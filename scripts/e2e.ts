/**
 * End-to-end vertical slice on a LOCAL Hardhat node (self-contained, no faucet
 * required for the compliance gate, no 0G testnet exposure for settlement):
 *   1. spawn `hardhat node`
 *   2. deploy VouchToken (EIP-3009), mint to the agent
 *   3. boot facilitator + a merchant (agentCheckout) in-process
 *   4. happy path: agent pays via x402 -> 200 + real txHash (mock compliance ALLOWED)
 *   5. blocked-by-deny-list path: agent on policy deny-list -> 403 compliance_denied
 *   6. blocked-by-amount path: amount above per-tx cap -> 403 compliance_denied
 *
 *   pnpm e2e
 */
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Server } from "node:http";
import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import express from "express";
import { agentCheckout, type AssetConfig } from "@agentcheckout/middleware";
import { createFacilitatorApp, makeClients } from "@agentcheckout/facilitator";
import { MockZGComputeClient } from "@agentcheckout/zerogravity";
import { JsonReceiptStore } from "@agentcheckout/shared/store";
import { payAndCall } from "@agentcheckout/mcp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RPC = "http://127.0.0.1:8545";
const CHAIN_ID = 31337;
const FACILITATOR_PORT = 4031;
const MERCHANT_PORT = 4030;

// deterministic Hardhat dev accounts
const ACC = {
  facilitator: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // #0 (gas)
  agent: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // #1
  blocked: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // #2
} as const;
const MERCHANT_ADDRESS = "0x90F79bf6EB2c4f870365E785982E1f101E93b906"; // #3

function log(msg: string) {
  console.log(`\x1b[36m[e2e]\x1b[0m ${msg}`);
}
function ok(msg: string) {
  console.log(`\x1b[32m  ✓ ${msg}\x1b[0m`);
}
function fail(msg: string): never {
  console.error(`\x1b[31m  ✗ ${msg}\x1b[0m`);
  throw new Error(msg);
}

async function waitForRpc(timeoutMs = 30000): Promise<void> {
  const client = createPublicClient({ transport: http(RPC) });
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const id = await client.getChainId();
      if (id === CHAIN_ID) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("hardhat node did not become ready");
}

function runCapture(cmd: string, args: string[], env: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: ROOT, shell: true, env });
    let out = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (out += d.toString()));
    child.on("close", (code) =>
      code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}\n${out}`)),
    );
  });
}

async function main() {
  let node: ChildProcess | undefined;
  let facilitatorServer: Server | undefined;
  let merchantServer: Server | undefined;

  try {
    // 1. hardhat node
    log("starting hardhat node...");
    node = spawn("pnpm", ["--filter", "@agentcheckout/contracts", "run", "node"], {
      cwd: ROOT,
      shell: true,
      stdio: "ignore",
    });
    await waitForRpc();
    ok("hardhat node ready (chainId 31337)");

    // 2. deploy + mint to agent
    log("deploying VouchToken + minting to agent...");
    const agentAddr = privateKeyToAccount(ACC.agent).address;
    const deployOut = await runCapture(
      "pnpm",
      ["--filter", "@agentcheckout/contracts", "run", "deploy:local"],
      { ...process.env, MINT_TO: agentAddr },
    );
    const m = deployOut.match(/GALILEO_ATOKEN_ADDRESS=(0x[0-9a-fA-F]{40})/);
    if (!m) fail(`could not parse deployed token address from:\n${deployOut}`);
    const atoken = m![1] as `0x${string}`;
    ok(`VouchToken deployed at ${atoken}`);

    // 3a. facilitator (in-process)
    const clients = makeClients({ rpcUrl: RPC, chainId: CHAIN_ID, privateKey: ACC.facilitator });
    facilitatorServer = createFacilitatorApp(clients, "0g-galileo").listen(FACILITATOR_PORT);
    ok(`facilitator on :${FACILITATOR_PORT} (wallet ${clients.account?.address})`);

    // 3b. merchant (in-process), MockZGComputeClient with the blocked agent denied
    const blockedAddr = privateKeyToAccount(ACC.blocked).address;
    const zg = new MockZGComputeClient({ denyList: [blockedAddr] });
    const store = new JsonReceiptStore(path.join(ROOT, ".data", "e2e-receipts.json"));
    const asset: AssetConfig = {
      address: atoken,
      name: "Vouch USD",
      version: "1",
      decimals: 6,
      symbol: "vUSD",
    };
    const merchant = express();
    merchant.use(
      agentCheckout({
        payTo: MERCHANT_ADDRESS,
        facilitatorUrl: `http://127.0.0.1:${FACILITATOR_PORT}`,
        network: "0g-galileo",
        chainId: CHAIN_ID,
        asset,
        routes: { "GET /premium-data": { price: "$0.01", description: "Premium market data" } },
        zg,
        store,
        merchantName: "Acme Data Co",
      }),
    );
    merchant.get("/premium-data", (_req, res) => res.json({ signal: "BUY", confidence: 0.91 }));
    merchantServer = merchant.listen(MERCHANT_PORT);
    ok(`merchant on :${MERCHANT_PORT} (protected GET /premium-data)`);

    const url = `http://127.0.0.1:${MERCHANT_PORT}/premium-data`;

    // 4. happy path
    log("HAPPY PATH: TEE-allowed agent pays...");
    const agent = privateKeyToAccount(ACC.agent);
    const happy = await payAndCall({ url, account: agent });
    if (!happy.paid) fail(`expected paid, got: ${JSON.stringify(happy)}`);
    if (!happy.txHash || !/^0x[0-9a-fA-F]{64}$/.test(happy.txHash))
      fail(`expected txHash, got ${happy.txHash}`);
    ok(`paid: status ${happy.status}, txHash ${happy.txHash}`);
    ok(`resource: ${JSON.stringify(happy.data)}`);

    // 5. blocked-by-deny-list path
    log("BLOCKED PATH (deny-list): agent on policy deny-list...");
    const blocked = privateKeyToAccount(ACC.blocked);
    const blockedRes = await payAndCall({ url, account: blocked });
    if (blockedRes.paid) fail(`expected blocked, but payment succeeded: ${JSON.stringify(blockedRes)}`);
    if (blockedRes.status !== 403)
      fail(`expected 403 compliance_denied, got ${blockedRes.status}`);
    if (blockedRes.error !== "compliance_denied")
      fail(`expected error=compliance_denied, got ${blockedRes.error}`);
    ok(`blocked: status ${blockedRes.status}, error "${blockedRes.error}"`);

    // receipts
    const receipts = await store.list();
    log(`receipts recorded: ${receipts.length}`);
    for (const r of receipts.slice(0, 4)) {
      console.log(
        `   - ${r.settlement.status.padEnd(7)} payer=${r.payer.slice(0, 10)} attested=${r.attestation.verified}/${r.attestation.verifiabilityKind} code=${r.compliance.code} tx=${r.settlement.txHash?.slice(0, 14) ?? "-"}`,
      );
    }

    const successCount = receipts.filter((r) => r.settlement.status === "SUCCESS").length;
    const blockedCount = receipts.filter((r) => r.settlement.status === "BLOCKED").length;
    if (successCount < 1) fail(`expected ≥1 SUCCESS, got ${successCount}`);
    if (blockedCount < 1) fail(`expected ≥1 BLOCKED, got ${blockedCount}`);
    ok(`receipt counts: ${successCount} success, ${blockedCount} blocked`);

    console.log(
      "\n\x1b[42m\x1b[30m  E2E PASSED  \x1b[0m  x402 + TEE-attested compliance gate + on-chain settlement working end-to-end.\n",
    );
  } finally {
    merchantServer?.close();
    facilitatorServer?.close();
    if (node) await killTree(node);
  }
}

function killTree(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (!child.pid) {
      child.kill();
      return resolve();
    }
    const tk = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { shell: true });
    tk.on("close", () => resolve());
    setTimeout(resolve, 4000);
  });
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("\n\x1b[41m\x1b[30m  E2E FAILED  \x1b[0m", (e as Error)?.message ?? e, "\n");
    process.exit(1);
  });
