import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '', agreeTerms: false,
  });
  const [showPw, setShowPw] = useState(false);

  const { register, authLoading, error, setError } = useAuth();
  const navigate = useNavigate();

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.name || !form.email || !form.password) {
      toast.error(isRTL ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill in all required fields'); return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error(isRTL ? 'كلمات المرور غير متطابقة' : 'Passwords do not match'); return;
    }
    if (form.password.length < 6) {
      toast.error(isRTL ? 'يجب أن تكون كلمة المرور 6 أحرف على الأقل' : 'Password must be at least 6 characters'); return;
    }
    if (!form.agreeTerms) {
      toast.error(isRTL ? 'يرجى الموافقة على الشروط والأحكام' : 'Please accept the terms & conditions'); return;
    }

    try {
      await register(
        form.name,
        form.email,
        form.password,
        form.confirmPassword
      );

      navigate('/verify', { state: { email: form.email } });
    } catch {
      // error already set in AuthContext
    }
  };

  const perks = [
    isRTL ? '✅ انضمام مجاني — بدون رسوم شهرية' : '✅ Free to join — no monthly fees',
    isRTL ? '🛍️ تسوق من +12,000 ماركة مصرية موثقة' : '🛍️ Access 12,000+ verified Egyptian brands',
    isRTL ? '❤️ احفظ مفضلاتك في قائمتك الخاصة' : '❤️ Save favorites to your wishlist',
    isRTL ? '📦 تتبع جميع طلباتك في مكان واحد' : '📦 Track all your orders in one place',
    isRTL ? '🤖 احصل على توصيات مدعومة بالذكاء الاصطناعي' : '🤖 Get AI-powered recommendations',
  ];

  return (
    <div className={`min-h-screen bg-brand-cream dark:bg-dark-bg flex transition-colors duration-200 ${isRTL ? 'flex-row-reverse' : ''}`}>
      {/* Left - Visual */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-brand-navy to-blue-900 dark:from-[#0f172a] dark:to-brand-navy items-center justify-center relative overflow-hidden transition-colors duration-200">
        <div className="absolute inset-0 bg-pattern opacity-20"></div>
        <div className={`relative z-10 text-white p-12 max-w-md ${isRTL ? 'text-right' : 'text-left'}`}>
          <div className="text-7xl mb-6 animate-float">🛍️</div>
          <h2 className={`text-4xl font-display font-bold mb-4 ${isRTL ? 'leading-relaxed' : ''}`}>
            {isRTL ? 'انضم إلى' : 'Join'}<br />
            <span className="text-gradient-gold">BrandHive</span>
          </h2>
          <p className="text-gray-300 dark:text-gray-400 mb-8 leading-relaxed">
            {isRTL 
              ? 'كن جزءاً من أكبر مجتمع للماركات المحلية في مصر. تسوق، اكتشف، وادعم رواد الأعمال المصريين.'
              : "Become part of Egypt's largest local brand community. Shop, discover, and support Egyptian entrepreneurs."}
          </p>
          <div className="space-y-3">
            {perks.map(perk => (
              <div key={perk} className={`flex items-center gap-2 text-sm text-gray-300 dark:text-gray-400 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span>{perk}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 overflow-y-auto">
        <div className={`w-full max-w-md ${isRTL ? 'text-right' : 'text-left'}`}>
          <Link to="/" className={`flex items-center gap-2 mb-8 ${isRTL ? 'flex-row-reverse justify-end' : ''}`}>
            <div className="w-10 h-10 bg-brand-navy dark:bg-brand-gold rounded-xl flex items-center justify-center transition-colors">
              <span className="text-white dark:text-brand-navy font-display font-bold text-xl">B</span>
            </div>
            <span className="font-display font-bold text-brand-navy dark:text-brand-gold text-2xl transition-colors">BrandHive</span>
          </Link>

          <h1 className="text-3xl font-display font-bold text-gray-900 dark:text-dark-text mb-2">
            {isRTL ? 'أنشئ حسابك' : 'Create your account'}
          </h1>
          <p className="text-gray-500 dark:text-dark-muted mb-6">
            {isRTL ? 'انضم لأكثر من 500,000 مشتري في أكبر سوق مصري' : 'Join 500,000+ buyers on Egypt\'s top marketplace'}
          </p>

          {/* API Error Banner */}
          {error && (
            <div className={`flex items-start gap-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/20 text-red-700 dark:text-red-400 rounded-xl px-4 py-3 mb-6 text-sm ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
              <AlertCircle size={16} className={`mt-0.5 shrink-0 text-red-500 ${isRTL ? 'ml-0 mr-0' : ''}`} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className={isRTL ? 'text-right' : ''}>
              <label className="input-label dark:text-dark-text block mb-1.5">{t('auth.name')} *</label>
              <input
                value={form.name}
                onChange={e => { update('name', e.target.value); setError(null); }}
                placeholder={isRTL ? 'الاسم الكامل' : t('auth.namePlaceholder')}
                className={`input-field ${isRTL ? 'text-right' : 'text-left'}`}
              />
            </div>

            <div className={isRTL ? 'text-right' : ''}>
              <label className="input-label dark:text-dark-text block mb-1.5">{t('auth.email')} *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => { update('email', e.target.value); setError(null); }}
                placeholder={t('auth.emailPlaceholder')}
                className={`input-field ${isRTL ? 'text-right' : 'text-left'}`}
              />
            </div>

            <div className={isRTL ? 'text-right' : ''}>
              <label className="input-label dark:text-dark-text block mb-1.5">{t('auth.password')} *</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => { update('password', e.target.value); setError(null); }}
                  placeholder={t('auth.passwordPlaceholder')}
                  className={`input-field ${isRTL ? 'pl-11 pr-4 text-right' : 'pr-11 pl-4'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className={`absolute ${isRTL ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-gray-400 dark:text-dark-muted hover:text-gray-600 dark:hover:text-dark-text`}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className={isRTL ? 'text-right' : ''}>
              <label className="input-label dark:text-dark-text block mb-1.5">{isRTL ? 'تأكيد كلمة المرور *' : 'Confirm Password *'}</label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={e => update('confirmPassword', e.target.value)}
                placeholder={isRTL ? 'كرر كلمة المرور' : 'Repeat your password'}
                className={`input-field ${isRTL ? 'text-right' : 'text-left'} ${form.confirmPassword && form.password !== form.confirmPassword ? 'border-red-300 dark:border-red-500 focus:border-red-400' : ''}`}
              />
              {form.confirmPassword && form.password !== form.confirmPassword && (
                <p className={`text-xs text-red-500 mt-1 ${isRTL ? 'text-right' : ''}`}>
                  {isRTL ? 'كلمات المرور غير متطابقة' : 'Passwords don\'t match'}
                </p>
              )}
            </div>

            <label className={`flex items-start gap-2 cursor-pointer ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
              <input
                type="checkbox"
                checked={form.agreeTerms}
                onChange={e => update('agreeTerms', e.target.checked)}
                className="mt-1 rounded border-gray-300 dark:border-dark-border text-brand-navy dark:text-brand-gold focus:ring-brand-navy dark:bg-dark-surface"
              />
              <span className={`text-sm text-gray-600 dark:text-dark-muted ${isRTL ? 'text-right' : ''}`}>
                {isRTL ? 'أوافق على ' : 'I agree to BrandHive\'s '}
                <Link to="/terms" className="text-brand-navy dark:text-brand-gold font-medium hover:underline">
                  {isRTL ? 'شروط الخدمة' : 'Terms of Service'}
                </Link>
                {isRTL ? ' و ' : ' and '}
                <Link to="/privacy" className="text-brand-navy dark:text-brand-gold font-medium hover:underline">
                  {isRTL ? 'سياسة الخصوصية' : 'Privacy Policy'}
                </Link>
              </span>
            </label>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full btn-primary py-4 text-base disabled:opacity-70"
            >
              {authLoading ? (
                <span className={`flex items-center justify-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {isRTL ? 'جاري إنشاء الحساب...' : 'Creating account...'}
                </span>
              ) : (
                <span className={`flex items-center justify-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  {isRTL ? 'إنشاء حساب' : t('auth.register')} <ArrowRight size={18} className={isRTL ? 'rotate-180' : ''} />
                </span>
              )}
            </button>
          </form>

          <p className={`text-center text-sm text-gray-600 dark:text-dark-muted mt-6 ${isRTL ? 'text-right flex justify-center gap-1 flex-row-reverse' : ''}`}>
            {t('auth.hasAccount')}{' '}
            <Link to="/login" className="text-brand-navy dark:text-brand-gold font-semibold hover:underline">
              {t('auth.signIn')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
