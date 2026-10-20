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
/** Why an instance stopped. `null` while it is still running or was never stopped. */
type InstanceStopReason = "user" | "max_runtime" | "idle" | "budget" | "low_balance" | "failed" | "system";
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
interface InstanceUpdateParams {
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
interface Environment {
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
    /**
     * Launch an instance. For unattended agent work, set `maxRuntimeMinutes` (5 to 10080) and
     * `idleShutdownMinutes` (5 to 1440) so the instance stops on its own. Values outside those
     * ranges are rejected with an `UnprocessableEntityError` (422). If the environment's monthly budget is
     * reached, this throws an `InsufficientCreditsError` with `code` `"BUDGET_REACHED"`.
     */
    create(params: InstanceCreateParams): Promise<Instance>;
    get(id: string): Promise<Instance>;
    /**
     * Change a starting or running instance's auto stop, by id or unique name. Returns the instance
     * with its new `autoStopAt`. An out-of-range value throws an `UnprocessableEntityError` (422);
     * a `ConflictError` (409) means the instance is not live, has
     * no GPU for idle stop, or was launched before idle stop existed.
     */
    update(id: string, params: InstanceUpdateParams): Promise<Instance>;
    terminate(id: string): Promise<void>;
    getStatus(id: string): Promise<InstanceStatus>;
    listTypes(params?: InstanceTypeListParams): Promise<InstanceType[]>;
}

declare class Environments {
    private readonly transport;
    constructor(transport: Transport);
    list(): Promise<Environment[]>;
    create(params: EnvironmentCreateParams): Promise<Environment>;
    /**
     * Get an environment, including its monthly budget (`monthlyBudgetUsd`), spend so far this
     * UTC month (`monthToDateUsd`) and what is left (`budgetRemainingUsd`). Budgets are read-only
     * here: a workspace owner or admin sets them in the dashboard.
     */
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
/**
 * HTTP 402. `code` tells the cases apart: `"insufficient_credits"` when the workspace balance is
 * too low, `"BUDGET_REACHED"` when a launch hits an environment's monthly budget, and
 * `"budget_exceeded"` when an inference call hits it.
 */
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

export { ApiError, AuthenticationError, BadRequestError, type Balance, type ChatChoice, type ChatCompletion, type ChatCompletionParams, type ChatMessage, type ChatUsage, ConflictError, ConnectionError, type Environment, type EnvironmentCreateParams, type EnvironmentUpdateParams, type ImageData, type ImageGeneration, type ImageGenerationParams, type Instance, type InstanceCreateParams, type InstanceListParams, type InstanceStatus, type InstanceStopReason, type InstanceType, type InstanceTypeListParams, type InstanceUpdateParams, InsufficientCreditsError, InternalServerError, type ListMeta, NotFoundError, PaginatedResponse, PermissionDeniedError, RateLimitError, Runcrate, type RuncrateConfig, RuncrateError, type SSHKey, type SSHKeyCreateParams, type StorageListParams, type StorageVolume, type TTSParams, type Template, type TemplateListParams, TimeoutError, type Transaction, type TransactionListParams, type TranscribeParams, type Transcription, UnprocessableEntityError, type UsageParams, type UsageSummary, type VideoGenerationParams, type VideoJob, type VideoSaveParams, Runcrate as default };
