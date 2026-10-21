import { describe, it, expect, vi, afterEach } from "vitest";
import { Runcrate } from "../src/client.js";
import { mockFetch, TEST_API_KEY } from "./helpers.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Secrets resource", () => {
  it("lists the environment's secret names in camelCase, and never a value", async () => {
    const { calls } = mockFetch([{
      body: {
        data: [
          // A value the API should never send is dropped all the same.
          { key: "DB_URL", sensitive: true, updated_at: "2026-10-20T11:00:00Z", value: "postgres://leak" },
          { key: "HF_TOKEN", sensitive: false, updated_at: "2026-10-21T09:30:00Z" },
        ],
      },
    }]);
    const rc = new Runcrate({ apiKey: TEST_API_KEY, environment: "staging", maxRetries: 0 });

    const secrets = await rc.secrets.list();

    expect(calls).toHaveLength(1);
    const url = new URL(calls[0]!.url);
    expect([calls[0]!.init.method, url.pathname, url.searchParams.get("environment")])
      .toEqual(["GET", "/api/v1/secrets", "staging"]);
    expect(secrets).toEqual([
      { key: "DB_URL", sensitive: true, updatedAt: "2026-10-20T11:00:00Z" },
      { key: "HF_TOKEN", sensitive: false, updatedAt: "2026-10-21T09:30:00Z" },
    ]);
    expect(JSON.stringify(secrets)).not.toContain("postgres");
  });
});
