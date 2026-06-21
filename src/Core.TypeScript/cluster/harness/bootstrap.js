// In-process dev-cluster bootstrap for argocd-health-test (no bun subprocess spawn).
import { join } from "node:path";
import { assertKindCiStackReady, assertK3dDevStackReady, liveDevClusterPorts, } from "../dev-cluster/deps.js";
import { assertDnsLabel, assertFileExists, assertGitHubRepoUrl, assertSafeGitRef, DEFAULT_GIT_REPO_URL, DEV_CLUSTER_SUBSTRATE_DIR, parseK3dAgentCount, parseK3dClusterName, } from "../dev-cluster/lib.js";
import { bringUpKindCiCluster, bringUpK3dDevCluster } from "../dev-cluster/use-cases.js";
export function bootstrapKindClusterInProcess(options) {
    if (options.containerRuntime) {
        process.env.ZETA_CONTAINER_RUNTIME = options.containerRuntime;
    }
    assertFileExists(options.configPath, "kind config");
    assertDnsLabel(options.clusterName, "cluster name");
    assertSafeGitRef(options.gitRef);
    const gitRepoUrl = options.gitRepoUrl ?? DEFAULT_GIT_REPO_URL;
    assertGitHubRepoUrl(gitRepoUrl);
    const ports = liveDevClusterPorts({ clusterShape: "kind-in-docker" });
    assertKindCiStackReady(ports);
    bringUpKindCiCluster(ports, {
        configPath: options.configPath,
        clusterName: options.clusterName,
        gitRef: options.gitRef,
        gitRepoUrl,
    });
}
export function bootstrapK3dClusterInProcess(options) {
    assertFileExists(options.configPath, "k3d config");
    const clusterName = parseK3dClusterName(options.configPath);
    assertDnsLabel(clusterName, "k3d config metadata.name");
    const kubeApiHost = `k3d-${clusterName}-server-0`;
    const agentCount = parseK3dAgentCount(options.configPath);
    assertSafeGitRef(options.gitRef);
    const gitRepoUrl = options.gitRepoUrl ?? DEFAULT_GIT_REPO_URL;
    assertGitHubRepoUrl(gitRepoUrl);
    const ports = liveDevClusterPorts({ clusterShape: "k3d-in-docker" });
    assertK3dDevStackReady(ports);
    bringUpK3dDevCluster(ports, {
        configPath: options.configPath,
        clusterName,
        agentCount,
        kubeApiHost,
        gitRef: options.gitRef,
        gitRepoUrl,
    });
}
export function defaultKindConfigPath() {
    return join(DEV_CLUSTER_SUBSTRATE_DIR, "profiles", "ci.kind-config.yaml");
}
export function defaultK3dConfigPath() {
    return join(DEV_CLUSTER_SUBSTRATE_DIR, "k3d-config.yaml");
}
