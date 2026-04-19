import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/errors";
import { logger } from "../utils/logger";

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: "Route not found" });
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const appError = error instanceof AppError ? error : new AppError("Internal server error");
  logger.error("request_failed", {
    method: req.method,
    path: req.path,
    statusCode: appError.statusCode,
    code: appError.code,
    message: appError.message,
  });
  res.status(appError.statusCode).json({
    error: appError.message,
    code: appError.code,
  });
}
