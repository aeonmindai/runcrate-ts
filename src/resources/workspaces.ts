import type { Transport } from "../transport.js";
import type {
  Workspace,
  WorkspaceCreateParams,
  WorkspaceUpdateParams,
} from "../types.js";
import { toSnakeCase } from "../util.js";

export class Workspaces {
  constructor(private readonly transport: Transport) {}

  async list(): Promise<Workspace[]> {
    const { data } = await this.transport.request<Workspace[]>({
      method: "GET",
      path: "/api/v1/workspaces",
    });
    return data;
  }

  async create(params: WorkspaceCreateParams): Promise<Workspace> {
    const { data } = await this.transport.request<Workspace>({
      method: "POST",
      path: "/api/v1/workspaces",
      body: toSnakeCase(params),
    });
    return data;
  }

  async get(id: string): Promise<Workspace> {
    const { data } = await this.transport.request<Workspace>({
      method: "GET",
      path: `/api/v1/workspaces/${id}`,
    });
    return data;
  }

  async update(id: string, params: WorkspaceUpdateParams): Promise<Workspace> {
    const { data } = await this.transport.request<Workspace>({
      method: "PATCH",
      path: `/api/v1/workspaces/${id}`,
      body: toSnakeCase(params),
    });
    return data;
  }

  async delete(id: string): Promise<void> {
    await this.transport.request<void>({
      method: "DELETE",
      path: `/api/v1/workspaces/${id}`,
    });
  }
}
