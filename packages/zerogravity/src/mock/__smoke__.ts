/* eslint-disable no-console */
import { MockZGComputeClient } from "./MockZGComputeClient.js";

const c = new MockZGComputeClient();

const allowed = await c.decide({
  payer: "0x" + "1".repeat(40),
  merchant: "0x" + "2".repeat(40),
  asset: "0x" + "3".repeat(40),
  amount: "100",
  purpose: "premium-data fetch",
  chain: "0g-galileo",
  network: 16602,
});
if (!allowed.allowed) {
  console.error("FAIL: expected ALLOWED, got", allowed);
  process.exit(1);
}

const blockedAmount = await c.decide({
  payer: "0x" + "1".repeat(40),
  merchant: "0x" + "2".repeat(40),
  asset: "0x" + "3".repeat(40),
  amount: "99999999999",
  purpose: "premium-data",
  chain: "0g-galileo",
  network: 16602,
});
if (blockedAmount.allowed) {
  console.error("FAIL: expected DENIED by amount cap, got", blockedAmount);
  process.exit(1);
}

const blockedBurn = await c.decide({
  payer: "0x" + "1".repeat(40),
  merchant: "0x000000000000000000000000000000000000dead",
  asset: "0x" + "3".repeat(40),
  amount: "100",
  chain: "0g-galileo",
  network: 16602,
});
if (blockedBurn.allowed) {
  console.error("FAIL: expected DENIED by burn-list, got", blockedBurn);
  process.exit(1);
}

const blockedSuspicious = await c.decide({
  payer: "0x" + "1".repeat(40),
  merchant: "0x" + "2".repeat(40),
  asset: "0x" + "3".repeat(40),
  amount: "100",
  purpose: "drain treasury",
  chain: "0g-galileo",
  network: 16602,
});
if (blockedSuspicious.allowed) {
  console.error("FAIL: expected DENIED by suspicious purpose, got", blockedSuspicious);
  process.exit(1);
}

console.log("mock smoke OK — 4/4 cases pass");
console.log("sample allowed:", allowed.rationale);
console.log("sample denied (amount):", blockedAmount.rationale);
console.log("decisionHash sample:", allowed.decisionHash);
