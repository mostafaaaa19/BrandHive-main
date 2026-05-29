import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Shield, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';
import OtpInput from '../components/OtpInput';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;

export default function VerifyResetPage() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const email = location.state?.email || '';

  // Redirect to /forgot-password if no email in state
  useEffect(() => {
    if (!email) navigate('/forgot-password', { replace: true });
  }, [email, navigate]);

  // ── State ──────────────────────────────────────────────────────────────────
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const [resendLoading, setResendLoading] = useState(false);

  // ── Countdown timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (otp.length < OTP_LENGTH) {
      setError(isRTL ? 'يرجى إدخال جميع الأرقام الستة.' : 'Please enter all 6 digits.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await authAPI.verifyResetCode({ email, otp });
      setSuccess(true);
      setTimeout(() => {
        toast.success(isRTL ? 'تم التحقق من الرمز! قم بتعيين كلمة المرور الجديدة.' : 'Code verified! Set your new password.', {
          duration: 4000,
          style: { borderRadius: '12px', fontFamily: isRTL ? 'Cairo' : 'Inter' },
        });
        navigate('/reset-password', { state: { email } });
      }, 1500);
    } catch (err) {
      const msg = isRTL 
        ? 'رمز غير صالح أو منتهي الصلاحية. يرجى المحاولة مرة أخرى.'
        : (err.response?.data?.message || err.message || 'Invalid or expired code. Please try again.');
      setError(msg);
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  // ── Resend ─────────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (countdown > 0 || resendLoading) return;
    setResendLoading(true);
    setError('');
    try {
      await authAPI.forgotPassword({ email });
      toast.success(isRTL ? 'تم إرسال رمز جديد إلى بريدك الإلكتروني.' : 'A new code has been sent to your email.', {
        icon: '📧',
        style: { borderRadius: '12px', fontFamily: isRTL ? 'Cairo' : 'Inter' },
      });
      setOtp('');
      setCountdown(RESEND_COOLDOWN);
    } catch (err) {
      const msg = isRTL 
        ? 'تعذر إعادة إرسال الرمز. يرجى المحاولة مرة أخرى.'
        : (err.response?.data?.message || 'Could not resend code. Please try again.');
      toast.error(msg, { style: { borderRadius: '12px', fontFamily: isRTL ? 'Cairo' : 'Inter' } });
    } finally {
      setResendLoading(false);
    }
  };

  // Guard
  if (!email) return null;

  return (
    <div className={`min-h-screen bg-brand-cream dark:bg-dark-bg flex transition-colors duration-200 ${isRTL ? 'flex-row-reverse' : ''}`}>

      {/* ── Left Panel ── */}
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
              <Shield size={44} className="text-brand-gold" />
            </div>
          </motion.div>

          <motion.h2
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className={`text-4xl font-display font-bold mb-4 ${isRTL ? 'leading-relaxed' : ''}`}
          >
            {isRTL ? (
              <>تحقق من بريدك.<br /><span className="text-gradient-gold">أدخل الرمز.</span></>
            ) : (
              <>Check your inbox.<br /><span className="text-gradient-gold">Enter the code.</span></>
            )}
          </motion.h2>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="text-gray-300 dark:text-gray-400 leading-relaxed"
          >
            {isRTL ? 'أدخل الرمز الذي أرسلناه للتحقق من هويتك.' : 'Enter the code we sent to verify your identity.'}
          </motion.p>
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

          {/* Success overlay */}
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
                  {isRTL ? 'تم التحقق من الرمز!' : 'Code Verified!'}
                </h2>
                <p className="text-gray-500 dark:text-dark-muted text-sm">
                  {isRTL ? 'جاري التحضير لتعيين كلمة المرور الجديدة...' : 'Setting up your new password…'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {!success && (
            <>
              <h1 className={`text-3xl font-display font-bold text-brand-navy dark:text-dark-text mb-2 ${isRTL ? 'text-right' : ''}`}>
                {isRTL ? 'أدخل رمز إعادة التعيين' : 'Enter Reset Code'}
              </h1>
              <p className={`text-gray-500 dark:text-dark-muted mb-8 text-sm leading-relaxed ${isRTL ? 'text-right' : ''}`}>
                {isRTL ? 'أدخل الرمز المكون من 6 أرقام المرسل إلى' : 'Enter the 6-digit code sent to'}{' '}
                <span className="font-semibold text-brand-navy dark:text-brand-gold" style={{ direction: 'ltr', display: 'inline-block' }}>{email}</span>
              </p>

              {/* Error banner */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    key="vr-error"
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

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* OTP boxes */}
                <div className={isRTL ? 'direction-ltr' : ''}>
                  <OtpInput
                    value={otp}
                    onChange={(val) => { setOtp(val); setError(''); }}
                    error={!!error}
                    disabled={loading}
                  />
                </div>

                {/* Verify button */}
                <button
                  type="submit"
                  id="verify-reset-submit"
                  disabled={loading || otp.length < OTP_LENGTH}
                  className="w-full btn-primary py-4 text-base disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className={`flex items-center justify-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {isRTL ? 'جاري التحقق...' : 'Verifying…'}
                    </span>
                  ) : (
                    isRTL ? 'التحقق من الرمز' : 'Verify Code'
                  )}
                </button>

                {/* Resend */}
                <div className={`text-center text-sm text-gray-500 dark:text-dark-muted ${isRTL ? 'text-right' : ''}`}>
                  {isRTL ? 'لم تستلم الرمز؟' : "Didn't receive a code?"}{' '}
                  {countdown > 0 ? (
                    <span className="text-brand-navy dark:text-brand-gold font-medium">
                      {isRTL ? `إعادة الإرسال خلال 0:${String(countdown).padStart(2, '0')}` : `Resend in 0:${String(countdown).padStart(2, '0')}`}
                    </span>
                  ) : (
                    <button
                      type="button"
                      id="verify-reset-resend"
                      onClick={handleResend}
                      disabled={resendLoading}
                      className={`text-brand-gold font-semibold hover:underline disabled:opacity-60 inline-flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}
                    >
                      {resendLoading && <RefreshCw size={13} className="animate-spin" />}
                      {isRTL ? 'إعادة إرسال الرمز' : 'Resend Code'}
                    </button>
                  )}
                </div>
              </form>

              <p className={`text-center text-sm text-gray-500 dark:text-dark-muted mt-6 ${isRTL ? 'text-right' : ''}`}>
                <Link to="/forgot-password" className={`text-brand-navy dark:text-brand-gold font-semibold hover:underline flex items-center justify-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  {isRTL ? '← عودة' : '← Back'}
                </Link>
              </p>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
