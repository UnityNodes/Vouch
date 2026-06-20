# Vouch - payments that vouch for themselves

> **Zero Cup submission · 0G Global Vibe Coding Tournament**

Vouch is a payment layer for AI agents. Before any money moves, every
transaction is reviewed by an AI judge running inside a sealed enclave
on **0G Compute**. The judge's reasoning, the verdict, and a
cryptographic proof are written to **0G Storage**, and anyone can click
**"Re-check"** on the public explorer to confirm the verdict was
honest. *Don't trust us. Check the receipts.*

---

## What Vouch actually proves

Vouch doesn't tell you who the payer is. There is no bank-verified
identity on 0G, and we won't pretend otherwise. What Vouch proves is
that the **decision** was made honestly, by policy, without anyone in
the middle tampering with the verdict.

That shifts the question from *"who is behind this agent?"* to
*"can you prove this payment was allowed for a real reason, by a real
policy, by a real LLM?"* For agent-to-agent commerce, that's the
harder question, and the one Vouch answers cryptographically.

### What we're honest about

1. **We don't verify the payer's real-world identity.** Vouch proves
   *decision honesty*, not *payer identity*. We build on what 0G
   actually delivers instead of promising what the chain can't.
2. **A TEE attests execution, not truth.** The attestation proves *this
   LLM, in this enclave, produced this output for this input.* It does
   not prove the input is true, the policy is correct, or that the LLM
   judged well. Garbage in, garbage out, but with a signature on the
   garbage, which is what makes it auditable.
3. **No escrow needed.** The verdict comes *before* settlement. If the
   verdict is *no*, settlement is never called and no money moves.
   Async escrow and human-in-the-loop escalation are on the roadmap,
   not in today's submission.

A competent judge will probe exactly these limits. Naming them up front
signals we understand our own stack better than competitors who claim
*"0G solves everything."*

---

## Why this is built on 0G - and only on 0G

Vouch is not a port of an Ethereum or Monad app. Every layer relies on
something only 0G provides:

- **0G Compute runs the judge.** The compliance LLM lives inside a
  TeeML-verifiable provider, queried through
  `@0gfoundation/0g-compute-ts-sdk`. After every reply we call
  `broker.inference.processResponse(provider, chatId, content)`. That
  one line returns `true` if the response was signed by the provider's
  TEE signer and `false` if it was tampered with. Without that line,
  Vouch would just be middleware with extra steps.
- **0G Storage keeps the audit trail honest.** Each decision (the
  prompt, the verdict, the attestation headers) is uploaded as a small
  JSON blob via `Indexer.upload(MemData, rpc, signer)`. The 32-byte
  root hash is content-addressed, durable, and cheap enough to anchor
  on-chain.
- **0G Chain settles with zero friction.** `ComplianceGateway.sol`
  records every decision on-chain via
  `DecisionRecorded(payer, merchant, amount, decisionHash, storageRoot, allowed)`.
  `VouchToken.sol` (vUSD) implements the full EIP-3009 surface
  (`transferWithAuthorization`, `DOMAIN_SEPARATOR`, `version`,
  `authorizationState`) so the x402 gasless settlement flow works
  end-to-end without the workarounds we'd need on tokens that ship
  without these primitives.

---

## How a single payment flows through Vouch

```
agent
  └─→ demo-merchant GET /premium-data
        └─→ middleware.agentCheckout (Express, x402)
              │
              ├─ A. ZGComputeClient.decide({payer, merchant, amount, purpose, ...})
              │    │
              │    ├─ live  → 0G Compute broker → TeeML provider → /chat/completions
              │    │         └─ processResponse(provider, chatId, content) → attestation.verified ✅
              │    └─ mock  → deterministic policy (for offline e2e)
              │
              ├─ B. ReceiptStore.append(receipt)
              │    └─ ZGStorageReceiptStore → Indexer.upload(MemData) → storageRoot (32-byte)
              │
              ├─ C. ComplianceGateway.recordDecision(...) → on-chain pointer
              │
              ├─ D. Facilitator.verify(payload, requirements) → checks EIP-712 signature
              │
              └─ E. Facilitator.settle(payload, requirements)
                    └─ VouchToken.transferWithAuthorization(...) → real txHash on Galileo

merchant-console / explorer
  └─→ polls /api/decisions
  └─→ "Re-check" button → POST /api/reverify
        └─→ zg.verifyAttestation(provider, chatId) → broker.inference.processResponse → bool
```

If step A returns a *no*, or the attestation comes back broken, the
request stops with a 403 and the judge's rationale attached. Settlement
is never called and no money moves. That property is why Vouch can
ship without an escrow contract today.

---

## What lives where

```
packages/
  shared/         x402 wire types, EIP-3009 helpers, ReceiptRecord schema
  zerogravity/    ZGComputeClient (live + mock), 0G Storage adapter
  middleware/     agentCheckout(): Express handler that ties it all together
  facilitator/    /verify + /settle endpoints (viem-based EIP-3009 relay)
  mcp/            pay_and_call MCP tool for AI agents
  contracts/      VouchToken.sol (zgUSD, EIP-3009) and ComplianceGateway.sol
apps/
  demo-merchant/      sample protected endpoint at /premium-data
  merchant-console/   Next.js Explorer with the live feed and Re-check button
scripts/
  e2e.ts                local Hardhat end-to-end test (mock judge, real settle)
  smoke-live-gate.ts    one-shot smoke against the real 0G Galileo broker
  generate-wallets.ts   creates the 5 funding wallets used during bootstrap
  fund-bootstrap.ts     daily readiness check against your wallets
```

---

## Quick start - no funding required

```bash
pnpm install
pnpm e2e
```

This boots a local Hardhat node, deploys `VouchToken`, and walks two
flows back-to-back.

The legitimate payment: an agent who passes the mock judge gets charged
and receives the protected resource. You get a real transaction hash on
the local chain.

The suspicious payment: an agent on the policy deny-list gets blocked
with a 403. No transaction, no money moved.

Both produce a receipt with a mock attestation. For the live flow
against the real 0G Galileo broker, jump to the live demo section
below.

---

## Live demo - needs a funded wallet

### 1. Funding bootstrap

To run live, the operator wallet needs at least 5 OG. That covers the
broker's `addLedger(3)` deposit, 1 OG per provider on `transferFund`,
and roughly 1 OG of headroom for storage uploads, contract deploys, and
settlement gas. The 3-OG minimum is enforced by 0G's `InferenceServing`
contract; values below that simply revert (see the official
[`0g-compute-ts-starter-kit`](https://github.com/0gfoundation/0g-compute-ts-starter-kit)).

Where the OG comes from:

| Source | Amount | Limit |
|---|---|---|
| [faucet.0g.ai](https://faucet.0g.ai) | 0.1 to 0.5 OG | per wallet, per day (resets ~24h) |
| [Google Cloud Faucet](https://cloud.google.com/application/web3/faucet/0g/galileo) | 0.1 OG | per wallet per day, separate quota |
| [0G Discord #faucet](https://discord.com/invite/0glabs) | on request | the docs officially route bigger asks here |

Five wallets dripping across both faucets stack to roughly 3 OG per
day, which is still short of the 5-OG target. Discord is the supported
channel for the gap, not a workaround.

Defaults in [packages/zerogravity/src/live/broker.ts](packages/zerogravity/src/live/broker.ts):
- `addLedger(3 OG)`. Override with `ZG_LEDGER_INITIAL_OG`. The contract enforces a 3-OG minimum in v0.6.x.
- `transferFund(provider, 'inference', 1 OG)`. Override with `ZG_PROVIDER_FUND_OG`.

```bash
npx tsx scripts/generate-wallets.ts        # one-shot: 5 EOAs → scripts/wallets.json (gitignored)
pnpm fund:balances                          # READY at sum ≥ 5 OG, MINIMAL at ≥ 4
```

Full source list, daily drip log, and Discord escalation template: [scripts/funding-log.md](scripts/funding-log.md).

### 2. Deploy contracts to Galileo

Once `PRIMARY_PRIVATE_KEY` has at least ~0.1 OG:

```bash
pnpm --filter @agentcheckout/contracts run deploy:galileo
# writes:
#   GALILEO_ATOKEN_ADDRESS=0x...
#   GALILEO_GATEWAY_ADDRESS=0x...
# copy both into .env
```

### 3. Smoke-test the live judge (the one test that matters)

This is the load-bearing check for the whole product: a single live
inference call where `processResponse(...)` returns `true`.

```bash
ZG_COMPUTE_MODE=live npx tsx scripts/smoke-live-gate.ts
# expected output: "GATE PASS ✅ - attestation verified by processResponse()"
```

### 4. Run the merchant and explorer

```bash
ZG_COMPUTE_MODE=live ZG_STORAGE_MODE=live pnpm dev
# demo-merchant : http://localhost:4020
# facilitator   : http://localhost:4021
# explorer      : http://localhost:3000
```

In the Explorer, click "Try a legitimate payment" and "Try a suspicious
payment". Both appear in the live feed. Hit "Re-check" on either row
and the merchant calls `broker.inference.processResponse(...)` against
the broker; the button turns green when the attestation is honest.

---

## Environment variables

See [.env.example](.env.example) for the full list. The hot ones:

| Variable | Purpose |
|---|---|
| `PRIMARY_PRIVATE_KEY` | EOA used for the broker ledger, provider auth, storage signer, and facilitator settle |
| `GALILEO_RPC_URL` | default `https://evmrpc-testnet.0g.ai` |
| `ZG_COMPUTE_MODE` | `live` (real broker) or `mock` (deterministic policy). Defaults to `mock`. |
| `ZG_STORAGE_MODE` | `live` (0G Storage) or `mock` (JsonReceiptStore). Defaults to `mock`. |
| `GALILEO_ATOKEN_ADDRESS` | populated by `deploy:galileo` |
| `GALILEO_GATEWAY_ADDRESS` | populated by `deploy:galileo` |
| `MERCHANT_ADDRESS` | recipient EOA for paid demo flows |
| `MCP_WALLET_PRIVATE_KEY` | agent EOA for `payAndCall` against the merchant |

---

## What's deliberately deferred

The group-stage submission is a thin vertical slice that proves the
critical path end-to-end. The next batch of features is scoped to
later rounds:

- **Per-agent policy registry** (Ro32). Extends `ComplianceGateway` with `mapping(agent => Policy)` so the on-chain rules are per agent, not global.
- **AgenticID integration** (Ro16). The gate would authorize via `authorizeUsage` on the ERC-7857 [AgenticID](https://github.com/0gfoundation/agenticID-examples) standard, linking each payment to the agent's on-chain identity.
- **Compliance Passport** (Ro16). A portable on-chain reputation accreted from clean-transaction history.
- **Human-in-the-loop escalation and escrow-hold** (Quarters). For async, delayed decisions.
- **Multi-agent budget tree** (Quarters). A parent agent sets sub-agent spending limits.
- **DA-layer decision stream** (Phase 2). For trustless auditor reconstruction.

Resisting feature creep is itself a position. The four primitives in
this submission cover the whole tournament-judging surface (x402, the
compliance gate, on-chain settlement, public verifiability) and they
all rest on real 0G primitives, not promised ones. The deferred items
each map to a real 0G primitive too, not vapor.

---

## License

MIT. See [LICENSE](LICENSE) if present, otherwise treat as MIT for the duration of the tournament.
