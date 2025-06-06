
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Twitter, 
  Instagram, 
  Send, 
  BarChart3,
  Heart,
  Users,
  TrendingUp
} from 'lucide-react';
import { AdminDashboardProps } from '../types/adminTypes';

export const SocialMediaTab: React.FC<AdminDashboardProps> = ({ 
  megaStats,
  isLoading,
  toast,
  loadMegaAdminData,
  formatCurrency
}) => {
  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const handleSocialMediaToggle = async (platform: 'twitter' | 'instagram') => {
    const currentState = platform === 'twitter' ? 
      megaStats.socialMedia.twitter : 
      megaStats.socialMedia.instagram;
    
    localStorage.setItem(`${platform}_bot_active`, (!currentState).toString());
    
    toast({
      title: `${platform.charAt(0).toUpperCase() + platform.slice(1)} Bot ${!currentState ? 'Activated' : 'Deactivated'}`,
      description: `Social media bot for ${platform} is now ${!currentState ? 'active' : 'inactive'}`,
    });
    
    await loadMegaAdminData();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Twitter Bot Control */}
        <Card className="border-2 border-blue-300">
          <CardHeader>
            <CardTitle className="flex items-center text-blue-700">
              <Twitter className="w-5 h-5 mr-2" />
              Twitter Bot Advanced Control
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">Twitter Bot Status</span>
              <Switch
                checked={megaStats.socialMedia.twitter}
                onCheckedChange={() => handleSocialMediaToggle('twitter')}
              />
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Posts Published:</span>
                  <span className="ml-2 font-bold">{megaStats.socialMedia.posts}</span>
                </div>
                <div>
                  <span className="font-medium">Engagement Rate:</span>
                  <span className="ml-2 font-bold text-green-600">
                    {formatPercentage(megaStats.socialMedia.engagement)}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Auto Price Alerts:</span>
                  <Badge className="bg-green-500 ml-2">ENABLED</Badge>
                </div>
                <div>
                  <span className="font-medium">Staking Updates:</span>
                  <Badge className="bg-green-500 ml-2">ENABLED</Badge>
                </div>
                <div>
                  <span className="font-medium">Community Engagement:</span>
                  <Badge className="bg-green-500 ml-2">ACTIVE</Badge>
                </div>
                <div>
                  <span className="font-medium">Auto-Reply:</span>
                  <Badge className="bg-blue-500 ml-2">CONFIGURED</Badge>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Button 
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={isLoading}
              >
                <Send className="w-4 h-4 mr-2" />
                Post Platform Update
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full"
                disabled={isLoading}
              >
                <Twitter className="w-4 h-4 mr-2" />
                Configure Twitter API
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Instagram Bot Control */}
        <Card className="border-2 border-pink-300">
          <CardHeader>
            <CardTitle className="flex items-center text-pink-700">
              <Instagram className="w-5 h-5 mr-2" />
              Instagram Bot Advanced Control
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">Instagram Bot Status</span>
              <Switch
                checked={megaStats.socialMedia.instagram}
                onCheckedChange={() => handleSocialMediaToggle('instagram')}
              />
            </div>
            
            <div className="bg-pink-50 p-4 rounded-lg border border-pink-200">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Stories Published:</span>
                  <span className="ml-2 font-bold">{Math.floor(megaStats.socialMedia.posts * 0.7)}</span>
                </div>
                <div>
                  <span className="font-medium">Reach:</span>
                  <span className="ml-2 font-bold text-pink-600">2.3K</span>
                </div>
                <div>
                  <span className="font-medium">Auto Content:</span>
                  <Badge className="bg-pink-500 ml-2">ENABLED</Badge>
                </div>
                <div>
                  <span className="font-medium">Platform Updates:</span>
                  <Badge className="bg-pink-500 ml-2">ACTIVE</Badge>
                </div>
                <div>
                  <span className="font-medium">Community Stories:</span>
                  <Badge className="bg-pink-500 ml-2">ENABLED</Badge>
                </div>
                <div>
                  <span className="font-medium">Auto-Schedule:</span>
                  <Badge className="bg-purple-500 ml-2">CONFIGURED</Badge>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Button 
                className="w-full bg-pink-600 hover:bg-pink-700"
                disabled={isLoading}
              >
                <Send className="w-4 h-4 mr-2" />
                Create Story Update
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full"
                disabled={isLoading}
              >
                <Instagram className="w-4 h-4 mr-2" />
                Configure Instagram API
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Social Media Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            Social Media Analytics Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 text-center">
              <Twitter className="w-8 h-8 mx-auto mb-2 text-blue-500" />
              <div className="text-2xl font-bold text-blue-700">{megaStats.socialMedia.posts}</div>
              <div className="text-sm text-blue-600">Twitter Posts</div>
            </div>
            <div className="bg-pink-50 p-4 rounded-lg border border-pink-200 text-center">
              <Instagram className="w-8 h-8 mx-auto mb-2 text-pink-500" />
              <div className="text-2xl font-bold text-pink-700">{Math.floor(megaStats.socialMedia.posts * 0.7)}</div>
              <div className="text-sm text-pink-600">Instagram Stories</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200 text-center">
              <Heart className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <div className="text-2xl font-bold text-green-700">{formatPercentage(megaStats.socialMedia.engagement)}</div>
              <div className="text-sm text-green-600">Engagement Rate</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200 text-center">
              <Users className="w-8 h-8 mx-auto mb-2 text-purple-500" />
              <div className="text-2xl font-bold text-purple-700">4.2K</div>
              <div className="text-sm text-purple-600">Total Reach</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 text-center">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 text-orange-500" />
              <div className="text-2xl font-bold text-orange-700">+23%</div>
              <div className="text-sm text-orange-600">Growth Rate</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
