/**
 * Speed Setu Admin System - API Client Adapter
 * Configured for Express + MongoDB Atlas Cloud Backend.
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5050/api';

// Token storage key
const TOKEN_KEY = 'speedsetu_admin_token';

export const getStoredToken = () => localStorage.getItem(TOKEN_KEY);
export const setStoredToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const removeStoredToken = () => localStorage.removeItem(TOKEN_KEY);

/**
 * Generic API request wrapper for MongoDB Atlas REST Endpoints
 */
export async function apiRequest(endpoint, options = {}) {
  const token = getStoredToken();

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, config);

    if (response.status === 401) {
      removeStoredToken();
      window.location.href = '/admin/login';
      throw new Error('Unauthorized. Please log in again.');
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
        window.dispatchEvent(new CustomEvent('db-connection-error', { detail: { message: errorData.message } }));
      }
      throw new Error(errorData.detail || errorData.message || `HTTP error ${response.status}`);
    }

    // Dispatch connection recovered event on successful response
    window.dispatchEvent(new CustomEvent('db-connection-recovered'));
    return await response.json();
  } catch (error) {
    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    if (isLocal && (error.name === 'TypeError' || error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
      window.dispatchEvent(new CustomEvent('db-connection-error', {
        detail: { message: 'Backend Server or MongoDB Atlas is unreachable. Please check connection.' }
      }));
    }
    console.warn(`[API Client] Backend call failed for ${endpoint}:`, error.message);
    throw error;
  }
}

/**
 * Async delay helper for UI animations & network response timing
 */
export const simulateDelay = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));
