import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import KeysPage from './pages/KeysPage';
import EncryptPage from './pages/EncryptPage';
import DecryptPage from './pages/DecryptPage';
import SignPage from './pages/SignPage';
import VerifyPage from './pages/VerifyPage';
import SettingsPage from './pages/SettingsPage';
import InfoPage from './pages/InfoPage';
import SEO from './components/SEO';
import LanguageSwitcher from './components/LanguageSwitcher';
import { getLanguageFromPath, defaultLanguage, supportedLanguages, SupportedLanguage } from './i18n';

// Navigation items with translation keys
const navItems = [
  { path: '', labelKey: 'nav.keys' },
  { path: '/encrypt', labelKey: 'nav.encrypt' },
  { path: '/decrypt', labelKey: 'nav.decrypt' },
  { path: '/sign', labelKey: 'nav.sign' },
  { path: '/verify', labelKey: 'nav.verify' },
  { path: '/settings', labelKey: 'nav.settings' },
];

// Component that handles language detection and routing
function LanguageHandler() {
  const location = useLocation();
  const { i18n } = useTranslation();

  // Get language from URL path
  const langFromPath = getLanguageFromPath(location.pathname);

  useEffect(() => {
    // If we have a valid language in the path, sync i18n with it
    if (langFromPath && langFromPath !== i18n.language) {
      i18n.changeLanguage(langFromPath);
    }
  }, [langFromPath, i18n]);

  // If no language in path, redirect to default language
  if (!langFromPath) {
    // Preserve the current path
    const currentPath = location.pathname === '/' ? '' : location.pathname;
    return <Navigate to={`/${defaultLanguage}${currentPath}`} replace />;
  }

  // If language is not supported, redirect to default
  if (!supportedLanguages.includes(langFromPath as SupportedLanguage)) {
    return <Navigate to={`/${defaultLanguage}`} replace />;
  }

  return null;
}

function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t, i18n } = useTranslation();
  const location = useLocation();

  // Get current language from URL for building nav links
  const currentLang = getLanguageFromPath(location.pathname) || i18n.language || defaultLanguage;

  // Build full path with language prefix
  const buildPath = (path: string) => `/${currentLang}${path}`;

  // Check if a nav item is active
  const isNavActive = (path: string) => {
    const fullPath = buildPath(path);
    if (path === '') {
      // Home route - exact match
      return location.pathname === `/${currentLang}` || location.pathname === `/${currentLang}/`;
    }
    return location.pathname.startsWith(fullPath);
  };

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      {/* SEO - Dynamic per route */}
      <SEO />

      {/* Language Handler */}
      <LanguageHandler />

      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-[80rem] mx-auto px-lg py-lg">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <NavLink to={buildPath('')} className="flex items-center gap-sm">
              <svg
                className="w-6 h-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="square"
                strokeLinejoin="miter"
              >
                <rect x="3" y="11" width="18" height="11" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span className="text-lg font-semibold tracking-tight">KRIPT</span>
            </NavLink>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-lg">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={buildPath(item.path)}
                  className={() =>
                    `text-sm tracking-wide transition-all duration-150 ${
                      isNavActive(item.path)
                        ? 'text-text-primary font-semibold'
                        : 'text-text-secondary hover:text-text-primary'
                    }`
                  }
                >
                  {t(item.labelKey)}
                </NavLink>
              ))}

              {/* Language Switcher - Desktop */}
              <LanguageSwitcher />
            </nav>

            {/* Mobile menu button */}
            <button
              className="md:hidden min-w-[44px] min-h-[44px] p-md border border-border hover:border-border-hover active:bg-bg-secondary transition-all duration-150 flex items-center justify-center"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={t('common.toggleMenu')}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {mobileMenuOpen ? (
                  <path
                    strokeLinecap="square"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="square"
                    strokeWidth="2"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <nav className="md:hidden mt-md pt-md border-t border-border">
              <div className="flex flex-col gap-xs">
                {navItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={buildPath(item.path)}
                    onClick={() => setMobileMenuOpen(false)}
                    className={() =>
                      `text-sm tracking-wide py-md min-h-[44px] flex items-center transition-all duration-150 active:bg-bg-secondary ${
                        isNavActive(item.path)
                          ? 'text-text-primary font-semibold'
                          : 'text-text-secondary hover:text-text-primary'
                      }`
                    }
                  >
                    {t(item.labelKey)}
                  </NavLink>
                ))}

                {/* Language Switcher - Mobile */}
                <div className="py-md border-t border-border mt-sm pt-md">
                  <LanguageSwitcher />
                </div>
              </div>
            </nav>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[80rem] mx-auto px-md md:px-lg py-xl md:py-2xl w-full">
        <Routes>
          {/* Routes with language prefix */}
          <Route path="/:lang" element={<KeysPage />} />
          <Route path="/:lang/encrypt" element={<EncryptPage />} />
          <Route path="/:lang/decrypt" element={<DecryptPage />} />
          <Route path="/:lang/sign" element={<SignPage />} />
          <Route path="/:lang/verify" element={<VerifyPage />} />
          <Route path="/:lang/settings" element={<SettingsPage />} />
          <Route path="/:lang/info" element={<InfoPage />} />

          {/* Fallback redirect */}
          <Route path="*" element={<Navigate to={`/${defaultLanguage}`} replace />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-auto">
        <div className="max-w-[80rem] mx-auto px-lg py-lg">
          <div className="flex flex-col gap-sm text-sm text-text-secondary">
            <div className="flex flex-col md:flex-row justify-between items-center gap-md">
              <div>{t('footer.tagline')}</div>
              <div className="flex items-center gap-lg">
                <a
                  href="https://github.com/gabrielee5/kript"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-text-primary transition-all duration-150"
                >
                  {t('footer.github')}
                </a>
                <NavLink
                  to={buildPath('/info')}
                  className="hover:text-text-primary transition-all duration-150"
                >
                  {t('footer.info')}
                </NavLink>
              </div>
            </div>
            <div className="text-center">
              {t('footer.createdBy')} -{' '}
              <a
                href="https://fabietti.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-text-primary transition-all duration-150"
              >
                fabietti.xyz
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
