import { apiRequest } from './apiClient';

export const cnTemplateService = {
  async getActiveTemplate() {
    return apiRequest('/cn-templates/active', { skipDedupe: true });
  },

  async getDefaultTemplate() {
    return apiRequest('/cn-templates/default');
  },

  async getVersions() {
    return apiRequest('/cn-templates/versions', { skipDedupe: true });
  },

  async getVersion(versionOrId) {
    return apiRequest(`/cn-templates/versions/${encodeURIComponent(versionOrId)}`);
  },

  async saveTemplate({ name, config, changeNote }) {
    return apiRequest('/cn-templates', {
      method: 'POST',
      body: JSON.stringify({ name, config, changeNote }),
    });
  },

  async restoreVersion(versionOrId) {
    return apiRequest(`/cn-templates/restore/${encodeURIComponent(versionOrId)}`, {
      method: 'POST',
    });
  },

  async resetToDefault() {
    return apiRequest('/cn-templates/reset', {
      method: 'POST',
    });
  },
};
