import type { Transport } from "../transport.js";
import type { Crate, CrateCreateParams, CrateListParams } from "../types.js";
import { removeUndefined } from "../util.js";
import { toSnakeCase } from "../util.js";

export class Crates {
  constructor(private readonly transport: Transport) {}

  async list(params?: CrateListParams): Promise<Crate[]> {
    const { data } = await this.transport.request<Crate[]>({
      method: "GET",
      path: "/api/v1/crates",
      params: params ? removeUndefined(params) : undefined,
    });
    return data;
  }

  async create(params: CrateCreateParams): Promise<Crate> {
    const { data } = await this.transport.request<Crate>({
      method: "POST",
      path: "/api/v1/crates",
      body: toSnakeCase(params),
    });
    return data;
  }

  async get(id: string): Promise<Crate> {
    const { data } = await this.transport.request<Crate>({
      method: "GET",
      path: `/api/v1/crates/${id}`,
    });
    return data;
  }

  async terminate(id: string): Promise<void> {
    await this.transport.request<void>({
      method: "DELETE",
      path: `/api/v1/crates/${id}`,
    });
  }
}
