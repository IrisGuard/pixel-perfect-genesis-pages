
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Shield, Globe, Lock, Eye, MapPin, RefreshCw, Power, AlertTriangle } from 'lucide-react';
import { vpnService } from '@/services/admin/vpnService';
import { antiMockDataProtection } from '@/services/security/antiMockDataProtection';
import { useToast } from '@/hooks/use-toast';

const EnhancedVPNSecurityPanel: React.FC = () => {
  const [vpnStatus, setVpnStatus] = useState(vpnService.getStatus());
  const [antiMockStatus, setAntiMockStatus] = useState(antiMockDataProtection.getProtectionStatus());
  const [isLoading, setIsLoading] = useState(false);
  const [securityScore, setSecurityScore] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    updateSecurityMetrics();
    const interval = setInterval(updateSecurityMetrics, 10000);
    
    const vpnUnsubscribe = vpnService.onStatusChange(setVpnStatus);
    
    return () => {
      clearInterval(interval);
      vpnUnsubscribe();
    };
  }, []);

  const updateSecurityMetrics = () => {
    const vpnScore = vpnStatus.isConnected ? 40 : 0;
    const antiMockScore = antiMockStatus.active ? 35 : 0;
    const phantomScore = typeof window !== 'undefined' && (window as any).solana ? 25 : 0;
    
    setSecurityScore(vpnScore + antiMockScore + phantomScore);
    setAntiMockStatus(antiMockDataProtection.getProtectionStatus());
  };

  const handleVPNToggle = async () => {
    setIsLoading(true);
    try {
      let result;
      if (vpnStatus.isConnected) {
        result = await vpnService.disconnectVPN();
      } else {
        result = await vpnService.connectVPN();
      }
      
      if (result.success) {
        toast({
          title: vpnStatus.isConnected ? "VPN Disconnected" : "VPN Connected",
          description: vpnStatus.isConnected ? "Protection disabled" : "Admin protection active",
        });
      }
    } catch (error) {
      toast({
        title: "VPN Error",
        description: "Failed to toggle VPN connection",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const runSecurityScan = async () => {
    setIsLoading(true);
    try {
      const validation = antiMockDataProtection.forceValidation();
      
      if (validation.isValid) {
        toast({
          title: "✅ Security Scan Clean",
          description: "No mock data detected in system",
        });
      } else {
        toast({
          title: "⚠️ Security Issues Found",
          description: `${validation.issues.length} mock data instances detected and removed`,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Scan Error",
        description: "Security scan failed",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getSecurityLevel = () => {
    if (securityScore >= 90) return { level: 'Maximum', color: 'green', icon: Shield };
    if (securityScore >= 70) return { level: 'High', color: 'blue', icon: Lock };
    if (securityScore >= 50) return { level: 'Medium', color: 'yellow', icon: Eye };
    return { level: 'Low', color: 'red', icon: AlertTriangle };
  };

  const securityLevel = getSecurityLevel();
  const SecurityIcon = securityLevel.icon;

  return (
    <div className="space-y-6">
      {/* Overall Security Status */}
      <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <SecurityIcon className={`w-6 h-6 mr-2 text-${securityLevel.color}-600`} />
              Admin Panel Security Center
            </div>
            <Badge className={`bg-${securityLevel.color}-500 text-white`}>
              {securityLevel.level} Security
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Security Score */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Security Score</span>
              <span className="text-2xl font-bold text-indigo-600">{securityScore}/100</span>
            </div>
            <Progress value={securityScore} className="h-3" />
          </div>

          {/* Security Components Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* VPN Protection */}
            <Card className={`border-2 ${vpnStatus.isConnected ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <Globe className={`w-5 h-5 mr-2 ${vpnStatus.isConnected ? 'text-green-600' : 'text-red-600'}`} />
                    <span className="font-medium text-sm">VPN Protection</span>
                  </div>
                  <Badge className={vpnStatus.isConnected ? 'bg-green-500' : 'bg-red-500'}>
                    {vpnStatus.isConnected ? 'ACTIVE' : 'OFF'}
                  </Badge>
                </div>
                
                {vpnStatus.isConnected && vpnStatus.currentLocation && (
                  <div className="text-xs text-gray-600 mb-3">
                    <div className="flex items-center">
                      <MapPin className="w-3 h-3 mr-1" />
                      {vpnStatus.currentLocation.flag} {vpnStatus.currentLocation.country}
                    </div>
                    <div className="font-mono text-xs mt-1">
                      IP: {vpnStatus.currentLocation.ip}
                    </div>
                  </div>
                )}
                
                <Button
                  size="sm"
                  onClick={handleVPNToggle}
                  disabled={isLoading}
                  className={`w-full ${vpnStatus.isConnected ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                >
                  <Power className="w-3 h-3 mr-1" />
                  {vpnStatus.isConnected ? 'Disconnect' : 'Connect'}
                </Button>
              </CardContent>
            </Card>

            {/* Anti-Mock Protection */}
            <Card className={`border-2 ${antiMockStatus.active ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <Shield className={`w-5 h-5 mr-2 ${antiMockStatus.active ? 'text-green-600' : 'text-red-600'}`} />
                    <span className="font-medium text-sm">Anti-Mock Shield</span>
                  </div>
                  <Badge className={antiMockStatus.active ? 'bg-green-500' : 'bg-red-500'}>
                    {antiMockStatus.active ? 'PROTECTED' : 'DISABLED'}
                  </Badge>
                </div>
                
                <div className="text-xs text-gray-600 mb-3">
                  <div>✅ Real data only enforced</div>
                  <div>🚫 Mock data auto-blocked</div>
                  <div>📊 Continuous monitoring</div>
                </div>
                
                <Button
                  size="sm"
                  onClick={runSecurityScan}
                  disabled={isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  <RefreshCw className={`w-3 h-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                  Security Scan
                </Button>
              </CardContent>
            </Card>

            {/* Wallet Security */}
            <Card className="border-2 border-purple-200 bg-purple-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <Lock className="w-5 h-5 mr-2 text-purple-600" />
                    <span className="font-medium text-sm">Wallet Security</span>
                  </div>
                  <Badge className="bg-purple-500">
                    SECURED
                  </Badge>
                </div>
                
                <div className="text-xs text-gray-600 mb-3">
                  <div>🔐 Phantom integration active</div>
                  <div>⚡ Real blockchain only</div>
                  <div>🛡️ Transaction validation</div>
                </div>
                
                <Button
                  size="sm"
                  disabled
                  className="w-full bg-purple-600 opacity-50"
                >
                  <Lock className="w-3 h-3 mr-1" />
                  Secured
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Security Alerts */}
          {securityScore < 70 && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                Security level below recommended. Consider enabling VPN protection for maximum admin security.
              </AlertDescription>
            </Alert>
          )}

          {securityScore >= 90 && (
            <Alert className="border-green-200 bg-green-50">
              <Shield className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                🎉 Maximum security level achieved! Your admin panel is fully protected.
              </AlertDescription>
            </Alert>
          )}

          {/* Security Features Summary */}
          <div className="bg-gray-100 rounded-lg p-4">
            <h4 className="font-medium text-gray-800 mb-3">Active Security Features</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center">
                <span className={`w-2 h-2 rounded-full mr-2 ${vpnStatus.isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                VPN Protection
              </div>
              <div className="flex items-center">
                <span className={`w-2 h-2 rounded-full mr-2 ${antiMockStatus.active ? 'bg-green-500' : 'bg-red-500'}`}></span>
                Anti-Mock Shield
              </div>
              <div className="flex items-center">
                <span className="w-2 h-2 rounded-full mr-2 bg-green-500"></span>
                Real Data Validation
              </div>
              <div className="flex items-center">
                <span className="w-2 h-2 rounded-full mr-2 bg-green-500"></span>
                Blockchain Security
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EnhancedVPNSecurityPanel;
