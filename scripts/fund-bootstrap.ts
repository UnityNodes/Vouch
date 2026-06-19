/**
 * Read balances of all 5 funding wallets. Print sum.
 * Run: `pnpm fund:balances` (or `npx tsx scripts/fund-bootstrap.ts`)
 *
 * Decision rule:
 *   - sum >= 5 OG → ready for Phase 3 DAY-1 GATE (live broker init)
 *   - sum >= 3 OG → can call addLedger(3) but no buffer
 *   - sum  < 3 OG → keep dripping faucet + Discord escalation
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

if (totalOg >= 5) {
  console.log(`\n✅ READY — sum ≥ 5 OG. Consolidate onto PRIMARY_PRIVATE_KEY and proceed to Phase 3 DAY-1 GATE.`);
} else if (totalOg >= 3) {
  console.log(`\n⚠️  USABLE — sum ≥ 3 OG (no buffer). Can run addLedger(3) but transferFund will need top-up.`);
} else {
  console.log(`\n⏳ KEEP DRIPPING — sum ${ethers.formatEther(total)} OG < 3 OG. Continue faucet + Discord escalation.`);
  console.log(`   Faucet: https://faucet.0g.ai (0.1 OG/wallet/day)`);
}
