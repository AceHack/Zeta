#!/usr/bin/env bun
// Zeta setup-machine CLI — the ONE-command, ONE-fingerprint entry point for onboarding a new
// dev machine / maintainer onto an EXISTING cluster. A thin shell around the pure orchestrator
// (setup-machine.ts → onboard.ts). It owns NO key/biometric/seed/gh/CA logic of its own:
//
//   * It builds ONE `sessionBiometric` door over the real biometric gate, then weaves that
//     SAME door into EVERY gated sub-effect (machine keygen, cert-sign) — so the operator
//     presses Touch ID / Windows Hello exactly ONCE for the whole run.
//   * It ALWAYS wires the CA door. If a CA private key exists on THIS host the device cert is
//     auto-signed against it (no `--sign-with-ca` flag); if NONE exists, setup-machine REALIZES a
//     local CA (under the same one approval) then signs — so a fresh host ends with CA + machine
//     key + cert under ONE fingerprint. JOINING a cluster is now detected rather than deferred:
//     the CLI scans the committed trust roots (`maintainers/<ca>/ssh-ca.pub`) and, when one
//     exists without a local CA private key, ca.ts resolves the disposition to "route" — no 2nd
//     CA is fabricated (that would split the trust root) and the cert is routed to the CA holder.
//   * `--dry-run` prompts NOTHING, writes NOTHING, generates NOTHING, fetches NOTHING.
//
// Usage:
//   bun setup-machine-cli.ts --user aaron                 # one command, one fingerprint
//   bun setup-machine-cli.ts --user aaron --dry-run       # plan only — NOTHING is done
//   bun setup-machine-cli.ts --user aaron --host mymac    # explicit hostname
//   bun setup-machine-cli.ts --user aaron --trust octocat --gpg   # also resolve a trust set
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { realEffects as realMachineEffects } from "./machine.ts";
import { realEffects as realTrustEffects } from "./github-trust.ts";
import { realEffects as realCaEffects } from "./ca.ts";
import { caPrivateKeyPath, maintainersDirPath, resolveCaDisposition } from "./ca.ts";
import { realBiometric, sessionBiometric } from "./biometric.ts";
import { formatSetupMachine, setupMachine, type SetupMachineOptions } from "./setup-machine.ts";
import type { OnboardEffects } from "./onboard.ts";

const args = process.argv.slice(2);
const flag = (n: string): boolean => args.includes(n);
const opt = (n: string): string | undefined => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};
const allOpts = (n: string): readonly string[] => {
  const out: string[] = [];
  for (let i = 0; i < args.length - 1; i++) {
    if (args[i] === n) {
      const v = args[i + 1];
      if (v !== undefined) out.push(v);
    }
  }
  return out;
};

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = opt("--repo-root") ?? resolvePath(here, "..", "..", "..");
const user = opt("--user");
const hostname = opt("--host");
const home = opt("--home") ?? homedir();
const keyTypeArg = opt("--type");
const dryRun = flag("--dry-run");
const includeGpg = flag("--gpg");
const trustIdentities = allOpts("--trust");
const certValidity = opt("--cert-validity");

function usage(): void {
  process.stderr.write(
    "usage: bun setup-machine-cli.ts --user <name> [--host <name>] [--home <path>] " +
      "[--type authentication|signing] [--trust <gh-user> ...] [--gpg] [--cert-validity +52w] " +
      "[--dry-run] [--repo-root <path>]\n" +
      "  ONE command, ONE fingerprint: status -> user-keyring(instruction) -> machine-key -> " +
      "trust-resolve -> (realize a local CA if none) -> auto cert-sign.\n" +
      "  Reuse-only: all key/biometric/seed/CA logic is delegated. --dry-run does NOTHING.\n" +
      "  Joining a cluster (a committed trust root exists but no local CA private key) ROUTES the " +
      "cert to the CA holder instead of fabricating a second CA.\n",
  );
}

/** Scan the committed trust roots — the CA PUBLIC keys already in the repo
 *  (`maintainers/<ca>/ssh-ca.pub`). Their presence means a CA exists somewhere ⇒ ROUTE, never
 *  fabricate a 2nd CA. Read-only directory probe (noninterference: the only ambient read here). */
function committedTrustRoots(repoRootPath: string): string[] {
  const dir = maintainersDirPath(repoRootPath);
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const roots: string[] = [];
  for (const name of entries) {
    if (existsSync(join(dir, name, "ssh-ca.pub"))) roots.push(name);
  }
  roots.sort(); // ordinal-stable (culture-invariant) for a deterministic readout
  return roots;
}

async function main(): Promise<number> {
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
  const keyType: "authentication" | "signing" = keyTypeArg === "signing" ? "signing" : "authentication";

  // ── THE ONE FINGERPRINT ─────────────────────────────────────────────────────────────────
  // Build ONE session door over the real biometric gate. Every gated sub-effect below carries
  // this SAME door, so the human is prompted at most once; the session replays that one
  // approval to the rest. FAIL-CLOSED: a declined first approval poisons the session.
  const session = sessionBiometric(realBiometric());

  // AUTO-CERT + REALIZE-CA-WHEN-MISSING: a CA is "configured" on this host iff its private key
  // exists. Probe via ca.ts's canonical path. We ALWAYS wire the CA door now: if a CA exists, the
  // cert is signed against it; if NOT, setup-machine REALIZES a local CA (under the one session
  // approval) then signs. The CA door is the ONLY channel for that realize+sign (noninterference).
  const caConfigured = existsSync(caPrivateKeyPath(home));

  // ── CA REALIZE-vs-ROUTE ──────────────────────────────────────────────────────────────────
  // Gather the two facts the disposition is a pure function of: (1) is the CA PRIVATE key present
  // on THIS host? (2) what committed CA trust roots already exist in the repo? Then resolve:
  //   present → sign here · realize → no CA anywhere → create here · route → the CA lives on
  //   another host → do NOT fabricate a 2nd CA; route the cert to its holder.
  const caDisposition = resolveCaDisposition({
    localCaPrivateExists: caConfigured,
    committedTrustRoots: committedTrustRoots(repoRoot),
    home,
  });
  // The CA door is needed whenever the CA is usable HERE ("present" → sign with the local CA, or
  // "realize" → generate it here then sign). On "route" no CA door is wired, so this host cannot
  // sign or fabricate at all — fail-closed by construction, not just by branch.
  const caUsableHere =
    caDisposition.disposition === "present" || caDisposition.disposition === "realize";

  const fx: OnboardEffects = {
    // machine keygen rides the session door (one approval).
    machine: realMachineEffects(),
    trust: realTrustEffects(),
    // The SHARED gate for machine-keygen + realize-CA + cert-sign is the session door (ONE approval).
    biometricAuth: session.door,
    // CA door wired when the CA is usable here (sign against an existing CA OR realize a missing
    // one). Omitted on "route" — the CA lives elsewhere, so we neither sign nor fabricate.
    ...(caUsableHere ? { ca: realCaEffects() } : {}),
  };

  const opts: SetupMachineOptions = {
    user,
    repoRoot,
    home,
    keyType,
    dryRun,
    includeGpg,
    caConfigured,
    caDisposition,
    ...(hostname !== undefined ? { hostname } : {}),
    ...(trustIdentities.length > 0 ? { trustIdentities } : {}),
    ...(certValidity !== undefined ? { certValidity } : {}),
  };

  const res = await setupMachine(fx, session, opts);
  process.stdout.write(formatSetupMachine(res) + "\n");

  // Hard block iff a gated step was refused (biometric declined on keygen or cert-sign).
  const hardBlock =
    res.onboard.machine.action === "aborted-biometric" ||
    res.onboard.cert?.action === "aborted-biometric";
  return hardBlock ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((e: unknown) => {
    process.stderr.write((e instanceof Error ? e.message : String(e)) + "\n");
    process.exit(1);
  });
