import type { Transport } from "../transport.js";
import type {
  CreateScheduleParams,
  RunNowResult,
  Schedule,
  ScheduleDeleteResult,
  ScheduleInstanceSpec,
  ScheduleJobSpec,
  UpdateScheduleParams,
} from "../types.js";
import { removeUndefined, toSnakeCase } from "../util.js";

/** Job env names are user data, so they go out exactly as given rather than snake_cased. */
function specBody(spec: ScheduleInstanceSpec | ScheduleJobSpec): Record<string, unknown> {
  const { env, ...rest } = spec as ScheduleJobSpec;
  const body = toSnakeCase(rest);
  if (env !== undefined) body.env = env;
  return body;
}

export class Schedules {
  constructor(private readonly transport: Transport) {}

  /**
   * Schedule an instance launch or a job, once (`runAt`) or on a recurring `cron` in `timezone`.
   * It starts within about 2 minutes of its time, as you, in this environment. Always set
   * `spec.maxRuntimeMinutes`. A bad spec, cron or time throws an `UnprocessableEntityError`
   * (422); more than 50 schedules in the workspace throws a `ConflictError` (409).
   */
  async create(params: CreateScheduleParams): Promise<Schedule> {
    const { kind, spec, runAt, cron, timezone, overlap, name, enabled } = params;
    const { data } = await this.transport.request<Schedule>({
      method: "POST",
      path: "/api/v1/schedules",
      body: removeUndefined({
        kind,
        spec: specBody(spec),
        run_at: runAt instanceof Date ? runAt.toISOString() : runAt,
        cron,
        timezone,
        overlap,
        name,
        enabled,
      }),
    });
    return data;
  }

  /** This environment's schedules, newest first. */
  async list(): Promise<Schedule[]> {
    const { data } = await this.transport.request<Schedule[]>({
      method: "GET",
      path: "/api/v1/schedules",
    });
    return data;
  }

  async get(id: string): Promise<Schedule> {
    const { data } = await this.transport.request<Schedule>({
      method: "GET",
      path: `/api/v1/schedules/${id}`,
    });
    return data;
  }

  /**
   * Pause (`{ enabled: false }`), resume (`{ enabled: true }`), retime, rename or change a
   * schedule. Resuming a one-off whose time has passed, without a new `runAt`, throws a
   * `ConflictError` (409).
   */
  async update(id: string, params: UpdateScheduleParams): Promise<Schedule> {
    const { spec, runAt, cron, timezone, overlap, name, enabled } = params;
    const { data } = await this.transport.request<Schedule>({
      method: "PATCH",
      path: `/api/v1/schedules/${id}`,
      body: removeUndefined({
        enabled,
        run_at: runAt instanceof Date ? runAt.toISOString() : runAt,
        cron,
        timezone,
        overlap,
        name,
        spec: spec ? specBody(spec) : undefined,
      }),
    });
    return data;
  }

  async delete(id: string): Promise<ScheduleDeleteResult> {
    const { data } = await this.transport.request<ScheduleDeleteResult>({
      method: "DELETE",
      path: `/api/v1/schedules/${id}`,
    });
    return data;
  }

  /**
   * Launch a schedule's instance or job now, enabled or not. Does not move `nextRunAt`.
   * A reached environment budget throws an `InsufficientCreditsError` with `code`
   * `"BUDGET_REACHED"`; a low balance, the same error with `code` `"insufficient_credits"`.
   */
  async runNow(id: string): Promise<RunNowResult> {
    const { data } = await this.transport.request<RunNowResult>({
      method: "POST",
      path: `/api/v1/schedules/${id}/run-now`,
    });
    return data;
  }
}
