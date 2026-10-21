import type { Transport } from "../transport.js";
import type { Secret } from "../types.js";

/**
 * The secrets of the environment the client acts in: environment variables every instance and
 * job launched there gets at boot. Names only: values are set in the Runcrate dashboard
 * (Settings > Secrets) and never returned.
 */
export class Secrets {
  constructor(private readonly transport: Transport) {}

  /** The secrets set in the environment, sorted by name. Never their values. */
  async list(): Promise<Secret[]> {
    const { data } = await this.transport.request<Secret[]>({
      method: "GET",
      path: "/api/v1/secrets",
    });
    // Picked field by field, so nothing but a name and its flags reaches the caller.
    return data.map(({ key, sensitive, updatedAt }) => ({ key, sensitive, updatedAt }));
  }
}
