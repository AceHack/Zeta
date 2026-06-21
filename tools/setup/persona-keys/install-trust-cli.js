// Zeta GitHub TEMP-TRUST-ROOT installer CLI — a thin shell that REUSES the read-only
// resolver (github-trust.ts) to PRODUCE the trust set, then RENDERS it into the
// `operator-ssh-keys` node-config format (install-trust.ts). `--dry-run`/`--emit` print
// to stdout and write NOTHING; `--write` is gated + default OFF (operator-gated trust
// POLICY). This CLI NEVER fetches/resolves on its own — resolution is github-trust.ts's
// door — and NEVER touches a secret (public keys only). Workitem 081KVM1TK3Z08QG0R0002959G6.
//
//   *** TEMP TRUST ROOT (GitHub) — migrate to cert-manager/Vault + Headscale when
//       clusters are redundant. ***
//
// Usage:
//   bun install-trust-cli.ts --user aaron --dry-run             # NO network; reports intent, writes nothing
//   bun install-trust-cli.ts --user aaron --emit                # fetch (resolver) + print rendered config to stdout
//   bun install-trust-cli.ts --user aaron --emit --format nix-array
//   bun install-trust-cli.ts --user aaron --write --out <path>  # GATED write THROUGH the effects door (default OFF)
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { realEffects as githubTrustEffects, resolveIdentities, resolveTrustSet, } from "./github-trust.js";
import { defaultOperatorKeysTxtPath, installTrust, realEffects as installEffects, renderOperatorSshKeys, } from "./install-trust.js";
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => {
    const i = args.indexOf(n);
    return i >= 0 ? args[i + 1] : undefined;
};
const allOpts = (n) => {
    const out = [];
    for (let i = 0; i < args.length - 1; i++) {
        if (args[i] === n) {
            const v = args[i + 1];
            if (v !== undefined)
                out.push(v);
        }
    }
    return out;
};
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = opt("--repo-root") ?? resolvePath(here, "..", "..", "..");
const explicitUsers = allOpts("--user");
const allowlistPath = opt("--allowlist");
const includeGpg = flag("--gpg"); // signing trust (resolver-side); not rendered into ssh keys
const dryRun = flag("--dry-run");
const emit = flag("--emit");
const doWrite = flag("--write");
const force = flag("--force");
const formatArg = opt("--format");
const outPath = opt("--out");
function parseFormat(v) {
    if (v === "nix-array")
        return "nix-array";
    return "txt";
}
async function main() {
    const format = parseFormat(formatArg);
    // REUSE the resolver's identity sourcing + read-only effects. No re-implemented sourcing.
    const ghFx = githubTrustEffects();
    const idRes = resolveIdentities(ghFx, {
        repoRoot,
        ...(explicitUsers.length > 0 ? { identities: explicitUsers } : {}),
        ...(allowlistPath !== undefined ? { allowlistPath } : {}),
    });
    if (idRes.rejected.length > 0) {
        console.error(`rejected invalid GitHub usernames: ${idRes.rejected.join(", ")}`);
    }
    console.error(`identity source: ${idRes.sourceKind}`);
    if (idRes.identities.length === 0) {
        console.error("no trusted identities resolved — pass --user, add an allowlist, or populate maintainers/.");
        return 2;
    }
    // REUSE resolveTrustSet to PRODUCE the trust set. On --dry-run NO network is performed.
    const res = await resolveTrustSet(ghFx, { identities: idRes.identities, includeGpg, dryRun });
    if (res.dryRun) {
        console.error(`*** ${"TEMP TRUST ROOT"} (GitHub) — dry-run: NO network, NO write. ***`);
        console.error(`would resolve: ${res.identities.join(", ")}`);
        console.error(`would render: operator-ssh-keys (${format}) — and write NOTHING (dry-run).`);
        return 0;
    }
    const anyError = res.perIdentity.some((p) => p.status === "error");
    if (!doWrite) {
        // --emit / default: print the rendered config to stdout. Writes NOTHING.
        const rendered = renderOperatorSshKeys(res, { format });
        if (emit || !doWrite) {
            process.stdout.write(rendered);
        }
        console.error(`rendered ${res.trustSet.length} authorized-keys line(s) to stdout (NOT installed).`);
        if (anyError) {
            console.error("one or more identities failed to resolve (see per-identity status).");
            return 1;
        }
        return 0;
    }
    // GATED write path (--write). Default OFF; reaching here required an explicit --write.
    if (anyError) {
        console.error("refusing to WRITE a trust set with resolution errors — fix resolution first.");
        return 1;
    }
    const target = outPath ?? defaultOperatorKeysTxtPath(repoRoot);
    const installFx = installEffects();
    const result = installTrust(installFx, res, { targetPath: target, format, write: true, force });
    if (result.wrote) {
        console.error(`WROTE ${result.bytes} byte(s) to ${result.path} (TEMP TRUST ROOT — operator-gated trust policy).`);
        return 0;
    }
    console.error(`did NOT write: ${result.refusedReason ?? "unknown"}`);
    return 1;
}
main()
    .then((code) => process.exit(code))
    .catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
});
