import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { supportedLanguages, languageNames, removeLanguagePrefix, getLanguageFromPath, SupportedLanguage, defaultLanguage } from '../i18n';

interface LanguageSwitcherProps {
  className?: string;
}

export default function LanguageSwitcher({ className = '' }: LanguageSwitcherProps) {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  // Get current language from URL path or i18n
  const currentLang = getLanguageFromPath(location.pathname) || i18n.language || defaultLanguage;

  const handleLanguageChange = (newLang: SupportedLanguage) => {
    if (newLang === currentLang) return;

    // Get clean path without language prefix
    const cleanPath = removeLanguagePrefix(location.pathname);

    // Change i18n language
    i18n.changeLanguage(newLang);

    // Navigate to new language path
    const newPath = `/${newLang}${cleanPath === '/' ? '' : cleanPath}`;
    navigate(newPath, { replace: true });
  };

  return (
    <div className={`flex items-center gap-xs ${className}`}>
      {supportedLanguages.map((lang, index) => (
        <span key={lang} className="flex items-center">
          {index > 0 && <span className="text-text-tertiary mx-xs">|</span>}
          <button
            onClick={() => handleLanguageChange(lang)}
            className={`text-sm uppercase tracking-wide transition-all duration-150 ${
              currentLang === lang
                ? 'text-text-primary font-semibold'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            aria-label={`Switch to ${languageNames[lang]}`}
            aria-current={currentLang === lang ? 'true' : undefined}
          >
            {lang}
          </button>
        </span>
      ))}
    </div>
  );
}
