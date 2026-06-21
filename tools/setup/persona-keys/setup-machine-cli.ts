#!/usr/bin/env bun
// Zeta setup-machine CLI — the ONE-command, ONE-fingerprint entry point for onboarding a new
// dev machine / maintainer onto an EXISTING cluster. A thin shell around the pure orchestrator
// (setup-machine.ts → onboard.ts). It owns NO key/biometric/seed/gh/CA logic of its own:
//
//   * It builds ONE `sessionBiometric` door over the real biometric gate, then weaves that
//     SAME door into EVERY gated sub-effect (machine keygen, cert-sign) — so the operator
//     presses Touch ID / Windows Hello exactly ONCE for the whole run.
//   * It auto-detects a configured CA (the CA private key on THIS host) and wires the CA door
//     ONLY then — so the device cert is auto-signed with no `--sign-with-ca` flag, and the
//     cert step is cleanly omitted when no CA is present.
//   * `--dry-run` prompts NOTHING, writes NOTHING, generates NOTHING, fetches NOTHING.
//
// Usage:
//   bun setup-machine-cli.ts --user aaron                 # one command, one fingerprint
//   bun setup-machine-cli.ts --user aaron --dry-run       # plan only — NOTHING is done
//   bun setup-machine-cli.ts --user aaron --host mymac    # explicit hostname
//   bun setup-machine-cli.ts --user aaron --trust octocat --gpg   # also resolve a trust set
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { realEffects as realMachineEffects } from "./machine.ts";
import { realEffects as realTrustEffects } from "./github-trust.ts";
import { realEffects as realCaEffects } from "./ca.ts";
import { caPrivateKeyPath } from "./ca.ts";
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
      "trust-resolve -> auto cert-sign (only if a CA is configured on this host).\n" +
      "  Reuse-only: all key/biometric/seed/CA logic is delegated. --dry-run does NOTHING.\n",
  );
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

  // AUTO-CERT: a CA is "configured" on this host iff its private key exists. Probe via ca.ts's
  // canonical path; wire the CA door ONLY then (so the cert step is omitted cleanly otherwise).
  const caConfigured = existsSync(caPrivateKeyPath(home));

  const fx: OnboardEffects = {
    // machine keygen rides the session door (one approval).
    machine: realMachineEffects(),
    trust: realTrustEffects(),
    // The SHARED gate for machine-keygen + cert-sign is the session door (the ONE approval).
    biometricAuth: session.door,
    // CA door only when a CA is configured (else the cert step is a clean skip).
    ...(caConfigured ? { ca: realCaEffects() } : {}),
  };

  const opts: SetupMachineOptions = {
    user,
    repoRoot,
    home,
    keyType,
    dryRun,
    includeGpg,
    caConfigured,
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
