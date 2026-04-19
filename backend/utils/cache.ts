import NodeCache from "node-cache";

export const rpcCache = new NodeCache({ stdTTL: 30, checkperiod: 30 });
export const priceCache = new NodeCache({ stdTTL: 60, checkperiod: 30 });
export const marketCache = new NodeCache({ stdTTL: 60, checkperiod: 30 });
