import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import express from "express";
import { createApp } from "./backend/app";
import { logger } from "./backend/utils/logger";

dotenv.config();

async function startServer(): Promise<void> {
  const app = createApp();
  const port = Number(process.env.PORT || 3000);
  const isProd = process.env.NODE_ENV === "production";

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(port, "0.0.0.0", () => {
    logger.info("server_started", {
      port,
      mode: process.env.NODE_ENV || "development",
    });
  });
}

startServer().catch((error) => {
  logger.error("server_start_failed", { message: error instanceof Error ? error.message : "unknown_error" });
  process.exit(1);
});
