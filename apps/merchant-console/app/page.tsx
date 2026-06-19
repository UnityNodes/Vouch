"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { explorerTxUrl, type ReceiptRecord } from "@agentcheckout/shared";

const trunc = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "-");
const fmtAmount = (raw: string, d = 6) => {
  const n = Number(raw);
  return Number.isFinite(n) ? (n / 10 ** d).toLocaleString(undefined, { maximumFractionDigits: d }) : raw;
};

type RunState = { loading: boolean; mode?: "success" | "blocked"; ok?: boolean; msg?: string };

/** Reveal-on-scroll via IntersectionObserver (GPU-cheap, no scroll listeners). */
function useReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    const revealAll = () => els.forEach((e) => e.classList.add("in"));
    if (typeof IntersectionObserver === "undefined") {
      revealAll();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (en.isIntersecting) {
            en.target.classList.add("in");
            io.unobserve(en.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -7% 0px" },
    );
    els.forEach((e) => io.observe(e));
    // safety net: never leave content hidden if a reveal is missed
    const safety = setTimeout(revealAll, 2600);
    return () => {
      io.disconnect();
      clearTimeout(safety);
    };
  }, []);
}

export default function Page() {
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [run, setRun] = useState<RunState>({ loading: false });
  const seen = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/receipts", { cache: "no-store" });
      const j = (await r.json()) as { receipts: ReceiptRecord[] };
      setReceipts(j.receipts ?? []);
    } catch {
      /* ignore transient */
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    for (const r of receipts) seen.current.add(r.id);
  }, [receipts]);

  useReveal();

  const runDemo = async (mode: "success" | "blocked") => {
    setRun({ loading: true, mode });
    try {
      const r = await fetch("/api/demo/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const j = await r.json();
      const ok = mode === "success" ? Boolean(j.paid) : !j.paid;
      const msg = j.paid
        ? `Settled on Monad · tx ${trunc(j.txHash)}`
        : `Blocked at the identity gate${j.apassCode ? ` · A-Pass code ${j.apassCode}` : ""}`;
      setRun({ loading: false, mode, ok, msg });
    } catch (e) {
      setRun({ loading: false, mode, ok: false, msg: (e as Error).message });
    } finally {
      setTimeout(refresh, 600);
    }
  };

  const total = receipts.length;
  const settled = receipts.filter((r) => r.settlement.status === "SUCCESS").length;
  const blocked = receipts.filter((r) => r.settlement.status === "BLOCKED").length;
  const travelRules = receipts.filter((r) => r.travelRule).length;

  const freshIds = new Set<string>();
  for (const r of receipts) if (!seen.current.has(r.id)) freshIds.add(r.id);

  return (
    <>
      <AuroraBackground />
      <GlassNav />

      <main className="mx-auto max-w-6xl px-5 sm:px-8">
        {/* Hero */}
        <section className="grid items-center gap-8 pt-16 pb-6 sm:pt-24 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <span
              className="reveal inline-flex items-center gap-2 rounded-full border border-[var(--hair)] bg-white/[0.04] px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted backdrop-blur"
              style={{ ["--d" as string]: "0ms" }}
            >
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-mint" style={{ background: "var(--mint)" }} /> Compliance-native · x402 · Monad
            </span>

            <h1
              className="reveal mt-6 font-display text-[2.7rem] font-normal leading-[1.04] tracking-[-0.03em] text-ink sm:text-6xl"
              style={{ ["--d" as string]: "90ms" }}
            >
              Payments from AI agents,
              <br />
              with <em className="aurora-em font-display italic">verified identity</em>
              <br className="hidden sm:block" /> on every charge.
            </h1>

            <p
              className="reveal mt-7 max-w-xl text-[15px] leading-relaxed text-muted sm:text-lg"
              style={{ ["--d" as string]: "170ms" }}
            >
              An agent pays your API like a customer would. Before any value moves, AgentCheckout checks the
              wallet for a bank-verified Cleanverse <span className="text-ink">A-Pass</span>, then settles a clean{" "}
              <span className="text-ink">A-Token</span> on Monad. No verified identity, no payment.
            </p>

            <div className="reveal mt-9 flex flex-wrap items-center gap-4" style={{ ["--d" as string]: "250ms" }}>
              <a href="#demo" className="btn btn-primary">
                Run the live demo
                <span className="ico">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M8 5l11 7-11 7V5z" fill="currentColor" />
                  </svg>
                </span>
              </a>
              <a href="#how" className="btn btn-ghost">
                See how it works
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>
          </div>

          <div className="reveal hidden lg:block" style={{ ["--d" as string]: "320ms" }}>
            <AuroraVisual />
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-24 pt-16">
          <SectionLabel className="reveal">How a payment flows</SectionLabel>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Step
              d="0ms"
              n="01"
              title="Agent hits a paid endpoint"
              body="The merchant protects any route with one line of x402 middleware. The agent receives a 402 with the exact price and asset."
              icon={<IconLock />}
            />
            <Step
              d="120ms"
              n="02"
              title="Identity gate · A-Pass"
              body="Cleanverse verifies the paying wallet holds a valid, bank-grade A-Pass. No pass and the request stops right here, with no value moved."
              icon={<IconShield />}
              gate
            />
            <Step
              d="240ms"
              n="03"
              title="Settle on Monad"
              body="The verified agent's A-Token transfer settles on-chain in about a second, with a real txHash and a Travel-Rule receipt filed automatically."
              icon={<IconChain />}
            />
          </div>
        </section>

        {/* Demo + stats (bento) */}
        <section id="demo" className="scroll-mt-24 pt-16">
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="reveal bezel">
              <div className="bezel-core p-6 sm:p-7">
                <div className="flex items-baseline justify-between">
                  <h2 className="font-display text-2xl text-ink">Try it live</h2>
                  <span className="text-xs text-faint">runs on Monad testnet</span>
                </div>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
                  Each button fires a real payment from a demo agent against the demo merchant. Watch it land in
                  the feed below with a real transaction hash.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <DemoButton
                    tone="accent"
                    loading={run.loading && run.mode === "success"}
                    disabled={run.loading}
                    onClick={() => runDemo("success")}
                    title="Verified agent pays"
                    sub="Valid A-Pass + balance → settles on-chain"
                  />
                  <DemoButton
                    tone="danger"
                    loading={run.loading && run.mode === "blocked"}
                    disabled={run.loading}
                    onClick={() => runDemo("blocked")}
                    title="Agent with no identity"
                    sub="On the deny list → blocked at the gate"
                  />
                </div>

                {run.msg && (
                  <div
                    role="status"
                    aria-live="polite"
                    className={`mt-4 flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-sm ${
                      run.ok
                        ? "border-[var(--mint-soft)] bg-[var(--mint-soft)] text-[var(--mint)]"
                        : "border-[var(--danger-soft)] bg-[var(--danger-soft)] text-danger"
                    }`}
                  >
                    <span aria-hidden className="mt-0.5">
                      {run.ok ? "✓" : "✕"}
                    </span>
                    <span className="font-mono text-[13px] leading-snug">{run.msg}</span>
                  </div>
                )}

                <a
                  href="/api/compliance-bundle"
                  className="group mt-5 inline-flex items-center gap-2 rounded-full text-sm font-medium text-muted transition-colors duration-500 hover:text-ink focus-visible:text-ink focus-visible:underline focus-visible:outline-none"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full border border-[var(--hair-strong)] bg-white/[0.04] transition-transform duration-500 ease-[var(--ease)] group-hover:-translate-y-px">
                    <IconDownload />
                  </span>
                  Download the compliance bundle (JSON)
                </a>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Stat d="80ms" label="Requests" value={total} />
              <Stat d="160ms" label="Settled" value={settled} accent="text-[var(--mint)]" />
              <Stat d="240ms" label="Blocked" value={blocked} accent="text-danger" />
              <Stat d="320ms" label="Travel-Rule receipts" value={travelRules} accent="text-[var(--gold)]" />
            </div>
          </div>
        </section>

        {/* Live feed */}
        <section className="pt-16 pb-24">
          <div className="mb-5 flex items-center gap-2.5">
            <span className="live-dot h-2 w-2 rounded-full" style={{ background: "var(--mint)" }} aria-hidden />
            <SectionLabel>Live payment feed</SectionLabel>
          </div>

          <div className="reveal bezel">
            <div className="bezel-core overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead className="border-b border-[var(--line)] text-[10px] uppercase tracking-[0.16em] text-faint">
                    <tr>
                      <Th>Time</Th>
                      <Th>Payer</Th>
                      <Th>Identity</Th>
                      <Th>Amount</Th>
                      <Th>Settlement</Th>
                      <Th>Travel Rule</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipts.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-16 text-center">
                          <p className="text-sm text-muted">No payments yet.</p>
                          <p className="mt-1 text-xs text-faint">
                            Hit <span style={{ color: "var(--mint)" }}>Verified agent pays</span> to see one land here.
                          </p>
                        </td>
                      </tr>
                    )}
                    {receipts.map((r) => (
                      <tr
                        key={r.id}
                        className={`border-b border-[var(--line)] last:border-0 transition-colors hover:bg-white/[0.02] ${
                          freshIds.has(r.id) ? "flash" : ""
                        }`}
                      >
                        <td className="whitespace-nowrap px-6 py-3.5 text-faint">
                          {new Date(r.ts).toLocaleTimeString()}
                        </td>
                        <td className="px-6 py-3.5 font-mono text-[13px] text-muted">{trunc(r.payer)}</td>
                        <td className="px-6 py-3.5">
                          {r.apass.verified ? (
                            <Pill tone="accent">A-Pass {r.apass.tier ? `· tier ${r.apass.tier}` : "verified"}</Pill>
                          ) : (
                            <Pill tone="danger">no A-Pass</Pill>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-6 py-3.5 font-mono text-[13px] text-ink">
                          {fmtAmount(r.payment.amount)} <span className="text-faint">{r.payment.asset}</span>
                        </td>
                        <td className="px-6 py-3.5">
                          {r.settlement.txHash ? (
                            <a
                              className="inline-flex items-center gap-1 font-mono text-[13px] text-accent transition-colors hover:text-[var(--accent-2)]"
                              href={r.settlement.explorerUrl ?? explorerTxUrl(r.settlement.txHash)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {trunc(r.settlement.txHash)} <IconArrow />
                            </a>
                          ) : (
                            <Pill tone="danger">blocked</Pill>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-[13px]">
                          <TravelRuleCell r={r} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <Footer />
        </section>
      </main>
    </>
  );
}

/* aurora background */

function AuroraBackground() {
  const sky = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sky.current;
    if (!el || el.childElementCount) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 46; i++) {
      const s = document.createElement("span");
      s.className = "star";
      s.style.left = `${Math.random() * 100}%`;
      s.style.top = `${Math.random() * 72}%`;
      s.style.transform = `scale(${0.6 + Math.random() * 1.1})`;
      if (reduce) {
        s.style.animation = "none";
        s.style.opacity = "0.5";
      } else {
        s.style.animationDelay = `${Math.random() * 4}s`;
        s.style.animationDuration = `${3 + Math.random() * 3}s`;
      }
      frag.appendChild(s);
    }
    el.appendChild(frag);
  }, []);
  return (
    <>
      <div className="aurora" aria-hidden>
        <div className="blob b1" />
        <div className="blob b2" />
        <div className="blob b3" />
        <div className="blob b4" />
        <div className="blob b5" />
      </div>
      <div className="stars" ref={sky} aria-hidden />
      <div className="grain" aria-hidden />
      <div className="vignette" aria-hidden />
    </>
  );
}

/* nav */

function GlassNav() {
  return (
    <div className="sticky top-0 z-30 mx-auto flex w-full max-w-6xl justify-center px-5 pt-5 sm:px-8">
      <header className="flex w-full items-center justify-between gap-4 rounded-full border border-[var(--hair)] bg-black/30 px-4 py-2.5 backdrop-blur-xl sm:px-5">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="font-display text-[15px] tracking-tight text-ink">AgentCheckout</span>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <Pill tone="muted">Monad testnet</Pill>
          <Pill tone="muted">A-Pass gated</Pill>
          <Pill tone="muted">x402</Pill>
        </div>
        <a
          href="#demo"
          className="rounded-full bg-white/[0.06] px-3.5 py-1.5 text-xs font-medium text-ink transition-colors duration-500 hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:hidden"
        >
          Demo
        </a>
      </header>
    </div>
  );
}

/* hero visual (aurora portal) */

function AuroraVisual() {
  return (
    <div className="visual" aria-hidden>
      <div className="stage">
        <div className="rail">
          <span className="pulse" />
        </div>

        <div className="vcard agent">
          <div className="av">
            <svg viewBox="0 0 24 24" fill="none">
              <rect x="4" y="7" width="16" height="12" rx="3" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="9" cy="13" r="1.4" fill="currentColor" />
              <circle cx="15" cy="13" r="1.4" fill="currentColor" />
              <path d="M12 4v3M9 19v2M15 19v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <div className="lbl">AI agent</div>
          <div className="val">Procurement bot</div>
          <div className="pay">
            <span className="amt">$420</span>
            <span className="cur">A-Token</span>
          </div>
        </div>

        <div className="gate">
          <div className="portal">
            <span className="scan" />
          </div>
          <div className="seal">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 2.5l7 3v5.2c0 4.4-3 8-7 9.8-4-1.8-7-5.4-7-9.8V5.5l7-3z" stroke="#6ee7c4" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M8.5 12l2.4 2.4L16 9.4" stroke="#6ee7c4" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="gsub">A-Pass gate</span>
          <span className="glabel">Identity verified</span>
        </div>

        <div className="vcard monad">
          <div className="orb">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                fill="#fff"
                d="M12 3c-2.599 0-9 6.4-9 9s6.401 9 9 9 9-6.401 9-9-6.401-9-9-9m-1.402 14.146c-1.097-.298-4.043-5.453-3.744-6.549s5.453-4.042 6.549-3.743c1.095.298 4.042 5.453 3.743 6.549-.298 1.095-5.453 4.042-6.549 3.743"
              />
            </svg>
          </div>
          <div className="lbl">Settled on</div>
          <div className="val">Monad</div>
          <span className="settled">
            <span className="c">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M5 12.5l4 4 10-10.5" stroke="#063" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            Confirmed
          </span>
        </div>

        <div className="tok ok">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M5 12.5l4 4 10-10.5" stroke="#063" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="tok bad">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
        <span className="blockbadge">Blocked · no valid identity</span>
      </div>
    </div>
  );
}

/* pieces */

function Step({ d, n, title, body, icon, gate }: { d: string; n: string; title: string; body: string; icon: React.ReactNode; gate?: boolean }) {
  return (
    <div className="reveal bezel h-full" style={{ ["--d" as string]: d }}>
      <div className="bezel-core flex h-full flex-col p-5">
        <div className="flex items-center justify-between">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--hair)] bg-white/[0.03] text-muted">
            {icon}
          </span>
          <span className="font-mono text-xs text-faint">{n}</span>
        </div>
        <h3 className="mt-4 text-[15px] font-semibold text-ink">{title}</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{body}</p>
        {gate && (
          <span className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--danger-soft)] bg-[var(--danger-soft)] px-2.5 py-1 text-[11px] font-medium text-danger">
            ✕ no A-Pass → stops here
          </span>
        )}
      </div>
    </div>
  );
}

function DemoButton({ tone, title, sub, loading, disabled, onClick }: { tone: "accent" | "danger"; title: string; sub: string; loading?: boolean; disabled?: boolean; onClick: () => void }) {
  const ring = tone === "accent" ? "hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]" : "hover:border-[var(--danger)] hover:bg-[var(--danger-soft)]";
  const dot = tone === "accent" ? "var(--accent)" : "var(--danger)";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group flex flex-col items-start gap-1 rounded-2xl border border-[var(--hair-strong)] bg-white/[0.02] p-4 text-left transition-[transform,background-color,border-color] duration-500 ease-[var(--ease)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--line-2)] disabled:cursor-not-allowed disabled:opacity-50 ${ring}`}
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-ink">
        <span className={`h-1.5 w-1.5 rounded-full ${loading ? "animate-ping" : ""}`} style={{ background: dot }} />
        {loading ? "Running…" : title}
      </span>
      <span className="text-[12px] leading-snug text-muted">{sub}</span>
    </button>
  );
}

function Stat({ d, label, value, accent }: { d: string; label: string; value: number; accent?: string }) {
  return (
    <div className="reveal bezel" style={{ ["--d" as string]: d }}>
      <div className="bezel-core p-5">
        <div className={`font-display text-4xl tabular-nums ${accent ?? "text-ink"}`}>{value}</div>
        <div className="mt-1.5 text-[10px] uppercase tracking-[0.14em] text-faint">{label}</div>
      </div>
    </div>
  );
}

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`text-[10px] font-semibold uppercase tracking-[0.22em] text-faint ${className ?? ""}`}>{children}</h2>;
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-6 py-3.5 font-medium">{children}</th>;
}

function Pill({ children, tone }: { children: React.ReactNode; tone: "accent" | "danger" | "muted" }) {
  const map = {
    accent: "border-[var(--accent-soft)] bg-[var(--accent-soft)] text-accent",
    danger: "border-[var(--danger-soft)] bg-[var(--danger-soft)] text-danger",
    muted: "border-[var(--hair)] bg-white/[0.03] text-muted",
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${map[tone]}`}>{children}</span>;
}

function TravelRuleCell({ r }: { r: ReceiptRecord }) {
  if (!r.travelRule) return <span className="text-faint">-</span>;
  const official = r.travelRule.officialReportUrl;
  const href = official && !official.includes("/mock-") ? official : `/api/travel-rule?id=${r.id}`;
  return (
    <a className="inline-flex items-center gap-1 text-[var(--gold)] transition-colors hover:text-[#f2d784]" href={href} target="_blank" rel="noreferrer">
      PDF <IconArrow />
    </a>
  );
}

function Footer() {
  return (
    <footer className="mt-10 flex flex-col gap-4 border-t border-[var(--line)] pt-7 text-xs text-faint sm:flex-row sm:items-center sm:justify-between">
      <p className="max-w-md leading-relaxed">
        Every payment is gated by Cleanverse A-Pass identity, settled in A-Token on Monad, and recorded with a
        Travel-Rule receipt, automatically.
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <span className="rounded-full border border-[var(--line)] px-2.5 py-1">x402</span>
        <span className="rounded-full border border-[var(--line)] px-2.5 py-1">Cleanverse A-Pass</span>
        <span className="rounded-full border border-[var(--line)] px-2.5 py-1">Monad</span>
      </div>
    </footer>
  );
}

/* marks & icons */

function Logo() {
  return (
    <span
      className="grid h-7 w-7 place-items-center rounded-[9px]"
      style={{
        background: "linear-gradient(150deg, var(--azure), #3f6dff 60%, var(--mint))",
        boxShadow: "0 0 16px rgba(91,140,255,.5), inset 0 1px 0 rgba(255,255,255,.4)",
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M5 12.5l4 4 10-10.5" stroke="#06122e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

const ip = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function IconLock() {
  return (
    <svg {...ip} aria-hidden>
      <rect x="4" y="11" width="16" height="9" rx="2.2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg {...ip} aria-hidden>
      <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
function IconChain() {
  return (
    <svg {...ip} aria-hidden>
      <path d="M9 15l6-6" />
      <path d="M8 13l-2 2a3 3 0 0 0 4 4l2-2" />
      <path d="M16 11l2-2a3 3 0 0 0-4-4l-2 2" />
    </svg>
  );
}
function IconDownload() {
  return (
    <svg {...ip} width={14} height={14} aria-hidden>
      <path d="M12 4v10" />
      <path d="M8 11l4 4 4-4" />
      <path d="M5 19h14" />
    </svg>
  );
}
function IconArrow() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path d="M7 17L17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
