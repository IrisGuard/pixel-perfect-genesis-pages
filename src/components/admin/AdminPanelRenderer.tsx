
import React from 'react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import CompleteFactoryDashboard from './CompleteFactoryDashboard';
import { Button } from '@/components/ui/button';
import { LogOut, User } from 'lucide-react';

const AdminPanelRenderer: React.FC = () => {
  const { isAuthenticated, user, logout } = useAdminAuth();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-white">
      {/* Admin Header Bar */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-3 flex justify-between items-center shadow-lg">
        <div className="flex items-center">
          <User className="w-5 h-5 mr-2" />
          <span className="font-medium">
            Welcome, {user?.username} ({user?.role})
          </span>
        </div>
        <Button
          onClick={logout}
          variant="outline"
          size="sm"
          className="text-white border-white hover:bg-white hover:text-blue-600"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>

      {/* Admin Dashboard */}
      <div className="h-full overflow-auto">
        <CompleteFactoryDashboard />
      </div>
    </div>
  );
};

export default AdminPanelRenderer;
