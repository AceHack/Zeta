#!/usr/bin/env bun
// Zeta biometric-gated GitHub PUBLIC-key publish CLI — a thin shell around the pure
// publisher (publish.ts). It reads the EXPLICIT PUBLIC key at `--key` (the USER's identity
// SSH key), requires a biometric confirmation (macOS Touch ID via pam_tid; Windows Hello =
// seam/TODO), and ONLY then uploads it to GitHub via `gh ssh-key add`. PUBLIC key only —
// never a secret. `--dry-run` prompts NOTHING and writes NOTHING.
//
// PURE-KEY MODEL (Aaron 2026-06-21): a MACHINE key is NOT a user's GitHub auth key, so
// `--key` is REQUIRED and there is no machine-key default — publish a USER's pubkey here.
// See publish.ts for the security invariants.
//
// Usage:
//   bun publish-cli.ts --user aaron --key path/to/user.pub   # Touch ID, then publish the USER's pubkey
//   bun publish-cli.ts --user aaron --key ... --type signing # add as a signing key (default: authentication)
//   bun publish-cli.ts --user aaron --key ... --dry-run      # NO biometric prompt, NO GitHub write
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { formatResult, hostHostname, publishKey, realEffects, type PublishOptions } from "./publish.ts";

const args = process.argv.slice(2);
const flag = (n: string): boolean => args.includes(n);
const opt = (n: string): string | undefined => {
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

function usage(): void {
  process.stderr.write(
    "usage: bun publish-cli.ts --user <gh-user> --key <pubfile> [--host <name>] " +
      "[--type authentication|signing] [--dry-run] [--repo-root <path>]\n" +
      "  Publishes the USER's PUBLIC key (--key REQUIRED — a machine key is NOT a GitHub auth key).\n" +
      "  Biometric-gated (Touch ID / Windows Hello), fail-closed, PUBLIC key ONLY.\n",
  );
}

async function main(): Promise<number> {
  if (user === undefined || user.trim().length === 0) {
    usage();
    process.stderr.write("error: --user <gh-user> is required\n");
    return 2;
  }
  if (keyPath === undefined || keyPath.trim().length === 0) {
    usage();
    process.stderr.write("error: --key <pubfile> is required (the USER's PUBLIC key to publish)\n");
    return 2;
  }
  if (keyTypeArg !== undefined && keyTypeArg !== "authentication" && keyTypeArg !== "signing") {
    usage();
    process.stderr.write(`error: --type must be 'authentication' or 'signing' (got '${keyTypeArg}')\n`);
    return 2;
  }
  const keyType: "authentication" | "signing" = keyTypeArg === "signing" ? "signing" : "authentication";

  const opts: PublishOptions = {
    user,
    repoRoot,
    hostname,
    keyType,
    dryRun,
    keyPath,
  };

  const fx = realEffects();
  const res = await publishKey(fx, opts);
  process.stdout.write(formatResult(res) + "\n");

  // Exit code: 0 published / would-publish; 1 aborted (biometric / no key / private material).
  return res.action === "published" || res.action === "would-publish" ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((e: unknown) => {
    process.stderr.write((e instanceof Error ? e.message : String(e)) + "\n");
    process.exit(1);
  });
