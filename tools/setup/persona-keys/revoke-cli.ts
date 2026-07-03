#!/usr/bin/env bun
// revoke-cli.ts — revoke a compromised machine cert via OpenSSH KRL (081KVP2M1QS08QG0R000JSXE1E).
//
// Usage:
//   bun revoke-cli.ts --ca aaron --host mymac                    # dry-run (default)
//   bun revoke-cli.ts --ca aaron --host mymac --confirm          # real revoke (one fingerprint)
//   bun revoke-cli.ts --ca aaron --cert path/to/cert.pub --confirm
import { hostname as osHostname } from "node:os";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { realBiometric, sessionBiometric } from "./biometric.ts";
import { formatRevoke, realEffects, revokeCert } from "./revoke.ts";

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
const certPath = opt("--cert");
const reason = opt("--reason");
const confirm = flag("--confirm");
const dryRun = !confirm;

function usage(): void {
  process.stderr.write(
    "usage: bun revoke-cli.ts --ca <name> [--host <name>|--cert <path>] [--reason ...] [--confirm] [--repo-root <path>]\n" +
      "  DEFAULT: dry-run — reports KRL update plan, touches nothing.\n" +
      "  --confirm: append cert serial to maintainers/<ca>/revoked-keys.krl (one biometric).\n",
  );
}

async function main(): Promise<number> {
  if (!ca?.trim()) {
    usage();
    return 2;
  }
  const session = sessionBiometric(realBiometric());
  const res = await revokeCert(realEffects(), {
    ca,
    repoRoot,
    hostname,
    ...(certPath ? { certPath: resolvePath(certPath) } : {}),
    dryRun,
    confirm,
    biometricAuth: session.door,
    ...(reason ? { reason } : {}),
  });
  process.stdout.write(`${formatRevoke(res)}\n`);
  if (res.action === "failed") return 1;
  if (res.action === "skipped-biometric") return 1;
  return 0;
}

if (import.meta.main) {
  main().then((c) => process.exit(c));
}
