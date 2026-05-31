import { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import OtpInput from './OtpInput';
import toast from 'react-hot-toast';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;

export default function SettingsPanel() {
  const { isDark, toggleTheme } = useTheme();
  const { language, setLanguage, isRTL } = useLanguage();
  const { user } = useAuth();

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pwStep, setPwStep] = useState('idle'); // idle | sent | verified
  const [pwLoading, setPwLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user?.email]);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  const handleSendCode = async () => {
    if (!email) return;
    setPwLoading(true);
    try {
      await authAPI.forgotPassword({ email });
      setPwStep('sent');
      setOtp('');
      setCountdown(RESEND_COOLDOWN);
      toast.success(
        isRTL ? 'تم إرسال رمز التحقق إلى بريدك' : 'Verification code sent to your email',
        { style: { borderRadius: '12px' } }
      );
    } catch (err) {
      toast.error(
        err.response?.data?.message || (isRTL ? 'فشل إرسال الرمز' : 'Failed to send code'),
        { style: { borderRadius: '12px' } }
      );
    } finally {
      setPwLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (otp.length < OTP_LENGTH) {
      toast.error(isRTL ? 'يرجى إدخال الرمز المكون من 6 أرقام' : 'Please enter the 6-digit code');
      return;
    }
    setPwLoading(true);
    try {
      await authAPI.verifyResetCode({ email, otp });
      setPwStep('verified');
      toast.success(
        isRTL ? 'تم التحقق! يمكنك الآن تعيين كلمة مرور جديدة' : 'Verified! You can set a new password',
        { style: { borderRadius: '12px' } }
      );
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          (isRTL ? 'رمز غير صالح أو منتهي' : 'Invalid or expired code'),
        { style: { borderRadius: '12px' } }
      );
      setOtp('');
    } finally {
      setPwLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (pwStep !== 'verified') {
      toast.error(
        isRTL ? 'يرجى التحقق من الرمز أولاً' : 'Verify reset code first',
        { style: { borderRadius: '12px' } }
      );
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      toast.error(isRTL ? 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' : 'Password must be at least 8 characters');
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      toast.error(
        isRTL
          ? 'كلمة المرور يجب أن تحتوي على حرف كبير وصغير ورقم'
          : 'Password must contain uppercase, lowercase, and number'
      );
      return;
    }
    setPwLoading(true);
    try {
      await authAPI.resetPassword({ email, newPassword });
      toast.success(isRTL ? 'تم تغيير كلمة المرور بنجاح ✅' : 'Password changed successfully ✅', {
        style: { borderRadius: '12px' },
      });
      setNewPassword('');
      setOtp('');
      setPwStep('idle');
    } catch (err) {
      toast.error(
        err.response?.data?.message || (isRTL ? 'فشل تغيير كلمة المرور' : 'Failed to change password'),
        { style: { borderRadius: '12px' } }
      );
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Appearance */}
      <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6">
        <h3 className={`font-display font-bold text-brand-navy dark:text-white text-lg mb-4 ${isRTL ? 'text-right' : ''}`}>
          {isRTL ? 'المظهر' : 'Appearance'}
        </h3>
        <div className={`flex items-center justify-between p-4 bg-brand-cream dark:bg-dark-bg rounded-xl ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className={isRTL ? 'text-right' : ''}>
            <p className="font-medium text-gray-900 dark:text-dark-text text-sm">
              {isRTL ? 'الوضع الداكن' : 'Dark Mode'}
            </p>
            <p className="text-xs text-gray-500 dark:text-dark-muted mt-0.5">
              {isDark ? (isRTL ? 'مفعّل' : 'Enabled') : (isRTL ? 'معطّل' : 'Disabled')}
            </p>
          </div>
          <button
            onClick={toggleTheme}
            className={`relative flex-shrink-0 w-12 h-6 
              rounded-full transition-colors duration-300
              ${isDark ? 'bg-brand-gold' : 'bg-gray-300'}`}
            aria-label="Toggle dark mode"
          >
            <span className={`absolute top-0.5 left-0.5
              w-5 h-5 bg-white rounded-full shadow-md 
              transition-transform duration-300
              ${isDark ? 'translate-x-6' : 'translate-x-0'}`}
            />
          </button>
        </div>
      </div>

      {/* Language */}
      <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6">
        <h3 className={`font-display font-bold text-brand-navy dark:text-white text-lg mb-4 ${isRTL ? 'text-right' : ''}`}>
          {isRTL ? 'اللغة' : 'Language'}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              code: 'en',
              label: 'English',
              sublabel: 'English',
              flag: (
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                  EN
                </div>
              ),
            },
            {
              code: 'ar',
              label: 'العربية',
              sublabel: 'Arabic',
              flag: (
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                  ع
                </div>
              ),
            },
          ].map(lang => (
            <button
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                language === lang.code
                  ? 'border-brand-gold bg-brand-gold/5 dark:bg-brand-gold/10'
                  : 'border-gray-200 dark:border-dark-border hover:border-brand-gold/50'
              } ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              {lang.flag}
              <div className={isRTL ? 'text-right' : 'text-left'}>
                <p className="font-semibold text-sm text-gray-900 dark:text-dark-text">
                  {lang.label}
                </p>
                <p className="text-xs text-gray-400 dark:text-dark-muted">
                  {lang.sublabel}
                </p>
                {language === lang.code && (
                  <p className="text-xs text-brand-gold font-medium">
                    {isRTL ? '✓ محدد' : '✓ Selected'}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-card dark:shadow-none dark:border dark:border-dark-border p-6">
        <h3 className={`font-display font-bold text-brand-navy dark:text-white text-lg mb-2 ${isRTL ? 'text-right' : ''}`}>
          {isRTL ? 'تغيير كلمة المرور' : 'Change Password'}
        </h3>
        <p className={`text-xs text-gray-500 dark:text-dark-muted mb-4 ${isRTL ? 'text-right' : ''}`}>
          {isRTL
            ? 'سنرسل رمز تحقق إلى بريدك، ثم يمكنك تعيين كلمة مرور جديدة.'
            : 'We will send a verification code to your email, then you can set a new password.'}
        </p>

        <div className="space-y-4">
          {pwStep === 'idle' && (
            <button
              onClick={handleSendCode}
              disabled={pwLoading || !email}
              className="btn-outline w-full text-sm disabled:opacity-50"
            >
              {pwLoading
                ? (isRTL ? 'جاري الإرسال...' : 'Sending...')
                : (isRTL ? 'إرسال رمز التحقق' : 'Send Verification Code')}
            </button>
          )}

          {(pwStep === 'sent' || pwStep === 'verified') && (
            <>
              <div className={isRTL ? 'text-right direction-ltr' : ''}>
                <label className={`input-label block mb-2 ${isRTL ? 'text-right direction-rtl' : ''}`}>
                  {isRTL ? 'رمز التحقق' : 'Verification Code'}
                </label>
                <OtpInput
                  value={otp}
                  onChange={setOtp}
                  disabled={pwLoading || pwStep === 'verified'}
                />
              </div>

              {pwStep === 'sent' && (
                <div className={`flex gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <button
                    onClick={handleVerifyCode}
                    disabled={pwLoading || otp.length < OTP_LENGTH}
                    className="flex-1 btn-primary text-sm disabled:opacity-50"
                  >
                    {pwLoading
                      ? (isRTL ? 'جاري التحقق...' : 'Verifying...')
                      : (isRTL ? 'تحقق من الرمز' : 'Verify Code')}
                  </button>
                  <button
                    onClick={handleSendCode}
                    disabled={pwLoading || countdown > 0}
                    className="flex-1 btn-outline text-sm disabled:opacity-50"
                  >
                    {countdown > 0
                      ? (isRTL ? `إعادة (${countdown}s)` : `Resend (${countdown}s)`)
                      : (isRTL ? 'إعادة الإرسال' : 'Resend Code')}
                  </button>
                </div>
              )}

              {pwStep === 'verified' && (
                <p className={`text-xs text-emerald-600 dark:text-emerald-400 font-medium ${isRTL ? 'text-right' : ''}`}>
                  {isRTL ? '✓ تم التحقق من الرمز' : '✓ Code verified'}
                </p>
              )}
            </>
          )}

          {pwStep === 'verified' && (
            <div className={isRTL ? 'text-right' : ''}>
              <label className="input-label">
                {isRTL ? 'كلمة المرور الجديدة' : 'New Password'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder={isRTL ? 'كلمة المرور الجديدة' : 'New password'}
                  className={`input-field dark:bg-dark-bg dark:border-dark-border dark:text-dark-text ${isRTL ? 'text-right pl-10 pr-3' : 'pr-10'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className={`absolute top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 ${isRTL ? 'left-3' : 'right-3'}`}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          {pwStep === 'verified' && (
            <button
              onClick={handleChangePassword}
              disabled={pwLoading || !newPassword}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pwLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {isRTL ? 'جاري الحفظ...' : 'Saving...'}
                </span>
              ) : (isRTL ? 'حفظ كلمة المرور' : 'Save Password')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
