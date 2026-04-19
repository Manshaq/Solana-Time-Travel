import { SOL_DECIMALS, SOL_MINT } from "../utils/constants";
import type { ParsedTokenLeg, ParsedTransaction } from "../types/transaction.types";
import type { ParsedTransactionWithMeta } from "./rpc.service";

type BalanceRecord = {
  mint: string;
  owner?: string;
  accountIndex: number;
  amount: bigint;
  decimals: number;
};

function bigintToUiAmount(amount: bigint, decimals: number): number {
  const divisor = 10 ** decimals;
  return Number(amount) / divisor;
}

function getSymbolFromMint(mint: string): string {
  if (mint === SOL_MINT) return "SOL";
  return `${mint.slice(0, 4)}...${mint.slice(-4)}`;
}

function toBalanceRecord(
  entry: {
    accountIndex: number;
    mint: string;
    owner?: string;
    uiTokenAmount: { amount: string; decimals: number };
  },
): BalanceRecord {
  return {
    accountIndex: entry.accountIndex,
    mint: entry.mint,
    owner: entry.owner,
    amount: BigInt(entry.uiTokenAmount.amount),
    decimals: entry.uiTokenAmount.decimals,
  };
}

function walletSolDelta(tx: ParsedTransactionWithMeta, wallet: string): number {
  const keys = tx.transaction.message.accountKeys.map((k) => (typeof k === "string" ? k : k.pubkey));
  const walletIndex = keys.findIndex((k) => k === wallet);
  if (walletIndex < 0 || !tx.meta) return 0;

  const pre = tx.meta.preBalances[walletIndex] || 0;
  const post = tx.meta.postBalances[walletIndex] || 0;
  const deltaLamports = BigInt(post) - BigInt(pre);
  return bigintToUiAmount(deltaLamports, SOL_DECIMALS);
}

function buildTokenDiffs(tx: ParsedTransactionWithMeta, wallet: string): ParsedTokenLeg[] {
  const pre = (tx.meta?.preTokenBalances || []).map(toBalanceRecord);
  const post = (tx.meta?.postTokenBalances || []).map(toBalanceRecord);
  const relevant = new Map<string, { pre: bigint; post: bigint; mint: string; decimals: number }>();

  for (const item of pre) {
    if (item.owner !== wallet) continue;
    const key = `${item.mint}:${item.accountIndex}`;
    relevant.set(key, { pre: item.amount, post: 0n, mint: item.mint, decimals: item.decimals });
  }

  for (const item of post) {
    if (item.owner !== wallet) continue;
    const key = `${item.mint}:${item.accountIndex}`;
    const current = relevant.get(key);
    if (current) {
      current.post = item.amount;
      relevant.set(key, current);
    } else {
      relevant.set(key, { pre: 0n, post: item.amount, mint: item.mint, decimals: item.decimals });
    }
  }

  const aggregateByMint = new Map<string, { amount: number; symbol: string }>();
  for (const item of relevant.values()) {
    const delta = item.post - item.pre;
    if (delta === 0n) continue;
    const ui = bigintToUiAmount(delta, item.decimals);
    const current = aggregateByMint.get(item.mint);
    if (current) {
      current.amount += ui;
      aggregateByMint.set(item.mint, current);
    } else {
      aggregateByMint.set(item.mint, { amount: ui, symbol: getSymbolFromMint(item.mint) });
    }
  }

  return Array.from(aggregateByMint.entries()).map(([mint, value]) => ({
    mint,
    symbol: value.symbol,
    amount: value.amount,
  }));
}

export function parseTransaction(tx: ParsedTransactionWithMeta, walletAddress: string): ParsedTransaction {
  const signature = tx.transaction.signatures[0] || "";
  const timestamp = tx.blockTime || 0;

  const tokenChanges = buildTokenDiffs(tx, walletAddress);
  const solChange = walletSolDelta(tx, walletAddress);
  // Only count a SOL leg if the net change is substantial enough to be a real transfer/swap leg.
  // Sub-threshold amounts are just transaction fees and should be ignored.
  const SOL_DUST_THRESHOLD = 0.001;
  if (Number.isFinite(solChange) && Math.abs(solChange) >= SOL_DUST_THRESHOLD) {
    tokenChanges.push({
      mint: SOL_MINT,
      symbol: "SOL",
      amount: solChange,
    });
  }

  const nonZero = tokenChanges.filter((c) => Math.abs(c.amount) > 0);
  const outgoing = nonZero.filter((c) => c.amount < 0);
  const incoming = nonZero.filter((c) => c.amount > 0);

  let type: ParsedTransaction["type"] = "unknown";
  if (nonZero.length === 2 && outgoing.length >= 1 && incoming.length >= 1) {
    type = "swap";
  } else if (nonZero.length === 1) {
    type = "transfer";
  }

  const tokenIn = outgoing[0];
  const tokenOut = incoming[0];

  return {
    type,
    token_in: tokenIn?.mint || null,
    token_out: tokenOut?.mint || null,
    symbol_in: tokenIn?.symbol || null,
    symbol_out: tokenOut?.symbol || null,
    amount_in: tokenIn ? Math.abs(tokenIn.amount) : 0,
    amount_out: tokenOut ? Math.abs(tokenOut.amount) : 0,
    timestamp,
    signature,
  };
}
