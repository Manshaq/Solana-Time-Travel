import type { NextFunction, Request, Response } from "express";
import { getDexPairByAddress, getDexTokenMarket, searchDexPairs } from "../services/dexscreener.service";
import { AppError } from "../utils/errors";
import { logger } from "../utils/logger";

export async function getTokenMarketController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { mint } = req.params;
    const market = await getDexTokenMarket(mint);
    if (!market) {
      next(new AppError("Market data not found", 404, "MARKET_NOT_FOUND"));
      return;
    }
    res.json({
      data: {
        mint,
        price: market.price,
        liquidity: market.liquidity,
        volume24h: market.volume24h,
        pairAddress: market.pairAddress,
        dexName: market.dexName,
      },
    });
  } catch (error) {
    logger.error("token_market_failed", { error: error instanceof Error ? error.message : "unknown" });
    next(new AppError("Failed to fetch market data", 502, "MARKET_FETCH_ERROR"));
  }
}

export async function searchTokenMarketController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = typeof req.query.q === "string" ? req.query.q : "";
    if (!query) {
      next(new AppError("Query parameter q is required", 400, "INVALID_QUERY"));
      return;
    }
    const pairs = await searchDexPairs(query);
    res.json({ data: { items: pairs } });
  } catch (error) {
    logger.error("token_search_failed", { error: error instanceof Error ? error.message : "unknown" });
    next(new AppError("Failed to search dexscreener", 502, "DEX_SEARCH_ERROR"));
  }
}

export async function getPairMarketController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { pairAddress } = req.params;
    const pair = await getDexPairByAddress(pairAddress);
    if (!pair) {
      next(new AppError("Pair not found", 404, "PAIR_NOT_FOUND"));
      return;
    }
    res.json({ data: pair });
  } catch (error) {
    logger.error("pair_market_failed", { error: error instanceof Error ? error.message : "unknown" });
    next(new AppError("Failed to fetch pair market", 502, "PAIR_FETCH_ERROR"));
  }
}
