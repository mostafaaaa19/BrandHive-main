import { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);   // initial hydration loading
  const [authLoading, setAuthLoading] = useState(false); // async op loading
  const [error, setError] = useState(null);        // API error message

  // ── On mount: hydrate from localStorage ──────────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem('brandhive_user');
    if (!stored) {
      setLoading(false);
      return;
    }
    try {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.token) {
        // Apply role override if exists
        const roleOverride = localStorage.getItem(
          'brandhive_role_override'
        );
        if (roleOverride) {
          parsed.role = roleOverride;
        }
        setUser(parsed);
        // Also update localStorage with override applied
        localStorage.setItem(
          'brandhive_user', 
          JSON.stringify(parsed)
        );
      } else {
        localStorage.removeItem('brandhive_user');
      }
    } catch {
      localStorage.removeItem('brandhive_user');
    }
    setLoading(false);
  }, []);

  // ── login ─────────────────────────────────────────────────────────────────
  const login = async (email, password) => {
    setAuthLoading(true);
    setError(null);
    try {
      const res = await authAPI.login({ email, password });
      const responseData = res.data?.data || res.data;
      
      const token = responseData?.token || responseData?.accessToken;
      const refreshToken = responseData?.refreshToken;
      const userData = responseData?.user || responseData;

      if (!token) {
        throw new Error('No token received from server');
      }

      const stored = { 
        ...userData, 
        token,
        refreshToken 
      };
      setUser(stored);
      localStorage.setItem(
        'brandhive_user', 
        JSON.stringify(stored)
      );
      return stored;
    } catch (err) {
      const message =
        err.response?.data?.message || 
        err.message ||
        'Login failed. Please try again.';
      setError(message);
      throw new Error(message);
    } finally {
      setAuthLoading(false);
    }
  };

  // ── register ──────────────────────────────────────────────────────────────
  const register = async (name, email, password, confirmPassword, extraFields = {}) => {
    setAuthLoading(true);
    setError(null);
    try {
      const res = await authAPI.register({ name, email, password, confirmPassword, ...extraFields });
      const responseData = res.data?.data || res.data;
      const token = responseData?.token || responseData?.accessToken;
      const refreshToken = responseData?.refreshToken;
      const userData = responseData?.user || responseData;
      const stored = { ...userData, token, refreshToken };
      setUser(stored);
      localStorage.setItem('brandhive_user', JSON.stringify(stored));
      return stored;
    } catch (err) {
      const message =
        err.response?.data?.message || 'Registration failed. Please try again.';
      setError(message);
      throw new Error(message);
    } finally {
      setAuthLoading(false);
    }
  };

  // ── logout ────────────────────────────────────────────────────────────────
  const logout = () => {
    setUser(null);
    localStorage.removeItem('brandhive_user');
    localStorage.removeItem('brandhive_cart');
    localStorage.removeItem('brandhive_wishlist');
    localStorage.removeItem('brandhive_role_override');
  };

  // ── updateUser (local only, for profile edits) ────────────────────────────
  const updateUser = (updates) => {
    const updated = { ...user, ...updates };
    setUser(updated);
    localStorage.setItem('brandhive_user', JSON.stringify(updated));
  };

  // ── upgradeToSeller (called after successful brand creation) ──────────────
  const upgradeToSeller = () => {
    const updated = { ...user, role: 'seller' };
    setUser(updated);
    localStorage.setItem(
      'brandhive_user', 
      JSON.stringify(updated)
    );
    // Store role override separately as backup
    localStorage.setItem('brandhive_role_override', 'seller');
  };

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin';
  const isSeller = user?.role === 'seller';
  const isCustomer = user?.role === 'customer';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authLoading,
        error,
        setError,
        login,
        register,
        logout,
        updateUser,
        upgradeToSeller,
        isAuthenticated,
        isAdmin,
        isSeller,
        isCustomer,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
