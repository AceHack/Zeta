#!/usr/bin/env bun
// Apply the dev/CI root App-of-Apps against the current cluster control plane context.

import { liveDevClusterPorts } from "./deps.ts";
import { assertGitHubRepoUrl, assertSafeGitRef, DEFAULT_GIT_REPO_URL } from "./lib.ts";
import {
  applyDevBootstrapSecrets,
  applyDevRegistryPullSecret,
  applyDevStorageClassAliases,
} from "./use-cases.ts";

export function applyRootApp(gitRef: string, gitRepoUrl: string = DEFAULT_GIT_REPO_URL): void {
  assertSafeGitRef(gitRef);
  assertGitHubRepoUrl(gitRepoUrl);
  const ports = liveDevClusterPorts({ clusterShape: "kind-in-docker" });
  // The THIRD door into the root catalogue, beside the two bring-ups -- and the
  // one the bring-up falsifiers do not watch. The aliases must precede it here
  // for the same reason they do there: a longhorn-backed Application synced into
  // a cluster with no such class leaves a PVC Pending, ArgoCD reports Pending as
  // Progressing rather than Degraded, so the Application never fails -- it just
  // never finishes. Applying a StorageClass that is already present is a no-op,
  // so this is safe when the cluster came up through a bring-up that did it.
  applyDevStorageClassAliases(ports);
  // Same third-door reasoning, different substrate: Grafana's admin Secret is
  // not part of the kube-prometheus-stack Application, so a root applied through
  // this entrypoint into a cluster that never had one leaves Grafana in
  // CreateContainerConfigError. Minting an already-present Secret is skipped
  // rather than rotated, so this is safe after a bring-up that did it.
  applyDevBootstrapSecrets(ports);
  applyDevRegistryPullSecret(ports);
  ports.appCatalog.applyRootDevCatalog(gitRef, gitRepoUrl);
}

function usage(): never {
  console.error("usage: bun src/Core.TypeScript/cluster/dev-cluster/apply-root-app.ts [git-ref] [repo-url]");
  process.exit(1);
}

function main(argv: readonly string[]): void {
  if (argv.includes("-h") || argv.includes("--help")) {
    usage();
  }
  applyRootApp(argv[0] ?? "main", argv[1] ?? DEFAULT_GIT_REPO_URL);
}

if (import.meta.main) {
  main(process.argv.slice(2));
}
