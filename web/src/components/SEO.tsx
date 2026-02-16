import { Helmet } from '@dr.pogodin/react-helmet';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { supportedLanguages, removeLanguagePrefix, getLanguageFromPath, defaultLanguage } from '../i18n';

interface SEOProps {
  titleKey?: string;
  descriptionKey?: string;
  noIndex?: boolean;
}

// Base URL for the site
const BASE_URL = 'https://www.kript.xyz';

// Get SEO keys based on route
const getSEOKeysForRoute = (pathname: string): { titleKey: string; descriptionKey: string } => {
  const cleanPath = removeLanguagePrefix(pathname);

  switch (cleanPath) {
    case '/':
      return { titleKey: 'seo.home.title', descriptionKey: 'seo.home.description' };
    case '/encrypt':
      return { titleKey: 'seo.encrypt.title', descriptionKey: 'seo.encrypt.description' };
    case '/decrypt':
      return { titleKey: 'seo.decrypt.title', descriptionKey: 'seo.decrypt.description' };
    case '/sign':
      return { titleKey: 'seo.sign.title', descriptionKey: 'seo.sign.description' };
    case '/verify':
      return { titleKey: 'seo.verify.title', descriptionKey: 'seo.verify.description' };
    case '/settings':
      return { titleKey: 'seo.settings.title', descriptionKey: 'seo.settings.description' };
    case '/info':
      return { titleKey: 'seo.info.title', descriptionKey: 'seo.info.description' };
    default:
      return { titleKey: 'seo.home.title', descriptionKey: 'seo.home.description' };
  }
};

export default function SEO({ titleKey, descriptionKey, noIndex = false }: SEOProps) {
  const { t, i18n } = useTranslation();
  const location = useLocation();

  // Get current language from path or i18n
  const currentLang = getLanguageFromPath(location.pathname) || i18n.language || defaultLanguage;

  // Get SEO keys for current route
  const routeSEO = getSEOKeysForRoute(location.pathname);

  // Use provided keys or route-based keys
  const title = t(titleKey || routeSEO.titleKey);
  const description = t(descriptionKey || routeSEO.descriptionKey);

  // Clean path without language prefix
  const cleanPath = removeLanguagePrefix(location.pathname);

  // Current URL
  const currentUrl = `${BASE_URL}/${currentLang}${cleanPath === '/' ? '' : cleanPath}`;

  // Canonical URL (uses current language)
  const canonicalUrl = currentUrl;

  // Generate hreflang URLs
  const hreflangUrls = supportedLanguages.map((lang) => ({
    lang,
    url: `${BASE_URL}/${lang}${cleanPath === '/' ? '' : cleanPath}`,
  }));

  // JSON-LD structured data
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Kript',
    description: t('seo.home.description'),
    url: BASE_URL,
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    author: {
      '@type': 'Person',
      name: 'Gabriele Fabietti',
      url: 'https://fabietti.xyz',
    },
    inLanguage: supportedLanguages.map((lang) => ({
      '@type': 'Language',
      name: lang === 'it' ? 'Italian' : 'English',
      alternateName: lang,
    })),
    featureList: [
      'PGP Key Generation',
      'Message Encryption',
      'Message Decryption',
      'Digital Signatures',
      'Signature Verification',
      'Local Processing',
      'No Server Communication',
    ],
  };

  return (
    <Helmet>
      {/* Basic meta tags */}
      <html lang={currentLang} />
      <title>{title}</title>
      <meta name="description" content={description} />

      {/* Canonical URL */}
      <link rel="canonical" href={canonicalUrl} />

      {/* hreflang tags for language targeting */}
      {hreflangUrls.map(({ lang, url }) => (
        <link key={lang} rel="alternate" hrefLang={lang === 'it' ? 'it-IT' : 'en'} href={url} />
      ))}
      <link rel="alternate" hrefLang="x-default" href={`${BASE_URL}/it${cleanPath === '/' ? '' : cleanPath}`} />

      {/* Open Graph tags */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Kript" />
      <meta property="og:locale" content={currentLang === 'it' ? 'it_IT' : 'en_US'} />
      <meta property="og:locale:alternate" content={currentLang === 'it' ? 'en_US' : 'it_IT'} />
      <meta property="og:image" content={`${BASE_URL}/og-image.png`} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content="Kript - PGP Encryption Tool" />

      {/* Twitter Card tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={`${BASE_URL}/og-image.png`} />

      {/* Additional SEO meta tags */}
      <meta name="author" content="Gabriele Fabietti" />
      <meta name="robots" content={noIndex ? 'noindex, nofollow' : 'index, follow'} />
      <meta name="googlebot" content={noIndex ? 'noindex, nofollow' : 'index, follow'} />

      {/* Structured data */}
      <script type="application/ld+json">
        {JSON.stringify(structuredData)}
      </script>
    </Helmet>
  );
}
