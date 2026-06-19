import type { ZGComputeClient, ZGMode } from "./types.js";

export * from "./types.js";

export async function makeZGComputeClient(mode: ZGMode): Promise<ZGComputeClient> {
  if (mode === "mock") {
    const { MockZGComputeClient } = await import("./mock/MockZGComputeClient.js");
    return new MockZGComputeClient();
  }
  const { LiveZGComputeClient } = await import("./live/LiveZGComputeClient.js");
  return await LiveZGComputeClient.create();
}
