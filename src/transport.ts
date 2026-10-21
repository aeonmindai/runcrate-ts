import { randomUUID } from "node:crypto";
import {
  makeApiError,
  ConnectionError,
  TimeoutError,
  ApiError,
} from "./errors.js";
import type { ListMeta } from "./types.js";
import { toCamelCase } from "./util.js";

const RETRYABLE_STATUS_CODES: Record<number, true> = { 429: true, 500: true, 502: true, 503: true, 504: true };
/**
 * The statuses that say a request was not acted on: rate limited before the handler ran (429), or
 * refused for no capacity before anything was created (503). The only statuses a request that is
 * not safe to send twice is retried on.
 */
const NOT_ACTED_ON_STATUS_CODES: Record<number, true> = { 429: true, 503: true };
/**
 * Errors raised before a request left this machine (the connection never opened), so the server
 * cannot have seen it: safe to retry for any request.
 */
const NOT_SENT_ERROR_CODES: Record<string, true> = {
  ECONNREFUSED: true,
  ENOTFOUND: true,
  EAI_AGAIN: true,
  EHOSTUNREACH: true,
  ENETUNREACH: true,
  UND_ERR_CONNECT_TIMEOUT: true,
};
/** How long a retry waits at least while the server still handles the same Idempotency-Key, in ms. */
const IN_PROGRESS_MIN_DELAY = 3_000;
const BASE_DELAY = 500;
const MAX_DELAY = 30_000;
const JITTER_FACTOR = 0.25;
/** The longest a Retry-After header is honoured, in seconds: a server asking for more is capped. */
const MAX_RETRY_AFTER = 60;
/**
 * Error codes that are never retried, whatever their status: the same request fails the same way.
 * `launch_refused` (502): the machine was refused for the request itself, not for capacity.
 */
const NON_RETRYABLE_CODES: Record<string, true> = { launch_refused: true };

/** Seconds a launch (instance create, schedule run-now) gets at least: the route may take 60 s. */
export const LAUNCH_TIMEOUT = 75;

/** A fresh Idempotency-Key: one per call, sent again on each of that call's retries. */
export function newIdempotencyKey(): string {
  return randomUUID();
}

function backoffDelay(attempt: number, retryAfter?: number): number {
  if (retryAfter !== undefined) return Math.min(Math.max(retryAfter, 0), MAX_RETRY_AFTER) * 1000;
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

/** The API error code and `details.reason` of a JSON error response, read from a copy (the body stays readable). */
async function errorInfo(response: Response): Promise<{ code: string | null; reason: string | null }> {
  const none = { code: null, reason: null };
  if (!(response.headers.get("content-type") ?? "").includes("application/json")) return none;
  try {
    const json = (await response.clone().json()) as { error?: { code?: unknown; details?: { reason?: unknown } } };
    const code = json?.error?.code;
    const reason = json?.error?.details?.reason;
    return { code: typeof code === "string" ? code : null, reason: typeof reason === "string" ? reason : null };
  } catch {
    return none;
  }
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
      if (value === undefined || value === null) continue;
      // An array is a repeated parameter (?tag=a:1&tag=b:2).
      for (const item of Array.isArray(value) ? value : [value]) url.searchParams.append(key, String(item));
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
  /** Optional environment name. Appended as ?environment=<name> to every request. */
  environment?: string;
  /**
   * Whether a POST is safe to send twice unless a request says otherwise. False for the
   * infrastructure API, where a POST creates or launches something; true for inference.
   */
  postsAreIdempotent?: boolean;
}

export interface RequestOptions {
  method: string;
  path: string;
  params?: Record<string, unknown>;
  body?: unknown;
  timeout?: number;
  /** Seconds the request gets at least, whatever the client's timeout (a launch takes a while). */
  minTimeout?: number;
  raw?: boolean;
  noUnwrap?: boolean;
  /**
   * Sent as the Idempotency-Key header, the same on every retry of this call. On a route that
   * honours it, a retry answers the first request's result instead of doing it again.
   */
  idempotencyKey?: string;
  /**
   * Whether sending this request twice is harmless. GET, PATCH, PUT and DELETE are; a POST only
   * when its route dedupes it (an honoured Idempotency-Key, or an action that is the same done
   * twice). A request that is not is never sent again once it may have reached the server (a
   * timeout, a lost connection, a 500, 502 or 504): only a 429 or 503, which say nothing was done,
   * and a connection that never opened are retried.
   */
  idempotent?: boolean;
  /** Response keys whose values are user data (tag names, env names): kept as sent, not camelCased. */
  rawKeys?: readonly string[];
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
    const response = await this.send(options);

    if (response.status === 204) {
      return { data: undefined as T };
    }

    if (options.raw) {
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

    const rawData = options.noUnwrap ? json : (json.data ?? json);
    const data = toCamelCase(rawData, options.rawKeys) as T;
    const meta = options.noUnwrap ? undefined : (toCamelCase(json.meta) as ListMeta | undefined);

    return { data, meta };
  }

  /**
   * Where a redirecting GET (an artifact download) points, without following it: the signed URL
   * needs no API key, and the key must not travel to another host.
   */
  async redirectLocation(options: Pick<RequestOptions, "path" | "params" | "timeout">): Promise<string> {
    const response = await this.send({ ...options, method: "GET" }, "manual");
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      return new URL(location, this.config.baseUrl).toString();
    }
    const json: unknown = (response.headers.get("content-type") ?? "").includes("application/json")
      ? await response.json().catch(() => null)
      : null;
    throw makeApiError(response.status >= 400 ? response.status : 502, json, `Expected a redirect, got HTTP ${response.status}`);
  }

  /**
   * Sends the request, retrying what is safe to retry (RequestOptions.idempotent), and answers
   * the last response; throws a TimeoutError or ConnectionError when no response came.
   */
  private async send(options: RequestOptions, redirect: RequestRedirect = "follow"): Promise<Response> {
    const { method, path, params, body, timeout, minTimeout, idempotencyKey } = options;
    const idempotent = options.idempotent
      ?? (method.toUpperCase() !== "POST" || this.config.postsAreIdempotent === true);
    const mergedParams = this.config.environment
      ? { environment: this.config.environment, ...params }
      : params;
    const url = buildUrl(this.config.baseUrl, path, mergedParams);
    const headers = idempotencyKey ? { ...this.headers, "Idempotency-Key": idempotencyKey } : this.headers;
    const timeoutMs = Math.max(timeout ?? this.config.timeout, minTimeout ?? 0) * 1000;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      const canRetry = attempt < this.config.maxRetries;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;
      try {
        response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
          redirect,
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          lastError = new TimeoutError(`Request timed out: ${method} ${path}`);
        } else {
          lastError = new ConnectionError(
            `Connection failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        // Whether the connection never opened, so the server cannot have seen the request.
        const cause = (err as { cause?: { code?: unknown } } | null)?.cause;
        const notSent = typeof cause?.code === "string" && NOT_SENT_ERROR_CODES[cause.code] === true;
        // A request that may have reached the server is only sent again when that is harmless.
        if (canRetry && (idempotent || notSent)) {
          await sleep(backoffDelay(attempt));
          continue;
        }
        throw lastError;
      } finally {
        clearTimeout(timer);
      }

      if (canRetry && (RETRYABLE_STATUS_CODES[response.status] || response.status === 409)) {
        const { code, reason } = await errorInfo(response);
        const retryAfter = parseRetryAfter(response.headers);
        if (response.status === 409) {
          // The first request with this key is still being handled: ask again for its result.
          if (idempotencyKey && reason === "idempotency_in_progress") {
            await sleep(Math.max(backoffDelay(attempt, retryAfter), IN_PROGRESS_MIN_DELAY));
            continue;
          }
        } else if (!NON_RETRYABLE_CODES[code ?? ""] && (idempotent || NOT_ACTED_ON_STATUS_CODES[response.status])) {
          await sleep(backoffDelay(attempt, retryAfter));
          continue;
        }
      }
      return response;
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
