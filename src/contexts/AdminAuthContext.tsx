
import React, { createContext, useContext, useState, useEffect } from 'react';

interface AdminUser {
  username: string;
  email: string;
  role: 'admin' | 'ai_assistant';
}

interface AdminAuthContextType {
  isAuthenticated: boolean;
  user: AdminUser | null;
  login: (username: string, email: string, password1: string, password2: string) => boolean;
  logout: () => void;
  showAdminModal: boolean;
  setShowAdminModal: (show: boolean) => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

// Hardcoded admin credentials - secure access only
const ADMIN_CREDENTIALS = [
  {
    username: 'admin_master',
    email: 'admin@smbot.com',
    password1: 'SMB0T_Admin_2024!',
    password2: 'Factory_Control_2024!',
    role: 'admin' as const
  },
  {
    username: 'ai_assistant_1',
    email: 'ai1@smbot.com',
    password1: 'AI_Helper_2024!',
    password2: 'Lovable_AI_2024!',
    role: 'ai_assistant' as const
  },
  {
    username: 'ai_assistant_2',
    email: 'ai2@smbot.com',
    password1: 'AI_Helper_2024!',
    password2: 'Lovable_AI_2024!',
    role: 'ai_assistant' as const
  },
  {
    username: 'ai_assistant_3',
    email: 'ai3@smbot.com',
    password1: 'AI_Helper_2024!',
    password2: 'Lovable_AI_2024!',
    role: 'ai_assistant' as const
  }
];

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [showAdminModal, setShowAdminModal] = useState(false);

  useEffect(() => {
    // Check for existing session
    const savedSession = localStorage.getItem('smbot_admin_session');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        const sessionTime = new Date(session.timestamp);
        const now = new Date();
        const hoursDiff = (now.getTime() - sessionTime.getTime()) / (1000 * 60 * 60);

        // Session expires after 4 hours
        if (hoursDiff < 4) {
          setIsAuthenticated(true);
          setUser(session.user);
        } else {
          localStorage.removeItem('smbot_admin_session');
        }
      } catch (error) {
        localStorage.removeItem('smbot_admin_session');
      }
    }

    // Global keyboard listener for Ctrl+Alt+A
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

  const login = (username: string, email: string, password1: string, password2: string): boolean => {
    const credential = ADMIN_CREDENTIALS.find(
      cred => 
        cred.username === username &&
        cred.email === email &&
        cred.password1 === password1 &&
        cred.password2 === password2
    );

    if (credential) {
      const userData: AdminUser = {
        username: credential.username,
        email: credential.email,
        role: credential.role
      };

      setIsAuthenticated(true);
      setUser(userData);
      setShowAdminModal(false);

      // Save secure session
      const sessionData = {
        user: userData,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('smbot_admin_session', JSON.stringify(sessionData));

      return true;
    }

    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
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
