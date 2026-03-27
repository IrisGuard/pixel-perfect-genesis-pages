import React, { createContext, useContext, useState, useEffect } from 'react';

interface AdminUser {
  username: string;
  email: string;
  role: 'admin';
}

interface AdminAuthContextType {
  isAuthenticated: boolean;
  isValidating: boolean;
  user: AdminUser | null;
  login: (username: string, email: string, sessionToken: string, _p1: string, _p2: string) => Promise<boolean>;
  logout: () => void;
  showAdminModal: boolean;
  setShowAdminModal: (show: boolean) => void;
  sessionToken: string | null;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);
const ADMIN_SESSION_STORAGE_KEY = 'smbot_admin_session';
const ADMIN_SESSION_INVALID_EVENT = 'smbot-admin-session-invalid';

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const clearAuthState = () => {
      if (!isMounted) return;
      setIsAuthenticated(false);
      setUser(null);
      setSessionToken(null);
      localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    };

    const validateStoredSession = async () => {
      const savedSession = localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
      if (!savedSession) {
        if (isMounted) setIsValidating(false);
        return;
      }

      try {
        const session = JSON.parse(savedSession);
        const storedToken = typeof session.sessionToken === 'string' ? session.sessionToken : '';
        const sessionTime = new Date(session.timestamp);
        const hoursDiff = (Date.now() - sessionTime.getTime()) / (1000 * 60 * 60);

        if (hoursDiff >= 24 || !storedToken || !session.user) {
          clearAuthState();
          if (isMounted) setIsValidating(false);
          return;
        }

        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'kwnthojndkdcgnvzugjb';
        const baseUrl = `https://${projectId}.supabase.co/functions/v1/admin-dashboard`;

        const response = await fetch(baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-session': storedToken,
          },
          body: JSON.stringify({ action: 'get_stats' }),
        });
        const data = await response.json().catch(() => null);

        if (!response.ok || data?.error) {
          clearAuthState();
          if (isMounted) setIsValidating(false);
          return;
        }

        if (!isMounted) return;
        setIsAuthenticated(true);
        setUser(session.user);
        setSessionToken(storedToken);
      } catch {
        clearAuthState();
      }
      if (isMounted) setIsValidating(false);
    };

    const handleInvalidSession = () => {
      clearAuthState();
      if (isMounted) {
        setShowAdminModal(true);
      }
    };

    validateStoredSession();
    window.addEventListener(ADMIN_SESSION_INVALID_EVENT, handleInvalidSession);

    return () => {
      isMounted = false;
      window.removeEventListener(ADMIN_SESSION_INVALID_EVENT, handleInvalidSession);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.altKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        if (!isAuthenticated) {
          setShowAdminModal(true);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isAuthenticated]);

  const login = async (
    username: string,
    email: string,
    token: string,
    _p1: string,
    _p2: string
  ): Promise<boolean> => {
    if (!username || !email || !token) return false;

    const userData: AdminUser = {
      username,
      email,
      role: 'admin',
    };

    setIsAuthenticated(true);
    setUser(userData);
    setSessionToken(token);
    setShowAdminModal(false);

    localStorage.setItem(
      ADMIN_SESSION_STORAGE_KEY,
      JSON.stringify({
        user: userData,
        sessionToken: token,
        timestamp: new Date().toISOString(),
      })
    );

    return true;
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
    setSessionToken(null);
    localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
  };

  return (
    <AdminAuthContext.Provider
      value={{
        isAuthenticated,
        isValidating,
        user,
        login,
        logout,
        showAdminModal,
        setShowAdminModal,
        sessionToken,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};
