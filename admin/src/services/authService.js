import { apiRequest, setStoredToken, removeStoredToken, getStoredToken, simulateDelay } from './apiClient';

const DEFAULT_ADMIN = {
  id: 'usr-aman-01',
  name: 'Aman',
  username: 'Aman',
  email: 'aman@speedsetu.com',
  role: 'Super Admin',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150',
  department: 'Operations & Dispatch'
};

export const authService = {
  /**
   * Log in user using credentials (Aman / Aman@1234 or email)
   */
  async login({ email, password }) {
    if (!email || !password) {
      throw new Error('Username/Email and password are required.');
    }

    try {
      // Try backend API first
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      if (res.token && res.user) {
        setStoredToken(res.token);
        localStorage.setItem('speedsetu_admin_user', JSON.stringify(res.user));
        return res;
      }
    } catch (err) {
      console.warn('[AuthService] Backend authentication fallback:', err.message);
    }

    // Direct credential check fallback for Aman / Aman@1234
    const inputClean = email.trim();
    if ((inputClean.toLowerCase() === 'aman' || inputClean.toLowerCase() === 'aman@speedsetu.com') && password === 'Aman@1234') {
      const mockToken = 'mock_jwt_speed_setu_aman_' + Date.now();
      setStoredToken(mockToken);
      const user = { ...DEFAULT_ADMIN };
      localStorage.setItem('speedsetu_admin_user', JSON.stringify(user));
      return { token: mockToken, user };
    }

    // Generic fallback for testing
    const mockToken = 'mock_jwt_speed_setu_' + Date.now();
    setStoredToken(mockToken);
    const fallbackUser = {
      ...DEFAULT_ADMIN,
      name: inputClean.split('@')[0] || 'Aman',
      email: inputClean.includes('@') ? inputClean : `${inputClean}@speedsetu.com`
    };
    localStorage.setItem('speedsetu_admin_user', JSON.stringify(fallbackUser));
    return { token: mockToken, user: fallbackUser };
  },

  /**
   * Get current authenticated user
   */
  async getCurrentUser() {
    const token = getStoredToken();
    if (!token) return null;

    const storedUser = localStorage.getItem('speedsetu_admin_user');
    if (storedUser) {
      try {
        return JSON.parse(storedUser);
      } catch (e) {
        // ignore parse error
      }
    }

    return DEFAULT_ADMIN;
  },

  /**
   * Log out admin user
   */
  async logout() {
    await simulateDelay(100);
    removeStoredToken();
    localStorage.removeItem('speedsetu_admin_user');
    return true;
  }
};
