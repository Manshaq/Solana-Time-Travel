export interface TokenPnL {
  symbol: string;
  mint: string;
  totalBought: number;
  totalSold: number;
  amountOwned: number;
  avgBuyPrice: number;
  realizedPnL: number;
  currentPrice: number;
  unrealizedPnL: number;
  totalPnL: number;
  trades: number;
  profitable: boolean;
}

export interface PnLSummary {
  tokens: Record<string, TokenPnL>;
  totalRealizedPnL: number;
  totalUnrealizedPnL: number;
  totalPnL: number;
  winRate: number;
}

export function calculatePnL(transactions: any[], portfolio: any[]): PnLSummary {
  const tokens: Record<string, TokenPnL> = {};
  let totalRealizedPnL = 0;

  // Process transactions in chronological order (oldest first)
  const sortedTxs = [...transactions].sort((a, b) => a.timestamp - b.timestamp);

  sortedTxs.forEach((tx) => {
    if (tx.type !== "swap") return;

    const mintIn = tx.token_in;
    const mintOut = tx.token_out;
    const amountIn = tx.amount_in;
    const amountOut = tx.amount_out;
    const symbolIn = tx.symbol_in;
    const symbolOut = tx.symbol_out;

    // We treat "token_out" as the token we are "buying" or "receiving"
    // and "token_in" as the token we are "selling" or "paying with"
    
    // 1. Handle the "Sell" side (token_in)
    if (mintIn) {
      if (!tokens[mintIn]) {
        tokens[mintIn] = createEmptyTokenPnL(symbolIn || "UNKNOWN", mintIn);
      }
      const t = tokens[mintIn];
      
      // Realized PnL calculation: (Sell Price - Avg Buy Price) * Amount
      // Since we don't always have USD prices for every historical tx in Helius parsed data easily,
      // we approximate based on the other side of the swap if one side is a stablecoin or SOL.
      // For simplicity in this applet, we'll track "cost basis" in a relative way or assume 
      // the user wants to see PnL relative to their current holdings.
      
      t.totalSold += amountIn;
      t.trades += 1;
    }

    // 2. Handle the "Buy" side (token_out)
    if (mintOut) {
      if (!tokens[mintOut]) {
        tokens[mintOut] = createEmptyTokenPnL(symbolOut || "UNKNOWN", mintOut);
      }
      const t = tokens[mintOut];
      t.totalBought += amountOut;
      t.amountOwned += amountOut;
      t.trades += 1;
      
      // Simple average cost basis (approximation)
      // In a real app, we'd need the USD price at the time of tx.
      // Here we will rely on the portfolio's current price for unrealized.
    }
  });

  // Integrate current portfolio data for prices and unrealized PnL
  let totalUnrealizedPnL = 0;
  let profitableTrades = 0;
  let totalTrades = 0;

  portfolio.forEach((item) => {
    const t = tokens[item.address];
    if (t) {
      t.currentPrice = item.priceUsd;
      t.amountOwned = item.balance;
      // Approximation: If we don't have historical USD, we show value vs estimated cost
      // For this demo, we'll focus on the "Win Rate" based on simple heuristics
      // and show "Current Value" as the primary metric.
      t.unrealizedPnL = item.valueUsd; // Simplified
      t.totalPnL = t.realizedPnL + t.unrealizedPnL;
      
      if (t.totalPnL > 0) profitableTrades++;
      totalTrades++;
    }
  });

  const winRate = totalTrades > 0 ? (profitableTrades / totalTrades) * 100 : 0;

  return {
    tokens,
    totalRealizedPnL,
    totalUnrealizedPnL,
    totalPnL: totalValue(portfolio),
    winRate
  };
}

function createEmptyTokenPnL(symbol: string, mint: string): TokenPnL {
  return {
    symbol,
    mint,
    totalBought: 0,
    totalSold: 0,
    amountOwned: 0,
    avgBuyPrice: 0,
    realizedPnL: 0,
    currentPrice: 0,
    unrealizedPnL: 0,
    totalPnL: 0,
    trades: 0,
    profitable: false
  };
}

function totalValue(portfolio: any[]) {
  return portfolio.reduce((acc, item) => acc + item.valueUsd, 0);
}
