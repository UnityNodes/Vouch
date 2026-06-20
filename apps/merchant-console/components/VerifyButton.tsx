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
        setDetail(j.mode === "live" ? "Verified via 0G Compute" : "Mock attestation");
      } else {
        setState("fail");
        setDetail(j.error ?? "Attestation did not match");
      }
    } catch (e) {
      setState("fail");
      setDetail((e as Error).message);
    }
  }

  const label =
    state === "idle"
      ? "Re-check"
      : state === "loading"
        ? "Checking…"
        : state === "ok"
          ? "✅ Honest"
          : "❌ Tampered";

  const tooltip =
    attestation.verifiabilityKind === "TeeML"
      ? "Click to ask 0G Compute to re-run the original attestation check."
      : "Mock attestation - in live mode this would hit a real TEE provider.";

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "stretch", gap: 2 }}>
      <button
        onClick={go}
        disabled={state === "loading"}
        title={tooltip}
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
