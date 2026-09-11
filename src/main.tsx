import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initPWA } from './pwa';

const rootElement = document.getElementById('root');

if (rootElement) {
  // Initialize Progressive Web App (PWA) registration safely
  initPWA();

  try {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <ErrorBoundary fallbackTitle="Please restart the terminal">
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );
  } catch (error) {
    console.error("React render failed:", error);
  }
} else {
  console.error("Root element not found in DOM");
}
