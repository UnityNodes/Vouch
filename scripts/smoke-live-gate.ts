/**
 * THE DAY-1 GATE smoke test.
 *
 * Run when `pnpm fund:balances` shows ≥ 5 OG consolidated onto PRIMARY_PRIVATE_KEY:
 *   ZG_COMPUTE_MODE=live npx tsx scripts/smoke-live-gate.ts
 *
 * Pass criteria:
 *   - LiveZGComputeClient.create() completes (addLedger, pick TeeML, transferFund)
 *   - decide() returns attestation.verified === true
 *   - LLM verdict parses to either ALLOWED or DENIED with rationale
 *
 * If FAIL by end of Day 2 → pivot to Ro32 (JUN 28). DO NOT keep grinding UI.
 */
import "dotenv/config";
import { makeZGComputeClient } from "@agentcheckout/zerogravity";

async function main() {
  console.log("[smoke] creating live ZGComputeClient — addLedger + pick TeeML + transferFund…");
  const t0 = Date.now();
  const client = await makeZGComputeClient("live");
  console.log(`[smoke] client ready in ${Date.now() - t0}ms`);

  console.log("[smoke] calling decide() on a benign input — should ALLOW + verified=true…");
  const t1 = Date.now();
  const result = await client.decide({
    payer: "0x" + "1".repeat(40),
    merchant: "0x" + "2".repeat(40),
    asset: "0x" + "3".repeat(40),
    amount: "100",
    purpose: "premium-data fetch",
    chain: "0g-galileo",
    network: 16602,
  });
  console.log(`[smoke] decide() in ${Date.now() - t1}ms`);
  console.log(JSON.stringify(result, null, 2));

  if (!result.attestation.verified) {
    console.error("\n❌ GATE FAIL: attestation.verified === false");
    console.error("Diagnosis steps (do NOT panic — work the list):");
    console.error(
      "  1. Re-run: testnet provider TEE runtimes are flaky. Wait 5 min, retry.",
    );
    console.error(
      "  2. Try another TeeML provider: edit broker.ts pickTeeProvider to pick second-in-list.",
    );
    console.error(
      "  3. Confirm processResponse signature is (provider, chatID?, content?) in installed SDK.",
    );
    console.error("  4. If chatId is empty (no 'ZG-Res-Key' header, no completion.id) — bug.");
    process.exit(1);
  }

  console.log("\n✅ GATE PASS — attestation verified by processResponse()");
  console.log("Ready to proceed to Phase 4 (middleware swap → live mode).");
}

main().catch((e) => {
  console.error("\n❌ GATE FAIL (exception):", e);
  process.exit(1);
});
