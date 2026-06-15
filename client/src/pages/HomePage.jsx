import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, Star, Shield, Zap, Heart,
  ChevronRight, Sparkles, MapPin, Award, CheckCircle2
} from 'lucide-react';
import { useInView } from 'react-intersection-observer';
import ProductCard from '../components/ProductCard';
import BrandCard from '../components/BrandCard';
import { testimonials } from '../data/mockData';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import { productsAPI, brandsAPI, categoriesAPI, aiAPI, loadLocalProductImages, enrichProductsWithLocalImages, sanitizeFeaturedLocalStorage, fetchFeaturedSlotIds, fetchPublicStats } from '../services/api';
import { mapProduct, mapBrand, mapCategory, hydrateProductImages } from '../utils/mappers';
import { filterHomepageQualityProducts, buildTrendingDisplayList } from '../utils/productQuality';
import { formatStatNumber } from '../utils/formatStat';

function CountUp({ target, suffix = '', duration = 2000 }) {
  const [count, setCount] = useState(0);
  const { ref, inView } = useInView({ triggerOnce: true });
  const isNumeric = !isNaN(parseInt(target));
  const numTarget = parseInt(target) || 0;

  useEffect(() => {
    if (!inView || !isNumeric) return;
    let start = 0;
    const increment = numTarget / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= numTarget) {
        setCount(numTarget);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [inView, numTarget, duration, isNumeric]);

  return (
    <span ref={ref}>
      {isNumeric ? count.toLocaleString() : target}
      {suffix}
    </span>
  );
}

export default function HomePage() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  
  const tabs = [
    { id: 'Popular', label: t('home.popular') },
    { id: 'New', label: t('home.new') },
    { id: 'Featured', label: t('home.featured') }
  ];
  const [activeTab, setActiveTab] = useState('Popular');
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [topRatedProducts, setTopRatedProducts] = useState([]);
  const [newArrivalProducts, setNewArrivalProducts] = useState([]);
  const [topBrands, setTopBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [globalBrands, setGlobalBrands] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [publicStats, setPublicStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const { ref: featuresRef, inView: featuresInView } = useInView({ triggerOnce: true, threshold: 0.1 });

  const mergeUniqueProducts = (...lists) => {
    const seen = new Set();
    const merged = [];
    lists.forEach((list) => {
      if (!Array.isArray(list)) return;
      list.forEach((product) => {
        const key = String(product?.id || product?.slug || product?.name || '');
        if (!key || seen.has(key)) return;
        seen.add(key);
        merged.push(product);
      });
    });
    return merged;
  };

  useEffect(() => {
    const fetchData = async () => {
      let catalog = [];

      try {
        setProductsLoading(true);
        const res = await productsAPI.getAll({ page: 1, limit: 100 });
        const raw =
          res.data?.data ||
          res.data?.products ||
          res.data?.items ||
          (Array.isArray(res.data) ? res.data : []);

        if (Array.isArray(raw) && raw.length > 0) {
          catalog = raw.map(mapProduct);
        }

        const catalogIds = new Set(
          catalog.map((product) => String(product.id || '')).filter(Boolean)
        );
        sanitizeFeaturedLocalStorage(catalogIds);

        const slotIds = await fetchFeaturedSlotIds();
        if (Array.isArray(slotIds) && slotIds.length > 0) {
          const byId = new Map(
            catalog.map((product) => [String(product.id), product])
          );
          const slotted = slotIds
            .map((id) => byId.get(String(id)))
            .filter(Boolean);
          if (slotted.length > 0) {
            const seen = new Set();
            catalog = [...slotted, ...catalog].filter((product) => {
              const key = product.id || product.slug || product.name;
              if (!key || seen.has(key)) return false;
              seen.add(key);
              return true;
            });
          }
        } else {
          const adminFeatured = localStorage.getItem('brandhive_featured_products');
          if (adminFeatured) {
            try {
              const parsed = JSON.parse(adminFeatured);
              if (Array.isArray(parsed) && parsed.length > 0) {
                const adminMapped = parsed.map(mapProduct);
                const seen = new Set();
                catalog = [...adminMapped, ...catalog].filter((product) => {
                  const key = product.id || product.slug || product.name;
                  if (!key || seen.has(key)) return false;
                  seen.add(key);
                  return true;
                });
              }
            } catch { /* ignore stale cache */ }
          }
        }

        catalog = filterHomepageQualityProducts(catalog);
      } catch {
        catalog = [];
      }

      const pickProducts = (response) => {
        const raw =
          response?.data?.data ||
          response?.data?.products ||
          response?.data?.items ||
          (Array.isArray(response?.data) ? response.data : []);
        return Array.isArray(raw) ? raw.map(mapProduct) : [];
      };

      let trending = [];
      let topRated = [];
      let newArrivals = [];

      try {
        trending = pickProducts(await aiAPI.getTrending()).slice(0, 8);
      } catch {
        trending = [];
      }

      try {
        topRated = pickProducts(await productsAPI.getTopRated()).slice(0, 8);
      } catch {
        topRated = [];
      }

      try {
        newArrivals = pickProducts(await productsAPI.getNewArrivals()).slice(0, 8);
      } catch {
        newArrivals = [];
      }

      catalog = hydrateProductImages(catalog, catalog);
      trending = hydrateProductImages(trending, catalog);
      topRated = hydrateProductImages(topRated, catalog);
      newArrivals = hydrateProductImages(newArrivals, catalog);

      const missingImageIds = [...catalog, ...trending, ...topRated, ...newArrivals]
        .filter((product) => !product.image && product.id)
        .map((product) => product.id);

      if (missingImageIds.length > 0) {
        await loadLocalProductImages([...new Set(missingImageIds)]);
        catalog = enrichProductsWithLocalImages(catalog);
        trending = enrichProductsWithLocalImages(trending);
        topRated = enrichProductsWithLocalImages(topRated);
        newArrivals = enrichProductsWithLocalImages(newArrivals);
      }

      catalog = filterHomepageQualityProducts(catalog);
      trending = filterHomepageQualityProducts(trending);
      topRated = filterHomepageQualityProducts(topRated, {
        minCount: 8,
        fallbackPool: [...catalog].sort((a, b) => (b.rating || 0) - (a.rating || 0)),
        limit: 8,
      });
      newArrivals = filterHomepageQualityProducts(newArrivals, {
        minCount: 8,
        fallbackPool: [...catalog].sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime()
        ),
        limit: 8,
      });

      setFeaturedProducts(catalog);
      setTrendingProducts(trending);
      setTopRatedProducts(topRated);
      setNewArrivalProducts(newArrivals);
      setProductsLoading(false);

      try {
        setBrandsLoading(true);
        const res = await brandsAPI.getAll(1, 50);
        const raw = res.data?.data || res.data?.brands || res.data || [];
        const list = Array.isArray(raw) ? raw : [];
        const brandsData = list.map(mapBrand);
        setTopBrands(brandsData);
        const globalList = brandsData
          .filter(b => b.logo || b.brandLogo)
          .slice(0, 12)
          .map(b => ({
            name: b.name,
            logo: b.logo || b.brandLogo,
            slug: b.slug,
          }));
        setGlobalBrands(globalList);
      } catch {
        setTopBrands([]);
      } finally {
        setBrandsLoading(false);
      }

      try {
        const res = await categoriesAPI.getAll();
        const raw = res.data?.data || res.data?.categories || res.data || [];
        const mapped = Array.isArray(raw) && raw.length > 0
          ? raw.map(mapCategory)
          : [];
        setCategories(mapped);
      } catch {
        setCategories([]);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchPublicStats()
      .then((data) => {
        if (!cancelled) setPublicStats(data);
      })
      .catch(() => {
        if (!cancelled) setPublicStats(null);
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tabProducts = useMemo(() => ({
    Popular: mergeUniqueProducts(
      topRatedProducts,
      [...featuredProducts].sort((a, b) => (b.rating || 0) - (a.rating || 0))
    ).slice(0, 8),
    New: mergeUniqueProducts(
      newArrivalProducts,
      [...featuredProducts].sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
      )
    ).slice(0, 8),
    Featured: mergeUniqueProducts(
      featuredProducts.filter((p) => p.isOnSale),
      featuredProducts
    ).slice(0, 8),
  }), [featuredProducts, topRatedProducts, newArrivalProducts]);

  const filteredProducts = tabProducts[activeTab] || [];

  const displayTrendingProducts = useMemo(
    () =>
      buildTrendingDisplayList({
        trending: trendingProducts,
        catalog: featuredProducts,
        excludeIds: filteredProducts.map((product) => product.id),
        limit: 8,
      }),
    [trendingProducts, featuredProducts, filteredProducts]
  );

  const stats = useMemo(() => {
    const source = publicStats || { brands: 0, products: 0, governorates: 0, buyers: 0 };
    const entries = [
      { key: 'brands', labelKey: 'home.hero.stats.brands', icon: '🏪' },
      { key: 'products', labelKey: 'home.hero.stats.products', icon: '📦' },
      { key: 'governorates', labelKey: 'home.hero.stats.governorates', icon: '📍' },
      { key: 'buyers', labelKey: 'home.hero.stats.buyers', icon: '😊' },
    ];

    return entries.map(({ key, labelKey, icon }) => {
      const formatted = formatStatNumber(source[key]);
      return {
        key,
        icon,
        label: t(labelKey),
        animateTo: formatted.animateTo,
        suffix: formatted.suffix,
      };
    });
  }, [publicStats, t]);

  const movementStats = useMemo(() => {
    const brands = formatStatNumber(publicStats?.brands || 0);
    const buyers = formatStatNumber(publicStats?.buyers || 0);
    return [
      { key: 'brands', emoji: '🔥', label: t('home.hero.stats.brands'), ...brands },
      {
        key: 'commission',
        emoji: '💰',
        label: isRTL ? 'عمولة فقط' : 'Commission Only',
        animateTo: 5,
        suffix: '%',
      },
      { key: 'buyers', emoji: '🚀', label: t('home.hero.stats.buyers'), ...buyers },
    ];
  }, [publicStats, t, isRTL]);

  const heroBrandCountLabel = useMemo(() => {
    if (statsLoading) return '...';
    const count = publicStats?.brands || 0;
    return count.toLocaleString(isRTL ? 'ar-EG' : 'en-US');
  }, [publicStats, statsLoading, isRTL]);

  const features = [
    { icon: Shield, title: t('home.features.verifiedSellers'), desc: t('home.features.verifiedSellersDesc'), color: 'text-emerald-500' },
    { icon: Zap, title: t('home.features.fastDelivery'), desc: t('home.features.fastDeliveryDesc'), color: 'text-amber-500' },
    { icon: Heart, title: t('home.features.supportLocal'), desc: t('home.features.supportLocalDesc'), color: 'text-rose-500' },
    { icon: Award, title: t('home.features.bestQuality'), desc: t('home.features.bestQualityDesc'), color: 'text-purple-500' },
  ];

  const heroShowcase = featuredProducts.length >= 4
    ? featuredProducts.slice(0, 4).map(p => ({
        cat: p.category || 'Product',
        name: p.name,
        from: `${(p.price || 0).toLocaleString()} ${t('common.egp')}`,
        image: typeof p.image === 'string' ? p.image : (p.image?.url || null),
        icon: null,
        slug: p.slug,
      }))
    : [
        { cat: isRTL ? 'يدوي' : 'Handmade', name: isRTL ? 'فخار فرعوني' : 'Pharaonic Pottery', from: isRTL ? '350 ج.م' : '350 EGP', icon: '🏺', image: null, slug: null },
        { cat: isRTL ? 'أزياء' : 'Fashion', name: isRTL ? 'قفطان حرير' : 'Silk Kaftan', from: isRTL ? '780 ج.م' : '780 EGP', icon: '👗', image: null, slug: null },
        { cat: isRTL ? 'مجوهرات' : 'Jewelry', name: isRTL ? 'قلادة عنخ' : 'Gold Ankh Pendant', from: isRTL ? '1,200 ج.م' : '1,200 EGP', icon: '💍', image: null, slug: null },
        { cat: isRTL ? 'عضوي' : 'Organic', name: isRTL ? 'عسل طبيعي' : 'Natural Honey', from: isRTL ? '250 ج.م' : '250 EGP', icon: '🍯', image: null, slug: null },
      ];

  const renderHeroShowcaseCard = (item, index, size) => {
    const heightClass = size === 'tall' ? 'h-[212px]' : 'h-[148px]';
    const cardClass = `relative ${heightClass} w-full bg-white/10 backdrop-blur-sm rounded-3xl overflow-hidden border border-white/15 hover:border-brand-gold/50 hover:shadow-xl hover:shadow-black/20 transition-all duration-300 hover:-translate-y-1 cursor-pointer animate-fade-in block ${isRTL ? 'text-right' : 'text-left'}`;

    const cardContent = (
      <>
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-4xl flex items-center justify-center h-full bg-white/10">
            {item.icon}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/5 pointer-events-none" />
        <div className={`absolute bottom-0 left-0 right-0 p-3.5 ${isRTL ? 'text-right' : 'text-left'}`}>
          <p className="text-brand-gold/90 text-[10px] font-bold uppercase tracking-[0.14em] mb-1">
            {item.cat}
          </p>
          <p className="text-white font-display font-semibold text-[15px] leading-snug line-clamp-2 mb-1">
            {item.name}
          </p>
          <p className="text-white/90 text-xs font-medium">
            {isRTL ? 'من' : 'From'}{' '}
            <span className="text-brand-gold font-bold">{item.from}</span>
          </p>
        </div>
      </>
    );

    if (item.slug) {
      return (
        <Link
          key={item.slug}
          to={`/product/${item.slug}`}
          className={cardClass}
          style={{ animationDelay: `${index * 0.1}s` }}
        >
          {cardContent}
        </Link>
      );
    }

    return (
      <div
        key={`hero-fallback-${index}`}
        className={cardClass}
        style={{ animationDelay: `${index * 0.1}s` }}
      >
        {cardContent}
      </div>
    );
  };

  const heroShowcaseColumns = [
    [
      { item: heroShowcase[0], index: 0, size: 'tall' },
      { item: heroShowcase[2], index: 2, size: 'short' },
    ],
    [
      { item: heroShowcase[1], index: 1, size: 'short' },
      { item: heroShowcase[3], index: 3, size: 'tall' },
    ],
  ];

  return (
    <div className="overflow-x-hidden">
      {/* ===== HERO ===== */}
      <section className="relative bg-brand-navy overflow-hidden min-h-[85vh] flex items-center">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-pattern opacity-30"></div>
        <div className={`absolute top-0 ${isRTL ? 'left-0' : 'right-0'} w-1/2 h-full bg-gradient-to-${isRTL ? 'r' : 'l'} from-white/5 to-transparent`}></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-brand-gold/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>

        <div className="page-container relative z-10 py-16 md:py-20">
          <div className={`grid lg:grid-cols-2 gap-12 items-center ${isRTL ? 'lg:flex-row-reverse' : ''}`}>
            {/* Left - Content */}
            <div className={`animate-slide-up ${isRTL ? 'text-right' : 'text-left'}`}>
              <div className={`inline-flex items-center gap-2 px-4 py-2 bg-brand-gold/20 text-brand-gold rounded-full text-sm font-semibold mb-6 border border-brand-gold/30 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Sparkles size={14} />
                {isRTL ? 'السوق المحلي الأول في مصر' : "Egypt's #1 Local Marketplace"}
              </div>

              <h1 className="text-5xl md:text-6xl lg:text-7xl font-display font-bold text-white leading-[1.05] mb-6">
                {isRTL ? (
                  <>
                    اكتشف أفضل<br />
                    المنتجات <span className="text-gradient-gold">المصرية</span>
                  </>
                ) : (
                  <>
                    Discover<br />
                    <span className="text-gradient-gold">Egypt's</span><br />
                    Finest.
                  </>
                )}
              </h1>

              <p className={`text-gray-300 text-lg leading-relaxed mb-8 max-w-lg ${isRTL ? 'mr-0 ml-auto' : ''}`}>
                {t('home.hero.subtitle', { count: heroBrandCountLabel })}
              </p>

              <div className={`flex flex-wrap gap-3 mb-10 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Link to="/products" className="btn-gold text-base px-8 py-4">
                  {t('home.hero.shopNow')} <ArrowRight size={18} className={isRTL ? 'rotate-180' : ''} />
                </Link>
                <Link to="/sell" className="btn-outline border-white text-white hover:bg-white hover:text-brand-navy text-base px-8 py-4">
                  {t('home.hero.startSelling')}
                </Link>
              </div>

              {/* Stats */}
              <div className={`flex flex-wrap gap-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
                {statsLoading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className={isRTL ? 'text-right' : 'text-left'}>
                      <div className="h-8 w-16 bg-white/10 rounded animate-pulse mb-1" />
                      <div className="h-4 w-20 bg-white/5 rounded animate-pulse" />
                    </div>
                  ))
                ) : (
                  stats.map((stat) => (
                    <div key={stat.key} className={isRTL ? 'text-right' : 'text-left'}>
                      <div className="text-2xl font-display font-bold text-white">
                        <CountUp target={stat.animateTo} suffix={stat.suffix} />
                      </div>
                      <div className="text-gray-400 text-sm">{stat.label}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right - Bento showcase: col1 tall→short, col2 short→tall */}
            <div className="relative hidden lg:flex justify-end">
              <div className={`flex gap-3.5 w-full max-w-[400px] ${isRTL ? 'flex-row-reverse' : ''}`}>
                {productsLoading ? (
                  heroShowcaseColumns.map((column, colIdx) => (
                    <div key={colIdx} className="flex flex-col gap-3.5 flex-1 min-w-0">
                      {column.map((slot) => (
                        <div
                          key={slot.index}
                          className={`bg-white/10 rounded-3xl animate-pulse ${slot.size === 'tall' ? 'h-[212px]' : 'h-[148px]'}`}
                        />
                      ))}
                    </div>
                  ))
                ) : (
                  heroShowcaseColumns.map((column, colIdx) => (
                    <div key={colIdx} className="flex flex-col gap-3.5 flex-1 min-w-0">
                      {column.map((slot) =>
                        renderHeroShowcaseCard(
                          slot.item,
                          slot.index,
                          slot.size
                        )
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURES STRIP ===== */}
      <section className="bg-white dark:bg-dark-surface border-y border-gray-100 dark:border-dark-border">
        <div className="page-container py-6">
          <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {features.map(({ icon: Icon, title, desc, color }) => (
              <div key={title} className={`flex items-start gap-3 p-3 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                <div className={`p-2 rounded-xl bg-gray-50 dark:bg-dark-bg ${color} flex-shrink-0`}>
                  <Icon size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-dark-text">{title}</p>
                  <p className="text-xs text-gray-500 dark:text-dark-muted leading-relaxed mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CATEGORIES ===== */}
      <section className="py-16 bg-brand-cream dark:bg-dark-bg">
        <div className="page-container">
          <div className={`flex items-center justify-between mb-10 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : ''}>
              <p className="text-brand-gold font-semibold text-sm uppercase tracking-wider mb-1">{isRTL ? 'تصفح' : 'Browse'}</p>
              <h2 className="section-heading">{isRTL ? 'تسوق حسب الفئة' : 'Shop by Category'}</h2>
            </div>
            <Link to="/products" className={`btn-ghost text-sm hidden sm:flex ${isRTL ? 'flex-row-reverse' : ''}`}>
              {isRTL ? 'عرض جميع الفئات' : 'View all categories'} <ChevronRight size={16} className={isRTL ? 'rotate-180' : ''} />
            </Link>
          </div>

          <div className="flex flex-wrap justify-center gap-4 pb-2">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/products?category=${cat.slug}`}
                className="group flex flex-col items-center gap-2 p-3 w-36 rounded-2xl bg-white dark:bg-dark-surface hover:shadow-card-hover dark:hover:border-brand-gold dark:border dark:border-transparent hover:-translate-y-1 transition-all duration-200 text-center"
              >
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${cat.color} flex items-center justify-center text-2xl shadow-sm group-hover:scale-110 transition-transform`}>
                  {cat.icon}
                </div>
                <span className="text-xs font-semibold text-gray-700 dark:text-dark-text group-hover:text-brand-navy dark:group-hover:text-brand-gold transition-colors leading-tight">{isRTL && cat.arName ? cat.arName : cat.name}</span>
                <span className="text-xs text-gray-400 dark:text-dark-muted">{cat.count}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TRENDING PRODUCTS ===== */}
      <section className="py-16 bg-white dark:bg-dark-surface">
        <div className="page-container">
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : ''}>
              <p className="text-brand-gold font-semibold text-sm uppercase tracking-wider mb-1">{isRTL ? 'مختاراتنا' : 'Curated'}</p>
              <h2 className="section-heading">{t('home.featuredProducts')}</h2>
            </div>
            <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-brand-navy dark:bg-brand-gold text-white dark:text-brand-navy shadow-sm'
                      : 'bg-gray-100 dark:bg-dark-bg text-gray-600 dark:text-dark-muted hover:bg-gray-200 dark:hover:bg-dark-surface'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              <Link to="/products" className={`btn-ghost text-sm hidden md:flex ${isRTL ? 'flex-row-reverse' : ''}`}>
                {isRTL ? 'الكل' : 'See all'} <ArrowRight size={14} className={isRTL ? 'rotate-180' : ''} />
              </Link>
            </div>
          </div>

          <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {productsLoading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="bg-gray-100 dark:bg-dark-surface rounded-2xl h-64 animate-pulse" />
              ))
            ) : (
              filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))
            )}
          </div>

          <div className="text-center mt-8">
            <Link to="/products" className="btn-outline">
              {isRTL ? 'تصفح جميع المنتجات' : 'Browse All Products'} <ArrowRight size={16} className={isRTL ? 'rotate-180' : ''} />
            </Link>
          </div>
        </div>
      </section>

      {displayTrendingProducts.length > 0 && (
        <section className="py-16 bg-white dark:bg-dark-surface">
          <div className="page-container">
            <div className={`flex items-center justify-between mb-8 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className={isRTL ? 'text-right' : ''}>
                <div className={`flex items-center gap-2 mb-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="text-2xl">🔥</span>
                  <span className="text-xs font-semibold text-brand-gold uppercase tracking-wider">
                    {isRTL ? 'مدعوم بالذكاء الاصطناعي' : 'AI Powered'}
                  </span>
                </div>
                <h2 className="text-3xl font-display font-bold text-gray-900 dark:text-dark-text">
                  {isRTL ? 'الأكثر رواجاً الآن' : 'Trending Now'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-dark-muted mt-1">
                  {isRTL
                    ? 'حسب المشاهدات والمبيعات الأخيرة — مختلف عن المنتجات المميزة أعلاه'
                    : 'Based on recent views & sales — distinct from featured picks above'}
                </p>
              </div>
              <Link to="/products" className="text-brand-gold hover:underline text-sm font-medium">
                {isRTL ? 'عرض الكل ←' : 'View All →'}
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {displayTrendingProducts.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  badge="🔥 Trending"
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== BRAND BAZAARS ===== */}
      <section className="py-16 bg-brand-cream dark:bg-dark-bg">
        <div className="page-container">
          <div className={`flex items-center justify-between mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : ''}>
              <p className="text-brand-gold font-semibold text-sm uppercase tracking-wider mb-1">{isRTL ? 'ميزة جديدة' : 'New Feature'}</p>
              <h2 className="section-heading">{isRTL ? 'بازارات الماركات' : 'Brand Bazaars'}</h2>
            </div>
            <Link to="/brands" className={`btn-ghost text-sm hidden sm:flex ${isRTL ? 'flex-row-reverse' : ''}`}>
              {isRTL ? 'استكشف البازارات' : 'Explore all bazaars'} <ChevronRight size={16} className={isRTL ? 'rotate-180' : ''} />
            </Link>
          </div>
          <p className={`text-gray-500 dark:text-dark-muted mb-8 max-w-xl ${isRTL ? 'text-right mr-auto ml-0' : ''}`}>
            {isRTL 
              ? 'لكل ماركة متجرها الصغير الخاص. تصفح، تابع، وتسوق مجموعتهم الكاملة.'
              : 'Every brand has its own mini-marketplace. Browse, follow, and shop their full collection.'}
          </p>

          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {brandsLoading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="bg-gray-100 dark:bg-dark-surface rounded-2xl h-64 animate-pulse" />
              ))
            ) : (
              topBrands.slice(0, 4).map((brand) => (
                <div key={brand.id} className="card overflow-hidden">
                  {/* Brand Header */}
                  <div className={`p-4 bg-gradient-to-br from-gray-100 to-gray-50 dark:from-dark-surface dark:to-dark-surface ${isRTL ? 'text-right' : ''}`}>
                    <div className={`flex items-center justify-between mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-12 h-12 rounded-2xl bg-brand-navy dark:bg-brand-gold flex items-center justify-center shadow`}>
                        <span className="text-white dark:text-brand-navy font-bold">{brand.name?.[0]}</span>
                      </div>
                      {brand.verified && <span className="badge-verified"><CheckCircle2 size={10} /> {isRTL ? 'موثق' : 'Verified'}</span>}
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-dark-text">{brand.name}</h3>
                    <div className={`flex items-center gap-1 text-xs text-gray-500 dark:text-dark-muted ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <MapPin size={10} />
                      {brand.country}
                    </div>
                    <div className={`flex gap-3 mt-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <span className="text-xs">
                        <span className="font-bold text-gray-900 dark:text-dark-text">{brand.productCount}</span> 
                        <span className="text-gray-500 dark:text-dark-muted"> {isRTL ? 'منتج' : 'Products'}</span>
                      </span>
                      <span className="text-xs">
                        <span className="font-bold text-gray-900 dark:text-dark-text">{brand.followers >= 1000 ? `${(brand.followers/1000).toFixed(1)}K` : brand.followers}</span> 
                        <span className="text-gray-500 dark:text-dark-muted"> {isRTL ? 'متابع' : 'Followers'}</span>
                      </span>
                      <span className="text-xs"><span className="font-bold text-amber-500">★ {brand.rating}</span></span>
                    </div>
                  </div>

                  {/* Visit button */}
                  <div className="p-3">
                    <Link to={`/brand/${brand.slug}`} className="block w-full text-center py-2 bg-brand-navy dark:bg-brand-gold text-white dark:text-brand-navy text-sm font-semibold rounded-xl hover:bg-opacity-90 transition-colors">
                      {isRTL ? 'زيارة البازار ←' : 'Visit Bazaar →'}
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ===== GEN Z SECTION ===== */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-brand-navy to-pink-900"></div>
        <div className="absolute inset-0 bg-pattern opacity-20"></div>
        {/* Floating elements */}
        <div className="absolute top-10 left-10 text-6xl opacity-20 animate-float" style={{animationDelay:'0s'}}>🏺</div>
        <div className="absolute top-1/3 right-16 text-5xl opacity-20 animate-float" style={{animationDelay:'0.5s'}}>💍</div>
        <div className="absolute bottom-10 left-1/4 text-4xl opacity-20 animate-float" style={{animationDelay:'1s'}}>👗</div>
        <div className="absolute bottom-1/4 right-1/3 text-5xl opacity-20 animate-float" style={{animationDelay:'1.5s'}}>🎨</div>

        <div className="page-container relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className={`inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-full text-sm font-semibold mb-6 border border-white/20 backdrop-blur-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Sparkles size={14} className="text-yellow-400" />
              {isRTL ? 'من أجل الثقافة ✨' : 'For the Culture ✨'}
            </div>

            <h2 className="text-4xl md:text-6xl font-display font-bold text-white mb-6 leading-tight">
              {isRTL ? (
                <>
                  محلي وفخور.<br />
                  <span className="text-gradient-genz">مصري بالقلب.</span>
                </>
              ) : (
                <>
                  Local & Proud.<br />
                  <span className="text-gradient-genz">Egyptian by Heart.</span>
                </>
              )}
            </h2>

            <p className="text-gray-300 text-lg mb-8 leading-relaxed">
              {isRTL 
                ? 'لسنا مجرد سوق. نحن حركة. ندعم المبدعين المصريين، نحتفل بثقافتنا، ونجعل التسوق المحلي هو الاتجاه.'
                : "We're not just a marketplace. We're a movement. Supporting Egyptian creators, celebrating our culture, and making local shopping the vibe."}
            </p>

            <div className={`grid grid-cols-3 gap-4 mb-10 ${isRTL ? 'flex-row-reverse' : ''}`}>
              {movementStats.map((item) => (
                <div key={item.key} className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                  <div className="text-3xl mb-2">{item.emoji}</div>
                  <div className="text-2xl font-display font-bold text-white">
                    {statsLoading && item.key !== 'commission' ? (
                      <span className="inline-block h-7 w-14 bg-white/10 rounded animate-pulse" />
                    ) : (
                      <CountUp target={item.animateTo} suffix={item.suffix} />
                    )}
                  </div>
                  <div className="text-gray-400 text-sm">{item.label}</div>
                </div>
              ))}
            </div>

            {/* Category Tags - Gen Z style */}
            <div className={`flex flex-wrap justify-center gap-3 mb-10 ${isRTL ? 'flex-row-reverse' : ''}`}>
              {['#MadeInEgypt', '#LocalFirst', '#SupportSmallBiz', '#EgyptianArtisans', '#BrandHive', '#ShopLocal'].map(tag => (
                <span
                  key={tag}
                  className="px-4 py-2 bg-white/10 backdrop-blur-sm text-white text-sm font-medium rounded-full border border-white/20 hover:bg-white/20 transition-colors cursor-pointer"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className={`flex flex-wrap justify-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Link to="/explore" className="btn-gold px-8 py-4 text-base">
                {isRTL ? 'استكشف الماركات 🏪' : 'Explore Brands 🏪'}
              </Link>
              <Link to="/sell" className="border-2 border-white text-white px-8 py-4 rounded-xl font-semibold hover:bg-white hover:text-brand-navy transition-all text-base">
                {isRTL ? 'ابدأ البيع 💼' : 'Start Selling 💼'}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TOP BRANDS ===== */}
      <section className="py-16 bg-white dark:bg-dark-surface">
        <div className="page-container">
          <div className={`flex items-center justify-between mb-10 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : ''}>
              <p className="text-brand-gold font-semibold text-sm uppercase tracking-wider mb-1">{isRTL ? 'بائعون موثوقون' : 'Trusted Sellers'}</p>
              <h2 className="section-heading">{t('home.topBrands')}</h2>
            </div>
            <Link to="/explore" className={`btn-ghost text-sm hidden sm:flex ${isRTL ? 'flex-row-reverse' : ''}`}>
              {isRTL ? 'جميع الماركات' : 'All brands'} <ChevronRight size={16} className={isRTL ? 'rotate-180' : ''} />
            </Link>
          </div>

          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {brandsLoading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="bg-gray-100 dark:bg-dark-surface rounded-2xl h-64 animate-pulse" />
              ))
            ) : (
              topBrands.slice(0, 4).map((brand) => (
                <BrandCard key={brand.id} brand={brand} />
              ))
            )}
          </div>
        </div>
      </section>

      {/* ===== GLOBAL BRANDS ===== */}
      <section className="py-16 bg-brand-cream dark:bg-dark-bg">
        <div className="page-container">
          <div className="text-center mb-10">
            <p className="text-brand-gold font-semibold text-sm uppercase tracking-wider mb-1">{isRTL ? 'دولي' : 'International'}</p>
            <h2 className="section-heading">{t('home.globalBrands')}</h2>
            <p className="text-gray-500 dark:text-dark-muted mt-2">
              {isRTL ? 'تسوق من الماركات العالمية — توصيل مباشر لباب منزلك.' : 'Shop international brands — delivered straight to your door.'}
            </p>
          </div>

          <div className={`grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {globalBrands.length > 0
              ? globalBrands.map((brand, i) => (
                  <div
                    key={i}
                    onClick={() => navigate(`/brand/${brand.slug}`)}
                    className="flex items-center justify-center p-4 bg-white dark:bg-dark-surface rounded-2xl shadow-card hover:shadow-card-hover transition-all cursor-pointer"
                  >
                    <img
                      src={brand.logo}
                      alt={brand.name}
                      className="h-10 w-auto object-contain max-w-[120px]"
                      onError={e => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'block';
                      }}
                    />
                    <span
                      style={{ display: 'none' }}
                      className="font-bold text-sm text-gray-700 dark:text-dark-text"
                    >
                      {brand.name}
                    </span>
                  </div>
                ))
              : topBrands.slice(0, 12).map((brand, i) => (
                  <div
                    key={i}
                    onClick={() => navigate(`/brand/${brand.slug}`)}
                    className="flex items-center justify-center p-4 bg-white dark:bg-dark-surface rounded-2xl shadow-card cursor-pointer"
                  >
                    <span className="font-bold text-sm text-gray-700 dark:text-dark-text truncate">
                      {brand.name}
                    </span>
                  </div>
                ))
            }
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section className="py-16 bg-white dark:bg-dark-surface">
        <div className="page-container">
          <div className="text-center mb-10">
            <p className="text-brand-gold font-semibold text-sm uppercase tracking-wider mb-1">{isRTL ? 'آراء' : 'Reviews'}</p>
            <h2 className="section-heading">{t('home.testimonials')}</h2>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {testimonials.map((t) => (
              <div key={t.id} className={`card p-6 ${isRTL ? 'text-right' : ''}`}>
                <div className={`flex mb-3 ${isRTL ? 'justify-end' : ''}`}>
                  {[...Array(t.rating)].map((_, i) => (
                    <Star key={i} size={14} className="text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-gray-700 dark:text-dark-text mb-4 leading-relaxed">"{isRTL && t.arText ? t.arText : t.text}"</p>
                <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className="w-9 h-9 rounded-full bg-brand-navy dark:bg-brand-gold flex items-center justify-center">
                    <span className="text-white dark:text-brand-navy text-sm font-bold">{t.name[0]}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-dark-text">{t.name}</p>
                    <p className="text-xs text-gray-500 dark:text-dark-muted">{isRTL && t.arRole ? t.arRole : t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== SELL ON BRANDHIVE CTA ===== */}
      <section className="py-16 bg-brand-navy">
        <div className="page-container">
          <div className={`flex flex-col lg:flex-row items-center justify-between gap-8 ${isRTL ? 'lg:flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-3">
                {isRTL ? 'مستعد لتنمية ماركتك؟' : 'Ready to grow your brand?'}
              </h2>
              <p className={`text-gray-300 max-w-lg ${isRTL ? 'mr-auto ml-0' : ''}`}>
                {t('home.sellCta.subtitle')}
              </p>
            </div>
            <div className={`flex flex-col sm:flex-row gap-4 flex-shrink-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Link to="/sell" className="btn-gold px-8 py-4 text-base">
                {isRTL ? 'ابدأ البيع مجاناً' : 'Start Selling Free'}
              </Link>
              <Link to="/explore" className="border-2 border-white text-white px-8 py-4 rounded-xl font-semibold hover:bg-white/10 transition-all text-base whitespace-nowrap">
                {isRTL ? 'تصفح الماركات' : 'Browse Brands'}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
