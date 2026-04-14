import { writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { extname } from 'path';

// src/errors.ts
var RuncrateError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "RuncrateError";
  }
};
var ApiError = class extends RuncrateError {
  statusCode;
  code;
  details;
  constructor(message, statusCode, code, details) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
};
var BadRequestError = class extends ApiError {
  constructor(message, code, details) {
    super(message, 400, code, details);
    this.name = "BadRequestError";
  }
};
var AuthenticationError = class extends ApiError {
  constructor(message, code, details) {
    super(message, 401, code, details);
    this.name = "AuthenticationError";
  }
};
var InsufficientCreditsError = class extends ApiError {
  constructor(message, code, details) {
    super(message, 402, code, details);
    this.name = "InsufficientCreditsError";
  }
};
var PermissionDeniedError = class extends ApiError {
  constructor(message, code, details) {
    super(message, 403, code, details);
    this.name = "PermissionDeniedError";
  }
};
var NotFoundError = class extends ApiError {
  constructor(message, code, details) {
    super(message, 404, code, details);
    this.name = "NotFoundError";
  }
};
var ConflictError = class extends ApiError {
  constructor(message, code, details) {
    super(message, 409, code, details);
    this.name = "ConflictError";
  }
};
var UnprocessableEntityError = class extends ApiError {
  constructor(message, code, details) {
    super(message, 422, code, details);
    this.name = "UnprocessableEntityError";
  }
};
var RateLimitError = class extends ApiError {
  constructor(message, code, details) {
    super(message, 429, code, details);
    this.name = "RateLimitError";
  }
};
var InternalServerError = class extends ApiError {
  constructor(message, code, details) {
    super(message, 500, code, details);
    this.name = "InternalServerError";
  }
};
var ConnectionError = class extends RuncrateError {
  constructor(message) {
    super(message);
    this.name = "ConnectionError";
  }
};
var TimeoutError = class extends RuncrateError {
  constructor(message) {
    super(message);
    this.name = "TimeoutError";
  }
};
var STATUS_MAP = {
  400: BadRequestError,
  401: AuthenticationError,
  402: InsufficientCreditsError,
  403: PermissionDeniedError,
  404: NotFoundError,
  409: ConflictError,
  422: UnprocessableEntityError,
  429: RateLimitError,
  500: InternalServerError
};
function extractErrorInfo(body) {
  if (!body || typeof body !== "object") {
    return { message: null, code: null, details: void 0 };
  }
  const b = body;
  if (b.error && typeof b.error === "object") {
    const e = b.error;
    return {
      message: e.message ?? null,
      code: e.code ?? null,
      details: e.details
    };
  }
  if (typeof b.error === "string") {
    return { message: b.error, code: null, details: void 0 };
  }
  if (typeof b.message === "string") {
    return { message: b.message, code: b.code ?? null, details: void 0 };
  }
  if (typeof b.detail === "string") {
    return { message: b.detail, code: null, details: void 0 };
  }
  return { message: JSON.stringify(body), code: null, details: void 0 };
}
function makeApiError(statusCode, body, fallbackMessage) {
  const { message: extractedMessage, code: extractedCode, details } = extractErrorInfo(body);
  const message = extractedMessage ?? fallbackMessage;
  const code = extractedCode ?? "api_error";
  const Cls = STATUS_MAP[statusCode];
  if (!Cls) {
    return new ApiError(message, statusCode, code, details);
  }
  return new Cls(message, code, details);
}

// src/util.ts
function removeUndefined(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== void 0) {
      result[key] = value;
    }
  }
  return result;
}
function camelToSnake(str) {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}
function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
function toSnakeCase(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== void 0) {
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        result[camelToSnake(key)] = toSnakeCase(value);
      } else {
        result[camelToSnake(key)] = value;
      }
    }
  }
  return result;
}
function toCamelCase(obj) {
  if (obj === null || obj === void 0) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(toCamelCase);
  }
  if (typeof obj === "object") {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[snakeToCamel(key)] = toCamelCase(value);
    }
    return result;
  }
  return obj;
}

// src/transport.ts
var RETRYABLE_STATUS_CODES = /* @__PURE__ */ new Set([429, 500, 502, 503, 504]);
var BASE_DELAY = 500;
var MAX_DELAY = 3e4;
var JITTER_FACTOR = 0.25;
function backoffDelay(attempt, retryAfter) {
  if (retryAfter !== void 0) return retryAfter * 1e3;
  const delay = Math.min(BASE_DELAY * 2 ** attempt, MAX_DELAY);
  const jitter = delay * JITTER_FACTOR * Math.random();
  return delay + jitter;
}
function parseRetryAfter(headers) {
  const value = headers.get("retry-after");
  if (!value) return void 0;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? void 0 : parsed;
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function buildUrl(baseUrl, path, params) {
  const url = new URL(path, baseUrl);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== void 0 && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}
var Transport = class {
  config;
  headers;
  constructor(config) {
    this.config = config;
    this.headers = {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "runcrate-ts/0.1.0",
      ...config.customHeaders
    };
  }
  async request(options) {
    const { method, path, params, body, timeout, raw } = options;
    const mergedParams = this.config.environment ? { environment: this.config.environment, ...params } : params;
    const url = buildUrl(this.config.baseUrl, path, mergedParams);
    let lastError;
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      let response;
      try {
        const controller = new AbortController();
        const timeoutMs = (timeout ?? this.config.timeout) * 1e3;
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        response = await fetch(url, {
          method,
          headers: this.headers,
          body: body ? JSON.stringify(body) : void 0,
          signal: controller.signal
        });
        clearTimeout(timer);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          lastError = new TimeoutError(`Request timed out: ${method} ${path}`);
        } else {
          lastError = new ConnectionError(
            `Connection failed: ${err instanceof Error ? err.message : String(err)}`
          );
        }
        if (attempt < this.config.maxRetries) {
          await sleep(backoffDelay(attempt));
          continue;
        }
        throw lastError;
      }
      if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < this.config.maxRetries) {
        const retryAfter = parseRetryAfter(response.headers);
        await sleep(backoffDelay(attempt, retryAfter));
        continue;
      }
      if (response.status === 204) {
        return { data: void 0 };
      }
      if (raw) {
        const buffer = await response.arrayBuffer();
        if (response.status >= 400) {
          throw makeApiError(response.status, null, `HTTP ${response.status}`);
        }
        return { data: buffer };
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
          "invalid_response"
        );
      }
      const json = await response.json();
      if (response.status >= 400) {
        throw makeApiError(
          response.status,
          json,
          `HTTP ${response.status}`
        );
      }
      const rawData = options.noUnwrap ? json : json.data ?? json;
      const data = toCamelCase(rawData);
      const meta = options.noUnwrap ? void 0 : toCamelCase(json.meta);
      return { data, meta };
    }
    throw lastError ?? new Error("Unexpected retry exhaustion");
  }
  async streamRequest(options) {
    const { method, path, params, body, timeout } = options;
    const url = buildUrl(this.config.baseUrl, path, params);
    const controller = new AbortController();
    const timeoutMs = (timeout ?? this.config.timeout) * 1e3;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetch(url, {
        method,
        headers: this.headers,
        body: body ? JSON.stringify(body) : void 0,
        signal: controller.signal
      });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new TimeoutError(`Request timed out: ${method} ${path}`);
      }
      throw new ConnectionError(
        `Connection failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    clearTimeout(timer);
    if (response.status >= 400) {
      const json = await response.json().catch(() => null);
      throw makeApiError(
        response.status,
        json,
        `HTTP ${response.status}`
      );
    }
    return response;
  }
};

// src/resources/instances.ts
var Instances = class {
  constructor(transport) {
    this.transport = transport;
  }
  transport;
  async list(params) {
    const { data } = await this.transport.request({
      method: "GET",
      path: "/api/v1/instances",
      params: params ? removeUndefined(params) : void 0
    });
    return data;
  }
  async create(params) {
    const { data } = await this.transport.request({
      method: "POST",
      path: "/api/v1/instances",
      body: toSnakeCase(params)
    });
    return data;
  }
  async get(id) {
    const { data } = await this.transport.request({
      method: "GET",
      path: `/api/v1/instances/${id}`
    });
    return data;
  }
  async terminate(id) {
    await this.transport.request({
      method: "DELETE",
      path: `/api/v1/instances/${id}`
    });
  }
  async getStatus(id) {
    const { data } = await this.transport.request({
      method: "GET",
      path: `/api/v1/instances/${id}/status`
    });
    return data;
  }
  async listTypes(params) {
    const { data } = await this.transport.request({
      method: "GET",
      path: "/api/v1/instances/types",
      params: params ? removeUndefined(params) : void 0
    });
    return data;
  }
};

// src/resources/environments.ts
var Environments = class {
  constructor(transport) {
    this.transport = transport;
  }
  transport;
  async list() {
    const { data } = await this.transport.request({
      method: "GET",
      path: "/api/v1/environments"
    });
    return data;
  }
  async create(params) {
    const { data } = await this.transport.request({
      method: "POST",
      path: "/api/v1/environments",
      body: toSnakeCase(params)
    });
    return data;
  }
  async get(id) {
    const { data } = await this.transport.request({
      method: "GET",
      path: `/api/v1/environments/${id}`
    });
    return data;
  }
  async update(id, params) {
    const { data } = await this.transport.request({
      method: "PATCH",
      path: `/api/v1/environments/${id}`,
      body: toSnakeCase(params)
    });
    return data;
  }
  async delete(id) {
    await this.transport.request({
      method: "DELETE",
      path: `/api/v1/environments/${id}`
    });
  }
};

// src/resources/ssh-keys.ts
var SSHKeys = class {
  constructor(transport) {
    this.transport = transport;
  }
  transport;
  async list() {
    const { data } = await this.transport.request({
      method: "GET",
      path: "/api/v1/ssh-keys"
    });
    return data;
  }
  async create(params) {
    const { data } = await this.transport.request({
      method: "POST",
      path: "/api/v1/ssh-keys",
      body: toSnakeCase(params)
    });
    return data;
  }
  async delete(id) {
    await this.transport.request({
      method: "DELETE",
      path: `/api/v1/ssh-keys/${id}`
    });
  }
};

// src/resources/storage.ts
var Storage = class {
  constructor(transport) {
    this.transport = transport;
  }
  transport;
  async list(params) {
    const { data } = await this.transport.request({
      method: "GET",
      path: "/api/v1/storage",
      params: params ? removeUndefined(params) : void 0
    });
    return data;
  }
  async get(id) {
    const { data } = await this.transport.request({
      method: "GET",
      path: `/api/v1/storage/${id}`
    });
    return data;
  }
  async listRegions() {
    const { data } = await this.transport.request({
      method: "GET",
      path: "/api/v1/storage/regions"
    });
    return data;
  }
  async create(params) {
    const { data } = await this.transport.request({
      method: "POST",
      path: "/api/v1/storage",
      body: toSnakeCase(params)
    });
    return data;
  }
  async resize(id, sizeGb) {
    const { data } = await this.transport.request({
      method: "PATCH",
      path: `/api/v1/storage/${id}`,
      body: { size_gb: sizeGb }
    });
    return data;
  }
  async delete(id) {
    const { data } = await this.transport.request({
      method: "DELETE",
      path: `/api/v1/storage/${id}`
    });
    return data;
  }
};

// src/pagination.ts
var PaginatedResponse = class {
  data;
  meta;
  constructor(data, meta) {
    this.data = data;
    this.meta = meta ?? {};
  }
  get hasMore() {
    return this.meta.hasMore ?? false;
  }
  get cursor() {
    return this.meta.cursor;
  }
  get total() {
    return this.meta.total;
  }
  [Symbol.iterator]() {
    return this.data[Symbol.iterator]();
  }
  get length() {
    return this.data.length;
  }
};

// src/resources/billing.ts
var Billing = class {
  constructor(transport) {
    this.transport = transport;
  }
  transport;
  async getBalance() {
    const { data } = await this.transport.request({
      method: "GET",
      path: "/api/v1/billing/balance"
    });
    return data;
  }
  async listTransactions(params) {
    const queryParams = {
      limit: params?.limit ?? 50,
      offset: params?.offset ?? 0,
      type: params?.type
    };
    const { data, meta } = await this.transport.request({
      method: "GET",
      path: "/api/v1/billing/transactions",
      params: removeUndefined(queryParams)
    });
    return new PaginatedResponse(data, meta);
  }
  async usage(params) {
    const { data } = await this.transport.request({
      method: "GET",
      path: "/api/v1/billing/usage",
      params: params ? removeUndefined(params) : void 0
    });
    return data;
  }
};

// src/resources/templates.ts
var Templates = class {
  constructor(transport) {
    this.transport = transport;
  }
  transport;
  async list(params) {
    const queryParams = {
      page: params?.page ?? 1,
      page_size: params?.pageSize ?? 25,
      search: params?.search,
      category: params?.category,
      sort_by: params?.sortBy,
      sort_dir: params?.sortDir
    };
    const { data, meta } = await this.transport.request({
      method: "GET",
      path: "/api/v1/templates",
      params: removeUndefined(queryParams)
    });
    return new PaginatedResponse(data, meta);
  }
};

// src/streaming.ts
async function* parseSSEStream(response) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body is not readable");
  }
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") return;
        try {
          yield JSON.parse(data);
        } catch {
          continue;
        }
      }
    }
    if (buffer.trim().startsWith("data: ")) {
      const data = buffer.trim().slice(6);
      if (data !== "[DONE]") {
        try {
          yield JSON.parse(data);
        } catch {
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// src/resources/models.ts
var IMAGE_FIELDS = /* @__PURE__ */ new Set(["image", "startImage", "start_image", "mask", "controlImage", "control_image"]);
var MIME_MAP = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif"
};
async function resolveImage(value) {
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
async function resolveImageFields(params) {
  for (const key of Object.keys(params)) {
    if (IMAGE_FIELDS.has(key)) {
      params[key] = await resolveImage(params[key]);
    }
  }
  return params;
}
function decodeImageBytes(imgData) {
  if (imgData.b64Json) {
    return Buffer.from(imgData.b64Json, "base64");
  }
  if (imgData.url?.startsWith("data:")) {
    const raw = imgData.url.split(",")[1];
    if (raw) return Buffer.from(raw, "base64");
  }
  return null;
}
var Models = class {
  constructor(transport, inferenceUrl, apiKey) {
    this.transport = transport;
    this.inferenceUrl = inferenceUrl;
    this.apiKey = apiKey;
  }
  transport;
  inferenceUrl;
  apiKey;
  async chatCompletion(params) {
    const body = removeUndefined(params);
    if (params.stream) {
      const response = await this.transport.streamRequest({
        method: "POST",
        path: "/v1/chat/completions",
        body,
        timeout: 120
      });
      return parseSSEStream(response);
    }
    const { data } = await this.transport.request({
      method: "POST",
      path: "/v1/chat/completions",
      body,
      noUnwrap: true
    });
    return data;
  }
  async generateImage(params) {
    const body = await resolveImageFields(removeUndefined(params));
    const { data } = await this.transport.request({
      method: "POST",
      path: "/v1/images/generations",
      body,
      timeout: 120,
      noUnwrap: true
    });
    const result = data;
    result.save = async (path) => {
      const imgData = result.data[0];
      if (!imgData) throw new Error("No image data in response");
      const bytes = decodeImageBytes(imgData);
      if (bytes) {
        await writeFile(path, bytes);
        return;
      }
      if (imgData.url) {
        const resp = await fetch(imgData.url);
        await writeFile(path, Buffer.from(await resp.arrayBuffer()));
        return;
      }
      throw new Error("No image data available to save");
    };
    return result;
  }
  async generateVideo(params) {
    const body = await resolveImageFields(removeUndefined(params));
    const { data } = await this.transport.request({
      method: "POST",
      path: "/v1/videos",
      body,
      timeout: 120,
      noUnwrap: true
    });
    return data;
  }
  async getVideoStatus(id) {
    const { data } = await this.transport.request({
      method: "GET",
      path: `/v1/videos/${id}`,
      noUnwrap: true
    });
    return data;
  }
  async downloadVideo(id) {
    const { data } = await this.transport.request({
      method: "GET",
      path: `/v1/videos/${id}/download`,
      timeout: 120,
      raw: true
    });
    return Buffer.from(data);
  }
  async generateVideoAndSave(path, params) {
    const { pollInterval = 5e3, onStatus, ...genParams } = params;
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
    await writeFile(path, videoBytes);
    return job;
  }
  async textToSpeech(params) {
    const { data } = await this.transport.request({
      method: "POST",
      path: "/v1/audio/speech",
      body: removeUndefined(params),
      timeout: 120,
      raw: true
    });
    return Buffer.from(data);
  }
  async textToSpeechAndSave(path, params) {
    const audio = await this.textToSpeech(params);
    await writeFile(path, audio);
  }
  async transcribe(params) {
    const { model, file, filename = "audio.wav", language, responseFormat, ...extra } = params;
    const formData = new FormData();
    formData.append("model", model);
    if (language) formData.append("language", language);
    if (responseFormat) formData.append("response_format", responseFormat);
    for (const [key, value] of Object.entries(extra)) {
      if (value !== void 0) formData.append(key, String(value));
    }
    if (file instanceof Blob) {
      formData.append("file", file, filename);
    } else {
      formData.append("file", new Blob([file]), filename);
    }
    const response = await fetch(
      `${this.inferenceUrl}/v1/audio/transcriptions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "User-Agent": "runcrate-ts/0.1.0"
        },
        body: formData
      }
    );
    if (response.status >= 400) {
      const json = await response.json().catch(() => null);
      throw makeApiError(response.status, json, `HTTP ${response.status}`);
    }
    return await response.json();
  }
};

// src/client.ts
var DEFAULT_BASE_URL = "https://www.runcrate.ai";
var DEFAULT_INFERENCE_URL = "https://api.runcrate.ai";
var DEFAULT_TIMEOUT = 30;
var DEFAULT_MAX_RETRIES = 3;
function resolveApiKey(config) {
  const key = config?.apiKey ?? process.env.RUNCRATE_API_KEY;
  if (!key) {
    throw new Error(
      "API key is required. Pass it as `apiKey` or set the RUNCRATE_API_KEY environment variable."
    );
  }
  if (!key.startsWith("rc_live_")) {
    throw new Error(
      'Invalid API key format. Keys must start with "rc_live_".'
    );
  }
  return key;
}
function trimTrailingSlash(url) {
  return url.replace(/\/+$/, "");
}
var Runcrate = class {
  instances;
  environments;
  sshKeys;
  storage;
  billing;
  templates;
  models;
  // ─── OpenAI-compatible aliases ─────────────────────────────────────────────
  /** OpenAI-compatible chat namespace: `rc.chat.completions.create(...)` */
  chat;
  /** OpenAI-compatible images namespace: `rc.images.generate(...)` */
  images;
  /** OpenAI-compatible audio namespace: `rc.audio.speech.create(...)`, `rc.audio.transcriptions.create(...)` */
  audio;
  /** Video namespace: `rc.videos.generate(...)` */
  videos;
  constructor(config) {
    const apiKey = resolveApiKey(config);
    const baseUrl = trimTrailingSlash(config?.baseUrl ?? DEFAULT_BASE_URL);
    const inferenceUrl = trimTrailingSlash(
      config?.inferenceUrl ?? DEFAULT_INFERENCE_URL
    );
    const timeout = config?.timeout ?? DEFAULT_TIMEOUT;
    const maxRetries = config?.maxRetries ?? DEFAULT_MAX_RETRIES;
    const customHeaders = config?.customHeaders ?? {};
    const environment = config?.environment;
    const infraTransport = new Transport({
      baseUrl,
      apiKey,
      timeout,
      maxRetries,
      customHeaders,
      environment
    });
    const inferenceTransport = new Transport({
      baseUrl: inferenceUrl,
      apiKey,
      timeout,
      maxRetries,
      customHeaders
    });
    this.instances = new Instances(infraTransport);
    this.environments = new Environments(infraTransport);
    this.sshKeys = new SSHKeys(infraTransport);
    this.storage = new Storage(infraTransport);
    this.billing = new Billing(infraTransport);
    this.templates = new Templates(infraTransport);
    this.models = new Models(inferenceTransport, inferenceUrl, apiKey);
    this.chat = {
      completions: {
        create: (params) => this.models.chatCompletion(params)
      }
    };
    this.images = {
      generate: (params) => this.models.generateImage(params)
    };
    this.audio = {
      speech: {
        create: (params) => this.models.textToSpeech(params)
      },
      transcriptions: {
        create: (params) => this.models.transcribe(params)
      }
    };
    this.videos = {
      generate: (params) => this.models.generateVideo(params),
      getStatus: (id) => this.models.getVideoStatus(id),
      download: (id) => this.models.downloadVideo(id),
      generateAndSave: (path, params) => this.models.generateVideoAndSave(path, params)
    };
  }
};

export { ApiError, AuthenticationError, BadRequestError, ConflictError, ConnectionError, InsufficientCreditsError, InternalServerError, NotFoundError, PaginatedResponse, PermissionDeniedError, RateLimitError, Runcrate, RuncrateError, TimeoutError, UnprocessableEntityError, Runcrate as default };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map