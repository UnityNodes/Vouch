"use client";

import { useState } from "react";

interface AttestationRef {
  providerAddress: string;
  chatId: string;
  verifiabilityKind: "TeeML" | "mock";
}

interface VerifyButtonProps {
  attestation: AttestationRef;
}

type State = "idle" | "loading" | "ok" | "fail";

export function VerifyButton({ attestation }: VerifyButtonProps) {
  const [state, setState] = useState<State>("idle");
  const [detail, setDetail] = useState<string>("");

  async function go() {
    setState("loading");
    setDetail("");
    try {
      const r = await fetch(`/api/reverify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerAddress: attestation.providerAddress,
          chatId: attestation.chatId,
        }),
      });
      const j = await r.json();
      if (j.verified) {
        setState("ok");
        setDetail(j.mode === "live" ? "via 0G Compute" : "mock attestation");
      } else {
        setState("fail");
        setDetail(j.error ?? "verdict did not match");
      }
    } catch (e) {
      setState("fail");
      setDetail((e as Error).message);
    }
  }

  const tooltip =
    attestation.verifiabilityKind === "TeeML"
      ? "Re-run the original TEE attestation through 0G Compute."
      : "Mock attestation - live mode hits a real TEE provider.";

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start" }}>
      <button
        className={`recheck ${state}`}
        onClick={go}
        disabled={state === "loading"}
        title={tooltip}
      >
        {state === "idle" && (
          <>
            <Loop /> Re-check
          </>
        )}
        {state === "loading" && <span style={{ position: "relative", zIndex: 1 }}>Checking…</span>}
        {state === "ok" && (
          <>
            <Tick /> Honest
          </>
        )}
        {state === "fail" && (
          <>
            <Cross /> Tampered
          </>
        )}
      </button>
      {detail && <span className="recheck-detail">{detail}</span>}
    </span>
  );
}

function Loop() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M3 12a9 9 0 0 1 15.5-6.2M21 12a9 9 0 0 1-15.5 6.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M18 3v3.5h-3.5M6 21v-3.5h3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Tick() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 12l2.5 2.5L16 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Cross() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
