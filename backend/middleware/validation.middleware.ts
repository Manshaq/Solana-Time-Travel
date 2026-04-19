import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/errors";
import { isValidSolanaAddress } from "../utils/validation";

export function validateAddressParam(req: Request, _res: Response, next: NextFunction): void {
  const { address } = req.params;
  if (!address || !isValidSolanaAddress(address)) {
    next(new AppError("Invalid Solana wallet address", 400, "INVALID_ADDRESS"));
    return;
  }
  next();
}

export function validateMintParam(req: Request, _res: Response, next: NextFunction): void {
  const { mint } = req.params;
  if (!mint || !isValidSolanaAddress(mint)) {
    next(new AppError("Invalid Solana mint address", 400, "INVALID_MINT"));
    return;
  }
  next();
}
