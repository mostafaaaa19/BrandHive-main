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
  },
});

const getAllPublicProducts = async (params = {}) => {
  const limit = params.limit || 100;
  let page = params.page || 1;
  let totalPages = 1;
  const allProducts = [];
  const seenIds = new Set();
  let firstResponse = null;

  do {
    const response = await getPublicProducts({ ...params, page, limit });
    if (!firstResponse) firstResponse = response;

    const products = getResponseArray(response);
    if (Array.isArray(products)) {
      products.forEach(p => {
        const id = p.id || p._id || p.slug;
        if (id && !seenIds.has(id)) {
          seenIds.add(id);
          allProducts.push(p);
        } else if (!id) {
          allProducts.push(p);
        }
      });
    }

    totalPages =
      response.data?.meta?.totalPages ||
      response.data?.meta?.pages ||
      1;
    page += 1;

    if (page > 10) break;
  } while (page <= totalPages);

  return {
    ...(firstResponse || {}),
    data: {
      ...(firstResponse?.data || {}),
      data: allProducts,
      products: allProducts,
      meta: {
        ...(firstResponse?.data?.meta || {}),
        total: allProducts.length,
        page: 1,
        limit,
        totalPages: 1,
      },
    },
  };
};

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
      return {
        ...response,
        data: {
          ...response.data,
          data: found,
          product: found,
        },
      };
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
      const stored = localStorage.getItem('brandhive_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.token) {
          config.headers.Authorization = `Bearer ${parsed.token}`;
        }
      }
    } catch {
      // silently ignore parse errors
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor: handle 401 ────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If 401 and haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const stored = localStorage.getItem('brandhive_user');
        const parsed = stored ? JSON.parse(stored) : null;
        
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

  // PATCH { email, newPassword } — set a new password
  resetPassword: (data) => api.patch('/auth/reset-password', data),

  // POST { oldPassword, newPassword }
  changePassword: (data) => api.post('/auth/change-password', data),

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

// ─── Brands — backend returns empty; keep using mockData ─────────────────────
export const brandsAPI = {
  getAll: (pageOrParams = 1, limit = 50) => {
    if (typeof pageOrParams === 'object' && pageOrParams !== null) {
      return api.get('/brand', { params: pageOrParams });
    }
    return api.get('/brand', { params: { page: pageOrParams, limit } });
  },
  getOne: (id) => api.get(`/brand/${id}`),
  getByCategory: (categoryId) => 
    api.get(`/brand/by-category/${categoryId}`),
  request: (data) => api.post('/brand/request', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

// ─── Products — backend returns empty; keep using mockData ───────────────────
export const productsAPI = {
  // The public product controller is protected on the live API, while search is public.
  // Use search for browsing and fall back to it for details so PLP/PDP work without auth.
  getAll: (params = {}) => getAllPublicProducts(params),
  getOne: (slug) => findPublicProduct(slug),
  getTrending: () => api.get('/product/trending'),
  getNewArrivals: () => api.get('/product/new-arrivals'),
  getByBrand: (brandId) => 
    getPublicProducts({ brand: brandId, limit: 100 }),
  getByCategory: (categoryId) => 
    getPublicProducts({ category: categoryId, limit: 100 }),
  search: (params) => 
    getPublicProducts(params),
};

// ─── Seller ──────────────────────────────────────────────────────────────────
export const sellerAPI = {
  getDashboard: () => api.get('/seller/dashboard'),
  getOrders: () => api.get('/seller/orders'),
  getProducts: () => api.get('/seller/products'),
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
  updateBazaar: (data) => api.put('/seller/bazaar', data),
  notifyFollowers: (data) => 
    api.post('/seller/bazaar/notify', data),
  getOrderDetails: (id) => 
    api.get(`/seller/orders/${id}`),
  filterOrders: (status) => 
    api.get(`/seller/orders?status=${status}`),
};

// ─── Admin ───────────────────────────────────────────────────────────────────
export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getUsers: (params = {}) => api.get('/admin/users', { params }),
  toggleUser: (id) => api.patch(`/admin/users/${id}/toggle`),
  getOrders: (params = {}) => api.get('/orders/admin/all', { params }),
  getBrands: (params = {}) => api.get('/admin/brands', { params }),
  verifyBrand: (id) => api.patch(`/admin/brands/${id}/verify`),
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
  getAll: () => getPublicCategories(),
  getOne: (id) => api.get(`/category/${id}`),
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
};

// ─── Notifications ────────────────────────────────────────────────────────────
export const notificationsAPI = {
  getAll: () => api.get('/notifications'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAllRead: () => api.patch('/notifications/read-all'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  delete: (id) => api.delete(`/notifications/${id}`),
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
  sendMessage: (messages, language) =>
    fetch('/chat/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, language }),
    }).then(r => r.json()),
};

export default api;
