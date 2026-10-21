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

/** Why an instance stopped. `null` while it is still running or was never stopped. */
export type InstanceStopReason =
  | "user"
  | "max_runtime"
  | "idle"
  | "budget"
  | "low_balance"
  | "failed"
  | "system";

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
  /** Minutes after first reaching `running` when the instance is terminated. `null`: no limit. */
  maxRuntimeMinutes?: number | null;
  /** Minutes of GPU utilisation under 5% with nobody connected before termination. `null`: off. */
  idleShutdownMinutes?: number | null;
  /** ISO timestamp when the max runtime limit terminates the instance. `null`: no limit set. */
  autoStopAt?: string | null;
  /** Why the instance stopped. `null` while it has not stopped. */
  stopReason?: InstanceStopReason | null;
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
  /**
   * Terminate the instance automatically after this many minutes of running.
   * The clock starts when the instance first becomes `running`, and an alert goes out
   * 10 minutes before it stops. Integer from 5 to 10080 (7 days). `null` or omitted: no limit.
   *
   * Recommended for unattended agent work, so a forgotten instance cannot run for days.
   */
  maxRuntimeMinutes?: number | null;
  /**
   * Terminate the instance when GPU utilisation stays under 5% with nobody connected (SSH, web
   * terminal or editor) for this many minutes. Integer from 5 to 1440 (24 hours). GPU instances
   * only. `null` or omitted: off.
   *
   * Recommended for unattended agent work, so an instance that finished its job stops billing.
   */
  idleShutdownMinutes?: number | null;
}

/**
 * A change to a starting or running instance's auto stop. A field left out keeps its value;
 * `null` turns that limit off. Pass at least one.
 */
export interface InstanceUpdateParams {
  /**
   * Total minutes the instance may run, counted from when it started running (5 to 10080). A
   * change never stops it sooner than 2 minutes from now. Extend it before a long job.
   */
  maxRuntimeMinutes?: number | null;
  /**
   * Minutes of GPU utilisation under 5% with nobody connected before termination (5 to 1440).
   * GPU instances launched with idle stop support only.
   */
  idleShutdownMinutes?: number | null;
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

/**
 * How the most recent run went. `null` until the schedule first runs. `"credential_revoked"`: the
 * schedule was paused because the API key it runs with was revoked, deactivated or moved, or the
 * agent sign-in it runs with ended.
 */
export type ScheduleRunStatus =
  | "launched"
  | "failed"
  | "skipped_budget"
  | "skipped_overlap"
  | "no_access"
  | "credential_revoked";

/** What a schedule's runs launch with: a person's sign-in, an API key, or an agent sign-in. */
export type ScheduleRunAsCredential = "user" | "api_key" | "agent";

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
  /** The user who created the schedule. */
  createdBy: string;
  /**
   * The user each run launches as: whoever created the schedule or last changed its spec or
   * timing, or resumed it.
   */
  runAs: string | null;
  /** What the runs launch with. */
  runAsCredential: ScheduleRunAsCredential;
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
  /**
   * Monthly spend cap for this environment in USD, set by a workspace owner or admin in the
   * dashboard. `null`: no cap. At 100%, launches fail with a 402 `BUDGET_REACHED`, running
   * instances stop and inference calls with this environment's API keys are refused until
   * the month ends or the budget is raised. The API cannot set or change it.
   */
  monthlyBudgetUsd?: number | null;
  /** Spend in this environment for the current UTC month, GPU instances plus inference, in USD. */
  monthToDateUsd?: number;
  /** USD left before the monthly budget is reached. `null` when there is no budget. */
  budgetRemainingUsd?: number | null;
  [key: string]: unknown;
}

export interface EnvironmentCreateParams {
  name: string;
}

export interface EnvironmentUpdateParams {
  name?: string;
  isDefault?: boolean;
}

// ─── Secrets ────────────────────────────────────────────────────────────────

/**
 * A secret set in the environment: an environment variable every instance and job launched
 * there gets. The API returns names only; values are set in the dashboard and never shown.
 * A value given for one launch (`envVars` on an instance, `env` on a scheduled job) wins over a secret
 * of the same name.
 */
export interface Secret {
  /** The variable's name, e.g. `HF_TOKEN`. */
  key: string;
  /** A sensitive secret's value is hidden in the dashboard too, for everyone. */
  sensitive: boolean;
  /** When the value or its settings last changed (ISO 8601). */
  updatedAt: string;
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
