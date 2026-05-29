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
  const { isAuthenticated } = useAuth();

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
    if (!isAuthenticated) return;
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
          price: item.productId?.price || item.price,
          quantity: item.quantity,
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
  }, [isAuthenticated]);

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
    if (isAuthenticated && isValidMongoId(product.id)) {
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
    
    if (isAuthenticated && isValidMongoId(item?.id)) {
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
    
    if (isAuthenticated && isValidMongoId(item?.id)) {
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
    if (isAuthenticated) {
      try {
        await cartAPI.clear();
      } catch {
        // Silent fail
      }
    }
  };

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
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
  const { isAuthenticated } = useAuth();

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
    if (!isAuthenticated) return;
    try {
      const res = await wishlistAPI.get();
      const data = res.data;
      const list = 
        data?.data?.items ||
        data?.data ||
        data?.items ||
        data?.wishlist ||
        [];
      if (Array.isArray(list) && list.length > 0) {
        const mapped = list.map(item => ({
          id: item.productId?._id || item.productId || item._id,
          name: item.productId?.name || item.name,
          price: item.productId?.price || item.price,
          image: item.productId?.images?.[0] || null,
          brandName: item.productId?.brand?.name || '',
          slug: item.productId?.slug || '',
          category: item.productId?.category?.name || '',
        }));
        setItems(mapped);
        localStorage.setItem(
          'brandhive_wishlist',
          JSON.stringify(mapped)
        );
      }
    } catch {
      // Keep localStorage items on failure
    }
  }, [isAuthenticated]);

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
    if (isAuthenticated && isValidMongoId(product.id)) {
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

    if (isAuthenticated && isValidMongoId(productId)) {
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
    if (isAuthenticated) {
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
