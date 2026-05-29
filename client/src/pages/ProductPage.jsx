import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Star, Heart, ShoppingCart, Share2, Truck, RotateCcw,
  Shield, CheckCircle2, MapPin, Minus, Plus, ChevronRight
} from 'lucide-react';
import ProductCard from '../components/ProductCard';
import { productsAPI, brandsAPI, reviewsAPI } from '../services/api';
import { mapProduct } from '../utils/mappers';
import { useCart, useWishlist } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import toast from 'react-hot-toast';

const CATEGORY_ICONS = {
  Fashion: '👗', Jewelry: '💍', Handmade: '🏺', 'Home Decor': '🏠',
  Organic: '🌿', 'Art & Culture': '🎨', Food: '🍯', Beauty: '💄',
};

export default function ProductPage() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { isAuthenticated } = useAuth();

  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [productReviews, setProductReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSize, setSelectedSize] = useState(0);
  const [selectedColor, setSelectedColor] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('description');
  const [activeImg, setActiveImg] = useState(0);

  // Review form
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await productsAPI.getOne(slug);
        const raw = res.data?.data || res.data;
        if (!raw) throw new Error('Not found');
        
        const mapped = mapProduct(raw);
        setProduct(mapped);

        // Fetch related products by same category
        if (raw.category?._id || raw.category?.id) {
          try {
            const relRes = await productsAPI.getByCategory(raw.category._id || raw.category.id);
            const relRaw = relRes.data?.data || [];
            setRelatedProducts(
              relRaw
                .filter(p => (p.id || p._id) !== (raw.id || raw._id))
                .slice(0, 4)
                .map(mapProduct)
            );
          } catch {
            setRelatedProducts([]);
          }
        }

        // Fetch reviews
        try {
          const revRes = await reviewsAPI.getProductReviews(raw.id || raw._id);
          const revRaw = revRes.data?.data || revRes.data?.reviews || [];
          setProductReviews(Array.isArray(revRaw) ? revRaw : []);
        } catch {
          setProductReviews([]);
        }

      } catch (err) {
        if (err.response?.status === 500) {
          setError(
            isRTL 
              ? 'حدث خطأ في الخادم. يرجى المحاولة لاحقاً'
              : 'Server error. Please try again later.'
          );
        } else if (err.response?.status === 404) {
          setError(
            isRTL 
              ? 'المنتج غير موجود'
              : 'Product not found'
          );
        } else {
          setError(
            isRTL 
              ? 'فشل تحميل المنتج'
              : 'Failed to load product'
          );
        }
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-cream dark:bg-dark-bg">
        <div className="max-w-7xl mx-auto px-4 py-8 animate-pulse">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="bg-gray-200 dark:bg-dark-surface rounded-3xl h-96" />
            <div className="space-y-4">
              <div className="h-8 bg-gray-200 dark:bg-dark-surface rounded-xl w-3/4" />
              <div className="h-6 bg-gray-200 dark:bg-dark-surface rounded-xl w-1/2" />
              <div className="h-10 bg-gray-200 dark:bg-dark-surface rounded-xl w-1/3" />
              <div className="h-24 bg-gray-200 dark:bg-dark-surface rounded-xl" />
              <div className="h-12 bg-gray-200 dark:bg-dark-surface rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-brand-cream dark:bg-dark-bg flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-2xl font-display font-bold text-brand-navy dark:text-white mb-2">
            {error}
          </h2>
          <p className="text-gray-500 dark:text-dark-muted mb-6">
            {isRTL 
              ? 'تحقق من الرابط أو ارجع للمنتجات'
              : 'Check the URL or go back to products'}
          </p>
          <div className="flex gap-3 justify-center">
            <button 
              onClick={() => navigate(-1)}
              className="btn-outline">
              {isRTL ? '→ رجوع' : '← Back'}
            </button>
            <Link to="/products" className="btn-primary">
              {isRTL ? 'كل المنتجات' : 'All Products'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const wishlisted = isInWishlist(product.id);
  const icon = CATEGORY_ICONS[product.category] || '🛍️';
  const images = product.images?.length > 0 
    ? product.images 
    : [product.image].filter(Boolean);

  const handleAddToCart = () => {
    addToCart(product, quantity, {
      size: product.sizes?.[selectedSize],
      color: product.colors?.[selectedColor],
    });
    toast.success(isRTL ? 'تمت الإضافة للسلة!' : 'Added to cart!', { 
      icon: '🛒', 
      style: { borderRadius: '12px', fontFamily: isRTL ? 'Cairo' : 'Inter' } 
    });
  };

  const handleBuyNow = () => {
    addToCart(product, quantity, {
      size: product.sizes?.[selectedSize],
      color: product.colors?.[selectedColor],
    });
    navigate('/cart');
  };

  const handleWishlist = () => {
    toggleWishlist(product);
    const msg = isRTL 
      ? (wishlisted ? 'تمت الإزالة من المفضلة' : 'تمت الإضافة للمفضلة!')
      : (wishlisted ? 'Removed from wishlist' : 'Added to wishlist!');
    toast.success(msg, {
      icon: wishlisted ? '💔' : '❤️',
      style: { borderRadius: '12px', fontFamily: isRTL ? 'Cairo' : 'Inter' },
    });
  };

  const submitReview = async () => {
    if (!isAuthenticated) {
      toast.error(isRTL ? 'يرجى تسجيل الدخول لإضافة تقييم' : 'Please login to submit a review');
      return;
    }
    if (!reviewForm.comment.trim()) {
      toast.error(isRTL ? 'يرجى كتابة تعليق' : 'Please write a comment');
      return;
    }
    setReviewLoading(true);
    try {
      await reviewsAPI.addReview({
        productId: product.id,
        rating: reviewForm.rating,
        comment: reviewForm.comment,
      });
      toast.success(isRTL ? 'تم إضافة تقييمك بنجاح ✅' : 'Review submitted successfully ✅');
      setReviewSubmitted(true);
      setReviewForm({ rating: 5, comment: '' });
      // Refresh reviews list
      const revRes = await reviewsAPI.getProductReviews(product.id);
      const revRaw = revRes.data?.data || revRes.data?.reviews || [];
      setProductReviews(Array.isArray(revRaw) ? revRaw : []);
    } catch (err) {
      toast.error(err.response?.data?.message || (isRTL ? 'فشل إرسال التقييم' : 'Failed to submit review'));
    } finally {
      setReviewLoading(false);
    }
  };

  return (
    <div className={`min-h-screen bg-brand-cream dark:bg-dark-bg transition-colors duration-200 ${isRTL ? 'text-right' : 'text-left'}`}>
      {/* Breadcrumb */}
      <div className="bg-white dark:bg-dark-surface border-b border-gray-100 dark:border-dark-border">
        <div className={`page-container py-3 text-sm text-gray-500 dark:text-dark-muted flex items-center gap-1 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Link to="/" className="hover:text-brand-navy dark:hover:text-brand-gold">{isRTL ? 'الرئيسية' : 'Home'}</Link>
          <ChevronRight size={13} className={isRTL ? 'rotate-180' : ''} />
          <Link to={`/products?category=${product.category.toLowerCase().replace(' ', '-')}`} className="hover:text-brand-navy dark:hover:text-brand-gold capitalize">
            {isRTL ? product.category : product.category}
          </Link>
          <ChevronRight size={13} className={isRTL ? 'rotate-180' : ''} />
          <span className="text-gray-900 dark:text-dark-text font-medium truncate max-w-xs">{product.name}</span>
        </div>
      </div>

      <div className="page-container py-8">
        <div className={`grid lg:grid-cols-2 gap-10 xl:gap-14 mb-12 ${isRTL ? 'lg:flex-row-reverse' : ''}`}>
          {/* Image Gallery */}
          <div className={isRTL ? 'order-2 lg:order-1' : ''}>
            {/* Main image */}
            <div className={`aspect-square rounded-3xl bg-gradient-to-br ${
              product.category === 'Jewelry' ? 'from-amber-100 to-yellow-200 dark:from-amber-900/40 dark:to-yellow-800/40' :
              product.category === 'Fashion' ? 'from-pink-100 to-rose-200 dark:from-pink-900/40 dark:to-rose-800/40' :
              product.category === 'Organic' ? 'from-green-100 to-emerald-200 dark:from-green-900/40 dark:to-emerald-800/40' :
              'from-orange-100 to-amber-200 dark:from-orange-900/40 dark:to-amber-800/40'
            } flex items-center justify-center mb-3 relative overflow-hidden shadow-sm border border-gray-100 dark:border-dark-border`}>
              {images.length > 0 ? (
                <img
                  src={images[activeImg]}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-9xl">{icon}</span>
              )}
              {product.discount > 0 && (
                <div className={`absolute top-4 ${isRTL ? 'right-4' : 'left-4'} bg-red-500 text-white px-3 py-1 rounded-full font-bold text-sm`}>
                  -{product.discount}%
                </div>
              )}
              <button
                onClick={handleWishlist}
                className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'} p-3 rounded-full shadow-lg transition-all ${
                  wishlisted ? 'bg-red-500 text-white' : 'bg-white dark:bg-dark-surface text-gray-500 dark:text-dark-muted hover:text-red-500'
                }`}
              >
                <Heart size={20} fill={wishlisted ? 'currentColor' : 'none'} />
              </button>
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className={`flex gap-2 overflow-x-auto pb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(i)}
                    className={`w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all ${
                      activeImg === i
                        ? 'border-brand-navy dark:border-brand-gold ring-2 ring-brand-navy/10'
                        : 'border-transparent bg-white dark:bg-dark-surface'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className={`flex flex-col ${isRTL ? 'order-1 lg:order-2' : ''}`}>
            {/* Brand */}
            <Link to={`/brand/${product.brandSlug}`} className={`flex items-center gap-2 mb-3 group ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className="w-8 h-8 rounded-xl bg-brand-navy dark:bg-brand-gold flex items-center justify-center">
                <span className="text-white dark:text-brand-navy text-xs font-bold">{product.brandName[0]}</span>
              </div>
              <span className="font-semibold text-brand-gold group-hover:underline">{product.brandName}</span>
              {product.verified && <CheckCircle2 size={14} className="text-emerald-500" />}
              <span className="text-gray-400 dark:text-dark-muted text-sm">· {isRTL ? 'زيارة البازار ←' : 'Visit Bazaar →'}</span>
            </Link>

            {/* Name */}
            <h1 className="text-3xl md:text-4xl font-display font-bold text-gray-900 dark:text-dark-text mb-3 leading-tight">
              {product.name}
            </h1>

            {/* Rating */}
            <div className={`flex items-center gap-3 mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className={`flex ${isRTL ? 'flex-row-reverse' : ''}`}>
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={16} className={i < Math.floor(product.rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600'} />
                ))}
              </div>
              <span className="font-bold text-gray-900 dark:text-dark-text">{product.rating}</span>
              <span className="text-gray-500 dark:text-dark-muted text-sm">· {product.reviews} {isRTL ? 'تقييم' : 'reviews'}</span>
              <span className="text-gray-500 dark:text-dark-muted text-sm">· {product.sold} {isRTL ? 'تم البيع' : 'sold'}</span>
            </div>

            {/* Price */}
            <div className={`flex items-baseline gap-3 mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <span className="text-3xl font-display font-bold text-brand-navy dark:text-brand-gold">
                {product.price.toLocaleString()} {t('common.egp')}
              </span>
              {product.originalPrice && (
                <>
                  <span className="text-xl text-gray-400 dark:text-dark-muted line-through">{product.originalPrice.toLocaleString()}</span>
                  <span className="text-emerald-600 dark:text-emerald-500 font-semibold">
                    {isRTL ? `وفر ${Math.round((1 - product.price/product.originalPrice) * 100)}%` : `Save ${Math.round((1 - product.price/product.originalPrice) * 100)}%`}
                  </span>
                </>
              )}
            </div>

            {/* Sizes */}
            {product.sizes.length > 0 && (
              <div className="mb-5">
                <p className="text-sm font-semibold text-gray-700 dark:text-dark-text mb-2">{isRTL ? 'المقاس' : 'Size'}</p>
                <div className={`flex flex-wrap gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  {product.sizes.map((size, i) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(i)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                        selectedSize === i
                          ? 'border-brand-navy dark:border-brand-gold bg-brand-navy dark:bg-brand-gold text-white dark:text-brand-navy'
                          : 'border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface hover:border-brand-navy dark:hover:border-brand-gold text-gray-700 dark:text-dark-text'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Colors */}
            {product.colors.length > 0 && (
              <div className="mb-5">
                <p className={`text-sm font-semibold text-gray-700 dark:text-dark-text mb-2 ${isRTL ? 'text-right' : ''}`}>
                  {isRTL ? 'اللون:' : 'Color:'} <span className="font-normal text-gray-600 dark:text-dark-muted">{product.colors[selectedColor]}</span>
                </p>
                <div className={`flex flex-wrap gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  {product.colors.map((color, i) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(i)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                        selectedColor === i
                          ? 'border-brand-navy dark:border-brand-gold bg-brand-navy/10 dark:bg-brand-gold/10 text-brand-navy dark:text-brand-gold'
                          : 'border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface hover:border-gray-300 dark:hover:border-dark-muted text-gray-700 dark:text-dark-text'
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="mb-6">
              <p className="text-sm font-semibold text-gray-700 dark:text-dark-text mb-2">{isRTL ? 'الكمية' : 'Quantity'}</p>
              <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={`flex items-center border-2 border-gray-200 dark:border-dark-border rounded-xl overflow-hidden ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-4 py-2.5 text-gray-600 dark:text-dark-muted hover:bg-gray-50 dark:hover:bg-dark-bg font-bold transition-colors"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="px-5 py-2.5 font-bold text-gray-900 dark:text-dark-text text-lg border-x-2 border-gray-200 dark:border-dark-border">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(product.inStock, quantity + 1))}
                    className="px-4 py-2.5 text-gray-600 dark:text-dark-muted hover:bg-gray-50 dark:hover:bg-dark-bg font-bold transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <span className="text-sm text-orange-600 dark:text-orange-500 font-medium">
                  {product.inStock <= 10 && (isRTL ? `بقي ${product.inStock} فقط في المخزن` : `Only ${product.inStock} left in stock`)}
                </span>
              </div>
            </div>

            {/* CTAs */}
            <div className={`flex gap-3 mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button onClick={handleAddToCart} className={`flex-1 btn-outline flex items-center justify-center gap-2 py-3.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <ShoppingCart size={18} />
                {t('products.addToCart')}
              </button>
              <button onClick={handleBuyNow} className="flex-1 btn-primary flex items-center justify-center gap-2 py-3.5 bg-brand-gold hover:opacity-90 shadow-gold">
                {isRTL ? 'شراء الآن' : 'Buy Now'}
              </button>
            </div>

            {/* Trust badges */}
            <div className={`grid grid-cols-3 gap-3 mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
              {[
                { icon: Truck, label: isRTL ? 'توصيل مجاني' : 'Free delivery', sub: isRTL ? 'لطلبات +500 ج.م' : '500+ EGP', color: 'text-emerald-500 dark:text-emerald-400' },
                { icon: RotateCcw, label: isRTL ? 'استرجاع 14 يوم' : '14-day returns', sub: isRTL ? 'سهولة الاسترجاع' : 'Easy returns', color: 'text-blue-500 dark:text-blue-400' },
                { icon: Shield, label: isRTL ? 'دفع آمن' : 'Secure payment', sub: '256-bit SSL', color: 'text-purple-500 dark:text-purple-400' },
              ].map(({ icon: Icon, label, sub, color }) => (
                <div key={label} className="flex flex-col items-center text-center p-3 bg-white dark:bg-dark-surface rounded-xl shadow-sm dark:border dark:border-dark-border">
                  <Icon size={18} className={color} />
                  <span className="text-xs font-semibold text-gray-700 dark:text-dark-text mt-1">{label}</span>
                  <span className="text-xs text-gray-400 dark:text-dark-muted">{sub}</span>
                </div>
              ))}
            </div>

            {/* Seller info */}
            <Link to={`/brand/${product.brandSlug}`} className={`flex items-center gap-3 p-4 bg-white dark:bg-dark-surface rounded-2xl shadow-sm dark:border dark:border-dark-border hover:shadow-card transition-shadow ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className="w-12 h-12 rounded-2xl bg-brand-navy dark:bg-brand-gold flex items-center justify-center flex-shrink-0">
                <span className="text-white dark:text-brand-navy font-bold">{product.brandName[0]}</span>
              </div>
              <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : ''}`}>
                <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="font-semibold text-gray-900 dark:text-dark-text">{product.brandName}</span>
                  {product.verified && <CheckCircle2 size={13} className="text-emerald-500" />}
                </div>
                <div className={`flex items-center gap-1 text-xs text-gray-500 dark:text-dark-muted ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <MapPin size={11} />
                  <span>{product.governorate}</span>
                  <span>·</span>
                  <Star size={11} className="text-amber-400 fill-amber-400" />
                  <span>4.9</span>
                  <span>·</span>
                  <span>{isRTL ? '840 مبيعات' : '840 sales'}</span>
                </div>
              </div>
              <span className="text-brand-gold font-medium text-sm">{isRTL ? 'زيارة البازار ←' : 'Visit Bazaar →'}</span>
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border overflow-hidden mb-10">
          <div className={`flex border-b border-gray-100 dark:border-dark-border ${isRTL ? 'flex-row-reverse' : ''}`}>
            {[
              { id: 'description', label: isRTL ? 'الوصف' : 'Description' },
              { id: 'reviews', label: isRTL ? `التقييمات (${product.reviews})` : `Reviews (${product.reviews})` },
              { id: 'shipping', label: isRTL ? 'الشحن' : 'Shipping' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab.id ? 'border-brand-navy dark:border-brand-gold text-brand-navy dark:text-brand-gold' : 'border-transparent text-gray-500 dark:text-dark-muted hover:text-gray-900 dark:hover:text-dark-text'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className={`p-6 ${isRTL ? 'text-right' : ''}`}>
            {activeTab === 'description' && (
              <div>
                <p className="text-gray-700 dark:text-dark-muted leading-relaxed">{product.description}</p>
                <div className={`mt-4 flex flex-wrap gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  {product.tags.map(tag => (
                    <span key={tag} className="px-3 py-1 bg-brand-cream dark:bg-dark-bg text-brand-navy dark:text-brand-gold text-sm rounded-full font-medium">#{tag}</span>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div>
                <div className={`flex items-center gap-4 mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-gray-900 dark:text-dark-text">{product.rating}</div>
                    <div className="flex justify-center my-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={14} className={i < Math.floor(product.rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600'} />
                      ))}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-dark-muted">{product.reviews} {isRTL ? 'تقييمات' : 'reviews'}</div>
                  </div>
                </div>

                <div className="space-y-4">
                  {productReviews.length > 0 ? (
                    productReviews.map((review, i) => (
                      <div key={review._id || i} className="border-b dark:border-dark-border pb-4">
                        <div className={`flex items-center gap-3 mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <div className="w-8 h-8 rounded-full bg-brand-gold flex items-center justify-center text-white text-sm font-bold">
                            {review.user?.name?.[0] || 'U'}
                          </div>
                          <div className={isRTL ? 'text-right' : ''}>
                            <p className="text-sm font-semibold text-gray-900 dark:text-dark-text">{review.user?.name || 'Customer'}</p>
                            <div className={`flex ${isRTL ? 'flex-row-reverse' : ''}`}>
                              {[...Array(5)].map((_, s) => (
                                <Star key={s} size={10} className={s < review.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600'} />
                              ))}
                            </div>
                          </div>
                          <span className={`${isRTL ? 'mr-auto ml-0' : 'ml-auto mr-0'} text-xs text-gray-400 dark:text-dark-muted`}>
                            {review.createdAt ? new Date(review.createdAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US') : ''}
                          </span>
                        </div>
                        <p className={`text-sm text-gray-700 dark:text-dark-muted ${isRTL ? 'mr-11' : 'ml-11'}`}>{review.comment}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 dark:text-dark-muted text-sm text-center py-8">
                      {isRTL ? 'لا توجد مراجعات بعد. كن أول من يكتب مراجعة!' : 'No reviews yet. Be the first to review!'}
                    </p>
                  )}
                </div>

                {/* Write Review Form */}
                {isAuthenticated && !reviewSubmitted && (
                  <div className="mt-6 pt-6 border-t border-gray-100 dark:border-dark-border">
                    <h4 className={`font-semibold text-gray-900 dark:text-dark-text mb-3 ${isRTL ? 'text-right' : ''}`}>
                      {isRTL ? 'اكتب تقييمك' : 'Write a Review'}
                    </h4>
                    {/* Star selector */}
                    <div className={`flex gap-1 mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      {[1,2,3,4,5].map(s => (
                        <button key={s} onClick={() => setReviewForm(p => ({ ...p, rating: s }))} type="button">
                          <Star size={24} className={s <= reviewForm.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600'} />
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={reviewForm.comment}
                      onChange={e => setReviewForm(p => ({ ...p, comment: e.target.value }))}
                      placeholder={isRTL ? 'شارك تجربتك مع هذا المنتج...' : 'Share your experience with this product...'}
                      rows={3}
                      className={`input-field resize-none mb-3 ${isRTL ? 'text-right' : ''}`}
                    />
                    <button
                      onClick={submitReview}
                      disabled={reviewLoading || !reviewForm.comment.trim()}
                      className="btn-primary disabled:opacity-50 flex items-center gap-2"
                    >
                      {reviewLoading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : null}
                      {isRTL ? 'إرسال التقييم' : 'Submit Review'}
                    </button>
                  </div>
                )}
                {reviewSubmitted && (
                  <p className="mt-4 text-sm text-emerald-600 dark:text-emerald-400 font-medium text-center">
                    {isRTL ? 'شكراً! تم إرسال تقييمك.' : 'Thanks! Your review has been submitted.'}
                  </p>
                )}
              </div>
            )}

            {activeTab === 'shipping' && (
              <div className="space-y-4">
                {[
                  { title: isRTL ? 'التوصيل' : 'Delivery', icon: '🚚', text: isRTL ? 'يتم الشحن خلال 3-5 أيام عمل. توصيل مجاني للطلبات فوق 500 ج.م.' : 'Ships within 3–5 business days. Free delivery on orders above 500 EGP.' },
                  { title: isRTL ? 'الاسترجاع' : 'Returns', icon: '↩️', text: isRTL ? 'سياسة استرجاع لمدة 14 يوماً. يجب أن تكون المنتجات غير مستخدمة وفي تغليفها الأصلي.' : '14-day return policy. Items must be unused and in original packaging.' },
                  { title: isRTL ? 'الدفع' : 'Payment', icon: '💳', text: isRTL ? 'نقبل البطاقات الائتمانية، فودافون كاش، فوري، والدفع عند الاستلام.' : 'Credit/debit cards, Vodafone Cash, Fawry, and Cash on Delivery accepted.' },
                ].map(item => (
                  <div key={item.title} className={`flex gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <span className="text-2xl">{item.icon}</span>
                    <div className={isRTL ? 'text-right' : 'text-left'}>
                      <h4 className="font-semibold text-gray-900 dark:text-dark-text mb-1">{item.title}</h4>
                      <p className="text-sm text-gray-600 dark:text-dark-muted">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div>
            <div className={`flex items-center justify-between mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <h2 className="text-2xl font-display font-bold text-gray-900 dark:text-dark-text">
                {isRTL ? 'قد يعجبك أيضاً' : 'You May Also Like'}
              </h2>
              <Link to={`/products?category=${product.category.toLowerCase()}`} className={`btn-ghost text-sm flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                {isRTL ? 'عرض الكل' : 'See all'} <ChevronRight size={15} className={isRTL ? 'rotate-180' : ''} />
              </Link>
            </div>
            <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
              {relatedProducts.map(p => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
