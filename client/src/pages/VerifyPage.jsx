import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';
import OtpInput from '../components/OtpInput';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;

export default function VerifyPage() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  // ── Resolve email ──────────────────────────────────────────────────────────
  const emailFromState = location.state?.email;
  const emailFromStorage = (() => {
    try {
      const stored = localStorage.getItem('brandhive_user');
      return stored ? JSON.parse(stored)?.email : null;
    } catch {
      return null;
    }
  })();
  const email = emailFromState || emailFromStorage;

  // If no email at all, send to register
  useEffect(() => {
    if (!email) navigate('/register', { replace: true });
  }, [email, navigate]);

  // ── State ──────────────────────────────────────────────────────────────────
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const [resendLoading, setResendLoading] = useState(false);

  const firstBoxRef = useRef(null);

  // ── Auto-focus first box ───────────────────────────────────────────────────
  useEffect(() => {
    firstBoxRef.current?.focus();
  }, []);

  // ── Countdown timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  // ── OTP change handler ────────────────────────────────────────────────────
  const handleOtpChange = (val) => {
    setOtpError('');
    setOtp(val);
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (otp.length < OTP_LENGTH) {
      setOtpError(isRTL ? 'يرجى إدخال جميع الأرقام الستة.' : 'Please enter all 6 digits.');
      return;
    }

    setLoading(true);
    setOtpError('');
    try {
      const res = await authAPI.verifyAccount({ email, otp });
      if (res.data?.success === false) {
        throw new Error(res.data.message || 'Verification failed.');
      }
      setSuccess(true);
      setTimeout(() => {
        toast.success(isRTL ? 'تم تفعيل الحساب! يرجى تسجيل الدخول. ✅' : 'Account verified! Please log in. ✅', {
          duration: 4000,
          style: { borderRadius: '12px', fontFamily: isRTL ? 'Cairo' : 'Inter' },
        });
        navigate('/login', { replace: true });
      }, 1500);
    } catch (err) {
      const msg = isRTL 
        ? 'رمز غير صالح أو منتهي الصلاحية. يرجى المحاولة مرة أخرى.'
        : (err.response?.data?.message || err.message || 'Invalid or expired code. Please try again.');
      setOtpError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Resend ─────────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (countdown > 0 || resendLoading) return;
    setResendLoading(true);
    setOtpError('');
    try {
      await authAPI.resendOtp({ email });
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

  // ── Guard: no email ────────────────────────────────────────────────────────
  if (!email) return null;

  const maskedEmail = email
    ? email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(Math.max(b.length, 3)) + c)
    : '';

  // ── Render ─────────────────────────────────────────────────────────────────
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
            className="text-7xl mb-6 inline-block"
          >
            📧
          </motion.div>

          <motion.h2
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className={`text-4xl font-display font-bold mb-4 ${isRTL ? 'leading-relaxed' : ''}`}
          >
            {isRTL ? (
              <>خطوة واحدة أخيرة!<br /><span className="text-gradient-gold">تحقق من بريدك.</span></>
            ) : (
              <>One last step!<br /><span className="text-gradient-gold">Check your inbox.</span></>
            )}
          </motion.h2>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="text-gray-300 dark:text-gray-400 leading-relaxed mb-8"
          >
            {isRTL ? 'لقد أرسلنا رمز تفعيل مكوناً من 6 أرقام إلى بريدك الإلكتروني. أدخله على اليمين لتفعيل حساب براند هايف الخاص بك.' : 'We sent a 6-digit verification code to your email address. Enter it on the right to activate your BrandHive account.'}
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
                  {isRTL ? 'تم تفعيل الحساب!' : 'Account Verified!'}
                </h2>
                <p className="text-gray-500 dark:text-dark-muted text-sm">
                  {isRTL ? 'جاري تحويلك لتسجيل الدخول...' : 'Redirecting you to login…'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {!success && (
            <>
              <h1 className={`text-3xl font-display font-bold text-brand-navy dark:text-dark-text mb-2 ${isRTL ? 'text-right' : ''}`}>
                {isRTL ? 'تفعيل حسابك' : 'Verify Your Account'}
              </h1>
              <p className={`text-gray-500 dark:text-dark-muted mb-8 text-sm leading-relaxed ${isRTL ? 'text-right' : ''}`}>
                {isRTL ? 'أدخل الرمز المكون من 6 أرقام المرسل إلى' : 'Enter the 6-digit code sent to'}{' '}
                <span className="font-semibold text-brand-navy dark:text-brand-gold" style={{ direction: 'ltr', display: 'inline-block' }}>{maskedEmail}</span>
              </p>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* OTP boxes */}
                <div className={isRTL ? 'direction-ltr' : ''}>
                  <OtpInput
                    value={otp}
                    onChange={handleOtpChange}
                    error={!!otpError}
                    disabled={loading}
                  />

                  {/* Error message */}
                  <AnimatePresence>
                    {otpError && (
                      <motion.div
                        key="otp-error"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className={`flex items-start gap-2 mt-3 text-sm text-red-600 dark:text-red-400 ${isRTL ? 'flex-row-reverse text-right' : ''}`}
                      >
                        <AlertCircle size={15} className="mt-0.5 shrink-0" />
                        <span>{otpError}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Verify button */}
                <button
                  type="submit"
                  id="verify-submit"
                  disabled={loading || otp.length < OTP_LENGTH}
                  className="w-full btn-primary py-4 text-base disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className={`flex items-center justify-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {isRTL ? 'جاري التحقق...' : 'Verifying…'}
                    </span>
                  ) : (
                    isRTL ? 'تفعيل الحساب' : 'Verify Account'
                  )}
                </button>

                {/* Resend */}
                <div className={`text-center text-sm text-gray-500 dark:text-dark-muted ${isRTL ? 'text-right' : ''}`}>
                  {isRTL ? 'لم تستلم الرمز؟' : "Didn't receive a code?"}{' '}
                  {countdown > 0 ? (
                    <span className="text-brand-navy dark:text-brand-gold font-medium">
                      {isRTL ? `إعادة الإرسال خلال 0:${String(countdown).padStart(2, '0')}` : `Resend code in 0:${String(countdown).padStart(2, '0')}`}
                    </span>
                  ) : (
                    <button
                      type="button"
                      id="verify-resend"
                      onClick={handleResend}
                      disabled={resendLoading}
                      className={`text-brand-gold font-semibold hover:underline disabled:opacity-60 inline-flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}
                    >
                      {resendLoading && (
                        <RefreshCw size={13} className="animate-spin" />
                      )}
                      {isRTL ? 'إعادة إرسال الرمز' : 'Resend Code'}
                    </button>
                  )}
                </div>
              </form>

              <p className={`text-center text-sm text-gray-500 dark:text-dark-muted mt-8 ${isRTL ? 'text-right' : ''}`}>
                {isRTL ? 'بريد خاطئ؟' : 'Wrong email?'}{' '}
                <Link to="/register" className="text-brand-navy dark:text-brand-gold font-semibold hover:underline">
                  {isRTL ? 'العودة لإنشاء حساب' : 'Go back to Register'}
                </Link>
              </p>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
