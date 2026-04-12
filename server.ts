import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";
import NodeCache from "node-cache";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { parseHeliusTransaction } from "./src/lib/txParser";

dotenv.config();

// Initialize Cache: 5 minutes TTL, check every 60 seconds
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// Solana Address Regex (Base58, 32-44 characters)
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Security Headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "img-src": ["'self'", "data:", "https://picsum.photos", "https://raw.githubusercontent.com", "https://*.birdeye.so"],
        "connect-src": ["'self'", "https://api.helius.xyz", "https://public-api.birdeye.so", "https://generativelanguage.googleapis.com", "ws:", "wss:"],
        "frame-ancestors": ["*"], // Required for AI Studio iframe
      },
    },
    frameguard: false, // Disable X-Frame-Options: SAMEORIGIN
    crossOriginEmbedderPolicy: false,
  }));

  app.use(express.json());

  // Rate Limiting: 100 requests per 15 minutes per IP
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: "Too many requests, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Apply rate limiter to all API routes
  app.use("/api/", limiter);

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Helius Parsed Transactions Proxy
  app.get("/api/wallet/transactions", async (req, res) => {
    const { address } = req.query;
    
    if (!address || typeof address !== "string" || !SOLANA_ADDRESS_REGEX.test(address)) {
      return res.status(400).json({ error: "Invalid Solana address format" });
    }

    const cacheKey = `tx_${address}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    const HELIUS_KEY = process.env.HELIUS_API_KEY;
    if (!HELIUS_KEY) {
      return res.status(500).json({ error: "System configuration error" });
    }

    try {
      const response = await axios.get(
        `https://api.helius.xyz/v0/addresses/${address}/transactions`,
        {
          params: { "api-key": HELIUS_KEY },
          timeout: 10000, // 10s timeout
        }
      );

      const structuredTx = response.data.map((tx: any) => parseHeliusTransaction(tx, address));
      const result = { data: { items: structuredTx } };
      
      cache.set(cacheKey, result);
      res.json(result);
    } catch (error: any) {
      console.error("Helius API Error:", error.message);
      res.status(error.response?.status || 500).json({ 
        error: "Failed to fetch parsed transactions",
        details: "External service error"
      });
    }
  });

  // Birdeye Portfolio Proxy
  app.get("/api/wallet/portfolio", async (req, res) => {
    const { address } = req.query;
    if (!address || typeof address !== "string" || !SOLANA_ADDRESS_REGEX.test(address)) {
      return res.status(400).json({ error: "Invalid Solana address format" });
    }

    const cacheKey = `port_${address}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    try {
      const response = await axios.get(`https://public-api.birdeye.so/v1/wallet/token_list`, {
        params: { wallet: address },
        headers: {
          "X-API-KEY": process.env.BIRDEYE_API_KEY || "",
          "x-chain": "solana"
        },
        timeout: 10000,
      });
      
      cache.set(cacheKey, response.data);
      res.json(response.data);
    } catch (error: any) {
      console.error("Birdeye API Error:", error.message);
      res.status(error.response?.status || 500).json({ 
        error: "Failed to fetch portfolio",
        details: "External service error"
      });
    }
  });

  // Birdeye Multi-Price Proxy
  app.get("/api/token/prices", async (req, res) => {
    const { list } = req.query;
    if (!list || typeof list !== "string") return res.status(400).json({ error: "List of addresses is required" });

    // Basic validation for comma-separated addresses
    const addresses = list.split(",");
    const allValid = addresses.every(addr => SOLANA_ADDRESS_REGEX.test(addr));
    if (!allValid) {
      return res.status(400).json({ error: "One or more invalid addresses in list" });
    }

    const cacheKey = `prices_${list}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    try {
      const response = await axios.get(`https://public-api.birdeye.so/v1/token/multi_price`, {
        params: { list },
        headers: {
          "X-API-KEY": process.env.BIRDEYE_API_KEY || "",
          "x-chain": "solana"
        },
        timeout: 10000,
      });
      
      cache.set(cacheKey, response.data, 60); // Shorter TTL for prices (1 minute)
      res.json(response.data);
    } catch (error: any) {
      console.error("Birdeye Price Error:", error.message);
      res.status(error.response?.status || 500).json({ 
        error: "Failed to fetch prices",
        details: "External service error"
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
