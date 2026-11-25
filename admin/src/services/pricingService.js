import { apiRequest } from './apiClient';
import {
  normalizeLocation,
  normalizeMode,
  isAgreementDateValid,
  findMatchingRuleInList,
  buildClientPricingSnapshot,
  evaluatePricingFromCatalog
} from '../utils/pricingValidation';

export {
  normalizeLocation,
  normalizeMode,
  isAgreementDateValid,
  findMatchingRuleInList,
  buildClientPricingSnapshot,
  evaluatePricingFromCatalog
};

export const pricingService = {
  /**
   * Validate shipment pricing coverage against Company Quotations and Rate Cards.
   * Uses server POST /shipments/validate-pricing first, with seamless live-API catalog fallback.
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
      console.warn('[Pricing Service] Validate pricing endpoint fallback triggered:', err.message);

      // Resilient live-API lookup using /quotations, /companies, and /rate-cards
      try {
        const [quotations, companies, rateCards] = await Promise.all([
          apiRequest('/quotations'),
          apiRequest('/companies').catch(() => []),
          apiRequest('/rate-cards').catch(() => [])
        ]);

        return evaluatePricingFromCatalog({
          companies: Array.isArray(companies) ? companies : [],
          quotations: Array.isArray(quotations) ? quotations : [],
          rateCards: Array.isArray(rateCards) ? rateCards : [],
          companyId,
          companyCode,
          companyName,
          origin,
          destination,
          freightMode,
          mode,
          date
        });
      } catch (fallbackErr) {
        console.error('[Pricing Service] Live catalog validation fallback failed:', fallbackErr.message);
        return {
          status: 'ERROR',
          source: 'NONE',
          isCovered: false,
          message: `Unable to validate pricing coverage with server (${err.message}). Please check connectivity and retry.`
        };
      }
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
