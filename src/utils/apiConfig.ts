/**
 * Dynamic API Base URL Configurator
 * Automatically routes frontend HTTP requests to import.meta.env.VITE_API_URL
 * when deployed to a remote CDN (Vercel/Netlify), or falls back to relative
 * same-origin '/api' endpoints in standard containers and development environments.
 */

const RAW_API_URL = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_API_URL
  ? (import.meta as any).env.VITE_API_URL.trim().replace(/\/$/, '')
  : '';

export const getApiUrl = (endpoint: string): string => {
  const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${RAW_API_URL}${cleanPath}`;
};

export const API_BASE = RAW_API_URL;
