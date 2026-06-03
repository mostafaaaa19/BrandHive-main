import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Search, ShoppingCart, Heart, User, Menu, X, ChevronDown,
  Store, LogOut, Settings, Package, LayoutDashboard, Sparkles, Bell, Trash2
} from 'lucide-react';
import { productsAPI, notificationsAPI, categoriesAPI } from '../services/api';
import { mapProduct, mapCategory } from '../utils/mappers';
import { useAuth } from '../context/AuthContext';
import { useCart, useWishlist } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export default function Navbar() {
  const { t } = useTranslation();
  const { language, isRTL, toggleLanguage } = useLanguage();

  const NAV_LINKS = [
    { label: t('nav.home'), path: '/' },
    { label: t('nav.explore'), path: '/explore', hasDropdown: true },
    { label: isRTL ? 'بازارات' : 'Bazaars', path: '/bazaar' },
    { label: t('nav.global'), path: '/global' },
    { label: t('nav.sell'), path: '/sell', highlight: true },
  ];

  const HARDCODED_CATS = [
    { label: isRTL ? 'يدوي' : 'Handmade', path: '/products?category=handmade', icon: '🏺' },
    { label: isRTL ? 'أزياء' : 'Fashion', path: '/products?category=fashion', icon: '👗' },
    { label: isRTL ? 'مجوهرات' : 'Jewelry', path: '/products?category=jewelry', icon: '💍' },
    { label: isRTL ? 'ديكور' : 'Home Decor', path: '/products?category=home-decor', icon: '🏠' },
    { label: isRTL ? 'عضوي' : 'Organic', path: '/products?category=organic', icon: '🌿' },
    { label: isRTL ? 'فن وثقافة' : 'Art & Culture', path: '/products?category=art', icon: '🎨' },
  ];

  const [apiCategories, setApiCategories] = useState([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // Notifications
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin, isSeller, isAuthenticated } = useAuth();
  const { itemCount } = useCart();
  const { itemCount: wishlistCount } = useWishlist();
  const dropdownRef = useRef(null);
  const userMenuRef = useRef(null);
  const searchRef = useRef(null);
  const notifRef = useRef(null);

  const categoryLinks = apiCategories.length > 0
    ? apiCategories.slice(0, 6).map(c => ({
        label: isRTL && c.arName ? c.arName : c.name,
        path: `/products?category=${c.slug}`,
        icon: c.icon || '🛍️',
      }))
    : HARDCODED_CATS;

  const EXPLORE_MENU = [
    { label: isRTL ? 'كل الماركات' : 'All Brands', path: '/explore', icon: '🏪' },
    { label: isRTL ? 'كل المنتجات' : 'All Products', path: '/products', icon: '🛍️' },
    ...categoryLinks,
  ];

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await categoriesAPI.getAll();
        const raw = res.data?.data || res.data?.categories || res.data || [];
        if (Array.isArray(raw) && raw.length > 0) {
          setApiCategories(raw.map(mapCategory));
        }
      } catch {
        // keep hardcoded fallback
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setDropdownOpen(false);
    setUserMenuOpen(false);
    setSearchResults([]);
    setNotifOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchResults([]);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Poll unread notification count every 30s when logged in
  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchCount = async () => {
      try {
        const res = await notificationsAPI.getUnreadCount();
        setUnreadCount(res.data?.data?.count || res.data?.count || 0);
      } catch {}
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery('');
      setSearchResults([]);
    }
  };

  const handleSearchInput = async (value) => {
    setSearchQuery(value);
    if (!value.trim() || value.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await productsAPI.search({ search: value, limit: 5 });
      const raw = res.data?.data || res.data || [];
      setSearchResults(Array.isArray(raw) ? raw.map(mapProduct) : []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const openNotifications = async () => {
    setNotifOpen(true);
    if (notifications.length > 0) return;
    setNotifLoading(true);
    try {
      const res = await notificationsAPI.getAll();
      const list = res.data?.data || res.data || [];
      setNotifications(Array.isArray(list) ? list : []);
      await notificationsAPI.markAllRead();
      setUnreadCount(0);
    } catch {
      setNotifications([]);
    } finally {
      setNotifLoading(false);
    }
  };

  const handleDeleteNotification = async (id, wasUnread) => {
    try {
      await notificationsAPI.deleteNotification(id);
      setNotifications(prev => prev.filter(n => (n._id || n.id) !== id));
      if (wasUnread) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch {
      // silent fail
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getDashboardPath = () => {
    if (isAdmin) return '/admin/dashboard';
    if (isSeller) return '/seller/dashboard';
    return '/account';
  };

  // Language Toggle Component
  const LanguageToggle = ({ mobile = false }) => (
    <div className={`flex items-center gap-0.5 ${mobile ? 'px-4 py-3' : ''}`}>
      <button
        onClick={() => language !== 'en' && toggleLanguage()}
        className={`px-2 py-1 text-xs font-bold transition-all rounded-md ${
          language === 'en'
            ? 'text-brand-gold border-b-2 border-brand-gold'
            : 'text-gray-400 dark:text-dark-muted hover:text-brand-navy dark:hover:text-brand-gold'
        }`}
        aria-label="Switch to English"
      >
        EN
      </button>
      <span className="text-gray-300 dark:text-dark-border text-xs select-none">|</span>
      <button
        onClick={() => language !== 'ar' && toggleLanguage()}
        className={`px-2 py-1 text-xs font-bold transition-all rounded-md ${
          language === 'ar'
            ? 'text-brand-gold border-b-2 border-brand-gold'
            : 'text-gray-400 dark:text-dark-muted hover:text-brand-navy dark:hover:text-brand-gold'
        }`}
        aria-label="Switch to Arabic"
      >
        AR
      </button>
    </div>
  );

  return (
    <>
      {/* Announcement Bar */}
      <div className="bg-brand-navy text-white text-xs py-2 overflow-hidden">
        <div className="flex animate-marquee whitespace-nowrap">
          {[...Array(3)].map((_, i) => (
            <span key={i} className="flex items-center gap-8 mr-8">
              <span>🚚 {isRTL ? 'توصيل مجاني للطلبات فوق 500 ج.م' : 'Free delivery on orders above 500 EGP'}</span>
              <span className="text-brand-gold">✦</span>
              <span>{isRTL ? '🌙 عرض رمضان — ينتهي قريباً' : '🌙 Ramadan Special — ends soon'}</span>
              <span className="text-brand-gold">✦</span>
              <span>{isRTL ? '✅ أكثر من 12,000 ماركة محلية موثقة في مصر' : '✅ 12,000+ verified local brands across Egypt'}</span>
              <span className="text-brand-gold">✦</span>
              <span>{isRTL ? '🏆 السوق المحلي الأول في مصر' : "🏆 Egypt's #1 Local Marketplace"}</span>
              <span className="text-brand-gold">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* Main Navbar */}
      <header className={`sticky top-0 z-50 bg-white dark:bg-dark-surface/95 dark:backdrop-blur-md transition-shadow duration-300 ${scrolled ? 'shadow-md' : 'border-b border-gray-100 dark:border-dark-border'}`}>
        <div className="page-container">
          <div className={`flex items-center h-16 gap-4 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Logo */}
            <Link to="/" className={`flex items-center gap-2 flex-shrink-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className="w-9 h-9 bg-brand-navy dark:bg-brand-gold rounded-xl flex items-center justify-center">
                <span className="text-white dark:text-brand-navy font-display font-bold text-lg">B</span>
              </div>
              <span className="font-display font-bold text-brand-navy dark:text-white text-xl hidden sm:block">BrandHive</span>
            </Link>

            {/* Desktop Nav Links */}
            <nav className={`hidden lg:flex items-center gap-1 ${isRTL ? 'mr-4' : 'ml-4'}`}>
              {NAV_LINKS.map((link) => (
                link.hasDropdown ? (
                  <div key={link.label} className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setDropdownOpen(!dropdownOpen)}
                      className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                        ${location.pathname === link.path
                          ? 'text-brand-navy dark:text-brand-gold'
                          : 'text-gray-600 dark:text-dark-muted hover:text-brand-navy dark:hover:text-brand-gold hover:bg-gray-50 dark:hover:bg-dark-bg'}`}
                    >
                      {link.label}
                      <ChevronDown size={14} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {dropdownOpen && (
                      <div className={`absolute top-full ${isRTL ? 'right-0' : 'left-0'} mt-2 w-56 bg-white dark:bg-dark-surface rounded-2xl shadow-card-hover border border-gray-100 dark:border-dark-border p-2 animate-fade-in`}>
                        {EXPLORE_MENU.map((item) => (
                          <Link
                            key={item.label}
                            to={item.path}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-700 dark:text-dark-text hover:bg-brand-cream dark:hover:bg-dark-bg hover:text-brand-navy dark:hover:text-brand-gold transition-colors"
                          >
                            <span className="text-base">{item.icon}</span>
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <Link
                    key={link.label}
                    to={link.path}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors
                      ${link.highlight
                        ? 'text-brand-gold font-semibold hover:bg-brand-gold-pale dark:hover:bg-brand-gold/10'
                        : location.pathname === link.path
                          ? 'text-brand-navy dark:text-brand-gold font-semibold'
                          : 'text-gray-600 dark:text-dark-muted hover:text-brand-navy dark:hover:text-brand-gold hover:bg-gray-50 dark:hover:bg-dark-bg'}`}
                  >
                    {link.label}
                  </Link>
                )
              ))}
            </nav>

            {/* Search Bar - Desktop */}
            <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md mx-4">
              <div ref={searchRef} className="relative w-full">
                <Search size={16} className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-gray-400 dark:text-dark-muted`} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  placeholder={isRTL ? 'ابحث عن ماركات، منتجات...' : 'Search brands, products, artisans...'}
                  className={`w-full ${isRTL ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-2.5 text-sm border border-gray-200 dark:border-dark-border rounded-xl bg-gray-50 dark:bg-dark-bg text-gray-900 dark:text-dark-text focus:bg-white dark:focus:bg-dark-bg focus:outline-none focus:ring-2 focus:ring-brand-navy/20 dark:focus:ring-brand-gold/20 focus:border-brand-navy dark:focus:border-brand-gold transition-all`}
                />
                {/* Live search dropdown */}
                {(searchResults.length > 0 || searchLoading) && searchQuery && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-dark-surface rounded-2xl shadow-card-hover dark:border dark:border-dark-border overflow-hidden z-50 max-h-80 overflow-y-auto">
                    {searchLoading && (
                      <div className="p-3 text-center">
                        <div className="w-4 h-4 border-2 border-brand-gold border-t-transparent rounded-full animate-spin mx-auto" />
                      </div>
                    )}
                    {searchResults.map(product => (
                      <Link
                        key={product.id}
                        to={`/product/${product.slug}`}
                        onClick={() => { setSearchResults([]); setSearchQuery(''); }}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-brand-cream dark:hover:bg-dark-bg transition-colors"
                      >
                        {product.image ? (
                          <img src={product.image} alt={product.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-dark-bg flex items-center justify-center flex-shrink-0">
                            <span className="text-lg">📦</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-dark-text truncate">{product.name}</p>
                          <p className="text-xs text-brand-gold font-semibold">{product.price?.toLocaleString()} EGP</p>
                        </div>
                      </Link>
                    ))}
                    {searchQuery && (
                      <Link
                        to={`/products?search=${encodeURIComponent(searchQuery)}`}
                        onClick={() => setSearchResults([])}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-brand-navy/5 dark:bg-brand-gold/5 text-brand-navy dark:text-brand-gold text-sm font-medium hover:bg-brand-navy/10 transition-colors"
                      >
                        <Search size={14} />
                        {isRTL ? `عرض كل نتائج "${searchQuery}"` : `See all results for "${searchQuery}"`}
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </form>

            {/* Right Actions */}
            <div className={`flex items-center gap-1 ${isRTL ? 'mr-auto' : 'ml-auto'}`}>

              {/* Mobile Search */}
              <button
                onClick={() => setSearchOpen(!searchOpen)}
                className="md:hidden p-2 rounded-lg text-gray-600 dark:text-dark-muted hover:text-brand-navy dark:hover:text-brand-gold hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors"
              >
                <Search size={20} />
              </button>

              {/* Wishlist */}
              <Link to="/account?tab=wishlist" className="relative p-2 rounded-lg text-gray-600 dark:text-dark-muted hover:text-brand-navy dark:hover:text-brand-gold hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors hidden sm:flex items-center">
                <Heart size={20} />
                {wishlistCount > 0 && (
                  <span className={`absolute -top-0.5 ${isRTL ? '-left-0.5' : '-right-0.5'} w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold`}>
                    {wishlistCount > 9 ? '9+' : wishlistCount}
                  </span>
                )}
              </Link>

              {/* Notifications Bell */}
              {user && (
                <div ref={notifRef} className="relative">
                  <button
                    onClick={openNotifications}
                    className="relative p-2 rounded-lg text-gray-600 dark:text-dark-muted hover:text-brand-navy dark:hover:text-brand-gold hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors"
                  >
                    <Bell size={20} />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold text-[10px]">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {notifOpen && (
                    <div className={`absolute top-full ${isRTL ? 'left-0' : 'right-0'} mt-2 w-80 bg-white dark:bg-dark-surface rounded-2xl shadow-card-hover dark:border dark:border-dark-border overflow-hidden z-50`}>
                      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-dark-border">
                        <h3 className="font-semibold text-gray-900 dark:text-dark-text text-sm">
                          {isRTL ? 'الإشعارات' : 'Notifications'}
                        </h3>
                        <button onClick={() => setNotifOpen(false)} className="text-gray-400 hover:text-gray-600 dark:text-dark-muted dark:hover:text-dark-text">
                          <X size={16} />
                        </button>
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        {notifLoading ? (
                          <div className="p-8 text-center">
                            <div className="w-6 h-6 border-2 border-brand-gold border-t-transparent rounded-full animate-spin mx-auto" />
                          </div>
                        ) : notifications.length === 0 ? (
                          <div className="p-8 text-center">
                            <Bell size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                            <p className="text-sm text-gray-500 dark:text-dark-muted">
                              {isRTL ? 'لا توجد إشعارات' : 'No notifications yet'}
                            </p>
                          </div>
                        ) : (
                          notifications.map((notif, i) => (
                            <div
                              key={notif._id || i}
                              className={`px-4 py-3 border-b border-gray-50 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors ${!notif.isRead ? 'bg-brand-gold/5' : ''} ${isRTL ? 'text-right' : ''}`}
                            >
                              <div className={`flex items-start gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 dark:text-dark-text">{notif.title || notif.message}</p>
                                  {notif.body && <p className="text-xs text-gray-500 dark:text-dark-muted mt-0.5">{notif.body}</p>}
                                  <p className="text-xs text-gray-400 dark:text-dark-muted mt-1">{new Date(notif.createdAt).toLocaleDateString()}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteNotification(notif._id || notif.id, !notif.isRead)}
                                  className="text-gray-300 hover:text-red-500 dark:text-dark-muted dark:hover:text-red-400 transition-colors p-1 flex-shrink-0"
                                  aria-label={isRTL ? 'حذف الإشعار' : 'Delete notification'}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Cart */}
              <Link to="/cart" className="relative p-2 rounded-lg text-gray-600 dark:text-dark-muted hover:text-brand-navy dark:hover:text-brand-gold hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors">
                <ShoppingCart size={20} />
                {itemCount > 0 && (
                  <span className={`absolute -top-0.5 ${isRTL ? '-left-0.5' : '-right-0.5'} w-4 h-4 bg-brand-navy dark:bg-brand-gold text-white dark:text-brand-navy text-xs rounded-full flex items-center justify-center font-bold`}>
                    {itemCount > 9 ? '9+' : itemCount}
                  </span>
                )}
              </Link>

              {/* User Menu */}
              {user ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-brand-navy dark:bg-brand-gold flex items-center justify-center">
                      <span className="text-white dark:text-brand-navy text-sm font-bold">{user.name?.[0]?.toUpperCase()}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-dark-text hidden sm:block max-w-[80px] truncate">{user.name?.split(' ')[0]}</span>
                    <ChevronDown size={14} className={`text-gray-400 transition-transform hidden sm:block ${userMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {userMenuOpen && (
                    <div className={`absolute ${isRTL ? 'left-0' : 'right-0'} top-full mt-2 w-52 bg-white dark:bg-dark-surface rounded-2xl shadow-card-hover border border-gray-100 dark:border-dark-border p-2 animate-fade-in`}>
                      <div className="px-3 py-2 border-b border-gray-100 dark:border-dark-border mb-1">
                        <p className="text-sm font-semibold text-gray-900 dark:text-dark-text">{user.name}</p>
                        <p className="text-xs text-gray-500 dark:text-dark-muted capitalize">{user.role}</p>
                      </div>
                      <Link to={getDashboardPath()} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-700 dark:text-dark-text hover:bg-brand-cream dark:hover:bg-dark-bg hover:text-brand-navy dark:hover:text-brand-gold transition-colors">
                        <LayoutDashboard size={15} />
                        {isRTL ? 'لوحة التحكم' : 'Dashboard'}
                      </Link>
                      {isAdmin && (
                        <Link to="/admin/dashboard" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-700 dark:text-dark-text hover:bg-brand-cream dark:hover:bg-dark-bg hover:text-brand-navy dark:hover:text-brand-gold transition-colors">
                          <Settings size={15} />
                          {t('nav.adminDashboard')}
                        </Link>
                      )}
                      {isSeller && (
                        <Link to="/seller/dashboard" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-700 dark:text-dark-text hover:bg-brand-cream dark:hover:bg-dark-bg hover:text-brand-navy dark:hover:text-brand-gold transition-colors">
                          <Store size={15} />
                          {t('nav.sellerDashboard')}
                        </Link>
                      )}
                      <Link to="/account" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-700 dark:text-dark-text hover:bg-brand-cream dark:hover:bg-dark-bg hover:text-brand-navy dark:hover:text-brand-gold transition-colors">
                        <User size={15} />
                        {t('nav.account')}
                      </Link>
                      <Link to="/account?tab=orders" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-700 dark:text-dark-text hover:bg-brand-cream dark:hover:bg-dark-bg hover:text-brand-navy dark:hover:text-brand-gold transition-colors">
                        <Package size={15} />
                        {t('dashboard.user.orders')}
                      </Link>
                      <div className="border-t border-gray-100 dark:border-dark-border mt-1 pt-1">
                        <button
                          onClick={handleLogout}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors w-full ${isRTL ? 'text-right' : 'text-left'}`}
                        >
                          <LogOut size={15} />
                          {t('nav.logout')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link to="/login" className="hidden sm:block text-sm font-medium text-gray-700 dark:text-dark-muted hover:text-brand-navy dark:hover:text-brand-gold px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors">
                    {t('auth.signIn')}
                  </Link>
                  <Link to="/register" className="btn-primary py-2 text-sm hidden sm:flex">
                    {isRTL ? 'انضم مجاناً' : 'Join Free'}
                  </Link>
                  <Link to="/login" className="sm:hidden p-2 rounded-lg text-gray-600 dark:text-dark-muted hover:text-brand-navy dark:hover:text-brand-gold hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors">
                    <User size={20} />
                  </Link>
                </div>
              )}

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className={`lg:hidden p-2 rounded-lg text-gray-600 dark:text-dark-muted hover:text-brand-navy dark:hover:text-brand-gold hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors ${isRTL ? 'mr-1' : 'ml-1'}`}
              >
                {mobileOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Search */}
        {searchOpen && (
          <div className="md:hidden border-t border-gray-100 dark:border-dark-border px-4 py-3 animate-slide-up bg-white dark:bg-dark-surface">
            <form onSubmit={handleSearch}>
              <div className="relative">
                <Search size={16} className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-gray-400 dark:text-dark-muted`} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isRTL ? 'ابحث...' : 'Search brands, products...'}
                  className={`w-full ${isRTL ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-2.5 text-sm border border-gray-200 dark:border-dark-border rounded-xl bg-gray-50 dark:bg-dark-bg text-gray-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-brand-navy/20 dark:focus:ring-brand-gold/20 focus:border-brand-navy dark:focus:border-brand-gold`}
                  autoFocus
                />
              </div>
            </form>
          </div>
        )}

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-gray-100 dark:border-dark-border bg-white dark:bg-dark-surface animate-slide-up">
            <div className="page-container py-4 space-y-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.label}
                  to={link.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors
                    ${link.highlight
                      ? 'text-brand-gold'
                      : 'text-gray-700 dark:text-dark-text hover:bg-brand-cream dark:hover:bg-dark-bg hover:text-brand-navy dark:hover:text-brand-gold'}`}
                >
                  {link.label}
                </Link>
              ))}

              {/* Theme & Language - Mobile (managed via Settings) */}

              <div className="border-t border-gray-100 dark:border-dark-border pt-3 mt-2 space-y-1">
                {user ? (
                  <>
                    <Link to={getDashboardPath()} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-700 dark:text-dark-text hover:bg-brand-cream dark:hover:bg-dark-bg hover:text-brand-navy dark:hover:text-brand-gold">
                      <LayoutDashboard size={16} /> {isRTL ? 'لوحة التحكم' : 'Dashboard'}
                    </Link>
                    <button onClick={handleLogout} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 w-full ${isRTL ? 'text-right' : 'text-left'}`}>
                      <LogOut size={16} /> {t('nav.logout')}
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/login" className="flex items-center justify-center px-4 py-3 rounded-xl text-sm font-semibold border-2 border-brand-navy dark:border-brand-gold text-brand-navy dark:text-brand-gold hover:bg-brand-navy dark:hover:bg-brand-gold hover:text-white dark:hover:text-brand-navy transition-colors">
                      {t('auth.signIn')}
                    </Link>
                    <Link to="/register" className="flex items-center justify-center px-4 py-3 rounded-xl text-sm font-semibold bg-brand-navy dark:bg-brand-gold text-white dark:text-brand-navy hover:bg-opacity-90 transition-colors">
                      {isRTL ? 'انضم مجاناً' : 'Join Free'}
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
