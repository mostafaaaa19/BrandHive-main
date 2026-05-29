import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Store, Package, ShoppingBag, DollarSign, Target, Star, Megaphone,
  Settings, MessageSquare, CreditCard, LogOut, Eye, Users,
  Plus, BarChart3, Bell
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { sellerAPI } from '../../services/api';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import toast from 'react-hot-toast';
import SettingsPanel from '../../components/SettingsPanel';



const STATUS_COLORS = {
  Shipped: 'bg-blue-100 text-blue-700',
  Delivered: 'bg-emerald-100 text-emerald-700',
  Pending: 'bg-amber-100 text-amber-700',
  Processing: 'bg-gray-100 text-gray-600',
};

function SidebarItem({ icon: Icon, label, tab, activeTab, setActiveTab, isRTL }) {
  const isActive = activeTab === tab;
  return (
    <button onClick={() => setActiveTab(tab)} className={`${isActive ? 'sidebar-item-active' : 'sidebar-item'} ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
      <Icon size={17} />
      <span>{label}</span>
    </button>
  );
}

function SellerOrdersTab({ orders, isRTL, sellerAPI, t }) {
  const [filter, setFilter] = useState('all');
  const [filteredOrders, setFilteredOrders] = useState(orders);
  const [loading, setLoading] = useState(false);

  const filterOrders = async (status) => {
    setFilter(status);
    if (status === 'all') {
      setFilteredOrders(orders);
      return;
    }
    setLoading(true);
    try {
      const res = await sellerAPI.filterOrders(status);
      const data = res.data?.data || res.data?.orders || [];
      setFilteredOrders(Array.isArray(data) ? data : []);
    } catch {
      setFilteredOrders(
        orders.filter(o => 
          o.status?.toLowerCase() === status.toLowerCase()
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const STATUS_FILTERS = [
    { value: 'all', label: isRTL ? 'الكل' : 'All' },
    { value: 'pending', label: isRTL ? 'قيد الانتظار' : 'Pending' },
    { value: 'processing', label: isRTL ? 'جاري المعالجة' : 'Processing' },
    { value: 'shipped', label: isRTL ? 'تم الشحن' : 'Shipped' },
    { value: 'delivered', label: isRTL ? 'تم التوصيل' : 'Delivered' },
    { value: 'cancelled', label: isRTL ? 'ملغي' : 'Cancelled' },
  ];

  const STATUS_COLORS = {
    pending: 'bg-amber-100 text-amber-700',
    PENDING: 'bg-amber-100 text-amber-700',
    processing: 'bg-blue-100 text-blue-700',
    PROCESSING: 'bg-blue-100 text-blue-700',
    shipped: 'bg-purple-100 text-purple-700',
    SHIPPED: 'bg-purple-100 text-purple-700',
    delivered: 'bg-emerald-100 text-emerald-700',
    DELIVERED: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-red-100 text-red-700',
    CANCELLED: 'bg-red-100 text-red-700',
  };

  return (
    <div>
      <h1 className={`text-2xl font-display font-bold 
        text-gray-900 dark:text-dark-text mb-6
        ${isRTL ? 'text-right' : ''}`}>
        {isRTL ? 'الطلبات' : 'Orders'}
      </h1>

      {/* Filter tabs */}
      <div className={`flex gap-2 mb-4 flex-wrap 
        ${isRTL ? 'flex-row-reverse' : ''}`}>
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => filterOrders(f.value)}
            className={`px-3 py-1.5 rounded-lg text-sm 
              font-medium transition-colors ${
              filter === f.value
                ? 'bg-brand-navy dark:bg-brand-gold text-white dark:text-brand-navy'
                : 'bg-white dark:bg-dark-surface text-gray-600 dark:text-dark-muted border border-gray-200 dark:border-dark-border hover:border-brand-navy dark:hover:border-brand-gold'
            }`}
          >
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
        ) : filteredOrders.length === 0 ? (
          <div className="p-8 text-center">
            <Package className="mx-auto text-gray-300 mb-3" size={40} />
            <p className="text-gray-500 dark:text-dark-muted">
              {isRTL ? 'لا توجد طلبات' : 'No orders yet'}
            </p>
          </div>
        ) : (
          <table className={`w-full text-sm 
            ${isRTL ? 'text-right' : 'text-left'}`}>
            <thead className="bg-gray-50 dark:bg-dark-bg">
              <tr>
                {[
                  isRTL ? 'رقم الطلب' : 'Order',
                  isRTL ? 'العميل' : 'Customer',
                  isRTL ? 'المنتجات' : 'Items',
                  isRTL ? 'المبلغ' : 'Amount',
                  isRTL ? 'التاريخ' : 'Date',
                  isRTL ? 'الحالة' : 'Status',
                ].map(h => (
                  <th key={h} className="px-4 py-3 
                    text-xs font-bold text-gray-400 
                    dark:text-dark-muted uppercase 
                    tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 
              dark:divide-dark-border">
              {filteredOrders.map((order, i) => (
                <tr key={order._id || order.id || i}
                  className="hover:bg-gray-50/50 
                    dark:hover:bg-dark-bg/50 transition-colors">
                  <td className="px-4 py-3 font-mono 
                    text-xs text-brand-gold font-bold">
                    #{(order._id || order.id || '').slice(-6).toUpperCase()}
                  </td>
                  <td className="px-4 py-3 font-medium 
                    dark:text-dark-text">
                    {order.user?.name || order.shippingAddress?.fullName || 'Customer'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 
                    dark:text-dark-muted">
                    {order.items?.length || 0} {isRTL ? 'منتج' : 'item(s)'}
                  </td>
                  <td className="px-4 py-3 font-semibold 
                    dark:text-dark-text">
                    {(order.totalAmount || order.total || 0)
                      .toLocaleString()} {t('common.egp')}
                  </td>
                  <td className="px-4 py-3 text-gray-400 
                    dark:text-dark-muted text-xs">
                    {order.createdAt 
                      ? new Date(order.createdAt)
                          .toLocaleDateString()
                      : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full 
                      text-[10px] font-bold ${
                      STATUS_COLORS[order.status] || 
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {order.status || 'pending'}
                    </span>
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

function SellerRevenueTab({ dashboard, analytics, analyticsLoading, isRTL, t }) {
  const stats = [
    { 
      label: isRTL ? 'إجمالي الأرباح' : 'Total Revenue', 
      value: `${(analytics?.totalRevenue || dashboard?.totalRevenue || dashboard?.revenue || 0).toLocaleString()} ${t('common.egp')}`,
      icon: '💰',
      color: 'bg-emerald-50 dark:bg-emerald-900/10'
    },
    { 
      label: isRTL ? 'طلبات هذا الشهر' : 'Orders This Month', 
      value: analytics?.ordersThisMonth || dashboard?.ordersCount || 0,
      icon: '📦',
      color: 'bg-blue-50 dark:bg-blue-900/10'
    },
    { 
      label: isRTL ? 'متوسط قيمة الطلب' : 'Avg Order Value', 
      value: `${(analytics?.avgOrderValue || dashboard?.avgOrderValue || 0).toLocaleString()} ${t('common.egp')}`,
      icon: '📊',
      color: 'bg-purple-50 dark:bg-purple-900/10'
    },
    { 
      label: isRTL ? 'عمولة المنصة (5%)' : 'Platform Fee (5%)', 
      value: `${Math.round((analytics?.totalRevenue || dashboard?.totalRevenue || 0) * 0.05).toLocaleString()} ${t('common.egp')}`,
      icon: '🏷️',
      color: 'bg-amber-50 dark:bg-amber-900/10'
    },
  ];

  const chartData = analytics?.revenueChart || analytics?.chartData || dashboard?.chartData || null;

  return (
    <div>
      <h1 className={`text-2xl font-display font-bold text-gray-900 dark:text-dark-text mb-6 ${isRTL ? 'text-right' : ''}`}>
        {isRTL ? 'الأرباح' : 'Revenue'}
      </h1>

      {analyticsLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-100 dark:bg-dark-surface rounded-2xl h-28 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map(s => (
            <div key={s.label} className={`${s.color} rounded-2xl p-5 ${isRTL ? 'text-right' : ''}`}>
              <div className="text-3xl mb-2">{s.icon}</div>
              <div className="text-xl font-bold text-gray-900 dark:text-dark-text">{s.value}</div>
              <div className="text-xs text-gray-500 dark:text-dark-muted mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6">
        <h3 className={`font-bold text-gray-900 dark:text-dark-text mb-4 ${isRTL ? 'text-right' : ''}`}>
          {isRTL ? 'الأرباح الشهرية' : 'Monthly Revenue'}
        </h3>
        {analyticsLoading ? (
          <div className="h-[200px] bg-gray-100 dark:bg-dark-surface rounded-xl animate-pulse" />
        ) : chartData ? (
          <div className={isRTL ? 'direction-ltr' : ''}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:opacity-10" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} reversed={isRTL} />
                <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} orientation={isRTL ? 'right' : 'left'} />
                <Tooltip
                  formatter={(v) => [`${v.toLocaleString()} ${t('common.egp')}`]}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', backgroundColor: '#1e293b' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Bar dataKey="revenue" fill="currentColor" className="text-brand-navy dark:text-brand-gold" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[200px] flex flex-col items-center justify-center text-gray-400 gap-2">
            <BarChart3 size={40} className="opacity-30" />
            <p className="text-sm italic">
              {isRTL ? 'ستظهر الرسوم البيانية بمجرد توفر بيانات مبيعات' : 'Charts will appear once sales data is available'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SellerReviewsTab({ isRTL, sellerAPI }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const res = await sellerAPI.getReviews();
        const data = res.data?.data || res.data?.reviews || [];
        setReviews(Array.isArray(data) ? data : []);
      } catch {
        setReviews([]);
      } finally {
        setLoading(false);
      }
    };
    fetchReviews();
  }, []);

  return (
    <div>
      <h1 className={`text-2xl font-display font-bold 
        text-gray-900 dark:text-dark-text mb-6
        ${isRTL ? 'text-right' : ''}`}>
        {isRTL ? 'التقييمات' : 'Reviews'}
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
        ) : reviews.length === 0 ? (
          <div className="text-center py-8">
            <Star className="mx-auto text-gray-300 mb-3" size={40} />
            <p className="text-gray-500 dark:text-dark-muted">
              {isRTL ? 'لا توجد تقييمات بعد' : 'No reviews yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review, i) => (
              <div key={review._id || i} 
                className={`border-b border-gray-100 
                  dark:border-dark-border pb-4 last:border-0
                  ${isRTL ? 'text-right' : ''}`}>
                <div className={`flex items-center 
                  justify-between mb-2
                  ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex items-center gap-2
                    ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className="w-8 h-8 rounded-full 
                      bg-brand-navy dark:bg-brand-gold 
                      flex items-center justify-center 
                      text-white text-xs font-bold">
                      {review.user?.name?.[0] || 'U'}
                    </div>
                    <span className="font-medium text-sm 
                      dark:text-dark-text">
                      {review.user?.name || 'Customer'}
                    </span>
                  </div>
                  <div className="flex">
                    {[...Array(5)].map((_, s) => (
                      <Star key={s} size={12}
                        className={s < (review.rating || 0)
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-gray-300'} />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-gray-600 
                  dark:text-dark-muted">
                  {review.comment || '-'}
                </p>
                <p className="text-xs text-gray-400 
                  dark:text-dark-muted mt-1">
                  {review.createdAt 
                    ? new Date(review.createdAt)
                        .toLocaleDateString()
                    : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SellerBazaarTab({ isRTL, sellerAPI }) {
  const [bazaar, setBazaar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notifying, setNotifying] = useState(false);

  useEffect(() => {
    const fetchBazaar = async () => {
      try {
        const res = await sellerAPI.getBazaar();
        setBazaar(res.data?.data || res.data || null);
      } catch {
        setBazaar(null);
      } finally {
        setLoading(false);
      }
    };
    fetchBazaar();
  }, []);

  const handleNotify = async () => {
    const title = prompt(isRTL 
      ? 'عنوان الإشعار:' 
      : 'Notification title:'
    );
    if (!title) return;
    const body = prompt(isRTL 
      ? 'نص الإشعار:' 
      : 'Notification body:'
    );
    if (!body) return;
    setNotifying(true);
    try {
      await sellerAPI.notifyFollowers({ title, body });
      toast.success(isRTL 
        ? 'تم إرسال الإشعار ✅' 
        : 'Notification sent ✅'
      );
    } catch {
      toast.error(isRTL 
        ? 'فشل الإرسال' 
        : 'Failed to send'
      );
    } finally {
      setNotifying(false);
    }
  };

  return (
    <div>
      <div className={`flex items-center justify-between mb-6
        ${isRTL ? 'flex-row-reverse' : ''}`}>
        <h1 className={`text-2xl font-display font-bold 
          text-gray-900 dark:text-dark-text
          ${isRTL ? 'text-right' : ''}`}>
          {isRTL ? 'بازاري' : 'My Bazaar'}
        </h1>
        <button
          onClick={handleNotify}
          disabled={notifying}
          className="btn-primary text-sm flex items-center gap-2">
          <Bell size={14} />
          {isRTL ? 'إشعار المتابعين' : 'Notify Followers'}
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-4 animate-pulse">
          {[1,2,3].map(i => (
            <div key={i} className="h-28 bg-gray-100 
              dark:bg-dark-surface rounded-2xl" />
          ))}
        </div>
      ) : bazaar ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: isRTL ? 'المتابعون' : 'Followers', 
                value: bazaar.followersCount || 0, emoji: '👥' },
              { label: isRTL ? 'المشاهدات' : 'Views', 
                value: bazaar.viewsCount || 0, emoji: '👁' },
              { label: isRTL ? 'التقييم' : 'Rating', 
                value: (bazaar.averageRating || 0).toFixed(1), 
                emoji: '⭐' },
            ].map(stat => (
              <div key={stat.label}
                className={`bg-white dark:bg-dark-surface 
                  rounded-2xl shadow-card p-5 text-center`}>
                <div className="text-3xl mb-2">{stat.emoji}</div>
                <div className="text-2xl font-bold 
                  text-brand-navy dark:text-white">
                  {stat.value}
                </div>
                <div className="text-xs text-gray-500 
                  dark:text-dark-muted mt-1">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
          {bazaar.description && (
            <div className={`bg-white dark:bg-dark-surface 
              rounded-2xl shadow-card p-6
              ${isRTL ? 'text-right' : ''}`}>
              <h3 className="font-bold text-gray-900 
                dark:text-dark-text mb-2">
                {isRTL ? 'وصف المتجر' : 'Store Description'}
              </h3>
              <p className="text-gray-600 dark:text-dark-muted">
                {bazaar.description}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-16 bg-white 
          dark:bg-dark-surface rounded-2xl shadow-card">
          <div className="text-6xl mb-4">🏪</div>
          <h3 className={`text-xl font-display font-bold 
            text-gray-900 dark:text-dark-text mb-2
            ${isRTL ? 'text-right' : 'text-center'}`}>
            {isRTL ? 'لا يوجد بازار بعد' : 'No Bazaar Yet'}
          </h3>
          <p className="text-gray-500 dark:text-dark-muted">
            {isRTL 
              ? 'سيتم إنشاء بازارك بعد موافقة الإدارة'
              : 'Your bazaar will be created after admin approval'}
          </p>
        </div>
      )}
    </div>
  );
}

function SellerProductsTab({ products, isRTL, navigate, t }) {
  return (
    <div>
      <div className={`flex items-center justify-between mb-6
        ${isRTL ? 'flex-row-reverse' : ''}`}>
        <h1 className="text-2xl font-display font-bold 
          text-gray-900 dark:text-dark-text">
          {isRTL ? 'منتجاتي' : 'My Products'}
        </h1>
        <button
          onClick={() => navigate('/seller/products/add')}
          className="btn-primary text-sm flex items-center gap-1">
          <Plus size={14} />
          {isRTL ? 'إضافة منتج' : 'Add Product'}
        </button>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-16 bg-white 
          dark:bg-dark-surface rounded-2xl shadow-card">
          <ShoppingBag className="mx-auto text-gray-300 
            dark:text-dark-muted mb-4" size={48} />
          <p className="font-semibold text-gray-700 
            dark:text-dark-text mb-1">
            {isRTL ? 'لا توجد منتجات بعد' : 'No products yet'}
          </p>
          <p className="text-sm text-gray-400 
            dark:text-dark-muted mb-4">
            {isRTL 
              ? 'أضف منتجك الأول الآن'
              : 'Add your first product now'}
          </p>
          <button
            onClick={() => navigate('/seller/products/add')}
            className="btn-primary text-sm">
            {isRTL ? 'إضافة منتج' : 'Add Product'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 
          lg:grid-cols-3 gap-4">
          {products.map((product, i) => (
            <div key={product._id || product.id || i}
              className="bg-white dark:bg-dark-surface 
                rounded-2xl shadow-card dark:shadow-none 
                dark:border dark:border-dark-border 
                overflow-hidden">
              <div className="h-40 bg-gray-100 
                dark:bg-dark-bg flex items-center 
                justify-center overflow-hidden">
                {product.images?.[0] || product.mainImage ? (
                  <img 
                    src={product.images?.[0] || product.mainImage}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-4xl">📦</span>
                )}
              </div>
              <div className={`p-4 ${isRTL ? 'text-right' : ''}`}>
                <h3 className="font-semibold text-gray-900 
                  dark:text-dark-text text-sm truncate">
                  {product.name}
                </h3>
                <p className="text-brand-gold font-bold mt-1">
                  {(product.finalPrice || product.price || 0)
                    .toLocaleString()} {t('common.egp')}
                </p>
                <div className={`flex items-center 
                  justify-between mt-2
                  ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="text-xs text-gray-400 
                    dark:text-dark-muted">
                    {isRTL ? 'المخزون:' : 'Stock:'} {product.stock || 0}
                  </span>
                  <span className={`text-xs px-2 py-0.5 
                    rounded-full font-medium ${
                    product.isActive !== false
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {product.isActive !== false
                      ? (isRTL ? 'نشط' : 'Active')
                      : (isRTL ? 'غير نشط' : 'Inactive')
                    }
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


export default function SellerDashboard() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const navigate = useNavigate();

  const [dashboard, setDashboard] = useState(null);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch seller dashboard stats
        const dashRes = await sellerAPI.getDashboard();
        const dashData = dashRes.data?.data || dashRes.data || {};
        setDashboard(dashData);
      } catch {
        setDashboard(null);
      }

      try {
        // Fetch seller orders
        const ordRes = await sellerAPI.getOrders();
        const ordData = ordRes.data?.data || ordRes.data?.orders || [];
        setOrders(Array.isArray(ordData) ? ordData : []);
      } catch {
        setOrders([]);
      }

      try {
        // Fetch seller products
        const prodRes = await sellerAPI.getProducts();
        const prodData = prodRes.data?.data || prodRes.data?.products || [];
        setProducts(Array.isArray(prodData) ? prodData : []);
      } catch {
        setProducts([]);
      }

      // Fetch analytics
      try {
        setAnalyticsLoading(true);
        const analyticsRes = await sellerAPI.getAnalytics();
        setAnalytics(analyticsRes.data?.data || analyticsRes.data || null);
      } catch {
        setAnalytics(null);
      } finally {
        setAnalyticsLoading(false);
      }

      setLoading(false);
    };
    fetchData();
  }, []);

  const brandName = user?.name || 'Seller';

  const handleLogout = () => { logout(); navigate('/'); };

  const navSections = [
    {
      label: isRTL ? 'نظرة عامة' : 'Overview',
      items: [
        { icon: LayoutDashboard, label: isRTL ? 'لوحة التحكم' : 'Dashboard', tab: 'dashboard' },
        { icon: Store, label: isRTL ? 'البازار الخاص بي' : 'My Bazaar', tab: 'bazaar' },
        { icon: Package, label: isRTL ? 'الطلبات' : 'Orders', tab: 'orders' },
        { icon: ShoppingBag, label: isRTL ? 'المنتجات' : 'Products', tab: 'products' },
        { icon: DollarSign, label: isRTL ? 'الأرباح' : 'Revenue', tab: 'revenue' },
      ],
    },
    {
      label: isRTL ? 'التسويق' : 'Marketing',
      items: [
        { icon: Target, label: isRTL ? 'العروض' : 'Promotions', tab: 'promotions' },
        { icon: Star, label: isRTL ? 'التقييمات' : 'Reviews', tab: 'reviews' },
        { icon: Megaphone, label: isRTL ? 'مدير الإعلانات' : 'Ads Manager', tab: 'ads' },
      ],
    },
    {
      label: isRTL ? 'الحساب' : 'Account',
      items: [
        { icon: Settings, label: isRTL ? 'إعدادات المتجر' : 'Shop Settings', tab: 'settings' },
        { icon: MessageSquare, label: isRTL ? 'الرسائل' : 'Messages', tab: 'messages' },
        { icon: CreditCard, label: isRTL ? 'المدفوعات' : 'Payouts', tab: 'payouts' },
      ],
    },
  ];

  const translateStatus = (status) => {
    if (!isRTL) return status;
    const map = {
      'Shipped': 'تم الشحن',
      'Delivered': 'تم التوصيل',
      'Pending': 'قيد الانتظار',
      'Processing': 'جاري المعالجة'
    };
    return map[status] || status;
  };

  return (
    <div className={`min-h-screen bg-brand-cream dark:bg-dark-bg transition-colors duration-200 ${isRTL ? 'text-right' : 'text-left'}`}>
      <div className="page-container py-8">
        <div className={`flex gap-8 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {/* Sidebar */}
          <aside className="hidden md:block w-56 flex-shrink-0">
            <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-4 sticky top-24">
              {/* Brand info */}
              <div className="p-3 mb-4 bg-brand-cream dark:bg-dark-bg rounded-2xl">
                <div className={`flex items-center gap-2 mb-1 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                  <div className="w-8 h-8 rounded-xl bg-brand-navy dark:bg-brand-gold flex items-center justify-center flex-shrink-0">
                    <span className="text-white dark:text-brand-navy text-xs font-bold">{brandName?.[0]}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-dark-text text-sm truncate">{brandName}</p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">● {isRTL ? 'متصل' : 'Online'}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-dark-muted">{isRTL ? 'بوابة البائع' : 'Seller Portal'}</p>
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
                <button onClick={handleLogout} className={`sidebar-item text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 w-full ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                  <LogOut size={16} /> {isRTL ? 'تسجيل الخروج' : 'Sign Out'}
                </button>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Dashboard */}
            {activeTab === 'dashboard' && (
              <div>
                <div className={`flex items-center justify-between mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className={isRTL ? 'text-right' : ''}>
                    <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-dark-text">{isRTL ? 'بوابة البائع' : 'Seller Portal'}</h1>
                    <p className="text-gray-500 dark:text-dark-muted mt-0.5">{isRTL ? 'الأداء — مارس 2025' : 'Performance — March 2025'}</p>
                  </div>
                  <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <button
                      onClick={() => toast(isRTL ? 'فتح البازار...' : 'Opening bazaar...', { icon: '🏪', style: { borderRadius: '12px', fontFamily: isRTL ? 'Cairo' : 'Inter' } })}
                      className="btn-ghost text-sm"
                    >
                      {isRTL ? 'عرض البازار ←' : 'View Bazaar →'}
                    </button>
                    <button
                      onClick={() => setActiveTab('products')}
                      className={`btn-primary text-sm flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}
                    >
                      <Plus size={14} /> {isRTL ? 'إضافة منتج' : 'Add Product'}
                    </button>
                  </div>
                </div>

                {/* Stat cards */}
                <div className={`grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  {[
                    { icon: DollarSign, label: isRTL ? 'الأرباح (ج.م)' : 'Revenue (EGP)', value: (dashboard?.revenue || dashboard?.totalRevenue || 0).toLocaleString(), change: '+0%', color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' },
                    { icon: Package, label: isRTL ? 'طلبات الشهر' : 'Orders This Month', value: (dashboard?.ordersCount || orders.length || 0).toString(), change: '+0%', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' },
                    { icon: Eye, label: isRTL ? 'زيارات البازار' : 'Bazaar Views', value: (dashboard?.views || 0).toLocaleString(), change: '+0%', color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400' },
                    { icon: Users, label: isRTL ? 'المتابعون' : 'Followers', value: (dashboard?.followers || 0).toLocaleString(), change: '+0', color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' },
                    { icon: Star, label: isRTL ? 'متوسط التقييم' : 'Avg Rating', value: (dashboard?.rating || 0).toFixed(1), change: '+0', color: 'bg-rose-100 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400' },
                  ].map(stat => (
                    <div key={stat.label} className={`bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-4 ${isRTL ? 'text-right' : ''}`}>
                      <div className={`w-9 h-9 rounded-xl ${stat.color} flex items-center justify-center mb-3 ${isRTL ? 'mr-0 ml-auto' : ''}`}>
                        <stat.icon size={16} />
                      </div>
                      <div className="text-xl font-display font-bold text-gray-900 dark:text-dark-text">{stat.value}</div>
                      <div className="text-[10px] text-gray-400 dark:text-dark-muted mt-0.5 uppercase font-bold">{stat.label}</div>
                      <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1">{stat.change}</div>
                    </div>
                  ))}
                </div>

                <div className={`grid lg:grid-cols-3 gap-6 mb-6 ${isRTL ? 'lg:flex-row-reverse' : ''}`}>
                  {/* Revenue Chart */}
                  <div className="lg:col-span-2 bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6">
                    <div className={`flex items-center justify-between mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <h3 className="font-display font-bold text-gray-900 dark:text-dark-text">
                        {isRTL ? 'الأرباح — آخر 7 أشهر' : 'Revenue — Last 7 Months'}
                      </h3>
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-900/10 px-2 py-1 rounded-full">
                        {isRTL ? '+22% عن الشهر الماضي' : '+22% vs last month'}
                      </span>
                    </div>
                    <div className={isRTL ? 'direction-ltr' : ''}>
                      {(() => {
                        const chartData = analytics?.revenueChart || analytics?.chartData || 
                                          dashboard?.chartData || dashboard?.revenueData || null;
                        return chartData ? (
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={chartData} barSize={24}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:opacity-10" />
                              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} reversed={isRTL} />
                              <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} orientation={isRTL ? 'right' : 'left'} />
                              <Tooltip
                                formatter={(v) => [`${v.toLocaleString()} ${t('common.egp')}`]}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', backgroundColor: '#1e293b' }}
                                itemStyle={{ color: '#fff' }}
                              />
                              <Bar dataKey="revenue" fill="currentColor" className="text-brand-navy dark:text-brand-gold" radius={[6, 6, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm italic">
                            {isRTL ? 'ستظهر الإحصائيات بمجرد استلام طلبات' : 'Analytics will appear once you have orders'}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Top Products + Metrics */}
                  <div className={`bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6 ${isRTL ? 'text-right' : ''}`}>
                    <h3 className="font-display font-bold text-gray-900 dark:text-dark-text mb-4">{isRTL ? 'صحة المتجر' : 'Bazaar Health'}</h3>
                    <div className="space-y-4 mb-6">
                      {[
                        { label: isRTL ? 'معدل الإنجاز' : 'Completion Rate', value: '94%', color: 'bg-emerald-500' },
                        { label: isRTL ? 'معدل الرد' : 'Response Rate', value: '98%', color: 'bg-blue-500' },
                        { label: isRTL ? 'تصنيف المنصة' : 'Platform Rank', value: isRTL ? 'أفضل 5%' : 'Top 5%', color: 'bg-brand-gold' },
                      ].map(m => (
                        <div key={m.label}>
                          <div className={`flex justify-between text-sm mb-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <span className="text-gray-600 dark:text-dark-muted">{m.label}</span>
                            <span className="font-semibold text-gray-900 dark:text-dark-text">{m.value}</span>
                          </div>
                          <div className="h-2 bg-gray-100 dark:bg-dark-bg rounded-full overflow-hidden">
                            <div className={`h-full ${m.color} rounded-full`} style={{ width: m.value.includes('%') ? (m.value.includes('5%') ? '5%' : m.value) : '80%' }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    <h4 className="font-semibold text-gray-900 dark:text-dark-text mb-3 text-sm">{isRTL ? 'أفضل المنتجات' : 'Top Products'}</h4>
                    {(analytics?.topProducts || []).length > 0 ? (
                      analytics.topProducts.slice(0, 5).map((p, i) => {
                        const maxSales = analytics.topProducts[0]?.totalSales || 1;
                        const percent = Math.round(((p.totalSales || p.sales || 0) / maxSales) * 100);
                        return (
                          <div key={p._id || p.productId || i} className={`flex items-center gap-2 mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <span className="text-xs text-gray-600 dark:text-dark-muted flex-1 truncate">
                              {p.productName || p.name || 'Product'}
                            </span>
                            <div className="w-24 h-1.5 bg-gray-100 dark:bg-dark-bg rounded-full overflow-hidden">
                              <div className="h-full bg-brand-gold rounded-full" style={{ width: `${percent}%` }} />
                            </div>
                            <span className="text-xs text-gray-500 dark:text-dark-muted w-8 text-right">{percent}%</span>
                          </div>
                        );
                      })
                    ) : (
                      [
                        { name: isRTL ? 'لا توجد بيانات بعد' : 'No data yet', percent: 0 },
                      ].map(p => (
                        <div key={p.name} className="text-xs text-gray-400 dark:text-dark-muted italic py-2">
                          {p.name}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Recent Orders */}
                <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6">
                  <div className={`flex items-center justify-between mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <h3 className="font-display font-bold text-gray-900 dark:text-dark-text">{isRTL ? 'الطلبات الأخيرة' : 'Recent Orders'}</h3>
                    <button onClick={() => setActiveTab('orders')} className="text-sm text-brand-gold hover:underline">{isRTL ? 'عرض الكل' : 'View All'}</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className={`w-full text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-dark-border">
                          {[
                            isRTL ? 'الطلب' : 'Order',
                            isRTL ? 'العميل' : 'Customer',
                            isRTL ? 'المنتج' : 'Product',
                            isRTL ? 'المبلغ' : 'Amount',
                            isRTL ? 'التاريخ' : 'Date',
                            isRTL ? 'الحالة' : 'Status'
                          ].map(h => (
                            <th key={h} className="text-xs font-semibold text-gray-400 dark:text-dark-muted uppercase tracking-wider pb-3 px-2">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {orders.length === 0 ? (
                          <tr><td colSpan="6" className="py-8 text-center text-gray-400 italic">{isRTL ? 'لا توجد طلبات بعد' : 'No orders yet'}</td></tr>
                        ) : (
                          orders.slice(0, 5).map(order => (
                            <tr key={order._id || order.id} className="border-b border-gray-50 dark:border-dark-border/50 last:border-0 hover:bg-gray-50/50 dark:hover:bg-dark-bg/50">
                              <td className="py-3 px-2 font-mono text-xs text-brand-navy dark:text-brand-gold font-semibold">#{(order._id || order.id).slice(-4).toUpperCase()}</td>
                              <td className="py-3 px-2 font-medium dark:text-dark-text">{order.user?.name || 'Customer'}</td>
                              <td className="py-3 px-2 text-gray-600 dark:text-dark-muted max-w-[140px] truncate">{order.items?.[0]?.product?.name || 'Product'}</td>
                              <td className="py-3 px-2 font-semibold dark:text-dark-text">{(order.totalAmount || order.total).toLocaleString()} {t('common.egp')}</td>
                              <td className="py-3 px-2 text-gray-500 dark:text-dark-muted">{new Date(order.createdAt).toLocaleDateString()}</td>
                              <td className="py-3 px-2">
                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-600'}`}>
                                  {translateStatus(order.status)}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Products Tab */}
            {/* Orders Tab */}
            {activeTab === 'orders' && (
              <SellerOrdersTab 
                orders={orders} 
                isRTL={isRTL} 
                sellerAPI={sellerAPI}
                t={t}
              />
            )}

            {/* Revenue Tab */}
            {activeTab === 'revenue' && (
              <SellerRevenueTab 
                dashboard={dashboard}
                analytics={analytics}
                analyticsLoading={analyticsLoading}
                isRTL={isRTL}
                t={t}
              />
            )}

            {/* Reviews Tab */}
            {activeTab === 'reviews' && (
              <SellerReviewsTab 
                isRTL={isRTL}
                sellerAPI={sellerAPI}
              />
            )}

            {/* Bazaar Tab */}
            {activeTab === 'bazaar' && (
              <SellerBazaarTab 
                isRTL={isRTL}
                sellerAPI={sellerAPI}
              />
            )}

            {/* Products Tab */}
            {activeTab === 'products' && (
              <SellerProductsTab
                products={products}
                isRTL={isRTL}
                navigate={navigate}
                t={t}
              />
            )}

            {/* Other tabs (messages, payouts, ads, promotions) */}
            {['messages', 'payouts', 'ads', 'promotions']
              .includes(activeTab) && (
              <div className="bg-white dark:bg-dark-surface 
                rounded-2xl shadow-card p-8 text-center">
                <BarChart3 className="mx-auto text-gray-300 
                  dark:text-dark-muted mb-4" size={48} />
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
