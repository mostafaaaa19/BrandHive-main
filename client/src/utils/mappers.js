export const mapProduct = (p) => ({
  id: p.id || p._id,
  name: p.name || '',
  slug: p.slug || p._id || '',
  description: p.description || '',
  price: p.finalPrice || p.price || 0,
  originalPrice: p.isOnSale ? p.price : null,
  discount: p.discountPercentage || 0,
  image:
    (typeof p.mainImage === 'string' ? p.mainImage : p.mainImage?.url) ||
    (typeof p.images?.[0] === 'string' ? p.images[0] : p.images?.[0]?.url) ||
    null,
  images: (p.images || []).map((img) =>
    typeof img === 'string' ? img : img?.url
  ).filter(Boolean),
  sizes: p.sizes || p.variants?.sizes || [],
  colors: p.colors || p.variants?.colors || [],
  category: p.category?.name || p.category || '',
  categorySlug: p.category?.slug || '',
  brandName: p.brand?.name || '',
  brandId: p.brand?._id || p.brand?.id || p.brandId || '',
  brandSlug: p.brand?.slug || '',
  brandLogo: p.brand?.logo?.url || null,
  rating: p.stats?.averageRating || 0,
  reviews: p.stats?.totalReviews || 0,
  stock: p.stock || 0,
  inStock: p.stock || 0,
  sold: p.stats?.totalSales || p.sold || p.salesCount || 0,
  isOutOfStock: p.isOutOfStock || false,
  isOnSale: p.isOnSale || false,
  isNew: false,
  isFeatured: false,
  tags: p.tags || [],
  verified: true,
  freeShipping: (p.finalPrice || p.price || 0) > 500,
  governorate: p.brand?.governorate || '',
  customizable: false,
  createdAt: p.createdAt || null,
});

export const hydrateProductImages = (products, catalog = []) => {
  if (!Array.isArray(products) || products.length === 0) return products;

  const byId = new Map();
  (Array.isArray(catalog) ? catalog : []).forEach((entry) => {
    const id = String(entry?.id || entry?._id || '');
    if (id) byId.set(id, entry);
  });

  return products.map((product) => {
    const id = String(product?.id || product?._id || '');
    const source = byId.get(id);
    if (!source) return product;

    return {
      ...product,
      image: product.image || source.image || null,
      images:
        product.images?.length > 0 ? product.images : source.images || [],
      brandName: product.brandName || source.brandName || '',
      brandLogo: product.brandLogo || source.brandLogo || null,
    };
  });
};

export const deduplicateProducts = (products) => {
  const seen = new Set();
  return products.filter(p => {
    const key = p.id || p._id || p.slug || p.name;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const mapBrand = (b) => ({
  id: b.id || b._id,
  name: b.name || '',
  slug: b.slug || b._id || '',
  description: b.description || '',
  longDescription: b.longDescription || b.description || '',
  arDescription: b.arDescription || '',
  logo: b.logo?.url || b.logo || null,
  coverImage: b.coverImage?.url || b.coverImage || null,
  category: b.categories?.[0]?.name ||
            b.category?.name ||
            b.category || 'General',
  country: b.governorate || b.location || b.country || 'Egypt',
  verified: b.isVerified ?? b.verified ?? true,
  featured: b.isFeatured || false,
  productCount: b.stats?.totalProducts ||
                b.productsCount ||
                b.productCount || 0,
  rating: b.stats?.averageRating ||
          b.averageRating ||
          b.rating || 0,
  sales: b.stats?.totalSales || b.salesCount || b.sales || 0,
  followers: b.stats?.followers ||
             b.followersCount ||
             b.followers || 0,
  memberSince: b.createdAt
    ? new Date(b.createdAt).getFullYear().toString()
    : '2024',
  createdAt: b.createdAt || null,
  location: b.governorate || b.location || b.country || 'Egypt',
  governorate: b.governorate || '',
  shipping: b.shippingTime || b.shipping || '3–5 business days',
  returns: b.returnPolicy || b.returns || '14-day returns',
  tags: b.tags || [],
});

const CATEGORY_META = {
  fashion:      { icon: '👗', color: 'from-pink-400 to-rose-500' },
  jewelry:      { icon: '💍', color: 'from-amber-400 to-yellow-500' },
  'home-decor': { icon: '🏠', color: 'from-teal-400 to-cyan-500' },
  home:         { icon: '🏠', color: 'from-teal-400 to-cyan-500' },
  handmade:     { icon: '🏺', color: 'from-orange-400 to-amber-500' },
  organic:      { icon: '🌿', color: 'from-green-400 to-emerald-500' },
  art:          { icon: '🎨', color: 'from-purple-400 to-violet-500' },
  'art-culture':{ icon: '🎨', color: 'from-purple-400 to-violet-500' },
  books:        { icon: '📚', color: 'from-blue-400 to-indigo-500' },
  food:         { icon: '🍯', color: 'from-yellow-400 to-orange-500' },
  beauty:       { icon: '💄', color: 'from-fuchsia-400 to-pink-500' },
  bazaars:      { icon: '🛍️', color: 'from-red-400 to-rose-500' },
  accessories:  { icon: '👜', color: 'from-violet-400 to-purple-500' },
  default:      { icon: '🛍️', color: 'from-gray-400 to-gray-500' },
};

const formatCategoryCount = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${n.toLocaleString()}+`;
};

export const mapCategory = (c) => {
  const slug = c.slug || c.name?.toLowerCase().replace(/\s+/g, '-') || '';
  const meta = CATEGORY_META[slug] || CATEGORY_META.default;
  const rawCount = c.productsCount ?? c.productCount ?? c.count;
  return {
    id: c._id || c.id,
    name: c.name || '',
    arName: c.arName || '',
    slug,
    icon: meta.icon,
    color: meta.color,
    count: formatCategoryCount(rawCount),
    logo: c.logo?.url || null,
  };
};

export const enrichCategoriesWithProductCounts = (categories, products) => {
  const counts = new Map();

  products.forEach((product) => {
    const slug = (product.categorySlug || product.category || '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/_/g, '-');
    if (!slug) return;
    counts.set(slug, (counts.get(slug) || 0) + 1);
  });

  return categories.map((category) => {
    const slug = (category.slug || category.name || '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-');
    const direct = counts.get(slug);
    if (direct) {
      return { ...category, count: formatCategoryCount(direct) };
    }

    let aliasTotal = 0;
    counts.forEach((value, key) => {
      if (key.includes(slug) || slug.includes(key)) {
        aliasTotal += value;
      }
    });

    return {
      ...category,
      count: aliasTotal > 0 ? formatCategoryCount(aliasTotal) : category.count,
    };
  });
};
