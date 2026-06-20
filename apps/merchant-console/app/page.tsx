"use client";

import { useEffect, useState } from "react";
import type { ReceiptRecord } from "@agentcheckout/shared";
import { VerifyButton } from "../components/VerifyButton";

export default function Page() {
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [demoBusy, setDemoBusy] = useState<"success" | "blocked" | null>(null);

  async function refresh() {
    try {
      const r = await fetch(`/api/decisions`, { cache: "no-store" });
      const j = (await r.json()) as { decisions: ReceiptRecord[] };
      setReceipts(j.decisions ?? []);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, []);

  async function triggerDemo(mode: "success" | "blocked") {
    setDemoBusy(mode);
    try {
      await fetch(`/api/demo/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDemoBusy(null);
      refresh();
    }
  }

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "2rem auto",
        padding: "0 1.5rem",
        fontFamily: "var(--font-sans), system-ui, sans-serif",
        color: "#e8e8e8",
      }}
    >
      <header style={{ marginBottom: "1.5rem" }}>
        <h1
          style={{
            fontFamily: "var(--font-display), serif",
            fontSize: "2.4rem",
            fontWeight: 500,
            margin: 0,
          }}
        >
          Vouch{" "}
          <span style={{ color: "#888", fontSize: "1.4rem", fontWeight: 400 }}>
            - payments that vouch for themselves
          </span>
        </h1>
        <p style={{ color: "#aaa", marginTop: 10, maxWidth: 760, lineHeight: 1.6 }}>
          Every payment below was reviewed by an AI judge running inside a sealed
          enclave on 0G Compute. The reasoning, the verdict, and a cryptographic
          proof are stored on 0G Storage - and you can re-check any of them
          yourself in one click. Don&rsquo;t take our word for it. Check the
          receipts.
        </p>
      </header>

      <section style={{ marginBottom: "1.5rem", display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => triggerDemo("success")}
          disabled={demoBusy !== null}
          style={demoBtnStyle("#0a8")}
        >
          {demoBusy === "success" ? "Sending…" : "Try a legitimate payment"}
        </button>
        <button
          onClick={() => triggerDemo("blocked")}
          disabled={demoBusy !== null}
          style={demoBtnStyle("#c33")}
        >
          {demoBusy === "blocked" ? "Sending…" : "Try a suspicious payment"}
        </button>
        <a
          href="https://github.com/0gfoundation/0g-compute-ts-starter-kit"
          target="_blank"
          rel="noreferrer"
          style={{ ...demoBtnStyle("#333"), textDecoration: "none", display: "inline-block" }}
        >
          0G Compute SDK ↗
        </a>
      </section>

      {error && (
        <div
          style={{
            background: "#3a0000",
            border: "1px solid #c33",
            padding: "10px 14px",
            borderRadius: 8,
            marginBottom: 16,
            fontFamily: "var(--font-mono), monospace",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 13,
          background: "#0e0e10",
          border: "1px solid #222",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <thead style={{ background: "#1a1a1d" }}>
          <tr>
            <Th>When</Th>
            <Th>Outcome</Th>
            <Th>Payer → Merchant</Th>
            <Th>Amount</Th>
            <Th>Verdict</Th>
            <Th>Why</Th>
            <Th>On-chain receipt</Th>
            <Th>Re-check</Th>
          </tr>
        </thead>
        <tbody>
          {receipts.length === 0 && (
            <tr>
              <td colSpan={8} style={{ padding: 28, textAlign: "center", color: "#888" }}>
                Nothing here yet. Try a payment above to see how Vouch decides.
              </td>
            </tr>
          )}
          {receipts.map((r) => (
            <tr key={r.id} style={{ borderTop: "1px solid #222" }}>
              <Td mono>{new Date(r.ts).toLocaleTimeString()}</Td>
              <Td>
                <span
                  style={{
                    color:
                      r.settlement.status === "SUCCESS"
                        ? "#0a8"
                        : r.settlement.status === "BLOCKED"
                          ? "#c33"
                          : "#aa6",
                    fontWeight: 600,
                  }}
                >
                  {r.settlement.status === "SUCCESS"
                    ? "Paid"
                    : r.settlement.status === "BLOCKED"
                      ? "Blocked"
                      : "Failed"}
                </span>
              </Td>
              <Td mono>
                {r.payer.slice(0, 10)}… → {r.resource.split("/").pop()?.slice(0, 12)}
              </Td>
              <Td mono>{r.payment.amount}</Td>
              <Td>
                <span style={{ color: r.compliance.allowed ? "#0a8" : "#c33" }}>
                  {r.compliance.code === "ALLOWED"
                    ? "Allowed"
                    : r.compliance.code === "DENIED"
                      ? "Denied"
                      : "Escalated"}
                </span>
              </Td>
              <Td>
                <span style={{ fontSize: 11, color: "#aaa" }}>
                  {r.compliance.rationale.slice(0, 110)}
                </span>
              </Td>
              <Td mono>
                {r.settlement.txHash ? (
                  r.settlement.explorerUrl ? (
                    <a
                      href={r.settlement.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#7af" }}
                    >
                      {r.settlement.txHash.slice(0, 10)}…
                    </a>
                  ) : (
                    r.settlement.txHash.slice(0, 10) + "…"
                  )
                ) : (
                  <span style={{ color: "#555" }}>-</span>
                )}
              </Td>
              <Td>
                <VerifyButton attestation={r.attestation} />
              </Td>
            </tr>
          ))}
        </tbody>
      </table>

      <footer style={{ marginTop: 28, color: "#888", fontSize: 12, lineHeight: 1.6 }}>
        The feed updates live as new payments come through. Re-checking a row
        runs the original attestation back through 0G Compute - if the
        provider tampered with the verdict, the check fails. In mock mode the
        check returns instantly; switch to live mode once your wallet has 0G
        Compute credits.
      </footer>
    </main>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "10px 12px",
        fontWeight: 500,
        color: "#aaa",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: 0.6,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, mono = false }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td
      style={{
        padding: "10px 12px",
        verticalAlign: "top",
        fontFamily: mono ? "var(--font-mono), monospace" : undefined,
      }}
    >
      {children}
    </td>
  );
}

function demoBtnStyle(bg: string): React.CSSProperties {
  return {
    padding: "8px 16px",
    borderRadius: 6,
    border: "1px solid #444",
    background: bg,
    color: "white",
    fontWeight: 500,
    cursor: "pointer",
  };
}
