/**
 * full-ai-cluster/nixos/cluster-discovery/cli.ts
 *
 * The entrypoint a first-boot script calls: probe the segment, decide, print.
 *
 * Contract, so a caller can branch without parsing prose:
 *   exit 0  a decision was reached; stdout carries one JSON line whose
 *           `action` is "bootstrap" or "join"
 *   exit 3  the situation is ambiguous or the probe failed; the JSON line
 *           carries `action: "refuse"`, a reason, and an operator action
 *   exit 2  the arguments were wrong
 *
 * CREDENTIALS ARE NOT READ HERE. `--token-present` is a boolean the caller
 * supplies, and `--expect-cluster-id` is the PUBLIC CA pin the caller derived
 * from the token prefix. Nothing in this process opens the token file, so no
 * secret can reach a log line, a JSON field or a crash trace.
 */

import { readdir, readFile } from "node:fs/promises";

import { clusterIdFromK3sTokenPrefix } from "./advertisement";
import {
  DEFAULT_DWELL_MS,
  decideClusterBoot,
  type ClusterBootDecisionInput,
  type DiscoveryPolicy,
  type ExplicitRoleDeclaration,
  type JoinCredentialState,
} from "./decide";
import { PASS_TIMEOUT_MS, probeForClusters, type BrowsePassResult } from "./probe";

/** Minimal flag reader. Unknown flags are an error, never a silent ignore. */
export function parseArgs(argv: readonly string[]): Readonly<Record<string, string>> | string {
  const out: Record<string, string> = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      return `unexpected argument ${JSON.stringify(arg)}`;
    }
    const body = arg.slice(2);
    const eq = body.indexOf("=");
    if (eq === -1) {
      out[body] = "true";
      continue;
    }
    out[body.slice(0, eq)] = body.slice(eq + 1);
  }
  return out;
}

const KNOWN_FLAGS = [
  "dwell-ms",
  "trust-domain",
  "token-present",
  "expect-cluster-id",
  "token-prefix",
  "role",
  "role-source",
  "join-server-url",
  "acknowledge-short-dwell",
  "avahi-browse",
];

/**
 * Is there a link to query on?
 *
 * Reads operstate for every non-loopback interface. A probe run before the NIC
 * is up would hear nothing for a reason that has nothing to do with whether a
 * cluster exists, and would then bootstrap -- so the absence of carrier is
 * reported as a probe failure rather than folded into the dwell.
 */
export async function anyInterfaceUp(sysClassNet = "/sys/class/net"): Promise<boolean> {
  let names: string[];
  try {
    names = await readdir(sysClassNet);
  } catch {
    return false;
  }
  for (const name of names) {
    if (name === "lo") {
      continue;
    }
    try {
      const state = await readFile(`${sysClassNet}/${name}/operstate`, "utf8");
      if (state.trim() === "up") {
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

/** The exit status `timeout(1)` uses, reused so a killed pass is legible. */
export const KILLED_BY_TIMEOUT_EXIT_CODE = 124;

/**
 * Real process runner. Returns null when the binary is absent, so the probe
 * reports `browser-missing` rather than an empty network.
 *
 * A pass that does not terminate is KILLED and reported as a failure. With
 * `--terminate` the browser exits by itself once the responder has said
 * all-for-now, so a pass still running after this long is hung -- and a hung
 * pass inside a first-boot install is an install that never finishes.
 */
export function bunBrowseRunner(
  binary: string,
  timeoutMs = PASS_TIMEOUT_MS,
): (args: readonly string[]) => Promise<BrowsePassResult | null> {
  return async (args) => {
    try {
      const child = Bun.spawn([binary, ...args], { stdout: "pipe", stderr: "pipe" });
      let timedOut = false;
      const killer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, timeoutMs);
      const [stdout, stderr] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]);
      const exitCode = await child.exited;
      clearTimeout(killer);
      if (timedOut) {
        const note = `zeta-cluster-discover: pass killed after ${String(timeoutMs)} ms without terminating`;
        return { exitCode: KILLED_BY_TIMEOUT_EXIT_CODE, stdout, stderr: `${stderr}\n${note}` };
      }
      return { exitCode, stdout, stderr };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("ENOENT")) {
        return null;
      }
      return { exitCode: 127, stdout: "", stderr: message };
    }
  };
}

/** Build the decision input from flags. Pure: no I/O, so it is unit-testable. */
export function credentialStateFromFlags(flags: Readonly<Record<string, string>>): JoinCredentialState | string {
  const tokenPresent = flags["token-present"] === "true";
  const prefix = flags["token-prefix"];
  const explicitPin = flags["expect-cluster-id"];
  if (prefix !== undefined) {
    if (explicitPin !== undefined) {
      return "pass --token-prefix or --expect-cluster-id, not both";
    }
    const derived = clusterIdFromK3sTokenPrefix(prefix);
    if (!derived.ok) {
      return derived.problem;
    }
    return { tokenAvailable: tokenPresent, expectedClusterId: derived.clusterId, source: "token-prefix" };
  }
  if (explicitPin !== undefined) {
    return { tokenAvailable: tokenPresent, expectedClusterId: explicitPin, source: "expect-cluster-id" };
  }
  return { tokenAvailable: tokenPresent };
}

export function explicitRoleFromFlags(flags: Readonly<Record<string, string>>): ExplicitRoleDeclaration | undefined {
  const role = flags["role"];
  if (role === undefined) {
    return undefined;
  }
  const source = flags["role-source"] ?? "unspecified";
  const joinServerUrl = flags["join-server-url"];
  if (joinServerUrl === undefined) {
    return { role, source };
  }
  return { role, source, joinServerUrl };
}

export function policyFromFlags(flags: Readonly<Record<string, string>>): DiscoveryPolicy {
  const expectedTrustDomain = flags["trust-domain"];
  const acknowledgedShortDwell = flags["acknowledge-short-dwell"] === "true";
  if (expectedTrustDomain === undefined) {
    return { acknowledgedShortDwell };
  }
  return { expectedTrustDomain, acknowledgedShortDwell };
}

/** Exit codes, named so a caller can branch on them without reading prose. */
export const EXIT_DECIDED = 0;
export const EXIT_BAD_ARGUMENTS = 2;
export const EXIT_REFUSED = 3;

export async function main(argv: readonly string[]): Promise<number> {
  const flags = parseArgs(argv);
  if (typeof flags === "string") {
    console.error(`zeta-cluster-discover: ${flags}`);
    return EXIT_BAD_ARGUMENTS;
  }
  for (const key of Object.keys(flags)) {
    if (!KNOWN_FLAGS.includes(key)) {
      console.error(`zeta-cluster-discover: unknown flag --${key}`);
      return EXIT_BAD_ARGUMENTS;
    }
  }
  const dwellRaw = flags["dwell-ms"];
  const dwellMs = dwellRaw === undefined ? DEFAULT_DWELL_MS : Number(dwellRaw);
  if (!Number.isInteger(dwellMs)) {
    console.error("zeta-cluster-discover: --dwell-ms must be an integer number of milliseconds");
    return EXIT_BAD_ARGUMENTS;
  }
  const credentials = credentialStateFromFlags(flags);
  if (typeof credentials === "string") {
    console.error(`zeta-cluster-discover: ${credentials}`);
    return EXIT_BAD_ARGUMENTS;
  }

  const probe = await probeForClusters({
    runBrowse: bunBrowseRunner(flags["avahi-browse"] ?? "avahi-browse"),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => Date.now(),
    hasCarrier: () => anyInterfaceUp(),
    dwellMs,
  });

  const input: ClusterBootDecisionInput = {
    probe,
    credentials,
    policy: policyFromFlags(flags),
  };
  const explicitRole = explicitRoleFromFlags(flags);
  const decision = decideClusterBoot(explicitRole === undefined ? input : { ...input, explicitRole });

  for (const note of decision.notes) {
    console.error(`zeta-cluster-discover: ${note}`);
  }
  console.log(JSON.stringify(decision));
  return decision.action === "refuse" ? EXIT_REFUSED : EXIT_DECIDED;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
