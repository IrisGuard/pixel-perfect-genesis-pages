
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Power, Activity, RotateCcw } from 'lucide-react';

interface AdminEmergencyControlsProps {
  isLoading: boolean;
  onEmergencyStop: () => void;
  onSystemDiagnostics: () => void;
  onResetDashboard: () => void;
}

export const AdminEmergencyControls: React.FC<AdminEmergencyControlsProps> = ({
  isLoading,
  onEmergencyStop,
  onSystemDiagnostics,
  onResetDashboard
}) => {
  return (
    <Card className="border-2 border-red-300 bg-red-50">
      <CardHeader>
        <CardTitle className="flex items-center text-red-700">
          <AlertTriangle className="w-6 h-6 mr-2" />
          Emergency Controls
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex space-x-4">
          <Button
            onClick={onEmergencyStop}
            disabled={isLoading}
            variant="destructive"
            className="flex-1"
          >
            <Power className="w-4 h-4 mr-2" />
            Emergency Stop All Systems
          </Button>
          
          <Button
            onClick={onSystemDiagnostics}
            disabled={isLoading}
            variant="outline"
            className="flex-1"
          >
            <Activity className="w-4 h-4 mr-2" />
            Run Full System Diagnostics
          </Button>
          
          <Button
            onClick={onResetDashboard}
            variant="outline"
            className="flex-1"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset Dashboard
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
