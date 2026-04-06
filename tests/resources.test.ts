import { describe, it, expect, vi, afterEach } from "vitest";
import { Runcrate } from "../src/client.js";
import { mockFetch, TEST_API_KEY } from "./helpers.js";

function makeClient() {
  return new Runcrate({ apiKey: TEST_API_KEY, maxRetries: 0 });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Instances resource", () => {
  it("lists instances", async () => {
    const instances = [
      { id: "i1", name: "gpu-1", status: "running" },
      { id: "i2", name: "gpu-2", status: "pending" },
    ];
    mockFetch([{ body: { data: instances } }]);
    const rc = makeClient();

    const result = await rc.instances.list();
    expect(result).toEqual(instances);
  });

  it("lists instances with search param", async () => {
    const { calls } = mockFetch([{ body: { data: [] } }]);
    const rc = makeClient();

    await rc.instances.list({ search: "gpu" });
    expect(calls[0]!.url).toContain("search=gpu");
  });

  it("creates an instance", async () => {
    const created = { id: "i1", name: "my-gpu", status: "provisioning" };
    const { calls } = mockFetch([{ body: { data: created } }]);
    const rc = makeClient();

    const result = await rc.instances.create({
      name: "my-gpu",
      sshKeyId: "key_123",
      gpuType: "A100",
      gpuCount: 1,
      template: "ubuntu-cuda",
    });

    expect(result).toEqual(created);
    const body = JSON.parse(calls[0]!.init.body as string);
    expect(body.name).toBe("my-gpu");
    expect(body.ssh_key_id).toBe("key_123");
    expect(body.gpu_type).toBe("A100");
  });

  it("gets an instance by id", async () => {
    const instance = { id: "i1", name: "gpu-1", status: "running", ip: "1.2.3.4" };
    const { calls } = mockFetch([{ body: { data: instance } }]);
    const rc = makeClient();

    const result = await rc.instances.get("i1");
    expect(result).toEqual(instance);
    expect(calls[0]!.url).toContain("/api/v1/instances/i1");
  });

  it("terminates an instance", async () => {
    const { calls } = mockFetch([{ status: 204 }]);
    const rc = makeClient();

    await rc.instances.terminate("i1");
    expect(calls[0]!.init.method).toBe("DELETE");
    expect(calls[0]!.url).toContain("/api/v1/instances/i1");
  });

  it("gets instance status", async () => {
    const status = { id: "i1", status: "running", ip: "1.2.3.4" };
    const { calls } = mockFetch([{ body: { data: status } }]);
    const rc = makeClient();

    const result = await rc.instances.getStatus("i1");
    expect(result).toEqual(status);
    expect(calls[0]!.url).toContain("/api/v1/instances/i1/status");
  });

  it("lists instance types with filters", async () => {
    const types = [
      { id: "t1", gpuType: "A100", gpuCount: 1, cpuCores: 8, memoryGb: 80, storageGb: 200, region: "us-east", hourlyRate: 2.5 },
    ];
    const { calls } = mockFetch([{ body: { data: types } }]);
    const rc = makeClient();

    const result = await rc.instances.listTypes({ gpuType: "A100", region: "us-east" });
    expect(result).toEqual(types);
    expect(calls[0]!.url).toContain("gpuType=A100");
    expect(calls[0]!.url).toContain("region=us-east");
  });
});

describe("Crates resource", () => {
  it("lists crates", async () => {
    const crates = [{ id: "c1", name: "app-1", status: "running" }];
    mockFetch([{ body: { data: crates } }]);
    const rc = makeClient();

    const result = await rc.crates.list();
    expect(result).toEqual(crates);
  });

  it("creates a crate", async () => {
    const crate = { id: "c1", name: "my-app", status: "provisioning" };
    mockFetch([{ body: { data: crate } }]);
    const rc = makeClient();

    const result = await rc.crates.create({
      name: "my-app",
      sshKeyId: "key_123",
      template: "pytorch",
    });
    expect(result).toEqual(crate);
  });

  it("gets a crate by id", async () => {
    const crate = { id: "c1", name: "app-1", status: "running" };
    const { calls } = mockFetch([{ body: { data: crate } }]);
    const rc = makeClient();

    const result = await rc.crates.get("c1");
    expect(result).toEqual(crate);
    expect(calls[0]!.url).toContain("/api/v1/crates/c1");
  });

  it("terminates a crate", async () => {
    const { calls } = mockFetch([{ status: 204 }]);
    const rc = makeClient();

    await rc.crates.terminate("c1");
    expect(calls[0]!.init.method).toBe("DELETE");
  });
});

describe("Projects resource", () => {
  it("lists projects", async () => {
    const projects = [{ id: "p1", name: "ML Research" }];
    mockFetch([{ body: { data: projects } }]);
    const rc = makeClient();

    const result = await rc.projects.list();
    expect(result).toEqual(projects);
  });

  it("creates a project", async () => {
    const project = { id: "p1", name: "New Project" };
    const { calls } = mockFetch([{ body: { data: project } }]);
    const rc = makeClient();

    const result = await rc.projects.create({
      name: "New Project",
      description: "My project",
    });
    expect(result).toEqual(project);
    const body = JSON.parse(calls[0]!.init.body as string);
    expect(body.name).toBe("New Project");
    expect(body.description).toBe("My project");
  });

  it("gets a project by id", async () => {
    const project = { id: "p1", name: "ML Research" };
    mockFetch([{ body: { data: project } }]);
    const rc = makeClient();

    const result = await rc.projects.get("p1");
    expect(result).toEqual(project);
  });

  it("updates a project", async () => {
    const project = { id: "p1", name: "Updated" };
    const { calls } = mockFetch([{ body: { data: project } }]);
    const rc = makeClient();

    const result = await rc.projects.update("p1", { name: "Updated" });
    expect(result).toEqual(project);
    expect(calls[0]!.init.method).toBe("PATCH");
  });

  it("deletes a project", async () => {
    const { calls } = mockFetch([{ status: 204 }]);
    const rc = makeClient();

    await rc.projects.delete("p1");
    expect(calls[0]!.init.method).toBe("DELETE");
    expect(calls[0]!.url).toContain("/api/v1/projects/p1");
  });
});

describe("SSH Keys resource", () => {
  it("lists SSH keys", async () => {
    const keys = [{ id: "k1", name: "laptop", fingerprint: "SHA256:abc" }];
    mockFetch([{ body: { data: keys } }]);
    const rc = makeClient();

    const result = await rc.sshKeys.list();
    expect(result).toEqual(keys);
  });

  it("creates an SSH key", async () => {
    const key = { id: "k1", name: "laptop" };
    const { calls } = mockFetch([{ body: { data: key } }]);
    const rc = makeClient();

    const result = await rc.sshKeys.create({
      name: "laptop",
      publicKey: "ssh-ed25519 AAAA...",
    });
    expect(result).toEqual(key);
    const body = JSON.parse(calls[0]!.init.body as string);
    expect(body.public_key).toBe("ssh-ed25519 AAAA...");
  });

  it("deletes an SSH key", async () => {
    const { calls } = mockFetch([{ status: 204 }]);
    const rc = makeClient();

    await rc.sshKeys.delete("k1");
    expect(calls[0]!.init.method).toBe("DELETE");
    expect(calls[0]!.url).toContain("/api/v1/ssh-keys/k1");
  });
});

describe("Storage resource", () => {
  it("lists storage volumes", async () => {
    const volumes = [{ id: "v1", name: "datasets", sizeGb: 100 }];
    mockFetch([{ body: { data: volumes } }]);
    const rc = makeClient();

    const result = await rc.storage.list();
    expect(result).toEqual(volumes);
  });

  it("lists storage with search", async () => {
    const { calls } = mockFetch([{ body: { data: [] } }]);
    const rc = makeClient();

    await rc.storage.list({ search: "data" });
    expect(calls[0]!.url).toContain("search=data");
  });

  it("gets a storage volume by id", async () => {
    const volume = { id: "v1", name: "datasets", sizeGb: 100, status: "attached" };
    const { calls } = mockFetch([{ body: { data: volume } }]);
    const rc = makeClient();

    const result = await rc.storage.get("v1");
    expect(result).toEqual(volume);
    expect(calls[0]!.url).toContain("/api/v1/storage/v1");
  });
});

describe("Billing resource", () => {
  it("gets balance", async () => {
    const balance = { creditsBalance: 50.0, originalBalance: 100.0, activeUsageCost: 2.5 };
    mockFetch([{ body: { data: balance } }]);
    const rc = makeClient();

    const result = await rc.billing.getBalance();
    expect(result).toEqual(balance);
  });

  it("lists transactions with pagination", async () => {
    const txns = [
      { id: "t1", type: "credit", amount: 50.0 },
      { id: "t2", type: "debit", amount: -2.5 },
    ];
    const { calls } = mockFetch([{
      body: {
        data: txns,
        meta: { hasMore: true, total: 100 },
      },
    }]);
    const rc = makeClient();

    const result = await rc.billing.listTransactions({ limit: 2, offset: 0, type: "credit" });
    expect(result.data).toEqual(txns);
    expect(result.hasMore).toBe(true);
    expect(result.total).toBe(100);
    expect(calls[0]!.url).toContain("limit=2");
    expect(calls[0]!.url).toContain("type=credit");
  });

  it("gets usage summary", async () => {
    const usage = { totalRequests: 500, totalTokens: 100000, totalCost: 5.0 };
    const { calls } = mockFetch([{ body: { data: usage } }]);
    const rc = makeClient();

    const result = await rc.billing.usage({ from: "2025-01-01", to: "2025-01-31" });
    expect(result).toEqual(usage);
    expect(calls[0]!.url).toContain("from=2025-01-01");
    expect(calls[0]!.url).toContain("to=2025-01-31");
  });
});

describe("Templates resource", () => {
  it("lists templates with pagination", async () => {
    const templates = [
      { id: "tpl1", name: "Ubuntu CUDA", category: "ml" },
      { id: "tpl2", name: "PyTorch", category: "ml" },
    ];
    const { calls } = mockFetch([{
      body: {
        data: templates,
        meta: { hasMore: false, total: 2 },
      },
    }]);
    const rc = makeClient();

    const result = await rc.templates.list({
      search: "pytorch",
      category: "ml",
      page: 1,
      pageSize: 10,
    });
    expect(result.data).toEqual(templates);
    expect(result.hasMore).toBe(false);
    expect(result.total).toBe(2);
    expect(calls[0]!.url).toContain("search=pytorch");
    expect(calls[0]!.url).toContain("category=ml");
  });

  it("uses default pagination params", async () => {
    const { calls } = mockFetch([{ body: { data: [], meta: {} } }]);
    const rc = makeClient();

    await rc.templates.list();
    expect(calls[0]!.url).toContain("page=1");
    expect(calls[0]!.url).toContain("page_size=25");
  });
});
