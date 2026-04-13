import type { Transport } from "../transport.js";
import type {
  StorageVolume,
  StorageListParams,
  StorageCreateParams,
  StorageDeleteResult,
  StorageRegion,
} from "../types.js";
import { removeUndefined, toSnakeCase } from "../util.js";

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

  async listRegions(): Promise<StorageRegion[]> {
    const { data } = await this.transport.request<StorageRegion[]>({
      method: "GET",
      path: "/api/v1/storage/regions",
    });
    return data;
  }

  async create(params: StorageCreateParams): Promise<StorageVolume> {
    const { data } = await this.transport.request<StorageVolume>({
      method: "POST",
      path: "/api/v1/storage",
      body: toSnakeCase(params),
    });
    return data;
  }

  async resize(id: string, sizeGb: number): Promise<StorageVolume> {
    const { data } = await this.transport.request<StorageVolume>({
      method: "PATCH",
      path: `/api/v1/storage/${id}`,
      body: { size_gb: sizeGb },
    });
    return data;
  }

  async delete(id: string): Promise<StorageDeleteResult> {
    const { data } = await this.transport.request<StorageDeleteResult>({
      method: "DELETE",
      path: `/api/v1/storage/${id}`,
    });
    return data;
  }
}
