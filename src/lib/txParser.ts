export type TransactionType = "swap" | "transfer" | "nft" | "unknown";

export interface ParsedTransaction {
  type: TransactionType;
  token_in: string | null;
  token_out: string | null;
  symbol_in?: string | null;
  symbol_out?: string | null;
  amount_in: number;
  amount_out: number;
  timestamp: number;
  signature: string;
  description?: string;
}

export function parseHeliusTransaction(tx: any, walletAddress: string): ParsedTransaction {
  const { type, tokenTransfers, nativeTransfers, timestamp, signature, description } = tx;
  
  let parsed: ParsedTransaction = {
    type: "unknown",
    token_in: null,
    token_out: null,
    amount_in: 0,
    amount_out: 0,
    timestamp,
    signature,
    description
  };

  // Detect NFT transactions
  if (type.includes("NFT") || type.includes("COMPRESSED_NFT")) {
    parsed.type = "nft";
  }

  // Analyze transfers to determine swap vs transfer
  const incomingTokens = tokenTransfers.filter((t: any) => t.toUser === walletAddress);
  const outgoingTokens = tokenTransfers.filter((t: any) => t.fromUser === walletAddress);
  
  const incomingSol = nativeTransfers.filter((t: any) => t.toUser === walletAddress);
  const outgoingSol = nativeTransfers.filter((t: any) => t.fromUser === walletAddress);

  // Swap Detection Logic: 
  // If there's at least one outgoing and one incoming (either token or SOL)
  const hasOutgoing = outgoingTokens.length > 0 || outgoingSol.length > 0;
  const hasIncoming = incomingTokens.length > 0 || incomingSol.length > 0;

  if (type === "SWAP" || (hasOutgoing && hasIncoming)) {
    parsed.type = "swap";
    
    // For swaps, we usually take the primary "in" and "out"
    if (outgoingTokens.length > 0) {
      parsed.token_in = outgoingTokens[0].mint;
      parsed.symbol_in = outgoingTokens[0].symbol || "TOKEN";
      parsed.amount_in = outgoingTokens[0].tokenAmount;
    } else if (outgoingSol.length > 0) {
      parsed.token_in = "So11111111111111111111111111111111111111112"; // SOL Mint
      parsed.symbol_in = "SOL";
      parsed.amount_in = outgoingSol[0].amount / 1e9;
    }

    if (incomingTokens.length > 0) {
      parsed.token_out = incomingTokens[0].mint;
      parsed.symbol_out = incomingTokens[0].symbol || "TOKEN";
      parsed.amount_out = incomingTokens[0].tokenAmount;
    } else if (incomingSol.length > 0) {
      parsed.token_out = "So11111111111111111111111111111111111111112";
      parsed.symbol_out = "SOL";
      parsed.amount_out = incomingSol[0].amount / 1e9;
    }
  } 
  else if (type === "TRANSFER" || hasOutgoing || hasIncoming) {
    parsed.type = "transfer";
    
    if (hasOutgoing) {
      if (outgoingTokens.length > 0) {
        parsed.token_in = outgoingTokens[0].mint;
        parsed.symbol_in = outgoingTokens[0].symbol || "TOKEN";
        parsed.amount_in = outgoingTokens[0].tokenAmount;
      } else {
        parsed.token_in = "So11111111111111111111111111111111111111112";
        parsed.symbol_in = "SOL";
        parsed.amount_in = outgoingSol[0].amount / 1e9;
      }
    } else if (hasIncoming) {
      if (incomingTokens.length > 0) {
        parsed.token_out = incomingTokens[0].mint;
        parsed.symbol_out = incomingTokens[0].symbol || "TOKEN";
        parsed.amount_out = incomingTokens[0].tokenAmount;
      } else {
        parsed.token_out = "So11111111111111111111111111111111111111112";
        parsed.symbol_out = "SOL";
        parsed.amount_out = incomingSol[0].amount / 1e9;
      }
    }
  }

  return parsed;
}
