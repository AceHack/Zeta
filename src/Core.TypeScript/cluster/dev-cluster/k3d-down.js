#!/usr/bin/env bun
// Tear down the local dev cluster + its registry. Idempotent.
import { join } from "node:path";
import { liveDevClusterPorts } from "./deps.js";
import { assertDnsLabel, assertFileExists, DEV_CLUSTER_SUBSTRATE_DIR, parseK3dClusterName, readFlagValue } from "./lib.js";
import { tearDownK3dDevCluster } from "./use-cases.js";
function usage() {
    console.error("usage: bun src/Core.TypeScript/cluster/dev-cluster/k3d-down.ts [--config <k3d-config.yaml>]");
    process.exit(1);
}
function main(argv) {
    let configPath = join(DEV_CLUSTER_SUBSTRATE_DIR, "k3d-config.yaml");
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "-h" || arg === "--help")
            usage();
        if (arg === "--config") {
            configPath = readFlagValue(argv, i, arg);
            i++;
            continue;
        }
        usage();
    }
    assertFileExists(configPath, "k3d config");
    const clusterName = parseK3dClusterName(configPath);
    assertDnsLabel(clusterName, "k3d config metadata.name");
    const ports = liveDevClusterPorts({ clusterShape: "k3d-in-docker" });
    tearDownK3dDevCluster(ports, clusterName);
}
if (import.meta.main) {
    main(process.argv.slice(2));
}
