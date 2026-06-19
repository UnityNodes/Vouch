import type { ZGComputeClient, ZGMode } from "./types.js";

export * from "./types.js";
export { MockZGComputeClient } from "./mock/MockZGComputeClient.js";
export type { MockZGOptions } from "./mock/MockZGComputeClient.js";
export { ZGStorageReceiptStore } from "./live/storage.js";

export async function makeZGComputeClient(mode: ZGMode): Promise<ZGComputeClient> {
  if (mode === "mock") {
    const { MockZGComputeClient } = await import("./mock/MockZGComputeClient.js");
    return new MockZGComputeClient();
  }
  const { LiveZGComputeClient } = await import("./live/LiveZGComputeClient.js");
  return await LiveZGComputeClient.create();
}
