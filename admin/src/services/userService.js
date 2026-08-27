import { apiRequest } from './apiClient';

export const userService = {
  /**
   * Fetch all user accounts from MongoDB Atlas Cloud
   */
  async getUsers() {
    try {
      const data = await apiRequest('/users');
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.warn('[User Service] Error fetching users:', err.message);
      throw err;
    }
  },

  /**
   * Create a new user account in MongoDB Atlas Cloud
   */
  async createUser(userData) {
    try {
      return await apiRequest('/users', {
        method: 'POST',
        body: JSON.stringify(userData)
      });
    } catch (err) {
      console.warn('[User Service] Error creating user:', err.message);
      throw err;
    }
  },

  /**
   * Update existing user account in MongoDB Atlas Cloud
   */
  async updateUser(id, userData) {
    try {
      return await apiRequest(`/users/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(userData)
      });
    } catch (err) {
      console.warn('[User Service] Error updating user:', err.message);
      throw err;
    }
  },

  /**
   * Delete user account from MongoDB Atlas Cloud
   */
  async deleteUser(id) {
    try {
      return await apiRequest(`/users/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.warn('[User Service] Error deleting user:', err.message);
      throw err;
    }
  }
};
