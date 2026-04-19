import { PublicKey } from "@solana/web3.js";

export function isValidSolanaAddress(value: string): boolean {
  try {
    // PublicKey constructor validates base58 and size.
    const key = new PublicKey(value);
    return key.toBase58() === value;
  } catch {
    return false;
  }
}

export function sanitizeString(value: string): string {
  return value.replace(/[<>"'`;\\]/g, "").trim();
}
