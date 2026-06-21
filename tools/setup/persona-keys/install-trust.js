// Zeta GitHub TEMP-TRUST-ROOT installer MECHANISM — the renderer that turns the
// read-only resolver's authorized-keys trust set (github-trust.ts → TrustResolution)
// into the node-config `operator-ssh-keys` format, and (gated, default OFF) writes it
// into the node's operator-ssh-keys.txt. Workitem 081KVM1TK3Z08QG0R0002959G6
// §"installer mechanism".
//
// >>> TEMP TRUST ROOT (GitHub) — migrate to cert-manager/Vault + Headscale when
//     clusters are redundant. <<<
//
// SECURITY INVARIANTS (security-sensitive slice — honesty over green):
//  1. RESOLUTION IS NOT RE-IMPLEMENTED. This module consumes a `TrustResolution`
//     PRODUCED by github-trust.ts (`resolveTrustSet`). It never fetches, never resolves,
//     never touches the network. It RENDERS (pure) and optionally WRITES (gated).
//  2. PUBLIC KEYS ONLY. The trust set is OpenSSH public-key lines. No secret, no seed,
//     no private key, no CA passes through here. The renderer cannot emit private
//     material (a test asserts the rendered output carries no private-key marker).
//  3. WRITE IS OPERATOR-GATED + DEFAULT OFF. `renderOperatorSshKeys` is pure and always
//     safe. `--dry-run`/`--emit` print to stdout and write NOTHING. `--write` is the only
//     path that touches the filesystem, it is OFF unless explicitly requested, and even
//     then it routes through the injected `InstallTrustEffects.writeText` door — so tests
//     write to temp dirs, never to the real operator-ssh-keys path. Installing a SPECIFIC
//     trust set is a trust-POLICY decision; this slice ships the MECHANISM only.
//
// Noninterference (manifesto §13): the filesystem WRITE enters ONLY through the injected
// `InstallTrustEffects` door — so the pure render path is deterministic and every test is
// hermetic (temp dirs / fixtures), NEVER a real node-config write.
//
// Anchors (Beacon): OpenSSH `sshd(8)` AUTHORIZED_KEYS file format (one pubkey per line,
// `#` comments ignored); the sibling `operator-ssh-keys.nix` reads `operator-ssh-keys.txt`
// via `builtins.readFile` then `lib.splitString "\n"` + filters comment/blank lines
// (so the `.txt` list IS the node trust). Nix string-injection avoidance (#5086): pubkey
// content is DATA read from a file, never a Nix string literal — the renderer targets the
// `.txt` file for exactly that reason.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { TEMP_TRUST_ROOT_BANNER } from "./github-trust.js";
/** The default node-config target the installer renders FOR. Relative to repo root. */
export function defaultOperatorKeysTxtPath(repoRoot) {
    return `${repoRoot}/full-ai-cluster/nixos/modules/operator-ssh-keys.txt`;
}
/** A stable header banner stamped into every rendered artifact: the TEMP-TRUST-ROOT
 *  warning + provenance (generated from the resolver) + a do-not-edit note. Deterministic
 *  (no timestamp) so renders are byte-stable + DST-replayable. */
function headerLines(res, commentPrefix) {
    return [
        `${commentPrefix} ${TEMP_TRUST_ROOT_BANNER}`,
        `${commentPrefix} generated from the GitHub temp-trust-root resolver (github-trust.ts) —`,
        `${commentPrefix} TEMP until Vault/cert-manager + Headscale. Do not edit by hand.`,
        `${commentPrefix} resolved from GitHub public .keys for: ${res.identities.join(", ") || "(none)"}`,
        `${commentPrefix} trust set: ${res.trustSet.length} unique authorized-keys line(s) — PUBLIC keys only.`,
    ];
}
/**
 * Render the resolver's authorized-keys trust set into the `operator-ssh-keys` node-config
 * format. PURE + deterministic: same `TrustResolution` → byte-identical string, no clock,
 * no network, no filesystem. Each entry is annotated with its source GitHub identity.
 *
 * - `format: "txt"` (default) → the sibling-of-`operator-ssh-keys.nix` `.txt` list: a
 *   header banner, then per key a `# source: gh:<user>` comment + the verbatim pubkey line.
 *   This is the file `operator-ssh-keys.nix` reads via `builtins.readFile`.
 * - `format: "nix-array"` → an inline `users.users.zeta.openssh.authorizedKeys.keys = [ … ]`
 *   array (each key a quoted string with a leading source comment). Alternate shape.
 *
 * NEVER emits private material — the input is public-key lines only.
 */
export function renderOperatorSshKeys(res, opts) {
    const format = opts?.format ?? "txt";
    if (format === "nix-array")
        return renderNixArray(res);
    return renderTxt(res);
}
/** Render the canonical `.txt` operator-keys list. */
function renderTxt(res) {
    const out = [...headerLines(res, "#"), ""];
    for (const e of res.trustSet) {
        out.push(`# source: gh:${e.source}`);
        out.push(e.key);
    }
    return out.join("\n") + "\n";
}
/** Escape a pubkey line for safe inclusion as a Nix double-quoted string literal. Pubkeys
 *  are base64 + a comment so this is normally a no-op, but we escape `\`, `"`, and `${`
 *  defensively (#5086 string-injection class). */
function nixEscape(s) {
    return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\$\{/g, "\\${");
}
/** Render the inline nix `authorizedKeys.keys = [ … ]` array shape (alternate). */
function renderNixArray(res) {
    const out = [...headerLines(res, "#"), "", "{", "  users.users.zeta.openssh.authorizedKeys.keys = ["];
    for (const e of res.trustSet) {
        out.push(`    # source: gh:${e.source}`);
        out.push(`    "${nixEscape(e.key)}"`);
    }
    out.push("  ];", "}");
    return out.join("\n") + "\n";
}
/** Guard: a rendered artifact must contain NO private-key material. The marker token is
 *  assembled at runtime (no contiguous private-key literal in this source). Returns true
 *  iff the text is clean (public only). Used by the write path as a last-line refusal. */
export function isPublicOnly(rendered) {
    // Assemble the marker at runtime so this source has no contiguous private-key literal.
    const marker = "PRIVATE" + " KEY";
    return !rendered.includes(marker);
}
/**
 * The GATED write path (default OFF). Renders the trust set and — only when `write: true`
 * — writes it to `targetPath` THROUGH the injected effects door. Refuses to write private
 * material (isPublicOnly guard) and, unless `force`, refuses to clobber an existing file.
 *
 * IMPORTANT: this is the MECHANISM. The CLI does not pass `write: true` unless `--write`
 * is explicitly given, and this PR ships no real installed trust set. Tests pass a temp
 * path + a temp-dir `writeText` — never the real operator-ssh-keys path.
 */
export function installTrust(fx, res, opts) {
    const rendered = renderOperatorSshKeys(res, opts.format !== undefined ? { format: opts.format } : {});
    if (!isPublicOnly(rendered)) {
        // Belt-and-suspenders: should be impossible (input is public keys), but never write
        // anything that looks like private material.
        return { wrote: false, path: opts.targetPath, bytes: 0, refusedReason: "rendered output contained private-key material" };
    }
    if (opts.write !== true) {
        return { wrote: false, path: opts.targetPath, bytes: Buffer.byteLength(rendered, "utf8"), refusedReason: "write not requested (--write OFF)" };
    }
    if (opts.force !== true && fx.exists(opts.targetPath)) {
        return { wrote: false, path: opts.targetPath, bytes: Buffer.byteLength(rendered, "utf8"), refusedReason: `target exists (pass force to overwrite): ${opts.targetPath}` };
    }
    fx.writeText(opts.targetPath, rendered);
    return { wrote: true, path: opts.targetPath, bytes: Buffer.byteLength(rendered, "utf8") };
}
/** The REAL effects (used by the CLI): a plain filesystem write + exists check. NO network,
 *  NO auth, NO secrets, NO read of any private path. Resolution is github-trust.ts's door. */
export function realEffects() {
    return {
        writeText: (p, contents) => writeFileSync(p, contents, "utf8"),
        exists: (p) => existsSync(p),
    };
}
/** Read a previously-rendered artifact back (CLI `--diff` convenience to compare against a
 *  target). Plain public read; never a private path. */
export function readExisting(path) {
    return existsSync(path) ? readFileSync(path, "utf8") : undefined;
}
