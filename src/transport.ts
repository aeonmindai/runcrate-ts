import {
  makeApiError,
  ConnectionError,
  TimeoutError,
  ApiError,
} from "./errors.js";
import type { ListMeta } from "./types.js";

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const BASE_DELAY = 500;
const MAX_DELAY = 30_000;
const JITTER_FACTOR = 0.25;

function backoffDelay(attempt: number, retryAfter?: number): number {
  if (retryAfter !== undefined) return retryAfter * 1000;
  const delay = Math.min(BASE_DELAY * 2 ** attempt, MAX_DELAY);
  const jitter = delay * JITTER_FACTOR * Math.random();
  return delay + jitter;
}

function parseRetryAfter(headers: Headers): number | undefined {
  const value = headers.get("retry-after");
  if (!value) return undefined;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? undefined : parsed;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildUrl(
  baseUrl: string,
  path: string,
  params?: Record<string, unknown>,
): string {
  const url = new URL(path, baseUrl);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

export interface TransportConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
  maxRetries: number;
  customHeaders: Record<string, string>;
}

export interface RequestOptions {
  method: string;
  path: string;
  params?: Record<string, unknown>;
  body?: unknown;
  timeout?: number;
  raw?: boolean;
  noUnwrap?: boolean;
}

export interface ApiResponse<T> {
  data: T;
  meta?: ListMeta;
}

export class Transport {
  private readonly config: TransportConfig;
  private readonly headers: Record<string, string>;

  constructor(config: TransportConfig) {
    this.config = config;
    this.headers = {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "runcrate-ts/0.1.0",
      ...config.customHeaders,
    };
  }

  async request<T>(options: RequestOptions): Promise<ApiResponse<T>> {
    const { method, path, params, body, timeout, raw } = options;
    const url = buildUrl(this.config.baseUrl, path, params);
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      let response: Response;
      try {
        const controller = new AbortController();
        const timeoutMs = (timeout ?? this.config.timeout) * 1000;
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        response = await fetch(url, {
          method,
          headers: this.headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timer);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          lastError = new TimeoutError(`Request timed out: ${method} ${path}`);
        } else {
          lastError = new ConnectionError(
            `Connection failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        if (attempt < this.config.maxRetries) {
          await sleep(backoffDelay(attempt));
          continue;
        }
        throw lastError;
      }

      if (
        RETRYABLE_STATUS_CODES.has(response.status) &&
        attempt < this.config.maxRetries
      ) {
        const retryAfter = parseRetryAfter(response.headers);
        await sleep(backoffDelay(attempt, retryAfter));
        continue;
      }

      if (response.status === 204) {
        return { data: undefined as T };
      }

      if (raw) {
        const buffer = await response.arrayBuffer();
        if (response.status >= 400) {
          throw makeApiError(response.status, null, `HTTP ${response.status}`);
        }
        return { data: buffer as T };
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        const text = await response.text();
        if (response.status >= 400) {
          throw makeApiError(response.status, null, text.slice(0, 200));
        }
        throw new ApiError(
          `Expected JSON response but got ${contentType} (status ${response.status}). Check that baseUrl is correct.`,
          response.status,
          "invalid_response",
        );
      }

      const json = (await response.json()) as Record<string, unknown>;

      if (response.status >= 400) {
        throw makeApiError(
          response.status,
          json,
          `HTTP ${response.status}`,
        );
      }

      const data = options.noUnwrap ? json : (json.data ?? json);
      const meta = options.noUnwrap ? undefined : (json.meta as ListMeta | undefined);

      return { data: data as T, meta };
    }

    throw lastError ?? new Error("Unexpected retry exhaustion");
  }

  async streamRequest(
    options: Omit<RequestOptions, "raw">,
  ): Promise<Response> {
    const { method, path, params, body, timeout } = options;
    const url = buildUrl(this.config.baseUrl, path, params);

    const controller = new AbortController();
    const timeoutMs = (timeout ?? this.config.timeout) * 1000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: this.headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new TimeoutError(`Request timed out: ${method} ${path}`);
      }
      throw new ConnectionError(
        `Connection failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    clearTimeout(timer);

    if (response.status >= 400) {
      const json: unknown = await response.json().catch(() => null);
      throw makeApiError(
        response.status,
        json,
        `HTTP ${response.status}`,
      );
    }

    return response;
  }
}
