
import React from 'react';

const CostCalculation: React.FC<{ centralized: any; independent: any; solPriceEur: number }> = () => {
  return (
    <div style={{backgroundColor: '#4A5568'}} className="rounded-lg p-3 mt-2">
      <h3 className="text-white font-medium text-sm mb-2">💰 Fees</h3>
      <div className="text-green-400 text-xs">
        ✅ Χρησιμοποιούνται αποκλειστικά πραγματικά blockchain fees — χωρίς σταθερές τιμές.
      </div>
      <div className="text-gray-400 text-xs mt-1">
        Τα ακριβή fees καταγράφονται σε κάθε session στο backend (total_fees_lost).
      </div>
    </div>
  );
};

export default CostCalculation;
