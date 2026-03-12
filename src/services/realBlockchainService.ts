
import { Connection } from '@solana/web3.js';
import { environmentConfig } from '../config/environmentConfig';

class RealBlockchainService {
  private connection: Connection;

  constructor() {
    const rpcUrl = environmentConfig.getSolanaRpcUrl();
    this.connection = new Connection(rpcUrl, 'confirmed');
    console.log('🔗 RealBlockchainService initialized — live Solana RPC');
  }

  async verifyTransaction(signature: string) {
    console.log(`🔍 Verifying transaction on-chain: ${signature}`);

    try {
      const status = await this.connection.getSignatureStatus(signature, {
        searchTransactionHistory: true,
      });

      if (!status || !status.value) {
        return { verified: false, blockHeight: 0, confirmations: 0 };
      }

      const confirmed =
        status.value.confirmationStatus === 'confirmed' ||
        status.value.confirmationStatus === 'finalized';

      return {
        verified: confirmed && !status.value.err,
        blockHeight: status.value.slot ?? 0,
        confirmations: status.value.confirmations ?? 0,
      };
    } catch (error) {
      console.error('❌ On-chain verification failed:', error);
      return { verified: false, blockHeight: 0, confirmations: 0 };
    }
  }

  async getBlockchainHealth() {
    try {
      const [slot, epochInfo, voteAccounts] = await Promise.all([
        this.connection.getSlot(),
        this.connection.getEpochInfo(),
        this.connection.getVoteAccounts(),
      ]);

      return {
        networkStatus: 'healthy' as const,
        currentSlot: slot,
        epochProgress: (epochInfo.slotIndex / epochInfo.slotsInEpoch) * 100,
        validatorCount: voteAccounts.current.length + voteAccounts.delinquent.length,
      };
    } catch (error) {
      console.error('❌ Blockchain health check failed:', error);
      return {
        networkStatus: 'degraded' as const,
        currentSlot: 0,
        epochProgress: 0,
        validatorCount: 0,
      };
    }
  }
}

export const realBlockchainService = new RealBlockchainService();
