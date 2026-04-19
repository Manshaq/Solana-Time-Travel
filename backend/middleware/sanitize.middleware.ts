import type { NextFunction, Request, Response } from "express";
import { sanitizeString } from "../utils/validation";

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") return sanitizeString(value);
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return entries.reduce<Record<string, unknown>>((acc, [k, v]) => {
      acc[k] = sanitizeValue(v);
      return acc;
    }, {});
  }
  return value;
}

export function sanitizeRequest(req: Request, _res: Response, next: NextFunction): void {
  req.query = sanitizeValue(req.query) as Request["query"];
  req.body = sanitizeValue(req.body) as Request["body"];
  req.params = sanitizeValue(req.params) as Request["params"];
  next();
}
