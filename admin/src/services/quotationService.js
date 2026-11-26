import { apiRequest } from './apiClient';

let quotationsStore = [];

/**
 * Format quotation document to ensure consistent identifiers across all views.
 * Canonical `id` is always the quotationNumber (e.g. 'QT-2026-003') with `_id` also preserved.
 */
function formatQuotation(q) {
  if (!q) return null;
  const canonicalId = q.quotationNumber || q._id || q.id;
  return {
    ...q,
    id: canonicalId,
    _id: q._id || q.id,
    quotationNumber: q.quotationNumber || canonicalId
  };
}

export const quotationService = {
  async getQuotations({ search = '', companyId = 'All', companyMongoId = '', companyCode = '', companyName = '', status = 'All', mode = 'All' } = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (search && search.trim()) queryParams.append('search', search.trim());
      if (status && status !== 'All') queryParams.append('status', status);
      if (companyId && companyId !== 'All' && companyId !== 'undefined' && companyId !== 'null') {
        queryParams.append('companyId', String(companyId).trim());
      }
      if (companyCode && companyCode !== 'All' && companyCode !== 'undefined' && companyCode !== 'null') {
        queryParams.append('companyCode', String(companyCode).trim());
      }
      if (companyName && companyName !== 'All' && companyName !== 'undefined' && companyName !== 'null') {
        queryParams.append('companyName', String(companyName).trim());
      }

      const remoteData = await apiRequest(`/quotations?${queryParams.toString()}`);
      if (Array.isArray(remoteData)) {
        quotationsStore = remoteData.map(formatQuotation);

        const hasCompanyScope = companyId && companyId !== 'All';
        const candidates = [companyId, companyMongoId, companyCode, companyName]
          .filter((v) => v && v !== 'All')
          .map((v) => String(v).trim().toLowerCase());

        return quotationsStore.filter((q) => {
          if (hasCompanyScope && candidates.length > 0) {
            if (q.isRateCard === true) return false;
            const qCompId = String(q.companyId || '').trim().toUpperCase();
            const qCompCode = String(q.companyCode || '').trim().toUpperCase();
            if (!qCompId || qCompId === 'ALL' || qCompCode === 'ALL') return false;

            const qFields = [q.companyId, q.companyCode, q.companyName]
              .filter(Boolean)
              .map((v) => String(v).trim().toLowerCase());
            if (!qFields.some((f) => candidates.includes(f))) return false;
          }
          if (status !== 'All' && String(q.status || '').trim().toLowerCase() !== status.trim().toLowerCase()) return false;
          return true;
        });
      }
      return [];
    } catch (err) {
      console.error('[Quotation Service] Quotations list fetch error:', err.message);
      throw err;
    }
  },

  async getCompanyActiveQuotations({ companyId, companyMongoId = '', companyCode = '', companyName = '' } = {}) {
    if (!companyId || companyId === 'All' || companyId === 'undefined' || companyId === 'null') {
      return [];
    }
    return this.getQuotations({
      companyId: String(companyId).trim(),
      companyMongoId: companyMongoId ? String(companyMongoId).trim() : '',
      companyCode: companyCode ? String(companyCode).trim() : '',
      companyName: companyName ? String(companyName).trim() : '',
      status: 'Active'
    });
  },

  async getCompanyRateCards(companyId) {
    if (!companyId || companyId === 'undefined' || companyId === 'null' || !String(companyId).trim()) {
      return [];
    }
    return this.getQuotations({ companyId: String(companyId).trim() });
  },

  async getQuotation(id) {
    if (!id || id === 'undefined' || id === 'null' || !String(id).trim()) {
      throw new Error('Valid quotation identifier is required.');
    }

    const cleanId = String(id).trim();

    try {
      const response = await apiRequest(`/quotations/${encodeURIComponent(cleanId)}`);
      if (response && (response.quotationNumber || response._id)) {
        const formatted = formatQuotation(response);
        const idx = quotationsStore.findIndex(
          (q) => q.quotationNumber === formatted.quotationNumber || q._id === formatted._id
        );
        if (idx !== -1) quotationsStore[idx] = formatted;
        else quotationsStore.unshift(formatted);
        return formatted;
      }
      throw new Error(`Quotation '${cleanId}' record was invalid or empty.`);
    } catch (err) {
      console.error(`[Quotation Service] Failed to retrieve quotation '${cleanId}':`, err.message);
      throw err;
    }
  },

  async createQuotation(quotationData) {
    const payload = { ...quotationData };
    delete payload._id;
    delete payload.id;
    if (payload.quotationNumber === 'Auto-generated on Save') {
      delete payload.quotationNumber;
    }

    try {
      const response = await apiRequest('/quotations', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (response && (response.quotationNumber || response._id)) {
        const formatted = formatQuotation(response);
        quotationsStore = [formatted, ...quotationsStore];
        return formatted;
      }
      throw new Error('Server response did not include a valid quotation record.');
    } catch (err) {
      console.error('[Quotation Service] Create quotation failed:', err.message);
      throw err;
    }
  },

  async createQuotationVersion(id, data) {
    if (!id || id === 'undefined' || id === 'null' || !String(id).trim()) {
      throw new Error('Valid quotation identifier is required to create a new version.');
    }

    const cleanId = String(id).trim();
    const payload = { ...data };
    delete payload._id;
    delete payload.id;

    try {
      const response = await apiRequest(`/quotations/${encodeURIComponent(cleanId)}/version`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (response && (response.quotationNumber || response._id)) {
        const formatted = formatQuotation(response);
        const index = quotationsStore.findIndex((q) => q.quotationNumber === formatted.quotationNumber);
        if (index !== -1) quotationsStore[index] = formatted;
        else quotationsStore.unshift(formatted);
        return formatted;
      }
      throw new Error('Server response did not include an updated quotation version record.');
    } catch (err) {
      console.error(`[Quotation Service] Create quotation version failed for '${cleanId}':`, err.message);
      throw err;
    }
  },

  async duplicateQuotation(id) {
    const existing = await this.getQuotation(id);
    const duplicatedData = {
      ...existing,
      quotationNumber: undefined,
      version: 1,
      status: 'Draft',
      createdAt: new Date().toISOString().split('T')[0]
    };
    delete duplicatedData._id;
    delete duplicatedData.id;
    return this.createQuotation(duplicatedData);
  },

  async updateQuotation(id, updateData) {
    if (!id || id === 'undefined' || id === 'null' || !String(id).trim()) {
      throw new Error('Valid quotation identifier is required to update quotation.');
    }

    const cleanId = String(id).trim();

    try {
      const response = await apiRequest(`/quotations/${encodeURIComponent(cleanId)}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      if (response && (response.quotationNumber || response._id)) {
        const formatted = formatQuotation(response);
        const index = quotationsStore.findIndex((q) => q.quotationNumber === formatted.quotationNumber);
        if (index !== -1) quotationsStore[index] = formatted;
        else quotationsStore.unshift(formatted);
        return formatted;
      }
      throw new Error('Server response did not include an updated quotation record.');
    } catch (err) {
      console.error(`[Quotation Service] Update quotation failed for '${cleanId}':`, err.message);
      throw err;
    }
  },

  async deactivateQuotation(id) {
    return this.updateQuotation(id, { status: 'Inactive' });
  }
};
