interface RuncrateConfig {
    apiKey?: string;
    baseUrl?: string;
    inferenceUrl?: string;
    timeout?: number;
    maxRetries?: number;
    customHeaders?: Record<string, string>;
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
interface Crate {
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
interface CrateCreateParams {
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
interface CrateListParams {
    search?: string;
}
/** @deprecated Use `Workspace` instead. */
interface Project {
    id: string;
    name: string;
    description?: string | null;
    isDefault?: boolean | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    userId?: string | null;
    resourceCount?: number | null;
    [key: string]: unknown;
}
/** @deprecated Use `WorkspaceCreateParams` instead. */
interface ProjectCreateParams {
    name: string;
    description?: string;
    isDefault?: boolean;
}
/** @deprecated Use `WorkspaceUpdateParams` instead. */
interface ProjectUpdateParams {
    name?: string;
    description?: string;
    isDefault?: boolean;
}
interface Workspace {
    id: string;
    name: string;
    description?: string | null;
    isDefault?: boolean | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    userId?: string | null;
    resourceCount?: number | null;
    [key: string]: unknown;
}
interface WorkspaceCreateParams {
    name: string;
    description?: string;
    isDefault?: boolean;
}
interface WorkspaceUpdateParams {
    name?: string;
    description?: string;
    isDefault?: boolean;
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

declare class Crates {
    private readonly transport;
    constructor(transport: Transport);
    list(params?: CrateListParams): Promise<Crate[]>;
    create(params: CrateCreateParams): Promise<Crate>;
    get(id: string): Promise<Crate>;
    terminate(id: string): Promise<void>;
}

declare class Projects {
    private readonly transport;
    constructor(transport: Transport);
    list(): Promise<Project[]>;
    create(params: ProjectCreateParams): Promise<Project>;
    get(id: string): Promise<Project>;
    update(id: string, params: ProjectUpdateParams): Promise<Project>;
    delete(id: string): Promise<void>;
}

declare class Workspaces {
    private readonly transport;
    constructor(transport: Transport);
    list(): Promise<Workspace[]>;
    create(params: WorkspaceCreateParams): Promise<Workspace>;
    get(id: string): Promise<Workspace>;
    update(id: string, params: WorkspaceUpdateParams): Promise<Workspace>;
    delete(id: string): Promise<void>;
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

declare class Runcrate {
    readonly instances: Instances;
    readonly crates: Crates;
    readonly workspaces: Workspaces;
    readonly environments: Environments;
    /** @deprecated Use `workspaces` instead. */
    readonly projects: Projects;
    readonly sshKeys: SSHKeys;
    readonly storage: Storage;
    readonly billing: Billing;
    readonly templates: Templates;
    readonly models: Models;
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

export { ApiError, AuthenticationError, BadRequestError, type Balance, type ChatChoice, type ChatCompletion, type ChatCompletionParams, type ChatMessage, type ChatUsage, ConflictError, ConnectionError, type Crate, type CrateCreateParams, type CrateListParams, type ImageData, type ImageGeneration, type ImageGenerationParams, type Instance, type InstanceCreateParams, type InstanceListParams, type InstanceStatus, type InstanceType, type InstanceTypeListParams, InsufficientCreditsError, InternalServerError, type ListMeta, NotFoundError, PaginatedResponse, PermissionDeniedError, type Project, type ProjectCreateParams, type ProjectUpdateParams, RateLimitError, Runcrate, type RuncrateConfig, RuncrateError, type SSHKey, type SSHKeyCreateParams, type StorageListParams, type StorageVolume, type TTSParams, type Template, type TemplateListParams, TimeoutError, type Transaction, type TransactionListParams, type TranscribeParams, type Transcription, UnprocessableEntityError, type UsageParams, type UsageSummary, type VideoGenerationParams, type VideoJob, type VideoSaveParams, Runcrate as default };
