import { describe, it, expect } from "vitest";
import { PaginatedResponse } from "../src/pagination.js";

describe("PaginatedResponse", () => {
  it("wraps data array", () => {
    const response = new PaginatedResponse([1, 2, 3]);
    expect(response.data).toEqual([1, 2, 3]);
    expect(response.length).toBe(3);
  });

  it("exposes meta properties", () => {
    const response = new PaginatedResponse(
      [{ id: "1" }],
      { hasMore: true, total: 50, cursor: "abc123" },
    );
    expect(response.hasMore).toBe(true);
    expect(response.total).toBe(50);
    expect(response.cursor).toBe("abc123");
  });

  it("defaults hasMore to false when meta is empty", () => {
    const response = new PaginatedResponse([]);
    expect(response.hasMore).toBe(false);
    expect(response.total).toBeUndefined();
    expect(response.cursor).toBeUndefined();
  });

  it("is iterable", () => {
    const items = [{ id: "1" }, { id: "2" }, { id: "3" }];
    const response = new PaginatedResponse(items);

    const collected = [];
    for (const item of response) {
      collected.push(item);
    }
    expect(collected).toEqual(items);
  });

  it("works with spread operator", () => {
    const response = new PaginatedResponse(["a", "b", "c"]);
    expect([...response]).toEqual(["a", "b", "c"]);
  });
});
