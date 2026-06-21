import React, { useEffect, useState } from "react";
import { LogIn, LogOut, User, ChevronDown } from "lucide-react";
import { getIdentity, login, logout, isConfigured, enabledProviders } from "./auth.js";

/* Small sign-in overlay shown on top of the (unchanged) Genesis prototype.
 * Identity-only: after sign-in it shows avatar + name + provider + sign-out.
 * Styled with the prototype's own CSS variables (with hard fallbacks) so it
 * blends with the dark "Vault-Tec" aesthetic without touching Genesis.jsx. */

const GithubMark = (props) => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden {...props}>
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.5 11.5 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

const GitlabMark = (props) => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="#FC6D26" aria-hidden {...props}>
    <path d="m23.6004 9.5927-.0337-.0862L20.3.9814a.851.851 0 0 0-.3362-.405.8748.8748 0 0 0-.9997.0539.8748.8748 0 0 0-.29.4399l-2.2055 6.748H7.5375l-2.2057-6.748a.8573.8573 0 0 0-.29-.4412.8748.8748 0 0 0-.9997-.0537.8585.8585 0 0 0-.3362.4049L.4332 9.5015l-.0325.0862a6.0657 6.0657 0 0 0 2.0119 7.0105l.0113.0087.03.0213 4.976 3.7264 2.462 1.8633 1.4995 1.1321a1.0085 1.0085 0 0 0 1.2197 0l1.4995-1.1321 2.462-1.8633 5.006-3.7489.0125-.01a6.0682 6.0682 0 0 0 2.0094-7.003z" />
  </svg>
);

const MARKS = { github: GithubMark, gitlab: GitlabMark };
const LABELS = { github: "GitHub", gitlab: "GitLab" };

const panel = {
  fontFamily: "var(--mono, ui-monospace, monospace)",
  background: "var(--panel2, #1B2334)",
  border: "1px solid var(--line2, #323E5C)",
  color: "var(--txt, #E7EBF4)",
  borderRadius: 10,
  boxShadow: "0 8px 24px rgba(0,0,0,.45)",
};

const btn = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  padding: "8px 12px",
  background: "var(--panel, #141A28)",
  border: "1px solid var(--line, #26304A)",
  color: "var(--txt, #E7EBF4)",
  borderRadius: 8,
  font: "inherit",
  fontSize: 12,
  letterSpacing: ".04em",
  cursor: "pointer",
};

export default function AuthWidget() {
  const [identity, setIdentity] = useState(() => getIdentity());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Re-read once after mount in case the token was just captured from the URL.
    setIdentity(getIdentity());
  }, []);

  const wrap = { position: "fixed", top: 14, right: 14, zIndex: 9999, ...panel };

  if (identity) {
    return (
      <div style={{ ...wrap, display: "flex", alignItems: "center", gap: 10, padding: "7px 10px 7px 8px" }}>
        {identity.picture ? (
          <img
            src={identity.picture}
            alt=""
            width={26}
            height={26}
            style={{ borderRadius: "50%", border: "1px solid var(--line2,#323E5C)" }}
          />
        ) : (
          <User size={18} />
        )}
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontFamily: "var(--body, system-ui)", fontSize: 13, fontWeight: 600 }}>
            {identity.name}
          </div>
          <div style={{ fontSize: 10, color: "var(--txt3, #5E6B8A)", letterSpacing: ".12em", textTransform: "uppercase" }}>
            {LABELS[identity.provider] || identity.provider}
            {identity.login ? ` · @${identity.login}` : ""}
          </div>
        </div>
        <button
          type="button"
          title="Sign out"
          onClick={() => { logout(); setIdentity(null); setOpen(false); }}
          style={{ ...btn, width: "auto", padding: 7, marginLeft: 4 }}
        >
          <LogOut size={15} />
        </button>
      </div>
    );
  }

  if (!isConfigured()) {
    return (
      <div
        style={{ ...wrap, padding: "8px 12px", fontSize: 11, color: "var(--txt3, #5E6B8A)", maxWidth: 240 }}
        title="Set window.__GENESIS_AUTH__.base in auth-config.js to your deployed OAuth broker URL."
      >
        Sign-in: set <span style={{ color: "var(--amber, #E8B566)" }}>base</span> in auth-config.js
      </div>
    );
  }

  return (
    <div style={{ ...wrap, padding: 8, width: open ? 200 : "auto" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ ...btn, justifyContent: "space-between" }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <LogIn size={15} /> Sign in
        </span>
        <ChevronDown size={14} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>
      {open && (
        <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
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
      )}
    </div>
  );
}
