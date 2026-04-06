import { describe, it, expect, vi, afterEach } from "vitest";
import { Runcrate } from "../src/client.js";
import { mockFetch, mockFetchStream, TEST_API_KEY } from "./helpers.js";

function makeClient() {
  return new Runcrate({ apiKey: TEST_API_KEY, maxRetries: 0 });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Models resource", () => {
  describe("chatCompletion", () => {
    it("makes a non-streaming chat completion request", async () => {
      const completion = {
        id: "chatcmpl-1",
        object: "chat.completion",
        model: "deepseek-ai/DeepSeek-V3",
        choices: [
          { index: 0, message: { role: "assistant", content: "Hello!" }, finishReason: "stop" },
        ],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      };
      const { calls } = mockFetch([{ body: completion }]);
      const rc = makeClient();

      const result = await rc.models.chatCompletion({
        model: "deepseek-ai/DeepSeek-V3",
        messages: [{ role: "user", content: "Hi" }],
      });

      expect(result).toEqual(completion);
      expect(calls[0]!.url).toContain("api.runcrate.ai/v1/chat/completions");
      const body = JSON.parse(calls[0]!.init.body as string);
      expect(body.model).toBe("deepseek-ai/DeepSeek-V3");
      expect(body.messages).toHaveLength(1);
    });

    it("streams chat completion via SSE", async () => {
      const sseLines = [
        'data: {"id":"1","choices":[{"index":0,"delta":{"content":"Hello"}}]}',
        'data: {"id":"1","choices":[{"index":0,"delta":{"content":" world"}}]}',
        "data: [DONE]",
      ];
      mockFetchStream(sseLines);
      const rc = makeClient();

      const stream = await rc.models.chatCompletion({
        model: "deepseek-ai/DeepSeek-V3",
        messages: [{ role: "user", content: "Hi" }],
        stream: true,
      });

      const chunks: Record<string, unknown>[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect((chunks[0]!.choices as any[])[0].delta.content).toBe("Hello");
      expect((chunks[1]!.choices as any[])[0].delta.content).toBe(" world");
    });

    it("passes optional parameters", async () => {
      mockFetch([{
        body: {
          id: "1",
          object: "chat.completion",
          model: "test",
          choices: [{ index: 0, message: { role: "assistant", content: "ok" } }],
        },
      }]);
      const rc = makeClient();

      await rc.models.chatCompletion({
        model: "test",
        messages: [{ role: "user", content: "Hi" }],
        maxTokens: 100,
        temperature: 0.7,
        topP: 0.9,
        stop: ["\n"],
        frequencyPenalty: 0.5,
        presencePenalty: 0.3,
      });

      const body = JSON.parse(
        (vi.mocked(fetch).mock.calls[0]![1] as RequestInit).body as string,
      );
      expect(body.maxTokens).toBe(100);
      expect(body.temperature).toBe(0.7);
      expect(body.topP).toBe(0.9);
      expect(body.stop).toEqual(["\n"]);
    });
  });

  describe("generateImage", () => {
    it("generates an image", async () => {
      const imageResult = {
        created: 1234567890,
        data: [{ url: "https://example.com/image.png", revisedPrompt: "A cat" }],
      };
      const { calls } = mockFetch([{ body: imageResult }]);
      const rc = makeClient();

      const result = await rc.models.generateImage({
        model: "black-forest-labs/FLUX.1-schnell",
        prompt: "A cat",
        width: 1024,
        height: 768,
      });

      expect(result.created).toEqual(imageResult.created);
      expect(result.data).toEqual(imageResult.data);
      expect(typeof result.save).toBe("function");
      expect(calls[0]!.url).toContain("/v1/images/generations");
      const body = JSON.parse(calls[0]!.init.body as string);
      expect(body.model).toBe("black-forest-labs/FLUX.1-schnell");
      expect(body.width).toBe(1024);
    });

    it("passes all optional image params", async () => {
      mockFetch([{ body: { data: [{ url: "test" }] } }]);
      const rc = makeClient();

      await rc.models.generateImage({
        model: "test",
        prompt: "test",
        aspectRatio: "16:9",
        responseFormat: "b64_json",
        numInferenceSteps: 20,
        guidance: 7.5,
        seed: 42,
        negativePrompt: "blurry",
      });

      const body = JSON.parse(
        (vi.mocked(fetch).mock.calls[0]![1] as RequestInit).body as string,
      );
      expect(body.aspectRatio).toBe("16:9");
      expect(body.seed).toBe(42);
      expect(body.negativePrompt).toBe("blurry");
    });
  });

  describe("generateVideo", () => {
    it("submits a video generation job", async () => {
      const job = { id: "vid_1", status: "queued" };
      const { calls } = mockFetch([{ body: job }]);
      const rc = makeClient();

      const result = await rc.models.generateVideo({
        model: "google/veo-3.0",
        prompt: "A drone over mountains",
        duration: 8,
      });

      expect(result).toEqual(job);
      expect(calls[0]!.url).toContain("/v1/videos");
    });

    it("gets video status", async () => {
      const job = { id: "vid_1", status: "processing" };
      const { calls } = mockFetch([{ body: job }]);
      const rc = makeClient();

      const result = await rc.models.getVideoStatus("vid_1");
      expect(result).toEqual(job);
      expect(calls[0]!.url).toContain("/v1/videos/vid_1");
    });

    it("downloads video as ArrayBuffer", async () => {
      const videoData = new Uint8Array([0, 1, 2, 3, 4]).buffer;
      mockFetch([{ rawBody: videoData }]);
      const rc = makeClient();

      const result = await rc.models.downloadVideo("vid_1");
      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe("textToSpeech", () => {
    it("returns audio as ArrayBuffer", async () => {
      const audioData = new Uint8Array([10, 20, 30]).buffer;
      mockFetch([{ rawBody: audioData }]);
      const rc = makeClient();

      const result = await rc.models.textToSpeech({
        model: "openai/tts-1",
        input: "Hello",
        voice: "alloy",
      });

      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe("transcribe", () => {
    it("sends multipart form data and returns transcription", async () => {
      const transcription = { text: "Hello world", duration: 2.5, language: "en" };
      const { calls } = mockFetch([{ body: transcription }]);
      const rc = makeClient();

      const audioBlob = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/wav" });
      const result = await rc.models.transcribe({
        model: "openai/whisper-1",
        file: audioBlob,
        filename: "test.wav",
      });

      expect(result).toEqual(transcription);
      expect(calls[0]!.url).toContain("/v1/audio/transcriptions");
      // Should NOT have JSON content-type (it's multipart)
      const headers = calls[0]!.init.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBeUndefined();
    });

    it("handles ArrayBuffer input", async () => {
      const transcription = { text: "Test" };
      mockFetch([{ body: transcription }]);
      const rc = makeClient();

      const result = await rc.models.transcribe({
        model: "openai/whisper-1",
        file: new Uint8Array([1, 2, 3]).buffer,
      });

      expect(result.text).toBe("Test");
    });
  });
});
