#!/usr/bin/env bun
// Bring up the local dev cluster end-to-end (k3d → Cilium → ArgoCD → root app).
import { join } from "node:path";
import { assertK3dDevStackReady, liveDevClusterPorts } from "./deps.js";
import { assertDnsLabel, assertFileExists, assertGitHubRepoUrl, assertSafeGitRef, DEFAULT_GIT_REPO_URL, DEV_CLUSTER_SUBSTRATE_DIR, parseK3dAgentCount, parseK3dClusterName, readFlagValue, } from "./lib.js";
import { bringUpK3dDevCluster } from "./use-cases.js";
function usage() {
    console.error(`usage: bun src/Core.TypeScript/cluster/dev-cluster/k3d-up.ts [git-ref]
       bun src/Core.TypeScript/cluster/dev-cluster/k3d-up.ts --config <k3d-config.yaml> [--git-ref <ref>] [--repo-url <url>]`);
    process.exit(1);
}
function main(argv) {
    let configPath = join(DEV_CLUSTER_SUBSTRATE_DIR, "k3d-config.yaml");
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
        if (gitRef !== "main")
            usage();
        gitRef = arg;
    }
    assertFileExists(configPath, "k3d config");
    const clusterName = parseK3dClusterName(configPath);
    assertDnsLabel(clusterName, "k3d config metadata.name");
    const kubecontext = `k3d-${clusterName}`;
    const kubeApiHost = `${kubecontext}-server-0`;
    const agentCount = parseK3dAgentCount(configPath);
    assertSafeGitRef(gitRef);
    assertGitHubRepoUrl(gitRepoUrl);
    const ports = liveDevClusterPorts({ clusterShape: "k3d-in-docker" });
    assertK3dDevStackReady(ports);
    bringUpK3dDevCluster(ports, {
        configPath,
        clusterName,
        agentCount,
        kubeApiHost,
        gitRef,
        gitRepoUrl,
    });
    console.log(`
Dev cluster up. Same substrate as prod, minus Longhorn + GPU stack.

  kubectl get nodes
  kubectl -n argocd get applications
  kubectl -n argocd port-forward svc/argocd-server 8443:443
  open https://localhost:8443

  kubectl -n argocd get secret argocd-initial-admin-secret \\
    -o jsonpath='{.data.password}' | base64 -d ; echo

Tear down: bun src/Core.TypeScript/cluster/dev-cluster/k3d-down.ts
`);
}
if (import.meta.main) {
    main(process.argv.slice(2));
}
