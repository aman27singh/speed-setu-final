import { apiRequest, simulateDelay } from './apiClient';
let expensesStore = [];

export const expenseService = {
  async getExpenses({ search = '', category = 'All', scope = 'All' } = {}) {
    let list = [];
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (category && category !== 'All') queryParams.append('category', category);

      const remoteData = await apiRequest(`/expenses?${queryParams.toString()}`);
      if (Array.isArray(remoteData)) {
        expensesStore = remoteData.map((e) => ({
          ...e,
          id: e.id || e.expenseId || e._id
        }));
        list = expensesStore;
      }
    } catch (err) {
      console.warn('[MongoDB Client] Expenses fetch fallback:', err.message);
      list = expensesStore;
    }

    return list.filter((e) => {
      if (category !== 'All' && (e.category || '').toLowerCase() !== category.toLowerCase()) return false;

      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const titleMatch = (e.title || '').toLowerCase().includes(q);
        const expIdMatch = (e.expenseId || e.id || '').toLowerCase().includes(q);
        const vendorMatch = (e.vendorName || '').toLowerCase().includes(q);
        const shipmentMatch = (e.shipmentId || e.cnNumber || '').toLowerCase().includes(q);
        const tripMatch = (e.tripId || '').toLowerCase().includes(q);
        if (!titleMatch && !expIdMatch && !vendorMatch && !shipmentMatch && !tripMatch) return false;
      }

      return true;
    });
  },

  async getExpenseDashboard() {
    const list = await this.getExpenses();

    const totalExpenses = list.reduce((acc, e) => acc + (e.amount || 0), 0);

    const tripExpenses = list
      .filter((e) => e.tripId || (e.category || '').toLowerCase().includes('trip') || (e.category || '').toLowerCase().includes('linehaul'))
      .reduce((acc, e) => acc + (e.amount || 0), 0);

    const shipmentExpenses = list
      .filter((e) => e.shipmentId || e.cnNumber || (e.category || '').toLowerCase().includes('pickup') || (e.category || '').toLowerCase().includes('delivery') || (e.category || '').toLowerCase().includes('operational'))
      .reduce((acc, e) => acc + (e.amount || 0), 0);

    const companyOverheads = list
      .filter((e) => (e.category || '').toLowerCase().includes('overhead') || (e.category || '').toLowerCase().includes('office') || (e.category || '').toLowerCase().includes('salary') || (e.category || '').toLowerCase().includes('rent'))
      .reduce((acc, e) => acc + (e.amount || 0), 0);

    const pendingPayouts = list
      .filter((e) => (e.paymentStatus || '').toLowerCase() === 'pending' || (e.paymentStatus || '').toLowerCase() === 'unpaid')
      .reduce((acc, e) => acc + (e.amount || 0), 0);

    const paidThisMonth = list
      .filter((e) => (e.paymentStatus || '').toLowerCase() === 'paid')
      .reduce((acc, e) => acc + (e.amount || 0), 0);

    return {
      totalExpenses,
      tripExpenses,
      shipmentExpenses,
      companyOverheads,
      pendingPayouts,
      paidThisMonth
    };
  },

  async getExpense(id) {
    if (!id || id === 'undefined') throw new Error('Invalid Expense identifier.');

    try {
      const response = await apiRequest(`/expenses/${encodeURIComponent(id)}`);
      if (response && (response.expenseId || response._id)) {
        return {
          ...response,
          id: response.id || response.expenseId || response._id
        };
      }
    } catch (err) {
      console.warn('[MongoDB Client] Single expense fetch fallback:', err.message);
    }

    await simulateDelay(120);
    const target = id.toLowerCase();
    const found = expensesStore.find(
      (e) => (e.id && e.id.toLowerCase() === target) || (e.expenseId && e.expenseId.toLowerCase() === target)
    );
    if (!found) throw new Error(`Expense record '${id}' not found.`);
    return { ...found };
  },

  async recordExpense(expenseData) {
    try {
      const response = await apiRequest('/expenses', {
        method: 'POST',
        body: JSON.stringify(expenseData)
      });

      if (response && (response.expenseId || response._id)) {
        const formatted = {
          ...response,
          id: response.id || response.expenseId || response._id,
          expenseId: response.expenseId || response.id || response._id,
          expenseNumber: response.expenseId || response.expenseNumber || response.id || response._id
        };
        expensesStore = [formatted, ...expensesStore];
        return formatted;
      }
    } catch (err) {
      console.warn('[MongoDB Client] Record expense fallback:', err.message);
    }

    await simulateDelay(250);
    const nextNum = expensesStore.length + 101;
    const expenseId = expenseData.expenseId || `EXP-${nextNum}`;

    const newExpense = {
      ...expenseData,
      id: expenseId,
      expenseId,
      expenseNumber: expenseId,
      createdAt: new Date().toISOString().split('T')[0]
    };

    expensesStore = [newExpense, ...expensesStore];
    return { ...newExpense };
  },

  async createExpense(expenseData) {
    return this.recordExpense(expenseData);
  },

  async updateExpense(id, updateData) {
    try {
      const response = await apiRequest(`/expenses/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      if (response && (response.expenseId || response._id)) {
        const formatted = {
          ...response,
          id: response.id || response.expenseId || response._id
        };
        const index = expensesStore.findIndex((e) => e.expenseId === formatted.expenseId);
        if (index !== -1) expensesStore[index] = formatted;
        else expensesStore.unshift(formatted);
        return formatted;
      }
    } catch (err) {
      console.warn('[MongoDB Client] Update expense fallback:', err.message);
    }

    await simulateDelay(200);
    const target = id.toLowerCase();
    const index = expensesStore.findIndex(
      (e) => (e.id && e.id.toLowerCase() === target) || (e.expenseId && e.expenseId.toLowerCase() === target)
    );

    if (index === -1) throw new Error(`Expense record '${id}' not found for update.`);

    const updatedExpense = {
      ...expensesStore[index],
      ...updateData,
      updatedAt: new Date().toISOString().split('T')[0]
    };

    expensesStore[index] = updatedExpense;
    return { ...updatedExpense };
  }
};
