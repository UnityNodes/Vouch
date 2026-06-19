/**
 * LiveZGComputeClient — full implementation lands in Phase 3 (DAY-1 GATE).
 * Stub here so the package exports cleanly and dynamic import in
 * makeZGComputeClient resolves at runtime.
 */
import type { DecideInput, DecideResult, ZGComputeClient } from "../types.js";

export class LiveZGComputeClient implements ZGComputeClient {
  readonly mode = "live" as const;

  private constructor() {
    /* will hold providerAddress once Phase 3 lands */
  }

  static async create(): Promise<LiveZGComputeClient> {
    throw new Error(
      "LiveZGComputeClient not yet implemented — set ZG_COMPUTE_MODE=mock or complete Phase 3.",
    );
  }

  async decide(_input: DecideInput): Promise<DecideResult> {
    throw new Error("LiveZGComputeClient not yet implemented.");
  }
}
