import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";
import NodeCache from "node-cache";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import { GoogleGenAI, Type } from "@google/genai";
import { parseHeliusTransaction } from "./src/lib/txParser";

dotenv.config();

const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// SECURITY FIX: Max number of token addresses accepted in a single prices request.
// Previously unbounded - attacker could send thousands of addresses to exhaust
// the Birdeye API quota and cause memory/timeout issues.
const MAX_TOKEN_LIST_SIZE = 50;

const PORT = Number(process.env.PORT) || 3000;

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "img-src": ["'self'", "data:", "https://picsum.photos", "https://raw.githubusercontent.com", "https://*.birdeye.so"],
      // SECURITY FIX: Removed generativelanguage.googleapis.com from connect-src.
      // The browser no longer talks directly to Gemini - all AI calls go through /api/ai/analyze.
      "connect-src": ["'self'", "https://api.helius.xyz", "https://public-api.birdeye.so", "ws:", "wss:"],
      "frame-ancestors": ["*"],
    },
  },
  frameguard: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(express.json({ limit: '100kb' })); // SECURITY FIX: cap request body size

// SECURITY FIX: Explicit CORS policy. Previously no cors() middleware was
// configured, leaving the policy implicit and unauditable.
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || false, // false = same-origin only
  methods: ['GET', 'POST'],
  credentials: false,
}));

// -----------------------------------------------------------------
// SECURITY FIX: Tiered rate limiting per endpoint sensitivity.
// Previously a single 100req/15min limit covered all /api/* routes.
// An attacker could burn the full budget on expensive data endpoints.
// -----------------------------------------------------------------

// General API limiter (loose - for health checks etc.)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

// Strict limiter for expensive external API proxy routes
const dataLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // 2 req/min per IP against paid APIs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Data request limit reached. Please wait before retrying." },
});

// AI limiter - Gemini calls are expensive, limit aggressively
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 10,                   // 10 AI analyses per IP per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "AI analysis limit reached. Please try again in an hour." },
});

app.use("/api/", generalLimiter);
app.use("/api/wallet/", dataLimiter);
app.use("/api/token/", dataLimiter);
app.use("/api/ai/", aiLimiter);

// ---------------------------------------------------------------
// Health
// ---------------------------------------------------------------
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// ---------------------------------------------------------------
// Helius Parsed Transactions Proxy
// ---------------------------------------------------------------
app.get("/api/wallet/transactions", async (req, res) => {
  const { address } = req.query;
  if (!address || typeof address !== "string" || !SOLANA_ADDRESS_REGEX.test(address)) {
    return res.status(400).json({ error: "Invalid Solana address format" });
  }

  const cacheKey = `tx_${address}`;
  const cachedData = cache.get(cacheKey);
  if (cachedData) return res.json(cachedData);

  const HELIUS_KEY = process.env.HELIUS_API_KEY;
  if (!HELIUS_KEY) return res.status(500).json({ error: "System configuration error" });

  try {
    const response = await axios.get(
      `https://api.helius.xyz/v0/addresses/${address}/transactions`,
      { params: { "api-key": HELIUS_KEY }, timeout: 10000 }
    );
    const structuredTx = response.data.map((tx: any) => parseHeliusTransaction(tx, address));
    const result = { data: { items: structuredTx } };
    cache.set(cacheKey, result);
    res.json(result);
  } catch (error: any) {
    console.error("Helius API Error:", error.message);
    // SECURITY FIX: Return a normalised 502 instead of forwarding upstream status.
    // Forwarding error.response?.status leaks whether the API key is valid/rate-limited.
    res.status(502).json({ error: "Failed to fetch parsed transactions" });
  }
});

// ---------------------------------------------------------------
// Birdeye Portfolio Proxy
// ---------------------------------------------------------------
app.get("/api/wallet/portfolio", async (req, res) => {
  const { address } = req.query;
  if (!address || typeof address !== "string" || !SOLANA_ADDRESS_REGEX.test(address)) {
    return res.status(400).json({ error: "Invalid Solana address format" });
  }

  const cacheKey = `port_${address}`;
  const cachedData = cache.get(cacheKey);
  if (cachedData) return res.json(cachedData);

  try {
    const response = await axios.get(`https://public-api.birdeye.so/v1/wallet/token_list`, {
      params: { wallet: address },
      headers: {
        "X-API-KEY": process.env.BIRDEYE_API_KEY || "",
        "x-chain": "solana",
      },
      timeout: 10000,
    });
    cache.set(cacheKey, response.data);
    res.json(response.data);
  } catch (error: any) {
    console.error("Birdeye API Error:", error.message);
    res.status(502).json({ error: "Failed to fetch portfolio" }); // normalised status
  }
});

// ---------------------------------------------------------------
// Birdeye Multi-Price Proxy
// ---------------------------------------------------------------
app.get("/api/token/prices", async (req, res) => {
  const { list } = req.query;
  if (!list || typeof list !== "string") {
    return res.status(400).json({ error: "List of addresses is required" });
  }

  const addresses = list.split(",");

  // SECURITY FIX: Enforce maximum list size to prevent DoS / cost amplification.
  if (addresses.length > MAX_TOKEN_LIST_SIZE) {
    return res.status(400).json({
      error: `Address list too long. Maximum ${MAX_TOKEN_LIST_SIZE} addresses allowed.`,
    });
  }

  const allValid = addresses.every((addr) => SOLANA_ADDRESS_REGEX.test(addr.trim()));
  if (!allValid) {
    return res.status(400).json({ error: "One or more invalid addresses in list" });
  }

  const cacheKey = `prices_${list}`;
  const cachedData = cache.get(cacheKey);
  if (cachedData) return res.json(cachedData);

  try {
    const response = await axios.get(`https://public-api.birdeye.so/v1/token/multi_price`, {
      params: { list },
      headers: {
        "X-API-KEY": process.env.BIRDEYE_API_KEY || "",
        "x-chain": "solana",
      },
      timeout: 10000,
    });
    cache.set(cacheKey, response.data, 60);
    res.json(response.data);
  } catch (error: any) {
    console.error("Birdeye Price Error:", error.message);
    res.status(502).json({ error: "Failed to fetch prices" }); // normalised status
  }
});

// ---------------------------------------------------------------
// SECURITY FIX: New server-side AI proxy endpoint.
// Previously the Gemini SDK was instantiated in src/services/aiService.ts
// (frontend code) with the key inlined by Vite's `define` config.
// The key is now only accessed server-side and never sent to the browser.
// ---------------------------------------------------------------
app.post("/api/ai/analyze", async (req, res) => {
  const { transactions, pnlSummary, missedGains } = req.body;

  if (!Array.isArray(transactions)) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) {
    return res.status(500).json({ error: "AI service not configured" });
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });

  const prompt = `
    Analyze the following Solana wallet data and provide a behavioral report card.
    
    Trade History Summary:
    ${JSON.stringify(transactions.slice(0, 20), null, 2)}
    
    PnL Summary:
    Win Rate: ${pnlSummary?.winRate}%
    Total Assets: ${pnlSummary?.totalAssets}
    
    Missed Opportunities (Fumbles):
    ${JSON.stringify(missedGains, null, 2)}
    
    Provide exactly 3 strengths, 3 weaknesses, and one summary paragraph.
    Keep the tone concise and accessible for retail traders.
  `;

  try {
    const response = await ai.models.generateContent({
      // SECURITY FIX: Updated to a valid model name. "gemini-3.1-pro-preview" does not exist
      // and caused every AI request to silently fail, returning the error fallback.
      model: "gemini-1.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
            summary: { type: Type.STRING },
          },
          required: ["strengths", "weaknesses", "summary"],
        },
      },
    });

    return res.json(JSON.parse(response.text));
  } catch (error: any) {
    console.error("Gemini API Error:", error.message);
    return res.status(502).json({
      strengths: ["Analysis unavailable"],
      weaknesses: ["AI processing failed"],
      summary: "The AI analysis service is temporarily unavailable. Please try again later.",
    });
  }
});

// ---------------------------------------------------------------
// Vite dev middleware / static production serve
// ---------------------------------------------------------------
if (process.env.NODE_ENV !== "production") {
  // Kick off Vite initialisation immediately so it's ready by the time
  // the first request arrives, but don't block the module export.
  // Cache the resolved instance so subsequent requests skip the await.
  let viteInstance: Awaited<ReturnType<typeof createViteServer>> | null = null;
  const vitePromise = createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  }).then((vite) => {
    viteInstance = vite;
    return vite;
  });

  app.use(async (req, res, next) => {
    try {
      const vite = viteInstance ?? await vitePromise;
      vite.middlewares(req, res, next);
    } catch (err) {
      next(err);
    }
  });
} else {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

export default app;

// Only start the HTTP server when running as a standalone process.
// On Vercel the platform invokes the exported handler directly.
if (!process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
