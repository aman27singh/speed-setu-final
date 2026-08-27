import { apiRequest, simulateDelay } from './apiClient';
import { billingService } from './billingService';

let paymentsStore = [];

export const paymentService = {
  async getPayments() {
    try {
      const remoteData = await apiRequest('/payments');
      if (Array.isArray(remoteData)) {
        paymentsStore = remoteData.map((p) => ({
          ...p,
          id: p.id || p.paymentNumber || p._id
        }));

        return paymentsStore;
      }
    } catch (err) {
      console.warn('[MongoDB Client] Payments fetch fallback:', err.message);
    }

    await simulateDelay(150);
    return paymentsStore;
  },

  async getPayment(id) {
    if (!id || id === 'undefined') throw new Error('Invalid Payment identifier.');

    try {
      const response = await apiRequest(`/payments/${encodeURIComponent(id)}`);
      if (response && (response.paymentNumber || response._id)) {
        return {
          ...response,
          id: response.id || response.paymentNumber || response._id
        };
      }
    } catch (err) {
      console.warn('[MongoDB Client] Single payment fetch fallback:', err.message);
    }

    await simulateDelay(120);
    const target = id.toLowerCase();
    const found = paymentsStore.find(
      (p) => (p.id && p.id.toLowerCase() === target) || (p.paymentNumber && p.paymentNumber.toLowerCase() === target)
    );
    if (!found) throw new Error(`Payment record '${id}' not found.`);
    return { ...found };
  },

  async recordPayment(paymentData) {
    try {
      const response = await apiRequest('/payments', {
        method: 'POST',
        body: JSON.stringify(paymentData)
      });

      if (response && (response.paymentNumber || response._id)) {
        const formatted = {
          ...response,
          id: response.id || response.paymentNumber || response._id
        };
        paymentsStore = [formatted, ...paymentsStore];

        return formatted;
      }
    } catch (err) {
      console.warn('[MongoDB Client] Record payment fallback:', err.message);
    }

    await simulateDelay(250);
    const nextNum = paymentsStore.length + 101;
    const paymentNumber = paymentData.paymentNumber || `PAY-2026-${nextNum}`;

    const newPayment = {
      ...paymentData,
      id: paymentNumber,
      paymentNumber,
      createdAt: new Date().toISOString().split('T')[0]
    };

    paymentsStore = [newPayment, ...paymentsStore];
    return { ...newPayment };
  },

  async updatePayment(id, updateData) {
    try {
      const response = await apiRequest(`/payments/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      if (response && (response.paymentNumber || response._id)) {
        const formatted = {
          ...response,
          id: response.id || response.paymentNumber || response._id
        };
        const index = paymentsStore.findIndex((p) => p.paymentNumber === formatted.paymentNumber);
        if (index !== -1) paymentsStore[index] = formatted;
        else paymentsStore.unshift(formatted);
        return formatted;
      }
    } catch (err) {
      console.warn('[MongoDB Client] Update payment fallback:', err.message);
    }

    await simulateDelay(200);
    const target = id.toLowerCase();
    const index = paymentsStore.findIndex(
      (p) => (p.id && p.id.toLowerCase() === target) || (p.paymentNumber && p.paymentNumber.toLowerCase() === target)
    );

    if (index === -1) throw new Error(`Payment record '${id}' not found for update.`);

    const updatedPayment = {
      ...paymentsStore[index],
      ...updateData,
      updatedAt: new Date().toISOString().split('T')[0]
    };

    paymentsStore[index] = updatedPayment;
    return { ...updatedPayment };
  },

  // Receivables Dashboard Summary Metrics
  async getReceivablesDashboard() {
    try {
      const invoices = await billingService.getInvoices();
      const validInvoices = invoices.filter(
        (i) => (i.status || '').toLowerCase() !== 'cancelled' && (i.status || '').toLowerCase() !== 'void'
      );

      const todayStr = new Date().toISOString().split('T')[0];
      const todayMs = new Date(todayStr).getTime();
      const in7DaysMs = todayMs + 7 * 86400000;

      const getBal = (i) => (typeof i.balanceAmount === 'number' && i.balanceAmount > 0 ? i.balanceAmount : Math.max(0, (i.grandTotal || i.totalAmount || 0) - (i.paidAmount || 0)));

      const totalReceivables = validInvoices.reduce((sum, i) => sum + getBal(i), 0);

      const overdueBalance = validInvoices
        .filter((i) => {
          const dueMs = new Date(i.dueDate || i.invoiceDate || todayStr).getTime();
          return dueMs < todayMs && getBal(i) > 0;
        })
        .reduce((sum, i) => sum + getBal(i), 0);

      const collectedTotal = validInvoices.reduce((sum, i) => sum + (i.paidAmount || 0), 0);

      const partiallyPaidCount = validInvoices.filter(
        (i) => i.status === 'Partially Paid' || (i.paidAmount > 0 && getBal(i) > 0)
      ).length;

      const dueSoonCount = validInvoices.filter((i) => {
        const dueMs = new Date(i.dueDate || i.invoiceDate || todayStr).getTime();
        return dueMs >= todayMs && dueMs <= in7DaysMs && getBal(i) > 0;
      }).length;

      const disputedCount = validInvoices.filter((i) => i.status === 'Disputed').length;

      return {
        totalReceivables,
        overdueReceivables: overdueBalance,
        overdueBalance,
        collectedThisMonth: collectedTotal,
        collectedTotal,
        partiallyPaidCount,
        dueSoonCount,
        disputedCount
      };
    } catch (err) {
      console.warn('[Receivables Dashboard] Error fetching summary:', err.message);
      return {
        totalReceivables: 0,
        overdueReceivables: 0,
        overdueBalance: 0,
        collectedThisMonth: 0,
        collectedTotal: 0,
        partiallyPaidCount: 0,
        dueSoonCount: 0,
        disputedCount: 0
      };
    }
  },

  // Receivables Records Table with Search and Filtering
  async getReceivables(params = {}) {
    const { search = '', status = 'All', companyId = 'All' } = params;

    try {
      const invoices = await billingService.getInvoices();
      let filtered = invoices.filter(
        (i) => (i.status || '').toLowerCase() !== 'cancelled' && (i.status || '').toLowerCase() !== 'void'
      );

      if (companyId && companyId !== 'All') {
        const cIdLower = companyId.toLowerCase().trim();
        filtered = filtered.filter(
          (i) => (i.companyId || '').toLowerCase().trim() === cIdLower || (i.companyCode || '').toLowerCase().trim() === cIdLower
        );
      }

      if (status && status !== 'All') {
        filtered = filtered.filter((i) => (i.status || '').toLowerCase() === status.toLowerCase());
      }

      if (search && search.trim() !== '') {
        const q = search.toLowerCase().trim();
        filtered = filtered.filter(
          (i) =>
            (i.invoiceNumber || '').toLowerCase().includes(q) ||
            (i.companyName || '').toLowerCase().includes(q) ||
            (i.cns && i.cns.some((cn) => cn.toLowerCase().includes(q)))
        );
      }

      return filtered.map((i) => {
        const total = i.grandTotal || i.totalAmount || 0;
        const paid = i.paidAmount || 0;
        const bal = (i.status || '').toLowerCase() === 'cancelled' || (i.status || '').toLowerCase() === 'void'
          ? 0
          : (typeof i.balanceAmount === 'number' && i.balanceAmount > 0 ? i.balanceAmount : Math.max(0, total - paid));

        return {
          id: i.id || i.invoiceNumber || i._id,
          invoiceNumber: i.invoiceNumber,
          companyName: i.companyName,
          companyId: i.companyId,
          invoiceDate: i.invoiceDate || i.createdAt,
          dueDate: i.dueDate || i.invoiceDate,
          grandTotal: total,
          paidAmount: paid,
          balanceAmount: bal,
          status: i.status || 'Draft'
        };
      });
    } catch (err) {
      console.warn('[Receivables Table] Error fetching records:', err.message);
      return [];
    }
  },

  // Accounts Receivable Aging Analysis
  async getReceivableAging() {
    try {
      const invoices = await billingService.getInvoices();
      const validInvoices = invoices.filter(
        (i) => (i.status || '').toLowerCase() !== 'cancelled' && (i.status || '').toLowerCase() !== 'void'
      );

      const todayMs = new Date(new Date().toISOString().split('T')[0]).getTime();

      let currentNotDue = 0;
      let days1to30 = 0;
      let days31to60 = 0;
      let days61to90 = 0;
      let days90Plus = 0;

      validInvoices.forEach((i) => {
        const total = i.grandTotal || i.totalAmount || 0;
        const paid = i.paidAmount || 0;
        const balance = typeof i.balanceAmount === 'number' && i.balanceAmount > 0 ? i.balanceAmount : Math.max(0, total - paid);
        if (balance <= 0) return;

        const dueMs = new Date(i.dueDate || i.invoiceDate || new Date()).getTime();
        const diffDays = Math.floor((todayMs - dueMs) / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) {
          currentNotDue += balance;
        } else if (diffDays <= 30) {
          days1to30 += balance;
        } else if (diffDays <= 60) {
          days31to60 += balance;
        } else if (diffDays <= 90) {
          days61to90 += balance;
        } else {
          days90Plus += balance;
        }
      });

      const totalReceivables = currentNotDue + days1to30 + days31to60 + days61to90 + days90Plus;

      return {
        currentNotDue,
        days1to30,
        days31to60,
        days61to90,
        days90Plus,
        totalReceivables
      };
    } catch (err) {
      console.warn('[Receivables Aging] Error calculating aging:', err.message);
      return {
        currentNotDue: 0,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        days90Plus: 0,
        totalReceivables: 0
      };
    }
  }
};
