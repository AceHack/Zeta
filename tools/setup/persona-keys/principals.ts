// Zeta per-machine authorized-principals data + AuthorizedPrincipalsFile rendering — the
// AUTHORIZATION half of the identity↔authorization split (decision doc
// docs/DECISIONS/2026-06-21-multi-owner-machines-identity-vs-authorization-ssh-ca-bootstrap.md
// §2 "Authorization = per-machine authorized-principals list").
//
// THE MODEL (why this file exists):
//   IDENTITY is a per-USER cert (`principal=<username>`, ca.ts §1) — "I am aaron." AUTHORIZATION
//   is a per-MACHINE list of usernames allowed on that host (OpenSSH `AuthorizedPrincipalsFile`).
//   Ownership is therefore plain DATA — a list of usernames per machine — never a cryptographic
//   re-binding. Adding a person to a machine = add their username to that machine's list (one
//   line edit); the fleet is NOT re-keyed. Keys stay O(N+M), not O(N×M).
//
//   THE PAIRING LIVES IN THE LIST, NEVER A COMPOSITE ID: a machine maps to a list of bare
//   usernames; there is NO `user@machine` composite key anywhere (the #8926 / Key-ID N×M lesson,
//   2026-06-21). The (user × machine) relation is the membership of a username in a host's list.
//
// DATA SHAPE (simplest durable + diffable text — no binary; the no-binary-in-proof-lineage rule):
//   a SINGLE `machines/principals.json` map at repo root (next to the `machines/<host>.pub`
//   registry — same change-rate, a DV2.0 satellite): { "<host>": ["aaron", "addison"], ... }.
//   One file, git-diffable, the single source of the ownership matrix. Bare usernames only —
//   NO key material (it lists who, not what-key); a username is not a secret.
//
// SECURITY / INVARIANTS:
//   * NO secrets — the file lists USERNAMES only (public). No key/seed bytes ever land here.
//   * INERT WHEN ABSENT — `loadPrincipals` on a missing/empty file yields an EMPTY map; the nix
//     render is `pathExists`-guarded (ssh-ca.nix) so an absent file changes NO sshd behavior
//     (same discipline as the existing CA-pubkey guard).
//   * Ordinal/culture-invariant — usernames are de-duplicated + sorted with ordinal collation
//     (culture-invariant-by-default rule) so the rendered file is byte-stable across machines.
//
// Anchors (Beacon): OpenSSH `AuthorizedPrincipalsFile` / `TrustedUserCAKeys` (`sshd_config(5)`);
// BLESS-style short-lived SSH certs (Netflix/Facebook); HashiCorp Vault SSH secrets engine +
// Jetstack cert-manager (the migration target — principals source moves to an identity provider).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** The ownership matrix: host → the usernames (principals) authorized on that host. A username's
 *  membership in a host's list IS the (user × machine) authorization — never a composite id. */
export type PrincipalsMap = Readonly<Record<string, readonly string[]>>;

/** Repo path of the single per-machine principals data file (next to `machines/<host>.pub`). */
export function principalsDataPath(repoRoot: string): string {
  return join(repoRoot, "machines", "principals.json");
}

/** Normalize a username list: trim, drop blanks, de-duplicate, sort ORDINAL (culture-invariant —
 *  byte-stable across machines, the culture-invariant-by-default rule). Returns a fresh array. */
export function normalizePrincipals(users: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const u of users) {
    const t = u.trim();
    if (t.length > 0) seen.add(t);
  }
  // Ordinal sort: codepoint order, NOT locale collation (deterministic + byte-lockable).
  return [...seen].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Parse a principals.json blob into a normalized map. Tolerant of an absent/empty/invalid file:
 *  anything that is not a `{ host: string[] }` object yields an EMPTY map (inert) rather than a
 *  throw — a missing ownership table must never break a caller (fail-INERT, not fail-open: an
 *  empty map authorizes NObody). Non-array / non-string entries are skipped, not guessed. */
export function parsePrincipals(json: string): PrincipalsMap {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return {};
  }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, readonly string[]> = {};
  for (const [host, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(val)) continue;
    const users = val.filter((u): u is string => typeof u === "string");
    const norm = normalizePrincipals(users);
    if (norm.length > 0) out[host] = norm;
  }
  return out;
}

/** Load the per-machine principals map from `machines/principals.json`. ABSENT ⇒ empty map
 *  (INERT — exactly the pathExists-guard discipline the nix layer mirrors). Never throws. */
export function loadPrincipals(repoRoot: string): PrincipalsMap {
  const p = principalsDataPath(repoRoot);
  if (!existsSync(p)) return {};
  return parsePrincipals(readFileSync(p, "utf8"));
}

/** Render the OpenSSH `AuthorizedPrincipalsFile` CONTENTS for ONE host: one username per line,
 *  ordinal-sorted, trailing newline. EMPTY list (or unknown host) ⇒ empty string (INERT — no
 *  principal is authorized, the fail-closed default). This is the exact file sshd reads when
 *  `AuthorizedPrincipalsFile` points at it. */
export function renderAuthorizedPrincipals(users: readonly string[]): string {
  const norm = normalizePrincipals(users);
  if (norm.length === 0) return "";
  return norm.map((u) => u).join("\n") + "\n";
}

/** Render the AuthorizedPrincipals content for `host` from the map (the per-host file body). */
export function renderHostAuthorizedPrincipals(map: PrincipalsMap, host: string): string {
  return renderAuthorizedPrincipals(map[host] ?? []);
}
