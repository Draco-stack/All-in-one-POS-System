import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';

// Dynamic API Routing fetch interceptor
if (typeof window !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_API_URL) {
  const originalFetch = window.fetch;
  const apiBaseUrl = (import.meta as any).env.VITE_API_URL.trim().replace(/\/$/, '');
  window.fetch = function (input, init) {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      return originalFetch(`${apiBaseUrl}${input}`, init);
    }
    return originalFetch(input, init);
  };
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
