import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { ApiError, ConnectionError, JobWaitTimeoutError } from "../errors.js";
import { PaginatedResponse } from "../pagination.js";
import { newIdempotencyKey, type Transport } from "../transport.js";
import type {
  Job,
  JobArtifact,
  JobEvent,
  JobGroup,
  JobGroupRunParams,
  JobListParams,
  JobLogChunk,
  JobLogs,
  JobLogsParams,
  JobMetricPoint,
  JobRerunParams,
  JobRunParams,
  JobStatus,
  JobSubmitOptions,
  JobUpload,
  JobWaitOptions,
  SubmittedJob,
  SubmittedJobGroup,
} from "../types.js";
import { removeUndefined, toSnakeCase } from "../util.js";

const PATH = "/api/v1/jobs";
/** Response keys holding user data (tag names) or API words (statuses), kept as sent. */
const RAW_KEYS = ["tags", "status_counts"] as const;
/**
 * A submit or rerun may take up to the route's 120 s while it launches: the client waits for the
 * answer rather than giving up first (a retry would then only replay the same key).
 */
const SUBMIT_TIMEOUT = 135;
/** The server holds a `follow` logs read for up to 25 s. */
const FOLLOW_TIMEOUT = 40;
/** A group cancel stops every machine, each with a final volume copy-up (300 s route). */
const GROUP_CANCEL_TIMEOUT = 315;
const LIVE: Record<string, true> = { queued: true, starting: true, running: true };

/** Whether a job status is final (`succeeded`, `failed`, `cancelled` or `timed_out`). */
export function isJobFinished(status: JobStatus): boolean {
  return !LIVE[status];
}

const jobPath = (id: string, suffix = "") => `${PATH}/${encodeURIComponent(id)}${suffix}`;

/** A submit body: env, tags and params are user data, so their keys go out exactly as given. */
function submitBody(params: Partial<JobGroupRunParams>): Record<string, unknown> {
  const { env, tags, params: groupParams, ...rest } = params;
  const body = toSnakeCase(rest);
  if (env !== undefined) body.env = env;
  if (tags !== undefined) body.tags = tags;
  if (groupParams !== undefined) body.params = groupParams;
  return body;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(done, ms);
    signal?.addEventListener("abort", done, { once: true });
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    }
  });
}

/** Downloads a signed URL; the API key is never sent to it. */
async function fetchSigned(url: string): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new ConnectionError(`Connection failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!response.ok || !response.body) {
    throw new ApiError(`Downloading the file failed (HTTP ${response.status})`, response.status, "download_failed");
  }
  return response;
}

/** A job's outputs: the files its command wrote to `$RUNCRATE_OUTPUT_DIR`. */
export class JobArtifacts {
  constructor(private readonly transport: Transport) {}

  /** The job's outputs by path, kept 30 days after it ended. */
  async list(jobId: string): Promise<JobArtifact[]> {
    const { data } = await this.transport.request<JobArtifact[]>({ method: "GET", path: jobPath(jobId, "/artifacts") });
    return data;
  }

  /** A signed URL that downloads one output, valid for an hour. Needs no API key. */
  async url(jobId: string, path: string): Promise<string> {
    const encoded = path.split("/").map(encodeURIComponent).join("/");
    return this.transport.redirectLocation({ path: jobPath(jobId, `/artifacts/${encoded}`) });
  }

  /** One output's bytes, in memory. Use `downloadTo` for large files. */
  async download(jobId: string, path: string): Promise<Buffer> {
    const response = await fetchSigned(await this.url(jobId, path));
    return Buffer.from(await response.arrayBuffer());
  }

  /** Streams one output to `destination` on disk (the file is replaced). */
  async downloadTo(jobId: string, path: string, destination: string): Promise<void> {
    const response = await fetchSigned(await this.url(jobId, path));
    await pipeline(Readable.fromWeb(response.body as unknown as NodeReadableStream), createWriteStream(destination));
  }
}

/** Code uploads: a tar.gz a job unpacks into `/workspace/code`, where its command runs. */
export class JobUploads {
  constructor(private readonly transport: Transport) {}

  /**
   * Somewhere to PUT a tar.gz of `bytes` (at most 1 GB). With `sha256`, the same archive again
   * answers the same upload. Use `upload()` to do both steps.
   */
  async create(params: { bytes: number; sha256?: string }): Promise<JobUpload> {
    const { data } = await this.transport.request<JobUpload>({
      method: "POST",
      path: `${PATH}/uploads`,
      body: removeUndefined(params),
      // The same hash answers the same upload, so a repeat makes no second one.
      idempotent: params.sha256 !== undefined,
    });
    return data;
  }

  /**
   * Uploads a tar.gz (its bytes, or a path to one) and answers the upload: run a job with
   * `code: { uploadId: upload.uploadId }` within 24 hours. The same archive again is not sent twice.
   */
  async upload(archive: Uint8Array | string): Promise<JobUpload> {
    const bytes = typeof archive === "string" ? await readFile(archive) : archive;
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const upload = await this.create({ bytes: bytes.byteLength, sha256 });
    if (upload.url) {
      let response: Response;
      try {
        response = await fetch(upload.url, { method: "PUT", body: bytes as Uint8Array<ArrayBuffer> });
      } catch (err) {
        throw new ConnectionError(`Connection failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      if (!response.ok) {
        throw new ApiError(`Uploading the code failed (HTTP ${response.status})`, response.status, "upload_failed");
      }
    }
    return upload;
  }
}

/**
 * Jobs: a command run on its own fresh GPU machine, which stops (and stops billing) when the
 * command ends. Every submit carries an Idempotency-Key, so its retries never start a second job.
 */
export class Jobs {
  readonly artifacts: JobArtifacts;
  readonly uploads: JobUploads;

  constructor(private readonly transport: Transport) {
    this.artifacts = new JobArtifacts(transport);
    this.uploads = new JobUploads(transport);
  }

  /**
   * Run one job. Answers it queued or starting; `wait()` for the end. A low balance throws an
   * `InsufficientCreditsError`, a reached environment budget the same with `code`
   * `"BUDGET_REACHED"`, a bad field an `UnprocessableEntityError`. For several jobs at once use
   * `runGroup()`.
   */
  async run(params: JobRunParams, options?: JobSubmitOptions): Promise<SubmittedJob> {
    if ("count" in params || "params" in params) {
      throw new TypeError("jobs.run() runs one job: use jobs.runGroup() for count or params");
    }
    return this.submit<SubmittedJob>(PATH, submitBody(params), options);
  }

  /**
   * Run a group of jobs: `count` copies of one, or one per `params` entry (each merged over
   * `env`), at most `maxParallel` at once. Answers the group with its jobs.
   */
  async runGroup(params: JobGroupRunParams, options?: JobSubmitOptions): Promise<SubmittedJobGroup> {
    return this.submit<SubmittedJobGroup>(PATH, submitBody(params), options);
  }

  /**
   * Run a job's spec again as a new job (its `rerunOf` set), with its env values. `overrides`
   * changes fields; its `env` is merged over the job's. Only whoever submitted the job can reuse
   * its env values; anyone else must send them.
   */
  async rerun(id: string, overrides?: JobRerunParams, options?: JobSubmitOptions): Promise<SubmittedJob> {
    return this.submit<SubmittedJob>(jobPath(id, "/rerun"), submitBody(overrides ?? {}), options);
  }

  private async submit<T>(path: string, body: Record<string, unknown>, options?: JobSubmitOptions): Promise<T> {
    const { data } = await this.transport.request<T>({
      method: "POST",
      path,
      body,
      idempotencyKey: options?.idempotencyKey ?? newIdempotencyKey(),
      idempotent: true,
      minTimeout: SUBMIT_TIMEOUT,
      rawKeys: RAW_KEYS,
    });
    return data;
  }

  async get(id: string): Promise<Job> {
    const { data } = await this.transport.request<Job>({ method: "GET", path: jobPath(id), rawKeys: RAW_KEYS });
    return data;
  }

  /** One page of jobs, newest first. Pass `cursor` for the next page, or use `listAll()`. */
  async list(params: JobListParams = {}): Promise<PaginatedResponse<Job>> {
    const { status, tags, groupId, q, gpuType, createdAfter, limit, cursor } = params;
    const { data, meta } = await this.transport.request<Job[]>({
      method: "GET",
      path: PATH,
      params: {
        status: Array.isArray(status) ? status.join(",") : status,
        tag: tags ? Object.entries(tags).map(([key, value]) => `${key}:${value}`) : undefined,
        group_id: groupId,
        q,
        gpu_type: gpuType,
        created_after: createdAfter instanceof Date ? createdAfter.toISOString() : createdAfter,
        limit,
        cursor,
      },
      rawKeys: RAW_KEYS,
    });
    return new PaginatedResponse(data, meta);
  }

  /** Every job matching `params`, newest first, page by page. */
  async *listAll(params: Omit<JobListParams, "cursor"> = {}): AsyncGenerator<Job> {
    let cursor: string | undefined;
    do {
      const page = await this.list({ ...params, cursor });
      yield* page.data;
      cursor = page.hasMore && page.cursor ? page.cursor : undefined;
    } while (cursor);
  }

  /** Stops the job's machine; the job becomes `cancelled`. A job that ended otherwise throws a `ConflictError`. */
  async cancel(id: string): Promise<Job> {
    const { data } = await this.transport.request<Job>({
      method: "POST",
      path: jobPath(id, "/cancel"),
      // Cancelling a cancelled job answers it unchanged.
      idempotent: true,
      minTimeout: SUBMIT_TIMEOUT,
      rawKeys: RAW_KEYS,
    });
    return data;
  }

  /** Deletes a job that ended, with its logs and outputs. A live job throws a `ConflictError`: cancel it first. */
  async delete(id: string): Promise<void> {
    await this.transport.request<void>({ method: "DELETE", path: jobPath(id) });
  }

  /** One page of the job's output after `after`. */
  async logs(id: string, params: JobLogsParams = {}): Promise<JobLogs> {
    const { data } = await this.transport.request<JobLogs>({
      method: "GET",
      path: jobPath(id, "/logs"),
      params: { after: params.after, limit: params.limit, follow: params.follow ? "true" : undefined },
      minTimeout: params.follow ? FOLLOW_TIMEOUT : undefined,
    });
    return data;
  }

  /**
   * The job's output as it is written, chunk by chunk, until the job ends and every chunk was
   * read. Starts at `after` (default 0, the start). Stop early with `signal` or by breaking out.
   */
  async *followLogs(id: string, options: { after?: number; signal?: AbortSignal } = {}): AsyncGenerator<JobLogChunk> {
    let after = options.after ?? 0;
    while (!options.signal?.aborted) {
      const page = await this.logs(id, { after, follow: true });
      yield* page.chunks;
      after = Math.max(after, page.cursor);
      if (page.done) return;
      // The server holds an empty read open; one answered at once is spaced out.
      if (page.chunks.length === 0) await sleep(1_000, options.signal);
    }
  }

  /** The job's timeline, oldest first. */
  async events(id: string): Promise<JobEvent[]> {
    const { data } = await this.transport.request<JobEvent[]>({ method: "GET", path: jobPath(id, "/events") });
    return data;
  }

  /** GPU use while the command ran, oldest first, one point per `step` seconds (60 to 86400). */
  async metrics(id: string, params: { step?: number } = {}): Promise<JobMetricPoint[]> {
    const { data } = await this.transport.request<JobMetricPoint[]>({
      method: "GET",
      path: jobPath(id, "/metrics"),
      params: { step: params.step },
    });
    return data;
  }

  /**
   * Polls the job until it ends (succeeded, failed, cancelled or timed out) and answers it. The
   * gap between polls starts at `pollInterval` and doubles up to `maxPollInterval`. Past
   * `timeout` seconds it throws a `JobWaitTimeoutError` holding the job as last seen; the job
   * keeps running.
   */
  async wait(id: string, options: JobWaitOptions = {}): Promise<Job> {
    const { timeout, pollInterval = 2, maxPollInterval = 30 } = options;
    const deadline = timeout === undefined ? Infinity : Date.now() + timeout * 1000;
    let gap = pollInterval * 1000;
    for (;;) {
      const job = await this.get(id);
      if (isJobFinished(job.status)) return job;
      const left = deadline - Date.now();
      if (left <= 0) {
        throw new JobWaitTimeoutError(`Job ${job.id} is still ${job.status} after ${timeout} s`, job);
      }
      await sleep(Math.min(gap, left));
      gap = Math.min(gap * 2, maxPollInterval * 1000);
    }
  }
}

/** Groups of jobs, made by `jobs.runGroup()`. */
export class JobGroups {
  constructor(private readonly transport: Transport) {}

  async get(id: string): Promise<JobGroup> {
    const { data } = await this.transport.request<JobGroup>({
      method: "GET",
      path: `/api/v1/job-groups/${encodeURIComponent(id)}`,
      rawKeys: RAW_KEYS,
    });
    return data;
  }

  /** Cancels every job of the group that has not ended. */
  async cancel(id: string): Promise<JobGroup> {
    const { data } = await this.transport.request<JobGroup>({
      method: "POST",
      path: `/api/v1/job-groups/${encodeURIComponent(id)}/cancel`,
      idempotent: true,
      minTimeout: GROUP_CANCEL_TIMEOUT,
      rawKeys: RAW_KEYS,
    });
    return data;
  }
}
