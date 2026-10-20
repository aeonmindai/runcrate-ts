interface RuncrateConfig {
    apiKey?: string;
    baseUrl?: string;
    inferenceUrl?: string;
    timeout?: number;
    maxRetries?: number;
    customHeaders?: Record<string, string>;
    /** Optional environment name. If not set, the workspace's default environment is used. */
    environment?: string;
}
interface ListMeta {
    cursor?: string | null;
    hasMore?: boolean | null;
    total?: number | null;
}
interface Instance {
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
interface InstanceCreateParams {
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
interface InstanceStatus {
    id: string;
    status: string;
    ip?: string | null;
    [key: string]: unknown;
}
interface InstanceType {
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
interface InstanceListParams {
    search?: string;
}
interface InstanceTypeListParams {
    gpuType?: string;
    region?: string;
    gpuCount?: number;
}
/** What a schedule launches. */
type ScheduleKind = "instance" | "job";
/**
 * Recurring schedules only: `"skip"` (default) skips a run while the previous run is still live,
 * `"allow"` launches anyway.
 */
type ScheduleOverlap = "skip" | "allow";
/** How the most recent run went. `null` until the schedule first runs. */
type ScheduleRunStatus = "launched" | "failed" | "skipped_budget" | "skipped_overlap" | "no_access";
/** A job to run: the same fields as creating a job. */
interface ScheduleJobSpec {
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
interface ScheduleInstanceSpec {
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
    envVars?: Array<{
        key: string;
        value: string;
    }>;
    startupCommands?: string[];
    launchScript?: string;
    launchScriptBase64?: string;
    cpuCores?: number;
    memory?: number;
    storage?: number;
    idleShutdownMinutes?: number;
}
/** What to launch, discriminated on `kind`. */
type ScheduleSpec = {
    kind: "instance";
    spec: ScheduleInstanceSpec;
} | {
    kind: "job";
    spec: ScheduleJobSpec;
};
/** A job spec as returned: env values are never returned, only their names in `envKeys`. */
type ScheduledJobSpec = Omit<ScheduleJobSpec, "env"> & {
    envKeys?: string[];
    [key: string]: unknown;
};
/** An instance spec as returned: env values are never returned, only their names in `envKeys`. */
type ScheduledInstanceSpec = Omit<ScheduleInstanceSpec, "envVars"> & {
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
type Schedule = (ScheduleBase & {
    kind: "instance";
    spec: ScheduledInstanceSpec;
}) | (ScheduleBase & {
    kind: "job";
    spec: ScheduledJobSpec;
});
/**
 * When a schedule runs: exactly one of `runAt` (once, at least a minute ahead and at most 365 days)
 * or `cron` (recurring, occurrences at least 15 minutes apart).
 */
type ScheduleTiming = {
    runAt: string | Date;
    cron?: never;
} | {
    cron: string;
    runAt?: never;
};
type CreateScheduleParams = ScheduleSpec & ScheduleTiming & {
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
type UpdateScheduleParams = ({
    runAt?: never;
    cron?: never;
} | {
    runAt: string | Date;
    cron?: never;
} | {
    cron: string;
    runAt?: never;
}) & {
    /** `false` pauses, `true` resumes. */
    enabled?: boolean;
    timezone?: string;
    overlap?: ScheduleOverlap;
    name?: string;
    spec?: ScheduleInstanceSpec | ScheduleJobSpec;
};
interface ScheduleDeleteResult {
    id: string;
    deleted: true;
}
/** The job a run started. */
interface ScheduledJob {
    id: string;
    name: string;
    status: string;
    [key: string]: unknown;
}
/** What `runNow` started: `instance` for an instance schedule, `job` for a job schedule. */
interface RunNowResult {
    schedule: Schedule;
    instance?: Instance;
    job?: ScheduledJob;
}
interface Environment {
    id: string;
    name: string;
    isDefault?: boolean | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    [key: string]: unknown;
}
interface EnvironmentCreateParams {
    name: string;
}
interface EnvironmentUpdateParams {
    name?: string;
    isDefault?: boolean;
}
interface SSHKey {
    id: string;
    name: string;
    fingerprint?: string | null;
    type?: string | null;
    createdAt?: string | null;
    lastUsed?: string | null;
    projectId?: string | null;
    [key: string]: unknown;
}
interface SSHKeyCreateParams {
    name: string;
    publicKey: string;
    type?: string;
}
interface StorageVolume {
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
interface StorageListParams {
    search?: string;
}
interface StorageCreateParams {
    name: string;
    sizeGb: number;
    region: string;
}
interface StorageDeleteResult {
    message: string;
    refundAmount?: number;
    [key: string]: unknown;
}
interface StorageRegion {
    id: string;
    name: string;
    provider: string;
    [key: string]: unknown;
}
interface Balance {
    creditsBalance: number;
    activeUsageCost: number;
    [key: string]: unknown;
}
interface Transaction {
    id: string;
    projectId?: string | null;
    type?: string | null;
    amount?: number | null;
    description?: string | null;
    createdAt?: string | null;
    [key: string]: unknown;
}
interface TransactionListParams {
    limit?: number;
    offset?: number;
    type?: string;
}
interface UsageSummary {
    totalRequests?: number | null;
    totalPromptTokens?: number | null;
    totalCompletionTokens?: number | null;
    totalTokens?: number | null;
    totalCost?: number | null;
    [key: string]: unknown;
}
interface UsageParams {
    from?: string;
    to?: string;
}
interface Template {
    id: string;
    name: string;
    description?: string | null;
    category?: string | null;
    createdAt?: string | null;
    [key: string]: unknown;
}
interface TemplateListParams {
    page?: number;
    pageSize?: number;
    search?: string;
    category?: string;
    sortBy?: string;
    sortDir?: string;
}
interface ChatMessage {
    role: string;
    content: string | unknown[];
    name?: string;
}
interface ChatCompletionParams {
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
interface ChatChoice {
    index: number;
    message: ChatMessage;
    finishReason?: string | null;
    [key: string]: unknown;
}
interface ChatUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    [key: string]: unknown;
}
interface ChatCompletion {
    id: string;
    object: string;
    created?: number | null;
    model: string;
    choices: ChatChoice[];
    usage?: ChatUsage | null;
    [key: string]: unknown;
}
interface ImageGenerationParams {
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
interface ImageData {
    url?: string | null;
    b64Json?: string | null;
    revisedPrompt?: string | null;
    [key: string]: unknown;
}
interface ImageGeneration {
    created?: number | null;
    data: ImageData[];
    [key: string]: unknown;
}
interface VideoGenerationParams {
    model: string;
    prompt: string;
    duration?: number;
    aspectRatio?: string;
    width?: number;
    height?: number;
    [key: string]: unknown;
}
interface VideoJob {
    id: string;
    status: string;
    [key: string]: unknown;
}
interface VideoSaveParams extends VideoGenerationParams {
    pollInterval?: number;
    onStatus?: (job: VideoJob) => void;
}
interface TTSParams {
    model: string;
    input: string;
    voice?: string;
    responseFormat?: string;
    [key: string]: unknown;
}
interface TranscribeParams {
    model: string;
    file: Blob | Buffer | ArrayBuffer;
    filename?: string;
    language?: string;
    responseFormat?: string;
    [key: string]: unknown;
}
interface Transcription {
    text: string;
    duration?: number | null;
    language?: string | null;
    segments?: unknown[] | null;
    [key: string]: unknown;
}

interface TransportConfig {
    baseUrl: string;
    apiKey: string;
    timeout: number;
    maxRetries: number;
    customHeaders: Record<string, string>;
    /** Optional environment name. Appended as ?environment=<name> to every request. */
    environment?: string;
}
interface RequestOptions {
    method: string;
    path: string;
    params?: Record<string, unknown>;
    body?: unknown;
    timeout?: number;
    raw?: boolean;
    noUnwrap?: boolean;
}
interface ApiResponse<T> {
    data: T;
    meta?: ListMeta;
}
declare class Transport {
    private readonly config;
    private readonly headers;
    constructor(config: TransportConfig);
    request<T>(options: RequestOptions): Promise<ApiResponse<T>>;
    streamRequest(options: Omit<RequestOptions, "raw">): Promise<Response>;
}

declare class Instances {
    private readonly transport;
    constructor(transport: Transport);
    list(params?: InstanceListParams): Promise<Instance[]>;
    create(params: InstanceCreateParams): Promise<Instance>;
    get(id: string): Promise<Instance>;
    terminate(id: string): Promise<void>;
    getStatus(id: string): Promise<InstanceStatus>;
    listTypes(params?: InstanceTypeListParams): Promise<InstanceType[]>;
}

declare class Environments {
    private readonly transport;
    constructor(transport: Transport);
    list(): Promise<Environment[]>;
    create(params: EnvironmentCreateParams): Promise<Environment>;
    get(id: string): Promise<Environment>;
    update(id: string, params: EnvironmentUpdateParams): Promise<Environment>;
    delete(id: string): Promise<void>;
}

declare class SSHKeys {
    private readonly transport;
    constructor(transport: Transport);
    list(): Promise<SSHKey[]>;
    create(params: SSHKeyCreateParams): Promise<SSHKey>;
    delete(id: string): Promise<void>;
}

declare class Storage {
    private readonly transport;
    constructor(transport: Transport);
    list(params?: StorageListParams): Promise<StorageVolume[]>;
    get(id: string): Promise<StorageVolume>;
    listRegions(): Promise<StorageRegion[]>;
    create(params: StorageCreateParams): Promise<StorageVolume>;
    resize(id: string, sizeGb: number): Promise<StorageVolume>;
    delete(id: string): Promise<StorageDeleteResult>;
}

declare class PaginatedResponse<T> {
    readonly data: T[];
    readonly meta: ListMeta;
    constructor(data: T[], meta?: ListMeta);
    get hasMore(): boolean;
    get cursor(): string | null | undefined;
    get total(): number | null | undefined;
    [Symbol.iterator](): Iterator<T>;
    get length(): number;
}

declare class Billing {
    private readonly transport;
    constructor(transport: Transport);
    getBalance(): Promise<Balance>;
    listTransactions(params?: TransactionListParams): Promise<PaginatedResponse<Transaction>>;
    usage(params?: UsageParams): Promise<UsageSummary>;
}

declare class Templates {
    private readonly transport;
    constructor(transport: Transport);
    list(params?: TemplateListParams): Promise<PaginatedResponse<Template>>;
}

declare class Schedules {
    private readonly transport;
    constructor(transport: Transport);
    /**
     * Schedule an instance launch or a job, once (`runAt`) or on a recurring `cron` in `timezone`.
     * It starts within about 2 minutes of its time, as you, in this environment. Always set
     * `spec.maxRuntimeMinutes`. A bad spec, cron or time throws an `UnprocessableEntityError`
     * (422); more than 50 schedules in the workspace throws a `ConflictError` (409).
     */
    create(params: CreateScheduleParams): Promise<Schedule>;
    /** This environment's schedules, newest first. */
    list(): Promise<Schedule[]>;
    get(id: string): Promise<Schedule>;
    /**
     * Pause (`{ enabled: false }`), resume (`{ enabled: true }`), retime, rename or change a
     * schedule. Resuming a one-off whose time has passed, without a new `runAt`, throws a
     * `ConflictError` (409).
     */
    update(id: string, params: UpdateScheduleParams): Promise<Schedule>;
    delete(id: string): Promise<ScheduleDeleteResult>;
    /**
     * Launch a schedule's instance or job now, enabled or not. Does not move `nextRunAt`.
     * A reached environment budget throws an `InsufficientCreditsError` with `code`
     * `"BUDGET_REACHED"`; a low balance, the same error with `code` `"insufficient_credits"`.
     */
    runNow(id: string): Promise<RunNowResult>;
}

declare class Models {
    private readonly transport;
    private readonly inferenceUrl;
    private readonly apiKey;
    constructor(transport: Transport, inferenceUrl: string, apiKey: string);
    chatCompletion(params: ChatCompletionParams & {
        stream: true;
    }): Promise<AsyncGenerator<Record<string, unknown>>>;
    chatCompletion(params: ChatCompletionParams & {
        stream?: false;
    }): Promise<ChatCompletion>;
    chatCompletion(params: ChatCompletionParams): Promise<ChatCompletion | AsyncGenerator<Record<string, unknown>>>;
    generateImage(params: ImageGenerationParams): Promise<ImageGeneration & {
        save(path: string): Promise<void>;
    }>;
    generateVideo(params: VideoGenerationParams): Promise<VideoJob>;
    getVideoStatus(id: string): Promise<VideoJob>;
    downloadVideo(id: string): Promise<Buffer>;
    generateVideoAndSave(path: string, params: VideoSaveParams): Promise<VideoJob>;
    textToSpeech(params: TTSParams): Promise<Buffer>;
    textToSpeechAndSave(path: string, params: TTSParams): Promise<void>;
    transcribe(params: TranscribeParams): Promise<Transcription>;
}

interface ChatCompletionsNamespace {
    create(params: ChatCompletionParams): Promise<ChatCompletion | AsyncGenerator<Record<string, unknown>>>;
}
interface ChatNamespace {
    completions: ChatCompletionsNamespace;
}
interface ImagesNamespace {
    generate(params: ImageGenerationParams): Promise<ImageGeneration & {
        save(path: string): Promise<void>;
    }>;
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
declare class Runcrate {
    readonly instances: Instances;
    readonly environments: Environments;
    readonly sshKeys: SSHKeys;
    readonly storage: Storage;
    readonly billing: Billing;
    readonly templates: Templates;
    readonly schedules: Schedules;
    readonly models: Models;
    /** OpenAI-compatible chat namespace: `rc.chat.completions.create(...)` */
    readonly chat: ChatNamespace;
    /** OpenAI-compatible images namespace: `rc.images.generate(...)` */
    readonly images: ImagesNamespace;
    /** OpenAI-compatible audio namespace: `rc.audio.speech.create(...)`, `rc.audio.transcriptions.create(...)` */
    readonly audio: AudioNamespace;
    /** Video namespace: `rc.videos.generate(...)` */
    readonly videos: VideosNamespace;
    constructor(config?: RuncrateConfig);
}

declare class RuncrateError extends Error {
    constructor(message: string);
}
declare class ApiError extends RuncrateError {
    readonly statusCode: number;
    readonly code: string;
    readonly details?: Record<string, unknown>;
    constructor(message: string, statusCode: number, code: string, details?: Record<string, unknown>);
}
declare class BadRequestError extends ApiError {
    constructor(message: string, code: string, details?: Record<string, unknown>);
}
declare class AuthenticationError extends ApiError {
    constructor(message: string, code: string, details?: Record<string, unknown>);
}
declare class InsufficientCreditsError extends ApiError {
    constructor(message: string, code: string, details?: Record<string, unknown>);
}
declare class PermissionDeniedError extends ApiError {
    constructor(message: string, code: string, details?: Record<string, unknown>);
}
declare class NotFoundError extends ApiError {
    constructor(message: string, code: string, details?: Record<string, unknown>);
}
declare class ConflictError extends ApiError {
    constructor(message: string, code: string, details?: Record<string, unknown>);
}
declare class UnprocessableEntityError extends ApiError {
    constructor(message: string, code: string, details?: Record<string, unknown>);
}
declare class RateLimitError extends ApiError {
    constructor(message: string, code: string, details?: Record<string, unknown>);
}
declare class InternalServerError extends ApiError {
    constructor(message: string, code: string, details?: Record<string, unknown>);
}
declare class ConnectionError extends RuncrateError {
    constructor(message: string);
}
declare class TimeoutError extends RuncrateError {
    constructor(message: string);
}

export { ApiError, AuthenticationError, BadRequestError, type Balance, type ChatChoice, type ChatCompletion, type ChatCompletionParams, type ChatMessage, type ChatUsage, ConflictError, ConnectionError, type CreateScheduleParams, type Environment, type EnvironmentCreateParams, type EnvironmentUpdateParams, type ImageData, type ImageGeneration, type ImageGenerationParams, type Instance, type InstanceCreateParams, type InstanceListParams, type InstanceStatus, type InstanceType, type InstanceTypeListParams, InsufficientCreditsError, InternalServerError, type ListMeta, NotFoundError, PaginatedResponse, PermissionDeniedError, RateLimitError, type RunNowResult, Runcrate, type RuncrateConfig, RuncrateError, type SSHKey, type SSHKeyCreateParams, type Schedule, type ScheduleDeleteResult, type ScheduleInstanceSpec, type ScheduleJobSpec, type ScheduleKind, type ScheduleOverlap, type ScheduleRunStatus, type ScheduleSpec, type ScheduleTiming, type ScheduledInstanceSpec, type ScheduledJob, type ScheduledJobSpec, type StorageListParams, type StorageVolume, type TTSParams, type Template, type TemplateListParams, TimeoutError, type Transaction, type TransactionListParams, type TranscribeParams, type Transcription, UnprocessableEntityError, type UpdateScheduleParams, type UsageParams, type UsageSummary, type VideoGenerationParams, type VideoJob, type VideoSaveParams, Runcrate as default };
