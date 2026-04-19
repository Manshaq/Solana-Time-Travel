import cors from "cors";
import express from "express";
import helmet from "helmet";
import type { Request, Response } from "express";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";
import { generalLimiter, tokenLimiter, walletLimiter } from "./middleware/rate-limit.middleware";
import { sanitizeRequest } from "./middleware/sanitize.middleware";
import { tokenRouter } from "./routes/token.routes";
import { walletRouter } from "./routes/wallet.routes";
import { isValidSolanaAddress } from "./utils/validation";
import { buildPortfolio, fetchParsedTransactions } from "./services/wallet-analytics.service";
import { getTokenPrices } from "./services/price.service";

export function createApp() {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(
    cors({
      origin: process.env.ALLOWED_ORIGIN || false,
      methods: ["GET"],
      credentials: false,
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.use(sanitizeRequest);
  app.use(generalLimiter);

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  app.use("/wallet", walletLimiter, walletRouter);
  app.use("/token", tokenLimiter, tokenRouter);

  // Backward-compatible API aliases used by frontend.
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  app.get("/api/wallet/transactions", walletLimiter, async (req: Request, res: Response) => {
    const address = typeof req.query.address === "string" ? req.query.address : "";
    if (!isValidSolanaAddress(address)) {
      res.status(400).json({ error: "Invalid Solana wallet address" });
      return;
    }
    const items = await fetchParsedTransactions(address);
    res.json({ data: { items } });
  });

  app.get("/api/wallet/portfolio", walletLimiter, async (req: Request, res: Response) => {
    const address = typeof req.query.address === "string" ? req.query.address : "";
    if (!isValidSolanaAddress(address)) {
      res.status(400).json({ error: "Invalid Solana wallet address" });
      return;
    }
    const transactions = await fetchParsedTransactions(address);
    const items = await buildPortfolio(transactions);
    res.json({ data: { items } });
  });

  app.get("/api/token/prices", tokenLimiter, async (req: Request, res: Response) => {
    const list = typeof req.query.list === "string" ? req.query.list : "";
    if (!list) {
      res.status(400).json({ error: "list is required" });
      return;
    }
    const mints = list
      .split(",")
      .map((m) => m.trim())
      .filter((m) => m.length > 0);
    const prices = await getTokenPrices(mints);
    const data = Object.fromEntries(Object.entries(prices).map(([mint, value]) => [mint, { value }]));
    res.json({ data });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
