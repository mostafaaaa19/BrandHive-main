import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, AlertCircle, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { authAPI } from '../services/api';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError(isRTL ? 'يرجى إدخال بريدك الإلكتروني.' : 'Please enter your email address.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await authAPI.forgotPassword({ email: email.trim() });
      setSuccess(true);
      setTimeout(() => {
        navigate('/verify-reset', { state: { email: email.trim() } });
      }, 1500);
    } catch (err) {
      const msg = isRTL 
        ? 'حدث خطأ ما. يرجى المحاولة مرة أخرى.'
        : (err.response?.data?.message || err.message || 'Something went wrong. Please try again.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen bg-brand-cream dark:bg-dark-bg flex transition-colors duration-200 ${isRTL ? 'flex-row-reverse' : ''}`}>

      {/* ── Left Panel (visual) ── */}
      <div className="hidden lg:flex flex-1 bg-brand-navy dark:bg-[#0f172a] items-center justify-center relative overflow-hidden transition-colors duration-200">
        <div className="absolute inset-0 bg-pattern opacity-20" />

        {/* Decorative rings */}
        <div className="absolute w-96 h-96 rounded-full border border-white/5 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute w-72 h-72 rounded-full border border-white/5 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

        <div className="relative z-10 text-center text-white p-12 max-w-md">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="mb-6 flex justify-center"
          >
            <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center">
              <Lock size={44} className="text-brand-gold" />
            </div>
          </motion.div>

          <motion.h2
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className={`text-4xl font-display font-bold mb-4 ${isRTL ? 'leading-relaxed' : ''}`}
          >
            {isRTL ? (
              <>أعد تعيين<br /><span className="text-gradient-gold">كلمة مرورك.</span></>
            ) : (
              <>Reset your<br /><span className="text-gradient-gold">password.</span></>
            )}
          </motion.h2>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="text-gray-300 dark:text-gray-400 leading-relaxed mb-8"
          >
            {isRTL ? 'سنقوم بإرسال رمز إعادة تعيين آمن إلى بريدك. أدخله في الشاشة التالية لاختيار كلمة مرور جديدة.' : "We'll send a secure reset code to your inbox. Enter it on the next screen to choose a new password."}
          </motion.p>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35 }}
            className={`flex items-center justify-center gap-2 text-brand-gold text-sm ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <Mail size={14} />
            <span>{isRTL ? 'تحقق من مجلد الرسائل المزعجة إذا لم تجد الرمز' : "Check your spam folder if you don't see it"}</span>
          </motion.div>
        </div>
      </div>

      {/* ── Right Panel (form) ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="w-full max-w-md"
        >
          {/* Logo */}
          <Link to="/" className={`flex items-center gap-2 mb-10 ${isRTL ? 'flex-row-reverse justify-end' : ''}`}>
            <div className="w-10 h-10 bg-brand-navy dark:bg-brand-gold rounded-xl flex items-center justify-center transition-colors">
              <span className="text-white dark:text-brand-navy font-display font-bold text-xl">B</span>
            </div>
            <span className="font-display font-bold text-brand-navy dark:text-brand-gold text-2xl transition-colors">BrandHive</span>
          </Link>

          {/* Success state */}
          <AnimatePresence>
            {success && (
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-16 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                >
                  <CheckCircle size={72} className="text-green-500 mb-4" />
                </motion.div>
                <h2 className="text-2xl font-display font-bold text-brand-navy dark:text-brand-gold mb-2">
                  {isRTL ? 'تم إرسال الرمز!' : 'Code sent!'}
                </h2>
                <p className="text-gray-500 dark:text-dark-muted text-sm">
                  {isRTL ? 'تحقق من بريدك الإلكتروني. جاري التحويل...' : 'Check your inbox. Redirecting…'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {!success && (
            <>
              <h1 className={`text-3xl font-display font-bold text-brand-navy dark:text-dark-text mb-2 ${isRTL ? 'text-right' : ''}`}>
                {isRTL ? 'نسيت كلمة المرور؟' : 'Forgot Password?'}
              </h1>
              <p className={`text-gray-500 dark:text-dark-muted mb-8 text-sm leading-relaxed ${isRTL ? 'text-right' : ''}`}>
                {isRTL ? 'أدخل بريدك الإلكتروني وسنرسل لك رمز إعادة التعيين.' : "Enter your email and we'll send you a reset code."}
              </p>

              {/* Error banner */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    key="fp-error"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className={`flex items-start gap-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/20 text-red-700 dark:text-red-400 rounded-xl px-4 py-3 mb-6 text-sm ${isRTL ? 'flex-row-reverse text-right' : ''}`}
                  >
                    <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-500" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className={`input-label dark:text-dark-text ${isRTL ? 'text-right' : ''}`}>
                    {isRTL ? 'البريد الإلكتروني' : 'Email Address'}
                  </label>
                  <input
                    type="email"
                    id="forgot-email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(''); }}
                    placeholder="you@example.com"
                    className={`input-field ${isRTL ? 'text-right' : ''}`}
                    autoComplete="email"
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  id="forgot-submit"
                  disabled={loading}
                  className="w-full btn-primary py-4 text-base mt-2 disabled:opacity-70"
                >
                  {loading ? (
                    <span className={`flex items-center justify-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {isRTL ? 'جاري الإرسال...' : 'Sending…'}
                    </span>
                  ) : (
                    isRTL ? 'إرسال رمز إعادة التعيين' : 'Send Reset Code'
                  )}
                </button>
              </form>

              <p className={`text-center text-sm text-gray-500 dark:text-dark-muted mt-6 ${isRTL ? 'text-right' : ''}`}>
                <Link to="/login" className={`text-brand-navy dark:text-brand-gold font-semibold hover:underline flex items-center justify-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  {isRTL ? '← العودة لتسجيل الدخول' : '← Back to Login'}
                </Link>
              </p>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
