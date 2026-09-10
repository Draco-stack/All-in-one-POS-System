console.log("Entry point script starting...");
window.onerror = function(message, source, lineno, colno, error) {
  console.error("FATAL ERROR CAUGHT:", message, source, lineno, colno, error);
  const div = document.createElement('div');
  div.style.position = 'fixed';
  div.style.top = '0';
  div.style.left = '0';
  div.style.width = '100%';
  div.style.height = '100%';
  div.style.backgroundColor = 'red';
  div.style.color = 'white';
  div.style.padding = '20px';
  div.style.fontSize = '20px';
  div.style.zIndex = '9999';
  div.style.overflow = 'auto';
  div.innerText = `FATAL ERROR: ${message}\n\nSource: ${source}:${lineno}:${colno}\n\nError: ${error ? error.stack : 'No stack'}`;
  document.body.appendChild(div);
};

window.onunhandledrejection = function(event) {
  console.error("UNHANDLED REJECTION CAUGHT:", event.reason);
  const div = document.createElement('div');
  div.style.position = 'fixed';
  div.style.bottom = '0';
  div.style.left = '0';
  div.style.width = '100%';
  div.style.backgroundColor = 'orange';
  div.style.color = 'white';
  div.style.padding = '10px';
  div.style.fontSize = '14px';
  div.style.zIndex = '9999';
  div.innerText = `UNHANDLED PROMISE REJECTION: ${event.reason}`;
  document.body.appendChild(div);
};
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';

console.log("App initializing...");

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
