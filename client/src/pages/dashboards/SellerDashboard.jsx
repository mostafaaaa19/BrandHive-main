import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard, Store, Package, ShoppingBag, DollarSign, Target, Star, Megaphone,
  Settings, MessageSquare, CreditCard, LogOut, Users,
  Plus, BarChart3, Bell, Edit, XCircle, Boxes
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../../context/AuthContext';
import {
  sellerAPI,
  brandsAPI,
  productsAPI,
  inventoryAPI,
  fetchSellerProducts,
  fetchSellerInventoryProducts,
  adjustSellerStock,
  fetchSellerOrders,
  fetchSellerReviews,
  fetchSellerBrandMessages,
  readCachedSellerProducts,
  getCachedSellerProductCount,
  fetchSellerPayoutSummary,
  saveSellerPayoutProfile,
  requestSellerWithdrawal,
  resolveSellerBrand,
  resolveSellerBazaarSource,
  rememberSellerBrand,
  readCachedSellerBrandForUser,
  ensureSellerBrandLinked,
} from '../../services/api';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import toast from 'react-hot-toast';
import SettingsPanel from '../../components/SettingsPanel';



const STATUS_COLORS = {
  shipped: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  delivered: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
  confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  processing: 'bg-gray-100 text-gray-600 dark:bg-dark-surface dark:text-dark-muted',
  canceled: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  Shipped: 'bg-blue-100 text-blue-700',
  Delivered: 'bg-emerald-100 text-emerald-700',
  Pending: 'bg-amber-100 text-amber-700',
  Processing: 'bg-gray-100 text-gray-600',
};

const getOrderStatus = (order) => String(order?.status || 'pending').toLowerCase();

const pickMetricNumber = (...values) => {
  let fallback = 0;
  for (const value of values) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) continue;
    if (parsed > 0) return parsed;
    fallback = parsed;
  }
  return fallback;
};

const getOrderTotal = (order) =>
  Number(order?.totalAmount ?? order?.total ?? order?.subtotal ?? 0) || 0;

const isActiveOrder = (order) => !['canceled', 'cancelled'].includes(getOrderStatus(order));

const computeSellerOrderStats = (orders = [], locale = 'en') => {
  const list = Array.isArray(orders) ? orders : [];
  const activeOrders = list.filter(isActiveOrder);
  const totalRevenue = activeOrders.reduce((sum, order) => sum + getOrderTotal(order), 0);
  const pendingCount = list.filter((order) => getOrderStatus(order) === 'pending').length;
  const now = new Date();
  const ordersThisMonth = list.filter((order) => {
    if (!order?.createdAt) return false;
    const created = new Date(order.createdAt);
    return (
      created.getMonth() === now.getMonth() &&
      created.getFullYear() === now.getFullYear()
    );
  }).length;
  const avgOrderValue = activeOrders.length
    ? Math.round(totalRevenue / activeOrders.length)
    : 0;

  const monthBuckets = [];
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthBuckets.push({
      key: `${date.getFullYear()}-${date.getMonth()}`,
      month: date.toLocaleDateString(locale, { month: 'short' }),
      revenue: 0,
    });
  }

  activeOrders.forEach((order) => {
    if (!order?.createdAt) return;
    const created = new Date(order.createdAt);
    const key = `${created.getFullYear()}-${created.getMonth()}`;
    const bucket = monthBuckets.find((entry) => entry.key === key);
    if (bucket) bucket.revenue += getOrderTotal(order);
  });

  const productMap = new Map();
  activeOrders.forEach((order) => {
    (order.items || []).forEach((item) => {
      const name = item?.name || item?.product?.name || 'Product';
      const id = item?.productId || item?.product?._id || item?.product?.id || name;
      const sales =
        (Number(item?.quantity) || 1) * (Number(item?.price) || 0);
      const existing = productMap.get(String(id)) || {
        _id: id,
        productId: id,
        name,
        productName: name,
        totalSales: 0,
      };
      existing.totalSales += sales;
      productMap.set(String(id), existing);
    });
  });

  return {
    totalCount: list.length,
    pendingCount,
    totalRevenue,
    ordersThisMonth,
    avgOrderValue,
    revenueChart: monthBuckets.map(({ month, revenue }) => ({ month, revenue })),
    topProducts: [...productMap.values()].sort(
      (a, b) => (b.totalSales || 0) - (a.totalSales || 0)
    ),
  };
};

const computeBazaarHealth = (orders = [], products = [], isRTL = false) => {
  const active = (Array.isArray(orders) ? orders : []).filter(isActiveOrder);
  const total = active.length;
  const delivered = active.filter((order) => getOrderStatus(order) === 'delivered').length;
  const processed = active.filter((order) => getOrderStatus(order) !== 'pending').length;
  const prodList = Array.isArray(products) ? products : [];
  const inStock = prodList.filter((product) => Number(product.stock ?? 0) > 0).length;

  const completionRate = total > 0 ? Math.round((delivered / total) * 100) : 0;
  const fulfillmentRate = total > 0 ? Math.round((processed / total) * 100) : 0;
  const stockHealth = prodList.length > 0 ? Math.round((inStock / prodList.length) * 100) : 0;

  return [
    {
      label: isRTL ? 'معدل الإنجاز' : 'Completion Rate',
      value: total > 0 ? `${completionRate}%` : '—',
      percent: completionRate,
      color: 'bg-emerald-500',
    },
    {
      label: isRTL ? 'معدل المعالجة' : 'Fulfillment Rate',
      value: total > 0 ? `${fulfillmentRate}%` : '—',
      percent: fulfillmentRate,
      color: 'bg-blue-500',
    },
    {
      label: isRTL ? 'صحة المخزون' : 'Stock Health',
      value: prodList.length > 0 ? `${stockHealth}%` : '—',
      percent: stockHealth,
      color: 'bg-brand-gold',
    },
  ];
};

const pickTopProducts = (orderStats, analytics, products = []) => {
  if (orderStats?.topProducts?.length > 0) return orderStats.topProducts;
  if (analytics?.topProducts?.length > 0) return analytics.topProducts;
  return (Array.isArray(products) ? products : []).slice(0, 5).map((product) => ({
    _id: product._id || product.id,
    productId: product._id || product.id,
    name: product.name,
    productName: product.name,
    totalSales: 0,
  }));
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

function SellerOrdersTab({ orders, isRTL, t }) {
  const [filter, setFilter] = useState('all');
  const [filteredOrders, setFilteredOrders] = useState(orders);

  useEffect(() => {
    if (filter === 'all') {
      setFilteredOrders(orders);
    }
  }, [orders, filter]);

  const filterOrders = (status) => {
    setFilter(status);
    if (status === 'all') {
      setFilteredOrders(orders);
      return;
    }
    setFilteredOrders(
      orders.filter(
        (order) => getOrderStatus(order) === status.toLowerCase()
      )
    );
  };

  const STATUS_FILTERS = [
    { value: 'all', label: isRTL ? 'الكل' : 'All' },
    { value: 'pending', label: isRTL ? 'قيد الانتظار' : 'Pending' },
    { value: 'processing', label: isRTL ? 'جاري المعالجة' : 'Processing' },
    { value: 'shipped', label: isRTL ? 'تم الشحن' : 'Shipped' },
    { value: 'delivered', label: isRTL ? 'تم التوصيل' : 'Delivered' },
    { value: 'canceled', label: isRTL ? 'ملغي' : 'Canceled' },
  ];

  const STATUS_COLORS = {
    shipped: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
    delivered: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
    confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
    processing: 'bg-gray-100 text-gray-600 dark:bg-dark-surface dark:text-dark-muted',
    canceled: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
    Shipped: 'bg-blue-100 text-blue-700',
    Delivered: 'bg-emerald-100 text-emerald-700',
    Pending: 'bg-amber-100 text-amber-700',
    Processing: 'bg-gray-100 text-gray-600',
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
        {filteredOrders.length === 0 ? (
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

const PAYOUT_METHODS = [
  { value: 'vodafone_cash', labelEn: 'Vodafone Cash', labelAr: 'فودافون كاش' },
  { value: 'instapay', labelEn: 'InstaPay', labelAr: 'إنستا باي' },
  { value: 'bank_transfer', labelEn: 'Bank Transfer', labelAr: 'تحويل بنكي' },
];

const WITHDRAWAL_STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
  approved: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
};

function SellerPayoutsTab({ user, brandId, orderStats, isRTL }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState('');
  const [profile, setProfile] = useState({
    method: 'vodafone_cash',
    walletNumber: '',
    instapayId: '',
    bankName: '',
    accountNumber: '',
    accountHolder: '',
  });

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSellerPayoutSummary(user, brandId);
      setSummary(data);
      if (data?.profile) {
        setProfile({
          method: data.profile.method || 'vodafone_cash',
          walletNumber: data.profile.walletNumber || '',
          instapayId: data.profile.instapayId || '',
          bankName: data.profile.bankName || '',
          accountNumber: data.profile.accountNumber || '',
          accountHolder: data.profile.accountHolder || '',
        });
      }
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [user, brandId]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const fallbackGross = orderStats?.totalRevenue || 0;
  const grossRevenue = summary?.grossRevenue ?? fallbackGross;
  const platformFee = summary?.platformFee ?? Math.round(fallbackGross * 0.05);
  const availableBalance =
    summary?.availableBalance ?? Math.max(0, fallbackGross - platformFee);
  const pendingWithdrawal = summary?.pendingWithdrawal ?? 0;
  const totalWithdrawn = summary?.totalWithdrawn ?? 0;
  const withdrawals = summary?.withdrawals || [];

  const validateProfile = () => {
    if (profile.method === 'vodafone_cash' && !profile.walletNumber?.trim()) {
      return isRTL ? 'أدخل رقم المحفظة' : 'Enter wallet number';
    }
    if (profile.method === 'instapay' && !profile.instapayId?.trim()) {
      return isRTL ? 'أدخل معرف InstaPay' : 'Enter InstaPay ID';
    }
    if (profile.method === 'bank_transfer') {
      if (!profile.bankName?.trim() || !profile.accountNumber?.trim() || !profile.accountHolder?.trim()) {
        return isRTL ? 'أكمل بيانات الحساب البنكي' : 'Complete bank account details';
      }
    }
    return null;
  };

  const handleSaveProfile = async () => {
    const error = validateProfile();
    if (error) {
      toast.error(error);
      return;
    }
    setSavingProfile(true);
    try {
      await saveSellerPayoutProfile(user, profile);
      toast.success(isRTL ? 'تم حفظ بيانات الدفع' : 'Payout details saved');
      await loadSummary();
    } catch (err) {
      toast.error(err.message || (isRTL ? 'فشل الحفظ' : 'Save failed'));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleWithdraw = async () => {
    const profileError = validateProfile();
    if (profileError) {
      toast.error(isRTL ? 'احفظ بيانات الدفع أولاً' : 'Save payout details first');
      return;
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 50) {
      toast.error(isRTL ? 'الحد الأدنى للسحب 50 ج.م' : 'Minimum withdrawal is 50 EGP');
      return;
    }
    if (parsedAmount > availableBalance) {
      toast.error(isRTL ? 'المبلغ أكبر من الرصيد المتاح' : 'Amount exceeds available balance');
      return;
    }

    setSubmitting(true);
    try {
      await saveSellerPayoutProfile(user, profile);
      await requestSellerWithdrawal(user, {
        brandId,
        amount: parsedAmount,
        method: profile.method,
        accountDetails: {
          walletNumber: profile.walletNumber,
          instapayId: profile.instapayId,
          bankName: profile.bankName,
          accountNumber: profile.accountNumber,
          accountHolder: profile.accountHolder,
        },
      });
      toast.success(isRTL ? 'تم إرسال طلب السحب' : 'Withdrawal request submitted');
      setAmount('');
      await loadSummary();
    } catch (err) {
      toast.error(err.message || (isRTL ? 'فشل طلب السحب' : 'Withdrawal failed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !summary) {
    return (
      <div className="p-12 text-center">
        <div className="w-8 h-8 border-2 border-brand-gold border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div>
      <h1 className={`text-2xl font-display font-bold text-gray-900 dark:text-dark-text mb-6 ${isRTL ? 'text-right' : ''}`}>
        {isRTL ? 'المدفوعات' : 'Payouts'}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          {
            icon: '💰',
            label: isRTL ? 'الرصيد المتاح' : 'Available Balance',
            value: `${availableBalance.toLocaleString()} ${isRTL ? 'ج.م' : 'EGP'}`,
            color: 'bg-emerald-50 dark:bg-emerald-900/10',
          },
          {
            icon: '📤',
            label: isRTL ? 'قيد السحب' : 'Pending Withdrawal',
            value: `${pendingWithdrawal.toLocaleString()} ${isRTL ? 'ج.م' : 'EGP'}`,
            color: 'bg-amber-50 dark:bg-amber-900/10',
          },
          {
            icon: '✅',
            label: isRTL ? 'إجمالي المسحوب' : 'Total Withdrawn',
            value: `${totalWithdrawn.toLocaleString()} ${isRTL ? 'ج.م' : 'EGP'}`,
            color: 'bg-blue-50 dark:bg-blue-900/10',
          },
        ].map((item) => (
          <div key={item.label} className={`${item.color} rounded-2xl p-5 ${isRTL ? 'text-right' : ''}`}>
            <div className="text-3xl mb-2">{item.icon}</div>
            <div className="text-xl font-bold text-gray-900 dark:text-dark-text">{item.value}</div>
            <div className="text-xs text-gray-500 dark:text-dark-muted mt-1">{item.label}</div>
          </div>
        ))}
      </div>

      <p className={`text-xs text-gray-400 dark:text-dark-muted mb-6 ${isRTL ? 'text-right' : ''}`}>
        {isRTL
          ? `إجمالي الأرباح: ${grossRevenue.toLocaleString()} ج.م — عمولة المنصة (5%): ${platformFee.toLocaleString()} ج.م`
          : `Gross earnings: ${grossRevenue.toLocaleString()} EGP — Platform fee (5%): ${platformFee.toLocaleString()} EGP`}
      </p>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6">
          <h3 className={`font-bold text-gray-900 dark:text-dark-text mb-4 ${isRTL ? 'text-right' : ''}`}>
            {isRTL ? 'بيانات الدفع' : 'Payout Details'}
          </h3>
          <div className="space-y-3">
            <div>
              <label className={`block text-xs font-semibold text-gray-500 mb-1 ${isRTL ? 'text-right' : ''}`}>
                {isRTL ? 'طريقة الدفع' : 'Payment method'}
              </label>
              <select
                value={profile.method}
                onChange={(e) => setProfile((prev) => ({ ...prev, method: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg px-3 py-2 text-sm"
              >
                {PAYOUT_METHODS.map((method) => (
                  <option key={method.value} value={method.value}>
                    {isRTL ? method.labelAr : method.labelEn}
                  </option>
                ))}
              </select>
            </div>

            {profile.method === 'vodafone_cash' && (
              <input
                type="text"
                placeholder={isRTL ? 'رقم المحفظة' : 'Wallet number'}
                value={profile.walletNumber}
                onChange={(e) => setProfile((prev) => ({ ...prev, walletNumber: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg px-3 py-2 text-sm"
              />
            )}

            {profile.method === 'instapay' && (
              <input
                type="text"
                placeholder={isRTL ? 'معرف InstaPay أو رقم الهاتف' : 'InstaPay ID or phone'}
                value={profile.instapayId}
                onChange={(e) => setProfile((prev) => ({ ...prev, instapayId: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg px-3 py-2 text-sm"
              />
            )}

            {profile.method === 'bank_transfer' && (
              <>
                <input
                  type="text"
                  placeholder={isRTL ? 'اسم البنك' : 'Bank name'}
                  value={profile.bankName}
                  onChange={(e) => setProfile((prev) => ({ ...prev, bankName: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  placeholder={isRTL ? 'رقم الحساب / IBAN' : 'Account number / IBAN'}
                  value={profile.accountNumber}
                  onChange={(e) => setProfile((prev) => ({ ...prev, accountNumber: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  placeholder={isRTL ? 'اسم صاحب الحساب' : 'Account holder name'}
                  value={profile.accountHolder}
                  onChange={(e) => setProfile((prev) => ({ ...prev, accountHolder: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg px-3 py-2 text-sm"
                />
              </>
            )}

            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="btn-primary w-full disabled:opacity-50"
            >
              {savingProfile
                ? (isRTL ? 'جاري الحفظ...' : 'Saving...')
                : (isRTL ? 'حفظ بيانات الدفع' : 'Save payout details')}
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6">
          <h3 className={`font-bold text-gray-900 dark:text-dark-text mb-4 ${isRTL ? 'text-right' : ''}`}>
            {isRTL ? 'طلب سحب' : 'Request Withdrawal'}
          </h3>
          <div className="space-y-3">
            <input
              type="number"
              min="50"
              step="1"
              placeholder={isRTL ? 'المبلغ (ج.م)' : 'Amount (EGP)'}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg px-3 py-2 text-sm"
            />
            <p className={`text-xs text-gray-400 ${isRTL ? 'text-right' : ''}`}>
              {isRTL ? `الحد الأدنى 50 ج.م — المتاح: ${availableBalance.toLocaleString()} ج.م` : `Min 50 EGP — Available: ${availableBalance.toLocaleString()} EGP`}
            </p>
            <button
              type="button"
              onClick={handleWithdraw}
              disabled={submitting || availableBalance < 50}
              className="btn-primary w-full disabled:opacity-50"
            >
              {submitting
                ? (isRTL ? 'جاري الإرسال...' : 'Submitting...')
                : (isRTL ? 'إرسال طلب السحب' : 'Submit withdrawal request')}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6">
        <h3 className={`font-bold text-gray-900 dark:text-dark-text mb-4 ${isRTL ? 'text-right' : ''}`}>
          {isRTL ? 'سجل السحب' : 'Withdrawal History'}
        </h3>
        {withdrawals.length === 0 ? (
          <p className={`text-sm text-gray-400 italic ${isRTL ? 'text-right' : ''}`}>
            {isRTL ? 'لا توجد طلبات سحب بعد' : 'No withdrawal requests yet'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className={`w-full text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
              <thead>
                <tr className="border-b border-gray-100 dark:border-dark-border">
                  {[
                    isRTL ? 'التاريخ' : 'Date',
                    isRTL ? 'المبلغ' : 'Amount',
                    isRTL ? 'الطريقة' : 'Method',
                    isRTL ? 'الحالة' : 'Status',
                  ].map((header) => (
                    <th key={header} className="pb-3 px-2 text-xs font-semibold text-gray-400 uppercase">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((entry) => (
                  <tr key={entry._id} className="border-b border-gray-50 dark:border-dark-border/50 last:border-0">
                    <td className="py-3 px-2 text-gray-500">
                      {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-2 font-semibold">
                      {Number(entry.amount || 0).toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                    </td>
                    <td className="py-3 px-2 text-gray-500">
                      {PAYOUT_METHODS.find((m) => m.value === entry.method)?.[isRTL ? 'labelAr' : 'labelEn'] || entry.method}
                    </td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${WITHDRAWAL_STATUS_COLORS[entry.status] || 'bg-gray-100 text-gray-600'}`}>
                        {entry.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SellerRevenueTab({ dashboard, analytics, analyticsLoading, orderStats, isRTL, t }) {
  const totalRevenue = pickMetricNumber(
    orderStats?.totalRevenue,
    analytics?.totalRevenue,
    dashboard?.totalRevenue,
    dashboard?.revenue?.total
  );
  const ordersThisMonth = pickMetricNumber(
    orderStats?.ordersThisMonth,
    analytics?.ordersThisMonth,
    dashboard?.ordersCount
  );
  const avgOrderValue = pickMetricNumber(
    orderStats?.avgOrderValue,
    analytics?.avgOrderValue,
    dashboard?.avgOrderValue
  );

  const stats = [
    { 
      label: isRTL ? 'إجمالي الأرباح' : 'Total Revenue', 
      value: `${totalRevenue.toLocaleString()} ${t('common.egp')}`,
      icon: '💰',
      color: 'bg-emerald-50 dark:bg-emerald-900/10'
    },
    { 
      label: isRTL ? 'طلبات هذا الشهر' : 'Orders This Month', 
      value: ordersThisMonth,
      icon: '📦',
      color: 'bg-blue-50 dark:bg-blue-900/10'
    },
    { 
      label: isRTL ? 'متوسط قيمة الطلب' : 'Avg Order Value', 
      value: `${avgOrderValue.toLocaleString()} ${t('common.egp')}`,
      icon: '📊',
      color: 'bg-purple-50 dark:bg-purple-900/10'
    },
    { 
      label: isRTL ? 'عمولة المنصة (5%)' : 'Platform Fee (5%)', 
      value: `${Math.round(totalRevenue * 0.05).toLocaleString()} ${t('common.egp')}`,
      icon: '🏷️',
      color: 'bg-amber-50 dark:bg-amber-900/10'
    },
  ];

  const chartData =
    analytics?.revenueChart ||
    analytics?.chartData ||
    dashboard?.chartData ||
    (orderStats?.revenueChart?.some((entry) => entry.revenue > 0)
      ? orderStats.revenueChart
      : null);

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

function SellerMessagesTab({ isRTL, brandId }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchSellerBrandMessages(brandId);
        setMessages(Array.isArray(data) ? data : []);
      } catch {
        setMessages([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [brandId]);

  return (
    <div>
      <h1 className={`text-2xl font-display font-bold text-gray-900 dark:text-dark-text mb-6 ${isRTL ? 'text-right' : ''}`}>
        {isRTL ? 'الرسائل' : 'Messages'}
      </h1>
      <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6">
        {loading ? (
          <div className="text-center py-8">
            <div className="w-6 h-6 border-2 border-brand-gold border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="mx-auto text-gray-300 dark:text-dark-muted mb-4" size={48} />
            <h3 className="font-bold text-gray-900 dark:text-dark-text mb-2">
              {isRTL ? 'لا توجد رسائل بعد' : 'No messages yet'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-dark-muted">
              {isRTL ? 'ستظهر رسائل العملاء من صفحة ماركتك هنا' : 'Customer messages from your brand page will appear here'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div
                key={msg._id || msg.id || i}
                className={`border-b border-gray-100 dark:border-dark-border pb-4 last:border-0 ${isRTL ? 'text-right' : ''}`}
              >
                <div className={`flex items-center justify-between mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="font-medium text-sm dark:text-dark-text">
                    {msg.fullName || msg.user?.name || 'Customer'}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-dark-muted">
                    {msg.createdAt ? new Date(msg.createdAt).toLocaleDateString() : ''}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-dark-muted">{msg.message}</p>
                {msg.email && (
                  <p className="text-xs text-gray-400 dark:text-dark-muted mt-1">{msg.email}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SellerReviewsTab({ isRTL, user }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReviews = async () => {
      setLoading(true);
      try {
        const reviewData = await fetchSellerReviews(user);
        setReviews(Array.isArray(reviewData) ? reviewData : []);
      } catch {
        setReviews([]);
      } finally {
        setLoading(false);
      }
    };
    fetchReviews();
  }, [user]);

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
                {(review.productName || review.product?.name) && (
                  <p className="text-xs text-brand-gold mt-1">
                    {review.productName || review.product?.name}
                  </p>
                )}
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

function SellerBazaarTab({ isRTL, sellerAPI, user, products, brandId, orderStats }) {
  const [bazaar, setBazaar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notifying, setNotifying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    description: '',
    whatsappLink: '',
    instagramLink: '',
    facebookLink: '',
  });

  const bazaarProfileKey = `brandhive_seller_bazaar_${user?.id || user?._id || 'default'}`;

  const readLocalBazaarProfile = () => {
    try {
      const raw = localStorage.getItem(bazaarProfileKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };

  const buildBazaarFromBrand = (brand, localProfile = {}) => ({
    _id: brand._id || brand.id,
    name: brand.name || 'My Bazaar',
    slug: brand.slug,
    description: localProfile.description || brand.description || '',
    whatsappLink: localProfile.whatsappLink || brand.whatsappLink || brand.whatsapp || '',
    instagramLink: localProfile.instagramLink || brand.instagramLink || brand.instagram || '',
    facebookLink: localProfile.facebookLink || brand.facebookLink || brand.facebook || '',
    followersCount: brand.followers || brand.followersCount || 0,
    viewsCount: brand.views || brand.viewsCount || 0,
    averageRating: brand.rating || brand.averageRating || 0,
    productCount: Array.isArray(products) ? products.length : 0,
    ordersCount: orderStats?.totalCount || 0,
    _fromBrand: true,
  });

  const mergeBazaarProfile = (base) => {
    const localProfile = readLocalBazaarProfile();
    return {
      ...base,
      description: localProfile.description || base.description || '',
      whatsappLink: localProfile.whatsappLink || base.whatsappLink || '',
      instagramLink: localProfile.instagramLink || base.instagramLink || '',
      facebookLink: localProfile.facebookLink || base.facebookLink || '',
    };
  };

  const loadBazaar = useCallback(async () => {
    const localProfile = readLocalBazaarProfile();
    const cachedBrand = readCachedSellerBrandForUser(user);
    if (cachedBrand) {
      setBazaar(buildBazaarFromBrand(cachedBrand, localProfile));
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      await ensureSellerBrandLinked(user);
      const source = await resolveSellerBazaarSource(user, { brandId, products });
      if (source?.kind === 'bazaar') {
        setBazaar(mergeBazaarProfile(source.payload));
        return;
      }
      if (source?.kind === 'brand' && source.payload) {
        setBazaar(buildBazaarFromBrand(source.payload, localProfile));
        return;
      }
      if (!cachedBrand) setBazaar(null);
    } catch {
      if (!cachedBrand) setBazaar(null);
    } finally {
      setLoading(false);
    }
  }, [user, products, brandId, orderStats?.totalCount]);

  useEffect(() => {
    loadBazaar();
  }, [loadBazaar]);

  useEffect(() => {
    if (bazaar) {
      setEditForm({
        description: bazaar.description || '',
        whatsappLink: bazaar.whatsappLink || '',
        instagramLink: bazaar.instagramLink || '',
        facebookLink: bazaar.facebookLink || '',
      });
    }
  }, [bazaar]);

  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem(bazaarProfileKey, JSON.stringify(editForm));
      const updated = { ...bazaar, ...editForm };
      setBazaar(updated);
      setEditing(false);

      if (!bazaar?._fromBrand) {
        const res = await sellerAPI.updateBazaar(editForm);
        setBazaar(mergeBazaarProfile(res.data?.data || res.data || updated));
      }

      toast.success(isRTL ? 'تم تحديث البازار ✅' : 'Bazaar updated ✅');
    } catch (err) {
      if (bazaar?._fromBrand) {
        setBazaar({ ...bazaar, ...editForm });
        setEditing(false);
        toast.success(isRTL ? 'تم حفظ التغييرات محلياً ✅' : 'Changes saved locally ✅');
      } else {
        toast.error(
          err.response?.data?.message ||
          (isRTL ? 'فشل التحديث' : 'Update failed')
        );
      }
    } finally {
      setSaving(false);
    }
  };

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
        <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {bazaar && (
            <button
              onClick={() => setEditing(!editing)}
              className="btn-outline text-sm flex items-center gap-2"
            >
              <Edit size={14} />
              {isRTL ? 'تعديل' : 'Edit'}
            </button>
          )}
          <button
            onClick={handleNotify}
            disabled={notifying}
            className="btn-primary text-sm flex items-center gap-2">
            <Bell size={14} />
            {isRTL ? 'إشعار المتابعين' : 'Notify Followers'}
          </button>
        </div>
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
          <div className={`bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-5 flex items-center justify-between gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : ''}>
              <h2 className="text-lg font-display font-bold text-gray-900 dark:text-dark-text">{bazaar.name}</h2>
              {bazaar._fromBrand && (
                <p className="text-xs text-gray-400 dark:text-dark-muted mt-1">
                  {isRTL ? 'متجرك مرتبط بماركة BrandHive' : 'Linked to your BrandHive brand'}
                </p>
              )}
            </div>
            {bazaar.slug && (
              <Link
                to={`/brand/${bazaar.slug}`}
                className="btn-outline text-sm whitespace-nowrap"
              >
                {isRTL ? 'عرض المتجر' : 'View Store'}
              </Link>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {[
              { label: isRTL ? 'المتابعون' : 'Followers', value: bazaar.followersCount || 0, emoji: '👥' },
              { label: isRTL ? 'المشاهدات' : 'Views', value: bazaar.viewsCount || 0, emoji: '👁' },
              { label: isRTL ? 'المنتجات' : 'Products', value: bazaar.productCount ?? products.length ?? 0, emoji: '📦' },
              { label: isRTL ? 'التقييم' : 'Rating', value: (bazaar.averageRating || 0).toFixed(1), emoji: '⭐' },
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
          {editing && (
            <div className={`bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6 ${isRTL ? 'text-right' : ''}`}>
              <h3 className="font-bold text-gray-900 dark:text-dark-text mb-4">
                {isRTL ? 'تعديل معلومات البازار' : 'Edit Bazaar Info'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-dark-muted mb-1">
                    {isRTL ? 'وصف المتجر' : 'Store Description'}
                  </label>
                  <textarea
                    value={editForm.description}
                    onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                    rows={3}
                    placeholder={isRTL ? 'اكتب وصفاً لمتجرك...' : 'Describe your store...'}
                    className={`w-full rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg px-4 py-2.5 text-sm outline-none focus:border-brand-gold resize-none dark:text-white ${isRTL ? 'text-right' : ''}`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-dark-muted mb-1">
                    WhatsApp {isRTL ? 'رابط' : 'Link'}
                  </label>
                  <input
                    value={editForm.whatsappLink}
                    onChange={e => setEditForm(p => ({ ...p, whatsappLink: e.target.value }))}
                    placeholder="https://wa.me/..."
                    className={`w-full rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg px-4 py-2.5 text-sm outline-none focus:border-brand-gold dark:text-white ${isRTL ? 'text-right' : ''}`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-dark-muted mb-1">
                    Instagram {isRTL ? 'رابط' : 'Link'}
                  </label>
                  <input
                    value={editForm.instagramLink}
                    onChange={e => setEditForm(p => ({ ...p, instagramLink: e.target.value }))}
                    placeholder="https://instagram.com/..."
                    className={`w-full rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg px-4 py-2.5 text-sm outline-none focus:border-brand-gold dark:text-white ${isRTL ? 'text-right' : ''}`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-dark-muted mb-1">
                    Facebook {isRTL ? 'رابط' : 'Link'}
                  </label>
                  <input
                    value={editForm.facebookLink}
                    onChange={e => setEditForm(p => ({ ...p, facebookLink: e.target.value }))}
                    placeholder="https://facebook.com/..."
                    className={`w-full rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg px-4 py-2.5 text-sm outline-none focus:border-brand-gold dark:text-white ${isRTL ? 'text-right' : ''}`}
                  />
                </div>
                <div className={`flex gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 btn-primary text-sm disabled:opacity-50"
                  >
                    {saving ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                    ) : (isRTL ? 'حفظ التغييرات' : 'Save Changes')}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="flex-1 btn-outline text-sm"
                  >
                    {isRTL ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              </div>
            </div>
          )}
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
          {(bazaar.whatsappLink || bazaar.instagramLink || bazaar.facebookLink) && (
            <div className={`bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-5 ${isRTL ? 'text-right' : ''}`}>
              <h3 className="font-bold text-gray-900 dark:text-dark-text mb-3 text-sm">
                {isRTL ? 'روابط التواصل الاجتماعي' : 'Social Links'}
              </h3>
              <div className="space-y-2">
                {bazaar.whatsappLink && (
                  <a href={bazaar.whatsappLink} target="_blank" rel="noreferrer"
                    className={`flex items-center gap-2 text-sm text-emerald-600 hover:underline ${isRTL ? 'flex-row-reverse' : ''}`}>
                    📱 WhatsApp
                  </a>
                )}
                {bazaar.instagramLink && (
                  <a href={bazaar.instagramLink} target="_blank" rel="noreferrer"
                    className={`flex items-center gap-2 text-sm text-pink-600 hover:underline ${isRTL ? 'flex-row-reverse' : ''}`}>
                    📸 Instagram
                  </a>
                )}
                {bazaar.facebookLink && (
                  <a href={bazaar.facebookLink} target="_blank" rel="noreferrer"
                    className={`flex items-center gap-2 text-sm text-blue-600 hover:underline ${isRTL ? 'flex-row-reverse' : ''}`}>
                    👥 Facebook
                  </a>
                )}
              </div>
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
            {products.length > 0 || brandId
              ? (isRTL
                ? 'تعذر ربط البازار بماركتك. حدّث الصفحة — أو من Products تأكد أن المنتجات مربوطة بماركتك.'
                : 'Could not link your bazaar yet. Refresh the page — or check Products are tied to your brand.')
              : (isRTL
                ? 'سيتم إنشاء بازارك بعد موافقة الإدارة. إذا وافق الأدمن بالفعل، سجّل خروج ثم ادخل من جديد.'
                : 'Your bazaar appears after admin approval. If already approved, log out and sign in again.')}
          </p>
          <button
            type="button"
            onClick={() => loadBazaar()}
            className="btn-primary text-sm mt-4"
          >
            {isRTL ? 'إعادة المحاولة' : 'Retry'}
          </button>
        </div>
      )}
    </div>
  );
}

const getProductImageSrc = (product) => {
  const first = product?.images?.[0];
  if (typeof first === 'string') return first;
  if (first?.url) return first.url;
  if (typeof product?.mainImage === 'string') return product.mainImage;
  if (product?.mainImage?.url) return product.mainImage.url;
  return product?.image || null;
};

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
                {getProductImageSrc(product) ? (
                  <img 
                    src={getProductImageSrc(product)}
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

function SellerInventoryTab({ isRTL, t }) {
  const { user } = useAuth();
  const getBrandKey = () => `brandhive_seller_brand_${user?.id || user?._id || 'default'}`;
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [adjustModal, setAdjustModal] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    productId: '',
    quantity: '',
    reason: 'restock',
    notes: '',
  });
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      setLogsLoading(true);
      try {
        const [logsRes, productsList] = await Promise.allSettled([
          inventoryAPI.getLogs({ limit: 20 }),
          fetchSellerInventoryProducts(user),
        ]);
        if (logsRes.status === 'fulfilled') {
          const data = logsRes.value.data?.data || logsRes.value.data || [];
          setLogs(Array.isArray(data) ? data : []);
        }
        if (productsList.status === 'fulfilled') {
          setProducts(Array.isArray(productsList.value) ? productsList.value : []);
        }
      } catch {
        setLogs([]);
      } finally {
        setLogsLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const handleAdjust = async () => {
    if (!adjustForm.productId || !adjustForm.quantity) {
      toast.error(isRTL ? 'يرجى ملء جميع الحقول' : 'Please fill all fields');
      return;
    }
    setAdjustLoading(true);
    try {
      const selected = products.find(
        (p) => String(p._id || p.id) === String(adjustForm.productId)
      );
      await adjustSellerStock(adjustForm.productId, {
        quantity: Number(adjustForm.quantity),
        reason: adjustForm.reason,
        notes: adjustForm.notes,
        currentStock: selected?.stock,
        catalogFallback: Boolean(selected?._catalogFallback || !selected?._sellerOwned),
      });
      toast.success(isRTL ? 'تم تعديل المخزون ✅' : 'Stock adjusted ✅');
      setAdjustModal(false);
      setAdjustForm({ productId: '', quantity: '', reason: 'restock', notes: '' });
      const [logsRes, productsList] = await Promise.allSettled([
        inventoryAPI.getLogs({ limit: 20 }),
        fetchSellerInventoryProducts(user),
      ]);
      if (logsRes.status === 'fulfilled') {
        const data = logsRes.value.data?.data || logsRes.value.data || [];
        setLogs(Array.isArray(data) ? data : []);
      }
      if (productsList.status === 'fulfilled') {
        setProducts(Array.isArray(productsList.value) ? productsList.value : []);
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
        (isRTL ? 'فشل تعديل المخزون' : 'Failed to adjust stock')
      );
    } finally {
      setAdjustLoading(false);
    }
  };

  const REASON_OPTIONS = [
    { value: 'restock', label: isRTL ? 'إعادة تخزين' : 'Restock' },
    { value: 'damage', label: isRTL ? 'تلف' : 'Damage' },
    { value: 'return', label: isRTL ? 'مرتجع' : 'Return' },
    { value: 'correction', label: isRTL ? 'تصحيح' : 'Correction' },
    { value: 'sale', label: isRTL ? 'بيع' : 'Sale' },
  ];

  const REASON_COLORS = {
    restock: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
    damage: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
    return: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
    correction: 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
    sale: 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
  };

  const lowStockProducts = products.filter(p => (p.stock || 0) <= 5);

  return (
    <div>
      <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
        <h1 className={`text-xl sm:text-2xl font-display font-bold text-gray-900 dark:text-dark-text ${isRTL ? 'text-right' : ''}`}>
          {isRTL ? 'إدارة المخزون' : 'Inventory Management'}
        </h1>
        <button
          onClick={() => setAdjustModal(true)}
          disabled={!logsLoading && products.length === 0}
          className="btn-primary text-sm flex items-center justify-center gap-2 w-full sm:w-auto shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={14} />
          {isRTL ? 'تعديل مخزون' : 'Adjust Stock'}
        </button>
      </div>

      {!logsLoading && products.length === 0 && (
        <div className={`mb-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 ${isRTL ? 'text-right' : ''}`}>
          <p className="text-sm text-amber-800 dark:text-amber-300">
            {isRTL
              ? 'لم نجد منتجات بعد. أضف منتجاً من تبويب Products ثم حدّث الصفحة — إذا أضفت منتجاً للتو ولم يظهر، جرّب تسجيل الخروج والدخول مرة أخرى.'
              : 'No products found yet. Add one from the Products tab and refresh — if you just added a product, try logging out and back in.'}
          </p>
        </div>
      )}

      {lowStockProducts.length > 0 && (
        <div className={`mb-6 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-2xl p-4 ${isRTL ? 'text-right' : ''}`}>
          <p className={`font-bold text-red-700 dark:text-red-400 text-sm mb-2 flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            ⚠️ {isRTL ? 'منتجات بمخزون منخفض' : 'Low Stock Products'}
          </p>
          <div className="flex flex-wrap gap-2">
            {lowStockProducts.map(p => (
              <span
                key={p._id || p.id}
                className={`text-xs px-2 py-1 rounded-full ${
                  (p.stock || 0) === 0
                    ? 'bg-red-200 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400'
                }`}
              >
                {p.name} — {p.stock || 0} {isRTL ? 'متبقي' : 'left'}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6">
        <h3 className={`font-bold text-gray-900 dark:text-dark-text mb-4 ${isRTL ? 'text-right' : ''}`}>
          {isRTL ? 'سجل المخزون' : 'Inventory Log'}
        </h3>

        {logsLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 dark:bg-dark-surface rounded-xl animate-pulse" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-4xl mb-2">📦</p>
            <p className="text-gray-500 dark:text-dark-muted text-sm">
              {isRTL ? 'لا توجد سجلات بعد' : 'No inventory logs yet'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
            <table className={`w-full min-w-[32rem] text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
              <thead>
                <tr className="border-b border-gray-100 dark:border-dark-border">
                  {[
                    isRTL ? 'المنتج' : 'Product',
                    isRTL ? 'التغيير' : 'Change',
                    isRTL ? 'السبب' : 'Reason',
                    isRTL ? 'المخزون بعد' : 'Stock After',
                    isRTL ? 'التاريخ' : 'Date',
                  ].map(h => (
                    <th key={h} className="text-xs font-semibold text-gray-400 dark:text-dark-muted uppercase pb-3 px-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={log._id || i} className="border-b border-gray-50 dark:border-dark-border/50 last:border-0 hover:bg-gray-50/50 dark:hover:bg-dark-bg/50">
                    <td className="py-3 px-2 font-medium text-gray-900 dark:text-dark-text truncate max-w-[150px]">
                      {log.product?.name || log.productName || '—'}
                    </td>
                    <td className={`py-3 px-2 font-bold ${
                      (log.quantityChange || log.change || 0) > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {(log.quantityChange || log.change || 0) > 0 ? '+' : ''}
                      {log.quantityChange || log.change || 0}
                    </td>
                    <td className="py-3 px-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${REASON_COLORS[log.reason] || REASON_COLORS.correction}`}>
                        {REASON_OPTIONS.find(r => r.value === log.reason)?.label || log.reason || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-gray-600 dark:text-dark-muted">
                      {log.stockAfter ?? log.currentStock ?? '—'}
                    </td>
                    <td className="py-3 px-2 text-gray-400 dark:text-dark-muted text-xs">
                      {log.createdAt ? new Date(log.createdAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {adjustModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className={`bg-white dark:bg-dark-surface rounded-3xl shadow-2xl p-8 w-full max-w-md ${isRTL ? 'text-right' : ''}`}>
            <div className={`flex items-center justify-between mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <h3 className="text-xl font-display font-bold text-gray-900 dark:text-dark-text">
                {isRTL ? 'تعديل المخزون' : 'Adjust Stock'}
              </h3>
              <button onClick={() => setAdjustModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-dark-text">
                <XCircle size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-dark-muted mb-1">
                  {isRTL ? 'المنتج' : 'Product'} *
                </label>
                <select
                  value={adjustForm.productId}
                  onChange={e => setAdjustForm(p => ({ ...p, productId: e.target.value }))}
                  className={`w-full rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg px-4 py-2.5 text-sm outline-none focus:border-brand-gold dark:text-white ${isRTL ? 'text-right' : ''}`}
                >
                  <option value="">{isRTL ? 'اختر منتجاً' : 'Select a product'}</option>
                  {products.map(p => (
                    <option key={p._id || p.id} value={p._id || p.id}>
                      {p.name} ({isRTL ? 'مخزون:' : 'Stock:'} {p.stock || 0})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-dark-muted mb-1">
                  {isRTL ? 'الكمية (+ للإضافة، - للخصم)' : 'Quantity (+ to add, - to deduct)'} *
                </label>
                <input
                  type="number"
                  value={adjustForm.quantity}
                  onChange={e => setAdjustForm(p => ({ ...p, quantity: e.target.value }))}
                  placeholder={isRTL ? 'مثال: +50 أو -10' : 'e.g. 50 or -10'}
                  className={`w-full rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg px-4 py-2.5 text-sm outline-none focus:border-brand-gold dark:text-white`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-dark-muted mb-1">
                  {isRTL ? 'السبب' : 'Reason'} *
                </label>
                <select
                  value={adjustForm.reason}
                  onChange={e => setAdjustForm(p => ({ ...p, reason: e.target.value }))}
                  className={`w-full rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg px-4 py-2.5 text-sm outline-none focus:border-brand-gold dark:text-white ${isRTL ? 'text-right' : ''}`}
                >
                  {REASON_OPTIONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-dark-muted mb-1">
                  {isRTL ? 'ملاحظات (اختياري)' : 'Notes (optional)'}
                </label>
                <input
                  value={adjustForm.notes}
                  onChange={e => setAdjustForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder={isRTL ? 'أي ملاحظات إضافية...' : 'Any additional notes...'}
                  className={`w-full rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg px-4 py-2.5 text-sm outline-none focus:border-brand-gold dark:text-white`}
                />
              </div>

              <div className={`flex gap-3 pt-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button
                  onClick={handleAdjust}
                  disabled={adjustLoading || !adjustForm.productId || !adjustForm.quantity}
                  className="flex-1 btn-primary text-sm disabled:opacity-50"
                >
                  {adjustLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                  ) : (isRTL ? 'تأكيد التعديل' : 'Confirm Adjustment')}
                </button>
                <button onClick={() => setAdjustModal(false)} className="flex-1 btn-outline text-sm">
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SellerShopSettingsTab({ isRTL, t, dashboard, user }) {
  const [form, setForm] = useState({
    storeName: dashboard?.brand?.name || user?.brandName || '',
    storeDescription: dashboard?.brand?.description || '',
    email: user?.email || '',
    phone: user?.phone || '',
    whatsapp: '',
    acceptsCOD: true,
    autoConfirm: false,
    lowStockAlert: 5,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('brandhive_shop_settings'));
      if (saved) setForm(prev => ({ ...prev, ...saved }));
    } catch {
      // keep defaults
    }
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem('brandhive_shop_settings', JSON.stringify(form));
      await new Promise(r => setTimeout(r, 600));
      toast.success(isRTL ? 'تم حفظ الإعدادات ✅' : 'Settings saved ✅');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className={`text-2xl font-display font-bold text-gray-900 dark:text-dark-text mb-6 ${isRTL ? 'text-right' : ''}`}>
        {isRTL ? 'إعدادات المتجر' : 'Shop Settings'}
      </h1>

      <div className="space-y-6">
        <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6">
          <h3 className={`font-bold text-gray-900 dark:text-dark-text mb-4 ${isRTL ? 'text-right' : ''}`}>
            {isRTL ? 'معلومات المتجر' : 'Store Information'}
          </h3>
          <div className={`space-y-4 ${isRTL ? 'text-right' : ''}`}>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-dark-muted mb-1">
                {isRTL ? 'اسم المتجر' : 'Store Name'}
              </label>
              <input
                value={form.storeName}
                onChange={e => setForm(p => ({ ...p, storeName: e.target.value }))}
                className={`w-full rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg px-4 py-2.5 text-sm outline-none focus:border-brand-gold dark:text-white ${isRTL ? 'text-right' : ''}`}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-dark-muted mb-1">
                {isRTL ? 'وصف المتجر' : 'Store Description'}
              </label>
              <textarea
                value={form.storeDescription}
                onChange={e => setForm(p => ({ ...p, storeDescription: e.target.value }))}
                rows={3}
                className={`w-full rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg px-4 py-2.5 text-sm outline-none focus:border-brand-gold resize-none dark:text-white ${isRTL ? 'text-right' : ''}`}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-dark-muted mb-1">
                  {isRTL ? 'البريد الإلكتروني' : 'Email'}
                </label>
                <input
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg px-4 py-2.5 text-sm outline-none focus:border-brand-gold dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-dark-muted mb-1">
                  {isRTL ? 'رقم الهاتف' : 'Phone'}
                </label>
                <input
                  value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg px-4 py-2.5 text-sm outline-none focus:border-brand-gold dark:text-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-dark-muted mb-1">
                WhatsApp
              </label>
              <input
                value={form.whatsapp}
                onChange={e => setForm(p => ({ ...p, whatsapp: e.target.value }))}
                placeholder="01xxxxxxxxx"
                className="w-full rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg px-4 py-2.5 text-sm outline-none focus:border-brand-gold dark:text-white"
              />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6">
          <h3 className={`font-bold text-gray-900 dark:text-dark-text mb-4 ${isRTL ? 'text-right' : ''}`}>
            {isRTL ? 'التفضيلات' : 'Preferences'}
          </h3>
          <div className="space-y-4">
            {[
              {
                key: 'acceptsCOD',
                label: isRTL ? 'قبول الدفع عند الاستلام' : 'Accept Cash on Delivery',
                desc: isRTL ? 'السماح للعملاء بالدفع عند الاستلام' : 'Allow customers to pay on delivery',
              },
              {
                key: 'autoConfirm',
                label: isRTL ? 'تأكيد الطلبات تلقائياً' : 'Auto-confirm Orders',
                desc: isRTL ? 'تأكيد الطلبات الجديدة تلقائياً دون مراجعة' : 'Automatically confirm new orders without review',
              },
            ].map(item => (
              <div key={item.key} className={`flex items-center justify-between gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={isRTL ? 'text-right' : ''}>
                  <p className="text-sm font-semibold text-gray-900 dark:text-dark-text">{item.label}</p>
                  <p className="text-xs text-gray-500 dark:text-dark-muted">{item.desc}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(p => ({ ...p, [item.key]: !p[item.key] }))}
                  className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                    form[item.key] ? 'bg-brand-gold' : 'bg-gray-200 dark:bg-dark-border'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${
                    form[item.key] ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            ))}

            <div className={isRTL ? 'text-right' : ''}>
              <label className="block text-xs font-semibold text-gray-600 dark:text-dark-muted mb-1">
                {isRTL ? 'تنبيه المخزون المنخفض (عند وصول الكمية إلى)' : 'Low Stock Alert (when quantity reaches)'}
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={form.lowStockAlert}
                onChange={e => setForm(p => ({ ...p, lowStockAlert: Number(e.target.value) }))}
                className="w-24 rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg px-4 py-2 text-sm outline-none focus:border-brand-gold dark:text-white"
              />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-primary disabled:opacity-50 w-full sm:w-auto"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
          ) : (isRTL ? 'حفظ الإعدادات' : 'Save Settings')}
        </button>
      </div>
    </div>
  );
}


export default function SellerDashboard() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user, logout } = useAuth();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(
    () => searchParams.get('tab') || 'dashboard'
  );
  const navigate = useNavigate();

  const getBrandKey = () => `brandhive_seller_brand_${user?.id || user?._id || 'default'}`;

  const [dashboard, setDashboard] = useState(null);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState(() => readCachedSellerProducts(user));
  const [myBrandId, setMyBrandId] = useState(
    () => localStorage.getItem(`brandhive_seller_brand_${user?.id || user?._id || 'default'}`) || null
  );
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [stockAlerts, setStockAlerts] = useState([]);

  const orderStats = useMemo(
    () => computeSellerOrderStats(orders, isRTL ? 'ar-EG' : 'en-US'),
    [orders, isRTL]
  );

  const activeProductCount = useMemo(
    () =>
      products.length ||
      getCachedSellerProductCount(user) ||
      dashboard?.products?.active ||
      0,
    [products.length, user, dashboard?.products?.active]
  );

  const bazaarHealth = useMemo(
    () => computeBazaarHealth(orders, products, isRTL),
    [orders, products, isRTL]
  );

  const topProducts = useMemo(
    () => pickTopProducts(orderStats, analytics, products),
    [orderStats, analytics, products]
  );

  const loadSellerProducts = useCallback(async () => {
    try {
      const prodData = await fetchSellerProducts(user);
      setProducts(Array.isArray(prodData) ? prodData : []);
      const brandId =
        localStorage.getItem(
          `brandhive_seller_brand_${user?.id || user?._id || 'default'}`
        ) || null;
      if (brandId) setMyBrandId(brandId);
    } catch {
      const cached = readCachedSellerProducts(user);
      if (cached.length > 0) setProducts(cached);
    }
  }, [user]);

  const loadSellerOrders = useCallback(async () => {
    try {
      const ordData = await fetchSellerOrders(user);
      setOrders(Array.isArray(ordData) ? ordData : []);
    } catch {
      setOrders([]);
    }
  }, [user]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const cachedProducts = readCachedSellerProducts(user);
      if (cachedProducts.length > 0) {
        setProducts((prev) => (prev.length > 0 ? prev : cachedProducts));
      }

      const [dashResult, analyticsResult] = await Promise.allSettled([
        sellerAPI.getDashboard(),
        sellerAPI.getAnalytics(),
        loadSellerOrders(),
        loadSellerProducts(),
        ensureSellerBrandLinked(user),
      ]);

      if (dashResult.status === 'fulfilled') {
        const dashData =
          dashResult.value.data?.data || dashResult.value.data || {};
        setDashboard(dashData);
        const dashBrand = dashData.brand;
        const dashBrandId = dashBrand?._id || dashBrand?.id;
        if (dashBrandId) {
          setMyBrandId(String(dashBrandId));
          const userId = user?.id || user?._id;
          if (userId && dashBrand) {
            rememberSellerBrand(userId, dashBrand);
          }
        }
      } else {
        setDashboard(null);
      }

      if (analyticsResult.status === 'fulfilled') {
        setAnalytics(
          analyticsResult.value.data?.data ||
            analyticsResult.value.data ||
            null
        );
      } else {
        setAnalytics(null);
      }

      setStockAlerts([]);
      setLoading(false);
    };
    fetchData();
  }, [user, loadSellerProducts, loadSellerOrders]);

  useEffect(() => {
    if (activeTab === 'products' || activeTab === 'inventory' || activeTab === 'bazaar') {
      loadSellerProducts();
    }
    if (activeTab === 'orders' || activeTab === 'dashboard') {
      loadSellerOrders();
    }
  }, [activeTab, loadSellerProducts, loadSellerOrders]);

  const brandName = user?.name || 'Seller';

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const mobileNavItems = [
    { icon: LayoutDashboard, label: isRTL ? 'لوحة التحكم' : 'Dashboard', tab: 'dashboard' },
    { icon: Store, label: isRTL ? 'البازار' : 'Bazaar', tab: 'bazaar' },
    { icon: Package, label: isRTL ? 'الطلبات' : 'Orders', tab: 'orders' },
    { icon: ShoppingBag, label: isRTL ? 'المنتجات' : 'Products', tab: 'products' },
    { icon: Boxes, label: isRTL ? 'المخزون' : 'Inventory', tab: 'inventory' },
    { icon: DollarSign, label: isRTL ? 'الأرباح' : 'Revenue', tab: 'revenue' },
    { icon: Star, label: isRTL ? 'التقييمات' : 'Reviews', tab: 'reviews' },
    { icon: Settings, label: isRTL ? 'الإعدادات' : 'Settings', tab: 'settings' },
  ];

  const navSections = [
    {
      label: isRTL ? 'نظرة عامة' : 'Overview',
      items: [
        { icon: LayoutDashboard, label: isRTL ? 'لوحة التحكم' : 'Dashboard', tab: 'dashboard' },
        { icon: Store, label: isRTL ? 'البازار الخاص بي' : 'My Bazaar', tab: 'bazaar' },
        { icon: Package, label: isRTL ? 'الطلبات' : 'Orders', tab: 'orders' },
        { icon: ShoppingBag, label: isRTL ? 'المنتجات' : 'Products', tab: 'products' },
        { icon: Boxes, label: isRTL ? 'المخزون' : 'Inventory', tab: 'inventory' },
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
      <div className="page-container py-4 sm:py-8">
        <div className={`flex flex-col md:flex-row gap-4 md:gap-8 ${isRTL ? 'md:flex-row-reverse' : ''}`}>
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
          <div className="flex-1 min-w-0 w-full">
            {/* Mobile navigation */}
            <div className="md:hidden overflow-x-auto pb-4 mb-2 -mx-1">
              <div className={`flex gap-2 whitespace-nowrap px-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                {mobileNavItems.map(item => (
                  <button
                    key={item.tab}
                    type="button"
                    onClick={() => setActiveTab(item.tab)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium flex-shrink-0 transition-all ${
                      activeTab === item.tab
                        ? 'bg-brand-navy dark:bg-brand-gold text-white dark:text-brand-navy'
                        : 'bg-white dark:bg-dark-surface text-gray-600 dark:text-dark-text border border-gray-100 dark:border-dark-border'
                    } ${isRTL ? 'flex-row-reverse' : ''}`}
                  >
                    <item.icon size={13} />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

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

                {stockAlerts.length > 0 && (
                  <div className={`mb-6 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-2xl p-4 ${isRTL ? 'text-right' : ''}`}>
                    <div className={`flex items-center gap-2 mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <span className="text-red-500">⚠️</span>
                      <h3 className="font-bold text-red-700 dark:text-red-400 text-sm">
                        {isRTL ? `تحذير: ${stockAlerts.length} منتج بمخزون منخفض` : `Warning: ${stockAlerts.length} product${stockAlerts.length > 1 ? 's' : ''} with low stock`}
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {stockAlerts.slice(0, 3).map((alert, i) => (
                        <div key={alert._id || i} className={`flex items-center justify-between gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <span className="text-sm text-gray-700 dark:text-dark-text truncate">
                            {alert.name || alert.productName || 'Product'}
                          </span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                            (alert.stock || alert.quantity || 0) === 0
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                          }`}>
                            {(alert.stock || alert.quantity || 0) === 0
                              ? (isRTL ? 'نفد المخزون' : 'Out of stock')
                              : `${alert.stock || alert.quantity} ${isRTL ? 'متبقي' : 'left'}`
                            }
                          </span>
                        </div>
                      ))}
                      {stockAlerts.length > 3 && (
                        <p className="text-xs text-gray-500 dark:text-dark-muted">
                          {isRTL ? `+${stockAlerts.length - 3} منتجات أخرى` : `+${stockAlerts.length - 3} more products`}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Stat cards */}
                <div className={`grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  {[
                    { icon: DollarSign, label: isRTL ? 'الأرباح (ج.م)' : 'Revenue (EGP)', value: pickMetricNumber(orderStats.totalRevenue, dashboard?.totalRevenue, dashboard?.revenue?.total).toLocaleString(), change: '+0%', color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' },
                    { icon: Package, label: isRTL ? 'إجمالي الطلبات' : 'Total Orders', value: pickMetricNumber(orderStats.totalCount, orders.length, dashboard?.orders?.total).toString(), change: '+0%', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' },
                    { icon: ShoppingBag, label: isRTL ? 'المنتجات النشطة' : 'Active Products', value: activeProductCount.toString(), change: '+0', color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400' },
                    { icon: Star, label: isRTL ? 'متوسط التقييم' : 'Avg Rating', value: (dashboard?.reviews?.averageRating || 0).toFixed(1), change: '+0', color: 'bg-rose-100 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400' },
                    { icon: Users, label: isRTL ? 'طلبات معلقة' : 'Pending Orders', value: pickMetricNumber(orderStats.pendingCount, dashboard?.orders?.pending).toString(), change: '+0', color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' },
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
                                          dashboard?.chartData || dashboard?.revenueData ||
                                          (orderStats.revenueChart.some((entry) => entry.revenue > 0)
                                            ? orderStats.revenueChart
                                            : null);
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
                      {bazaarHealth.map((metric) => (
                        <div key={metric.label}>
                          <div className={`flex justify-between text-sm mb-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <span className="text-gray-600 dark:text-dark-muted">{metric.label}</span>
                            <span className="font-semibold text-gray-900 dark:text-dark-text">{metric.value}</span>
                          </div>
                          <div className="h-2 bg-gray-100 dark:bg-dark-bg rounded-full overflow-hidden">
                            <div
                              className={`h-full ${metric.color} rounded-full transition-all`}
                              style={{ width: `${metric.percent}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <h4 className="font-semibold text-gray-900 dark:text-dark-text mb-3 text-sm">{isRTL ? 'أفضل المنتجات' : 'Top Products'}</h4>
                    {topProducts.length > 0 ? (
                      topProducts.slice(0, 5).map((product, index) => {
                        const maxSales = topProducts[0]?.totalSales || topProducts[0]?.sales || 1;
                        const sales = product.totalSales || product.sales || 0;
                        const percent = maxSales > 0 ? Math.round((sales / maxSales) * 100) : 0;
                        return (
                          <div key={product._id || product.productId || index} className={`flex items-center gap-2 mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <span className="text-xs text-gray-600 dark:text-dark-muted flex-1 truncate">
                              {product.productName || product.name || 'Product'}
                            </span>
                            <div className="w-24 h-1.5 bg-gray-100 dark:bg-dark-bg rounded-full overflow-hidden">
                              <div className="h-full bg-brand-gold rounded-full" style={{ width: `${sales > 0 ? percent : 8}%` }} />
                            </div>
                            <span className="text-xs text-gray-500 dark:text-dark-muted w-14 text-right whitespace-nowrap">
                              {sales > 0
                                ? `${sales.toLocaleString()} ${isRTL ? 'ج.م' : 'EGP'}`
                                : (isRTL ? 'بدون مبيعات' : 'No sales')}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-xs text-gray-400 dark:text-dark-muted italic py-2">
                        {isRTL ? 'لا توجد بيانات بعد' : 'No data yet'}
                      </div>
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
                              <td className="py-3 px-2 text-gray-600 dark:text-dark-muted max-w-[140px] truncate">{order.items?.[0]?.name || order.items?.[0]?.product?.name || 'Product'}</td>
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
                t={t}
              />
            )}

            {/* Revenue Tab */}
            {activeTab === 'revenue' && (
              <SellerRevenueTab 
                dashboard={dashboard}
                analytics={analytics}
                analyticsLoading={analyticsLoading}
                orderStats={orderStats}
                isRTL={isRTL}
                t={t}
              />
            )}

            {/* Reviews Tab */}
            {activeTab === 'reviews' && (
              <SellerReviewsTab 
                isRTL={isRTL}
                user={user}
              />
            )}

            {/* Bazaar Tab */}
            {activeTab === 'bazaar' && (
              <SellerBazaarTab
                isRTL={isRTL}
                sellerAPI={sellerAPI}
                user={user}
                products={products}
                brandId={myBrandId}
                orderStats={orderStats}
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

            {activeTab === 'inventory' && (
              <SellerInventoryTab isRTL={isRTL} t={t} />
            )}

            {activeTab === 'settings' && (
              <SellerShopSettingsTab
                isRTL={isRTL}
                t={t}
                dashboard={dashboard}
                user={user}
              />
            )}

            {activeTab === 'messages' && (
              <SellerMessagesTab isRTL={isRTL} brandId={myBrandId} />
            )}

            {activeTab === 'payouts' && (
              <SellerPayoutsTab
                user={user}
                brandId={myBrandId}
                orderStats={orderStats}
                isRTL={isRTL}
              />
            )}

            {activeTab === 'promotions' && (
              <div>
                <h1 className={`text-2xl font-display font-bold text-gray-900 dark:text-dark-text mb-6 ${isRTL ? 'text-right' : ''}`}>
                  {isRTL ? 'العروض والخصومات' : 'Promotions & Discounts'}
                </h1>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {[
                    { icon: '🏷️', title: isRTL ? 'كوبونات الخصم' : 'Discount Coupons', desc: isRTL ? 'أنشئ كوبونات خصم لعملائك بنسبة مئوية أو قيمة ثابتة' : 'Create discount coupons for customers — percentage or fixed value', status: isRTL ? 'قريباً' : 'Coming Soon', color: 'bg-purple-50 dark:bg-purple-900/10' },
                    { icon: '⚡', title: isRTL ? 'عروض فلاش' : 'Flash Sales', desc: isRTL ? 'خصومات محدودة الوقت تزيد المبيعات بشكل كبير' : 'Limited-time discounts that dramatically boost sales', status: isRTL ? 'قريباً' : 'Coming Soon', color: 'bg-amber-50 dark:bg-amber-900/10' },
                    { icon: '🎁', title: isRTL ? 'اشترِ X واحصل على Y' : 'Buy X Get Y', desc: isRTL ? 'عروض "اشترِ واحد واحصل على الثاني بنصف السعر" وما شابهها' : 'Buy one get one free and similar bundle deals', status: isRTL ? 'قريباً' : 'Coming Soon', color: 'bg-emerald-50 dark:bg-emerald-900/10' },
                    { icon: '🚚', title: isRTL ? 'شحن مجاني' : 'Free Shipping', desc: isRTL ? 'قدم شحناً مجانياً عند تجاوز حد معين للطلب' : 'Offer free shipping above a minimum order value', status: isRTL ? 'قريباً' : 'Coming Soon', color: 'bg-blue-50 dark:bg-blue-900/10' },
                  ].map((item, i) => (
                    <div key={i} className={`${item.color} rounded-2xl p-5 ${isRTL ? 'text-right' : ''}`}>
                      <div className="text-3xl mb-3">{item.icon}</div>
                      <div className={`flex items-start justify-between gap-2 mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <h3 className="font-bold text-gray-900 dark:text-dark-text">{item.title}</h3>
                        <span className="text-xs bg-gray-200 dark:bg-dark-bg text-gray-500 dark:text-dark-muted px-2 py-0.5 rounded-full whitespace-nowrap">{item.status}</span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-dark-muted">{item.desc}</p>
                    </div>
                  ))}
                </div>
                <div className={`flex items-start gap-3 bg-brand-gold-pale dark:bg-brand-gold/10 rounded-2xl p-5 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                  <span className="text-2xl">💡</span>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-dark-text text-sm mb-1">
                      {isRTL ? 'هل تعلم؟' : 'Did you know?'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-dark-muted">
                      {isRTL
                        ? 'المتاجر التي تستخدم العروض والخصومات تحقق مبيعات أعلى بنسبة 35% في المتوسط على منصة BrandHive.'
                        : 'Stores using promotions and discounts achieve 35% higher sales on average on BrandHive.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'ads' && (
              <div>
                <h1 className={`text-2xl font-display font-bold text-gray-900 dark:text-dark-text mb-6 ${isRTL ? 'text-right' : ''}`}>
                  {isRTL ? 'مدير الإعلانات' : 'Ads Manager'}
                </h1>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {[
                    { icon: '🔝', title: isRTL ? 'منتج مميز' : 'Featured Product', desc: isRTL ? 'اجعل منتجك يظهر في أعلى نتائج البحث والصفحة الرئيسية' : 'Get your product featured on search results and homepage', price: isRTL ? 'من 99 ج.م / يوم' : 'From 99 EGP/day' },
                    { icon: '🏪', title: isRTL ? 'ماركة مميزة' : 'Featured Brand', desc: isRTL ? 'احصل على مكان مميز في قسم "أفضل الماركات" على الصفحة الرئيسية' : 'Get a featured spot in the Top Brands section on homepage', price: isRTL ? 'من 299 ج.م / أسبوع' : 'From 299 EGP/week' },
                    { icon: '📢', title: isRTL ? 'إعلان بانر' : 'Banner Ad', desc: isRTL ? 'أعلن عن منتجاتك أو عروضك في أماكن بارزة على المنصة' : 'Advertise your products or offers in prominent platform spots', price: isRTL ? 'من 499 ج.م / أسبوع' : 'From 499 EGP/week' },
                  ].map((item, i) => (
                    <div key={i} className={`bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6 ${isRTL ? 'text-right' : ''}`}>
                      <div className="text-3xl mb-3">{item.icon}</div>
                      <h3 className="font-bold text-gray-900 dark:text-dark-text mb-2">{item.title}</h3>
                      <p className="text-sm text-gray-500 dark:text-dark-muted mb-4">{item.desc}</p>
                      <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <span className="text-brand-gold font-bold text-sm">{item.price}</span>
                        <button type="button" className="text-xs bg-brand-navy dark:bg-brand-gold text-white dark:text-brand-navy px-3 py-1.5 rounded-lg font-semibold opacity-50 cursor-not-allowed">
                          {isRTL ? 'قريباً' : 'Coming Soon'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className={`flex items-start gap-3 bg-brand-navy/5 dark:bg-brand-navy/20 rounded-2xl p-5 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                  <span className="text-2xl">📩</span>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-dark-text text-sm mb-1">
                      {isRTL ? 'مهتم بالإعلان؟' : 'Interested in advertising?'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-dark-muted">
                      {isRTL
                        ? 'تواصل مع فريق BrandHive على support@brandhive.com لمعرفة المزيد عن خيارات الإعلان المتاحة.'
                        : 'Contact the BrandHive team at support@brandhive.com to learn more about available advertising options.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
