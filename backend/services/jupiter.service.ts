import { requestWithRetry } from "../utils/http";

// Jupiter Price API v3 — each key maps to a price object with `usdPrice`.
// https://api.jup.ag/price/v3?ids=<comma-separated-mints>
interface JupiterV3PriceEntry {
  usdPrice: number;
  decimals: number;
  liquidity?: number;
  priceChange24h?: number;
}

type JupiterV3Response = Record<string, JupiterV3PriceEntry | null>;

// Default to the current live base URL. The env var is kept for overrides.
const JUPITER_BASE_URL = process.env.JUPITER_API_URL || "https://api.jup.ag";

// Jupiter v3 accepts up to ~100 IDs per request safely.
const JUPITER_CHUNK_SIZE = 50;

export async function getJupiterPrices(mints: string[]): Promise<Record<string, number>> {
  if (mints.length === 0) return {};

  const result: Record<string, number> = {};

  // Chunk to avoid overly long query strings.
  for (let i = 0; i < mints.length; i += JUPITER_CHUNK_SIZE) {
    const chunk = mints.slice(i, i + JUPITER_CHUNK_SIZE);
    const ids = chunk.join(",");
    try {
      const data = await requestWithRetry<JupiterV3Response>({
        method: "GET",
        url: `${JUPITER_BASE_URL}/price/v3`,
        params: { ids },
      });
      for (const mint of chunk) {
        const entry = data[mint];
        if (entry && typeof entry.usdPrice === "number" && Number.isFinite(entry.usdPrice) && entry.usdPrice > 0) {
          result[mint] = entry.usdPrice;
        }
      }
    } catch {
      // partial failure — skip this chunk, DexScreener fallback will cover it
    }
  }

  return result;
}
