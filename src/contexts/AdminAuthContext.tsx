import React, { createContext, useContext, useState, useEffect } from 'react';

interface AdminUser {
  username: string;
  email: string;
  role: 'admin';
}

interface AdminAuthContextType {
  isAuthenticated: boolean;
  user: AdminUser | null;
  login: (username: string, email: string, sessionToken: string, _p1: string, _p2: string) => Promise<boolean>;
  logout: () => void;
  showAdminModal: boolean;
  setShowAdminModal: (show: boolean) => void;
  sessionToken: string | null;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [showAdminModal, setShowAdminModal] = useState(false);

  useEffect(() => {
    const savedSession = localStorage.getItem('smbot_admin_session');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        const sessionTime = new Date(session.timestamp);
        const now = new Date();
        const hoursDiff = (now.getTime() - sessionTime.getTime()) / (1000 * 60 * 60);

        if (hoursDiff < 24) {
          setIsAuthenticated(true);
          setUser(session.user);
          setSessionToken(session.sessionToken || null);
        } else {
          localStorage.removeItem('smbot_admin_session');
        }
      } catch {
        localStorage.removeItem('smbot_admin_session');
      }
    }

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
      'smbot_admin_session',
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
    localStorage.removeItem('smbot_admin_session');
  };

  return (
    <AdminAuthContext.Provider
      value={{
        isAuthenticated,
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
