
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Settings, TrendingUp, DollarSign, Timer, Target } from 'lucide-react';
import { BotConfig, BotMode } from '@/types/botTypes';

interface BotConfigurationPanelProps {
  config: BotConfig;
  mode: BotMode;
  onConfigUpdate: (updates: Partial<BotConfig>) => void;
}

const BotConfigurationPanel: React.FC<BotConfigurationPanelProps> = ({
  config,
  mode,
  onConfigUpdate
}) => {
  const handleMakersChange = (increment: number) => {
    const newValue = Math.max(10, config.makers + increment);
    const maxMakers = mode === 'independent' ? 200 : 150;
    const finalValue = Math.min(maxMakers, newValue);
    
    onConfigUpdate({ 
      makers: finalValue,
      solSpend: mode === 'independent' 
        ? (finalValue / 150) * 0.256 
        : (finalValue / 120) * 0.198
    });
  };

  const handleVolumeChange = (increment: number) => {
    const newValue = Math.max(100, config.volume + increment);
    onConfigUpdate({ volume: newValue });
  };

  const handleSolSpendChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    onConfigUpdate({ solSpend: numValue });
  };

  const handleRuntimeChange = (increment: number) => {
    const newValue = Math.max(5, Math.min(180, config.runtime + increment));
    onConfigUpdate({ runtime: newValue });
  };

  const calculateEstimatedCost = (): number => {
    const baseCost = config.solSpend;
    const networkFees = config.makers * 0.000005;
    const jupiterFees = baseCost * 0.001;
    return baseCost + networkFees + jupiterFees;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Settings className="w-5 h-5 mr-2" />
          Step 3: Bot Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        <div className={`p-4 rounded-lg ${
          mode === 'independent' 
            ? 'bg-blue-50 border border-blue-200' 
            : 'bg-purple-50 border border-purple-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">
                {mode === 'independent' ? 'Enhanced Independent Mode' : 'Enhanced Centralized Mode'}
              </h4>
              <p className="text-sm text-gray-600">
                {mode === 'independent' 
                  ? 'Maximum decentralization with separate wallets'
                  : 'Optimized execution with cost savings'
                }
              </p>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold">
                {mode === 'independent' ? '0.25600' : '0.19800'} SOL
              </div>
              {mode === 'centralized' && (
                <div className="text-sm text-green-600">Save 24%</div>
              )}
            </div>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div>
            <Label className="text-base font-medium flex items-center">
              <TrendingUp className="w-4 h-4 mr-2" />
              Number of Makers *
            </Label>
            <div className="mt-2 flex items-center space-x-2">
              <Input
                type="number"
                value={config.makers}
                onChange={(e) => onConfigUpdate({ makers: parseInt(e.target.value) || 0 })}
                className="flex-1"
                min={10}
                max={mode === 'independent' ? 200 : 150}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleMakersChange(-10)}
                className="bg-red-50 hover:bg-red-100"
              >
                -10
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleMakersChange(10)}
                className="bg-green-50 hover:bg-green-100"
              >
                +10
              </Button>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              More makers = more trading wallets = higher volume appearance
            </p>
          </div>

          <div>
            <Label className="text-base font-medium flex items-center">
              <DollarSign className="w-4 h-4 mr-2" />
              Target Volume (USD) *
            </Label>
            <div className="mt-2 flex items-center space-x-2">
              <Input
                type="number"
                value={config.volume}
                onChange={(e) => onConfigUpdate({ volume: parseInt(e.target.value) || 0 })}
                className="flex-1"
                min={100}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleVolumeChange(-250)}
                className="bg-red-50 hover:bg-red-100"
              >
                -250
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleVolumeChange(250)}
                className="bg-green-50 hover:bg-green-100"
              >
                +250
              </Button>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Total USD volume to generate across all makers
            </p>
          </div>

          <div>
            <Label className="text-base font-medium flex items-center">
              <DollarSign className="w-4 h-4 mr-2" />
              SOL to Spend *
            </Label>
            <div className="mt-2">
              <Input
                type="number"
                step="0.001"
                value={config.solSpend}
                onChange={(e) => handleSolSpendChange(e.target.value)}
                className="w-full"
                min={0.01}
              />
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Total SOL amount for trading operations
            </p>
          </div>

          <div>
            <Label className="text-base font-medium flex items-center">
              <Timer className="w-4 h-4 mr-2" />
              Runtime (minutes) *
            </Label>
            <div className="mt-2 flex items-center space-x-2">
              <Input
                type="number"
                value={config.runtime}
                onChange={(e) => onConfigUpdate({ runtime: parseInt(e.target.value) || 0 })}
                className="flex-1"
                min={5}
                max={180}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRuntimeChange(-5)}
                className="bg-red-50 hover:bg-red-100"
              >
                -5
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRuntimeChange(5)}
                className="bg-green-50 hover:bg-green-100"
              >
                +5
              </Button>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              How long the bot will run (5-180 minutes)
            </p>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="font-medium">Advanced Settings</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Slippage Tolerance (%)</Label>
              <Select 
                value={config.slippage.toString()} 
                onValueChange={(value) => onConfigUpdate({ slippage: parseFloat(value) })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1% (Conservative)</SelectItem>
                  <SelectItem value="3">3% (Recommended)</SelectItem>
                  <SelectItem value="5">5% (Aggressive)</SelectItem>
                  <SelectItem value="10">10% (High Risk)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">Sell Strategy</Label>
              <Select 
                value={config.strategy} 
                onValueChange={(value) => onConfigUpdate({ strategy: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sell100">Sell 100%</SelectItem>
                  <SelectItem value="sell75">Sell 75%</SelectItem>
                  <SelectItem value="sell50">Sell 50%</SelectItem>
                  <SelectItem value="sell25">Sell 25%</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="autoSell"
              checked={config.autoSell}
              onChange={(e) => onConfigUpdate({ autoSell: e.target.checked })}
              className="w-4 h-4 text-blue-600"
            />
            <Label htmlFor="autoSell" className="text-sm">
              Auto-sell tokens after purchase
            </Label>
          </div>
        </div>

        <Separator />

        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium mb-3 flex items-center">
            <Target className="w-4 h-4 mr-2" />
            Cost Breakdown
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between">
              <span>Trading Amount:</span>
              <span className="font-medium">{config.solSpend.toFixed(4)} SOL</span>
            </div>
            <div className="flex justify-between">
              <span>Network Fees:</span>
              <span className="font-medium">{(config.makers * 0.000005).toFixed(6)} SOL</span>
            </div>
            <div className="flex justify-between">
              <span>Jupiter Fees:</span>
              <span className="font-medium">{(config.solSpend * 0.001).toFixed(6)} SOL</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t pt-2">
              <span>Total Estimated:</span>
              <span>{calculateEstimatedCost().toFixed(4)} SOL</span>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium mb-3">Expected Performance</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Estimated Duration:</span>
              <div className="font-medium">{config.runtime} minutes</div>
            </div>
            <div>
              <span className="text-gray-600">Trades per Minute:</span>
              <div className="font-medium">{(config.makers / config.runtime).toFixed(1)}</div>
            </div>
            <div>
              <span className="text-gray-600">Success Rate:</span>
              <div className="font-medium">{mode === 'independent' ? '99.7%' : '99.8%'}</div>
            </div>
            <div>
              <span className="text-gray-600">Volume Generation:</span>
              <div className="font-medium">${config.volume.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BotConfigurationPanel;
