"use client";

import { useState } from "react";

interface AttestationRef {
  providerAddress: string;
  chatId: string;
  verifiabilityKind: "TeeML" | "mock";
}

interface VerifyButtonProps {
  attestation: AttestationRef;
  /** demo-merchant base URL (it owns /api/reverify which hits broker.processResponse). */
  merchantOrigin?: string;
}

type State = "idle" | "loading" | "ok" | "fail";

export function VerifyButton({ attestation, merchantOrigin }: VerifyButtonProps) {
  const [state, setState] = useState<State>("idle");
  const [detail, setDetail] = useState<string>("");

  async function go() {
    setState("loading");
    setDetail("");
    try {
      const base = merchantOrigin ?? process.env.NEXT_PUBLIC_DEMO_MERCHANT_URL ?? "http://localhost:4020";
      const r = await fetch(`${base.replace(/\/$/, "")}/api/reverify`, {
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
        setDetail(`mode=${j.mode}`);
      } else {
        setState("fail");
        setDetail(j.error ?? `raw=${JSON.stringify(j.raw)}`);
      }
    } catch (e) {
      setState("fail");
      setDetail((e as Error).message);
    }
  }

  const label =
    state === "idle"
      ? "Verify"
      : state === "loading"
        ? "…"
        : state === "ok"
          ? "✅ Verified"
          : "❌ Failed";

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "stretch", gap: 2 }}>
      <button
        onClick={go}
        disabled={state === "loading"}
        title={`${attestation.verifiabilityKind} attestation${detail ? " · " + detail : ""}`}
        style={{
          padding: "4px 10px",
          fontSize: 12,
          borderRadius: 6,
          border: "1px solid #333",
          background:
            state === "ok" ? "#0a8" : state === "fail" ? "#c33" : "#1a1a1a",
          color: state === "idle" || state === "loading" ? "#eee" : "white",
          cursor: state === "loading" ? "wait" : "pointer",
        }}
      >
        {label}
      </button>
      {detail && (
        <span style={{ fontSize: 10, color: "#888", marginTop: 2 }}>
          {detail}
        </span>
      )}
    </span>
  );
}
