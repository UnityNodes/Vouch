"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const spot = useRef<HTMLDivElement>(null);

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

  // cursor spotlight
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const el = spot.current;
      if (!el) return;
      el.style.setProperty("--mx", `${e.clientX}px`);
      el.style.setProperty("--my", `${e.clientY}px`);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  // scroll reveal (with a safety fallback: if anything is still hidden after 2s,
  // show it - covers headless screenshots and ancient browsers without IO).
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    const reveal = (el: Element) => el.classList.add("in");
    if (typeof IntersectionObserver === "undefined") {
      els.forEach(reveal);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (en.isIntersecting) {
            reveal(en.target);
            io.unobserve(en.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -10% 0px" },
    );
    els.forEach((el) => io.observe(el));
    const safety = setTimeout(() => els.forEach(reveal), 2000);
    return () => {
      io.disconnect();
      clearTimeout(safety);
    };
  }, []);

  async function triggerDemo(scenario: "success" | "blocked") {
    setDemoBusy(scenario);
    try {
      await fetch(`/api/demo/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: scenario }),
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
    <>
      <div className="field" aria-hidden />
      <div className="plasma" aria-hidden />
      <div className="grid-bg" aria-hidden />
      <div className="spotlight" ref={spot} aria-hidden />
      <div className="grain" aria-hidden />

      <main className="shell">
        <nav className="nav">
          <div className="mark">
            <span className="glyph"><img src="/logo.png" alt="Vouch logo" width="22" height="22" /></span>
            <span className="name">Vouch</span>
            <span className="by">on <b>0G</b></span>
          </div>
          <div className="nav-right">
            <span className="live">
              <span className="dot" />
              {mode === "live" ? "Live · 0G Galileo" : "Live"}
            </span>
            <a className="nav-link" href={GH} target="_blank" rel="noreferrer">
              <Github /> <span>GitHub</span>
            </a>
          </div>
        </nav>

        <header className="hero">
          <div>
            <span className="eyebrow enter"><Spark /> 0G Global Vibe Coding Tournament</span>
            <h1 className="enter" style={vd(80)}>
              Payments that <span className="glow">vouch</span> for themselves.
            </h1>
            <p className="lede enter" style={vd(160)}>
              Every payment is judged by an AI inside a{" "}
              <b>sealed TEE enclave on 0G Compute</b>, written to{" "}
              <b>0G Storage</b>, and settled on <b>0G Chain</b>. You can re-check
              any verdict yourself in one click.
            </p>
            <p className="kicker enter" style={vd(220)}>
              Don&rsquo;t trust us. <span className="hi">Check the receipts.</span>
            </p>
            <div className="actions enter" style={vd(300)}>
              <button className="btn btn-go" onClick={() => triggerDemo("success")} disabled={demoBusy !== null}>
                <Check />
                {demoBusy === "success" ? (mode === "live" ? "Judging on 0G…" : "Sending…") : "Try a legitimate payment"}
              </button>
              <button className="btn btn-stop" onClick={() => triggerDemo("blocked")} disabled={demoBusy !== null}>
                <Ban />
                {demoBusy === "blocked" ? (mode === "live" ? "Judging on 0G…" : "Sending…") : "Try a suspicious payment"}
              </button>
              <a className="btn btn-link" href={SDK} target="_blank" rel="noreferrer">
                0G Compute SDK <Arrow />
              </a>
            </div>
          </div>

          <div className="term-stage enter" style={vd(240)} aria-hidden>
            <TerminalHero receipts={receipts} mode={mode} />
          </div>
        </header>

        <section>
          <div className="stats reveal">
            <div className="stat"><div className="n"><Counter value={total} /></div><div className="k">Decisions</div></div>
            <div className="stat"><div className="n ok"><Counter value={paid} /></div><div className="k">Paid</div></div>
            <div className="stat"><div className="n bad"><Counter value={blocked} /></div><div className="k">Blocked</div></div>
            <div className="stat"><div className="n p"><Counter value={attested} /></div><div className="k">TEE-attested</div></div>
          </div>
        </section>

        <section className="section">
          <div className="reveal">
            <div className="section-tag">How it works</div>
            <h2 className="section-title">One payment, three proofs, zero trust required.</h2>
          </div>
          <div className="steps">
            <div className="step reveal" style={vd(80)}>
              <div className="ic"><ShieldHalf /></div>
              <div className="ix">01 / JUDGE</div>
              <h3>Decided in a sealed enclave</h3>
              <p>An AI judge reviews each payment inside a <b>TEE on 0G Compute</b>. The verdict ships with a hardware attestation: proof it ran untampered.</p>
            </div>
            <div className="step reveal" style={vd(160)}>
              <div className="ic"><Box /></div>
              <div className="ix">02 / RECORD</div>
              <h3>Proven on 0G</h3>
              <p>The decision is written to <b>0G Storage</b>, allowed payments settle in vUSD on <b>0G Chain</b>, and blocks are recorded on-chain too.</p>
            </div>
            <div className="step reveal" style={vd(240)}>
              <div className="ic"><Magnifier /></div>
              <div className="ix">03 / VERIFY</div>
              <h3>Re-checkable by anyone</h3>
              <p>Hit <b>Re-check</b> on any row. Vouch re-runs the original attestation through 0G: tamper with a verdict and the check fails.</p>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="feed-head reveal">
            <div>
              <div className="section-tag">Live feed</div>
              <h2 className="section-title">Live decision feed</h2>
            </div>
            <span className="feed-sub">updates every 3s</span>
          </div>

          {error && <div className="alert">{error}</div>}

          <div className="panel reveal">
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
                      <td className="mono faint">{new Date(r.ts).toLocaleTimeString()}</td>
                      <td><Outcome status={r.settlement.status} /></td>
                      <td className="mono dim">
                        {r.payer.slice(0, 8)}… <span className="faint">&rarr;</span>{" "}
                        {r.resource.split("/").pop()?.replace(/#.*$/, "").slice(0, 14)}
                      </td>
                      <td><span className="amt">{fmtAmount(r.payment.amount)}<span className="u">{r.payment.asset}</span></span></td>
                      <td><Verdict code={r.compliance.code} /></td>
                      <td><span className="why">{r.compliance.rationale}</span></td>
                      <td>
                        <div className="rcpt-cell">
                          {r.settlement.txHash ? (
                            r.settlement.explorerUrl ? (
                              <a className="rcpt" href={r.settlement.explorerUrl} target="_blank" rel="noreferrer">{r.settlement.txHash.slice(0, 10)}…</a>
                            ) : (
                              <span className="rcpt">{r.settlement.txHash.slice(0, 10)}…</span>
                            )
                          ) : (
                            <span className="rcpt none">not recorded</span>
                          )}
                          {r.storage?.storageRoot && (
                            <span className="zgs" title="0G Storage root hash">0G Storage {r.storage.storageRoot.slice(0, 10)}…</span>
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
        </section>

        <footer className="foot">
          <div className="row">
            <div>
              Re-checking a row re-runs its attestation through 0G Compute. In{" "}
              <a href={SDK} target="_blank" rel="noreferrer">live mode</a> a tampered verdict fails the check; mock mode returns instantly.
            </div>
            <span className="mode">{mode === "live" ? "live on 0G Galileo" : "mock mode"}</span>
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <span>
              Contracts on 0G Galileo:{" "}
              <a href={`${SCAN}/${ATOKEN}`} target="_blank" rel="noreferrer">VouchToken</a> ·{" "}
              <a href={`${SCAN}/${GATEWAY}`} target="_blank" rel="noreferrer">ComplianceGateway</a>
            </span>
            <a href={GH} target="_blank" rel="noreferrer">github.com/UnityNodes/Vouch</a>
          </div>
        </footer>
      </main>
    </>
  );
}

function vd(ms: number): React.CSSProperties {
  return { ["--d" as string]: `${ms}ms` } as React.CSSProperties;
}

function fmtAmount(raw: string): string {
  const n = Number(raw) / 1e6;
  if (!isFinite(n)) return raw;
  return n.toLocaleString(undefined, { maximumFractionDigits: n < 1 ? 4 : 2 });
}


type Mode = "live" | "mock";
type Line = { kind: "cmd" | "log" | "idle" | "result"; html: string; resultOk?: boolean };

function buildLines(latest: ReceiptRecord | undefined, mode: Mode): Line[] {
  if (!latest) {
    return [
      { kind: "cmd", html: "0g-vouch judge --watch" },
      { kind: "idle", html: mode === "live" ? "waiting for payment intent on 0G Galileo…" : "(mock mode - press a button above to seed)" },
    ];
  }
  const allowed = latest.compliance.allowed;
  const verified = latest.attestation.verified;
  const amt = (Number(latest.payment.amount) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 4 });
  const payer = latest.payer.slice(0, 10) + "…";
  const prov = latest.attestation.providerAddress.slice(0, 10) + "…";
  const rationale = latest.compliance.rationale.length > 56
    ? latest.compliance.rationale.slice(0, 53) + "..."
    : latest.compliance.rationale;
  const txShort = latest.settlement.txHash ? latest.settlement.txHash.slice(0, 14) + "…" : null;
  const rootShort = latest.storage?.storageRoot ? latest.storage.storageRoot.slice(0, 14) + "…" : null;

  const lines: Line[] = [
    { kind: "cmd", html: `judge --payer ${payer} --amount ${amt} vUSD` },
    { kind: "log", html: `<span class="tag">[0G/TEE]</span>   provider ${prov}` },
    { kind: "log", html: `<span class="tag">[0G/TEE]</span>   verdict: <span class="${allowed ? "ok" : "bad"}">${latest.compliance.code}</span>  -  ${rationale}` },
    { kind: "log", html: `<span class="tag">[0G/TEE]</span>   processResponse: verified=<span class="${verified ? "ok" : "bad"}">${verified}</span>` },
  ];
  if (rootShort) lines.push({ kind: "log", html: `<span class="tag">[0G/STORE]</span> root <span class="hash">${rootShort}</span>` });
  if (txShort) lines.push({ kind: "log", html: `<span class="tag">[0G/CHAIN]</span> ${allowed ? "settled" : "anchored"} tx <span class="hash">${txShort}</span>` });
  lines.push({
    kind: "result",
    resultOk: allowed,
    html: allowed ? `&#10003; PAID ${amt} vUSD on 0G Galileo` : `&#10005; BLOCKED  (no money moved)`,
  });
  return lines;
}

function TerminalHero({ receipts, mode }: { receipts: ReceiptRecord[]; mode: Mode }) {
  const latest = receipts[0];
  const lines = useMemo(() => buildLines(latest, mode), [latest, mode]);
  const [step, setStep] = useState(0);
  const [typed, setTyped] = useState("");

  // reset typewriter when the latest receipt changes
  useEffect(() => {
    setStep(0);
    setTyped("");
  }, [latest?.id, mode]);

  // typewriter through `lines`
  useEffect(() => {
    const line = lines[step];
    if (!line) return;
    const current = line.html;
    if (typed.length < current.length) {
      const isTag = current[typed.length] === "<";
      const delta = isTag ? current.indexOf(">", typed.length) - typed.length + 1 : 1;
      const t = setTimeout(() => setTyped(current.slice(0, typed.length + delta)), isTag ? 0 : 14);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => { setStep((sv) => sv + 1); setTyped(""); }, 320);
    return () => clearTimeout(t);
  }, [step, typed, lines]);

  const done = step >= lines.length;
  return (
    <div className="term">
      <div className="term-bar">
        <span className="b r" /><span className="b y" /><span className="b g" />
        <span className="term-title">
          0g-tee-judge ~ /vouch
          <span className="live">live</span>
        </span>
      </div>
      <div className="term-body">
        {lines.slice(0, step).map((l, i) => (
          <div key={i} className={`tl ${l.kind}${l.kind === "result" && l.resultOk !== undefined ? (l.resultOk ? " ok" : " bad") : ""}`} dangerouslySetInnerHTML={{ __html: l.html }} />
        ))}
        {lines[step] && (
          <div className={`tl ${lines[step]!.kind}`}>
            <span dangerouslySetInnerHTML={{ __html: typed }} />
            <span className="caret" />
          </div>
        )}
        {done && <div className="tl cmd"><span className="caret" /></div>}
      </div>
    </div>
  );
}

function Counter({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const dur = 700;
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(a + (value - a) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{display}</>;
}

function Outcome({ status }: { status: ReceiptRecord["settlement"]["status"] }) {
  if (status === "SUCCESS") return <span className="pill pill-ok"><span className="d" /> Paid</span>;
  if (status === "BLOCKED") return <span className="pill pill-bad"><span className="d" /> Blocked</span>;
  return <span className="pill pill-warn"><span className="d" /> Failed</span>;
}
function Verdict({ code }: { code: ReceiptRecord["compliance"]["code"] }) {
  if (code === "ALLOWED") return <span className="verdict ok">Allowed</span>;
  if (code === "DENIED") return <span className="verdict bad">Denied</span>;
  return <span className="verdict warn">Escalated</span>;
}

/* ===== icons ===== */
function Github() {
  return (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48l-.01-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.36 1.09 2.94.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85l-.01 2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" /></svg>);
}
function Spark() {
  return (<svg viewBox="0 0 24 24" fill="none"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.4 2.4M15.3 15.3l2.4 2.4M17.7 6.3l-2.4 2.4M8.7 15.3l-2.4 2.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>);
}
function Check() { return (<svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>); }
function Ban() { return (<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.2" stroke="currentColor" strokeWidth="1.8" /><path d="M6.2 6.2l11.6 11.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>); }
function Arrow() { return (<svg viewBox="0 0 24 24" fill="none"><path d="M7 17 17 7M9 7h8v8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>); }
function ShieldHalf() { return (<svg viewBox="0 0 24 24" fill="none"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M12 3v20" stroke="currentColor" strokeWidth="1.6" /></svg>); }
function Box() { return (<svg viewBox="0 0 24 24" fill="none"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M4 7.5 12 12m0 0 8-4.5M12 12v9" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>); }
function Magnifier() { return (<svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" /><path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /><path d="M8.5 11l1.8 1.8L14 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>); }
