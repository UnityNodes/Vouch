/**
 * One-shot: generate 5 EOA keypairs into scripts/wallets.json (gitignored).
 * Run: `npx tsx scripts/generate-wallets.ts`
 *
 * After running, request faucet at https://faucet.0g.ai for each address.
 * Track times in scripts/funding-log.md.
 */
import { ethers } from "ethers";
import * as fs from "node:fs";
import * as path from "node:path";

const OUT = path.resolve("scripts/wallets.json");
if (fs.existsSync(OUT)) {
  console.error(`scripts/wallets.json already exists. Refusing to overwrite.`);
  console.error(`Delete it first if you want to regenerate (will LOSE existing keys).`);
  process.exit(1);
}

const wallets = Array.from({ length: 5 }, () => {
  const w = ethers.Wallet.createRandom();
  return { address: w.address, privateKey: w.privateKey };
});

fs.writeFileSync(OUT, JSON.stringify(wallets, null, 2));
console.log(`Wrote ${wallets.length} wallets → ${OUT}`);
console.log("\nAddresses (request faucet for each at https://faucet.0g.ai):\n");
for (const [i, w] of wallets.entries()) {
  console.log(`  ${i + 1}. ${w.address}`);
}
console.log("\nNext steps:");
console.log("  1. Open https://faucet.0g.ai , request 0.1 OG per address (max once per 24h each).");
console.log("  2. Post in 0G Discord/Telegram for ~5 OG topup on address #1 (see scripts/funding-log.md).");
console.log("  3. Run `pnpm fund:balances` daily to track accumulation.");
