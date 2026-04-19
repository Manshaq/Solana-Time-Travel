import { priceCache } from "../utils/cache";
import { getDexTokenPrice } from "./dexscreener.service";
import { getJupiterPrices } from "./jupiter.service";

export async function getTokenPrice(mint: string): Promise<number> {
  const cacheKey = `price:${mint}`;
  const cached = priceCache.get<number>(cacheKey);
  if (cached !== undefined) return cached;

  let price = 0;
  try {
    const jupiterPrices = await getJupiterPrices([mint]);
    price = jupiterPrices[mint] || 0;
  } catch {
    price = 0;
  }

  if (!price || price <= 0) {
    const fallbackPrice = await getDexTokenPrice(mint);
    price = fallbackPrice || 0;
  }

  priceCache.set(cacheKey, price, 60);
  return price;
}

export async function getTokenPrices(mints: string[]): Promise<Record<string, number>> {
  const unique = Array.from(new Set(mints));
  const result: Record<string, number> = {};
  const missing: string[] = [];

  for (const mint of unique) {
    const cached = priceCache.get<number>(`price:${mint}`);
    if (cached !== undefined) {
      result[mint] = cached;
    } else {
      missing.push(mint);
    }
  }

  if (missing.length > 0) {
    let jupiterPrices: Record<string, number> = {};
    try {
      jupiterPrices = await getJupiterPrices(missing);
    } catch {
      jupiterPrices = {};
    }

    // Limit fallback fan-out to reduce burst pressure on Dexscreener rate limits.
    const BATCH_SIZE = 5;
    for (let i = 0; i < missing.length; i += BATCH_SIZE) {
      const batch = missing.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (mint) => {
          const jPrice = jupiterPrices[mint] || 0;
          const price = jPrice > 0 ? jPrice : (await getDexTokenPrice(mint)) || 0;
          result[mint] = price;
          priceCache.set(`price:${mint}`, price, 60);
        }),
      );
    }
  }

  return result;
}
