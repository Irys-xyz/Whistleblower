import axios, { type AxiosError, type AxiosRequestConfig, type AxiosResponse } from "axios";
import retry from "async-retry";
import { DEFAULT_AXIOS_CONFIG, DEFAULT_REQUEST_RETRY_CONFIG } from "./env";
import logger from "@logger";

/**
 * async-retry wrapped axios static request method.
 * default retry config is retries:3, maxTimeout: 5_000
 * @param url - full URL to request
 * @param config - Axios request config & retry options
 * @returns {AxiosResponse}
 */
export async function retryRequest<T = any, R = AxiosResponse<T>>(
  url: string | URL,
  config?: AxiosRequestConfig & {
    retry?: retry.Options & { shouldBail?: (response: AxiosResponse | AxiosError) => Promise<boolean> | boolean };
  },
): Promise<R> {
  config = { ...DEFAULT_AXIOS_CONFIG, ...config };
  return retry(
    async (bail) => {
      const then = performance.now();
      const r = await axios<T, R>(url.toString(), config).catch((e) => e);
      logger.debug(
        `[retryRequest] ${r.config.method?.toUpperCase()} ${url.toString()} status ${r?.status ?? r?.code} took ${(
          performance.now() - then
        ).toFixed(3)}ms`,
      );
      if ((await config?.retry?.shouldBail?.(r)) === true) bail(r);
      if (r instanceof Error) throw r;
      return r;
    },
    { ...DEFAULT_REQUEST_RETRY_CONFIG, ...config.retry },
  );
}
