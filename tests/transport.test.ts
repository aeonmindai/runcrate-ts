import { describe, it, expect, vi, afterEach } from "vitest";
import { Transport } from "../src/transport.js";
import { mockFetch, TEST_API_KEY, TEST_BASE_URL } from "./helpers.js";
import {
  ApiError,
  BadRequestError,
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  InternalServerError,
  InsufficientCreditsError,
  PermissionDeniedError,
  ConflictError,
} from "../src/errors.js";

function makeTransport(overrides?: Partial<ConstructorParameters<typeof Transport>[0]>) {
  return new Transport({
    baseUrl: TEST_BASE_URL,
    apiKey: TEST_API_KEY,
    timeout: 30,
    maxRetries: 2,
    customHeaders: {},
    ...overrides,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Transport", () => {
  it("makes a successful GET request", async () => {
    const { calls } = mockFetch([{ body: { data: { id: "1", name: "test" } } }]);
    const transport = makeTransport();

    const result = await transport.request<{ id: string; name: string }>({
      method: "GET",
      path: "/api/v1/test",
    });

    expect(result.data).toEqual({ id: "1", name: "test" });
    expect(calls[0]!.url).toBe("https://runcrate.ai/api/v1/test");
    expect(calls[0]!.init.method).toBe("GET");
  });

  it("sends query parameters", async () => {
    mockFetch([{ body: { data: [] } }]);
    const transport = makeTransport();
    const { calls } = mockFetch([{ body: { data: [] } }]);

    await transport.request({
      method: "GET",
      path: "/api/v1/items",
      params: { search: "gpu", limit: 10 },
    });

    const url = new URL(calls[0]!.url);
    expect(url.searchParams.get("search")).toBe("gpu");
    expect(url.searchParams.get("limit")).toBe("10");
  });

  it("sends JSON body on POST", async () => {
    const { calls } = mockFetch([{ body: { data: { id: "new" } } }]);
    const transport = makeTransport();

    await transport.request({
      method: "POST",
      path: "/api/v1/items",
      body: { name: "test", gpuType: "A100" },
    });

    expect(calls[0]!.init.method).toBe("POST");
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      name: "test",
      gpuType: "A100",
    });
  });

  it("handles 204 No Content", async () => {
    mockFetch([{ status: 204, body: undefined }]);
    const transport = makeTransport();

    const result = await transport.request<void>({
      method: "DELETE",
      path: "/api/v1/items/123",
    });

    expect(result.data).toBeUndefined();
  });

  it("extracts meta from wrapped response", async () => {
    mockFetch([{
      body: {
        data: [{ id: "1" }, { id: "2" }],
        meta: { hasMore: true, total: 50, cursor: "abc" },
      },
    }]);
    const transport = makeTransport();

    const result = await transport.request<unknown[]>({
      method: "GET",
      path: "/api/v1/items",
    });

    expect(result.data).toHaveLength(2);
    expect(result.meta).toEqual({ hasMore: true, total: 50, cursor: "abc" });
  });

  it("returns raw body when raw option is set", async () => {
    const rawData = new Uint8Array([1, 2, 3, 4]).buffer;
    mockFetch([{ rawBody: rawData }]);
    const transport = makeTransport();

    const result = await transport.request<ArrayBuffer>({
      method: "GET",
      path: "/v1/audio",
      raw: true,
    });

    expect(result.data).toBeInstanceOf(ArrayBuffer);
  });

  describe("error handling", () => {
    it("throws BadRequestError on 400", async () => {
      mockFetch([{
        status: 400,
        body: { error: { code: "invalid_params", message: "Bad request" } },
      }]);
      const transport = makeTransport({ maxRetries: 0 });

      await expect(
        transport.request({ method: "GET", path: "/api/v1/test" }),
      ).rejects.toThrow(BadRequestError);
    });

    it("throws AuthenticationError on 401", async () => {
      mockFetch([{
        status: 401,
        body: { error: { code: "invalid_key", message: "Invalid API key" } },
      }]);
      const transport = makeTransport({ maxRetries: 0 });

      await expect(
        transport.request({ method: "GET", path: "/api/v1/test" }),
      ).rejects.toThrow(AuthenticationError);
    });

    it("throws InsufficientCreditsError on 402", async () => {
      mockFetch([{
        status: 402,
        body: { error: { code: "insufficient_credits", message: "Not enough credits" } },
      }]);
      const transport = makeTransport({ maxRetries: 0 });

      await expect(
        transport.request({ method: "GET", path: "/api/v1/test" }),
      ).rejects.toThrow(InsufficientCreditsError);
    });

    it("throws PermissionDeniedError on 403", async () => {
      mockFetch([{
        status: 403,
        body: { error: { code: "forbidden", message: "Forbidden" } },
      }]);
      const transport = makeTransport({ maxRetries: 0 });

      await expect(
        transport.request({ method: "GET", path: "/api/v1/test" }),
      ).rejects.toThrow(PermissionDeniedError);
    });

    it("throws NotFoundError on 404", async () => {
      mockFetch([{
        status: 404,
        body: { error: { code: "not_found", message: "Not found" } },
      }]);
      const transport = makeTransport({ maxRetries: 0 });

      await expect(
        transport.request({ method: "GET", path: "/api/v1/test" }),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws ConflictError on 409", async () => {
      mockFetch([{
        status: 409,
        body: { error: { code: "conflict", message: "Conflict" } },
      }]);
      const transport = makeTransport({ maxRetries: 0 });

      await expect(
        transport.request({ method: "GET", path: "/api/v1/test" }),
      ).rejects.toThrow(ConflictError);
    });

    it("throws RateLimitError on 429 when retries exhausted", async () => {
      mockFetch([
        { status: 429, body: { error: { code: "rate_limited", message: "Rate limited" } } },
        { status: 429, body: { error: { code: "rate_limited", message: "Rate limited" } } },
        { status: 429, body: { error: { code: "rate_limited", message: "Rate limited" } } },
      ]);
      const transport = makeTransport({ maxRetries: 2 });

      await expect(
        transport.request({ method: "GET", path: "/api/v1/test" }),
      ).rejects.toThrow(RateLimitError);
    });

    it("throws InternalServerError on 500 when retries exhausted", async () => {
      mockFetch([
        { status: 500, body: { error: { code: "server_error", message: "Server error" } } },
        { status: 500, body: { error: { code: "server_error", message: "Server error" } } },
        { status: 500, body: { error: { code: "server_error", message: "Server error" } } },
      ]);
      const transport = makeTransport({ maxRetries: 2 });

      await expect(
        transport.request({ method: "GET", path: "/api/v1/test" }),
      ).rejects.toThrow(InternalServerError);
    });

    it("preserves error details", async () => {
      mockFetch([{
        status: 400,
        body: {
          error: {
            code: "validation_error",
            message: "Name is required",
            details: { field: "name" },
          },
        },
      }]);
      const transport = makeTransport({ maxRetries: 0 });

      try {
        await transport.request({ method: "POST", path: "/api/v1/test" });
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestError);
        const apiErr = err as BadRequestError;
        expect(apiErr.code).toBe("validation_error");
        expect(apiErr.message).toBe("Name is required");
        expect(apiErr.details).toEqual({ field: "name" });
      }
    });

    it("falls back to generic ApiError for unknown status codes", async () => {
      mockFetch([{
        status: 418,
        body: { error: { code: "teapot", message: "I'm a teapot" } },
      }]);
      const transport = makeTransport({ maxRetries: 0 });

      try {
        await transport.request({ method: "GET", path: "/api/v1/test" });
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).statusCode).toBe(418);
      }
    });
  });

  describe("retry logic", () => {
    it("retries on 429 and succeeds", async () => {
      const { fakeFetch } = mockFetch([
        { status: 429, body: { error: { code: "rate_limited", message: "Slow down" } } },
        { body: { data: { id: "1" } } },
      ]);
      const transport = makeTransport({ maxRetries: 1 });

      const result = await transport.request<{ id: string }>({
        method: "GET",
        path: "/api/v1/test",
      });

      expect(result.data).toEqual({ id: "1" });
      expect(fakeFetch).toHaveBeenCalledTimes(2);
    });

    it("retries on 500 and succeeds", async () => {
      const { fakeFetch } = mockFetch([
        { status: 500, body: { error: { code: "server_error", message: "Oops" } } },
        { body: { data: { id: "1" } } },
      ]);
      const transport = makeTransport({ maxRetries: 1 });

      const result = await transport.request<{ id: string }>({
        method: "GET",
        path: "/api/v1/test",
      });

      expect(result.data).toEqual({ id: "1" });
      expect(fakeFetch).toHaveBeenCalledTimes(2);
    });

    it("retries on 502 and succeeds", async () => {
      const { fakeFetch } = mockFetch([
        { status: 502, body: { error: { code: "bad_gateway", message: "Bad gateway" } } },
        { body: { data: [] } },
      ]);
      const transport = makeTransport({ maxRetries: 1 });

      const result = await transport.request<unknown[]>({
        method: "GET",
        path: "/api/v1/test",
      });

      expect(result.data).toEqual([]);
      expect(fakeFetch).toHaveBeenCalledTimes(2);
    });

    it("does not retry on 400", async () => {
      const { fakeFetch } = mockFetch([
        { status: 400, body: { error: { code: "bad_request", message: "Bad" } } },
      ]);
      const transport = makeTransport({ maxRetries: 2 });

      await expect(
        transport.request({ method: "GET", path: "/api/v1/test" }),
      ).rejects.toThrow(BadRequestError);
      expect(fakeFetch).toHaveBeenCalledTimes(1);
    });

    it("does not retry on 404", async () => {
      const { fakeFetch } = mockFetch([
        { status: 404, body: { error: { code: "not_found", message: "Not found" } } },
      ]);
      const transport = makeTransport({ maxRetries: 2 });

      await expect(
        transport.request({ method: "GET", path: "/api/v1/test" }),
      ).rejects.toThrow(NotFoundError);
      expect(fakeFetch).toHaveBeenCalledTimes(1);
    });

    it("retries on fetch network error", async () => {
      let callCount = 0;
      vi.stubGlobal("fetch", vi.fn(async () => {
        callCount++;
        if (callCount === 1) throw new TypeError("Failed to fetch");
        return new Response(JSON.stringify({ data: { ok: true } }), {
          headers: { "content-type": "application/json" },
        });
      }));
      const transport = makeTransport({ maxRetries: 1 });

      const result = await transport.request<{ ok: boolean }>({
        method: "GET",
        path: "/api/v1/test",
      });

      expect(result.data).toEqual({ ok: true });
      expect(callCount).toBe(2);
    });
  });
});
