import { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { authAPI, humanizeApiError, syncSellerBrandNameForUser } from '../services/api';

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
      const token = parsed?.token || parsed?.accessToken;
      if (parsed && token) {
        if (!parsed.token) {
          parsed.token = token;
        }
        // Apply role override if exists
        const roleOverride = localStorage.getItem(
          'brandhive_role_override'
        );
        if (!parsed.serverRole && parsed.role) {
          parsed.serverRole = parsed.role;
        }
        if (roleOverride) {
          parsed.role = roleOverride;
        }
        syncSellerBrandNameForUser(parsed);
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

      const token = responseData?.accessToken ||
        responseData?.token ||
        responseData?.data?.accessToken ||
        responseData?.data?.token;
      const refreshToken = responseData?.refreshToken ||
        responseData?.data?.refreshToken;
      const userData = responseData?.user || responseData?.data?.user || responseData;

      if (!token) {
        throw new Error('No token received from server');
      }

      const userToStore = {
        ...userData,
        serverRole: userData?.role || 'customer',
        role: userData?.role || 'customer',
        token,
        accessToken: token,
        refreshToken,
      };
      const roleOverride = localStorage.getItem('brandhive_role_override');
      if (roleOverride) {
        userToStore.role = roleOverride;
      }
      syncSellerBrandNameForUser(userToStore);
      setUser(userToStore);
      localStorage.setItem(
        'brandhive_user',
        JSON.stringify(userToStore)
      );
      return userToStore;
    } catch (err) {
      const message = humanizeApiError(
        err,
        'Login failed. Please try again.'
      );
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
      const token = responseData?.accessToken ||
        responseData?.token ||
        responseData?.data?.accessToken ||
        responseData?.data?.token;
      const refreshToken = responseData?.refreshToken ||
        responseData?.data?.refreshToken;
      const userData = responseData?.user || responseData?.data?.user || responseData;

      if (token) {
        const userToStore = {
          ...userData,
          email: userData?.email || email,
          name: userData?.name || name,
          serverRole: userData?.role || 'customer',
          role: userData?.role || 'customer',
          token,
          accessToken: token,
          refreshToken,
        };
        setUser(userToStore);
        localStorage.setItem('brandhive_user', JSON.stringify(userToStore));
        return userToStore;
      }

      // Registration succeeded — verify email before login (no token yet)
      const pendingUser = {
        email: userData?.email || email,
        name: userData?.name || name,
        userId: responseData?.userId || userData?.userId || userData?._id,
      };
      localStorage.setItem('brandhive_user', JSON.stringify(pendingUser));
      return pendingUser;
    } catch (err) {
      const raw = err.response?.data?.message;
      const message = Array.isArray(raw)
        ? raw.join(', ')
        : humanizeApiError(err, 'Registration failed. Please try again.');
      setError(message);
      throw new Error(message);
    } finally {
      setAuthLoading(false);
    }
  };

  // ── logout ────────────────────────────────────────────────────────────────
  const logout = async () => {
    try {
      const currentUser = JSON.parse(localStorage.getItem('brandhive_user'));
      if (currentUser?.email) {
        authAPI.logout({ email: currentUser.email }).catch(() => {});
      }
    } catch {
      // Even if API fails, clear local state
    } finally {
      setUser(null);
      localStorage.removeItem('brandhive_user');
      localStorage.removeItem('brandhive_cart');
      localStorage.removeItem('brandhive_wishlist');
      localStorage.removeItem('brandhive_role_override');
    }
  };

  // ── updateUser (local only, for profile edits) ────────────────────────────
  const updateUser = (updates) => {
    const updated = { ...user, ...updates };
    setUser(updated);
    localStorage.setItem('brandhive_user', JSON.stringify(updated));
  };

  // ── upgradeToSeller (after admin approval or local UI access) ─────────────
  const upgradeToSeller = (serverUser = null) => {
    const merged = { ...user, ...(serverUser || {}) };
    const roleFromServer =
      serverUser?.role || merged.serverRole || merged.role || 'customer';
    const isServerSeller =
      roleFromServer === 'seller' || roleFromServer === 'admin';

    const updated = {
      ...merged,
      id: merged.id || merged._id,
      _id: merged._id || merged.id,
      role: isServerSeller ? roleFromServer : 'seller',
      serverRole: isServerSeller ? roleFromServer : (merged.serverRole || merged.role || 'customer'),
      token: merged.token || merged.accessToken,
      accessToken: merged.accessToken || merged.token,
    };

    if (isServerSeller) {
      localStorage.removeItem('brandhive_role_override');
    } else {
      localStorage.setItem('brandhive_role_override', 'seller');
    }

    setUser(updated);
    localStorage.setItem('brandhive_user', JSON.stringify(updated));
    return updated;
  };

  // ── refreshSession — sync role/brand from GET /auth/me ────────────────────
  const refreshSession = async () => {
    try {
      const res = await authAPI.getMe();
      const payload = res.data?.data || res.data;
      const serverUser = payload?.user || payload;
      if (!serverUser?.email && !(serverUser?.id || serverUser?._id)) {
        return user;
      }

      const token = user?.token || user?.accessToken || serverUser.token;
      const serverRole = serverUser.role || user?.serverRole || 'customer';
      const updated = {
        ...user,
        ...serverUser,
        id: serverUser.id || serverUser._id || user?.id || user?._id,
        _id: serverUser._id || serverUser.id || user?._id || user?.id,
        serverRole,
        role: serverRole,
        token,
        accessToken: token,
        refreshToken: user?.refreshToken || serverUser.refreshToken,
      };

      const roleOverride = localStorage.getItem('brandhive_role_override');
      if (
        roleOverride &&
        serverRole !== 'seller' &&
        serverRole !== 'admin'
      ) {
        updated.role = roleOverride;
      } else if (serverRole === 'seller' || serverRole === 'admin') {
        localStorage.removeItem('brandhive_role_override');
        updated.role = serverRole;
      }

      syncSellerBrandNameForUser(updated);
      setUser(updated);
      localStorage.setItem('brandhive_user', JSON.stringify(updated));
      return updated;
    } catch {
      return user;
    }
  };

  const serverRole = user?.serverRole || user?.role || 'customer';
  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin';
  const isSeller = user?.role === 'seller';
  const isCustomer = user?.role === 'customer';
  const hasSellerApiAccess = serverRole === 'seller' || serverRole === 'admin';

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
        refreshSession,
        isAuthenticated,
        isAdmin,
        isSeller,
        isCustomer,
        hasSellerApiAccess,
        serverRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
