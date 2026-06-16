import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { MapPin, Star, CheckCircle2, MessageSquare, Heart, Share2, ArrowLeft, Truck, RotateCcw, Tag, Gift, Zap } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import { mapProduct, mapBrand, hydrateProductImages, deduplicateProducts } from '../utils/mappers';
import { productsAPI, brandsAPI, loadLocalProductImages, enrichProductsWithLocalImages, enrichCatalogWithMirroredImages, fetchBrandProductReviews, fetchBrandFollowState, toggleBrandFollow, fetchBrandPublicOffers } from '../services/api';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function BrandPage() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { slug } = useParams();
  const navigate = useNavigate();

  const { user, isAuthenticated } = useAuth();
  const [brand, setBrand] = useState(null);
  const [brandProducts, setBrandProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('Bazaar');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [localFollowers, setLocalFollowers] = useState(0);
  const [localSales, setLocalSales] = useState(0);
  const [brandReviews, setBrandReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [brandOffers, setBrandOffers] = useState({ promos: [], coupons: [] });
  const [sortBy, setSortBy] = useState('Best Match');
  const [filterCat, setFilterCat] = useState('All');

  useEffect(() => {
    const fetchBrand = async () => {
      setLoading(true);
      setError(null);
      try {
        let found = null;

        try {
          const oneRes = await brandsAPI.getOne(slug);
          found = oneRes.data?.data || oneRes.data?.brand || oneRes.data;
        } catch {
          const res = await brandsAPI.getAll(1, 100);
          const allBrands =
            res.data?.data ||
            res.data?.brands ||
            res.data ||
            [];
          found = Array.isArray(allBrands)
            ? allBrands.find((b) =>
                b.slug === slug ||
                b._id === slug ||
                b.id === slug
              )
            : null;
        }

        if (!found || (!found.name && !found._id && !found.id)) {
          setError(isRTL ? 'الماركة غير موجودة' : 'Brand not found');
          setBrand(null);
          return;
        }

        const brandId = found._id || found.id;
        let products = [];

        if (brandId) {
          try {
            const prodRes = await productsAPI.getByBrand(brandId);
            const prods =
              prodRes.data?.data ||
              prodRes.data?.products ||
              prodRes.data ||
              [];
            products = Array.isArray(prods) ? prods : [];
          } catch {
            products = [];
          }
        }

        await loadLocalProductImages(products.map((product) => product._id || product.id));
        products = enrichProductsWithLocalImages(products);

        const mappedBrand = mapBrand(found);

        let mappedProducts = products.map(mapProduct).map((product) => ({
          ...product,
          brandName: product.brandName || mappedBrand.name,
          brandSlug: product.brandSlug || mappedBrand.slug,
          brandLogo: product.brandLogo || mappedBrand.logo,
          verified: product.verified ?? mappedBrand.verified,
        }));

        try {
          const catalogRes = await productsAPI.getAll({ limit: 100 });
          const catalogRaw =
            catalogRes.data?.data ||
            catalogRes.data?.products ||
            catalogRes.data ||
            [];
          const catalog = Array.isArray(catalogRaw)
            ? catalogRaw.map(mapProduct)
            : [];
          mappedProducts = hydrateProductImages(mappedProducts, catalog);
        } catch {
          // keep brand API data
        }

        mappedProducts = await enrichCatalogWithMirroredImages(mappedProducts, {
          limit: 50,
        });
        mappedProducts = deduplicateProducts(mappedProducts);
        setBrandProducts(mappedProducts);

        const totalSales = products.reduce(
          (sum, p) => sum + (p.stats?.totalSales || p.sold || p.cartCount || 0),
          0
        );
        setLocalSales(totalSales);

        if (mappedProducts.length > 0) {
          mappedBrand.productCount = mappedProducts.length;
          const rated = mappedProducts.filter((p) => (p.rating || 0) > 0);
          if (rated.length > 0) {
            mappedBrand.rating =
              Math.round(
                (rated.reduce((s, p) => s + p.rating, 0) / rated.length) * 10
              ) / 10;
          }
        }
        if (totalSales > 0) mappedBrand.sales = totalSales;

        setBrand(mappedBrand);
      } catch {
        setError(isRTL ? 'فشل تحميل الماركة' : 'Failed to load brand');
        setBrand(null);
      } finally {
        setLoading(false);
      }
    };
    fetchBrand();
  }, [slug, isRTL]);

  useEffect(() => {
    if (!brand) return;

    setLocalFollowers(brand.followers || 0);

    const userId = user?.id || user?._id;
    if (!userId) {
      setIsFollowing(false);
      return;
    }

    const loadFollowState = async () => {
      const brandId = brand.id || brand._id;
      const state = await fetchBrandFollowState(userId, brandId);
      setIsFollowing(state.isFollowing);
    };

    loadFollowState();
  }, [brand, user?.id, user?._id]);

  useEffect(() => {
    if (!brandProducts.length) {
      setBrandReviews([]);
      return;
    }

    const loadReviews = async () => {
      setReviewsLoading(true);
      try {
        const reviews = await fetchBrandProductReviews(brandProducts);
        setBrandReviews(reviews);
      } catch {
        setBrandReviews([]);
      } finally {
        setReviewsLoading(false);
      }
    };

    loadReviews();
  }, [brandProducts]);

  useEffect(() => {
    const brandId = brand?.id || brand?._id;
    if (!brandId) {
      setBrandOffers({ promos: [], coupons: [] });
      return;
    }

    let cancelled = false;
    fetchBrandPublicOffers(brandId)
      .then((offers) => {
        if (!cancelled) setBrandOffers(offers);
      })
      .catch(() => {
        if (!cancelled) setBrandOffers({ promos: [], coupons: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [brand?.id, brand?._id, activeTab]);

  useEffect(() => {
    if (!brand?.id) return;
    const interval = setInterval(async () => {
      try {
        const res = await brandsAPI.getAll(1, 100);
        const all = res.data?.data || res.data?.brands || res.data || [];
        const updated = Array.isArray(all)
          ? all.find(b => b.slug === slug || b._id === brand.id || b.id === brand.id)
          : null;
        if (updated) {
          const mapped = mapBrand(updated);
          setBrand(mapped);
          setLocalFollowers(mapped.followers || 0);
        }
      } catch {
        // keep current stats
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [brand?.id, slug]);

  const handleFollow = async () => {
    if (!isAuthenticated) {
      toast.error(isRTL ? 'يرجى تسجيل الدخول أولاً' : 'Please login first');
      navigate('/login', { state: { from: `/brand/${slug}` } });
      return;
    }

    const brandId = brand?.id || brand?._id;
    const userId = user?.id || user?._id;
    if (!brandId || !userId || followLoading) return;

    setFollowLoading(true);
    try {
      const nextFollowing = await toggleBrandFollow(
        userId,
        brandId,
        isFollowing
      );
      setIsFollowing(nextFollowing);
      setLocalFollowers((prev) =>
        nextFollowing ? prev + 1 : Math.max(0, prev - 1)
      );
      toast.success(
        nextFollowing
          ? isRTL
            ? 'تم المتابعة ✅'
            : 'Following ✅'
          : isRTL
            ? 'تم إلغاء المتابعة'
            : 'Unfollowed'
      );
    } catch {
      toast.error(
        isRTL ? 'تعذرت متابعة الماركة' : 'Could not update follow status'
      );
    } finally {
      setFollowLoading(false);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/brand/${slug}`;
    const shareTitle = brand?.name || 'BrandHive';
    const shareText = isRTL
      ? `تصفح ماركة ${shareTitle} على BrandHive`
      : `Check out ${shareTitle} on BrandHive`;

    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, text: shareText, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success(isRTL ? 'تم نسخ الرابط ✅' : 'Link copied ✅');
    } catch (err) {
      if (err?.name === 'AbortError') return;
      try {
        await navigator.clipboard.writeText(url);
        toast.success(isRTL ? 'تم نسخ الرابط ✅' : 'Link copied ✅');
      } catch {
        toast.error(isRTL ? 'تعذر مشاركة الرابط' : 'Could not share link');
      }
    }
  };

  const handleMessage = () => {
    if (!isAuthenticated) {
      toast.error(isRTL ? 'يرجى تسجيل الدخول أولاً' : 'Please login first');
      navigate('/login', { state: { from: `/brand/${slug}` } });
      return;
    }

    const brandId = brand?.id || brand?._id;
    const sellerBrandId = localStorage.getItem(
      `brandhive_seller_brand_${user?.id || user?._id || 'default'}`
    );

    if (sellerBrandId && brandId && String(sellerBrandId) === String(brandId)) {
      toast(
        isRTL
          ? 'هذه ماركتك — رسائل العملاء تظهر في لوحة البائع'
          : 'This is your brand — customer messages appear in Seller Dashboard',
        { icon: 'ℹ️' }
      );
      navigate('/seller/dashboard?tab=messages');
      return;
    }

    navigate('/chat', {
      state: {
        brandId,
        brandName: brand?.name,
      },
    });
  };

  const totalReviews = useMemo(
    () =>
      brandReviews.length > 0
        ? brandReviews.length
        : brandProducts.reduce((sum, p) => sum + (p.reviews || 0), 0),
    [brandReviews, brandProducts]
  );

  const reviewAverage = useMemo(() => {
    if (brandReviews.length > 0) {
      const rated = brandReviews.filter((review) => Number(review.rating) > 0);
      if (rated.length === 0) return brand?.rating || 0;
      return (
        Math.round(
          (rated.reduce((sum, review) => sum + Number(review.rating), 0) /
            rated.length) *
            10
        ) / 10
      );
    }
    return brand?.rating || 0;
  }, [brandReviews, brand?.rating]);

  const handleCopyCoupon = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      sessionStorage.setItem('brandhive_pending_coupon', String(code).toUpperCase());
      toast.success(
        isRTL ? `تم نسخ الكود: ${code}` : `Coupon copied: ${code}`
      );
    } catch {
      toast.error(isRTL ? 'تعذر نسخ الكود' : 'Could not copy code');
    }
  };

  const freeShippingOffer = brandOffers.promos.find(
    (entry) => entry.type === 'free_shipping'
  );
  const bundleOffer = brandOffers.promos.find(
    (entry) => entry.type === 'buy_x_get_y'
  );
  const hasActiveOffers =
    brandOffers.coupons.length > 0 ||
    Boolean(freeShippingOffer || bundleOffer);

  const filteredProducts = useMemo(() => {
    let result = brandProducts.filter((p) => {
      if (filterCat === 'All') return true;
      if (filterCat === 'On Sale') return p.isOnSale || (p.discount || 0) > 0;
      if (filterCat === 'New Arrivals') return p.isNew;
      if (filterCat === 'Customizable') return p.customizable;
      return true;
    });

    switch (sortBy) {
      case 'Price: Low to High':
        result = [...result].sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case 'Price: High to Low':
        result = [...result].sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case 'Top Rated':
        result = [...result].sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'Newest':
        result = [...result].sort(
          (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        );
        break;
      default:
        break;
    }

    return result;
  }, [brandProducts, filterCat, sortBy]);

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-cream dark:bg-dark-bg">
        <div className="max-w-7xl mx-auto px-4 py-8 animate-pulse">
          <div className="flex flex-col md:flex-row gap-6 items-start mb-8">
            <div className="w-20 h-20 rounded-3xl bg-gray-200 dark:bg-dark-surface" />
            <div className="flex-1 space-y-3">
              <div className="h-8 bg-gray-200 dark:bg-dark-surface rounded-xl w-1/3" />
              <div className="h-4 bg-gray-200 dark:bg-dark-surface rounded-xl w-1/4" />
              <div className="h-20 bg-gray-200 dark:bg-dark-surface rounded-xl" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-200 dark:bg-dark-surface rounded-2xl h-64" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-cream dark:bg-dark-bg">
        <div className="text-center">
          <div className="text-6xl mb-4">🏪</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text mb-2">
            {error || (isRTL ? 'الماركة غير موجودة' : 'Brand not found')}
          </h2>
          <Link to="/explore" className="btn-primary mt-4 inline-block">
            {isRTL ? 'استكشف الماركات' : 'Explore Brands'}
          </Link>
        </div>
      </div>
    );
  }

  const productCount = brandProducts.length || brand.productCount || 0;
  const displayRating = brand.rating || 0;
  const displayFollowers = localFollowers || brand.followers || 0;

  const tabs = [
    { id: 'Bazaar', label: isRTL ? `البازار (${productCount})` : `Bazaar (${productCount})` },
    { id: 'Reviews', label: isRTL ? `التقييمات (${totalReviews})` : `Reviews (${totalReviews})` },
    { id: 'About', label: isRTL ? 'عن الماركة' : 'About' },
    { id: 'Policies', label: isRTL ? 'السياسات' : 'Policies' },
  ];

  const salesCount = localSales || brand.sales || 0;
  const salesDisplay = salesCount >= 1000 ? `${(salesCount / 1000).toFixed(1)}K` : salesCount;

  const formatStat = (value) => (value > 0 ? value : '—');

  return (
    <div className={`min-h-screen bg-brand-cream dark:bg-dark-bg transition-colors duration-200 text-start`}>
      {/* Breadcrumb */}
      <div className="bg-white dark:bg-dark-surface border-b border-gray-100 dark:border-dark-border">
        <div className="page-container py-3">
          <Link to="/explore" className={`flex items-center gap-1 text-sm text-gray-500 dark:text-dark-muted hover:text-brand-navy dark:hover:text-brand-gold transition-colors`}>
            <ArrowLeft size={14} className="rtl-flip" />
            {isRTL ? 'العودة للماركات' : 'Back to Brands'}
          </Link>
        </div>
      </div>

      {/* Brand Header */}
      <div className={`bg-gradient-to-r ${brand.coverColor || 'from-gray-100 to-gray-50'} dark:from-dark-surface dark:to-dark-surface border-b border-gray-200 dark:border-dark-border`}>
        <div className="page-container py-8">
          <div className={`flex flex-col md:flex-row gap-6 items-start`}>
            {/* Brand Avatar */}
            <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${brand.color || 'from-brand-navy to-blue-800'} flex items-center justify-center shadow-lg flex-shrink-0 overflow-hidden`}>
              {brand.logo ? (
                <img src={brand.logo} alt={brand.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-bold text-3xl">{brand.name?.[0]}</span>
              )}
            </div>

            {/* Brand Info */}
            <div className="flex-1 min-w-0">
              <div className={`flex flex-wrap items-center gap-3 mb-2`}>
                <h1 className="text-3xl font-display font-bold text-gray-900 dark:text-dark-text">{brand.name}</h1>
                {brand.verified && (
                  <span className={`badge-verified text-sm`}>
                    <CheckCircle2 size={13} /> {isRTL ? 'موثق' : 'Verified'}
                  </span>
                )}
              </div>

              <div className={`flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-dark-muted mb-3`}>
                <span className={`flex items-center gap-1`}><MapPin size={13} /> {brand.country}</span>
                <span>· {isRTL ? 'عضو منذ' : 'Member since'} {brand.memberSince}</span>
              </div>

              <div className={`flex flex-wrap gap-2 mb-4`}>
                {brand.tags?.map(tag => (
                  <span key={tag} className="px-3 py-1 bg-white/80 dark:bg-dark-bg/80 rounded-full text-xs font-medium text-gray-700 dark:text-dark-text">
                    {tag}
                  </span>
                ))}
              </div>

              <p className="text-gray-600 dark:text-dark-muted max-w-xl leading-relaxed">
                {(isRTL && brand.arDescription ? brand.arDescription : brand.longDescription) ||
                  brand.description ||
                  (isRTL ? 'علامة تجارية مصرية على BrandHive.' : 'An Egyptian brand on BrandHive.')}
              </p>
            </div>

            {/* Stats + Actions */}
            <div className={`flex flex-col items-end gap-4 ${isRTL ? 'items-start' : 'items-end'}`}>
              <div className={`grid grid-cols-4 gap-4 text-center`}>
                {[
                  { value: formatStat(productCount), label: isRTL ? 'منتجات' : 'Products' },
                  { value: salesCount > 0 ? salesDisplay : '—', label: isRTL ? 'مبيعات' : 'Sales' },
                  { value: displayRating > 0 ? `${displayRating}★` : '—', label: isRTL ? 'تقييم' : 'Rating' },
                  {
                    value: displayFollowers > 0
                      ? (displayFollowers >= 1000 ? `${(displayFollowers / 1000).toFixed(1)}K` : displayFollowers)
                      : '—',
                    label: isRTL ? 'متابعون' : 'Followers',
                  },
                ].map(stat => (
                  <div key={stat.label} className="bg-white dark:bg-dark-surface rounded-2xl px-4 py-3 shadow-sm dark:border dark:border-dark-border min-w-[70px]">
                    <div className="text-lg font-bold text-brand-navy dark:text-brand-gold">{stat.value}</div>
                    <div className="text-[10px] text-gray-500 dark:text-dark-muted uppercase font-semibold">{stat.label}</div>
                  </div>
                ))}
              </div>

              <div className={`flex gap-2`}>
                <button
                  type="button"
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 ${
                  isFollowing
                    ? 'bg-gray-100 dark:bg-dark-bg text-gray-700 dark:text-dark-text hover:bg-gray-200 dark:hover:bg-dark-surface'
                    : 'bg-brand-navy dark:bg-brand-gold text-white dark:text-brand-navy hover:bg-opacity-90'
                }`}>
                  <Heart size={15} fill={isFollowing ? 'currentColor' : 'none'} className={isFollowing ? 'text-red-500' : ''} />
                  {isFollowing ? (isRTL ? 'متابع' : 'Following') : (isRTL ? '+ متابعة' : '+ Follow')}
                </button>
                <button type="button" onClick={handleMessage} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm border-2 border-gray-200 dark:border-dark-border hover:border-brand-navy dark:hover:border-brand-gold text-gray-700 dark:text-dark-text hover:text-brand-navy dark:hover:text-brand-navy transition-all`}>
                  <MessageSquare size={15} />
                  {isRTL ? 'رسالة' : 'Message'}
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  className="p-2.5 rounded-xl border-2 border-gray-200 dark:border-dark-border hover:border-brand-navy dark:hover:border-brand-gold text-gray-500 dark:text-dark-muted hover:text-brand-navy dark:hover:text-brand-navy transition-all"
                  aria-label={isRTL ? 'مشاركة' : 'Share'}
                >
                  <Share2 size={15} />
                </button>
              </div>

              {/* Shipping info */}
              <div className={`flex gap-4 text-xs text-gray-500 dark:text-dark-muted`}>
                <span className={`flex items-center gap-1`}>
                  <Truck size={12} />
                  {freeShippingOffer
                    ? freeShippingOffer.label
                    : `${isRTL ? 'توصيل:' : 'Shipping:'} ${brand.shipping}`}
                </span>
                <span className={`flex items-center gap-1`}><RotateCcw size={12} /> {isRTL ? 'استرجاع:' : 'Returns:'} {brand.returns}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-dark-surface border-b border-gray-200 dark:border-dark-border sticky top-16 z-30">
        <div className="page-container">
          <div className={`flex gap-1 overflow-x-auto`}>
            {tabs.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    isActive ? 'border-brand-navy dark:border-brand-gold text-brand-navy dark:text-brand-gold' : 'border-transparent text-gray-500 dark:text-dark-muted hover:text-gray-900 dark:hover:text-dark-text'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="page-container py-8">
        {/* Bazaar Tab */}
        {activeTab === 'Bazaar' && (
          <div>
            {hasActiveOffers && (
              <div className="mb-6 space-y-3">
                <div className={`flex items-center gap-2 mb-1`}>
                  <Zap size={16} className="text-brand-gold" />
                  <h3 className="font-bold text-gray-900 dark:text-dark-text">
                    {isRTL ? 'عروض المتجر' : 'Store Offers'}
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {freeShippingOffer && (
                    <div className={`flex items-start gap-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-4`}>
                      <Truck size={18} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-sm text-gray-900 dark:text-dark-text">
                          {isRTL ? 'شحن مجاني' : 'Free Shipping'}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-dark-muted mt-1">
                          {freeShippingOffer.label}
                        </p>
                      </div>
                    </div>
                  )}
                  {bundleOffer && (
                    <div className={`flex items-start gap-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-4`}>
                      <Gift size={18} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-sm text-gray-900 dark:text-dark-text">
                          {isRTL ? 'عرض خاص' : 'Bundle Deal'}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-dark-muted mt-1">
                          {bundleOffer.label}
                        </p>
                      </div>
                    </div>
                  )}
                  {brandOffers.coupons.map((coupon) => (
                    <div
                      key={coupon._id || coupon.id || coupon.code}
                      className={`flex items-center justify-between gap-3 bg-brand-gold-pale dark:bg-brand-gold/10 border border-brand-gold/30 rounded-2xl p-4`}
                    >
                      <div className={`flex items-start gap-3`}>
                        <Tag size={18} className="text-brand-navy dark:text-brand-gold flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-brand-navy dark:text-brand-gold tracking-wide">
                            {coupon.code}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-dark-muted mt-1">
                            {coupon.type === 'percentage'
                              ? `${coupon.value}% ${isRTL ? 'خصم' : 'off'}`
                              : `${coupon.value} EGP ${isRTL ? 'خصم' : 'off'}`}
                            {coupon.expiresAt
                              ? ` · ${isRTL ? 'حتى' : 'until'} ${new Date(coupon.expiresAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US')}`
                              : ''}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyCoupon(coupon.code)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-navy dark:bg-brand-gold text-white dark:text-brand-navy hover:opacity-90"
                      >
                        {isRTL ? 'نسخ' : 'Copy'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filters bar */}
            <div className={`flex flex-wrap items-center gap-3 mb-6`}>
              {[
                { id: 'All', label: isRTL ? 'الكل' : 'All' },
                { id: 'On Sale', label: isRTL ? 'عروض' : 'On Sale' },
                { id: 'New Arrivals', label: isRTL ? 'وصل حديثاً' : 'New Arrivals' },
                { id: 'Customizable', label: isRTL ? 'قابل للتخصيص' : 'Customizable' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilterCat(f.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    filterCat === f.id ? 'bg-brand-navy dark:bg-brand-gold text-white dark:text-brand-navy' : 'bg-white dark:bg-dark-surface text-gray-600 dark:text-dark-text hover:bg-gray-50 dark:hover:bg-dark-bg shadow-sm'
                  }`}
                >
                  {f.label}
                </button>
              ))}
              <div className={isRTL ? 'mr-auto ml-0' : 'ml-auto mr-0'}>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className={`input-field py-2 text-sm w-40 ${isRTL ? 'text-right' : ''}`}
                >
                  <option value="Best Match">{isRTL ? 'الأكثر مطابقة' : 'Best Match'}</option>
                  <option value="Price: Low to High">{isRTL ? 'السعر: من الأقل للأعلى' : 'Price: Low to High'}</option>
                  <option value="Price: High to Low">{isRTL ? 'السعر: من الأعلى للأقل' : 'Price: High to Low'}</option>
                  <option value="Top Rated">{isRTL ? 'الأعلى تقييماً' : 'Top Rated'}</option>
                  <option value="Newest">{isRTL ? 'الأحدث' : 'Newest'}</option>
                </select>
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-5xl mb-4">📦</div>
                <p className="text-gray-500 dark:text-dark-muted">
                  {isRTL ? 'لا توجد منتجات تطابق هذه الفلاتر' : 'No products match these filters'}
                </p>
              </div>
            ) : (
              <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4`}>
                {filteredProducts.map(product => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reviews Tab */}
        {activeTab === 'Reviews' && (
          <div className={`max-w-2xl ${isRTL ? 'mr-0' : ''}`}>
            {reviewsLoading ? (
              <div className="text-center py-16 bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:border dark:border-dark-border">
                <div className="w-6 h-6 border-2 border-brand-gold border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : totalReviews === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:border dark:border-dark-border">
                <div className="text-5xl mb-4">⭐</div>
                <p className="text-gray-500 dark:text-dark-muted">
                  {isRTL ? 'لا توجد تقييمات بعد' : 'No reviews yet'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6">
                  <div className={`flex items-center gap-6`}>
                    <div className="text-center">
                      <div className="text-5xl font-display font-bold text-brand-navy dark:text-brand-gold">
                        {reviewAverage > 0 ? reviewAverage : '—'}
                      </div>
                      <div className="flex justify-center my-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            size={16}
                            className={i < Math.floor(reviewAverage) ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600'}
                          />
                        ))}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-dark-muted">
                        {totalReviews} {isRTL ? 'تقييم' : 'reviews'}
                      </div>
                    </div>
                  </div>
                </div>

                {brandReviews.map((review, i) => (
                  <div
                    key={review._id || review.id || i}
                    className={`bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-5 ${isRTL ? 'text-right' : ''}`}
                  >
                    <div className={`flex items-center gap-3 mb-2`}>
                      <div className="w-9 h-9 rounded-full bg-brand-gold flex items-center justify-center text-white text-sm font-bold">
                        {review.user?.name?.[0] || 'U'}
                      </div>
                      <div className={isRTL ? 'text-right' : ''}>
                        <p className="text-sm font-semibold text-gray-900 dark:text-dark-text">
                          {review.user?.name || 'Customer'}
                        </p>
                        <div className={`flex`}>
                          {[...Array(5)].map((_, s) => (
                            <Star
                              key={s}
                              size={12}
                              className={
                                s < (review.rating || 0)
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'text-gray-300 dark:text-gray-600'
                              }
                            />
                          ))}
                        </div>
                      </div>
                      <span className={`ms-auto text-xs text-gray-400 dark:text-dark-muted`}>
                        {review.createdAt
                          ? new Date(review.createdAt).toLocaleDateString(
                              isRTL ? 'ar-EG' : 'en-US'
                            )
                          : ''}
                      </span>
                    </div>
                    <p className={`text-sm text-gray-700 dark:text-dark-muted ms-12`}>
                      {review.comment || '-'}
                    </p>
                    {review.productName && (
                      <p className={`text-xs text-brand-gold mt-2 ms-12`}>
                        {review.productName}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* About Tab */}
        {activeTab === 'About' && (
          <div className="max-w-2xl">
            <div className={`bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6 ${isRTL ? 'text-right' : ''}`}>
              <h3 className="text-xl font-display font-bold text-gray-900 dark:text-dark-text mb-4">
                {isRTL ? `عن ${brand.name}` : `About ${brand.name}`}
              </h3>
              <p className="text-gray-700 dark:text-dark-muted leading-relaxed mb-6">{isRTL && brand.arDescription ? brand.arDescription : brand.longDescription}</p>

              <div className={`grid grid-cols-2 gap-4`}>
                <div className="bg-brand-cream dark:bg-dark-bg rounded-xl p-4">
                  <p className="text-sm font-semibold text-gray-700 dark:text-dark-text">{isRTL ? 'الموقع' : 'Location'}</p>
                  <p className={`text-gray-600 dark:text-dark-muted text-sm mt-1 flex items-center gap-1`}><MapPin size={13} /> {brand.country}</p>
                </div>
                <div className="bg-brand-cream dark:bg-dark-bg rounded-xl p-4">
                  <p className="text-sm font-semibold text-gray-700 dark:text-dark-text">{isRTL ? 'عضو منذ' : 'Member Since'}</p>
                  <p className="text-gray-600 dark:text-dark-muted text-sm mt-1">{brand.memberSince}</p>
                </div>
                <div className="bg-brand-cream dark:bg-dark-bg rounded-xl p-4">
                  <p className="text-sm font-semibold text-gray-700 dark:text-dark-text">{isRTL ? 'الفئة' : 'Category'}</p>
                  <p className="text-gray-600 dark:text-dark-muted text-sm mt-1">{isRTL && brand.arCategory ? brand.arCategory : brand.category}</p>
                </div>
                <div className="bg-brand-cream dark:bg-dark-bg rounded-xl p-4">
                  <p className="text-sm font-semibold text-gray-700 dark:text-dark-text">{isRTL ? 'سرعة الرد' : 'Response Rate'}</p>
                  <p className="text-gray-600 dark:text-dark-muted text-sm mt-1">{isRTL ? '98% خلال 24 ساعة' : '98% within 24h'}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Policies Tab */}
        {activeTab === 'Policies' && (
          <div className="max-w-2xl">
            <div className={`bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6 ${isRTL ? 'text-right' : ''}`}>
              <h3 className="text-xl font-display font-bold text-gray-900 dark:text-dark-text mb-6">
                {isRTL ? 'سياسات المتجر' : 'Shop Policies'}
              </h3>
              <div className="space-y-6">
                {[
                  { title: isRTL ? 'سياسة الشحن' : 'Shipping Policy', icon: '🚚', text: isRTL ? `يتم تجهيز الطلبات خلال 1-2 أيام عمل. التوصيل المتوقع: ${brand.shipping}. شحن مجاني للطلبات فوق 500 ج.م.` : `Orders are processed within 1–2 business days. Estimated delivery: ${brand.shipping}. Free shipping on orders above 500 EGP.` },
                  { title: isRTL ? 'سياسة الاسترجاع' : 'Returns Policy', icon: '↩️', text: isRTL ? `${brand.returns} من تاريخ التوصيل. يجب أن تكون المنتجات بحالتها الأصلية. المنتجات المخصصة غير قابلة للاسترجاع.` : `${brand.returns} from delivery date. Items must be in original condition. Customized items are non-refundable.` },
                  { title: isRTL ? 'طرق الدفع' : 'Payment Methods', icon: '💳', text: isRTL ? 'نقبل جميع البطاقات الائتمانية الرئيسية، فودافون كاش، فوري، والدفع عند الاستلام.' : 'We accept all major credit cards, Vodafone Cash, Fawry, and Cash on Delivery.' },
                  { title: isRTL ? 'التخصيص' : 'Customization', icon: '✨', text: isRTL ? 'تتوفر طلبات التخصيص لبعض المنتجات. يرجى مراسلتنا قبل تقديم طلب مخصص.' : 'Custom orders available for select products. Please message us before placing a custom order.' },
                ].map(p => (
                  <div key={p.title} className={`flex gap-4`}>
                    <span className="text-2xl flex-shrink-0">{p.icon}</span>
                    <div className={isRTL ? 'text-right' : ''}>
                      <h4 className="font-semibold text-gray-900 dark:text-dark-text mb-1">{p.title}</h4>
                      <p className="text-sm text-gray-600 dark:text-dark-muted leading-relaxed">{p.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
