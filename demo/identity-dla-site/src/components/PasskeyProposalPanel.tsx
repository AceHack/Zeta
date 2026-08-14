import { useState } from "react";
import {
  createProposalIntent,
  downloadJson,
  enrollProposalPasskey,
  githubNewIssueUrl,
  isCommitSha,
  proposalIssueBody,
  signProposal,
  ZETA_REPOSITORY,
  type PasskeyEnrollment,
} from "../lib/passkeyProposal";

const CREDENTIAL_STORAGE_KEY = "zeta-proposal-passkey-credential-id";

type PanelState = "idle" | "loading-base" | "enrolling" | "ready" | "signing" | "signed" | "error";

type ProposalAuthorityBinding = {
  readonly baseSha: string;
  readonly authorRegistrySequence: number;
};

async function fetchAuthorityBinding(): Promise<ProposalAuthorityBinding> {
  const response = await fetch(`https://api.github.com/repos/${ZETA_REPOSITORY}/commits/main`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!response.ok) throw new Error(`GitHub did not return main's commit SHA (HTTP ${response.status}).`);
  const json = (await response.json()) as { sha?: unknown };
  if (typeof json.sha !== "string" || !isCommitSha(json.sha))
    throw new Error("GitHub returned an invalid main commit SHA.");
  const registryResponse = await fetch(
    `https://raw.githubusercontent.com/${ZETA_REPOSITORY}/${json.sha}/docs/security/proposal-author-registry.json`,
  );
  if (!registryResponse.ok)
    throw new Error(`GitHub did not return the author registry at the bound commit (HTTP ${registryResponse.status}).`);
  const registry = (await registryResponse.json()) as { schema?: unknown; repository?: unknown; sequence?: unknown };
  if (
    registry.schema !== "zeta.proposal-author-registry.v2" ||
    registry.repository !== ZETA_REPOSITORY ||
    typeof registry.sequence !== "number" ||
    !Number.isSafeInteger(registry.sequence) ||
    registry.sequence < 0
  ) {
    throw new Error("GitHub returned an invalid proposal-author registry.");
  }
  return { baseSha: json.sha, authorRegistrySequence: registry.sequence };
}

export default function PasskeyProposalPanel() {
  const [expanded, setExpanded] = useState(false);
  const [state, setState] = useState<PanelState>("idle");
  const [message, setMessage] = useState("No GitHub token is stored or requested by this page.");
  const [baseSha, setBaseSha] = useState("");
  const [authorRegistrySequence, setAuthorRegistrySequence] = useState<number | null>(null);
  const [payload, setPayload] = useState("");
  const [credentialId, setCredentialId] = useState(() => localStorage.getItem(CREDENTIAL_STORAGE_KEY) ?? "");
  const [enrollment, setEnrollment] = useState<PasskeyEnrollment | null>(null);
  const [issueUrl, setIssueUrl] = useState<string | null>(null);

  const loadBaseSha = async () => {
    setState("loading-base");
    setIssueUrl(null);
    try {
      const binding = await fetchAuthorityBinding();
      setBaseSha(binding.baseSha);
      setAuthorRegistrySequence(binding.authorRegistrySequence);
      setState("ready");
      setMessage(
        `Bound to immutable main commit ${binding.baseSha.slice(0, 12)} and author registry sequence ${binding.authorRegistrySequence.toString()}.`,
      );
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not retrieve the current main SHA.");
    }
  };

  const enroll = async () => {
    setState("enrolling");
    setIssueUrl(null);
    try {
      const registered = await enrollProposalPasskey();
      setEnrollment(registered);
      setCredentialId(registered.credentialId);
      localStorage.setItem(CREDENTIAL_STORAGE_KEY, registered.credentialId);
      setState("ready");
      setMessage(
        "Passkey created. Export its public enrollment package for a maintainer to add to the authorized author registry; enrollment itself gives no repository write authority.",
      );
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Passkey enrollment did not complete.");
    }
  };

  const createSignedProposal = async () => {
    setState("signing");
    setIssueUrl(null);
    try {
      if (authorRegistrySequence === null)
        throw new Error("Bind the current main commit and author registry before signing.");
      const intent = await createProposalIntent({ baseSha, payload, credentialId, authorRegistrySequence });
      const proposal = await signProposal(intent);
      const url = githubNewIssueUrl(`proposal: ${proposal.proposalId}`, proposalIssueBody(payload, proposal));
      setIssueUrl(url);
      setState("signed");
      setMessage(
        "Passkey assertion created. Open GitHub’s issue form to submit it using your own GitHub session; this page never sees that session or a token.",
      );
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "The proposal was not signed.");
    }
  };

  const canSign =
    isCommitSha(baseSha) && authorRegistrySequence !== null && payload.trim().length > 0 && credentialId.length > 0;
  const statusColor = state === "error" ? "#fca5a5" : state === "signed" ? "#6ee7b7" : "#94a3b8";

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
          <div style={{ color: "#93c5fd", fontSize: "0.63rem", fontWeight: 700 }}>Passkey proposal → gated commit</div>
          <div style={{ color: "#64748b", fontSize: "0.47rem", marginTop: "0.08rem" }}>
            Passkey identifies the proposer; a GitHub Action verifies and executes only a branch proposal.
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
          {expanded ? "▲ hide" : "▼ propose"}
        </button>
      </div>
      {expanded && (
        <div style={{ marginTop: "0.45rem", fontSize: "0.53rem", color: "#cbd5e1", lineHeight: 1.5 }}>
          <div
            style={{
              padding: "0.3rem 0.4rem",
              background: "rgba(15,23,42,0.72)",
              borderLeft: "2px solid #3b82f6",
              marginBottom: "0.35rem",
              color: "#94a3b8",
            }}
          >
            This PWA does <strong style={{ color: "#e2e8f0" }}>not</strong> log you into GitHub or hold a shared GitHub
            key. It asks the operating system or security key for a user-verified passkey assertion. GitHub&apos;s own
            issue form authenticates the submitter; the later Action owns the bounded branch write.
          </div>
          <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", marginBottom: "0.35rem" }}>
            <button
              onClick={loadBaseSha}
              disabled={state === "loading-base"}
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
              {state === "loading-base" ? "loading main…" : "1. bind main SHA"}
            </button>
            <button
              onClick={enroll}
              disabled={state === "enrolling"}
              style={{
                background: "rgba(139,92,246,0.12)",
                border: "1px solid #7c3aed",
                borderRadius: 3,
                color: "#ddd6fe",
                fontSize: "0.5rem",
                cursor: "pointer",
                padding: "0.12rem 0.35rem",
              }}
            >
              {state === "enrolling" ? "passkey prompt…" : "2. enroll passkey"}
            </button>
            {enrollment && (
              <button
                onClick={() => downloadJson("zeta-proposal-author.json", enrollment)}
                style={{
                  background: "rgba(16,185,129,0.12)",
                  border: "1px solid #047857",
                  borderRadius: 3,
                  color: "#a7f3d0",
                  fontSize: "0.5rem",
                  cursor: "pointer",
                  padding: "0.12rem 0.35rem",
                }}
              >
                download enrollment
              </button>
            )}
          </div>
          <label style={{ display: "block", color: "#64748b", marginBottom: "0.1rem" }}>
            Base SHA — immutable revision the proposal was reviewed against
          </label>
          <input
            value={baseSha}
            onChange={(event) => setBaseSha(event.target.value.trim())}
            placeholder="Use ‘bind main SHA’"
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
            Requested change — exact unified Git patch, included in the signed SHA-256 payload
          </label>
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
          <div style={{ marginTop: "0.32rem", display: "flex", gap: "0.3rem", alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={createSignedProposal}
              disabled={!canSign || state === "signing"}
              style={{
                background: canSign ? "rgba(16,185,129,0.15)" : "rgba(71,85,105,0.16)",
                border: `1px solid ${canSign ? "#059669" : "#475569"}`,
                borderRadius: 3,
                color: canSign ? "#a7f3d0" : "#64748b",
                fontSize: "0.5rem",
                cursor: canSign ? "pointer" : "not-allowed",
                padding: "0.14rem 0.4rem",
              }}
            >
              {state === "signing" ? "passkey prompt…" : "3. sign proposal"}
            </button>
            {issueUrl && (
              <a
                href={issueUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: "#bfdbfe",
                  border: "1px solid #1d4ed8",
                  background: "rgba(37,99,235,0.12)",
                  borderRadius: 3,
                  padding: "0.14rem 0.4rem",
                  textDecoration: "none",
                  fontSize: "0.5rem",
                }}
              >
                4. submit on GitHub ↗
              </a>
            )}
          </div>
          <div style={{ color: statusColor, fontSize: "0.48rem", marginTop: "0.32rem" }}>{message}</div>
          <div style={{ color: "#475569", fontSize: "0.44rem", marginTop: "0.25rem" }}>
            Verifier rejection is expected for an unenrolled passkey, expired envelope, replayed nonce, mismatched
            repository/ref, changed payload, or origin/RP-ID mismatch. Each rejection returns a correction path rather
            than silently accepting or discarding evidence.
          </div>
        </div>
      )}
    </div>
  );
}
