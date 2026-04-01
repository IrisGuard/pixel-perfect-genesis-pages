
import React from 'react';

const CostCalculation: React.FC<{ centralized: any; independent: any; solPriceEur: number }> = () => {
  return (
    <div style={{backgroundColor: '#4A5568'}} className="rounded-lg p-3 mt-2">
      <h3 className="text-white font-medium text-sm mb-2">💰 Cost Breakdown</h3>
      <div className="text-green-400 text-xs space-y-1">
        <div>✅ <strong>Buy Amount</strong>: Ποσό που μετατρέπεται σε tokens (deterministic).</div>
        <div>🔒 <strong>Buffer Locked</strong>: ~0.015 SOL/trade κλειδωμένο σε maker wallet — recoverable μέσω Sell + Drain.</div>
        <div>⛓️ <strong>Blockchain Fee</strong>: ~0.00012 SOL/trade — on-chain fee, ΔΕΝ επιστρέφεται.</div>
      </div>
      <div className="text-yellow-400 text-xs mt-2">
        ⚠️ Το πεδίο "Capital Used" στο admin = funded − auto-drained. Περιλαμβάνει budget + buffer + fees, <strong>ΔΕΝ</strong> είναι μόνο network fee.
      </div>
    </div>
  );
};

export default CostCalculation;
