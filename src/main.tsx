import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initPWA } from './pwa';

console.log("App initializing...");
initPWA();

const rootElement = document.getElementById('root');
console.log("Root element found:", !!rootElement);

if (rootElement) {
  try {
    console.log("Rendering React root...");
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <ErrorBoundary fallbackTitle="Please restart the terminal">
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );
    console.log("React root rendered.");
  } catch (error) {
    console.error("React render failed:", error);
  }
} else {
  console.error("Root element not found in DOM");
}
