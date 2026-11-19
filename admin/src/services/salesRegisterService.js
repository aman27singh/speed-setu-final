import { BASE_URL, getStoredToken } from './apiClient';

/**
 * Service to interact with the Sales Register Backend API (/api/reports/sales-register).
 */
export const salesRegisterService = {
  /**
   * Fetches JSON preview of the GST Sales Register.
   */
  async getSalesRegister(params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        qs.set(key, String(val));
      }
    });

    const token = getStoredToken();
    const correlationId = `sr_preview_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const response = await fetch(`${BASE_URL}/reports/sales-register?${qs.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Correlation-Id': correlationId,
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errorMsg = errData.error || errData.message || `Failed to fetch sales register (HTTP ${response.status})`;
      const err = new Error(errorMsg);
      err.status = response.status;
      throw err;
    }

    return await response.json();
  },

  /**
   * Downloads Sales Register as Excel (.xlsx) or CSV (.csv) using authenticated blob download.
   */
  async downloadSalesRegister(params = {}, format = 'xlsx') {
    const qs = new URLSearchParams();
    Object.entries({ ...params, format }).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        qs.set(key, String(val));
      }
    });

    const token = getStoredToken();
    const correlationId = `sr_export_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const response = await fetch(`${BASE_URL}/reports/sales-register/export?${qs.toString()}`, {
      method: 'GET',
      headers: {
        'X-Correlation-Id': correlationId,
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errorMsg = errData.error || errData.message || `Download failed (HTTP ${response.status})`;
      const err = new Error(errorMsg);
      err.status = response.status;
      throw err;
    }

    // Extract filename from Content-Disposition header
    const disposition = response.headers.get('Content-Disposition') || '';
    const match = /filename="?([^"]+)"?/.exec(disposition);
    const filename = match ? match[1] : `Sales_Register.${format}`;

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }
};
