import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, Heart, Star, User, MapPin, CreditCard,
  Bell, MessageSquare, LogOut, ChevronRight, TrendingUp, Settings,
  X, Clock, CheckCircle, XCircle, Truck, RefreshCw, AlertCircle, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ordersAPI, addressesAPI, usersAPI, reviewsAPI, notificationsAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useWishlist, useCart } from '../../context/CartContext';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import toast from 'react-hot-toast';
import SettingsPanel from '../../components/SettingsPanel';

const STATUS_COLORS = {
  shipped: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  SHIPPED: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  Shipped: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  delivered: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  DELIVERED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  Delivered: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  processing: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  PROCESSING: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  Processing: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  pending: 'bg-gray-100 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400',
  PENDING: 'bg-gray-100 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400',
  Pending: 'bg-gray-100 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  Cancelled: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
};

function NavItem({ icon: Icon, label, tab, activeTab, setActiveTab, badge, isRTL }) {
  const isActive = activeTab === tab;
  return (
    <button
      onClick={() => setActiveTab(tab)}
      className={`${isActive ? 'sidebar-item-active' : 'sidebar-item'} ${isRTL ? 'flex-row-reverse text-right' : ''}`}
    >
      <Icon size={18} />
      <span>{label}</span>
      {badge > 0 && (
        <span className={`${isRTL ? 'mr-auto ml-0' : 'ml-auto mr-0'} bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center`}>
          {badge}
        </span>
      )}
    </button>
  );
}

function NotificationsTab({ isRTL }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { notificationsAPI } = await import('../../services/api');
        const res = await notificationsAPI.getAll();
        const data = res.data?.data || res.data || [];
        setNotifications(Array.isArray(data) ? data : []);
        await notificationsAPI.markAllRead();
      } catch {
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return (
    <div className="bg-white dark:bg-dark-surface 
      rounded-2xl shadow-card dark:shadow-none 
      dark:border dark:border-dark-border">
      {loading ? (
        <div className="p-8 text-center">
          <div className="w-6 h-6 border-2 
            border-brand-gold border-t-transparent 
            rounded-full animate-spin mx-auto" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="p-8 text-center">
          <Bell className="mx-auto text-gray-300 mb-3" size={40} />
          <p className="text-gray-500 dark:text-dark-muted">
            {isRTL ? 'لا توجد إشعارات' : 'No notifications yet'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50 
          dark:divide-dark-border">
          {notifications.map((n, i) => (
            <div key={n._id || i}
              className={`px-6 py-4 hover:bg-gray-50/50 
                dark:hover:bg-dark-bg/50 transition-colors
                ${!n.isRead ? 'bg-brand-gold/5' : ''}
                ${isRTL ? 'text-right' : ''}`}>
              <p className="font-medium text-sm 
                text-gray-900 dark:text-dark-text">
                {n.title || n.message}
              </p>
              {n.body && (
                <p className="text-xs text-gray-500 
                  dark:text-dark-muted mt-0.5">
                  {n.body}
                </p>
              )}
              <p className="text-xs text-gray-400 
                dark:text-dark-muted mt-1">
                {n.createdAt
                  ? new Date(n.createdAt).toLocaleDateString()
                  : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function UserDashboard() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user, logout, updateUser } = useAuth();
  const { items: wishlistItems, toggleWishlist, moveToCart } = useWishlist();
  const { addToCart } = useCart();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'dashboard');
  const navigate = useNavigate();

  const displayName = user?.name || 'User';
  const displayEmail = user?.email || '';
  const displayAvatar = user?.avatar || null;
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetail, setOrderDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [reorderLoading, setReorderLoading] = useState(null);

  // Addresses state
  const [addresses, setAddresses] = useState([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressForm, setAddressForm] = useState({
    fullName: '', phone: '', street: '', city: '', governorate: 'Cairo',
  });

  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
  });
  const [profileLoading, setProfileLoading] = useState(false);

  const [myReviews, setMyReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const [savedCards, setSavedCards] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('brandhive_saved_cards')) || [];
    } catch {
      return [];
    }
  });
  const [showAddCard, setShowAddCard] = useState(false);
  const [cardForm, setCardForm] = useState({ number: '', name: '', expiry: '', cvv: '' });
  const [cardErrors, setCardErrors] = useState({});

  const [profileInitialized, setProfileInitialized] = useState(false);

  useEffect(() => {
    if (user && !profileInitialized) {
      const nameParts = (user.name || '').split(' ');
      setProfileForm({
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        phone: user.phone || '',
      });
      setProfileInitialized(true);
    }
  }, [user, profileInitialized]);

  useEffect(() => {
    if (activeTab !== 'reviews') return;
    const fetchMyReviews = async () => {
      setReviewsLoading(true);
      try {
        const res = await reviewsAPI.getMyReviews();
        const data = res.data?.data || res.data?.reviews || res.data || [];
        setMyReviews(Array.isArray(data) ? data : []);
      } catch {
        // 403 = admin account; 404 = no reviews yet — both show empty state silently
        setMyReviews([]);
      } finally {
        setReviewsLoading(false);
      }
    };
    fetchMyReviews();
  }, [activeTab]);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const res = await notificationsAPI.getUnreadCount();
        setUnreadCount(res.data?.data?.count || res.data?.count || 0);
      } catch {
        setUnreadCount(0);
      }
    };
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab === 'orders' || activeTab === 'dashboard') {
      fetchOrders();
    }
    if (activeTab === 'addresses' || activeTab === 'profile') {
      fetchAddresses();
    }
  }, [activeTab]);

  const handleProfileSave = async () => {
    setProfileLoading(true);
    try {
      const name = `${profileForm.firstName} ${profileForm.lastName}`.trim();
      await usersAPI.updateProfile({
        name,
        phone: profileForm.phone
      });
      updateUser({ name, phone: profileForm.phone });
      toast.success(isRTL ? 'تم تحديث الملف الشخصي!' : 'Profile updated!', {
        style: { borderRadius: '12px', fontFamily: isRTL ? 'Cairo' : 'Inter' }
      });
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
        (isRTL ? 'فشل تحديث الملف الشخصي' : 'Failed to update profile'),
        { style: { borderRadius: '12px' } }
      );
    } finally {
      setProfileLoading(false);
    }
  };

  const detectCardType = (number) => {
    const n = number.replace(/\s/g, '');
    if (n.startsWith('4')) return 'Visa';
    if (n.startsWith('5') || n.startsWith('2')) return 'Mastercard';
    if (n.startsWith('6')) return 'Meeza';
    return 'Card';
  };

  const formatCardNumber = (val) =>
    val.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();

  const formatExpiry = (val) => {
    const clean = val.replace(/\D/g, '').slice(0, 4);
    return clean.length >= 3 ? clean.slice(0, 2) + '/' + clean.slice(2) : clean;
  };

  const handleAddCard = () => {
    const errors = {};
    const num = cardForm.number.replace(/\s/g, '');
    if (num.length < 16) errors.number = isRTL ? 'رقم الكارت غير صحيح' : 'Invalid card number';
    if (!cardForm.name.trim()) errors.name = isRTL ? 'الاسم مطلوب' : 'Name required';
    if (cardForm.expiry.length < 5) errors.expiry = isRTL ? 'تاريخ انتهاء غير صحيح' : 'Invalid expiry';
    if (cardForm.cvv.length < 3) errors.cvv = isRTL ? 'CVV غير صحيح' : 'Invalid CVV';
    setCardErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const newCard = {
      id: Date.now().toString(),
      last4: num.slice(-4),
      type: detectCardType(num),
      expiry: cardForm.expiry,
      name: cardForm.name,
      isDefault: savedCards.length === 0,
    };
    const updated = [...savedCards, newCard];
    setSavedCards(updated);
    localStorage.setItem('brandhive_saved_cards', JSON.stringify(updated));
    setCardForm({ number: '', name: '', expiry: '', cvv: '' });
    setCardErrors({});
    setShowAddCard(false);
    toast.success(isRTL ? 'تم إضافة الكارت ✅' : 'Card added ✅');
  };

  const handleDeleteCard = (id) => {
    const updated = savedCards.filter(c => c.id !== id);
    if (updated.length > 0 && !updated.some(c => c.isDefault)) updated[0].isDefault = true;
    setSavedCards(updated);
    localStorage.setItem('brandhive_saved_cards', JSON.stringify(updated));
    toast.success(isRTL ? 'تم حذف الكارت' : 'Card removed');
  };

  const handleSetDefault = (id) => {
    const updated = savedCards.map(c => ({ ...c, isDefault: c.id === id }));
    setSavedCards(updated);
    localStorage.setItem('brandhive_saved_cards', JSON.stringify(updated));
  };

  const fetchOrders = async () => {
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const res = await ordersAPI.getAll();
      const data = res.data;
      const list = Array.isArray(data) ? data : data?.data || data?.orders || [];
      setOrders(list);
    } catch (err) {
      // 401 / 403 = auth issue (admin accounts hit 403 on customer endpoints)
      // silently show empty state; only surface real errors
      const status = err.response?.status;
      if (status !== 401 && status !== 403) {
        setOrdersError(
          err.response?.data?.message ||
          'Failed to load orders'
        );
      }
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  };

  const fetchOrderDetail = async (orderId) => {
    setDetailLoading(true);
    try {
      const res = await ordersAPI.getMyOrder(orderId);
      const data = res.data;
      setOrderDetail(data?.data || data?.order || data);
    } catch (err) {
      toast.error(isRTL ? 'فشل تحميل تفاصيل الطلب' : 'Failed to load order details');
    } finally {
      setDetailLoading(false);
    }
  };

  const cancelOrder = async (orderId) => {
    setCancellingId(orderId);
    try {
      await ordersAPI.cancelOrder(orderId, { reason: 'Customer requested cancellation' });
      toast.success(isRTL ? 'تم إلغاء الطلب بنجاح' : 'Order cancelled successfully');
      setSelectedOrder(null);
      setOrderDetail(null);
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || (isRTL ? 'فشل إلغاء الطلب' : 'Failed to cancel order'));
    } finally {
      setCancellingId(null);
    }
  };

  const handleReorder = async (orderId) => {
    setReorderLoading(orderId);
    try {
      await ordersAPI.reorder(orderId);
      toast.success(
        isRTL ? 'تم إعادة الطلب بنجاح! 🛍️' : 'Order placed again successfully! 🛍️',
        { style: { borderRadius: '12px', fontFamily: isRTL ? 'Cairo' : 'Inter' } }
      );
      const res = await ordersAPI.getAll();
      const data = res.data?.data || res.data?.orders || [];
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(
        err.response?.data?.message || (isRTL ? 'فشل إعادة الطلب' : 'Failed to reorder'),
        { style: { borderRadius: '12px' } }
      );
    } finally {
      setReorderLoading(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const canReorder = (status) =>
    ['delivered', 'cancelled', 'Delivered', 'Cancelled'].includes(status);

  const fetchAddresses = async () => {
    try {
      const res = await addressesAPI.getAll();
      const list = res.data?.data || res.data || [];
      setAddresses(Array.isArray(list) ? list : []);
    } catch {
      setAddresses([]);
    }
  };

  const addAddress = async () => {
    setAddressLoading(true);
    try {
      await addressesAPI.add(addressForm);
      toast.success(isRTL ? 'تم إضافة العنوان ✅' : 'Address added ✅');
      setShowAddressForm(false);
      setAddressForm({ fullName: '', phone: '', street: '', city: '', governorate: 'Cairo' });
      fetchAddresses();
    } catch (err) {
      toast.error(err.response?.data?.message || (isRTL ? 'فشل إضافة العنوان' : 'Failed to add address'));
    } finally {
      setAddressLoading(false);
    }
  };

  const deleteAddress = async (id) => {
    try {
      await addressesAPI.delete(id);
      toast.success(isRTL ? 'تم حذف العنوان' : 'Address deleted');
      fetchAddresses();
    } catch {
      toast.error(isRTL ? 'فشل حذف العنوان' : 'Failed to delete');
    }
  };

  const TABS = [
    { icon: LayoutDashboard, label: isRTL ? 'لوحة التحكم' : 'Dashboard', tab: 'dashboard' },
    { icon: Package, label: isRTL ? 'طلباتي' : 'My Orders', tab: 'orders', badge: orders.length || 0 },
    { icon: Heart, label: isRTL ? 'المفضلة' : 'Wishlist', tab: 'wishlist', badge: wishlistItems.length || 0 },
    { icon: Star, label: isRTL ? 'تقييماتي' : 'Reviews', tab: 'reviews', badge: myReviews.length || 0 },
    { icon: Settings, label: isRTL ? 'الإعدادات' : 'Settings', tab: 'settings' },
  ];

  const PROFILE_TABS = [
    { icon: User, label: isRTL ? 'إعدادات الحساب' : 'Profile Settings', tab: 'profile' },
    { icon: MapPin, label: isRTL ? 'العناوين' : 'Addresses', tab: 'addresses' },
    { icon: CreditCard, label: isRTL ? 'طرق الدفع' : 'Payment Methods', tab: 'payment' },
    { icon: Bell, label: isRTL ? 'التنبيهات' : 'Notifications', tab: 'notifications', badge: unreadCount || 0 },
  ];

  const SUPPORT_TABS = [
    { icon: MessageSquare, label: isRTL ? 'الدعم الفني' : 'Chat Support', tab: 'chat' },
  ];

  const translateStatus = (status) => {
    if (!isRTL) return status;
    const map = {
      'Shipped': 'تم الشحن',
      'Delivered': 'تم التوصيل',
      'Processing': 'جاري المعالجة',
      'Pending': 'قيد الانتظار',
      'Cancelled': 'ملغي'
    };
    return map[status] || status;
  };

  return (
    <div className={`min-h-screen bg-brand-cream dark:bg-dark-bg transition-colors duration-200 ${isRTL ? 'text-right' : 'text-left'}`}>
      <div className="page-container py-8">
        <div className={`flex gap-8 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {/* Sidebar */}
          <aside className="hidden md:block w-60 flex-shrink-0">
            <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-4 sticky top-24">
              {/* User info */}
              <div className={`flex items-center gap-3 p-3 mb-4 bg-brand-cream dark:bg-dark-bg rounded-2xl ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className="w-12 h-12 rounded-2xl bg-brand-navy dark:bg-brand-gold flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {displayAvatar ? (
                    <img src={displayAvatar} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white dark:text-brand-navy font-bold text-xl">{initials}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-dark-text truncate">{displayName}</p>
                  <p className="text-xs text-gray-500 dark:text-dark-muted truncate">{displayEmail}</p>
                </div>
              </div>

              <p className={`text-xs font-bold text-gray-400 dark:text-dark-muted uppercase tracking-wider px-4 mb-2 ${isRTL ? 'text-right' : ''}`}>
                {isRTL ? 'الحساب' : 'Account'}
              </p>
              {TABS.map(t => <NavItem key={t.tab} {...t} activeTab={activeTab} setActiveTab={setActiveTab} isRTL={isRTL} />)}

              <p className={`text-xs font-bold text-gray-400 dark:text-dark-muted uppercase tracking-wider px-4 mb-2 mt-4 ${isRTL ? 'text-right' : ''}`}>
                {isRTL ? 'الملف الشخصي' : 'Profile'}
              </p>
              {PROFILE_TABS.map(t => <NavItem key={t.tab} {...t} activeTab={activeTab} setActiveTab={setActiveTab} isRTL={isRTL} />)}

              <p className={`text-xs font-bold text-gray-400 dark:text-dark-muted uppercase tracking-wider px-4 mb-2 mt-4 ${isRTL ? 'text-right' : ''}`}>
                {isRTL ? 'الدعم' : 'Support'}
              </p>
              {SUPPORT_TABS.map(t => <NavItem key={t.tab} {...t} activeTab={activeTab} setActiveTab={setActiveTab} isRTL={isRTL} />)}

              <div className="border-t border-gray-100 dark:border-dark-border mt-4 pt-3">
                <button onClick={handleLogout} className={`sidebar-item text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 w-full ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                  <LogOut size={16} /> {isRTL ? 'تسجيل الخروج' : 'Sign Out'}
                </button>
              </div>
            </div>
          </aside>

          {/* Mobile Tab Bar */}
          <div className="md:hidden w-full overflow-x-auto pb-4 mb-2">
            <div className={`flex gap-2 whitespace-nowrap ${isRTL ? 'flex-row-reverse' : ''}`}>
              {[...TABS, ...PROFILE_TABS, ...SUPPORT_TABS].map(t => (
                <button
                  key={t.tab}
                  onClick={() => setActiveTab(t.tab)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium flex-shrink-0 transition-all ${activeTab === t.tab ? 'bg-brand-navy dark:bg-brand-gold text-white dark:text-brand-navy' : 'bg-white dark:bg-dark-surface text-gray-600 dark:text-dark-text'
                    }`}
                >
                  <t.icon size={13} /> {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Dashboard Overview */}
            {activeTab === 'dashboard' && (
              <div>
                <div className={`flex items-center justify-between mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className={isRTL ? 'text-right' : ''}>
                    <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-dark-text">
                      {isRTL ? 'حسابي' : 'My Account'}
                    </h1>
                    <p className="text-gray-500 dark:text-dark-muted mt-1">
                      {isRTL ? `مرحباً بعودتك، ${displayName?.split(' ')[0]} 👋` : `Welcome back, ${displayName?.split(' ')[0]} 👋`}
                    </p>
                  </div>
                  <Link to="/products" className={`btn-primary text-sm flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    {isRTL ? 'مواصلة التسوق ←' : 'Continue Shopping →'}
                  </Link>
                </div>

                {/* Stats */}
                <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  {[
                    { icon: Package, label: isRTL ? 'إجمالي الطلبات' : 'Total Orders', value: orders.length, color: 'bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400' },
                    { icon: Heart, label: isRTL ? 'المنتجات المفضلة' : 'Wishlist Items', value: wishlistItems.length, color: 'bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400' },
                    { icon: Star, label: isRTL ? 'التقييمات المكتوبة' : 'Reviews Written', value: user?.reviewsCount || 0, color: 'bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400' },
                    { icon: TrendingUp, label: isRTL ? 'ج.م تم توفيرها' : 'EGP Saved', value: (user?.savedAmount || 0).toLocaleString(), color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' },
                  ].map(stat => (
                    <div key={stat.label} className={`bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-5 ${isRTL ? 'text-right' : ''}`}>
                      <div className={`w-10 h-10 rounded-xl ${stat.color} flex items-center justify-center mb-3 ${isRTL ? 'mr-0 ml-auto' : ''}`}>
                        <stat.icon size={18} />
                      </div>
                      <div className="text-2xl font-display font-bold text-gray-900 dark:text-dark-text">{stat.value}</div>
                      <div className="text-xs text-gray-500 dark:text-dark-muted mt-0.5">{stat.label}</div>
                    </div>
                  ))}
                </div>

                {/* Recent orders */}
                <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6">
                  <div className={`flex items-center justify-between mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <h2 className="font-display font-bold text-xl text-gray-900 dark:text-dark-text">
                      {isRTL ? 'الطلبات الأخيرة' : 'Recent Orders'}
                    </h2>
                    <button onClick={() => setActiveTab('orders')} className={`text-sm text-brand-gold hover:underline flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      {isRTL ? 'عرض الكل' : 'View All'} <ChevronRight size={14} className={isRTL ? 'rotate-180' : ''} />
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className={`w-full text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
                      <thead>
                        <tr className={`border-b border-gray-100 dark:border-dark-border ${isRTL ? 'flex-row-reverse' : ''}`}>
                          {[
                            isRTL ? 'رقم الطلب' : 'Order ID',
                            isRTL ? 'المنتج' : 'Product',
                            isRTL ? 'الماركة' : 'Brand',
                            isRTL ? 'التاريخ' : 'Date',
                            isRTL ? 'المبلغ' : 'Amount',
                            isRTL ? 'الحالة' : 'Status'
                          ].map(h => (
                            <th key={h} className="text-xs font-semibold text-gray-400 dark:text-dark-muted uppercase tracking-wider pb-3 px-2">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ordersLoading ? (
                          [...Array(3)].map((_, i) => (
                            <tr key={i}><td colSpan="6"><div className="animate-pulse bg-gray-100 dark:bg-dark-border rounded-xl h-12 w-full my-1"></div></td></tr>
                          ))
                        ) : ordersError ? (
                          <tr><td colSpan="6" className="text-center py-4 text-red-500">{ordersError}</td></tr>
                        ) : orders.length === 0 ? (
                          <tr><td colSpan="6" className="text-center py-4 text-gray-500">{isRTL ? 'لا توجد طلبات بعد' : 'No orders yet'}</td></tr>
                        ) : orders.slice(0, 4).map(order => {
                          const orderId = order._id || order.id || order.orderId;
                          const date = new Date(order.createdAt || order.date || Date.now()).toLocaleDateString();
                          const amount = Number(order.totalAmount || order.total || order.amount || 0);
                          const status = order.status || order.orderStatus || 'Pending';
                          const items = order.items || order.products || [];
                          const productName = items[0]?.product?.name || items[0]?.name || order.product || 'Multiple items';
                          const brandName = items[0]?.product?.brand?.name || items[0]?.brandName || order.brand || '-';

                          return (
                            <tr key={orderId} className="border-b border-gray-50 dark:border-dark-border/50 last:border-0 hover:bg-gray-50/50 dark:hover:bg-dark-bg/50">
                              <td className="py-3 px-2 font-mono text-xs text-brand-navy dark:text-brand-gold font-semibold">#{orderId.toString().slice(-6).toUpperCase()}</td>
                              <td className="py-3 px-2 font-medium text-gray-900 dark:text-dark-text max-w-[140px] truncate">{productName}</td>
                              <td className="py-3 px-2 text-gray-600 dark:text-dark-muted">{brandName}</td>
                              <td className="py-3 px-2 text-gray-500 dark:text-dark-muted whitespace-nowrap">{date}</td>
                              <td className="py-3 px-2 font-semibold text-gray-900 dark:text-dark-text whitespace-nowrap">{amount.toLocaleString()} {t('common.egp')}</td>
                              <td className="py-3 px-2">
                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-600'}`}>
                                  {translateStatus(status)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Orders Tab */}
            {activeTab === 'orders' && (
              <div>
                <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-dark-text mb-6">
                  {isRTL ? 'طلباتي' : 'My Orders'}
                </h1>
                <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6">
                  {ordersLoading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="animate-pulse bg-gray-100 dark:bg-dark-border rounded-xl h-16 w-full"></div>
                      ))}
                    </div>
                  ) : ordersError ? (
                    <div className="text-center py-12">
                      <AlertCircle className="mx-auto text-red-400 mb-4" size={48} />
                      <p className="text-red-500 mb-4">{ordersError}</p>
                      <button onClick={fetchOrders} className="btn-primary inline-flex items-center gap-2">
                        <RefreshCw size={16} /> Try Again
                      </button>
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="text-center py-12">
                      <Package className="mx-auto text-gray-300 mb-4" size={48} />
                      <h3 className="text-xl font-bold text-gray-900 dark:text-dark-text mb-2">
                        {isRTL ? 'لا توجد طلبات بعد' : 'No orders yet'}
                      </h3>
                      <p className="text-gray-500 mb-4">
                        {isRTL ? 'عندما تقوم بطلب، سيظهر هنا' : 'When you place an order, it will appear here'}
                      </p>
                      <Link to="/products" className="btn-primary inline-block">
                        {isRTL ? 'ابدأ التسوق' : 'Start Shopping'}
                      </Link>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className={`w-full text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
                        <thead>
                          <tr className="border-b border-gray-100 dark:border-dark-border">
                            {[
                              isRTL ? 'رقم الطلب' : 'Order ID',
                              isRTL ? 'المنتج' : 'Product',
                              isRTL ? 'الماركة' : 'Brand',
                              isRTL ? 'التاريخ' : 'Date',
                              isRTL ? 'المبلغ' : 'Amount',
                              isRTL ? 'الحالة' : 'Status',
                              isRTL ? 'إجراءات' : 'Actions'
                            ].map(h => (
                              <th key={h} className="text-xs font-semibold text-gray-400 dark:text-dark-muted uppercase tracking-wider pb-3 px-2">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {orders.map(order => {
                            const orderId = order._id || order.id || order.orderId;
                            const date = new Date(order.createdAt || order.date || Date.now()).toLocaleDateString();
                            const amount = Number(order.totalAmount || order.total || order.amount || 0);
                            const status = order.status || order.orderStatus || 'Pending';
                            const items = order.items || order.products || [];
                            const productName = items[0]?.product?.name || items[0]?.name || order.product || 'Multiple items';
                            const brandName = items[0]?.product?.brand?.name || items[0]?.brandName || order.brand || '-';

                            return (
                              <tr key={orderId} className="border-b border-gray-50 dark:border-dark-border/50 last:border-0 hover:bg-gray-50/50 dark:hover:bg-dark-bg/50">
                                <td className="py-3 px-2 font-mono text-xs text-brand-navy dark:text-brand-gold font-semibold">#{orderId.toString().slice(-6).toUpperCase()}</td>
                                <td className="py-3 px-2 font-medium text-gray-900 dark:text-dark-text max-w-[140px] truncate">{productName}</td>
                                <td className="py-3 px-2 text-gray-600 dark:text-dark-muted">{brandName}</td>
                                <td className="py-3 px-2 text-gray-500 dark:text-dark-muted">{date}</td>
                                <td className="py-3 px-2 font-semibold text-gray-900 dark:text-dark-text">{amount.toLocaleString()} {t('common.egp')}</td>
                                <td className="py-3 px-2">
                                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-600'}`}>
                                    {translateStatus(status)}
                                  </span>
                                </td>
                                <td className="py-3 px-2">
                                  <div className={`flex items-center gap-2 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
                                    <button
                                      onClick={() => {
                                        setSelectedOrder(order);
                                        fetchOrderDetail(orderId);
                                      }}
                                      className="text-xs text-brand-navy dark:text-brand-gold hover:underline"
                                    >
                                      {isRTL ? 'تتبع' : 'Track'}
                                    </button>
                                    {canReorder(status) && (
                                      <button
                                        onClick={() => handleReorder(order._id || order.id)}
                                        disabled={reorderLoading === (order._id || order.id)}
                                        className="text-xs px-3 py-1.5 bg-brand-gold/10 text-brand-gold hover:bg-brand-gold/20 rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center gap-1"
                                      >
                                        {reorderLoading === (order._id || order.id) ? (
                                          <div className="w-3 h-3 border-2 border-brand-gold border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                          <>🔄 {isRTL ? 'إعادة الطلب' : 'Reorder'}</>
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Wishlist Tab */}
            {activeTab === 'wishlist' && (
              <div>
                <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-dark-text mb-6">
                  {isRTL ? 'قائمة المفضلة' : 'My Wishlist'}
                </h1>
                {wishlistItems.length === 0 ? (
                  <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-12 text-center">
                    <Heart className="mx-auto text-gray-300 dark:text-dark-muted mb-4" size={48} />
                    <h3 className="text-xl font-bold text-gray-900 dark:text-dark-text mb-2">
                      {isRTL ? 'قائمة المفضلة فارغة' : 'Your wishlist is empty'}
                    </h3>
                    <p className="text-gray-500 dark:text-dark-muted mb-4">
                      {isRTL ? 'احفظ المنتجات التي تحبها لتجدها لاحقاً' : 'Save products you love to find them later'}
                    </p>
                    <Link to="/products" className="btn-primary inline-block">
                      {isRTL ? 'تصفح المنتجات' : 'Browse Products'}
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {wishlistItems.map(item => (
                      <div key={item.id} className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-4 hover:shadow-card-hover transition-all flex gap-4">
                        <div className="w-24 h-24 rounded-xl bg-gray-50 dark:bg-dark-bg flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-3xl">🛍️</span>
                          )}
                        </div>
                        <div className={`flex-1 min-w-0 flex flex-col ${isRTL ? 'text-right' : 'text-left'}`}>
                          <p className="text-xs text-brand-gold font-semibold truncate">{item.brandName || item.brand?.name || ''}</p>
                          <Link to={`/product/${item.slug || item._id || item.id}`} className="text-sm font-bold text-gray-900 dark:text-dark-text line-clamp-1 hover:text-brand-gold">
                            {item.name}
                          </Link>
                          <p className="text-brand-navy dark:text-brand-gold font-bold mt-1">
                            {(item.price || item.salePrice || item.discountPrice || 0).toLocaleString()} {t('common.egp')}
                          </p>

                          <div className={`flex items-center gap-3 mt-auto pt-2 border-t border-gray-50 dark:border-dark-border/50 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <button
                              onClick={() => moveToCart(item.id, addToCart)}
                              className="text-xs font-bold text-brand-navy dark:text-brand-gold hover:underline"
                            >
                              {isRTL ? 'نقل للسلة' : 'Move to Cart'}
                            </button>
                            <button
                              onClick={() => toggleWishlist(item)}
                              className="text-xs font-medium text-red-500 hover:underline"
                            >
                              {isRTL ? 'إزالة' : 'Remove'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Reviews Tab */}
            {activeTab === 'reviews' && (
              <div>
                <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-dark-text mb-6">
                  {isRTL ? 'تقييماتي' : 'My Reviews'}
                </h1>

                {reviewsLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="bg-gray-100 dark:bg-dark-surface rounded-2xl h-28 animate-pulse" />
                    ))}
                  </div>
                ) : myReviews.length === 0 ? (
                  <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-8 text-center">
                    <Star className="mx-auto text-gray-300 dark:text-dark-muted mb-4" size={48} />
                    <h3 className="text-xl font-bold text-gray-900 dark:text-dark-text mb-2">
                      {isRTL ? 'لم تكتب أي تقييمات بعد' : 'No reviews yet'}
                    </h3>
                    <p className="text-gray-500 dark:text-dark-muted">
                      {isRTL ? 'بعد شراء منتج، يمكنك كتابة تقييمك هنا.' : 'After purchasing a product, you can leave a review here.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-500 dark:text-dark-muted mb-2">
                      {isRTL ? `كتبت ${myReviews.length} تقييم` : `You've written ${myReviews.length} review${myReviews.length !== 1 ? 's' : ''}`}
                    </p>
                    {myReviews.map((review, i) => (
                      <div key={review._id || i} className={`bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-5 ${isRTL ? 'text-right' : ''}`}>
                        <div className={`flex items-start justify-between gap-3 mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-dark-text text-sm">
                              {review.product?.name || (isRTL ? 'منتج محذوف' : 'Deleted product')}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-dark-muted mt-0.5">
                              {review.createdAt ? new Date(review.createdAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US') : ''}
                            </p>
                          </div>
                          <div className="flex">
                            {[...Array(5)].map((_, j) => (
                              <Star
                                key={j}
                                size={13}
                                className={j < review.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600'}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-gray-700 dark:text-dark-text text-sm leading-relaxed">
                          {review.comment}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-dark-text">
                  {isRTL ? 'إعدادات الحساب' : 'Profile Settings'}
                </h1>

                {/* Profile Info Card */}
                <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6">
                  <div className={`flex items-center gap-4 mb-6 pb-6 border-b border-gray-100 dark:border-dark-border ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className="w-16 h-16 rounded-2xl bg-brand-navy dark:bg-brand-gold flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {displayAvatar ? (
                        <img src={displayAvatar} alt={displayName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white dark:text-brand-navy font-bold text-2xl">{initials}</span>
                      )}
                    </div>
                    <div className={isRTL ? 'text-right' : ''}>
                      <p className="font-bold text-gray-900 dark:text-dark-text">{displayName}</p>
                      <p className="text-gray-500 dark:text-dark-muted text-sm">{displayEmail}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <div className={isRTL ? 'text-right' : ''}>
                      <label className="input-label">{isRTL ? 'الاسم الأول' : 'First Name'}</label>
                      <input
                        value={profileForm.firstName}
                        onChange={e => setProfileForm(p => ({ ...p, firstName: e.target.value }))}
                        placeholder={isRTL ? 'الاسم الأول' : 'First Name'}
                        className={`input-field ${isRTL ? 'text-right' : ''}`}
                      />
                    </div>
                    <div className={isRTL ? 'text-right' : ''}>
                      <label className="input-label">{isRTL ? 'الاسم الأخير' : 'Last Name'}</label>
                      <input
                        value={profileForm.lastName}
                        onChange={e => setProfileForm(p => ({ ...p, lastName: e.target.value }))}
                        placeholder={isRTL ? 'الاسم الأخير' : 'Last Name'}
                        className={`input-field ${isRTL ? 'text-right' : ''}`}
                      />
                    </div>
                    <div className={isRTL ? 'text-right' : ''}>
                      <label className="input-label">{isRTL ? 'البريد الإلكتروني' : 'Email'}</label>
                      <input
                        value={displayEmail}
                        disabled
                        className={`input-field opacity-50 cursor-not-allowed ${isRTL ? 'text-right' : ''}`}
                      />
                    </div>
                    <div className={isRTL ? 'text-right' : ''}>
                      <label className="input-label">{isRTL ? 'رقم الهاتف' : 'Phone'}</label>
                      <input
                        value={profileForm.phone}
                        onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                        placeholder={isRTL ? 'رقم الهاتف' : 'Phone'}
                        className={`input-field ${isRTL ? 'text-right' : ''}`}
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleProfileSave}
                    disabled={profileLoading}
                    className={`btn-primary disabled:opacity-50 ${isRTL ? 'float-right' : ''}`}
                  >
                    {profileLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                    ) : (isRTL ? 'حفظ التغييرات' : 'Save Changes')}
                  </button>
                  <div className="clear-both" />
                </div>
              </div>
            )}

            {/* Chat Support */}
            {activeTab === 'chat' && (
              <div>
                <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-dark-text mb-6">
                  {isRTL ? 'الدعم الفني' : 'Chat Support'}
                </h1>
                <Link to="/chat" className="btn-primary inline-flex">
                  {isRTL ? 'فتح محادثة الدعم' : 'Open Support Chat'}
                </Link>
              </div>
            )}

            {activeTab === 'settings' && (
              <div>
                <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-dark-text mb-6">
                  {isRTL ? 'الإعدادات' : 'Settings'}
                </h1>
                <SettingsPanel />
              </div>
            )}

            {/* Generic tabs — addresses gets real UI; payment/notifications still coming soon */}
            {activeTab === 'addresses' && (
              <div>
                <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-dark-text mb-6">
                  {isRTL ? 'عناويني' : 'My Addresses'}
                </h1>
                <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6">
                  <div className={`flex items-center justify-between mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <h3 className="font-display font-bold text-brand-navy dark:text-white text-lg">
                      {isRTL ? 'عناوين التوصيل' : 'Saved Addresses'}
                    </h3>
                    <button onClick={() => setShowAddressForm(!showAddressForm)} className="btn-primary text-sm py-2 px-4">
                      {isRTL ? '+ إضافة عنوان' : '+ Add Address'}
                    </button>
                  </div>

                  {showAddressForm && (
                    <div className="bg-brand-cream dark:bg-dark-bg rounded-xl p-4 mb-4 space-y-3">
                      {[
                        { key: 'fullName', label: isRTL ? 'الاسم الكامل' : 'Full Name' },
                        { key: 'phone', label: isRTL ? 'رقم الهاتف' : 'Phone' },
                        { key: 'street', label: isRTL ? 'الشارع' : 'Street' },
                        { key: 'city', label: isRTL ? 'المدينة' : 'City' },
                      ].map(({ key, label }) => (
                        <input
                          key={key}
                          type="text"
                          placeholder={label}
                          value={addressForm[key]}
                          onChange={e => setAddressForm(p => ({ ...p, [key]: e.target.value }))}
                          className={`input-field dark:bg-dark-surface dark:border-dark-border dark:text-dark-text ${isRTL ? 'text-right' : ''}`}
                        />
                      ))}
                      <select
                        value={addressForm.governorate}
                        onChange={e => setAddressForm(p => ({ ...p, governorate: e.target.value }))}
                        className={`input-field dark:bg-dark-surface dark:border-dark-border dark:text-dark-text ${isRTL ? 'text-right' : ''}`}
                      >
                        {['Cairo', 'Alexandria', 'Giza', 'Luxor', 'Aswan', 'Hurghada',
                          'Port Said', 'Suez', 'Mansoura', 'Tanta', 'Zagazig', 'Ismailia',
                          'Damietta', 'Minya', 'Beni Suef', 'Fayoum', 'Sohag', 'Qena',
                          'Asyut', 'Kafr El Sheikh', 'Sharqia', 'Gharbia', 'Monufia',
                          'Beheira', 'Qalyubia', 'Dakahlia', 'North Sinai', 'South Sinai'
                        ].map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                      <div className="flex gap-2">
                        <button
                          onClick={addAddress}
                          disabled={addressLoading || !addressForm.fullName}
                          className="btn-primary flex-1 text-sm py-2 disabled:opacity-50"
                        >
                          {addressLoading ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                          ) : (isRTL ? 'حفظ' : 'Save')}
                        </button>
                        <button onClick={() => setShowAddressForm(false)} className="btn-outline flex-1 text-sm py-2">
                          {isRTL ? 'إلغاء' : 'Cancel'}
                        </button>
                      </div>
                    </div>
                  )}

                  {addresses.length === 0 ? (
                    <div className="text-center py-8">
                      <MapPin size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                      <p className="text-sm text-gray-500 dark:text-dark-muted">
                        {isRTL ? 'لا توجد عناوين محفوظة' : 'No saved addresses yet'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {addresses.map((addr, i) => (
                        <div key={addr._id || i} className={`flex items-start justify-between p-4 bg-brand-cream dark:bg-dark-bg rounded-xl ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <div className={isRTL ? 'text-right' : ''}>
                            <p className="font-semibold text-sm text-gray-900 dark:text-dark-text">{addr.fullName}</p>
                            <p className="text-xs text-gray-500 dark:text-dark-muted mt-1">{addr.street}, {addr.city}, {addr.governorate}</p>
                            <p className="text-xs text-gray-400 dark:text-dark-muted">{addr.phone}</p>
                          </div>
                          <button onClick={() => deleteAddress(addr._id)} className="text-red-400 hover:text-red-600 transition-colors p-1 flex-shrink-0">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div>
                <h1 className={`text-2xl font-display font-bold 
                  text-gray-900 dark:text-dark-text mb-6
                  ${isRTL ? 'text-right' : ''}`}>
                  {isRTL ? 'الإشعارات' : 'Notifications'}
                </h1>
                <NotificationsTab isRTL={isRTL} />
              </div>
            )}

            {/* Payment Tab */}
            {activeTab === 'payment' && (
              <div className="space-y-6">
                <h1
                  className={`text-2xl font-display font-bold text-gray-900 dark:text-dark-text ${
                    isRTL ? 'text-right' : ''
                  }`}
                >
                  {isRTL ? 'طرق الدفع' : 'Payment Methods'}
                </h1>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    {
                      icon: '💳',
                      name: isRTL ? 'باي موب' : 'Paymob',
                      subtitle: isRTL ? 'بطاقة ائتمان / خصم' : 'Credit / Debit Card',
                      badge: isRTL ? 'الأكثر شيوعاً' : 'Most Popular',
                      badgeClass:
                        'bg-brand-gold/15 text-brand-navy dark:bg-brand-gold/20 dark:text-brand-gold',
                      supports: isRTL
                        ? 'فيزا • ماستركارد • ميزة'
                        : 'Visa • Mastercard • Meeza',
                    },
                    {
                      icon: '🏧',
                      name: isRTL ? 'فوري' : 'Fawry',
                      subtitle: isRTL ? 'دفع نقدي في نقاط فوري' : 'Cash at Fawry outlets',
                      badge: isRTL ? 'كل مصر' : 'All Egypt',
                      badgeClass:
                        'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
                      supports: isRTL
                        ? 'أكثر من 300,000 نقطة'
                        : '300,000+ payment points',
                    },
                    {
                      icon: '🚚',
                      name: isRTL ? 'الدفع عند الاستلام' : 'Cash on Delivery',
                      subtitle: isRTL ? 'ادفع عند استلام طلبك' : 'Pay when your order arrives',
                      badge: isRTL ? 'بدون رسوم إضافية' : 'No extra fees',
                      badgeClass:
                        'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
                      supports: isRTL ? '27 محافظة' : '27 Governorates',
                    },
                  ].map((method) => (
                    <div
                      key={method.name}
                      className={`bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-5 flex flex-col ${
                        isRTL ? 'text-right' : ''
                      }`}
                    >
                      <div
                        className={`flex items-start justify-between gap-2 mb-4 ${
                          isRTL ? 'flex-row-reverse' : ''
                        }`}
                      >
                        <span className="text-3xl" aria-hidden>
                          {method.icon}
                        </span>
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${method.badgeClass}`}
                        >
                          {method.badge}
                        </span>
                      </div>
                      <h3 className="font-display font-bold text-gray-900 dark:text-dark-text text-lg">
                        {method.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-dark-muted mt-1">
                        {method.subtitle}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-dark-muted mt-4 pt-4 border-t border-gray-100 dark:border-dark-border">
                        {isRTL ? 'يدعم: ' : 'Supports: '}
                        {method.supports}
                      </p>
                    </div>
                  ))}
                </div>

                <div
                  className={`flex gap-3 bg-brand-navy/5 dark:bg-brand-gold/5 border border-brand-navy/10 dark:border-brand-gold/20 rounded-2xl p-4 ${
                    isRTL ? 'flex-row-reverse text-right' : ''
                  }`}
                >
                  <span className="text-xl flex-shrink-0" aria-hidden>
                    🔒
                  </span>
                  <p className="text-sm text-gray-600 dark:text-dark-muted">
                    {isRTL
                      ? 'جميع المعاملات مشفرة بتقنية SSL 256-bit. لا نخزن بيانات بطاقتك أبداً.'
                      : 'All transactions are encrypted with 256-bit SSL. We never store your card details.'}
                  </p>
                </div>

                <div>
                  <h3 className={`font-bold text-gray-900 dark:text-dark-text mb-3 ${isRTL ? 'text-right' : ''}`}>
                    {isRTL ? 'الكروت المحفوظة' : 'Saved Cards'}
                  </h3>

                  <div className="space-y-3 mb-3">
                    {savedCards.map(card => (
                      <div key={card.id} className={`bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-4 flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-12 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          card.type === 'Visa' ? 'bg-brand-navy' :
                          card.type === 'Mastercard' ? 'bg-purple-700' :
                          card.type === 'Meeza' ? 'bg-emerald-700' : 'bg-gray-700'
                        }`}>
                          <span className="text-white text-xs font-bold">
                            {card.type === 'Visa' ? 'VISA' : card.type === 'Mastercard' ? 'MC' : card.type === 'Meeza' ? 'M' : '💳'}
                          </span>
                        </div>
                        <div className={`flex-1 ${isRTL ? 'text-right' : ''}`}>
                          <p className="font-semibold text-gray-900 dark:text-dark-text text-sm">
                            •••• •••• •••• {card.last4}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-dark-muted">
                            {card.type} — {isRTL ? 'ينتهي' : 'Expires'} {card.expiry}
                          </p>
                        </div>
                        {card.isDefault ? (
                          <span className="text-xs bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded-full font-semibold flex-shrink-0">
                            {isRTL ? 'افتراضي' : 'Default'}
                          </span>
                        ) : (
                          <button onClick={() => handleSetDefault(card.id)} className="text-xs text-brand-navy dark:text-brand-gold font-semibold hover:underline flex-shrink-0">
                            {isRTL ? 'تعيين افتراضي' : 'Set Default'}
                          </button>
                        )}
                        <button onClick={() => handleDeleteCard(card.id)} className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>

                  {!showAddCard ? (
                    <button
                      onClick={() => setShowAddCard(true)}
                      className="w-full border-2 border-dashed border-gray-200 dark:border-dark-border rounded-2xl p-4 flex items-center justify-center gap-3 hover:border-brand-gold hover:bg-brand-gold/5 transition-all"
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-dark-bg flex items-center justify-center">
                        <span className="text-gray-400 text-xl">+</span>
                      </div>
                      <div className={isRTL ? 'text-right' : ''}>
                        <p className="font-semibold text-gray-700 dark:text-dark-text text-sm">
                          {isRTL ? 'إضافة كارت جديد' : 'Add New Card'}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-dark-muted">Visa, Mastercard, Meeza</p>
                      </div>
                    </button>
                  ) : (
                    <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-5">
                      <h4 className={`font-bold text-gray-900 dark:text-dark-text mb-4 ${isRTL ? 'text-right' : ''}`}>
                        {isRTL ? 'إضافة كارت جديد' : 'Add New Card'}
                      </h4>
                      <div className={`space-y-3 ${isRTL ? 'text-right' : ''}`}>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 dark:text-dark-muted mb-1">
                            {isRTL ? 'رقم الكارت' : 'Card Number'}
                          </label>
                          <input
                            value={cardForm.number}
                            onChange={e => setCardForm(p => ({ ...p, number: formatCardNumber(e.target.value) }))}
                            placeholder="1234 5678 9012 3456"
                            maxLength={19}
                            className={`w-full rounded-xl border ${cardErrors.number ? 'border-red-400' : 'border-gray-200 dark:border-dark-border'} bg-gray-50 dark:bg-dark-bg px-4 py-2.5 text-sm outline-none focus:border-brand-gold dark:text-white`}
                          />
                          {cardErrors.number && <p className="text-red-400 text-xs mt-1">{cardErrors.number}</p>}
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 dark:text-dark-muted mb-1">
                            {isRTL ? 'الاسم على الكارت' : 'Name on Card'}
                          </label>
                          <input
                            value={cardForm.name}
                            onChange={e => setCardForm(p => ({ ...p, name: e.target.value }))}
                            placeholder={isRTL ? 'الاسم كما يظهر على الكارت' : 'As it appears on card'}
                            className={`w-full rounded-xl border ${cardErrors.name ? 'border-red-400' : 'border-gray-200 dark:border-dark-border'} bg-gray-50 dark:bg-dark-bg px-4 py-2.5 text-sm outline-none focus:border-brand-gold dark:text-white`}
                          />
                          {cardErrors.name && <p className="text-red-400 text-xs mt-1">{cardErrors.name}</p>}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 dark:text-dark-muted mb-1">
                              {isRTL ? 'تاريخ الانتهاء' : 'Expiry Date'}
                            </label>
                            <input
                              value={cardForm.expiry}
                              onChange={e => setCardForm(p => ({ ...p, expiry: formatExpiry(e.target.value) }))}
                              placeholder="MM/YY"
                              maxLength={5}
                              className={`w-full rounded-xl border ${cardErrors.expiry ? 'border-red-400' : 'border-gray-200 dark:border-dark-border'} bg-gray-50 dark:bg-dark-bg px-4 py-2.5 text-sm outline-none focus:border-brand-gold dark:text-white`}
                            />
                            {cardErrors.expiry && <p className="text-red-400 text-xs mt-1">{cardErrors.expiry}</p>}
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 dark:text-dark-muted mb-1">CVV</label>
                            <input
                              value={cardForm.cvv}
                              onChange={e => setCardForm(p => ({ ...p, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                              placeholder="123"
                              maxLength={4}
                              type="password"
                              className={`w-full rounded-xl border ${cardErrors.cvv ? 'border-red-400' : 'border-gray-200 dark:border-dark-border'} bg-gray-50 dark:bg-dark-bg px-4 py-2.5 text-sm outline-none focus:border-brand-gold dark:text-white`}
                            />
                            {cardErrors.cvv && <p className="text-red-400 text-xs mt-1">{cardErrors.cvv}</p>}
                          </div>
                        </div>
                        <div className={`flex gap-3 pt-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <button onClick={handleAddCard} className="flex-1 btn-primary text-sm">
                            {isRTL ? 'إضافة الكارت' : 'Add Card'}
                          </button>
                          <button onClick={() => { setShowAddCard(false); setCardErrors({}); }} className="flex-1 btn-outline text-sm">
                            {isRTL ? 'إلغاء' : 'Cancel'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tracking Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-dark-surface rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto relative"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <h2 className="text-xl font-display font-bold text-gray-900 dark:text-dark-text">
                      {isRTL ? 'تفاصيل الطلب' : 'Order Details'}
                    </h2>
                    <p className="font-mono text-sm text-brand-gold mt-1">
                      #{((selectedOrder._id || selectedOrder.id || selectedOrder.orderId || '').toString()).slice(-6).toUpperCase()}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(selectedOrder.createdAt || selectedOrder.date || Date.now()).toLocaleDateString()}
                    </p>
                  </div>
                  <button onClick={() => { setSelectedOrder(null); setOrderDetail(null); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-dark-text p-1">
                    <X size={20} />
                  </button>
                </div>

                {detailLoading ? (
                  <div className="flex justify-center items-center py-12">
                    <RefreshCw className="animate-spin text-brand-gold" size={32} />
                  </div>
                ) : orderDetail ? (
                  <div className="space-y-6">
                    {/* Timeline */}
                    <div className={`space-y-4 ${isRTL ? 'text-right' : 'text-left'}`}>
                      {(() => {
                        const status = (orderDetail.status || orderDetail.orderStatus || 'pending').toLowerCase();
                        const steps = [
                          { id: 'placed', label: isRTL ? 'تم الطلب' : 'Order Placed', done: true },
                          { id: 'processing', label: isRTL ? 'جاري المعالجة' : 'Processing', done: ['processing', 'shipped', 'delivered'].includes(status) },
                          { id: 'shipped', label: isRTL ? 'تم الشحن' : 'Shipped', done: ['shipped', 'delivered'].includes(status) },
                          { id: 'out_for_delivery', label: isRTL ? 'في الطريق إليك' : 'Out for Delivery', done: ['shipped', 'delivered'].includes(status) },
                          { id: 'delivered', label: isRTL ? 'تم التوصيل' : 'Delivered', done: status === 'delivered' }
                        ];
                        return steps.map((step, idx) => (
                          <div key={step.id} className={`flex ${isRTL ? 'flex-row-reverse' : 'flex-row'} items-center`}>
                            <div className="relative flex flex-col items-center">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${step.done ? 'bg-brand-gold text-white' : 'border-2 border-gray-300 dark:border-dark-border text-transparent'}`}>
                                {step.done && <CheckCircle size={14} />}
                              </div>
                              {idx < steps.length - 1 && (
                                <div className={`w-0.5 h-8 ${steps[idx + 1].done ? 'bg-brand-gold' : 'bg-gray-200 dark:bg-dark-border'}`}></div>
                              )}
                            </div>
                            <div className={`${isRTL ? 'mr-4' : 'ml-4'} pb-8`}>
                              <p className={`text-sm font-medium ${step.done ? 'text-gray-900 dark:text-dark-text' : 'text-gray-400 dark:text-dark-muted'}`}>{step.label}</p>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>

                    {/* Items */}
                    <div className={`border-t border-gray-100 dark:border-dark-border pt-4 ${isRTL ? 'text-right' : 'text-left'}`}>
                      <h3 className="font-semibold text-gray-900 dark:text-dark-text mb-3">{isRTL ? 'المنتجات' : 'Order Items'}</h3>
                      <div className="space-y-3">
                        {(orderDetail.items || orderDetail.products || []).map((item, idx) => (
                          <div key={idx} className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <div className="w-10 h-10 bg-gray-50 dark:bg-dark-bg rounded-lg flex items-center justify-center text-xl">
                              📦
                            </div>
                            <div className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                              <p className="text-sm font-medium text-gray-900 dark:text-dark-text">{item.product?.name || item.name || 'Product'}</p>
                              <p className="text-xs text-gray-500">{(item.quantity || 1)} × {(item.price || item.salePrice || 0).toLocaleString()} {t('common.egp')}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Address */}
                    <div className={`border-t border-gray-100 dark:border-dark-border pt-4 ${isRTL ? 'text-right' : 'text-left'}`}>
                      <div className={`flex items-start gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <MapPin size={18} className="text-gray-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-dark-text mb-1">{isRTL ? 'عنوان التوصيل' : 'Shipping Address'}</h3>
                          {orderDetail.shippingAddress ? (
                            <p className="text-sm text-gray-600 dark:text-dark-muted leading-relaxed">
                              {orderDetail.shippingAddress.fullName}<br />
                              {orderDetail.shippingAddress.street}, {orderDetail.shippingAddress.city}<br />
                              {orderDetail.shippingAddress.governorate}, {orderDetail.shippingAddress.country}<br />
                              {orderDetail.shippingAddress.phone}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-600 dark:text-dark-muted">N/A</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Payment */}
                    <div className={`border-t border-gray-100 dark:border-dark-border pt-4 flex justify-between items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 mb-1">{isRTL ? 'الإجمالي' : 'Total Amount'}</span>
                        <span className="font-bold text-lg text-gray-900 dark:text-dark-text">
                          {(orderDetail.totalAmount || orderDetail.total || orderDetail.amount || 0).toLocaleString()} {t('common.egp')}
                        </span>
                      </div>
                      <div>
                        <span className="px-3 py-1 bg-gray-100 dark:bg-dark-bg text-gray-600 dark:text-dark-text rounded-lg text-xs font-medium">
                          {orderDetail.paymentMethod || 'Cash on Delivery'}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className={`border-t border-gray-100 dark:border-dark-border pt-4 flex gap-2 flex-wrap ${isRTL ? 'justify-start flex-row-reverse' : 'justify-end'}`}>
                      {canReorder(orderDetail.status || orderDetail.orderStatus) && (
                        <button
                          onClick={() => handleReorder(orderDetail._id || orderDetail.id)}
                          disabled={reorderLoading === (orderDetail._id || orderDetail.id)}
                          className="text-xs px-3 py-1.5 bg-brand-gold/10 text-brand-gold hover:bg-brand-gold/20 rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                          {reorderLoading === (orderDetail._id || orderDetail.id) ? (
                            <div className="w-3 h-3 border-2 border-brand-gold border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>🔄 {isRTL ? 'إعادة الطلب' : 'Reorder'}</>
                          )}
                        </button>
                      )}
                      {['pending', 'processing'].includes((orderDetail.status || orderDetail.orderStatus || 'pending').toLowerCase()) && (
                        <button
                          disabled={cancellingId === (orderDetail._id || orderDetail.id)}
                          onClick={() => {
                            if (window.confirm(isRTL ? 'هل أنت متأكد من إلغاء هذا الطلب؟' : 'Are you sure you want to cancel this order?')) {
                              cancelOrder(orderDetail._id || orderDetail.id);
                            }
                          }}
                          className="border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl px-4 py-2 text-sm disabled:opacity-50 flex items-center gap-2"
                        >
                          {cancellingId === (orderDetail._id || orderDetail.id) && <RefreshCw size={14} className="animate-spin" />}
                          {isRTL ? 'إلغاء الطلب' : 'Cancel Order'}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-gray-500">
                    {isRTL ? 'حدث خطأ' : 'Something went wrong'}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
