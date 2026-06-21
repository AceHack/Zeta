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
export const TEMP_TRUST_ROOT_BANNER = "TEMP TRUST ROOT (GitHub) — migrate to cert-manager/Vault + Headscale when clusters are redundant";
/** GitHub usernames: 1–39 chars, alphanumeric or single hyphens, not leading/trailing
 *  hyphen. We validate to keep an allowlist from injecting odd tokens into a URL/path. */
export function isValidGithubUser(user) {
    return /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/.test(user);
}
/** Parse a `.keys` response body into individual public-key lines (ignores blanks).
 *  Each non-empty, non-comment line is one authorized key. Ordinal/whitespace-stable. */
export function parseKeyLines(body) {
    return body
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith("#"));
}
/** The algorithm token of an SSH public-key line (first whitespace-delimited field). */
export function keyAlgo(line) {
    const first = line.split(/\s+/, 1)[0];
    return first ?? "";
}
/** Where the trust allowlist config lives by convention (an explicit list of trusted
 *  GitHub identities). JSON: { "identities": ["user1", "user2", …] }. */
export function defaultAllowlistPath(repoRoot) {
    return `${repoRoot}/maintainers/github-trust-allowlist.json`;
}
/** Source the trusted-identity set. Precedence: explicit `identities` arg wins; else the
 *  allowlist config file if present; else the `maintainers/<persona>/` directory names
 *  (every registered maintainer is a trusted identity by convention). De-duplicated,
 *  ordinal-sorted, validated. PURE over the injected effects (no network). */
export function resolveIdentities(fx, opts) {
    let raw;
    let sourceKind;
    if (opts.identities !== undefined && opts.identities.length > 0) {
        raw = opts.identities;
        sourceKind = "arg";
    }
    else {
        const cfgPath = opts.allowlistPath ?? defaultAllowlistPath(opts.repoRoot);
        if (fx.exists(cfgPath)) {
            raw = parseAllowlistConfig(fx.readText(cfgPath));
            sourceKind = "config";
        }
        else {
            const maintainersDir = `${opts.repoRoot}/maintainers`;
            raw = fx.exists(maintainersDir) ? sourceFromMaintainers(fx, maintainersDir) : [];
            sourceKind = "maintainers";
        }
    }
    const valid = [];
    const rejected = [];
    for (const u of raw) {
        const t = u.trim();
        if (t.length === 0)
            continue;
        if (isValidGithubUser(t))
            valid.push(t);
        else
            rejected.push(t);
    }
    const deduped = [...new Set(valid)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return { identities: deduped, rejected, sourceKind };
}
/** Parse the allowlist config JSON → identity list. Tolerates `{ identities: [...] }`
 *  or a bare `[...]`. Throws on malformed JSON (fail loud, not silently empty). */
export function parseAllowlistConfig(text) {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed))
        return parsed.filter((x) => typeof x === "string");
    if (parsed !== null && typeof parsed === "object" && "identities" in parsed) {
        const ids = parsed.identities;
        if (Array.isArray(ids))
            return ids.filter((x) => typeof x === "string");
    }
    return [];
}
/** Every immediate subdir of maintainers/ that holds a keyring-public.json or
 *  ssh-pubkeys.txt is a registered trusted identity. (The `personas` dir is a parent
 *  of agent personas; we treat top-level maintainer dirs as the identities.) */
function sourceFromMaintainers(fx, maintainersDir) {
    const out = [];
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
export async function resolveTrustSet(fx, opts) {
    const includeGpg = opts.includeGpg === true;
    const dryRun = opts.dryRun === true;
    const identities = opts.identities;
    if (dryRun) {
        // --dry-run does NO network. Report intent, resolve nothing.
        return { dryRun: true, includeGpg, identities, perIdentity: [], trustSet: [], gpgBlocks: [] };
    }
    const perIdentity = [];
    const trustSet = [];
    const seenKeys = new Set(); // dedup by exact key line (idempotency)
    const gpgBlocks = [];
    for (const user of identities) {
        try {
            const body = await fx.fetchKeys(user);
            const lines = parseKeyLines(body);
            for (const key of lines) {
                if (seenKeys.has(key))
                    continue; // idempotent: collapse duplicate keys
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
        }
        catch (e) {
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
export function renderAuthorizedKeys(res) {
    const out = [
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
export function formatStatus(res) {
    const lines = [];
    lines.push(`*** ${TEMP_TRUST_ROOT_BANNER} ***`);
    lines.push(res.dryRun ? "[dry-run] NO network performed — reporting intent only." : "GitHub trust-root resolution:");
    lines.push(`  identities (${res.identities.length}): ${res.identities.join(", ") || "(none)"}`);
    if (res.dryRun) {
        lines.push(`  would fetch: https://github.com/<user>.keys${res.includeGpg ? " (+ .gpg)" : ""} for each identity`);
        lines.push("  would produce: a combined authorized-keys trust set (NOT installed).");
        return lines.join("\n");
    }
    for (const r of res.perIdentity) {
        const tail = r.status === "error"
            ? `ERROR: ${r.error ?? "unknown"}`
            : `${r.sshKeyCount} ssh key(s)${res.includeGpg ? `, ${r.gpgCount} gpg` : ""}${r.status === "no-keys" ? " (no keys published)" : ""}`;
        lines.push(`  gh:${r.user} -> ${tail}`);
    }
    lines.push(`  combined trust set: ${res.trustSet.length} unique authorized-keys line(s)`);
    if (res.includeGpg)
        lines.push(`  signing (gpg) blocks: ${res.gpgBlocks.length}`);
    lines.push("  trust set PRODUCED, not installed — wiring into node authorized_keys is a follow-up slice.");
    return lines.join("\n");
}
/** The REAL effects (used by the CLI): a public, read-only HTTPS GET to GitHub's
 *  `.keys` / `.gpg` endpoints + plain filesystem reads. NO writes, NO auth, NO secrets. */
export function realEffects() {
    const fetchEndpoint = async (user, suffix) => {
        if (!isValidGithubUser(user))
            throw new Error(`invalid GitHub username: ${user}`);
        const url = `https://github.com/${encodeURIComponent(user)}${suffix}`;
        const resp = await fetch(url, { method: "GET", redirect: "follow" });
        if (!resp.ok)
            throw new Error(`GET ${url} -> HTTP ${resp.status}`);
        return await resp.text();
    };
    return {
        fetchKeys: (user) => fetchEndpoint(user, ".keys"),
        fetchGpg: (user) => fetchEndpoint(user, ".gpg"),
        readText: (p) => readFileSync(p, "utf8"),
        exists: (p) => existsSync(p),
        listDir: (p) => readdirSync(p, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => d.name),
    };
}
