import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

// Supported languages
export const supportedLanguages = ['it', 'en'] as const;
export type SupportedLanguage = typeof supportedLanguages[number];

// Default language is Italian
export const defaultLanguage: SupportedLanguage = 'it';

// Language names for display
export const languageNames: Record<SupportedLanguage, string> = {
  it: 'Italiano',
  en: 'English',
};

// Extract language from URL path (e.g., /it/encrypt -> 'it')
export const getLanguageFromPath = (pathname: string): SupportedLanguage | null => {
  const match = pathname.match(/^\/(it|en)(\/|$)/);
  return match ? (match[1] as SupportedLanguage) : null;
};

// Remove language prefix from path
export const removeLanguagePrefix = (pathname: string): string => {
  return pathname.replace(/^\/(it|en)(\/|$)/, '/').replace(/\/+/g, '/') || '/';
};

// Add language prefix to path
export const addLanguagePrefix = (pathname: string, lang: SupportedLanguage): string => {
  const cleanPath = removeLanguagePrefix(pathname);
  return `/${lang}${cleanPath === '/' ? '' : cleanPath}`;
};

// Initialize i18next
i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // Default language is Italian
    fallbackLng: defaultLanguage,
    supportedLngs: [...supportedLanguages],

    // Load translations from public folder
    backend: {
      loadPath: '/locales/{{lng}}/translation.json',
    },

    // Language detection options
    detection: {
      // Order of detection methods
      order: ['path', 'localStorage', 'navigator'],

      // Cache the detected language
      caches: ['localStorage'],

      // Look for language in URL path
      lookupFromPathIndex: 0,

      // Key for localStorage
      lookupLocalStorage: 'kript-language',
    },

    // Interpolation options
    interpolation: {
      escapeValue: false, // React already escapes values
    },

    // Don't load resources synchronously
    react: {
      useSuspense: true,
    },

    // Debug mode (disable in production)
    debug: false,
  });

export default i18n;
