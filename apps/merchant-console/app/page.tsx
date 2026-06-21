"use client";

import { useEffect, useState } from "react";
import type { ReceiptRecord } from "@agentcheckout/shared";
import { VerifyButton } from "../components/VerifyButton";

const GH = "https://github.com/UnityNodes/Vouch";
const SDK = "https://github.com/0gfoundation/0g-compute-ts-starter-kit";
const SCAN = "https://chainscan-galileo.0g.ai/address";
const ATOKEN = "0x5B27c085896B28e69ba6f2Dc3B388D6BCcb1B1Cc";
const GATEWAY = "0xb82E8677Ccede3FffA4DF1fE502d3AE702874440";

export default function Page() {
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [demoBusy, setDemoBusy] = useState<"success" | "blocked" | null>(null);
  const [mode, setMode] = useState<"live" | "mock">("mock");

  async function refresh() {
    try {
      const r = await fetch(`/api/decisions`, { cache: "no-store" });
      const j = (await r.json()) as { decisions: ReceiptRecord[]; mode?: string };
      setReceipts(j.decisions ?? []);
      setMode(j.mode === "live" ? "live" : "mock");
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

  const total = receipts.length;
  const paid = receipts.filter((r) => r.settlement.status === "SUCCESS").length;
  const blocked = receipts.filter((r) => r.settlement.status === "BLOCKED").length;
  const attested = receipts.filter((r) => r.attestation.verified).length;

  return (
    <main className="shell">
      <nav className="nav">
        <div className="mark">
          <span className="glyph">
            <ZeroG />
          </span>
          <span className="name">Vouch</span>
          <span className="by">
            on <b>0G</b>
          </span>
        </div>
        <div className="nav-right">
          <span className="live">
            <span className="dot" />
            {mode === "live" ? "Live · 0G Galileo" : "Live"}
          </span>
          <a className="nav-link gh" href={GH} target="_blank" rel="noreferrer">
            <Github />
            <span>GitHub</span>
          </a>
        </div>
      </nav>

      <header className="hero">
        <span className="eyebrow reveal" style={vd(0)}>
          <Spark /> 0G Global Vibe Coding Tournament
        </span>
        <h1 className="reveal" style={vd(60)}>
          Payments that <span className="glow">vouch</span> for themselves.
        </h1>
        <p className="lede reveal" style={vd(140)}>
          Every payment below was judged by an AI running inside a{" "}
          <b>sealed TEE enclave on 0G Compute</b>. The reasoning, the verdict and
          a cryptographic proof are written to <b>0G Storage</b> and{" "}
          <b>0G Chain</b> - and you can re-check any of them yourself in one
          click.
        </p>
        <p className="kicker reveal" style={vd(200)}>
          Don&rsquo;t trust us. <span className="hi">Check the receipts.</span>
        </p>

        <div className="stats reveal" style={vd(260)}>
          <div className="stat">
            <div className="n">{total}</div>
            <div className="k">Decisions</div>
          </div>
          <div className="stat">
            <div className="n ok">{paid}</div>
            <div className="k">Paid</div>
          </div>
          <div className="stat">
            <div className="n bad">{blocked}</div>
            <div className="k">Blocked</div>
          </div>
          <div className="stat">
            <div className="n p">{attested}</div>
            <div className="k">TEE-attested</div>
          </div>
        </div>

        <div className="actions reveal" style={vd(320)}>
          <button
            className="btn btn-go"
            onClick={() => triggerDemo("success")}
            disabled={demoBusy !== null}
          >
            <Check />
            {demoBusy === "success"
              ? mode === "live"
                ? "Judging on 0G…"
                : "Sending…"
              : "Try a legitimate payment"}
          </button>
          <button
            className="btn btn-stop"
            onClick={() => triggerDemo("blocked")}
            disabled={demoBusy !== null}
          >
            <Ban />
            {demoBusy === "blocked"
              ? mode === "live"
                ? "Judging on 0G…"
                : "Sending…"
              : "Try a suspicious payment"}
          </button>
          <a className="btn btn-link" href={SDK} target="_blank" rel="noreferrer">
            0G Compute SDK
            <Arrow />
          </a>
        </div>
      </header>

      <section className="steps">
        <div className="step reveal" style={vd(120)}>
          <div className="ic"><ShieldHalf /></div>
          <div className="ix">01 / JUDGE</div>
          <h3>Decided in a sealed enclave</h3>
          <p>
            An AI judge reviews each payment inside a <b>TEE on 0G Compute</b>.
            The verdict comes with a hardware attestation - proof it ran
            untampered.
          </p>
        </div>
        <div className="step reveal" style={vd(190)}>
          <div className="ic"><Box /></div>
          <div className="ix">02 / RECORD</div>
          <h3>Proven on 0G</h3>
          <p>
            Verdict, reasoning and proof hash are written to <b>0G Storage</b>{" "}
            and anchored on <b>0G Chain</b>. No private database to trust.
          </p>
        </div>
        <div className="step reveal" style={vd(260)}>
          <div className="ic"><Magnifier /></div>
          <div className="ix">03 / VERIFY</div>
          <h3>Re-checkable by anyone</h3>
          <p>
            Hit <b>Re-check</b> on any row. Vouch re-runs the original
            attestation through 0G - tamper with a verdict and the check fails.
          </p>
        </div>
      </section>

      <div className="section-head">
        <h2>Live decision feed</h2>
        <span className="sub">updates every 3s</span>
      </div>

      {error && <div className="alert">{error}</div>}

      <div className="panel">
        <div className="scroll-x">
          <table className="feed">
            <thead>
              <tr>
                <th>When</th>
                <th>Outcome</th>
                <th>Payer &rarr; Resource</th>
                <th>Amount</th>
                <th>Verdict</th>
                <th>Why</th>
                <th>On-chain receipt</th>
                <th>Re-check</th>
              </tr>
            </thead>
            <tbody>
              {receipts.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div className="empty">
                      <div className="big">No decisions yet.</div>
                      Trigger a payment above to watch Vouch judge it live.
                    </div>
                  </td>
                </tr>
              )}
              {receipts.map((r) => (
                <tr key={r.id}>
                  <td className="mono faint">
                    {new Date(r.ts).toLocaleTimeString()}
                  </td>
                  <td><Outcome status={r.settlement.status} /></td>
                  <td className="mono dim">
                    {r.payer.slice(0, 8)}…{" "}
                    <span className="faint">&rarr;</span>{" "}
                    {r.resource.split("/").pop()?.replace(/#.*$/, "").slice(0, 14)}
                  </td>
                  <td>
                    <span className="amt">
                      {fmtAmount(r.payment.amount)}
                      <span className="u">{r.payment.asset}</span>
                    </span>
                  </td>
                  <td><Verdict code={r.compliance.code} /></td>
                  <td><span className="why">{r.compliance.rationale}</span></td>
                  <td>
                    <div className="rcpt-cell">
                      {r.settlement.txHash ? (
                        r.settlement.explorerUrl ? (
                          <a
                            className="rcpt"
                            href={r.settlement.explorerUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {r.settlement.txHash.slice(0, 10)}…
                          </a>
                        ) : (
                          <span className="rcpt">
                            {r.settlement.txHash.slice(0, 10)}…
                          </span>
                        )
                      ) : (
                        <span className="rcpt none">not recorded</span>
                      )}
                      {r.storage?.storageRoot && (
                        <span className="zgs" title="0G Storage root hash">
                          0G Storage {r.storage.storageRoot.slice(0, 10)}…
                        </span>
                      )}
                    </div>
                  </td>
                  <td><VerifyButton attestation={r.attestation} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <footer className="foot">
        <div className="row">
          <div>
            Re-checking a row re-runs its attestation through 0G Compute. In{" "}
            <a href={SDK} target="_blank" rel="noreferrer">
              live mode
            </a>{" "}
            a tampered verdict fails the check; mock mode returns instantly.
          </div>
          <span className="mode">
            {mode === "live" ? "live on 0G Galileo" : "mock mode"}
          </span>
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <span>
            Contracts on 0G Galileo:{" "}
            <a href={`${SCAN}/${ATOKEN}`} target="_blank" rel="noreferrer">
              VouchToken
            </a>{" "}
            ·{" "}
            <a href={`${SCAN}/${GATEWAY}`} target="_blank" rel="noreferrer">
              ComplianceGateway
            </a>
          </span>
          <a href={GH} target="_blank" rel="noreferrer">
            github.com/UnityNodes/Vouch
          </a>
        </div>
      </footer>
    </main>
  );
}

function vd(ms: number): React.CSSProperties {
  return { ["--d" as string]: `${ms}ms` } as React.CSSProperties;
}

function fmtAmount(raw: string): string {
  const n = Number(raw) / 1e6;
  if (!isFinite(n)) return raw;
  return n.toLocaleString(undefined, {
    maximumFractionDigits: n < 1 ? 4 : 2,
  });
}

function Outcome({ status }: { status: ReceiptRecord["settlement"]["status"] }) {
  if (status === "SUCCESS")
    return (
      <span className="pill pill-ok">
        <span className="d" /> Paid
      </span>
    );
  if (status === "BLOCKED")
    return (
      <span className="pill pill-bad">
        <span className="d" /> Blocked
      </span>
    );
  return (
    <span className="pill pill-warn">
      <span className="d" /> Failed
    </span>
  );
}

function Verdict({ code }: { code: ReceiptRecord["compliance"]["code"] }) {
  if (code === "ALLOWED") return <span className="verdict ok">Allowed</span>;
  if (code === "DENIED") return <span className="verdict bad">Denied</span>;
  return <span className="verdict warn">Escalated</span>;
}

/* ===== icons ===== */
function ZeroG() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="12" cy="12" rx="6.4" ry="8.2" stroke="#cb8aff" strokeWidth="1.7" />
      <path d="M16.5 6 7.5 18" stroke="#cb8aff" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
function Github() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48l-.01-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.36 1.09 2.94.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85l-.01 2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
    </svg>
  );
}
function Spark() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.4 2.4M15.3 15.3l2.4 2.4M17.7 6.3l-2.4 2.4M8.7 15.3l-2.4 2.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Ban() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6.2 6.2l11.6 11.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function Arrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M7 17 17 7M9 7h8v8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ShieldHalf() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 3v20" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function Box() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M4 7.5 12 12m0 0 8-4.5M12 12v9" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
function Magnifier() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8.5 11l1.8 1.8L14 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
