import { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { authAPI, humanizeApiError, syncSellerBrandNameForUser, syncHomepageStatsFromAdmin, incrementPublicBuyerCount, mergeUserWithMirrorProfile } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

const buildUserFromStorage = (parsed) => {
  const token = parsed?.token || parsed?.accessToken;
  if (!parsed || !token) return null;

  const serverRole = parsed.serverRole || parsed.role || 'customer';
  return {
    ...parsed,
    token,
    accessToken: token,
    serverRole,
    role: serverRole,
  };
};

const buildUserFromAuthResponse = (userData, token, refreshToken) => {
  const serverRole = userData?.role || 'customer';
  return {
    ...userData,
    serverRole,
    role: serverRole,
    token,
    accessToken: token,
    refreshToken,
  };
};

const persistUser = (userData) => {
  if (!userData) return;
  localStorage.setItem('brandhive_user', JSON.stringify(userData));
};

const clearAuthStorage = () => {
  localStorage.removeItem('brandhive_user');
  localStorage.removeItem('brandhive_cart');
  localStorage.removeItem('brandhive_wishlist');
  localStorage.removeItem('brandhive_role_override');
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const hydrateSession = async () => {
      const stored = localStorage.getItem('brandhive_user');
      if (!stored) {
        if (!cancelled) setLoading(false);
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse(stored);
      } catch {
        clearAuthStorage();
        if (!cancelled) setLoading(false);
        return;
      }

      const localUser = buildUserFromStorage(parsed);
      if (!localUser) {
        clearAuthStorage();
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const res = await authAPI.validateSession();
        const payload = res.data?.data || res.data;
        const serverUser = payload?.user || payload;
        const token = localUser.token || serverUser?.token || serverUser?.accessToken;
        const serverRole = serverUser?.role || localUser.serverRole || 'customer';

        const refreshed = {
          ...localUser,
          ...serverUser,
          id: serverUser?.id || serverUser?._id || localUser.id || localUser._id,
          _id: serverUser?._id || serverUser?.id || localUser._id || localUser.id,
          serverRole,
          role: serverRole,
          token,
          accessToken: token,
          refreshToken: localUser.refreshToken || serverUser?.refreshToken,
        };

        const merged = await mergeUserWithMirrorProfile(refreshed);

        if (!cancelled) {
          syncSellerBrandNameForUser(merged);
          setUser(merged);
          persistUser(merged);
          if (serverRole === 'admin') {
            syncHomepageStatsFromAdmin().catch(() => {});
          }
        }
      } catch (err) {
        const status = err.response?.status;
        if (status === 401 || status === 403) {
          clearAuthStorage();
          if (!cancelled) setUser(null);
        } else if (!cancelled) {
          syncSellerBrandNameForUser(localUser);
          setUser(localUser);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    hydrateSession();
    return () => {
      cancelled = true;
    };
  }, []);

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

      const userToStore = await mergeUserWithMirrorProfile(
        buildUserFromAuthResponse(userData, token, refreshToken)
      );
      syncSellerBrandNameForUser(userToStore);
      setUser(userToStore);
      persistUser(userToStore);

      if (userToStore.serverRole === 'admin') {
        syncHomepageStatsFromAdmin().catch(() => {});
      }
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
        const userToStore = buildUserFromAuthResponse(
          {
            ...userData,
            email: userData?.email || email,
            name: userData?.name || name,
          },
          token,
          refreshToken
        );
        setUser(userToStore);
        persistUser(userToStore);
        incrementPublicBuyerCount().catch(() => {});
        return userToStore;
      }

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

  const logout = async () => {
    try {
      const currentUser = JSON.parse(localStorage.getItem('brandhive_user') || 'null');
      if (currentUser?.email) {
        authAPI.logout({ email: currentUser.email }).catch(() => {});
      }
    } catch {
      // clear local state even if API fails
    } finally {
      setUser(null);
      clearAuthStorage();
    }
  };

  const updateUser = (updates) => {
    const updated = { ...user, ...updates };
    setUser(updated);
    persistUser(updated);
  };

  const upgradeToSeller = (serverUser = null) => {
    const merged = { ...user, ...(serverUser || {}) };
    const serverRole = serverUser?.role || merged.serverRole || merged.role || 'customer';

    if (serverRole !== 'seller' && serverRole !== 'admin') {
      return user;
    }

    const updated = {
      ...merged,
      id: merged.id || merged._id,
      _id: merged._id || merged.id,
      serverRole,
      role: serverRole,
      token: merged.token || merged.accessToken,
      accessToken: merged.accessToken || merged.token,
    };

    setUser(updated);
    persistUser(updated);
    return updated;
  };

  const refreshSession = async () => {
    try {
      const res = await authAPI.validateSession();
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

      const merged = await mergeUserWithMirrorProfile(updated);

      syncSellerBrandNameForUser(merged);
      setUser(merged);
      persistUser(merged);
      return merged;
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        setUser(null);
        clearAuthStorage();
      }
      return null;
    }
  };

  const serverRole = user?.serverRole || user?.role || 'customer';
  const isAuthenticated = !!user?.token;
  const isAdmin = serverRole === 'admin';
  const isSeller = serverRole === 'seller';
  const isCustomer = serverRole === 'customer';
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
