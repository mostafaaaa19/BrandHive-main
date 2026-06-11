import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, Store, Star, Package, MapPin, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import { brandsAPI, sellerAPI } from '../services/api';
import { mapBrand } from '../utils/mappers';

export default function BazaarPage() {
  const { isRTL } = useLanguage();
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchBazaars = useCallback(async (searchQuery = '') => {
    setLoading(true);
    try {
      let res;
      if (searchQuery.trim()) {
        res = await sellerAPI.searchBazaar(searchQuery);
      } else {
        res = await brandsAPI.getAll({ limit: 50 });
      }
      const raw = res.data?.data || res.data?.brands || res.data || [];
      setBrands(Array.isArray(raw) ? raw.map(mapBrand) : []);
    } catch {
      setBrands([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBazaars(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search, fetchBazaars]);

  return (
    <div className="min-h-screen bg-brand-cream dark:bg-dark-bg">
      {/* Hero */}
      <div className="bg-brand-navy py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="text-5xl mb-4">🏪</div>
            <h1 className="text-4xl font-display font-bold text-white mb-3">
              {isRTL ? 'البازارات المصرية' : 'Egyptian Bazaars'}
            </h1>
            <p className="text-gray-300 mb-8">
              {isRTL
                ? 'اكتشف متاجر البائعين المصريين الموثوقين'
                : 'Discover trusted Egyptian seller stores'}
            </p>
            <div className="relative max-w-lg mx-auto">
              <Search
                className={`absolute top-1/2 -translate-y-1/2 text-gray-400 ${
                  isRTL ? 'right-4' : 'left-4'
                }`}
                size={18}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  isRTL ? 'ابحث عن متجر...' : 'Search for a store...'
                }
                className={`w-full py-3 rounded-2xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-brand-gold ${
                  isRTL ? 'pr-12 pl-4 text-right' : 'pl-12 pr-4'
                }`}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className={`absolute top-1/2 -translate-y-1/2 text-gray-400 ${
                    isRTL ? 'left-4' : 'right-4'
                  }`}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="bg-white dark:bg-dark-surface border-b border-gray-100 dark:border-dark-border py-3 px-4">
        <div className="max-w-7xl mx-auto text-sm text-gray-500 dark:text-dark-muted">
          {isRTL ? `${brands.length} متجر` : `${brands.length} stores`}
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-dark-surface rounded-3xl overflow-hidden animate-pulse"
              >
                <div className="h-32 bg-gray-100 dark:bg-dark-border" />
                <div className="p-5 space-y-3">
                  <div className="h-5 bg-gray-100 dark:bg-dark-border rounded-xl w-2/3" />
                  <div className="h-4 bg-gray-100 dark:bg-dark-border rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : brands.length === 0 ? (
          <div className="text-center py-16">
            <Store size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 dark:text-dark-muted">
              {isRTL ? 'لا توجد نتائج' : 'No stores found'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {brands.map((brand, i) => (
              <motion.div
                key={brand.id || i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-white dark:bg-dark-surface rounded-3xl overflow-hidden shadow-card dark:shadow-none dark:border dark:border-dark-border hover:shadow-card-hover transition-all group"
              >
                {/* Cover */}
                <div className="h-32 bg-gradient-to-br from-brand-navy to-brand-dark relative">
                  {brand.coverImage ? (
                    <img
                      src={brand.coverImage}
                      alt={brand.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Store size={32} className="text-white/20" />
                    </div>
                  )}
                  {/* Logo */}
                  <div className="absolute bottom-0 left-4 translate-y-1/2 w-14 h-14 rounded-2xl bg-white dark:bg-dark-surface shadow-card overflow-hidden border-2 border-white dark:border-dark-border">
                    {brand.logo ? (
                      <img
                        src={brand.logo}
                        alt={brand.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-brand-gold/10 flex items-center justify-center font-bold text-brand-gold text-xl">
                        {(brand.name || 'B')[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className={`pt-10 p-5 ${isRTL ? 'text-right' : ''}`}>
                  <h3 className="font-display font-bold text-gray-900 dark:text-dark-text text-lg truncate">
                    {brand.name}
                  </h3>
                  {brand.description && (
                    <p className="text-sm text-gray-500 dark:text-dark-muted mt-1 line-clamp-2">
                      {brand.description}
                    </p>
                  )}
                  <div
                    className={`flex items-center gap-3 mt-3 text-xs text-gray-400 ${
                      isRTL ? 'flex-row-reverse' : ''
                    }`}
                  >
                    {brand.rating > 0 && (
                      <span className="flex items-center gap-1">
                        <Star
                          size={11}
                          className="text-amber-400 fill-amber-400"
                        />
                        {brand.rating.toFixed(1)}
                      </span>
                    )}
                    {brand.productCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Package size={11} />
                        {brand.productCount}
                      </span>
                    )}
                    {brand.location && brand.location !== 'Egypt' && (
                      <span className="flex items-center gap-1">
                        <MapPin size={11} />
                        {brand.location}
                      </span>
                    )}
                  </div>
                  <Link
                    to={`/brand/${brand.slug}`}
                    className="mt-4 w-full block text-center btn-outline text-sm py-2 hover:bg-brand-navy hover:text-white dark:hover:bg-brand-gold dark:hover:text-brand-navy transition-colors"
                  >
                    {isRTL ? 'زيارة المتجر' : 'Visit Store'}
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
