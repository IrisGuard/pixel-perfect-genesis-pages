
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminDashboardProps } from '../types/adminTypes';

// Import tab components
import { OverviewTab } from '../tabs/OverviewTab';
import { MarketBotsTab } from '../tabs/MarketBotsTab';
import { StakingTab } from '../tabs/StakingTab';
import { BuySMBOTTab } from '../tabs/BuySMBOTTab';
import { SocialMediaTab } from '../tabs/SocialMediaTab';
import { WalletTab } from '../tabs/WalletTab';
import { APITab } from '../tabs/APITab';
import { SecurityTab } from '../tabs/SecurityTab';
import { MonitoringTab } from '../tabs/MonitoringTab';
import { AnalyticsTab } from '../tabs/AnalyticsTab';
import { TreasuryTab } from '../tabs/TreasuryTab';

interface AdminTabsProps {
  tabProps: AdminDashboardProps;
}

export const AdminTabs: React.FC<AdminTabsProps> = ({ tabProps }) => {
  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList className="grid w-full grid-cols-11">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="bots">Market Bots</TabsTrigger>
        <TabsTrigger value="staking">Staking</TabsTrigger>
        <TabsTrigger value="buy">Buy SMBOT</TabsTrigger>
        <TabsTrigger value="social">Social Media</TabsTrigger>
        <TabsTrigger value="wallet">Wallets</TabsTrigger>
        <TabsTrigger value="treasury">Treasury</TabsTrigger>
        <TabsTrigger value="api">APIs</TabsTrigger>
        <TabsTrigger value="security">Security</TabsTrigger>
        <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        <TabsTrigger value="analytics">Analytics</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <OverviewTab {...tabProps} />
      </TabsContent>

      <TabsContent value="bots">
        <MarketBotsTab {...tabProps} />
      </TabsContent>

      <TabsContent value="staking">
        <StakingTab {...tabProps} />
      </TabsContent>

      <TabsContent value="buy">
        <BuySMBOTTab {...tabProps} />
      </TabsContent>

      <TabsContent value="social">
        <SocialMediaTab {...tabProps} />
      </TabsContent>

      <TabsContent value="wallet">
        <WalletTab {...tabProps} />
      </TabsContent>

      <TabsContent value="treasury">
        <TreasuryTab {...tabProps} />
      </TabsContent>

      <TabsContent value="api">
        <APITab {...tabProps} />
      </TabsContent>

      <TabsContent value="security">
        <SecurityTab {...tabProps} />
      </TabsContent>

      <TabsContent value="monitoring">
        <MonitoringTab {...tabProps} />
      </TabsContent>

      <TabsContent value="analytics">
        <AnalyticsTab {...tabProps} />
      </TabsContent>
    </Tabs>
  );
};
