import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Key, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';

// ── Password strength helper ───────────────────────────────────────────────────
function getPasswordStrength(pw, isRTL) {
  if (!pw) return null;
  if (pw.length < 8) return { 
    level: 'weak', 
    label: isRTL ? 'ضعيفة' : 'Weak', 
    color: 'bg-red-400', 
    textColor: 'text-red-500', 
    width: '33%',
    tip: isRTL ? ' — استخدم 8 أحرف أو أكثر' : ' — use 8+ characters'
  };
  const hasUpper = /[A-Z]/.test(pw);
  const hasNum = /[0-9]/.test(pw);
  if (hasUpper && hasNum) return { 
    level: 'strong', 
    label: isRTL ? 'قوية' : 'Strong', 
    color: 'bg-green-500', 
    textColor: 'text-green-600', 
    width: '100%',
    tip: ''
  };
  return { 
    level: 'medium', 
    label: isRTL ? 'متوسطة' : 'Medium', 
    color: 'bg-yellow-400', 
    textColor: 'text-yellow-600', 
    width: '66%',
    tip: isRTL ? ' — أضف حروفاً كبيرة وأرقاماً' : ' — add uppercase & a number'
  };
}

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const email = location.state?.email || '';

  // If no email in state, redirect back to forgot-password
  useEffect(() => {
    if (!email) navigate('/forgot-password', { replace: true });
  }, [email, navigate]);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const strength = getPasswordStrength(newPassword, isRTL);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Frontend validation
    if (newPassword.length < 8) {
      setError(isRTL ? 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.' : 'Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(isRTL ? 'كلمات المرور غير متطابقة.' : 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await authAPI.resetPassword({ email, newPassword });
      setSuccess(true);
      setTimeout(() => {
        toast.success(isRTL ? 'تم إعادة تعيين كلمة المرور بنجاح! يرجى تسجيل الدخول. ✅' : 'Password reset successfully! Please log in. ✅', {
          duration: 4000,
          style: { borderRadius: '12px', fontFamily: isRTL ? 'Cairo' : 'Inter' },
        });
        navigate('/login', { replace: true });
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

  if (!email) return null;

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
              <Key size={44} className="text-brand-gold" />
            </div>
          </motion.div>

          <motion.h2
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className={`text-4xl font-display font-bold mb-4 ${isRTL ? 'leading-relaxed' : ''}`}
          >
            {isRTL ? (
              <>أوشكت على الانتهاء.<br /><span className="text-gradient-gold">كلمة مرور جديدة.</span></>
            ) : (
              <>Almost there.<br /><span className="text-gradient-gold">New password.</span></>
            )}
          </motion.h2>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="text-gray-300 dark:text-gray-400 leading-relaxed"
          >
            {isRTL ? 'اختر كلمة مرور قوية وجديدة لحساب براند هايف الخاص بك.' : 'Choose a strong new password for your BrandHive account.'}
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
                  {isRTL ? 'تمت إعادة التعيين!' : 'Password Reset!'}
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
                {isRTL ? 'تعيين كلمة مرور جديدة' : 'Set New Password'}
              </h1>
              <p className={`text-gray-500 dark:text-dark-muted mb-8 text-sm leading-relaxed ${isRTL ? 'text-right' : ''}`}>
                {isRTL ? 'اختر كلمة مرور قوية لحسابك' : 'Choose a strong password for your account'}
              </p>

              {/* Error banner */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    key="rp-error"
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

              <form onSubmit={handleSubmit} className="space-y-5">

                {/* New Password */}
                <div className={isRTL ? 'text-right' : ''}>
                  <label className="input-label dark:text-dark-text">
                    {isRTL ? 'كلمة المرور الجديدة' : 'New Password'}
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPw ? 'text' : 'password'}
                      id="reset-new-password"
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                      placeholder={isRTL ? '8 أحرف على الأقل' : 'At least 8 characters'}
                      className={`input-field ${isRTL ? 'pr-4 pl-11 text-right' : 'pr-11'}`}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw(!showNewPw)}
                      className={`absolute top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-dark-muted dark:hover:text-dark-text ${isRTL ? 'left-3' : 'right-3'}`}
                    >
                      {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {/* Password strength indicator */}
                  {newPassword && strength && (
                    <div className="mt-2">
                      <div className="h-1.5 bg-gray-200 dark:bg-dark-border rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${strength.color}`}
                          initial={{ width: 0 }}
                          animate={{ width: strength.width }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                      <p className={`text-xs mt-1 font-medium ${strength.textColor}`}>
                        {isRTL ? 'كلمة مرور ' : ''}{strength.label}{isRTL ? '' : ' password'}
                        {strength.tip}
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div className={isRTL ? 'text-right' : ''}>
                  <label className="input-label dark:text-dark-text">
                    {isRTL ? 'تأكيد كلمة المرور' : 'Confirm Password'}
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPw ? 'text' : 'password'}
                      id="reset-confirm-password"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                      placeholder={isRTL ? 'كرر كلمة المرور' : 'Repeat your password'}
                      className={`input-field ${isRTL ? 'pr-4 pl-11 text-right' : 'pr-11'} ${confirmPassword && newPassword !== confirmPassword ? 'border-red-300 dark:border-red-900/50 focus:border-red-400' : ''}`}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPw(!showConfirmPw)}
                      className={`absolute top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-dark-muted dark:hover:text-dark-text ${isRTL ? 'left-3' : 'right-3'}`}
                    >
                      {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-red-500 mt-1">
                      {isRTL ? 'كلمات المرور غير متطابقة' : "Passwords don't match"}
                    </p>
                  )}
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  id="reset-submit"
                  disabled={loading}
                  className="w-full btn-primary py-4 text-base disabled:opacity-70"
                >
                  {loading ? (
                    <span className={`flex items-center justify-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {isRTL ? 'جاري التعيين...' : 'Resetting…'}
                    </span>
                  ) : (
                    isRTL ? 'إعادة تعيين كلمة المرور' : 'Reset Password'
                  )}
                </button>
              </form>

              <p className={`text-center text-sm text-gray-500 dark:text-dark-muted mt-6 ${isRTL ? 'text-right' : ''}`}>
                <Link to="/verify-reset" className={`text-brand-navy dark:text-brand-gold font-semibold hover:underline flex items-center justify-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
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
