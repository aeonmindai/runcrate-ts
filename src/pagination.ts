import type { ListMeta } from "./types.js";

export class PaginatedResponse<T> {
  readonly data: T[];
  readonly meta: ListMeta;

  constructor(data: T[], meta?: ListMeta) {
    this.data = data;
    this.meta = meta ?? {};
  }

  get hasMore(): boolean {
    return this.meta.hasMore ?? false;
  }

  get cursor(): string | null | undefined {
    return this.meta.cursor;
  }

  get total(): number | null | undefined {
    return this.meta.total;
  }

  [Symbol.iterator](): Iterator<T> {
    return this.data[Symbol.iterator]();
  }

  get length(): number {
    return this.data.length;
  }
}
