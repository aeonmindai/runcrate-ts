import { describe, it, expect, vi, afterEach } from "vitest";
import { Runcrate } from "../src/client.js";
import { ConflictError, InsufficientCreditsError } from "../src/errors.js";
import { mockFetch, TEST_API_KEY } from "./helpers.js";

function makeClient() {
  return new Runcrate({ apiKey: TEST_API_KEY, maxRetries: 0 });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const apiSchedule = {
  id: "s1",
  name: "nightly-train",
  kind: "job",
  environment_id: "env1",
  created_by: "u1",
  spec: {
    command: "python train.py",
    gpu_type: "H100",
    gpu_count: 1,
    max_runtime_minutes: 120,
    env_keys: ["HF_TOKEN"],
  },
  max_runtime_minutes: 120,
  run_at: null,
  cron: "0 2 * * *",
  timezone: "Europe/London",
  overlap: "skip",
  enabled: true,
  next_run_at: "2026-10-21T01:00:00.000Z",
  last_run_at: null,
  last_status: null,
  last_error: null,
  last_instance_id: null,
  last_job_id: null,
  run_count: 0,
  created_at: "2026-10-20T10:00:00.000Z",
  updated_at: "2026-10-20T10:00:00.000Z",
};

function sentBody(init: RequestInit) {
  return JSON.parse(init.body as string);
}

describe("Schedules resource", () => {
  it("creates a recurring job schedule, keeping env names as given", async () => {
    const { calls } = mockFetch([{ status: 201, body: { data: apiSchedule } }]);
    const rc = makeClient();

    const schedule = await rc.schedules.create({
      kind: "job",
      cron: "0 2 * * *",
      timezone: "Europe/London",
      name: "nightly-train",
      spec: {
        command: "python train.py",
        gpuType: "H100",
        maxRuntimeMinutes: 120,
        env: { HF_TOKEN: "secret", wandbKey: "w" },
      },
    });

    expect(calls[0]!.init.method).toBe("POST");
    expect(calls[0]!.url).toBe("https://www.runcrate.ai/api/v1/schedules");
    expect(sentBody(calls[0]!.init)).toEqual({
      kind: "job",
      cron: "0 2 * * *",
      timezone: "Europe/London",
      name: "nightly-train",
      spec: {
        command: "python train.py",
        gpu_type: "H100",
        max_runtime_minutes: 120,
        env: { HF_TOKEN: "secret", wandbKey: "w" },
      },
    });

    expect(schedule.kind).toBe("job");
    expect(schedule.environmentId).toBe("env1");
    expect(schedule.nextRunAt).toBe("2026-10-21T01:00:00.000Z");
    expect(schedule.maxRuntimeMinutes).toBe(120);
    expect(schedule.runCount).toBe(0);
    if (schedule.kind === "job") {
      expect(schedule.spec.gpuType).toBe("H100");
      expect(schedule.spec.envKeys).toEqual(["HF_TOKEN"]);
    }
  });

  it("creates a one-off instance schedule, sending a Date as an ISO run_at", async () => {
    const { calls } = mockFetch([{ status: 201, body: { data: { ...apiSchedule, kind: "instance" } } }]);
    const rc = makeClient();

    await rc.schedules.create({
      kind: "instance",
      runAt: new Date("2026-10-21T01:00:00Z"),
      overlap: "allow",
      enabled: false,
      spec: {
        name: "eval-box",
        gpuType: "A100",
        maxRuntimeMinutes: 60,
        sshKeyId: "key1",
        envVars: [{ key: "MODE", value: "eval" }],
        idleShutdownMinutes: 30,
      },
    });

    expect(sentBody(calls[0]!.init)).toEqual({
      kind: "instance",
      run_at: "2026-10-21T01:00:00.000Z",
      overlap: "allow",
      enabled: false,
      spec: {
        name: "eval-box",
        gpu_type: "A100",
        max_runtime_minutes: 60,
        ssh_key_id: "key1",
        env_vars: [{ key: "MODE", value: "eval" }],
        idle_shutdown_minutes: 30,
      },
    });
  });

  it("lists schedules", async () => {
    const { calls } = mockFetch([{ body: { data: [apiSchedule] } }]);
    const rc = makeClient();

    const schedules = await rc.schedules.list();
    expect(calls[0]!.init.method).toBe("GET");
    expect(calls[0]!.url).toBe("https://www.runcrate.ai/api/v1/schedules");
    expect(schedules).toHaveLength(1);
    expect(schedules[0]!.lastStatus).toBeNull();
    expect(schedules[0]!.createdBy).toBe("u1");
  });

  it("gets a schedule by id", async () => {
    const { calls } = mockFetch([{ body: { data: apiSchedule } }]);
    const rc = makeClient();

    const schedule = await rc.schedules.get("s1");
    expect(calls[0]!.init.method).toBe("GET");
    expect(calls[0]!.url).toBe("https://www.runcrate.ai/api/v1/schedules/s1");
    expect(schedule.id).toBe("s1");
  });

  it("pauses a schedule with only the changed field", async () => {
    const { calls } = mockFetch([{ body: { data: { ...apiSchedule, enabled: false, next_run_at: null } } }]);
    const rc = makeClient();

    const schedule = await rc.schedules.update("s1", { enabled: false });
    expect(calls[0]!.init.method).toBe("PATCH");
    expect(calls[0]!.url).toBe("https://www.runcrate.ai/api/v1/schedules/s1");
    expect(sentBody(calls[0]!.init)).toEqual({ enabled: false });
    expect(schedule.enabled).toBe(false);
    expect(schedule.nextRunAt).toBeNull();
  });

  it("retimes and replaces the spec on update", async () => {
    const { calls } = mockFetch([{ body: { data: apiSchedule } }]);
    const rc = makeClient();

    await rc.schedules.update("s1", {
      runAt: "2026-10-22T09:00:00.000Z",
      spec: { command: "make", gpuType: "L4", maxRuntimeMinutes: 30, env: { API_KEY: "x" } },
    });
    expect(sentBody(calls[0]!.init)).toEqual({
      run_at: "2026-10-22T09:00:00.000Z",
      spec: { command: "make", gpu_type: "L4", max_runtime_minutes: 30, env: { API_KEY: "x" } },
    });
  });

  it("deletes a schedule", async () => {
    const { calls } = mockFetch([{ body: { data: { id: "s1", deleted: true } } }]);
    const rc = makeClient();

    const result = await rc.schedules.delete("s1");
    expect(calls[0]!.init.method).toBe("DELETE");
    expect(calls[0]!.url).toBe("https://www.runcrate.ai/api/v1/schedules/s1");
    expect(result).toEqual({ id: "s1", deleted: true });
  });

  it("runs a schedule now and maps the launched job", async () => {
    const { calls } = mockFetch([{
      status: 201,
      body: {
        data: {
          schedule: { ...apiSchedule, run_count: 1, last_status: "launched", last_job_id: "j1" },
          job: { id: "j1", name: "nightly-train", status: "queued", max_runtime_minutes: 120 },
        },
      },
    }]);
    const rc = makeClient();

    const result = await rc.schedules.runNow("s1");
    expect(calls[0]!.init.method).toBe("POST");
    expect(calls[0]!.url).toBe("https://www.runcrate.ai/api/v1/schedules/s1/run-now");
    expect(calls[0]!.init.body).toBeUndefined();
    expect(result.schedule.runCount).toBe(1);
    expect(result.schedule.lastStatus).toBe("launched");
    expect(result.schedule.lastJobId).toBe("j1");
    expect(result.job).toEqual({ id: "j1", name: "nightly-train", status: "queued", maxRuntimeMinutes: 120 });
    expect(result.instance).toBeUndefined();
  });

  it("throws InsufficientCreditsError with code BUDGET_REACHED when run-now hits the budget", async () => {
    mockFetch([{
      status: 402,
      body: { error: { code: "BUDGET_REACHED", message: "Monthly budget for agents reached" } },
    }]);
    const rc = makeClient();

    const err = await rc.schedules.runNow("s1").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InsufficientCreditsError);
    expect((err as InsufficientCreditsError).code).toBe("BUDGET_REACHED");
    expect((err as InsufficientCreditsError).statusCode).toBe(402);
    expect((err as InsufficientCreditsError).message).toBe("Monthly budget for agents reached");
  });

  it("throws ConflictError when the workspace is at its schedule cap", async () => {
    mockFetch([{
      status: 409,
      body: { error: { code: "conflict", message: "A workspace can have at most 50 schedules" } },
    }]);
    const rc = makeClient();

    await expect(
      rc.schedules.create({
        kind: "job",
        cron: "0 * * * *",
        spec: { command: "true", gpuType: "L4", maxRuntimeMinutes: 5 },
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
