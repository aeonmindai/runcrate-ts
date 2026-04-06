import type { RuncrateConfig } from "./types.js";
import { Transport } from "./transport.js";
import { Instances } from "./resources/instances.js";
import { Crates } from "./resources/crates.js";
import { Projects } from "./resources/projects.js";
import { SSHKeys } from "./resources/ssh-keys.js";
import { Storage } from "./resources/storage.js";
import { Billing } from "./resources/billing.js";
import { Templates } from "./resources/templates.js";
import { Models } from "./resources/models.js";

const DEFAULT_BASE_URL = "https://runcrate.com";
const DEFAULT_INFERENCE_URL = "https://api.runcrate.ai";
const DEFAULT_TIMEOUT = 30;
const DEFAULT_MAX_RETRIES = 3;

function resolveApiKey(config?: RuncrateConfig): string {
  const key = config?.apiKey ?? process.env.RUNCRATE_API_KEY;
  if (!key) {
    throw new Error(
      "API key is required. Pass it as `apiKey` or set the RUNCRATE_API_KEY environment variable.",
    );
  }
  if (!key.startsWith("rc_live_")) {
    throw new Error(
      'Invalid API key format. Keys must start with "rc_live_".',
    );
  }
  return key;
}

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export class Runcrate {
  readonly instances: Instances;
  readonly crates: Crates;
  readonly projects: Projects;
  readonly sshKeys: SSHKeys;
  readonly storage: Storage;
  readonly billing: Billing;
  readonly templates: Templates;
  readonly models: Models;

  constructor(config?: RuncrateConfig) {
    const apiKey = resolveApiKey(config);
    const baseUrl = trimTrailingSlash(config?.baseUrl ?? DEFAULT_BASE_URL);
    const inferenceUrl = trimTrailingSlash(
      config?.inferenceUrl ?? DEFAULT_INFERENCE_URL,
    );
    const timeout = config?.timeout ?? DEFAULT_TIMEOUT;
    const maxRetries = config?.maxRetries ?? DEFAULT_MAX_RETRIES;
    const customHeaders = config?.customHeaders ?? {};

    // Infrastructure transport (runcrate.com)
    const infraTransport = new Transport({
      baseUrl,
      apiKey,
      timeout,
      maxRetries,
      customHeaders,
    });

    // Inference transport (api.runcrate.ai)
    const inferenceTransport = new Transport({
      baseUrl: inferenceUrl,
      apiKey,
      timeout,
      maxRetries,
      customHeaders,
    });

    this.instances = new Instances(infraTransport);
    this.crates = new Crates(infraTransport);
    this.projects = new Projects(infraTransport);
    this.sshKeys = new SSHKeys(infraTransport);
    this.storage = new Storage(infraTransport);
    this.billing = new Billing(infraTransport);
    this.templates = new Templates(infraTransport);
    this.models = new Models(inferenceTransport, inferenceUrl, apiKey);
  }
}

export default Runcrate;
