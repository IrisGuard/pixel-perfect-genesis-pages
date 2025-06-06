
import { transactionHistoryService } from './transactionHistoryService';
import { balanceService } from './balanceService';
import { autoTransferService } from './autoTransferService';

export class PaymentService {
  private static instance: PaymentService;

  static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  constructor() {
    console.log('💳 PaymentService initialized');
  }

  async collectUserPayment(userWallet: string, amount: number, sessionType: string): Promise<string> {
    try {
      console.log(`💰 Collecting payment: ${amount} SOL from ${userWallet} for ${sessionType}`);
      
      const paymentId = `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      transactionHistoryService.addTransaction({
        id: paymentId,
        type: 'user_payment',
        amount,
        from: userWallet,
        to: 'system',
        timestamp: Date.now()
      });
      
      console.log(`✅ Payment collected: ${paymentId}`);
      return paymentId;
      
    } catch (error) {
      console.error('❌ Payment collection failed:', error);
      throw error;
    }
  }

  async executeRefund(amount: number, userWallet: string): Promise<string> {
    try {
      console.log(`🔄 Executing refund: ${amount} SOL to ${userWallet}`);
      
      const refundId = `refund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      transactionHistoryService.addTransaction({
        id: refundId,
        type: 'user_payment',
        amount: -amount,
        from: 'system',
        to: userWallet,
        timestamp: Date.now()
      });
      
      console.log(`✅ Refund executed: ${refundId}`);
      return refundId;
      
    } catch (error) {
      console.error('❌ Refund execution failed:', error);
      throw error;
    }
  }

  async collectTradingProfits(amount: number): Promise<string> {
    try {
      console.log(`📈 Collecting trading profits: ${amount} SOL`);
      
      const profitId = `profit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      transactionHistoryService.addTransaction({
        id: profitId,
        type: 'profit_collection',
        amount,
        from: 'trading_system',
        to: 'treasury',
        timestamp: Date.now()
      });
      
      console.log(`✅ Trading profits collected: ${profitId}`);
      return profitId;
      
    } catch (error) {
      console.error('❌ Trading profit collection failed:', error);
      throw error;
    }
  }

  async getTreasuryStats() {
    const totalFees = transactionHistoryService.getTotalFeesCollected();
    const totalProfits = transactionHistoryService.getTotalProfitsCollected();
    const totalCollected = transactionHistoryService.getTotalCollected();
    const lastTransfer = transactionHistoryService.getLastTransferTime();
    const adminBalance = await balanceService.getAdminBalance();
    const phantomBalance = await balanceService.getYourPhantomBalance();
    const autoTransferSettings = autoTransferService.getAutoTransferSettings();

    return {
      totalFees,
      totalProfits,
      totalCollected,
      lastTransfer,
      transactionCount: transactionHistoryService.getTransactionHistory().length,
      adminBalance,
      phantomBalance,
      totalFeesCollected: totalFees,
      totalProfitsCollected: totalProfits,
      autoTransferActive: autoTransferSettings.enabled,
      lastTransferTime: lastTransfer,
      adminWallet: balanceService.getAdminWalletAddress(),
      phantomWallet: balanceService.getPhantomWalletAddress()
    };
  }

  getRealTimeStats() {
    return this.getTreasuryStats();
  }

  getTransactionHistory() {
    return transactionHistoryService.getTransactionHistory();
  }

  async transferToYourPhantom(amount: number) {
    return autoTransferService.executeTransferToPhantom(amount);
  }

  setAutoTransfer(enabled: boolean) {
    return autoTransferService.setAutoTransfer(enabled);
  }

  setAutoTransferThreshold(threshold: number) {
    return autoTransferService.setAutoTransferThreshold(threshold);
  }

  async getAdminBalance() {
    return balanceService.getAdminBalance();
  }
}

export const paymentService = PaymentService.getInstance();
