/**
 * Read balances of all 5 funding wallets. Print sum + readiness.
 * Run: `pnpm fund:balances` (or `npx tsx scripts/fund-bootstrap.ts`)
 *
 * Thresholds match the OFFICIAL 0g-compute-ts-starter-kit minimums:
 *   - addLedger:     3 OG (contract minimum, will revert if lower)
 *   - transferFund:  1 OG per provider (inference sub-account)
 *   - gas / storage / deploys / settlement: ~0.5 OG buffer recommended
 *
 *   ≥ 5 OG → READY (3 + 1 + 1 buffer)
 *   ≥ 4 OG → MINIMAL (works for one shot, no margin for mistakes)
 *   < 4 OG → cannot init ledger; keep dripping + Discord escalation
 */
import "dotenv/config";
import { ethers } from "ethers";
import * as fs from "node:fs";
import * as path from "node:path";

const RPC = process.env.GALILEO_RPC_URL ?? "https://evmrpc-testnet.0g.ai";
const WALLETS_FILE = path.resolve("scripts/wallets.json");

if (!fs.existsSync(WALLETS_FILE)) {
  console.error(`scripts/wallets.json not found. Run \`npx tsx scripts/generate-wallets.ts\` first.`);
  process.exit(1);
}
const wallets = JSON.parse(fs.readFileSync(WALLETS_FILE, "utf8")) as Array<{
  address: string;
  privateKey: string;
}>;

const provider = new ethers.JsonRpcProvider(RPC);

let total = 0n;
const rows: Array<{ idx: number; address: string; balance: string; raw: bigint }> = [];
for (const [i, w] of wallets.entries()) {
  try {
    const bal = await provider.getBalance(w.address);
    total += bal;
    rows.push({ idx: i + 1, address: w.address, balance: ethers.formatEther(bal), raw: bal });
  } catch (e) {
    rows.push({ idx: i + 1, address: w.address, balance: "ERROR: " + (e as Error).message, raw: 0n });
  }
}

console.log(`\n0G Galileo balances (RPC ${RPC}):\n`);
for (const r of rows) {
  console.log(`  #${r.idx} ${r.address}  →  ${r.balance} OG`);
}
const totalOg = Number(ethers.formatEther(total));
console.log(`\n  total: ${ethers.formatEther(total)} OG`);

if (totalOg >= 5.0) {
  console.log(`\n✅ Ready to go - you have at least 5 OG.`);
  console.log(`   Move it all onto PRIMARY_PRIVATE_KEY and run the live smoke test.`);
  console.log(`   The first run will spend ~4 OG on the broker (addLedger + transferFund)`);
  console.log(`   and ~1 OG on storage uploads, deploys, and settlement gas.`);
} else if (totalOg >= 4.0) {
  console.log(`\n⚠️  Just barely - ${totalOg.toFixed(2)} OG.`);
  console.log(`   That covers the one-shot broker init, but leaves no headroom.`);
  console.log(`   Any retry or contract deploy will hit zero.`);
  console.log(`   Strongly recommend a Discord top-up first (see scripts/funding-log.md).`);
} else {
  console.log(`\n⏳ Still short - ${totalOg.toFixed(2)} OG of the 4 OG minimum.`);
  console.log(`   The 0G InferenceServing contract requires at least 3 OG on addLedger;`);
  console.log(`   anything less will revert. Faucets alone give about 3 OG per day`);
  console.log(`   across five wallets. The fastest path is the Discord template in`);
  console.log(`   scripts/funding-log.md - the 0G docs route bigger asks there directly.`);
}
