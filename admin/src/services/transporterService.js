import { apiRequest, simulateDelay } from './apiClient';

let transportersStore = [];

export const transporterService = {
  async getTransporters(search = '', status = 'All') {
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (status && status !== 'All') queryParams.append('status', status);

      const remoteData = await apiRequest(`/transporters?${queryParams.toString()}`);
      if (Array.isArray(remoteData)) {
        transportersStore = remoteData.map((t) => ({
          ...t,
          id: t.id || t.transporterId || t._id
        }));

        return transportersStore.filter((t) => {
          if (status !== 'All' && t.status?.toLowerCase() !== status.toLowerCase()) return false;
          return true;
        });
      }
    } catch (err) {
      console.warn('[MongoDB Client] Transporters list fetch fallback:', err.message);
    }

    await simulateDelay(120);
    return transportersStore;
  },

  async getTransporter(id) {
    if (!id || id === 'undefined') throw new Error('Invalid Transporter identifier.');

    try {
      const response = await apiRequest(`/transporters/${encodeURIComponent(id)}`);
      if (response && (response.name || response._id)) {
        return {
          ...response,
          id: response.id || response.transporterId || response._id
        };
      }
    } catch (err) {
      console.warn('[MongoDB Client] Single transporter fetch fallback:', err.message);
    }

    await simulateDelay(100);
    const target = id.toLowerCase();
    const found = transportersStore.find(
      (t) => (t.id && t.id.toLowerCase() === target) || (t.transporterId && t.transporterId.toLowerCase() === target)
    );
    if (!found) throw new Error(`Transporter '${id}' not found.`);
    return { ...found };
  },

  async createTransporter(data) {
    try {
      const response = await apiRequest('/transporters', {
        method: 'POST',
        body: JSON.stringify(data)
      });

      if (response && (response.name || response._id)) {
        const formatted = {
          ...response,
          id: response.id || response.transporterId || response._id
        };
        transportersStore = [formatted, ...transportersStore];
        return formatted;
      }
    } catch (err) {
      console.warn('[MongoDB Client] Create transporter fallback:', err.message);
    }

    await simulateDelay(200);
    const nextNum = transportersStore.length + 1;
    const transporterId = data.transporterId || `TRP-VND-${String(nextNum).padStart(3, '0')}`;

    const newTransporter = {
      ...data,
      id: transporterId,
      transporterId,
      status: data.status || 'Active',
      createdAt: new Date().toISOString().split('T')[0]
    };

    transportersStore = [newTransporter, ...transportersStore];
    return { ...newTransporter };
  },

  async updateTransporter(id, updateData) {
    try {
      const response = await apiRequest(`/transporters/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      if (response && (response.name || response._id)) {
        const formatted = {
          ...response,
          id: response.id || response.transporterId || response._id
        };
        const index = transportersStore.findIndex((t) => t.id === formatted.id);
        if (index !== -1) transportersStore[index] = formatted;
        else transportersStore.unshift(formatted);
        return formatted;
      }
    } catch (err) {
      console.warn('[MongoDB Client] Update transporter fallback:', err.message);
    }

    await simulateDelay(180);
    const target = id.toLowerCase();
    const index = transportersStore.findIndex(
      (t) => (t.id && t.id.toLowerCase() === target) || (t.transporterId && t.transporterId.toLowerCase() === target)
    );
    if (index === -1) throw new Error(`Transporter '${id}' not found for update.`);

    transportersStore[index] = { ...transportersStore[index], ...updateData };
    return { ...transportersStore[index] };
  },

  async deactivateTransporter(id) {
    return this.updateTransporter(id, { status: 'Inactive' });
  }
};
