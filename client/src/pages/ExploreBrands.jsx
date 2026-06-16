import { useState, useMemo, useEffect } from 'react';
import { Search, Grid3X3, List, X } from 'lucide-react';
import BrandCard from '../components/BrandCard';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import { brandsAPI, productsAPI, getResponseArray } from '../services/api';
import { mapBrand } from '../utils/mappers';

export default function ExploreBrands() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  const sortOptions = [
    { value: 'Top Rated', label: isRTL ? 'الأعلى تقييماً' : 'Top Rated' },
    { value: 'Most Sales', label: isRTL ? 'الأكثر مبيعاً' : 'Most Sales' },
    { value: 'Most Products', label: isRTL ? 'الأكثر منتجات' : 'Most Products' },
    { value: 'Alphabetical', label: isRTL ? 'أبجدياً' : 'Alphabetical' }
  ];

  const filterTabs = [
    { value: 'All', label: isRTL ? 'الكل' : 'All' },
    { value: 'Verified Only', label: isRTL ? '✓ موثق فقط' : '✓ Verified Only' },
    { value: 'Featured', label: isRTL ? '🌟 مميز' : '🌟 Featured' },
    { value: 'New Sellers', label: isRTL ? '🆕 بائعون جدد' : '🆕 New Sellers' },
    { value: 'Top Rated', label: isRTL ? '🏆 الأعلى تقييماً' : '🏆 Top Rated' }
  ];

  const [search, setSearch] = useState('');
  const [view, setView] = useState('grid');
  const [sort, setSort] = useState('Alphabetical');
  const [selectedGov, setSelectedGov] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  
  const [brands, setBrands] = useState([]);
  const [productCounts, setProductCounts] = useState({});
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
        const counts = {};
        products.forEach((product) => {
          const isActive =
            product.isActive !== false &&
            product.status !== 'inactive' &&
            product.status !== 'draft';
          if (!isActive) return;

          const brandId =
            product.brand?._id ||
            product.brand?.id ||
            product.brandId?._id ||
            product.brandId;
          if (!brandId) return;
          const key = String(brandId);
          counts[key] = (counts[key] || 0) + 1;
        });
        setProductCounts(counts);
      } catch {
        setBrands([]);
        setProductCounts({});
      } finally {
        setLoading(false);
      }
    };
    fetchBrands();
  }, []);

  const activeBrands = useMemo(
    () =>
      brands
        .map((brand) => ({
          ...brand,
          productCount: productCounts[String(brand.id)] ?? brand.productCount ?? 0,
        }))
        .filter((brand) => brand.productCount > 0),
    [brands, productCounts]
  );

  const realCategories = useMemo(() => {
    const cats = new Set();
    activeBrands.forEach(b => {
      if (b.category) cats.add(b.category);
    });
    return Array.from(cats).filter(Boolean);
  }, [activeBrands]);

  const realGovernorates = useMemo(() => {
    const govs = new Set();
    activeBrands.forEach(b => {
      if (b.governorate) govs.add(b.governorate);
      if (b.location && b.location !== 'Egypt') govs.add(b.location);
    });
    return Array.from(govs).filter(Boolean);
  }, [activeBrands]);

  const filtered = useMemo(() => {
    let result = [...activeBrands];

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(b =>
        (b.name || '').toLowerCase().includes(q) ||
        (b.description || '').toLowerCase().includes(q) ||
        (b.location || '').toLowerCase().includes(q) ||
        (b.category || '').toLowerCase().includes(q)
      );
    }

    // Category filter
    if (selectedCat) {
      result = result.filter(b =>
        (b.category || '').toLowerCase()
          .includes(selectedCat.toLowerCase())
      );
    }

    // Governorate filter
    if (selectedGov) {
      result = result.filter(b =>
        (b.governorate || '').toLowerCase()
          .includes(selectedGov.toLowerCase()) ||
        (b.location || '').toLowerCase()
          .includes(selectedGov.toLowerCase())
      );
    }

    // Active filter tabs
    switch (activeFilter) {
      case 'Verified Only':
        result = result.filter((b) => b.verified === true);
        break;
      case 'Featured':
        result = result.filter((b) => b.featured === true);
        break;
      case 'New Sellers':
        // Sort by newest
        result = [...result].sort((a, b) =>
          new Date(b.createdAt || 0) - 
          new Date(a.createdAt || 0)
        );
        break;
      case 'Top Rated':
        // Sort by rating
        result = [...result].sort((a, b) =>
          (b.rating || 0) - (a.rating || 0)
        );
        break;
      default:
        break; // 'All' — no filter
    }

    // Sort dropdown
    switch (sort) {
      case 'Top Rated': 
        result = [...result].sort((a, b) => 
          (b.rating||0) - (a.rating||0)
        ); 
        break;
      case 'Most Products': 
        result = [...result].sort((a, b) => 
          (b.productCount||0) - (a.productCount||0)
        ); 
        break;
      case 'Alphabetical': 
        result = [...result].sort((a, b) => 
          (a.name||'').localeCompare(b.name||'')
        ); 
        break;
      case 'Most Sales':
        result = [...result].sort((a, b) =>
          (b.followers||0) - (a.followers||0)
        );
        break;
    }

    return result;
  }, [activeBrands, search, selectedGov, selectedCat, 
      activeFilter, sort]);

  const clearFilters = () => {
    setSearch('');
    setSelectedGov('');
    setSelectedCat('');
    setActiveFilter('All');
    setSort('Alphabetical');
  };

  const hasFilters = search || selectedGov || selectedCat || activeFilter !== 'All';

  return (
    <div className={`min-h-screen bg-brand-cream dark:bg-dark-bg transition-colors duration-200 text-start`}>
      {/* Header */}
      <div className="bg-brand-navy text-white py-12">
        <div className="page-container">
          <h1 className="text-4xl md:text-5xl font-display font-bold mb-3">
            {isRTL ? 'استكشف الماركات المصرية' : 'Explore Egyptian Brands'}
          </h1>
          <p className="text-gray-300 text-lg">
            {isRTL ? 'اكتشف أكثر من 12,000 بائع محلي موثق من جميع أنحاء مصر' : 'Discover 12,000+ verified local sellers from across Egypt'}
          </p>
        </div>
      </div>

      <div className="page-container py-8">
        {/* Search + Controls */}
        <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-4 mb-6">
          <div className={`flex flex-col sm:flex-row gap-3`}>
            <div className="relative flex-1">
              <Search size={16} className={`absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-dark-muted`} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isRTL ? 'ابحث عن الماركات بالاسم، الفئة، الموقع...' : 'Search brands by name, category, location...'}
                className={`input-field ps-9 pe-4 text-start`}
              />
              {search && (
                <button onClick={() => setSearch('')} className={`absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-dark-text`}>
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Governorate */}
            {realGovernorates.length > 0 && (
              <select
                value={selectedGov}
                onChange={(e) => setSelectedGov(e.target.value)}
                className={`input-field sm:w-48 ${isRTL ? 'text-right' : ''}`}
              >
                <option value="">{isRTL ? 'كل المحافظات' : 'All Governorates'}</option>
                {realGovernorates.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            )}

            {/* Category */}
            <select
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value)}
              className={`input-field sm:w-44 ${isRTL ? 'text-right' : ''}`}
            >
              <option value="">{isRTL ? 'جميع الفئات' : 'All Categories'}</option>
              {realCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* Sort */}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className={`input-field sm:w-40 ${isRTL ? 'text-right' : ''}`}
            >
              {sortOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>

            {/* View toggle */}
            <div className={`flex items-center gap-1 bg-gray-100 dark:bg-dark-bg rounded-xl p-1 flex-shrink-0`}>
              <button
                onClick={() => setView('grid')}
                className={`p-2 rounded-lg transition-all ${view === 'grid' ? 'bg-white dark:bg-dark-surface shadow-sm text-brand-navy dark:text-brand-gold' : 'text-gray-400 dark:text-dark-muted'}`}
              >
                <Grid3X3 size={16} />
              </button>
              <button
                onClick={() => setView('list')}
                className={`p-2 rounded-lg transition-all ${view === 'list' ? 'bg-white dark:bg-dark-surface shadow-sm text-brand-navy dark:text-brand-gold' : 'text-gray-400 dark:text-dark-muted'}`}
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className={`flex items-center gap-2 mb-6 overflow-x-auto pb-2`}>
          {filterTabs.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
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

        {/* Result count */}
        <div className={`flex items-center justify-between mb-6`}>
          <p className="text-gray-600 dark:text-dark-muted text-sm">
            {isRTL ? (
              <>عرض <span className="font-semibold text-brand-gold">{filtered.length}</span> ماركة</>
            ) : (
              <>Showing <span className="font-semibold text-brand-navy dark:text-brand-gold">{filtered.length}</span> brands</>
            )}
          </p>
        </div>

        {/* Brand Grid / List */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-gray-100 dark:bg-dark-surface rounded-2xl h-64 animate-pulse" />
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
