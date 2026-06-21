import React, { useEffect, useState } from "react";
import { LogIn } from "lucide-react";
import Genesis from "./Genesis.jsx";
import AuthWidget from "./AuthWidget.jsx";
import {
  captureTokenFromUrl,
  getIdentity,
  login,
  isConfigured,
  enabledProviders,
} from "./auth.js";

/* Gate: the (unchanged) Genesis prototype is only mounted once the visitor is
 * signed in. Until then a full-screen sign-in screen is shown.
 *
 * Escape hatch: while the OAuth backend is not yet configured (auth-config.js
 * `base` is empty), the gate offers "Continue to preview" so the public URL is
 * not bricked before the backend is deployed. Once configured, it is a strict
 * gate. Genesis.jsx itself is never modified. */

const GithubMark = (props) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden {...props}>
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.5 11.5 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);
const GitlabMark = (props) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="#FC6D26" aria-hidden {...props}>
    <path d="m23.6004 9.5927-.0337-.0862L20.3.9814a.851.851 0 0 0-.3362-.405.8748.8748 0 0 0-.9997.0539.8748.8748 0 0 0-.29.4399l-2.2055 6.748H7.5375l-2.2057-6.748a.8573.8573 0 0 0-.29-.4412.8748.8748 0 0 0-.9997-.0537.8585.8585 0 0 0-.3362.4049L.4332 9.5015l-.0325.0862a6.0657 6.0657 0 0 0 2.0119 7.0105l.0113.0087.03.0213 4.976 3.7264 2.462 1.8633 1.4995 1.1321a1.0085 1.0085 0 0 0 1.2197 0l1.4995-1.1321 2.462-1.8633 5.006-3.7489.0125-.01a6.0682 6.0682 0 0 0 2.0094-7.003z" />
  </svg>
);
const MARKS = { github: GithubMark, gitlab: GitlabMark };
const LABELS = { github: "GitHub", gitlab: "GitLab" };

function GateScreen({ onPreview }) {
  const configured = isConfigured();
  const screen = {
    position: "fixed",
    inset: 0,
    zIndex: 10000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    background:
      "radial-gradient(1200px 600px at 50% -10%, #131A2B 0%, var(--ground, #0B0E16) 60%)",
    fontFamily: "var(--body, system-ui, sans-serif)",
    color: "var(--txt, #E7EBF4)",
  };
  const card = {
    width: "100%",
    maxWidth: 420,
    background: "var(--panel, #141A28)",
    border: "1px solid var(--line, #26304A)",
    borderRadius: 16,
    padding: 32,
    boxShadow: "0 20px 60px rgba(0,0,0,.5)",
    textAlign: "center",
  };
  const btn = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    width: "100%",
    padding: "12px 16px",
    background: "var(--panel2, #1B2334)",
    border: "1px solid var(--line2, #323E5C)",
    color: "var(--txt, #E7EBF4)",
    borderRadius: 10,
    font: "inherit",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  };
  const lbl = {
    fontFamily: "var(--mono, ui-monospace, monospace)",
    fontSize: 10,
    letterSpacing: ".18em",
    textTransform: "uppercase",
    color: "var(--txt3, #5E6B8A)",
  };

  return (
    <div style={screen}>
      <div style={card}>
        <div
          style={{
            width: 48,
            height: 48,
            margin: "0 auto 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid var(--amber-d, #B6863F)",
            borderRadius: 12,
            color: "var(--amber, #E8B566)",
          }}
        >
          <LogIn size={22} />
        </div>
        <div style={lbl}>Project Genesis</div>
        <h1 style={{ fontFamily: "var(--disp, system-ui)", fontSize: 26, margin: "8px 0 6px" }}>
          Sign in to enter
        </h1>
        <p style={{ color: "var(--txt2, #94A0BC)", fontSize: 14, margin: "0 0 22px", lineHeight: 1.5 }}>
          Authenticate with your developer identity to enter the settlement.
        </p>

        {configured ? (
          <div style={{ display: "grid", gap: 10 }}>
            {enabledProviders().map((p) => {
              const Mark = MARKS[p];
              return (
                <button key={p} type="button" style={btn} onClick={() => login(p)}>
                  {Mark ? <Mark /> : null}
                  Continue with {LABELS[p] || p}
                </button>
              );
            })}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            <div
              style={{
                fontSize: 12,
                color: "var(--txt3, #5E6B8A)",
                border: "1px dashed var(--line2, #323E5C)",
                borderRadius: 10,
                padding: "12px 14px",
                lineHeight: 1.5,
              }}
            >
              Sign-in backend not configured yet. Set{" "}
              <span style={{ color: "var(--amber, #E8B566)" }}>base</span> in{" "}
              <span style={{ fontFamily: "var(--mono, monospace)" }}>auth-config.js</span> to your
              deployed OAuth broker URL.
            </div>
            <button
              type="button"
              style={{ ...btn, background: "transparent", fontWeight: 500 }}
              onClick={onPreview}
            >
              Continue to preview →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthGate() {
  const [ready, setReady] = useState(false);
  const [identity, setIdentity] = useState(null);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    captureTokenFromUrl(); // pick up #token=... handed back by the broker
    setIdentity(getIdentity());
    setReady(true);
  }, []);

  if (!ready) return null;

  // Signed in (or previewing): mount the unchanged prototype + the sign-out / sign-in chip.
  if (identity || preview) {
    return (
      <>
        <Genesis />
        <AuthWidget />
      </>
    );
  }

  // Not signed in: gate.
  return <GateScreen onPreview={() => setPreview(true)} />;
}
