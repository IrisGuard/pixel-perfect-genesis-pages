
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Shield, 
  Eye, 
  Globe, 
  AlertTriangle, 
  Lock 
} from 'lucide-react';
import { AdminDashboardProps } from '../types/adminTypes';

export const SecurityTab: React.FC<AdminDashboardProps> = ({ 
  megaStats,
  securityConfig,
  setSecurityConfig,
  isLoading
}) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* VPN Protection */}
        <Card className="border-2 border-red-300">
          <CardHeader>
            <CardTitle className="flex items-center text-red-700">
              <Shield className="w-5 h-5 mr-2" />
              VPN Protection System
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">VPN Protection</span>
              <Switch
                checked={securityConfig.vpnEnabled}
                onCheckedChange={(checked) => 
                  setSecurityConfig(prev => ({ ...prev, vpnEnabled: checked }))
                }
              />
            </div>
            
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Active Connections:</span>
                  <span className="ml-2 font-bold">{megaStats.vpnProtection.connections}</span>
                </div>
                <div>
                  <span className="font-medium">Countries:</span>
                  <span className="ml-2 font-bold">{megaStats.vpnProtection.countries}</span>
                </div>
                <div>
                  <span className="font-medium">Status:</span>
                  <Badge className={megaStats.vpnProtection.active ? 'bg-green-500 ml-2' : 'bg-red-500 ml-2'}>
                    {megaStats.vpnProtection.active ? 'ACTIVE' : 'INACTIVE'}
                  </Badge>
                </div>
                <div>
                  <span className="font-medium">Encryption:</span>
                  <span className="ml-2 font-bold text-green-600">AES-256</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Button
                className="w-full bg-red-600 hover:bg-red-700"
                disabled={isLoading}
              >
                <Shield className="w-4 h-4 mr-2" />
                Configure VPN Settings
              </Button>
              
              <Button
                variant="outline"
                className="w-full"
                disabled={isLoading}
              >
                <Globe className="w-4 h-4 mr-2" />
                Change VPN Location
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Security Monitoring */}
        <Card className="border-2 border-yellow-300">
          <CardHeader>
            <CardTitle className="flex items-center text-yellow-700">
              <Eye className="w-5 h-5 mr-2" />
              Security Monitoring
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Active Alerts:</span>
                  <span className="ml-2 font-bold text-red-600">{megaStats.monitoring.alerts}</span>
                </div>
                <div>
                  <span className="font-medium">Error Count:</span>
                  <span className="ml-2 font-bold text-orange-600">{megaStats.monitoring.errors}</span>
                </div>
                <div>
                  <span className="font-medium">Rate Limiting:</span>
                  <Badge className={securityConfig.rateLimiting ? 'bg-green-500 ml-2' : 'bg-red-500 ml-2'}>
                    {securityConfig.rateLimiting ? 'ENABLED' : 'DISABLED'}
                  </Badge>
                </div>
                <div>
                  <span className="font-medium">Encryption Level:</span>
                  <span className="ml-2 font-bold text-green-600">{securityConfig.encryptionLevel.toUpperCase()}</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Rate Limiting</span>
                <Switch
                  checked={securityConfig.rateLimiting}
                  onCheckedChange={(checked) => 
                    setSecurityConfig(prev => ({ ...prev, rateLimiting: checked }))
                  }
                />
              </div>
              
              <Button
                className="w-full bg-yellow-600 hover:bg-yellow-700"
                disabled={isLoading}
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                View Security Logs
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Security Features */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Lock className="w-5 h-5 mr-2" />
            Advanced Security Features
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <h4 className="font-bold text-green-800 mb-2">🔐 Encryption</h4>
              <div className="text-sm text-green-700 space-y-1">
                <div>• AES-256 encryption for all data</div>
                <div>• End-to-end encrypted communications</div>
                <div>• Secure key management</div>
                <div>• Regular security audits</div>
              </div>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="font-bold text-blue-800 mb-2">🛡️ Access Control</h4>
              <div className="text-sm text-blue-700 space-y-1">
                <div>• Multi-factor authentication</div>
                <div>• IP address whitelisting</div>
                <div>• Session timeout controls</div>
                <div>• Admin privilege escalation</div>
              </div>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <h4 className="font-bold text-purple-800 mb-2">📊 Monitoring</h4>
              <div className="text-sm text-purple-700 space-y-1">
                <div>• Real-time threat detection</div>
                <div>• Automated alert system</div>
                <div>• Intrusion prevention</div>
                <div>• Comprehensive audit trails</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
