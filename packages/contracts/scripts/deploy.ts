import hre from "hardhat";
import { parseUnits, formatEther } from "viem";

/**
 * Deploy MockAToken (EIP-3009) to the selected network and optionally mint to
 * demo addresses. Usage:
 *   pnpm --filter @agentcheckout/contracts run deploy:monad
 *   pnpm --filter @agentcheckout/contracts run deploy:local
 *
 * Env: DEPLOYER_PRIVATE_KEY (for monad), MINT_TO (comma-separated addresses).
 */
async function main() {
  const name = process.env.MOCK_ATOKEN_NAME ?? "AgentCheckout Mock aUSDC";
  const symbol = process.env.MOCK_ATOKEN_SYMBOL ?? "acAUSDC";
  const decimals = Number(process.env.MOCK_ATOKEN_DECIMALS ?? 6);

  const [wallet] = await hre.viem.getWalletClients();
  const pub = await hre.viem.getPublicClient();
  if (wallet) {
    const bal = await pub.getBalance({ address: wallet.account.address });
    console.log(`deployer: ${wallet.account.address}  balance: ${formatEther(bal)} MON`);
  }

  const token = await hre.viem.deployContract("MockAToken", [name, symbol, decimals]);
  console.log(`\nMockAToken deployed at: ${token.address}`);
  console.log(`  name=${name} symbol=${symbol} decimals=${decimals}`);

  const mintTo = (process.env.MINT_TO ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as `0x${string}`[];

  for (const addr of mintTo) {
    const amount = parseUnits("1000", decimals);
    const hash = await token.write.mint([addr, amount]);
    await pub.waitForTransactionReceipt({ hash });
    console.log(`  minted 1000 ${symbol} -> ${addr}`);
  }

  console.log(`\n👉 Add to .env:  MOCK_ATOKEN_ADDRESS=${token.address}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
