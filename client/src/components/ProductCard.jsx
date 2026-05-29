import { Link } from 'react-router-dom';
import { Heart, Star, ShoppingCart, MapPin } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/CartContext';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import toast from 'react-hot-toast';

const CATEGORY_COLORS = {
  fashion: 'from-pink-200 to-rose-200',
  jewelry: 'from-amber-200 to-yellow-200',
  handmade: 'from-orange-200 to-amber-200',
  'home-decor': 'from-teal-200 to-cyan-200',
  organic: 'from-green-200 to-emerald-200',
  'art & culture': 'from-purple-200 to-violet-200',
  art: 'from-purple-200 to-violet-200',
  food: 'from-yellow-200 to-orange-200',
  beauty: 'from-fuchsia-200 to-pink-200',
  default: 'from-gray-100 to-gray-200',
};

const CATEGORY_ICONS = {
  fashion: '👗',
  jewelry: '💍',
  handmade: '🏺',
  'home-decor': '🏠',
  organic: '🌿',
  'art & culture': '🎨',
  art: '🎨',
  food: '🍯',
  beauty: '💄',
  default: '🛍️',
};

export default function ProductCard({ product, size = 'md' }) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const wishlisted = isInWishlist(product.id);
  const catKey = product.category?.toLowerCase().replace(/\s+/g, '-');
  const bgGradient = CATEGORY_COLORS[catKey] || CATEGORY_COLORS.default;
  const icon = CATEGORY_ICONS[catKey] || CATEGORY_ICONS.default;
  const productPath = `/product/${encodeURIComponent(product.slug || product.id)}`;

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product, 1, { size: product.sizes?.[0], color: product.colors?.[0] });
    toast.success(isRTL ? `تم إضافة ${product.name} إلى السلة!` : `${product.name} added to cart!`, {
      icon: '🛒',
      style: { borderRadius: '12px', fontFamily: isRTL ? 'Cairo' : 'Inter' },
    });
  };

  const handleWishlist = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product);
    const msg = wishlisted 
      ? (isRTL ? 'تمت الإزالة من المفضلة' : 'Removed from wishlist')
      : (isRTL ? 'تمت الإضافة إلى المفضلة!' : 'Added to wishlist!');
    toast.success(msg, {
      icon: wishlisted ? '💔' : '❤️',
      style: { borderRadius: '12px', fontFamily: isRTL ? 'Cairo' : 'Inter' },
    });
  };

  const isSmall = size === 'sm';

  return (
    <Link to={productPath} className="card-product group flex h-full flex-col">
      {/* Image */}
      <div className={`relative ${isSmall ? 'h-40' : 'h-44 sm:h-52 md:h-60'} bg-gradient-to-br ${bgGradient} flex items-center justify-center overflow-hidden`}>
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-contain bg-white/40 dark:bg-white/5 p-2"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
        ) : null}
        <div 
          className={`${product.image ? 'hidden' : 'flex'} 
            w-full h-full items-center justify-center`}
        >
          <span className={`${isSmall ? 'text-4xl' : 'text-6xl'} opacity-60`}>{icon}</span>
        </div>

        {/* Badges */}
        <div className={`absolute top-2 ${isRTL ? 'right-2' : 'left-2'} flex flex-col gap-1`}>
          {product.discount > 0 && (
            <span className="badge-sale">-{product.discount}%</span>
          )}
          {product.isNew && (
            <span className="badge-new">{isRTL ? 'جديد' : 'NEW'}</span>
          )}
          {product.isFeatured && !product.discount && !product.isNew && (
            <span className="badge-featured">★</span>
          )}
        </div>

        {/* Wishlist Button */}
        <button
          onClick={handleWishlist}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          className={`absolute top-2 ${isRTL ? 'left-2' : 'right-2'} z-20 flex h-9 w-9 items-center justify-center rounded-full transition-all ${
            wishlisted
              ? 'bg-red-500 text-white shadow-md scale-110'
              : 'bg-white text-gray-500 hover:text-red-500 shadow-md'
          }`}
        >
          <Heart size={17} fill={wishlisted ? 'currentColor' : 'none'} />
        </button>

        {/* Quick Add on Hover */}
        <div className="absolute bottom-0 left-0 right-0 p-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity sm:translate-y-2 sm:group-hover:translate-y-0">
          <button
            onClick={handleAddToCart}
            className="w-full flex items-center justify-center gap-2 py-2 bg-brand-navy/95 text-white text-xs font-semibold rounded-xl hover:bg-opacity-90 transition-colors dark:bg-brand-gold dark:text-brand-navy"
          >
            <ShoppingCart size={12} />
            {t('products.addToCart')}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className={`flex flex-1 flex-col p-3 ${isSmall ? '' : 'sm:p-4'} ${isRTL ? 'text-right' : 'text-left'}`}>
        {/* Brand */}
        <div className={`flex items-center gap-1 mb-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <span className={`text-brand-gold text-xs font-semibold truncate`}>{product.brandName}</span>
          {product.verified && <span className="text-emerald-500 text-xs">✓</span>}
        </div>

        {/* Name */}
        <h3 className={`font-semibold text-gray-900 dark:text-dark-text line-clamp-2 leading-tight mb-2 min-h-[2.25rem] ${isSmall ? 'text-xs' : 'text-sm'}`}>
          {product.name}
        </h3>

        {/* Rating */}
        <div className={`flex items-center gap-1 mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="flex">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                size={10}
                className={i < Math.floor(product.rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600'}
              />
            ))}
          </div>
          <span className="text-xs text-gray-500 dark:text-dark-muted">({product.reviews})</span>
        </div>

        {/* Price */}
        <div className={`mt-auto flex items-end justify-between gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className={isRTL ? 'text-right' : 'text-left'}>
            <span className={`block font-bold text-brand-navy dark:text-brand-gold ${isSmall ? 'text-sm' : 'text-base sm:text-lg'}`}>
              {product.price.toLocaleString()}
            </span>
            <span className="block text-xs font-semibold text-brand-navy/80 dark:text-brand-gold/80">{t('common.egp')}</span>
            {product.originalPrice && (
              <span className={`text-xs text-gray-400 dark:text-dark-muted line-through ${isRTL ? 'mr-1' : 'ml-1'}`}>
                {product.originalPrice.toLocaleString()}
              </span>
            )}
          </div>
          {product.freeShipping && (
            <span className="shrink-0 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              {isRTL ? 'شحن مجاني' : 'Free ship'}
            </span>
          )}
        </div>

        {/* Governorate */}
        {!isSmall && (
          <div className={`flex items-center gap-1 mt-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <MapPin size={10} className="text-gray-400 dark:text-dark-muted" />
            <span className="text-xs text-gray-400 dark:text-dark-muted">{product.governorate}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
