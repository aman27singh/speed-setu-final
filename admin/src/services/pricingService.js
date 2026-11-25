import { apiRequest } from './apiClient';

export const pricingService = {
  /**
   * Validate shipment pricing coverage against Company Quotations and Rate Cards
   */
  async validatePricing({ companyId, companyCode, companyName, origin, destination, freightMode, mode, date }) {
    try {
      const response = await apiRequest('/shipments/validate-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          companyCode,
          companyName,
          origin,
          destination,
          freightMode: freightMode || mode,
          mode: mode || freightMode,
          date
        })
      });
      return response;
    } catch (err) {
      console.warn('[Pricing Service] Validate pricing remote fallback:', err.message);
      return {
        status: 'MISSING',
        source: 'NONE',
        message: 'Could not validate pricing with server: ' + err.message
      };
    }
  },

  /**
   * Update or assign pricing coverage on a shipment
   */
  async assignPricing(idOrCN, { action = 'revalidate', quotationId, rateCardId, reason, modifiedBy = 'Admin' } = {}) {
    return apiRequest(`/shipments/${encodeURIComponent(idOrCN)}/pricing`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        quotationId,
        rateCardId,
        reason,
        modifiedBy
      })
    });
  },

  /**
   * Fetch active rate cards
   */
  async getRateCards({ search = '', status = 'Active' } = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (status && status !== 'All') queryParams.append('status', status);

      const response = await apiRequest(`/rate-cards?${queryParams.toString()}`);
      return Array.isArray(response) ? response : [];
    } catch (err) {
      console.warn('[Pricing Service] Fetch rate cards error:', err.message);
      return [];
    }
  }
};
