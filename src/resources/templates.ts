import { PaginatedResponse } from "../pagination.js";
import type { Transport } from "../transport.js";
import type { Template, TemplateListParams } from "../types.js";
import { removeUndefined } from "../util.js";

export class Templates {
  constructor(private readonly transport: Transport) {}

  async list(
    params?: TemplateListParams,
  ): Promise<PaginatedResponse<Template>> {
    const queryParams = {
      page: params?.page ?? 1,
      page_size: params?.pageSize ?? 25,
      search: params?.search,
      category: params?.category,
      sort_by: params?.sortBy,
      sort_dir: params?.sortDir,
    };
    const { data, meta } = await this.transport.request<Template[]>({
      method: "GET",
      path: "/api/v1/templates",
      params: removeUndefined(queryParams),
    });
    return new PaginatedResponse(data, meta);
  }
}
