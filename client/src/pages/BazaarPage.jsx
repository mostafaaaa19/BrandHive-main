import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, Store, Star, Package, MapPin, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import { fetchPublicBazaars } from '../services/api';

export default function BazaarPage() {
  const { isRTL } = useLanguage();
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchBazaars = useCallback(async (searchQuery = '') => {
    setLoading(true);
    try {
      const list = await fetchPublicBazaars(searchQuery);
      setBrands(Array.isArray(list) ? list : []);
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
                className="absolute top-1/2 -translate-y-1/2 text-gray-400 start-4"
                size={18}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  isRTL ? 'ابحث عن بازار أو ماركة...' : 'Search bazaars or brands...'
                }
                className="w-full ps-12 pe-10 py-3 rounded-2xl bg-white/10 border border-white/20 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-gold"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute top-1/2 -translate-y-1/2 end-4 text-gray-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Grid */}
      <div className="page-container py-12">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-48 bg-gray-100 dark:bg-dark-surface rounded-2xl animate-pulse"
              />
            ))}
          </div>
        ) : brands.length === 0 ? (
          <div className="text-center py-16">
            <Store className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-500 dark:text-dark-muted">
              {isRTL ? 'لا توجد نتائج' : 'No bazaars found'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {brands.map((brand, i) => (
              <motion.div
                key={brand.id || brand._id || i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  to={`/brand/${brand.slug || brand.id || brand._id}`}
                  className="block bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border overflow-hidden hover:shadow-card-hover transition-all group"
                >
                  <div className="h-32 bg-gradient-to-br from-brand-navy to-brand-navy/80 flex items-center justify-center">
                    {brand.logo ? (
                      <img
                        src={brand.logo}
                        alt={brand.name}
                        className="w-16 h-16 rounded-xl object-cover"
                      />
                    ) : (
                      <span className="text-4xl">🏪</span>
                    )}
                  </div>
                  <div className={`p-5 ${isRTL ? 'text-right' : ''}`}>
                    <h3 className="font-display font-bold text-lg text-gray-900 dark:text-dark-text group-hover:text-brand-gold transition-colors">
                      {brand.name}
                    </h3>
                    {brand.description && (
                      <p className="text-sm text-gray-500 dark:text-dark-muted mt-1 line-clamp-2">
                        {brand.description}
                      </p>
                    )}
                    <div
                      className={`flex items-center gap-4 mt-3 text-xs text-gray-400 dark:text-dark-muted flex-wrap`}
                    >
                      {(brand.governorate || brand.location) && (
                        <span className="flex items-center gap-1">
                          <MapPin size={12} />
                          {brand.governorate || brand.location}
                        </span>
                      )}
                      {brand.rating > 0 && (
                        <span className="flex items-center gap-1">
                          <Star size={12} className="text-brand-gold fill-brand-gold" />
                          {Number(brand.rating).toFixed(1)}
                        </span>
                      )}
                      {brand.productCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Package size={12} />
                          {brand.productCount}{' '}
                          {isRTL ? 'منتج' : 'products'}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
