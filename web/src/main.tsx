import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import './index.css';

// Initialize i18n before rendering
import './i18n';

// Loading fallback for Suspense
const LoadingFallback = () => (
  <div className="min-h-screen bg-bg-primary flex items-center justify-center">
    <div className="text-text-secondary">Loading...</div>
  </div>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
          <App />
        </Suspense>
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
);
