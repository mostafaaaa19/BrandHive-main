import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, CheckCircle2, Mail, Home, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  authAPI,
  brandsAPI,
  sellerAPI,
  fetchMyBrandRequest,
  getResponseArray,
  rememberSellerBrand,
  rememberSellerBrandName,
  linkBrandFromFacets,
} from '../../services/api';
import toast from 'react-hot-toast';

const isBrandApproved = (brand) =>
  Boolean(
    brand?.isVerified ||
    brand?.isApproved ||
    brand?.status === 'approved' ||
    brand?.status === 'active'
  );

const brandMatchesUser = (brand, user, brandName) => {
  const userId = user?.id || user?._id;
  const nameMatch =
    brandName &&
    brand?.name?.toLowerCase() === String(brandName).toLowerCase();
  const ownerId =
    brand?.owner?._id ||
    brand?.owner?.id ||
    brand?.owner ||
    brand?.userId ||
    brand?.user?._id ||
    brand?.user?.id ||
    brand?.requestedBy?._id ||
    brand?.requestedBy?.id ||
    brand?.requestedBy;
  const ownerMatch = userId && ownerId && String(ownerId) === String(userId);
  return nameMatch || ownerMatch;
};

export default function SellerPendingPage() {
  const { user, upgradeToSeller, refreshSession } = useAuth();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [brandStatus, setBrandStatus] = useState('pending');
  const approvedRef = useRef(false);

  const brandName =
    location.state?.brandName ||
    user?.brandName ||
    (isRTL ? 'ماركتك' : 'your brand');

  useEffect(() => {
    if (approvedRef.current) return;

    const applyApproval = async (serverUser, brand) => {
      if (approvedRef.current) return;
      approvedRef.current = true;
      setBrandStatus('approved');

      const refreshed = serverUser?.role
        ? upgradeToSeller(serverUser)
        : upgradeToSeller(await refreshSession());

      const userId = refreshed?.id || refreshed?._id || user?.id || user?._id;
      if (brand && userId) {
        rememberSellerBrand(userId, brand);
        rememberSellerBrandName(userId, brand.name || brandName, refreshed?.email || user?.email);
      } else if (userId) {
        await linkBrandFromFacets(refreshed || user);
      }

      toast.success(
        isRTL ? 'تمت الموافقة على ماركتك! 🎉' : 'Your brand has been approved! 🎉',
        { style: { borderRadius: '12px' }, duration: 4000 }
      );
      setTimeout(() => navigate('/seller/dashboard'), 2500);
    };

    const checkStatus = async () => {
      try {
        const meRes = await authAPI.getMe();
        const payload = meRes.data?.data || meRes.data;
        const me = payload?.user || payload;
        if (me?.role === 'seller' || me?.role === 'admin') {
          let brand = null;
          try {
            const dashRes = await sellerAPI.getDashboard();
            brand = dashRes.data?.data?.brand || dashRes.data?.brand || null;
          } catch {
            // dashboard optional during approval
          }
          await applyApproval(me, brand);
          return;
        }
      } catch {
        // continue with other checks
      }

      try {
        const dashRes = await sellerAPI.getDashboard();
        const brand = dashRes.data?.data?.brand || dashRes.data?.brand;
        if (brand?._id || brand?.id) {
          const refreshed = await refreshSession();
          await applyApproval(refreshed, brand);
          return;
        }
      } catch {
        // not approved yet
      }

      try {
        const myRequest = await fetchMyBrandRequest(user);
        const requestStatus = myRequest?.status || myRequest?.requestStatus;
        if (myRequest && requestStatus === 'approved') {
          const brand =
            myRequest.brand ||
            myRequest.approvedBrand || {
              _id: myRequest.brandId || myRequest._id || myRequest.id,
              id: myRequest.brandId || myRequest._id || myRequest.id,
              name: myRequest.name || myRequest.brandName || brandName,
              slug: myRequest.slug,
            };
          const refreshed = await refreshSession();
          await applyApproval(refreshed, brand);
          return;
        }
      } catch {
        // requests endpoint may be admin-only on some backends
      }

      try {
        const res = await brandsAPI.getAll({ limit: 100 });
        const brands = getResponseArray(res);
        const brand = brands.find(
          (entry) => brandMatchesUser(entry, user, brandName) && isBrandApproved(entry)
        );
        if (brand) {
          const refreshed = await refreshSession();
          await applyApproval(refreshed, brand);
        }
      } catch {
        // silent fail on poll — user stays on pending screen
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 15000);
    return () => clearInterval(interval);
  }, [brandName, user, upgradeToSeller, refreshSession, navigate, isRTL]);

  const steps = [
    {
      done: true,
      title: isRTL ? 'تم إرسال الطلب' : 'Application submitted',
      desc: isRTL
        ? 'استلمنا طلب انضمامك كبائع على براند هايف.'
        : 'We received your seller application on BrandHive.',
    },
    {
      done: false,
      active: true,
      title: isRTL ? 'قيد المراجعة' : 'Under review',
      desc: isRTL
        ? 'فريقنا يتحقق من بيانات ماركتك — عادةً خلال 1–3 أيام عمل.'
        : 'Our team is reviewing your brand details — usually within 1–3 business days.',
    },
    {
      done: false,
      title: isRTL ? 'الموافقة والبدء' : 'Approved & go live',
      desc: isRTL
        ? 'بعد الموافقة ستصلك رسالة ويمكنك فتح لوحة البائع وإضافة المنتجات.'
        : 'Once approved, you will get a notification and can open your seller dashboard.',
    },
  ];

  return (
    <div
      className={`min-h-[calc(100vh-4rem)] bg-brand-cream dark:bg-dark-bg flex items-center justify-center px-4 py-12 ${isRTL ? 'text-right' : 'text-left'}`}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        <div className="bg-white dark:bg-dark-surface rounded-3xl shadow-card dark:border dark:border-dark-border p-8 md:p-10 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-brand-gold/15 flex items-center justify-center">
            <Clock size={40} className="text-brand-gold animate-pulse" />
          </div>

          <h1 className="text-2xl md:text-3xl font-display font-bold text-brand-navy dark:text-dark-text mb-2">
            {brandStatus === 'approved'
              ? (isRTL ? 'تمت الموافقة!' : 'Approved!')
              : (isRTL ? 'طلبك قيد المراجعة' : 'Waiting for approval')}
          </h1>

          <p className="text-gray-600 dark:text-dark-muted mb-8 leading-relaxed">
            {isRTL ? (
              <>
                شكراً لتقديم طلب <span className="font-semibold text-brand-navy dark:text-brand-gold">{brandName}</span>.
                {' '}سنخبرك عبر البريد عند الموافقة على ماركتك.
              </>
            ) : (
              <>
                Thanks for applying with{' '}
                <span className="font-semibold text-brand-navy dark:text-brand-gold">{brandName}</span>.
                {' '}We will email you when your brand is approved.
              </>
            )}
          </p>

          <div className={`space-y-4 mb-8 ${isRTL ? 'text-right' : 'text-left'}`}>
            {steps.map((step, i) => (
              <div
                key={i}
                className={`flex gap-4 p-4 rounded-2xl border ${
                  step.active
                    ? 'border-brand-gold/40 bg-brand-gold-pale/50 dark:bg-brand-gold/10'
                    : 'border-gray-100 dark:border-dark-border bg-gray-50/50 dark:bg-dark-bg/50'
                } ${isRTL ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                    step.done
                      ? 'bg-emerald-500 text-white'
                      : step.active
                      ? 'bg-brand-gold text-white'
                      : 'bg-gray-200 dark:bg-dark-border text-gray-400'
                  }`}
                >
                  {step.done ? (
                    <CheckCircle2 size={18} />
                  ) : (
                    <span className="text-sm font-bold">{i + 1}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-dark-text text-sm">
                    {step.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-dark-muted mt-0.5 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {user?.email && (
            <p
              className={`text-sm text-gray-500 dark:text-dark-muted mb-6 flex items-center justify-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <Mail size={14} />
              {isRTL ? 'إشعارات على:' : 'Updates sent to:'}{' '}
              <span className="font-medium text-gray-700 dark:text-dark-text">{user.email}</span>
            </p>
          )}

          <div className={`flex flex-col sm:flex-row gap-3 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
            <Link to="/" className={`btn-outline flex-1 justify-center ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Home size={16} />
              {isRTL ? 'الصفحة الرئيسية' : 'Back to home'}
            </Link>
            <Link
              to="/account"
              className={`btn-primary flex-1 justify-center ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              {isRTL ? 'حسابي' : 'My account'}
              <ArrowRight size={16} className={isRTL ? 'rotate-180' : ''} />
            </Link>
          </div>

          <button
            type="button"
            onClick={() => navigate('/seller/dashboard')}
            className="mt-4 text-xs text-gray-400 dark:text-dark-muted hover:text-brand-navy dark:hover:text-brand-gold transition-colors"
          >
            {isRTL ? 'الذهاب للوحة البائع (بعد الموافقة)' : 'Go to seller dashboard (after approval)'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
