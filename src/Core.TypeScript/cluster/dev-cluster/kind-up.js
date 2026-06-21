#!/usr/bin/env bun
// Bring up the CI-friendly kind substrate for the B-0967 ArgoCD health test.
import { join } from "node:path";
import { assertKindCiStackReady, liveDevClusterPorts } from "./deps.js";
import { assertDnsLabel, assertFileExists, assertGitHubRepoUrl, assertSafeGitRef, DEFAULT_GIT_REPO_URL, DEV_CLUSTER_SUBSTRATE_DIR, readFlagValue, } from "./lib.js";
import { bringUpKindCiCluster } from "./use-cases.js";
function usage() {
    console.error("usage: bun src/Core.TypeScript/cluster/dev-cluster/kind-up.ts [--config <kind-config.yaml>] [--cluster-name <name>] [--git-ref <ref>] [--repo-url <url>]");
    process.exit(1);
}
function main(argv) {
    let configPath = join(DEV_CLUSTER_SUBSTRATE_DIR, "profiles", "ci.kind-config.yaml");
    let clusterName = "zeta-ci";
    let gitRef = "main";
    let gitRepoUrl = DEFAULT_GIT_REPO_URL;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "-h" || arg === "--help")
            usage();
        if (arg === "--config") {
            configPath = readFlagValue(argv, i, arg);
            i++;
            continue;
        }
        if (arg === "--cluster-name") {
            clusterName = readFlagValue(argv, i, arg);
            i++;
            continue;
        }
        if (arg === "--git-ref") {
            gitRef = readFlagValue(argv, i, arg);
            i++;
            continue;
        }
        if (arg === "--repo-url") {
            gitRepoUrl = readFlagValue(argv, i, arg);
            i++;
            continue;
        }
        usage();
    }
    assertFileExists(configPath, "kind config");
    assertDnsLabel(clusterName, "cluster name");
    assertSafeGitRef(gitRef);
    assertGitHubRepoUrl(gitRepoUrl);
    const ports = liveDevClusterPorts({ clusterShape: "kind-in-docker" });
    assertKindCiStackReady(ports);
    bringUpKindCiCluster(ports, { configPath, clusterName, gitRef, gitRepoUrl });
    console.log(`
Kind CI cluster up.

  kubectl get nodes
  kubectl -n argocd get applications

Tear down: bun src/Core.TypeScript/cluster/dev-cluster/kind-down.ts --cluster-name ${clusterName}
`);
}
if (import.meta.main) {
    main(process.argv.slice(2));
}
