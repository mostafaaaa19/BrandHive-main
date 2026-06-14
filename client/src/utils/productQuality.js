const TEST_NAME_PATTERNS = [
  /^test\b/i,
  /testt/i,
  /^mmmm+$/i,
  /^xxx+$/i,
  /^demo$/i,
  /^sample$/i,
  /^asdf/i,
  /^foo+$/i,
  /^bar+$/i,
];

export const isTestProductName = (name) => {
  const value = String(name || '').trim();
  if (!value || value.length < 2) return true;
  return TEST_NAME_PATTERNS.some((pattern) => pattern.test(value));
};

export const hasProductImage = (product) => {
  if (!product) return false;
  if (product.image) return true;

  const mainImage = product.mainImage;
  if (typeof mainImage === 'string' && mainImage.trim()) return true;
  if (mainImage?.url) return true;

  const images = product.images;
  if (!Array.isArray(images) || images.length === 0) return false;

  const first = images[0];
  return Boolean(typeof first === 'string' ? first.trim() : first?.url);
};

export const isHomepageQualityProduct = (product) =>
  Boolean(product?.name) &&
  hasProductImage(product) &&
  !isTestProductName(product.name);

export const filterHomepageQualityProducts = (products, options = {}) => {
  const { minCount = 0, fallbackPool = [], limit = null } = options;
  const list = Array.isArray(products) ? products : [];
  const filtered = list.filter(isHomepageQualityProduct);
  const seen = new Set(
    filtered.map((product) => String(product.id || product._id || product.slug || product.name))
  );

  if (minCount > 0 && filtered.length < minCount && Array.isArray(fallbackPool)) {
    for (const product of fallbackPool) {
      if (filtered.length >= minCount) break;
      if (!isHomepageQualityProduct(product)) continue;
      const key = String(product.id || product._id || product.slug || product.name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      filtered.push(product);
    }
  }

  return typeof limit === 'number' ? filtered.slice(0, limit) : filtered;
};

export const excludeProductsById = (products, excludeIds) => {
  const excluded =
    excludeIds instanceof Set
      ? excludeIds
      : new Set(
          (Array.isArray(excludeIds) ? excludeIds : [])
            .map((id) => String(id))
            .filter(Boolean)
        );

  return (Array.isArray(products) ? products : []).filter((product) => {
    const id = String(product.id || product._id || '');
    return id && !excluded.has(id);
  });
};

const mergeUniqueProductsById = (...lists) => {
  const seen = new Set();
  const merged = [];

  lists.forEach((list) => {
    if (!Array.isArray(list)) return;
    list.forEach((product) => {
      const key = String(product?.id || product?._id || '');
      if (!key || seen.has(key)) return;
      seen.add(key);
      merged.push(product);
    });
  });

  return merged;
};

/** Trending = API order first (views/sales on server), then top sellers not shown above. */
export const buildTrendingDisplayList = ({
  trending = [],
  catalog = [],
  excludeIds = [],
  limit = 8,
} = {}) => {
  const excluded = new Set(
    (Array.isArray(excludeIds) ? excludeIds : [])
      .map((id) => String(id))
      .filter(Boolean)
  );

  const apiTrending = excludeProductsById(
    filterHomepageQualityProducts(trending),
    excluded
  );

  if (apiTrending.length >= limit) {
    return apiTrending.slice(0, limit);
  }

  const usedIds = new Set([
    ...excluded,
    ...apiTrending.map((product) => String(product.id || product._id || '')),
  ]);

  const soldFallback = excludeProductsById(
    filterHomepageQualityProducts(
      [...catalog].sort((a, b) => (b.sold || 0) - (a.sold || 0))
    ),
    usedIds
  );

  return mergeUniqueProductsById(apiTrending, soldFallback).slice(0, limit);
};

const FEATURED_SLOTS_KEY = 'brandhive_featured_slots';
const FEATURED_PRODUCTS_KEY = 'brandhive_featured_products';

export const sanitizeFeaturedLocalStorage = (validCatalogIds) => {
  if (typeof localStorage === 'undefined') {
    return { slots: [], products: [], removed: 0 };
  }

  const ids =
    validCatalogIds instanceof Set
      ? validCatalogIds
      : new Set(
          (Array.isArray(validCatalogIds) ? validCatalogIds : [])
            .map((id) => String(id))
            .filter(Boolean)
        );

  try {
    const slots = JSON.parse(localStorage.getItem(FEATURED_SLOTS_KEY) || '[]');
    const products = JSON.parse(localStorage.getItem(FEATURED_PRODUCTS_KEY) || '[]');

    const validSlots = (Array.isArray(slots) ? slots : []).filter((id) =>
      ids.has(String(id))
    );
    const validProducts = (Array.isArray(products) ? products : []).filter((product) => {
      const id = String(product?.id || product?._id || '');
      return (
        ids.has(id) &&
        hasProductImage(product) &&
        !isTestProductName(product.name)
      );
    });

    const removed =
      (Array.isArray(slots) ? slots.length : 0) -
      validSlots.length +
      (Array.isArray(products) ? products.length : 0) -
      validProducts.length;

    localStorage.setItem(FEATURED_SLOTS_KEY, JSON.stringify(validSlots));
    localStorage.setItem(FEATURED_PRODUCTS_KEY, JSON.stringify(validProducts));

    return { slots: validSlots, products: validProducts, removed };
  } catch {
    localStorage.removeItem(FEATURED_SLOTS_KEY);
    localStorage.removeItem(FEATURED_PRODUCTS_KEY);
    return { slots: [], products: [], removed: 0 };
  }
};
