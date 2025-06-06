
import React from 'react';
import EnhancedVPNSecurityPanel from '../EnhancedVPNSecurityPanel';
import { AdminDashboardProps } from '../types/adminTypes';

export const SecurityTab: React.FC<AdminDashboardProps> = ({ 
  megaStats 
}) => {
  return (
    <div className="space-y-6">
      <EnhancedVPNSecurityPanel />
    </div>
  );
};
