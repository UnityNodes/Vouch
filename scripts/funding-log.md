# 0G Galileo testnet funding - log

Chain ID **16602**, RPC `https://evmrpc-testnet.0g.ai`, explorer `https://chainscan-galileo.0g.ai`.

## The hard requirement

The `InferenceServing` contract (per the official [`0g-compute-ts-starter-kit` README](https://github.com/0gfoundation/0g-compute-ts-starter-kit)) **requires 3 OG minimum** to call `addLedger`. Anything lower reverts. Plus 1 OG per provider sub-account on `transferFund`. So the realistic budget is:

| Step | Cost |
|---|---|
| `addLedger(3)` - broker ledger init | 3.0 OG |
| `transferFund(provider, 'inference', 1)` | 1.0 OG |
| Gas for both txs + ack + smoke | ~0.01 OG |
| Deploy `AgentCheckoutToken` + `ComplianceGateway` | ~0.05 OG |
| Storage uploads (~10 demo receipts) | ~0.1 OG |
| Settlement EIP-3009 transactions | ~0.05 OG |
| **Sane buffer for retries** | ~0.8 OG |
| **Realistic minimum on `PRIMARY_PRIVATE_KEY`** | **~5 OG** |

## Funding sources (all official)

| # | Source | Amount | Limit | Auth |
|---|---|---|---|---|
| 1 | [faucet.0g.ai](https://faucet.0g.ai) | 0.1-0.5 OG | **per wallet per day** (resets ~24h) | Twitter/X or GitHub |
| 2 | [Google Cloud Faucet](https://cloud.google.com/application/web3/faucet/0g/galileo) | 0.1 OG | per wallet per day, separate quota | Google account |
| 3 | [0G Discord #faucet](https://discord.com/invite/0glabs) | **on request** | the docs explicitly direct here for >0.1 OG/day | Discord |
| 4 | [faucet.trade](https://faucet.trade/0g-galileo-testnet-0g-faucet) | 0.005-0.02 OG | per day, Twitter follow required | not worth the work |

> Faucets across 5 wallets give ~3 OG/day max. To hit the 5-OG threshold cleanly **you will need Discord**. Don't treat it as a fallback - it's the supported channel for amounts > 0.1 OG/day.

## Wallets (5 EOAs from `scripts/generate-wallets.ts`)

| # | Address | Private key |
|---|---|---|
| 1 | 0xEF6B3bfE14Fb5210d481F80a4Cd0434cA9c12257 | `scripts/wallets.json` |
| 2 | 0x04b055189aF9808920d4869Cb5225700dDAd5932 | `scripts/wallets.json` |
| 3 | 0x5f2663777797b0eEe5F1bF7A653802d2B70C67D4 | `scripts/wallets.json` |
| 4 | 0x3F9eCe28BFf7b9043f08967CDbf71de86541b3a6 | `scripts/wallets.json` |
| 5 | 0x9d4B7a19342e22769f2FaBED939dD9334d6cb25c | `scripts/wallets.json` |

After collecting, consolidate onto wallet #1 - it becomes `PRIMARY_PRIVATE_KEY` in `.env`.

## Daily drip log

| Date (UTC) | Source | #1 | #2 | #3 | #4 | #5 | Total this round |
|---|---|---|---|---|---|---|---|
| YYYY-MM-DD | faucet.0g.ai | ✅ 0.5 | ✅ 0.5 | ✅ 0.5 | ✅ 0.5 | ✅ 0.5 | 2.5 OG |
| YYYY-MM-DD | Google Cloud | ✅ 0.1 | ✅ 0.1 | ✅ 0.1 | ✅ 0.1 | ✅ 0.1 | +0.5 OG |

## Discord escalation template (paste this - verbatim)

Post in `#hackathon` / `#zero-cup` / `#faucet` on [discord.com/invite/0glabs](https://discord.com/invite/0glabs):

> Hi 👋 - I'm a Zero Cup participant building **Vouch**, a payment layer for AI agents where every transaction is reviewed by a TEE-attested judge on 0G Compute. To run the live flow I need to call `addLedger(3)` and `transferFund(1)` plus a small gas buffer - roughly **5 OG** total. Faucets across 5 wallets get me to ~3 OG/day, so I'm about 2 OG short. Could you top up `0xEF6B3bfE14Fb5210d481F80a4Cd0434cA9c12257`? The repo will be public at submission. Thank you! 🙏

| Date | Channel | Outcome |
|---|---|---|
|  | Discord #faucet |  |
|  | Discord #hackathon / #zero-cup |  |
|  | Discord judge/organizer DM |  |
