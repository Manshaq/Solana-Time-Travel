export interface MissedGain {
  token: string;
  symbol: string;
  sell_price: number;
  current_price: number;
  missed_profit: number;
  percentage: number;
  amount_sold: number;
}

export function calculateMissedGains(
  transactions: any[], 
  currentPrices: Record<string, any>
): MissedGain[] {
  const gains: MissedGain[] = [];
  const processedMints = new Set<string>();

  // We look for the most recent sell of each token
  const sortedTxs = [...transactions].sort((a, b) => b.timestamp - a.timestamp);

  sortedTxs.forEach((tx) => {
    if (tx.type !== "swap") return;
    
    const mintSold = tx.token_in;
    const symbolSold = tx.symbol_in;
    const amountSold = tx.amount_in;
    
    // If we haven't processed this token yet and we have a current price for it
    if (mintSold && !processedMints.has(mintSold) && currentPrices[mintSold]) {
      processedMints.add(mintSold);
      
      const currentPrice = currentPrices[mintSold].value;
      
      // Estimate sell price in USD
      // If token_out is USDC/USDT, we use that amount
      // If token_out is SOL, we'd need SOL price, but for now we'll look for stablecoin pairs
      let sellPriceUsd = 0;
      if (tx.symbol_out === "USDC" || tx.symbol_out === "USDT") {
        sellPriceUsd = tx.amount_out / tx.amount_in;
      } else if (tx.symbol_out === "SOL" && currentPrices["So11111111111111111111111111111111111111112"]) {
        const solPrice = currentPrices["So11111111111111111111111111111111111111112"].value;
        sellPriceUsd = (tx.amount_out * solPrice) / tx.amount_in;
      }

      if (sellPriceUsd > 0 && currentPrice > sellPriceUsd) {
        const percentage = ((currentPrice - sellPriceUsd) / sellPriceUsd) * 100;
        
        if (percentage > 20) {
          gains.push({
            token: mintSold,
            symbol: symbolSold || "UNKNOWN",
            sell_price: sellPriceUsd,
            current_price: currentPrice,
            missed_profit: (currentPrice - sellPriceUsd) * amountSold,
            percentage,
            amount_sold: amountSold
          });
        }
      }
    }
  });

  return gains;
}
