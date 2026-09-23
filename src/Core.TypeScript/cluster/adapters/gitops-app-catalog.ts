import { laneScopedExcludeGlob, listApplicationDirs } from "../application-dirs.ts";
import { REPO_ROOT } from "../dev-cluster/lib.ts";
import {
  buildRootDevCatalogManifest, rootDevCatalogExcludeGlobFor,
  DEFAULT_ROOT_DEV_CATALOG,
  type AppCatalogApplicator,
  type ClusterControlPlane,
  type RootDevCatalogSpec,
} from "../ports.ts";

export function gitOpsAppCatalog(
  controlPlane: ClusterControlPlane,
  catalogDefaults: RootDevCatalogSpec = DEFAULT_ROOT_DEV_CATALOG,
  repoRoot: string = REPO_ROOT,
): AppCatalogApplicator {
  return {
    applyRootDevCatalog: (gitRef, gitRepoUrl, provider = null, kindCni = "kindnetd", laneDirs = null) => {
      // The exclude glob is derived PER SUBSTRATE so it agrees with what the
      // harness asserts. Default `null` + kindnetd keeps the shipped glob verbatim.
      const spec: RootDevCatalogSpec = {
        ...catalogDefaults,
        gitRef,
        gitRepoUrl,
        // LANE-SCOPED through the same module the harness's discovery uses, so the
        // charts this cluster applies and the charts it asserts are one list.
        excludeGlob: laneScopedExcludeGlob(
          rootDevCatalogExcludeGlobFor(provider, kindCni),
          laneDirs,
          laneDirs === null ? [] : listApplicationDirs(repoRoot),
        ),
      };
      console.log(`Applying root App-of-Apps (git repo: ${spec.gitRepoUrl}, git ref: ${spec.gitRef}) ...`);
      controlPlane.applyInlineManifest(buildRootDevCatalogManifest(spec));
    },
  };
}
