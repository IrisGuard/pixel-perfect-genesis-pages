
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  verified: boolean;
  decimals: number;
  logoURI?: string;
}

interface TokenContextType {
  selectedToken: TokenInfo | null;
  setSelectedToken: (token: TokenInfo | null) => void;
  tokenValue: number; // SOL value for trading
  setTokenValue: (value: number) => void;
}

const TokenContext = createContext<TokenContextType | undefined>(undefined);

export const useToken = () => {
  const context = useContext(TokenContext);
  if (!context) {
    throw new Error('useToken must be used within a TokenProvider');
  }
  return context;
};

interface TokenProviderProps {
  children: ReactNode;
}

export const TokenProvider: React.FC<TokenProviderProps> = ({ children }) => {
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null);
  const [tokenValue, setTokenValue] = useState(3.20); // Updated default 3.20 SOL

  return (
    <TokenContext.Provider value={{
      selectedToken,
      setSelectedToken,
      tokenValue,
      setTokenValue
    }}>
      {children}
    </TokenContext.Provider>
  );
};
