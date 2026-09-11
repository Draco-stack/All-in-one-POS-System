import { registerSW } from 'virtual:pwa-register';

// Automatically register and update service worker for POS asset caching and offline resilience
export function initPWA() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      // In sandboxed iframe environments (such as AI Studio preview), service workers are restricted by browser policy
      if (window.self !== window.top) {
        return;
      }
    } catch {
      // Accessing window.top across origins can throw SecurityError; in that case, skip SW registration
      return;
    }

    try {
      registerSW({
        onNeedRefresh() {
          console.log('[PWA] New content available.');
        },
        onOfflineReady() {
          console.log('[PWA] Service worker ready for offline caching.');
        },
        onRegisterError(error) {
          console.warn('[PWA] Service worker registration error:', error);
        },
      });
    } catch (err) {
      console.warn('[PWA] Failed to initialize service worker:', err);
    }
  }
}
