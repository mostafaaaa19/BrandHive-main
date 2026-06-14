import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Upload, CheckCircle, Store, BarChart3, Users, MessageSquare, ShoppingBag } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { brandsAPI, categoriesAPI, rememberSellerBrandName } from '../services/api';
import { mapCategory } from '../utils/mappers';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import toast from 'react-hot-toast';

export default function SellerRegistration() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await categoriesAPI.getAll();
        const raw = res.data?.data || res.data?.categories || res.data || [];
        if (Array.isArray(raw) && raw.length > 0) {
          setCategories(raw.map(mapCategory));
        }
      } catch {
        // keep empty categories on failure
      }
    };
    fetchCategories();
  }, []);
  const { user } = useAuth();
  const navigate = useNavigate();

  const hasSession = Boolean(user?.token || user?.accessToken);

  useEffect(() => {
    if (!hasSession) return;
    if (user?.role === 'seller' || user?.serverRole === 'seller') {
      navigate('/seller/dashboard', { replace: true });
    }
  }, [hasSession, user, navigate]);

  const STEPS = [
    { num: 1, label: isRTL ? 'المعلومات الأساسية' : 'Basic Information' },
    { num: 2, label: isRTL ? 'إعداد العلامة التجارية' : 'Brand Setup' },
    { num: 3, label: isRTL ? 'المراجعة' : 'Review' },
  ];

  const PERKS = [
    { icon: ShoppingBag, title: isRTL ? 'صل لأكثر من 500 ألف مشترٍ' : 'Reach 500K+ Buyers', desc: isRTL ? 'أكبر جمهور تسوق محلي في مصر فوراً' : "Egypt's largest local shopping audience instantly" },
    { icon: BarChart3, title: isRTL ? 'عمولة 5% فقط' : 'Just 5% Commission', desc: isRTL ? 'لا رسوم شهرية — ادفع فقط عند البيع' : 'No monthly fees — only pay when you sell' },
    { icon: Store, title: isRTL ? 'أنشئ البازار الخاص بك' : 'Create Your Bazaar', desc: isRTL ? 'متجرك المصغر الخاص على براند هايف' : 'Your own branded mini-storefront on BrandHive' },
    { icon: BarChart3, title: isRTL ? 'تحليلات مباشرة' : 'Real-Time Analytics', desc: isRTL ? 'المبيعات، الزيارات، الطلبات — في لوحة واحدة' : 'Sales, traffic, orders — all in one dashboard' },
    { icon: MessageSquare, title: isRTL ? 'دعم 24/7' : '24/7 Support', desc: isRTL ? 'فريق دعم مخصص بالعربية والإنجليزية' : 'Dedicated Arabic & English support team' },
  ];

  const [form, setForm] = useState({
    name: user?.name || '',
    phone: '',
    governorate: 'Cairo',
    brandName: '',
    description: '',
    logoFile: null,
    categories: [],
    agreeTerms: false,
  });

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleNext = () => {
    if (step === 1) {
      if (!form.name?.trim() || !form.phone?.trim()) {
        toast.error(isRTL ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill in all required fields'); return;
      }
    }
    if (step === 2) {
      if (!form.brandName || !form.description) {
        toast.error(isRTL ? 'اسم الماركة والوصف مطلوبان' : 'Brand name and description are required'); return;
      }
    }
    setStep(s => s + 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.agreeTerms) {
      toast.error(isRTL
        ? 'يرجى الموافقة على الشروط'
        : 'Please accept the terms'
      );
      return;
    }
    if (!hasSession) {
      toast.error(
        isRTL
          ? 'يجب تسجيل الدخول أولاً لربط الطلب بحسابك'
          : 'You must sign in first so we can link the application to your account',
        { style: { borderRadius: '12px' }, duration: 5000 }
      );
      navigate('/login', { state: { from: '/sell' } });
      return;
    }
    setLoading(true);
    try {
      const submitData = new FormData();

      submitData.append('name', form.brandName.trim());
      submitData.append('description', form.description.trim());
      submitData.append('country', 'Egypt');
      submitData.append('city', form.governorate || 'Cairo');
      submitData.append('phone', form.phone?.trim() || '');

      if (form.logoFile) {
        submitData.append('logo', form.logoFile);
      }

      const selectedCatObjects = categories.filter(c => {
        const displayName = isRTL && c.arName
          ? c.arName : c.name;
        return form.categories.includes(displayName);
      });
      if (selectedCatObjects.length > 0) {
        selectedCatObjects.forEach(c =>
          submitData.append(
            'categories[]',
            c.id || c._id || c.name
          )
        );
      }

      await brandsAPI.request(submitData);

      const userId = user?.id || user?._id;
      if (userId || user?.email) {
        rememberSellerBrandName(userId, form.brandName.trim(), user?.email);
      }

      toast.success(
        isRTL
          ? 'تم إرسال طلبك بنجاح! سيتم مراجعته قريباً 🎉'
          : 'Application submitted! It will be reviewed soon 🎉',
        { style: { borderRadius: '12px' }, duration: 4000 }
      );
      navigate('/seller/pending', {
        state: { brandName: form.brandName }
      });
    } catch (err) {
      const msg = err.response?.data?.message;
      toast.error(
        msg || (isRTL ? 'فشل إرسال الطلب. حاول مرة أخرى.' : 'Failed to submit. Please try again.'),
        { style: { borderRadius: '12px' } }
      );
    } finally {
      setLoading(false);
    }
  };

  const EGYPT_GOVERNORATES = [
    'Cairo', 'Alexandria', 'Giza', 'Luxor', 'Aswan', 'Hurghada', 'Port Said', 'Suez',
    'Mansoura', 'Tanta', 'Zagazig', 'Ismailia', 'Minya', 'Beni Suef', 'Fayoum', 'Sohag',
    'Qena', 'Asyut', 'Kafr El Sheikh', 'Sharqia', 'Gharbia', 'Monufia', 'Beheira', 'Qalyubia',
    'Dakahlia', 'North Sinai', 'South Sinai',
  ];

  const catOptions = categories.map(c => isRTL && c.arName ? c.arName : c.name);

  const toggleCat = (cat) => {
    setForm(p => ({
      ...p,
      categories: p.categories.includes(cat) ? p.categories.filter(c => c !== cat) : [...p.categories, cat]
    }));
  };

  return (
    <div className={`min-h-screen bg-brand-cream dark:bg-dark-bg flex transition-colors duration-200 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
      {/* Left Sidebar - Benefits */}
      <div className="hidden lg:flex lg:w-[420px] bg-brand-navy dark:bg-[#0f172a] flex-col justify-center p-12 relative overflow-hidden transition-colors duration-200">
        <div className="absolute inset-0 bg-pattern opacity-20"></div>
        <div className="relative z-10">
          <Link to="/" className={`flex items-center gap-2 mb-10 ${isRTL ? 'flex-row-reverse justify-end' : ''}`}>
            <div className="w-10 h-10 bg-brand-gold rounded-xl flex items-center justify-center">
              <span className="text-white dark:text-brand-navy font-display font-bold text-xl">B</span>
            </div>
            <span className="text-white dark:text-brand-gold font-display font-bold text-2xl transition-colors">BrandHive</span>
          </Link>

          <p className="text-brand-gold text-sm font-semibold uppercase tracking-wider mb-3">
            {isRTL ? 'هل تبيع بالفعل؟' : 'Already selling?'}
          </p>
          <h2 className={`text-4xl font-display font-bold text-white mb-4 leading-tight ${isRTL ? 'text-right' : ''}`}>
            {isRTL ? (
              <>انضم للمنصة<br />الأولى في مصر</>
            ) : (
              <>Join Egypt's #1<br />Marketplace</>
            )}
          </h2>
          <p className="text-gray-300 dark:text-gray-400 mb-8">
            {isRTL ? 'ابدأ البيع لأكثر من 500 ألف مشترٍ في مصر وخارجها.' : 'Start selling to 500K+ buyers across Egypt and beyond.'}
          </p>

          <div className="space-y-5">
            {PERKS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className={`flex gap-4 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                <div className="w-10 h-10 rounded-xl bg-brand-gold/20 flex items-center justify-center flex-shrink-0">
                  <Icon size={18} className="text-brand-gold" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{title}</p>
                  <p className="text-gray-400 dark:text-gray-500 text-xs">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 overflow-y-auto">
        <div className="w-full max-w-lg">
          {/* Mobile logo */}
          <Link to="/" className={`flex lg:hidden items-center gap-2 mb-8 ${isRTL ? 'flex-row-reverse justify-end' : ''}`}>
            <div className="w-9 h-9 bg-brand-navy dark:bg-brand-gold rounded-xl flex items-center justify-center transition-colors">
              <span className="text-white dark:text-brand-navy font-display font-bold">B</span>
            </div>
            <span className="font-display font-bold text-brand-navy dark:text-brand-gold text-xl transition-colors">BrandHive</span>
          </Link>

          {/* Already selling hint */}
          <div className={`flex justify-end mb-4 ${isRTL ? 'flex-row-reverse justify-start' : ''}`}>
            <Link to="/login" className="text-sm text-gray-500 dark:text-dark-muted hover:text-brand-navy dark:hover:text-brand-gold transition-colors">
              {isRTL ? 'تبيع بالفعل؟' : 'Already selling?'} <span className="font-semibold text-brand-navy dark:text-brand-gold">{isRTL ? 'سجل دخول' : 'Sign in'}</span>
            </Link>
          </div>

          {/* Step indicator */}
          <div className={`flex items-center gap-3 mb-8 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {STEPS.map((s, i) => (
              <div key={s.num} className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={`flex items-center gap-2 transition-all ${isRTL ? 'flex-row-reverse' : ''} ${step >= s.num ? 'text-brand-navy dark:text-brand-gold' : 'text-gray-400 dark:text-dark-muted'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${step > s.num ? 'bg-emerald-500 text-white' :
                      step === s.num ? 'bg-brand-navy dark:bg-brand-gold text-white dark:text-brand-navy shadow-md' : 'bg-gray-200 dark:bg-dark-surface'
                    }`}>
                    {step > s.num ? <CheckCircle size={14} /> : s.num}
                  </div>
                  <span className={`text-xs font-medium hidden sm:block ${step === s.num ? 'text-brand-navy dark:text-dark-text' : 'text-gray-400 dark:text-dark-muted'}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-8 h-0.5 mx-1 transition-all ${step > s.num ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-dark-border'}`} />
                )}
              </div>
            ))}
          </div>

          <h2 className="text-2xl font-display font-bold text-gray-900 dark:text-dark-text mb-1">
            {isRTL ? 'إنشاء حساب بائع' : 'Create Your Seller Account'}
          </h2>
          <p className="text-gray-500 dark:text-dark-muted text-sm mb-6">
            {isRTL ? `الخطوة ${step} من ${STEPS.length} · ${STEPS[step - 1].label}` : `Step ${step} of ${STEPS.length} · ${STEPS[step - 1].label}`}
          </p>

          {!hasSession && (
            <div className={`mb-6 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 ${isRTL ? 'text-right' : ''}`}>
              {isRTL
                ? 'سجّل دخولك أو أنشئ حساباً أولاً — الطلب لازم يتربط بحسابك عشان الموافقة تشتغل صح.'
                : 'Sign in or create an account first — your application must be linked to your account for approval to work.'}
              {' '}
              <Link to="/login" state={{ from: '/sell' }} className="font-semibold underline">
                {isRTL ? 'تسجيل الدخول' : 'Sign in'}
              </Link>
            </div>
          )}

          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div className={isRTL ? 'text-right' : ''}>
                <label className="input-label dark:text-dark-text">{isRTL ? 'الاسم *' : 'Name *'}</label>
                <input value={form.name} onChange={e => update('name', e.target.value)} placeholder={isRTL ? 'اسمك الكامل' : 'Your full name'} className={`input-field ${isRTL ? 'text-right' : ''}`} />
              </div>
              <div className={isRTL ? 'text-right' : ''}>
                <label className="input-label dark:text-dark-text">{isRTL ? 'رقم الهاتف *' : 'Phone Number *'}</label>
                <input value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+20 10 0000 0000" className={`input-field ${isRTL ? 'text-right' : ''}`} />
              </div>
              <div className={isRTL ? 'text-right' : ''}>
                <label className={`block text-sm font-medium text-gray-700 dark:text-dark-text mb-1 ${isRTL ? 'text-right' : ''}`}>
                  {isRTL ? 'المحافظة' : 'Governorate'} *
                </label>
                <select
                  value={form.governorate || 'Cairo'}
                  onChange={e => update('governorate', e.target.value)}
                  className={`input-field ${isRTL ? 'text-right' : ''}`}
                >
                  {EGYPT_GOVERNORATES.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Step 2: Brand Setup */}
          {step === 2 && (
            <div className="space-y-4">
              <div className={isRTL ? 'text-right' : ''}>
                <label className="input-label dark:text-dark-text">{isRTL ? 'اسم الماركة *' : 'Brand Name *'}</label>
                <input
                  value={form.brandName}
                  onChange={e => update('brandName', e.target.value)}
                  placeholder={isRTL ? 'اسم ماركتك بالإنجليزية' : 'Your brand name in English'}
                  className={`input-field ${isRTL ? 'text-right' : ''}`}
                />
              </div>

              <div className={isRTL ? 'text-right' : ''}>
                <label className="input-label dark:text-dark-text">{isRTL ? 'وصف الماركة *' : 'Brand Description *'}</label>
                <textarea
                  value={form.description}
                  onChange={e => update('description', e.target.value)}
                  placeholder={isRTL ? 'أخبر العملاء بقصتك — ماذا تصنع ولماذا...' : 'Tell customers your story — what you make and why...'}
                  className={`input-field h-28 resize-none ${isRTL ? 'text-right' : ''}`}
                />
              </div>

              <div className={isRTL ? 'text-right' : ''}>
                <label className="input-label dark:text-dark-text">{isRTL ? 'الفئات (اختر كل ما ينطبق)' : 'Categories (select all that apply)'}</label>
                <div className={`flex flex-wrap gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  {catOptions.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCat(cat)}
                      className={`px-3 py-1.5 rounded-xl text-sm font-medium border-2 transition-all ${form.categories.includes(cat)
                          ? 'border-brand-navy dark:border-brand-gold bg-brand-navy dark:bg-brand-gold text-white dark:text-brand-navy'
                          : 'border-gray-200 dark:border-dark-border text-gray-600 dark:text-dark-muted hover:border-brand-navy/40 dark:hover:border-brand-gold/40'
                        }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Logo Upload */}
              <div className={isRTL ? 'text-right' : ''}>
                <label className="input-label dark:text-dark-text">{isRTL ? 'شعار الماركة' : 'Brand Logo'}</label>
                <label className="block cursor-pointer">
                  <div className="border-2 border-dashed border-gray-300 dark:border-dark-border rounded-xl p-8 text-center hover:border-brand-navy dark:hover:border-brand-gold transition-colors">
                    {form.logoFile ? (
                      <div className="flex flex-col items-center gap-2">
                        <img
                          src={URL.createObjectURL(form.logoFile)}
                          alt="Logo preview"
                          className="w-20 h-20 object-contain rounded-xl border border-gray-200 dark:border-dark-border"
                        />
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle size={12} /> {form.logoFile.name}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-dark-muted">
                          {isRTL ? 'اضغط لتغيير الصورة' : 'Click to change'}
                        </p>
                      </div>
                    ) : (
                      <>
                        <Upload size={24} className="mx-auto text-gray-400 dark:text-dark-muted mb-2" />
                        <p className="text-sm text-gray-600 dark:text-dark-text mb-1">
                          {isRTL ? 'ضع شعارك هنا أو اضغط للتصفح' : 'Drop your logo here or click to browse'}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-dark-muted">PNG · JPG · SVG · {isRTL ? 'حتى 5 ميجابايت' : 'up to 5MB'}</p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) update('logoFile', file);
                    }}
                  />
                </label>
              </div>
            </div>
          )}

          {/* Step 3: Review & Submit */}
          {step === 3 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-5">
                <h4 className={`font-semibold text-gray-900 dark:text-dark-text mb-3 ${isRTL ? 'text-right' : ''}`}>{isRTL ? 'ملخص الطلب' : 'Application Summary'}</h4>
                <div className="space-y-2 text-sm">
                  <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <span className="text-gray-500 dark:text-dark-muted">{isRTL ? 'الاسم' : 'Name'}</span>
                    <span className="font-medium dark:text-dark-text">{form.name}</span>
                  </div>
                  <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <span className="text-gray-500 dark:text-dark-muted">{isRTL ? 'الماركة' : 'Brand'}</span>
                    <span className="font-medium dark:text-dark-text">{form.brandName || '—'}</span>
                  </div>
                  <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <span className="text-gray-500 dark:text-dark-muted">{isRTL ? 'الموقع' : 'Location'}</span>
                    <span className="font-medium dark:text-dark-text">{form.governorate}</span>
                  </div>
                  <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <span className="text-gray-500 dark:text-dark-muted">{isRTL ? 'الهاتف' : 'Phone'}</span>
                    <span className="font-medium dark:text-dark-text">{form.phone}</span>
                  </div>
                </div>
              </div>

              <label className={`flex items-start gap-2 cursor-pointer ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                <input
                  type="checkbox"
                  checked={form.agreeTerms}
                  onChange={e => update('agreeTerms', e.target.checked)}
                  className="mt-1 rounded border-gray-300 dark:border-dark-border text-brand-navy dark:text-brand-gold focus:ring-brand-gold"
                />
                <span className="text-sm text-gray-600 dark:text-dark-muted">
                  {isRTL ? 'أوافق على ' : "I agree to BrandHive's "}{' '}
                  <Link to="/terms" className="text-brand-navy dark:text-brand-gold font-medium hover:underline">{isRTL ? 'شروط البائع' : 'Seller Terms'}</Link>
                  {' '}{isRTL ? 'و' : 'and'}{' '}
                  <Link to="/privacy" className="text-brand-navy dark:text-brand-gold font-medium hover:underline">{isRTL ? 'سياسة الخصوصية' : 'Privacy Policy'}</Link>
                </span>
              </label>

              <button type="submit" disabled={loading} className="w-full btn-primary py-4 text-base disabled:opacity-70">
                {loading ? (
                  <span className={`flex items-center justify-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {isRTL ? 'جاري الإرسال...' : 'Submitting...'}
                  </span>
                ) : (
                  <span className={`flex items-center justify-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    {isRTL ? 'تقديم الطلب' : 'Submit Application'} <ArrowRight size={18} className={isRTL ? 'rotate-180' : ''} />
                  </span>
                )}
              </button>
            </form>
          )}

          {/* Navigation buttons (non-final steps) */}
          {step < 3 && (
            <div className={`flex gap-3 mt-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
              {step > 1 && (
                <button onClick={() => setStep(s => s - 1)} className={`btn-ghost flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <ArrowLeft size={16} className={isRTL ? 'rotate-180' : ''} /> {isRTL ? 'رجوع' : 'Back'}
                </button>
              )}
              <button onClick={handleNext} className={`flex-1 btn-primary py-4 flex items-center justify-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                {step === 2 
                  ? (isRTL ? 'مواصلة للمراجعة' : 'Continue to Review') 
                  : (isRTL ? 'مواصلة لإعداد الماركة' : 'Continue to Brand Setup')
                } <ArrowRight size={18} className={isRTL ? 'rotate-180' : ''} />
              </button>
            </div>
          )}

          {step > 1 && step < 3 && (
            <button
              onClick={() => toast.success(isRTL ? 'تم حفظ المسودة!' : 'Draft saved!', { style: { borderRadius: '12px', fontFamily: isRTL ? 'Cairo' : 'Inter' } })}
              className={`w-full text-center text-sm text-gray-500 dark:text-dark-muted hover:text-brand-navy dark:hover:text-brand-gold transition-colors mt-3 py-2`}
            >
              {isRTL ? 'حفظ مسودة' : 'Save Draft'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
