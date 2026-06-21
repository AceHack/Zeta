#!/usr/bin/env bun
// Apply the dev/CI root App-of-Apps against the current cluster control plane context.
import { liveDevClusterPorts } from "./deps.js";
import { assertGitHubRepoUrl, assertSafeGitRef, DEFAULT_GIT_REPO_URL } from "./lib.js";
export function applyRootApp(gitRef, gitRepoUrl = DEFAULT_GIT_REPO_URL) {
    assertSafeGitRef(gitRef);
    assertGitHubRepoUrl(gitRepoUrl);
    const ports = liveDevClusterPorts({ clusterShape: "kind-in-docker" });
    ports.appCatalog.applyRootDevCatalog(gitRef, gitRepoUrl);
}
function usage() {
    console.error("usage: bun src/Core.TypeScript/cluster/dev-cluster/apply-root-app.ts [git-ref] [repo-url]");
    process.exit(1);
}
function main(argv) {
    if (argv.includes("-h") || argv.includes("--help")) {
        usage();
    }
    applyRootApp(argv[0] ?? "main", argv[1] ?? DEFAULT_GIT_REPO_URL);
}
if (import.meta.main) {
    main(process.argv.slice(2));
}
