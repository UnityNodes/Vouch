import path from "node:path";
import dotenv from "dotenv";
import { MONAD_TESTNET } from "@agentcheckout/shared";
import { makeClients } from "./viem";
import { createFacilitatorApp } from "./server";

// load env from cwd and from monorepo root (first wins; dotenv never overrides)
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), "..", "..", ".env") });

export { makeClients } from "./viem";
export { createFacilitatorApp } from "./server";
export { verifyPayment } from "./verify";
export { settlePayment } from "./settle";

function start() {
  const port = Number(process.env.FACILITATOR_PORT ?? 4021);
  const rpcUrl = process.env.MONAD_RPC_URL ?? MONAD_TESTNET.defaultRpcUrl;
  const chainId = Number(process.env.MONAD_CHAIN_ID ?? MONAD_TESTNET.chainId);
  const network = process.env.SETTLEMENT_NETWORK ?? MONAD_TESTNET.slug;
  const privateKey = process.env.FACILITATOR_PRIVATE_KEY;

  const clients = makeClients({ rpcUrl, chainId, privateKey });
  const app = createFacilitatorApp(clients, network);
  app.listen(port, () => {
    console.log(`[facilitator] listening on :${port}  network=${network} chainId=${chainId}`);
    console.log(`[facilitator] rpc=${rpcUrl}`);
    console.log(`[facilitator] wallet=${clients.account?.address ?? "(none - settle disabled until FACILITATOR_PRIVATE_KEY set)"}`);
  });
}

// run only when executed directly (not when imported by the e2e harness)
const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}`;
if (isDirectRun) start();
