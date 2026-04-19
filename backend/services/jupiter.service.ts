import { requestWithRetry } from "../utils/http";

interface JupiterResponse {
  data: Record<string, { id: string; price: number }>;
}

const JUPITER_BASE_URL = process.env.JUPITER_API_URL || "https://price.jup.ag";

export async function getJupiterPrices(mints: string[]): Promise<Record<string, number>> {
  if (mints.length === 0) return {};
  const ids = mints.join(",");
  const data = await requestWithRetry<JupiterResponse>({
    method: "GET",
    url: `${JUPITER_BASE_URL}/v4/price`,
    params: { ids },
  });
  const result: Record<string, number> = {};
  for (const mint of Object.keys(data.data || {})) {
    const price = data.data[mint]?.price;
    if (typeof price === "number" && Number.isFinite(price)) {
      result[mint] = price;
    }
  }
  return result;
}
