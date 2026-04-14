// ─── Client Config ──────────────────────────────────────────────────────────

export interface RuncrateConfig {
  apiKey?: string;
  baseUrl?: string;
  inferenceUrl?: string;
  timeout?: number;
  maxRetries?: number;
  customHeaders?: Record<string, string>;
  /** Optional environment name. If not set, the workspace's default environment is used. */
  environment?: string;
}

// ─── Shared ─────────────────────────────────────────────────────────────────

export interface ListMeta {
  cursor?: string | null;
  hasMore?: boolean | null;
  total?: number | null;
}

// ─── Instances ──────────────────────────────────────────────────────────────

export interface Instance {
  id: string;
  name: string;
  status: string;
  gpuType?: string | null;
  gpuCount?: number | null;
  cpuCores?: number | null;
  memory?: number | null;
  storage?: number | null;
  region?: string | null;
  ip?: string | null;
  osImage?: string | null;
  costPerHour?: number | null;
  deployedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  [key: string]: unknown;
}

export interface InstanceCreateParams {
  name: string;
  sshKeyId: string;
  gpuType?: string;
  instanceTypeId?: string;
  region?: string;
  gpuCount?: number;
  cpuCores?: number;
  memory?: number;
  storage?: number;
  template?: string;
  envVars?: Record<string, string>;
  startupCommands?: string[];
  storageId?: string;
  launchScript?: string;
  launchScriptBase64?: string;
}

export interface InstanceStatus {
  id: string;
  status: string;
  ip?: string | null;
  [key: string]: unknown;
}

export interface InstanceType {
  id: string;
  gpuType: string;
  gpuCount: number;
  cpuCores: number;
  memoryGb: number;
  storageGb: number;
  region: string;
  deploymentType?: string | null;
  hourlyRate: number;
  [key: string]: unknown;
}

export interface InstanceListParams {
  search?: string;
}

export interface InstanceTypeListParams {
  gpuType?: string;
  region?: string;
  gpuCount?: number;
}

// ─── Environments ───────────────────────────────────────────────────────────

export interface Environment {
  id: string;
  name: string;
  isDefault?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  [key: string]: unknown;
}

export interface EnvironmentCreateParams {
  name: string;
}

export interface EnvironmentUpdateParams {
  name?: string;
  isDefault?: boolean;
}

// ─── SSH Keys ───────────────────────────────────────────────────────────────

export interface SSHKey {
  id: string;
  name: string;
  fingerprint?: string | null;
  type?: string | null;
  createdAt?: string | null;
  lastUsed?: string | null;
  projectId?: string | null;
  [key: string]: unknown;
}

export interface SSHKeyCreateParams {
  name: string;
  publicKey: string;
  type?: string;
}

// ─── Storage ────────────────────────────────────────────────────────────────

export interface StorageVolume {
  id: string;
  name: string;
  sizeGb?: number | null;
  status?: string | null;
  region?: string | null;
  providerType?: string | null;
  deploymentId?: string | null;
  projectId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  [key: string]: unknown;
}

export interface StorageListParams {
  search?: string;
}

export interface StorageCreateParams {
  name: string;
  sizeGb: number;
  region: string;
}

export interface StorageDeleteResult {
  message: string;
  refundAmount?: number;
  [key: string]: unknown;
}

export interface StorageRegion {
  id: string;
  name: string;
  provider: string;
  [key: string]: unknown;
}

// ─── Billing ────────────────────────────────────────────────────────────────

export interface Balance {
  creditsBalance: number;
  activeUsageCost: number;
  [key: string]: unknown;
}

export interface Transaction {
  id: string;
  projectId?: string | null;
  type?: string | null;
  amount?: number | null;
  description?: string | null;
  createdAt?: string | null;
  [key: string]: unknown;
}

export interface TransactionListParams {
  limit?: number;
  offset?: number;
  type?: string;
}

export interface UsageSummary {
  totalRequests?: number | null;
  totalPromptTokens?: number | null;
  totalCompletionTokens?: number | null;
  totalTokens?: number | null;
  totalCost?: number | null;
  [key: string]: unknown;
}

export interface UsageParams {
  from?: string;
  to?: string;
}

// ─── Templates ──────────────────────────────────────────────────────────────

export interface Template {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  createdAt?: string | null;
  [key: string]: unknown;
}

export interface TemplateListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  sortBy?: string;
  sortDir?: string;
}

// ─── Model Inference ────────────────────────────────────────────────────────

export interface ChatMessage {
  role: string;
  content: string | unknown[];
  name?: string;
}

export interface ChatCompletionParams {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stop?: string | string[];
  frequencyPenalty?: number;
  presencePenalty?: number;
  [key: string]: unknown;
}

export interface ChatChoice {
  index: number;
  message: ChatMessage;
  finishReason?: string | null;
  [key: string]: unknown;
}

export interface ChatUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  [key: string]: unknown;
}

export interface ChatCompletion {
  id: string;
  object: string;
  created?: number | null;
  model: string;
  choices: ChatChoice[];
  usage?: ChatUsage | null;
  [key: string]: unknown;
}

export interface ImageGenerationParams {
  model: string;
  prompt: string;
  width?: number;
  height?: number;
  aspectRatio?: string;
  responseFormat?: string;
  numInferenceSteps?: number;
  guidance?: number;
  seed?: number;
  negativePrompt?: string;
  [key: string]: unknown;
}

export interface ImageData {
  url?: string | null;
  b64Json?: string | null;
  revisedPrompt?: string | null;
  [key: string]: unknown;
}

export interface ImageGeneration {
  created?: number | null;
  data: ImageData[];
  [key: string]: unknown;
}

export interface VideoGenerationParams {
  model: string;
  prompt: string;
  duration?: number;
  aspectRatio?: string;
  width?: number;
  height?: number;
  [key: string]: unknown;
}

export interface VideoJob {
  id: string;
  status: string;
  [key: string]: unknown;
}

export interface VideoSaveParams extends VideoGenerationParams {
  pollInterval?: number;
  onStatus?: (job: VideoJob) => void;
}

export interface TTSParams {
  model: string;
  input: string;
  voice?: string;
  responseFormat?: string;
  [key: string]: unknown;
}

export interface TranscribeParams {
  model: string;
  file: Blob | Buffer | ArrayBuffer;
  filename?: string;
  language?: string;
  responseFormat?: string;
  [key: string]: unknown;
}

export interface Transcription {
  text: string;
  duration?: number | null;
  language?: string | null;
  segments?: unknown[] | null;
  [key: string]: unknown;
}
