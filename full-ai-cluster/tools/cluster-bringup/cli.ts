#!/usr/bin/env bun
// full-ai-cluster/tools/cluster-bringup/cli.ts
//
// Read-only cluster bring-up ladder.
//
//   status   probe the recorded estate and classify it; rc 0/3/1
//   plan     the same, plus the ordered acts a human would run next — printed, never run
//
//   rc 0 = ready (one identified, addressable cluster)
//   rc 3 = reachable but a prerequisite is missing (EXPECTED; the acts are named)
//   rc 1 = blocked (a real failure; the stage says which)
//   rc 2 = usage
//
// THERE IS NO `apply` VERB, AND THERE MUST NOT BE ONE HERE.
//
// Everything this tool identifies as a next act is either (a) an operator act with a
// credential in it (fetching a kubeconfig), or (b) irreversible (re-provisioning a node,
// initialising Vault). Neither belongs behind a flag on a status command. When the apply
// half is written it belongs in `tools/setup/persona-keys/` and must go through
// `runGatedCeremony` in `ceremony-handoff.ts`, which resolves credentials BEFORE opening
// the biometric door and defaults to a dry run.
//
// Vault initialisation in particular is not merely gated but currently UNNAMEABLE: the
// closed operation set in `src/Core.TypeScript/federated-identity/ceremony-gate.ts` has no
// member covering it, and extending a closed set is a maintainer decision. See the
// research note beside this file.

import { classifyEstate, readinessExitCode, renderReadiness } from "./estate.ts";
import { addressesToProbe, arpTable, kubeContexts, observeAddress, readNodeRecords } from "./probe.ts";

function usage(): string {
  return [
    "usage:",
    "  bun full-ai-cluster/tools/cluster-bringup/cli.ts status [--address <ip>]... [--verbose]",
    "  bun full-ai-cluster/tools/cluster-bringup/cli.ts plan   [--address <ip>]... [--verbose]",
    "",
    "  rc 0 = one identified, addressable cluster",
    "  rc 3 = reachable, a prerequisite is missing (expected; the acts are named)",
    "  rc 1 = blocked (a real failure)",
    "  rc 2 = usage",
    "",
    "  This tool never writes anything and never touches a cluster.",
  ].join("\n");
}

function repoRoot(): string {
  // The tool lives two directories below full-ai-cluster/, which sits at the repo root.
  return new URL("../../../", import.meta.url).pathname.replace(/\/$/, "");
}

export function main(argv: readonly string[] = process.argv.slice(2)): 0 | 1 | 2 | 3 {
  if (argv.includes("-h") || argv.includes("--help")) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  const verb = argv[0];
  if (verb !== "status" && verb !== "plan") {
    process.stderr.write(`cluster-bringup: unknown verb ${verb ?? "(none)"}\n\n${usage()}\n`);
    return 2;
  }
  const verbose = argv.includes("--verbose");
  const explicit: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--address" && argv[i + 1] !== undefined) explicit.push(String(argv[i + 1]));
  }

  const records = readNodeRecords(repoRoot());
  const arp = arpTable();
  const addresses = addressesToProbe(records, arp, explicit);
  const observed = addresses.map((a) => observeAddress(a, arp));
  const contexts = kubeContexts();

  if (verbose) {
    process.stdout.write(`records   ${records.length}\n`);
    for (const r of records) {
      process.stdout.write(`  ${r.hostname.padEnd(16)} ${r.mac}  flake-host=${r.flakeHost ?? "-"}  (${r.maintainer})\n`);
    }
    process.stdout.write(`probed    ${observed.length}\n`);
    for (const o of observed) {
      process.stdout.write(
        `  ${o.address.padEnd(16)} icmp=${o.icmpResponded ? "yes" : "no "} api=${o.apiServerResponded ? "yes" : "no "}` +
          `  says="${o.servedNodeName ?? "-"}"  cluster-ca=${o.caPublicKeySha256?.slice(0, 16) ?? "-"}\n`,
      );
    }
    process.stdout.write(`contexts  ${contexts.length}\n`);
    for (const c of contexts) process.stdout.write(`  ${c.name.padEnd(26)} ${c.server}\n`);
    process.stdout.write("\n");
  }

  const readiness = classifyEstate({ records, observed, kubeContexts: contexts });
  process.stdout.write(`${renderReadiness("cluster bring-up ladder", readiness)}\n`);

  if (verb === "plan") {
    process.stdout.write(
      [
        "",
        "ORDERED BRING-UP — each step is printed for a human. This tool runs none of them.",
        "",
        "  1. Resolve the estate to ONE cluster. Until `status` reports rc 0 or an",
        "     actionable rung, nothing below is safe: an irreversible command would land",
        "     on an unidentified machine.",
        "  2. Fetch a kubeconfig for the chosen cluster onto the operator workstation and",
        "     rewrite its server address away from 127.0.0.1.",
        "  3. Confirm what is actually deployed (ArgoCD, storage class, Vault) — this tool",
        "     cannot see inside a cluster it has no credential for, and does not guess.",
        "  4. Vault syncs at sync-wave -60 and comes up SEALED. `vault status` exits 2 when",
        "     sealed and 1 on error: a NotReady pod exiting 2 is correct, not a regression.",
        "  5. STOP. `vault operator init` is a gated class and is not designed to be run",
        "     from any tool in this repository without a fresh human decision on unseal-key",
        "     custody. See the research note beside this file.",
        "",
      ].join("\n"),
    );
  }

  return readinessExitCode(readiness);
}

if (import.meta.main) {
  process.exit(main());
}
