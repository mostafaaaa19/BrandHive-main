import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Store, Package, DollarSign, Search as SearchIcon,
  Flag, Target, Settings, Bell, FileText, LogOut, CheckCircle, Eye, BarChart3, XCircle
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { adminAPI, productsAPI } from '../../services/api';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import toast from 'react-hot-toast';
import SettingsPanel from '../../components/SettingsPanel';

const monthlyData = [
  { month: 'Sep', gmv: 1800000, orders: 12000 },
  { month: 'Oct', gmv: 2100000, orders: 14200 },
  { month: 'Nov', gmv: 1950000, orders: 13100 },
  { month: 'Dec', gmv: 2800000, orders: 18900 },
  { month: 'Jan', gmv: 2200000, orders: 15000 },
  { month: 'Feb', gmv: 2350000, orders: 15900 },
  { month: 'Mar', gmv: 2400000, orders: 18240 },
];

const monthlyDataAr = [
  { month: 'سبتمبر', gmv: 1800000, orders: 12000 },
  { month: 'أكتوبر', gmv: 2100000, orders: 14200 },
  { month: 'نوفمبر', gmv: 1950000, orders: 13100 },
  { month: 'ديسمبر', gmv: 2800000, orders: 18900 },
  { month: 'يناير', gmv: 2200000, orders: 15000 },
  { month: 'فبراير', gmv: 2350000, orders: 15900 },
  { month: 'مارس', gmv: 2400000, orders: 18240 },
];

const pendingSellers = [
  { id: 1, seller: 'Amira S.', brand: 'Desert Rose Textiles', category: 'Fashion', location: 'Assiut', submitted: 'Mar 9, 2025' },
  { id: 2, seller: 'Bassem K.', brand: 'Nubian Colors', category: 'Art', location: 'Aswan', submitted: 'Mar 8, 2025' },
  { id: 3, seller: 'Yasmine T.', brand: 'Cairo Clay Studio', category: 'Pottery', location: 'New Cairo', submitted: 'Mar 7, 2025' },
  { id: 4, seller: 'Kareem N.', brand: 'Nile Textiles Co.', category: 'Handmade', location: 'Alexandria', submitted: 'Mar 6, 2025' },
];

const categoryData = [
  { name: 'Fashion', value: 35 },
  { name: 'Jewelry', value: 18 },
  { name: 'Handmade', value: 22 },
  { name: 'Home Decor', value: 15 },
  { name: 'Organic', value: 10 },
];

const categoryDataAr = [
  { name: 'موضة', value: 35 },
  { name: 'مجوهرات', value: 18 },
  { name: 'يدوي', value: 22 },
  { name: 'ديكور', value: 15 },
  { name: 'عضوي', value: 10 },
];

const COLORS = ['#1A2040', '#C8922A', '#7C3AED', '#06B6D4', '#84CC16'];

function SidebarItem({ icon: Icon, label, tab, activeTab, setActiveTab, badge, isRTL }) {
  return (
    <button onClick={() => setActiveTab(tab)} className={`${activeTab === tab ? 'sidebar-item-active' : 'sidebar-item'} ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
      <Icon size={16} />
      <span>{label}</span>
      {badge > 0 && (
        <span className={`${isRTL ? 'mr-auto ml-0' : 'ml-auto mr-0'} bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full`}>{badge}</span>
      )}
    </button>
  );
}

function AdminUsersTab({ adminAPI, isRTL, toast }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState('all');

  const fetchUsers = async (p = 1, role = 'all') => {
    setLoading(true);
    try {
      const params = { page: p, limit: 15 };
      if (role !== 'all') params.role = role;
      const res = await adminAPI.getUsers(params);
      const data = res.data?.data || res.data?.users || [];
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleToggle = async (userId) => {
    try {
      await adminAPI.toggleUser(userId);
      toast.success(isRTL 
        ? 'تم تحديث الحالة ✅' 
        : 'Status updated ✅'
      );
      fetchUsers(page, roleFilter);
    } catch {
      toast.error(isRTL 
        ? 'فشل التحديث' 
        : 'Failed to update'
      );
    }
  };

  const ROLE_FILTERS = [
    { value: 'all', label: isRTL ? 'الكل' : 'All' },
    { value: 'customer', label: isRTL ? 'العملاء' : 'Customers' },
    { value: 'seller', label: isRTL ? 'البائعين' : 'Sellers' },
    { value: 'admin', label: isRTL ? 'المشرفين' : 'Admins' },
  ];

  return (
    <div>
      <h1 className={`text-2xl font-display font-bold 
        text-gray-900 dark:text-dark-text mb-6
        ${isRTL ? 'text-right' : ''}`}>
        {isRTL ? 'إدارة المستخدمين' : 'Users Management'}
      </h1>

      <div className={`flex gap-2 mb-4 flex-wrap
        ${isRTL ? 'flex-row-reverse' : ''}`}>
        {ROLE_FILTERS.map(f => (
          <button key={f.value}
            onClick={() => {
              setRoleFilter(f.value);
              fetchUsers(1, f.value);
            }}
            className={`px-3 py-1.5 rounded-lg text-sm 
              font-medium transition-colors ${
              roleFilter === f.value
                ? 'bg-brand-navy dark:bg-brand-gold text-white dark:text-brand-navy'
                : 'bg-white dark:bg-dark-surface text-gray-600 dark:text-dark-muted border border-gray-200 dark:border-dark-border'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-dark-surface 
        rounded-2xl shadow-card dark:shadow-none 
        dark:border dark:border-dark-border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-6 h-6 border-2 
              border-brand-gold border-t-transparent 
              rounded-full animate-spin mx-auto" />
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            {isRTL ? 'لا يوجد مستخدمون' : 'No users found'}
          </div>
        ) : (
          <table className={`w-full text-sm 
            ${isRTL ? 'text-right' : 'text-left'}`}>
            <thead className="bg-gray-50 dark:bg-dark-bg">
              <tr>
                {[
                  isRTL ? 'الاسم' : 'Name',
                  isRTL ? 'البريد' : 'Email',
                  isRTL ? 'الدور' : 'Role',
                  isRTL ? 'الحالة' : 'Status',
                  isRTL ? 'إجراء' : 'Action',
                ].map(h => (
                  <th key={h} className="px-4 py-3 
                    text-xs font-bold text-gray-400 
                    dark:text-dark-muted uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 
              dark:divide-dark-border">
              {users.map((u, i) => (
                <tr key={u._id || u.id || i}
                  className="hover:bg-gray-50/50 
                    dark:hover:bg-dark-bg/50">
                  <td className="px-4 py-3 font-medium 
                    dark:text-dark-text">
                    {u.name}
                  </td>
                  <td className="px-4 py-3 text-gray-500 
                    dark:text-dark-muted text-xs">
                    {u.email}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full 
                      text-[10px] font-bold ${
                      u.role === 'admin' 
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400'
                        : u.role === 'seller'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full 
                      text-[10px] font-bold ${
                      u.isBlocked
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                    }`}>
                      {u.isBlocked 
                        ? (isRTL ? 'محظور' : 'Blocked')
                        : (isRTL ? 'نشط' : 'Active')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => 
                        handleToggle(u._id || u.id)
                      }
                      className={`text-xs px-3 py-1 
                        rounded-lg font-medium 
                        transition-colors ${
                        u.isBlocked
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400'
                          : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400'
                      }`}>
                      {u.isBlocked 
                        ? (isRTL ? 'رفع الحظر' : 'Unblock')
                        : (isRTL ? 'حظر' : 'Block')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function AdminOrdersTab({ adminAPI, isRTL }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await adminAPI.getAllOrders?.() || 
          { data: { data: [] } };
        const data = res.data?.data || 
                     res.data?.orders || [];
        setOrders(Array.isArray(data) ? data : []);
      } catch {
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return (
    <div>
      <h1 className={`text-2xl font-display font-bold 
        text-gray-900 dark:text-dark-text mb-6
        ${isRTL ? 'text-right' : ''}`}>
        {isRTL ? 'إدارة الطلبات' : 'Orders Management'}
      </h1>
      <div className="bg-white dark:bg-dark-surface 
        rounded-2xl shadow-card dark:shadow-none 
        dark:border dark:border-dark-border p-6">
        {loading ? (
          <div className="text-center py-8">
            <div className="w-6 h-6 border-2 
              border-brand-gold border-t-transparent 
              rounded-full animate-spin mx-auto" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-8">
            <Package className="mx-auto text-gray-300 mb-3" 
              size={40} />
            <p className="text-gray-500 dark:text-dark-muted">
              {isRTL ? 'لا توجد طلبات' : 'No orders yet'}
            </p>
          </div>
        ) : (
          <table className={`w-full text-sm 
            ${isRTL ? 'text-right' : 'text-left'}`}>
            <thead>
              <tr className="border-b border-gray-100 
                dark:border-dark-border">
                {[
                  isRTL ? 'رقم الطلب' : 'Order ID',
                  isRTL ? 'العميل' : 'Customer',
                  isRTL ? 'المبلغ' : 'Amount',
                  isRTL ? 'طريقة الدفع' : 'Payment',
                  isRTL ? 'الحالة' : 'Status',
                  isRTL ? 'التاريخ' : 'Date',
                ].map(h => (
                  <th key={h} className="pb-3 px-2 
                    text-xs font-bold text-gray-400 
                    dark:text-dark-muted uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((order, i) => (
                <tr key={order._id || i} 
                  className="border-b border-gray-50 
                    dark:border-dark-border last:border-0">
                  <td className="py-3 px-2 font-mono 
                    text-xs text-brand-gold">
                    #{(order._id || '').slice(-6)}
                  </td>
                  <td className="py-3 px-2 dark:text-dark-text">
                    {order.user?.name || 'Customer'}
                  </td>
                  <td className="py-3 px-2 font-semibold 
                    dark:text-dark-text">
                    {(order.totalAmount || 0).toLocaleString()} EGP
                  </td>
                  <td className="py-3 px-2 text-gray-500 
                    dark:text-dark-muted capitalize">
                    {order.paymentMethod || '-'}
                  </td>
                  <td className="py-3 px-2">
                    <span className="px-2 py-1 rounded-full 
                      text-[10px] font-bold bg-amber-100 
                      text-amber-700">
                      {order.status || 'pending'}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-gray-400 
                    dark:text-dark-muted text-xs">
                    {order.createdAt 
                      ? new Date(order.createdAt)
                          .toLocaleDateString()
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function AdminProductsTab({ adminAPI, isRTL }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await productsAPI.getAll({ 
          page: 1, limit: 50 
        });
        const data = res.data?.data || [];
        setProducts(Array.isArray(data) ? data : []);
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return (
    <div>
      <h1 className={`text-2xl font-display font-bold 
        text-gray-900 dark:text-dark-text mb-6
        ${isRTL ? 'text-right' : ''}`}>
        {isRTL ? 'إدارة المنتجات' : 'Products Management'}
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 
        lg:grid-cols-3 gap-4">
        {loading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="h-48 bg-gray-100 
              dark:bg-dark-surface rounded-2xl 
              animate-pulse" />
          ))
        ) : products.length === 0 ? (
          <div className="col-span-3 text-center py-8 
            text-gray-400">
            {isRTL ? 'لا توجد منتجات' : 'No products'}
          </div>
        ) : (
          products.map((product, i) => (
            <div key={product._id || product.id || i}
              className="bg-white dark:bg-dark-surface 
                rounded-2xl shadow-card dark:shadow-none 
                dark:border dark:border-dark-border 
                overflow-hidden">
              <div className="h-32 bg-gray-100 
                dark:bg-dark-bg overflow-hidden">
                {product.mainImage || product.images?.[0] ? (
                  <img 
                    src={product.mainImage || product.images[0]}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex 
                    items-center justify-center text-3xl">
                    📦
                  </div>
                )}
              </div>
              <div className={`p-3 ${isRTL ? 'text-right' : ''}`}>
                <p className="font-medium text-sm 
                  text-gray-900 dark:text-dark-text truncate">
                  {product.name}
                </p>
                <p className="text-xs text-brand-gold 
                  font-bold mt-1">
                  {(product.finalPrice || product.price || 0)
                    .toLocaleString()} EGP
                </p>
                <div className={`flex items-center 
                  justify-between mt-2
                  ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="text-xs text-gray-400">
                    {product.brand?.name || ''}
                  </span>
                  <span className="text-xs px-2 py-0.5 
                    rounded-full bg-emerald-100 
                    text-emerald-700 font-medium">
                    {product.isActive !== false 
                      ? (isRTL ? 'نشط' : 'Active')
                      : (isRTL ? 'غير نشط' : 'Inactive')}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboard, setDashboard] = useState(null);
  const [users, setUsers] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adminAnalytics, setAdminAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const dashRes = await adminAPI.getDashboard();
        setDashboard(dashRes.data?.data || dashRes.data || {});
      } catch {
        setDashboard(null);
      }

      try {
        const userRes = await adminAPI.getUsers();
        setUsers(userRes.data?.data || userRes.data?.users || []);
      } catch {
        setUsers([]);
      }

      try {
        const brandRes = await adminAPI.getBrandRequests();
        setBrands(brandRes.data?.data || brandRes.data?.brands || []);
      } catch {
        try {
          const brandResFallback = await adminAPI.getBrands();
          setBrands(brandResFallback.data?.data || brandResFallback.data?.brands || []);
        } catch {
          setBrands([]);
        }
      }
      try {
        setAnalyticsLoading(true);
        const [revenueRes, topProductsRes, topCustomersRes] = await Promise.allSettled([
          adminAPI.getRevenue('month'),
          adminAPI.getTopProducts(),
          adminAPI.getTopCustomers(),
        ]);
        setAdminAnalytics({
          revenue: revenueRes.status === 'fulfilled'
            ? (revenueRes.value.data?.data || revenueRes.value.data || null)
            : null,
          topProducts: topProductsRes.status === 'fulfilled'
            ? (topProductsRes.value.data?.data || topProductsRes.value.data || [])
            : [],
          topCustomers: topCustomersRes.status === 'fulfilled'
            ? (topCustomersRes.value.data?.data || topCustomersRes.value.data || [])
            : [],
        });
      } catch {
        setAdminAnalytics(null);
      } finally {
        setAnalyticsLoading(false);
      }

      setLoading(false);
    };
    fetchData();
  }, []);

  const sellers = brands.filter(b => !b.isVerified);

  const approveSeller = async (id) => {
    try {
      await adminAPI.approveBrandRequest(id);
      setBrands(prev => prev.map(b =>
        (b._id === id || b.id === id) ? { ...b, isVerified: true } : b
      ));
      toast.success(
        isRTL ? 'تم قبول البائع وإرسال إشعار!' : 'Seller approved and notified!',
        { icon: '✅', style: { borderRadius: '12px', fontFamily: isRTL ? 'Cairo' : 'Inter' } }
      );
    } catch (err) {
      toast.error(
        err.response?.data?.message || (isRTL ? 'فشل قبول الطلب' : 'Failed to approve'),
        { style: { borderRadius: '12px' } }
      );
    }
  };

  const rejectSeller = async (id) => {
    try {
      await adminAPI.rejectBrandRequest(id);
      setBrands(prev => prev.filter(b => b._id !== id && b.id !== id));
      toast.error(
        isRTL ? 'تم رفض طلب البائع.' : 'Seller application rejected.',
        { style: { borderRadius: '12px', fontFamily: isRTL ? 'Cairo' : 'Inter' } }
      );
    } catch (err) {
      toast.error(
        err.response?.data?.message || (isRTL ? 'فشل رفض الطلب' : 'Failed to reject'),
        { style: { borderRadius: '12px' } }
      );
    }
  };

  const navSections = [
    {
      label: isRTL ? 'المنصة' : 'Platform',
      items: [
        { icon: LayoutDashboard, label: isRTL ? 'نظرة عامة' : 'Overview', tab: 'overview' },
        { icon: Users, label: isRTL ? 'المستخدمين' : 'Users', tab: 'users' },
        { icon: Store, label: isRTL ? 'البائعين' : 'Sellers', tab: 'sellers', badge: sellers.length },
        { icon: Package, label: isRTL ? 'الطلبات' : 'Orders', tab: 'orders' },
        { icon: DollarSign, label: isRTL ? 'الأرباح' : 'Revenue', tab: 'revenue' },
      ],
    },
    {
      label: isRTL ? 'الرقابة' : 'Moderation',
      items: [
        { icon: SearchIcon, label: isRTL ? 'مراجعة المنتجات' : 'Review Products', tab: 'products' },
        { icon: Flag, label: isRTL ? 'البلاغات' : 'Reports', tab: 'reports' },
        { icon: Target, label: isRTL ? 'الخانات المميزة' : 'Featured Slots', tab: 'featured' },
      ],
    },
    {
      label: isRTL ? 'النظام' : 'System',
      items: [
        { icon: Settings, label: isRTL ? 'الإعدادات' : 'Settings', tab: 'settings' },
        { icon: Bell, label: isRTL ? 'التنبيهات' : 'Notifications', tab: 'notifications' },
        { icon: FileText, label: isRTL ? 'سجل العمليات' : 'Audit Log', tab: 'audit' },
      ],
    },
  ];

  return (
    <div className={`min-h-screen bg-brand-cream dark:bg-dark-bg transition-colors duration-200 ${isRTL ? 'text-right' : 'text-left'}`}>
      <div className="page-container py-8">
        <div className={`flex gap-8 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {/* Sidebar */}
          <aside className="hidden md:block w-56 flex-shrink-0">
            <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-4 sticky top-24">
              {/* Admin badge */}
              <div className={`flex items-center gap-2 p-3 mb-4 bg-brand-navy/5 dark:bg-brand-gold/5 rounded-2xl ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className="w-9 h-9 rounded-xl bg-brand-navy dark:bg-brand-gold flex items-center justify-center flex-shrink-0">
                  <span className="text-white dark:text-brand-navy font-bold text-sm">A</span>
                </div>
                <div className={isRTL ? 'text-right' : ''}>
                  <p className="font-semibold text-gray-900 dark:text-dark-text text-sm">{isRTL ? 'لوحة التحكم' : 'Admin Console'}</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">● {isRTL ? 'نشط' : 'Active'}</p>
                </div>
              </div>

              {navSections.map(section => (
                <div key={section.label} className="mb-4">
                  <p className={`text-xs font-bold text-gray-400 dark:text-dark-muted uppercase tracking-wider px-4 mb-2 ${isRTL ? 'text-right' : ''}`}>{section.label}</p>
                  {section.items.map(item => (
                    <SidebarItem key={item.tab} {...item} activeTab={activeTab} setActiveTab={setActiveTab} isRTL={isRTL} />
                  ))}
                </div>
              ))}

              <div className="border-t border-gray-100 dark:border-dark-border pt-3">
                <button onClick={() => { logout(); navigate('/'); }} className={`sidebar-item text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 w-full ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                  <LogOut size={16} /> {isRTL ? 'تسجيل الخروج' : 'Sign Out'}
                </button>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {activeTab === 'overview' && (
              <div>
                <div className={`flex items-center justify-between mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className={isRTL ? 'text-right' : ''}>
                    <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-dark-text">{isRTL ? 'لوحة تحكم المشرف' : 'Admin Console'}</h1>
                    <p className="text-gray-500 dark:text-dark-muted mt-0.5">{isRTL ? 'مقاييس المنصة بالوقت الفعلي — 10 مارس 2025' : 'Real-time platform metrics — March 10, 2025'}</p>
                  </div>
                  <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <button className="btn-ghost text-sm flex items-center gap-1">
                      📤 {isRTL ? 'تصدير' : 'Export'}
                    </button>
                    <button className="btn-primary text-sm flex items-center gap-1">
                      🔍 {isRTL ? 'تشغيل تقرير' : 'Run Report'}
                    </button>
                  </div>
                </div>

                {/* Stats */}
                <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  {[
                    { icon: Users, label: isRTL ? 'المستخدمين المسجلين' : 'Registered Users', value: (dashboard?.usersCount || users.length || 0).toLocaleString(), change: '+0%', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400', trend: '↑' },
                    { icon: Store, label: isRTL ? 'البائعين النشطين' : 'Active Sellers', value: (dashboard?.brandsCount || brands.length || 0).toLocaleString(), change: '+0', color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400', trend: '↑' },
                    { icon: DollarSign, label: isRTL ? 'حجم المبيعات' : 'GMV (Mar)', value: (dashboard?.totalSales || 0).toLocaleString() + ' EGP', change: '+0%', color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400', trend: '↑' },
                    { icon: Package, label: isRTL ? 'طلبات الشهر' : 'Orders This Month', value: (dashboard?.ordersCount || 0).toLocaleString(), change: '+0%', color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400', trend: '↑' },
                  ].map(stat => (
                    <div key={stat.label} className={`bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-5 ${isRTL ? 'text-right' : ''}`}>
                      <div className={`w-10 h-10 rounded-xl ${stat.color} flex items-center justify-center mb-3 ${isRTL ? 'mr-0 ml-auto' : ''}`}>
                        <stat.icon size={18} />
                      </div>
                      <div className="text-2xl font-display font-bold text-gray-900 dark:text-dark-text">{stat.value}</div>
                      <div className="text-[10px] text-gray-500 dark:text-dark-muted mt-0.5 uppercase font-bold">{stat.label}</div>
                      <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1">{stat.trend} {stat.change}</div>
                    </div>
                  ))}
                </div>

                {/* Charts Row */}
                <div className={`grid lg:grid-cols-3 gap-6 mb-6 ${isRTL ? 'lg:flex-row-reverse' : ''}`}>
                  {/* GMV Chart */}
                  <div className="lg:col-span-2 bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6">
                    <h3 className="font-display font-bold text-gray-900 dark:text-dark-text mb-4">
                      {isRTL ? 'حجم المبيعات والطلبات — آخر 7 أشهر' : 'GMV & Orders — Last 7 Months'}
                    </h3>
                    <div className={isRTL ? 'direction-ltr' : ''}>
                      {dashboard?.chartData ? (
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={dashboard.chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:opacity-10" />
                            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} reversed={isRTL} />
                            <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} orientation={isRTL ? 'right' : 'left'} />
                            <Tooltip
                              formatter={(v, n) => [n === 'gmv' ? `${(v/1000).toFixed(1)}K ${t('common.egp')}` : v.toLocaleString(), n === 'gmv' ? (isRTL ? 'المبيعات' : 'GMV') : (isRTL ? 'الطلبات' : 'Orders')]}
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', backgroundColor: '#1e293b' }}
                              itemStyle={{ color: '#fff' }}
                            />
                            <Bar dataKey="gmv" radius={[6, 6, 0, 0]} name="gmv" className="text-brand-navy dark:text-brand-gold" fill="currentColor" />
                            <Bar dataKey="orders" fill="#C8922A" radius={[6, 6, 0, 0]} name="orders" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm italic">
                          {isRTL ? 'ستظهر الإحصائيات عند توفر بيانات المبيعات' : 'Analytics will appear when sales data is available'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Category Breakdown */}
                  <div className={`bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6 ${isRTL ? 'text-right' : ''}`}>
                    <h3 className="font-display font-bold text-gray-900 dark:text-dark-text mb-4">{isRTL ? 'توزيع الفئات' : 'Category Breakdown'}</h3>
                    <div className={isRTL ? 'direction-ltr' : ''}>
                      {dashboard?.categories ? (
                        <ResponsiveContainer width="100%" height={150}>
                          <PieChart>
                            <Pie data={dashboard.categories} cx="50%" cy="50%" outerRadius={65} dataKey="value">
                              {dashboard.categories.map((_, index) => (
                                <Cell key={index} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v) => [`${v}%`]} contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: '#1e293b', color: '#fff' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[150px] flex items-center justify-center text-gray-400 text-xs italic">
                          No category data
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5 mt-2">
                      {(isRTL ? categoryDataAr : categoryData).map((item, i) => (
                        <div key={item.name} className={`flex items-center justify-between text-xs ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <div className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }}></div>
                            <span className="text-gray-600 dark:text-dark-muted">{item.name}</span>
                          </div>
                          <span className="font-semibold text-gray-900 dark:text-dark-text">{item.value}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Pending Seller Approvals */}
                <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6">
                  <div className={`flex items-center justify-between mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <h3 className="font-display font-bold text-gray-900 dark:text-dark-text">
                      {isRTL ? 'طلبات انضمام بائعين قيد المراجعة' : 'Pending Seller Approvals'}
                      <span className={`mx-2 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-[10px] rounded-full font-bold`}>
                        {sellers.length} {isRTL ? 'في انتظار المراجعة' : 'awaiting review'}
                      </span>
                    </h3>
                  </div>

                  {sellers.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle className="mx-auto text-emerald-400 mb-2" size={40} />
                      <p className="text-gray-500 dark:text-dark-muted">{isRTL ? 'كل شيء تمام! لا توجد طلبات معلقة.' : 'All caught up! No pending approvals.'}</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className={`w-full text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
                        <thead>
                          <tr className="border-b border-gray-100 dark:border-dark-border">
                            {[
                              isRTL ? 'البائع' : 'Seller',
                              isRTL ? 'الماركة' : 'Brand',
                              isRTL ? 'الفئة' : 'Category',
                              isRTL ? 'الموقع' : 'Location',
                              isRTL ? 'تاريخ التقديم' : 'Submitted',
                              isRTL ? 'إجراء' : 'Action'
                            ].map(h => (
                              <th key={h} className="text-xs font-semibold text-gray-400 dark:text-dark-muted uppercase tracking-wider pb-3 px-2">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sellers.map(brand => (
                            <tr key={brand._id || brand.id} className="border-b border-gray-50 dark:border-dark-border/50 last:border-0 hover:bg-gray-50/50 dark:hover:bg-dark-bg/50">
                              <td className="py-3 px-2 font-medium text-gray-900 dark:text-dark-text">{brand.owner?.name || 'Seller'}</td>
                              <td className="py-3 px-2 font-semibold text-brand-navy dark:text-brand-gold">{brand.name}</td>
                              <td className="py-3 px-2 text-gray-600 dark:text-dark-muted">{brand.category?.name || 'Category'}</td>
                              <td className="py-3 px-2 text-gray-500 dark:text-dark-muted">{brand.location || 'Egypt'}</td>
                              <td className="py-3 px-2 text-gray-500 dark:text-dark-muted">{new Date(brand.createdAt).toLocaleDateString()}</td>
                              <td className="py-3 px-2">
                                <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                  <button
                                    onClick={() => {
                                      adminAPI.verifyBrand(brand._id || brand.id);
                                      setBrands(prev => prev.map(b => (b._id === brand._id || b.id === brand.id) ? { ...b, isVerified: true } : b));
                                      toast.success(isRTL ? 'تم قبول البائع!' : 'Seller approved!');
                                    }}
                                    className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                                  >
                                    <CheckCircle size={12} /> {isRTL ? 'قبول' : 'Approve'}
                                  </button>
                                  <button
                                    className="px-3 py-1.5 bg-gray-100 dark:bg-dark-bg text-gray-600 dark:text-dark-muted hover:bg-gray-200 dark:hover:bg-dark-surface rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                                  >
                                    <Eye size={12} /> {isRTL ? 'مراجعة' : 'Review'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Settings tab */}
            {activeTab === 'settings' && (
              <div>
                <h2 className="text-2xl font-display font-bold text-gray-900 dark:text-dark-text mb-6">
                  {isRTL ? 'إعدادات النظام' : 'System Settings'}
                </h2>
                <SettingsPanel />
              </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
              <AdminUsersTab 
                adminAPI={adminAPI}
                isRTL={isRTL}
                toast={toast}
              />
            )}

            {/* Orders Tab */}
            {activeTab === 'orders' && (
              <AdminOrdersTab 
                adminAPI={adminAPI}
                isRTL={isRTL}
              />
            )}

            {/* Products Tab */}
            {activeTab === 'products' && (
              <AdminProductsTab 
                adminAPI={adminAPI}
                isRTL={isRTL}
              />
            )}

            {/* Sellers Tab */}
            {activeTab === 'sellers' && (
              <div>
                <h2 className={`text-2xl font-display font-bold text-gray-900 dark:text-dark-text mb-6 ${isRTL ? 'text-right' : ''}`}>
                  {isRTL ? 'طلبات البائعين' : 'Seller Requests'}
                </h2>
                <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6">
                  <div className={`flex items-center justify-between mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <h3 className="font-display font-bold text-gray-900 dark:text-dark-text">
                      {isRTL ? 'طلبات انضمام بائعين قيد المراجعة' : 'Pending Seller Approvals'}
                      <span className="mx-2 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-[10px] rounded-full font-bold">
                        {sellers.length} {isRTL ? 'في انتظار المراجعة' : 'awaiting review'}
                      </span>
                    </h3>
                  </div>

                  {sellers.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle className="mx-auto text-emerald-400 mb-2" size={40} />
                      <p className="text-gray-500 dark:text-dark-muted">
                        {isRTL ? 'كل شيء تمام! لا توجد طلبات معلقة.' : 'All caught up! No pending approvals.'}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className={`w-full text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
                        <thead>
                          <tr className="border-b border-gray-100 dark:border-dark-border">
                            {[
                              isRTL ? 'البائع' : 'Seller',
                              isRTL ? 'الماركة' : 'Brand',
                              isRTL ? 'الفئة' : 'Category',
                              isRTL ? 'الموقع' : 'Location',
                              isRTL ? 'تاريخ التقديم' : 'Submitted',
                              isRTL ? 'إجراء' : 'Action'
                            ].map(h => (
                              <th key={h} className="text-xs font-semibold text-gray-400 dark:text-dark-muted uppercase tracking-wider pb-3 px-2">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sellers.map(brand => (
                            <tr key={brand._id || brand.id} className="border-b border-gray-50 dark:border-dark-border/50 last:border-0 hover:bg-gray-50/50 dark:hover:bg-dark-bg/50">
                              <td className="py-3 px-2 font-medium text-gray-900 dark:text-dark-text">{brand.owner?.name || 'Seller'}</td>
                              <td className="py-3 px-2 font-semibold text-brand-navy dark:text-brand-gold">{brand.name}</td>
                              <td className="py-3 px-2 text-gray-600 dark:text-dark-muted">{brand.categories?.[0]?.name || brand.category?.name || '—'}</td>
                              <td className="py-3 px-2 text-gray-500 dark:text-dark-muted">{brand.country || 'Egypt'}</td>
                              <td className="py-3 px-2 text-gray-500 dark:text-dark-muted">
                                {brand.createdAt ? new Date(brand.createdAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US') : '—'}
                              </td>
                              <td className="py-3 px-2">
                                <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                  <button
                                    onClick={() => approveSeller(brand._id || brand.id)}
                                    className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                                  >
                                    <CheckCircle size={12} /> {isRTL ? 'قبول' : 'Approve'}
                                  </button>
                                  <button
                                    onClick={() => rejectSeller(brand._id || brand.id)}
                                    className="px-3 py-1.5 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                                  >
                                    <XCircle size={12} /> {isRTL ? 'رفض' : 'Reject'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Revenue & Analytics Tab */}
            {activeTab === 'revenue' && (
              <div>
                <h2 className={`text-2xl font-display font-bold text-gray-900 dark:text-dark-text mb-6 ${isRTL ? 'text-right' : ''}`}>
                  {isRTL ? 'الأرباح والتحليلات' : 'Revenue & Analytics'}
                </h2>

                {analyticsLoading ? (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="bg-gray-100 dark:bg-dark-surface rounded-2xl h-28 animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {[
                      {
                        icon: '💰',
                        label: isRTL ? 'إجمالي الإيرادات' : 'Total Revenue',
                        value: `${(adminAnalytics?.revenue?.total || dashboard?.totalRevenue || 0).toLocaleString()} ${isRTL ? 'ج.م' : 'EGP'}`,
                        color: 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400',
                      },
                      {
                        icon: '📦',
                        label: isRTL ? 'إجمالي الطلبات' : 'Total Orders',
                        value: (adminAnalytics?.revenue?.ordersCount || dashboard?.ordersCount || 0).toLocaleString(),
                        color: 'bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-400',
                      },
                      {
                        icon: '🏪',
                        label: isRTL ? 'متوسط قيمة الطلب' : 'Avg Order Value',
                        value: `${(adminAnalytics?.revenue?.avgOrderValue || 0).toLocaleString()} ${isRTL ? 'ج.م' : 'EGP'}`,
                        color: 'bg-purple-50 dark:bg-purple-900/10 text-purple-700 dark:text-purple-400',
                      },
                      {
                        icon: '🏷️',
                        label: isRTL ? 'عمولة المنصة (5%)' : 'Platform Commission (5%)',
                        value: `${Math.round((adminAnalytics?.revenue?.total || 0) * 0.05).toLocaleString()} ${isRTL ? 'ج.م' : 'EGP'}`,
                        color: 'bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400',
                      },
                    ].map(s => (
                      <div key={s.label} className={`${s.color} rounded-2xl p-5 ${isRTL ? 'text-right' : ''}`}>
                        <div className="text-3xl mb-2">{s.icon}</div>
                        <div className="text-xl font-bold text-gray-900 dark:text-dark-text">{s.value}</div>
                        <div className="text-xs mt-1">{s.label}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Top Products */}
                  <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6">
                    <h3 className={`font-bold text-gray-900 dark:text-dark-text mb-4 ${isRTL ? 'text-right' : ''}`}>
                      {isRTL ? 'أفضل المنتجات' : 'Top Products'}
                    </h3>
                    {analyticsLoading ? (
                      <div className="space-y-3">
                        {[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-gray-100 dark:bg-dark-surface rounded-lg animate-pulse" />)}
                      </div>
                    ) : (adminAnalytics?.topProducts || []).length === 0 ? (
                      <p className="text-gray-400 dark:text-dark-muted text-sm italic text-center py-4">
                        {isRTL ? 'لا توجد بيانات بعد' : 'No data yet'}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {adminAnalytics.topProducts.slice(0, 5).map((p, i) => {
                          const max = adminAnalytics.topProducts[0]?.totalSales || 1;
                          const pct = Math.round(((p.totalSales || p.sales || 0) / max) * 100);
                          return (
                            <div key={p._id || i} className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                              <span className="text-xs text-gray-500 dark:text-dark-muted w-4">{i + 1}</span>
                              <span className="text-sm text-gray-700 dark:text-dark-text flex-1 truncate">{p.name || p.productName}</span>
                              <div className="w-20 h-1.5 bg-gray-100 dark:bg-dark-bg rounded-full overflow-hidden">
                                <div className="h-full bg-brand-gold rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-gray-500 dark:text-dark-muted w-8 text-right">{p.totalSales || 0}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Top Customers */}
                  <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6">
                    <h3 className={`font-bold text-gray-900 dark:text-dark-text mb-4 ${isRTL ? 'text-right' : ''}`}>
                      {isRTL ? 'أفضل العملاء' : 'Top Customers'}
                    </h3>
                    {analyticsLoading ? (
                      <div className="space-y-3">
                        {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-gray-100 dark:bg-dark-surface rounded-lg animate-pulse" />)}
                      </div>
                    ) : (adminAnalytics?.topCustomers || []).length === 0 ? (
                      <p className="text-gray-400 dark:text-dark-muted text-sm italic text-center py-4">
                        {isRTL ? 'لا توجد بيانات بعد' : 'No data yet'}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {adminAnalytics.topCustomers.slice(0, 5).map((c, i) => (
                          <div key={c._id || i} className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <div className="w-8 h-8 rounded-full bg-brand-navy dark:bg-brand-gold flex items-center justify-center flex-shrink-0">
                              <span className="text-white dark:text-brand-navy text-xs font-bold">
                                {(c.name || c.userName || '?')[0]?.toUpperCase()}
                              </span>
                            </div>
                            <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : ''}`}>
                              <p className="text-sm font-semibold text-gray-900 dark:text-dark-text truncate">{c.name || c.userName || 'Customer'}</p>
                              <p className="text-xs text-gray-500 dark:text-dark-muted">{(c.totalSpent || 0).toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}</p>
                            </div>
                            <span className="text-xs text-gray-400 dark:text-dark-muted">{c.ordersCount || 0} {isRTL ? 'طلب' : 'orders'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Other tabs (reports, etc) */}
            {['reports', 'featured',
              'notifications', 'audit'].includes(activeTab) && (
              <div className="bg-white dark:bg-dark-surface 
                rounded-2xl shadow-card p-8 text-center">
                <BarChart3 className="mx-auto text-gray-300 mb-4"
                  size={48} />
                <p className="text-gray-500 dark:text-dark-muted">
                  {isRTL
                    ? 'هذا القسم قيد التطوير'
                    : 'This section is under development'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
