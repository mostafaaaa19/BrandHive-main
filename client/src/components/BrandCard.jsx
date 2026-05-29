import { Link } from 'react-router-dom';
import { MapPin, Star, Package, Users, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';

export default function BrandCard({ brand, view = 'grid' }) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const gradient = brand.color || 'from-brand-navy to-blue-800';

  if (view === 'list') {
    return (
      <Link 
        to={`/brand/${brand.slug}`} 
        className={`card flex items-center gap-4 p-4 hover:shadow-card-hover dark:hover:border-brand-gold transition-all ${isRTL ? 'flex-row-reverse text-right' : ''}`}
      >
        {/* Avatar */}
        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm border border-white/20`}>
          {brand.logo ? (
            <img src={brand.logo} alt={brand.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-white font-bold text-lg">{brand.name?.[0]}</span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className={`flex items-center gap-2 mb-0.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <h3 className="font-semibold text-gray-900 dark:text-dark-text truncate">{brand.name}</h3>
            {brand.verified && (
              <span className="badge-verified">
                <CheckCircle2 size={10} />
                {isRTL ? 'موثق' : 'Verified'}
              </span>
            )}
          </div>
          <div className={`flex items-center gap-1 text-xs text-gray-500 dark:text-dark-muted mb-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <MapPin size={11} />
            {brand.country}
          </div>
          <p className="text-xs text-gray-500 dark:text-dark-muted line-clamp-1">{brand.description}</p>
        </div>

        {/* Stats */}
        <div className={`hidden sm:flex items-center gap-6 flex-shrink-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="text-center">
            <div className={`flex items-center gap-1 text-amber-500 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Star size={12} fill="currentColor" />
              <span className="text-sm font-bold text-gray-900 dark:text-dark-text">{brand.rating}</span>
            </div>
            <span className="text-xs text-gray-400 dark:text-dark-muted">{isRTL ? 'التقييم' : 'Rating'}</span>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-gray-900 dark:text-dark-text">{brand.followers >= 1000 ? `${(brand.followers/1000).toFixed(1)}K` : brand.followers}</p>
            <span className="text-xs text-gray-400 dark:text-dark-muted">{isRTL ? 'المتابعون' : 'Followers'}</span>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-gray-900 dark:text-dark-text">{brand.productCount}</p>
            <span className="text-xs text-gray-400 dark:text-dark-muted">{isRTL ? 'المنتجات' : 'Products'}</span>
          </div>
        </div>

        <div className={`text-brand-gold font-bold hidden sm:block ${isRTL ? 'rotate-180' : ''}`}>→</div>
      </Link>
    );
  }

  return (
    <Link to={`/brand/${brand.slug}`} className={`card-brand block group ${isRTL ? 'text-right' : ''}`}>
      {/* Cover */}
      <div className={`-mx-6 -mt-6 mb-4 h-16 bg-gray-200 dark:bg-dark-bg rounded-t-2xl relative overflow-hidden`}>
        {brand.coverImage ? (
          <img src={brand.coverImage} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-30`}></div>
        )}
        {brand.featured && (
          <div className={`absolute top-2 ${isRTL ? 'left-2' : 'right-2'} bg-brand-gold text-white text-xs px-2 py-0.5 rounded-full font-semibold`}>
            {isRTL ? 'مميز' : 'Featured'}
          </div>
        )}
      </div>

      {/* Avatar */}
      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-3 -mt-10 relative z-10 shadow-lg border-2 border-white dark:border-dark-surface overflow-hidden ${isRTL ? 'mr-0' : 'ml-0'}`}>
        {brand.logo ? (
          <img src={brand.logo} alt={brand.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-white font-bold text-xl">{brand.name?.[0]}</span>
        )}
      </div>

      {/* Info */}
      <div className={`flex items-start justify-between gap-2 mb-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <h3 className="font-bold text-gray-900 dark:text-dark-text group-hover:text-brand-navy dark:group-hover:text-brand-gold transition-colors">{brand.name}</h3>
        {brand.verified && (
          <span className="badge-verified flex-shrink-0">
            <CheckCircle2 size={10} />
            {isRTL ? 'موثق' : 'Verified'}
          </span>
        )}
      </div>

      <div className={`flex items-center gap-1 text-xs text-gray-500 dark:text-dark-muted mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <MapPin size={11} />
        {brand.country}
      </div>

      <p className="text-xs text-gray-500 dark:text-dark-muted line-clamp-2 mb-3 leading-relaxed">{brand.description}</p>

      {/* Stats */}
      <div className={`flex items-center gap-4 pt-3 border-t border-gray-100 dark:border-dark-border ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Star size={12} className="text-amber-400 fill-amber-400" />
          <span className="text-xs font-bold text-gray-900 dark:text-dark-text">{brand.rating}</span>
        </div>
        <div className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Package size={12} className="text-gray-400 dark:text-dark-muted" />
          <span className="text-xs text-gray-600 dark:text-dark-muted">
            {brand.productCount} {isRTL ? 'منتج' : 'products'}
          </span>
        </div>
        <div className={`flex items-center gap-1 ${isRTL ? 'mr-auto' : 'ml-auto'} ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Users size={12} className="text-gray-400 dark:text-dark-muted" />
          <span className="text-xs text-gray-600 dark:text-dark-muted">
            {brand.followers >= 1000 ? `${(brand.followers/1000).toFixed(1)}K` : brand.followers}
          </span>
        </div>
      </div>
    </Link>
  );
}
