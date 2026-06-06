import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Star, CheckCircle2, MessageSquare, Heart, Share2, ArrowLeft, Truck, RotateCcw } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import { productsAPI, brandsAPI } from '../services/api';
import { mapProduct, mapBrand } from '../utils/mappers';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function BrandPage() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { slug } = useParams();
  
  const { isAuthenticated } = useAuth();
  const [brand, setBrand] = useState(null);
  const [brandProducts, setBrandProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('Bazaar');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [localFollowers, setLocalFollowers] = useState(0);
  const [localSales, setLocalSales] = useState(0);
  const [sortBy, setSortBy] = useState('Best Match');
  const [filterCat, setFilterCat] = useState('All');

  useEffect(() => {
    const fetchBrand = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await brandsAPI.getAll(1, 100);
        const allBrands =
          res.data?.data ||
          res.data?.brands ||
          res.data ||
          [];

        const found = Array.isArray(allBrands)
          ? allBrands.find(b =>
              b.slug === slug ||
              b._id === slug ||
              b.id === slug
            )
          : null;

        if (!found) {
          setError(isRTL
            ? 'الماركة غير موجودة'
            : 'Brand not found'
          );
          setBrand(null);
          return;
        }

        setBrand(mapBrand(found));

        const brandId = found._id || found.id;
        if (brandId) {
          try {
            const prodRes = await productsAPI.getByBrand(brandId);
            const prods =
              prodRes.data?.data ||
              prodRes.data ||
              [];
            const products = Array.isArray(prods) ? prods : [];
            const totalCartAdds = products.reduce((sum, p) =>
              sum + (p.cartCount || 0), 0
            );
            setLocalSales(totalCartAdds);
            setBrandProducts(products.map(mapProduct));
          } catch {
            setBrandProducts([]);
            setLocalSales(0);
          }
        }
      } catch {
        setError(isRTL
          ? 'فشل تحميل الماركة'
          : 'Failed to load brand'
        );
        setBrand(null);
      } finally {
        setLoading(false);
      }
    };
    fetchBrand();
  }, [slug, isRTL]);

  useEffect(() => {
    if (brand) {
      setLocalFollowers(brand.followers || 0);
    }
  }, [brand]);

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
      toast.error(isRTL
        ? 'يرجى تسجيل الدخول أولاً'
        : 'Please login first'
      );
      return;
    }

    setFollowLoading(true);
    const newFollowing = !isFollowing;
    try {
      setIsFollowing(newFollowing);
      setLocalFollowers(prev =>
        newFollowing ? prev + 1 : prev - 1
      );

      toast.success(newFollowing
        ? (isRTL ? 'تم المتابعة ✅' : 'Following ✅')
        : (isRTL ? 'تم إلغاء المتابعة' : 'Unfollowed')
      );
    } catch {
      setIsFollowing(!newFollowing);
      setLocalFollowers(prev =>
        newFollowing ? prev - 1 : prev + 1
      );
    } finally {
      setFollowLoading(false);
    }
  };

  const handleMessage = () => {
    toast((isRTL ? 'فتح الدردشة مع ' : 'Opening chat with ') + brand?.name, {
      icon: '💬',
      style: { borderRadius: '12px', fontFamily: isRTL ? 'Cairo' : 'Inter' },
    });
  };

  const filteredProducts = brandProducts.filter(p => {
    if (filterCat === 'All') return true;
    if (filterCat === 'On Sale') return p.discount > 0;
    if (filterCat === 'New Arrivals') return p.isNew;
    if (filterCat === 'Customizable') return p.customizable;
    return true;
  });

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

  const tabs = [
    { id: 'Bazaar', label: isRTL ? `البازار (${brandProducts.length})` : `Bazaar (${brandProducts.length})` },
    { id: 'Reviews', label: isRTL ? `التقييمات (${Math.floor(Math.random() * 300 + 100)})` : `Reviews (${Math.floor(Math.random() * 300 + 100)})` },
    { id: 'About', label: isRTL ? 'عن الماركة' : 'About' },
    { id: 'Policies', label: isRTL ? 'السياسات' : 'Policies' }
  ];

  const salesCount = localSales || brand.sales || brand.stats?.totalSales || 0;
  const salesDisplay = salesCount >= 1000 ? `${(salesCount / 1000).toFixed(1)}K` : salesCount;

  return (
    <div className={`min-h-screen bg-brand-cream dark:bg-dark-bg transition-colors duration-200 ${isRTL ? 'text-right' : 'text-left'}`}>
      {/* Breadcrumb */}
      <div className="bg-white dark:bg-dark-surface border-b border-gray-100 dark:border-dark-border">
        <div className="page-container py-3">
          <Link to="/explore" className={`flex items-center gap-1 text-sm text-gray-500 dark:text-dark-muted hover:text-brand-navy dark:hover:text-brand-gold transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}>
            <ArrowLeft size={14} className={isRTL ? 'rotate-180' : ''} />
            {isRTL ? 'العودة للماركات' : 'Back to Brands'}
          </Link>
        </div>
      </div>

      {/* Brand Header */}
      <div className={`bg-gradient-to-r ${brand.coverColor || 'from-gray-100 to-gray-50'} dark:from-dark-surface dark:to-dark-surface border-b border-gray-200 dark:border-dark-border`}>
        <div className="page-container py-8">
          <div className={`flex flex-col md:flex-row gap-6 items-start ${isRTL ? 'md:flex-row-reverse' : ''}`}>
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
              <div className={`flex flex-wrap items-center gap-3 mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <h1 className="text-3xl font-display font-bold text-gray-900 dark:text-dark-text">{brand.name}</h1>
                {brand.verified && (
                  <span className={`badge-verified text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <CheckCircle2 size={13} /> {isRTL ? 'موثق' : 'Verified'}
                  </span>
                )}
              </div>

              <div className={`flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-dark-muted mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}><MapPin size={13} /> {brand.country}</span>
                <span>· {isRTL ? 'عضو منذ' : 'Member since'} {brand.memberSince}</span>
              </div>

              <div className={`flex flex-wrap gap-2 mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                {brand.tags?.map(tag => (
                  <span key={tag} className="px-3 py-1 bg-white/80 dark:bg-dark-bg/80 rounded-full text-xs font-medium text-gray-700 dark:text-dark-text">
                    {tag}
                  </span>
                ))}
              </div>

              <p className="text-gray-600 dark:text-dark-muted max-w-xl leading-relaxed">{isRTL && brand.arDescription ? brand.arDescription : brand.longDescription}</p>
            </div>

            {/* Stats + Actions */}
            <div className={`flex flex-col items-end gap-4 ${isRTL ? 'items-start' : 'items-end'}`}>
              <div className={`grid grid-cols-4 gap-4 text-center ${isRTL ? 'flex-row-reverse' : ''}`}>
                {[
                  { value: brand.productCount, label: isRTL ? 'منتجات' : 'Products' },
                  { value: salesDisplay, label: isRTL ? 'مبيعات' : 'Sales' },
                  { value: `${brand.rating}★`, label: isRTL ? 'تقييم' : 'Rating' },
                  { value: localFollowers >= 1000 ? `${(localFollowers / 1000).toFixed(1)}K` : localFollowers, label: isRTL ? 'متابعون' : 'Followers' },
                ].map(stat => (
                  <div key={stat.label} className="bg-white dark:bg-dark-surface rounded-2xl px-4 py-3 shadow-sm dark:border dark:border-dark-border min-w-[70px]">
                    <div className="text-lg font-bold text-brand-navy dark:text-brand-gold">{stat.value}</div>
                    <div className="text-[10px] text-gray-500 dark:text-dark-muted uppercase font-semibold">{stat.label}</div>
                  </div>
                ))}
              </div>

              <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button
                  type="button"
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 ${isRTL ? 'flex-row-reverse' : ''} ${
                  isFollowing
                    ? 'bg-gray-100 dark:bg-dark-bg text-gray-700 dark:text-dark-text hover:bg-gray-200 dark:hover:bg-dark-surface'
                    : 'bg-brand-navy dark:bg-brand-gold text-white dark:text-brand-navy hover:bg-opacity-90'
                }`}>
                  <Heart size={15} fill={isFollowing ? 'currentColor' : 'none'} className={isFollowing ? 'text-red-500' : ''} />
                  {isFollowing ? (isRTL ? 'متابع' : 'Following') : (isRTL ? '+ متابعة' : '+ Follow')}
                </button>
                <button onClick={handleMessage} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm border-2 border-gray-200 dark:border-dark-border hover:border-brand-navy dark:hover:border-brand-gold text-gray-700 dark:text-dark-text hover:text-brand-navy dark:hover:text-brand-navy transition-all ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <MessageSquare size={15} />
                  {isRTL ? 'رسالة' : 'Message'}
                </button>
                <button className="p-2.5 rounded-xl border-2 border-gray-200 dark:border-dark-border hover:border-brand-navy dark:hover:border-brand-gold text-gray-500 dark:text-dark-muted hover:text-brand-navy dark:hover:text-brand-navy transition-all">
                  <Share2 size={15} />
                </button>
              </div>

              {/* Shipping info */}
              <div className={`flex gap-4 text-xs text-gray-500 dark:text-dark-muted ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}><Truck size={12} /> {isRTL ? 'توصيل:' : 'Shipping:'} {brand.shipping}</span>
                <span className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}><RotateCcw size={12} /> {isRTL ? 'استرجاع:' : 'Returns:'} {brand.returns}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-dark-surface border-b border-gray-200 dark:border-dark-border sticky top-16 z-30">
        <div className="page-container">
          <div className={`flex gap-1 overflow-x-auto ${isRTL ? 'flex-row-reverse' : ''}`}>
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
            {/* Filters bar */}
            <div className={`flex flex-wrap items-center gap-3 mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
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
              <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
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
            <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6 mb-6">
              <div className={`flex items-center gap-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className="text-center">
                  <div className="text-5xl font-display font-bold text-brand-navy dark:text-brand-gold">{brand.rating}</div>
                  <div className="flex justify-center my-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={16} className={i < Math.floor(brand.rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600'} />
                    ))}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-dark-muted">{isRTL ? 'التقييم العام' : 'Overall Rating'}</div>
                </div>
                <div className="flex-1 space-y-2">
                  {[5, 4, 3, 2, 1].map(star => (
                    <div key={star} className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <span className="text-xs text-gray-500 dark:text-dark-muted w-4">{star}</span>
                      <Star size={11} className="text-amber-400 fill-amber-400" />
                      <div className="flex-1 h-2 bg-gray-100 dark:bg-dark-bg rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded-full"
                          style={{ width: star === 5 ? '70%' : star === 4 ? '20%' : star === 3 ? '7%' : '2%' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {[...Array(3)].map((_, i) => (
              <div key={i} className={`bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-5 mb-4 ${isRTL ? 'text-right' : ''}`}>
                <div className={`flex items-center gap-3 mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className="w-9 h-9 rounded-full bg-brand-navy dark:bg-brand-gold flex items-center justify-center">
                    <span className="text-white dark:text-brand-navy text-sm font-bold">{['N', 'A', 'S'][i]}</span>
                  </div>
                  <div className={isRTL ? 'text-right' : ''}>
                    <p className="text-sm font-semibold text-gray-900 dark:text-dark-text">{isRTL ? ['نادية م.', 'أحمد ك.', 'سارة هـ.'][i] : ['Nadia M.', 'Ahmed K.', 'Sara H.'][i]}</p>
                    <div className={`flex ${isRTL ? 'flex-row-reverse' : ''}`}>
                      {[...Array(5)].map((_, j) => (
                        <Star key={j} size={10} className="text-amber-400 fill-amber-400" />
                      ))}
                    </div>
                  </div>
                  <span className={`${isRTL ? 'mr-auto ml-0' : 'ml-auto mr-0'} text-xs text-gray-400 dark:text-dark-muted`}>
                    {isRTL ? 'مارس 2025' : 'Mar 2025'}
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-dark-muted">
                  {isRTL ? ['جودة رائعة! الحرفة مذهلة.', 'هدية مثالية، تغليف جميل وشحن سريع!', 'أحب كل قطعة اشتريتها من هذه الماركة. سأطلب مرة أخرى!'][i] : ['Amazing quality! The craftsmanship is incredible.', 'Perfect gift, beautifully packaged and shipped fast!', 'Love every piece I bought from this brand. Will order again!'][i]}
                </p>
              </div>
            ))}
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

              <div className={`grid grid-cols-2 gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className="bg-brand-cream dark:bg-dark-bg rounded-xl p-4">
                  <p className="text-sm font-semibold text-gray-700 dark:text-dark-text">{isRTL ? 'الموقع' : 'Location'}</p>
                  <p className={`text-gray-600 dark:text-dark-muted text-sm mt-1 flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}><MapPin size={13} /> {brand.country}</p>
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
                  <div key={p.title} className={`flex gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
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
