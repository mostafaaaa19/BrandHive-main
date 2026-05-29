import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function SettingsPanel() {
  const { isDark, toggleTheme } = useTheme();
  const { language, setLanguage, isRTL } = useLanguage();

  const [pwForm, setPwForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPw, setShowPw] = useState({ old: false, new: false, confirm: false });
  const [pwLoading, setPwLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!pwForm.oldPassword) {
      toast.error(isRTL ? 'يرجى إدخال كلمة المرور الحالية' : 'Please enter your current password');
      return;
    }
    if (pwForm.newPassword.length < 8) {
      toast.error(isRTL ? 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' : 'Password must be at least 8 characters');
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast.error(isRTL ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
      return;
    }
    setPwLoading(true);
    try {
      await authAPI.changePassword({
        oldPassword: pwForm.oldPassword,
        newPassword: pwForm.newPassword,
      });
      toast.success(isRTL ? 'تم تغيير كلمة المرور بنجاح ✅' : 'Password changed successfully ✅', {
        style: { borderRadius: '12px' },
      });
      setPwForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(
        err.response?.data?.message || (isRTL ? 'فشل تغيير كلمة المرور' : 'Failed to change password'),
        { style: { borderRadius: '12px' } }
      );
    } finally {
      setPwLoading(false);
    }
  };

  const PwInput = ({ field, label, placeholder }) => {
    const key = field === 'old' ? 'oldPassword' : field === 'new' ? 'newPassword' : 'confirmPassword';
    return (
      <div className={isRTL ? 'text-right' : ''}>
        <label className="input-label">{label}</label>
        <div className="relative">
          <input
            type={showPw[field] ? 'text' : 'password'}
            placeholder={placeholder}
            value={pwForm[key]}
            onChange={e => setPwForm(p => ({ ...p, [key]: e.target.value }))}
            className={`input-field dark:bg-dark-bg dark:border-dark-border dark:text-dark-text ${isRTL ? 'text-right pl-10 pr-3' : 'pr-10'}`}
          />
          <button
            type="button"
            onClick={() => setShowPw(p => ({ ...p, [field]: !p[field] }))}
            className={`absolute top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 ${isRTL ? 'left-3' : 'right-3'}`}
          >
            {showPw[field] ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>
    );
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
          {/* Toggle switch */}
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
        <h3 className={`font-display font-bold text-brand-navy dark:text-white text-lg mb-4 ${isRTL ? 'text-right' : ''}`}>
          {isRTL ? 'تغيير كلمة المرور' : 'Change Password'}
        </h3>
        <div className="space-y-4">
          <PwInput
            field="old"
            label={isRTL ? 'كلمة المرور الحالية' : 'Current Password'}
            placeholder={isRTL ? 'أدخل كلمة المرور الحالية' : 'Enter current password'}
          />
          <PwInput
            field="new"
            label={isRTL ? 'كلمة المرور الجديدة' : 'New Password'}
            placeholder={isRTL ? 'أدخل كلمة المرور الجديدة' : 'Enter new password'}
          />
          <PwInput
            field="confirm"
            label={isRTL ? 'تأكيد كلمة المرور' : 'Confirm Password'}
            placeholder={isRTL ? 'تأكيد كلمة المرور الجديدة' : 'Confirm new password'}
          />
          <button
            onClick={handleChangePassword}
            disabled={pwLoading || !pwForm.oldPassword || !pwForm.newPassword || !pwForm.confirmPassword}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pwLoading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {isRTL ? 'جاري الحفظ...' : 'Saving...'}
              </span>
            ) : (isRTL ? 'حفظ كلمة المرور' : 'Save Password')}
          </button>
        </div>
      </div>
    </div>
  );
}
