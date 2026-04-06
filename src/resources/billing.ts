import { PaginatedResponse } from "../pagination.js";
import type { Transport } from "../transport.js";
import type {
  Balance,
  Transaction,
  TransactionListParams,
  UsageParams,
  UsageSummary,
} from "../types.js";
import { removeUndefined } from "../util.js";

export class Billing {
  constructor(private readonly transport: Transport) {}

  async getBalance(): Promise<Balance> {
    const { data } = await this.transport.request<Balance>({
      method: "GET",
      path: "/api/v1/billing/balance",
    });
    return data;
  }

  async listTransactions(
    params?: TransactionListParams,
  ): Promise<PaginatedResponse<Transaction>> {
    const queryParams = {
      limit: params?.limit ?? 50,
      offset: params?.offset ?? 0,
      type: params?.type,
    };
    const { data, meta } = await this.transport.request<Transaction[]>({
      method: "GET",
      path: "/api/v1/billing/transactions",
      params: removeUndefined(queryParams),
    });
    return new PaginatedResponse(data, meta);
  }

  async usage(params?: UsageParams): Promise<UsageSummary> {
    const { data } = await this.transport.request<UsageSummary>({
      method: "GET",
      path: "/api/v1/billing/usage",
      params: params ? removeUndefined(params) : undefined,
    });
    return data;
  }
}
