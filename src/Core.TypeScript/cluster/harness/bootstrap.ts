// In-process dev-cluster bootstrap for argocd-health-test (no bun subprocess spawn).

import { join } from "node:path";
import { assertKindCiStackReady, assertK3dDevStackReady, liveDevClusterPorts } from "../dev-cluster/deps.ts";
import {
  assertDnsLabel,
  assertFileExists,
  assertGitHubRepoUrl,
  assertLaneTreeRepoUrl,
  assertSafeGitRef,
  DEFAULT_GIT_REPO_URL,
  DEV_CLUSTER_SUBSTRATE_DIR,
  parseK3dAgentCount,
  parseK3dClusterName,
} from "../dev-cluster/lib.ts";
import { bringUpKindCiCluster, bringUpK3dDevCluster } from "../dev-cluster/use-cases.ts";
import type { KindCni } from "../ports.ts";

export interface KindBootstrapOptions {
  readonly configPath: string;
  readonly clusterName: string;
  readonly gitRef: string;
  readonly gitRepoUrl?: string;
  readonly containerRuntime?: string;
  readonly cni?: KindCni;
  /**
   * Serve a rung-applied copy of the tree in-cluster and point ArgoCD at it.
   * See `KindCiBringUpOptions.laneTree`; absent leaves the committed tree in use.
   */
  readonly laneTree?: { readonly manifests: string; readonly repoUrl: string; readonly gitRef?: string };
  /**
   * One lane's Application directories; absent is the whole roster. Scopes the
   * root catalogue's exclude glob via `laneScopedExcludeGlob`.
   */
  readonly laneDirs?: readonly string[];
}

export function bootstrapKindClusterInProcess(options: KindBootstrapOptions): void {
  if (options.containerRuntime) {
    process.env.ZETA_CONTAINER_RUNTIME = options.containerRuntime;
  }
  assertFileExists(options.configPath, "kind config");
  assertDnsLabel(options.clusterName, "cluster name");
  assertSafeGitRef(options.gitRef);
  const gitRepoUrl = options.gitRepoUrl ?? DEFAULT_GIT_REPO_URL;
  // STILL ASSERTED, and deliberately still asserted on the GitHub URL rather than
  // on whatever the lane ends up cloning. `gitRepoUrl` is the fallback the run
  // uses if no lane tree is supplied, so it must satisfy the same rule it always
  // did; the lane-tree URL is checked separately by `assertLaneTreeRepoUrl`, which
  // accepts exactly one in-cluster shape and nothing else. Widening this predicate
  // to "or an http:// URL" would have let any URL through on the strength of a
  // flag, which is the opposite of what the original guard is for.
  assertGitHubRepoUrl(gitRepoUrl);
  if (options.laneTree !== undefined) assertLaneTreeRepoUrl(options.laneTree.repoUrl);
  const ports = liveDevClusterPorts({ clusterShape: "kind-in-docker" });
  assertKindCiStackReady(ports);
  bringUpKindCiCluster(ports, {
    configPath: options.configPath,
    clusterName: options.clusterName,
    gitRef: options.gitRef,
    gitRepoUrl,
    ...(options.cni === undefined ? {} : { cni: options.cni }),
    ...(options.laneTree === undefined ? {} : { laneTree: options.laneTree }),
    ...(options.laneDirs === undefined ? {} : { laneDirs: options.laneDirs }),
  });
}

export interface K3dBootstrapOptions {
  readonly configPath: string;
  readonly gitRef: string;
  readonly gitRepoUrl?: string;
  /**
   * Serve a rung-applied copy of the tree in-cluster and point ArgoCD at it.
   * Same field as `KindBootstrapOptions.laneTree`; absent leaves the committed
   * tree in use.
   */
  readonly laneTree?: { readonly manifests: string; readonly repoUrl: string; readonly gitRef?: string };
  /**
   * One lane's Application directories; absent is the whole roster. Scopes the
   * root catalogue's exclude glob via `laneScopedExcludeGlob`.
   */
  readonly laneDirs?: readonly string[];
}

export function bootstrapK3dClusterInProcess(options: K3dBootstrapOptions): void {
  assertFileExists(options.configPath, "k3d config");
  const clusterName = parseK3dClusterName(options.configPath);
  assertDnsLabel(clusterName, "k3d config metadata.name");
  const kubeApiHost = `k3d-${clusterName}-server-0`;
  const agentCount = parseK3dAgentCount(options.configPath);
  assertSafeGitRef(options.gitRef);
  const gitRepoUrl = options.gitRepoUrl ?? DEFAULT_GIT_REPO_URL;
  assertGitHubRepoUrl(gitRepoUrl);
  if (options.laneTree !== undefined) assertLaneTreeRepoUrl(options.laneTree.repoUrl);
  const ports = liveDevClusterPorts({ clusterShape: "k3d-in-docker" });
  assertK3dDevStackReady(ports);
  bringUpK3dDevCluster(ports, {
    configPath: options.configPath,
    clusterName,
    agentCount,
    kubeApiHost,
    gitRef: options.gitRef,
    gitRepoUrl,
    ...(options.laneTree === undefined ? {} : { laneTree: options.laneTree }),
    ...(options.laneDirs === undefined ? {} : { laneDirs: options.laneDirs }),
  });
}

export function defaultKindConfigPath(): string {
  return join(DEV_CLUSTER_SUBSTRATE_DIR, "profiles", "ci.kind-config.yaml");
}

export function defaultKindCiliumConfigPath(): string {
  return join(DEV_CLUSTER_SUBSTRATE_DIR, "profiles", "ci.cilium.kind-config.yaml");
}

export function defaultK3dConfigPath(): string {
  return join(DEV_CLUSTER_SUBSTRATE_DIR, "k3d-config.yaml");
}
