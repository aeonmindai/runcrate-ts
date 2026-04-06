import type { Transport } from "../transport.js";
import type {
  Instance,
  InstanceCreateParams,
  InstanceListParams,
  InstanceStatus,
  InstanceType,
  InstanceTypeListParams,
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
