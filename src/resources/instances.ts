import type { Transport } from "../transport.js";
import type {
  Instance,
  InstanceCreateParams,
  InstanceListParams,
  InstanceStatus,
  InstanceType,
  InstanceTypeListParams,
  InstanceUpdateParams,
} from "../types.js";
import { removeUndefined, toSnakeCase } from "../util.js";

export class Instances {
  constructor(private readonly transport: Transport) {}

  async list(params?: InstanceListParams): Promise<Instance[]> {
    const { data } = await this.transport.request<Instance[]>({
      method: "GET",
      path: "/api/v1/instances",
      params: params ? removeUndefined(params) : undefined,
    });
    return data;
  }

  /**
   * Launch an instance. For unattended agent work, set `maxRuntimeMinutes` (5 to 10080) and
   * `idleShutdownMinutes` (5 to 1440) so the instance stops on its own. Values outside those
   * ranges are rejected with a `BadRequestError`. If the environment's monthly budget is
   * reached, this throws an `InsufficientCreditsError` with `code` `"BUDGET_REACHED"`.
   */
  async create(params: InstanceCreateParams): Promise<Instance> {
    const { data } = await this.transport.request<Instance>({
      method: "POST",
      path: "/api/v1/instances",
      body: toSnakeCase(params),
    });
    return data;
  }

  async get(id: string): Promise<Instance> {
    const { data } = await this.transport.request<Instance>({
      method: "GET",
      path: `/api/v1/instances/${id}`,
    });
    return data;
  }

  /**
   * Change a starting or running instance's auto stop, by id or unique name. Returns the instance
   * with its new `autoStopAt`. Throws a `ConflictError` (409) when the instance is not live, has
   * no GPU for idle stop, or was launched before idle stop existed.
   */
  async update(id: string, params: InstanceUpdateParams): Promise<Instance> {
    const { data } = await this.transport.request<Instance>({
      method: "PATCH",
      path: `/api/v1/instances/${encodeURIComponent(id)}`,
      body: toSnakeCase(params),
    });
    return data;
  }

  async terminate(id: string): Promise<void> {
    await this.transport.request<void>({
      method: "DELETE",
      path: `/api/v1/instances/${id}`,
    });
  }

  async getStatus(id: string): Promise<InstanceStatus> {
    const { data } = await this.transport.request<InstanceStatus>({
      method: "GET",
      path: `/api/v1/instances/${id}/status`,
    });
    return data;
  }

  async listTypes(params?: InstanceTypeListParams): Promise<InstanceType[]> {
    const { data } = await this.transport.request<InstanceType[]>({
      method: "GET",
      path: "/api/v1/instances/types",
      params: params ? removeUndefined(params) : undefined,
    });
    return data;
  }
}
