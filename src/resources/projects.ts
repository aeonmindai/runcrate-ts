import type { Transport } from "../transport.js";
import type {
  Project,
  ProjectCreateParams,
  ProjectUpdateParams,
} from "../types.js";
import { toSnakeCase } from "../util.js";

export class Projects {
  constructor(private readonly transport: Transport) {}

  async list(): Promise<Project[]> {
    const { data } = await this.transport.request<Project[]>({
      method: "GET",
      path: "/api/v1/projects",
    });
    return data;
  }

  async create(params: ProjectCreateParams): Promise<Project> {
    const { data } = await this.transport.request<Project>({
      method: "POST",
      path: "/api/v1/projects",
      body: toSnakeCase(params),
    });
    return data;
  }

  async get(id: string): Promise<Project> {
    const { data } = await this.transport.request<Project>({
      method: "GET",
      path: `/api/v1/projects/${id}`,
    });
    return data;
  }

  async update(id: string, params: ProjectUpdateParams): Promise<Project> {
    const { data } = await this.transport.request<Project>({
      method: "PATCH",
      path: `/api/v1/projects/${id}`,
      body: toSnakeCase(params),
    });
    return data;
  }

  async delete(id: string): Promise<void> {
    await this.transport.request<void>({
      method: "DELETE",
      path: `/api/v1/projects/${id}`,
    });
  }
}
