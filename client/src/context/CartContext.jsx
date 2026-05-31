import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { cartAPI, wishlistAPI } from '../services/api';
import { useAuth } from './AuthContext';

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

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState([]);
  const { isAuthenticated, isCustomer } = useAuth();

  useEffect(() => {
    const stored = localStorage.getItem('brandhive_cart');
    if (stored) {
      try { setItems(JSON.parse(stored)); } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('brandhive_cart', JSON.stringify(items));
  }, [items]);

  // Fetch cart from API (when logged in)
  const fetchCart = useCallback(async () => {
    // Cart API is customer-only; seller/admin JWTs get 403
    if (!isAuthenticated || !isCustomer) return;
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
      if (Array.isArray(cartItems) && cartItems.length > 0) {
        // Map API items to local format
        const mapped = cartItems.map(item => ({
          key: item._id || item.productId,
          id: item.productId?._id || item.productId,
          name: item.productId?.name || item.name,
          price: Number(
            item.productId?.finalPrice ||
            item.productId?.discountPrice ||
            item.productId?.price ||
            item.price ||
            0
          ),
          quantity: Number(item.quantity) || 1,
          brandName: item.productId?.brand?.name || '',
          brandSlug: item.productId?.brand?.slug || '',
          category: item.productId?.category?.name || '',
          image: item.productId?.mainImage || item.productId?.images?.[0] || item.image || null,
        }));
        setItems(mapped);
        localStorage.setItem(
          'brandhive_cart', 
          JSON.stringify(mapped)
        );
      }
    } catch {
      // API failed — keep localStorage items
    }
  }, [isAuthenticated, isCustomer]);

  // Fetch cart on mount and when auth changes
  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  // addToCart — call API if logged in
  const addToCart = async (product, quantity = 1, options = {}) => {
    const key = `${product.id}-${options.size||''}-${options.color||''}`;
    
    // Optimistic local update first
    setItems(prev => {
      const existing = prev.find(i => i.key === key);
      if (existing) {
        return prev.map(i => 
          i.key === key 
            ? { ...i, quantity: i.quantity + quantity } 
            : i
        );
      }
      return [...prev, { ...product, quantity, options, key }];
    });

    // Only sync with API if product has real MongoDB ID
    if (isAuthenticated && isCustomer && isValidMongoId(product.id)) {
      try {
        await cartAPI.add({ 
          productId: product.id, 
          quantity 
        });
      } catch {
        // Silent fail — local state already updated
      }
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
    localStorage.removeItem('brandhive_cart');
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
  const { isAuthenticated, isCustomer } = useAuth();

  // Helper: check if valid MongoDB ID
  const isValidMongoId = (id) =>
    id && typeof id === 'string' && 
    /^[a-f\d]{24}$/i.test(id);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('brandhive_wishlist');
    if (stored) {
      try { setItems(JSON.parse(stored)); } catch {}
    }
  }, []);

  // Sync localStorage when items change
  useEffect(() => {
    localStorage.setItem(
      'brandhive_wishlist', 
      JSON.stringify(items)
    );
  }, [items]);

  // Fetch wishlist from API when logged in
  const fetchWishlist = useCallback(async () => {
    if (!isAuthenticated || !isCustomer) return;
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

      if (list.length === 0) return;

      const mapped = await Promise.all(
        list.map(async (item) => {
          if (
            item.productId &&
            typeof item.productId === 'object' &&
            item.productId.name
          ) {
            return {
              id: item.productId._id || item.productId.id,
              name: item.productId.name,
              price:
                item.productId.finalPrice ||
                item.productId.price ||
                0,
              image:
                item.productId.mainImage ||
                item.productId.images?.[0] ||
                null,
              brandName: item.productId.brand?.name || '',
              brandSlug: item.productId.brand?.slug || '',
              slug: item.productId.slug || '',
              category: item.productId.category?.name || '',
            };
          }

          const productId =
            item.productId || item._id || item.product;
          if (!productId) return null;

          try {
            const { productsAPI } = await import('../services/api');
            const prodRes = await productsAPI.getOne(productId);
            const p = prodRes.data?.data || prodRes.data;
            if (!p) return null;
            return {
              id: p.id || p._id,
              name: p.name,
              price: p.finalPrice || p.price || 0,
              image: p.mainImage || p.images?.[0] || null,
              brandName: p.brand?.name || '',
              brandSlug: p.brand?.slug || '',
              slug: p.slug || '',
              category: p.category?.name || '',
            };
          } catch {
            return null;
          }
        })
      );

      const validItems = mapped.filter(Boolean);
      if (validItems.length > 0) {
        setItems(validItems);
        localStorage.setItem(
          'brandhive_wishlist',
          JSON.stringify(validItems)
        );
      }
    } catch {
      // Keep localStorage items on failure
    }
  }, [isAuthenticated, isCustomer]);

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

  // Clear wishlist
  const clearWishlist = async () => {
    setItems([]);
    localStorage.removeItem('brandhive_wishlist');
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
      clearWishlist,
      fetchWishlist,
      loading,
    }}>
      {children}
    </WishlistContext.Provider>
  );
};
