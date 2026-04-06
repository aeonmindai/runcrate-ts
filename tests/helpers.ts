import { vi } from "vitest";

interface MockResponseInit {
  status?: number;
  headers?: Record<string, string>;
  body?: unknown;
  rawBody?: ArrayBuffer;
}

export function mockFetch(responses: MockResponseInit[]) {
  let callIndex = 0;
  const calls: { url: string; init: RequestInit }[] = [];

  const fakeFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const resp = responses[callIndex] ?? responses[responses.length - 1]!;
    callIndex++;
    calls.push({ url: url.toString(), init: init ?? {} });

    const status = resp.status ?? 200;
    const headers = new Headers({
      "content-type": "application/json",
      ...resp.headers,
    });

    if (resp.rawBody) {
      headers.set("content-type", "application/octet-stream");
      return new Response(resp.rawBody, { status, headers });
    }

    if (status === 204) {
      return new Response(null, { status, headers });
    }

    const bodyStr = resp.body !== undefined ? JSON.stringify(resp.body) : "";
    return new Response(bodyStr, { status, headers });
  }) as unknown as typeof globalThis.fetch;

  vi.stubGlobal("fetch", fakeFetch);

  return { calls, fakeFetch };
}

export function mockFetchStream(lines: string[], status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];

  const fakeFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: url.toString(), init: init ?? {} });

    const stream = new ReadableStream({
      start(controller) {
        for (const line of lines) {
          controller.enqueue(new TextEncoder().encode(line + "\n"));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      status,
      headers: { "content-type": "text/event-stream" },
    });
  }) as unknown as typeof globalThis.fetch;

  vi.stubGlobal("fetch", fakeFetch);
  return { calls, fakeFetch };
}

export const TEST_API_KEY = "rc_live_test123456";
export const TEST_BASE_URL = "https://runcrate.com";
export const TEST_INFERENCE_URL = "https://api.runcrate.ai";
