import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type PublicClient,
  type WalletClient,
  type Account,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

export interface FacilitatorClients {
  chainId: number;
  publicClient: PublicClient;
  walletClient?: WalletClient;
  account?: Account;
}

export function makeClients(opts: { rpcUrl: string; chainId: number; privateKey?: string }): FacilitatorClients {
  const chain = defineChain({
    id: opts.chainId,
    name: `chain-${opts.chainId}`,
    nativeCurrency: { name: "Native", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [opts.rpcUrl] } },
  });

  const publicClient = createPublicClient({ chain, transport: http(opts.rpcUrl) }) as PublicClient;

  let walletClient: WalletClient | undefined;
  let account: Account | undefined;
  if (opts.privateKey) {
    const pk = opts.privateKey.startsWith("0x") ? opts.privateKey : `0x${opts.privateKey}`;
    account = privateKeyToAccount(pk as `0x${string}`);
    walletClient = createWalletClient({ account, chain, transport: http(opts.rpcUrl) });
  }

  return { chainId: opts.chainId, publicClient, walletClient, account };
}
