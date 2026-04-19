import type { NextFunction, Request, Response } from "express";
import {
  buildMissedOpportunities,
  buildPnl,
  buildSummary,
  buildTimeline,
  fetchParsedTransactions,
} from "../services/wallet-analytics.service";
import { AppError } from "../utils/errors";

function parseLimit(value: unknown): number | undefined {
  if (!value || typeof value !== "string") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function getWalletTransactionsController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { address } = req.params;
    const limit = parseLimit(req.query.limit);
    const transactions = await fetchParsedTransactions(address, limit);
    res.json({ data: { items: transactions } });
  } catch (error) {
    next(new AppError("Failed to fetch wallet transactions", 502, "TRANSACTIONS_FETCH_ERROR"));
  }
}

export async function getWalletTimelineController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { address } = req.params;
    const limit = parseLimit(req.query.limit);
    const transactions = await fetchParsedTransactions(address, limit);
    const timeline = buildTimeline(transactions);
    res.json({ data: { items: timeline } });
  } catch {
    next(new AppError("Failed to build timeline", 502, "TIMELINE_FETCH_ERROR"));
  }
}

export async function getWalletPnlController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { address } = req.params;
    const limit = parseLimit(req.query.limit);
    const transactions = await fetchParsedTransactions(address, limit);
    const pnl = await buildPnl(transactions);
    res.json({
      data: {
        totalPnlUsd: pnl.totalPnlUsd,
        perTokenPnl: pnl.perTokenPnl,
      },
    });
  } catch {
    next(new AppError("Failed to calculate pnl", 502, "PNL_CALCULATION_ERROR"));
  }
}

export async function getWalletSummaryController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { address } = req.params;
    const limit = parseLimit(req.query.limit);
    const transactions = await fetchParsedTransactions(address, limit);
    const summary = await buildSummary(transactions);
    res.json({ data: summary });
  } catch {
    next(new AppError("Failed to build summary", 502, "SUMMARY_ERROR"));
  }
}

export async function getWalletMissedController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { address } = req.params;
    const limit = parseLimit(req.query.limit);
    const transactions = await fetchParsedTransactions(address, limit);
    const missed = await buildMissedOpportunities(transactions);
    res.json({ data: { items: missed } });
  } catch {
    next(new AppError("Failed to build missed opportunities", 502, "MISSED_OPPORTUNITIES_ERROR"));
  }
}
