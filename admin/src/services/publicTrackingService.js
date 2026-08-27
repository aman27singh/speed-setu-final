import { simulateDelay } from './apiClient';
import { shipmentService } from './shipmentService';

export const publicTrackingService = {
  /**
   * Secure Public CN Lookup Endpoint (GET /api/v1/public/track/{cnNumber})
   * Strictly filters out financial rates, margins, costs & private driver KYC.
   */
  async trackShipmentByCN(cnNumber) {
    await simulateDelay(300); // Simulate network lookup

    if (!cnNumber || !cnNumber.trim()) {
      throw new Error('Please enter a valid Consignment Note (CN) number.');
    }

    try {
      const s = await shipmentService.getShipment(cnNumber.trim());

      // Return ONLY sanitized public payload
      return {
        cnNumber: s.cnNumber,
        bookingDate: s.cnDate,
        origin: s.origin,
        destination: s.destination,
        mode: s.mode,
        packages: s.packages,
        actualWeight: s.actualWeight,
        status: s.status,
        currentLocation: s.operational?.currentLocation || s.origin,
        expectedDeliveryDate: s.operational?.expectedDeliveryDate || 'TBD',
        statusHistory: (s.statusHistory || []).map((h) => ({
          status: h.status,
          timestamp: h.timestamp,
          location: h.location
        })),
        podAvailable: s.podStatus === 'Uploaded' || s.podStatus === 'Verified'
      };
    } catch (err) {
      throw new Error('Shipment Not Found. Please check the CN number and try again.');
    }
  }
};
