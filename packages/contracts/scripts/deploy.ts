import hre from "hardhat";
import { parseUnits, formatEther } from "viem";

/**
 * Deploy AgentCheckoutToken (EIP-3009 acUSD) + ComplianceGateway and optionally
 * mint to demo addresses. Networks:
 *   pnpm --filter @agentcheckout/contracts run deploy:galileo   (0G Galileo)
 *   pnpm --filter @agentcheckout/contracts run deploy:local     (hardhat node)
 *
 * Env: DEPLOYER_PRIVATE_KEY / PRIMARY_PRIVATE_KEY (for galileo),
 *      MINT_TO (comma-separated addresses).
 */
async function main() {
  const [wallet] = await hre.viem.getWalletClients();
  const pub = await hre.viem.getPublicClient();
  if (wallet) {
    const bal = await pub.getBalance({ address: wallet.account.address });
    console.log(`deployer: ${wallet.account.address}  balance: ${formatEther(bal)} OG`);
  }

  // 1. AgentCheckoutToken
  const token = await hre.viem.deployContract("AgentCheckoutToken", []);
  console.log(`\nAgentCheckoutToken (acUSD) deployed at: ${token.address}`);

  const mintTo = (process.env.MINT_TO ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as `0x${string}`[];

  for (const addr of mintTo) {
    const amount = parseUnits("1000", 6);
    const hash = await token.write.mint([addr, amount]);
    await pub.waitForTransactionReceipt({ hash });
    console.log(`  minted 1000 acUSD -> ${addr}`);
  }

  // 2. ComplianceGateway
  const gateway = await hre.viem.deployContract("ComplianceGateway", []);
  console.log(`ComplianceGateway deployed at: ${gateway.address}`);

  console.log("\n👉 Add to .env:");
  console.log(`GALILEO_ATOKEN_ADDRESS=${token.address}`);
  console.log(`GALILEO_GATEWAY_ADDRESS=${gateway.address}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
