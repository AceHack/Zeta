// Zeta machine/status CLI — a thin shell around the pure oracle (machine.ts).
// Two modes, both SAFE:
//   status  (READ-ONLY)  — the two-part (user × machine) presence check, no generation.
//   machine (GATED)      — generate THIS machine's per-host ed25519 device key (only),
//                          private stays local under umask 077; --publish writes ONLY the
//                          public key to maintainers/<user>/machines/<host>.pub (no commit).
// SECURITY: no seed/CA/persona key generated; no secret to argv/stdout/git. See machine.ts.
//
// Usage:
//   bun machine-cli.ts status  --user aaron
//   bun machine-cli.ts machine --user aaron --dry-run        # generates NOTHING
//   bun machine-cli.ts machine --user aaron                  # generate local device key
//   bun machine-cli.ts machine --user aaron --publish        # + write public key to repo (no commit)
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkPresence, ensureMachineKey, formatStatus, realEffects } from "./machine.ts";

const args = process.argv.slice(2);
const mode = args[0];
const flag = (n: string) => args.includes(n);
const opt = (n: string) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};

const user = opt("--user") ?? "zeta";
// Repo root: 3 levels up from tools/setup/persona-keys/ (override with --repo-root for tests).
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = opt("--repo-root") ?? resolve(here, "..", "..", "..");
const fx = realEffects();

if (mode === "status" || mode === "whoami") {
  const s = checkPresence(fx, { user, repoRoot });
  console.log(formatStatus(s));
  console.log(`  user keyring: ${s.userKeyringPath}`);
  console.log(`  device key (local, private): ${s.devicePrivatePath}`);
  console.log(`  device pubkey (publish path): ${s.devicePublicPath}`);
  process.exit(0);
}

if (mode === "machine") {
  const dryRun = flag("--dry-run");
  const publish = flag("--publish");
  const r = ensureMachineKey(fx, { user, repoRoot, publish, dryRun });
  if (r.dryRun) {
    console.log(`[dry-run] action=${r.action} (NOTHING generated or written)`);
    console.log(`[dry-run] would write private key to: ${r.devicePrivatePath}`);
    if (publish) console.log(`[dry-run] would write PUBLIC key to: ${r.devicePublicPath}`);
    process.exit(0);
  }
  console.log(`action=${r.action} hostname=${r.hostname}`);
  console.log(`private key (local only): ${r.devicePrivatePath}`);
  if (r.published) console.log(`published PUBLIC key -> ${r.devicePublicPath} (NOT committed)`);
  // Printing the PUBLIC key is safe (it is the publishable trust artifact).
  if (r.publicKey !== undefined) console.log(r.publicKey);
  process.exit(0);
}

console.error("usage: bun machine-cli.ts <status|whoami|machine> --user <name> [--dry-run] [--publish]");
process.exit(2);
