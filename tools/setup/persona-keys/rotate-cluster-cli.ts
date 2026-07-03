#!/usr/bin/env bun
// rotate-cluster-cli.ts — cluster-trust-root rotate (081KVP2M1 deferred gap).
// One command spanning cluster CA + machine scopes; preserves peer CAs in the trust set.
//
// Usage:
//   bun rotate-cluster-cli.ts --ca acme --user aaron                    # dry-run (default)
//   bun rotate-cluster-cli.ts --ca acme --user aaron --confirm          # real rotate (one fingerprint)
//   bun rotate-cluster-cli.ts --ca acme --user aaron --ports ca-key --confirm
import { hostname as osHostname, homedir } from "node:os";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { realBiometric, sessionBiometric } from "./biometric.ts";
import { ROTATE_PORTS, realEffects, type RotatePort } from "./rotate.ts";
import {
  CLUSTER_ROTATE_PORTS,
  formatRotateCluster,
  rotateCluster,
} from "./rotate-cluster.ts";

const args = process.argv.slice(2);
const flag = (n: string): boolean => args.includes(n);
const opt = (n: string): string | undefined => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = opt("--repo-root") ?? resolvePath(here, "..", "..", "..");
const ca = opt("--ca");
const user = opt("--user") ?? ca;
const hostname = opt("--host") ?? osHostname();
const home = opt("--home") ?? homedir();
const certValidity = opt("--validity");
const confirm = flag("--confirm");
const dryRun = !confirm;

const portsArg = opt("--ports");
const ports: readonly RotatePort[] =
  portsArg === undefined
    ? CLUSTER_ROTATE_PORTS
    : (portsArg.split(",").map((p) => p.trim()).filter((p) => p.length > 0) as RotatePort[]);

function usage(): void {
  process.stderr.write(
    "usage: bun rotate-cluster-cli.ts --ca <name> [--user <name>] [--host <name>] [--home <path>] " +
      "[--ports <a,b,c>] [--validity <+52w>] [--confirm] [--repo-root <path>]\n" +
      "  Cluster-trust-root rotate: CA overlap-window + peer CA preservation; default ports span\n" +
      `  cluster + machine scopes (${CLUSTER_ROTATE_PORTS.join(", ")}).\n` +
      "  DEFAULT-SAFE: no --confirm => DRY RUN. --confirm => one biometric, stages for a PR.\n",
  );
}

async function main(): Promise<number> {
  if (!ca?.trim()) {
    usage();
    process.stderr.write("error: --ca <name> is required (cluster trust root identity)\n");
    return 2;
  }
  if (!user?.trim()) {
    usage();
    process.stderr.write("error: --user <name> is required when not implied by --ca\n");
    return 2;
  }
  const badPorts = ports.filter((p) => !ROTATE_PORTS.includes(p));
  if (badPorts.length > 0) {
    usage();
    process.stderr.write(`error: unknown port(s): ${badPorts.join(", ")}\n`);
    return 2;
  }

  const session = sessionBiometric(realBiometric());
  const res = await rotateCluster(realEffects(), {
    ca,
    user,
    repoRoot,
    home,
    hostname,
    ports,
    dryRun,
    confirm,
    biometricAuth: session.door,
    ...(certValidity !== undefined ? { certValidity } : {}),
  });
  process.stdout.write(formatRotateCluster(res) + "\n");

  if (!res.peersPreserved) return 1;
  const declined =
    res.confirmed &&
    !res.dryRun &&
    res.rotate.biometric !== undefined &&
    !res.rotate.biometric.ok;
  return declined ? 1 : 0;
}

if (import.meta.main) {
  main()
    .then((code) => process.exit(code))
    .catch((e: unknown) => {
      process.stderr.write((e instanceof Error ? e.message : String(e)) + "\n");
      process.exit(1);
    });
}

export { main };
