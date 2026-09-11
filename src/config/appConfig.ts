/**
 * Central Application Configuration
 * All public app names, URLs, endpoints, and contact channels are defined here
 * and can be overridden using environment variables (e.g. on Railway or Vercel).
 */

export interface AppConfig {
  appName: string;
  appUrl: string;
  supportEmail: string;
  supportPhone: string;
  apiUrl: string;
  currencySymbol: string;
  currencyCode: string;
}

const getEnv = (key: string, fallback: string): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  return fallback;
};

export const appConfig: AppConfig = {
  appName: getEnv('VITE_APP_NAME', 'Tillora'),
  appUrl: getEnv('VITE_APP_URL', typeof window !== 'undefined' ? window.location.origin : 'https://tillora.com'),
  supportEmail: getEnv('VITE_SUPPORT_EMAIL', 'support@tillora.com'),
  supportPhone: getEnv('VITE_SUPPORT_PHONE', '+1 (800) 555-TILL (8455)'),
  apiUrl: getEnv('VITE_API_URL', ''),
  currencySymbol: getEnv('VITE_CURRENCY_SYMBOL', '$'),
  currencyCode: getEnv('VITE_CURRENCY_CODE', 'USD'),
};
