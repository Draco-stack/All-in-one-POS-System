import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';

// Dynamic API Routing fetch interceptor
try {
  if (typeof window !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_API_URL) {
    const originalFetch = window.fetch;
    const apiBaseUrl = (import.meta as any).env.VITE_API_URL.trim().replace(/\/$/, '');
    
    // Safely redefine window.fetch without direct assignment that can trigger readonly property errors
    Object.defineProperty(window, 'fetch', {
      value: function (input: any, init: any) {
        if (typeof input === 'string' && input.startsWith('/api/')) {
          return originalFetch(`${apiBaseUrl}${input}`, init);
        }
        return originalFetch(input, init);
      },
      writable: true,
      configurable: true,
      enumerable: true
    });
  }
} catch (error) {
  console.warn('[Network] Dynamic fetch interceptor could not be mounted due to environment safety/sandboxing constraint. Falling back to relative API calls.', error);
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary fallbackTitle="Please restart the terminal">
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
