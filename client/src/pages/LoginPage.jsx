import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, Shield, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  const { login, authLoading, error, setError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      toast.error(isRTL ? 'يرجى ملء جميع الحقول' : 'Please fill in all fields');
      return;
    }

    try {
      const userData = await login(email, password);

      const welcomeMsg = isRTL 
        ? `مرحباً بعودتك، ${userData.name?.split(' ')[0] ?? 'بك'}! 👋` 
        : `Welcome back, ${userData.name?.split(' ')[0] ?? 'there'}! 👋`;

      toast.success(welcomeMsg, {
        style: { borderRadius: '12px', fontFamily: isRTL ? 'Cairo' : 'Inter' },
      });

      if (userData.role === 'admin') navigate('/admin/dashboard');
      else if (userData.role === 'seller') navigate('/seller/dashboard');
      else navigate('/account');
    } catch {
      // error is already set in AuthContext
    }
  };

  return (
    <div className={`min-h-screen bg-brand-cream dark:bg-dark-bg flex transition-colors duration-200 ${isRTL ? 'flex-row-reverse' : ''}`}>
      {/* Left - Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className={`w-full max-w-md ${isRTL ? 'text-right' : 'text-left'}`}>
          {/* Logo */}
          <Link to="/" className={`flex items-center gap-2 mb-8 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className="w-10 h-10 bg-brand-navy dark:bg-brand-gold rounded-xl flex items-center justify-center transition-colors">
              <span className="text-white dark:text-brand-navy font-display font-bold text-xl">B</span>
            </div>
            <span className="font-display font-bold text-brand-navy dark:text-brand-gold text-2xl transition-colors">BrandHive</span>
          </Link>

          <h1 className="text-3xl font-display font-bold text-gray-900 dark:text-dark-text mb-2">
            {isRTL ? 'مرحباً بعودتك' : 'Welcome back'}
          </h1>
          <p className="text-gray-500 dark:text-dark-muted mb-8">
            {isRTL ? 'سجل دخولك إلى حسابك في براند هايف' : 'Sign in to your BrandHive account'}
          </p>

          {/* API Error Banner */}
          {error && (
            <div className={`flex items-start gap-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/20 text-red-700 dark:text-red-400 rounded-xl px-4 py-3 mb-6 text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
              <AlertCircle size={16} className={`mt-0.5 shrink-0 text-red-500 ${isRTL ? 'ml-0 mr-0' : ''}`} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="input-label dark:text-dark-text block mb-1.5">{t('auth.email')}</label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(null); }}
                placeholder={t('auth.emailPlaceholder')}
                className={`input-field ${isRTL ? 'text-right' : 'text-left'}`}
                autoComplete="email"
              />
            </div>

            <div>
              <div className={`flex items-center justify-between mb-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <label className="input-label dark:text-dark-text mb-0">{t('auth.password')}</label>
                <Link to="/forgot-password" className="text-xs text-brand-gold hover:underline">
                  {t('auth.forgotPassword')}
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(null); }}
                  placeholder={t('auth.passwordPlaceholder')}
                  className={`input-field ${isRTL ? 'pl-11 pr-4 text-right' : 'pr-11 pl-4'}`}
                  autoComplete="current-password"
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

            <button
              type="submit"
              disabled={authLoading}
              className="w-full btn-primary py-4 text-base mt-2 disabled:opacity-70"
            >
              {authLoading ? (
                <span className={`flex items-center justify-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {isRTL ? 'جاري الدخول...' : 'Signing in...'}
                </span>
              ) : (
                <span className={`flex items-center justify-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  {t('auth.signIn')} <ArrowRight size={18} className={isRTL ? 'rotate-180' : ''} />
                </span>
              )}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gray-200 dark:bg-dark-border"></div>
            <span className="text-xs text-gray-400 dark:text-dark-muted">{t('auth.orContinueWith')}</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-dark-border"></div>
          </div>

          <div className={`grid grid-cols-2 gap-3 mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {[
              { label: 'Google', icon: '🟢' },
              { label: 'Facebook', icon: '🔵' },
            ].map(provider => (
              <button
                key={provider.label}
                onClick={() => toast('Social login coming soon!', { icon: '🔜', style: { borderRadius: '12px' } })}
                className="flex items-center justify-center gap-2 py-3 border border-gray-200 dark:border-dark-border rounded-xl text-sm font-medium text-gray-700 dark:text-dark-text hover:bg-gray-50 dark:hover:bg-dark-surface transition-colors"
              >
                {provider.icon} {provider.label}
              </button>
            ))}
          </div>

          <p className="text-center text-sm text-gray-600 dark:text-dark-muted">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="text-brand-navy dark:text-brand-gold font-semibold hover:underline">
              {isRTL ? 'انضم لبراند هايف مجاناً' : 'Join BrandHive free'}
            </Link>
          </p>
        </div>
      </div>

      {/* Right - Visual */}
      <div className="hidden lg:flex flex-1 bg-brand-navy dark:bg-[#0f172a] items-center justify-center relative overflow-hidden transition-colors duration-200">
        <div className="absolute inset-0 bg-pattern opacity-20"></div>
        <div className="relative z-10 text-center text-white p-12 max-w-md">
          <div className="text-7xl mb-6 animate-float">🏺</div>
          <h2 className="text-4xl font-display font-bold mb-4">
            {isRTL ? (
              <>
                أفضل الماركات<br />
                <span className="text-gradient-gold">المحلية المصرية</span>
              </>
            ) : (
              <>
                Egypt's Finest<br />
                <span className="text-gradient-gold">Local Brands</span>
              </>
            )}
          </h2>
          <p className="text-gray-300 dark:text-gray-400 leading-relaxed mb-8">
            {isRTL 
              ? 'سجل دخولك للوصول إلى قائمتك المفضلة، تتبع طلباتك، واكتشاف توصيات مخصصة من أفضل الماركات المحلية في مصر.'
              : 'Sign in to access your wishlist, track orders, and discover personalized recommendations from Egypt\'s top local brands.'}
          </p>
          <div className={`flex items-center justify-center gap-2 text-brand-gold ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Shield size={14} />
            <span className="text-sm">{isRTL ? 'تشفير SSL 256 بت' : '256-bit SSL encrypted'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
