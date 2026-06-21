#!/usr/bin/env bun
// Zeta key-onboarding ORCHESTRATOR CLI — a thin shell around the pure orchestrator
// (onboard.ts). It wires the THREE sub-modules' REAL effects (machine / publish /
// github-trust) and runs the end-to-end first-run flow with a clean numbered readout.
//
// The CLI contains NO secret/biometric/gh/seed logic of its own — every door comes from a
// sub-module's `realEffects()`. The biometric gate lives in publish.ts and is never
// bypassed; a missing user keyring prints the `keyring.sh` instruction (no seed-gen here).
// `--dry-run` prompts NOTHING, writes NOTHING, generates NOTHING, fetches NOTHING.
//
// Usage:
//   bun onboard-cli.ts --user aaron                      # full first-run flow (this host)
//   bun onboard-cli.ts --user aaron --dry-run            # plan only — NOTHING is done
//   bun onboard-cli.ts --user aaron --host mymac         # explicit hostname
//   bun onboard-cli.ts --user aaron --type signing       # publish as a signing key
//   bun onboard-cli.ts --user aaron --trust octocat --trust torvalds --gpg   # trust set
import { homedir } from "node:os";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { realEffects as realMachineEffects } from "./machine.js";
import { realEffects as realPublishEffects } from "./publish.js";
import { realEffects as realTrustEffects } from "./github-trust.js";
import { realEffects as realCaEffects } from "./ca.js";
import { realBiometric } from "./biometric.js";
import { formatOnboard, onboard } from "./onboard.js";
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => {
    const i = args.indexOf(n);
    return i >= 0 ? args[i + 1] : undefined;
};
/** Collect ALL values for a repeatable option (e.g. --trust a --trust b). */
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
// Repo root: 3 levels up from tools/setup/persona-keys/ (override with --repo-root).
const repoRoot = opt("--repo-root") ?? resolvePath(here, "..", "..", "..");
const user = opt("--user");
const hostname = opt("--host");
const home = opt("--home") ?? homedir();
const keyTypeArg = opt("--type");
const dryRun = flag("--dry-run");
const includeGpg = flag("--gpg");
const trustIdentities = allOpts("--trust");
const signWithCa = flag("--sign-with-ca");
const certValidity = opt("--cert-validity");
function usage() {
    process.stderr.write("usage: bun onboard-cli.ts --user <name> [--host <name>] [--home <path>] " +
        "[--type authentication|signing] [--trust <gh-user> ...] [--gpg] [--sign-with-ca [--cert-validity +52w]] " +
        "[--dry-run] [--repo-root <path>]\n" +
        "  Chains: status -> user-keyring(instruction) -> machine-key -> publish(biometric-gated) -> trust-resolve" +
        " [-> cert-sign (optional, --sign-with-ca; skips cleanly with no CA)].\n" +
        "  Reuse-only: no secret/biometric/gh/seed/CA-sign logic here — all delegated. --dry-run does NOTHING.\n");
}
async function main() {
    if (user === undefined || user.trim().length === 0) {
        usage();
        process.stderr.write("error: --user <name> is required\n");
        return 2;
    }
    if (keyTypeArg !== undefined && keyTypeArg !== "authentication" && keyTypeArg !== "signing") {
        usage();
        process.stderr.write(`error: --type must be 'authentication' or 'signing' (got '${keyTypeArg}')\n`);
        return 2;
    }
    const keyType = keyTypeArg === "signing" ? "signing" : "authentication";
    const fx = {
        machine: realMachineEffects(),
        publish: realPublishEffects(),
        trust: realTrustEffects(),
        // The SHARED biometric gate — the operator's authorization for the agent-run keygen +
        // cert-sign steps (fail-closed). The publish step uses publish's own gate. Dry-run never
        // invokes any of them.
        biometricAuth: realBiometric(),
        // The CA door is wired ONLY when the operator opts into the cert tie-in. Absent the flag
        // the cert step never runs (and a missing CA private key skips cleanly inside ca.ts).
        ...(signWithCa ? { ca: realCaEffects() } : {}),
    };
    const opts = {
        user,
        repoRoot,
        home,
        keyType,
        dryRun,
        includeGpg,
        ...(hostname !== undefined ? { hostname } : {}),
        ...(trustIdentities.length > 0 ? { trustIdentities } : {}),
        ...(signWithCa ? { signWithCa: true } : {}),
        ...(certValidity !== undefined ? { certValidity } : {}),
    };
    const res = await onboard(fx, opts);
    process.stdout.write(formatOnboard(res) + "\n");
    // Exit code: 0 unless the publish step was a hard, non-recoverable block (biometric
    // declined / private material). A would-publish (dry-run) or no-key is informational.
    const hardBlock = res.publish.action === "aborted-biometric" || res.publish.action === "aborted-private-material";
    return hardBlock ? 1 : 0;
}
main()
    .then((code) => process.exit(code))
    .catch((e) => {
    process.stderr.write((e instanceof Error ? e.message : String(e)) + "\n");
    process.exit(1);
});
