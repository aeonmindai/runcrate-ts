import type { Transport } from "../transport.js";
import type { SSHKey, SSHKeyCreateParams } from "../types.js";
import { toSnakeCase } from "../util.js";

export class SSHKeys {
  constructor(private readonly transport: Transport) {}

  async list(): Promise<SSHKey[]> {
    const { data } = await this.transport.request<SSHKey[]>({
      method: "GET",
      path: "/api/v1/ssh-keys",
    });
    return data;
  }

  async create(params: SSHKeyCreateParams): Promise<SSHKey> {
    const { data } = await this.transport.request<SSHKey>({
      method: "POST",
      path: "/api/v1/ssh-keys",
      body: toSnakeCase(params),
    });
    return data;
  }

  async delete(id: string): Promise<void> {
    await this.transport.request<void>({
      method: "DELETE",
      path: `/api/v1/ssh-keys/${id}`,
    });
  }
}
