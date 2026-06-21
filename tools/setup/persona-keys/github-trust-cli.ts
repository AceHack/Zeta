// Zeta GitHub TEMP-TRUST-ROOT resolver CLI — a thin shell around the pure resolver
// (github-trust.ts). READ-ONLY: it fetches ONLY public github.com/<user>.keys (+ .gpg)
// and PRODUCES a combined authorized-keys trust set. It NEVER writes to GitHub, NEVER
// touches a secret, and NEVER installs the trust set into node trust (that is a later
// slice). `--dry-run` does NO network. See github-trust.ts for the security invariants.
//
//   *** TEMP TRUST ROOT (GitHub) — migrate to cert-manager/Vault + Headscale when
//       clusters are redundant. ***
//
// Usage:
//   bun github-trust-cli.ts status                              # identities from maintainers/ or allowlist
//   bun github-trust-cli.ts status  --user aaron --user octocat # explicit allowlist
//   bun github-trust-cli.ts resolve --user aaron --gpg          # fetch + print the trust set
//   bun github-trust-cli.ts resolve --user aaron --dry-run      # NO network; reports intent
//   bun github-trust-cli.ts resolve --user aaron --emit         # also print authorized-keys text (not installed)
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatStatus,
  realEffects,
  renderAuthorizedKeys,
  resolveIdentities,
  resolveTrustSet,
} from "./github-trust.ts";

const args = process.argv.slice(2);
const mode = args[0];
const flag = (n: string): boolean => args.includes(n);
/** Collect ALL values for a repeatable option (e.g. --user a --user b). */
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
const opt = (n: string): string | undefined => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};

const here = dirname(fileURLToPath(import.meta.url));
// Repo root: 3 levels up from tools/setup/persona-keys/ (override with --repo-root).
const repoRoot = opt("--repo-root") ?? resolvePath(here, "..", "..", "..");
const explicitUsers = allOpts("--user");
const allowlistPath = opt("--allowlist");
const includeGpg = flag("--gpg");
const dryRun = flag("--dry-run");

async function main(): Promise<number> {
  if (mode !== "status" && mode !== "resolve") {
    console.error(
      "usage: bun github-trust-cli.ts <status|resolve> [--user <gh-user> ...] [--allowlist <path>] [--gpg] [--dry-run] [--emit]",
    );
    return 2;
  }

  const fx = realEffects();
  const idRes = resolveIdentities(fx, {
    repoRoot,
    ...(explicitUsers.length > 0 ? { identities: explicitUsers } : {}),
    ...(allowlistPath !== undefined ? { allowlistPath } : {}),
  });

  if (idRes.rejected.length > 0) {
    console.error(`rejected invalid GitHub usernames: ${idRes.rejected.join(", ")}`);
  }
  console.error(`identity source: ${idRes.sourceKind}`);

  if (mode === "status" && idRes.identities.length === 0) {
    console.log(formatStatus({ dryRun: true, includeGpg, identities: [], perIdentity: [], trustSet: [], gpgBlocks: [] }));
    console.error("no trusted identities resolved — pass --user, add an allowlist, or populate maintainers/.");
    return 0;
  }

  // status without explicit fetch intent stays a DRY readout (no network) unless resolve.
  const effectiveDryRun = mode === "status" ? true : dryRun;
  const res = await resolveTrustSet(fx, { identities: idRes.identities, includeGpg, dryRun: effectiveDryRun });

  console.log(formatStatus(res));

  if (mode === "resolve" && !res.dryRun) {
    if (flag("--emit")) {
      console.log("\n--- authorized-keys trust set (PRODUCED, NOT installed) ---");
      console.log(renderAuthorizedKeys(res));
    }
    const anyError = res.perIdentity.some((p) => p.status === "error");
    if (anyError) {
      console.error("one or more identities failed to resolve (see ERROR above).");
      return 1;
    }
  }
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
