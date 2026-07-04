// token-store.ts — OUR token store, not Codex's (shadow*).
//
// Aaron 2026-07-03: own the login end-to-end. The harness plugins each keep their own token file; so
// do we — Zeta stores its OAuth tokens under our own path, per-provider, so a dead Codex session can
// never break us (the fragility we hit). A `TokenStore` is the port; a file-backed impl (injected fs)
// is the default; an in-memory impl is the test double. Pure over the injected fs — noninterference
// §13, fake-testable, and the token bytes never touch stdout.

import type { OAuthTokens } from "./auth-provider.ts";

/// A stored token record: the tokens + the provider + when we last refreshed (for staleness).
export interface StoredTokens {
  readonly provider: string;
  readonly tokens: OAuthTokens;
  readonly lastRefresh: string;
}

/// The token-store port: load/save a provider's tokens. Both methods are async (a file impl does I/O).
export interface TokenStore {
  load(provider: string): Promise<StoredTokens | null>;
  save(record: StoredTokens): Promise<void>;
}

/// The injected filesystem door — the ONLY channel the file store touches disk through (so it is
/// fake-testable with no real fs). `nowIso` supplies the timestamp (no ambient clock).
export interface StoreFs {
  readFile(path: string): Promise<string>;
  writeFile(path: string, contents: string): Promise<void>;
  nowIso(): string;
}

/// A file-backed token store: one JSON file per provider under `dir`. `readFile` rejecting (missing
/// file) yields `null` from `load` — an absent store is not an error.
export function fileTokenStore(dir: string, fs: StoreFs): TokenStore {
  let base = dir;
  while (base.endsWith("/")) base = base.slice(0, -1); // strip trailing slashes (no backtracking regex)
  const pathFor = (provider: string) => `${base}/${provider}.json`;
  return {
    async load(provider: string): Promise<StoredTokens | null> {
      let raw: string;
      try {
        raw = await fs.readFile(pathFor(provider));
      } catch {
        return null; // no file yet
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return null;
      }
      if (typeof parsed !== "object" || parsed === null) return null;
      const p = parsed as { provider?: unknown; tokens?: unknown; lastRefresh?: unknown };
      const t = p.tokens as { accessToken?: unknown; refreshToken?: unknown; accountId?: unknown } | undefined;
      if (typeof p.provider !== "string" || !t || typeof t.accessToken !== "string" || typeof t.refreshToken !== "string") return null;
      const tokens: OAuthTokens = { accessToken: t.accessToken, refreshToken: t.refreshToken };
      return {
        provider: p.provider,
        tokens: typeof t.accountId === "string" ? { ...tokens, accountId: t.accountId } : tokens,
        lastRefresh: typeof p.lastRefresh === "string" ? p.lastRefresh : "",
      };
    },
    async save(record: StoredTokens): Promise<void> {
      await fs.writeFile(pathFor(record.provider), JSON.stringify(record, null, 2));
    },
  };
}

/// An in-memory token store (the test double / ephemeral sessions).
export function memoryTokenStore(): TokenStore {
  const map = new Map<string, StoredTokens>();
  return {
    load: (provider) => Promise.resolve(map.get(provider) ?? null),
    save: (record) => {
      map.set(record.provider, record);
      return Promise.resolve();
    },
  };
}
