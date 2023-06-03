import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";
import retry from "async-retry";

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
  return retry(async (_) => {
    return await axios<T, R>(url.toString(), config);
  }, config?.retry ?? { retries: 3, maxTimeout: 5_000 });
}
