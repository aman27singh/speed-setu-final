import { apiRequest, simulateDelay } from './apiClient';
import { shipmentService } from './shipmentService';
import { billingService } from './billingService';
import { payableService } from './payableService';
import { expenseService } from './expenseService';
import { companyService } from './companyService';

export const dashboardService = {
  async getDashboardSummary() {
    try {
      const [reportOverview, shipments, invoices, payables, expenses, companies] = await Promise.all([
        apiRequest('/reports/overview').catch(() => null),
        shipmentService.getShipments().catch(() => []),
        billingService.getInvoices().catch(() => []),
        payableService.getPayables().catch(() => []),
        expenseService.getExpenses().catch(() => []),
        companyService.getCompanies().catch(() => [])
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

      // Pending Vendor Payables
      const payablesVal = payables.reduce((acc, p) => acc + (p.balance ?? p.outstandingAmount ?? p.amount ?? 0), 0);

      // Current Month Date Filter (e.g. "2026-08")
      const now = new Date();
      const currentYearMonth = now.toISOString().slice(0, 7);

      // Dynamic Active Month: If current calendar month has invoice activity, use current month; otherwise use latest active billing month
      const invoiceMonths = validInvoices.map(i => (i.invoiceDate || i.createdAt || '').slice(0, 7)).filter(Boolean).sort().reverse();
      const activeBillingMonth = (invoiceMonths.includes(currentYearMonth) || invoiceMonths.length === 0)
        ? currentYearMonth
        : invoiceMonths[0];

      // Invoices issued in active billing month
      const activeMonthInvoices = validInvoices.filter((i) => {
        const d = i.invoiceDate || i.createdAt || '';
        return d.startsWith(activeBillingMonth);
      });

      const currentMonthRevenue = activeMonthInvoices.length > 0
        ? activeMonthInvoices.reduce((acc, i) => acc + (i.grandTotal || i.totalAmount || i.subTotal || 0), 0)
        : validInvoices.reduce((acc, i) => acc + (i.grandTotal || i.totalAmount || i.subTotal || 0), 0);

      // Expenses incurred in active billing month
      const activeMonthExpensesList = expenses.filter((e) => {
        const d = e.expenseDate || e.date || e.createdAt || '';
        return d.startsWith(activeBillingMonth);
      });

      const currentMonthExpenses = (activeMonthExpensesList.length > 0 ? activeMonthExpensesList : expenses).reduce((acc, e) => acc + (e.amount || 0), 0);
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

      // Build Clean Canonical Company Billing Accounts breakdown
      const normalizeCompanyKey = (name = '') => {
        return (name || '')
          .toLowerCase()
          .replace(/autocamp/g, 'autocomp') // normalize typo
          .replace(/\b(pvt|pvt\.|private|ltd|ltd\.|limited|llp|corp|corporation)\b/gi, '')
          .replace(/[^a-z0-9]/gi, '')
          .trim();
      };

      // 1. Build canonical company accounts from registered companies
      const canonicalCompanies = (companies || []).map((comp) => {
        const id = comp.id || comp.companyId || comp._id;
        const code = comp.companyCode || comp.code || '';
        const name = comp.companyName || comp.name || 'Client Company';
        return {
          id: id || code.toLowerCase(),
          companyId: id,
          companyName: name,
          companyCode: code || 'CLIENT',
          gstin: comp.gstin || comp.taxId || '-',
          state: comp.billing?.state || comp.state || '-',
          city: comp.billing?.city || comp.city || '-',
          address: comp.billing?.address || comp.address || '-',
          paymentTerms: comp.billing?.paymentTerms || comp.paymentTerms || 'Net 30',
          primaryContact: comp.primaryContact || null,
          normName: normalizeCompanyKey(name),
          normCode: (code || '').toLowerCase().trim(),
          normId: (id || '').toLowerCase().trim()
        };
      });

      // 2. Helper to find which canonical company a record belongs to
      const findCompanyForRecord = (record) => {
        if (!record) return null;
        const rId = (record.companyId || '').toLowerCase().trim();
        const rCode = (record.companyCode || '').toLowerCase().trim();
        const rawName = record.companyName || record.company || '';
        const rName = normalizeCompanyKey(rawName);

        return canonicalCompanies.find((c) => {
          if (rId && (c.normId === rId || c.normCode === rId)) return true;
          if (rCode && (c.normCode === rCode || c.normId === rCode)) return true;
          // Map historical alias ADV -> COM-001 (Advik Autocomp)
          if (c.companyCode === 'COM-001' && (rCode === 'adv' || rCode === 'advik')) return true;
          if (rName && c.normName) {
            if (c.normName === rName) return true;
            if (c.normName.includes(rName) || rName.includes(c.normName)) return true;
          }
          return false;
        }) || null;
      };

      // 3. Discover only genuine unregistered client companies from shipments/invoices (NEVER consignee)
      const additionalCompaniesMap = new Map();
      [...shipments, ...invoices].forEach((item) => {
        const rawName = item.companyName || item.company;
        if (!rawName || rawName.trim().length === 0) return;
        const existing = findCompanyForRecord(item);
        if (existing) return; // Already belongs to a registered company

        const normK = normalizeCompanyKey(rawName);
        if (!normK || additionalCompaniesMap.has(normK)) return;

        const genId = item.companyId || `comp-${normK}`;
        additionalCompaniesMap.set(normK, {
          id: genId,
          companyId: genId,
          companyName: rawName.trim(),
          companyCode: item.companyCode || 'CLIENT',
          gstin: item.customerGstin || '-',
          state: '-',
          city: '-',
          address: item.customerAddress || '-',
          paymentTerms: 'Net 30',
          primaryContact: null,
          normName: normK,
          normCode: (item.companyCode || '').toLowerCase().trim(),
          normId: (genId || '').toLowerCase().trim()
        });
      });

      const allCompaniesList = [
        ...canonicalCompanies,
        ...Array.from(additionalCompaniesMap.values())
      ];

      // 4. Match and aggregate data for each company
      const companyBillingAccounts = allCompaniesList.map((comp) => {
        const compShipments = shipments.filter((s) => {
          const matched = findCompanyForRecord(s);
          if (matched && matched.id === comp.id) return true;
          const sNameNorm = normalizeCompanyKey(s.companyName || s.company);
          return sNameNorm && comp.normName && sNameNorm === comp.normName;
        });

        const compInvoices = validInvoices.filter((inv) => {
          const matched = findCompanyForRecord(inv);
          if (matched && matched.id === comp.id) return true;
          const invNameNorm = normalizeCompanyKey(inv.companyName);
          return invNameNorm && comp.normName && invNameNorm === comp.normName;
        });

        // Map shipments with bill made vs not made status
        const processedShipments = compShipments.map((s) => {
          const bStatus = (s.billingStatus || '').toLowerCase();

          const matchedInvoice = compInvoices.find((inv) => {
            if (s.invoiceId && (inv.id === s.invoiceId || inv.invoiceNumber === s.invoiceId)) return true;
            if (s.invoiceNumber && (inv.id === s.invoiceNumber || inv.invoiceNumber === s.invoiceNumber)) return true;
            if (Array.isArray(inv.cns) && inv.cns.includes(s.cnNumber)) return true;
            if (Array.isArray(inv.items) && inv.items.some((item) => item.cnNumber === s.cnNumber)) return true;
            return false;
          });

          const isBillMade = Boolean(
            matchedInvoice ||
            s.invoiceId ||
            ['invoiced', 'billed', 'generated', 'sent'].includes(bStatus)
          );

          const invoiceNumber = matchedInvoice?.invoiceNumber || s.invoiceId || (isBillMade ? 'Generated' : null);

          const weight = s.chargeableWeight || s.actualWeight || 0;
          const rate = s.ratePerKg || s.rate || 0;
          const basicF = s.freightCharges || s.basicFreight || (rate > 0 && weight > 0 ? rate * weight : 0);
          const otherCharges = (s.packingCharges || 0) + (s.laborCharges || 0) + (s.pickupCharges || 0) + (s.deliveryCharges || 0) + (s.godownCharges || 0);
          const subtotal = basicF + otherCharges;
          const gstRate = s.isGstExempt ? 0 : (s.gstRate || 18);
          const gst = Math.round((subtotal * gstRate) / 100);
          const totalFreight = s.grandTotal || (subtotal + gst) || 0;

          return {
            ...s,
            id: s.id || s.cnNumber,
            cnNumber: s.cnNumber,
            cnDate: s.cnDate || s.bookingDate || s.createdAt || '-',
            origin: s.origin || (s.consignor && s.consignor.city) || '-',
            destination: s.destination || (s.consignee && s.consignee.city) || '-',
            packages: s.packages || s.numberOfBoxes || s.noOfBoxes || 0,
            actualWeight: s.actualWeight || 0,
            chargeableWeight: s.chargeableWeight || 0,
            materialDescription: s.materialDescription || 'General Cargo',
            isBillMade,
            invoiceNumber,
            invoiceId: matchedInvoice?.id || s.invoiceId,
            invoice: matchedInvoice || null,
            freightAmount: totalFreight,
            status: s.status || 'Booked',
            podStatus: s.podStatus || 'Pending',
            billingStatus: isBillMade ? 'Invoiced' : (s.billingStatus || 'Not Ready')
          };
        });

        const billsMadeCount = processedShipments.filter((s) => s.isBillMade).length;
        const billsNotMadeCount = processedShipments.filter((s) => !s.isBillMade).length;

        // Pending amount that company has to pay to my company (unpaid invoice balance)
        const pendingAmount = compInvoices.reduce((acc, inv) => {
          const bal = typeof inv.balanceAmount === 'number'
            ? inv.balanceAmount
            : (inv.balanceDue !== undefined ? inv.balanceDue : ((inv.grandTotal || inv.totalAmount || 0) - (inv.paidAmount || 0)));
          return acc + Math.max(0, bal);
        }, 0);

        const totalBilledAmount = compInvoices.reduce((acc, inv) => acc + (inv.grandTotal || inv.totalAmount || 0), 0);
        const totalPaidAmount = compInvoices.reduce((acc, inv) => acc + (inv.paidAmount || 0), 0);

        const unbilledFreightAmount = processedShipments
          .filter((s) => !s.isBillMade)
          .reduce((acc, s) => acc + (s.freightAmount || 0), 0);

        return {
          ...comp,
          totalShipments: processedShipments.length,
          billsMade: billsMadeCount,
          billsNotMade: billsNotMadeCount,
          pendingAmount, // Amount company has to pay to my company
          totalBilledAmount,
          totalPaidAmount,
          unbilledFreightAmount,
          shipments: processedShipments,
          invoices: compInvoices
        };
      });

      // Filter out empty ghost records and sort
      const validCompanyBillingAccounts = companyBillingAccounts
        .filter((c) => c.totalShipments > 0 || c.totalBilledAmount > 0 || (c.companyCode && c.companyCode.startsWith('COM-')))
        .sort((a, b) => {
          if (b.pendingAmount !== a.pendingAmount) return b.pendingAmount - a.pendingAmount;
          if (b.totalShipments !== a.totalShipments) return b.totalShipments - a.totalShipments;
          return (b.totalBilledAmount || 0) - (a.totalBilledAmount || 0);
        });

      return {
        kpis,
        statusOverview,
        companyTurnover,
        companyProfit,
        revenueVsExpenses,
        recentShipments,
        paymentFollowUps,
        pendingPayables: pendingPayablesList,
        companyBillingAccounts: validCompanyBillingAccounts
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
      pendingPayables: [],
      companyBillingAccounts: []
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
  },

  async getCompanyBillingAccount(idOrCode) {
    const summary = await this.getDashboardSummary();
    const accounts = summary.companyBillingAccounts || [];
    if (!idOrCode) return accounts[0] || null;

    const target = idOrCode.toLowerCase().trim();
    const cleanTarget = target
      .replace(/autocamp/g, 'autocomp')
      .replace(/\b(pvt|pvt\.|private|ltd|ltd\.|limited|llp)\b/gi, '')
      .replace(/[^a-z0-9]/gi, '')
      .trim();

    return accounts.find((c) => {
      const cId = (c.id || '').toLowerCase().trim();
      const cCode = (c.companyCode || '').toLowerCase().trim();
      const cName = (c.companyName || '').toLowerCase().trim();
      const cNorm = (c.normName || '').toLowerCase().trim();

      if (cId === target || cCode === target) return true;
      if (cName === target || cNorm === cleanTarget) return true;
      if (cleanTarget && cNorm && (cNorm.includes(cleanTarget) || cleanTarget.includes(cNorm))) return true;
      return false;
    }) || null;
  }
};
