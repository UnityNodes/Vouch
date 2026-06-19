"use client";

import { useEffect, useState } from "react";
import type { ReceiptRecord } from "@agentcheckout/shared";
import { VerifyButton } from "../components/VerifyButton";

const DEMO_MERCHANT =
  process.env.NEXT_PUBLIC_DEMO_MERCHANT_URL ?? "http://localhost:4020";

export default function Page() {
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [demoBusy, setDemoBusy] = useState<"success" | "blocked" | null>(null);

  async function refresh() {
    try {
      const r = await fetch(`${DEMO_MERCHANT}/api/decisions`, { cache: "no-store" });
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
          0G Compliance Explorer
        </h1>
        <p style={{ color: "#aaa", marginTop: 6, maxWidth: 720 }}>
          Live TEE-attested payment decisions. Each row was decided by an LLM
          running inside a 0G Compute TEE; the decision + attestation proof is
          stored on 0G Storage with an on-chain pointer. Click <b>Verify</b> to
          re-check the attestation against the broker — &ldquo;trust us&rdquo;
          becomes &ldquo;verify yourself.&rdquo;
        </p>
      </header>

      <section style={{ marginBottom: "1.5rem", display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => triggerDemo("success")}
          disabled={demoBusy !== null}
          style={demoBtnStyle("#0a8")}
        >
          {demoBusy === "success" ? "running…" : "Trigger paid flow"}
        </button>
        <button
          onClick={() => triggerDemo("blocked")}
          disabled={demoBusy !== null}
          style={demoBtnStyle("#c33")}
        >
          {demoBusy === "blocked" ? "running…" : "Trigger blocked flow"}
        </button>
        <a
          href={`${DEMO_MERCHANT}/`}
          target="_blank"
          rel="noreferrer"
          style={{ ...demoBtnStyle("#333"), textDecoration: "none", display: "inline-block" }}
        >
          demo-merchant status
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
            <Th>time</Th>
            <Th>status</Th>
            <Th>payer → merchant</Th>
            <Th>amount</Th>
            <Th>code</Th>
            <Th>rationale</Th>
            <Th>tx</Th>
            <Th>verify</Th>
          </tr>
        </thead>
        <tbody>
          {receipts.length === 0 && (
            <tr>
              <td colSpan={8} style={{ padding: 24, textAlign: "center", color: "#666" }}>
                No decisions yet. Trigger a flow above to populate the feed.
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
                  {r.settlement.status}
                </span>
              </Td>
              <Td mono>
                {r.payer.slice(0, 10)}… → {r.resource.split("/").pop()?.slice(0, 12)}
              </Td>
              <Td mono>{r.payment.amount}</Td>
              <Td>
                <span style={{ color: r.compliance.allowed ? "#0a8" : "#c33" }}>
                  {r.compliance.code}
                </span>
              </Td>
              <Td>
                <span style={{ fontSize: 11, color: "#aaa" }}>
                  {r.compliance.rationale.slice(0, 100)}
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
                  <span style={{ color: "#555" }}>—</span>
                )}
              </Td>
              <Td>
                <VerifyButton attestation={r.attestation} merchantOrigin={DEMO_MERCHANT} />
              </Td>
            </tr>
          ))}
        </tbody>
      </table>

      <footer style={{ marginTop: 24, color: "#666", fontSize: 12 }}>
        Polling <code>{DEMO_MERCHANT}/api/decisions</code> every 3s · Verify hits{" "}
        <code>{DEMO_MERCHANT}/api/reverify</code> which calls{" "}
        <code>broker.inference.processResponse(...)</code>.
      </footer>
    </main>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "8px 12px",
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
        padding: "8px 12px",
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
