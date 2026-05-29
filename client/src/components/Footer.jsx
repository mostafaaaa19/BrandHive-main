import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';

export default function Footer() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  const footerLinks = {
    [t('footer.about')]: [
      { label: t('nav.home'), path: '/' },
      { label: t('nav.explore'), path: '/explore' },
      { label: t('nav.products'), path: '/products' },
      { label: t('nav.global'), path: '/global' },
    ],
    [t('sell.title')]: [
      { label: t('nav.sell'), path: '/sell' },
      { label: t('dashboard.seller.title'), path: '/seller/dashboard' },
    ],
    [t('support.title')]: [
      { label: t('footer.contact'), path: '/support#contact' },
      { label: 'Live Chat', path: '/chat' },
    ],
  };

  const categories = [
    { label: isRTL ? 'أزياء' : 'Fashion', path: '/products?category=fashion' },
    { label: isRTL ? 'مجوهرات' : 'Jewelry', path: '/products?category=jewelry' },
    { label: isRTL ? 'يدوي' : 'Handmade', path: '/products?category=handmade' },
    { label: isRTL ? 'ديكور' : 'Home Decor', path: '/products?category=home-decor' },
    { label: isRTL ? 'عضوي' : 'Organic', path: '/products?category=organic' },
    { label: isRTL ? 'فن وثقافة' : 'Art & Culture', path: '/products?category=art' },
  ];

  return (
    <footer className="bg-brand-dark text-gray-300">
      {/* Newsletter Bar */}
      <div className="bg-brand-navy/80 border-b border-white/10">
        <div className="page-container py-8">
          <div className={`flex flex-col md:flex-row items-center justify-between gap-6 ${isRTL ? 'md:flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <h3 className="text-white font-display font-bold text-xl">
                {isRTL ? 'ابق على اطلاع 🐝' : 'Stay in the loop 🐝'}
              </h3>
              <p className="text-gray-400 text-sm mt-1">
                {isRTL 
                  ? 'ماركات جديدة، عروض حصريّة وقصص الحرفيين المصريين — في بريدك.' 
                  : 'New brands, exclusive deals & Egyptian artisan stories — in your inbox.'}
              </p>
            </div>
            <form className={`flex gap-2 w-full md:w-auto ${isRTL ? 'flex-row-reverse' : ''}`} onSubmit={(e) => e.preventDefault()}>
              <input
                type="email"
                placeholder="your@email.com"
                className={`flex-1 md:w-72 px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-brand-gold text-sm ${isRTL ? 'text-right' : 'text-left'}`}
              />
              <button type="submit" className="btn-gold px-6 py-3 text-sm whitespace-nowrap">
                {isRTL ? 'اشترك' : 'Subscribe'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Main Footer */}
      <div className="page-container py-12">
        <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 mb-10 ${isRTL ? 'text-right' : 'text-left'}`}>
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-3 lg:col-span-1">
            <Link to="/" className={`flex items-center gap-2 mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className="w-9 h-9 bg-brand-gold rounded-xl flex items-center justify-center">
                <span className="text-white font-display font-bold text-lg">B</span>
              </div>
              <span className="text-white font-display font-bold text-xl">BrandHive</span>
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              {isRTL 
                ? 'سوق مصر الأول للماركات المحلية، الحرفيين، والمنتجات العالمية. تمكين رواد الأعمال المصريين منذ عام 2024.'
                : "Egypt's premier marketplace for local brands, artisans, and global products. Empowering Egyptian entrepreneurs since 2024."}
            </p>
            <div className={`flex items-center gap-3 ${isRTL ? 'justify-end' : 'justify-start'}`}>
              {[
                { emoji: '📸', href: '#', label: 'Instagram' },
                { emoji: '📘', href: '#', label: 'Facebook' },
                { emoji: '𝕏', href: '#', label: 'X/Twitter' },
                { emoji: '▶️', href: '#', label: 'YouTube' },
              ].map(({ emoji, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-brand-gold transition-colors text-sm"
                >
                  {emoji}
                </a>
              ))}
            </div>
          </div>

          {/* Link Columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-white font-semibold text-sm mb-4">{title}</h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.path}
                      className="text-gray-400 text-sm hover:text-brand-gold transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Categories */}
        <div className="border-t border-white/10 pt-8 mb-8">
          <p className={`text-gray-500 text-xs mb-3 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
            {isRTL ? 'تصفح حسب الفئة' : 'Browse by category'}
          </p>
          <div className={`flex flex-wrap gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {categories.map((cat) => (
              <Link
                key={cat.label}
                to={cat.path}
                className="px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 text-xs hover:bg-brand-gold/20 hover:text-brand-gold transition-colors"
              >
                {cat.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div className="border-t border-white/10 pt-8 mb-8">
          <div className={`flex flex-wrap gap-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <a href="mailto:support@brandhive.eg" className="flex items-center gap-2 text-gray-400 text-sm hover:text-brand-gold transition-colors">
              <Mail size={14} />
              support@brandhive.eg
            </a>
            <a href="tel:+201000000000" className="flex items-center gap-2 text-gray-400 text-sm hover:text-brand-gold transition-colors">
              <Phone size={14} />
              +20 100 000 0000
            </a>
            <span className="flex items-center gap-2 text-gray-400 text-sm">
              <MapPin size={14} />
              {isRTL ? 'القاهرة، مصر 🇪🇬' : 'Cairo, Egypt 🇪🇬'}
            </span>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className={`border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
          <p className="text-gray-500 text-xs">
            © 2025 BrandHive Inc. {t('footer.rights')}. &nbsp;
            <span className="text-brand-gold">{isRTL ? '🇪🇬 صنع في مصر' : '🇪🇬 Made in Egypt'}</span>
          </p>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="text-gray-500 text-xs hover:text-gray-300 transition-colors">{t('footer.privacy')}</Link>
            <Link to="/terms" className="text-gray-500 text-xs hover:text-gray-300 transition-colors">{t('footer.terms')}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
