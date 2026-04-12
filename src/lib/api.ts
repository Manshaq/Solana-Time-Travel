import axios from "axios";

export const api = {
  getTransactions: (address: string) => axios.get(`/api/wallet/transactions?address=${address}`),
  getPortfolio: (address: string) => axios.get(`/api/wallet/portfolio?address=${address}`),
  getPrices: (mints: string[]) => axios.get(`/api/token/prices?list=${mints.join(",")}`),
};
