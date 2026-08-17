import { useEffect, useState, type CSSProperties } from "react";
import {
  authorizeOperatorDevice,
  downloadJson,
  enrollProposalPasskey,
  isExpiredDeviceCapability,
  isCommitSha,
  isOperatorCapabilityExpiry,
  operatorCapabilityExpiryTeachingError,
  submitAutomaticProposal,
  ZETA_DEVICE_DELEGATION_STORAGE_KEY,
  ZETA_REPOSITORY,
  type DeviceCapability,
  type PasskeyEnrollment,
} from "../lib/passkeyProposal";
import {
  canQueueGeneratedVerification,
  canQueueSuppliedProposal,
  queueHarmlessVerification,
} from "../lib/verificationPatch";

const CREDENTIAL_STORAGE_KEY = "zeta-proposal-passkey-credential-id";
type PanelState = "idle" | "binding" | "enrolling" | "authorizing" | "ready" | "submitting" | "submitted" | "error";
type AuthorityBinding = { readonly baseSha: string; readonly sequence: number };

function retainedCapability(): DeviceCapability | null {
  try {
    const value = localStorage.getItem(ZETA_DEVICE_DELEGATION_STORAGE_KEY);
    return value === null ? null : (JSON.parse(value) as DeviceCapability);
  } catch {
    return null;
  }
}

async function fetchAuthorityBinding(): Promise<AuthorityBinding> {
  const response = await fetch(`https://api.github.com/repos/${ZETA_REPOSITORY}/commits/main`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!response.ok) throw new Error(`GitHub did not return main's commit SHA (HTTP ${response.status}).`);
  const commit = (await response.json()) as { sha?: unknown };
  if (typeof commit.sha !== "string" || !isCommitSha(commit.sha))
    throw new Error("GitHub returned an invalid main commit SHA.");
  const registryResponse = await fetch(
    `https://raw.githubusercontent.com/${ZETA_REPOSITORY}/${commit.sha}/docs/security/proposal-author-registry.json`,
  );
  const registry = (await registryResponse.json()) as { schema?: unknown; repository?: unknown; sequence?: unknown };
  if (
    !registryResponse.ok ||
    registry.schema !== "zeta.proposal-author-registry.v2" ||
    registry.repository !== ZETA_REPOSITORY ||
    typeof registry.sequence !== "number" ||
    registry.sequence < 0
  )
    throw new Error("GitHub returned an invalid author registry at the bound main commit.");
  return { baseSha: commit.sha, sequence: registry.sequence };
}

export default function PasskeyProposalPanel() {
  const [expanded, setExpanded] = useState(false);
  const [state, setState] = useState<PanelState>("idle");
  const [message, setMessage] = useState("No repository credential is stored or requested by this page.");
  const [baseSha, setBaseSha] = useState("");
  const [registrySequence, setRegistrySequence] = useState<number | null>(null);
  const [payload, setPayload] = useState("");
  const [credentialId, setCredentialId] = useState(() => localStorage.getItem(CREDENTIAL_STORAGE_KEY) ?? "");
  const [enrollment, setEnrollment] = useState<PasskeyEnrollment | null>(null);
  const [capability, setCapability] = useState<DeviceCapability | null>(retainedCapability);

  useEffect(() => {
    if (expanded && !isCommitSha(baseSha)) void bindAuthority();
  }, [expanded]);

  const bindAuthority = async () => {
    setState("binding");
    try {
      const binding = await fetchAuthorityBinding();
      setBaseSha(binding.baseSha);
      setRegistrySequence(binding.sequence);
      setState("ready");
      setMessage(
        `Bound to main ${binding.baseSha.slice(0, 12)} and author registry sequence ${binding.sequence.toString()}.`,
      );
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not retrieve the current authority binding.");
    }
  };
  const enroll = async () => {
    setState("enrolling");
    try {
      const record = await enrollProposalPasskey();
      setEnrollment(record);
      setCredentialId(record.credentialId);
      localStorage.setItem(CREDENTIAL_STORAGE_KEY, record.credentialId);
      setState("ready");
      setMessage(
        "Passkey created. Export its public enrollment record for protected review; it has no direct repository authority.",
      );
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Passkey enrollment did not complete.");
    }
  };
  const authorize = async () => {
    setState("authorizing");
    try {
      if (registrySequence === null)
        throw new Error("Refresh the protected authority binding before authorizing this device.");
      const result = await authorizeOperatorDevice(credentialId, registrySequence);
      setCapability(result);
      localStorage.setItem(ZETA_DEVICE_DELEGATION_STORAGE_KEY, JSON.stringify(result));
      setState("ready");
      setMessage(
        `The reviewed passkey remains your durable authority. This browser now holds a delegated capability until ${new Date(result.expiresAt).toLocaleTimeString()}; after expiry or revocation, authorize this device again before queuing a bounded patch.`,
      );
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "This device was not authorized.");
    }
  };
  const queue = async (payloadToSubmit = payload) => {
    if (!capability || registrySequence === null) return;
    if (isExpiredDeviceCapability(capability)) {
      localStorage.removeItem(ZETA_DEVICE_DELEGATION_STORAGE_KEY);
      setCapability(null);
      setState("ready");
      setMessage(operatorCapabilityExpiryTeachingError().message);
      return;
    }
    setState("submitting");
    try {
      const result = await submitAutomaticProposal({ capability, baseSha, payload: payloadToSubmit });
      setState("submitted");
      setMessage(`${result.message} Proposal ${result.proposalId.slice(0, 8)} is staged for bounded Action review delivery.`);
    } catch (error) {
      if (isOperatorCapabilityExpiry(error)) {
        localStorage.removeItem(ZETA_DEVICE_DELEGATION_STORAGE_KEY);
        setCapability(null);
        setState("ready");
        setMessage(operatorCapabilityExpiryTeachingError().message);
        return;
      }
      setState("error");
      setMessage(error instanceof Error ? error.message : "Automatic proposal delivery failed.");
    }
  };
  const queueVerification = async () => {
    try {
      await queueHarmlessVerification({
        baseSha,
        submit: async (generated) => {
          setPayload(generated);
          await queue(generated);
        },
      });
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "The local verification agent could not generate a bounded patch.");
    }
  };
  const canGenerate = canQueueGeneratedVerification({ capability, registrySequence, baseSha });
  const canSupply = canQueueSuppliedProposal({ capability, registrySequence, baseSha, payload });
  const buttonStyle = (active: boolean): CSSProperties => ({
    background: active ? "rgba(16,185,129,0.12)" : "rgba(71,85,105,0.16)",
    border: `1px solid ${active ? "#059669" : "#475569"}`,
    borderRadius: 3,
    color: active ? "#a7f3d0" : "#64748b",
    fontSize: "0.5rem",
    cursor: active ? "pointer" : "not-allowed",
    padding: "0.12rem 0.35rem",
  });
  const statusColor = state === "error" ? "#fca5a5" : state === "submitted" ? "#6ee7b7" : "#94a3b8";

  return (
    <div
      style={{
        margin: "0.6rem 0",
        padding: "0.55rem 0.7rem",
        background: "rgba(59,130,246,0.06)",
        border: "1px solid rgba(59,130,246,0.28)",
        borderRadius: 5,
        fontFamily: "monospace",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
        <div>
          <div style={{ color: "#93c5fd", fontSize: "0.63rem", fontWeight: 700 }}>
            Agent proposals: automatic · human authority: one-time device passkey
          </div>
          <div style={{ color: "#64748b", fontSize: "0.47rem", marginTop: "0.08rem" }}>
            Local AI/BNN proposes; the verifier and Action create gated review branches. This page never holds a
            repository key.
          </div>
        </div>
        <button
          onClick={() => setExpanded((value) => !value)}
          style={{
            background: "rgba(37,99,235,0.14)",
            border: "1px solid #1d4ed8",
            borderRadius: 3,
            color: "#bfdbfe",
            fontSize: "0.5rem",
            cursor: "pointer",
            padding: "0.12rem 0.35rem",
          }}
        >
          {expanded ? "▲ hide agent controls" : "▼ authorize & queue"}
        </button>
      </div>
      {expanded && (
        <div style={{ marginTop: "0.45rem", fontSize: "0.53rem", color: "#cbd5e1", lineHeight: 1.5 }}>
          <div
            style={{
              padding: "0.3rem 0.4rem",
              background: "rgba(16,185,129,0.06)",
              borderLeft: "2px solid #10b981",
              marginBottom: "0.35rem",
              color: "#a7f3d0",
            }}
          >
            <strong>Routine path: durable passkey, short-lived delegation.</strong> The reviewed passkey is the
            persistent authority. A user-verified prompt mints this browser a deliberately short-lived delegated
            capability; browser-local agents use that delegation to submit bounded patches directly to the trusted
            verifier. No loopback companion, GitHub issue form, or browser-held repository key is involved.
          </div>
          <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", marginBottom: "0.35rem" }}>
            <button
              onClick={bindAuthority}
              disabled={state === "binding"}
              style={{
                background: "rgba(59,130,246,0.12)",
                border: "1px solid #2563eb",
                borderRadius: 3,
                color: "#bfdbfe",
                fontSize: "0.5rem",
                cursor: "pointer",
                padding: "0.12rem 0.35rem",
              }}
            >
              {state === "binding" ? "binding protected main…" : "refresh authority binding"}
            </button>
            <button
              onClick={enroll}
              disabled={credentialId.length > 0 || state === "enrolling"}
              style={buttonStyle(credentialId.length === 0)}
            >
              {state === "enrolling"
                ? "device passkey prompt…"
                : credentialId.length > 0
                  ? "device passkey ready"
                  : "first time: enroll device passkey"}
            </button>
            {enrollment && (
              <button onClick={() => downloadJson("zeta-proposal-author.json", enrollment)} style={buttonStyle(true)}>
                export public enrollment
              </button>
            )}
            <button
              onClick={authorize}
              disabled={credentialId.length === 0 || state === "authorizing"}
              style={buttonStyle(credentialId.length > 0)}
            >
              {state === "authorizing"
                ? "device passkey prompt…"
                : capability
                  ? "delegated capability active"
                  : "authorize this device"}
            </button>
          </div>
          <label style={{ display: "block", color: "#64748b", marginBottom: "0.1rem" }}>
            Bound main SHA — refresh after changing intended work
          </label>
          <input
            value={baseSha}
            onChange={(event) => setBaseSha(event.target.value.trim())}
            placeholder="Use ‘refresh authority binding’"
            spellCheck={false}
            style={{
              display: "block",
              width: "100%",
              boxSizing: "border-box",
              background: "#0f172a",
              border: `1px solid ${baseSha.length === 0 || isCommitSha(baseSha) ? "#334155" : "#ef4444"}`,
              color: "#cbd5e1",
              borderRadius: 3,
              padding: "0.25rem 0.35rem",
              fontSize: "0.5rem",
              fontFamily: "monospace",
            }}
          />
          <label style={{ display: "block", color: "#64748b", margin: "0.35rem 0 0.1rem" }}>
            Automatic local-agent verification
          </label>
          <button
            onClick={queueVerification}
            disabled={!canGenerate || state === "submitting"}
            style={{ ...buttonStyle(canGenerate), marginBottom: "0.35rem" }}
          >
            {state === "submitting" ? "queueing automatic proposal…" : "queue harmless verification"}
          </button>
          <details style={{ marginTop: "0.08rem" }}>
            <summary style={{ color: "#64748b", cursor: "pointer" }}>advanced: supply an exact local-agent unified patch</summary>
          <textarea
            value={payload}
            onChange={(event) => setPayload(event.target.value)}
            placeholder={
              "diff --git a/docs/example.md b/docs/example.md\n--- a/docs/example.md\n+++ b/docs/example.md\n@@ -1 +1 @@\n-old\n+new"
            }
            rows={6}
            style={{
              display: "block",
              resize: "vertical",
              width: "100%",
              boxSizing: "border-box",
              background: "#0f172a",
              border: "1px solid #334155",
              color: "#cbd5e1",
              borderRadius: 3,
              padding: "0.3rem 0.35rem",
              fontSize: "0.52rem",
              fontFamily: "monospace",
              lineHeight: 1.45,
            }}
          />
          </details>
          <div style={{ marginTop: "0.32rem" }}>
            <button onClick={() => void queue()} disabled={!canSupply || state === "submitting"} style={buttonStyle(canSupply)}>
              {state === "submitting" ? "queueing automatic proposal…" : "queue supplied proposal"}
            </button>
          </div>
          <div style={{ color: statusColor, fontSize: "0.48rem", marginTop: "0.32rem" }}>{message}</div>
          <div style={{ color: "#475569", fontSize: "0.44rem", marginTop: "0.25rem" }}>
            The executor rejects an expired, unrecognized, or revoked delegated authority; stale base SHA;
            oversize/non-unified patch; protected-path edit; replay; or origin/RP-ID mismatch before creating any
            review branch. Expiry removes only the local delegation, never the reviewed passkey enrollment.
          </div>
        </div>
      )}
    </div>
  );
}
