import { createContext, useContext, useState, useCallback } from 'react';
import i18n from '../i18n/index.js';

const LanguageContext = createContext(null);

const applyLang = (lang) => {
  try {
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
    if (lang === 'ar') {
      document.documentElement.classList.add('rtl');
    } else {
      document.documentElement.classList.remove('rtl');
    }
    localStorage.setItem('brandhive_lang', lang);
    i18n.changeLanguage(lang);
  } catch {}
};

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    try {
      return localStorage.getItem('brandhive_lang') || 'en';
    } catch { return 'en'; }
  });

  const setLanguage = useCallback((lang) => {
    applyLang(lang);
    setLanguageState(lang);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'en' ? 'ar' : 'en');
  }, [language, setLanguage]);

  return (
    <LanguageContext.Provider value={{
      language,
      isRTL: language === 'ar',
      toggleLanguage,
      setLanguage,
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
