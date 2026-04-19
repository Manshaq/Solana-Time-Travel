import { Router } from "express";
import {
  getPairMarketController,
  getTokenMarketController,
  searchTokenMarketController,
} from "../controllers/token.controller";
import { validateMintParam } from "../middleware/validation.middleware";

export const tokenRouter = Router();

tokenRouter.get("/:mint/market", validateMintParam, getTokenMarketController);
tokenRouter.get("/search", searchTokenMarketController);
tokenRouter.get("/pair/:pairAddress", getPairMarketController);
