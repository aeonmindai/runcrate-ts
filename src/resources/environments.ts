import type { Transport } from "../transport.js";
import type {
  Environment,
  EnvironmentCreateParams,
  EnvironmentUpdateParams,
} from "../types.js";
import { toSnakeCase } from "../util.js";

export class Environments {
  constructor(private readonly transport: Transport) {}

  async list(): Promise<Environment[]> {
    const { data } = await this.transport.request<Environment[]>({
      method: "GET",
      path: "/api/v1/environments",
    });
    return data;
  }

  async create(params: EnvironmentCreateParams): Promise<Environment> {
    const { data } = await this.transport.request<Environment>({
      method: "POST",
      path: "/api/v1/environments",
      body: toSnakeCase(params),
    });
    return data;
  }

  async get(id: string): Promise<Environment> {
    const { data } = await this.transport.request<Environment>({
      method: "GET",
      path: `/api/v1/environments/${id}`,
    });
    return data;
  }

  async update(id: string, params: EnvironmentUpdateParams): Promise<Environment> {
    const { data } = await this.transport.request<Environment>({
      method: "PATCH",
      path: `/api/v1/environments/${id}`,
      body: toSnakeCase(params),
    });
    return data;
  }

  async delete(id: string): Promise<void> {
    await this.transport.request<void>({
      method: "DELETE",
      path: `/api/v1/environments/${id}`,
    });
  }
}
