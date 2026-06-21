/**
 * On-chain anchor for a live compliance decision.
 *
 * Writes the decision (hash + allowed bit) to ComplianceGateway on 0G Galileo
 * so the "On-chain receipt" in the explorer is a real, clickable transaction -
 * even for BLOCKED payments. Uses viem with the merchant key.
 *
 * We do NOT wait for the receipt: writeContract returns the tx hash as soon as
 * the tx is broadcast, which is all the UI needs for a chainscan link, and the
 * Galileo RPC is slow/flaky about receipt polling. The tx confirms within a few
 * seconds on its own.
 */
import {
  createWalletClient,
  defineChain,
  http,
  parseAbi,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC = process.env.GALILEO_RPC_URL ?? "https://evmrpc-testnet.0g.ai";
const CHAIN_ID = Number(process.env.GALILEO_CHAIN_ID ?? 16602);
const EXPLORER = (process.env.GALILEO_EXPLORER_URL ?? "https://chainscan-galileo.0g.ai").replace(/\/$/, "");
const ZERO32 = ("0x" + "0".repeat(64)) as Hex;

const galileo = defineChain({
  id: CHAIN_ID,
  name: "0G Galileo",
  nativeCurrency: { name: "OG", symbol: "OG", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

const abi = parseAbi([
  "function recordDecision(address payer,address merchant,uint256 amount,bytes32 decisionHash,bytes32 storageRoot,bool allowed)",
]);

export interface AnchorInput {
  payer: string;
  merchant: string;
  amount: string;
  decisionHash: string;
  allowed: boolean;
}

export interface AnchorResult {
  txHash: string;
  explorerUrl: string;
}

export async function anchorDecision(input: AnchorInput): Promise<AnchorResult> {
  const pk = process.env.PRIMARY_PRIVATE_KEY as Hex | undefined;
  const gateway = process.env.GALILEO_GATEWAY_ADDRESS as Hex | undefined;
  if (!pk || pk.length < 64) throw new Error("PRIMARY_PRIVATE_KEY missing");
  if (!gateway) throw new Error("GALILEO_GATEWAY_ADDRESS missing");

  const account = privateKeyToAccount(pk);
  const wallet = createWalletClient({ account, chain: galileo, transport: http(RPC) });

  const txHash = await wallet.writeContract({
    address: gateway,
    abi,
    functionName: "recordDecision",
    args: [
      input.payer as Hex,
      input.merchant as Hex,
      BigInt(input.amount),
      input.decisionHash as Hex,
      ZERO32,
      input.allowed,
    ],
  });

  return { txHash, explorerUrl: `${EXPLORER}/tx/${txHash}` };
}
