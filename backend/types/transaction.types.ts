export type ParsedTransactionType = "swap" | "transfer" | "unknown";

export interface ParsedTokenLeg {
  mint: string;
  symbol: string;
  amount: number;
}

export interface ParsedTransaction {
  type: ParsedTransactionType;
  token_in: string | null;
  token_out: string | null;
  symbol_in: string | null;
  symbol_out: string | null;
  amount_in: number;
  amount_out: number;
  timestamp: number;
  signature: string;
}

export interface TimelineEvent {
  signature: string;
  timestamp: number;
  action: string;
  type: ParsedTransactionType;
}

export interface TokenPnLItem {
  mint: string;
  symbol: string;
  qtyHeld: number;
  avgCost: number;
  realizedPnlUsd: number;
  unrealizedPnlUsd: number;
  totalPnlUsd: number;
  trades: number;
}

export interface WalletSummary {
  totalTrades: number;
  winRate: number;
  mostTradedTokens: Array<{ mint: string; symbol: string; trades: number }>;
  totalVolumeUsd: number;
}

export interface MissedOpportunity {
  token: string;
  symbol: string;
  missedProfitPercent: number;
  estimatedUsdLoss: number;
}
