import { describe, it, expect } from "vitest";
import { parseSSEStream } from "../src/streaming.js";

function makeStreamResponse(lines: string[]): Response {
  const stream = new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(new TextEncoder().encode(line + "\n"));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/event-stream" },
  });
}

describe("parseSSEStream", () => {
  it("parses SSE data lines", async () => {
    const response = makeStreamResponse([
      'data: {"id":"1","content":"hello"}',
      'data: {"id":"2","content":"world"}',
      "data: [DONE]",
    ]);

    const chunks: Record<string, unknown>[] = [];
    for await (const chunk of parseSSEStream(response)) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toEqual({ id: "1", content: "hello" });
    expect(chunks[1]).toEqual({ id: "2", content: "world" });
  });

  it("ignores non-data lines", async () => {
    const response = makeStreamResponse([
      ": comment line",
      "",
      'data: {"value":1}',
      "event: ping",
      'data: {"value":2}',
      "data: [DONE]",
    ]);

    const chunks: Record<string, unknown>[] = [];
    for await (const chunk of parseSSEStream(response)) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(2);
  });

  it("stops at [DONE]", async () => {
    const response = makeStreamResponse([
      'data: {"n":1}',
      "data: [DONE]",
      'data: {"n":2}', // should not be yielded
    ]);

    const chunks: Record<string, unknown>[] = [];
    for await (const chunk of parseSSEStream(response)) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({ n: 1 });
  });

  it("handles empty stream", async () => {
    const response = makeStreamResponse(["data: [DONE]"]);

    const chunks: Record<string, unknown>[] = [];
    for await (const chunk of parseSSEStream(response)) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(0);
  });

  it("handles stream with only whitespace lines", async () => {
    const response = makeStreamResponse(["", "  ", "\t"]);

    const chunks: Record<string, unknown>[] = [];
    for await (const chunk of parseSSEStream(response)) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(0);
  });

  it("parses complex nested JSON chunks", async () => {
    const response = makeStreamResponse([
      'data: {"choices":[{"index":0,"delta":{"role":"assistant","content":"Hi"},"finish_reason":null}]}',
      "data: [DONE]",
    ]);

    const chunks: Record<string, unknown>[] = [];
    for await (const chunk of parseSSEStream(response)) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(1);
    const choices = chunks[0]!.choices as { delta: { content: string } }[];
    expect(choices[0]!.delta.content).toBe("Hi");
  });
});
