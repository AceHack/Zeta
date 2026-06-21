#!/usr/bin/env bun
// Zeta biometric-gated GitHub PUBLIC-key publish CLI — a thin shell around the pure
// publisher (publish.ts). It reads THIS machine's PUBLIC device key, requires a biometric
// confirmation (macOS Touch ID via pam_tid; Windows Hello = seam/TODO), and ONLY then
// uploads the PUBLIC key to GitHub via `gh ssh-key add`. PUBLIC key only — never a secret.
// `--dry-run` prompts NOTHING and writes NOTHING. See publish.ts for the security invariants.
//
// Usage:
//   bun publish-cli.ts --user aaron                       # Touch ID, then publish this host's pubkey
//   bun publish-cli.ts --user aaron --host mymac          # explicit hostname for the conventional path
//   bun publish-cli.ts --user aaron --key path/to/x.pub   # explicit pubkey path
//   bun publish-cli.ts --user aaron --type signing        # add as a signing key (default: authentication)
//   bun publish-cli.ts --user aaron --dry-run             # NO biometric prompt, NO GitHub write
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { formatResult, hostHostname, publishKey, realEffects } from "./publish.js";
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => {
    const i = args.indexOf(n);
    return i >= 0 ? args[i + 1] : undefined;
};
const here = dirname(fileURLToPath(import.meta.url));
// Repo root: 3 levels up from tools/setup/persona-keys/ (override with --repo-root).
const repoRoot = opt("--repo-root") ?? resolvePath(here, "..", "..", "..");
const user = opt("--user");
const hostname = opt("--host") ?? hostHostname();
const keyPath = opt("--key");
const keyTypeArg = opt("--type");
const dryRun = flag("--dry-run");
function usage() {
    process.stderr.write("usage: bun publish-cli.ts --user <gh-user> [--host <name>] [--key <pubfile>] " +
        "[--type authentication|signing] [--dry-run] [--repo-root <path>]\n" +
        "  Biometric-gated (Touch ID / Windows Hello), fail-closed, PUBLIC key ONLY.\n");
}
async function main() {
    if (user === undefined || user.trim().length === 0) {
        usage();
        process.stderr.write("error: --user <gh-user> is required\n");
        return 2;
    }
    if (keyTypeArg !== undefined && keyTypeArg !== "authentication" && keyTypeArg !== "signing") {
        usage();
        process.stderr.write(`error: --type must be 'authentication' or 'signing' (got '${keyTypeArg}')\n`);
        return 2;
    }
    const keyType = keyTypeArg === "signing" ? "signing" : "authentication";
    const opts = {
        user,
        repoRoot,
        hostname,
        keyType,
        dryRun,
        ...(keyPath !== undefined ? { keyPath } : {}),
    };
    const fx = realEffects();
    const res = await publishKey(fx, opts);
    process.stdout.write(formatResult(res) + "\n");
    // Exit code: 0 published / would-publish; 1 aborted (biometric / no key / private material).
    return res.action === "published" || res.action === "would-publish" ? 0 : 1;
}
main()
    .then((code) => process.exit(code))
    .catch((e) => {
    process.stderr.write((e instanceof Error ? e.message : String(e)) + "\n");
    process.exit(1);
});
