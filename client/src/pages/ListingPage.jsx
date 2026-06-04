import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { SlidersHorizontal, Grid3X3, LayoutGrid, List, X, ChevronDown, ChevronUp, Star, RefreshCw } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import { productsAPI, categoriesAPI, searchAPI } from '../services/api';
import { mapProduct, mapCategory, deduplicateProducts } from '../utils/mappers';
import { categories as mockCategories } from '../data/mockData';

function FilterSection({ title, children, defaultOpen = true, isRTL }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 dark:border-dark-border pb-4 mb-4">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center justify-between w-full text-sm font-semibold text-gray-900 dark:text-dark-text mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}
      >
        {title}
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
      {open && children}
    </div>
  );
}

const CATEGORY_ALIASES = {
  handmade: ['handmade', 'handicrafts', 'hand craft', 'hand-made'],
  handicrafts: ['handmade', 'handicrafts', 'hand craft', 'hand-made'],
  jewelry: ['jewelry', 'accessories'],
  accessories: ['jewelry', 'accessories'],
  fashion: ['fashion', 'accessories'],
  decor: ['decor', 'home-decor', 'home decor'],
  'home-decor': ['decor', 'home-decor', 'home decor'],
  art: ['art', 'art-culture', 'art & culture'],
  'art-culture': ['art', 'art-culture', 'art & culture'],
};

const normalizeCategory = (value = '') =>
  value.toLowerCase().trim().replace(/_/g, '-');

const getCategoryTerms = (category) => {
  const normalized = normalizeCategory(category);
  return CATEGORY_ALIASES[normalized] || [normalized];
};

export default function ListingPage() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [searchParams] = useSearchParams();
  const categoryParam = searchParams.get('category') || '';
  const searchParam = searchParams.get('search') || '';

  const SORT_OPTIONS = [
    { value: '', label: isRTL ? 'الكل' : 'All' },
    { value: 'Price: Low to High', label: isRTL ? 'السعر: من الأقل للأعلى' : 'Price: Low to High' },
    { value: 'Price: High to Low', label: isRTL ? 'السعر: من الأعلى للأقل' : 'Price: High to Low' },
    { value: 'Top Rated', label: isRTL ? 'الأعلى تقييماً' : 'Top Rated' },
    { value: 'Newest', label: isRTL ? 'الأحدث' : 'Newest' },
    { value: 'Most Reviewed', label: isRTL ? 'الأكثر تقييماً' : 'Most Reviewed' }
  ];

  const [sort, setSort] = useState('');
  const [view, setView] = useState('grid4');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Filters state
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [selectedGovs, setSelectedGovs] = useState([]);
  const [minRating, setMinRating] = useState(0);
  const [filters, setFilters] = useState({
    freeShipping: false,
    onSale: false,
  });

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(mockCategories);
  const [facets, setFacets] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalPages, setTotalPages] = useState(1);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await productsAPI.getAll({
        page: 1,
        limit: 100,
      });

      // Handle all possible response shapes
      const raw =
        res.data?.data ||       // { data: [...] }
        res.data?.products ||   // { products: [...] }
        res.data?.items ||      // { items: [...] }
        (Array.isArray(res.data) ? res.data : []);

      console.log('[ListingPage] raw products count:', Array.isArray(raw) ? raw.length : raw);

      if (Array.isArray(raw) && raw.length > 0) {
        const mapped = raw.map(mapProduct);
        setProducts(deduplicateProducts(mapped));
        setError(null);
        // Extract pagination meta if present
        const meta = res.data?.meta || {};
        setTotalPages(meta.pages || meta.totalPages || 1);
      } else {
        // API returned empty — show empty state
        setProducts([]);
      }
    } catch (err) {
      console.error('[ListingPage] fetch error:', err.response?.status, err.response?.data);
      setError('Failed to load products. Please retry.');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [searchParam]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await categoriesAPI.getAll();
        const raw = res.data?.data || res.data?.categories || res.data || [];
        if (Array.isArray(raw) && raw.length > 0) {
          setCategories(raw.map(mapCategory));
        }
      } catch {
        // keep mockCategories fallback
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    const fetchFacets = async () => {
      try {
        const res = await searchAPI.getFacets();
        setFacets(res.data?.data || res.data || null);
      } catch {
        // keep existing filters
      }
    };
    fetchFacets();
  }, []);

  const priceHint = facets?.priceRange || null;

  // Use categoryParam directly for filtering
  // Real products have category.name from API
  const activeCategory = categoryParam || '';
  // categoryLabel for display — capitalize first letter
  const categoryLabel = activeCategory
    ? activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)
    : '';

  const toggleGov = (gov) => {
    setSelectedGovs(prev => prev.includes(gov) ? prev.filter(g => g !== gov) : [...prev, gov]);
  };

  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Search filter
    if (searchParam) {
      const q = searchParam.toLowerCase();
      result = result.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.brandName || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      );
    }

    // Category filter — flexible matching
    if (activeCategory && categoryParam) {
      const terms = getCategoryTerms(categoryParam);
      result = result.filter(p => {
        const categoryName = normalizeCategory(p.category);
        const categorySlug = normalizeCategory(p.categorySlug);

        return terms.some(term => {
          const normalizedTerm = normalizeCategory(term);
          return (
            categoryName.includes(normalizedTerm) ||
            categorySlug.includes(normalizedTerm) ||
            normalizedTerm.includes(categoryName) ||
            normalizedTerm.includes(categorySlug)
          );
        });
      });
    }

    // Price filters
    if (priceMin) 
      result = result.filter(p => 
        (p.price || 0) >= parseInt(priceMin)
      );
    if (priceMax) 
      result = result.filter(p => 
        (p.price || 0) <= parseInt(priceMax)
      );

    // Rating filter
    if (minRating > 0) 
      result = result.filter(p => 
        (p.rating || 0) >= minRating
      );

    // Governorate filter — skip if real products 
    // don't have governorate
    if (selectedGovs.length) {
      result = result.filter(p => 
        !p.governorate || 
        p.governorate.trim() === '' ||
        selectedGovs.includes(p.governorate)
      );
    }

    // Boolean filters — only apply if field exists
    if (filters.freeShipping) 
      result = result.filter(p => p.freeShipping);
    
    if (filters.onSale) 
      result = result.filter(p => 
        p.isOnSale || (p.discount || 0) > 0
      );
    
    // Remove verifiedOnly and customizable filters
    // since real API products don't have these fields
    // if (filters.verifiedOnly) ...  ← REMOVE
    // if (filters.customizable) ...  ← REMOVE

    // Sort
    switch (sort) {
      case '':
        // Keep original API order — do nothing
        break;
      case 'Price: Low to High': 
        result.sort((a, b) => (a.price||0) - (b.price||0)); 
        break;
      case 'Price: High to Low': 
        result.sort((a, b) => (b.price||0) - (a.price||0)); 
        break;
      case 'Top Rated': 
        result.sort((a, b) => (b.rating||0) - (a.rating||0)); 
        break;
      case 'Most Reviewed': 
        result.sort((a, b) => (b.reviews||0) - (a.reviews||0)); 
        break;
      case 'Newest':
        result.sort((a, b) => 
          new Date(b.createdAt||0) - new Date(a.createdAt||0)
        );
        break;
    }

    return result;
  }, [products, searchParam, activeCategory, categoryParam,
      priceMin, priceMax, selectedGovs, minRating, 
      filters, sort]);

  const clearAll = () => {
    setPriceMin('');
    setPriceMax('');
    setSelectedGovs([]);
    setMinRating(0);
    setFilters({ 
      freeShipping: false, 
      onSale: false, 
    });
  };

  const govCounts = {};
  products.forEach(p => { 
    if (p.governorate && p.governorate.trim()) {
      govCounts[p.governorate] = (govCounts[p.governorate] || 0) + 1; 
    }
  });
  const topGovs = Object.entries(govCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const gridClass = view === 'grid4'
    ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'
    : view === 'grid2'
      ? 'grid grid-cols-1 sm:grid-cols-2 gap-6'
      : 'flex flex-col gap-4';

  const SidebarContent = () => (
    <div className={isRTL ? 'text-right' : 'text-left'}>
      <div className={`flex items-center justify-between mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <h2 className="font-bold text-gray-900 dark:text-dark-text">{isRTL ? 'الفلاتر' : 'Filters'}</h2>
        <button onClick={clearAll} className="text-xs text-brand-gold hover:underline">{isRTL ? 'مسح الكل' : 'Clear All'}</button>
      </div>

      <FilterSection title={isRTL ? 'نطاق السعر' : 'Price Range'} isRTL={isRTL}>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <input
            type="number"
            value={priceMin}
            onChange={e => setPriceMin(e.target.value)}
            placeholder={priceHint ? `Min (${priceHint.min} EGP)` : (isRTL ? 'الأقل' : 'Min')}
            className={`input-field py-2 text-sm ${isRTL ? 'text-right' : ''}`}
          />
          <span className="text-gray-400 dark:text-dark-muted text-sm">—</span>
          <input
            type="number"
            value={priceMax}
            onChange={e => setPriceMax(e.target.value)}
            placeholder={priceHint ? `Max (${priceHint.max} EGP)` : (isRTL ? 'الأعلى' : 'Max')}
            className={`input-field py-2 text-sm ${isRTL ? 'text-right' : ''}`}
          />
        </div>
        <div className={`flex gap-2 mt-2 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
          {[['0–200', 0, 200], ['200–500', 200, 500], ['500–1K', 500, 1000], ['1K+', 1000, '']].map(([label, min, max]) => (
            <button
              key={label}
              onClick={() => { setPriceMin(min.toString()); setPriceMax(max.toString()); }}
              className="px-3 py-1 text-xs rounded-lg bg-gray-100 dark:bg-dark-bg text-gray-700 dark:text-dark-text hover:bg-brand-navy dark:hover:bg-brand-gold hover:text-white dark:hover:text-brand-navy transition-colors"
            >
              {label} {t('common.egp')}
            </button>
          ))}
        </div>
      </FilterSection>

      {categories.length > 0 && (
        <FilterSection title={isRTL ? 'الفئة' : 'Category'} isRTL={isRTL}>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {categories.map(cat => (
              <Link
                key={cat.id || cat.slug}
                to={`/products?category=${cat.slug}`}
                className={`flex items-center gap-2 text-sm transition-colors ${isRTL ? 'flex-row-reverse text-right' : ''} ${
                  normalizeCategory(categoryParam) === normalizeCategory(cat.slug)
                    ? 'text-brand-gold font-semibold'
                    : 'text-gray-700 dark:text-dark-text hover:text-brand-gold'
                }`}
              >
                <span>{cat.icon}</span>
                <span className="flex-1">{isRTL && cat.arName ? cat.arName : cat.name}</span>
                {cat.count && <span className="text-xs text-gray-400 dark:text-dark-muted">{cat.count}</span>}
              </Link>
            ))}
          </div>
        </FilterSection>
      )}

      {topGovs.length > 0 && (
        <FilterSection title={isRTL ? 'المحافظة' : 'Governorate'} isRTL={isRTL}>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {topGovs.map(([gov, count]) => (
              <label key={gov} className={`flex items-center gap-2 cursor-pointer group ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                <input
                  type="checkbox"
                  checked={selectedGovs.includes(gov)}
                  onChange={() => toggleGov(gov)}
                  className="rounded border-gray-300 dark:border-dark-border text-brand-navy dark:text-brand-gold focus:ring-brand-navy dark:bg-dark-surface"
                />
                <span className="text-sm text-gray-700 dark:text-dark-text group-hover:text-brand-gold flex-1 transition-colors">{gov}</span>
                <span className="text-xs text-gray-400 dark:text-dark-muted">{count.toLocaleString()}</span>
              </label>
            ))}
          </div>
        </FilterSection>
      )}

      <FilterSection title={isRTL ? 'التقييم' : 'Rating'} isRTL={isRTL}>
        <div className="space-y-2">
          {[5, 4, 3].map(r => (
            <label key={r} className={`flex items-center gap-2 cursor-pointer group ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
              <input
                type="radio"
                name="rating"
                checked={minRating === r}
                onChange={() => setMinRating(r)}
                className="text-brand-navy dark:text-brand-gold focus:ring-brand-navy dark:bg-dark-surface dark:border-dark-border"
              />
              <div className={`flex ${isRTL ? 'flex-row-reverse' : ''}`}>
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={12} className={i < r ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600'} />
                ))}
              </div>
              <span className="text-xs text-gray-500 dark:text-dark-muted">{isRTL ? 'وأكثر' : '& up'}</span>
            </label>
          ))}
          {minRating > 0 && (
            <button onClick={() => setMinRating(0)} className={`text-xs text-red-500 hover:underline ${isRTL ? 'block w-full text-right' : ''}`}>{isRTL ? 'مسح' : 'Clear'}</button>
          )}
        </div>
      </FilterSection>

      <FilterSection title={isRTL ? 'خاص' : 'Special'} isRTL={isRTL}>
        <div className="space-y-2">
          {[
            { key: 'freeShipping', label: isRTL ? '🚚 شحن مجاني' : '🚚 Free Shipping' },
            { key: 'onSale', label: isRTL ? '🏷️ عروض' : '🏷️ On Sale' },
          ].map(({ key, label }) => (
            <label key={key} className={`flex items-center gap-2 cursor-pointer group ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
              <input
                type="checkbox"
                checked={filters[key]}
                onChange={() => setFilters(prev => ({ ...prev, [key]: !prev[key] }))}
                className="rounded border-gray-300 dark:border-dark-border text-brand-navy dark:text-brand-gold focus:ring-brand-navy dark:bg-dark-surface"
              />
              <span className="text-sm text-gray-700 dark:text-dark-text group-hover:text-brand-gold transition-colors">{label}</span>
            </label>
          ))}
        </div>
      </FilterSection>
    </div>
  );

  return (
    <div className={`min-h-screen bg-brand-cream dark:bg-dark-bg transition-colors duration-200 ${isRTL ? 'text-right' : 'text-left'}`}>
      {/* Breadcrumb */}
      <div className="bg-white dark:bg-dark-surface border-b border-gray-100 dark:border-dark-border">
        <div className={`page-container py-3 text-sm text-gray-500 dark:text-dark-muted flex items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Link to="/" className="hover:text-brand-navy dark:hover:text-brand-gold">{isRTL ? 'الرئيسية' : 'Home'}</Link>
          <span className="mx-2">›</span>
          <Link to="/products" className="hover:text-brand-navy dark:hover:text-brand-gold">{isRTL ? 'الفئات' : 'Categories'}</Link>
          {activeCategory && (
            <>
              <span className="mx-2">›</span>
              <span className="text-gray-900 dark:text-dark-text font-medium">{activeCategory}</span>
            </>
          )}
          {searchParam && (
            <>
              <span className="mx-2">›</span>
              <span className="text-gray-900 dark:text-dark-text font-medium">{isRTL ? 'بحث' : 'Search'}: "{searchParam}"</span>
            </>
          )}
        </div>
      </div>

      <div className="page-container py-8">
        <div className={`flex gap-8 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {/* Sidebar - Desktop */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6 sticky top-24">
              <SidebarContent />
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className={`flex flex-wrap items-center justify-between gap-3 mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className={isRTL ? 'text-right' : 'text-left'}>
                <h1 className="text-xl font-display font-bold text-gray-900 dark:text-dark-text">
                  {searchParam ? (isRTL ? `نتائج البحث عن "${searchParam}"` : `Results for "${searchParam}"`) : activeCategory ? activeCategory : (isRTL ? 'جميع المنتجات' : 'All Products')}
                </h1>
                <p className="text-gray-500 dark:text-dark-muted text-sm mt-0.5">
                  {isRTL ? (
                    <>عرض <span className="font-semibold text-brand-gold">{filteredProducts.length.toLocaleString()}</span> نتيجة{activeCategory && ` في ${activeCategory}`}</>
                  ) : (
                    <>Showing {filteredProducts.length.toLocaleString()} results{activeCategory && ` in ${activeCategory}`}</>
                  )}
                </p>
              </div>

              <div className={`flex items-center gap-2 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
                {/* Mobile filter button */}
                <button
                  onClick={() => setShowMobileFilters(true)}
                  className={`lg:hidden flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface text-sm font-medium hover:border-brand-navy dark:hover:border-brand-gold transition-colors text-gray-700 dark:text-dark-text ${isRTL ? 'flex-row-reverse' : ''}`}
                >
                  <SlidersHorizontal size={15} />
                  {isRTL ? 'الفلاتر' : 'Filters'}
                </button>

                {/* Sort */}
                <select
                  value={sort}
                  onChange={e => setSort(e.target.value)}
                  className={`input-field py-2.5 text-sm w-44 ${isRTL ? 'text-right' : ''}`}
                >
                  {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>

                {/* View */}
                <div className={`flex items-center gap-1 bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  {[
                    { key: 'grid4', icon: <LayoutGrid size={15} /> },
                    { key: 'grid2', icon: <Grid3X3 size={15} /> },
                    { key: 'list', icon: <List size={15} /> },
                  ].map(v => (
                    <button
                      key={v.key}
                      onClick={() => setView(v.key)}
                      className={`p-2 rounded-lg transition-all ${view === v.key ? 'bg-brand-navy dark:bg-brand-gold text-white dark:text-brand-navy shadow-sm' : 'text-gray-400 dark:text-dark-muted hover:text-gray-600 dark:hover:text-dark-text'}`}
                    >
                      {v.icon}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Active filters */}
            {(priceMin || priceMax || selectedGovs.length > 0 || minRating > 0 || Object.values(filters).some(Boolean)) && (
              <div className={`flex flex-wrap items-center gap-2 mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="text-xs text-gray-500 dark:text-dark-muted font-medium">{isRTL ? 'نشط:' : 'Active:'}</span>
                {priceMin && <span className={`flex items-center gap-1 px-3 py-1 bg-brand-navy/10 dark:bg-brand-gold/10 text-brand-navy dark:text-brand-gold rounded-full text-xs font-medium ${isRTL ? 'flex-row-reverse' : ''}`}>{isRTL ? 'من' : 'From'} {priceMin} {t('common.egp')} <button onClick={() => setPriceMin('')}><X size={11} /></button></span>}
                {priceMax && <span className={`flex items-center gap-1 px-3 py-1 bg-brand-navy/10 dark:bg-brand-gold/10 text-brand-navy dark:text-brand-gold rounded-full text-xs font-medium ${isRTL ? 'flex-row-reverse' : ''}`}>{isRTL ? 'إلى' : 'Up to'} {priceMax} {t('common.egp')} <button onClick={() => setPriceMax('')}><X size={11} /></button></span>}
                {selectedGovs.map(g => <span key={g} className={`flex items-center gap-1 px-3 py-1 bg-brand-navy/10 dark:bg-brand-gold/10 text-brand-navy dark:text-brand-gold rounded-full text-xs font-medium ${isRTL ? 'flex-row-reverse' : ''}`}>{g} <button onClick={() => toggleGov(g)}><X size={11} /></button></span>)}
                {minRating > 0 && <span className={`flex items-center gap-1 px-3 py-1 bg-brand-navy/10 dark:bg-brand-gold/10 text-brand-navy dark:text-brand-gold rounded-full text-xs font-medium ${isRTL ? 'flex-row-reverse' : ''}`}>{minRating}★ {isRTL ? 'وأكثر' : '& up'} <button onClick={() => setMinRating(0)}><X size={11} /></button></span>}
                <button onClick={clearAll} className="text-xs text-red-500 hover:underline ml-1">{isRTL ? 'مسح الكل' : 'Clear all'}</button>
              </div>
            )}

            {/* Products */}
            {loading ? (
              <div className={gridClass}>
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="bg-gray-100 dark:bg-dark-surface rounded-2xl h-64 animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-20">
                <div className="text-6xl mb-4">⚠️</div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-dark-text mb-2">
                  {isRTL ? 'خطأ في التحميل' : 'Error Loading Products'}
                </h3>
                <p className="text-gray-500 dark:text-dark-muted mb-4">{error}</p>
                <button onClick={fetchProducts} className="btn-primary flex items-center gap-2 mx-auto">
                  <RefreshCw size={16} /> {isRTL ? 'إعادة المحاولة' : 'Retry'}
                </button>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-6xl mb-4">🛍️</div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-dark-text mb-2">
                  {isRTL ? 'لم يتم العثور على منتجات' : 'No products found'}
                </h3>
                <button onClick={fetchProducts} className="btn-primary mt-4">
                  {isRTL ? 'إعادة المحاولة' : 'Retry'}
                </button>
              </div>
            ) : (
              <div className={gridClass}>
                {filteredProducts.map(product => (
                  <ProductCard key={product.id} product={product} size={view === 'list' ? 'md' : 'md'} />
                ))}
              </div>
            )}


          </div>
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      {showMobileFilters && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowMobileFilters(false)} />
          <div className={`relative ${isRTL ? 'mr-auto animate-slide-in-left' : 'ml-auto animate-slide-in-right'} w-80 max-w-full h-full bg-white dark:bg-dark-surface p-6 overflow-y-auto shadow-2xl`}>
            <div className={`flex items-center justify-between mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <h2 className="font-bold text-xl text-gray-900 dark:text-dark-text">{isRTL ? 'الفلاتر' : 'Filters'}</h2>
              <button onClick={() => setShowMobileFilters(false)} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-bg text-gray-600 dark:text-dark-muted">
                <X size={20} />
              </button>
            </div>
            <SidebarContent />
            <button onClick={() => setShowMobileFilters(false)} className="w-full btn-primary mt-6">
              {isRTL ? `عرض ${filteredProducts.length} نتيجة` : `Show ${filteredProducts.length} Results`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
