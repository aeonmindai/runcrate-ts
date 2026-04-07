import { readFile, writeFile as fsWriteFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname } from "node:path";
import { makeApiError } from "../errors.js";
import { parseSSEStream } from "../streaming.js";
import type { Transport } from "../transport.js";
import type {
  ChatCompletion,
  ChatCompletionParams,
  ImageGeneration,
  ImageGenerationParams,
  Transcription,
  TranscribeParams,
  TTSParams,
  VideoGenerationParams,
  VideoJob,
  VideoSaveParams,
} from "../types.js";
import { removeUndefined } from "../util.js";

const IMAGE_FIELDS = new Set(["image", "startImage", "start_image", "mask", "controlImage", "control_image"]);

const MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

async function resolveImage(value: unknown): Promise<unknown> {
  if (typeof value !== "string") return value;
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) return value;
  if (value.length > 200 && !value.includes("/") && !value.includes("\\")) return value;
  if (existsSync(value)) {
    const ext = extname(value).toLowerCase();
    const mime = MIME_MAP[ext] ?? "image/png";
    const data = await readFile(value);
    return `data:${mime};base64,${data.toString("base64")}`;
  }
  return value;
}

async function resolveImageFields(params: Record<string, unknown>): Promise<Record<string, unknown>> {
  for (const key of Object.keys(params)) {
    if (IMAGE_FIELDS.has(key)) {
      params[key] = await resolveImage(params[key]);
    }
  }
  return params;
}

function decodeImageBytes(imgData: { url?: string | null; b64Json?: string | null }): Buffer | null {
  if (imgData.b64Json) {
    return Buffer.from(imgData.b64Json, "base64");
  }
  if (imgData.url?.startsWith("data:")) {
    const raw = imgData.url.split(",")[1];
    if (raw) return Buffer.from(raw, "base64");
  }
  return null;
}

export class Models {
  private readonly inferenceUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly transport: Transport,
    inferenceUrl: string,
    apiKey: string,
  ) {
    this.inferenceUrl = inferenceUrl;
    this.apiKey = apiKey;
  }

  async chatCompletion(
    params: ChatCompletionParams & { stream: true },
  ): Promise<AsyncGenerator<Record<string, unknown>>>;
  async chatCompletion(
    params: ChatCompletionParams & { stream?: false },
  ): Promise<ChatCompletion>;
  async chatCompletion(
    params: ChatCompletionParams,
  ): Promise<ChatCompletion | AsyncGenerator<Record<string, unknown>>>;
  async chatCompletion(
    params: ChatCompletionParams,
  ): Promise<ChatCompletion | AsyncGenerator<Record<string, unknown>>> {
    const body = removeUndefined(params);

    if (params.stream) {
      const response = await this.transport.streamRequest({
        method: "POST",
        path: "/v1/chat/completions",
        body,
        timeout: 120,
      });
      return parseSSEStream(response);
    }

    const { data } = await this.transport.request<ChatCompletion>({
      method: "POST",
      path: "/v1/chat/completions",
      body,
      noUnwrap: true,
    });
    return data;
  }

  async generateImage(params: ImageGenerationParams): Promise<ImageGeneration & { save(path: string): Promise<void> }> {
    const body = await resolveImageFields(removeUndefined(params));
    const { data } = await this.transport.request<ImageGeneration>({
      method: "POST",
      path: "/v1/images/generations",
      body,
      timeout: 120,
      noUnwrap: true,
    });

    const result = data as ImageGeneration & { save(path: string): Promise<void> };
    result.save = async (path: string) => {
      const imgData = result.data[0];
      if (!imgData) throw new Error("No image data in response");

      const bytes = decodeImageBytes(imgData);
      if (bytes) {
        await fsWriteFile(path, bytes);
        return;
      }

      if (imgData.url) {
        const resp = await fetch(imgData.url);
        await fsWriteFile(path, Buffer.from(await resp.arrayBuffer()));
        return;
      }

      throw new Error("No image data available to save");
    };

    return result;
  }

  async generateVideo(params: VideoGenerationParams): Promise<VideoJob> {
    const body = await resolveImageFields(removeUndefined(params));
    const { data } = await this.transport.request<VideoJob>({
      method: "POST",
      path: "/v1/videos",
      body,
      timeout: 120,
      noUnwrap: true,
    });
    return data;
  }

  async getVideoStatus(id: string): Promise<VideoJob> {
    const { data } = await this.transport.request<VideoJob>({
      method: "GET",
      path: `/v1/videos/${id}`,
      noUnwrap: true,
    });
    return data;
  }

  async downloadVideo(id: string): Promise<Buffer> {
    const { data } = await this.transport.request<ArrayBuffer>({
      method: "GET",
      path: `/v1/videos/${id}/download`,
      timeout: 120,
      raw: true,
    });
    return Buffer.from(data);
  }

  async generateVideoAndSave(
    path: string,
    params: VideoSaveParams,
  ): Promise<VideoJob> {
    const { pollInterval = 5000, onStatus, ...genParams } = params;

    let job = await this.generateVideo(genParams);

    while (job.status !== "completed" && job.status !== "failed") {
      await new Promise((r) => setTimeout(r, pollInterval));
      job = await this.getVideoStatus(job.id);
      onStatus?.(job);
    }

    if (job.status === "failed") {
      throw new Error(`Video generation failed (job ${job.id})`);
    }

    const videoBytes = await this.downloadVideo(job.id);
    await fsWriteFile(path, videoBytes);

    return job;
  }

  async textToSpeech(params: TTSParams): Promise<Buffer> {
    const { data } = await this.transport.request<ArrayBuffer>({
      method: "POST",
      path: "/v1/audio/speech",
      body: removeUndefined(params),
      timeout: 120,
      raw: true,
    });
    return Buffer.from(data);
  }

  async textToSpeechAndSave(path: string, params: TTSParams): Promise<void> {
    const audio = await this.textToSpeech(params);
    await fsWriteFile(path, audio);
  }

  async transcribe(params: TranscribeParams): Promise<Transcription> {
    const { model, file, filename = "audio.wav", language, responseFormat, ...extra } = params;
    const formData = new FormData();
    formData.append("model", model);
    if (language) formData.append("language", language);
    if (responseFormat) formData.append("response_format", responseFormat);
    for (const [key, value] of Object.entries(extra)) {
      if (value !== undefined) formData.append(key, String(value));
    }

    if (file instanceof Blob) {
      formData.append("file", file, filename);
    } else {
      formData.append("file", new Blob([file as ArrayBuffer]), filename);
    }

    const response = await fetch(
      `${this.inferenceUrl}/v1/audio/transcriptions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "User-Agent": "runcrate-ts/0.1.0",
        },
        body: formData,
      },
    );

    if (response.status >= 400) {
      const json = await response.json().catch(() => null);
      throw makeApiError(response.status, json, `HTTP ${response.status}`);
    }

    return (await response.json()) as Transcription;
  }
}
