// Zeta machine/status CLI — a thin shell around the pure oracle (machine.ts).
// Two modes, both SAFE:
//   status  (READ-ONLY)  — the two-part (user × machine) presence check, no generation.
//   machine (GATED)      — generate THIS machine's PURE per-host ed25519 machine key (only),
//                          label = MACHINE only (no `user@`); private stays local under umask
//                          077; --publish writes ONLY the public key to the USER-INDEPENDENT
//                          registry `machines/<host>.pub` at repo root (no commit).
// SECURITY: no seed/CA/persona key generated; no secret to argv/stdout/git. See machine.ts.
// PURE-KEY MODEL (Aaron 2026-06-21): a machine key is a host identity shared across users; the
// (user × machine) binding is a CA cert (ca.ts), never baked into the key or filed per-user.
//
// Usage:
//   bun machine-cli.ts status  --user aaron
//   bun machine-cli.ts machine --dry-run                     # generates NOTHING
//   bun machine-cli.ts machine                               # generate local PURE machine key
//   bun machine-cli.ts machine --publish                     # + register public key to machines/ (no commit)
//   bun machine-cli.ts machine --owner aaron --publish       # record an attribution owner (NOT in the key label)
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkPresence, ensureMachineKey, formatStatus, realEffects } from "./machine.ts";
import { realBiometric } from "./biometric.ts";

const args = process.argv.slice(2);
const mode = args[0];
const flag = (n: string) => args.includes(n);
const opt = (n: string) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};

const user = opt("--user") ?? "zeta";
const owner = opt("--owner"); // OPTIONAL attribution METADATA only — NEVER in the key label
// Repo root: 3 levels up from tools/setup/persona-keys/ (override with --repo-root for tests).
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = opt("--repo-root") ?? resolve(here, "..", "..", "..");
const fx = realEffects();

async function main(): Promise<number> {
  if (mode === "status" || mode === "whoami") {
    const s = checkPresence(fx, { user, repoRoot });
    console.log(formatStatus(s));
    console.log(`  user keyring: ${s.userKeyringPath}`);
    console.log(`  machine key (local, private): ${s.devicePrivatePath}`);
    console.log(`  machine pubkey (registry path): ${s.devicePublicPath}`);
    return 0;
  }

  if (mode === "machine") {
    const dryRun = flag("--dry-run");
    const publish = flag("--publish");
    // AGENT-RUN, OPERATOR-APPROVED: the shared biometric gate authorizes the real keygen
    // (fail-closed). Dry-run never invokes it. PURE key — label is the MACHINE only.
    const r = await ensureMachineKey(fx, {
      repoRoot,
      publish,
      dryRun,
      biometricAuth: realBiometric(),
      ...(owner !== undefined ? { owner } : {}),
    });
    if (r.dryRun) {
      console.log(`[dry-run] action=${r.action} key label="${r.keyLabel}" (NOTHING generated or written)`);
      console.log(`[dry-run] would write private key to: ${r.devicePrivatePath}`);
      if (publish) console.log(`[dry-run] would register PUBLIC key at: ${r.devicePublicPath}`);
      return 0;
    }
    if (r.action === "aborted-biometric") {
      console.error(
        `blocked: biometric ${r.biometric?.reason ?? "not approved"} — NO machine key generated (fail-closed).`,
      );
      return 1;
    }
    console.log(`action=${r.action} hostname=${r.hostname} key label="${r.keyLabel}"`);
    console.log(`private key (local only): ${r.devicePrivatePath}`);
    if (r.published) console.log(`registered PUBLIC key -> ${r.devicePublicPath} (NOT committed)`);
    // Printing the PUBLIC key is safe (it is the publishable trust artifact).
    if (r.publicKey !== undefined) console.log(r.publicKey);
    return 0;
  }

  console.error("usage: bun machine-cli.ts <status|whoami|machine> [--user <name>] [--owner <name>] [--dry-run] [--publish]");
  return 2;
}

main()
  .then((code) => process.exit(code))
  .catch((e: unknown) => {
    process.stderr.write((e instanceof Error ? e.message : String(e)) + "\n");
    process.exit(1);
  });
