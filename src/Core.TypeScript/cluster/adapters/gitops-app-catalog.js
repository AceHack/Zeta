import { buildRootDevCatalogManifest, DEFAULT_ROOT_DEV_CATALOG, } from "../ports.js";
export function gitOpsAppCatalog(controlPlane, catalogDefaults = DEFAULT_ROOT_DEV_CATALOG) {
    return {
        applyRootDevCatalog: (gitRef, gitRepoUrl) => {
            const spec = { ...catalogDefaults, gitRef, gitRepoUrl };
            console.log(`Applying root App-of-Apps (git repo: ${spec.gitRepoUrl}, git ref: ${spec.gitRef}) ...`);
            controlPlane.applyInlineManifest(buildRootDevCatalogManifest(spec));
        },
    };
}
