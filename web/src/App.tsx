import { Routes, Route, NavLink } from 'react-router-dom';
import { useState } from 'react';
import KeysPage from './pages/KeysPage';
import EncryptPage from './pages/EncryptPage';
import DecryptPage from './pages/DecryptPage';
import SignPage from './pages/SignPage';
import VerifyPage from './pages/VerifyPage';
import SettingsPage from './pages/SettingsPage';
import InfoPage from './pages/InfoPage';

const navItems = [
  { path: '/', label: 'KEYS' },
  { path: '/encrypt', label: 'ENCRYPT' },
  { path: '/decrypt', label: 'DECRYPT' },
  { path: '/sign', label: 'SIGN' },
  { path: '/verify', label: 'VERIFY' },
  { path: '/settings', label: 'SETTINGS' },
];

function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-[80rem] mx-auto px-lg py-lg">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-sm">
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
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-lg">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `text-sm tracking-wide transition-all duration-150 ${
                      isActive
                        ? 'text-text-primary font-semibold'
                        : 'text-text-secondary hover:text-text-primary'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            {/* Mobile menu button - larger touch target (44px min) */}
            <button
              className="md:hidden min-w-[44px] min-h-[44px] p-md border border-border hover:border-border-hover active:bg-bg-secondary transition-all duration-150 flex items-center justify-center"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
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

          {/* Mobile Navigation - larger touch targets and better spacing */}
          {mobileMenuOpen && (
            <nav className="md:hidden mt-md pt-md border-t border-border">
              <div className="flex flex-col gap-xs">
                {navItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `text-sm tracking-wide py-md min-h-[44px] flex items-center transition-all duration-150 active:bg-bg-secondary ${
                        isActive
                          ? 'text-text-primary font-semibold'
                          : 'text-text-secondary hover:text-text-primary'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </nav>
          )}
        </div>
      </header>

      {/* Main Content - increased padding on mobile */}
      <main className="flex-1 max-w-[80rem] mx-auto px-md md:px-lg py-xl md:py-2xl w-full">
        <Routes>
          <Route path="/" element={<KeysPage />} />
          <Route path="/encrypt" element={<EncryptPage />} />
          <Route path="/decrypt" element={<DecryptPage />} />
          <Route path="/sign" element={<SignPage />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/info" element={<InfoPage />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-auto">
        <div className="max-w-[80rem] mx-auto px-lg py-lg">
          <div className="flex flex-col gap-sm text-sm text-text-secondary">
            <div className="flex flex-col md:flex-row justify-between items-center gap-md">
              <div>Kript v1.0.0 - All operations run locally in your browser</div>
              <div className="flex items-center gap-lg">
                <a
                  href="https://github.com/gabrielee5/kript"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-text-primary transition-all duration-150"
                >
                  GitHub
                </a>
                <NavLink
                  to="/info"
                  className="hover:text-text-primary transition-all duration-150"
                >
                  Info
                </NavLink>
              </div>
            </div>
            <div className="text-center">
              Created by Gabriele Fabietti -{' '}
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
