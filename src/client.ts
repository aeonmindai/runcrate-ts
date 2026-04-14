import type {
  RuncrateConfig,
  ChatCompletionParams,
  ChatCompletion,
  ImageGenerationParams,
  ImageGeneration,
  TTSParams,
  TranscribeParams,
  Transcription,
  VideoGenerationParams,
  VideoJob,
  VideoSaveParams,
} from "./types.js";
import { Transport } from "./transport.js";
import { Instances } from "./resources/instances.js";
import { Environments } from "./resources/environments.js";
import { SSHKeys } from "./resources/ssh-keys.js";
import { Storage } from "./resources/storage.js";
import { Billing } from "./resources/billing.js";
import { Templates } from "./resources/templates.js";
import { Models } from "./resources/models.js";

const DEFAULT_BASE_URL = "https://runcrate.ai";
const DEFAULT_INFERENCE_URL = "https://api.runcrate.ai";
const DEFAULT_TIMEOUT = 30;
const DEFAULT_MAX_RETRIES = 3;

function resolveApiKey(config?: RuncrateConfig): string {
  const key = config?.apiKey ?? process.env.RUNCRATE_API_KEY;
  if (!key) {
    throw new Error(
      "API key is required. Pass it as `apiKey` or set the RUNCRATE_API_KEY environment variable.",
    );
  }
  if (!key.startsWith("rc_live_")) {
    throw new Error(
      'Invalid API key format. Keys must start with "rc_live_".',
    );
  }
  return key;
}

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

// ─── OpenAI-compatible interface types ─────────────────────────────────────

interface ChatCompletionsNamespace {
  create(params: ChatCompletionParams): Promise<ChatCompletion | AsyncGenerator<Record<string, unknown>>>;
}

interface ChatNamespace {
  completions: ChatCompletionsNamespace;
}

interface ImagesNamespace {
  generate(params: ImageGenerationParams): Promise<ImageGeneration & { save(path: string): Promise<void> }>;
}

interface SpeechNamespace {
  create(params: TTSParams): Promise<Buffer>;
}

interface TranscriptionsNamespace {
  create(params: TranscribeParams): Promise<Transcription>;
}

interface AudioNamespace {
  speech: SpeechNamespace;
  transcriptions: TranscriptionsNamespace;
}

interface VideosNamespace {
  generate(params: VideoGenerationParams): Promise<VideoJob>;
  getStatus(id: string): Promise<VideoJob>;
  download(id: string): Promise<Buffer>;
  generateAndSave(path: string, params: VideoSaveParams): Promise<VideoJob>;
}

// ─── Client ────────────────────────────────────────────────────────────────

export class Runcrate {
  readonly instances: Instances;
  readonly environments: Environments;
  readonly sshKeys: SSHKeys;
  readonly storage: Storage;
  readonly billing: Billing;
  readonly templates: Templates;
  readonly models: Models;

  // ─── OpenAI-compatible aliases ─────────────────────────────────────────────
  /** OpenAI-compatible chat namespace: `rc.chat.completions.create(...)` */
  readonly chat: ChatNamespace;
  /** OpenAI-compatible images namespace: `rc.images.generate(...)` */
  readonly images: ImagesNamespace;
  /** OpenAI-compatible audio namespace: `rc.audio.speech.create(...)`, `rc.audio.transcriptions.create(...)` */
  readonly audio: AudioNamespace;
  /** Video namespace: `rc.videos.generate(...)` */
  readonly videos: VideosNamespace;

  constructor(config?: RuncrateConfig) {
    const apiKey = resolveApiKey(config);
    const baseUrl = trimTrailingSlash(config?.baseUrl ?? DEFAULT_BASE_URL);
    const inferenceUrl = trimTrailingSlash(
      config?.inferenceUrl ?? DEFAULT_INFERENCE_URL,
    );
    const timeout = config?.timeout ?? DEFAULT_TIMEOUT;
    const maxRetries = config?.maxRetries ?? DEFAULT_MAX_RETRIES;
    const customHeaders = config?.customHeaders ?? {};
    const environment = config?.environment;

    // Infrastructure transport (runcrate.com)
    const infraTransport = new Transport({
      baseUrl,
      apiKey,
      timeout,
      maxRetries,
      customHeaders,
      environment,
    });

    // Inference transport (api.runcrate.ai)
    const inferenceTransport = new Transport({
      baseUrl: inferenceUrl,
      apiKey,
      timeout,
      maxRetries,
      customHeaders,
    });

    this.instances = new Instances(infraTransport);
    this.environments = new Environments(infraTransport);
    this.sshKeys = new SSHKeys(infraTransport);
    this.storage = new Storage(infraTransport);
    this.billing = new Billing(infraTransport);
    this.templates = new Templates(infraTransport);
    this.models = new Models(inferenceTransport, inferenceUrl, apiKey);

    // ─── OpenAI-compatible aliases ─────────────────────────────────────────────
    this.chat = {
      completions: {
        create: (params: ChatCompletionParams) => this.models.chatCompletion(params),
      },
    };

    this.images = {
      generate: (params: ImageGenerationParams) => this.models.generateImage(params),
    };

    this.audio = {
      speech: {
        create: (params: TTSParams) => this.models.textToSpeech(params),
      },
      transcriptions: {
        create: (params: TranscribeParams) => this.models.transcribe(params),
      },
    };

    this.videos = {
      generate: (params: VideoGenerationParams) => this.models.generateVideo(params),
      getStatus: (id: string) => this.models.getVideoStatus(id),
      download: (id: string) => this.models.downloadVideo(id),
      generateAndSave: (path: string, params: VideoSaveParams) =>
        this.models.generateVideoAndSave(path, params),
    };
  }
}

export default Runcrate;
