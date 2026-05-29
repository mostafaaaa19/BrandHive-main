import { useLanguage } from '../context/LanguageContext';
import { Link } from 'react-router-dom';
import { Store } from 'lucide-react';

export default function BazaarPage() {
  const { isRTL } = useLanguage();
  return (
    <div className="min-h-screen bg-brand-cream 
      dark:bg-dark-bg flex items-center justify-center">
      <div className="text-center p-8">
        <Store size={64} className="mx-auto 
          text-brand-gold mb-4" />
        <h1 className="text-3xl font-display font-bold 
          text-brand-navy dark:text-white mb-2">
          {isRTL ? 'البازارات' : 'Bazaars'}
        </h1>
        <p className="text-gray-500 dark:text-dark-muted mb-6">
          {isRTL 
            ? 'استكشف متاجر البائعين المصريين'
            : 'Explore Egyptian seller stores'}
        </p>
        <Link to="/brands" className="btn-primary">
          {isRTL ? 'استكشف الماركات' : 'Explore Brands'}
        </Link>
      </div>
    </div>
  );
}
