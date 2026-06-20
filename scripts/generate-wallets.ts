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
console.log(`Wrote ${wallets.length} fresh wallets to ${OUT}.`);
console.log("\nAddresses to drip - paste each into https://faucet.0g.ai:\n");
for (const [i, w] of wallets.entries()) {
  console.log(`  ${i + 1}. ${w.address}`);
}
console.log("\nWhat to do next:");
console.log("  1. Open https://faucet.0g.ai and request testnet OG for each address.");
console.log("     (The faucet rate-limits per wallet per day, so spread the drips out.)");
console.log("  2. For the bigger top-up, post in 0G Discord - the template is in");
console.log("     scripts/funding-log.md. Ask to land it on address #1.");
console.log("  3. Run `pnpm fund:balances` daily to see how close you are to the 5 OG target.");
