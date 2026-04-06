import type { Transport } from "../transport.js";
import type { StorageVolume, StorageListParams } from "../types.js";
import { removeUndefined } from "../util.js";

export class Storage {
  constructor(private readonly transport: Transport) {}

  async list(params?: StorageListParams): Promise<StorageVolume[]> {
    const { data } = await this.transport.request<StorageVolume[]>({
      method: "GET",
      path: "/api/v1/storage",
      params: params ? removeUndefined(params) : undefined,
    });
    return data;
  }

  async get(id: string): Promise<StorageVolume> {
    const { data } = await this.transport.request<StorageVolume>({
      method: "GET",
      path: `/api/v1/storage/${id}`,
    });
    return data;
  }
}
