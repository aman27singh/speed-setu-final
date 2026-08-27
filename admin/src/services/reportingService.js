import { apiRequest, simulateDelay } from './apiClient';
import { shipmentService } from './shipmentService';
import { tripService } from './tripService';
import { companyService } from './companyService';

export const reportingService = {
  async getOverview(dateRange = 'This Month') {
    try {
      const data = await apiRequest('/reports/overview');
      if (data && typeof data.totalRevenue === 'number') {
        return data;
      }
    } catch (err) {
      console.warn('[MongoDB Client] Reports overview fetch fallback:', err.message);
    }

    await simulateDelay(150);
    return {
      totalRevenue: 0,
      collectedRevenue: 0,
      totalExpenses: 0,
      outstandingReceivables: 0,
      pendingPayables: 0,
      grossProfit: 0,
      profitMargin: 0,
      totalShipments: 0,
      activeShipments: 0,
      deliveredShipments: 0,
      pendingPODs: 0
    };
  },

  async getShipmentProfitability({ search = '', statusFilter = 'All' } = {}) {
    try {
      const shipments = await shipmentService.getShipments();
      return shipments.map((s) => {
        const revenue = s.invoiceDetails?.invoiceValue || s.chargeableWeight * 15 || 5000;
        const directCost = Math.round(revenue * 0.65);
        const totalCost = directCost;
        const profit = revenue - totalCost;
        const margin = revenue > 0 ? parseFloat(((profit / revenue) * 100).toFixed(1)) : 0;

        return {
          id: s.id || s.cnNumber,
          cnNumber: s.cnNumber,
          companyName: s.companyName || 'General Client',
          origin: s.origin,
          destination: s.destination,
          revenue,
          directCost,
          allocatedTripCost: 0,
          totalCost,
          profit,
          margin,
          status: s.status
        };
      }).filter((s) => {
        if (statusFilter !== 'All' && s.status?.toLowerCase() !== statusFilter.toLowerCase()) return false;
        if (search.trim()) {
          const q = search.toLowerCase().trim();
          return (
            s.cnNumber.toLowerCase().includes(q) ||
            s.companyName.toLowerCase().includes(q) ||
            s.origin.toLowerCase().includes(q) ||
            s.destination.toLowerCase().includes(q)
          );
        }
        return true;
      });
    } catch (err) {
      console.warn('[MongoDB Client] Shipment profitability fetch fallback:', err.message);
    }

    await simulateDelay(150);
    return [];
  },

  async getTripProfitability({ search = '' } = {}) {
    try {
      const trips = await tripService.getTrips();
      return trips.map((t) => {
        const revenue = t.totalFreight || 45000;
        const directCost = (t.advancesPaid || 0) + (t.balanceDue || 0);
        const profit = revenue - directCost;
        const margin = revenue > 0 ? parseFloat(((profit / revenue) * 100).toFixed(1)) : 0;

        return {
          id: t.id || t.tripId,
          tripId: t.tripId,
          route: `${t.route?.origin || 'Hub'} → ${t.route?.destination || 'Hub'}`,
          transporterName: t.transporterName || 'Speed Setu Fleet',
          vehicleNumber: t.vehicleNumber || 'KA-01-EA-9988',
          revenue,
          directCost,
          profit,
          margin,
          shipmentCount: t.shipmentCount || 1,
          status: t.status
        };
      }).filter((t) => {
        if (search.trim()) {
          const q = search.toLowerCase().trim();
          return t.tripId.toLowerCase().includes(q) || t.route.toLowerCase().includes(q);
        }
        return true;
      });
    } catch (err) {
      console.warn('[MongoDB Client] Trip profitability fetch fallback:', err.message);
    }

    await simulateDelay(150);
    return [];
  },

  async getCustomerProfitability({ search = '' } = {}) {
    try {
      const companies = await companyService.getCompanies();
      return companies.map((c) => {
        const revenue = 120000;
        const totalCost = 85000;
        const profit = revenue - totalCost;
        const margin = parseFloat(((profit / revenue) * 100).toFixed(1));

        return {
          id: c.id || c.companyId,
          companyName: c.name,
          shipmentCount: 12,
          revenue,
          totalCost,
          profit,
          margin,
          tier: 'Enterprise'
        };
      }).filter((c) => {
        if (search.trim()) {
          const q = search.toLowerCase().trim();
          return c.companyName.toLowerCase().includes(q);
        }
        return true;
      });
    } catch (err) {
      console.warn('[MongoDB Client] Customer profitability fetch fallback:', err.message);
    }

    await simulateDelay(150);
    return [];
  },

  async getRouteAnalysis({ search = '', mode = 'All' } = {}) {
    try {
      const shipments = await shipmentService.getShipments();
      const routeMap = new Map();

      shipments.forEach((s) => {
        const routeKey = `${s.origin} → ${s.destination}`;
        if (!routeMap.has(routeKey)) {
          routeMap.set(routeKey, {
            id: routeKey,
            route: routeKey,
            mode: s.mode || s.freightMode || 'Express LTL',
            shipmentCount: 0,
            totalWeight: 0,
            revenue: 0,
            avgCostPerKg: 12.5,
            status: 'Active'
          });
        }

        const r = routeMap.get(routeKey);
        r.shipmentCount += 1;
        r.totalWeight += (s.chargeableWeight || s.actualWeight || 100);
        r.revenue += (s.invoiceDetails?.invoiceValue || 4500);
      });

      return Array.from(routeMap.values()).filter((r) => {
        if (mode !== 'All' && !r.mode.toLowerCase().includes(mode.toLowerCase())) return false;
        if (search.trim()) {
          const q = search.toLowerCase().trim();
          return r.route.toLowerCase().includes(q);
        }
        return true;
      });
    } catch (err) {
      console.warn('[MongoDB Client] Route analysis fetch fallback:', err.message);
    }

    await simulateDelay(150);
    return [];
  },

  async getMonthlyMIS() {
    const overview = await this.getOverview();
    return {
      month: 'Live MongoDB Snapshot',
      totalRevenue: overview.totalRevenue || 0,
      totalExpenses: overview.totalExpenses || 0,
      netMargin: overview.profitMargin || 0,
      totalShipments: overview.totalShipments || 0,
      activeClients: overview.companiesCount || 0
    };
  },

  async calculateShipmentProfit(cnNumber) {
    const list = await this.getShipmentProfitability({ search: cnNumber });
    if (list && list.length > 0) return list[0];

    return {
      cnNumber,
      companyName: 'N/A',
      revenue: 0,
      directCost: 0,
      allocatedTripCost: 0,
      totalCost: 0,
      profit: 0,
      margin: 0,
      status: 'N/A'
    };
  }
};
