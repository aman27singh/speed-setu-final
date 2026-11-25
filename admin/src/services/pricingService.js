import { apiRequest } from './apiClient';
import {
  normalizeLocation,
  normalizeMode,
  isAgreementDateValid,
  findMatchingRuleInList,
  buildClientPricingSnapshot,
  evaluatePricingFromCatalog
} from '../utils/pricingValidation';

export {
  normalizeLocation,
  normalizeMode,
  isAgreementDateValid,
  findMatchingRuleInList,
  buildClientPricingSnapshot,
  evaluatePricingFromCatalog
};

export const pricingService = {
  /**
   * Validate shipment pricing coverage against Company Quotations and Rate Cards.
   * Uses server POST /shipments/validate-pricing first, with seamless live-API catalog fallback.
   */
  async validatePricing({ companyId, companyCode, companyName, origin, destination, freightMode, mode, date }) {
    try {
      const response = await apiRequest('/shipments/validate-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          companyCode,
          companyName,
          origin,
          destination,
          freightMode: freightMode || mode,
          mode: mode || freightMode,
          date
        })
      });
      return response;
    } catch (err) {
      console.warn('[Pricing Service] Validate pricing endpoint fallback triggered:', err.message);

      // Resilient live-API lookup using /quotations, /companies, and /rate-cards
      try {
        const [quotations, companies, rateCards] = await Promise.all([
          apiRequest('/quotations'),
          apiRequest('/companies').catch(() => []),
          apiRequest('/rate-cards').catch(() => [])
        ]);

        return evaluatePricingFromCatalog({
          companies: Array.isArray(companies) ? companies : [],
          quotations: Array.isArray(quotations) ? quotations : [],
          rateCards: Array.isArray(rateCards) ? rateCards : [],
          companyId,
          companyCode,
          companyName,
          origin,
          destination,
          freightMode,
          mode,
          date
        });
      } catch (fallbackErr) {
        console.error('[Pricing Service] Live catalog validation fallback failed:', fallbackErr.message);
        return {
          status: 'ERROR',
          source: 'NONE',
          isCovered: false,
          message: `Unable to validate pricing coverage with server (${err.message}). Please check connectivity and retry.`
        };
      }
    }
  },

  /**
   * Update or assign pricing coverage on a shipment.
   * Uses PATCH /shipments/:idOrCN/pricing first, falling back to live catalog resolution + PUT /shipments/:idOrCN if backend endpoint is unavailable (404).
   */
  async assignPricing(idOrCN, { action = 'revalidate', quotationId, rateCardId, reason, modifiedBy = 'Admin' } = {}) {
    try {
      return await apiRequest(`/shipments/${encodeURIComponent(idOrCN)}/pricing`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          quotationId,
          rateCardId,
          reason,
          modifiedBy
        })
      });
    } catch (err) {
      console.warn('[Pricing Service] PATCH /pricing fallback triggered via live PUT /shipments:', err.message);

      const [shipment, quotations, companies, rateCards] = await Promise.all([
        apiRequest(`/shipments/${encodeURIComponent(idOrCN)}`),
        apiRequest('/quotations').catch(() => []),
        apiRequest('/companies').catch(() => []),
        apiRequest('/rate-cards').catch(() => [])
      ]);

      if (!shipment) {
        throw new Error(`Shipment '${idOrCN}' not found.`);
      }

      const prevStatus = shipment.pricingValidation?.status || 'MISSING';
      const prevSource = shipment.pricingValidation?.source || 'NONE';
      const existingAudit = Array.isArray(shipment.pricingValidation?.auditLog)
        ? shipment.pricingValidation.auditLog
        : [];
      const targetMode = shipment.freightMode || shipment.mode || 'Air';
      const targetDate = shipment.bookingDate || shipment.cnDate || new Date().toISOString().split('T')[0];

      let updatedValidation = null;

      if (action === 'assign_quotation' && quotationId) {
        const qList = Array.isArray(quotations) ? quotations : [];
        const qIdLower = String(quotationId).trim().toLowerCase();
        const quote = qList.find((q) =>
          [q._id, q.id, q.quotationNumber].filter(Boolean).some((v) => String(v).trim().toLowerCase() === qIdLower)
        );
        if (!quote) {
          throw new Error(`Quotation '${quotationId}' not found.`);
        }

        const rulesList = [
          ...(Array.isArray(quote.rateRules) ? quote.rateRules : []),
          ...(Array.isArray(quote.routes) ? quote.routes : [])
        ];
        const matchedRule = findMatchingRuleInList(rulesList, shipment.origin, shipment.destination, targetMode) || rulesList[0] || {};
        const pricingSnapshot = buildClientPricingSnapshot({
          source: 'QUOTATION',
          doc: quote,
          matchedRule,
          origin: shipment.origin,
          destination: shipment.destination,
          mode: targetMode,
          date: targetDate,
          weight: shipment.chargeableWeight || shipment.actualWeight || 0
        });

        updatedValidation = {
          status: 'MATCHED',
          source: 'QUOTATION',
          quotationId: quote._id ? String(quote._id) : quote.id,
          quotationNumber: quote.quotationNumber,
          quotationVersion: quote.version || 1,
          agreementVersion: quote.version || 1,
          rateCardId: null,
          rateCardNumber: null,
          rateCardVersion: null,
          companyId: quote.companyId || shipment.companyId,
          companyCode: quote.companyCode || shipment.companyCode,
          companyName: quote.companyName || shipment.companyName,
          origin: shipment.origin,
          destination: shipment.destination,
          freightMode: targetMode,
          rateBasis: pricingSnapshot.rateBasis,
          appliedRate: pricingSnapshot.baseFreightRate,
          minimumChargeableWeight: pricingSnapshot.minimumWeight,
          appliedRuleSnapshot: {
            quotationNumber: quote.quotationNumber,
            version: quote.version || 1,
            origin: matchedRule.origin || shipment.origin,
            destination: matchedRule.destination || shipment.destination,
            mode: matchedRule.mode || targetMode,
            rateBasis: pricingSnapshot.rateBasis,
            freightRate: pricingSnapshot.baseFreightRate,
            minimumChargeableWeight: pricingSnapshot.minimumWeight,
            additionalCharges: matchedRule.additionalCharges || quote.additionalCharges || [],
            taxConfiguration: pricingSnapshot.taxConfiguration
          },
          pricingSnapshot,
          validatedAt: new Date().toISOString(),
          overrideConfirmed: false,
          overrideConfirmedBy: null,
          overrideConfirmedAt: null,
          isCovered: true,
          message: `Quotation Available – ${quote.quotationNumber} (v${quote.version || 1})`,
          auditLog: [
            ...existingAudit,
            {
              action: 'Quotation assigned manually',
              previousStatus: prevStatus,
              newStatus: 'MATCHED',
              previousSource: prevSource,
              newSource: 'QUOTATION',
              reason: reason || `Quotation ${quote.quotationNumber} assigned`,
              modifiedBy,
              modifiedAt: new Date().toISOString()
            }
          ]
        };
      } else if (action === 'assign_rate_card' && rateCardId) {
        const rcList = [
          ...(Array.isArray(rateCards) ? rateCards : []),
          ...(Array.isArray(quotations) ? quotations.filter((q) => q.isRateCard || !q.companyId || q.companyId === 'ALL') : [])
        ];
        const rcIdLower = String(rateCardId).trim().toLowerCase();
        const rc = rcList.find((r) =>
          [r._id, r.id, r.rateCardNumber, r.quotationNumber].filter(Boolean).some((v) => String(v).trim().toLowerCase() === rcIdLower)
        );
        if (!rc) {
          throw new Error(`Rate Card '${rateCardId}' not found.`);
        }

        const rulesList = [
          ...(Array.isArray(rc.rateRules) ? rc.rateRules : []),
          ...(Array.isArray(rc.routes) ? rc.routes : [])
        ];
        const matchedRule = findMatchingRuleInList(rulesList, shipment.origin, shipment.destination, targetMode) || rulesList[0] || {};
        const rcNumber = rc.rateCardNumber || rc.quotationNumber || rc.name || 'RC-STANDARD';
        const pricingSnapshot = buildClientPricingSnapshot({
          source: 'RATE_CARD',
          doc: rc,
          matchedRule,
          origin: shipment.origin,
          destination: shipment.destination,
          mode: targetMode,
          date: targetDate,
          weight: shipment.chargeableWeight || shipment.actualWeight || 0
        });

        updatedValidation = {
          status: 'MATCHED',
          source: 'RATE_CARD',
          quotationId: null,
          quotationNumber: null,
          quotationVersion: null,
          rateCardId: rc._id ? String(rc._id) : rc.id,
          rateCardNumber: rcNumber,
          rateCardName: rc.name || rcNumber,
          rateCardVersion: rc.version || 1,
          agreementVersion: rc.version || 1,
          companyId: shipment.companyId,
          companyCode: shipment.companyCode,
          companyName: shipment.companyName,
          origin: shipment.origin,
          destination: shipment.destination,
          freightMode: targetMode,
          rateBasis: pricingSnapshot.rateBasis,
          appliedRate: pricingSnapshot.baseFreightRate,
          minimumChargeableWeight: pricingSnapshot.minimumWeight,
          appliedRuleSnapshot: {
            rateCardNumber: rcNumber,
            rateCardName: rc.name || rcNumber,
            version: rc.version || 1,
            origin: matchedRule.origin || shipment.origin,
            destination: matchedRule.destination || shipment.destination,
            mode: matchedRule.mode || targetMode,
            rateBasis: pricingSnapshot.rateBasis,
            freightRate: pricingSnapshot.baseFreightRate,
            minimumChargeableWeight: pricingSnapshot.minimumWeight,
            additionalCharges: matchedRule.additionalCharges || rc.additionalCharges || [],
            taxConfiguration: pricingSnapshot.taxConfiguration
          },
          pricingSnapshot,
          validatedAt: new Date().toISOString(),
          overrideConfirmed: false,
          overrideConfirmedBy: null,
          overrideConfirmedAt: null,
          isCovered: true,
          message: `No Company Quotation – Charges Based on Rate Card (${rcNumber})`,
          auditLog: [
            ...existingAudit,
            {
              action: 'Rate card assigned manually',
              previousStatus: prevStatus,
              newStatus: 'MATCHED',
              previousSource: prevSource,
              newSource: 'RATE_CARD',
              reason: reason || `Rate Card ${rcNumber} assigned`,
              modifiedBy,
              modifiedAt: new Date().toISOString()
            }
          ]
        };
      } else {
        const reval = evaluatePricingFromCatalog({
          companies: Array.isArray(companies) ? companies : [],
          quotations: Array.isArray(quotations) ? quotations : [],
          rateCards: Array.isArray(rateCards) ? rateCards : [],
          companyId: shipment.companyId,
          companyCode: shipment.companyCode,
          companyName: shipment.companyName,
          origin: shipment.origin,
          destination: shipment.destination,
          freightMode: targetMode,
          mode: shipment.mode,
          date: targetDate
        });

        updatedValidation = {
          ...reval,
          overrideConfirmed: reval.status === 'MISSING' ? (shipment.pricingValidation?.overrideConfirmed || false) : false,
          overrideConfirmedBy: reval.status === 'MISSING' ? shipment.pricingValidation?.overrideConfirmedBy : null,
          overrideConfirmedAt: reval.status === 'MISSING' ? shipment.pricingValidation?.overrideConfirmedAt : null,
          validatedAt: new Date().toISOString(),
          auditLog: [
            ...existingAudit,
            {
              action: 'Pricing revalidated via catalog',
              previousStatus: prevStatus,
              newStatus: reval.status,
              previousSource: prevSource,
              newSource: reval.source,
              reason: reason || 'Triggered revalidation',
              modifiedBy,
              modifiedAt: new Date().toISOString()
            }
          ]
        };
      }

      const targetId = shipment._id || shipment.cnNumber || idOrCN;
      const updateBody = {
        cnNumber: shipment.cnNumber,
        pricingValidation: updatedValidation
      };

      if (updatedValidation.status === 'MATCHED' && updatedValidation.pricingSnapshot) {
        const snap = updatedValidation.pricingSnapshot;
        if (snap.pickupCharges > 0 && !(shipment.pickupCharges > 0)) updateBody.pickupCharges = snap.pickupCharges;
        if (snap.deliveryCharges > 0 && !(shipment.deliveryCharges > 0)) updateBody.deliveryCharges = snap.deliveryCharges;
        if (snap.gstPercentage !== undefined) {
          updateBody.gstRate = snap.gstPercentage;
          updateBody.isGstExempt = snap.gstPercentage === 0;
        }
        updateBody.billingSnapshot = {
          mode: targetMode,
          chargeableWeight: Math.max(shipment.chargeableWeight || shipment.actualWeight || 0, updatedValidation.minimumChargeableWeight || 0),
          ratePerKg: updatedValidation.appliedRate || 0,
          quotationNumber: updatedValidation.quotationNumber || updatedValidation.rateCardNumber,
          version: updatedValidation.agreementVersion || 1,
          pricingSource: updatedValidation.source
        };
      }

      const updatedShipment = await apiRequest(`/shipments/${encodeURIComponent(targetId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody)
      });

      return {
        success: true,
        message: updatedValidation.status === 'MATCHED'
          ? 'Pricing validation updated successfully'
          : updatedValidation.message,
        pricingValidation: updatedShipment?.pricingValidation || updatedValidation
      };
    }
  },

  /**
   * Fetch active rate cards
   */
  async getRateCards({ search = '', status = 'Active' } = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (status && status !== 'All') queryParams.append('status', status);

      const response = await apiRequest(`/rate-cards?${queryParams.toString()}`);
      return Array.isArray(response) ? response : [];
    } catch (err) {
      console.warn('[Pricing Service] Fetch rate cards error:', err.message);
      return [];
    }
  }
};
