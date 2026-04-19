import { txCache } from "../utils/cache";
import { AppError } from "../utils/errors";
import { requestWithRetry } from "../utils/http";

interface RpcEnvelope<T> {
  jsonrpc: "2.0";
  id: number;
  result: T;
}

interface RpcErrorEnvelope {
  jsonrpc: "2.0";
  id: number;
  error: {
    code: number;
    message: string;
  };
}

type RpcResponse<T> = RpcEnvelope<T> | RpcErrorEnvelope;

interface SignatureInfo {
  signature: string;
  blockTime: number | null;
}

export interface ParsedTransactionWithMeta {
  blockTime: number | null;
  meta: {
    err: unknown;
    preBalances: number[];
    postBalances: number[];
    preTokenBalances?: Array<{
      accountIndex: number;
      mint: string;
      owner?: string;
      uiTokenAmount: { amount: string; decimals: number; uiAmountString?: string };
    }>;
    postTokenBalances?: Array<{
      accountIndex: number;
      mint: string;
      owner?: string;
      uiTokenAmount: { amount: string; decimals: number; uiAmountString?: string };
    }>;
  } | null;
  transaction: {
    signatures: string[];
    message: {
      accountKeys: Array<string | { pubkey: string }>;
    };
  };
}

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

async function rpcCall<T>(method: string, params: unknown[]): Promise<T> {
  const payload = {
    jsonrpc: "2.0",
    id: Date.now(),
    method,
    params,
  };
  const response = await requestWithRetry<RpcResponse<T>>({
    method: "POST",
    url: SOLANA_RPC_URL,
    data: payload,
    headers: {
      "Content-Type": "application/json",
    },
  });

  if ("error" in response) {
    throw new AppError(`RPC ${method} failed`, 502, "SOLANA_RPC_ERROR");
  }

  return response.result;
}

export async function getSignaturesForAddress(address: string, limit: number): Promise<SignatureInfo[]> {
  const cacheKey = `rpc:sig:${address}:${limit}`;
  const cached = txCache.get<SignatureInfo[]>(cacheKey);
  if (cached) return cached;

  const signatures = await rpcCall<SignatureInfo[]>("getSignaturesForAddress", [
    address,
    { limit },
  ]);
  txCache.set(cacheKey, signatures, 20);
  return signatures;
}

export async function getTransaction(signature: string): Promise<ParsedTransactionWithMeta | null> {
  const cacheKey = `rpc:tx:${signature}`;
  const cached = txCache.get<ParsedTransactionWithMeta | null>(cacheKey);
  if (cached !== undefined) return cached;

  const tx = await rpcCall<ParsedTransactionWithMeta | null>("getTransaction", [
    signature,
    {
      encoding: "jsonParsed",
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    },
  ]);
  txCache.set(cacheKey, tx, 30);
  return tx;
}

export async function getWalletTransactions(address: string, limit: number): Promise<ParsedTransactionWithMeta[]> {
  const signatures = await getSignaturesForAddress(address, limit);
  const txs = await Promise.all(signatures.map((item) => getTransaction(item.signature)));
  return txs.filter((item): item is ParsedTransactionWithMeta => Boolean(item?.meta));
}
