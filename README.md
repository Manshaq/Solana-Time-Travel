# Solana Wallet Time Machine Backend

## Folder Structure

```text
backend/
  controllers/
    token.controller.ts
    wallet.controller.ts
  middleware/
    error.middleware.ts
    rate-limit.middleware.ts
    sanitize.middleware.ts
    validation.middleware.ts
  routes/
    token.routes.ts
    wallet.routes.ts
  services/
    dexscreener.service.ts
    jupiter.service.ts
    parser.service.ts
    price.service.ts
    rpc.service.ts
    wallet-analytics.service.ts
  types/
    express.types.ts
    transaction.types.ts
  utils/
    cache.ts
    constants.ts
    errors.ts
    http.ts
    logger.ts
    validation.ts
server.ts
```

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

## APIs

- `GET /wallet/:address/transactions`
- `GET /wallet/:address/timeline`
- `GET /wallet/:address/pnl`
- `GET /wallet/:address/summary`
- `GET /wallet/:address/missed`
- `GET /token/:mint/market`

## Example Responses

### `GET /wallet/:address/transactions`

```json
{
  "data": {
    "items": [
      {
        "type": "swap",
        "token_in": "So11111111111111111111111111111111111111112",
        "token_out": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
        "symbol_in": "SOL",
        "symbol_out": "DezX...B263",
        "amount_in": 1.12,
        "amount_out": 50234.8,
        "timestamp": 1713471923,
        "signature": "5N3..."
      }
    ]
  }
}
```

### `GET /wallet/:address/timeline`

```json
{
  "data": {
    "items": [
      {
        "signature": "5N3...",
        "timestamp": 1713471923,
        "action": "Swapped SOL → DezX...B263",
        "type": "swap"
      }
    ]
  }
}
```

### `GET /wallet/:address/pnl`

```json
{
  "data": {
    "totalPnlUsd": 842.12,
    "perTokenPnl": [
      {
        "mint": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
        "symbol": "DezX...B263",
        "qtyHeld": 10000,
        "avgCost": 0.000011,
        "realizedPnlUsd": 621.2,
        "unrealizedPnlUsd": 220.92,
        "totalPnlUsd": 842.12,
        "trades": 14
      }
    ]
  }
}
```

### `GET /wallet/:address/summary`

```json
{
  "data": {
    "totalTrades": 42,
    "winRate": 57.14,
    "mostTradedTokens": [
      {
        "mint": "So11111111111111111111111111111111111111112",
        "symbol": "SOL",
        "trades": 40
      }
    ],
    "totalVolumeUsd": 20394.11
  }
}
```

### `GET /wallet/:address/missed`

```json
{
  "data": {
    "items": [
      {
        "token": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
        "symbol": "DezX...B263",
        "missedProfitPercent": 73.4,
        "estimatedUsdLoss": 913.12
      }
    ]
  }
}
```

### `GET /token/:mint/market`

```json
{
  "data": {
    "mint": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    "price": 0.000024,
    "liquidity": 2813490,
    "volume24h": 1023498,
    "pairAddress": "9xQeWvG816bUx9EPjHmaT23yvVM6eE6N4Myn7LJ8K4x9",
    "dexName": "raydium"
  }
}
```
