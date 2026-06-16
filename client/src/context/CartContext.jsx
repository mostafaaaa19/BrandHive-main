import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { cartAPI, wishlistAPI, aiAPI } from '../services/api';
import { useAuth } from './AuthContext';
import { mapProduct } from '../utils/mappers';

const CartContext = createContext(null);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
};

const WishlistContext = createContext(null);
export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) throw new Error('useWishlist must be used within WishlistProvider');
  return context;
};

const isValidMongoId = (id) => 
  id && typeof id === 'string' && 
  /^[a-f\d]{24}$/i.test(id);

const CART_STORAGE_KEY = 'brandhive_cart';
const WISHLIST_STORAGE_KEY = 'brandhive_wishlist';

const getScopedStorageKey = (baseKey, userId) =>
  userId ? `${baseKey}_${userId}` : `${baseKey}_guest`;

const readScopedStorage = (baseKey, userId) => {
  const scoped = localStorage.getItem(getScopedStorageKey(baseKey, userId));
  if (scoped) {
    try {
      return JSON.parse(scoped);
    } catch {
      return [];
    }
  }

  if (userId) {
    const legacy = localStorage.getItem(baseKey);
    if (legacy) {
      try {
        return JSON.parse(legacy);
      } catch {
        return [];
      }
    }
  }

  return [];
};

const writeScopedStorage = (baseKey, userId, items) => {
  localStorage.setItem(getScopedStorageKey(baseKey, userId), JSON.stringify(items));
};

const clearScopedStorage = (baseKey, userId) => {
  if (userId) {
    localStorage.removeItem(getScopedStorageKey(baseKey, userId));
  }
  localStorage.removeItem(baseKey);
};

const mapApiCartItem = (item) => ({
  key: item.product?.id || item._id || item.productId?._id || item.productId,
  id: item.product?.id || item._id || item.id || item.productId?._id,
  productId: item.product?.id || item.productId,
  name: item.product?.name || item.productId?.name || item.name || '',
  price: Number(
    item.effectivePrice ||
    item.lockedPrice ||
    item.currentPrice ||
    item.product?.price ||
    item.productId?.finalPrice ||
    item.productId?.price ||
    item.price ||
    0
  ),
  quantity: Number(item.quantity) || 1,
  image: item.product?.image ||
    item.product?.images?.[0] ||
    item.productId?.images?.[0]?.url ||
    item.image || null,
  slug: item.product?.slug || item.productId?.slug || item.slug || '',
  brandName: item.product?.brand?.name || item.productId?.brand?.name || item.brandName || '',
  brandId:
    item.product?.brand?._id ||
    item.product?.brand?.id ||
    item.productId?.brand?._id ||
    item.productId?.brand?.id ||
    item.brandId ||
    '',
  brandSlug: item.product?.brand?.slug || item.productId?.brand?.slug || '',
  category: item.product?.category?.name || item.productId?.category?.name || '',
});

const normalizeCartItems = (items) => {
  const byProduct = new Map();

  items.forEach((item) => {
    const productId = String(item.id || item.productId || '');
    if (!productId) return;

    const existing = byProduct.get(productId);
    if (existing) {
      existing.quantity += Number(item.quantity) || 1;
      return;
    }

    byProduct.set(productId, {
      ...item,
      id: productId,
      productId,
      key: productId,
      quantity: Number(item.quantity) || 1,
    });
  });

  return Array.from(byProduct.values());
};

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState([]);
  const { isAuthenticated, isCustomer, user } = useAuth();
  const userId = user?.id || user?._id || null;

  useEffect(() => {
    if (!userId) {
      setItems([]);
      return;
    }
    setItems(readScopedStorage(CART_STORAGE_KEY, userId));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    writeScopedStorage(CART_STORAGE_KEY, userId, items);
  }, [items, userId]);

  // Fetch cart from API (when logged in)
  const fetchCart = useCallback(async () => {
    // Cart API is customer-only; seller/admin JWTs get 403
    if (!isAuthenticated || !isCustomer) return null;
    try {
      const res = await cartAPI.get();
      const data = res.data;
      // Handle both { data: { items: [] } } 
      // and { items: [] } and { data: [] }
      const cartItems = 
        data?.data?.items || 
        data?.items || 
        data?.data || 
        [];

      if (!Array.isArray(cartItems)) return null;

      if (cartItems.length === 0) {
        setItems([]);
        clearScopedStorage(CART_STORAGE_KEY, userId);
        return [];
      }

      const mapped = cartItems.map(mapApiCartItem);
      const normalized = normalizeCartItems(mapped);

      if (normalized.length !== mapped.length) {
        await Promise.allSettled(
          normalized.map((item) =>
            cartAPI.update({
              productId: item.id,
              quantity: item.quantity,
            })
          )
        );
      }

      setItems(normalized);
      writeScopedStorage(CART_STORAGE_KEY, userId, normalized);
      return normalized;
    } catch {
      return null;
    }
  }, [isAuthenticated, isCustomer, userId]);

  // Fetch cart on mount and when auth changes
  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  // addToCart — call API if logged in
  const addToCart = async (product, quantity = 1, options = {}) => {
    const productId = String(product.id || '');
    const key = `${productId}-${options.size||''}-${options.color||''}`;

    if (isAuthenticated && isCustomer && isValidMongoId(productId)) {
      try {
        await cartAPI.add({ productId, quantity });
        const storedUser = JSON.parse(
          localStorage.getItem('brandhive_user') || '{}'
        );
        const userId = storedUser?.id || storedUser?._id;
        if (userId) {
          aiAPI.trackEvent({
            user_id: userId,
            product_id: product.id,
            event: 'cart',
          }).catch(() => {});
        }
        await fetchCart();
      } catch {
        setItems(prev => {
          const existing = prev.find(i => i.key === key);
          if (existing) {
            return prev.map(i => i.key === key ? { ...i, quantity: i.quantity + quantity } : i);
          }
          return [...prev, { ...product, quantity, options, key }];
        });
      }
    } else {
      setItems(prev => {
        const existing = prev.find(i => i.key === key);
        if (existing) {
          return prev.map(i => i.key === key ? { ...i, quantity: i.quantity + quantity } : i);
        }
        return [...prev, { ...product, quantity, options, key }];
      });
    }
  };

  // removeFromCart — call API if logged in
  const removeFromCart = async (key) => {
    const item = items.find(i => i.key === key);
    setItems(prev => prev.filter(i => i.key !== key));
    
    if (isAuthenticated && isCustomer && isValidMongoId(item?.id)) {
      try {
        await cartAPI.removeItem(item.id);
      } catch {
        // Silent fail
      }
    }
  };

  // updateQuantity — call API if logged in
  const updateQuantity = async (key, quantity) => {
    if (quantity <= 0) { 
      removeFromCart(key); 
      return; 
    }
    const item = items.find(i => i.key === key);
    setItems(prev => 
      prev.map(i => i.key === key ? { ...i, quantity } : i)
    );
    
    if (isAuthenticated && isCustomer && isValidMongoId(item?.id)) {
      try {
        await cartAPI.update({ 
          productId: item.id, 
          quantity 
        });
      } catch {
        // Silent fail
      }
    }
  };

  // clearCart — call API if logged in
  const clearCart = async () => {
    setItems([]);
    clearScopedStorage(CART_STORAGE_KEY, userId);
    if (isAuthenticated && isCustomer) {
      try {
        await cartAPI.clear();
      } catch {
        // Silent fail
      }
    }
  };

  const total = items.reduce((sum, item) => {
    const price = Number(item.price) || 0;
    const qty = Number(item.quantity) || 0;
    return sum + price * qty;
  }, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = total;

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, total, subtotal, itemCount, fetchCart }}>
      {children}
    </CartContext.Provider>
  );
};

export const WishlistProvider = ({ children }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated, isCustomer, user } = useAuth();
  const userId = user?.id || user?._id || null;
  const prevUserIdRef = useRef(userId);

  useEffect(() => {
    const previousUserId = prevUserIdRef.current;
    prevUserIdRef.current = userId;

    if (!userId) {
      if (previousUserId) {
        setItems([]);
        return;
      }
      setItems(readScopedStorage(WISHLIST_STORAGE_KEY, null));
      return;
    }

    setItems(readScopedStorage(WISHLIST_STORAGE_KEY, userId));
  }, [userId]);

  useEffect(() => {
    writeScopedStorage(WISHLIST_STORAGE_KEY, userId, items);
  }, [items, userId]);

  // Fetch wishlist from API when logged in
  const fetchWishlist = useCallback(async () => {
    if (!isAuthenticated || !isCustomer || !userId) return;
    try {
      const res = await wishlistAPI.get();
      const data =
        res.data?.data?.items ||
        res.data?.data ||
        res.data?.wishlist ||
        res.data?.items ||
        res.data ||
        [];
      const list = Array.isArray(data) ? data : [];

      if (list.length === 0) {
        setItems([]);
        writeScopedStorage(WISHLIST_STORAGE_KEY, userId, []);
        clearScopedStorage(WISHLIST_STORAGE_KEY, null);
        return;
      }

      const mapWishlistItem = (item) => {
        const prod = item.product || item.productId;
        if (!prod || typeof prod !== 'object') return null;
        const mapped = mapProduct(prod);
        return mapped.id ? mapped : null;
      };

      const extractWishlistProductId = (item) => {
        const prod = item.product || item.productId;
        if (prod && typeof prod === 'object') {
          return prod._id || prod.id || null;
        }
        return typeof item.productId === 'string' ? item.productId : null;
      };

      const mapped = await Promise.all(
        list.map(async (item) => {
          const quick = mapWishlistItem(item);
          const productId = extractWishlistProductId(item);
          const needsFullProduct =
            !quick?.name || !quick?.price || !quick?.image;

          if (!needsFullProduct) return quick;
          if (!productId || !isValidMongoId(String(productId))) {
            return quick?.name ? quick : null;
          }

          try {
            const { productsAPI } = await import('../services/api');
            const prodRes = await productsAPI.getOne(productId);
            const p = prodRes.data?.data || prodRes.data?.product || prodRes.data;
            if (!p) return quick;
            return mapWishlistItem({ product: p, _id: item._id }) || quick;
          } catch {
            return quick;
          }
        })
      );

      const validItems = mapped.filter(Boolean);
      setItems(validItems);
      writeScopedStorage(WISHLIST_STORAGE_KEY, userId, validItems);
    } catch {
      // Keep this account's cached items on failure
    }
  }, [isAuthenticated, isCustomer, userId]);

  // Fetch on mount and auth change
  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  // Toggle wishlist item
  const toggleWishlist = async (product) => {
    const exists = items.some(i => i.id === product.id);

    // Optimistic local update
    if (exists) {
      setItems(prev => prev.filter(i => i.id !== product.id));
    } else {
      setItems(prev => [...prev, product]);
    }

    // Sync with API if logged in and valid ID
    if (isAuthenticated && isCustomer && isValidMongoId(product.id)) {
      try {
        if (exists) {
          await wishlistAPI.remove(product.id);
        } else {
          await wishlistAPI.add({ productId: product.id });
        }
      } catch {
        // Revert on failure
        if (exists) {
          setItems(prev => [...prev, product]);
        } else {
          setItems(prev => 
            prev.filter(i => i.id !== product.id)
          );
        }
      }
    }
  };

  // Move item to cart
  const moveToCart = async (productId, addToCartFn) => {
    const item = items.find(i => i.id === productId);
    if (!item) return;

    if (isAuthenticated && isCustomer && isValidMongoId(productId)) {
      try {
        await wishlistAPI.moveToCart(productId);
        setItems(prev => prev.filter(i => i.id !== productId));
        return;
      } catch {
        // Fallback to local
      }
    }

    // Local fallback
    if (addToCartFn) addToCartFn(item, 1);
    setItems(prev => prev.filter(i => i.id !== productId));
  };

  const moveAllToCart = async (addToCartFn) => {
    if (items.length === 0) return;

    if (isAuthenticated && isCustomer) {
      try {
        await wishlistAPI.moveAllToCart({});
        if (addToCartFn) {
          items.forEach((item) => addToCartFn(item, 1));
        }
        setItems([]);
        clearScopedStorage(WISHLIST_STORAGE_KEY, userId);
        return;
      } catch {
        // fall through to per-item local move
      }
    }

    const snapshot = [...items];
    snapshot.forEach((item) => {
      if (addToCartFn) addToCartFn(item, 1);
    });
    setItems([]);
    clearScopedStorage(WISHLIST_STORAGE_KEY, userId);
  };

  // Clear wishlist
  const clearWishlist = async () => {
    setItems([]);
    clearScopedStorage(WISHLIST_STORAGE_KEY, userId);
    if (isAuthenticated && isCustomer) {
      try {
        await wishlistAPI.clear();
      } catch {}
    }
  };

  const isInWishlist = (productId) => 
    items.some(i => i.id === productId);
  
  const itemCount = items.length;

  return (
    <WishlistContext.Provider value={{ 
      items, 
      toggleWishlist, 
      isInWishlist, 
      itemCount,
      moveToCart,
      moveAllToCart,
      clearWishlist,
      fetchWishlist,
      loading,
    }}>
      {children}
    </WishlistContext.Provider>
  );
};
