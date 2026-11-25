import { apiRequest } from './apiClient';
import { compareCompanyCodes } from '../utils/formatters';

/**
 * Speed Setu - Centralized Consignor & Consignee Master API Client
 * Centralized service for managing companies used interchangeably as shippers (consignors) and receivers (consignees).
 * 
 * CORE BUSINESS RULE:
 * One company = One master record = One company code.
 */

export const consignorConsigneeService = {
  /**
   * Fetch paginated or filtered list of companies
   */
  async getParties({
    search = '',
    city = 'All',
    state = 'All',
    status = 'All',
    isActive,
    page = 1,
    limit = 50,
    all = false,
    autocomplete = false
  } = {}) {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (city && city !== 'All') params.append('city', city);
    if (state && state !== 'All') params.append('state', state);
    if (status && status !== 'All') params.append('status', status);
    if (isActive !== undefined) params.append('isActive', String(isActive));
    if (page) params.append('page', String(page));
    if (limit) params.append('limit', String(limit));
    if (all) params.append('all', 'true');
    if (autocomplete) params.append('autocomplete', 'true');

    const res = await apiRequest(`/consignor-consignee?${params.toString()}`);
    if (Array.isArray(res)) {
      return [...res].sort((a, b) => compareCompanyCodes(a.companyCode, b.companyCode));
    }
    if (res && Array.isArray(res.items)) {
      return {
        ...res,
        items: [...res.items].sort((a, b) => compareCompanyCodes(a.companyCode, b.companyCode))
      };
    }
    return res;
  },

  /**
   * Fetch all active parties for autocomplete in shipment creation
   */
  async getActiveParties() {
    const params = new URLSearchParams();
    params.append('isActive', 'true');
    params.append('autocomplete', 'true');

    const res = await apiRequest(`/consignor-consignee?${params.toString()}`);
    return Array.isArray(res) ? res : (res?.items || []);
  },

  /**
   * Quick live search endpoint for autocomplete
   */
  async searchParties(query = '') {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    const res = await apiRequest(`/consignor-consignee/search?${params.toString()}`);
    return Array.isArray(res) ? res : (res?.items || []);
  },

  /**
   * Get single party by ID or code
   */
  async getParty(id) {
    if (!id) throw new Error('Party ID is required');
    return apiRequest(`/consignor-consignee/${encodeURIComponent(id)}`);
  },

  /**
   * Get summary stats (total, active, inactive)
   */
  async getStats() {
    return apiRequest('/consignor-consignee/stats');
  },

  /**
   * Preview next company code (e.g. COM-001)
   */
  async getNextCode() {
    return apiRequest('/consignor-consignee/next-code');
  },

  /**
   * Create new company
   */
  async createParty(partyData) {
    return apiRequest('/consignor-consignee', {
      method: 'POST',
      body: JSON.stringify(partyData)
    });
  },

  /**
   * Update existing company
   */
  async updateParty(id, partyData) {
    if (!id) throw new Error('Party ID is required for update');
    return apiRequest(`/consignor-consignee/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(partyData)
    });
  },

  /**
   * Toggle company active status
   */
  async togglePartyStatus(id, isActive) {
    if (!id) throw new Error('Party ID is required');
    return apiRequest(`/consignor-consignee/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive })
    });
  },

  /**
   * Delete company
   */
  async deleteParty(id) {
    if (!id) throw new Error('Party ID is required');
    return apiRequest(`/consignor-consignee/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  }
};
