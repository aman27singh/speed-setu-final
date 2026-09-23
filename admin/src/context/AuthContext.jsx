import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { getStoredToken } from '../services/apiClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const token = getStoredToken();
      if (token) {
        try {
          const currentUser = await authService.getCurrentUser();
          setUser(currentUser);
        } catch (err) {
          console.error('Auth initialization error:', err);
          setUser(null);
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (credentials) => {
    setLoading(true);
    try {
      const response = await authService.login(credentials);
      setUser(response.user);
      return response;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await authService.logout();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const rawRole = user?.role || 'Super Admin';
  const role = rawRole;
  const normRole = String(rawRole).trim().toLowerCase();

  const isDriver = normRole === 'driver' || normRole === 'fleet manager' || normRole === 'fleet_manager' || user?.username?.toLowerCase() === 'driver' || user?.email?.toLowerCase().includes('driver');
  const isSuperAdmin = !isDriver && (normRole === 'super admin' || normRole === 'super_admin' || normRole === 'superadmin' || normRole === 'owner' || normRole === 'administrator' || normRole.includes('super admin'));
  const isAdmin = !isDriver;

  const hasRole = (allowedRoles) => {
    if (!allowedRoles || allowedRoles.length === 0) return true;
    if (isDriver && allowedRoles.includes('Driver')) return true;
    if (!isDriver) return true;
    return allowedRoles.some(r => r.toLowerCase() === normRole);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isSuperAdmin,
        isAdmin,
        isDriver,
        hasRole,
        isAuthenticated: !!user,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
