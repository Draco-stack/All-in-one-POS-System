import { registerSW } from 'virtual:pwa-register';

// Automatically register and update service worker for POS asset caching and offline resilience
export function initPWA() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    const updateSW = registerSW({
      onNeedRefresh() {
        console.log('[PWA] New content available, updating service worker...');
        updateSW(true);
      },
      onOfflineReady() {
        console.log('[PWA] Service worker ready for offline caching.');
      },
      onRegisterError(error) {
        console.warn('[PWA] Service worker registration error:', error);
      },
    });
  }
}
