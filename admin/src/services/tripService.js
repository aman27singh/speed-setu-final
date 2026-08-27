import { apiRequest, simulateDelay } from './apiClient';
import { shipmentService } from './shipmentService';

let tripsStore = [];
let tripCounter = 103;

export const tripService = {
  async generateNextTripID() {
    await simulateDelay(50);
    return `TRP-${tripCounter}`;
  },

  async getTrips({ search = '', status = 'All', mode = 'All', transporterId = 'All' } = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (status && status !== 'All') queryParams.append('status', status);

      const remoteData = await apiRequest(`/trips?${queryParams.toString()}`);
      if (Array.isArray(remoteData)) {
        tripsStore = remoteData.map((t) => ({
          ...t,
          id: t.id || t.tripNumber || t._id
        }));

        return tripsStore.filter((t) => {
          if (status !== 'All' && t.status?.toLowerCase() !== status.toLowerCase()) return false;
          if (mode !== 'All' && t.mode?.toLowerCase() !== mode.toLowerCase()) return false;
          return true;
        });
      }
    } catch (err) {
      console.warn('[MongoDB Client] Trips list fetch fallback:', err.message);
    }

    await simulateDelay(150);

    return tripsStore.filter((t) => {
      if (status !== 'All' && t.status.toLowerCase() !== status.toLowerCase()) return false;
      if (mode !== 'All' && t.mode?.toLowerCase() !== mode.toLowerCase()) return false;

      if (search.trim()) {
        const q = search.toLowerCase().trim();
        return (
          t.tripNumber.toLowerCase().includes(q) ||
          t.origin.toLowerCase().includes(q) ||
          t.destination.toLowerCase().includes(q)
        );
      }
      return true;
    });
  },

  async getTrip(idOrNumber) {
    if (!idOrNumber || idOrNumber === 'undefined') {
      throw new Error('Invalid Trip identifier.');
    }

    try {
      const response = await apiRequest(`/trips/${encodeURIComponent(idOrNumber)}`);
      if (response && (response.tripNumber || response._id)) {
        return {
          ...response,
          id: response.id || response.tripNumber || response._id
        };
      }
    } catch (err) {
      console.warn('[MongoDB Client] Single trip fetch fallback:', err.message);
    }

    await simulateDelay(120);
    const target = idOrNumber.toLowerCase();
    const found = tripsStore.find(
      (t) =>
        (t.id && t.id.toLowerCase() === target) ||
        (t.tripNumber && t.tripNumber.toLowerCase() === target)
    );
    if (!found) throw new Error(`Trip '${idOrNumber}' not found.`);
    return { ...found };
  },

  async createTrip(tripData) {
    try {
      const response = await apiRequest('/trips', {
        method: 'POST',
        body: JSON.stringify(tripData)
      });

      if (response && (response.tripNumber || response._id)) {
        const formatted = {
          ...response,
          id: response.id || response.tripNumber || response._id
        };
        tripsStore = [formatted, ...tripsStore];

        if (formatted.shipmentIds && formatted.shipmentIds.length > 0) {
          for (const sId of formatted.shipmentIds) {
            try {
              await shipmentService.updateShipment(sId, {
                operational: { tripId: formatted.tripNumber }
              });
            } catch (e) {
              console.warn(`Could not update shipment ${sId} trip reference:`, e);
            }
          }
        }
        return formatted;
      }
    } catch (err) {
      console.warn('[MongoDB Client] Create trip fallback:', err.message);
    }

    await simulateDelay(250);
    const generatedID = `TRP-${tripCounter++}`;
    const id = generatedID;

    const initialHistory = [
      {
        status: tripData.status || 'Planned',
        timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
        location: tripData.origin || 'Dispatch Office',
        remarks: `Trip ${generatedID} created.`
      }
    ];

    const newTrip = {
      ...tripData,
      id,
      tripNumber: generatedID,
      tripDate: tripData.tripDate || new Date().toISOString().split('T')[0],
      shipmentIds: tripData.shipmentIds || [],
      status: tripData.status || 'Planned',
      statusHistory: initialHistory,
      documents: tripData.documents || [],
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0]
    };

    tripsStore = [newTrip, ...tripsStore];

    if (newTrip.shipmentIds && newTrip.shipmentIds.length > 0) {
      for (const sId of newTrip.shipmentIds) {
        try {
          await shipmentService.updateShipment(sId, {
            operational: { tripId: generatedID }
          });
        } catch (e) {
          console.warn(`Could not update shipment ${sId} trip reference:`, e);
        }
      }
    }

    return { ...newTrip };
  },

  async updateTrip(idOrNumber, updateData) {
    try {
      const response = await apiRequest(`/trips/${encodeURIComponent(idOrNumber)}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      if (response && (response.tripNumber || response._id)) {
        const formatted = {
          ...response,
          id: response.id || response.tripNumber || response._id
        };
        const index = tripsStore.findIndex((t) => t.tripNumber === formatted.tripNumber);
        if (index !== -1) tripsStore[index] = formatted;
        else tripsStore.unshift(formatted);
        return formatted;
      }
    } catch (err) {
      console.warn('[MongoDB Client] Update trip fallback:', err.message);
    }

    await simulateDelay(200);
    const target = idOrNumber.toLowerCase();
    const index = tripsStore.findIndex(
      (t) => (t.id && t.id.toLowerCase() === target) || (t.tripNumber && t.tripNumber.toLowerCase() === target)
    );

    if (index === -1) throw new Error(`Trip '${idOrNumber}' not found for update.`);

    const updatedTrip = {
      ...tripsStore[index],
      ...updateData,
      updatedAt: new Date().toISOString().split('T')[0]
    };

    tripsStore[index] = updatedTrip;
    return { ...updatedTrip };
  }
};
