// Zeta GitHub TEMP-TRUST-ROOT resolver — the pre-cluster bootstrap for distributing
// node trust through GitHub as an IdP + key directory (workitem
// 081KVM1TK3Z08QG0R0002959G6 §"Pre-cluster bootstrap … Option A — GitHub as IdP +
// key directory"). This is the BRIDGE until redundant clusters + cert-manager/Vault +
// Headscale exist; the trust *shape* (a directory of operator public keys) is
// forward-compatible — only custody/automation upgrade later.
//
// >>> TEMP TRUST ROOT (GitHub) — migrate to cert-manager/Vault + Headscale when
//     clusters are redundant. <<<
//
// SECURITY INVARIANTS (security-sensitive slice — honesty over green):
//  1. READ-ONLY from GitHub. We fetch ONLY the PUBLIC `https://github.com/<user>.keys`
//     (SSH) and optionally `.gpg` (signing) endpoints. NO GitHub write of any kind
//     (no `gh ssh-key add`, no key upload, no repo write) lives in this module —
//     publishing a key modifies the operator's account and is an operator-gated LATER
//     slice. This resolver only READS public keys and PRODUCES a trust set.
//  2. NO secrets touched at all — public keys in, public authorized-keys set out. No
//     seed, no private key, no CA. Nothing here can emit private material.
//  3. This module PRODUCES the trust set + a readout; it does NOT install it. Writing
//     the set into operator-ssh-keys / authorized_keys is an explicit follow-up slice.
//
// Noninterference (manifesto §13): the network (the GitHub fetch) + the filesystem
// (reading the allowlist config / maintainers dirs) enter ONLY through the injected
// `GithubTrustEffects` — so `--dry-run` and every test are deterministic against
// fixtures, NEVER live network, NEVER CI egress.
//
// Anchors (Beacon): GitHub publishes every user's SSH keys at `/<user>.keys` and PGP
// keys at `/<user>.gpg` (GitHub Docs, "Checking for existing SSH keys" / the public
// key endpoints); `ssh-import-id gh:<user>` (Canonical) is the canonical consumer of
// the same endpoint. SSH authorized_keys format — OpenSSH `sshd(8)` AUTHORIZED_KEYS.
// Trust-on-first-use / web-of-trust framing for an IdP-as-key-directory — the
// workitem's two-mode trust doc (GitHub-border trust bootstrap).
import { existsSync, readFileSync, readdirSync } from "node:fs";

/** The doors for ambient influence — the ONLY channel for network + filesystem
 *  (noninterference §13). Tests/dry-run inject fixtures; the CLI injects the real ones. */
export interface GithubTrustEffects {
  /** Fetch the PUBLIC SSH keys for a GitHub user (the `/<user>.keys` endpoint).
   *  Returns the raw text body (one `ssh-…` line per key) — READ-ONLY, public. */
  readonly fetchKeys: (user: string) => Promise<string>;
  /** Fetch the PUBLIC GPG/PGP armored block for a GitHub user (`/<user>.gpg`).
   *  Optional signing trust — READ-ONLY, public. */
  readonly fetchGpg: (user: string) => Promise<string>;
  /** Read a PUBLIC text artifact (the allowlist config). Never used on private paths. */
  readonly readText: (path: string) => string;
  /** True iff a path exists (used to source identities from maintainers/ dirs). */
  readonly exists: (path: string) => boolean;
  /** List immediate subdirectory names of a dir (e.g. the maintainers/ personas). */
  readonly listDir: (path: string) => readonly string[];
}

/** A single resolved authorized-key line, annotated with the GitHub identity it came
 *  from. The combined trust set is a list of these (line + source). */
export interface TrustEntry {
  /** The GitHub identity (username) this key was fetched from. */
  readonly source: string;
  /** The verbatim public key line (`ssh-ed25519 AAAA… [comment]`). */
  readonly key: string;
  /** The key algorithm token (`ssh-ed25519`, `ssh-rsa`, `ecdsa-sha2-…`), for readout. */
  readonly algo: string;
}

/** Per-identity resolution outcome (how many keys, or why none / error). */
export interface IdentityResolution {
  readonly user: string;
  /** Number of SSH keys resolved for this identity. */
  readonly sshKeyCount: number;
  /** Number of GPG blocks resolved (0 or 1; only when includeGpg). */
  readonly gpgCount: number;
  /** "ok" | "no-keys" (resolved but empty) | "error" (fetch threw). */
  readonly status: "ok" | "no-keys" | "error";
  /** Present only when status === "error" — the error message (no secrets involved). */
  readonly error?: string;
}

/** The full resolution: the combined trust set + per-identity breakdown + dry-run flag. */
export interface TrustResolution {
  readonly dryRun: boolean;
  readonly includeGpg: boolean;
  readonly identities: readonly string[];
  readonly perIdentity: readonly IdentityResolution[];
  /** The combined, de-duplicated SSH authorized-keys trust set (annotated). */
  readonly trustSet: readonly TrustEntry[];
  /** Armored GPG blocks keyed by source identity (signing trust), when includeGpg. */
  readonly gpgBlocks: readonly { readonly source: string; readonly armored: string }[];
}

export const TEMP_TRUST_ROOT_BANNER =
  "TEMP TRUST ROOT (GitHub) — migrate to cert-manager/Vault + Headscale when clusters are redundant";

/** GitHub usernames: 1–39 chars, alphanumeric or single hyphens, not leading/trailing
 *  hyphen. We validate to keep an allowlist from injecting odd tokens into a URL/path. */
export function isValidGithubUser(user: string): boolean {
  return /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/.test(user);
}

/** Parse a `.keys` response body into individual public-key lines (ignores blanks).
 *  Each non-empty, non-comment line is one authorized key. Ordinal/whitespace-stable. */
export function parseKeyLines(body: string): readonly string[] {
  return body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
}

/** The algorithm token of an SSH public-key line (first whitespace-delimited field). */
export function keyAlgo(line: string): string {
  const first = line.split(/\s+/, 1)[0];
  return first ?? "";
}

/** Where the trust allowlist config lives by convention (an explicit list of trusted
 *  GitHub identities). JSON: { "identities": ["user1", "user2", …] }. */
export function defaultAllowlistPath(repoRoot: string): string {
  return `${repoRoot}/maintainers/github-trust-allowlist.json`;
}

/** Source the trusted-identity set. Precedence: explicit `identities` arg wins; else the
 *  allowlist config file if present; else the `maintainers/<persona>/` directory names
 *  (every registered maintainer is a trusted identity by convention). De-duplicated,
 *  ordinal-sorted, validated. PURE over the injected effects (no network). */
export function resolveIdentities(
  fx: GithubTrustEffects,
  opts: { readonly repoRoot: string; readonly identities?: readonly string[]; readonly allowlistPath?: string },
): { readonly identities: readonly string[]; readonly rejected: readonly string[]; readonly sourceKind: "arg" | "config" | "maintainers" } {
  let raw: readonly string[];
  let sourceKind: "arg" | "config" | "maintainers";
  if (opts.identities !== undefined && opts.identities.length > 0) {
    raw = opts.identities;
    sourceKind = "arg";
  } else {
    const cfgPath = opts.allowlistPath ?? defaultAllowlistPath(opts.repoRoot);
    if (fx.exists(cfgPath)) {
      raw = parseAllowlistConfig(fx.readText(cfgPath));
      sourceKind = "config";
    } else {
      const maintainersDir = `${opts.repoRoot}/maintainers`;
      raw = fx.exists(maintainersDir) ? sourceFromMaintainers(fx, maintainersDir) : [];
      sourceKind = "maintainers";
    }
  }
  const valid: string[] = [];
  const rejected: string[] = [];
  for (const u of raw) {
    const t = u.trim();
    if (t.length === 0) continue;
    if (isValidGithubUser(t)) valid.push(t);
    else rejected.push(t);
  }
  const deduped = [...new Set(valid)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return { identities: deduped, rejected, sourceKind };
}

/** Parse the allowlist config JSON → identity list. Tolerates `{ identities: [...] }`
 *  or a bare `[...]`. Throws on malformed JSON (fail loud, not silently empty). */
export function parseAllowlistConfig(text: string): readonly string[] {
  const parsed: unknown = JSON.parse(text);
  if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === "string");
  if (parsed !== null && typeof parsed === "object" && "identities" in parsed) {
    const ids = (parsed as { identities: unknown }).identities;
    if (Array.isArray(ids)) return ids.filter((x): x is string => typeof x === "string");
  }
  return [];
}

/** Every immediate subdir of maintainers/ that holds a keyring-public.json or
 *  ssh-pubkeys.txt is a registered trusted identity. (The `personas` dir is a parent
 *  of agent personas; we treat top-level maintainer dirs as the identities.) */
function sourceFromMaintainers(fx: GithubTrustEffects, maintainersDir: string): readonly string[] {
  const out: string[] = [];
  for (const name of fx.listDir(maintainersDir)) {
    const dir = `${maintainersDir}/${name}`;
    if (fx.exists(`${dir}/keyring-public.json`) || fx.exists(`${dir}/ssh-pubkeys.txt`)) {
      out.push(name);
    }
  }
  return out;
}

/**
 * Resolve the trusted GitHub identities into a combined authorized-keys trust set.
 * READ-ONLY: fetches ONLY public `.keys` (+ optional `.gpg`) through the injected door.
 * On `dryRun` NO network is touched at all — the resolution is empty and flagged.
 *
 * The trust set is de-duplicated by exact key line (idempotent: the same key published
 * by two identities collapses to one entry, annotated with the FIRST source seen in
 * identity order — deterministic). It is PRODUCED and returned; it is NOT installed.
 */
export async function resolveTrustSet(
  fx: GithubTrustEffects,
  opts: {
    readonly identities: readonly string[];
    readonly includeGpg?: boolean;
    readonly dryRun?: boolean;
  },
): Promise<TrustResolution> {
  const includeGpg = opts.includeGpg === true;
  const dryRun = opts.dryRun === true;
  const identities = opts.identities;

  if (dryRun) {
    // --dry-run does NO network. Report intent, resolve nothing.
    return { dryRun: true, includeGpg, identities, perIdentity: [], trustSet: [], gpgBlocks: [] };
  }

  const perIdentity: IdentityResolution[] = [];
  const trustSet: TrustEntry[] = [];
  const seenKeys = new Set<string>(); // dedup by exact key line (idempotency)
  const gpgBlocks: { source: string; armored: string }[] = [];

  for (const user of identities) {
    try {
      const body = await fx.fetchKeys(user);
      const lines = parseKeyLines(body);
      for (const key of lines) {
        if (seenKeys.has(key)) continue; // idempotent: collapse duplicate keys
        seenKeys.add(key);
        trustSet.push({ source: user, key, algo: keyAlgo(key) });
      }
      let gpgCount = 0;
      if (includeGpg) {
        const armored = (await fx.fetchGpg(user)).trim();
        if (armored.length > 0) {
          gpgBlocks.push({ source: user, armored });
          gpgCount = 1;
        }
      }
      perIdentity.push({
        user,
        sshKeyCount: lines.length,
        gpgCount,
        status: lines.length > 0 ? "ok" : "no-keys",
      });
    } catch (e) {
      perIdentity.push({
        user,
        sshKeyCount: 0,
        gpgCount: 0,
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { dryRun: false, includeGpg, identities, perIdentity, trustSet, gpgBlocks };
}

/** Render the combined authorized-keys trust set as text — one key per line, each
 *  annotated with its source identity as a leading comment line. This is the artifact
 *  a LATER slice would feed into operator-ssh-keys / authorized_keys (NOT installed here). */
export function renderAuthorizedKeys(res: TrustResolution): string {
  const out: string[] = [
    `# ${TEMP_TRUST_ROOT_BANNER}`,
    `# Resolved from GitHub public .keys for: ${res.identities.join(", ")}`,
    "# READ-ONLY trust set — produced, NOT installed. Do not edit by hand.",
    "",
  ];
  for (const e of res.trustSet) {
    out.push(`# source: gh:${e.source}`);
    out.push(e.key);
  }
  return out.join("\n") + "\n";
}

/** Human-readable status/dry-run readout: which identity → how many keys, the resulting
 *  trust set size, and the TEMP-TRUST-ROOT banner. Safe to print (public keys only). */
export function formatStatus(res: TrustResolution): string {
  const lines: string[] = [];
  lines.push(`*** ${TEMP_TRUST_ROOT_BANNER} ***`);
  lines.push(res.dryRun ? "[dry-run] NO network performed — reporting intent only." : "GitHub trust-root resolution:");
  lines.push(`  identities (${res.identities.length}): ${res.identities.join(", ") || "(none)"}`);
  if (res.dryRun) {
    lines.push(`  would fetch: https://github.com/<user>.keys${res.includeGpg ? " (+ .gpg)" : ""} for each identity`);
    lines.push("  would produce: a combined authorized-keys trust set (NOT installed).");
    return lines.join("\n");
  }
  for (const r of res.perIdentity) {
    const tail =
      r.status === "error"
        ? `ERROR: ${r.error ?? "unknown"}`
        : `${r.sshKeyCount} ssh key(s)${res.includeGpg ? `, ${r.gpgCount} gpg` : ""}${r.status === "no-keys" ? " (no keys published)" : ""}`;
    lines.push(`  gh:${r.user} -> ${tail}`);
  }
  lines.push(`  combined trust set: ${res.trustSet.length} unique authorized-keys line(s)`);
  if (res.includeGpg) lines.push(`  signing (gpg) blocks: ${res.gpgBlocks.length}`);
  lines.push("  trust set PRODUCED, not installed — wiring into node authorized_keys is a follow-up slice.");
  return lines.join("\n");
}

/** The REAL effects (used by the CLI): a public, read-only HTTPS GET to GitHub's
 *  `.keys` / `.gpg` endpoints + plain filesystem reads. NO writes, NO auth, NO secrets. */
export function realEffects(): GithubTrustEffects {
  const fetchEndpoint = async (user: string, suffix: ".keys" | ".gpg"): Promise<string> => {
    if (!isValidGithubUser(user)) throw new Error(`invalid GitHub username: ${user}`);
    const url = `https://github.com/${encodeURIComponent(user)}${suffix}`;
    const resp = await fetch(url, { method: "GET", redirect: "follow" });
    if (!resp.ok) throw new Error(`GET ${url} -> HTTP ${resp.status}`);
    return await resp.text();
  };
  return {
    fetchKeys: (user) => fetchEndpoint(user, ".keys"),
    fetchGpg: (user) => fetchEndpoint(user, ".gpg"),
    readText: (p) => readFileSync(p, "utf8"),
    exists: (p) => existsSync(p),
    listDir: (p) =>
      readdirSync(p, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name),
  };
}
