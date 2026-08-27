import { apiRequest, simulateDelay } from './apiClient';

let payablesStore = [];

export const payableService = {
  async getPayables({ search = '', payeeType = 'All', status = 'All' } = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (status && status !== 'All') queryParams.append('status', status);

      const remoteData = await apiRequest(`/payables?${queryParams.toString()}`);
      if (Array.isArray(remoteData)) {
        payablesStore = remoteData.map((p) => ({
          ...p,
          id: p.id || p.payableId || p._id
        }));
      }
    } catch (err) {
      console.warn('[MongoDB Client] Payables fetch fallback:', err.message);
    }

    let filtered = [...payablesStore];
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          (p.payableId && p.payableId.toLowerCase().includes(q)) ||
          (p.vendorName && p.vendorName.toLowerCase().includes(q)) ||
          (p.vendorType && p.vendorType.toLowerCase().includes(q))
      );
    }
    if (payeeType && payeeType !== 'All') {
      filtered = filtered.filter((p) => p.vendorType === payeeType || p.payeeType === payeeType);
    }
    if (status && status !== 'All') {
      filtered = filtered.filter((p) => p.status === status);
    }

    return filtered;
  },

  async getPayablesDashboard() {
    const list = await this.getPayables();
    const totalPayables = list.reduce((acc, p) => acc + (p.balance ?? p.amount ?? 0), 0);
    const transporterPayables = list.filter(p => p.vendorType === 'Transporter' || p.payeeType === 'Transporter').reduce((acc, p) => acc + (p.balance ?? p.amount ?? 0), 0);
    const driverPayables = list.filter(p => p.vendorType === 'Driver' || p.payeeType === 'Driver').reduce((acc, p) => acc + (p.balance ?? p.amount ?? 0), 0);
    const vendorPayables = list.filter(p => p.vendorType === 'Vendor' || p.payeeType === 'Vendor').reduce((acc, p) => acc + (p.balance ?? p.amount ?? 0), 0);
    const paidThisMonth = list.filter(p => p.status === 'Paid' || p.status === 'Settled').reduce((acc, p) => acc + (p.paidAmount ?? p.amount ?? 0), 0);
    const dueThisWeekCount = list.filter(p => p.status === 'Pending' || p.status === 'Overdue').length;

    return {
      totalPayables,
      transporterPayables,
      driverPayables,
      vendorPayables,
      paidThisMonth,
      dueThisWeekCount
    };
  },

  async getPayableAging() {
    const list = await this.getPayables();
    const current = list.filter(p => p.status !== 'Overdue').reduce((acc, p) => acc + (p.balance ?? p.amount ?? 0), 0);
    const overdue1to15 = list.filter(p => p.status === 'Overdue' && (p.daysOverdue <= 15 || !p.daysOverdue)).reduce((acc, p) => acc + (p.balance ?? p.amount ?? 0), 0);
    const overdue16to30 = list.filter(p => p.status === 'Overdue' && p.daysOverdue > 15 && p.daysOverdue <= 30).reduce((acc, p) => acc + (p.balance ?? p.amount ?? 0), 0);
    const overdue30Plus = list.filter(p => p.status === 'Overdue' && p.daysOverdue > 30).reduce((acc, p) => acc + (p.balance ?? p.amount ?? 0), 0);
    const totalPayables = current + overdue1to15 + overdue16to30 + overdue30Plus;

    return {
      totalPayables,
      current,
      overdue1to15,
      overdue16to30,
      overdue30Plus
    };
  },

  async getPayable(id) {
    if (!id || id === 'undefined') throw new Error('Invalid Payable identifier.');

    try {
      const response = await apiRequest(`/payables/${encodeURIComponent(id)}`);
      if (response && (response.payableId || response._id)) {
        return {
          ...response,
          id: response.id || response.payableId || response._id
        };
      }
    } catch (err) {
      console.warn('[MongoDB Client] Single payable fetch fallback:', err.message);
    }

    await simulateDelay(120);
    const target = id.toLowerCase();
    const found = payablesStore.find(
      (p) => (p.id && p.id.toLowerCase() === target) || (p.payableId && p.payableId.toLowerCase() === target)
    );
    if (!found) throw new Error(`Payable record '${id}' not found.`);
    return { ...found };
  },

  async recordPayable(payableData) {
    try {
      const response = await apiRequest('/payables', {
        method: 'POST',
        body: JSON.stringify(payableData)
      });

      if (response && (response.payableId || response._id)) {
        const formatted = {
          ...response,
          id: response.id || response.payableId || response._id
        };
        payablesStore = [formatted, ...payablesStore];
        return formatted;
      }
    } catch (err) {
      console.warn('[MongoDB Client] Record payable fallback:', err.message);
    }

    await simulateDelay(250);
    const nextNum = payablesStore.length + 101;
    const payableId = payableData.payableId || `PAYABLE-${nextNum}`;

    const newPayable = {
      ...payableData,
      id: payableId,
      payableId,
      createdAt: new Date().toISOString().split('T')[0]
    };

    payablesStore = [newPayable, ...payablesStore];
    return { ...newPayable };
  },

  async updatePayable(id, updateData) {
    try {
      const response = await apiRequest(`/payables/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      if (response && (response.payableId || response._id)) {
        const formatted = {
          ...response,
          id: response.id || response.payableId || response._id
        };
        const index = payablesStore.findIndex((p) => p.payableId === formatted.payableId);
        if (index !== -1) payablesStore[index] = formatted;
        else payablesStore.unshift(formatted);
        return formatted;
      }
    } catch (err) {
      console.warn('[MongoDB Client] Update payable fallback:', err.message);
    }

    await simulateDelay(200);
    const target = id.toLowerCase();
    const index = payablesStore.findIndex(
      (p) => (p.id && p.id.toLowerCase() === target) || (p.payableId && p.payableId.toLowerCase() === target)
    );

    if (index === -1) throw new Error(`Payable record '${id}' not found for update.`);

    const updatedPayable = {
      ...payablesStore[index],
      ...updateData,
      updatedAt: new Date().toISOString().split('T')[0]
    };

    payablesStore[index] = updatedPayable;
    return { ...updatedPayable };
  }
};
