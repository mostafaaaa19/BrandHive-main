import axios from 'axios';
import {
  filterHomepageQualityProducts,
  sanitizeFeaturedLocalStorage,
} from '../utils/productQuality';
import { resolveProductImage } from '../utils/mappers';

export { sanitizeFeaturedLocalStorage };

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

// Companion server (MongoDB) for features Railway does not expose:
// seller order mirror, payouts, product image mirror, support replies, audit log.
// Dev: Vite proxies /orders-local → localhost server. Prod: set VITE_MIRROR_API_URL.
const MIRROR_API_ROOT = (import.meta.env.VITE_MIRROR_API_URL || '').replace(/\/$/, '');

const createMirrorApi = (devBaseUrl, serverPath) => {
  const axiosConfig = {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
    withCredentials: false,
  };
  if (import.meta.env.DEV) {
    return axios.create({ baseURL: devBaseUrl, ...axiosConfig });
  }
  if (MIRROR_API_ROOT) {
    return axios.create({ baseURL: `${MIRROR_API_ROOT}${serverPath}`, ...axiosConfig });
  }
  return null;
};

const localSupport = createMirrorApi('/support-local', '/support/chat');
const localSellerOrders = createMirrorApi('/orders-local', '/orders/seller-mirror');
const localSellerPayouts = createMirrorApi('/payouts-local', '/payouts/seller');
const localProductImages = createMirrorApi('/product-images-local', '/products/image-mirror');
const localAuditLog = createMirrorApi('/audit-local', '/audit/log');
const localPlatform = createMirrorApi('/platform-local', '/platform');
const localPayment = createMirrorApi('/payment-local', '/payment');

export const companionServices = {
  payment: Boolean(localPayment),
  platform: Boolean(localPlatform),
  payouts: Boolean(localSellerPayouts),
  audit: Boolean(localAuditLog),
  support: Boolean(localSupport),
  productImages: Boolean(localProductImages),
};

const FEATURED_SLOTS_STORAGE_KEY = 'brandhive_featured_slots';
const NEWSLETTER_LOCAL_KEY = 'brandhive_newsletter_emails';
const AD_INQUIRIES_LOCAL_KEY = 'brandhive_ad_inquiries';

export const subscribeNewsletter = async (email) => {
  const normalized = String(email || '').toLowerCase().trim();
  if (!normalized || !normalized.includes('@')) {
    throw new Error('Invalid email');
  }

  if (localPlatform) {
    const res = await localPlatform.post('/newsletter', { email: normalized });
    return res.data?.data || res.data;
  }

  throw mirrorServiceUnavailable();
};

export const fetchFeaturedSlotIds = async () => {
  if (localPlatform) {
    try {
      const res = await localPlatform.get('/featured-slots');
      const ids = res.data?.data?.productIds;
      if (Array.isArray(ids) && ids.length > 0) {
        const normalized = ids.map(String);
        localStorage.setItem(FEATURED_SLOTS_STORAGE_KEY, JSON.stringify(normalized));
        return normalized;
      }
    } catch {
      // fall through to local cache
    }
  }

  try {
    const cached = localStorage.getItem(FEATURED_SLOTS_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return parsed.map(String);
    }
  } catch {
    // ignore stale cache
  }

  return [];
};

export const saveFeaturedSlotIds = async (productIds = []) => {
  const ids = productIds.slice(0, 4).map(String);
  localStorage.setItem(FEATURED_SLOTS_STORAGE_KEY, JSON.stringify(ids));

  if (localPlatform) {
    await localPlatform.put('/featured-slots', { productIds: ids });
  }

  return ids;
};

const PUBLIC_STATS_STORAGE_KEY = 'brandhive_public_stats';
export const EGYPT_GOVERNORATES_COUNT = 27;

export const fetchPublicHomepageStats = async () => {
  if (localPlatform) {
    const res = await localPlatform.get('/public-stats');
    const data = res.data?.data || res.data || {};
    localStorage.setItem(PUBLIC_STATS_STORAGE_KEY, JSON.stringify(data));
    return data;
  }

  try {
    const cached = localStorage.getItem(PUBLIC_STATS_STORAGE_KEY);
    return cached ? JSON.parse(cached) : {};
  } catch {
    return {};
  }
};

export const savePublicHomepageStats = async (stats = {}) => {
  const current = await fetchPublicHomepageStats().catch(() => ({}));
  const payload = {
    buyers: Math.max(
      Number(stats.buyers) || 0,
      Number(current.buyers) || 0,
      Number(current.newsletterCount) || 0,
      Number(current.registeredUsers) || 0
    ),
    governorates: Math.max(0, Number(stats.governorates) || EGYPT_GOVERNORATES_COUNT),
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(PUBLIC_STATS_STORAGE_KEY, JSON.stringify(payload));

  if (localPlatform) {
    await localPlatform.put('/public-stats', payload);
  }

  return payload;
};

export const incrementPublicBuyerCount = async () => {
  const current = await fetchPublicHomepageStats().catch(() => ({}));
  return savePublicHomepageStats({
    buyers: Math.max(Number(current.buyers) || 0, 1) + 1,
    governorates: Number(current.governorates) || EGYPT_GOVERNORATES_COUNT,
  });
};

export const syncHomepageStatsFromAdmin = async () => {
  if (!isAdminSession()) return null;

  try {
    const dashRes = await adminAPI.getDashboard();
    const overview = dashRes.data?.data?.overview || dashRes.data?.overview || {};
    let buyers = Number(overview.totalCustomers || overview.totalUsers) || 0;

    if (!buyers) {
      try {
        const usersRes = await adminAPI.getUsers({ page: 1, limit: 1 });
        buyers = Number(usersRes.data?.meta?.total) || 0;
      } catch {
        // ignore
      }
    }

    if (!buyers) return null;

    return savePublicHomepageStats({
      buyers,
      governorates: EGYPT_GOVERNORATES_COUNT,
    });
  } catch {
    return null;
  }
};

const countEngagedReviewers = (facets = {}) =>
  (facets.ratings || [])
    .filter((entry) => Number(entry?.rating) > 0)
    .reduce((sum, entry) => sum + (Number(entry?.count) || 0), 0);

const resolveBuyersCount = async ({ mirrorStats = {}, facets = {}, products = 0 } = {}) => {
  let buyers = Math.max(
    Number(mirrorStats.buyers) || 0,
    Number(mirrorStats.newsletterCount) || 0,
    Number(mirrorStats.registeredUsers) || 0,
    countEngagedReviewers(facets)
  );

  if (!buyers && isAdminSession()) {
    const synced = await syncHomepageStatsFromAdmin();
    buyers = Number(synced?.buyers) || buyers;
  }

  if (!buyers && products > 0) {
    buyers = Math.max(countEngagedReviewers(facets), Math.ceil(products / 20), 1);
  }

  return buyers;
};

const isAdminSession = () => {
  if (!hasAuthToken()) return false;
  try {
    const user = JSON.parse(localStorage.getItem('brandhive_user') || 'null');
    const role = user?.serverRole || user?.role;
    return role === 'admin';
  } catch {
    return false;
  }
};

export const submitAdInquiry = async (payload = {}) => {
  if (!localPlatform) throw mirrorServiceUnavailable();

  const res = await localPlatform.post('/ad-inquiries', payload);
  return res.data?.data || res.data;
};

const mirrorServiceUnavailable = () =>
  new Error(
    'Mirror service unavailable. Run `npm run server` locally or set VITE_MIRROR_API_URL to your deployed companion server.'
  );

const productImageMirrorCache = new Map();
const PLATFORM_FEE_RATE = 0.05;

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
};

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

export const getResponseArray = (response) => {
  const root = response?.data;
  if (!root) return [];
  if (Array.isArray(root)) return root;

  const candidates = [
    root.data,
    root.products,
    root.items,
    root.results,
    root.data?.products,
    root.data?.items,
    root.data?.results,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
};

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

let catalogIdCache = null;
let catalogIdCacheTime = 0;
const CATALOG_ID_CACHE_TTL = 5 * 60 * 1000;

const getCatalogIdSet = async () => {
  if (catalogIdCache && Date.now() - catalogIdCacheTime < CATALOG_ID_CACHE_TTL) {
    return catalogIdCache;
  }
  try {
    const res = await getAllPublicProducts({ limit: MAX_PRODUCT_PAGE_SIZE });
    const ids = new Set(
      getResponseArray(res)
        .map((product) => String(product.id || product._id || ''))
        .filter(Boolean)
    );
    catalogIdCache = ids;
    catalogIdCacheTime = Date.now();
    return ids;
  } catch {
    return catalogIdCache || new Set();
  }
};

const verifyCatalogProduct = async (productId) => {
  if (!productId) return null;

  const cached = getCachedProduct(productId);
  if (cached?.name && (cached.id || cached._id)) return cached;

  const catalogIds = await getCatalogIdSet();
  if (catalogIds.has(String(productId))) {
    try {
      const searchRes = await getPublicProducts({ limit: MAX_PRODUCT_PAGE_SIZE });
      const found = getResponseArray(searchRes).find(
        (product) => String(product.id || product._id) === String(productId)
      );
      if (found?.name) {
        cacheProducts([found]);
        return found;
      }
    } catch {
      // ignore
    }
  }

  if (hasAuthToken()) {
    try {
      const res = await api.get(`/product/${encodeURIComponent(productId)}`);
      const raw = res.data?.data || res.data?.product || res.data;
      if (raw?.name && (raw.id || raw._id)) {
        cacheProducts([raw]);
        return raw;
      }
    } catch {
      // product not in catalog
    }
  }

  return null;
};

const filterToRealProducts = async (products, limit = 8) => {
  const catalogIds = await getCatalogIdSet();
  const validated = [];

  for (const product of products) {
    if (validated.length >= limit) break;
    const id = String(product?.id || product?._id || '');
    if (!id) continue;

    if (catalogIds.has(id) && product?.name) {
      validated.push(product);
      continue;
    }

    if (catalogIds.has(id)) {
      const cached = getCachedProduct(id);
      if (cached) {
        validated.push(cached);
        continue;
      }
      const real = await verifyCatalogProduct(id);
      if (real) validated.push(real);
    }
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

let qualityFallbackPoolCache = [];
let qualityFallbackPoolTime = 0;
const QUALITY_FALLBACK_TTL = 5 * 60 * 1000;

const getQualityFallbackPool = async () => {
  if (
    qualityFallbackPoolCache.length > 0 &&
    Date.now() - qualityFallbackPoolTime < QUALITY_FALLBACK_TTL
  ) {
    return qualityFallbackPoolCache;
  }

  try {
    const res = await getAllPublicProducts({ limit: MAX_PRODUCT_PAGE_SIZE });
    qualityFallbackPoolCache = filterHomepageQualityProducts(getResponseArray(res));
    qualityFallbackPoolTime = Date.now();
  } catch {
    qualityFallbackPoolCache = [];
  }

  return qualityFallbackPoolCache;
};

const filterProductListResponse = async (response, options = {}) => {
  if (!response?.data) return response;

  const raw = getResponseArray(response);
  const fallbackPool =
    options.fallbackPool ?? (options.useFallback ? await getQualityFallbackPool() : []);
  const filtered = filterHomepageQualityProducts(raw, {
    minCount: options.minCount || 0,
    fallbackPool,
    limit: options.limit ?? null,
  });

  return {
    ...response,
    data: {
      ...response.data,
      data: filtered,
      products: filtered,
      items: filtered,
    },
  };
};

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

const getBrandsFromFacets = async () => {
  try {
    const res = await api.get('/search/facets');
    const facets = res.data?.data || res.data || {};
    const brands = facets.brands || [];
    if (!Array.isArray(brands)) return [];
    return brands.map((brand) => ({
      _id: brand._id || brand.id,
      id: brand._id || brand.id,
      name: brand.name,
      slug: brand.slug,
      productsCount: brand.count || brand.productsCount || 0,
      productCount: brand.count || brand.productCount || 0,
      isVerified: brand.isVerified ?? brand.verified ?? true,
      isFeatured: brand.isFeatured ?? brand.featured ?? false,
      isActive: brand.isActive ?? true,
    }));
  } catch {
    return [];
  }
};

const normalizeBrandDirectoryResponse = (brands, sourceResponse = {}) => ({
  ...sourceResponse,
  data: {
    ...(sourceResponse.data || {}),
    data: brands,
    brands,
  },
});

const getPublicBrands = async (params = {}) => {
  const [facetBrands, response] = await Promise.all([
    getBrandsFromFacets(),
    getAllPublicProducts({ page: 1, limit: 100, ...params }),
  ]);
  const products = getResponseArray(response);
  const brandMap = new Map();

  facetBrands.forEach((brand) => {
    const id = brand._id || brand.id;
    if (id) brandMap.set(String(id), brand);
  });

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
      productCount: (existing?.productCount || 0) + 1,
      isVerified: brand.isVerified ?? existing?.isVerified ?? true,
      isFeatured: brand.isFeatured ?? existing?.isFeatured ?? false,
      isActive: brand.isActive ?? existing?.isActive ?? true,
    });
  });

  const merged = mergeBrandLists(facetBrands, Array.from(brandMap.values()));
  return normalizeBrandDirectoryResponse(merged, response);
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
  '/product/behavioral/track',
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

  // GET — requires Authorization header (falls back to localStorage for legacy callers)
  getMe: () => api.get('/auth/me').catch(() => {
    const parsed = getStoredAuth();
    return { data: { data: parsed, user: parsed } };
  }),

  // GET — strict session check; rejects on 401 (use on app load)
  validateSession: () => api.get('/auth/me'),

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

  // PATCH { oldPassword, newPassword } — logged-in user changes password
  changePassword: (data) =>
    api.patch('/auth/change-password', {
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

    const publicRes = await getPublicBrands(params);
    const publicBrands = getResponseArray(publicRes);

    if (!hasAuthToken()) {
      return publicRes;
    }

    try {
      const res = await api.get('/brand', { params });
      const authedBrands = getResponseArray(res);
      const merged = mergeBrandLists(authedBrands, publicBrands);
      return normalizeBrandDirectoryResponse(merged, res);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        return publicRes;
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
  follow: (brandId) => api.put('/brand/follow', { brandId: String(brandId) }),
  unfollow: (brandId) => api.put('/brand/unfollow', { brandId: String(brandId) }),
  getMyFollowing: () => api.get('/brand/my-following'),
  getFollowing: () => api.get('/brand/following'),
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

  getTrending: async () =>
    filterProductListResponse(await api.get('/product/trending'), {
      minCount: 8,
      useFallback: true,
    }),
  getNewArrivals: async () =>
    filterProductListResponse(await api.get('/product/new-arrivals'), {
      minCount: 8,
      useFallback: true,
    }),
  getTopRated: async () =>
    filterProductListResponse(await api.get('/product/top-rated'), {
      minCount: 8,
      useFallback: true,
    }),

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
  updateOrderStatus: (id, status, note = '') =>
    api.patch(`/seller/orders/${id}/status`, { status, note }),
  filterOrders: (status) => 
    api.get(`/seller/orders?status=${status}`),
  getStockAlerts: () => api.get('/seller/inventory/alerts'),
  adjustStock: (productId, data) =>
    api.patch(`/seller/inventory/${productId}/adjust`, data),
  getBazaarBySlug: (slug) => api.get(`/seller/bazaar/${encodeURIComponent(slug)}`),
  getMessages: () => api.get('/support/seller'),
  getBrandMessages: (brandId) =>
    api.get('/support/brand', {
      params: brandId ? { brandId: String(brandId) } : {},
    }),
  replyToCustomer: (messageId, reply) =>
    api.post('/support/seller/reply', { messageId, reply }),
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

const resolveProductBasePrice = (product) => {
  if (!product || typeof product !== 'object') return 0;
  const fields = [
    product.price,
    product.originalPrice,
    product.basePrice,
    product.finalPrice,
    product.sellingPrice,
  ];
  for (const value of fields) {
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) return num;
  }
  return 0;
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

  if (!localProductImages) {
    console.warn('[mirrorProductImages] Mirror service not configured');
    return null;
  }

  try {
    const res = await localProductImages.post('/', entry);
    const saved = res.data?.data || entry;
    persistProductImageMirror(saved);
    return saved;
  } catch (err) {
    console.warn('[mirrorProductImages]', err.response?.data || err.message);
    return null;
  }
};

export const loadLocalProductImages = async (productIds = []) => {
  const ids = [...new Set(productIds.map(String).filter(Boolean))];
  if (ids.length === 0) return;

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

  const existingImage = resolveProductImage(product);
  if (existingImage) {
    return product.image ? product : { ...product, image: existingImage };
  }

  const id = String(product._id || product.id || '');
  const mirror = productImageMirrorCache.get(id);
  if (!mirror) return product;

  const main = mirror.mainImage || mirror.images?.[0] || null;
  const images = (mirror.images || []).map((url) =>
    typeof url === 'string' ? { url } : url
  );
  const resolvedImages = images.length > 0 ? images : main ? [{ url: main }] : [];

  return {
    ...product,
    mainImage: main,
    images: resolvedImages,
    image: main,
  };
};

export const enrichProductsWithLocalImages = (products = []) => {
  if (!Array.isArray(products)) return [];
  return products.map(enrichProductWithLocalImages);
};

export const enrichCatalogWithMirroredImages = async (products = [], { limit } = {}) => {
  if (!Array.isArray(products) || products.length === 0 || !localProductImages) {
    return products;
  }

  const missingImageIds = products
    .filter((product) => !resolveProductImage(product) && (product.id || product._id))
    .map((product) => product.id || product._id);

  const fetchLimit = Number.isFinite(limit) ? limit : missingImageIds.length;
  const idsToFetch = [...new Set(missingImageIds)].slice(0, fetchLimit);

  if (idsToFetch.length === 0) return products;

  await loadLocalProductImages(idsToFetch);
  return enrichProductsWithLocalImages(products);
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

  if (created && (created._id || created.id)) {
    try {
      const stored = JSON.parse(localStorage.getItem('brandhive_user') || 'null');
      const userId = stored?.id || stored?._id;
      if (userId) {
        const productIdStr = String(created._id || created.id);
        const cached = readCachedSellerProducts({ id: userId, _id: userId });
        cacheSellerProducts(userId, [
          created,
          ...cached.filter((p) => String(p._id || p.id) !== productIdStr),
        ]);
      }
    } catch {
      // ignore cache errors
    }
  }

  return createRes;
};

export const updateSellerProduct = async (productId, payload, imageFiles = {}) => {
  if (!productId) throw new Error('Product ID required');

  const { mainImage = null, additionalImages = [] } = imageFiles;
  const hasImages = Boolean(mainImage || additionalImages.length > 0);
  const clean = sanitizeProductPayload(payload);

  let updateRes = null;

  if (hasImages) {
    try {
      const formData = buildProductFormData(payload, mainImage, additionalImages);
      updateRes = await api.put(`/seller/products/${productId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } catch {
      updateRes = await sellerAPI.updateProduct(productId, clean);
    }
    await mirrorProductImages(productId, mainImage, additionalImages);
  } else {
    try {
      updateRes = await sellerAPI.updateProduct(productId, clean);
    } catch (err) {
      const status = err.response?.status;
      if (status === 404 || status === 500 || status === 502 || status === 503) {
        updateRes = await productsAPI.update(productId, clean);
      } else {
        throw err;
      }
    }
  }

  const updated = extractCreatedProduct(updateRes);
  if (updated && (updated._id || updated.id)) {
    try {
      const stored = JSON.parse(localStorage.getItem('brandhive_user') || 'null');
      const userId = stored?.id || stored?._id;
      if (userId) {
        const productIdStr = String(updated._id || updated.id);
        const cached = readCachedSellerProducts({ id: userId, _id: userId });
        cacheSellerProducts(
          userId,
          cached.map((product) =>
            String(product._id || product.id) === productIdStr ? { ...product, ...updated } : product
          )
        );
      }
    } catch {
      // ignore cache errors
    }
  }

  return updateRes;
};

export const deleteSellerProduct = async (productId, user) => {
  if (!productId) throw new Error('Product ID required');
  await sellerAPI.deleteProduct(productId);

  const userId = user?.id || user?._id;
  if (userId) {
    const cached = readCachedSellerProducts(user);
    cacheSellerProducts(
      userId,
      cached.filter((product) => String(product._id || product.id) !== String(productId))
    );
  }
};

const extractProductPayload = (response) =>
  response?.data?.data || response?.data?.product || response?.data || null;

export const fetchSellerProductForEdit = async (productId, user) => {
  const id = String(productId);
  if (!id) throw new Error('Product ID required');

  try {
    const res = await sellerAPI.getProduct(id);
    const product = extractProductPayload(res);
    if (product && (product.name || product._id || product.id)) {
      return enrichProductWithLocalImages(product);
    }
  } catch {
    // fall through
  }

  try {
    const res = await productsAPI.getOne(id);
    const product = extractProductPayload(res);
    if (product && (product.name || product._id || product.id)) {
      return enrichProductWithLocalImages(product);
    }
  } catch {
    // fall through
  }

  const cached = readCachedSellerProducts(user).find(
    (product) => String(product._id || product.id) === id
  );
  if (cached) return enrichProductWithLocalImages(cached);

  try {
    const products = await fetchSellerProducts(user);
    const found = products.find((product) => String(product._id || product.id) === id);
    if (found) return enrichProductWithLocalImages(found);
  } catch {
    // fall through
  }

  throw new Error('Product not found');
};

export const updateSellerOrderStatus = async (orderOrId, status, note = '') => {
  if (!orderOrId || !status) throw new Error('Order ID and status required');

  const order =
    typeof orderOrId === 'object' && orderOrId !== null ? orderOrId : null;
  const railwayId =
    order?.railwayOrderId ||
    order?._id ||
    order?.id ||
    orderOrId;
  const mirrorId = order?.mirrorId;
  const normalized = String(status).toLowerCase();

  try {
    const res = await sellerAPI.updateOrderStatus(railwayId, normalized, note);
    return res.data?.data || res.data?.order || res.data;
  } catch (err) {
    const statusCode = err.response?.status;
    if (statusCode && statusCode !== 404 && statusCode !== 405 && statusCode !== 501) {
      throw err;
    }
  }

  if (!localSellerOrders) throw mirrorServiceUnavailable();

  const lookupIds = [...new Set([mirrorId, railwayId].filter(Boolean).map(String))];
  let lastError = null;

  for (const lookupId of lookupIds) {
    try {
      const res = await localSellerOrders.patch(
        `/${encodeURIComponent(lookupId)}/status`,
        { status: normalized, note }
      );
      return res.data?.data || res.data;
    } catch (err) {
      lastError = err;
      if (err.response?.status !== 404) break;
    }
  }

  throw lastError || new Error('Order not found');
};

export const fetchSellerStockAlerts = async () => {
  try {
    const res = await sellerAPI.getStockAlerts();
    const alerts = getResponseArray(res);
    if (alerts.length > 0) return alerts;
  } catch {
    // fall through
  }

  try {
    const res = await inventoryAPI.getAlerts();
    return getResponseArray(res);
  } catch {
    return [];
  }
};

export const deleteSellerPromotion = async (userId, brandId, promoId) => {
  if (!userId || !promoId) throw new Error('Invalid promotion');
  if (!localPlatform) throw mirrorServiceUnavailable();

  await localPlatform.delete(
    `/sellers/${encodeURIComponent(String(userId))}/promos/${encodeURIComponent(String(promoId))}`
  );
  if (brandId) brandOffersCache.delete(String(brandId));
};

export const fetchAdInquiries = async (params = {}) => {
  if (!localPlatform) throw mirrorServiceUnavailable();
  const res = await localPlatform.get('/ad-inquiries', { params });
  return getResponseArray(res);
};

export const updateAdInquiryStatus = async (inquiryId, status) => {
  if (!localPlatform) throw mirrorServiceUnavailable();
  const res = await localPlatform.patch(
    `/ad-inquiries/${encodeURIComponent(String(inquiryId))}/status`,
    { status }
  );
  return res.data?.data || res.data;
};

export const fetchPublicBazaars = async (searchQuery = '') => {
  const query = String(searchQuery || '').trim();

  try {
    const res = await sellerAPI.searchBazaar(query || 'a');
    const list = getResponseArray(res);
    if (list.length > 0) {
      return query
        ? list
        : list.filter((entry) => entry?.name || entry?.slug);
    }
  } catch {
    // fall through to brand directory
  }

  try {
    const res = await brandsAPI.getAll({ limit: 100 });
    const raw = getResponseArray(res);
    let brands = raw.map((brand) => ({
      _id: brand._id || brand.id,
      id: brand._id || brand.id,
      name: brand.name,
      slug: brand.slug,
      description: brand.description || brand.tagline,
      governorate: brand.governorate || brand.city || brand.location,
      rating: brand.rating || brand.averageRating,
      productCount: brand.productCount || brand.productsCount,
      verified: brand.verified !== false,
      logo: brand.logo || brand.image,
    }));

    if (query) {
      const haystack = query.toLowerCase();
      brands = brands.filter((brand) =>
        [brand.name, brand.description, brand.governorate, brand.slug]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(haystack)
      );
    }

    return brands;
  } catch {
    return [];
  }
};

const brandOwnerMatchesUser = (brand, userId) => {
  if (!brand || !userId) return false;
  const ownerId =
    brand.owner?._id ||
    brand.owner?.id ||
    brand.owner ||
    brand.userId ||
    brand.user?._id ||
    brand.user?.id ||
    brand.sellerId ||
    brand.createdBy;
  return ownerId && String(ownerId) === String(userId);
};

const resolveAdminBazaarName = (bazaar, brands = [], settingsMap = new Map()) => {
  const rawName = bazaar.name || bazaar.bazaarName || bazaar.storeName || bazaar.brand?.name;
  if (rawName && !isValidMongoId(String(rawName))) return String(rawName).trim();

  const id = String(bazaar._id || bazaar.id || '');
  const brandId = String(bazaar.brandId || bazaar.brand?._id || bazaar.brand?.id || '');

  const settings = settingsMap.get(id);
  const settingsName = settings?.shop?.storeName || settings?.name || settings?.bazaar?.name;
  if (settingsName?.trim()) return settingsName.trim();

  if (brandId) {
    const byBrandId = brands.find((brand) => String(brand._id || brand.id) === brandId);
    if (byBrandId?.name) return byBrandId.name;
  }

  const byOwner = brands.find((brand) => brandOwnerMatchesUser(brand, id));
  if (byOwner?.name) return byOwner.name;

  if (bazaar.slug && !isValidMongoId(String(bazaar.slug))) return bazaar.slug;

  return id ? `Bazaar #${id.slice(-6).toUpperCase()}` : 'Unknown Bazaar';
};

export const fetchAdminBazaars = async () => {
  let list = [];
  try {
    const res = await sellerAPI.getAllBazaarsAdmin({ limit: 100 });
    list = getResponseArray(res);
  } catch {
    list = [];
  }

  let brands = [];
  try {
    const res = await brandsAPI.getAll({ limit: 200 });
    brands = getResponseArray(res);
  } catch {
    brands = [];
  }

  const settingsMap = new Map();
  try {
    if (localPlatform) {
      const res = await localPlatform.get('/admin/bazaars');
      getResponseArray(res).forEach((entry) => {
        if (entry?.userId) settingsMap.set(String(entry.userId), entry);
      });
    }
  } catch {
    // ignore mirror errors
  }

  if (list.length === 0 && settingsMap.size > 0) {
    list = [...settingsMap.values()].map((entry) => ({
      _id: entry.userId,
      id: entry.userId,
      brandId: entry.brandId,
      name: entry.name,
      isActive: entry.isActive !== false,
      sellerEmail: entry.email,
    }));
  }

  return list.map((bazaar) => {
    const id = String(bazaar._id || bazaar.id || '');
    const settings = settingsMap.get(id);
    return {
      ...bazaar,
      displayName: resolveAdminBazaarName(bazaar, brands, settingsMap),
      sellerEmail: bazaar.sellerEmail || bazaar.email || settings?.email || '',
    };
  });
};

export const requestOrderReturn = async ({ orderId, reason, user }) => {
  if (!orderId || !reason?.trim()) {
    throw new Error('Order ID and reason are required');
  }

  const payload = {
    reason: reason.trim(),
    message: reason.trim(),
  };

  try {
    const res = await ordersAPI.requestReturn(orderId, payload);
    return res.data?.data || res.data;
  } catch (err) {
    const statusCode = err.response?.status;
    if (statusCode && statusCode !== 404 && statusCode !== 405 && statusCode !== 501) {
      throw err;
    }
  }

  const ticketMessage = `[Return Request] Order #${String(orderId).slice(-6).toUpperCase()}: ${reason.trim()}`;
  const apiMessage =
    ticketMessage.length >= 20
      ? ticketMessage
      : ticketMessage + '\u200b'.repeat(20 - ticketMessage.length);

  const ticketRes = await supportAPI.sendMessage({
    email: user?.email,
    fullName: user?.name || user?.fullName || 'Customer',
    message: apiMessage,
  });

  const ticketId = extractSupportTicketId(ticketRes);
  const userId = user?.id || user?._id;
  if (userId && ticketId) rememberSupportTicketId(userId, ticketId);

  await saveLocalSupportTicket({
    userId,
    email: user?.email,
    fullName: user?.name || user?.fullName || 'Customer',
    message: ticketMessage,
    railwayTicketId: ticketId,
    messageType: 'return_request',
  });

  return ticketRes.data?.data || ticketRes.data || { submitted: true };
};

export const fetchAddressShippingFee = async (addressId, subtotal) => {
  if (!addressId) return null;
  try {
    const res = await addressesAPI.getShippingFee(addressId, subtotal);
    const fee =
      res.data?.data?.fee ??
      res.data?.data?.shippingFee ??
      res.data?.fee ??
      res.data?.shippingFee;
    return Number.isFinite(Number(fee)) ? Number(fee) : null;
  } catch {
    return null;
  }
};

const sellerBrandStorageKey = (userId) =>
  `brandhive_seller_brand_${userId || 'default'}`;

const sellerBrandSlugStorageKey = (userId) =>
  `brandhive_seller_brand_slug_${userId || 'default'}`;

const storeSettingsCache = new Map();
const storeSettingsInflight = new Map();
const lastPersistedSellerBrand = new Map();

export const rememberSellerBrand = (userId, brand) => {
  if (!userId || !brand) return;
  const brandId = brand._id || brand.id;
  if (brandId) {
    localStorage.setItem(sellerBrandStorageKey(userId), brandId);
  }
  if (brand.slug) {
    localStorage.setItem(sellerBrandSlugStorageKey(userId), brand.slug);
  }
  if (brand.name) {
    rememberSellerBrandName(userId, brand.name, null, { skipMirror: true });
  }

  if (!brandId || !localPlatform) return;

  const persistKey = `${userId}:${brandId}:${brand.slug || ''}:${brand.name || ''}`;
  if (lastPersistedSellerBrand.get(userId) === persistKey) return;
  lastPersistedSellerBrand.set(userId, persistKey);

  const payload = { brandId: String(brandId) };
  if (brand.name || brand.slug) {
    payload.bazaar = {
      ...(brand.name ? { name: brand.name } : {}),
      ...(brand.slug ? { slug: brand.slug } : {}),
    };
  }
  localPlatform
    .put(`/users/${encodeURIComponent(String(userId))}/store-settings`, payload)
    .then(() => {
      storeSettingsCache.delete(String(userId));
    })
    .catch(() => {});
};

const resolveBrandRecordByName = async (brandName) => {
  const normalized = brandName?.trim().toLowerCase();
  if (!normalized) return null;

  if (hasAuthToken()) {
    try {
      const res = await api.get('/brand', { params: { limit: 100 } });
      const brands = getResponseArray(res);
      const match = brands.find(
        (brand) => String(brand.name || '').trim().toLowerCase() === normalized
      );
      if (match) return match;
    } catch {
      // fall through
    }
  }

  try {
    const facets = await getBrandsFromFacets();
    const match = facets.find(
      (brand) => String(brand.name || '').trim().toLowerCase() === normalized
    );
    if (match) return match;
  } catch {
    // ignore
  }

  return null;
};

const loadMirrorSellerBrandRecord = async (userId) => {
  if (!userId || !localPlatform) return null;
  try {
    const settings = await fetchSellerStoreSettings(userId);
    const brandId = settings?.brandId;
    const bazaar = settings?.bazaar || {};
    const shop = settings?.shop || {};
    const name = bazaar.name || shop.storeName || null;
    const slug = bazaar.slug || null;

    if (brandId) {
      return {
        _id: brandId,
        id: brandId,
        name,
        slug,
      };
    }

    if (name) {
      const resolved = await resolveBrandRecordByName(name);
      const resolvedId = resolved?._id || resolved?.id;
      if (resolvedId) {
        const record = {
          _id: resolvedId,
          id: resolvedId,
          name: resolved.name || name,
          slug: resolved.slug || slug,
        };
        rememberSellerBrand(userId, record);
        return record;
      }
    }
  } catch {
    return null;
  }

  return null;
};

export const prefetchSellerBrandHints = async (user) => {
  const userId = user?.id || user?._id;
  if (!userId) return collectSellerBrandHints(user);

  if (localPlatform) {
    try {
      const settings = await fetchSellerStoreSettings(userId);
      const mirrorName =
        settings?.shop?.storeName || settings?.bazaar?.name || null;
      const mirrorBrandId = settings?.brandId || null;
      const mirrorSlug = settings?.bazaar?.slug || null;

      if (mirrorName) {
        localStorage.setItem(sellerBrandNameStorageKey(userId), mirrorName);
        if (user?.email) {
          localStorage.setItem(
            sellerBrandNameByEmailKey(user.email.toLowerCase()),
            mirrorName
          );
        }
      }
      if (mirrorBrandId) {
        localStorage.setItem(sellerBrandStorageKey(userId), String(mirrorBrandId));
      }
      if (mirrorSlug) {
        localStorage.setItem(sellerBrandSlugStorageKey(userId), mirrorSlug);
      }
    } catch {
      // keep local hints
    }
  }

  return collectSellerBrandHints(user);
};

const bootstrapSellerDataFromDashboard = async (user, { addProducts, rememberBrandId }) => {
  const userId = user?.id || user?._id;
  try {
    const dashRes = await sellerAPI.getDashboard();
    const dashData = dashRes.data?.data || dashRes.data || {};
    const dashBrand = dashData.brand;
    const brandId = dashBrand?._id || dashBrand?.id;

    if (brandId) {
      rememberSellerBrand(userId, dashBrand);
      rememberBrandId(brandId);
    }

    const productCandidates = [
      dashData.products,
      dashData.recentProducts,
      dashData.topProducts,
      dashData.products?.items,
      dashData.products?.list,
    ];
    productCandidates.forEach((list) => {
      if (Array.isArray(list)) addProducts(list);
    });

    return { brandId, dashBrand, dashData };
  } catch (err) {
    console.warn(
      '[fetchSellerProducts/dashboard]',
      err.response?.status,
      err.response?.data || err.message
    );
    return null;
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

export const rememberSellerBrandName = (userId, brandName, email, { skipMirror = false } = {}) => {
  const trimmed = brandName?.trim();
  if (!trimmed) return;
  const existing =
    userId && localStorage.getItem(sellerBrandNameStorageKey(userId));
  if (userId) {
    localStorage.setItem(sellerBrandNameStorageKey(userId), trimmed);
  }
  const emailKey = email || null;
  if (emailKey) {
    localStorage.setItem(sellerBrandNameByEmailKey(emailKey), trimmed);
  }

  if (skipMirror || !userId || !localPlatform || existing === trimmed) return;

  localPlatform
    .put(`/users/${encodeURIComponent(String(userId))}/store-settings`, {
      shop: {
        storeName: trimmed,
        ...(email ? { email: String(email).toLowerCase().trim() } : {}),
      },
      bazaar: { name: trimmed },
    })
    .then(() => {
      storeSettingsCache.delete(String(userId));
    })
    .catch(() => {});
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
          request.userId ||
          request.user?._id ||
          request.user?.id;
        if (userId && ownerId && String(ownerId) === String(userId)) {
          return true;
        }

        const requestEmail = (
          request.email ||
          request.owner?.email ||
          request.requestedBy?.email ||
          request.user?.email ||
          ''
        ).toLowerCase();
        return email && requestEmail && requestEmail === email;
      }) || null
    );
  } catch {
    return null;
  }
};

const brandRequestMatchesUser = (request, user) => {
  if (!request || !user) return false;
  const userId = String(user.id || user._id || '');
  const email = user.email?.toLowerCase() || '';
  const ownerId =
    request.owner?._id ||
    request.owner?.id ||
    request.owner ||
    request.requestedBy?._id ||
    request.requestedBy?.id ||
    request.requestedBy ||
    request.userId ||
    request.user?._id ||
    request.user?.id;
  if (userId && ownerId && String(ownerId) === userId) return true;
  const requestEmail = (
    request.email ||
    request.owner?.email ||
    request.requestedBy?.email ||
    request.user?.email ||
    ''
  ).toLowerCase();
  return email && requestEmail && requestEmail === email;
};

export const fetchMyBrandRequest = async (user) => {
  if (!hasAuthToken() || !user) return null;
  const hints = collectSellerBrandHints(user);
  const savedName = hints.savedName?.trim().toLowerCase();
  try {
    const res = await api.get('/brand/requests', { params: { limit: 50 } });
    const requests = getResponseArray(res);
    return (
      requests.find((request) => {
        if (brandRequestMatchesUser(request, user)) return true;
        const reqName = (request.name || request.brandName || '').trim().toLowerCase();
        if (savedName && reqName === savedName) {
          const status = request.status || request.requestStatus;
          return !status || status === 'approved' || status === 'pending';
        }
        return false;
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

export const readCachedSellerBrandForUser = (user) => {
  const hints = collectSellerBrandHints(user);
  return getCachedSellerBrand(hints.userId, hints.savedName, hints.savedSlug);
};

/** Match saved seller brand name/slug to public catalog and cache brand id locally. */
export const linkBrandFromFacets = async (user) => {
  const hints = collectSellerBrandHints(user);
  const { userId, savedName, savedSlug } = hints;
  if (!userId || (!savedName && !savedSlug)) return null;

  const facetsBrands = await getBrandsFromFacets();
  const normalizedName = savedName?.trim().toLowerCase();
  const normalizedSlug = savedSlug?.trim().toLowerCase();

  const matched = facetsBrands.find((brand) => {
    const brandSlug = brand.slug?.toLowerCase();
    const brandName = brand.name?.toLowerCase();
    if (normalizedSlug && brandSlug === normalizedSlug) return true;
    if (normalizedName && brandName === normalizedName) return true;
    return false;
  });

  if (!matched) return null;
  return pickSellerBrand(userId, matched, savedName);
};

/** Find brand by saved name in authed GET /brand (works even with zero public products). */
export const linkBrandFromAuthedCatalog = async (user) => {
  const hints = collectSellerBrandHints(user);
  const { userId, savedName, savedSlug, email } = hints;
  if (!userId || !hasAuthToken()) return null;

  try {
    const res = await api.get('/brand', { params: { limit: 100 } });
    const brands = getResponseArray(res);
    if (brands.length === 0) return null;

    const normalizedName = savedName?.trim().toLowerCase();
    const normalizedSlug = savedSlug?.trim().toLowerCase();
    const nameSlug = savedName ? slugifyBrandName(savedName) : null;
    const userEmail = email?.toLowerCase();

    const byName = brands.find((brand) => {
      const brandName = brand.name?.trim().toLowerCase();
      const brandSlug = brand.slug?.toLowerCase();
      if (normalizedName && brandName === normalizedName) return true;
      if (normalizedSlug && brandSlug === normalizedSlug) return true;
      if (nameSlug && slugifyBrandName(brand.name) === nameSlug) return true;
      return false;
    });
    if (byName) {
      rememberSellerBrandName(userId, byName.name || savedName, user?.email);
      return pickSellerBrand(userId, byName, savedName || byName.name);
    }

    if (userEmail) {
      const byEmail = brands.find((brand) => {
        const emails = [
          brand.owner?.email,
          brand.user?.email,
          brand.requestedBy?.email,
          brand.email,
        ]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase());
        return emails.includes(userEmail);
      });
      if (byEmail) {
        rememberSellerBrandName(userId, byEmail.name, user?.email);
        return pickSellerBrand(userId, byEmail, byEmail.name || savedName);
      }
    }
  } catch {
    return null;
  }

  return null;
};

/** Ensure seller account has brand id cached — fast paths only. */
export const ensureSellerBrandLinked = async (user) => {
  if (!user) return readCachedSellerBrandForUser(user);

  await prefetchSellerBrandHints(user);
  const cached = readCachedSellerBrandForUser(user);
  const hints = collectSellerBrandHints(user);
  const { userId, savedName } = hints;

  const linkFromMirrorStore = async () => {
    const mirrorBrand = await loadMirrorSellerBrandRecord(userId);
    if (!mirrorBrand) return null;
    return pickSellerBrand(userId, mirrorBrand, savedName || mirrorBrand.name);
  };

  const linkFromRequest = async () => {
    const req = await fetchMyBrandRequest(user);
    const status = req?.status || req?.requestStatus;
    if (!req || (status && status !== 'approved' && status !== 'pending')) return null;
    const brand =
      req.brand ||
      req.approvedBrand || {
        _id: req.brandId || req._id || req.id,
        id: req.brandId || req._id || req.id,
        name: req.name || req.brandName || savedName,
        slug: req.slug,
        description: req.description,
      };
    if (!brand?._id && !brand?.id) return null;
    return pickSellerBrand(userId, brand, savedName);
  };

  const linkFromDashboard = async () => {
    try {
      const dashRes = await sellerAPI.getDashboard();
      const dashBrand = dashRes.data?.data?.brand || dashRes.data?.brand;
      if (!dashBrand?._id && !dashBrand?.id) return null;
      return pickSellerBrand(userId, dashBrand, savedName);
    } catch {
      return null;
    }
  };

  try {
    const linked = await Promise.any([
      cached ? Promise.resolve(cached) : Promise.reject(),
      linkFromMirrorStore(),
      linkFromDashboard(),
      linkFromRequest(),
      linkBrandFromAuthedCatalog(user),
      linkBrandFromFacets(user),
    ]);
    return linked || cached;
  } catch {
    return (
      cached ||
      (await linkFromMirrorStore().catch(() => null)) ||
      (await linkFromDashboard().catch(() => null)) ||
      (await linkBrandFromAuthedCatalog(user).catch(() => null)) ||
      (await linkFromRequest().catch(() => null)) ||
      (await linkBrandFromFacets(user).catch(() => null)) ||
      null
    );
  }
};

const withRequestTimeout = (promise, ms = 8000) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('timeout')), ms);
    }),
  ]);

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

/** Resolve brand/bazaar for seller My Bazaar tab — fast parallel lookups, no heavy resolveSellerBrand. */
export const resolveSellerBazaarSource = async (user, { brandId, products = [] } = {}) => {
  await prefetchSellerBrandHints(user);
  const hints = collectSellerBrandHints(user);
  const { userId, savedName, savedSlug } = hints;

  const toBrandResult = (brand) => {
    const normalized = normalizeSellerBrand(brand, savedName);
    if (!normalized) return null;
    if (userId) pickSellerBrand(userId, normalized, savedName);
    return { kind: 'brand', payload: normalized };
  };

  const cached = getCachedSellerBrand(userId, savedName, savedSlug);

  const attempts = [];

  if (userId) {
    attempts.push(
      withRequestTimeout(
        loadMirrorSellerBrandRecord(userId).then((record) => {
          const result = toBrandResult(record);
          if (result) return result;
          throw new Error('empty mirror brand');
        }),
        6000
      ),
      withRequestTimeout(
        ensureSellerBrandLinked(user).then((brand) => {
          const result = toBrandResult(brand);
          if (result) return result;
          throw new Error('brand not linked');
        }),
        8000
      ),
      withRequestTimeout(linkBrandFromAuthedCatalog(user), 8000).then((brand) => {
        const result = toBrandResult(brand);
        if (result) return result;
        throw new Error('no authed brand match');
      })
    );
  }

  if (brandId) {
    attempts.push(
      Promise.resolve(
        toBrandResult({
          _id: brandId,
          id: brandId,
          name: savedName || 'My Brand',
          slug: savedSlug,
        })
      )
    );
  }

  if (cached) {
    attempts.push(Promise.resolve(toBrandResult(cached)));
  }

  if (Array.isArray(products) && products.length > 0) {
    const fromProduct = brandFromProduct(products[0]);
    if (fromProduct) {
      attempts.push(Promise.resolve(toBrandResult(fromProduct)));
    }
  }

  attempts.push(
    withRequestTimeout(sellerAPI.getBazaar(), 6000).then((res) => {
      const bazaar = res.data?.data || res.data?.bazaar || res.data;
      if (bazaar && (bazaar._id || bazaar.id || bazaar.name)) {
        return { kind: 'bazaar', payload: bazaar };
      }
      throw new Error('empty bazaar');
    }),
    withRequestTimeout(sellerAPI.getDashboard(), 6000).then((res) => {
      const dashBrand = res.data?.data?.brand || res.data?.brand;
      const result = toBrandResult(dashBrand);
      if (result) return result;
      throw new Error('empty dashboard brand');
    }),
    withRequestTimeout(fetchMyBrandRequest(user), 6000).then((req) => {
      if (!req) throw new Error('no request');
      const status = req.status || req.requestStatus;
      if (status && status !== 'approved' && status !== 'pending') {
        throw new Error('request not approved');
      }
      const result = toBrandResult(
        req.brand ||
          req.approvedBrand || {
            _id: req.brandId || req._id || req.id,
            id: req.brandId || req._id || req.id,
            name: req.name || req.brandName || savedName,
            slug: req.slug,
            description: req.description,
          }
      );
      if (result) return result;
      throw new Error('empty request brand');
    }),
    withRequestTimeout(linkBrandFromFacets(user), 6000).then((brand) => {
      const result = toBrandResult(brand);
      if (result) return result;
      throw new Error('no facet match');
    })
  );

  try {
    return await Promise.any(attempts);
  } catch {
    return cached ? toBrandResult(cached) : null;
  }
};

export const resolveSellerBrandId = async (user) => {
  const hints = collectSellerBrandHints(user);
  const { userId, savedName, savedSlug } = hints;
  if (!userId) return null;

  const mirrorBrand = await loadMirrorSellerBrandRecord(userId);
  if (mirrorBrand?._id || mirrorBrand?.id) {
    rememberSellerBrand(userId, mirrorBrand);
    return mirrorBrand._id || mirrorBrand.id;
  }

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

  await prefetchSellerBrandHints(user);
  await bootstrapSellerDataFromDashboard(user, { addProducts, rememberBrandId });
  await ensureSellerBrandLinked(user).catch(() => null);
  await linkBrandFromAuthedCatalog(user).then((brand) => {
    const brandId = brand?._id || brand?.id;
    if (brandId) rememberBrandId(brandId);
  }).catch(() => null);

  const resolvedBrandId = await resolveSellerBrandId(user);
  if (resolvedBrandId) rememberBrandId(resolvedBrandId);

  const cachedBrandId = userId
    ? localStorage.getItem(sellerBrandStorageKey(userId))
    : null;
  if (cachedBrandId) rememberBrandId(cachedBrandId);

  const savedSlug = userId
    ? localStorage.getItem(sellerBrandSlugStorageKey(userId))
    : null;

  const fastFetches = [
    sellerAPI.getProducts().catch(() => null),
    ...[...candidateBrandIds].map((id) =>
      productsAPI.getByBrand(id).catch(() => null)
    ),
    ...[...candidateBrandIds].map((id) =>
      getPublicProducts({ brand: id, limit: 100 }).catch(() => null)
    ),
  ];

  const fetchResults = await Promise.all(fastFetches);
  fetchResults.forEach((res) => {
    if (res) addProducts(getResponseArray(res));
  });

  if (byId.size === 0) {
    const brandId = resolvedBrandId || (await resolveSellerBrandId(user));
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

    if (byId.size === 0 && hasAuthToken()) {
      try {
        const authedRes = await getAllAuthedProducts({ limit: 100 });
        const authedProducts = getResponseArray(authedRes);
        const brandIdSet = new Set([...candidateBrandIds].map(String));
        addProducts(
          authedProducts.filter((product) => {
            const productBrandId = String(
              product.brand?._id || product.brand?.id || product.brandId || ''
            );
            if (brandIdSet.size > 0) return brandIdSet.has(productBrandId);
            return brandOwnedByUser(product.brand, userId);
          })
        );
      } catch {
        // ignore authed catalog errors
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

/** Products the seller can adjust stock for — seller API first, brand catalog as fallback. */
export const fetchSellerInventoryProducts = async (user) => {
  let products = [];
  let fromSellerApi = false;

  try {
    const res = await sellerAPI.getProducts();
    products = getResponseArray(res);
    fromSellerApi = products.length > 0;
  } catch {
    // fall through
  }

  if (products.length === 0) {
    products = await fetchSellerProducts(user);
  }

  if (products.length === 0) {
    products = readCachedSellerProducts(user);
  }

  if (products.length === 0) return [];

  products = products.map((product) => ({
    ...product,
    _sellerOwned: fromSellerApi,
    _catalogFallback: !fromSellerApi,
  }));

  await loadLocalProductImages(products.map((product) => product._id || product.id));
  products = enrichProductsWithLocalImages(products);

  const userId = user?.id || user?._id;
  if (userId) cacheSellerProducts(userId, products);
  return products;
};

export const adjustSellerStock = async (
  productId,
  { quantity, reason, notes, currentStock, catalogFallback = false } = {}
) => {
  const payload = {
    quantity: Number(quantity),
    reason,
    ...(notes ? { notes } : {}),
  };

  const baseStock = Number(currentStock);
  const newStock =
    Number.isNaN(baseStock) || Number.isNaN(payload.quantity)
      ? null
      : Math.max(0, baseStock + payload.quantity);

  const updateStockDirect = async () => {
    if (newStock == null) {
      const error = new Error('Invalid stock values');
      error.response = { data: { message: 'Invalid stock values' } };
      throw error;
    }
    if (catalogFallback) {
      return productsAPI.update(productId, { stock: newStock });
    }
    try {
      return await sellerAPI.updateProduct(productId, { stock: newStock });
    } catch (err) {
      return productsAPI.update(productId, { stock: newStock });
    }
  };

  if (catalogFallback) {
    return updateStockDirect();
  }

  try {
    return await sellerAPI.adjustStock(productId, payload);
  } catch (err) {
    const message = String(err.response?.data?.message || '').toLowerCase();
    const status = err.response?.status;
    const canRetry =
      status === 403 ||
      status === 404 ||
      message.includes('not found') ||
      message.includes('not yours');

    if (!canRetry) throw err;
    return updateStockDirect();
  }
};

const normalizeMirroredSellerOrder = (order) => ({
  _id: order.railwayOrderId || order._id,
  id: order.railwayOrderId || order._id,
  mirrorId: order._id,
  railwayOrderId: order.railwayOrderId,
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

  if (!localSellerOrders) {
    console.warn('[mirrorSellerOrder] Mirror service not configured');
    return null;
  }

  try {
    const res = await localSellerOrders.post('/', mirrorPayload);
    return res.data?.data || res.data || mirrorPayload;
  } catch (err) {
    const message =
      err.response?.data?.message ||
      err.message ||
      'Failed to mirror seller order';
    console.warn('[mirrorSellerOrder]', message, err.response?.data || '');
    return null;
  }
};

export const mirrorCreatedOrderForSellers = async ({
  orderId,
  cartItems = [],
  shippingAddress = {},
  paymentMethod = 'cod',
  totalAmount = 0,
  subtotal = 0,
  status = 'pending',
  customerUser = null,
} = {}) => {
  if (!orderId || !Array.isArray(cartItems) || cartItems.length === 0) return null;

  const items = cartItems
    .map((item) => ({
      productId: String(item.id || item.productId || ''),
      name: item.name || 'Product',
      quantity: Number(item.quantity) || 1,
      price: Number(item.price) || 0,
      brandId: item.brandId || item.brand?._id || item.brand?.id,
      brandName: item.brandName || item.brand?.name || '',
    }))
    .filter((item) => item.productId);

  if (items.length === 0) return null;

  return mirrorSellerOrder({
    railwayOrderId: String(orderId),
    customerUserId: customerUser?.id || customerUser?._id,
    customerEmail: customerUser?.email,
    customerName: shippingAddress?.fullName || customerUser?.name,
    items,
    subtotal: subtotal || totalAmount,
    totalAmount: totalAmount || subtotal,
    paymentMethod,
    status,
    shippingAddress,
  });
};

const collectSellerBrandIds = async (user) => {
  const brandIds = new Set();
  const userId = user?.id || user?._id;

  await prefetchSellerBrandHints(user);

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
  const userId = user?.id || user?._id;
  let railwayOrders = [];

  try {
    const ordRes = await sellerAPI.getOrders();
    railwayOrders = getResponseArray(ordRes);
  } catch (err) {
    console.warn('[fetchSellerOrders]', err.response?.data || err.message);
  }

  const brandIds = await collectSellerBrandIds(user);
  let mirrored = [];

  if (localSellerOrders && (brandIds.length > 0 || userId)) {
    try {
      const localRes = await localSellerOrders.get('/', {
        params: {
          ...(brandIds.length > 0 ? { brandIds: brandIds.join(',') } : {}),
          ...(userId ? { sellerId: String(userId) } : {}),
          _t: Date.now(),
        },
      });
      mirrored = getResponseArray(localRes)
        .map(normalizeMirroredSellerOrder)
        .filter((order) => order._id || order.id);

      await Promise.all(
        mirrored.map(async (order) => {
          if (order._mirrored) return;
          const id = order._id || order.id;
          if (!id) return;
          try {
            const res = await sellerAPI.getOrderDetails(id);
            const live =
              res.data?.data || res.data?.order || res.data || null;
            if (live?.status) order.status = live.status;
          } catch {
            // mirror-only orders are not on Railway seller API
          }
        })
      );
    } catch (err) {
      console.warn('[fetchSellerOrders/mirror]', err.response?.data || err.message);
    }
  }

  const merged = new Map();
  mirrored.forEach((order) => {
    const key = String(order.railwayOrderId || order._id || order.id);
    merged.set(key, order);
  });
  railwayOrders.forEach((order) => {
    const key = String(order._id || order.id);
    const existing = merged.get(key);
    merged.set(key, existing ? { ...existing, ...order } : order);
  });

  const list = [...merged.values()].sort(
    (a, b) =>
      new Date(b.createdAt || 0).getTime() -
      new Date(a.createdAt || 0).getTime()
  );

  return hydrateOrdersWithPaymobPaymentStatus(list, { reconcile: true });
};

export const computeReviewAverageRating = (reviews) => {
  if (!Array.isArray(reviews) || reviews.length === 0) return 0;
  const rated = reviews.filter((review) => Number(review.rating) > 0);
  if (rated.length === 0) return 0;
  return (
    rated.reduce((sum, review) => sum + Number(review.rating), 0) / rated.length
  );
};

export const fetchSellerReviews = async (user) => {
  try {
    const res = await sellerAPI.getReviews();
    const reviews = getResponseArray(res);
    if (reviews.length > 0) return reviews;
  } catch {
    // fall through to product-level reviews
  }

  try {
    const products = await fetchSellerInventoryProducts(user);
    const aggregated = [];

    await Promise.all(
      products.slice(0, 25).map(async (product) => {
        const productId = product._id || product.id;
        if (!productId) return;
        try {
          const res = await reviewsAPI.getProductReviews(productId);
          getResponseArray(res).forEach((review) => {
            aggregated.push({
              ...review,
              product: review.product || { name: product.name, _id: productId },
              productName: review.productName || product.name,
            });
          });
        } catch {
          // ignore per-product failures
        }
      })
    );

    return aggregated.sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
    );
  } catch {
    return [];
  }
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

  const orders = await fetchSellerOrders(user);
  const scopedOrders = brandId
    ? orders.filter((order) => orderMatchesBrandIds(order, [brandId]))
    : orders;
  const summary = computeClientPayoutSummary(scopedOrders, []);

  return {
    ...summary,
    profile: null,
    withdrawals: [],
  };
};

export const saveSellerPayoutProfile = async (user, profile) => {
  if (!user) return null;

  if (!localSellerPayouts) {
    throw mirrorServiceUnavailable();
  }

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
};

export const requestSellerWithdrawal = async (user, payload) => {
  if (!user) {
    throw new Error('You must be logged in to request a withdrawal');
  }

  const parsedAmount = Number(payload?.amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount < 50) {
    throw new Error('Minimum withdrawal amount is 50 EGP');
  }

  if (!localSellerPayouts) {
    throw mirrorServiceUnavailable();
  }

  try {
    const res = await localSellerPayouts.post('/withdrawals', {
      sellerUserId: user.id || user._id,
      sellerEmail: user.email,
      sellerName: user.name,
      ...payload,
    });
    return res.data?.data || null;
  } catch (err) {
    throw new Error(err.response?.data?.message || err.message || 'Failed to create withdrawal');
  }
};

export const fetchAdminWithdrawals = async () => {
  if (!localSellerPayouts) {
    return [];
  }

  try {
    const res = await localSellerPayouts.get('/admin/withdrawals', {
      params: { _t: Date.now() },
    });
    return getResponseArray(res);
  } catch (err) {
    console.warn('[fetchAdminWithdrawals]', err.response?.data || err.message);
    return [];
  }
};

export const updateWithdrawalStatus = async (id, status, adminNote = '') => {
  if (!localSellerPayouts) {
    throw mirrorServiceUnavailable();
  }

  const res = await localSellerPayouts.patch(`/admin/withdrawals/${id}`, {
    status,
    adminNote,
  });
  return res.data?.data || null;
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
  getOrder: (id) => api.get(`/orders/admin/${id}`),
  updateOrderStatus: (id, status, note = '') =>
    api.patch(`/orders/admin/${id}/status`, { status, note }),
  markOrderPaid: (id) => api.patch(`/orders/admin/${id}/mark-paid`),
  cancelOrder: (id, data = {}) => api.post(`/orders/admin/${id}/cancel`, data),
  getInvoice: (id) => api.get(`/orders/admin/${id}/invoice`),
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

/** After admin approves a seller request: activate brand so it appears publicly. */
export const finalizeBrandRequestApproval = async (requestId, requestSnapshot = null) => {
  const res = await adminAPI.approveBrandRequest(requestId);
  const payload = res.data?.data || res.data || {};
  const brandId =
    payload.brandId ||
    payload.brand?._id ||
    payload.brand?.id ||
    requestSnapshot?.brandId ||
    requestSnapshot?.approvedBrandId;

  if (brandId) {
    try {
      await brandsAPI.activate(brandId);
    } catch {
      // brand may already be active
    }
  }

  return { response: res, brandId: brandId || null };
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
  getCount: () => api.get('/orders/my-orders/count'),
  cancelOrder: (orderId, data) => api.post(`/orders/my-orders/${orderId}/cancel`, data),
  requestReturn: (orderId, data) =>
    api.post(`/orders/my-orders/${orderId}/return`, data),
  reorder: (orderId) => api.post(`/orders/my-orders/${orderId}/reorder`),
  getInvoice: (orderId) => api.get(`/orders/my-orders/${orderId}/invoice`),
  retryPayment: (orderId) => api.post(`/payment/retry/${orderId}`),
};

const extractOrderLineItems = (order) => {
  const rows = order?.items || order?.products || [];
  return rows
    .map((item) => {
      const productId =
        item.productId?._id ||
        item.productId?.id ||
        item.productId ||
        item.product?._id ||
        item.product?.id;
      const quantity = Math.max(1, Number(item.quantity) || 1);
      if (!productId || !isValidMongoId(String(productId))) return null;
      return { productId: String(productId), quantity };
    })
    .filter(Boolean);
};

export const reorderOrderToCart = async (orderId, orderFallback = null) => {
  let order = orderFallback;

  if (
    !order ||
    String(order._id || order.id || order.orderId || '') !== String(orderId)
  ) {
    try {
      const res = await ordersAPI.getMyOrder(orderId);
      order = res.data?.data || res.data?.order || res.data || order;
    } catch {
      // keep list fallback if detail fetch fails
    }
  }

  const lineItems = extractOrderLineItems(order);
  if (lineItems.length === 0) {
    throw new Error('No products found in this order');
  }

  let added = 0;
  for (const line of lineItems) {
    try {
      await cartAPI.add({
        productId: line.productId,
        quantity: line.quantity,
      });
      added += 1;
    } catch {
      // skip unavailable products
    }
  }
  if (added === 0) {
    throw new Error('Could not add order items to cart');
  }

  return { lineItems: lineItems.length };
};

export const customerAPI = {
  get: () => api.get('/customer'),
};

// ─── Users ───────────────────────────────────────────────────────────────────
export const extractProfilePayload = (response) =>
  response?.data?.data?.user ||
  response?.data?.user ||
  response?.data?.data ||
  response?.data ||
  {};

export const mergeUserWithMirrorProfile = async (user) => {
  if (!user || !localPlatform) return user;

  const userId = user.id || user._id;
  if (!userId) return user;

  try {
    const res = await localPlatform.get(
      `/users/${encodeURIComponent(String(userId))}/profile`
    );
    const profile = res.data?.data;
    if (!profile?.name && profile?.phone == null) return user;

    return {
      ...user,
      name: profile.name || user.name,
      phone: profile.phone ?? user.phone,
    };
  } catch {
    return user;
  }
};

export const usersAPI = {
  getProfile: async () => {
    const railwayRes = await api.get('/customer').catch(() => authAPI.getMe());
    const parsed = getStoredAuth();
    const userId = parsed?.id || parsed?._id;

    if (localPlatform && userId) {
      try {
        const mirrorRes = await localPlatform.get(
          `/users/${encodeURIComponent(String(userId))}/profile`
        );
        const mirror = mirrorRes.data?.data;
        const railwayUser = extractProfilePayload(railwayRes);
        const merged = {
          ...railwayUser,
          name: mirror?.name || railwayUser.name,
          phone: mirror?.phone ?? railwayUser.phone,
        };
        return { data: { data: merged, user: merged } };
      } catch {
        // mirror offline — fall back to Railway profile
      }
    }

    return railwayRes;
  },

  updateProfile: async (data) => {
    const parsed = getStoredAuth();
    const userId = parsed?.id || parsed?._id;
    if (!userId) {
      const error = new Error('Not signed in');
      error.response = { data: { message: 'Not signed in' } };
      throw error;
    }

    if (!localPlatform) {
      const error = new Error(
        'Profile updates need the companion server (npm run dev from project root).'
      );
      error.response = { data: { message: error.message } };
      throw error;
    }

    const res = await localPlatform.put(
      `/users/${encodeURIComponent(String(userId))}/profile`,
      {
        ...data,
        email: parsed?.email,
      }
    );
    const profile = res.data?.data || res.data || data;
    return {
      data: {
        success: true,
        data: profile,
        user: profile,
      },
    };
  },
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

  moveAllToCart: (data = {}) => api.post('/wishlist/move-all-to-cart', data),
};

export const reviewsAPI = {
  getProductReviews: (productId) => api.get(`/reviews/product/${productId}`),
  addReview: (data) => api.post('/reviews', data),
  getMyReviews: () => api.get('/reviews/my-reviews'),
  deleteReview: (id) => api.delete(`/reviews/${id}`),
  adminDelete: (id) => api.delete(`/reviews/admin/${id}`),
  adminToggle: (id) => api.patch(`/reviews/admin/${id}/toggle`),
};

const getReviewProductId = (review) => {
  const candidates = [
    review?.productId,
    review?.product_id,
    review?.product?._id,
    review?.product?.id,
    typeof review?.product === 'string' ? review.product : null,
  ];

  for (const raw of candidates) {
    if (!raw) continue;
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'object') return raw._id || raw.id || null;
  }

  return null;
};

const getReviewOrderId = (review) => {
  const raw = review?.orderId ?? review?.order_id ?? review?.order?._id ?? review?.order?.id;
  if (!raw) return null;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object') return raw._id || raw.id || null;
  return null;
};

const getLineItemProductId = (item) => {
  const raw =
    item?.productId ??
    item?.product_id ??
    item?.product?._id ??
    item?.product?.id;
  if (!raw) return null;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object') return raw._id || raw.id || null;
  return null;
};

const getLineItemProductName = (item) =>
  item?.productName ||
  item?.name ||
  item?.product?.name ||
  item?.productId?.name ||
  null;

const getInlineReviewProductName = (review) =>
  review?.product?.name ||
  review?.productName ||
  review?.product_name ||
  review?.productTitle ||
  review?.product_title ||
  (typeof review?.productId === 'object' ? review.productId?.name : null) ||
  null;

const getReviewNameFromOrder = (review, orders = []) => {
  const orderId = getReviewOrderId(review);
  const productId = getReviewProductId(review);
  if (!orderId || !Array.isArray(orders)) return null;

  const order = orders.find(
    (entry) => String(entry._id || entry.id || entry.orderId || '') === String(orderId)
  );
  if (!order) return null;

  const items = order.items || order.products || [];
  if (productId) {
    const match = items.find(
      (item) => String(getLineItemProductId(item) || '') === String(productId)
    );
    if (match) return getLineItemProductName(match);
  }

  if (items.length === 1) {
    return getLineItemProductName(items[0]);
  }

  return null;
};

const buildReviewProductLookup = (orders = [], catalogProducts = []) => {
  const lookup = new Map();

  const remember = (id, name, slug) => {
    if (!id || !name) return;
    const key = String(id);
    lookup.set(key, {
      name,
      slug: slug || lookup.get(key)?.slug || key,
    });
  };

  orders.forEach((order) => {
    (order.items || order.products || []).forEach((item) => {
      remember(
        getLineItemProductId(item),
        getLineItemProductName(item),
        item.product?.slug || item.slug
      );
    });
  });

  catalogProducts.forEach((product) => {
    remember(
      product.id || product._id,
      product.name,
      product.slug
    );
  });

  return lookup;
};

export const rememberReviewProduct = (product) => {
  if (!product?.id || !product?.name || typeof localStorage === 'undefined') return;
  try {
    const cache = JSON.parse(localStorage.getItem('brandhive_review_products') || '{}');
    cache[String(product.id)] = {
      name: product.name,
      slug: product.slug || product.id,
    };
    localStorage.setItem('brandhive_review_products', JSON.stringify(cache));
  } catch {
    // ignore storage errors
  }
};

const getLocalReviewProductCache = () => {
  if (typeof localStorage === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem('brandhive_review_products') || '{}');
  } catch {
    return {};
  }
};

export const hydrateMyReviews = async (reviews, { orders: orderInput = null } = {}) => {
  if (!Array.isArray(reviews) || reviews.length === 0) return [];

  let orders = Array.isArray(orderInput) ? [...orderInput] : [];
  if (orders.length === 0) {
    try {
      const res = await ordersAPI.getAll();
      orders = getResponseArray(res);
      if (!Array.isArray(orders) || orders.length === 0) {
        const body = res.data?.data || res.data?.orders || res.data;
        orders = Array.isArray(body) ? body : [];
      }
    } catch {
      orders = [];
    }
  }

  const reviewOrderIds = [
    ...new Set(
      reviews.map(getReviewOrderId).filter(Boolean).map(String)
    ),
  ];

  await Promise.allSettled(
    reviewOrderIds.map(async (orderId) => {
      const existing = orders.find(
        (entry) => String(entry._id || entry.id || entry.orderId || '') === orderId
      );
      const hasItems = (existing?.items || existing?.products || []).length > 0;
      if (existing && hasItems) return;

      try {
        const res = await ordersAPI.getMyOrder(orderId);
        const order = res.data?.data || res.data?.order || res.data;
        if (!order) return;

        const index = orders.findIndex(
          (entry) => String(entry._id || entry.id || entry.orderId || '') === orderId
        );
        if (index >= 0) orders[index] = order;
        else orders.push(order);
      } catch {
        // ignore missing order detail
      }
    })
  );

  orders.forEach((order) => {
    (order.items || order.products || []).forEach((item) => {
      const id = getLineItemProductId(item);
      const name = getLineItemProductName(item);
      if (id && name) {
        rememberReviewProduct({
          id,
          name,
          slug: item.product?.slug || item.slug || id,
        });
      }
    });
  });

  let catalogProducts = [];
  try {
    const res = await getAllPublicProducts({ limit: MAX_PRODUCT_PAGE_SIZE });
    catalogProducts = getResponseArray(res);
    cacheProducts(catalogProducts);
  } catch {
    catalogProducts = [];
  }

  const lookup = buildReviewProductLookup(orders, catalogProducts);
  const localReviewCache = getLocalReviewProductCache();

  return Promise.all(
    reviews.map(async (review) => {
      const productId = getReviewProductId(review);
      const fromOrder = getReviewNameFromOrder(review, orders);
      const cached = productId ? lookup.get(String(productId)) : null;
      const localCached = productId ? localReviewCache[String(productId)] : null;

      let name =
        getInlineReviewProductName(review) ||
        fromOrder ||
        cached?.name ||
        localCached?.name ||
        null;
      let slug =
        review?.product?.slug ||
        (typeof review?.productId === 'object' ? review.productId?.slug : null) ||
        cached?.slug ||
        localCached?.slug ||
        '';

      if (!name && productId) {
        const memory = getCachedProduct(productId);
        if (memory?.name) {
          name = memory.name;
          slug = slug || memory.slug || '';
        }
      }

      if (!name && productId && hasAuthToken()) {
        try {
          const res = await api.get(`/product/${encodeURIComponent(productId)}`);
          const raw = res.data?.data || res.data?.product || res.data;
          if (raw?.name) {
            name = raw.name;
            slug = slug || raw.slug || '';
            cacheProducts([raw]);
          }
        } catch {
          // fall through
        }
      }

      if (!name && productId) {
        try {
          const res = await findPublicProduct(String(productId));
          const raw = res.data?.data || res.data?.product || res.data;
          if (raw?.name) {
            name = raw.name;
            slug = slug || raw.slug || '';
            cacheProducts([raw]);
          }
        } catch {
          // fall through
        }
      }

      if (name && productId) {
        rememberReviewProduct({ id: productId, name, slug: slug || productId });
      }

      return {
        ...review,
        product: {
          ...(typeof review.product === 'object' && review.product ? review.product : {}),
          id: productId,
          name,
          slug: slug || productId || '',
        },
      };
    })
  );
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
  setDefault: (id) => api.patch(`/addresses/${id}/default`),
  getShippingFee: (id, subtotal) =>
    api.get(`/addresses/${id}/shipping-fee?subtotal=${subtotal}`),
};

export const getInstantSupportReply = (messageText, language = 'en') => {
  const text = String(messageText || '').toLowerCase();
  const isAr = language === 'ar';

  if (
    text.includes('track') ||
    text.includes('order') ||
    text.includes('تتبع') ||
    text.includes('طلب')
  ) {
    return isAr
      ? 'لتتبع طلبك، افتح حسابك ← طلباتي. إذا احتجت مساعدة إضافية، أرسل رقم الطلب وسيتواصل معك فريق الدعم.'
      : 'To track your order, go to your account → My Orders. If you need more help, send your order number and our team will follow up.';
  }
  if (text.includes('return') || text.includes('استرجاع')) {
    return isAr
      ? 'طلبات الاسترجاع متاحة خلال 14 يوماً. افتح الطلب من "طلباتي" واختر طلب استرجاع، أو اترك تفاصيل الطلب هنا.'
      : 'Returns are available within 14 days. Open the order from My Orders and request a return, or leave your order details here.';
  }
  if (text.includes('cancel') || text.includes('إلغاء')) {
    return isAr
      ? 'يمكن إلغاء الطلب قبل الشحن من صفحة "طلباتي". أرسل رقم الطلب إن لم يظهر لك خيار الإلغاء.'
      : 'You can cancel before shipping from My Orders. Send your order number if you do not see a cancel option.';
  }
  if (text.includes('payment') || text.includes('pay') || text.includes('دفع')) {
    return isAr
      ? 'نقبل Paymob والبطاقات وفوري وفودافون كاش والدفع عند الاستلام. إذا فشل الدفع، جرّب مرة أخرى من الطلب أو تواصل مع الدعم.'
      : 'We accept Paymob, cards, Fawry, Vodafone Cash, and cash on delivery. If payment failed, retry from your order or contact support.';
  }

  return isAr
    ? 'شكراً لتواصلك مع BrandHive. تم استلام رسالتك وسيرد فريق الدعم قريباً.'
    : 'Thanks for contacting BrandHive. Your message was received and our support team will reply soon.';
};

export const isAutoHandledSupportIntent = (messageText) => {
  const text = String(messageText || '').trim().toLowerCase();
  const autoPhrases = [
    'track my order',
    'return request',
    'cancel order',
    'payment issue',
    'تتبع طلبي',
    'طلب استرجاع',
    'إلغاء الطلب',
    'مشكلة في الدفع',
  ];
  if (autoPhrases.includes(text)) return true;

  return (
    /\b(track|return|cancel|payment)\b/.test(text) ||
    /(تتبع|استرجاع|إلغاء|دفع)/.test(text)
  );
};

export const autoResolveSupportTicket = async ({
  ticketId,
  reply,
  ticketMeta = {},
}) => {
  if (!ticketId || !reply?.trim()) return null;
  return syncLocalSupportReply(ticketId, reply, 'resolved', ticketMeta);
};

export const chatAPI = {
  sendMessage: async (messages, language) => {
    const lastUserMessage =
      [...(messages || [])].reverse().find((m) => m.role === 'user')?.content || '';

    try {
      const response = await fetch('/chat/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, language }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          reply: getInstantSupportReply(lastUserMessage, language),
          offline: true,
        };
      }

      return {
        reply: data?.reply || getInstantSupportReply(lastUserMessage, language),
        offline: Boolean(data?.offline),
      };
    } catch {
      return {
        reply: getInstantSupportReply(lastUserMessage, language),
        offline: true,
      };
    }
  },
};

// ─── Inventory ───────────────────────────────────────────────────────────────
export const inventoryAPI = {
  getLogs: (params = {}) => api.get('/inventory/logs', { params }),
  getLogsByProduct: (productId, params = {}) =>
    api.get(`/inventory/logs/${productId}`, { params }),
  adjust: (data) => api.post('/inventory/adjust', data),
  getLowStock: (params = {}) => api.get('/inventory/low-stock', { params }),
  getOutOfStock: (params = {}) => api.get('/inventory/out-of-stock', { params }),
  getAlerts: async () => {
    try {
      const res = await api.get('/seller/inventory/alerts');
      if (getResponseArray(res).length > 0) return res;
    } catch {
      // fall through to admin inventory endpoints
    }
    try {
      return await api.get('/inventory/low-stock');
    } catch {
      return api.get('/inventory/out-of-stock');
    }
  },
};

// ─── Search ────────────────────────────────────────────────────────────────────
export const searchAPI = {
  search: (params) => getPublicProducts(params),
  getFacets: () => api.get('/search/facets'),
};

const normalizeFacetsPayload = (facetsRes) => {
  const root = facetsRes?.data || {};
  if (root?.data && typeof root.data === 'object' && !Array.isArray(root.data)) {
    return root.data;
  }
  return root;
};

const collectGovernorates = (brands = [], facets = {}) => {
  const govs = new Set();
  brands.forEach((brand) => {
    ['governorate', 'city', 'location'].forEach((field) => {
      const value = brand?.[field];
      if (!value) return;
      const normalized = String(value).trim();
      if (!normalized || normalized.toLowerCase() === 'egypt') return;
      govs.add(normalized);
    });
  });
  (facets.governorates || []).forEach((entry) => {
    const name =
      typeof entry === 'string'
        ? entry
        : entry?.name || entry?.governorate || entry?._id;
    if (name) govs.add(String(name).trim());
  });
  return govs;
};

/** Public homepage stats from live catalog data (no auth required). */
export const fetchPublicStats = async () => {
  const [productsRes, facetsRes, mirrorStats] = await Promise.all([
    getPublicProducts({ page: 1, limit: 1 }),
    searchAPI.getFacets().catch(() => null),
    fetchPublicHomepageStats().catch(() => ({})),
  ]);

  const facets = normalizeFacetsPayload(facetsRes);
  const facetBrands = Array.isArray(facets.brands) ? facets.brands : [];

  const products =
    productsRes?.data?.meta?.total ??
    getResponseArray(productsRes).length ??
    0;

  let brands =
    facets.totalBrands ??
    facets.brandsCount ??
    facets.brandCount ??
    facetBrands.length;

  if (hasAuthToken()) {
    try {
      const brandRes = await api.get('/brand', { params: { page: 1, limit: 1 } });
      const brandTotal = brandRes.data?.meta?.total;
      if (brandTotal != null) brands = brandTotal;
    } catch {
      // keep facet-derived count
    }
  }

  const derivedGovernorates = collectGovernorates(facetBrands, facets).size;
  let governorates =
    Number(mirrorStats?.governorates) ||
    derivedGovernorates ||
    EGYPT_GOVERNORATES_COUNT;

  const buyers = await resolveBuyersCount({
    mirrorStats,
    facets,
    products: Number(products) || 0,
  });

  return {
    brands: Number(brands) || 0,
    products: Number(products) || 0,
    governorates: Number(governorates) || EGYPT_GOVERNORATES_COUNT,
    buyers: Number(buyers) || 0,
  };
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

const normalizeCouponExpiry = (expiresAt) => {
  if (!expiresAt) return undefined;
  const raw = String(expiresAt).trim();
  if (!raw) return undefined;
  if (raw.includes('T')) return new Date(raw).toISOString();
  const endOfDay = new Date(`${raw}T23:59:59.999`);
  return Number.isNaN(endOfDay.getTime()) ? raw : endOfDay.toISOString();
};

const computeCouponDiscountAmount = (coupon, subtotal = 0) => {
  const base = Math.max(0, Number(subtotal) || 0);
  if (!coupon || base <= 0) return 0;

  const minOrder = Number(coupon.minOrder || coupon.minimumOrder) || 0;
  if (minOrder > 0 && base < minOrder) return 0;

  const type = coupon.type || coupon.discountType || 'percentage';
  const value = Number(coupon.value ?? coupon.discountValue ?? coupon.amount) || 0;

  if (type === 'percentage' || type === 'percent') {
    return Math.round(base * value / 100);
  }

  return Math.min(base, value);
};

export const syncPlatformCoupon = async (coupon = {}) => {
  if (!localPlatform || !coupon?.code) return null;

  const res = await localPlatform.post('/coupons', {
    code: String(coupon.code).toUpperCase().trim(),
    type: coupon.type || 'percentage',
    value: Number(coupon.value),
    expiresAt: normalizeCouponExpiry(coupon.expiresAt),
    minOrder: Number(coupon.minOrder) || 0,
    railwayId: coupon._id || coupon.id || undefined,
  });
  return res.data?.data || res.data;
};

export const validatePlatformCoupon = async (code, subtotal = 0) => {
  if (!localPlatform) return null;

  const res = await localPlatform.post('/coupons/validate', {
    code: String(code || '').toUpperCase().trim(),
    subtotal: Number(subtotal) || 0,
  });
  return res.data?.data || res.data;
};

export const removePlatformCoupon = async (coupon = {}) => {
  if (!localPlatform) return;
  const couponId = coupon._id || coupon.id;
  const code = coupon.code;
  if (!couponId && !code) return;

  await localPlatform.delete(
    `/coupons/${couponId ? String(couponId) : 'by-code'}`,
    { params: code ? { code: String(code).toUpperCase().trim() } : {} }
  );
};

const brandOffersCache = new Map();

const cacheBrandOffers = (brandId, offers) => {
  if (brandId) {
    brandOffersCache.set(String(brandId), {
      promos: Array.isArray(offers?.promos) ? offers.promos : [],
      coupons: Array.isArray(offers?.coupons) ? offers.coupons : [],
    });
  }
};

const getCachedBrandPromos = (brandId) =>
  brandOffersCache.get(String(brandId))?.promos || [];

const getCachedBrandCoupons = (brandId) =>
  brandOffersCache.get(String(brandId))?.coupons || [];

const productSaleCache = new Map();

export const saveProductSaleMirror = async (productId, payload = {}) => {
  if (!localPlatform || !productId || !payload.brandId) return null;

  const res = await localPlatform.put(
    `/products/${encodeURIComponent(String(productId))}/sale`,
    {
      brandId: String(payload.brandId),
      originalPrice: Number(payload.originalPrice),
      discountPrice: Number(payload.discountPrice),
      discountPercent:
        payload.discountPercent != null ? Number(payload.discountPercent) : undefined,
    }
  );
  productSaleCache.delete(String(payload.brandId));
  return res.data?.data || res.data;
};

export const fetchBrandProductSales = async (brandId) => {
  if (!brandId || !localPlatform) return new Map();

  const key = String(brandId);
  if (productSaleCache.has(key)) return productSaleCache.get(key);

  try {
    const res = await localPlatform.get(
      `/brands/${encodeURIComponent(key)}/product-sales`
    );
    const map = new Map();
    getResponseArray(res).forEach((entry) => {
      if (entry?.productId) map.set(String(entry.productId), entry);
    });
    productSaleCache.set(key, map);
    return map;
  } catch {
    return new Map();
  }
};

export const applyFlashPromoToMappedProduct = (product, promos = []) => {
  if (!product || !Array.isArray(promos) || promos.length === 0) return product;

  const productId = String(product.id || product._id || '');
  const flash = promos.find(
    (promo) =>
      promo.type === 'flash' &&
      promo.active !== false &&
      Number(promo.discount) > 0 &&
      (!promo.productId || String(promo.productId) === productId)
  );
  if (!flash) return product;

  const base = Number(product.originalPrice) || Number(product.price) || 0;
  if (base <= 0) return product;

  const pct = Number(flash.discount);
  const salePrice = Math.round(base * (1 - pct / 100));
  if (salePrice <= 0 || salePrice >= base) return product;

  return {
    ...product,
    price: salePrice,
    originalPrice: base,
    discount: pct,
    isOnSale: true,
  };
};

export const applyProductPricingOffers = (product, { promos = [], sales = null } = {}) => {
  if (!product) return product;

  const productId = String(product.id || product._id || '');
  const sale = sales instanceof Map ? sales.get(productId) : null;

  if (sale && Number(sale.discountPrice) > 0) {
    const original = Number(sale.originalPrice) || Number(product.price) || 0;
    const discounted = Number(sale.discountPrice);
    if (original > 0 && discounted > 0 && discounted < original) {
      return {
        ...product,
        price: discounted,
        originalPrice: original,
        discount:
          sale.discountPercent != null
            ? Number(sale.discountPercent)
            : Math.round((1 - discounted / original) * 100),
        isOnSale: true,
      };
    }
  }

  return applyFlashPromoToMappedProduct(product, promos);
};

export const enrichMappedProductWithPricing = async (product) => {
  if (!product?.brandId) return product;

  try {
    const [offers, sales] = await Promise.all([
      fetchBrandPublicOffers(product.brandId),
      fetchBrandProductSales(product.brandId),
    ]);
    return applyProductPricingOffers(product, { promos: offers.promos, sales });
  } catch {
    return product;
  }
};

export const enrichMappedProductsWithPricing = async (products = []) => {
  if (!Array.isArray(products) || products.length === 0) return products;

  const brandIds = [...new Set(products.map((product) => product.brandId).filter(Boolean))];
  const offersByBrand = new Map();
  const salesByBrand = new Map();

  await Promise.all(
    brandIds.map(async (brandId) => {
      const key = String(brandId);
      const [offers, sales] = await Promise.all([
        fetchBrandPublicOffers(brandId).catch(() => ({ promos: [], coupons: [] })),
        fetchBrandProductSales(brandId).catch(() => new Map()),
      ]);
      offersByBrand.set(key, offers.promos || []);
      salesByBrand.set(key, sales);
    })
  );

  return products.map((product) =>
    applyProductPricingOffers(product, {
      promos: offersByBrand.get(String(product.brandId)) || [],
      sales: salesByBrand.get(String(product.brandId)) || new Map(),
    })
  );
};

export const fetchBrandPublicOffers = async (brandId) => {
  if (!brandId) return { promos: [], coupons: [] };

  if (!localPlatform) throw mirrorServiceUnavailable();

  const res = await localPlatform.get(
    `/brands/${encodeURIComponent(String(brandId))}/offers`
  );
  const data = res.data?.data || res.data || {};
  const offers = {
    promos: Array.isArray(data.promos) ? data.promos : [],
    coupons: Array.isArray(data.coupons) ? data.coupons : [],
  };
  cacheBrandOffers(brandId, offers);
  return offers;
};

export const syncBrandPublicOffers = () => {
  // Offers are stored on the server when sellers create coupons/promos.
};

const getCartBrandIds = (items = []) =>
  [
    ...new Set(
      items
        .map((item) => String(item.brandId || item.brand?._id || item.brand?.id || ''))
        .filter(Boolean)
    ),
  ];

export const prefetchCartBrandOffers = async (items = []) => {
  const brandIds = getCartBrandIds(items);
  await Promise.allSettled(
    brandIds.map((brandId) => fetchBrandPublicOffers(brandId))
  );
};

const findBrandCouponOnServer = async (code, preferredBrandIds = []) => {
  const normalized = String(code || '').toUpperCase().trim();
  if (!normalized) return null;

  const now = Date.now();
  const brandIds =
    preferredBrandIds.length > 0
      ? preferredBrandIds.map(String)
      : [...brandOffersCache.keys()];

  for (const brandId of brandIds) {
    let coupons = getCachedBrandCoupons(brandId);
    if (coupons.length === 0) {
      try {
        const offers = await fetchBrandPublicOffers(brandId);
        coupons = offers.coupons;
      } catch {
        continue;
      }
    }

    const match = coupons.find(
      (coupon) => coupon.code?.toUpperCase() === normalized
    );
    if (!match) continue;
    if (match.expiresAt && new Date(match.expiresAt).getTime() < now) continue;
    return { coupon: match, brandId };
  }

  return null;
};

export const computeBrandCouponDiscount = (
  coupon,
  items = [],
  subtotal = 0,
  brandId = ''
) => {
  const scopedBrandId = String(brandId || coupon?.brandId || '');
  const brandItems = scopedBrandId
    ? items.filter((item) => String(item.brandId) === scopedBrandId)
    : items;
  const brandSubtotal = brandItems.reduce(
    (sum, item) =>
      sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
    0
  );
  const base = brandSubtotal > 0 ? brandSubtotal : subtotal;
  if (!base || !coupon) return 0;

  if (coupon.type === 'percentage') {
    return Math.round(base * (Number(coupon.value) || 0) / 100);
  }

  return Math.min(base, Number(coupon.value) || 0);
};

export const computeCartPromoAdjustments = (
  items = [],
  subtotal = 0,
  couponDiscount = 0
) => {
  const brandIds = getCartBrandIds(items);
  const baseShipping = subtotal >= 500 ? 0 : 50;
  let bundleDiscount = 0;
  const promoLabels = [];

  let qualifyingSubtotal = 0;
  brandIds.forEach((brandId) => {
    const freeShip = getCachedBrandPromos(brandId).find(
      (entry) => entry.type === 'free_shipping'
    );
    if (!freeShip) return;

    const minOrder = Number(freeShip.minOrder) || 0;
    const brandSubtotal = items
      .filter((item) => String(item.brandId) === brandId)
      .reduce(
        (sum, item) =>
          sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
        0
      );

    if (brandSubtotal >= minOrder) {
      qualifyingSubtotal += brandSubtotal;
      if (freeShip.label) promoLabels.push(freeShip.label);
    }
  });

  let shippingCost = baseShipping;
  if (baseShipping > 0 && qualifyingSubtotal > 0 && subtotal > 0) {
    shippingCost =
      qualifyingSubtotal >= subtotal
        ? 0
        : Math.round(baseShipping * (1 - qualifyingSubtotal / subtotal));
  }

  brandIds.forEach((brandId) => {
    const bundle = getCachedBrandPromos(brandId).find(
      (entry) => entry.type === 'buy_x_get_y'
    );
    if (!bundle) return;

    const buyQty = Number(bundle.buyQty) || 0;
    const discountPct = Number(bundle.discount) || 0;
    if (buyQty <= 1 || discountPct <= 0) return;

    const units = [];
    items
      .filter((item) => String(item.brandId) === brandId)
      .forEach((item) => {
        const unitPrice = Number(item.price) || 0;
        const qty = Number(item.quantity) || 1;
        for (let i = 0; i < qty; i += 1) units.push(unitPrice);
      });

    units.sort((a, b) => a - b);
    const extraUnits = units.length - buyQty;
    if (extraUnits <= 0) return;

    const savings = units
      .slice(0, extraUnits)
      .reduce((sum, price) => sum + Math.round(price * discountPct / 100), 0);

    if (savings > 0) {
      bundleDiscount += savings;
      if (bundle.label) promoLabels.push(bundle.label);
    }
  });

  const totalDiscount = couponDiscount + bundleDiscount;
  const total = Math.max(0, subtotal + shippingCost - totalDiscount);

  return {
    shippingCost,
    couponDiscount,
    bundleDiscount,
    totalDiscount,
    total,
    promoLabels,
  };
};

export const applyCartCouponCode = async ({ code, items = [], subtotal = 0 }) => {
  const normalized = String(code || '').toUpperCase().trim();
  if (!normalized) throw new Error('Coupon code required');

  if (localPlatform) {
    try {
      const mirrorResult = await validatePlatformCoupon(normalized, subtotal);
      if (mirrorResult?.valid !== false) {
        const discount = Number(mirrorResult?.discount) || 0;
        if (discount > 0) {
          return {
            code: normalized,
            source: 'platform',
            discount,
            coupon: mirrorResult.coupon,
            persisted: false,
          };
        }
      }
    } catch (err) {
      if (err.response?.status !== 404) {
        // keep trying other validators
      }
    }
  }

  try {
    const res = await cartAPI.applyCoupon({ couponCode: normalized });
    const data = res.data?.data || res.data || {};
    const apiSubtotal = Number(data.subtotal) || subtotal;
    const apiTotal = Number(data.total);
    const apiDiscount =
      Number(data.couponDiscount || data.couponSaving || 0) || 0;
    const discountValue =
      apiSubtotal && Number.isFinite(apiTotal)
        ? Math.max(0, apiSubtotal - apiTotal)
        : apiDiscount;

    if (discountValue > 0) {
      return {
        code: normalized,
        source: 'railway',
        discount: discountValue,
        persisted: true,
      };
    }
  } catch {
    // fall through to validate / brand coupons
  }

  try {
    const res = await couponsAPI.validate({ code: normalized, subtotal });
    const data = res.data?.data || res.data || {};
    if (data.valid === false || data.isValid === false) {
      throw new Error('invalid');
    }

    const coupon = data.coupon || data;
    let discount = Number(
      data.discount ||
        data.discountAmount ||
        data.couponDiscount ||
        data.saving ||
        data.amount ||
        0
    );

    if (discount <= 0) {
      discount = computeCouponDiscountAmount(coupon, subtotal);
    }

    if (discount > 0) {
      return {
        code: normalized,
        source: 'validate',
        discount,
        coupon,
        persisted: false,
      };
    }
  } catch {
    // fall through
  }

  const brandIds = getCartBrandIds(items);
  const found = await findBrandCouponOnServer(normalized, brandIds);
  if (!found) throw new Error('invalid');

  const discount = computeBrandCouponDiscount(
    found.coupon,
    items,
    subtotal,
    found.brandId
  );
  if (discount <= 0) throw new Error('invalid');

  return {
    code: normalized,
    source: 'brand',
    brandId: found.brandId,
    coupon: found.coupon,
    discount,
    persisted: false,
  };
};

const extractServerCartLines = (data) => {
  const raw =
    data?.data?.items ||
    data?.items ||
    (Array.isArray(data?.data) ? data.data : []) ||
    [];
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => ({
      productId: String(
        item.product?.id ||
          item.product?._id ||
          item.productId?._id ||
          item.productId?.id ||
          item.productId ||
          item.id ||
          ''
      ),
      quantity: Math.max(1, Number(item.quantity) || 1),
    }))
    .filter((line) => isMongoId(line.productId));
};

const cartLinesMatch = (clientLines, serverLines) => {
  if (clientLines.length !== serverLines.length) return false;
  const serverMap = new Map(serverLines.map((line) => [line.productId, line.quantity]));
  return clientLines.every((line) => serverMap.get(line.productId) === line.quantity);
};

export const syncCartBeforeCheckout = async (cartItems = []) => {
  const payload = cartItems
    .filter((item) => {
      const id = String(item.id || item.productId || '');
      return isMongoId(id);
    })
    .map((item) => ({
      productId: String(item.id || item.productId),
      quantity: Math.max(1, Number(item.quantity) || 1),
    }));

  if (payload.length === 0) {
    throw new Error('Cart items must be real catalog products to checkout');
  }

  let serverLines = [];
  try {
    const res = await cartAPI.get();
    serverLines = extractServerCartLines(res.data);
  } catch {
    serverLines = [];
  }

  if (cartLinesMatch(payload, serverLines)) {
    return payload;
  }

  try {
    await cartAPI.clear();
  } catch {
    // cart may already be empty
  }

  const failedIds = [];
  for (const entry of payload) {
    try {
      await cartAPI.add(entry);
    } catch {
      failedIds.push(entry.productId);
    }
  }

  if (failedIds.length > 0) {
    throw new Error(
      failedIds.length === payload.length
        ? 'Could not sync your cart with the server. Remove items and add them again.'
        : 'Some cart items could not be synced. Please refresh and try again.'
    );
  }

  try {
    const verify = await cartAPI.get();
    const verified = extractServerCartLines(verify.data);
    if (!cartLinesMatch(payload, verified)) {
      throw new Error('Cart sync verification failed');
    }
  } catch (err) {
    if (err.message?.includes('sync') || err.message?.includes('Cart')) throw err;
    throw new Error('Could not verify cart before checkout');
  }

  return payload;
};

export const isUsablePaymentUrl = (url) => {
  if (!url || typeof url !== 'string') return false;

  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;

  const blockedPatterns = [
    /PLACEHOLDER/i,
    /IFRAME_ID/i,
    /YOUR_/i,
    /example\.com/i,
    /localhost/i,
  ];
  if (blockedPatterns.some((pattern) => pattern.test(trimmed))) return false;

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname.includes('paymob.com')) {
      if (/iframe/i.test(parsed.pathname) && !/\/iframes\/\d+/i.test(parsed.pathname)) {
        return false;
      }
      const token = parsed.searchParams.get('payment_token');
      if (!token || /placeholder/i.test(token)) return false;
    }
    return true;
  } catch {
    return false;
  }
};

export const extractOrderPaymentUrl = (response) => {
  const data = response?.data?.data || response?.data?.order || response?.data || {};
  const raw =
    data.paymentUrl ||
    data.checkoutUrl ||
    data.iframeUrl ||
    response?.data?.paymentUrl ||
    null;

  return isUsablePaymentUrl(raw) ? raw : null;
};

export const extractCreatedOrderId = (response) => {
  const data = response?.data?.data || response?.data?.order || response?.data || {};
  return data._id || data.id || data.orderId || null;
};

export const initiateOrderPayment = async (orderId, options = {}) => {
  if (!orderId) return null;

  try {
    const res = await ordersAPI.retryPayment(orderId);
    const railwayUrl = extractOrderPaymentUrl(res);
    if (railwayUrl) return railwayUrl;
  } catch {
    // fall through to companion Paymob
  }

  return initiatePaymobCheckout({ orderId, ...options });
};

export const initiatePaymobCheckout = async ({
  orderId,
  amount,
  paymentMethod = 'paymob',
  billing = {},
  customerEmail = '',
} = {}) => {
  if (!orderId) return null;

  if (!localPayment) {
    throw new Error(
      'Payment service unavailable. Run `npm run server` locally or set VITE_MIRROR_API_URL.'
    );
  }

  const parsed = getStoredAuth();
  const token = parsed?.token || parsed?.accessToken;

  const res = await localPayment.post(
    '/paymob/initiate',
    {
      orderId,
      amount,
      paymentMethod,
      billing,
      customerEmail,
    },
    token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
  );

  const paymentUrl = res.data?.data?.paymentUrl || res.data?.paymentUrl || null;
  return isUsablePaymentUrl(paymentUrl) ? paymentUrl : null;
};

export const fetchPaymobStatus = async () => {
  if (!localPayment) {
    return {
      available: false,
      configured: false,
      fawryConfigured: false,
      reason: 'mirror_unavailable',
    };
  }

  try {
    const res = await localPayment.get('/paymob/status');
    const data = res.data?.data || res.data || {};
    return {
      available: true,
      configured: Boolean(data.configured),
      fawryConfigured: Boolean(data.fawryConfigured),
    };
  } catch {
    return {
      available: false,
      configured: false,
      fawryConfigured: false,
      reason: 'status_unreachable',
    };
  }
};

const PAID_ORDERS_STORAGE_KEY = 'brandhive_paid_orders';

export const parsePaymobReturnSuccess = (params = {}) => {
  const read = (key) => {
    if (params instanceof URLSearchParams) return params.get(key);
    return params?.[key];
  };

  const success = read('success');
  if (success === 'true' || success === '1') return true;

  const code = String(read('txn_response_code') || read('txn_response') || '').toUpperCase();
  if (code === 'APPROVED') return true;

  const message = String(read('data_message') || read('message') || '').toLowerCase();
  if (message.includes('approved') || message.includes('success')) return true;

  if (read('paid') === 'true') return true;
  return false;
};

const PAYMENT_PENDING_STATUSES = new Set([
  'pending',
  'pending_payment',
  'payment_failed',
]);

const isPaymentPendingStatus = (status) =>
  PAYMENT_PENDING_STATUSES.has(String(status || '').toLowerCase());

export const markOrderPaidLocally = (orderId) => {
  if (!orderId || typeof localStorage === 'undefined') return;
  try {
    const map = JSON.parse(localStorage.getItem(PAID_ORDERS_STORAGE_KEY) || '{}');
    map[String(orderId)] = { paidAt: new Date().toISOString() };
    localStorage.setItem(PAID_ORDERS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota errors
  }
};

export const applyPaidOrderOverlay = (orders = []) => {
  if (!Array.isArray(orders) || typeof localStorage === 'undefined') return orders;

  let paidMap = {};
  try {
    paidMap = JSON.parse(localStorage.getItem(PAID_ORDERS_STORAGE_KEY) || '{}');
  } catch {
    paidMap = {};
  }

  return orders.map((order) => {
    const id = String(order._id || order.id || order.orderId || '');
    const status = String(order.status || order.orderStatus || '').toLowerCase();
    if (!id || !paidMap[id]) return order;
    if (!isPaymentPendingStatus(status)) return order;
    return { ...order, status: 'paid' };
  });
};

export const hydratePaidOrdersFromMirror = async (orders = []) => {
  const withLocal = applyPaidOrderOverlay(orders);
  if (!localPayment || !Array.isArray(withLocal) || withLocal.length === 0) {
    return withLocal;
  }

  const updated = [...withLocal];
  await Promise.allSettled(
    updated.map(async (order, index) => {
      const id = String(order._id || order.id || order.orderId || '');
      const status = String(order.status || order.orderStatus || '').toLowerCase();
      if (!id || !isPaymentPendingStatus(status)) return;

      try {
        const res = await localPayment.get(`/paymob/order/${encodeURIComponent(id)}/status`);
        const sessionStatus = res.data?.data?.status || res.data?.status;
        if (sessionStatus === 'paid') {
          updated[index] = { ...order, status: 'paid', orderStatus: 'paid' };
          markOrderPaidLocally(id);
        }
      } catch {
        // mirror unavailable
      }
    })
  );

  return updated;
};

export const confirmPaymobReturn = async (orderId, paymobParams = {}) => {
  if (!orderId) return null;

  const paramsObject =
    paymobParams instanceof URLSearchParams
      ? Object.fromEntries(paymobParams.entries())
      : paymobParams;

  const success = parsePaymobReturnSuccess(paramsObject);
  if (!success) {
    return { success: false, status: 'pending' };
  }

  if (localPayment) {
    try {
      const parsed = getStoredAuth();
      const token = parsed?.token || parsed?.accessToken;
      const res = await localPayment.post(
        '/paymob/confirm',
        { orderId: String(orderId), paymobParams: paramsObject },
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
      );
      const data = res.data?.data || res.data || {};
      if (data.success) {
        markOrderPaidLocally(orderId);
      }
      return data;
    } catch {
      markOrderPaidLocally(orderId);
      return { success: true, status: 'paid', localOnly: true };
    }
  }

  markOrderPaidLocally(orderId);
  return { success: true, status: 'paid', localOnly: true };
};

const isMirrorPaymobOrder = (order) => {
  const payment = String(order?.paymentMethod || order?.payment?.method || '').toLowerCase();
  return (
    payment.includes('paymob') ||
    payment.includes('fawry') ||
    payment === 'card' ||
    payment === 'visa'
  );
};

export const fetchPaidOrderIdsFromMirror = async () => {
  if (!localPayment) return new Set();

  try {
    const res = await localPayment.get('/paymob/paid-orders');
    const ids = res.data?.data?.orderIds || res.data?.orderIds || [];
    return new Set(ids.map(String));
  } catch {
    return new Set();
  }
};

export const hydrateOrdersWithPaymobPaymentStatus = async (
  orders = [],
  { reconcile = true } = {}
) => {
  if (!Array.isArray(orders) || orders.length === 0) return orders;

  const withLocal = applyPaidOrderOverlay(orders).map((order) => {
    const status = String(order.status || order.orderStatus || '').toLowerCase();
    if (status === 'paid' && isMirrorPaymobOrder(order)) {
      return { ...order, status: 'confirmed' };
    }
    return order;
  });

  const paidIds = await fetchPaidOrderIdsFromMirror();
  const updated = [...withLocal];

  await Promise.allSettled(
    updated.map(async (order, index) => {
      const id = String(order._id || order.id || order.orderId || '');
      const status = String(order.status || order.orderStatus || '').toLowerCase();
      if (!id || status !== 'pending' || !isMirrorPaymobOrder(order)) return;
      if (!paidIds.has(id)) return;

      if (reconcile && localPayment) {
        try {
          await localPayment.post(`/paymob/reconcile/${encodeURIComponent(id)}`);
        } catch {
          // overlay status even if reconcile fails
        }
      }

      updated[index] = { ...order, status: 'confirmed' };
    })
  );

  return updated;
};

export const syncAdminOrdersAfterPaymob = async (orders = []) => {
  const paidIds = await fetchPaidOrderIdsFromMirror();
  const hydrated = await hydrateOrdersWithPaymobPaymentStatus(orders, {
    reconcile: true,
  });
  const updated = [...hydrated];

  await Promise.allSettled(
    updated.map(async (order, index) => {
      const id = String(order._id || order.id || '');
      const status = String(order.status || order.orderStatus || '').toLowerCase();
      if (!id || status !== 'pending' || !isMirrorPaymobOrder(order) || !paidIds.has(id)) {
        return;
      }

      try {
        await adminAPI.markOrderPaid(id);
        updated[index] = { ...order, status: 'confirmed' };
      } catch {
        updated[index] = { ...order, status: 'confirmed', _paymentVerifiedLocally: true };
      }
    })
  );

  return updated;
};

export const fetchSellerCoupons = async (userId, brandId) => {
  if (!userId) return [];

  if (localPlatform) {
    const res = await localPlatform.get(
      `/sellers/${encodeURIComponent(String(userId))}/coupons`,
      { params: brandId ? { brandId: String(brandId) } : {} }
    );
    return getResponseArray(res);
  }

  try {
    const res = await couponsAPI.getAll({ page: 1, limit: 50 });
    return getResponseArray(res);
  } catch {
    return [];
  }
};

export const createSellerCoupon = async (userId, brandId, payload) => {
  const body = {
    code: String(payload.code || '').toUpperCase().trim(),
    type: payload.type || 'percentage',
    value: Number(payload.value),
    expiresAt: payload.expiresAt,
    ...(brandId ? { brandId: String(brandId) } : {}),
  };

  if (localPlatform) {
    const res = await localPlatform.post(
      `/sellers/${encodeURIComponent(String(userId))}/coupons`,
      body
    );
    const entry = res.data?.data || res.data || body;
    if (brandId) {
      brandOffersCache.delete(String(brandId));
    }
    return entry;
  }

  let created = null;
  try {
    const res = await couponsAPI.create(body);
    created = res.data?.data || res.data || body;
  } catch (err) {
    const message = String(err.response?.data?.message || '');
    if (!message.includes('should not exist')) throw err;
    const res = await couponsAPI.create({
      code: body.code,
      type: body.type,
      value: body.value,
      expiresAt: body.expiresAt,
    });
    created = res.data?.data || res.data || body;
  }

  return {
    ...created,
    code: created.code || body.code,
    brandId: brandId ? String(brandId) : undefined,
    createdAt: created.createdAt || new Date().toISOString(),
  };
};

export const deleteSellerCoupon = async (userId, couponId, code, brandId) => {
  if (localPlatform) {
    const couponKey = couponId ? String(couponId) : 'by-code';
    await localPlatform.delete(
      `/sellers/${encodeURIComponent(String(userId))}/coupons/${encodeURIComponent(couponKey)}`,
      { params: { code, brandId: brandId ? String(brandId) : undefined } }
    );
    if (brandId) brandOffersCache.delete(String(brandId));
    return [];
  }

  try {
    if (couponId) await couponsAPI.delete(couponId);
  } catch {
    // ignore remote delete failures
  }

  return [];
};

export const fetchSellerPromotions = async (userId, brandId) => {
  if (!userId) return [];

  if (!localPlatform) throw mirrorServiceUnavailable();

  const res = await localPlatform.get(
    `/sellers/${encodeURIComponent(String(userId))}/promos`,
    { params: brandId ? { brandId: String(brandId) } : {} }
  );
  return getResponseArray(res);
};

export const saveSellerPromotion = async (userId, brandId, promotion) => {
  if (!userId || !promotion?.type) {
    throw new Error('Invalid promotion');
  }

  if (!localPlatform) throw mirrorServiceUnavailable();

  const res = await localPlatform.post(
    `/sellers/${encodeURIComponent(String(userId))}/promos`,
    {
      ...promotion,
      brandId: brandId ? String(brandId) : undefined,
    }
  );
  const entry = res.data?.data || res.data;
  if (brandId) brandOffersCache.delete(String(brandId));
  return entry;
};

export const fetchSavedCards = async (userId) => {
  if (!userId) return [];
  if (!localPlatform) throw mirrorServiceUnavailable();

  const res = await localPlatform.get(
    `/users/${encodeURIComponent(String(userId))}/saved-cards`
  );
  return getResponseArray(res);
};

export const addSavedCard = async (userId, card = {}) => {
  if (!userId) throw new Error('User required');
  if (!localPlatform) throw mirrorServiceUnavailable();

  const res = await localPlatform.post(
    `/users/${encodeURIComponent(String(userId))}/saved-cards`,
    card
  );
  return res.data?.data || res.data;
};

export const removeSavedCard = async (userId, cardId) => {
  if (!userId || !cardId) return;
  if (!localPlatform) throw mirrorServiceUnavailable();

  await localPlatform.delete(
    `/users/${encodeURIComponent(String(userId))}/saved-cards/${encodeURIComponent(String(cardId))}`
  );
};

export const setDefaultSavedCard = async (userId, cardId) => {
  if (!userId || !cardId) return null;
  if (!localPlatform) throw mirrorServiceUnavailable();

  const res = await localPlatform.patch(
    `/users/${encodeURIComponent(String(userId))}/saved-cards/${encodeURIComponent(String(cardId))}/default`
  );
  return res.data?.data || res.data;
};

export const fetchSellerStoreSettings = async (userId, brandId) => {
  if (!userId) return { bazaar: {}, shop: {} };
  if (!localPlatform) return { bazaar: {}, shop: {} };

  const key = String(userId);
  const cached = storeSettingsCache.get(key);
  if (cached && Date.now() - cached.at < 30_000) {
    return cached.data;
  }

  if (storeSettingsInflight.has(key)) {
    return storeSettingsInflight.get(key);
  }

  const request = localPlatform
    .get(`/users/${encodeURIComponent(String(userId))}/store-settings`, {
      params: brandId ? { brandId: String(brandId) } : {},
    })
    .then((res) => {
      const data = res.data?.data || res.data || { bazaar: {}, shop: {} };
      storeSettingsCache.set(key, { data, at: Date.now() });
      return data;
    })
    .finally(() => {
      storeSettingsInflight.delete(key);
    });

  storeSettingsInflight.set(key, request);
  return request;
};

export const saveSellerBazaarProfile = async (userId, brandId, bazaar = {}) => {
  if (!userId) throw new Error('User required');
  if (!localPlatform) throw mirrorServiceUnavailable();

  const res = await localPlatform.put(
    `/users/${encodeURIComponent(String(userId))}/store-settings`,
    { brandId: brandId ? String(brandId) : undefined, bazaar }
  );
  return res.data?.data || res.data;
};

export const saveSellerShopSettings = async (userId, brandId, shop = {}) => {
  if (!userId) throw new Error('User required');
  if (!localPlatform) throw mirrorServiceUnavailable();

  const res = await localPlatform.put(
    `/users/${encodeURIComponent(String(userId))}/store-settings`,
    { brandId: brandId ? String(brandId) : undefined, shop }
  );
  return res.data?.data || res.data;
};

export const applySellerFlashSale = async (
  productOrId,
  discountPercent,
  user = null,
  brandId = null
) => {
  const pct = Math.min(90, Math.max(1, Number(discountPercent) || 0));
  const userId = user?.id || user?._id;

  let product = null;
  let productId = null;

  if (typeof productOrId === 'object' && productOrId !== null) {
    product = productOrId;
    productId = product._id || product.id;
  } else {
    productId = productOrId;
  }

  if (!productId || pct <= 0) {
    throw new Error('Invalid flash sale values');
  }

  let price = resolveProductBasePrice(product);

  if (price <= 0 && user) {
    try {
      product = await fetchSellerProductForEdit(productId, user);
      price = resolveProductBasePrice(product);
    } catch {
      // fall through
    }
  }

  if (price <= 0 && user) {
    const cached = readCachedSellerProducts(user).find(
      (entry) => String(entry._id || entry.id) === String(productId)
    );
    if (cached) {
      product = cached;
      price = resolveProductBasePrice(cached);
    }
  }

  if (price <= 0) {
    throw new Error('Product not found');
  }

  const discountPrice = Math.round(price * (1 - pct / 100));
  const patch = {
    price,
    discountPrice,
    finalPrice: discountPrice,
    isOnSale: true,
    salePercent: pct,
  };

  let apiUpdated = false;
  try {
    await updateSellerProduct(productId, {
      discountPrice,
      isOnSale: true,
    });
    apiUpdated = true;
  } catch {
    // continue with mirror/cache fallback
  }

  let promoSaved = false;
  if (userId && brandId) {
    try {
      await saveSellerPromotion(userId, brandId, {
        type: 'flash',
        discount: pct,
        productId: String(productId),
        label: `${product?.name || 'Product'} — ${pct}% flash sale`,
      });
      promoSaved = true;
    } catch {
      // non-fatal
    }

    try {
      await saveProductSaleMirror(productId, {
        brandId,
        originalPrice: price,
        discountPrice,
        discountPercent: pct,
      });
      promoSaved = true;
    } catch {
      // non-fatal
    }
  }

  if (userId) {
    const cached = readCachedSellerProducts({ id: userId, _id: userId });
    cacheSellerProducts(
      userId,
      cached.map((entry) =>
        String(entry._id || entry.id) === String(productId)
          ? { ...entry, ...patch }
          : entry
      )
    );
  }

  if (!apiUpdated && !promoSaved && !userId) {
    throw new Error('Failed to activate flash sale');
  }

  return { productId, discountPrice, discountPercent: pct, apiUpdated, promoSaved };
};

export const fetchBrandProductReviews = async (products = []) => {
  const aggregated = [];
  const seen = new Set();

  await Promise.all(
    products.slice(0, 30).map(async (product) => {
      const productId = product.id || product._id;
      if (!productId) return;

      try {
        const res = await reviewsAPI.getProductReviews(productId);
        getResponseArray(res).forEach((review) => {
          const id = review._id || review.id;
          if (id && seen.has(String(id))) return;
          if (id) seen.add(String(id));
          aggregated.push({
            ...review,
            productName: product.name,
            productId,
          });
        });
      } catch {
        // ignore per-product failures
      }
    })
  );

  return aggregated.sort(
    (a, b) =>
      new Date(b.createdAt || 0).getTime() -
      new Date(a.createdAt || 0).getTime()
  );
};

export const fetchBrandFollowState = async (userId, brandId) => {
  if (!userId || !brandId) {
    return { isFollowing: false, followingIds: [], followersCount: 0 };
  }

  const localIds = readLocalFollowingIds(userId);
  let followingIds = [...localIds];

  try {
    const res = await brandsAPI.getMyFollowing();
    const apiIds = getResponseArray(res)
      .map((brand) => brand._id || brand.id)
      .filter(Boolean)
      .map(String);
    followingIds = [...new Set([...followingIds, ...apiIds])];
    writeLocalFollowingIds(userId, followingIds);
  } catch {
    // keep local cache
  }

  let followersCount = 0;
  try {
    followersCount = await fetchBrandFollowersCount(brandId);
  } catch {
    // ignore
  }

  return {
    isFollowing: followingIds.includes(String(brandId)),
    followingIds,
    followersCount,
  };
};

const brandFollowersCache = new Map();

export const fetchBrandFollowersCount = async (brandId) => {
  if (!brandId || !localPlatform) return 0;

  const key = String(brandId);
  if (brandFollowersCache.has(key)) return brandFollowersCache.get(key);

  try {
    const res = await localPlatform.get(
      `/brands/${encodeURIComponent(key)}/followers/count`
    );
    const count = Number(res.data?.data?.count ?? res.data?.count ?? 0);
    const safe = Number.isFinite(count) ? count : 0;
    brandFollowersCache.set(key, safe);
    return safe;
  } catch {
    return 0;
  }
};

export const mirrorBrandFollow = async (brandId, userId, following, email = null) => {
  if (!localPlatform || !brandId || !userId) return null;

  const path = `/brands/${encodeURIComponent(String(brandId))}/${following ? 'follow' : 'unfollow'}`;
  const res = await localPlatform.put(path, {
    userId: String(userId),
    ...(email ? { email: String(email).toLowerCase().trim() } : {}),
  });
  brandFollowersCache.delete(String(brandId));
  return res.data?.data || res.data;
};

const followStorageKey = (userId) => `brandhive_following_${userId || 'guest'}`;

const readLocalFollowingIds = (userId) => {
  if (!userId) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(followStorageKey(userId)) || '[]');
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

const writeLocalFollowingIds = (userId, ids) => {
  if (!userId) return;
  try {
    localStorage.setItem(
      followStorageKey(userId),
      JSON.stringify([...new Set((ids || []).map(String))])
    );
  } catch {
    // ignore quota errors
  }
};

export const toggleBrandFollow = async (
  userId,
  brandId,
  isCurrentlyFollowing,
  userEmail = null
) => {
  if (!userId) {
    throw new Error('Login required');
  }

  const id = String(brandId);
  if (!isValidMongoId(id)) {
    throw new Error('Invalid brand ID');
  }

  try {
    if (isCurrentlyFollowing) {
      await brandsAPI.unfollow(id);
    } else {
      await brandsAPI.follow(id);
    }
  } catch {
    // Follow API is customer-only on Railway; mirror + local cache still apply.
  }

  let mirrorCount = null;
  try {
    const mirrorResult = await mirrorBrandFollow(
      id,
      userId,
      !isCurrentlyFollowing,
      userEmail
    );
    mirrorCount = mirrorResult?.count;
  } catch {
    // non-fatal
  }

  const current = readLocalFollowingIds(userId);
  const next = isCurrentlyFollowing
    ? current.filter((entry) => entry !== id)
    : [...new Set([...current, id])];

  writeLocalFollowingIds(userId, next);

  return {
    following: !isCurrentlyFollowing,
    followersCount: mirrorCount,
  };
};

export const fetchMyFollowingBrands = async (userId) => {
  let followingIds = userId ? readLocalFollowingIds(userId) : [];

  try {
    const res = await brandsAPI.getMyFollowing();
    const apiBrands = getResponseArray(res);
    if (apiBrands.length > 0) {
      followingIds = [
        ...new Set([
          ...followingIds,
          ...apiBrands.map((brand) => String(brand._id || brand.id)).filter(Boolean),
        ]),
      ];
      if (userId) writeLocalFollowingIds(userId, followingIds);
      return apiBrands;
    }
  } catch {
    // fall through to local enrichment
  }

  if (followingIds.length === 0) return [];

  try {
    const res = await brandsAPI.getAll({ limit: 100 });
    const allBrands = getResponseArray(res);
    const matched = allBrands.filter((brand) =>
      followingIds.includes(String(brand._id || brand.id))
    );
    if (matched.length > 0) return matched;
  } catch {
    // fall through
  }

  return followingIds.map((id) => ({ _id: id, id, name: id }));
};

const fetchSimilarProducts = async (productId) => {
  try {
    const res = await api.get(`/product/similar/${productId}`);
    if (getResponseArray(res).length > 0) return res;
  } catch (err) {
    if (err.response?.status && err.response.status !== 401 && err.response.status !== 404) {
      throw err;
    }
  }
  return api.get(`/recommendation/similar/${productId}`);
};

export const recommendationAPI = {
  getAll: () => api.get('/recommendation'),
  getSimilar: (productId) => api.get(`/recommendation/similar/${productId}`),
  getTrending: () => api.get('/recommendation/trending'),
};

export const aiAPI = {
  getRecommendations: (data) =>
    api.post('/product/recommendations', data),
  getSimilar: (productId) => fetchSimilarProducts(productId),
  trackEvent: (data = {}) => {
    if (!hasAuthToken() || !isCustomerApiRole()) {
      return Promise.resolve({ data: { skipped: true } });
    }

    const productId = data.productId || data.product_id;
    const userId = data.userId || data.user_id;
    if (!userId || !isValidMongoId(productId)) {
      return Promise.resolve({ data: { skipped: true } });
    }

    const event = String(data.event || data.eventType || 'view').toLowerCase();

    return api
      .post('/product/behavioral/track', {
        userId,
        productId,
        event,
      })
      .catch(() => ({ data: { skipped: true } }));
  },
  getBehavioralRecommendations: (data) =>
    api.post('/product/behavioral/recommend', data),
  getTrending: async () => {
    const filterOptions = { useFallback: false };

    if (hasAuthToken()) {
      try {
        const res = await api.get('/product/ai-trending');
        if (getResponseArray(res).length > 0) {
          return filterProductListResponse(res, filterOptions);
        }
      } catch {
        // fall through
      }
    }
    try {
      const res = await api.get('/recommendation/trending');
      if (getResponseArray(res).length > 0) {
        return filterProductListResponse(res, filterOptions);
      }
    } catch {
      // fall through
    }
    return filterProductListResponse(
      await api.get('/product/trending'),
      filterOptions
    );
  },
  getCatalogTrending: () => api.get('/product/trending'),
  getCrossSell: (data) =>
    api.post('/product/cart/cross-sell', data),
};

export const parseInvoiceResponse = async (response) => {
  const contentType = String(response?.headers?.['content-type'] || '');

  if (response?.data instanceof Blob) {
    if (contentType.includes('pdf') || response.data.type?.includes('pdf')) {
      const blobUrl = URL.createObjectURL(response.data);
      return { type: 'pdf', blobUrl };
    }
    try {
      const text = await response.data.text();
      const parsed = JSON.parse(text);
      return parseInvoicePayload(parsed?.data || parsed);
    } catch {
      return { type: 'error', message: 'Invalid invoice response' };
    }
  }

  return parseInvoicePayload(response?.data?.data || response?.data);
};

const parseInvoicePayload = (body) => {
  if (!body) {
    return { type: 'error', message: 'Invoice unavailable' };
  }

  const url = body.url || body.invoiceUrl || body.pdfUrl;
  if (url && typeof url === 'string') {
    return { type: 'url', url };
  }

  if (body.message) {
    return {
      type: 'email',
      message: body.message,
      orderNumber: body.orderNumber || body.orderNo || null,
    };
  }

  return { type: 'error', message: 'Invoice unavailable' };
};

export const openInvoiceFromResponse = async (response) => {
  const result = await parseInvoiceResponse(response);

  if (result.type === 'url') {
    window.open(result.url, '_blank', 'noopener,noreferrer');
    return result;
  }

  if (result.type === 'pdf') {
    window.open(result.blobUrl, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(result.blobUrl), 60000);
    return result;
  }

  return result;
};

export const supportAPI = {
  sendMessage: (data) => api.post('/support', data),
  getAllMessages: () => api.get('/support'),
  getMyMessages: () => api.get('/support/my-messages'),
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
  brandId,
  brandName,
  messageType,
}) => {
  if (!localSupport || !email || !message) return null;

  try {
    const res = await localSupport.post('/', {
      userId,
      email,
      fullName,
      message,
      railwayTicketId,
      brandId,
      brandName,
      messageType,
    });
    return res.data?.data || res.data;
  } catch {
    return null;
  }
};

const stripBrandTagFromMessage = (text) =>
  String(text || '')
    .replace(/^\[[^\]]+\]\s*/, '')
    .trim();

const normalizeSellerInboxMessage = (entry, brandName) => ({
  ...entry,
  _id: entry._id || entry.id,
  message: stripBrandTagFromMessage(entry.message),
  fullName: entry.fullName || entry.user?.name || 'Customer',
  email: entry.email || entry.user?.email || '',
  status: entry.status || 'pending',
  reply: entry.reply || '',
  brandName: entry.brandName || brandName || '',
});

export const saveBrandInquiryMessage = async ({
  brandId,
  brandName,
  userId,
  email,
  fullName,
  message,
  railwayTicketId,
}) => {
  if (!message?.trim()) return null;

  if (railwayTicketId) {
    return { _id: railwayTicketId, message: message.trim(), brandId, brandName };
  }

  const taggedMessage = brandName
    ? `[${brandName}] ${message.trim()}`
    : message.trim();

  const apiMessage =
    taggedMessage.length >= 20
      ? taggedMessage
      : taggedMessage + '\u200b'.repeat(20 - taggedMessage.length);

  try {
    const res = await supportAPI.sendMessage({
      fullName: fullName || 'Guest',
      email: email || 'guest@brandhive.com',
      message: apiMessage,
    });
    const ticketId = extractSupportTicketId(res) || railwayTicketId;
    if (userId && ticketId) rememberSupportTicketId(userId, ticketId);
    return res.data?.data || res.data || { _id: ticketId, message: message.trim() };
  } catch (err) {
    console.warn('[saveBrandInquiryMessage]', err.response?.data || err.message);
    return null;
  }
};

export const replyToSellerCustomer = async (messageId, reply) => {
  const trimmed = String(reply || '').trim();
  if (!messageId || !trimmed) return null;

  try {
    const res = await sellerAPI.replyToCustomer(messageId, trimmed);
    return res.data?.data || res.data;
  } catch (err) {
    console.warn('[replyToSellerCustomer]', err.response?.data || err.message);
    throw err;
  }
};

export const fetchSellerBrandMessages = async (brandId, brandName = '') => {
  const merged = new Map();

  try {
    const res = await sellerAPI.getMessages();
    getResponseArray(res).forEach((entry) => {
      const id = entry._id || entry.id;
      if (id) merged.set(String(id), normalizeSellerInboxMessage(entry, brandName));
    });
  } catch (err) {
    console.warn('[fetchSellerBrandMessages/seller]', err.response?.status);
  }

  if (merged.size === 0 && brandId) {
    try {
      const res = await sellerAPI.getBrandMessages(brandId);
      getResponseArray(res).forEach((entry) => {
        const id = entry._id || entry.id;
        if (id) merged.set(String(id), normalizeSellerInboxMessage(entry, brandName));
      });
    } catch (err) {
      console.warn('[fetchSellerBrandMessages/brand]', err.response?.status);
    }
  }

  let messages = [...merged.values()];

  if (brandName && messages.length > 0) {
    const tag = `[${brandName}]`;
    const tagged = messages.filter((entry) =>
      String(entry.message || '').includes(tag) ||
      String(entry.brandName || '').toLowerCase() === brandName.toLowerCase() ||
      String(entry.brandId || '') === String(brandId || '')
    );
    if (tagged.length > 0) messages = tagged;
  }

  if (messages.length > 0) {
    return messages.sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
    );
  }

  if (localSupport && brandId) {
    try {
      const res = await localSupport.get('/', {
        params: { brandId: String(brandId) },
      });
      getResponseArray(res).forEach((entry) => {
        const id = entry._id || entry.id || entry.railwayTicketId;
        if (id) merged.set(String(id), normalizeSellerInboxMessage(entry, brandName));
      });
      return [...merged.values()].sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
      );
    } catch {
      // mirror offline
    }
  }

  return [];
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

  try {
    const res = await supportAPI.getMyMessages();
    getResponseArray(res).forEach((ticket) => {
      byId.set(ticket._id || ticket.id, ticket);
    });
  } catch {
    // fall through to legacy paths
  }

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
    .replace(/^\[[^\]]+\]\s*/, '')
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
