import { apiRequest, simulateDelay } from './apiClient';

let quotationsStore = [];

export const quotationService = {
  async getQuotations({ search = '', companyId = 'All', status = 'All', mode = 'All' } = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (status && status !== 'All') queryParams.append('status', status);
      if (companyId && companyId !== 'All') queryParams.append('companyId', companyId);

      const remoteData = await apiRequest(`/quotations?${queryParams.toString()}`);
      if (Array.isArray(remoteData)) {
        quotationsStore = remoteData.map((q) => ({
          ...q,
          id: q.id || q.quotationNumber || q._id
        }));

        return quotationsStore.filter((q) => {
          if (
            companyId !== 'All' &&
            q.companyId !== companyId &&
            q.companyCode !== companyId &&
            (q.companyName || '').toLowerCase() !== companyId.toLowerCase()
          ) return false;
          if (status !== 'All' && q.status?.toLowerCase() !== status.toLowerCase()) return false;
          return true;
        });
      }
    } catch (err) {
      console.warn('[MongoDB Client] Quotations list fetch fallback:', err.message);
    }

    await simulateDelay(150);

    return quotationsStore.filter((q) => {
      if (
        companyId !== 'All' &&
        q.companyId !== companyId &&
        q.companyCode !== companyId &&
        (q.companyName || '').toLowerCase() !== companyId.toLowerCase()
      ) return false;
      if (status !== 'All' && q.status?.toLowerCase() !== status.toLowerCase()) return false;
      if (search.trim()) {
        const query = search.toLowerCase().trim();
        const numMatch = (q.quotationNumber || '').toLowerCase().includes(query);
        const compNameMatch = (q.companyName || '').toLowerCase().includes(query);
        return numMatch || compNameMatch;
      }
      return true;
    });
  },

  async getCompanyRateCards(companyId) {
    if (!companyId) return [];
    return this.getQuotations({ companyId });
  },

  async getQuotation(id) {
    if (!id || id === 'undefined') {
      throw new Error('Invalid Quotation identifier.');
    }

    try {
      const response = await apiRequest(`/quotations/${encodeURIComponent(id)}`);
      if (response && (response.quotationNumber || response._id)) {
        return {
          ...response,
          id: response.id || response.quotationNumber || response._id
        };
      }
    } catch (err) {
      console.warn('[MongoDB Client] Single quotation fetch fallback:', err.message);
    }

    await simulateDelay(120);
    const target = id.toLowerCase();
    const found = quotationsStore.find(
      (q) =>
        (q.id && q.id.toLowerCase() === target) ||
        (q.quotationNumber && q.quotationNumber.toLowerCase() === target)
    );

    if (!found) {
      throw new Error(`Quotation '${id}' not found.`);
    }
    return { ...found };
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
        const formatted = {
          ...response,
          id: response._id || response.id || response.quotationNumber
        };
        quotationsStore = [formatted, ...quotationsStore];
        return formatted;
      }
    } catch (err) {
      console.warn('[MongoDB Client] Create quotation fallback:', err.message);
    }

    await simulateDelay(250);
    const nextIdNumber = quotationsStore.length + 1;
    const quotationNumber = quotationData.quotationNumber && quotationData.quotationNumber !== 'Auto-generated on Save'
      ? quotationData.quotationNumber
      : `QT-2026-${String(nextIdNumber).padStart(3, '0')}`;
    const version = quotationData.version || 1;
    const id = quotationNumber;

    const newQuotation = {
      ...quotationData,
      id,
      quotationNumber,
      version,
      status: quotationData.status || 'Active',
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0]
    };
    delete newQuotation._id;

    quotationsStore = [newQuotation, ...quotationsStore];
    return { ...newQuotation };
  },

  async createQuotationVersion(id, data) {
    const existing = await this.getQuotation(id);
    const newVersion = (existing.version || 1) + 1;

    const baseNumber = (existing.quotationNumber || id).replace(/-v\d+$/, '');
    const newQuotationNumber = `${baseNumber}-v${newVersion}`;

    const newQuotationData = {
      ...existing,
      ...data,
      quotationNumber: newQuotationNumber,
      version: newVersion,
      status: 'Active',
      updatedAt: new Date().toISOString().split('T')[0]
    };
    delete newQuotationData._id;
    delete newQuotationData.id;

    return this.createQuotation(newQuotationData);
  },

  async duplicateQuotation(id) {
    const existing = await this.getQuotation(id);
    const duplicatedData = {
      ...existing,
      quotationNumber: undefined,
      status: 'Draft',
      createdAt: new Date().toISOString().split('T')[0]
    };
    return this.createQuotation(duplicatedData);
  },

  async updateQuotation(id, updateData) {
    try {
      const response = await apiRequest(`/quotations/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      if (response && (response.quotationNumber || response._id)) {
        const formatted = {
          ...response,
          id: response.id || response.quotationNumber || response._id
        };
        const index = quotationsStore.findIndex((q) => q.quotationNumber === formatted.quotationNumber);
        if (index !== -1) quotationsStore[index] = formatted;
        else quotationsStore.unshift(formatted);
        return formatted;
      }
    } catch (err) {
      console.warn('[MongoDB Client] Update quotation fallback:', err.message);
    }

    await simulateDelay(200);
    const target = id.toLowerCase();
    const index = quotationsStore.findIndex(
      (q) => (q.id && q.id.toLowerCase() === target) || (q.quotationNumber && q.quotationNumber.toLowerCase() === target)
    );

    if (index === -1) {
      throw new Error(`Quotation '${id}' not found for update.`);
    }

    const updatedQuotation = {
      ...quotationsStore[index],
      ...updateData,
      updatedAt: new Date().toISOString().split('T')[0]
    };

    quotationsStore[index] = updatedQuotation;
    return { ...updatedQuotation };
  },

  async deactivateQuotation(id) {
    return this.updateQuotation(id, { status: 'Inactive' });
  }
};
