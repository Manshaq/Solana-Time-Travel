import type { Request } from "express";

export interface AddressRequest extends Request {
  params: Request["params"] & {
    address: string;
  };
}

export interface MintRequest extends Request {
  params: Request["params"] & {
    mint: string;
  };
}
