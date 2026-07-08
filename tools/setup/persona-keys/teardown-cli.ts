#!/usr/bin/env bun
// Zeta teardown CLI — the DESTRUCTIVE inverse of setup-machine: wipe THIS host's local private
// material AND stage the unregistration of its registered PUBLIC artifacts (for a PR). A thin shell
// around the pure `teardown.ts` orchestrator; it owns NO key/biometric/git logic of its own.
//
// DEFAULT-SAFE: with NO flags this is a DRY RUN — it reports exactly what WOULD be wiped /
// unregistered and touches NOTHING and NEVER prompts. A real teardown requires `--confirm` AND the
// operator approving ONE biometric (Touch ID / Windows Hello). A declined biometric ⇒ nothing
// deleted (fail-closed). Idempotent: a second run after a teardown is a clean "already clean" no-op.
//
// Usage:
//   bun teardown-cli.ts --ca aaron                         # DRY RUN (default — nothing touched)
//   bun teardown-cli.ts --ca aaron --confirm               # REAL teardown (one fingerprint)
//   bun teardown-cli.ts --ca aaron --host mymac --confirm  # explicit hostname
//   bun teardown-cli.ts --ca aaron --note-1password        # also PRINT the 1Password items (no delete)
//   bun teardown-cli.ts --ca aaron --cascade               # also PRINT cascade blast-radius plan
//
// This NEVER pushes: the repo-unregister half stages a `git rm` under --repo-root for you to commit
// + open a PR (Otto verify-gates security-class changes). It respects shared-checkout-is-view-only —
// pass YOUR OWN clone as --repo-root, never the shared checkout.
import { hostname as osHostname } from "node:os";
import { homedir } from "node:os";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { realBiometric, sessionBiometric } from "./biometric.ts";
import { formatCascadePlan, planCascadeTeardown, type CascadeTeardownInventory } from "./cascade-teardown.ts";
import {
  format1PasswordNote,
  formatTeardown,
  realEffects,
  teardown,
  type TeardownOptions,
  type TeardownResult,
} from "./teardown.ts";

const args = process.argv.slice(2);
const flag = (n: string): boolean => args.includes(n);
const opt = (n: string): string | undefined => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = opt("--repo-root") ?? resolvePath(here, "..", "..", "..");
const ca = opt("--ca");
const hostname = opt("--host") ?? osHostname();
const home = opt("--home") ?? homedir();
const confirm = flag("--confirm");
const dryRun = !confirm; // DEFAULT-safe: only an explicit --confirm makes it a real run
const note1Password = flag("--note-1password");
const cascade = flag("--cascade");

function usage(): void {
  process.stderr.write(
    "usage: bun teardown-cli.ts --ca <name> [--host <name>] [--home <path>] [--confirm] " +
      "[--note-1password] [--cascade] [--repo-root <path>]\n" +
      "  DEFAULT-SAFE: no --confirm => DRY RUN (reports what WOULD be wiped/unregistered; nothing touched, no prompt).\n" +
      "  --confirm => REAL teardown: securely wipe ~/.config/zeta/{ca,machine,keyring,keyset} +\n" +
      "               stage `git rm` of maintainers/<ca>/ssh-ca.pub, machines/<host>.pub, machines/<host>-cert.pub.\n" +
      "               Requires ONE biometric approval (fail-closed). NEVER pushes — stages a removal for a PR.\n" +
      "  --note-1password => also PRINT which 1Password items correspond (NEVER deletes them).\n" +
      "  --cascade => also PRINT a dry-run cascade blast-radius plan from the public inventory.\n",
  );
}

async function main(): Promise<number> {
  if (ca === undefined || ca.trim().length === 0) {
    usage();
    process.stderr.write("error: --ca <name> is required (the maintainers/<ca>/ trust root to unregister)\n");
    return 2;
  }

  // ONE biometric session over the real gate — wired into the (single) destructive run so the
  // operator is prompted at most once. On a dry-run the door is never called.
  const session = sessionBiometric(realBiometric());

  const opts: TeardownOptions = {
    ca,
    repoRoot,
    home,
    hostname,
    dryRun,
    confirm,
    biometricAuth: session.door,
  };

  const res = await teardown(realEffects(), opts);
  if (cascade) {
    process.stdout.write(formatCascadePlan(planCascadeTeardown(cascadeInputFromTeardown(res))) + "\n");
  }
  process.stdout.write(formatTeardown(res) + "\n");
  if (note1Password) {
    process.stdout.write(format1PasswordNote() + "\n");
  }

  // Hard block iff a confirmed run was refused at the biometric gate (nothing was deleted).
  const declined = res.confirmed && !res.dryRun && res.biometric !== undefined && !res.biometric.ok;
  return declined ? 1 : 0;
}

function cascadeInputFromTeardown(res: TeardownResult) {
  const target = { id: `ca:${res.ca}`, ownerUserId: res.ca };
  return {
    target,
    requestedByUserId: res.ca,
    inventory: cascadeInventoryFromTeardown(res, target.id),
  };
}

function cascadeInventoryFromTeardown(res: TeardownResult, targetId: string): CascadeTeardownInventory {
  const present = res.repoUnregister.filter((entry) => entry.present);
  return {
    machines: present
      .filter((entry) => entry.kind === "machine-pubkey")
      .map((entry) => ({
        id: entry.relPath,
        kind: "machine" as const,
        label: entry.relPath,
        dependsOn: [targetId],
      })),
    certs: present
      .filter((entry) => entry.kind === "machine-cert")
      .map((entry) => ({
        id: entry.relPath,
        kind: "cert" as const,
        label: entry.relPath,
        dependsOn: [targetId],
      })),
    registrations: present
      .filter((entry) => entry.kind === "ca-pubkey")
      .map((entry) => ({
        id: entry.relPath,
        kind: "registration" as const,
        label: entry.relPath,
        dependsOn: [targetId],
      })),
  };
}

main()
  .then((code) => process.exit(code))
  .catch((e: unknown) => {
    process.stderr.write((e instanceof Error ? e.message : String(e)) + "\n");
    process.exit(1);
  });
