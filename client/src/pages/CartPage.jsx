import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingCart, Minus, Plus, X, ArrowLeft, Tag, ChevronRight,
  CreditCard, Smartphone, Banknote, Building2, CheckCircle, Shield
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { ordersAPI, cartAPI, addressesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import toast from 'react-hot-toast';

const CATEGORY_ICONS = {
  Fashion: '👗', Jewelry: '💍', Handmade: '🏺', 'Home Decor': '🏠',
  Organic: '🌿', 'Art & Culture': '🎨', Food: '🍯', Beauty: '💄', default: '🛍️',
};

const isValidMongoId = (id) => 
  id && typeof id === 'string' && 
  /^[a-f\d]{24}$/i.test(id);

export default function CartPage() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { items, removeFromCart, updateQuantity, clearCart, subtotal, itemCount } = useCart();
  const { isAuthenticated } = useAuth();
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState('cod');
  const [orderPlaced, setOrderPlaced] = useState(false);

  const [delivery, setDelivery] = useState({
    name: '', phone: '', street: '', governorate: isRTL ? 'القاهرة' : 'Cairo', postalCode: '',
  });

  const STEPS = [
    isRTL ? 'السلة' : 'Cart',
    isRTL ? 'التوصيل' : 'Delivery',
    isRTL ? 'الدفع' : 'Payment',
    isRTL ? 'تأكيد' : 'Confirm'
  ];

  const PAYMENT_METHODS = [
    { 
      id: 'paymob', 
      icon: CreditCard, 
      label: isRTL ? 'بطاقة ائتمان' : 'Credit / Debit Card', 
      sub: isRTL ? 'فيزا، ماستركارد، ميزة عبر باي موب' : 'Visa, Mastercard, Meeza via Paymob' 
    },
    { 
      id: 'fawry', 
      icon: Building2, 
      label: isRTL ? 'فوري' : 'Fawry', 
      sub: isRTL ? 'ادفع في أي منفذ فوري' : 'Pay at any Fawry outlet' 
    },
    { 
      id: 'cod', 
      icon: Banknote, 
      label: isRTL ? 'الدفع عند الاستلام' : 'Cash on Delivery', 
      sub: isRTL ? 'ادفع عند استلام طلبك' : 'Pay when you receive' 
    },
  ];

  const [promoLoading, setPromoLoading] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const [discount, setDiscount] = useState(0);

  useEffect(() => {
    if (step !== 1 || !isAuthenticated) return;
    const fetchAddresses = async () => {
      setAddressesLoading(true);
      try {
        const res = await addressesAPI.getAll();
        const list = res.data?.data || res.data || [];
        setSavedAddresses(Array.isArray(list) ? list : []);
      } catch {
        setSavedAddresses([]);
      } finally {
        setAddressesLoading(false);
      }
    };
    fetchAddresses();
  }, [step, isAuthenticated]);

  const handleSelectSavedAddress = (addr) => {
    setSelectedAddressId(addr._id || addr.id);
    setDelivery({
      name: addr.fullName || '',
      phone: addr.phone || '',
      street: addr.street || '',
      governorate: addr.governorate || addr.city || 'Cairo',
      postalCode: addr.postalCode || '',
    });
  };

  const shippingCost = subtotal >= 500 ? 0 : 50;
  const total = subtotal + shippingCost - discount;

  const handlePromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    try {
      const res = await cartAPI.applyCoupon({ 
        couponCode: promoCode.toUpperCase() 
      });
      const data = res.data;
      const discountValue = 
        data?.data?.discount || 
        data?.discount || 
        0;
      setAppliedPromo(promoCode.toUpperCase());
      setDiscount(discountValue);
      toast.success(
        isRTL 
          ? `تم تطبيق الكوبون! خصم ${discountValue} ج.م 🎉`
          : `Coupon applied! ${discountValue} EGP off 🎉`,
        { style: { borderRadius: '12px' } }
      );
    } catch (err) {
      toast.error(
        isRTL 
          ? 'كوبون غير صالح أو منتهي الصلاحية'
          : 'Invalid or expired coupon code',
        { style: { borderRadius: '12px' } }
      );
    } finally {
      setPromoLoading(false);
    }
  };

  const handlePlaceOrder = async () => {
    setOrderLoading(true);
    try {
      // Only sync real products (MongoDB IDs)
      const realItems = items.filter(item => 
        isValidMongoId(item.id)
      );
      
      if (realItems.length > 0) {
        for (const item of realItems) {
          try {
            await cartAPI.add({ 
              productId: item.id, 
              quantity: item.quantity 
            });
          } catch {
            // Continue
          }
        }
      }

      // If no real items, try placing order with whatever is in the backend cart instead
      if (realItems.length === 0) {
        try {
          const orderData = {
            shippingAddress: {
              fullName: delivery.name,
              phone: delivery.phone,
              street: delivery.street,
              city: delivery.governorate,
              governorate: delivery.governorate,
              country: 'Egypt',
            },
            paymentMethod: selectedPayment,
          };
          await ordersAPI.create(orderData);
          await clearCart();
          setOrderPlaced(true);
          setTimeout(() => navigate('/account?tab=orders'), 3000);
        } catch (err) {
          toast.error(
            err.response?.data?.message ||
            (isRTL ? 'فشل إتمام الطلب' : 'Order failed'),
            { style: { borderRadius: '12px' } }
          );
        } finally {
          setOrderLoading(false);
        }
        return;
      }

      const orderData = {
        shippingAddress: {
          fullName: delivery.name,
          phone: delivery.phone,
          street: delivery.street,
          city: delivery.governorate,
          governorate: delivery.governorate,
          country: 'Egypt',
        },
        paymentMethod: selectedPayment,
      };

      await ordersAPI.create(orderData);
      await clearCart();
      setOrderPlaced(true);
      setTimeout(() => navigate('/account?tab=orders'), 3000);

    } catch (err) {
      const msg = err.response?.data?.message;
      toast.error(
        isRTL
          ? `فشل إتمام الطلب: ${msg || 'يرجى المحاولة مجدداً'}`
          : `Order failed: ${msg || 'Please try again'}`,
        { style: { borderRadius: '12px' } }
      );
    } finally {
      setOrderLoading(false);
    }
  };

  const canProceedDelivery = delivery.name && delivery.phone && delivery.street && delivery.governorate;

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-brand-cream dark:bg-dark-bg flex items-center justify-center px-4">
        <div className="bg-white dark:bg-dark-surface rounded-3xl shadow-card-hover p-10 max-w-md w-full text-center animate-fade-in">
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="text-emerald-600 dark:text-emerald-400" size={40} />
          </div>
          <h2 className="text-3xl font-display font-bold text-gray-900 dark:text-dark-text mb-3">
            {isRTL ? 'تم تقديم الطلب! 🎉' : 'Order Placed! 🎉'}
          </h2>
          <p className="text-gray-600 dark:text-dark-muted mb-2">
            {isRTL ? 'تم تقديم طلبك بنجاح.' : 'Your order has been placed successfully.'}
          </p>
          <p className="text-gray-500 dark:text-dark-muted text-sm mb-8">
            {isRTL ? 'جاري توجيهك لطلباتك...' : 'Redirecting to your orders...'}
          </p>
          <div className="flex items-center justify-center gap-2 text-emerald-600">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-brand-cream dark:bg-dark-bg transition-colors duration-200 ${isRTL ? 'text-right' : 'text-left'}`}>
      <div className="page-container py-8">
        {/* Stepper */}
        <div className={`flex items-center justify-center mb-8 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {STEPS.map((s, i) => (
            <div key={`step-${i}`} className={`flex items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className={`flex items-center gap-2 ${i <= step ? 'text-brand-navy dark:text-brand-gold' : 'text-gray-400 dark:text-dark-muted'} ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  i < step ? 'bg-emerald-500 text-white' :
                  i === step ? 'bg-brand-navy dark:bg-brand-gold text-white dark:text-brand-navy shadow-md' :
                  'bg-gray-200 dark:bg-dark-surface text-gray-400 dark:text-dark-muted'
                }`}>
                  {i < step ? <CheckCircle size={14} /> : i + 1}
                </div>
                <span className={`text-sm font-medium hidden sm:block ${i === step ? 'text-brand-navy dark:text-dark-text' : 'text-gray-400 dark:text-dark-muted'}`}>{s}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-8 sm:w-16 h-0.5 mx-2 transition-all ${i < step ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-dark-surface'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Empty Cart */}
        {items.length === 0 && step === 0 && (
          <div className="text-center py-20">
            <ShoppingCart className="mx-auto text-gray-300 dark:text-dark-muted mb-4" size={64} />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text mb-2">{isRTL ? 'سلتك فارغة' : t('cart.empty')}</h2>
            <p className="text-gray-500 dark:text-dark-muted mb-6">
              {isRTL ? 'اكتشف أفضل الماركات والمنتجات المصرية' : 'Discover amazing Egyptian brands and products'}
            </p>
            <Link to="/products" className="btn-primary">{isRTL ? 'متابعة التسوق' : t('cart.continueShopping')}</Link>
          </div>
        )}

        {/* Step 0: Cart */}
        {step === 0 && items.length > 0 && (
          <div className={`grid lg:grid-cols-3 gap-8 ${isRTL ? 'lg:flex-row-reverse' : ''}`}>
            {/* Cart Items */}
            <div className="lg:col-span-2">
              <div className={`flex items-center justify-between mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <h2 className="text-xl font-display font-bold text-gray-900 dark:text-dark-text">
                  {isRTL ? `سلتك (${itemCount} منتجات)` : `Your Cart (${itemCount} items)`}
                </h2>
                <Link to="/products" className={`flex items-center gap-1 text-sm text-brand-gold hover:underline ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <ArrowLeft size={14} className={isRTL ? 'rotate-180' : ''} /> {isRTL ? 'متابعة التسوق' : t('cart.continueShopping')}
                </Link>
              </div>

              <div className="space-y-4">
                {items.map((item, idx) => {
                  const icon = CATEGORY_ICONS[item.category] || CATEGORY_ICONS.default;
                  return (
                    <div key={item.key || item.id || idx} className={`bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-4 flex gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      {/* Image */}
                      <div className={`w-20 h-20 rounded-xl flex-shrink-0 flex items-center justify-center text-4xl ${
                        item.category === 'Jewelry' ? 'bg-amber-50 dark:bg-amber-900/10' :
                        item.category === 'Fashion' ? 'bg-pink-50 dark:bg-pink-900/10' :
                        'bg-orange-50 dark:bg-orange-900/10'
                      } overflow-hidden`}>
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <span className={`${item.image ? 'hidden' : 'flex'} w-full h-full items-center justify-center`}>
                          {icon}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className={`flex items-start justify-between gap-2 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                          <div className={isRTL ? 'text-right' : 'text-left'}>
                            <Link to={`/brand/${item.brandSlug}`} className="text-xs text-brand-gold font-semibold hover:underline">
                              {item.brandName}
                            </Link>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-dark-text leading-tight">{item.name}</h3>
                            {item.options?.size && (
                              <p className="text-xs text-gray-500 dark:text-dark-muted mt-0.5">
                                {item.options.size}{item.options.color && ` · ${item.options.color}`}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => removeFromCart(item.key)}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 text-gray-400 dark:text-dark-muted hover:text-red-500 transition-colors flex-shrink-0"
                          >
                            <X size={14} />
                          </button>
                        </div>

                        <div className={`flex items-center justify-between mt-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          {/* Quantity */}
                          <div className={`flex items-center border border-gray-200 dark:border-dark-border rounded-xl overflow-hidden ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <button
                              onClick={() => updateQuantity(item.key, item.quantity - 1)}
                              className="px-3 py-1.5 text-gray-600 dark:text-dark-muted hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="px-3 py-1.5 text-sm font-bold border-x border-gray-200 dark:border-dark-border dark:text-dark-text">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.key, item.quantity + 1)}
                              className="px-3 py-1.5 text-gray-600 dark:text-dark-muted hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                          <span className="font-bold text-brand-navy dark:text-brand-gold">
                            {(item.price * item.quantity).toLocaleString()} {isRTL ? 'ج.م' : t('common.egp')}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6 sticky top-24">
                <h3 className="font-display font-bold text-xl text-gray-900 dark:text-dark-text mb-5">
                  {isRTL ? 'ملخص الطلب' : 'Order Summary'}
                </h3>

                <div className="space-y-3 mb-5">
                  <div className={`flex justify-between text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <span className="text-gray-600 dark:text-dark-muted">
                      {isRTL ? `المجموع (${itemCount} منتجات)` : `Subtotal (${itemCount} items)`}
                    </span>
                    <span className="font-semibold dark:text-dark-text">{subtotal.toLocaleString()} {isRTL ? 'ج.م' : t('common.egp')}</span>
                  </div>
                  <div className={`flex justify-between text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <span className="text-gray-600 dark:text-dark-muted">{isRTL ? 'الشحن' : 'Shipping'}</span>
                    <span className={`font-semibold ${shippingCost === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'dark:text-dark-text'}`}>
                      {shippingCost === 0 ? (isRTL ? 'مجاني' : 'Free') : `${shippingCost} ${isRTL ? 'ج.م' : t('common.egp')}`}
                    </span>
                  </div>
                  {appliedPromo && (
                    <div className={`flex justify-between text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <span className="text-emerald-600 dark:text-emerald-400">{isRTL ? `خصم (${appliedPromo})` : `Discount (${appliedPromo})`}</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">-{discount.toLocaleString()} {isRTL ? 'ج.م' : t('common.egp')}</span>
                    </div>
                  )}
                  <div className={`border-t border-gray-100 dark:border-dark-border pt-3 flex justify-between font-bold text-lg ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <span className="dark:text-dark-text">{isRTL ? 'الإجمالي' : t('cart.total')}</span>
                    <span className="text-brand-navy dark:text-brand-gold">{total.toLocaleString()} {isRTL ? 'ج.م' : t('common.egp')}</span>
                  </div>
                </div>

                {/* Promo */}
                <div className={`flex gap-2 mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className="relative flex-1">
                    <Tag size={14} className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-gray-400 dark:text-dark-muted`} />
                    <input
                      type="text"
                      value={promoCode}
                      onChange={e => setPromoCode(e.target.value)}
                      placeholder={isRTL ? 'رمز ترويجي...' : 'Promo code...'}
                      className={`input-field ${isRTL ? 'pr-8 pl-4 text-right' : 'pl-8 pr-4'} py-2.5 text-sm`}
                    />
                  </div>
                  <button 
                    onClick={handlePromo} 
                    disabled={promoLoading}
                    className="btn-primary py-2.5 text-sm px-4 disabled:opacity-70"
                  >
                    {promoLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-2" />
                    ) : (
                      isRTL ? 'تطبيق' : 'Apply'
                    )}
                  </button>
                </div>

                <button
                  onClick={() => setStep(1)}
                  className={`w-full btn-primary py-4 text-base flex items-center justify-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
                >
                  {isRTL ? 'الاستمرار للتوصيل' : 'Proceed to Delivery'} <ChevronRight size={18} className={isRTL ? 'rotate-180' : ''} />
                </button>

                <div className={`flex items-center justify-center gap-3 mt-4 text-xs text-gray-400 dark:text-dark-muted ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Shield size={12} /> {isRTL ? 'آمن · سترايب · SSL 256 بت' : 'Secured · Stripe · 256-bit SSL'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Delivery */}
        {step === 1 && (
          <div className="max-w-2xl mx-auto">
            <h2 className={`text-2xl font-display font-bold text-gray-900 dark:text-dark-text mb-6 ${isRTL ? 'text-right' : ''}`}>
              {isRTL ? 'تفاصيل التوصيل' : 'Delivery Details'}
            </h2>
            
            {/* Saved Addresses Selector */}
            {isAuthenticated && (
              <div className="mb-4">
                {addressesLoading ? (
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {[...Array(2)].map((_, i) => (
                      <div key={i} className="flex-shrink-0 w-52 h-20 bg-gray-100 dark:bg-dark-surface rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : savedAddresses.length > 0 ? (
                  <div>
                    <p className={`text-sm font-semibold text-gray-700 dark:text-dark-text mb-3 ${isRTL ? 'text-right' : ''}`}>
                      {isRTL ? 'اختر عنواناً محفوظاً' : 'Choose a saved address'}
                    </p>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {savedAddresses.map(addr => (
                        <button
                          key={addr._id || addr.id}
                          onClick={() => handleSelectSavedAddress(addr)}
                          className={`flex-shrink-0 w-56 p-3 rounded-xl border-2 text-left transition-all ${isRTL ? 'text-right' : 'text-left'} ${
                            selectedAddressId === (addr._id || addr.id)
                              ? 'border-brand-navy dark:border-brand-gold bg-brand-navy/5 dark:bg-brand-gold/5'
                              : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-dark-muted bg-white dark:bg-dark-surface'
                          }`}
                        >
                          <p className="font-semibold text-sm text-gray-900 dark:text-dark-text truncate">{addr.fullName}</p>
                          <p className="text-xs text-gray-500 dark:text-dark-muted truncate mt-0.5">{addr.street}</p>
                          <p className="text-xs text-gray-400 dark:text-dark-muted">{addr.governorate}</p>
                        </button>
                      ))}
                      <button
                        onClick={() => { setSelectedAddressId(null); setDelivery({ name: '', phone: '', street: '', governorate: isRTL ? 'القاهرة' : 'Cairo', postalCode: '' }); }}
                        className="flex-shrink-0 w-40 p-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-dark-border text-gray-500 dark:text-dark-muted hover:border-brand-gold hover:text-brand-gold transition-all text-sm font-medium flex items-center justify-center"
                      >
                        + {isRTL ? 'عنوان جديد' : 'New address'}
                      </button>
                    </div>
                    <div className="border-t border-gray-100 dark:border-dark-border my-4" />
                    <p className={`text-xs text-gray-400 dark:text-dark-muted mb-3 ${isRTL ? 'text-right' : ''}`}>
                      {isRTL ? 'أو أدخل عنواناً جديداً:' : 'Or enter a new address:'}
                    </p>
                  </div>
                ) : null}
              </div>
            )}
            
            <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6 space-y-4 mb-6">
              <div className={`grid grid-cols-2 gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={isRTL ? 'text-right' : 'text-left'}>
                  <label className="input-label dark:text-dark-text block mb-1.5">{isRTL ? 'الاسم الكامل' : 'Full Name'}</label>
                  <input 
                    value={delivery.name} 
                    onChange={e => setDelivery({...delivery, name: e.target.value})} 
                    placeholder={isRTL ? 'نادية محمد' : 'Nadia Mohamed'} 
                    className={`input-field ${isRTL ? 'text-right' : ''}`} 
                  />
                </div>
                <div className={isRTL ? 'text-right' : 'text-left'}>
                  <label className="input-label dark:text-dark-text block mb-1.5">{isRTL ? 'رقم الهاتف' : 'Phone Number'}</label>
                  <input 
                    value={delivery.phone} 
                    onChange={e => setDelivery({...delivery, phone: e.target.value})} 
                    placeholder="+20 10 0000 0000" 
                    className={`input-field ${isRTL ? 'text-right' : ''}`} 
                  />
                </div>
              </div>
              <div className={isRTL ? 'text-right' : 'text-left'}>
                <label className="input-label dark:text-dark-text block mb-1.5">{isRTL ? 'عنوان الشارع' : 'Street Address'}</label>
                <input 
                  value={delivery.street} 
                  onChange={e => setDelivery({...delivery, street: e.target.value})} 
                  placeholder={isRTL ? '5 شارع طلعت حرب، وسط البلد، القاهرة' : '5 Talaat Harb St, Downtown Cairo'} 
                  className={`input-field ${isRTL ? 'text-right' : ''}`} 
                />
              </div>
              <div className={`grid grid-cols-2 gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={isRTL ? 'text-right' : 'text-left'}>
                  <label className="input-label dark:text-dark-text block mb-1.5">{isRTL ? 'المحافظة' : 'Governorate'}</label>
                  <select 
                    value={delivery.governorate} 
                    onChange={e => setDelivery({...delivery, governorate: e.target.value})} 
                    className={`input-field ${isRTL ? 'text-right pr-4 pl-10' : ''}`}
                  >
                    {[
                      { en: 'Cairo', ar: 'القاهرة' },
                      { en: 'Alexandria', ar: 'الإسكندرية' },
                      { en: 'Giza', ar: 'الجيزة' },
                      { en: 'Luxor', ar: 'الأقصر' },
                      { en: 'Aswan', ar: 'أسوان' },
                      { en: 'Port Said', ar: 'بورسعيد' },
                      { en: 'Suez', ar: 'السويس' },
                      { en: 'Fayoum', ar: 'الفيوم' }
                    ].map((g, idx) => (
                      <option 
                        key={g.en || g.ar || idx} 
                        value={isRTL ? g.ar : g.en}>
                        {isRTL ? g.ar : g.en}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={isRTL ? 'text-right' : 'text-left'}>
                  <label className="input-label dark:text-dark-text block mb-1.5">{isRTL ? 'الرمز البريدي' : 'Postal Code'}</label>
                  <input 
                    value={delivery.postalCode} 
                    onChange={e => setDelivery({...delivery, postalCode: e.target.value})} 
                    placeholder="11511" 
                    className={`input-field ${isRTL ? 'text-right' : ''}`} 
                  />
                </div>
              </div>
            </div>
            <div className={`flex gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button onClick={() => setStep(0)} className={`btn-ghost flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <ArrowLeft size={16} className={isRTL ? 'rotate-180' : ''} /> {isRTL ? 'رجوع' : 'Back'}
              </button>
              <button
                onClick={() => canProceedDelivery && setStep(2)}
                disabled={!canProceedDelivery}
                className={`flex-1 btn-primary py-4 text-base ${!canProceedDelivery ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isRTL ? 'الاستمرار للدفع ←' : 'Continue to Payment →'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Payment */}
        {step === 2 && (
          <div className="max-w-2xl mx-auto">
            <h2 className={`text-2xl font-display font-bold text-gray-900 dark:text-dark-text mb-6 ${isRTL ? 'text-right' : ''}`}>
              {isRTL ? 'طريقة الدفع' : 'Payment Method'}
            </h2>
            <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6 mb-6">
              <div className="space-y-3">
                {PAYMENT_METHODS.map(method => (
                  <label
                    key={method.id}
                    className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${isRTL ? 'flex-row-reverse text-right' : ''} ${
                      selectedPayment === method.id
                        ? 'border-brand-navy dark:border-brand-gold bg-brand-navy/5 dark:bg-brand-gold/5'
                        : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-dark-muted'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value={method.id}
                      checked={selectedPayment === method.id}
                      onChange={() => setSelectedPayment(method.id)}
                      className="text-brand-navy dark:text-brand-gold focus:ring-brand-gold"
                    />
                    <method.icon size={20} className="text-brand-navy dark:text-brand-gold flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-dark-text">{method.label}</p>
                      <p className="text-xs text-gray-500 dark:text-dark-muted">{method.sub}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className={`flex gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button onClick={() => setStep(1)} className={`btn-ghost flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <ArrowLeft size={16} className={isRTL ? 'rotate-180' : ''} /> {isRTL ? 'رجوع' : 'Back'}
              </button>
              <button onClick={() => setStep(3)} className="flex-1 btn-primary py-4 text-base">
                {isRTL ? 'مراجعة الطلب ←' : 'Review Order →'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <div className="max-w-2xl mx-auto">
            <h2 className={`text-2xl font-display font-bold text-gray-900 dark:text-dark-text mb-6 ${isRTL ? 'text-right' : ''}`}>
              {isRTL ? 'مراجعة طلبك' : 'Review Your Order'}
            </h2>

            {/* Items summary */}
            <div className={`bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6 mb-4 ${isRTL ? 'text-right' : ''}`}>
              <h3 className="font-semibold text-gray-900 dark:text-dark-text mb-3">{isRTL ? 'منتجات الطلب' : 'Order Items'}</h3>
              {items.map((item, idx) => (
                <div key={item.key || item.id || idx} className={`flex justify-between items-center py-2 border-b border-gray-50 dark:border-dark-border last:border-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="text-sm text-gray-700 dark:text-dark-muted">{item.name} × {item.quantity}</span>
                  <span className="text-sm font-semibold dark:text-dark-text">{(item.price * item.quantity).toLocaleString()} {isRTL ? 'ج.م' : t('common.egp')}</span>
                </div>
              ))}
              <div className={`flex justify-between items-center pt-3 font-bold text-lg ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="dark:text-dark-text">{isRTL ? 'الإجمالي' : t('cart.total')}</span>
                <span className="text-brand-navy dark:text-brand-gold">{total.toLocaleString()} {isRTL ? 'ج.م' : t('common.egp')}</span>
              </div>
            </div>

            {/* Delivery summary */}
            <div className={`bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6 mb-4 ${isRTL ? 'text-right' : ''}`}>
              <h3 className="font-semibold text-gray-900 dark:text-dark-text mb-3">{isRTL ? 'توصيل إلى' : 'Delivery To'}</h3>
              <p className="text-sm text-gray-700 dark:text-dark-text">{delivery.name}</p>
              <p className="text-sm text-gray-500 dark:text-dark-muted">{delivery.phone}</p>
              <p className="text-sm text-gray-500 dark:text-dark-muted">{delivery.street}, {delivery.governorate}</p>
            </div>

            {/* Payment summary */}
            <div className={`bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6 mb-6 ${isRTL ? 'text-right' : ''}`}>
              <h3 className="font-semibold text-gray-900 dark:text-dark-text mb-3">{isRTL ? 'طريقة الدفع' : 'Payment Method'}</h3>
              <p className="text-sm text-gray-700 dark:text-dark-text">
                {PAYMENT_METHODS.find(m => m.id === selectedPayment)?.label}
              </p>
            </div>

            <div className={`flex gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button onClick={() => setStep(2)} className={`btn-ghost flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <ArrowLeft size={16} className={isRTL ? 'rotate-180' : ''} /> {isRTL ? 'رجوع' : 'Back'}
              </button>
              <button 
                onClick={handlePlaceOrder} 
                disabled={orderLoading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl text-base transition-colors disabled:opacity-70"
              >
                {orderLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {isRTL ? 'جاري إتمام الطلب...' : 'Placing order...'}
                  </span>
                ) : (
                  isRTL ? 'إتمام الطلب ✓' : 'Place Order ✓'
                )}
              </button>
            </div>
            <p className={`text-center text-xs text-gray-400 dark:text-dark-muted mt-3 flex items-center justify-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Shield size={11} /> {isRTL ? 'آمن · سترايب · SSL 256 بت' : 'Secured · Stripe · 256-bit SSL'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
