import { apiRequest, simulateDelay } from './apiClient';
import { shipmentService } from './shipmentService';
import { billingService } from './billingService';

let companiesStore = [];

export const companyService = {
  /**
   * Fetch companies list directly from MongoDB Atlas Cloud REST API
   */
  async getCompanies({ search = '', status = 'All', state = 'All', paymentTerms = 'All' } = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (status && status !== 'All') queryParams.append('status', status);

      const remoteData = await apiRequest(`/companies?${queryParams.toString()}`);
      if (Array.isArray(remoteData)) {
        let liveShipments = [];
        let liveInvoices = [];
        try {
          liveShipments = await shipmentService.getShipments();
          liveInvoices = await billingService.getInvoices();
        } catch (e) {
          // ignore error
        }

        companiesStore = remoteData.map((c) => {
          const compId = c.id || c.companyId || c.companyCode || c._id;
          const cNameLower = (c.companyName || '').toLowerCase().trim();
          const cCodeLower = (c.companyCode || c.companyId || '').toLowerCase().trim();

          const compShipments = liveShipments.filter((s) => {
            const sCompId = (s.companyId || s.companyCode || '').toLowerCase().trim();
            const sCompName = (s.companyName || '').toLowerCase().trim();
            return (sCompId && (sCompId === cCodeLower || sCompId === compId.toLowerCase())) ||
                   (sCompName && cNameLower && (sCompName.includes(cNameLower) || cNameLower.includes(sCompName)));
          });

          const compInvoices = liveInvoices.filter((inv) => {
            const invCompId = (inv.companyId || inv.companyCode || '').toLowerCase().trim();
            const invCompName = (inv.companyName || '').toLowerCase().trim();
            return (invCompId && (invCompId === cCodeLower || invCompId === compId.toLowerCase())) ||
                   (invCompName && cNameLower && (invCompName.includes(cNameLower) || cNameLower.includes(invCompName)));
          });

          const validInvoices = compInvoices.filter((i) => (i.status || '').toLowerCase() !== 'cancelled');

          const outstandingAmount = validInvoices.reduce(
            (acc, inv) => acc + (typeof inv.balanceAmount === 'number' ? inv.balanceAmount : (inv.balanceDue ?? inv.grandTotal ?? 0)),
            0
          );
          const totalBilling = validInvoices.reduce((acc, inv) => acc + (inv.grandTotal || inv.subTotal || 0), 0);
          const paidAmount = validInvoices.reduce((acc, inv) => acc + (inv.paidAmount || 0), 0);

          const updatedKPIs = {
            totalShipments: compShipments.length,
            activeShipments: compShipments.filter((s) => s.status !== 'Delivered' && s.status !== 'Cancelled').length,
            outstandingAmount,
            outstanding: outstandingAmount,
            totalBilling,
            paidAmount,
            activeQuotations: c.kpis?.activeQuotations || 0,
            lastShipmentDate: compShipments[0]?.bookingDate || c.kpis?.lastShipmentDate || '-'
          };

          return {
            ...c,
            id: compId,
            kpis: updatedKPIs,
            totalShipments: compShipments.length,
            outstandingAmount,
            outstanding: outstandingAmount
          };
        });

        return companiesStore.filter((c) => {
          if (status !== 'All' && c.status?.toLowerCase() !== status.toLowerCase()) return false;
          if (state !== 'All' && c.billing?.state?.toLowerCase() !== state.toLowerCase()) return false;
          if (paymentTerms !== 'All' && c.billing?.paymentTerms !== paymentTerms) return false;
          return true;
        });
      }
    } catch (err) {
      console.warn('[MongoDB Client] Companies list fetch fallback:', err.message);
    }

    await simulateDelay(150);

    return companiesStore.filter((c) => {
      if (status !== 'All' && c.status?.toLowerCase() !== status.toLowerCase()) return false;
      if (state !== 'All' && c.billing?.state?.toLowerCase() !== state.toLowerCase()) return false;
      if (paymentTerms !== 'All' && c.billing?.paymentTerms !== paymentTerms) return false;

      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const nameMatch = c.companyName?.toLowerCase().includes(q);
        const codeMatch = c.companyCode?.toLowerCase().includes(q);
        const gstinMatch = c.gstin?.toLowerCase().includes(q);
        const contactMatch = c.primaryContact?.name?.toLowerCase().includes(q);
        const phoneMatch = c.primaryContact?.phone?.toLowerCase().includes(q);
        const emailMatch = c.primaryContact?.email?.toLowerCase().includes(q);

        return nameMatch || codeMatch || gstinMatch || contactMatch || phoneMatch || emailMatch;
      }

      return true;
    });
  },

  /**
   * Fetch single company detail by ID or Company Code
   */
  async getCompany(idOrCode) {
    if (!idOrCode || idOrCode === 'undefined') {
      throw new Error('Invalid Company identifier.');
    }

    try {
      const response = await apiRequest(`/companies/${encodeURIComponent(idOrCode)}`);
      if (response && (response.companyName || response._id)) {
        return {
          ...response,
          id: response.id || response.companyId || response.companyCode || response._id
        };
      }
    } catch (err) {
      console.warn('[MongoDB Client] Single company fetch fallback:', err.message);
    }

    await simulateDelay(120);
    const target = idOrCode.toLowerCase();
    const found = companiesStore.find(
      (c) =>
        (c.id && c.id.toLowerCase() === target) ||
        (c.companyCode && c.companyCode.toLowerCase() === target) ||
        (c.companyId && c.companyId.toLowerCase() === target) ||
        (c._id && c._id.toLowerCase() === target)
    );

    if (!found) {
      throw new Error(`Company with ID '${idOrCode}' not found.`);
    }
    return { ...found };
  },

  /**
   * Create new company record in MongoDB database
   */
  async createCompany(companyData) {
    try {
      const response = await apiRequest('/companies', {
        method: 'POST',
        body: JSON.stringify(companyData)
      });

      if (response && (response.companyName || response._id)) {
        const formatted = {
          ...response,
          id: response.id || response.companyId || response.companyCode || response._id
        };
        companiesStore = [formatted, ...companiesStore];
        return formatted;
      }
    } catch (err) {
      console.warn('[MongoDB Client] Falling back to local store simulation:', err.message);
    }

    await simulateDelay(250);

    const nextIdNumber = companiesStore.length + 1;
    const companyCode = `COM-${String(nextIdNumber).padStart(3, '0')}`;
    const id = `comp-${String(nextIdNumber).padStart(3, '0')}`;

    const newCompany = {
      ...companyData,
      id,
      companyId: id,
      companyCode,
      status: companyData.status || 'Active',
      kpis: {
        totalShipments: 0,
        totalBilling: 0,
        outstanding: 0,
        paidAmount: 0,
        activeShipments: 0,
        lastShipmentDate: '-'
      },
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0]
    };

    companiesStore = [newCompany, ...companiesStore];
    return { ...newCompany };
  },

  /**
   * Update existing company record in MongoDB database
   */
  async updateCompany(id, updateData) {
    try {
      const response = await apiRequest(`/companies/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      if (response && (response.companyName || response._id)) {
        const formatted = {
          ...response,
          id: response.id || response.companyId || response.companyCode || response._id
        };
        const index = companiesStore.findIndex(
          (c) => c.id === formatted.id || c.companyCode === formatted.companyCode
        );
        if (index !== -1) companiesStore[index] = formatted;
        else companiesStore.unshift(formatted);
        return formatted;
      }
    } catch (err) {
      console.warn('[MongoDB Client] Company update fallback:', err.message);
    }

    await simulateDelay(200);

    const target = id.toLowerCase();
    const index = companiesStore.findIndex(
      (c) =>
        (c.id && c.id.toLowerCase() === target) ||
        (c.companyCode && c.companyCode.toLowerCase() === target) ||
        (c.companyId && c.companyId.toLowerCase() === target)
    );

    if (index === -1) {
      throw new Error(`Company '${id}' not found for update.`);
    }

    const updatedCompany = {
      ...companiesStore[index],
      ...updateData,
      updatedAt: new Date().toISOString().split('T')[0]
    };

    companiesStore[index] = updatedCompany;
    return { ...updatedCompany };
  },

  /**
   * Deactivate company (Soft delete preserving historical records)
   */
  async deactivateCompany(id) {
    return this.updateCompany(id, { status: 'Inactive' });
  }
};
