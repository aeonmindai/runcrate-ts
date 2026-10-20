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

// ─── Schedules ──────────────────────────────────────────────────────────────

/** What a schedule launches. */
export type ScheduleKind = "instance" | "job";

/**
 * Recurring schedules only: `"skip"` (default) skips a run while the previous run is still live,
 * `"allow"` launches anyway.
 */
export type ScheduleOverlap = "skip" | "allow";

/** How the most recent run went. `null` until the schedule first runs. */
export type ScheduleRunStatus =
  | "launched"
  | "failed"
  | "skipped_budget"
  | "skipped_overlap"
  | "no_access";

/** A job to run: the same fields as creating a job. */
export interface ScheduleJobSpec {
  /** Shell command to run on the machine. */
  command: string;
  gpuType: string;
  /** Whole minutes from 1 to 1440. The job stops after this long. */
  maxRuntimeMinutes: number;
  gpuCount?: number;
  template?: string;
  image?: string;
  /** Environment variables for the command. Names are sent exactly as given. Write-only. */
  env?: Record<string, string>;
  storageId?: string;
  name?: string;
  region?: string;
}

/** An instance to launch: the same fields as creating an instance, with `maxRuntimeMinutes` required. */
export interface ScheduleInstanceSpec {
  name: string;
  /** Required for a schedule, so a scheduled instance always stops on its own. Whole minutes. */
  maxRuntimeMinutes: number;
  gpuType?: string;
  instanceTypeId?: string;
  gpuCount?: number;
  region?: string;
  template?: string;
  sshKeyId?: string;
  storageId?: string;
  /** Write-only. */
  envVars?: Array<{ key: string; value: string }>;
  startupCommands?: string[];
  launchScript?: string;
  launchScriptBase64?: string;
  cpuCores?: number;
  memory?: number;
  storage?: number;
  idleShutdownMinutes?: number;
}

/** What to launch, discriminated on `kind`. */
export type ScheduleSpec =
  | { kind: "instance"; spec: ScheduleInstanceSpec }
  | { kind: "job"; spec: ScheduleJobSpec };

/** A job spec as returned: env values are never returned, only their names in `envKeys`. */
export type ScheduledJobSpec = Omit<ScheduleJobSpec, "env"> & {
  envKeys?: string[];
  [key: string]: unknown;
};

/** An instance spec as returned: env values are never returned, only their names in `envKeys`. */
export type ScheduledInstanceSpec = Omit<ScheduleInstanceSpec, "envVars"> & {
  envKeys?: string[];
  [key: string]: unknown;
};

interface ScheduleBase {
  id: string;
  /** 1 to 63 characters. */
  name: string;
  environmentId: string;
  /** The user the schedule launches as. */
  createdBy: string;
  /** Read-only here: change it through `spec`. */
  maxRuntimeMinutes: number;
  /** One-off: the time it runs (ISO). `null` for a recurring schedule. */
  runAt: string | null;
  /** Recurring: a 5-field cron expression. `null` for a one-off. */
  cron: string | null;
  /** IANA timezone the cron is read in, `"UTC"` by default. */
  timezone: string;
  overlap: ScheduleOverlap;
  enabled: boolean;
  /** `null` when disabled or a one-off that has already run. */
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastStatus: ScheduleRunStatus | null;
  lastError: string | null;
  lastInstanceId: string | null;
  lastJobId: string | null;
  runCount: number;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

/** A schedule that launches an instance or runs a job, once or on a cron. */
export type Schedule =
  | (ScheduleBase & { kind: "instance"; spec: ScheduledInstanceSpec })
  | (ScheduleBase & { kind: "job"; spec: ScheduledJobSpec });

/**
 * When a schedule runs: exactly one of `runAt` (once, at least a minute ahead and at most 365 days)
 * or `cron` (recurring, occurrences at least 15 minutes apart).
 */
export type ScheduleTiming =
  | { runAt: string | Date; cron?: never }
  | { cron: string; runAt?: never };

export type CreateScheduleParams = ScheduleSpec &
  ScheduleTiming & {
    /** IANA timezone, e.g. `"Europe/London"`. Default `"UTC"`. */
    timezone?: string;
    overlap?: ScheduleOverlap;
    /** Defaults to the spec's name, or `"<kind>-schedule"`. */
    name?: string;
    enabled?: boolean;
  };

/**
 * Any of these. `runAt` makes the schedule a one-off (clears `cron`), `cron` makes it recurring
 * (clears `runAt`). `spec` replaces the whole spec, so resend env values.
 */
export type UpdateScheduleParams = (
  | { runAt?: never; cron?: never }
  | { runAt: string | Date; cron?: never }
  | { cron: string; runAt?: never }
) & {
  /** `false` pauses, `true` resumes. */
  enabled?: boolean;
  timezone?: string;
  overlap?: ScheduleOverlap;
  name?: string;
  spec?: ScheduleInstanceSpec | ScheduleJobSpec;
};

export interface ScheduleDeleteResult {
  id: string;
  deleted: true;
}

/** The job a run started. */
export interface ScheduledJob {
  id: string;
  name: string;
  status: string;
  [key: string]: unknown;
}

/** What `runNow` started: `instance` for an instance schedule, `job` for a job schedule. */
export interface RunNowResult {
  schedule: Schedule;
  instance?: Instance;
  job?: ScheduledJob;
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
