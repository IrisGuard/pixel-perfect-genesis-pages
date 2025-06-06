
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';
import { AdminDashboardProps } from '../types/adminTypes';

export const SocialMediaTab: React.FC<AdminDashboardProps> = ({ 
  megaStats 
}) => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Social Media Integration (Coming Soon)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-600">Social media bot functionality will be implemented after completing the current trading systems.</p>
            <div className="mt-4">
              <p className="text-sm text-gray-500">Current social stats:</p>
              <p>Twitter: {megaStats.socialMedia.twitter ? 'Active' : 'Inactive'}</p>
              <p>Instagram: {megaStats.socialMedia.instagram ? 'Active' : 'Inactive'}</p>
              <p>Posts: {megaStats.socialMedia.posts}</p>
              <p>Engagement: {megaStats.socialMedia.engagement}%</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
