import { createHash } from "node:crypto";
import { describe, it, expect, vi, afterEach } from "vitest";
import { Runcrate } from "../src/client.js";
import { ConflictError, ConnectionError, InternalServerError, JobWaitTimeoutError, TimeoutError } from "../src/errors.js";
import { mockFetch, TEST_API_KEY } from "./helpers.js";

const JOB_ID = "6f1c2d3e-4b5a-4c6d-8e7f-901234567890";

function apiJob(overrides: Record<string, unknown> = {}) {
  return {
    id: JOB_ID,
    name: "train",
    status: "queued",
    command: "python train.py",
    gpu_type: "A4000",
    gpu_count: 1,
    gpu_candidates: [{ gpu_type: "A4000", gpu_count: 1 }],
    env_keys: ["HF_TOKEN"],
    tags: { run_id: "r-1", "team.ml": "vision" },
    exit_code: null,
    created_at: "2026-10-21T10:00:00Z",
    ...overrides,
  };
}

function client(maxRetries = 2) {
  return new Runcrate({ apiKey: TEST_API_KEY, maxRetries });
}

function header(init: RequestInit, name: string): string | undefined {
  return (init.headers as Record<string, string> | undefined)?.[name];
}

/** A fetch that fails the first `failures` calls with `error`, then answers `body` with `status`. */
function failingFetch(failures: number, error: () => unknown, status = 201, body: unknown = { data: apiJob() }) {
  const calls: RequestInit[] = [];
  const fake = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    calls.push(init ?? {});
    if (calls.length <= failures) throw error();
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  });
  vi.stubGlobal("fetch", fake);
  return { calls, fake };
}

const connectionReset = () => Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET" } });
const connectionRefused = () => Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } });
const timedOut = () => new DOMException("The operation was aborted", "AbortError");

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("jobs.run", () => {
  it("sends user env, tag and params keys as given, and nested fields snake_cased", async () => {
    const { calls } = mockFetch([{ status: 201, body: { data: { id: "g1", jobs: [] } } }]);
    await client().jobs.runGroup({
      command: "python sweep.py",
      gpuType: ["H100", "A100-80GB:2"],
      maxRuntimeMinutes: 30,
      env: { hfToken: "x", HF_HOME: "/cache" },
      tags: { runId: "1" },
      params: [{ learningRate: "0.1" }],
      maxParallel: 2,
      code: { git: { url: "https://github.com/a/b", tokenEnv: "GIT_TOKEN" } },
      imageRegistryAuth: { usernameEnv: "REG_USER", passwordEnv: "REG_PASS" },
      retryOn: ["nonzero_exit"],
      maxRetries: 2,
    });
    const body = JSON.parse(calls[0]!.init.body as string);
    expect(body).toEqual({
      command: "python sweep.py",
      gpu_type: ["H100", "A100-80GB:2"],
      max_runtime_minutes: 30,
      env: { hfToken: "x", HF_HOME: "/cache" },
      tags: { runId: "1" },
      params: [{ learningRate: "0.1" }],
      max_parallel: 2,
      code: { git: { url: "https://github.com/a/b", token_env: "GIT_TOKEN" } },
      image_registry_auth: { username_env: "REG_USER", password_env: "REG_PASS" },
      retry_on: ["nonzero_exit"],
      max_retries: 2,
    });
  });

  it("returns tags as sent while camelCasing the job", async () => {
    mockFetch([{ status: 201, body: { data: apiJob() } }]);
    const job = await client().jobs.run({ command: "x", gpuType: "A4000", maxRuntimeMinutes: 5 });
    expect(job.tags).toEqual({ run_id: "r-1", "team.ml": "vision" });
    expect(job.envKeys).toEqual(["HF_TOKEN"]);
    expect(job.gpuCandidates).toEqual([{ gpuType: "A4000", gpuCount: 1 }]);
  });

  it("sends one Idempotency-Key per call and the same one on that call's retries", async () => {
    const { calls } = mockFetch([
      { status: 500, body: { error: { code: "internal_error", message: "oops" } } },
      { status: 201, body: { data: apiJob() } },
      { status: 201, body: { data: apiJob() } },
    ]);
    const rc = client(1);
    await rc.jobs.run({ command: "x", gpuType: "A4000", maxRuntimeMinutes: 5 });
    await rc.jobs.run({ command: "x", gpuType: "A4000", maxRuntimeMinutes: 5 });
    const keys = calls.map((c) => header(c.init, "Idempotency-Key"));
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  it("retries a submit after a lost connection with the same key, so the server answers the first job", async () => {
    const { calls } = failingFetch(1, connectionReset);
    const job = await client(1).jobs.run({ command: "x", gpuType: "A4000", maxRuntimeMinutes: 5 }, { idempotencyKey: "my-key-1" });
    expect(job.id).toBe(JOB_ID);
    expect(calls.map((c) => header(c, "Idempotency-Key"))).toEqual(["my-key-1", "my-key-1"]);
  });

  it("asks again while the first request with the key is still being handled", async () => {
    vi.useFakeTimers();
    const { calls } = mockFetch([
      { status: 409, body: { error: { code: "conflict", message: "still handled", details: { reason: "idempotency_in_progress" } } } },
      { status: 200, headers: { "idempotent-replayed": "true" }, body: { data: apiJob() } },
    ]);
    const pending = client(2).jobs.run({ command: "x", gpuType: "A4000", maxRuntimeMinutes: 5 });
    await vi.advanceTimersByTimeAsync(2_900);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(200);
    expect((await pending).id).toBe(JOB_ID);
    expect(header(calls[1]!.init, "Idempotency-Key")).toBe(header(calls[0]!.init, "Idempotency-Key"));
  });

  it("does not retry a key reused with a different request", async () => {
    const { calls } = mockFetch([
      { status: 409, body: { error: { code: "conflict", message: "different", details: { reason: "idempotency_conflict" } } } },
    ]);
    await expect(client(2).jobs.run({ command: "x", gpuType: "A4000", maxRuntimeMinutes: 5 })).rejects.toThrow(ConflictError);
    expect(calls).toHaveLength(1);
  });

  it("refuses count or params: those make a group", async () => {
    mockFetch([{ status: 201, body: { data: apiJob() } }]);
    await expect(
      client().jobs.run({ command: "x", gpuType: "A4000", maxRuntimeMinutes: 5, count: 3 } as never),
    ).rejects.toThrow(/runGroup/);
  });

  it("reruns with the overrides and its own key", async () => {
    const { calls } = mockFetch([{ status: 201, body: { data: apiJob({ rerun_of: JOB_ID }) } }]);
    const job = await client().jobs.rerun(JOB_ID, { gpuCount: 2, env: { EXTRA: "1" } });
    expect(job.rerunOf).toBe(JOB_ID);
    expect(calls[0]!.url).toBe(`https://www.runcrate.ai/api/v1/jobs/${JOB_ID}/rerun`);
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ gpu_count: 2, env: { EXTRA: "1" } });
    expect(header(calls[0]!.init, "Idempotency-Key")).toBeTruthy();
  });
});

describe("creates that the server does not deduplicate (RUN-548)", () => {
  const create = {
    instance: (rc: Runcrate) => rc.instances.create({ name: "box", gpuType: "A4000" } as never),
    schedule: (rc: Runcrate) => rc.schedules.create({ kind: "job", spec: { command: "x", gpuType: "A4000", maxRuntimeMinutes: 5 }, cron: "0 2 * * *" }),
    volume: (rc: Runcrate) => rc.storage.create({ name: "data", sizeGb: 10, region: "137" } as never),
  };

  for (const [what, call] of Object.entries(create)) {
    it(`a ${what} create carries an Idempotency-Key`, async () => {
      const { calls } = mockFetch([{ status: 201, body: { data: { id: "1" } } }]);
      await call(client());
      expect(header(calls[0]!.init, "Idempotency-Key")).toMatch(/^[0-9a-f-]{36}$/);
    });

    it(`a ${what} create is not sent again after a lost connection`, async () => {
      const { calls } = failingFetch(1, connectionReset, 201, { data: { id: "1" } });
      await expect(call(client(3))).rejects.toThrow(ConnectionError);
      expect(calls).toHaveLength(1);
    });
  }

  it("an instance create is not sent again after a timeout", async () => {
    const { calls } = failingFetch(1, timedOut, 201, { data: { id: "1" } });
    await expect(create.instance(client(3))).rejects.toThrow(TimeoutError);
    expect(calls).toHaveLength(1);
  });

  it("an instance create is not sent again after a 500 or 504, which may follow a launch", async () => {
    for (const status of [500, 504]) {
      const { calls } = mockFetch([
        { status, body: { error: { code: "internal_error", message: "oops" } } },
        { status: 201, body: { data: { id: "1" } } },
      ]);
      await expect(create.instance(client(3))).rejects.toMatchObject({ statusCode: status });
      expect(calls).toHaveLength(1);
    }
  });

  it("an instance create is retried after a 503, which launched nothing, with the same key", async () => {
    vi.useFakeTimers();
    const { calls } = mockFetch([
      { status: 503, headers: { "retry-after": "1" }, body: { error: { code: "service_unavailable", message: "No GPU" } } },
      { status: 201, body: { data: { id: "1" } } },
    ]);
    const pending = create.instance(client(1));
    await vi.advanceTimersByTimeAsync(1_000);
    expect((await pending).id).toBe("1");
    expect(header(calls[1]!.init, "Idempotency-Key")).toBe(header(calls[0]!.init, "Idempotency-Key"));
  });

  it("an instance create is retried when the connection never opened", async () => {
    const { calls } = failingFetch(1, connectionRefused, 201, { data: { id: "1" } });
    expect((await create.instance(client(1))).id).toBe("1");
    expect(calls).toHaveLength(2);
  });

  it("a schedule run-now is not sent again after a 502 that may follow a launch", async () => {
    const { calls } = mockFetch([
      { status: 502, body: { error: { code: "bad_gateway", message: "Bad gateway" } } },
      { status: 201, body: { data: {} } },
    ]);
    await expect(client(3).schedules.runNow("s1")).rejects.toMatchObject({ statusCode: 502 });
    expect(calls).toHaveLength(1);
  });

  it("a GET is still retried after a lost connection", async () => {
    const { calls } = failingFetch(1, connectionReset, 200, { data: apiJob() });
    expect((await client(1).jobs.get(JOB_ID)).id).toBe(JOB_ID);
    expect(calls).toHaveLength(2);
  });
});

describe("jobs reads", () => {
  it("lists with every filter, repeating tag", async () => {
    const { calls } = mockFetch([{ body: { data: [apiJob()], meta: { cursor: "c2", hasMore: true } } }]);
    const page = await client().jobs.list({
      status: ["running", "failed"],
      tags: { team: "ml", run: "a:b" },
      groupId: "g1",
      q: "train",
      gpuType: "H100",
      createdAfter: new Date("2026-10-20T00:00:00Z"),
      limit: 50,
      cursor: "c1",
    });
    const url = new URL(calls[0]!.url);
    expect(url.searchParams.get("status")).toBe("running,failed");
    expect(url.searchParams.getAll("tag")).toEqual(["team:ml", "run:a:b"]);
    expect(url.searchParams.get("group_id")).toBe("g1");
    expect(url.searchParams.get("q")).toBe("train");
    expect(url.searchParams.get("gpu_type")).toBe("H100");
    expect(url.searchParams.get("created_after")).toBe("2026-10-20T00:00:00.000Z");
    expect(url.searchParams.get("limit")).toBe("50");
    expect(url.searchParams.get("cursor")).toBe("c1");
    expect(page.hasMore).toBe(true);
    expect(page.cursor).toBe("c2");
    expect(page.data[0]!.tags).toEqual({ run_id: "r-1", "team.ml": "vision" });
  });

  it("listAll follows the cursor until the last page", async () => {
    const { calls } = mockFetch([
      { body: { data: [apiJob({ id: "a" })], meta: { cursor: "c2", hasMore: true } } },
      { body: { data: [apiJob({ id: "b" })], meta: { cursor: null, hasMore: false } } },
    ]);
    const ids: string[] = [];
    for await (const job of client().jobs.listAll({ status: "succeeded" })) ids.push(job.id);
    expect(ids).toEqual(["a", "b"]);
    expect(new URL(calls[1]!.url).searchParams.get("cursor")).toBe("c2");
  });

  it("followLogs yields chunks in order, passing each cursor back, until done", async () => {
    const { calls } = mockFetch([
      { body: { data: { job_id: JOB_ID, status: "running", chunks: [{ seq: 1, ts: "t", text: "a\n" }, { seq: 2, ts: "t", text: "b\n" }], cursor: 2, truncated: false, done: false } } },
      { body: { data: { job_id: JOB_ID, status: "succeeded", chunks: [{ seq: 3, ts: "t", text: "c\n" }], cursor: 3, truncated: false, done: true } } },
    ]);
    const text: string[] = [];
    for await (const chunk of client().jobs.followLogs(JOB_ID)) text.push(chunk.text);
    expect(text.join("")).toBe("a\nb\nc\n");
    expect(calls.map((c) => new URL(c.url).searchParams.get("after"))).toEqual(["0", "2"]);
    expect(new URL(calls[0]!.url).searchParams.get("follow")).toBe("true");
  });

  it("wait polls with a growing gap until the job ends", async () => {
    vi.useFakeTimers();
    const { calls } = mockFetch([
      { body: { data: apiJob({ status: "queued" }) } },
      { body: { data: apiJob({ status: "running" }) } },
      { body: { data: apiJob({ status: "failed", exit_code: 3 }) } },
    ]);
    const pending = client().jobs.wait(JOB_ID, { pollInterval: 1, maxPollInterval: 30 });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1_900);
    expect(calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(100);
    const job = await pending;
    expect(job.status).toBe("failed");
    expect(job.exitCode).toBe(3);
  });

  it("wait gives up after its timeout with the job as last seen", async () => {
    vi.useFakeTimers();
    mockFetch([{ body: { data: apiJob({ status: "running" }) } }]);
    const pending = client().jobs.wait(JOB_ID, { timeout: 5, pollInterval: 2 });
    const caught = pending.catch((err: unknown) => err);
    await vi.advanceTimersByTimeAsync(6_000);
    const error = await caught;
    expect(error).toBeInstanceOf(JobWaitTimeoutError);
    expect((error as JobWaitTimeoutError).job.status).toBe("running");
  });
});

describe("artifacts and uploads", () => {
  it("downloads an output from its signed URL without sending the API key there", async () => {
    const { calls } = mockFetch([
      { status: 302, headers: { location: "https://files.example.com/o?sig=1" }, body: undefined },
      { rawBody: new Uint8Array([7, 8, 9]).buffer },
    ]);
    const bytes = await client().jobs.artifacts.download(JOB_ID, "runs/a b.txt");
    expect([...bytes]).toEqual([7, 8, 9]);
    expect(calls[0]!.url).toBe(`https://www.runcrate.ai/api/v1/jobs/${JOB_ID}/artifacts/runs/a%20b.txt`);
    expect(calls[0]!.init.redirect).toBe("manual");
    expect(calls[1]!.url).toBe("https://files.example.com/o?sig=1");
    expect(header(calls[1]!.init, "Authorization")).toBeUndefined();
  });

  it("an unknown output is a NotFoundError", async () => {
    mockFetch([{ status: 404, body: { error: { code: "not_found", message: "The job has no such output" } } }]);
    await expect(client().jobs.artifacts.url(JOB_ID, "nope")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("uploads code with its hash, and skips the PUT when the upload is already in use", async () => {
    const { calls } = mockFetch([
      { status: 201, body: { data: { upload_id: "u1", url: "https://files.example.com/put", url_expires_at: "t", expires_at: "t", max_bytes: 1 } } },
      { status: 200, body: {} },
      { status: 201, body: { data: { upload_id: "u1", url: null, url_expires_at: null, expires_at: "t", max_bytes: 1 } } },
    ]);
    const archive = new TextEncoder().encode("tar");
    const first = await client().jobs.uploads.upload(archive);
    expect(first.uploadId).toBe("u1");
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      bytes: 3,
      sha256: createHash("sha256").update("tar").digest("hex"),
    });
    expect(calls[1]!.init.method).toBe("PUT");
    await client().jobs.uploads.upload(archive);
    expect(calls).toHaveLength(3);
  });

  it("cancels a group once even when the answer is lost, since a repeat is harmless", async () => {
    const { calls } = failingFetch(1, connectionReset, 200, { data: { id: "g1", count: 2, max_parallel: 2, status_counts: { timed_out: 0, cancelled: 2 } } });
    const group = await client(1).jobGroups.cancel("g1");
    expect(group.statusCounts).toEqual({ timed_out: 0, cancelled: 2 });
    expect(calls).toHaveLength(2);
  });

  it("keeps the 500 of a cancel that never succeeds", async () => {
    mockFetch([{ status: 500, body: { error: { code: "internal_error", message: "oops" } } }]);
    await expect(client(0).jobs.cancel(JOB_ID)).rejects.toThrow(InternalServerError);
  });
});
