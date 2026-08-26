// provider-roster.ts — declare every paid login the custom agent harness owns (data, not code).
//
// Aaron 2026-08-26: device login first; other account OAuth if the vendor has no
// device grant; prefer remote/no-browser; vendor-CLI login + token import when we
// cannot reverse their flow. Adding a provider is a DATA change.

import { preferredFlow, type LoginFlow } from "./login-ladder.ts";

export type LoginKind = "account-oauth" | "account-cli-session" | "account-api-key" | "api-key-secondary";

/// How far the harness has actually taken this provider. `wired` means
/// `harny login <id>` actually persists a session (native device flow, or
/// Manus account API key from --from-file) into ~/.config/zeta/auth.
export type ProviderStatus = "wired" | "declared" | "api-key-only";

export interface ProviderEntry {
  readonly id: string;
  readonly displayName: string;
  readonly loginKind: LoginKind;
  readonly status: ProviderStatus;
  /// Token-store key. Codex shares the ChatGPT account → store as `openai`.
  readonly storeAs: string;
  readonly aliases: readonly string[];
  readonly personaScoped: boolean;
  /// Vendor CLI the loop still spawnSyncs today (the thing we are replacing).
  readonly vendorCli: string | null;
  /// Where the VENDOR keeps its session today — also the import source.
  readonly vendorCredPaths: readonly string[];
  /// Flows the vendor is known to offer, ranked by login-ladder.ts.
  readonly flows: readonly LoginFlow[];
  /// Manus (and similar) run on the vendor's cloud — local Ace/Zeta tools do not apply.
  readonly execution: "local" | "remote-only";
  readonly notes: string;
}

export const PROVIDER_ROSTER: readonly ProviderEntry[] = [
  {
    id: "github",
    displayName: "GitHub",
    loginKind: "account-oauth",
    status: "wired",
    storeAs: "github",
    aliases: ["gh"],
    personaScoped: true,
    vendorCli: "gh",
    vendorCredPaths: ["~/.config/gh/hosts.yml"],
    flows: ["device-code", "vendor-cli-import"],
    execution: "local",
    notes: "RFC 8628 device flow live. Import from gh hosts.yml if they already ran `gh auth login`.",
  },
  {
    id: "openai",
    displayName: "OpenAI ChatGPT",
    loginKind: "account-oauth",
    status: "wired",
    storeAs: "openai",
    aliases: ["chatgpt"],
    personaScoped: true,
    vendorCli: null,
    vendorCredPaths: ["~/.codex/auth.json"],
    flows: ["device-code", "paste-code", "vendor-cli-import", "pkce-localhost"],
    execution: "local",
    notes: "Device + PKCE live (openai-auth.ts). Codex CLI session is importable as a fallback.",
  },
  {
    id: "codex",
    displayName: "OpenAI Codex",
    loginKind: "account-oauth",
    status: "wired",
    storeAs: "openai",
    aliases: [],
    personaScoped: true,
    vendorCli: "codex",
    vendorCredPaths: ["~/.codex/auth.json"],
    flows: ["device-code", "paste-code", "vendor-cli-import", "pkce-localhost"],
    execution: "local",
    notes: "Same ChatGPT account as openai. `codex login` then `zeta-login import codex` is the no-reverse-engineer path.",
  },
  {
    id: "claude",
    displayName: "Anthropic Claude",
    loginKind: "account-oauth",
    status: "declared",
    storeAs: "claude",
    aliases: ["anthropic"],
    personaScoped: true,
    vendorCli: "claude",
    vendorCredPaths: ["~/.config/claude/credentials.json", "~/.claude/.credentials.json"],
    flows: ["paste-code", "vendor-cli-import", "pkce-localhost", "api-key"],
    execution: "local",
    notes: "No RFC 8628 (Claude Code issue 22992). --no-browser paste-code on their CLI; we import the session until we wire paste-code ourselves.",
  },
  {
    id: "grok",
    displayName: "xAI Grok",
    loginKind: "account-oauth",
    status: "declared",
    storeAs: "grok",
    aliases: ["xai"],
    personaScoped: true,
    vendorCli: "grok",
    vendorCredPaths: ["~/.grok/auth.json"],
    flows: ["device-code", "vendor-cli-import", "pkce-localhost", "api-key"],
    execution: "local",
    notes: "auth.x.ai advertises device_authorization_endpoint (OIDC). We lack a public client_id, so today: `grok login --device-auth` then import ~/.grok/auth.json.",
  },
  {
    id: "gemini",
    displayName: "Google Gemini",
    loginKind: "account-oauth",
    status: "declared",
    storeAs: "gemini",
    aliases: ["google"],
    personaScoped: true,
    vendorCli: "agy",
    vendorCredPaths: ["~/.gemini/oauth_creds.json"],
    flows: ["vendor-cli-import", "pkce-localhost", "api-key"],
    execution: "local",
    notes: "Gemini CLI is localhost PKCE; Google device-code exists but not for Code Assist scopes. Import oauth_creds.json after `gemini`/`agy` login. Headless they document as API key.",
  },
  {
    id: "kiro",
    displayName: "Amazon Kiro",
    loginKind: "account-oauth",
    status: "declared",
    storeAs: "kiro",
    aliases: [],
    personaScoped: true,
    vendorCli: "kiro-cli",
    vendorCredPaths: ["~/.aws/sso/cache/kiro-auth-token.json"],
    flows: ["device-code", "vendor-cli-import", "pkce-localhost", "api-key"],
    execution: "local",
    notes: "kiro-cli login --use-device-flow is documented for SSH. Import their cache until we own Builder ID / IdC device endpoints.",
  },
  {
    id: "manus",
    displayName: "Manus",
    loginKind: "account-api-key",
    status: "wired",
    storeAs: "manus",
    aliases: [],
    personaScoped: false,
    vendorCli: null,
    vendorCredPaths: [],
    flows: ["api-key"],
    execution: "remote-only",
    notes: "Account login IS their API key (no extra per-call billing). Always runs on Manus cloud — Harny cannot give it local Ace/Zeta tools. `harny login manus --from-file`.",
  },
];

export function resolveProvider(idOrAlias: string): ProviderEntry | null {
  const needle = idOrAlias.trim().toLowerCase();
  if (needle.length === 0) return null;
  for (const p of PROVIDER_ROSTER) {
    if (p.id === needle) return p;
    if (p.aliases.some((a) => a === needle)) return p;
  }
  return null;
}

export function wiredProviders(): readonly ProviderEntry[] {
  return PROVIDER_ROSTER.filter((p) => p.status === "wired");
}

export function preferredLogin(entry: ProviderEntry): LoginFlow | null {
  return preferredFlow(entry.flows);
}

export function uniqueStoreKeys(): readonly string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const p of PROVIDER_ROSTER) {
    if (seen.has(p.storeAs)) continue;
    seen.add(p.storeAs);
    keys.push(p.storeAs);
  }
  return keys;
}
