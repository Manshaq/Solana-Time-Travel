import { DEFAULT_LIMIT, MAX_LIMIT, STABLE_MINTS, STABLE_SYMBOLS } from "../utils/constants";
import { parseTransaction } from "./parser.service";
import { getTokenPrices } from "./price.service";
import { getWalletTransactions } from "./rpc.service";
import type {
  MissedOpportunity,
  ParsedTransaction,
  TimelineEvent,
  TokenPnLItem,
  WalletSummary,
} from "../types/transaction.types";

function normalizeLimit(limit?: number): number {
  if (!limit || Number.isNaN(limit)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(limit)));
}

function isStable(symbol: string | null, mint: string | null): boolean {
  if (symbol && STABLE_SYMBOLS.has(symbol)) return true;
  if (mint && STABLE_MINTS.has(mint)) return true;
  return false;
}

function txUsdValue(tx: ParsedTransaction, prices: Record<string, number>): number {
  const inPrice = tx.token_in ? prices[tx.token_in] || 0 : 0;
  const outPrice = tx.token_out ? prices[tx.token_out] || 0 : 0;
  const inValue = inPrice * tx.amount_in;
  const outValue = outPrice * tx.amount_out;
  return Math.max(inValue, outValue);
}

export async function fetchParsedTransactions(address: string, limit?: number): Promise<ParsedTransaction[]> {
  const normalizedLimit = normalizeLimit(limit);
  const rawTxs = await getWalletTransactions(address, normalizedLimit);
  return rawTxs
    .map((tx) => parseTransaction(tx, address))
    .filter((tx) => tx.signature && tx.timestamp > 0)
    .sort((a, b) => b.timestamp - a.timestamp);
}

export function buildTimeline(transactions: ParsedTransaction[]): TimelineEvent[] {
  const sorted = [...transactions].sort((a, b) => a.timestamp - b.timestamp);
  return sorted.map((tx) => {
    let action = "Unknown action";
    if (tx.type === "swap") {
      action = `Swapped ${tx.symbol_in || "TOKEN"} → ${tx.symbol_out || "TOKEN"}`;
    } else if (tx.type === "transfer") {
      if (tx.amount_in > 0) {
        action = `Sent ${tx.symbol_in || "TOKEN"}`;
      } else if (tx.amount_out > 0) {
        action = `Received ${tx.symbol_out || "TOKEN"}`;
      } else {
        action = "Transfer";
      }
    }
    return {
      signature: tx.signature,
      timestamp: tx.timestamp,
      action,
      type: tx.type,
    };
  });
}

export async function buildPnl(transactions: ParsedTransaction[]): Promise<{
  totalPnlUsd: number;
  perTokenPnl: TokenPnLItem[];
}> {
  const swaps = transactions.filter((tx) => tx.type === "swap");
  const mints = swaps.flatMap((tx) => [tx.token_in, tx.token_out]).filter((m): m is string => Boolean(m));
  const prices = await getTokenPrices(mints);

  const buckets = new Map<string, TokenPnLItem & { costUsd: number }>();
  const chronological = [...swaps].sort((a, b) => a.timestamp - b.timestamp);

  for (const tx of chronological) {
    const inMint = tx.token_in;
    const outMint = tx.token_out;
    const inSymbol = tx.symbol_in || "TOKEN";
    const outSymbol = tx.symbol_out || "TOKEN";
    const inUsd = (prices[inMint || ""] || 0) * tx.amount_in;
    const outUsd = (prices[outMint || ""] || 0) * tx.amount_out;

    if (outMint) {
      const buy = buckets.get(outMint) || {
        mint: outMint,
        symbol: outSymbol,
        qtyHeld: 0,
        avgCost: 0,
        realizedPnlUsd: 0,
        unrealizedPnlUsd: 0,
        totalPnlUsd: 0,
        trades: 0,
        costUsd: 0,
      };
      const acquireCost = inUsd > 0 ? inUsd : outUsd;
      buy.qtyHeld += tx.amount_out;
      buy.costUsd += acquireCost;
      buy.avgCost = buy.qtyHeld > 0 ? buy.costUsd / buy.qtyHeld : 0;
      buy.trades += 1;
      buckets.set(outMint, buy);
    }

    if (inMint) {
      const sell = buckets.get(inMint) || {
        mint: inMint,
        symbol: inSymbol,
        qtyHeld: 0,
        avgCost: 0,
        realizedPnlUsd: 0,
        unrealizedPnlUsd: 0,
        totalPnlUsd: 0,
        trades: 0,
        costUsd: 0,
      };
      const soldQty = Math.min(sell.qtyHeld, tx.amount_in);
      const basis = soldQty * sell.avgCost;
      const proceeds = outUsd > 0 ? outUsd : inUsd;
      sell.realizedPnlUsd += proceeds - basis;
      sell.qtyHeld = Math.max(0, sell.qtyHeld - tx.amount_in);
      sell.costUsd = Math.max(0, sell.costUsd - basis);
      sell.avgCost = sell.qtyHeld > 0 ? sell.costUsd / sell.qtyHeld : 0;
      sell.trades += 1;
      buckets.set(inMint, sell);
    }
  }

  const perTokenPnl = Array.from(buckets.values()).map((item) => {
    const currentPrice = prices[item.mint] || 0;
    const marketValue = item.qtyHeld * currentPrice;
    item.unrealizedPnlUsd = marketValue - item.costUsd;
    item.totalPnlUsd = item.realizedPnlUsd + item.unrealizedPnlUsd;
    return {
      mint: item.mint,
      symbol: item.symbol,
      qtyHeld: item.qtyHeld,
      avgCost: item.avgCost,
      realizedPnlUsd: item.realizedPnlUsd,
      unrealizedPnlUsd: item.unrealizedPnlUsd,
      totalPnlUsd: item.totalPnlUsd,
      trades: item.trades,
    };
  });

  const totalPnlUsd = perTokenPnl.reduce((acc, t) => acc + t.totalPnlUsd, 0);
  return { totalPnlUsd, perTokenPnl };
}

export async function buildPortfolio(transactions: ParsedTransaction[]): Promise<
  Array<{
    address: string;
    symbol: string;
    name: string;
    balance: number;
    priceUsd: number;
    valueUsd: number;
  }>
> {
  const pnl = await buildPnl(transactions);
  const mints = pnl.perTokenPnl.map((token) => token.mint);
  const prices = await getTokenPrices(mints);
  return pnl.perTokenPnl
    .filter((token) => token.qtyHeld > 0)
    .map((token) => {
      const priceUsd = prices[token.mint] || 0;
      return {
        address: token.mint,
        symbol: token.symbol,
        name: token.symbol,
        balance: token.qtyHeld,
        priceUsd,
        valueUsd: token.qtyHeld * priceUsd,
      };
    });
}

export async function buildSummary(transactions: ParsedTransaction[]): Promise<WalletSummary> {
  const swaps = transactions.filter((tx) => tx.type === "swap");
  const mints = swaps.flatMap((tx) => [tx.token_in, tx.token_out]).filter((m): m is string => Boolean(m));
  const prices = await getTokenPrices(mints);
  const tradeCounter = new Map<string, { symbol: string; trades: number }>();

  let totalVolumeUsd = 0;
  for (const tx of swaps) {
    if (tx.token_in) {
      const current = tradeCounter.get(tx.token_in) || { symbol: tx.symbol_in || "TOKEN", trades: 0 };
      current.trades += 1;
      tradeCounter.set(tx.token_in, current);
    }
    if (tx.token_out) {
      const current = tradeCounter.get(tx.token_out) || { symbol: tx.symbol_out || "TOKEN", trades: 0 };
      current.trades += 1;
      tradeCounter.set(tx.token_out, current);
    }
    totalVolumeUsd += txUsdValue(tx, prices);
  }

  const pnl = await buildPnl(transactions);
  const winners = pnl.perTokenPnl.filter((t) => t.totalPnlUsd > 0).length;
  const winRate = pnl.perTokenPnl.length ? (winners / pnl.perTokenPnl.length) * 100 : 0;

  const mostTradedTokens = Array.from(tradeCounter.entries())
    .map(([mint, data]) => ({ mint, symbol: data.symbol, trades: data.trades }))
    .sort((a, b) => b.trades - a.trades)
    .slice(0, 5);

  return {
    totalTrades: swaps.length,
    winRate,
    mostTradedTokens,
    totalVolumeUsd,
  };
}

export async function buildMissedOpportunities(transactions: ParsedTransaction[]): Promise<MissedOpportunity[]> {
  const swaps = transactions.filter((tx) => tx.type === "swap");
  const mints = swaps.flatMap((tx) => [tx.token_in, tx.token_out]).filter((m): m is string => Boolean(m));
  const prices = await getTokenPrices(mints);
  const missed: MissedOpportunity[] = [];
  const seen = new Set<string>();

  for (const tx of swaps) {
    if (!tx.token_in || seen.has(tx.token_in) || tx.amount_in <= 0) continue;
    const currentPrice = prices[tx.token_in] || 0;
    if (currentPrice <= 0) continue;

    let sellUnitPrice = 0;
    if (isStable(tx.symbol_out, tx.token_out)) {
      sellUnitPrice = tx.amount_out / tx.amount_in;
    } else if (tx.token_out && prices[tx.token_out] > 0) {
      sellUnitPrice = (tx.amount_out * prices[tx.token_out]) / tx.amount_in;
    }

    if (sellUnitPrice <= 0 || currentPrice <= sellUnitPrice) continue;

    const missedProfitPercent = ((currentPrice - sellUnitPrice) / sellUnitPrice) * 100;
    const estimatedUsdLoss = (currentPrice - sellUnitPrice) * tx.amount_in;
    seen.add(tx.token_in);

    missed.push({
      token: tx.token_in,
      symbol: tx.symbol_in || "TOKEN",
      missedProfitPercent,
      estimatedUsdLoss,
    });
  }

  return missed.sort((a, b) => b.estimatedUsdLoss - a.estimatedUsdLoss).slice(0, 20);
}
