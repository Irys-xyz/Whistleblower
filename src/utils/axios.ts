import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";
import retry from "async-retry";
import { DEFAULT_AXIOS_CONFIG, DEFAULT_REQUEST_RETRY_CONFIG } from "./env";

/**
 * async-retry wrapped axios static request method.
 * default retry config is retries:3, maxTimeout: 5_000
 * @param url - full URL to request
 * @param config - Axios request config & retry options
 * @returns {AxiosResponse}
 */
export async function retryRequest<T = any, R = AxiosResponse<T>>(
  url: string | URL,
  config?: AxiosRequestConfig & { retry?: retry.Options },
): Promise<R> {
  config = { ...DEFAULT_AXIOS_CONFIG, ...config };
  return retry(
    async (_) => {
      return await axios<T, R>(url.toString(), config);
    },
    { ...DEFAULT_REQUEST_RETRY_CONFIG, ...config.retry },
  );
}
