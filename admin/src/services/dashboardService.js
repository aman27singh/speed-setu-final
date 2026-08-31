import { apiRequest, simulateDelay } from './apiClient';
import { shipmentService } from './shipmentService';
import { billingService } from './billingService';
import { payableService } from './payableService';
import { expenseService } from './expenseService';

export const dashboardService = {
  async getDashboardSummary() {
    try {
      const [reportOverview, shipments, invoices, payables, expenses] = await Promise.all([
        apiRequest('/reports/overview').catch(() => null),
        shipmentService.getShipments().catch(() => []),
        billingService.getInvoices().catch(() => []),
        payableService.getPayables().catch(() => []),
        expenseService.getExpenses().catch(() => [])
      ]);

      const totalShipments = shipments.length;
      const activeShipments = shipments.filter((s) => ['Booked', 'Picked Up', 'In Transit', 'Out for Delivery'].includes(s.status)).length;
      const inTransit = shipments.filter((s) => s.status === 'In Transit').length;
      const outForDelivery = shipments.filter((s) => s.status === 'Out for Delivery').length;
      const deliveredToday = shipments.filter((s) => s.status === 'Delivered').length;
      const podPending = shipments.filter((s) => s.podStatus === 'Pending' || s.podStatus === 'Unuploaded').length;
      const readyForBilling = shipments.filter((s) => s.billingStatus === 'Ready' || s.status === 'Delivered').length;

      const validInvoices = invoices.filter(i => (i.status || '').toLowerCase() !== 'cancelled' && (i.status || '').toLowerCase() !== 'void');

      // Customer Outstanding = All-time unpaid receivables across all valid client invoices
      const customerOutstanding = validInvoices.reduce((acc, i) => acc + (typeof i.balanceAmount === 'number' ? i.balanceAmount : (i.balanceDue ?? i.grandTotal ?? 0)), 0);

      // Current Month Date Filter (e.g. "2026-08")
      const now = new Date();
      const currentYearMonth = now.toISOString().slice(0, 7);

      // Invoices issued in the current month
      const currentMonthInvoices = validInvoices.filter((i) => {
        const d = i.invoiceDate || i.createdAt || '';
        return d.startsWith(currentYearMonth);
      });

      const currentMonthRevenue = currentMonthInvoices.length > 0
        ? currentMonthInvoices.reduce((acc, i) => acc + (i.grandTotal || i.totalAmount || i.subTotal || 0), 0)
        : validInvoices.reduce((acc, i) => acc + (i.grandTotal || i.totalAmount || i.subTotal || 0), 0);

      // Expenses incurred in the current month
      const currentMonthExpensesList = expenses.filter((e) => {
        const d = e.expenseDate || e.date || e.createdAt || '';
        return d.startsWith(currentYearMonth);
      });

      const currentMonthExpenses = (currentMonthExpensesList.length > 0 ? currentMonthExpensesList : expenses).reduce((acc, e) => acc + (e.amount || 0), 0);
      const currentMonthProfit = Math.max(0, currentMonthRevenue - currentMonthExpenses);

      const kpis = {
        activeShipments,
        activeTrips: 0,
        inTransit,
        outForDelivery,
        deliveredToday,
        podPending,
        customerOutstanding,
        payables: payablesVal,
        currentMonthRevenue,
        currentMonthExpenses,
        currentMonthProfit,
        totalShipments,
        pendingPODs: podPending,
        readyForBilling,
        monthlyRevenue: currentMonthRevenue,
        outstandingReceivables: customerOutstanding,
        pendingPayables: payablesVal,
        totalExpenses: currentMonthExpenses
      };

      const statusColors = {
        'Booked': '#3b82f6',
        'Picked Up': '#8b5cf6',
        'In Transit': '#f59e0b',
        'Out for Delivery': '#06b6d4',
        'Delivered': '#10b981'
      };

      const statusOverview = [
        { name: 'Booked', status: 'Booked', count: shipments.filter((s) => s.status === 'Booked').length, color: statusColors['Booked'] },
        { name: 'Picked Up', status: 'Picked Up', count: shipments.filter((s) => s.status === 'Picked Up').length, color: statusColors['Picked Up'] },
        { name: 'In Transit', status: 'In Transit', count: shipments.filter((s) => s.status === 'In Transit').length, color: statusColors['In Transit'] },
        { name: 'Out for Delivery', status: 'Out for Delivery', count: shipments.filter((s) => s.status === 'Out for Delivery').length, color: statusColors['Out for Delivery'] },
        { name: 'Delivered', status: 'Delivered', count: shipments.filter((s) => s.status === 'Delivered').length, color: statusColors['Delivered'] }
      ];

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const revenueVsExpenses = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mName = monthNames[d.getMonth()];
        const yMonth = d.toISOString().slice(0, 7);

        const rev = validInvoices
          .filter(inv => (inv.invoiceDate || inv.createdAt || '').startsWith(yMonth))
          .reduce((sum, inv) => sum + (inv.grandTotal || inv.totalAmount || 0), 0);

        const exp = expenses
          .filter(ex => (ex.date || ex.createdAt || '').startsWith(yMonth))
          .reduce((sum, ex) => sum + (ex.amount || 0), 0);

        revenueVsExpenses.push({
          month: mName,
          revenue: rev,
          expenses: exp
        });
      }

      const recentShipments = shipments.slice(0, 5).map((s) => ({
        ...s,
        id: s.id || s.cnNumber || s._id,
        cnNumber: s.cnNumber,
        company: s.companyName || s.companyCode || s.company || 'General Client',
        origin: s.origin || (s.consignor && s.consignor.city) || '-',
        destination: s.destination || (s.consignee && s.consignee.city) || '-',
        mode: s.mode || s.freightMode || 'Express LTL',
        packages: s.packages || s.numberOfBoxes || s.noOfBoxes || 10,
        weight: s.chargeableWeight || s.actualWeight || s.weight || 0,
        status: s.status || 'Booked',
        podStatus: s.podStatus || 'Pending',
        billingStatus: s.billingStatus || 'Not Ready'
      }));

      const paymentFollowUps = validInvoices
        .filter((i) => (i.balanceAmount ?? i.balanceDue ?? (i.grandTotal - (i.paidAmount || 0))) > 0)
        .slice(0, 5)
        .map((i) => ({
          ...i,
          id: i.id || i.invoiceNumber || i._id,
          company: i.companyName || i.companyCode || 'General Client',
          invoice: i.invoiceNumber || i.id,
          amount: i.balanceAmount ?? i.balanceDue ?? i.grandTotal,
          dueDate: i.dueDate || i.invoiceDate || '-',
          daysOverdue: 0,
          status: i.status || 'Draft'
        }));

      const pendingPayablesList = payables.slice(0, 5).map((p) => ({
        ...p,
        id: p.id || p.payableId || p._id,
        vendor: p.vendorName || p.driverName || p.payeeName || 'Vendor',
        trip: p.tripId || p.cnNumber || p.shipmentId || 'Operational',
        amount: p.balance ?? p.amount ?? 0,
        dueDate: p.dueDate || '-',
        status: p.status || 'Pending'
      }));

      // Company Monthly Turnover Breakdown
      const companyTurnoverMap = {};
      validInvoices.forEach((inv) => {
        const cName = inv.companyName || inv.companyCode || 'General Client';
        const val = inv.grandTotal || inv.totalAmount || inv.subTotal || 0;
        companyTurnoverMap[cName] = (companyTurnoverMap[cName] || 0) + val;
      });

      // Fallback to shipments freight if no invoice exists yet
      if (Object.keys(companyTurnoverMap).length === 0) {
        shipments.forEach((s) => {
          const cName = s.companyName || s.companyCode || s.company || 'General Client';
          const val = s.grandTotal || s.totalFreight || s.freightAmount || s.billingAmount || 0;
          companyTurnoverMap[cName] = (companyTurnoverMap[cName] || 0) + val;
        });
      }

      const companyTurnover = Object.entries(companyTurnoverMap)
        .map(([name, turnover]) => ({ name, turnover }))
        .sort((a, b) => b.turnover - a.turnover)
        .slice(0, 7);

      // Company Monthly Profit Breakdown
      const companyProfitMap = {};
      validInvoices.forEach((inv) => {
        const cName = inv.companyName || inv.companyCode || 'General Client';
        const rev = inv.grandTotal || inv.totalAmount || inv.subTotal || 0;
        const exp = inv.expensesAmount || inv.vendorPayout || (rev * 0.7);
        const profit = Math.max(0, rev - exp);
        companyProfitMap[cName] = (companyProfitMap[cName] || 0) + profit;
      });

      if (Object.keys(companyProfitMap).length === 0) {
        shipments.forEach((s) => {
          const cName = s.companyName || s.companyCode || s.company || 'General Client';
          const rev = s.grandTotal || s.totalFreight || s.freightAmount || s.billingAmount || 0;
          const exp = s.vendorPayout || s.driverAdvance || (rev * 0.7);
          const profit = Math.max(0, rev - exp);
          companyProfitMap[cName] = (companyProfitMap[cName] || 0) + profit;
        });
      }

      const companyProfit = Object.entries(companyProfitMap)
        .map(([name, profit]) => ({ name, profit }))
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 7);

      return {
        kpis,
        statusOverview,
        companyTurnover,
        companyProfit,
        revenueVsExpenses,
        recentShipments,
        paymentFollowUps,
        pendingPayables: pendingPayablesList
      };
    } catch (err) {
      console.warn('[MongoDB Client] Dashboard summary error:', err.message);
    }

    await simulateDelay(200);
    return {
      kpis: {
        activeShipments: 0,
        pendingPODs: 0,
        readyForBilling: 0,
        totalShipments: 0,
        monthlyRevenue: 0,
        outstandingReceivables: 0,
        pendingPayables: 0,
        totalExpenses: 0
      },
      statusOverview: [],
      recentShipments: [],
      paymentFollowUps: [],
      pendingPayables: []
    };
  },

  async getKpis() {
    const summary = await this.getDashboardSummary();
    return summary.kpis;
  },

  async getShipmentOverview() {
    const summary = await this.getDashboardSummary();
    return summary.statusOverview;
  },

  async getRecentShipments() {
    const summary = await this.getDashboardSummary();
    return summary.recentShipments;
  },

  async getPaymentFollowUps() {
    const summary = await this.getDashboardSummary();
    return summary.paymentFollowUps;
  },

  async getPendingPayables() {
    const summary = await this.getDashboardSummary();
    return summary.pendingPayables;
  }
};
