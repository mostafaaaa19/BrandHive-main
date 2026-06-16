import { useState, useMemo, useEffect } from 'react';
import { Search, Grid3X3, List, X } from 'lucide-react';
import BrandCard from '../components/BrandCard';
import { useLanguage } from '../context/LanguageContext';
import { brandsAPI, productsAPI, getResponseArray } from '../services/api';
import { mapBrand } from '../utils/mappers';

const normalizeToken = (value) => String(value || '').trim().toLowerCase();

const categoryLabel = (category) => {
  if (!category) return '';
  if (typeof category === 'string') return category;
  return category.name || category.slug || '';
};

const NEW_SELLER_DAYS = 90;

export default function ExploreBrands() {
  const { isRTL } = useLanguage();

  const sortOptions = [
    { value: 'Top Rated', label: isRTL ? 'الأعلى تقييماً' : 'Top Rated' },
    { value: 'Most Sales', label: isRTL ? 'الأكثر مبيعاً' : 'Most Sales' },
    { value: 'Most Products', label: isRTL ? 'الأكثر منتجات' : 'Most Products' },
    { value: 'Newest', label: isRTL ? 'الأحدث' : 'Newest' },
    { value: 'Alphabetical', label: isRTL ? 'أبجدياً' : 'Alphabetical' },
  ];

  const filterTabs = [
    { value: 'All', label: isRTL ? 'الكل' : 'All' },
    { value: 'Verified Only', label: isRTL ? '✓ موثق فقط' : '✓ Verified Only' },
    { value: 'Featured', label: isRTL ? '🌟 مميز' : '🌟 Featured' },
    { value: 'New Sellers', label: isRTL ? '🆕 بائعون جدد' : '🆕 New Sellers' },
    { value: 'Top Rated', label: isRTL ? '🏆 الأعلى تقييماً' : '🏆 Top Rated' },
  ];

  const [search, setSearch] = useState('');
  const [view, setView] = useState('grid');
  const [sort, setSort] = useState('Alphabetical');
  const [selectedGov, setSelectedGov] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  const [brands, setBrands] = useState([]);
  const [brandMeta, setBrandMeta] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const [brandsRes, productsRes] = await Promise.all([
          brandsAPI.getAll({ page: 1, limit: 100 }),
          productsAPI.getAll({ page: 1, limit: 100 }),
        ]);
        const raw = getResponseArray(brandsRes);
        setBrands(Array.isArray(raw) ? raw.map(mapBrand) : []);

        const products = getResponseArray(productsRes);
        const meta = {};

        products.forEach((product) => {
          const isActive =
            product.isActive !== false &&
            product.status !== 'inactive' &&
            product.status !== 'draft';
          if (!isActive) return;

          const brandId = String(
            product.brand?._id ||
              product.brand?.id ||
              product.brandId?._id ||
              product.brandId ||
              ''
          );
          if (!brandId) return;

          if (!meta[brandId]) {
            meta[brandId] = {
              productCount: 0,
              categories: new Set(),
              latestCreatedAt: null,
              maxRating: 0,
            };
          }

          const entry = meta[brandId];
          entry.productCount += 1;

          const cat = categoryLabel(product.category);
          if (cat) entry.categories.add(cat);

          const createdAt = product.createdAt || product.brand?.createdAt;
          if (createdAt) {
            const ts = new Date(createdAt).getTime();
            if (!entry.latestCreatedAt || ts > entry.latestCreatedAt) {
              entry.latestCreatedAt = ts;
            }
          }

          const rating = Number(
            product.stats?.averageRating ||
              product.brand?.stats?.averageRating ||
              product.brand?.rating ||
              0
          );
          if (rating > entry.maxRating) entry.maxRating = rating;
        });

        const serialized = {};
        Object.entries(meta).forEach(([id, value]) => {
          serialized[id] = {
            productCount: value.productCount,
            categories: Array.from(value.categories),
            latestCreatedAt: value.latestCreatedAt,
            maxRating: value.maxRating,
          };
        });
        setBrandMeta(serialized);
      } catch {
        setBrands([]);
        setBrandMeta({});
      } finally {
        setLoading(false);
      }
    };
    fetchBrands();
  }, []);

  const activeBrands = useMemo(
    () =>
      brands
        .map((brand) => {
          const id = String(brand.id);
          const meta = brandMeta[id] || {};
          const productCount = Math.max(
            meta.productCount || 0,
            brand.productCount || 0,
            brand.productsCount || 0
          );
          const categories = meta.categories?.length
            ? meta.categories
            : brand.category
              ? [brand.category]
              : [];
          const primaryCategory = categories[0] || brand.category || '';
          const rating = Math.max(brand.rating || 0, meta.maxRating || 0);
          const createdAt =
            brand.createdAt ||
            (meta.latestCreatedAt
              ? new Date(meta.latestCreatedAt).toISOString()
              : null);

          return {
            ...brand,
            productCount,
            category: primaryCategory,
            categories,
            rating,
            createdAt,
          };
        })
        .filter((brand) => brand.productCount > 0),
    [brands, brandMeta]
  );

  const realCategories = useMemo(() => {
    const cats = new Set();
    activeBrands.forEach((brand) => {
      (brand.categories || []).forEach((cat) => {
        if (cat) cats.add(cat);
      });
      if (brand.category) cats.add(brand.category);
    });
    return Array.from(cats).sort((a, b) => a.localeCompare(b, isRTL ? 'ar' : 'en'));
  }, [activeBrands, isRTL]);

  const realGovernorates = useMemo(() => {
    const govs = new Set();
    activeBrands.forEach((brand) => {
      if (brand.governorate) govs.add(brand.governorate);
      if (brand.location && brand.location !== 'Egypt') govs.add(brand.location);
    });
    return Array.from(govs).sort((a, b) => a.localeCompare(b, isRTL ? 'ar' : 'en'));
  }, [activeBrands, isRTL]);

  const effectiveSort = useMemo(() => {
    if (activeFilter === 'Top Rated') return 'Top Rated';
    if (activeFilter === 'New Sellers') return 'Newest';
    return sort;
  }, [activeFilter, sort]);

  const filtered = useMemo(() => {
    let result = [...activeBrands];

    if (search) {
      const q = normalizeToken(search);
      result = result.filter((brand) =>
        [brand.name, brand.description, brand.location, brand.category, ...(brand.categories || [])]
          .some((field) => normalizeToken(field).includes(q))
      );
    }

    if (selectedCat) {
      const cat = normalizeToken(selectedCat);
      result = result.filter((brand) =>
        (brand.categories || []).some((value) => normalizeToken(value) === cat) ||
        normalizeToken(brand.category) === cat
      );
    }

    if (selectedGov) {
      const gov = normalizeToken(selectedGov);
      result = result.filter(
        (brand) =>
          normalizeToken(brand.governorate).includes(gov) ||
          normalizeToken(brand.location).includes(gov)
      );
    }

    switch (activeFilter) {
      case 'Verified Only':
        result = result.filter((brand) => brand.verified === true);
        break;
      case 'Featured':
        result = result.filter((brand) => brand.featured === true);
        break;
      case 'New Sellers': {
        const cutoff = Date.now() - NEW_SELLER_DAYS * 24 * 60 * 60 * 1000;
        result = result.filter((brand) => {
          if (!brand.createdAt) return false;
          return new Date(brand.createdAt).getTime() >= cutoff;
        });
        break;
      }
      case 'Top Rated':
        result = result.filter((brand) => Number(brand.rating) > 0);
        break;
      default:
        break;
    }

    switch (effectiveSort) {
      case 'Top Rated':
        result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'Most Products':
        result.sort((a, b) => (b.productCount || 0) - (a.productCount || 0));
        break;
      case 'Most Sales':
        result.sort((a, b) => (b.followers || 0) - (a.followers || 0));
        break;
      case 'Newest':
        result.sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime()
        );
        break;
      case 'Alphabetical':
      default:
        result.sort((a, b) =>
          (a.name || '').localeCompare(b.name || '', isRTL ? 'ar' : 'en')
        );
        break;
    }

    return result;
  }, [
    activeBrands,
    search,
    selectedGov,
    selectedCat,
    activeFilter,
    effectiveSort,
    isRTL,
  ]);

  const clearFilters = () => {
    setSearch('');
    setSelectedGov('');
    setSelectedCat('');
    setActiveFilter('All');
    setSort('Alphabetical');
  };

  const hasFilters =
    Boolean(search) ||
    Boolean(selectedGov) ||
    Boolean(selectedCat) ||
    activeFilter !== 'All' ||
    sort !== 'Alphabetical';

  const handleFilterTab = (value) => {
    setActiveFilter(value);
    if (value === 'Top Rated') setSort('Top Rated');
    if (value === 'New Sellers') setSort('Newest');
    if (value === 'All') setSort('Alphabetical');
  };

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen bg-brand-cream dark:bg-dark-bg transition-colors duration-200"
    >
      <div className="bg-brand-navy text-white py-12">
        <div className="page-container">
          <h1 className="text-4xl md:text-5xl font-display font-bold mb-3">
            {isRTL ? 'استكشف الماركات المصرية' : 'Explore Egyptian Brands'}
          </h1>
          <p className="text-gray-300 text-lg">
            {isRTL
              ? 'اكتشف بائعين محليين موثقين من جميع أنحاء مصر'
              : 'Discover verified local sellers from across Egypt'}
          </p>
        </div>
      </div>

      <div className="page-container py-8">
        <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-dark-muted"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  isRTL
                    ? 'ابحث عن الماركات بالاسم، الفئة، الموقع...'
                    : 'Search brands by name, category, location...'
                }
                className="input-field ps-9 pe-4 text-start"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-dark-text"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {realGovernorates.length > 0 && (
              <select
                value={selectedGov}
                onChange={(e) => setSelectedGov(e.target.value)}
                className="input-field sm:w-48 text-start"
              >
                <option value="">{isRTL ? 'كل المحافظات' : 'All Governorates'}</option>
                {realGovernorates.map((gov) => (
                  <option key={gov} value={gov}>
                    {gov}
                  </option>
                ))}
              </select>
            )}

            {realCategories.length > 0 && (
              <select
                value={selectedCat}
                onChange={(e) => setSelectedCat(e.target.value)}
                className="input-field sm:w-44 text-start"
              >
                <option value="">{isRTL ? 'جميع الفئات' : 'All Categories'}</option>
                {realCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            )}

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="input-field sm:w-40 text-start"
              disabled={activeFilter === 'Top Rated' || activeFilter === 'New Sellers'}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1 bg-gray-100 dark:bg-dark-bg rounded-xl p-1 flex-shrink-0">
              <button
                onClick={() => setView('grid')}
                className={`p-2 rounded-lg transition-all ${
                  view === 'grid'
                    ? 'bg-white dark:bg-dark-surface shadow-sm text-brand-navy dark:text-brand-gold'
                    : 'text-gray-400 dark:text-dark-muted'
                }`}
              >
                <Grid3X3 size={16} />
              </button>
              <button
                onClick={() => setView('list')}
                className={`p-2 rounded-lg transition-all ${
                  view === 'list'
                    ? 'bg-white dark:bg-dark-surface shadow-sm text-brand-navy dark:text-brand-gold'
                    : 'text-gray-400 dark:text-dark-muted'
                }`}
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleFilterTab(tab.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 shadow-sm ${
                activeFilter === tab.value
                  ? 'bg-brand-navy dark:bg-brand-gold text-white dark:text-brand-navy'
                  : 'bg-white dark:bg-dark-surface text-gray-600 dark:text-dark-text hover:bg-gray-50 dark:hover:bg-dark-bg'
              }`}
            >
              {tab.label}
            </button>
          ))}

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-xl hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors whitespace-nowrap ms-auto flex-shrink-0"
            >
              <X size={13} /> {isRTL ? 'مسح الفلاتر' : 'Clear Filters'}
            </button>
          )}
        </div>

        <div className="flex items-center justify-between mb-6">
          <p className="text-gray-600 dark:text-dark-muted text-sm">
            {isRTL ? (
              <>
                عرض{' '}
                <span className="font-semibold text-brand-gold">{filtered.length}</span>{' '}
                ماركة من أصل{' '}
                <span className="font-semibold">{activeBrands.length}</span>
              </>
            ) : (
              <>
                Showing{' '}
                <span className="font-semibold text-brand-navy dark:text-brand-gold">
                  {filtered.length}
                </span>{' '}
                of <span className="font-semibold">{activeBrands.length}</span> brands
              </>
            )}
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="bg-gray-100 dark:bg-dark-surface rounded-2xl h-64 animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-dark-text mb-2">
              {isRTL ? 'لم يتم العثور على ماركات' : 'No brands found'}
            </h3>
            <p className="text-gray-500 dark:text-dark-muted mb-4">
              {isRTL ? 'جرب تعديل البحث أو الفلاتر' : 'Try adjusting your search or filters'}
            </p>
            <button onClick={clearFilters} className="btn-primary">
              {isRTL ? 'مسح جميع الفلاتر' : 'Clear All Filters'}
            </button>
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((brand) => (
              <BrandCard key={brand.id} brand={brand} view="grid" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filtered.map((brand) => (
              <BrandCard key={brand.id} brand={brand} view="list" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
