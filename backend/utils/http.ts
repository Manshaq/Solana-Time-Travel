import axios, { type AxiosRequestConfig } from "axios";
import { logger } from "./logger";

const DEFAULT_TIMEOUT_MS = Number(process.env.HTTP_TIMEOUT_MS || 10000);
const DEFAULT_RETRIES = Number(process.env.HTTP_RETRY_COUNT || 2);

function canRetry(status?: number): boolean {
  if (!status) return true;
  return status >= 500 || status === 429;
}

export async function requestWithRetry<T>(config: AxiosRequestConfig, retries = DEFAULT_RETRIES): Promise<T> {
  let attempt = 0;
  let lastError: unknown = null;

  while (attempt <= retries) {
    try {
      const response = await axios.request<T>({
        timeout: DEFAULT_TIMEOUT_MS,
        ...config,
      });
      return response.data;
    } catch (error: any) {
      lastError = error;
      const status: number | undefined = error?.response?.status;
      if (attempt >= retries || !canRetry(status)) {
        break;
      }
      const backoffMs = 200 * (attempt + 1);
      logger.warn("retrying_http_request", {
        attempt: attempt + 1,
        retries,
        status,
        url: config.url,
      });
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
    attempt += 1;
  }

  throw lastError;
}
