import { apiRequest, simulateDelay } from './apiClient';

let vehiclesStore = [];

export const vehicleService = {
  async getVehicles(search = '', status = 'All') {
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (status && status !== 'All') queryParams.append('status', status);

      const remoteData = await apiRequest(`/vehicles?${queryParams.toString()}`);
      if (Array.isArray(remoteData)) {
        vehiclesStore = remoteData.map((v) => ({
          ...v,
          id: v.id || v.vehicleNumber || v._id
        }));

        return vehiclesStore.filter((v) => {
          if (status !== 'All' && v.status?.toLowerCase() !== status.toLowerCase()) return false;
          return true;
        });
      }
    } catch (err) {
      console.warn('[MongoDB Client] Vehicles list fetch fallback:', err.message);
    }

    await simulateDelay(120);
    return vehiclesStore;
  },

  async getVehicle(id) {
    if (!id || id === 'undefined') throw new Error('Invalid Vehicle identifier.');

    try {
      const response = await apiRequest(`/vehicles/${encodeURIComponent(id)}`);
      if (response && (response.vehicleNumber || response._id)) {
        return {
          ...response,
          id: response.id || response.vehicleNumber || response._id
        };
      }
    } catch (err) {
      console.warn('[MongoDB Client] Single vehicle fetch fallback:', err.message);
    }

    await simulateDelay(100);
    const target = id.toLowerCase();
    const found = vehiclesStore.find(
      (v) => (v.id && v.id.toLowerCase() === target) || (v.vehicleNumber && v.vehicleNumber.toLowerCase() === target)
    );
    if (!found) throw new Error(`Vehicle '${id}' not found.`);
    return { ...found };
  },

  async createVehicle(data) {
    try {
      const response = await apiRequest('/vehicles', {
        method: 'POST',
        body: JSON.stringify(data)
      });

      if (response && (response.vehicleNumber || response._id)) {
        const formatted = {
          ...response,
          id: response.id || response.vehicleNumber || response._id
        };
        vehiclesStore = [formatted, ...vehiclesStore];
        return formatted;
      }
    } catch (err) {
      console.warn('[MongoDB Client] Create vehicle fallback:', err.message);
    }

    await simulateDelay(200);
    const newVehicle = {
      ...data,
      id: data.vehicleNumber,
      status: data.status || 'Available',
      createdAt: new Date().toISOString().split('T')[0]
    };

    vehiclesStore = [newVehicle, ...vehiclesStore];
    return { ...newVehicle };
  },

  async updateVehicle(id, updateData) {
    try {
      const response = await apiRequest(`/vehicles/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      if (response && (response.vehicleNumber || response._id)) {
        const formatted = {
          ...response,
          id: response.id || response.vehicleNumber || response._id
        };
        const index = vehiclesStore.findIndex((v) => v.vehicleNumber === formatted.vehicleNumber);
        if (index !== -1) vehiclesStore[index] = formatted;
        else vehiclesStore.unshift(formatted);
        return formatted;
      }
    } catch (err) {
      console.warn('[MongoDB Client] Update vehicle fallback:', err.message);
    }

    await simulateDelay(180);
    const target = id.toLowerCase();
    const index = vehiclesStore.findIndex(
      (v) => (v.id && v.id.toLowerCase() === target) || (v.vehicleNumber && v.vehicleNumber.toLowerCase() === target)
    );
    if (index === -1) throw new Error(`Vehicle '${id}' not found for update.`);

    vehiclesStore[index] = { ...vehiclesStore[index], ...updateData };
    return { ...vehiclesStore[index] };
  },

  async deactivateVehicle(id) {
    return this.updateVehicle(id, { status: 'Inactive' });
  }
};
