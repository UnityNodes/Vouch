import type { ZGComputeClient, ZGMode } from "./types";

export * from "./types";
export { MockZGComputeClient } from "./mock/MockZGComputeClient";
export type { MockZGOptions } from "./mock/MockZGComputeClient";
export { ZGStorageReceiptStore } from "./live/storage";

export async function makeZGComputeClient(mode: ZGMode): Promise<ZGComputeClient> {
  if (mode === "mock") {
    const { MockZGComputeClient } = await import("./mock/MockZGComputeClient");
    return new MockZGComputeClient();
  }
  const { LiveZGComputeClient } = await import("./live/LiveZGComputeClient");
  return await LiveZGComputeClient.create();
}
