import {
  buildRootDevCatalogManifest,
  DEFAULT_ROOT_DEV_CATALOG,
  type AppCatalogApplicator,
  type ClusterControlPlane,
  type RootDevCatalogSpec,
} from "../ports.ts";

export function gitOpsAppCatalog(
  controlPlane: ClusterControlPlane,
  catalogDefaults: RootDevCatalogSpec = DEFAULT_ROOT_DEV_CATALOG,
): AppCatalogApplicator {
  return {
    applyRootDevCatalog: (gitRef, gitRepoUrl) => {
      const spec: RootDevCatalogSpec = { ...catalogDefaults, gitRef, gitRepoUrl };
      console.log(`Applying root App-of-Apps (git repo: ${spec.gitRepoUrl}, git ref: ${spec.gitRef}) ...`);
      controlPlane.applyInlineManifest(buildRootDevCatalogManifest(spec));
    },
  };
}
