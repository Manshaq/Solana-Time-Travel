import { marketCache } from "../utils/cache";
import { requestWithRetry } from "../utils/http";

interface DexPair {
  pairAddress: string;
  dexId: string;
  priceUsd?: string;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  baseToken?: { address: string; symbol: string };
  quoteToken?: { address: string; symbol: string };
}

interface DexPairsResponse {
  pairs: DexPair[] | null;
}

interface DexSearchResponse {
  pairs: DexPair[];
}

const DEXSCREENER_BASE_URL = process.env.DEXSCREENER_API_URL || "https://api.dexscreener.com";

function pickBestPair(pairs: DexPair[]): DexPair | null {
  if (!pairs.length) return null;
  return [...pairs].sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
}

export async function searchDexPairs(query: string): Promise<DexPair[]> {
  const cacheKey = `dex:search:${query}`;
  const cached = marketCache.get<DexPair[]>(cacheKey);
  if (cached) return cached;

  const data = await requestWithRetry<DexSearchResponse>({
    method: "GET",
    url: `${DEXSCREENER_BASE_URL}/latest/dex/search`,
    params: { q: query },
  });
  const pairs = data.pairs || [];
  marketCache.set(cacheKey, pairs, 60);
  return pairs;
}

export async function getDexPairByAddress(pairAddress: string): Promise<DexPair | null> {
  const cacheKey = `dex:pair:${pairAddress}`;
  const cached = marketCache.get<DexPair | null>(cacheKey);
  if (cached !== undefined) return cached;

  const data = await requestWithRetry<DexPairsResponse>({
    method: "GET",
    url: `${DEXSCREENER_BASE_URL}/latest/dex/pairs/solana/${pairAddress}`,
  });
  const pair = pickBestPair(data.pairs || []);
  marketCache.set(cacheKey, pair, 60);
  return pair;
}

export async function getDexTokenMarket(mint: string): Promise<{
  price: number;
  liquidity: number;
  volume24h: number;
  pairAddress: string;
  dexName: string;
} | null> {
  const cacheKey = `dex:token:${mint}`;
  const cached = marketCache.get<{
    price: number;
    liquidity: number;
    volume24h: number;
    pairAddress: string;
    dexName: string;
  } | null>(cacheKey);
  if (cached !== undefined) return cached;

  const data = await requestWithRetry<DexPairsResponse>({
    method: "GET",
    url: `${DEXSCREENER_BASE_URL}/latest/dex/tokens/${mint}`,
  });

  const best = pickBestPair(data.pairs || []);
  if (!best) {
    marketCache.set(cacheKey, null, 60);
    return null;
  }

  const market = {
    price: Number(best.priceUsd || 0),
    liquidity: Number(best.liquidity?.usd || 0),
    volume24h: Number(best.volume?.h24 || 0),
    pairAddress: best.pairAddress,
    dexName: best.dexId,
  };
  marketCache.set(cacheKey, market, 60);
  return market;
}

export async function getDexTokenPrice(mint: string): Promise<number | null> {
  const market = await getDexTokenMarket(mint);
  if (!market || !market.price || market.price <= 0) return null;
  return market.price;
}
