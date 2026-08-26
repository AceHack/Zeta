// import-vendor-session.ts — copy a token the vendor CLI already minted.
//
// Aaron 2026-08-26: if we cannot reverse a vendor's login, use their CLI
// to log in and share the token. This is that share: parse known session
// files (Claude, Codex, Grok, Gemini, gh hosts.yml, Kiro SSO cache) into
// OUR TokenStore. No network. Tokens never go to stdout from this module.

import type { OAuthTokens } from "./auth-provider.ts";

export type ImportOutcome =
  | { readonly ok: true; readonly tokens: OAuthTokens; readonly path: string }
  | { readonly ok: false; readonly error: string };

export function expandHome(path: string, home: string): string {
  if (path === "~") return home;
  if (path.startsWith("~/")) {
    const base = home.endsWith("/") ? home.slice(0, -1) : home;
    return `${base}${path.slice(1)}`;
  }
  return path;
}

/// Pull access+refresh from the JSON shapes vendor CLIs actually write.
/// Codex nests under `tokens`; Claude Code nests under `claudeAiOauth`;
/// Google/Gemini and Grok use top-level snake_case or camelCase.
export function tokensFromVendorJson(raw: string): OAuthTokens | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const root = parsed as Record<string, unknown>;

  const fromCodex = readCodexShape(root.tokens);
  if (fromCodex) return fromCodex;

  const fromClaude = readClaudeShape(root.claudeAiOauth);
  if (fromClaude) return fromClaude;

  const fromTop = readTokenPair(root);
  if (fromTop) return fromTop;

  return null;
}

function readCodexShape(tokens: unknown): OAuthTokens | null {
  if (typeof tokens !== "object" || tokens === null) return null;
  return readTokenPair(tokens as Record<string, unknown>);
}

function readClaudeShape(oauth: unknown): OAuthTokens | null {
  if (typeof oauth !== "object" || oauth === null) return null;
  return readTokenPair(oauth as Record<string, unknown>);
}

function readTokenPair(obj: Record<string, unknown>): OAuthTokens | null {
  const access = stringField(obj, ["access_token", "accessToken", "token", "oauth_token"]);
  if (access === null) return null;
  const refresh = stringField(obj, ["refresh_token", "refreshToken"]) ?? "";
  const accountId = stringField(obj, ["account_id", "accountId", "chatgpt_account_id"]);
  return accountId === null ? { accessToken: access, refreshToken: refresh } : { accessToken: access, refreshToken: refresh, accountId };
}

function stringField(obj: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

/// gh writes YAML, not JSON. We only need the oauth_token line.
export function tokensFromGhHostsYaml(raw: string): OAuthTokens | null {
  const lines = raw.split("\n");
  for (const line of lines) {
    const m = /^\s*oauth_token:\s*(\S+)\s*$/.exec(line);
    if (m && m[1] !== undefined) return { accessToken: m[1], refreshToken: "" };
  }
  return null;
}

export function tokensFromVendorFile(path: string, contents: string): OAuthTokens | null {
  if (path.endsWith(".yml") || path.endsWith(".yaml")) return tokensFromGhHostsYaml(contents);
  return tokensFromVendorJson(contents);
}

export async function importVendorSession(
  paths: readonly string[],
  home: string,
  readFile: (path: string) => Promise<string>,
): Promise<ImportOutcome> {
  if (paths.length === 0) return { ok: false, error: "no vendor session path declared" };
  const errors: string[] = [];
  for (const declared of paths) {
    const path = expandHome(declared, home);
    let contents: string;
    try {
      contents = await readFile(path);
    } catch {
      errors.push(`${path}: missing`);
      continue;
    }
    const tokens = tokensFromVendorFile(path, contents);
    if (tokens === null) {
      errors.push(`${path}: unrecognised session shape`);
      continue;
    }
    return { ok: true, tokens, path };
  }
  return { ok: false, error: errors.join("; ") };
}
