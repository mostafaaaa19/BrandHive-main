import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Store, Package, DollarSign, Search as SearchIcon,
  Flag, Target, Settings, Bell, FileText, LogOut, CheckCircle, Eye, BarChart3, XCircle, Trash2, Tag, Plus
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { adminAPI, productsAPI, couponsAPI } from '../../services/api';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import toast from 'react-hot-toast';
import SettingsPanel from '../../components/SettingsPanel';

const exportToCSV = (data, filename) => {
  if (!data || data.length === 0) {
    toast.error('No data to export');
    return;
  }
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row =>
      headers.map(h => {
        const val = row[h] ?? '';
        const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
        return `"${str.replace(/"/g, '""')}"`;
      }).join(',')
    )
  ];
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  toast.success(`${filename}.csv downloaded!`);
};

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
      setUsers(prev => prev.map(u =>
        (u._id === userId || u.id === userId)
          ? { ...u, isActive: !u.isActive }
          : u
      ));
      toast.success(isRTL ? 'تم تحديث الحالة ✅' : 'Status updated ✅');
    } catch {
      toast.error(isRTL ? 'فشل التحديث' : 'Failed to update');
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(
      isRTL
        ? `هل أنت متأكد من حذف "${userName}"؟ لا يمكن التراجع عن هذا الإجراء.`
        : `Are you sure you want to delete "${userName}"? This cannot be undone.`
    )) return;

    const userToDelete = users.find(u => u._id === userId || u.id === userId);
    if (userToDelete?.role === 'admin') {
      toast.error(isRTL ? 'لا يمكن حذف حساب مشرف' : 'Cannot delete admin accounts');
      return;
    }

    try {
      await adminAPI.deleteUser(userId);
      setUsers(prev => prev.filter(u => u._id !== userId && u.id !== userId));
      toast.success(
        isRTL ? 'تم حذف المستخدم ✅' : 'User deleted ✅',
        { style: { borderRadius: '12px' } }
      );
    } catch (err) {
      toast.error(
        err.response?.data?.message || (isRTL ? 'فشل حذف المستخدم' : 'Failed to delete user'),
        { style: { borderRadius: '12px' } }
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
                      u.isActive === false
                        ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                        : 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                    }`}>
                      {u.isActive === false
                        ? (isRTL ? 'محظور' : 'Blocked')
                        : (isRTL ? 'نشط' : 'Active')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <button
                        onClick={() => 
                          handleToggle(u._id || u.id)
                        }
                        className={`text-xs px-3 py-1 
                          rounded-lg font-medium 
                          transition-colors ${
                          u.isActive === false
                            ? 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/20'
                            : 'bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20'
                        }`}>
                        {u.isActive === false
                          ? (isRTL ? 'رفع الحظر' : 'Unblock')
                          : (isRTL ? 'حظر' : 'Block')}
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u._id || u.id, u.name)}
                        className="px-3 py-1.5 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                      >
                        <Trash2 size={12} /> {isRTL ? 'حذف' : 'Delete'}
                      </button>
                    </div>
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

  const fetchOrders = async () => {
    try {
      const res = await adminAPI.getOrders();
      const data = res.data?.data || res.data?.orders || [];
      setOrders(Array.isArray(data) ? data : []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
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
                  isRTL ? 'تحديث' : 'Update',
                ].map(h => (
                  <th key={h} className="px-2 py-3 text-xs 
                    font-bold text-gray-400 dark:text-dark-muted 
                    uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((order, i) => (
                <tr key={order._id || i}
                  className="border-b border-gray-50 
                    dark:border-dark-border last:border-0
                    hover:bg-gray-50/50 
                    dark:hover:bg-dark-bg/50">
                  <td className="py-3 px-2 font-mono 
                    text-xs text-brand-gold font-bold">
                    #{(order._id || '').slice(-6)}
                  </td>
                  <td className="py-3 px-2 dark:text-dark-text 
                    text-sm">
                    {order.user?.name ||
                     order.shippingAddress?.fullName ||
                     order.user?.email?.split('@')[0] ||
                     'Customer'}
                  </td>
                  <td className="py-3 px-2 font-semibold 
                    dark:text-dark-text">
                    {(
                      order.subtotal ||
                      order.grandTotal ||
                      order.totalAmount ||
                      order.total ||
                      0
                    ).toLocaleString()} EGP
                  </td>
                  <td className="py-3 px-2 text-gray-500 
                    dark:text-dark-muted capitalize text-sm">
                    {order.paymentMethod || '-'}
                  </td>
                  <td className="py-3 px-2">
                    <span className={`px-2 py-1 rounded-full 
                      text-[10px] font-bold ${
                      order.status === 'delivered' ||
                      order.status === 'confirmed'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                        : order.status === 'shipped' ||
                          order.status === 'processing'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                        : order.status === 'cancelled'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                    }`}>
                      {order.status || 'pending'}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-gray-400 
                    dark:text-dark-muted text-xs">
                    {order.createdAt
                      ? new Date(order.createdAt).toLocaleDateString()
                      : '-'}
                  </td>
                  <td className="py-3 px-2">
                    <select
                      defaultValue={order.status}
                      onChange={async (e) => {
                        try {
                          await adminAPI.updateOrderStatus(
                            order._id,
                            {
                              status: e.target.value.toUpperCase(),
                              note: 'Updated by admin',
                            }
                          );
                          toast.success(isRTL
                            ? 'تم تحديث الحالة ✅'
                            : 'Status updated ✅'
                          );
                          await fetchOrders();
                        } catch {
                          toast.error(isRTL
                            ? 'فشل التحديث'
                            : 'Update failed'
                          );
                        }
                      }}
                      className="text-xs px-2 py-1 rounded-lg 
                        border border-gray-200 dark:border-dark-border
                        bg-white dark:bg-dark-bg 
                        dark:text-dark-text cursor-pointer"
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="processing">Processing</option>
                      <option value="shipped">Shipped</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
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
  const [actionLoading, setActionLoading] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await productsAPI.getAll({ page: 1, limit: 50 });
        const data = res.data?.data || [];
        setProducts(Array.isArray(data) ? data : []);
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const handleDelete = async (id, name) => {
    if (!window.confirm(isRTL ? `هل تريد حذف "${name}"؟` : `Delete "${name}"?`)) return;
    setActionLoading(id + '_delete');
    try {
      await adminAPI.deleteProduct(id);
      setProducts(prev => prev.filter(p => p._id !== id && p.id !== id));
      toast.success(isRTL ? 'تم حذف المنتج' : 'Product deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || (isRTL ? 'فشل الحذف' : 'Delete failed'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggle = async (product) => {
    const id = product._id || product.id;
    const isActive = product.isActive !== false;
    setActionLoading(id + '_toggle');
    try {
      if (isActive) {
        await adminAPI.deactivateProduct(id);
      } else {
        await adminAPI.activateProduct(id);
      }
      setProducts(prev => prev.map(p =>
        (p._id === id || p.id === id) ? { ...p, isActive: !isActive } : p
      ));
      toast.success(isActive
        ? (isRTL ? 'تم إخفاء المنتج' : 'Product deactivated')
        : (isRTL ? 'تم تفعيل المنتج' : 'Product activated')
      );
    } catch (err) {
      toast.error(err.response?.data?.message || (isRTL ? 'فشل التحديث' : 'Update failed'));
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = products.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.brand?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className={`flex items-center justify-between mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <h1 className={`text-2xl font-display font-bold text-gray-900 dark:text-dark-text ${isRTL ? 'text-right' : ''}`}>
          {isRTL ? 'إدارة المنتجات' : 'Products Management'}
          <span className="mx-2 text-sm font-normal text-gray-400">({products.length})</span>
        </h1>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={isRTL ? 'بحث...' : 'Search...'}
          className="px-4 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg text-sm outline-none focus:border-brand-gold dark:text-white w-48"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-56 bg-gray-100 dark:bg-dark-surface rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">📦</p>
          <p>{isRTL ? 'لا توجد منتجات' : 'No products found'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((product) => {
            const id = product._id || product.id;
            const isActive = product.isActive !== false;
            const imageUrl = product.images?.[0]?.url || product.images?.[0] || product.mainImage || null;
            return (
              <div key={id} className={`bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border overflow-hidden ${!isActive ? 'opacity-60' : ''}`}>
                <div className="h-36 bg-gray-100 dark:bg-dark-bg overflow-hidden relative">
                  {imageUrl ? (
                    <img src={imageUrl} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">📦</div>
                  )}
                  <span className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full font-semibold ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {isActive ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'غير نشط' : 'Inactive')}
                  </span>
                </div>
                <div className={`p-3 ${isRTL ? 'text-right' : ''}`}>
                  <p className="font-semibold text-sm text-gray-900 dark:text-dark-text truncate">{product.name}</p>
                  <p className="text-xs text-brand-gold font-bold mt-0.5">
                    {(product.finalPrice || product.price || 0).toLocaleString()} EGP
                  </p>
                  <p className="text-xs text-gray-400 dark:text-dark-muted mt-0.5 truncate">
                    {product.brand?.name || '—'}
                  </p>
                  <div className={`flex gap-2 mt-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <button
                      onClick={() => handleToggle(product)}
                      disabled={actionLoading === id + '_toggle'}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
                        isActive
                          ? 'bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 hover:bg-amber-100'
                          : 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100'
                      }`}
                    >
                      {actionLoading === id + '_toggle' ? '...' : isActive ? (isRTL ? 'إخفاء' : 'Deactivate') : (isRTL ? 'تفعيل' : 'Activate')}
                    </button>
                    <button
                      onClick={() => handleDelete(id, product.name)}
                      disabled={actionLoading === id + '_delete'}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === id + '_delete' ? '...' : (isRTL ? 'حذف' : 'Delete')}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AdminNotificationSender({ isRTL, adminAPI }) {
  const [form, setForm] = useState({ title: '', body: '' });
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error(isRTL ? 'يرجى ملء جميع الحقول' : 'Please fill all fields');
      return;
    }
    setLoading(true);
    try {
      await adminAPI.sendNotification(form);
      toast.success(isRTL ? 'تم إرسال الإشعار!' : 'Notification sent!');
      setForm({ title: '', body: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || (isRTL ? 'فشل الإرسال' : 'Failed to send'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`space-y-4 ${isRTL ? 'text-right' : ''}`}>
      <div>
        <label className="block text-sm font-semibold text-gray-700 dark:text-dark-text mb-1">
          {isRTL ? 'عنوان الإشعار' : 'Notification Title'}
        </label>
        <input
          value={form.title}
          onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
          placeholder={isRTL ? 'مثال: عرض خاص لعيد الأضحى' : 'e.g. Special Eid offer'}
          className={`w-full rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg px-4 py-2 text-sm outline-none focus:border-brand-gold dark:text-white ${isRTL ? 'text-right' : ''}`}
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 dark:text-dark-text mb-1">
          {isRTL ? 'نص الإشعار' : 'Notification Body'}
        </label>
        <textarea
          value={form.body}
          onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
          rows={3}
          placeholder={isRTL ? 'نص الرسالة...' : 'Message body...'}
          className={`w-full rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg px-4 py-2 text-sm outline-none focus:border-brand-gold resize-none dark:text-white ${isRTL ? 'text-right' : ''}`}
        />
      </div>
      <button
        type="button"
        onClick={handleSend}
        disabled={loading || !form.title.trim() || !form.body.trim()}
        className="w-full btn-primary disabled:opacity-50 text-sm"
      >
        {loading ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
        ) : (isRTL ? '📢 إرسال للجميع' : '📢 Send to All Users')}
      </button>
    </div>
  );
}

function AdminCouponsTab({ isRTL, toast }) {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    code: '',
    type: 'percentage',
    value: '',
    expiresAt: '',
  });

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const res = await couponsAPI.getAll({ page: 1, limit: 20 });
      const data = res.data?.data || res.data?.coupons || res.data || [];
      setCoupons(Array.isArray(data) ? data : []);
    } catch {
      setCoupons([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCoupons(); }, []);

  const handleCreate = async () => {
    if (!form.code || !form.value || !form.expiresAt) {
      toast.error(isRTL ? 'يرجى ملء جميع الحقول' : 'Please fill all fields');
      return;
    }
    setCreating(true);
    try {
      await couponsAPI.create({
        code: form.code.toUpperCase().trim(),
        type: form.type,
        value: parseFloat(form.value),
        expiresAt: form.expiresAt,
      });
      toast.success(isRTL ? 'تم إنشاء الكوبون ✅' : 'Coupon created ✅');
      setForm({ code: '', type: 'percentage', value: '', expiresAt: '' });
      setShowForm(false);
      fetchCoupons();
    } catch (err) {
      toast.error(
        err.response?.data?.message || (isRTL ? 'فشل إنشاء الكوبون' : 'Failed to create')
      );
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(isRTL ? 'هل تريد حذف هذا الكوبون؟' : 'Delete this coupon?')) return;
    try {
      await couponsAPI.delete(id);
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
      setCoupons(prev => prev.filter(c => (c._id || c.id) !== id));
    } catch {
      toast.error(isRTL ? 'فشل الحذف' : 'Failed');
    }
  };

  return (
    <div>
      <div className={`flex items-center justify-between mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-dark-text">
          {isRTL ? 'إدارة الكوبونات' : 'Coupons Management'}
        </h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary text-sm flex items-center gap-2"
        >
          <Plus size={14} />
          {isRTL ? 'كوبون جديد' : 'New Coupon'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6 mb-6">
          <h3 className={`font-bold text-gray-900 dark:text-dark-text mb-4 ${isRTL ? 'text-right' : ''}`}>
            {isRTL ? 'إنشاء كوبون جديد' : 'Create New Coupon'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="input-label">{isRTL ? 'كود الكوبون' : 'Coupon Code'} *</label>
              <input
                type="text"
                placeholder="e.g. SAVE20"
                value={form.code}
                onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                className={`input-field dark:bg-dark-bg dark:border-dark-border dark:text-dark-text uppercase ${isRTL ? 'text-right' : ''}`}
              />
            </div>
            <div>
              <label className="input-label">{isRTL ? 'نوع الخصم' : 'Discount Type'} *</label>
              <select
                value={form.type}
                onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                className="input-field dark:bg-dark-bg dark:border-dark-border dark:text-dark-text"
              >
                <option value="percentage">{isRTL ? 'نسبة مئوية (%)' : 'Percentage (%)'}</option>
                <option value="fixed">{isRTL ? 'مبلغ ثابت (EGP)' : 'Fixed Amount (EGP)'}</option>
              </select>
            </div>
            <div>
              <label className="input-label">{isRTL ? 'قيمة الخصم' : 'Discount Value'} *</label>
              <input
                type="number"
                placeholder={form.type === 'percentage' ? '0-100' : '0'}
                value={form.value}
                onChange={e => setForm(p => ({ ...p, value: e.target.value }))}
                min="0"
                max={form.type === 'percentage' ? 100 : undefined}
                className={`input-field dark:bg-dark-bg dark:border-dark-border dark:text-dark-text ${isRTL ? 'text-right' : ''}`}
              />
            </div>
            <div>
              <label className="input-label">{isRTL ? 'تاريخ الانتهاء' : 'Expiry Date'} *</label>
              <input
                type="date"
                value={form.expiresAt}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setForm(p => ({ ...p, expiresAt: e.target.value }))}
                className="input-field dark:bg-dark-bg dark:border-dark-border dark:text-dark-text"
              />
            </div>
          </div>
          <div className={`flex gap-3 mt-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {creating ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              {isRTL ? 'إنشاء' : 'Create'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-outline">
              {isRTL ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-6 h-6 border-2 border-brand-gold border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : coupons.length === 0 ? (
          <div className="p-8 text-center">
            <Tag size={40} className="mx-auto text-gray-300 dark:text-dark-muted mb-3" />
            <p className="text-gray-500 dark:text-dark-muted text-sm">
              {isRTL ? 'لا توجد كوبونات بعد' : 'No coupons yet'}
            </p>
          </div>
        ) : (
          <table className={`w-full text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
            <thead className="bg-gray-50 dark:bg-dark-bg">
              <tr>
                {[
                  isRTL ? 'الكود' : 'Code',
                  isRTL ? 'النوع' : 'Type',
                  isRTL ? 'القيمة' : 'Value',
                  isRTL ? 'الانتهاء' : 'Expires',
                  isRTL ? 'الحالة' : 'Status',
                  isRTL ? 'إجراء' : 'Action',
                ].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-bold text-gray-400 dark:text-dark-muted uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-dark-border">
              {coupons.map((coupon, i) => (
                <tr key={coupon._id || coupon.id || i} className="hover:bg-gray-50/50 dark:hover:bg-dark-bg/50">
                  <td className="px-4 py-3 font-mono font-bold text-brand-gold">{coupon.code}</td>
                  <td className="px-4 py-3 dark:text-dark-text capitalize">
                    {coupon.type === 'percentage'
                      ? (isRTL ? 'نسبة' : 'Percentage')
                      : (isRTL ? 'مبلغ ثابت' : 'Fixed')}
                  </td>
                  <td className="px-4 py-3 font-semibold dark:text-dark-text">
                    {coupon.type === 'percentage' ? `${coupon.value}%` : `${coupon.value} EGP`}
                  </td>
                  <td className="px-4 py-3 text-gray-400 dark:text-dark-muted text-xs">
                    {coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                      coupon.isActive !== false
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                    }`}>
                      {coupon.isActive !== false
                        ? (isRTL ? 'نشط' : 'Active')
                        : (isRTL ? 'منتهي' : 'Expired')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(coupon._id || coupon.id)}
                      className="text-red-400 hover:text-red-600 transition-colors p-1"
                    >
                      <Trash2 size={14} />
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

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboard, setDashboard] = useState(null);
  const [stats, setStats] = useState(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [users, setUsers] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adminAnalytics, setAdminAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [rejectModal, setRejectModal] = useState({ open: false, brandId: null, brandName: '' });
  const [reviewModal, setReviewModal] = useState({ open: false, brand: null });
  const [rejectReason, setRejectReason] = useState('');
  const [exportLoading, setExportLoading] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const dashRes = await adminAPI.getDashboard();
        const dashData = dashRes.data?.data || dashRes.data || {};
        setDashboard(dashData);
        setStats({
          totalUsers: dashData.overview?.totalUsers || 0,
          totalSellers: dashData.overview?.totalSellers || 0,
          totalRevenue: dashData.overview?.totalRevenue || 0,
          totalOrders: dashData.overview?.totalOrders || 0,
          totalProducts: dashData.overview?.totalProducts || 0,
          totalCustomers: dashData.overview?.totalCustomers || 0,
          totalReviews: dashData.overview?.totalReviews || 0,
          ordersToday: dashData.today?.ordersToday || 0,
          revenueToday: dashData.today?.revenueToday || 0,
          pendingOrders: dashData.alerts?.pendingOrders || 0,
          lowStockProducts: dashData.alerts?.lowStockProducts || 0,
          ordersByStatus: dashData.ordersByStatus || {},
        });
      } catch {
        setDashboard(null);
        setStats(null);
      }

      try {
        const prodRes = await productsAPI.getAll({ page: 1, limit: 100 });
        const prods = prodRes.data?.data || prodRes.data?.products || prodRes.data || [];
        const productList = Array.isArray(prods) ? prods : [];

        const catCounts = {};
        productList.forEach(p => {
          const cat = p.category?.name || p.category || 'Other';
          catCounts[cat] = (catCounts[cat] || 0) + 1;
        });

        const total = productList.length || 1;
        const breakdown = Object.entries(catCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count], i) => ({
            name,
            count,
            percentage: Math.round((count / total) * 100),
            color: ['bg-brand-gold', 'bg-purple-400', 'bg-cyan-400', 'bg-emerald-400', 'bg-red-400'][i] || 'bg-gray-400',
          }));
        setCategoryBreakdown(breakdown);
      } catch {
        setCategoryBreakdown([]);
      }

      try {
        const userRes = await adminAPI.getUsers();
        setUsers(userRes.data?.data || userRes.data?.users || []);
      } catch {
        setUsers([]);
      }

      try {
        const firstRes = await adminAPI.getBrandRequests();
        const meta = firstRes.data?.meta;
        let allBrands = firstRes.data?.data || [];

        if (meta?.total > meta?.limit && meta?.total > allBrands.length) {
          const totalPages = Math.ceil(meta.total / (meta.limit || 10));
          const pagePromises = [];
          for (let page = 2; page <= Math.min(totalPages, 10); page++) {
            pagePromises.push(adminAPI.getBrandRequests(page));
          }
          const restResults = await Promise.allSettled(pagePromises);
          restResults.forEach(result => {
            if (result.status === 'fulfilled') {
              const pageData = result.value.data?.data || [];
              allBrands = [...allBrands, ...pageData];
            }
          });
        }

        setBrands(Array.isArray(allBrands) ? allBrands : []);
        console.log('[Admin] total brands loaded:', allBrands.length);
        console.log('[Admin] pending:', allBrands.filter(b => b.status === 'pending').length);
      } catch {
        try {
          const brandResFallback = await adminAPI.getBrands();
          const rawFallback = brandResFallback.data?.data || brandResFallback.data?.brands || brandResFallback.data || [];
          setBrands(Array.isArray(rawFallback) ? rawFallback : []);
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

  const sellers = brands.filter(b => b.status === 'pending');

  const approveSeller = async (id) => {
    try {
      await adminAPI.approveBrandRequest(id);
      setBrands(prev => prev.map(b =>
        (b._id === id || b.id === id)
          ? { ...b, isVerified: true, isApproved: true, isActive: true, status: 'approved' }
          : b
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

  const rejectSeller = (id, name) => {
    setRejectReason('');
    setRejectModal({ open: true, brandId: id, brandName: name });
  };

  const confirmReject = async () => {
    if (!rejectReason.trim() || rejectReason.trim().length < 10) {
      toast.error(isRTL ? 'يجب أن يكون سبب الرفض 10 أحرف على الأقل' : 'Rejection reason must be at least 10 characters');
      return;
    }
    try {
      await adminAPI.rejectBrandRequest(rejectModal.brandId, rejectReason.trim());
      setBrands(prev => prev.filter(b => b._id !== rejectModal.brandId && b.id !== rejectModal.brandId));
      setRejectModal({ open: false, brandId: null, brandName: '' });
      setRejectReason('');
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

  const handleExportUsers = async () => {
    setExportLoading(p => ({ ...p, users: true }));
    try {
      const res = await adminAPI.getUsers({ limit: 100, page: 1 });
      const raw = res.data?.data || res.data?.users || [];
      if (raw.length === 0) {
        toast.error(isRTL ? 'لا يوجد مستخدمون للتصدير' : 'No users to export');
        return;
      }
      const data = raw.map(u => ({
        Name: u.name || '',
        Email: u.email || '',
        Role: u.role || '',
        Status: u.isActive !== false ? 'Active' : 'Blocked',
        Verified: u.isEmailVerified ? 'Yes' : 'No',
        'Joined Date': u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '',
      }));
      exportToCSV(data, 'BrandHive_Users_Report');
    } catch {
      toast.error(isRTL ? 'فشل تصدير المستخدمين' : 'Failed to export users');
    } finally {
      setExportLoading(p => ({ ...p, users: false }));
    }
  };

  const handleExportOrders = async () => {
    setExportLoading(p => ({ ...p, orders: true }));
    try {
      const res = await adminAPI.getDashboard();
      const overview = res.data?.data?.overview || {};
      const ordersByStatus = res.data?.data?.ordersByStatus || {};
      const today = res.data?.data?.today || {};
      const alerts = res.data?.data?.alerts || {};

      const data = [
        { Metric: 'Total Orders', Value: overview.totalOrders || 0 },
        { Metric: 'Total Revenue (EGP)', Value: overview.totalRevenue || 0 },
        { Metric: 'Orders Today', Value: today.ordersToday || 0 },
        { Metric: 'Revenue Today (EGP)', Value: today.revenueToday || 0 },
        { Metric: 'Pending Orders', Value: ordersByStatus.pending || 0 },
        { Metric: 'Confirmed Orders', Value: ordersByStatus.confirmed || 0 },
        { Metric: 'Delivered Orders', Value: ordersByStatus.delivered || 0 },
        { Metric: 'Cancelled Orders', Value: ordersByStatus.canceled || 0 },
        { Metric: 'Pending Orders Alert', Value: alerts.pendingOrders || 0 },
        { Metric: 'Total Products', Value: overview.totalProducts || 0 },
        { Metric: 'Total Users', Value: overview.totalUsers || 0 },
        { Metric: 'Total Sellers', Value: overview.totalSellers || 0 },
        { Metric: 'Export Date', Value: new Date().toLocaleDateString() },
      ];

      exportToCSV(data, 'BrandHive_Sales_Report');
    } catch {
      toast.error(isRTL ? 'فشل تصدير التقرير' : 'Failed to export report');
    } finally {
      setExportLoading(p => ({ ...p, orders: false }));
    }
  };

  const handleExportSellers = async () => {
    setExportLoading(p => ({ ...p, sellers: true }));
    try {
      const res = await adminAPI.getBrandRequests();
      const raw = res.data?.data || [];
      if (raw.length === 0) {
        toast.error(isRTL ? 'لا يوجد بائعون للتصدير' : 'No sellers to export');
        return;
      }
      const data = raw.map(b => ({
        'Brand Name': b.name || '',
        Country: b.country || 'Egypt',
        Status: b.status || '',
        'Submitted Date': b.createdAt ? new Date(b.createdAt).toLocaleDateString() : '',
        'Reviewed Date': b.reviewedAt ? new Date(b.reviewedAt).toLocaleDateString() : '',
      }));
      exportToCSV(data, 'BrandHive_Sellers_Report');
    } catch {
      toast.error(isRTL ? 'فشل تصدير البائعين' : 'Failed to export sellers');
    } finally {
      setExportLoading(p => ({ ...p, sellers: false }));
    }
  };

  const handleExportProducts = async () => {
    setExportLoading(p => ({ ...p, products: true }));
    try {
      const res = await productsAPI.getAll({ limit: 50, page: 1 });
      const raw = res.data?.data || res.data?.products || [];
      if (raw.length === 0) {
        toast.error(isRTL ? 'لا توجد منتجات للتصدير' : 'No products to export');
        return;
      }
      const data = raw.map(p => ({
        Name: p.name || '',
        Brand: p.brand?.name || '',
        Category: p.category?.name || '',
        Price: p.price || 0,
        'Discount Price': p.discountPrice || p.salePrice || '',
        Stock: p.stock || 0,
        Status: p.isActive !== false ? 'Active' : 'Inactive',
        Rating: p.averageRating || p.rating || 0,
      }));
      exportToCSV(data, 'BrandHive_Products_Report');
    } catch {
      toast.error(isRTL ? 'فشل تصدير المنتجات' : 'Failed to export products');
    } finally {
      setExportLoading(p => ({ ...p, products: false }));
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
        { icon: Tag, label: isRTL ? 'الكوبونات' : 'Coupons', tab: 'coupons' },
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
            {activeTab === 'overview' && (() => {
              const orderStatuses = [
                {
                  label: isRTL ? 'قيد الانتظار' : 'Pending',
                  value: stats?.ordersByStatus?.pending || 0,
                  color: 'bg-amber-400',
                },
                {
                  label: isRTL ? 'مؤكد' : 'Confirmed',
                  value: stats?.ordersByStatus?.confirmed || 0,
                  color: 'bg-emerald-400',
                },
                {
                  label: isRTL ? 'تم التوصيل' : 'Delivered',
                  value: stats?.ordersByStatus?.delivered || 0,
                  color: 'bg-blue-400',
                },
                {
                  label: isRTL ? 'ملغي' : 'Cancelled',
                  value: stats?.ordersByStatus?.canceled || 0,
                  color: 'bg-red-400',
                },
              ];
              const totalOrdersForChart = stats?.totalOrders || 1;

              return (
              <div>
                <div className={`flex items-center justify-between mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className={isRTL ? 'text-right' : ''}>
                    <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-dark-text">{isRTL ? 'لوحة تحكم المشرف' : 'Admin Console'}</h1>
                    <p className="text-gray-500 dark:text-dark-muted mt-0.5">
                      {isRTL
                        ? `مقاييس المنصة بالوقت الفعلي — ${new Date().toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })}`
                        : `Real-time platform metrics — ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                      }
                    </p>
                  </div>
                  <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <button
                      type="button"
                      onClick={() => {
                        const data = [
                          { Metric: isRTL ? 'إجمالي المستخدمين' : 'Total Users', Value: stats?.totalUsers || 0 },
                          { Metric: isRTL ? 'إجمالي البائعين' : 'Total Sellers', Value: stats?.totalSellers || 0 },
                          { Metric: isRTL ? 'إجمالي المنتجات' : 'Total Products', Value: stats?.totalProducts || 0 },
                          { Metric: isRTL ? 'إجمالي الطلبات' : 'Total Orders', Value: stats?.totalOrders || 0 },
                          { Metric: isRTL ? 'إجمالي الإيرادات (ج.م)' : 'Total Revenue (EGP)', Value: stats?.totalRevenue || 0 },
                          { Metric: isRTL ? 'طلبات معلقة' : 'Pending Orders', Value: stats?.pendingOrders || 0 },
                          { Metric: isRTL ? 'تاريخ التصدير' : 'Export Date', Value: new Date().toLocaleDateString() },
                        ];
                        exportToCSV(data, 'BrandHive_Overview_Report');
                      }}
                      className="btn-ghost text-sm flex items-center gap-1"
                    >
                      📤 {isRTL ? 'تصدير' : 'Export'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('reports')}
                      className="btn-primary text-sm flex items-center gap-1"
                    >
                      🔍 {isRTL ? 'تشغيل تقرير' : 'Run Report'}
                    </button>
                  </div>
                </div>

                {/* Stats */}
                <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  {[
                    { icon: Users, label: isRTL ? 'المستخدمون' : 'Registered Users', value: (stats?.totalUsers || 0).toLocaleString(), change: '+0%', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400', trend: '↑' },
                    { icon: Store, label: isRTL ? 'البائعون النشطون' : 'Active Sellers', value: (stats?.totalSellers || 0).toLocaleString(), change: '+0', color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400', trend: '↑' },
                    { icon: DollarSign, label: isRTL ? 'إجمالي الإيرادات' : 'Total Revenue', value: `${(stats?.totalRevenue || 0).toLocaleString()} EGP`, change: '+0%', color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400', trend: '↑' },
                    { icon: Package, label: isRTL ? 'إجمالي الطلبات' : 'Total Orders', value: (stats?.totalOrders || 0).toLocaleString(), change: '+0%', color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400', trend: '↑' },
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

                {(stats?.pendingOrders > 0 || stats?.lowStockProducts > 0) && (
                  <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-2xl p-4 mb-6">
                    <h4 className={`font-bold text-amber-700 dark:text-amber-400 mb-2 text-sm ${isRTL ? 'text-right' : ''}`}>
                      {isRTL ? '⚠️ تنبيهات' : '⚠️ Alerts'}
                    </h4>
                    <div className="space-y-1 text-sm">
                      {stats?.pendingOrders > 0 && (
                        <p className={`text-amber-600 dark:text-amber-300 ${isRTL ? 'text-right' : ''}`}>
                          {isRTL
                            ? `${stats.pendingOrders} طلب في انتظار المعالجة`
                            : `${stats.pendingOrders} orders pending processing`}
                        </p>
                      )}
                      {stats?.lowStockProducts > 0 && (
                        <p className={`text-amber-600 dark:text-amber-300 ${isRTL ? 'text-right' : ''}`}>
                          {isRTL
                            ? `${stats.lowStockProducts} منتج بمخزون منخفض`
                            : `${stats.lowStockProducts} products low on stock`}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Charts Row */}
                <div className={`grid lg:grid-cols-3 gap-6 mb-6 ${isRTL ? 'lg:flex-row-reverse' : ''}`}>
                  {/* GMV Chart */}
                  <div className="lg:col-span-2 bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6">
                    <h3 className={`font-display font-bold text-gray-900 dark:text-dark-text mb-4 ${isRTL ? 'text-right' : ''}`}>
                      {isRTL ? 'الطلبات حسب الحالة' : 'Orders by Status'}
                    </h3>
                    <div className="space-y-4">
                      {orderStatuses.map(s => (
                        <div key={s.label} className={`space-y-1 ${isRTL ? 'text-right' : ''}`}>
                          <div className={`flex items-center justify-between text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <span className="text-gray-600 dark:text-dark-muted">{s.label}</span>
                            <span className="font-bold dark:text-dark-text">{s.value}</span>
                          </div>
                          <div className="h-2 bg-gray-100 dark:bg-dark-border rounded-full">
                            <div
                              className={`h-full ${s.color} rounded-full transition-all duration-500`}
                              style={{
                                width: `${Math.round((s.value / totalOrdersForChart) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Category Breakdown */}
                  <div className={`bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6 ${isRTL ? 'text-right' : ''}`}>
                    <h3 className="font-display font-bold text-gray-900 dark:text-dark-text mb-4">{isRTL ? 'توزيع الفئات' : 'Category Breakdown'}</h3>
                    <div className="space-y-2 mt-2">
                      {categoryBreakdown.length > 0 ? (
                        categoryBreakdown.map(cat => (
                          <div
                            key={cat.name}
                            className={`flex items-center justify-between text-sm ${isRTL ? 'flex-row-reverse' : ''}`}
                          >
                            <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                              <div className={`w-3 h-3 rounded-full ${cat.color}`} />
                              <span className="text-gray-600 dark:text-dark-muted">{cat.name}</span>
                            </div>
                            <span className="font-bold dark:text-dark-text">{cat.percentage}%</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-400 text-sm text-center">
                          {isRTL ? 'لا توجد بيانات' : 'No category data'}
                        </p>
                      )}
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
                                      setBrands(prev => prev.map(b => (b._id === brand._id || b.id === brand.id) ? { ...b, isVerified: true, isApproved: true, isActive: true, status: 'approved' } : b));
                                      toast.success(isRTL ? 'تم قبول البائع!' : 'Seller approved!');
                                    }}
                                    className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                                  >
                                    <CheckCircle size={12} /> {isRTL ? 'قبول' : 'Approve'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setReviewModal({ open: true, brand })}
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
            );
            })()}

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

            {/* Coupons Tab */}
            {activeTab === 'coupons' && (
              <AdminCouponsTab isRTL={isRTL} toast={toast} />
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
                                    onClick={() => rejectSeller(brand._id || brand.id, brand.name)}
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
                        value: `${(adminAnalytics?.revenue?.total || stats?.totalRevenue || 0).toLocaleString()} ${isRTL ? 'ج.م' : 'EGP'}`,
                        color: 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400',
                      },
                      {
                        icon: '📦',
                        label: isRTL ? 'إجمالي الطلبات' : 'Total Orders',
                        value: (adminAnalytics?.revenue?.ordersCount || stats?.totalOrders || 0).toLocaleString(),
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

            {activeTab === 'reports' && (
              <div>
                <h2 className={`text-2xl font-display font-bold text-gray-900 dark:text-dark-text mb-2 ${isRTL ? 'text-right' : ''}`}>
                  {isRTL ? 'التقارير' : 'Reports'}
                </h2>
                <p className={`text-sm text-gray-500 dark:text-dark-muted mb-6 ${isRTL ? 'text-right' : ''}`}>
                  {isRTL ? 'تصدير البيانات كملفات CSV جاهزة للاستخدام في Excel' : 'Export data as CSV files ready to open in Excel'}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    {
                      icon: '📊',
                      title: isRTL ? 'تقرير المبيعات' : 'Sales Report',
                      desc: isRTL
                        ? 'ملخص المبيعات — إجمالي الطلبات، الإيرادات، الحالات، وإحصائيات اليوم'
                        : 'Sales summary — total orders, revenue, statuses, and today stats',
                      key: 'orders',
                      handler: handleExportOrders,
                      color: 'bg-blue-50 dark:bg-blue-900/10',
                    },
                    {
                      icon: '👥',
                      title: isRTL ? 'تقرير المستخدمين' : 'Users Report',
                      desc: isRTL ? 'جميع المستخدمين — الاسم، الإيميل، الدور، الحالة، تاريخ التسجيل' : 'All users — name, email, role, status, join date',
                      key: 'users',
                      handler: handleExportUsers,
                      color: 'bg-purple-50 dark:bg-purple-900/10',
                    },
                    {
                      icon: '🏪',
                      title: isRTL ? 'تقرير البائعين' : 'Sellers Report',
                      desc: isRTL ? 'جميع طلبات البائعين — الاسم، الحالة، تاريخ التقديم والمراجعة' : 'All seller applications — name, status, submission and review dates',
                      key: 'sellers',
                      handler: handleExportSellers,
                      color: 'bg-amber-50 dark:bg-amber-900/10',
                    },
                    {
                      icon: '📦',
                      title: isRTL ? 'تقرير المنتجات' : 'Products Report',
                      desc: isRTL ? 'جميع المنتجات — الاسم، الماركة، الفئة، السعر، المخزون، التقييم' : 'All products — name, brand, category, price, stock, rating',
                      key: 'products',
                      handler: handleExportProducts,
                      color: 'bg-emerald-50 dark:bg-emerald-900/10',
                    },
                  ].map((item) => (
                    <div key={item.key} className={`${item.color} rounded-2xl p-6 ${isRTL ? 'text-right' : ''}`}>
                      <div className="text-3xl mb-3">{item.icon}</div>
                      <h3 className="font-bold text-gray-900 dark:text-dark-text mb-2">{item.title}</h3>
                      <p className="text-sm text-gray-500 dark:text-dark-muted mb-4">{item.desc}</p>
                      <button
                        type="button"
                        onClick={item.handler}
                        disabled={exportLoading[item.key]}
                        className={`flex items-center gap-2 px-4 py-2 bg-brand-navy dark:bg-brand-gold text-white dark:text-brand-navy rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 ${isRTL ? 'flex-row-reverse' : ''}`}
                      >
                        {exportLoading[item.key] ? (
                          <>
                            <div className="w-3 h-3 border-2 border-white dark:border-brand-navy border-t-transparent rounded-full animate-spin" />
                            {isRTL ? 'جاري التصدير...' : 'Exporting...'}
                          </>
                        ) : (
                          <>
                            ⬇️ {isRTL ? 'تصدير CSV' : 'Export CSV'}
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'featured' && (
              <div>
                <h2 className={`text-2xl font-display font-bold text-gray-900 dark:text-dark-text mb-6 ${isRTL ? 'text-right' : ''}`}>
                  {isRTL ? 'الخانات المميزة' : 'Featured Slots'}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { icon: '🏠', title: isRTL ? 'الصفحة الرئيسية' : 'Homepage', slots: 4, desc: isRTL ? 'خانات المنتجات المميزة في الصفحة الرئيسية' : 'Featured product slots on the homepage' },
                    { icon: '🔍', title: isRTL ? 'نتائج البحث' : 'Search Results', slots: 3, desc: isRTL ? 'منتجات تظهر في أعلى نتائج البحث' : 'Products appearing at the top of search results' },
                    { icon: '🏷️', title: isRTL ? 'صفحة الفئات' : 'Category Pages', slots: 2, desc: isRTL ? 'ماركات مميزة في صفحات الفئات' : 'Featured brands on category pages' },
                  ].map((item, i) => (
                    <div key={i} className={`bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6 ${isRTL ? 'text-right' : ''}`}>
                      <div className="text-3xl mb-3">{item.icon}</div>
                      <h3 className="font-bold text-gray-900 dark:text-dark-text mb-1">{item.title}</h3>
                      <p className="text-xs text-brand-gold font-semibold mb-2">{item.slots} {isRTL ? 'خانات متاحة' : 'slots available'}</p>
                      <p className="text-sm text-gray-500 dark:text-dark-muted mb-4">{item.desc}</p>
                      <button type="button" disabled className="w-full py-2 text-xs bg-gray-100 dark:bg-dark-bg text-gray-400 rounded-xl font-semibold cursor-not-allowed">
                        {isRTL ? 'إدارة الخانات — قريباً' : 'Manage Slots — Coming Soon'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div>
                <h2 className={`text-2xl font-display font-bold text-gray-900 dark:text-dark-text mb-6 ${isRTL ? 'text-right' : ''}`}>
                  {isRTL ? 'إرسال إشعار' : 'Send Notification'}
                </h2>
                <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6 max-w-lg">
                  <AdminNotificationSender isRTL={isRTL} adminAPI={adminAPI} />
                </div>
              </div>
            )}

            {activeTab === 'audit' && (
              <div>
                <h2 className={`text-2xl font-display font-bold text-gray-900 dark:text-dark-text mb-6 ${isRTL ? 'text-right' : ''}`}>
                  {isRTL ? 'سجل العمليات' : 'Audit Log'}
                </h2>
                <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6">
                  <div className="text-center py-8">
                    <FileText className="mx-auto text-gray-300 dark:text-dark-muted mb-4" size={40} />
                    <p className="font-semibold text-gray-700 dark:text-dark-text mb-2">
                      {isRTL ? 'سجل العمليات' : 'Audit Log'}
                    </p>
                    <p className="text-sm text-gray-400 dark:text-dark-muted">
                      {isRTL
                        ? 'سيتم تسجيل جميع العمليات الإدارية هنا — موافقة البائعين، حذف المنتجات، تعديل المستخدمين'
                        : 'All admin actions will be logged here — seller approvals, product deletions, user modifications'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Review Brand Modal */}
      {reviewModal.open && reviewModal.brand && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className={`bg-white dark:bg-dark-surface rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto ${isRTL ? 'text-right' : ''}`}>

            <div className={`flex items-center justify-between p-6 border-b border-gray-100 dark:border-dark-border ${isRTL ? 'flex-row-reverse' : ''}`}>
              <h3 className="text-xl font-display font-bold text-gray-900 dark:text-dark-text">
                {isRTL ? 'مراجعة طلب البائع' : 'Review Seller Application'}
              </h3>
              <button
                type="button"
                onClick={() => setReviewModal({ open: false, brand: null })}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-dark-text transition-colors"
              >
                <XCircle size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-dark-bg overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {reviewModal.brand.logo?.url ? (
                    <img src={reviewModal.brand.logo.url} alt={reviewModal.brand.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">🏪</span>
                  )}
                </div>
                <div className={isRTL ? 'text-right' : ''}>
                  <h4 className="text-lg font-bold text-gray-900 dark:text-dark-text">{reviewModal.brand.name}</h4>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    reviewModal.brand.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                      : reviewModal.brand.status === 'rejected'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                  }`}>
                    {reviewModal.brand.status || 'pending'}
                  </span>
                </div>
              </div>

              {[
                { label: isRTL ? 'الوصف' : 'Description', value: reviewModal.brand.description || '—' },
                { label: isRTL ? 'الدولة' : 'Country', value: reviewModal.brand.country || 'Egypt' },
                { label: isRTL ? 'الفئات' : 'Categories', value: reviewModal.brand.categories?.map(c => c.name || c).join(', ') || reviewModal.brand.category?.name || '—' },
                { label: isRTL ? 'الموقع الإلكتروني' : 'Website', value: reviewModal.brand.website || '—' },
                { label: isRTL ? 'تاريخ التقديم' : 'Submitted', value: reviewModal.brand.createdAt ? new Date(reviewModal.brand.createdAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US') : '—' },
              ].map(item => (
                <div key={item.label} className={`flex gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="text-sm font-semibold text-gray-500 dark:text-dark-muted w-28 flex-shrink-0">{item.label}:</span>
                  <span className="text-sm text-gray-900 dark:text-dark-text">{item.value}</span>
                </div>
              ))}
            </div>

            {reviewModal.brand.status === 'pending' && (
              <div className={`flex gap-3 p-6 pt-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button
                  type="button"
                  onClick={() => {
                    approveSeller(reviewModal.brand._id || reviewModal.brand.id);
                    setReviewModal({ open: false, brand: null });
                  }}
                  className="flex-1 py-2.5 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle size={16} /> {isRTL ? 'قبول' : 'Approve'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReviewModal({ open: false, brand: null });
                    rejectSeller(reviewModal.brand._id || reviewModal.brand.id, reviewModal.brand.name);
                  }}
                  className="flex-1 py-2.5 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 hover:bg-red-100 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <XCircle size={16} /> {isRTL ? 'رفض' : 'Reject'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reject Brand Modal */}
      {rejectModal.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className={`bg-white dark:bg-dark-surface rounded-3xl shadow-2xl p-8 w-full max-w-md ${isRTL ? 'text-right' : ''}`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-display font-bold text-gray-900 dark:text-dark-text">
                {isRTL ? 'رفض طلب البائع' : 'Reject Seller Application'}
              </h3>
              <button
                onClick={() => setRejectModal({ open: false, brandId: null, brandName: '' })}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-dark-text transition-colors"
              >
                <XCircle size={24} />
              </button>
            </div>

            <div className="bg-red-50 dark:bg-red-900/10 rounded-2xl p-4 mb-5">
              <p className="text-sm text-red-700 dark:text-red-400">
                {isRTL
                  ? `هل أنت متأكد من رفض طلب "${rejectModal.brandName}"؟`
                  : `Are you sure you want to reject "${rejectModal.brandName}"?`}
              </p>
            </div>

            <div className="mb-5">
              <label className={`block text-sm font-semibold text-gray-700 dark:text-dark-text mb-2 ${isRTL ? 'text-right' : ''}`}>
                {isRTL ? 'سبب الرفض (مطلوب — 10 أحرف على الأقل)' : 'Rejection Reason (required — min 10 characters)'}
              </label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
                placeholder={isRTL
                  ? 'مثال: المعلومات المقدمة غير كافية أو غير مكتملة...'
                  : 'e.g. The provided information is incomplete or insufficient...'}
                className={`w-full rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg px-4 py-3 text-sm text-gray-900 dark:text-dark-text outline-none focus:border-brand-navy dark:focus:border-brand-gold resize-none ${isRTL ? 'text-right' : ''}`}
              />
              <p className={`text-xs mt-1 ${rejectReason.trim().length >= 10 ? 'text-emerald-500' : 'text-gray-400 dark:text-dark-muted'}`}>
                {rejectReason.trim().length}/10 {isRTL ? 'حرف كحد أدنى' : 'characters minimum'}
              </p>
            </div>

            <div className={`flex gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button
                onClick={() => setRejectModal({ open: false, brandId: null, brandName: '' })}
                className="flex-1 btn-outline text-sm"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={confirmReject}
                disabled={rejectReason.trim().length < 10}
                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-colors"
              >
                {isRTL ? 'تأكيد الرفض' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
