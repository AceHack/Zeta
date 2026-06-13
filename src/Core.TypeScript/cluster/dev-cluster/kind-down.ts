#!/usr/bin/env bun
// Tear down a kind cluster used by dev/CI.

import { liveDevClusterPorts } from "./deps.ts";
import { assertDnsLabel, readFlagValue } from "./lib.ts";
import { tearDownKindCluster } from "./use-cases.ts";

const DEFAULT_CLUSTER_NAME = "zeta-ci";

function usage(): never {
  console.error("usage: bun src/Core.TypeScript/cluster/dev-cluster/kind-down.ts [--cluster-name <name>]");
  process.exit(1);
}

function main(argv: readonly string[]): void {
  let clusterName = DEFAULT_CLUSTER_NAME;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "-h" || arg === "--help") usage();
    if (arg === "--cluster-name") {
      clusterName = readFlagValue(argv, i, arg)!;
      i++;
      continue;
    }
    usage();
  }

  assertDnsLabel(clusterName, "cluster name");
  const ports = liveDevClusterPorts({ clusterShape: "kind-in-docker" });
  tearDownKindCluster(ports, clusterName);
}

if (import.meta.main) {
  main(process.argv.slice(2));
}
