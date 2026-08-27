import { apiRequest, simulateDelay } from './apiClient';

let driversStore = [];

export const driverService = {
  async getDrivers(search = '', status = 'All') {
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (status && status !== 'All') queryParams.append('status', status);

      const remoteData = await apiRequest(`/drivers?${queryParams.toString()}`);
      if (Array.isArray(remoteData)) {
        driversStore = remoteData.map((d) => ({
          ...d,
          id: d.id || d.driverId || d._id
        }));

        return driversStore.filter((d) => {
          if (status !== 'All' && d.status?.toLowerCase() !== status.toLowerCase()) return false;
          return true;
        });
      }
    } catch (err) {
      console.warn('[MongoDB Client] Drivers list fetch fallback:', err.message);
    }

    await simulateDelay(120);
    return driversStore;
  },

  async getDriver(id) {
    if (!id || id === 'undefined') throw new Error('Invalid Driver identifier.');

    try {
      const response = await apiRequest(`/drivers/${encodeURIComponent(id)}`);
      if (response && (response.name || response._id)) {
        return {
          ...response,
          id: response.id || response.driverId || response._id
        };
      }
    } catch (err) {
      console.warn('[MongoDB Client] Single driver fetch fallback:', err.message);
    }

    await simulateDelay(100);
    const target = id.toLowerCase();
    const found = driversStore.find(
      (d) => (d.id && d.id.toLowerCase() === target) || (d.driverId && d.driverId.toLowerCase() === target)
    );
    if (!found) throw new Error(`Driver '${id}' not found.`);
    return { ...found };
  },

  async createDriver(data) {
    try {
      const response = await apiRequest('/drivers', {
        method: 'POST',
        body: JSON.stringify(data)
      });

      if (response && (response.name || response._id)) {
        const formatted = {
          ...response,
          id: response.id || response.driverId || response._id
        };
        driversStore = [formatted, ...driversStore];
        return formatted;
      }
    } catch (err) {
      console.warn('[MongoDB Client] Create driver fallback:', err.message);
    }

    await simulateDelay(200);
    const nextNum = driversStore.length + 1;
    const driverId = data.driverId || `DRV-${String(nextNum).padStart(3, '0')}`;

    const newDriver = {
      ...data,
      id: driverId,
      driverId,
      status: data.status || 'Active',
      createdAt: new Date().toISOString().split('T')[0]
    };

    driversStore = [newDriver, ...driversStore];
    return { ...newDriver };
  },

  async updateDriver(id, updateData) {
    try {
      const response = await apiRequest(`/drivers/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      if (response && (response.name || response._id)) {
        const formatted = {
          ...response,
          id: response.id || response.driverId || response._id
        };
        const index = driversStore.findIndex((d) => d.id === formatted.id);
        if (index !== -1) driversStore[index] = formatted;
        else driversStore.unshift(formatted);
        return formatted;
      }
    } catch (err) {
      console.warn('[MongoDB Client] Update driver fallback:', err.message);
    }

    await simulateDelay(180);
    const target = id.toLowerCase();
    const index = driversStore.findIndex(
      (d) => (d.id && d.id.toLowerCase() === target) || (d.driverId && d.driverId.toLowerCase() === target)
    );
    if (index === -1) throw new Error(`Driver '${id}' not found for update.`);

    driversStore[index] = { ...driversStore[index], ...updateData };
    return { ...driversStore[index] };
  },

  async deactivateDriver(id) {
    return this.updateDriver(id, { status: 'Inactive' });
  }
};
