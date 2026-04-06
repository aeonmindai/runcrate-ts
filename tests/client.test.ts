import { describe, it, expect, vi, afterEach } from "vitest";
import { Runcrate } from "../src/client.js";
import { mockFetch, TEST_API_KEY } from "./helpers.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Runcrate client", () => {
  it("throws if no API key provided and no env var set", () => {
    delete process.env.RUNCRATE_API_KEY;
    expect(() => new Runcrate()).toThrow("API key is required");
  });

  it("throws if API key has wrong prefix", () => {
    expect(() => new Runcrate({ apiKey: "sk_wrong_key" })).toThrow(
      'Keys must start with "rc_live_"',
    );
  });

  it("reads API key from environment variable", () => {
    process.env.RUNCRATE_API_KEY = TEST_API_KEY;
    mockFetch([{ body: { data: [] } }]);
    const rc = new Runcrate();
    expect(rc.instances).toBeDefined();
    expect(rc.models).toBeDefined();
    delete process.env.RUNCRATE_API_KEY;
  });

  it("creates all resource namespaces", () => {
    const rc = new Runcrate({ apiKey: TEST_API_KEY });
    expect(rc.instances).toBeDefined();
    expect(rc.crates).toBeDefined();
    expect(rc.projects).toBeDefined();
    expect(rc.sshKeys).toBeDefined();
    expect(rc.storage).toBeDefined();
    expect(rc.billing).toBeDefined();
    expect(rc.templates).toBeDefined();
    expect(rc.models).toBeDefined();
  });

  it("sends authorization header in requests", async () => {
    const { calls } = mockFetch([{ body: { data: [] } }]);
    const rc = new Runcrate({ apiKey: TEST_API_KEY });
    await rc.instances.list();

    expect(calls).toHaveLength(1);
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${TEST_API_KEY}`);
  });

  it("sends requests to correct base URL", async () => {
    const { calls } = mockFetch([{ body: { data: [] } }]);
    const rc = new Runcrate({
      apiKey: TEST_API_KEY,
      baseUrl: "https://custom.runcrate.com",
    });
    await rc.instances.list();

    expect(calls[0]!.url).toContain("https://custom.runcrate.com");
  });

  it("strips trailing slash from base URL", async () => {
    const { calls } = mockFetch([{ body: { data: [] } }]);
    const rc = new Runcrate({
      apiKey: TEST_API_KEY,
      baseUrl: "https://runcrate.com///",
    });
    await rc.instances.list();

    expect(calls[0]!.url).toMatch(/^https:\/\/runcrate\.com\/api/);
  });
});
