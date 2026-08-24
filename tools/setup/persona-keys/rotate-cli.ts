#!/usr/bin/env bun
// Zeta rotate CLI — the per-PORT `rotate` corner of the generate·rotate·teardown lifecycle triad
// (workitem 081KVP2M1QS008QG0R000JSXE1E). A thin shell around the pure `rotate.ts` orchestrator; it
// owns NO key / biometric / git logic of its own. Aaron (2026-06-21): *"force rotation support on
// everything from the beginning and make it easy so people can't get it wrong."*
//
// DEFAULT-SAFE: with NO flags this is a DRY RUN — it reports exactly what WOULD rotate and touches
// NOTHING and NEVER prompts. A real rotate requires `--confirm` AND the operator approving ONE
// biometric (Touch ID / Windows Hello). A declined biometric ⇒ nothing rotated (fail-closed).
// Idempotent-aware: re-running mid-overlap RESUMES the same overlap (no second standby minted).
//
// OVERLAP-WINDOW MODEL: each port mints a new key as STANDBY, overlaps (old + new both valid), then
// promotes the standby to Active and retires the old. For the CA the trust SET is the unit: EVERY
// CA pubkey already in `TrustedUserCAKeys` stays, so every existing cert still verifies. The set
// only GROWS on this path — the readout reports the measured before/after counts rather than
// claiming ∅-blast-radius unconditionally.
//
// --finalize IS THE CLOSING BOUND, and the only way a CA leaves the set. It rotates nothing: it
// sweeps the trust set and drops each retired CA that a CERTIFICATE CENSUS of `<repo>/machines`
// proves no unexpired certificate still names. Anything else is refused with its reason, and the
// one biometric prompt NAMES every CA it would drop. Without it the union above would make each
// retired CA a permanent trust root — the opposite defect, so both halves ship together.
//
// Usage:
//   bun rotate-cli.ts --user aaron --ca aaron                         # DRY RUN (default — nothing touched)
//   bun rotate-cli.ts --user aaron --ca aaron --confirm               # REAL rotate, all ports (one fingerprint)
//   bun rotate-cli.ts --user aaron --ca aaron --ports ca-key --finalize          # DRY RUN of the sweep
//   bun rotate-cli.ts --user aaron --ca aaron --ports ca-key --finalize --confirm # retire closed CAs
//   bun rotate-cli.ts --user aaron --ca aaron --confirm --shamir 2-of-3  # + split new active CA key into shares
//   bun rotate-cli.ts --user aaron --ca aaron --ports machine-key,device-cert --confirm
//   bun rotate-cli.ts --user aaron --ca aaron --host mymac --confirm  # explicit hostname
//
// This NEVER pushes: the staged public artifacts (updated pubkey / cert / trusted-CA-keys file) are
// staged with `git add` under --repo-root for you to commit + open a PR (Otto verify-gates
// security-class changes). It respects shared-checkout-is-view-only — pass YOUR OWN clone.
import { hostname as osHostname, homedir } from "node:os";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { realBiometric, sessionBiometric } from "./biometric.ts";
import {
  ROTATE_PORTS,
  formatRotate,
  realEffects,
  rotate,
  type RotateOptions,
  type RotatePort,
} from "./rotate.ts";
import {
  formatSplitCaShamir,
  realEffects as shamirRealFx,
  splitCaToShares,
} from "./ca-shamir-custody.ts";

const args = process.argv.slice(2);
const flag = (n: string): boolean => args.includes(n);
const opt = (n: string): string | undefined => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = opt("--repo-root") ?? resolvePath(here, "..", "..", "..");
const user = opt("--user");
const ca = opt("--ca") ?? user;
const hostname = opt("--host") ?? osHostname();
const home = opt("--home") ?? homedir();
const certValidity = opt("--validity");
const confirm = flag("--confirm");
const dryRun = !confirm; // DEFAULT-safe: only an explicit --confirm makes it a real run
const finalizeSweep = flag("--finalize");
const shamirSpec = opt("--shamir");

const portsArg = opt("--ports");
const ports: readonly RotatePort[] =
  portsArg === undefined
    ? ROTATE_PORTS
    : (portsArg.split(",").map((p) => p.trim()).filter((p) => p.length > 0) as RotatePort[]);

function usage(): void {
  process.stderr.write(
    "usage: bun rotate-cli.ts --user <name> [--ca <name>] [--host <name>] [--home <path>] " +
      "[--ports <a,b,c>] [--validity <+52w>] [--confirm] [--shamir <k-of-n>] [--repo-root <path>]\n" +
      "  DEFAULT-SAFE: no --confirm => DRY RUN (reports what WOULD rotate; nothing touched, no prompt).\n" +
      `  --ports => any of: ${ROTATE_PORTS.join(", ")} (default: all).\n` +
      "  --confirm => REAL rotate on the overlap-window lifecycle: mint standby → promote → retire old,\n" +
      "               re-sign the device cert (N+M), keep EVERY trusted CA pubkey through the overlap.\n" +
      "               Requires ONE biometric approval (fail-closed). NEVER pushes — stages for a PR.\n" +
      "  --finalize => rotate NOTHING; sweep the CA trust set and drop each retired CA that the\n" +
      "               certificate census proves no UNEXPIRED cert still names. The one approval names\n" +
      "               every CA it drops. This is the ONLY way a CA leaves the trusted set.\n",
  );
}

async function main(): Promise<number> {
  if (user === undefined || user.trim().length === 0) {
    usage();
    process.stderr.write("error: --user <name> is required (the cert principal — N+M: principal = user)\n");
    return 2;
  }
  const badPorts = ports.filter((p) => !ROTATE_PORTS.includes(p));
  if (badPorts.length > 0) {
    usage();
    process.stderr.write(`error: unknown port(s): ${badPorts.join(", ")}\n`);
    return 2;
  }

  // ONE biometric session over the real gate — wired into the (single) rotation so the operator is
  // prompted at most once. On a dry-run the door is never called.
  const session = sessionBiometric(realBiometric());

  const opts: RotateOptions = {
    user,
    ca: ca ?? user,
    repoRoot,
    home,
    hostname,
    ports,
    dryRun,
    confirm,
    biometricAuth: session.door,
    ...(finalizeSweep ? { finalize: true } : {}),
    ...(certValidity !== undefined ? { certValidity } : {}),
  };

  const res = await rotate(realEffects(), opts);
  process.stdout.write(formatRotate(res) + "\n");

  if (
    shamirSpec !== undefined &&
    !finalizeSweep && // a finalize rotates NO key, so there is no new active CA to split
    confirm &&
    !dryRun &&
    ports.includes("ca-key") &&
    res.rotations.some((r) => r.port === "ca-key" && r.action === "rotated")
  ) {
    const sr = await splitCaToShares(shamirRealFx(), {
      ca: ca ?? user,
      home,
      shamir: shamirSpec,
      confirm: true,
      label: "active-post-rotate",
      biometricAuth: session.door,
    });
    process.stdout.write(formatSplitCaShamir(sr) + "\n");
    if (sr.action === "skipped-biometric" || sr.action === "no-ca" || sr.action === "failed") {
      return 1;
    }
  }

  // Hard block iff a confirmed run was refused at the biometric gate (nothing was rotated).
  const declined = res.confirmed && !res.dryRun && res.biometric !== undefined && !res.biometric.ok;
  return declined ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((e: unknown) => {
    process.stderr.write((e instanceof Error ? e.message : String(e)) + "\n");
    process.exit(1);
  });
