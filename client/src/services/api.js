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

// Railway rejects ?limit>100 on /search/products and /product
const MAX_PRODUCT_PAGE_SIZE = 100;
const clampPageLimit = (limit) =>
  Math.min(Math.max(Number(limit) || MAX_PRODUCT_PAGE_SIZE, 1), MAX_PRODUCT_PAGE_SIZE);

// Local dev server mirrors support tickets so users can read admin replies
// (Railway GET /support is admin-only for regular accounts).
const localSupport = import.meta.env.DEV
  ? axios.create({
      baseURL: '/support-local',
      headers: { 'Content-Type': 'application/json' },
      withCredentials: false,
    })
  : null;

const localSellerOrders = import.meta.env.DEV
  ? axios.create({
      baseURL: '/orders-local',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      withCredentials: false,
    })
  : null;

const localSellerPayouts = import.meta.env.DEV
  ? axios.create({
      baseURL: '/payouts-local',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      withCredentials: false,
    })
  : null;

const localProductImages = import.meta.env.DEV
  ? axios.create({
      baseURL: '/product-images-local',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      withCredentials: false,
    })
  : null;

const localAuditLog = import.meta.env.DEV
  ? axios.create({
      baseURL: '/audit-local',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      withCredentials: false,
    })
  : null;

const productImageMirrorCache = new Map();

const SELLER_ORDERS_STORAGE_KEY = 'brandhive_seller_orders_mirror';
const PRODUCT_IMAGES_STORAGE_KEY = 'brandhive_product_images_mirror';
const sellerPayoutStorageKey = (userId) =>
  `brandhive_seller_payout_${userId || 'default'}`;
const PLATFORM_FEE_RATE = 0.05;

const readStoredSellerOrders = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(SELLER_ORDERS_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeStoredSellerOrder = (order) => {
  if (!order) return;
  const id = String(order.railwayOrderId || order._id || order.id || '');
  if (!id) return;

  const list = readStoredSellerOrders().filter(
    (entry) => String(entry.railwayOrderId || entry._id || entry.id) !== id
  );
  list.unshift({
    ...order,
    _id: id,
    railwayOrderId: order.railwayOrderId || id,
    createdAt: order.createdAt || new Date().toISOString(),
  });
  try {
    localStorage.setItem(SELLER_ORDERS_STORAGE_KEY, JSON.stringify(list.slice(0, 500)));
  } catch {
    // ignore quota errors
  }
};

const readPayoutStore = (sellerUserId) => {
  if (!sellerUserId) return { profile: null, withdrawals: [] };
  try {
    const parsed = JSON.parse(
      localStorage.getItem(sellerPayoutStorageKey(sellerUserId)) || '{}'
    );
    return {
      profile: parsed.profile || null,
      withdrawals: Array.isArray(parsed.withdrawals) ? parsed.withdrawals : [],
    };
  } catch {
    return { profile: null, withdrawals: [] };
  }
};

const writePayoutStore = (sellerUserId, store) => {
  if (!sellerUserId) return;
  try {
    localStorage.setItem(
      sellerPayoutStorageKey(sellerUserId),
      JSON.stringify({
        profile: store.profile || null,
        withdrawals: Array.isArray(store.withdrawals) ? store.withdrawals : [],
      })
    );
  } catch {
    // ignore quota errors
  }
};

const activeOrderTotal = (orders = []) =>
  orders
    .filter(
      (order) =>
        !['canceled', 'cancelled'].includes(String(order.status || '').toLowerCase())
    )
    .reduce(
      (sum, order) =>
        sum + (Number(order.totalAmount) || Number(order.subtotal) || 0),
      0
    );

const computeClientPayoutSummary = (orders = [], withdrawals = []) => {
  const grossRevenue = activeOrderTotal(orders);
  const platformFee = Math.round(grossRevenue * PLATFORM_FEE_RATE);
  const netEarnings = grossRevenue - platformFee;
  const pendingWithdrawal = withdrawals
    .filter((entry) => ['pending', 'approved'].includes(entry.status))
    .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
  const totalWithdrawn = withdrawals
    .filter((entry) => entry.status === 'paid')
    .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
  const availableBalance = Math.max(0, netEarnings - pendingWithdrawal - totalWithdrawn);

  return {
    grossRevenue,
    platformFee,
    netEarnings,
    availableBalance,
    pendingWithdrawal,
    totalWithdrawn,
    withdrawals,
  };
};

const orderMatchesBrandIds = (order, brandIds = []) => {
  if (!brandIds.length) return true;
  const ids = brandIds.map(String);
  if (Array.isArray(order.brandIds) && order.brandIds.some((id) => ids.includes(String(id)))) {
    return true;
  }
  return (order.items || []).some((item) =>
    ids.includes(String(item.brandId || item.brand?._id || item.brand?.id || ''))
  );
};

const persistProductImageMirror = (entry) => {
  if (!entry?.productId) return;
  productImageMirrorCache.set(String(entry.productId), entry);
  try {
    const raw = localStorage.getItem(PRODUCT_IMAGES_STORAGE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[String(entry.productId)] = entry;
    localStorage.setItem(PRODUCT_IMAGES_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota errors
  }
};

try {
  const storedImages = JSON.parse(localStorage.getItem(PRODUCT_IMAGES_STORAGE_KEY) || '{}');
  Object.entries(storedImages).forEach(([id, entry]) => {
    if (entry) productImageMirrorCache.set(String(id), entry);
  });
} catch {
  // ignore corrupt cache
}

export const lookupProductBrand = async (productId) => {
  if (!productId) return null;

  try {
    const res = await api.get(`/product/${encodeURIComponent(productId)}`);
    const raw = res.data?.data || res.data?.product || res.data;
    const brandId = raw?.brand?._id || raw?.brand?.id;
    if (brandId) {
      return {
        brandId: String(brandId),
        brandName: raw?.brand?.name || '',
      };
    }
  } catch {
    // fall through to public search
  }

  try {
    const searchRes = await getPublicProducts({ limit: MAX_PRODUCT_PAGE_SIZE });
    const found = getResponseArray(searchRes).find(
      (product) => String(product.id || product._id) === String(productId)
    );
    const brandId = found?.brand?._id || found?.brand?.id;
    if (brandId) {
      return {
        brandId: String(brandId),
        brandName: found?.brand?.name || '',
      };
    }
  } catch {
    // ignore lookup errors
  }

  return null;
};

const getResponseArray = (response) =>
  response.data?.data ||
  response.data?.products ||
  response.data?.items ||
  (Array.isArray(response.data) ? response.data : []);

const getPublicProducts = (params = {}) => api.get('/search/products', {
  params: {
    page: params.page || 1,
    limit: clampPageLimit(params.limit),
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

const pickResponseProducts = (response) => getResponseArray(response);

const verifyCatalogProduct = async (productId) => {
  if (!productId) return null;

  try {
    const res = await api.get(`/product/${encodeURIComponent(productId)}`);
    const raw = res.data?.data || res.data?.product || res.data;
    if (raw?.name && (raw.id || raw._id)) return raw;
  } catch {
    // fall through to public search
  }

  try {
    const searchRes = await getPublicProducts({ search: String(productId), limit: 20 });
    const found = getResponseArray(searchRes).find(
      (product) => String(product.id || product._id) === String(productId)
    );
    if (found?.name) return found;
  } catch {
    // ignore
  }

  return null;
};

const filterToRealProducts = async (products, limit = 8) => {
  const validated = [];
  for (const product of products) {
    if (validated.length >= limit) break;
    const id = product?.id || product?._id;
    if (!id) continue;
    const real = await verifyCatalogProduct(id);
    if (real) validated.push(real);
  }
  return validated;
};

export const fetchCatalogRecommendations = async ({
  categories = [],
  excludeIds = [],
  limit = 8,
} = {}) => {
  const exclude = new Set(excludeIds.map(String));
  let pool = [];

  try {
    const catalogRes = await getMergedProductCatalog({ limit: MAX_PRODUCT_PAGE_SIZE });
    pool.push(...getResponseArray(catalogRes));
  } catch {
    // ignore
  }

  const uniqueCats = [...new Set(categories.filter(Boolean))];
  if (uniqueCats.length > 0) {
    const normalizedCats = uniqueCats.map((c) => c.toLowerCase());
    pool = pool.filter((product) => {
      const name = (product.category?.name || product.category || '').toLowerCase();
      const slug = (product.category?.slug || product.categorySlug || '').toLowerCase();
      return normalizedCats.some(
        (cat) => name.includes(cat) || slug.includes(cat) || cat.includes(name)
      );
    });
  }

  const seen = new Set();
  const results = [];
  for (const product of pool) {
    const id = String(product.id || product._id || '');
    if (!id || exclude.has(id) || seen.has(id)) continue;
    seen.add(id);
    results.push(product);
    if (results.length >= limit) break;
  }
  return results;
};

export const fetchSafeRecommendations = async ({
  categories = [],
  excludeIds = [],
  limit = 8,
} = {}) => {
  if (categories.length > 0) {
    try {
      const aiRes = await api.post('/product/recommendations', { categories });
      const aiProducts = pickResponseProducts(aiRes);
      if (aiProducts.length > 0) {
        const validated = await filterToRealProducts(aiProducts, limit);
        if (validated.length > 0) return validated;
      }
    } catch {
      // fall through to catalog
    }
  }

  return fetchCatalogRecommendations({ categories, excludeIds, limit });
};

export const fetchSafeCrossSell = async ({
  productIds = [],
  categories = [],
  limit = 4,
} = {}) => {
  const excludeIds = productIds.map(String);

  if (productIds.length > 0) {
    try {
      const res = await api.post('/product/cart/cross-sell', {
        cart_product_ids: productIds,
      });
      const aiProducts = pickResponseProducts(res);
      if (aiProducts.length > 0) {
        const validated = await filterToRealProducts(aiProducts, limit);
        if (validated.length > 0) return validated;
      }
    } catch {
      // fall through to catalog
    }
  }

  return fetchCatalogRecommendations({ categories, excludeIds, limit });
};

const isAuthError = (err) => {
  const status = err?.response?.status;
  return status === 401 || status === 403;
};

const MAX_NETWORK_RETRIES = 2;

const isTransientNetworkError = (err) => {
  const status = err?.response?.status;
  if (status === 502 || status === 503 || status === 504) return true;
  if (err?.response) return false;

  const message = String(err?.message || '');
  const code = String(err?.code || '');
  return (
    code === 'ERR_NETWORK' ||
    code === 'ECONNABORTED' ||
    message.includes('Network Error') ||
    message.includes('ECONNRESET') ||
    message.includes('ETIMEDOUT') ||
    message.includes('ENOTFOUND')
  );
};

export const humanizeApiError = (err, fallback = 'Request failed. Please try again.') => {
  const raw = err?.response?.data?.message ?? err?.message ?? '';
  const message = Array.isArray(raw)
    ? raw.join(', ')
    : typeof raw === 'string'
      ? raw
      : '';
  const status = err?.response?.status;
  if (
    isTransientNetworkError(err) ||
    /temporarily unavailable/i.test(message)
  ) {
    return 'تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى بعد قليل.';
  }
  if (status === 429) {
    return 'طلبات كثيرة جداً. انتظر قليلاً ثم حاول مجدداً.';
  }
  if (status === 403) {
    return message || 'ليس لديك صلاحية لتنفيذ هذا الإجراء على السيرفر.';
  }
  if (status === 409) {
    return message || 'هذا الاسم مستخدم بالفعل. غيّر اسم المنتج وحاول مجدداً.';
  }
  if (status === 500) {
    return message && message !== 'Internal server error'
      ? message
      : 'خطأ داخلي في السيرفر. جرّب تغيير اسم المنتج أو إزالة الخصم مؤقتاً، ثم حاول مجدداً.';
  }
  return message || fallback;
};

export const getServerRole = () => {
  const parsed = getStoredAuth();
  return parsed?.serverRole || parsed?.role || 'customer';
};

export const hasSellerApiAccess = () => {
  const role = getServerRole();
  return role === 'seller' || role === 'admin';
};

export const isCustomerApiRole = () => getServerRole() === 'customer';

const isMongoId = (value) => /^[a-f0-9]{24}$/i.test(String(value || ''));

export const isValidMongoId = isMongoId;

const isRetriableAuthRequest = (url = '') =>
  /\/auth\/(login|register|refresh)/.test(url);

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

const withAuthFallbackUnlessEmpty = async (authedRequest, fallbackRequest) => {
  if (hasAuthToken()) {
    try {
      const res = await authedRequest();
      if (getResponseArray(res).length > 0) return res;
    } catch (err) {
      if (!isAuthError(err)) throw err;
    }
  }
  return fallbackRequest();
};

const mergePaginatedProducts = async (fetchPage, params = {}) => {
  const limit = clampPageLimit(params.limit);
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

const mergeProductLists = (...lists) => {
  const byId = new Map();
  lists.forEach((list) => {
    if (!Array.isArray(list)) return;
    list.forEach((product) => {
      const id = product?.id || product?._id;
      if (!id) return;
      const key = String(id);
      byId.set(key, {
        ...byId.get(key),
        ...product,
        id: product.id || product._id,
        _id: product._id || product.id,
      });
    });
  });
  return Array.from(byId.values());
};

const normalizeMergedProductResponse = (products, params = {}, catalogTotal = null) => ({
  data: {
    data: products,
    products,
    meta: {
      total: catalogTotal ?? products.length,
      page: 1,
      limit: clampPageLimit(params.limit),
      totalPages: 1,
    },
  },
});

const getMergedProductCatalog = async (params = {}) => {
  let catalogTotal = null;

  const trackTotal = (response) => {
    const total = response?.data?.meta?.total;
    if (typeof total === 'number' && total > 0) catalogTotal = total;
    return response;
  };

  const settled = await Promise.allSettled([
    getAllPublicProducts(params).then(trackTotal),
    api.get('/product/trending'),
    api.get('/product/new-arrivals'),
    ...(hasAuthToken() ? [getAllAuthedProducts(params).then(trackTotal)] : []),
  ]);

  const lists = settled
    .filter((result) => result.status === 'fulfilled')
    .map((result) => getResponseArray(result.value));

  const merged = mergeProductLists(...lists);
  if (merged.length > 0) cacheProducts(merged);
  return normalizeMergedProductResponse(merged, params, catalogTotal);
};

const getMergedBrandProducts = async (brandId) => {
  const settled = await Promise.allSettled([
    hasAuthToken()
      ? api.get(`/product/by-brand/${brandId}`)
      : Promise.reject(new Error('no auth')),
    getPublicProducts({ brand: brandId, limit: 100 }),
    api.get('/product/trending'),
  ]);

  const lists = settled
    .filter((result) => result.status === 'fulfilled')
    .map((result) => getResponseArray(result.value))
    .map((list) =>
      list.filter((product) => {
        const productBrandId =
          product.brand?._id || product.brand?.id || product.brandId;
        return !productBrandId || String(productBrandId) === String(brandId);
      })
    );

  const merged = mergeProductLists(...lists);
  if (merged.length > 0) cacheProducts(merged);
  return normalizeMergedProductResponse(merged);
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

const getPublicBrands = async (params = {}) => {
  const response = await getAllPublicProducts({ page: 1, limit: 100, ...params });
  const products = getResponseArray(response);
  const brandMap = new Map();

  products.forEach((product) => {
    const brand = product.brand;
    if (!brand) return;

    const id = brand._id || brand.id || brand.slug || brand.name;
    if (!id) return;

    const existing = brandMap.get(String(id));
    brandMap.set(String(id), {
      ...(typeof brand === 'object' ? brand : { name: brand }),
      _id: brand._id || brand.id || id,
      id: brand._id || brand.id || id,
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

const mergeBrandLists = (...lists) => {
  const byId = new Map();
  lists.forEach((list) => {
    if (!Array.isArray(list)) return;
    list.forEach((brand) => {
      const id = brand?._id || brand?.id;
      if (!id) return;
      byId.set(String(id), { ...byId.get(String(id)), ...brand, _id: id, id });
    });
  });
  return Array.from(byId.values());
};

const slugifyBrandName = (name) =>
  String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .replace(/^-+|-+$/g, '');

const sellerBrandNameByEmailKey = (email) =>
  `brandhive_seller_brand_email_${String(email || 'default').toLowerCase()}`;

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

const AUTH_SILENT_PATHS = [
  '/auth/logout',
  '/auth/login',
  '/auth/register',
  '/auth/confirm-email',
  '/auth/forget-password',
  '/auth/verify-reset-code',
  '/auth/reset-password',
  '/auth/refresh',
  '/auth/change-password',
];

const isAuthSilentRequest = (url = '') =>
  AUTH_SILENT_PATHS.some((path) => url.includes(path));

const shouldRedirectToLoginOnAuthFailure = (url = '') => {
  if (isPublicBrowseRequest(url) || isAuthSilentRequest(url)) return false;
  if (
    url.includes('/seller/') ||
    url.includes('/cart') ||
    url.includes('/wishlist') ||
    url.includes('/orders') ||
    url.includes('/reviews') ||
    url.includes('/addresses') ||
    url.includes('/notifications') ||
    url.includes('/category')
  ) {
    return false;
  }
  return true;
};

let refreshTokenPromise = null;

const refreshAccessToken = async () => {
  if (refreshTokenPromise) return refreshTokenPromise;

  refreshTokenPromise = (async () => {
    const parsed = getStoredAuth();
    if (!parsed?.refreshToken) return null;

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

    if (!newToken) return null;

    const newRefreshToken =
      refreshRes.data?.refreshToken ||
      refreshRes.data?.data?.refreshToken ||
      parsed.refreshToken;

    const updated = {
      ...parsed,
      token: newToken,
      accessToken: newToken,
      refreshToken: newRefreshToken,
    };
    localStorage.setItem('brandhive_user', JSON.stringify(updated));
    return newToken;
  })().finally(() => {
    refreshTokenPromise = null;
  });

  return refreshTokenPromise;
};

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
    if (!originalRequest) return Promise.reject(error);

    const requestUrl = originalRequest.url || '';
    const method = (originalRequest.method || 'get').toLowerCase();
    const networkRetries = originalRequest._networkRetryCount || 0;
    const canRetryNetwork =
      networkRetries < MAX_NETWORK_RETRIES && isTransientNetworkError(error);
    if (
      canRetryNetwork &&
      (method === 'get' || isRetriableAuthRequest(requestUrl))
    ) {
      originalRequest._networkRetryCount = networkRetries + 1;
      await new Promise((resolve) => setTimeout(resolve, 1000 * networkRetries + 1000));
      return api(originalRequest);
    }

    // If 401 and haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isPublicBrowseRequest(requestUrl) || isAuthSilentRequest(requestUrl)) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      try {
        const newToken = await refreshAccessToken();
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      } catch {
        // refresh failed
      }

      if (shouldRedirectToLoginOnAuthFailure(requestUrl)) {
        localStorage.removeItem('brandhive_user');
        localStorage.removeItem('brandhive_cart');
        localStorage.removeItem('brandhive_wishlist');
        localStorage.removeItem('brandhive_role_override');
        window.location.href = '/login';
      }

      return Promise.reject(error);
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
  // Not in official spec — kept for optional session refresh if backend adds it
  getMe: () => api.get('/auth/me').catch(() => {
    const parsed = getStoredAuth();
    return { data: { data: parsed, user: parsed } };
  }),

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
      const res = await api.get('/brand', { params });
      const authedBrands = getResponseArray(res);
      if (authedBrands.length > 0) return res;
      return getPublicBrands(params);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        return getPublicBrands(params);
      }
      throw err;
    }
  },
  getOne: (id) => api.get(`/brand/${id}`),
  create: (data, config = {}) => api.post('/brand', data, config),
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
      return getMergedBrandProducts(params.brand);
    }
    if (params.category) {
      return withAuthFallback(
        async () => {
          const [categoryRes, mergedRes] = await Promise.all([
            api.get(`/product/by-category/${params.category}`),
            getMergedProductCatalog(params),
          ]);
          const products = mergeProductLists(
            getResponseArray(categoryRes),
            getResponseArray(mergedRes)
          );
          return normalizeMergedProductResponse(products, params);
        },
        () => getMergedProductCatalog(params)
      );
    }
    return getMergedProductCatalog(params);
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

  getByBrand: (brandId) => getMergedBrandProducts(brandId),

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
  createProduct: (data, config = {}) => api.post('/seller/products', data, config),
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
  getAllBazaarsAdmin: (params = {}) =>
    api.get('/seller/bazaar/admin/all', { params }),
  toggleBazaarAdmin: (id) =>
    api.patch(`/seller/bazaar/admin/${id}/toggle`),
  getOrderDetails: (id) =>
    api.get(`/seller/orders/${id}`),
  filterOrders: (status) => 
    api.get(`/seller/orders?status=${status}`),
  getStockAlerts: () => api.get('/seller/inventory/alerts'),
  adjustStock: (productId, data) =>
    api.post(`/seller/inventory/${productId}/adjust`, data),
};

const sanitizeProductPayload = (payload = {}) => {
  const clean = {};
  Object.entries(payload).forEach(([key, value]) => {
    if (value == null || value === '') return;
    if (key === 'images' || key === 'imageFiles') return;
    if (typeof value === 'number' && Number.isNaN(value)) return;
    if (key === 'tags' && Array.isArray(value)) {
      if (value.length > 0) clean.tags = value;
      return;
    }
    clean[key] = value;
  });
  return clean;
};

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const buildProductFormData = (payload, mainImage, additionalImages = []) => {
  const formData = new FormData();
  Object.entries(sanitizeProductPayload(payload)).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => formData.append(`${key}[]`, entry));
      return;
    }
    formData.append(key, value);
  });

  if (mainImage) {
    formData.append('images', mainImage);
    formData.append('mainImage', mainImage);
  }
  additionalImages.forEach((file) => {
    if (file) formData.append('images', file);
  });

  return formData;
};

const extractCreatedProduct = (response) =>
  response?.data?.data ||
  response?.data?.product ||
  response?.data ||
  null;

const mirrorProductImages = async (productId, mainImage, additionalImages = []) => {
  if (!productId) return null;

  const dataUrls = [];
  if (mainImage) {
    dataUrls.push(await fileToDataUrl(mainImage));
  }
  for (const file of additionalImages) {
    if (file) dataUrls.push(await fileToDataUrl(file));
  }
  if (dataUrls.length === 0) return null;

  const entry = {
    productId: String(productId),
    mainImage: dataUrls[0],
    images: dataUrls,
  };

  if (localProductImages) {
    try {
      const res = await localProductImages.post('/', entry);
      const saved = res.data?.data || entry;
      persistProductImageMirror(saved);
      return saved;
    } catch (err) {
      console.warn('[mirrorProductImages]', err.response?.data || err.message);
    }
  }

  persistProductImageMirror(entry);
  return entry;
};

export const loadLocalProductImages = async (productIds = []) => {
  const ids = [...new Set(productIds.map(String).filter(Boolean))];
  if (ids.length === 0) return;

  ids.forEach((id) => {
    try {
      const raw = localStorage.getItem(PRODUCT_IMAGES_STORAGE_KEY);
      const map = raw ? JSON.parse(raw) : {};
      if (map[id]) productImageMirrorCache.set(id, map[id]);
    } catch {
      // ignore
    }
  });

  if (!localProductImages) return;

  try {
    const res = await localProductImages.get('/', {
      params: { productIds: ids.join(','), _t: Date.now() },
    });
    getResponseArray(res).forEach((entry) => {
      if (entry?.productId) persistProductImageMirror(entry);
    });
  } catch (err) {
    console.warn('[loadLocalProductImages]', err.response?.data || err.message);
  }
};

export const enrichProductWithLocalImages = (product) => {
  if (!product) return product;

  const id = String(product._id || product.id || '');
  const mirror = productImageMirrorCache.get(id);
  if (!mirror) return product;

  const hasApiImage =
    product.mainImage ||
    (Array.isArray(product.images) && product.images.length > 0);
  if (hasApiImage) return product;

  const main = mirror.mainImage || mirror.images?.[0];
  const images = (mirror.images || []).map((url) =>
    typeof url === 'string' ? { url } : url
  );

  return {
    ...product,
    mainImage: main,
    images: images.length > 0 ? images : main ? [{ url: main }] : [],
  };
};

export const enrichProductsWithLocalImages = (products = []) => {
  if (!Array.isArray(products)) return [];
  return products.map(enrichProductWithLocalImages);
};

const createSellerProductWithFormData = async (payload, mainImage, additionalImages) => {
  const formData = buildProductFormData(payload, mainImage, additionalImages);
  const config = { headers: { 'Content-Type': 'multipart/form-data' } };

  try {
    return await sellerAPI.createProduct(formData, config);
  } catch (err) {
    const status = err.response?.status;
    if (status === 500 || status === 502 || status === 503) {
      return api.post('/product', formData, config);
    }
    throw err;
  }
};

export const createSellerProduct = async (payload, imageFiles = {}) => {
  const { mainImage = null, additionalImages = [] } = imageFiles;
  const hasImages = Boolean(mainImage || additionalImages.length > 0);
  const clean = sanitizeProductPayload(payload);

  let createRes = null;

  if (hasImages) {
    try {
      createRes = await createSellerProductWithFormData(
        payload,
        mainImage,
        additionalImages
      );
      const created = extractCreatedProduct(createRes);
      const productId = created?._id || created?.id;
      if (productId) {
        await mirrorProductImages(productId, mainImage, additionalImages);
      }
      return createRes;
    } catch (err) {
      const message = String(err.response?.data?.message || err.message || '');
      const validationRejectedImages =
        message.includes('images') || err.response?.status === 400;
      if (!validationRejectedImages) {
        throw err;
      }
    }
  }

  try {
    createRes = await sellerAPI.createProduct(clean);
  } catch (err) {
    const status = err.response?.status;
    if (status === 500 || status === 502 || status === 503) {
      createRes = await productsAPI.create(clean);
    } else {
      throw err;
    }
  }

  const created = extractCreatedProduct(createRes);
  const productId = created?._id || created?.id;

  if (hasImages && productId) {
    await mirrorProductImages(productId, mainImage, additionalImages);
    const mirror = productImageMirrorCache.get(String(productId));
    if (mirror && createRes?.data) {
      const enriched = enrichProductWithLocalImages(created);
      if (createRes.data.data) createRes.data.data = enriched;
      else if (createRes.data.product) createRes.data.product = enriched;
      else createRes.data = enriched;
    }
  }

  return createRes;
};

const sellerBrandStorageKey = (userId) =>
  `brandhive_seller_brand_${userId || 'default'}`;

const sellerBrandSlugStorageKey = (userId) =>
  `brandhive_seller_brand_slug_${userId || 'default'}`;

export const rememberSellerBrand = (userId, brand) => {
  if (!userId || !brand) return;
  const brandId = brand._id || brand.id;
  if (brandId) {
    localStorage.setItem(sellerBrandStorageKey(userId), brandId);
  }
  if (brand.slug) {
    localStorage.setItem(sellerBrandSlugStorageKey(userId), brand.slug);
  }
};

const brandOwnedByUser = (brand, userId) => {
  if (!brand || !userId) return false;
  const ownerId =
    brand.owner?._id ||
    brand.owner?.id ||
    brand.owner ||
    brand.userId ||
    brand.user?._id ||
    brand.user?.id ||
    brand.createdBy?._id ||
    brand.createdBy?.id ||
    brand.createdBy ||
    brand.requestedBy?._id ||
    brand.requestedBy?.id ||
    brand.requestedBy;
  return String(ownerId) === String(userId);
};

const sellerBrandNameStorageKey = (userId) =>
  `brandhive_seller_brand_name_${userId || 'default'}`;

const sellerProductsCacheKey = (userId) =>
  `brandhive_seller_products_${userId || 'default'}`;

export const readCachedSellerProducts = (user) => {
  const userId = user?.id || user?._id;
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(sellerProductsCacheKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const getCachedSellerProductCount = (user) => readCachedSellerProducts(user).length;

const cacheSellerProducts = (userId, products) => {
  if (!userId || !Array.isArray(products) || products.length === 0) return;
  try {
    localStorage.setItem(sellerProductsCacheKey(userId), JSON.stringify(products));
  } catch {
    // ignore quota errors
  }
};

export const rememberSellerBrandName = (userId, brandName, email) => {
  const trimmed = brandName?.trim();
  if (!trimmed) return;
  if (userId) {
    localStorage.setItem(sellerBrandNameStorageKey(userId), trimmed);
  }
  const emailKey = email || null;
  if (emailKey) {
    localStorage.setItem(sellerBrandNameByEmailKey(emailKey), trimmed);
  }
};

export const syncSellerBrandNameForUser = (user) => {
  const userId = user?.id || user?._id;
  const email = user?.email?.toLowerCase();
  if (!userId || !email) return null;

  const byUserId = localStorage.getItem(sellerBrandNameStorageKey(userId));
  const byEmail = localStorage.getItem(sellerBrandNameByEmailKey(email));

  if (byEmail && !byUserId) {
    localStorage.setItem(sellerBrandNameStorageKey(userId), byEmail);
    return byEmail;
  }
  if (byUserId && !byEmail) {
    localStorage.setItem(sellerBrandNameByEmailKey(email), byUserId);
    return byUserId;
  }
  return byUserId || byEmail || null;
};

const collectSellerBrandHints = (user) => {
  const userId = user?.id || user?._id;
  const email = user?.email?.toLowerCase();
  syncSellerBrandNameForUser(user);

  const savedName =
    (userId && localStorage.getItem(sellerBrandNameStorageKey(userId))) ||
    (email && localStorage.getItem(sellerBrandNameByEmailKey(email))) ||
    user?.brandName ||
    null;
  const savedSlug =
    (userId && localStorage.getItem(sellerBrandSlugStorageKey(userId))) ||
    (savedName ? slugifyBrandName(savedName) : null);
  const cachedId = userId
    ? localStorage.getItem(sellerBrandStorageKey(userId))
    : null;

  return { userId, email, savedName, savedSlug, cachedId };
};

const findBrandByHints = (brands, hints) => {
  if (!Array.isArray(brands) || brands.length === 0) return null;
  const { userId, savedName, savedSlug, cachedId } = hints;
  const normalizedName = savedName?.trim().toLowerCase();
  const normalizedSlug = savedSlug?.trim().toLowerCase();
  const nameSlug = savedName ? slugifyBrandName(savedName) : null;

  if (cachedId) {
    const byId = brands.find(
      (brand) => String(brand._id || brand.id) === String(cachedId)
    );
    if (byId) return byId;
  }

  if (normalizedSlug) {
    const bySlug = brands.find(
      (brand) => String(brand.slug || '').toLowerCase() === normalizedSlug
    );
    if (bySlug) return bySlug;
  }

  if (normalizedName) {
    const byName = brands.find(
      (brand) => String(brand.name || '').trim().toLowerCase() === normalizedName
    );
    if (byName) return byName;
  }

  if (nameSlug) {
    const bySlugifiedName = brands.find(
      (brand) => slugifyBrandName(brand.name) === nameSlug
    );
    if (bySlugifiedName) return bySlugifiedName;
  }

  if (userId) {
    const owned = brands.find((brand) => brandOwnedByUser(brand, userId));
    if (owned) return owned;
  }

  return null;
};

const loadBrandsForSellerResolution = async () => {
  const results = await Promise.allSettled([
    brandsAPI.getAll({ limit: 50 }),
    getPublicBrands({ limit: 100 }),
  ]);

  const lists = results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => getResponseArray(result.value));

  return mergeBrandLists(...lists);
};

const normalizeSellerBrand = (brand, fallbackName = 'My Brand') => {
  const id = brand?._id || brand?.id;
  if (!id) return null;
  return {
    ...brand,
    _id: id,
    id,
    name: brand?.name || brand?.slug || fallbackName,
    slug: brand?.slug,
  };
};

const pickSellerBrand = (userId, brand, fallbackName) => {
  const normalized = normalizeSellerBrand(brand, fallbackName);
  if (!normalized) return null;
  rememberSellerBrand(userId, normalized);
  return normalized;
};

const brandFromProduct = (product) => {
  if (!product) return null;
  if (product.brand && typeof product.brand === 'object') {
    return product.brand;
  }
  if (typeof product.brand === 'string') {
    return {
      _id: product.brandId || product.brand,
      id: product.brandId || product.brand,
      name: product.brandName || product.brand,
    };
  }
  if (product.brandId) {
    return {
      _id: product.brandId,
      id: product.brandId,
      name: product.brandName || 'My Brand',
    };
  }
  return null;
};

const getAuthedBrandsList = async () => {
  if (!hasAuthToken()) return [];
  try {
    const res = await api.get('/brand', { params: { limit: 50 } });
    return getResponseArray(res);
  } catch (err) {
    if (isAuthError(err)) return [];
    throw err;
  }
};

const getApprovedBrandRequestForUser = async (user) => {
  if (!hasAuthToken() || !user) return null;
  if (getServerRole() !== 'admin') return null;

  const userId = user.id || user._id;
  const email = user.email?.toLowerCase();

  try {
    const res = await api.get('/brand/requests', { params: { limit: 50 } });
    const requests = getResponseArray(res);
    return (
      requests.find((request) => {
        const status = request.status || request.requestStatus;
        if (status && status !== 'approved') return false;

        const ownerId =
          request.owner?._id ||
          request.owner?.id ||
          request.owner ||
          request.requestedBy?._id ||
          request.requestedBy?.id ||
          request.requestedBy ||
          request.userId;
        if (userId && ownerId && String(ownerId) === String(userId)) {
          return true;
        }

        const requestEmail = (
          request.email ||
          request.owner?.email ||
          request.requestedBy?.email ||
          ''
        ).toLowerCase();
        return email && requestEmail && requestEmail === email;
      }) || null
    );
  } catch {
    return null;
  }
};

const getCachedSellerBrand = (userId, savedName, savedSlug) => {
  const cachedId = localStorage.getItem(sellerBrandStorageKey(userId));
  if (!cachedId) return null;
  return normalizeSellerBrand(
    {
      _id: cachedId,
      id: cachedId,
      name: savedName || 'My Brand',
      slug: savedSlug || undefined,
    },
    savedName
  );
};

export const resolveSellerBrand = async (user) => {
  const hints = collectSellerBrandHints(user);
  const { userId, savedName, savedSlug, cachedId } = hints;
  if (!userId) return null;

  const cachedBrand = getCachedSellerBrand(userId, savedName, savedSlug);
  let apiUnreachable = false;

  try {
    const brands = await loadBrandsForSellerResolution();
    const hinted = findBrandByHints(brands, hints);
    if (hinted) {
      return pickSellerBrand(userId, hinted, savedName);
    }
  } catch (err) {
    if (isTransientNetworkError(err)) apiUnreachable = true;
  }

  try {
    const sellerProductsRes = await sellerAPI.getProducts();
    const sellerProducts = getResponseArray(sellerProductsRes);
    if (sellerProducts.length > 0) {
      const resolved = pickSellerBrand(
        userId,
        brandFromProduct(sellerProducts[0]),
        savedName
      );
      if (resolved) return resolved;
    }
  } catch (err) {
    if (isTransientNetworkError(err)) apiUnreachable = true;
  }

  try {
    const dashRes = await sellerAPI.getDashboard();
    const dashBrand = dashRes.data?.data?.brand || dashRes.data?.brand;
    const resolved = pickSellerBrand(userId, dashBrand, savedName);
    if (resolved) return resolved;
  } catch (err) {
    if (isTransientNetworkError(err)) apiUnreachable = true;
  }

  const approvedRequest = await getApprovedBrandRequestForUser(user);
  if (approvedRequest) {
    const resolved = pickSellerBrand(userId, approvedRequest, savedName);
    if (resolved) return resolved;
  }

  let resolvedBrandId = null;
  try {
    resolvedBrandId = await resolveSellerBrandId(user);
  } catch (err) {
    if (isTransientNetworkError(err)) apiUnreachable = true;
  }

  try {
    const authedBrands = await getAuthedBrandsList();
    const owned = authedBrands.find((brand) => brandOwnedByUser(brand, userId));
    const resolvedOwned = pickSellerBrand(userId, owned, savedName);
    if (resolvedOwned) return resolvedOwned;

    const brandId = resolvedBrandId;
    if (brandId) {
      const byId = authedBrands.find(
        (brand) => String(brand._id || brand.id) === String(brandId)
      );
      const resolvedById = pickSellerBrand(userId, byId, savedName);
      if (resolvedById) return resolvedById;
    }

    if (savedSlug) {
      const bySlug = authedBrands.find((brand) => brand.slug === savedSlug);
      const resolvedBySlug = pickSellerBrand(userId, bySlug, savedName);
      if (resolvedBySlug) return resolvedBySlug;
    }

    if (savedName) {
      const byName = authedBrands.find(
        (brand) =>
          brand.name?.toLowerCase() === String(savedName).toLowerCase()
      );
      const resolvedByName = pickSellerBrand(userId, byName, savedName);
      if (resolvedByName) return resolvedByName;
    }
  } catch (err) {
    if (isTransientNetworkError(err)) apiUnreachable = true;
  }

  try {
    const brandsRes = await brandsAPI.getAll({ limit: 50 });
    const brands = getResponseArray(brandsRes);
    const brandId = resolvedBrandId;

    if (brandId) {
      const byId = brands.find(
        (brand) => String(brand._id || brand.id) === String(brandId)
      );
      const resolved = pickSellerBrand(userId, byId, savedName);
      if (resolved) return resolved;
    }

    if (savedName) {
      const byName = brands.find(
        (brand) =>
          brand.name?.toLowerCase() === String(savedName).toLowerCase()
      );
      const resolved = pickSellerBrand(userId, byName, savedName);
      if (resolved) return resolved;
    }
  } catch (err) {
    if (isTransientNetworkError(err)) apiUnreachable = true;
  }

  try {
    const catalogRes = await getAllPublicProducts({ limit: 100 });
    const products = getResponseArray(catalogRes);
    const brandCandidates = new Map();

    products.forEach((product) => {
      const brand = brandFromProduct(product);
      const id = brand?._id || brand?.id;
      if (id) brandCandidates.set(String(id), brand);
    });

    const brandId = resolvedBrandId;
    if (brandId && brandCandidates.has(String(brandId))) {
      return pickSellerBrand(
        userId,
        brandCandidates.get(String(brandId)),
        savedName
      );
    }

    for (const brand of brandCandidates.values()) {
      if (savedSlug && brand.slug === savedSlug) {
        const resolved = pickSellerBrand(userId, brand, savedName);
        if (resolved) return resolved;
      }
      if (
        savedName &&
        brand.name?.toLowerCase() === String(savedName).toLowerCase()
      ) {
        const resolved = pickSellerBrand(userId, brand, savedName);
        if (resolved) return resolved;
      }
    }

  } catch (err) {
    if (isTransientNetworkError(err)) apiUnreachable = true;
  }

  if (resolvedBrandId) {
    return pickSellerBrand(
      userId,
      {
        _id: resolvedBrandId,
        id: resolvedBrandId,
        name: savedName || 'My Brand',
        slug: savedSlug || undefined,
      },
      savedName
    );
  }

  if (cachedBrand && (savedName || cachedId)) {
    return cachedBrand;
  }

  if (cachedBrand && apiUnreachable) return cachedBrand;

  return null;
};

export const resolveSellerBrandId = async (user) => {
  const hints = collectSellerBrandHints(user);
  const { userId, savedName, savedSlug } = hints;
  if (!userId) return null;

  try {
    const brands = await loadBrandsForSellerResolution();
    const hinted = findBrandByHints(brands, hints);
    const hintedId = hinted?._id || hinted?.id;
    if (hintedId) {
      rememberSellerBrand(userId, hinted);
      return hintedId;
    }
  } catch {
    // fall through
  }

  let dashBrand = null;
  try {
    const dashRes = await sellerAPI.getDashboard();
    dashBrand = dashRes.data?.data?.brand || dashRes.data?.brand;
    const dashBrandId = dashBrand?._id || dashBrand?.id;
    if (dashBrandId) {
      rememberSellerBrand(userId, dashBrand);
      return dashBrandId;
    }
  } catch {
    // fall through to brand list / cache
  }

  try {
    const brandsRes = await brandsAPI.getAll({ limit: 50 });
    const brands = getResponseArray(brandsRes);

    const savedSlug = localStorage.getItem(sellerBrandSlugStorageKey(userId));
    if (savedSlug) {
      const bySlug = brands.find((brand) => brand.slug === savedSlug);
      const bySlugId = bySlug?._id || bySlug?.id;
      if (bySlugId) {
        rememberSellerBrand(userId, bySlug);
        return bySlugId;
      }
    }

    if (dashBrand?.name) {
      const byName = brands.find(
        (brand) =>
          brand.name?.toLowerCase() === String(dashBrand.name).toLowerCase()
      );
      const byNameId = byName?._id || byName?.id;
      if (byNameId) {
        rememberSellerBrand(userId, byName);
        return byNameId;
      }
    }

    const owned = brands.find((brand) => brandOwnedByUser(brand, userId));
    const ownedId = owned?._id || owned?.id;
    if (ownedId) {
      rememberSellerBrand(userId, owned);
      return ownedId;
    }
  } catch {
    // fall through to cache
  }

  const cachedId = localStorage.getItem(sellerBrandStorageKey(userId));
  if (cachedId) {
    try {
      const verify = await getPublicProducts({ brand: cachedId, limit: 1 });
      if (getResponseArray(verify).length > 0) return cachedId;
      localStorage.removeItem(sellerBrandStorageKey(userId));
    } catch {
      return cachedId;
    }
  }

  return null;
};

export const fetchSellerProducts = async (user) => {
  const userId = user?.id || user?._id;
  const byId = new Map();
  const candidateBrandIds = new Set();

  const addProducts = (list) => {
    if (!Array.isArray(list)) return;
    list.forEach((product) => {
      const id = product?._id || product?.id;
      if (id) byId.set(String(id), product);
    });
  };

  const rememberBrandId = (id) => {
    if (id) candidateBrandIds.add(String(id));
  };

  const cachedBrandId = userId
    ? localStorage.getItem(sellerBrandStorageKey(userId))
    : null;
  if (cachedBrandId) rememberBrandId(cachedBrandId);

  const savedSlug = userId
    ? localStorage.getItem(sellerBrandSlugStorageKey(userId))
    : null;

  const fastFetches = [
    sellerAPI.getProducts().catch(() => null),
    cachedBrandId
      ? productsAPI.getByBrand(cachedBrandId).catch(() => null)
      : Promise.resolve(null),
    cachedBrandId
      ? getPublicProducts({ brand: cachedBrandId, limit: 100 }).catch(() => null)
      : Promise.resolve(null),
  ];

  const [sellerRes, brandProductsRes, publicBrandRes] = await Promise.all(fastFetches);
  if (sellerRes) addProducts(getResponseArray(sellerRes));
  if (brandProductsRes) addProducts(getResponseArray(brandProductsRes));
  if (publicBrandRes) addProducts(getResponseArray(publicBrandRes));

  if (byId.size === 0) {
    const brandId = await resolveSellerBrandId(user);
    rememberBrandId(brandId);

    try {
      const brandsRes = await brandsAPI.getAll({ limit: 50 });
      const brands = getResponseArray(brandsRes);
      brands.forEach((brand) => {
        if (brandOwnedByUser(brand, userId)) {
          rememberBrandId(brand._id || brand.id);
        }
      });

      if (savedSlug) {
        const bySlug = brands.find((brand) => brand.slug === savedSlug);
        rememberBrandId(bySlug?._id || bySlug?.id);
      }
    } catch {
      // ignore brand list errors
    }

    const brandFetches = [...candidateBrandIds].map((id) =>
      productsAPI.getByBrand(id).catch(() => null)
    );
    const brandResults = await Promise.all(brandFetches);
    brandResults.forEach((res) => {
      if (res) addProducts(getResponseArray(res));
    });

    if (byId.size === 0 && candidateBrandIds.size > 0) {
      try {
        const searchRes = await getAllPublicProducts({ limit: 100 });
        addProducts(
          getResponseArray(searchRes).filter((product) =>
            candidateBrandIds.has(
              String(product.brand?._id || product.brand?.id)
            )
          )
        );
      } catch {
        // ignore search fallback errors
      }
    }

    if (byId.size === 0) {
      try {
        let dashBrandName = null;
        try {
          const dashRes = await sellerAPI.getDashboard();
          const dashBrand = dashRes.data?.data?.brand || dashRes.data?.brand;
          dashBrandName = dashBrand?.name || null;
          rememberBrandId(dashBrand?._id || dashBrand?.id);
        } catch {
          // ignore dashboard errors
        }

        const catalogRes = await getAllPublicProducts({ limit: 100 });
        addProducts(
          getResponseArray(catalogRes).filter((product) => {
            const productBrandId = String(
              product.brand?._id || product.brand?.id || ''
            );
            const productBrandName = product.brand?.name?.toLowerCase() || '';
            const productBrandSlug = product.brand?.slug?.toLowerCase() || '';

            if (candidateBrandIds.has(productBrandId)) return true;
            if (
              savedSlug &&
              productBrandSlug === String(savedSlug).toLowerCase()
            ) {
              return true;
            }
            if (
              dashBrandName &&
              productBrandName === String(dashBrandName).toLowerCase()
            ) {
              return true;
            }
            return false;
          })
        );
      } catch {
        // ignore catalog fallback errors
      }
    }
  }

  const products = [...byId.values()].sort(
    (a, b) =>
      new Date(b.createdAt || 0).getTime() -
      new Date(a.createdAt || 0).getTime()
  );

  if (products.length > 0) {
    await loadLocalProductImages(products.map((product) => product._id || product.id));
    const enriched = enrichProductsWithLocalImages(products);
    cacheSellerProducts(userId, enriched);
    cacheProducts(enriched);
    return enriched;
  }

  return products;
};

const normalizeMirroredSellerOrder = (order) => ({
  _id: order.railwayOrderId || order._id,
  id: order.railwayOrderId || order._id,
  status: order.status || 'pending',
  items: order.items || [],
  totalAmount: order.totalAmount || order.subtotal || 0,
  total: order.totalAmount || order.subtotal || 0,
  subtotal: order.subtotal || order.totalAmount || 0,
  shippingAddress: order.shippingAddress,
  user: {
    name: order.customerName || order.shippingAddress?.fullName || 'Customer',
    email: order.customerEmail,
  },
  createdAt: order.createdAt,
  paymentMethod: order.paymentMethod,
  _mirrored: true,
});

export const mirrorSellerOrder = async (payload) => {
  if (!payload?.items?.length) return null;

  const enrichedItems = [];
  for (const item of payload.items) {
    let brandId = item.brandId;
    let brandName = item.brandName;
    if (!brandId && item.productId) {
      const brand = await lookupProductBrand(item.productId);
      brandId = brand?.brandId;
      brandName = brand?.brandName || brandName;
    }
    if (!brandId) continue;
    enrichedItems.push({
      ...item,
      brandId: String(brandId),
      brandName: brandName || item.name || 'Brand',
    });
  }

  if (enrichedItems.length === 0) return null;

  const mirrorPayload = {
    ...payload,
    items: enrichedItems,
    brandIds: [
      ...new Set([
        ...(Array.isArray(payload.brandIds) ? payload.brandIds.map(String) : []),
        ...enrichedItems.map((item) => String(item.brandId)),
      ]),
    ],
    _id: payload.railwayOrderId || payload._id || `local-${Date.now()}`,
    createdAt: payload.createdAt || new Date().toISOString(),
  };

  writeStoredSellerOrder(mirrorPayload);

  if (localSellerOrders) {
    try {
      const res = await localSellerOrders.post('/', mirrorPayload);
      return res.data?.data || res.data || mirrorPayload;
    } catch (err) {
      console.warn('[mirrorSellerOrder]', err.response?.data || err.message);
    }
  }

  return mirrorPayload;
};

const collectSellerBrandIds = async (user) => {
  const brandIds = new Set();
  const userId = user?.id || user?._id;
  if (userId) {
    const cached = localStorage.getItem(sellerBrandStorageKey(userId));
    if (cached) brandIds.add(String(cached));
  }

  const resolved = await resolveSellerBrandId(user);
  if (resolved) brandIds.add(String(resolved));

  try {
    const products = await fetchSellerProducts(user);
    products.forEach((product) => {
      const id =
        product.brand?._id ||
        product.brand?.id ||
        product.brandId;
      if (id) brandIds.add(String(id));
    });
  } catch {
    // ignore product lookup errors
  }

  return [...brandIds];
};

export const fetchSellerOrders = async (user) => {
  const merged = new Map();
  const brandIds = await collectSellerBrandIds(user);

  try {
    const ordRes = await sellerAPI.getOrders();
    getResponseArray(ordRes).forEach((order) => {
      const id = order._id || order.id;
      if (id) merged.set(String(id), order);
    });
  } catch {
    // Railway seller orders may be empty when products aren't linked server-side
  }

  if (localSellerOrders && brandIds.length > 0) {
    try {
      const localRes = await localSellerOrders.get('/', {
        params: { brandIds: brandIds.join(','), _t: Date.now() },
      });
      getResponseArray(localRes).forEach((order) => {
        const normalized = normalizeMirroredSellerOrder(order);
        const id = normalized._id || normalized.id;
        if (id) merged.set(String(id), normalized);
      });
    } catch (err) {
      console.warn('[fetchSellerOrders/local]', err.response?.data || err.message);
    }
  }

  readStoredSellerOrders()
    .filter((order) => orderMatchesBrandIds(order, brandIds))
    .forEach((order) => {
      const normalized = normalizeMirroredSellerOrder(order);
      const id = normalized._id || normalized.id;
      if (id) merged.set(String(id), normalized);
    });

  return [...merged.values()].sort(
    (a, b) =>
      new Date(b.createdAt || 0).getTime() -
      new Date(a.createdAt || 0).getTime()
  );
};

const emptyPayoutSummary = () => ({
  grossRevenue: 0,
  platformFee: 0,
  netEarnings: 0,
  availableBalance: 0,
  pendingWithdrawal: 0,
  totalWithdrawn: 0,
  withdrawals: [],
  profile: null,
});

export const fetchSellerPayoutSummary = async (user, brandId) => {
  const sellerUserId = user?.id || user?._id;
  if (!sellerUserId) return emptyPayoutSummary();

  if (localSellerPayouts) {
    try {
      const res = await localSellerPayouts.get('/summary', {
        params: { sellerUserId, brandId, _t: Date.now() },
      });
      return res.data?.data || emptyPayoutSummary();
    } catch (err) {
      console.warn('[fetchSellerPayoutSummary]', err.response?.data || err.message);
    }
  }

  const store = readPayoutStore(sellerUserId);
  const orders = await fetchSellerOrders(user);
  const scopedOrders = brandId
    ? orders.filter((order) => orderMatchesBrandIds(order, [brandId]))
    : orders;
  const summary = computeClientPayoutSummary(
    scopedOrders,
    store.withdrawals || []
  );

  return {
    ...summary,
    profile: store.profile || null,
    withdrawals: store.withdrawals || [],
  };
};

export const saveSellerPayoutProfile = async (user, profile) => {
  if (!user) return null;

  if (localSellerPayouts) {
    try {
      const res = await localSellerPayouts.post('/profile', {
        sellerUserId: user.id || user._id,
        sellerEmail: user.email,
        ...profile,
      });
      return res.data?.data || null;
    } catch (err) {
      throw new Error(err.response?.data?.message || err.message || 'Failed to save payout profile');
    }
  }

  const sellerUserId = user.id || user._id;
  const store = readPayoutStore(sellerUserId);
  store.profile = {
    ...profile,
    sellerUserId: String(sellerUserId),
    sellerEmail: user.email,
  };
  writePayoutStore(sellerUserId, store);
  return store.profile;
};

export const requestSellerWithdrawal = async (user, payload) => {
  if (!user) {
    throw new Error('You must be logged in to request a withdrawal');
  }

  const sellerUserId = user.id || user._id;
  const parsedAmount = Number(payload?.amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount < 50) {
    throw new Error('Minimum withdrawal amount is 50 EGP');
  }

  if (localSellerPayouts) {
    try {
      const res = await localSellerPayouts.post('/withdrawals', {
        sellerUserId,
        sellerEmail: user.email,
        sellerName: user.name,
        ...payload,
      });
      return res.data?.data || null;
    } catch (err) {
      throw new Error(err.response?.data?.message || err.message || 'Failed to create withdrawal');
    }
  }

  const summary = await fetchSellerPayoutSummary(user, payload?.brandId);
  if (parsedAmount > summary.availableBalance) {
    throw new Error(`Amount exceeds available balance (${summary.availableBalance} EGP)`);
  }

  const store = readPayoutStore(sellerUserId);
  const withdrawal = {
    _id: `local-withdrawal-${Date.now()}`,
    sellerUserId: String(sellerUserId),
    sellerEmail: user.email,
    sellerName: user.name || 'Seller',
    brandId: payload?.brandId,
    brandName: payload?.brandName,
    amount: parsedAmount,
    method: payload?.method,
    accountDetails: payload?.accountDetails || {},
    availableBalanceAtRequest: summary.availableBalance,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  store.withdrawals = [withdrawal, ...(store.withdrawals || [])];
  writePayoutStore(sellerUserId, store);
  return withdrawal;
};

export const fetchAdminWithdrawals = async () => {
  if (localSellerPayouts) {
    try {
      const res = await localSellerPayouts.get('/admin/withdrawals', {
        params: { _t: Date.now() },
      });
      return getResponseArray(res);
    } catch (err) {
      console.warn('[fetchAdminWithdrawals]', err.response?.data || err.message);
    }
  }

  const merged = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith('brandhive_seller_payout_')) continue;
      const store = JSON.parse(localStorage.getItem(key) || '{}');
      if (Array.isArray(store.withdrawals)) merged.push(...store.withdrawals);
    }
  } catch {
    // ignore
  }

  return merged.sort(
    (a, b) =>
      new Date(b.createdAt || 0).getTime() -
      new Date(a.createdAt || 0).getTime()
  );
};

export const updateWithdrawalStatus = async (id, status, adminNote = '') => {
  if (localSellerPayouts) {
    const res = await localSellerPayouts.patch(`/admin/withdrawals/${id}`, {
      status,
      adminNote,
    });
    return res.data?.data || null;
  }

  let updated = null;
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith('brandhive_seller_payout_')) continue;
      const store = JSON.parse(localStorage.getItem(key) || '{}');
      if (!Array.isArray(store.withdrawals)) continue;

      const index = store.withdrawals.findIndex(
        (entry) => String(entry._id || entry.id) === String(id)
      );
      if (index === -1) continue;

      store.withdrawals[index] = {
        ...store.withdrawals[index],
        status,
        ...(adminNote !== undefined ? { adminNote: String(adminNote).trim() } : {}),
      };
      localStorage.setItem(key, JSON.stringify(store));
      updated = store.withdrawals[index];
      break;
    }
  } catch {
    // ignore
  }

  if (!updated) {
    throw new Error('Withdrawal not found');
  }
  return updated;
};

export const logAdminAction = async (actor, entry = {}) => {
  if (!localAuditLog || !entry?.action) return null;

  try {
    const res = await localAuditLog.post('/', {
      adminUserId: actor?.id || actor?._id,
      adminEmail: actor?.email,
      adminName: actor?.name || 'Admin',
      status: 'success',
      ...entry,
    });
    return res.data?.data || null;
  } catch (err) {
    console.warn('[logAdminAction]', err.response?.data || err.message);
    return null;
  }
};

export const fetchAdminAuditLogs = async (params = {}) => {
  if (!localAuditLog) return [];

  try {
    const res = await localAuditLog.get('/', {
      params: { limit: params.limit || 100, action: params.action, _t: Date.now() },
    });
    return getResponseArray(res);
  } catch (err) {
    console.warn('[fetchAdminAuditLogs]', err.response?.data || err.message);
    return [];
  }
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
    api.patch(`/brand/requests/${id}/reject`, {
      rejectionReason: reason,
      reason,
    }),
  getBrandRequests: (params = {}) => {
    const query =
      typeof params === 'number' ? { page: params } : params;
    return api.get('/brand/requests', { params: query });
  },
  deleteProduct: (id) => api.delete(`/product/${id}`),
  activateProduct: (id) => api.patch(`/product/${id}/activate`),
  deactivateProduct: (id) => api.patch(`/product/${id}/deactivate`),
  sendNotification: (data) => api.post('/notifications/send', data),
};

const getCategoriesFallback = async () => {
  const cached = localStorage.getItem('brandhive_categories_cache');
  if (cached) {
    return { data: { data: JSON.parse(cached) } };
  }
  return getPublicCategories();
};

export const categoriesAPI = {
  getAll: async () => {
    const parsed = getStoredAuth();
    const isAdmin = parsed?.role === 'admin';

    if (!hasAuthToken() || !isAdmin) {
      return getCategoriesFallback();
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
        return getCategoriesFallback();
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
  getProfile: () =>
    api.get('/users/profile').catch(() => {
      const parsed = getStoredAuth();
      return { data: { data: parsed, user: parsed } };
    }),
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

const supportTicketsStorageKey = (userId) =>
  `brandhive_support_tickets_${userId}`;

export const extractSupportTicketId = (response) =>
  response?.data?.data?.id ||
  response?.data?.data?._id ||
  response?.data?.id ||
  response?.data?._id;

export const rememberSupportTicketId = (userId, ticketId) => {
  if (!userId || !ticketId) return;
  const key = supportTicketsStorageKey(userId);
  const ids = JSON.parse(localStorage.getItem(key) || '[]');
  if (!ids.includes(ticketId)) {
    localStorage.setItem(key, JSON.stringify([...ids, ticketId]));
  }
};

export const saveLocalSupportTicket = async ({
  userId,
  email,
  fullName,
  message,
  railwayTicketId,
}) => {
  if (!localSupport || !email || !message) return null;

  try {
    const res = await localSupport.post('/', {
      userId,
      email,
      fullName,
      message,
      railwayTicketId,
    });
    return res.data?.data || res.data;
  } catch {
    return null;
  }
};

export const syncLocalSupportReply = async (
  railwayTicketId,
  reply,
  status = 'resolved',
  ticketMeta = {}
) => {
  if (!localSupport || !railwayTicketId || !reply?.trim()) return null;

  try {
    const res = await localSupport.post(`/${railwayTicketId}/reply`, {
      reply: reply.trim(),
      status,
      ...ticketMeta,
    });
    return res.data?.data || res.data;
  } catch {
    return null;
  }
};

export const fetchMySupportTickets = async (user) => {
  if (!user?.email) return [];

  const userId = user.id || user._id;
  const byId = new Map();

  if (localSupport) {
    try {
      const res = await localSupport.get('/', {
        params: {
          ...(userId ? { userId } : {}),
          email: user.email,
        },
      });
      getResponseArray(res).forEach((ticket) => {
        byId.set(ticket.railwayTicketId || ticket._id || ticket.id, ticket);
      });
    } catch {
      // Local server may be offline
    }
  }

  if (byId.size > 0) {
    return [...byId.values()].sort(
      (a, b) =>
        new Date(a.createdAt || 0).getTime() -
        new Date(b.createdAt || 0).getTime()
    );
  }

  const storedIds = JSON.parse(
    localStorage.getItem(supportTicketsStorageKey(userId)) || '[]'
  );

  await Promise.all(
    storedIds.map(async (id) => {
      try {
        const res = await supportAPI.getMessage(id);
        const ticket = res.data?.data || res.data;
        if (ticket && (ticket.message || ticket._id || ticket.id)) {
          byId.set(ticket._id || ticket.id || id, ticket);
        }
      } catch {
        // Regular users cannot read Railway tickets without admin role
      }
    })
  );

  try {
    const res = await supportAPI.getAllMessages();
    getResponseArray(res)
      .filter(
        (ticket) =>
          ticket.email?.toLowerCase() === user.email.toLowerCase()
      )
      .forEach((ticket) => {
        byId.set(ticket._id || ticket.id, ticket);
      });
  } catch {
    // GET /support is admin-only for most accounts
  }

  return [...byId.values()].sort(
    (a, b) =>
      new Date(a.createdAt || 0).getTime() -
      new Date(b.createdAt || 0).getTime()
  );
};

export const formatSupportTime = (dateStr, locale = 'en-US') => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const cleanSupportMessageText = (text) =>
  String(text || '')
    .replace(/\s*— support request from BrandHive chat$/i, '')
    .trimEnd();

export const supportTicketsToChatMessages = (tickets, locale = 'en-US') => {
  const messages = [];
  let id = 1;

  for (const ticket of tickets) {
    messages.push({
      id: id++,
      from: 'me',
      text: cleanSupportMessageText(ticket.message),
      time: formatSupportTime(ticket.createdAt, locale),
    });

    if (ticket.reply?.trim()) {
      messages.push({
        id: id++,
        from: 'them',
        text: ticket.reply,
        time: formatSupportTime(
          ticket.updatedAt || ticket.repliedAt || ticket.createdAt,
          locale
        ),
        isAdminReply: true,
      });
    }
  }

  return messages;
};

export default api;
