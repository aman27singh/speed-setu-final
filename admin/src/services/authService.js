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

    const inputClean = email.trim();

    try {
      // Try backend API first
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: inputClean, password })
      });
      if (res.token && res.user) {
        setStoredToken(res.token);
        localStorage.setItem('speedsetu_admin_user', JSON.stringify(res.user));
        return res;
      }
    } catch (err) {
      // If backend explicitly rejected credentials or returned error message, throw it
      if (err.message && !err.message.includes('Failed to fetch') && !err.message.includes('NetworkError')) {
        throw new Error(err.message || 'Invalid credentials. Please check username/email and password.');
      }
      console.warn('[AuthService] Backend unreachable, checking offline credentials...');
    }

    // Offline fallback ONLY for official admin credentials when backend is unreachable
    if ((inputClean.toLowerCase() === 'aman' || inputClean.toLowerCase() === 'aman@speedsetu.com') && password === 'Aman@1234') {
      const mockToken = 'mock_jwt_speed_setu_aman_' + Date.now();
      setStoredToken(mockToken);
      const user = { ...DEFAULT_ADMIN };
      localStorage.setItem('speedsetu_admin_user', JSON.stringify(user));
      return { token: mockToken, user };
    }

    // Reject all invalid credentials
    throw new Error('Invalid credentials. Please check username/email and password.');
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

    return null;
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
