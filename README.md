# AgentCheckout 0G — TEE-attested compliance gateway for AI-agent payments

> **Zero Cup submission · 0G Global Vibe Coding Tournament**

A payment gateway where every transaction is gated by a compliance LLM running inside a **0G Compute TEE**, the full audit trail lives on **0G Storage**, and the on-chain pointer is anchored on **0G Chain (Galileo)**. Anyone can click **"Verify"** on the public explorer and re-check the attestation themselves — **"trust us" becomes "verify yourself."**

---

## What this proves (and what it does not)

The product makes the *payment decision* provable. The question shifts from "who owns this agent?" to "can you prove this payment was allowed honestly, by policy, without tampering?"

### Three honest limits (state them before a judge asks)

1. **Identity:** we prove *decision honesty*, not *payer identity*. There is no bank-verified identity on 0G. This is a deliberate shift — building on 0G's actual stack rather than promising what the chain can't deliver.
2. **Input integrity:** the TEE-attestation proves that THIS LLM in THIS enclave produced THIS output for THIS input. It does **not** prove the input is true, that the policy is correct, or that the LLM judged well. Execution honesty is guaranteed; input honesty is a separate layer (Phase 2 — signed/oracle-fed input).
3. **No escrow-hold:** the decision is made *before* settle. If decision = NO, settle is never called and no money moves. Async escrow + human-in-the-loop are Phase 2.

These are the limits a competent technical judge will probe. Surfacing them up front signals you understand your own stack better than competitors who claim "0G solves everything."

---

## Why 0G and not a redeploy of an EVM clone

This is **not** a port of an existing Monad/Ethereum app. It uses 0G's actual primitives:

- **0G Compute (TEE inference).** The compliance LLM runs in a TeeML-verifiable provider via `@0gfoundation/0g-compute-ts-sdk`. After every chat completion we call `broker.inference.processResponse(provider, chatId, content)` — the load-bearing line that returns `true/false` for whether the response was signed by the provider's TEE signer. Without this, the gateway is just another middleware.
- **0G Storage (audit trail).** Each decision (input, verdict, attestation headers) is uploaded as a small JSON blob via `@0gfoundation/0g-storage-ts-sdk`'s `Indexer.upload(MemData, rpc, signer)`. The returned 32-byte root hash is durable, content-addressed, and cheap.
- **0G Chain (settlement + on-chain pointer).** `ComplianceGateway.sol` emits `DecisionRecorded(payer, merchant, amount, decisionHash, storageRoot, allowed)` and persists the storage-root mapping. `AgentCheckoutToken.sol` (acUSD) implements the **full EIP-3009 surface** — `transferWithAuthorization`, `DOMAIN_SEPARATOR`, `version`, `authorizationState` — so the x402 gasless "exact" flow works end-to-end. On Monad we had to fall back to "direct" raw transfers because the deployed token there lacks EIP-3009; on 0G the clean flow is restored.

---

## Architecture

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
                    └─ AgentCheckoutToken.transferWithAuthorization(...) → real txHash on Galileo

merchant-console / explorer
  └─→ polls /api/decisions
  └─→ "Verify" button → POST /api/reverify
        └─→ zg.verifyAttestation(provider, chatId) → broker.inference.processResponse → bool
```

If A returns `allowed: false` or `attestation.verified: false`, the request returns **403 compliance_denied** with the rationale. **Settle is never called** — no money moves. That is the "no escrow needed" property.

---

## Repo layout

```
packages/
  shared/         x402 wire types, EIP-3009 helpers, ReceiptRecord v2 schema
  zerogravity/    ZGComputeClient (live + mock), ZGStorageReceiptStore
  middleware/     agentCheckout(): Express handler, x402 + compliance + settle
  facilitator/    /verify + /settle endpoints (viem, EIP-3009 broadcast)
  mcp/            pay_and_call MCP tool + x402 client (used by demo)
  contracts/      AgentCheckoutToken.sol, ComplianceGateway.sol (hardhat)
apps/
  demo-merchant/  /premium-data + /api/decisions + /api/reverify
  merchant-console/  Next.js explorer with live feed + Verify button
scripts/
  e2e.ts                local hardhat E2E (mock compliance, on-chain settle)
  smoke-live-gate.ts    DAY-1 GATE smoke against real Galileo broker
  generate-wallets.ts   funding bootstrap (5 EOAs → faucet drip)
  fund-bootstrap.ts     daily balance check
```

---

## Quick start (mock-mode, no funding required)

```bash
pnpm install
pnpm e2e
```

This spawns a local Hardhat node, deploys `AgentCheckoutToken`, runs:
- **Happy path:** mock-allowed agent pays via x402 → 200 + real txHash
- **Blocked path:** agent on policy deny-list → 403 `compliance_denied`

Both produce a `ReceiptRecord` with `attestation.verifiabilityKind === "mock"`.

To run the live stack against the real Galileo broker, see **Live demo (testnet)** below.

---

## Live demo (testnet — requires funded wallet)

### 1. Funding bootstrap

The 0G ledger requires **3 OG minimum** for `addLedger`, plus 1 OG per provider sub-account, plus a buffer for storage uploads / contract deploys. The public faucet caps at 0.1 OG/wallet/day, so practical bootstrap is *5 wallets dripping + Discord/Telegram topup*.

```bash
npx tsx scripts/generate-wallets.ts        # one-shot: 5 EOAs → scripts/wallets.json (gitignored)
pnpm fund:balances                          # daily check; switch to next step when sum ≥ 5 OG
```

Funding-log template at [scripts/funding-log.md](scripts/funding-log.md).

### 2. Deploy contracts to Galileo

Once `PRIMARY_PRIVATE_KEY` has at least ~0.1 OG:

```bash
pnpm --filter @agentcheckout/contracts run deploy:galileo
# writes:
#   GALILEO_ATOKEN_ADDRESS=0x...
#   GALILEO_GATEWAY_ADDRESS=0x...
# copy both into .env
```

### 3. DAY-1 GATE smoke (the load-bearing test)

This proves the whole product thesis: a single live inference call where `processResponse(...)` returns `true`.

```bash
ZG_COMPUTE_MODE=live npx tsx scripts/smoke-live-gate.ts
# expected output: "GATE PASS ✅ — attestation verified by processResponse()"
```

### 4. Run the merchant + explorer

```bash
ZG_COMPUTE_MODE=live ZG_STORAGE_MODE=live pnpm dev
# demo-merchant : http://localhost:4020
# facilitator    : http://localhost:4021
# explorer       : http://localhost:3000
```

In the explorer, click **Trigger paid flow** and **Trigger blocked flow**. Both appear in the live feed; click **Verify** on either — `broker.inference.processResponse(...)` re-runs against the broker and the button turns ✅ when the attestation is honest.

---

## Environment variables

See [.env.example](.env.example) for the full list. The hot ones:

| Variable | Purpose |
|---|---|
| `PRIMARY_PRIVATE_KEY` | EOA used for broker ledger, provider auth, storage signer, facilitator settle |
| `GALILEO_RPC_URL` | default `https://evmrpc-testnet.0g.ai` |
| `ZG_COMPUTE_MODE` | `live` (broker) or `mock` (deterministic policy) — default `mock` |
| `ZG_STORAGE_MODE` | `live` (0G Storage) or `mock` (JsonReceiptStore) — default `mock` |
| `GALILEO_ATOKEN_ADDRESS` | populated by `deploy:galileo` |
| `GALILEO_GATEWAY_ADDRESS` | populated by `deploy:galileo` |
| `MERCHANT_ADDRESS` | recipient EOA for paid demo flows |
| `MCP_WALLET_PRIVATE_KEY` | agent EOA for `payAndCall` against the merchant |

---

## What's deliberately deferred (per the spec)

The group-stage submission is a **thin vertical slice** that proves the critical path end-to-end. The following are scoped to later rounds:

- **Per-agent policy registry** — `ComplianceGateway` extension with `mapping(agent => Policy)`. Ro32.
- **Compliance Passport** — portable on-chain reputation accreted from clean-tx history. Ro16.
- **Human-in-the-loop escalation + escrow-hold** — async delayed decisions. Quarters.
- **Multi-agent budget tree** — parent agent sets sub-agent limits. Quarters.
- **DA-layer decision stream** — trustless auditor reconstruction. Phase 2.

Resisting feature creep is itself a position — the four primitives in this submission cover the whole tournament-judging surface (x402, compliance gate, on-chain settlement, public verifiability) and rest on real 0G primitives, not promised ones.

---

## License

MIT. See [LICENSE](LICENSE) if present, otherwise treat as MIT for the duration of the tournament.
