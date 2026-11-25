/**
 * Speed Setu Admin System - API Client Adapter
 * Strictly isolates development and production API endpoints.
 * Enforces runtime browser host boundaries to prevent localhost from ever calling production.
 */

function resolveBaseUrl() {
  const configuredUrl = import.meta.env.VITE_API_URL;
  const isLocalhost = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '0.0.0.0' ||
    window.location.hostname.endsWith('.local')
  );

  // CRITICAL HARDWARE/NETWORK BOUNDARY:
  // Any session accessed via localhost/127.0.0.1 MUST NEVER connect to production Render!
  if (isLocalhost) {
    // In dev mode, if explicitly misconfigured to point to prod, warn/block
    if (import.meta.env.DEV && configuredUrl && (configuredUrl.includes('onrender.com') || configuredUrl.includes('speed-setu-final.com'))) {
      const err = new Error(
        `🚨 [FATAL SECURITY VIOLATION]: Application running on localhost (${window.location.host}) cannot point to production URL "${configuredUrl}"!\n` +
        'Local browser sessions must connect exclusively to local development backend (http://localhost:5050/api).'
      );
      console.error(err);
      alert(err.message);
      throw err;
    }
    // Always route localhost to local development backend
    if (configuredUrl && !configuredUrl.includes('onrender.com') && !configuredUrl.includes('speed-setu-final.com')) {
      return configuredUrl;
    }
    return 'http://localhost:5050/api';
  }

  // If in development mode (Vite dev server)
  if (import.meta.env.DEV) {
    if (!configuredUrl) {
      throw new Error(
        '🚨 [FATAL CONFIG ERROR]: VITE_API_URL is missing in development environment!\n' +
        'Please define VITE_API_URL in admin/.env.development (e.g. VITE_API_URL=http://localhost:5050/api).'
      );
    }
    if (configuredUrl.includes('onrender.com') || configuredUrl.includes('speed-setu-final.com')) {
      throw new Error(
        `🚨 [FATAL SECURITY VIOLATION]: Development frontend cannot point to production URL "${configuredUrl}"!`
      );
    }
    return configuredUrl;
  }

  // Deployed Production Build (e.g., hosted on speedsetu.com or onrender.com)
  if (configuredUrl && !configuredUrl.includes('localhost') && !configuredUrl.includes('127.0.0.1')) {
    return configuredUrl;
  }
  return 'https://speed-setu-final.onrender.com/api';
}

export const BASE_URL = resolveBaseUrl();

// Token storage key
const TOKEN_KEY = 'speedsetu_admin_token';

export const getStoredToken = () => localStorage.getItem(TOKEN_KEY);
export const setStoredToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const removeStoredToken = () => localStorage.removeItem(TOKEN_KEY);

/**
 * Normalize API endpoint path to prevent duplicate /api prefixes and ensure leading slash
 */
function normalizeEndpoint(endpoint) {
  if (!endpoint) return '';
  let clean = String(endpoint).trim();
  // Strip duplicate /api if caller supplied it
  if (clean.startsWith('/api/')) {
    clean = clean.substring(4);
  } else if (clean === '/api') {
    clean = '';
  }
  if (!clean.startsWith('/')) {
    clean = `/${clean}`;
  }
  return clean;
}

// In-flight request tracker for collapsing concurrent identical GET/HEAD requests
const inFlightRequests = new Map();

/**
 * Generic API request wrapper for MongoDB Atlas REST Endpoints.
 * Includes in-flight deduplication for concurrent GET requests, clean error logging, and security boundaries.
 */
export async function apiRequest(endpoint, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const cleanEndpoint = normalizeEndpoint(endpoint);
  const targetUrl = `${BASE_URL}${cleanEndpoint}`;

  // In-flight deduplication for concurrent idempotent read requests
  const isDeduplicable = (method === 'GET' || method === 'HEAD') && !options.skipDedupe;
  const dedupeKey = isDeduplicable ? `${method}:${targetUrl}` : null;

  if (dedupeKey && inFlightRequests.has(dedupeKey)) {
    console.log(`⚡ [API Client Dedupe] Reusing in-flight request: ${method} ${targetUrl}`);
    return inFlightRequests.get(dedupeKey);
  }

  const executeRequest = async () => {
    const token = getStoredToken();
    const correlationId = `frontend_req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Correlation-Id': correlationId,
      'X-Request-Id': correlationId,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const config = {
      ...options,
      method,
      headers,
    };

    console.log(`📡 [API Client ${correlationId}] -> ${method} ${targetUrl}`);

    try {
      const response = await fetch(targetUrl, config);

      if (response.status === 401) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || 'Invalid credentials. Please check username/email and password.';
        
        if (cleanEndpoint === '/auth/login') {
          throw new Error(errorMessage);
        }

        removeStoredToken();
        window.location.href = '/admin/login';
        throw new Error('Unauthorized. Please log in again.');
      }

      if (response.status === 403) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.safetyGuardBlocked) {
          const errorMsg = `🚨 [DATABASE SAFETY GUARD BLOCKED]: ${errorData.message}`;
          console.error(errorMsg);
          alert(errorMsg);
          throw new Error(errorMsg);
        }
      }

      if (response.status === 503) {
        const errorData = await response.json().catch(() => ({}));
        window.dispatchEvent(new CustomEvent('db-connection-error', {
          detail: { message: errorData.message || 'MongoDB Atlas Connection Error' }
        }));
        throw new Error(errorData.message || 'Database Connection Error: Failed to connect to MongoDB Atlas Cloud');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.dbError) {
          window.dispatchEvent(new CustomEvent('db-connection-error', {
            detail: { message: errorData.message }
          }));
        }
        const errMessage = errorData.detail || errorData.message || errorData.error || `HTTP error ${response.status} on ${method} ${cleanEndpoint}`;
        console.error(`🚨 [API Error ${correlationId}] ${method} ${targetUrl} -> Status ${response.status}: ${errMessage}`);
        const err = new Error(errMessage);
        err.status = response.status;
        err.data = errorData;
        err.invoiceNumberError = errorData.invoiceNumberError;
        err.conflictingInvoice = errorData.conflictingInvoice;
        err.docketErrors = errorData.docketErrors;
        err.detail = errorData.detail;
        throw err;
      }

      window.dispatchEvent(new CustomEvent('db-connection-recovered'));
      return await response.json();
    } catch (error) {
      if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        if (error.name === 'TypeError' || error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          window.dispatchEvent(new CustomEvent('db-connection-error', {
            detail: { message: 'Local Development Server (http://localhost:5050) is offline. Please start server via "npm run dev".' }
          }));
        }
      }
      console.warn(`[API Client] Backend call failed for ${cleanEndpoint}:`, error.message);
      throw error;
    } finally {
      if (dedupeKey) {
        inFlightRequests.delete(dedupeKey);
      }
    }
  };

  const reqPromise = executeRequest();
  if (dedupeKey) {
    inFlightRequests.set(dedupeKey, reqPromise);
  }
  return reqPromise;
}

/**
 * Async delay helper for UI animations & network response timing
 */
export const simulateDelay = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));

