import { Router } from "express";
import {
  getWalletMissedController,
  getWalletPnlController,
  getWalletSummaryController,
  getWalletTimelineController,
  getWalletTransactionsController,
} from "../controllers/wallet.controller";
import { validateAddressParam } from "../middleware/validation.middleware";

export const walletRouter = Router();

walletRouter.get("/:address/transactions", validateAddressParam, getWalletTransactionsController);
walletRouter.get("/:address/timeline", validateAddressParam, getWalletTimelineController);
walletRouter.get("/:address/pnl", validateAddressParam, getWalletPnlController);
walletRouter.get("/:address/summary", validateAddressParam, getWalletSummaryController);
walletRouter.get("/:address/missed", validateAddressParam, getWalletMissedController);
