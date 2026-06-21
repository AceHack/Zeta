#!/usr/bin/env bun
// Zeta teardown-cluster CLI — the DESTRUCTIVE inverse of setup-cluster: wipe THIS cluster's CA private
// key AND stage the unregistration of its registered PUBLIC trust-root artifacts (the CA pubkey + the
// multi-CA trusted-user-ca-keys.pub trust set) for a PR. A thin shell around the pure
// `teardown-cluster.ts` orchestrator; it owns NO key/biometric/git logic of its own.
//
// DEFAULT-SAFE: with NO flags this is a DRY RUN — it reports exactly what WOULD be wiped/unregistered
// PLUS the cascade WARNINGS (cross-cluster peer trust, dependent machine certs, unrecoverable private)
// and touches NOTHING and NEVER prompts. A real teardown requires `--confirm` AND the operator
// approving ONE biometric (Touch ID / Windows Hello). A declined biometric ⇒ nothing deleted
// (fail-closed). Idempotent: a second run after a teardown is a clean "already clean" no-op.
//
// Usage:
//   bun teardown-cluster-cli.ts --ca acme                  # DRY RUN (default — nothing touched; shows warnings)
//   bun teardown-cluster-cli.ts --ca acme --confirm        # REAL cluster teardown (one fingerprint)
//   bun teardown-cluster-cli.ts --ca acme --note-1password # also PRINT the 1Password item (no delete)
//
// This NEVER pushes: the repo-unregister half stages a `git rm` under --repo-root for you to commit +
// open a PR (Otto verify-gates security-class changes). It respects shared-checkout-is-view-only — pass
// YOUR OWN clone as --repo-root, never the shared checkout.
import { homedir } from "node:os";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { realBiometric, sessionBiometric } from "./biometric.ts";
import {
  format1PasswordNote,
  formatClusterTeardown,
  realEffects,
  teardownCluster,
  type ClusterTeardownOptions,
} from "./teardown-cluster.ts";

const args = process.argv.slice(2);
const flag = (n: string): boolean => args.includes(n);
const opt = (n: string): string | undefined => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = opt("--repo-root") ?? resolvePath(here, "..", "..", "..");
const ca = opt("--ca");
const home = opt("--home") ?? homedir();
const confirm = flag("--confirm");
const dryRun = !confirm; // DEFAULT-safe: only an explicit --confirm makes it a real run
const note1Password = flag("--note-1password");

function usage(): void {
  process.stderr.write(
    "usage: bun teardown-cluster-cli.ts --ca <name> [--home <path>] [--confirm] " +
      "[--note-1password] [--repo-root <path>]\n" +
      "  DEFAULT-SAFE: no --confirm => DRY RUN (reports what WOULD be wiped/unregistered + cascade warnings; nothing touched, no prompt).\n" +
      "  --confirm => REAL cluster teardown: securely wipe ~/.config/zeta/ca + stage `git rm` of\n" +
      "               maintainers/<ca>/ssh-ca.pub and maintainers/<ca>/trusted-user-ca-keys.pub.\n" +
      "               Requires ONE biometric approval (fail-closed). NEVER pushes — stages a removal for a PR.\n" +
      "  --note-1password => also PRINT which 1Password item corresponds (NEVER deletes it).\n",
  );
}

async function main(): Promise<number> {
  if (ca === undefined || ca.trim().length === 0) {
    usage();
    process.stderr.write("error: --ca <name> is required (the maintainers/<ca>/ trust root to tear down)\n");
    return 2;
  }

  // ONE biometric session over the real gate — wired into the (single) destructive run so the operator
  // is prompted at most once. On a dry-run the door is never called.
  const session = sessionBiometric(realBiometric());

  const opts: ClusterTeardownOptions = {
    ca,
    repoRoot,
    home,
    dryRun,
    confirm,
    biometricAuth: session.door,
  };

  const res = await teardownCluster(realEffects(), opts);
  process.stdout.write(formatClusterTeardown(res) + "\n");
  if (note1Password) {
    process.stdout.write(format1PasswordNote() + "\n");
  }

  // Hard block iff a confirmed run was refused at the biometric gate (nothing was deleted).
  const declined =
    res.confirmed && !res.dryRun && res.biometric !== undefined && !res.biometric.ok;
  return declined ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((e: unknown) => {
    process.stderr.write((e instanceof Error ? e.message : String(e)) + "\n");
    process.exit(1);
  });
