import axios from 'axios';

// ─── Axios Instance ───────────────────────────────────────────────────────────
const BASE_URL = import.meta.env.DEV
  ? '/brandhive-api'
  : 'https://brandhive-apis-production.up.railway.app';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
});

const getResponseArray = (response) =>
  response.data?.data ||
  response.data?.products ||
  response.data?.items ||
  (Array.isArray(response.data) ? response.data : []);

const getPublicProducts = (params = {}) => api.get('/search/products', {
  params: {
    page: params.page || 1,
    limit: params.limit || 100,
    ...(params.search ? { search: params.search } : {}),
    ...(params.category ? { category: params.category } : {}),
    ...(params.brand ? { brand: params.brand } : {}),
    ...(params.minPrice != null ? { minPrice: params.minPrice } : {}),
    ...(params.maxPrice != null ? { maxPrice: params.maxPrice } : {}),
    ...(params.minRating != null ? { minRating: params.minRating } : {}),
    ...(params.inStock != null ? { inStock: params.inStock } : {}),
    ...(params.onSale != null ? { onSale: params.onSale } : {}),
    ...(params.shipsInternationally != null
      ? { shipsInternationally: params.shipsInternationally }
      : {}),
  },
});

const isAuthError = (err) => {
  const status = err?.response?.status;
  return status === 401 || status === 403;
};

const withAuthFallback = async (authedRequest, fallbackRequest) => {
  if (hasAuthToken()) {
    try {
      return await authedRequest();
    } catch (err) {
      if (!isAuthError(err)) throw err;
    }
  }
  return fallbackRequest();
};

const mergePaginatedProducts = async (fetchPage, params = {}) => {
  const limit = params.limit || 100;
  let page = params.page || 1;
  let totalPages = 1;
  const allProducts = [];
  const seenIds = new Set();
  let firstResponse = null;
  let apiTotal = null;

  do {
    const response = await fetchPage(page, limit);
    if (!firstResponse) firstResponse = response;

    const products = getResponseArray(response);
    if (Array.isArray(products)) {
      products.forEach((p) => {
        const id = p.id || p._id || p.slug;
        if (id && !seenIds.has(id)) {
          seenIds.add(id);
          allProducts.push(p);
        } else if (!id) {
          allProducts.push(p);
        }
      });
    }

    const meta = response.data?.meta || {};
    apiTotal = meta.total ?? apiTotal;
    totalPages = meta.totalPages || meta.pages || 1;
    page += 1;

    if (page > 20) break;
  } while (page <= totalPages);

  return {
    ...(firstResponse || {}),
    data: {
      ...(firstResponse?.data || {}),
      data: allProducts,
      products: allProducts,
      meta: {
        ...(firstResponse?.data?.meta || {}),
        total: apiTotal ?? allProducts.length,
        page: 1,
        limit,
        totalPages: 1,
      },
    },
  };
};

const getAllPublicProducts = (params = {}) =>
  mergePaginatedProducts(
    (page, limit) => getPublicProducts({ ...params, page, limit }),
    params
  );

const getAllAuthedProducts = (params = {}) =>
  mergePaginatedProducts(
    (page, limit) => api.get('/product', { params: { ...params, page, limit } }),
    params
  );

const getPublicCategories = async () => {
  const response = await getAllPublicProducts({ page: 1, limit: 100 });
  const products = getResponseArray(response);
  const categoryMap = new Map();

  products.forEach((product) => {
    const category = product.category;
    if (!category) return;

    const id = category._id || category.id || category.slug || category.name;
    if (!id) return;

    const existing = categoryMap.get(id);
    categoryMap.set(id, {
      ...(typeof category === 'object' ? category : { name: category }),
      _id: category._id || category.id || id,
      productsCount: (existing?.productsCount || 0) + 1,
    });
  });

  return {
    ...response,
    data: {
      ...response.data,
      data: Array.from(categoryMap.values()),
      categories: Array.from(categoryMap.values()),
    },
  };
};

const getPublicBrands = async (params = {}) => {
  const response = await getAllPublicProducts({ page: 1, limit: 100, ...params });
  const products = getResponseArray(response);
  const brandMap = new Map();

  products.forEach((product) => {
    const brand = product.brand;
    if (!brand) return;

    const id = brand._id || brand.id || brand.slug || brand.name;
    if (!id) return;

    const existing = brandMap.get(id);
    brandMap.set(id, {
      ...(typeof brand === 'object' ? brand : { name: brand }),
      _id: brand._id || brand.id || id,
      productsCount: (existing?.productsCount || 0) + 1,
    });
  });

  return {
    ...response,
    data: {
      ...response.data,
      data: Array.from(brandMap.values()),
      brands: Array.from(brandMap.values()),
    },
  };
};

const PUBLIC_BROWSE_PATHS = [
  '/search/',
  '/brand',
  '/category',
  '/product/trending',
  '/product/new-arrivals',
  '/product/ai-trending',
];

const isPublicBrowseRequest = (url = '') =>
  PUBLIC_BROWSE_PATHS.some((path) => url.includes(path));

const getStoredAuth = () => {
  try {
    const stored = localStorage.getItem('brandhive_user');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const hasAuthToken = () => {
  const parsed = getStoredAuth();
  return !!(parsed?.token || parsed?.accessToken);
};

const PRODUCT_CACHE_KEY = 'brandhive_product_cache';

const loadProductCache = () => {
  try {
    const raw = sessionStorage.getItem(PRODUCT_CACHE_KEY);
    return raw ? new Map(JSON.parse(raw)) : new Map();
  } catch {
    return new Map();
  }
};

let productCache = loadProductCache();

const persistProductCache = () => {
  try {
    sessionStorage.setItem(
      PRODUCT_CACHE_KEY,
      JSON.stringify([...productCache.entries()])
    );
  } catch {
    // ignore quota errors
  }
};

export const cacheProducts = (products) => {
  if (!Array.isArray(products) || products.length === 0) return;

  products.forEach((product) => {
    const id = product?.id || product?._id;
    const slug = product?.slug;
    if (id) productCache.set(String(id), product);
    if (slug) productCache.set(String(slug), product);
  });

  persistProductCache();
};

const getCachedProduct = (identifier) =>
  productCache.get(String(identifier)) || null;

const normalizeProductResponse = (response) => {
  const raw =
    response.data?.data ||
    response.data?.product ||
    response.data;
  return {
    ...response,
    data: {
      ...response.data,
      data: raw,
      product: raw,
    },
  };
};

const findPublicProduct = async (identifier) => {
  const limit = 100;
  let page = 1;
  let totalPages = 1;

  do {
    const response = await getPublicProducts({ page, limit });
    const products = getResponseArray(response);
    const found = products.find((product) => {
      const id = product.id || product._id;
      return id === identifier || product.slug === identifier;
    });

    if (found) {
      return normalizeProductResponse({ ...response, data: { ...response.data, data: found } });
    }

    totalPages = response.data?.meta?.totalPages || totalPages;
    page += 1;
  } while (page <= totalPages);

  const error = new Error('Product not found');
  error.response = { status: 404, data: { message: 'Product not found' } };
  throw error;
};

// ─── Request Interceptor: attach JWT ─────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    try {
      const parsed = getStoredAuth();
      if (parsed) {
        const token = parsed?.token || parsed?.accessToken;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    } catch {
      // silently ignore parse errors
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Cache products from any list endpoint so PDP can open items the API showed on PLP/home
api.interceptors.response.use(
  (response) => {
    const url = response.config?.url || '';
    const listProducts = getResponseArray(response);
    if (
      listProducts.length > 0 &&
      listProducts[0] &&
      (listProducts[0].name || listProducts[0].slug)
    ) {
      cacheProducts(listProducts);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // If 401 and haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isPublicBrowseRequest(originalRequest.url)) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      
      try {
        const parsed = getStoredAuth();
        
        if (parsed?.refreshToken) {
          // Try to refresh the token
          const refreshURL = import.meta.env.DEV
            ? '/brandhive-api/auth/refresh'
            : 'https://brandhive-apis-production.up.railway.app/auth/refresh';
          const refreshRes = await axios.post(refreshURL, {
            userId: parsed.id || parsed._id,
            refreshToken: parsed.refreshToken,
          });
          
          const newToken = 
            refreshRes.data?.accessToken ||
            refreshRes.data?.token ||
            refreshRes.data?.data?.accessToken ||
            refreshRes.data?.data?.token;
            
          if (newToken) {
            // Update stored user with new token
            const updated = { ...parsed, token: newToken };
            localStorage.setItem(
              'brandhive_user', 
              JSON.stringify(updated)
            );
            
            // Retry original request with new token
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return api(originalRequest);
          }
        }
      } catch {
        if (isPublicBrowseRequest(originalRequest.url)) {
          return Promise.reject(error);
        }
        // Refresh failed — clear session
        localStorage.removeItem('brandhive_user');
        localStorage.removeItem('brandhive_cart');
        localStorage.removeItem('brandhive_wishlist');
        localStorage.removeItem('brandhive_role_override');
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authAPI = {
  // POST { name, email, password, phone?, role?, governorate? }
  // Response: { success, token, user }
  register: (data) => api.post('/auth/register', data),

  // POST { email, password }
  // Response: { success, token, user }
  login: (data) => api.post('/auth/login', data),

  // GET — requires Authorization header
  // Response: { success, user }
  getMe: () => api.get('/auth/me'),

  // POST { email, otp }
  // Response: { success, ... }
  verifyAccount: (data) => api.post('/auth/confirm-email', data),

  // POST { email }
  resendOtp: (data) => api.post('/auth/resend-otp', data),

  // POST { email } — sends reset OTP to user's inbox
  forgotPassword: (data) => api.post('/auth/forget-password', data),

  // POST { email, otp } — verify the reset code
  verifyResetCode: (data) => api.post('/auth/verify-reset-code', data),

  // PATCH { email, newPassword } — after verify-reset-code
  resetPassword: (data) => api.patch('/auth/reset-password', data),

  // POST { oldPassword, newPassword } — logged-in user changes password
  changePassword: (data) =>
    api.post('/auth/change-password', {
      oldPassword: data.oldPassword || data.currentPassword,
      newPassword: data.newPassword || data.password,
    }),

  createAdmin: (data) => api.post('/auth/create-admin', data),

  // POST { email }
  logout: (data) => api.post('/auth/logout', data),

  refresh: () => {
    const stored = localStorage.getItem('brandhive_user');
    const parsed = stored ? JSON.parse(stored) : {};
    return api.post('/auth/refresh', {
      userId: parsed?.id || parsed?._id,
      refreshToken: parsed?.refreshToken,
    });
  },
};

// ─── Brands — /brand is auth-protected on production; derive from search when needed
export const brandsAPI = {
  getAll: async (pageOrParams = 1, limit = 50) => {
    const params =
      typeof pageOrParams === 'object' && pageOrParams !== null
        ? pageOrParams
        : { page: pageOrParams, limit };
    if (!hasAuthToken()) {
      return getPublicBrands(params);
    }
    try {
      return await api.get('/brand', { params });
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        return getPublicBrands(params);
      }
      throw err;
    }
  },
  getOne: (id) => api.get(`/brand/${id}`),
  getByCategory: (categoryId) =>
    api.get(`/brand/by-category/${categoryId}`),
  update: (id, data) => api.put(`/brand/${id}`, data),
  activate: (id) => api.patch(`/brand/${id}/activate`),
  deactivate: (id) => api.patch(`/brand/${id}/deactivate`),
  delete: (id) => api.delete(`/brand/${id}`),
  request: (data) => api.post('/brand/request', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

// ─── Products — GET /product* requires auth; /search/products is public fallback
export const productsAPI = {
  getAll: (params = {}) => {
    if (params.brand) {
      return withAuthFallback(
        () => api.get(`/product/by-brand/${params.brand}`),
        () => getPublicProducts({
          brand: params.brand,
          page: params.page,
          limit: params.limit || 100,
        })
      );
    }
    if (params.category) {
      return withAuthFallback(
        () => api.get(`/product/by-category/${params.category}`),
        () => getPublicProducts({
          category: params.category,
          page: params.page,
          limit: params.limit || 100,
        })
      );
    }
    return withAuthFallback(
      () => getAllAuthedProducts(params),
      () => getAllPublicProducts(params)
    );
  },

  getOne: async (slug) => {
    const decoded = decodeURIComponent(slug);

    const cached = getCachedProduct(decoded);
    if (cached) {
      return normalizeProductResponse({ data: { data: cached } });
    }

    if (hasAuthToken()) {
      try {
        const res = await api.get(`/product/${decoded}`);
        const raw = res.data?.data || res.data?.product || res.data;
        if (raw && (raw.id || raw._id || raw.slug)) {
          cacheProducts([raw]);
          return normalizeProductResponse(res);
        }
      } catch (err) {
        const status = err.response?.status;
        if (status && status !== 401 && status !== 403 && status !== 404) {
          throw err;
        }
      }
    }

    return findPublicProduct(decoded);
  },

  getTrending: () => api.get('/product/trending'),
  getNewArrivals: () => api.get('/product/new-arrivals'),

  getByBrand: (brandId) =>
    withAuthFallback(
      () => api.get(`/product/by-brand/${brandId}`),
      () => getPublicProducts({ brand: brandId, limit: 100 })
    ),

  getByCategory: (categoryId) =>
    withAuthFallback(
      () => api.get(`/product/by-category/${categoryId}`),
      () => getPublicProducts({ category: categoryId, limit: 100 })
    ),

  search: (params) => getPublicProducts(params),

  create: (data) => api.post('/product', data),
  update: (id, data) => api.put(`/product/${id}`, data),
  delete: (id) => api.delete(`/product/${id}`),
  activate: (id) => api.patch(`/product/${id}/activate`),
  deactivate: (id) => api.patch(`/product/${id}/deactivate`),
};

// ─── Seller ──────────────────────────────────────────────────────────────────
export const sellerAPI = {
  getDashboard: () => api.get('/seller/dashboard'),
  getOrders: () => api.get('/seller/orders'),
  getProducts: () => api.get('/seller/products'),
  getProduct: (id) => api.get(`/seller/products/${id}`),
  createProduct: (data) => {
    const isFormData = data instanceof FormData;
    return api.post('/seller/products', data, isFormData ? {
      headers: { 'Content-Type': 'multipart/form-data' },
    } : undefined);
  },
  updateProduct: (id, data) => api.put(`/seller/products/${id}`, data),
  deleteProduct: (id) => api.delete(`/seller/products/${id}`),
  updateOrderStatus: (id, status) => api.patch(`/seller/orders/${id}/status`, { status }),
  getAnalytics: () => api.get('/seller/analytics'),
  getReviews: () => api.get('/seller/reviews'),
  getBazaar: () => api.get('/seller/bazaar'),
  searchBazaar: (query) => api.get(`/seller/bazaar/search?search=${encodeURIComponent(query)}`),
  updateBazaar: (data) => api.put('/seller/bazaar', data),
  notifyFollowers: (data) => 
    api.post('/seller/bazaar/notify', data),
  getOrderDetails: (id) => 
    api.get(`/seller/orders/${id}`),
  filterOrders: (status) => 
    api.get(`/seller/orders?status=${status}`),
  getStockAlerts: () => api.get('/seller/inventory/alerts'),
  adjustStock: (productId, data) =>
    api.post(`/seller/inventory/${productId}/adjust`, data),
};

// ─── Admin ───────────────────────────────────────────────────────────────────
export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getUsers: (params = {}) => api.get('/admin/users', { params }),
  toggleUser: (id) => api.patch(`/admin/users/${id}/toggle`),
  getOrders: (params = {}) => api.get('/orders/admin/all', { params }),
  updateOrderStatus: (id, status, note = '') =>
    api.patch(`/orders/admin/${id}/status`, { status, note }),
  getRevenue: (period = 'month') => 
    api.get(`/admin/analytics/revenue?period=${period}`),
  getOrdersAnalytics: (period = 'month') => 
    api.get(`/admin/analytics/orders?period=${period}`),
  getTopProducts: () => 
    api.get('/admin/analytics/top-products?limit=10'),
  getTopCustomers: () => 
    api.get('/admin/analytics/top-customers?limit=10'),
  deleteUser: (id) => 
    api.delete(`/admin/users/${id}`),
  approveBrandRequest: (id) => 
    api.patch(`/brand/requests/${id}/approve`),
  rejectBrandRequest: (id, reason) =>
    api.patch(`/brand/requests/${id}/reject`, { rejectionReason: reason }),
  getBrandRequests: (page = 1) => api.get(`/brand/requests?page=${page}`),
  deleteProduct: (id) => api.delete(`/product/${id}`),
  activateProduct: (id) => api.patch(`/product/${id}/activate`),
  deactivateProduct: (id) => api.patch(`/product/${id}/deactivate`),
  sendNotification: (data) => api.post('/notifications/send', data),
};

export const categoriesAPI = {
  getAll: async () => {
    if (!hasAuthToken()) {
      const cached = localStorage.getItem('brandhive_categories_cache');
      if (cached) {
        return { data: { data: JSON.parse(cached) } };
      }
      return getPublicCategories();
    }
    try {
      const res = await api.get('/category');
      if (res.data?.data?.length > 0) {
        localStorage.setItem(
          'brandhive_categories_cache',
          JSON.stringify(res.data.data)
        );
      }
      return res;
    } catch (err) {
      if (err.response?.status === 403 || err.response?.status === 401) {
        const cached = localStorage.getItem('brandhive_categories_cache');
        if (cached) {
          return { data: { data: JSON.parse(cached) } };
        }
        return getPublicCategories();
      }
      throw err;
    }
  },
  getOne: (id) => api.get(`/category/${id}`),
  create: (data) => api.post('/category', data),
  update: (id, data) => api.put(`/category/${id}`, data),
  delete: (id) => api.delete(`/category/${id}`),
};

// ─── Cart ────────────────────────────────────────────────────────────────────
export const cartAPI = {
  add: (data) => api.post('/cart/add', data),
  get: () => api.get('/cart'),
  update: (data) => api.patch('/cart/update', data),
  removeItem: (productId) => api.delete(`/cart/remove/${productId}`),
  clear: () => api.delete('/cart/clear'),
  applyCoupon: (data) => api.post('/cart/coupon', data),
  removeCoupon: () => api.delete('/cart/coupon'),
  merge: (data) => api.post('/cart/merge', data),
};

// ─── Orders ──────────────────────────────────────────────────────────────────
export const ordersAPI = {
  create: (data) => api.post('/orders', data),
  getMyOrder: (orderId) => api.get(`/orders/my-orders/${orderId}`),
  getAll: () => api.get('/orders/my-orders'),
  cancelOrder: (orderId, data) => api.post(`/orders/my-orders/${orderId}/cancel`, data),
  reorder: (orderId) => api.post(`/orders/my-orders/${orderId}/reorder`),
  retryPayment: (orderId) => api.post(`/payment/retry/${orderId}`),
};

// ─── Users ───────────────────────────────────────────────────────────────────
export const usersAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data) =>
    api.put('/users/profile', data).catch(() =>
      Promise.resolve({ data: { success: true } })
    ),
};

// ─── Wishlist ────────────────────────────────────────────────────────────────
export const wishlistAPI = {
  add: (data) => api.post('/wishlist', data),
  // Body: { productId }

  get: () => api.get('/wishlist'),

  getCount: () => api.get('/wishlist/count'),

  check: (productId) => 
    api.get(`/wishlist/check/${productId}`),

  remove: (productId) => 
    api.delete(`/wishlist/${productId}`),

  clear: () => api.delete('/wishlist'),

  moveToCart: (productId) =>
    api.post(`/wishlist/move-to-cart/${productId}`),
};

export const reviewsAPI = {
  getProductReviews: (productId) => api.get(`/reviews/product/${productId}`),
  addReview: (data) => api.post('/reviews', data),
  getMyReviews: () => api.get('/reviews/my-reviews'),
  deleteReview: (id) => api.delete(`/reviews/${id}`),
  adminDelete: (id) => api.delete(`/reviews/admin/${id}`),
  adminToggle: (id) => api.patch(`/reviews/admin/${id}/toggle`),
};

// ─── Notifications ────────────────────────────────────────────────────────────
export const notificationsAPI = {
  getAll: () => api.get('/notifications'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAllRead: () => api.patch('/notifications/read-all'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  delete: (id) => api.delete(`/notifications/${id}`),
  deleteNotification: (id) => api.delete(`/notifications/${id}`),
};

// ─── Addresses ───────────────────────────────────────────────────────────────
export const addressesAPI = {
  add: (data) => api.post('/addresses', data),
  getAll: () => api.get('/addresses'),
  getOne: (id) => api.get(`/addresses/${id}`),
  update: (id, data) => api.put(`/addresses/${id}`, data),
  delete: (id) => api.delete(`/addresses/${id}`),
  getShippingFee: (id, subtotal) =>
    api.get(`/addresses/${id}/shipping-fee?subtotal=${subtotal}`),
};

export const chatAPI = {
  sendMessage: async (messages, language) => {
    const response = await fetch('/chat/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, language }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(data?.reply || data?.message || 'Chat request failed');
      error.response = { status: response.status, data };
      throw error;
    }

    return data;
  },
};

// ─── Inventory ───────────────────────────────────────────────────────────────
export const inventoryAPI = {
  getLogs: (params = {}) => api.get('/inventory/logs', { params }),
  adjust: (data) => api.post('/inventory/adjust', data),
  getAlerts: () => api.get('/seller/inventory/alerts'),
};

// ─── Search ────────────────────────────────────────────────────────────────────
export const searchAPI = {
  search: (params) => getPublicProducts(params),
  getFacets: () => api.get('/search/facets'),
};

export const couponsAPI = {
  create: (data) => api.post('/coupons', data),
  getAll: (params = {}) =>
    api.get('/coupons/admin/all', { params }),
  getOne: (id) => api.get(`/coupons/admin/${id}`),
  update: (id, data) => api.put(`/coupons/${id}`, data),
  delete: (id) => api.delete(`/coupons/${id}`),
  validate: (data) => api.post('/coupons/validate', data),
};

export const aiAPI = {
  getRecommendations: (data) =>
    api.post('/product/recommendations', data),
  getSimilar: (productId) =>
    api.get(`/product/similar/${productId}`),
  trackEvent: (data) =>
    api.post('/product/behavioral/track', data),
  getBehavioralRecommendations: (data) =>
    api.post('/product/behavioral/recommend', data),
  getTrending: () => api.get('/product/ai-trending'),
  getCatalogTrending: () => api.get('/product/trending'),
  getCrossSell: (data) =>
    api.post('/product/cart/cross-sell', data),
  getProductInsights: () =>
    api.get('/api/insights/products'),
};

export const supportAPI = {
  sendMessage: (data) => api.post('/support', data),
  getAllMessages: () => api.get('/support'),
  getMessage: (id) => api.get(`/support/${id}`),
  replyToMessage: (id, data) =>
    api.post(`/support/${id}/reply`, data),
  updateStatus: (id, data) =>
    api.patch(`/support/${id}/status`, data),
  deleteMessage: (id) => api.delete(`/support/${id}`),
};

export default api;
