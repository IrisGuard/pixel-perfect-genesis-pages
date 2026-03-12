
import React, { createContext, useContext, useState, useEffect } from 'react';

interface AdminUser {
  username: string;
  email: string;
  role: 'admin' | 'ai_assistant';
}

interface AdminAuthContextType {
  isAuthenticated: boolean;
  user: AdminUser | null;
  login: (username: string, email: string, password1: string, password2: string, apiKey: string) => Promise<boolean>;
  logout: () => void;
  showAdminModal: boolean;
  setShowAdminModal: (show: boolean) => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

const verifyAdminKey = async (apiKey: string): Promise<boolean> => {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

  if (!apiKey || !projectId) return false;

  try {
    const response = await fetch(`https://${projectId}.supabase.co/functions/v1/admin-dashboard`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': apiKey,
      },
      body: JSON.stringify({ action: 'get_stats' }),
    });

    if (!response.ok) return false;

    const result = await response.json();
    return !result?.error;
  } catch {
    return false;
  }
};

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [showAdminModal, setShowAdminModal] = useState(false);

  useEffect(() => {
    const savedSession = localStorage.getItem('smbot_admin_session');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        const sessionTime = new Date(session.timestamp);
        const now = new Date();
        const hoursDiff = (now.getTime() - sessionTime.getTime()) / (1000 * 60 * 60);

        if (hoursDiff < 4) {
          setIsAuthenticated(true);
          setUser(session.user);
          if (session.adminKey) {
            (window as any).__ADMIN_KEY__ = session.adminKey;
          }
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

  const login = async (username: string, email: string, _password1: string, _password2: string, apiKey: string): Promise<boolean> => {
    const normalizedKey = apiKey.trim();
    const isKeyValid = await verifyAdminKey(normalizedKey);

    if (!isKeyValid) {
      return false;
    }

    const userData: AdminUser = {
      username: username.trim(),
      email: email.trim(),
      role: 'admin',
    };

    setIsAuthenticated(true);
    setUser(userData);
    setShowAdminModal(false);

    (window as any).__ADMIN_KEY__ = normalizedKey;

    const sessionData = {
      user: userData,
      timestamp: new Date().toISOString(),
      adminKey: normalizedKey,
    };

    localStorage.setItem('smbot_admin_session', JSON.stringify(sessionData));
    return true;
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
    (window as any).__ADMIN_KEY__ = '';
    localStorage.removeItem('smbot_admin_session');
  };

  return (
    <AdminAuthContext.Provider value={{
      isAuthenticated,
      user,
      login,
      logout,
      showAdminModal,
      setShowAdminModal
    }}>
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
