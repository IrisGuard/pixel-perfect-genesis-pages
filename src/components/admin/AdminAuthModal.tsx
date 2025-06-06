
import React from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import AdminLoginForm from './AdminLoginForm';

const AdminAuthModal: React.FC = () => {
  const { showAdminModal, setShowAdminModal } = useAdminAuth();

  return (
    <Dialog open={showAdminModal} onOpenChange={setShowAdminModal}>
      <DialogContent className="sm:max-w-md p-0 bg-transparent border-none shadow-none">
        <DialogTitle className="sr-only">Admin Authentication</DialogTitle>
        <AdminLoginForm />
      </DialogContent>
    </Dialog>
  );
};

export default AdminAuthModal;
