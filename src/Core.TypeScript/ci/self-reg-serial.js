/**
 * B-0831 slice 3 — parse iter-5.4.1-ci dry-run lines from QEMU serial output.
 * Composes with zeta-install.sh Step 6.9 non-TTY CI path.
 */
const COMPOSED_RE = /\[iter-5\.4\.1-ci\] composed ClusterNode maintainer=(\S+) node=(\S+)/;
const TREE_PATH_RE = /\[iter-5\.4\.1-ci\] tree-path=(maintainers\/\S+\/cluster-nodes\/\S+\/node\.yaml)/;
const PREVIEW_RE = /\[iter-5\.4\.1-ci\] preview=(\S+)/;
/** Exported for unit tests and qemu-full-install-test.ts phase-1 assertions. */
export function parseSelfRegCiSerial(serialOutput) {
    const composed = serialOutput.match(COMPOSED_RE);
    const tree = serialOutput.match(TREE_PATH_RE);
    if (!composed || !tree) {
        return null;
    }
    const preview = serialOutput.match(PREVIEW_RE);
    return {
        maintainer: composed[1],
        nodeHostname: composed[2],
        treePath: tree[1],
        ...(preview ? { previewPath: preview[1] } : {}),
    };
}
/** B-0794 / B-0812 per-maintainer tree convention. */
export function expectedClusterNodeTreePath(maintainer, nodeHostname) {
    return `maintainers/${maintainer}/cluster-nodes/${nodeHostname}/node.yaml`;
}
/** Cross-check iter-5.4.1-ci serial lines for internal consistency (B-0831 slice 3). */
export function validateSelfRegCiCoherent(serialOutput) {
    const parsed = parseSelfRegCiSerial(serialOutput);
    if (!parsed) {
        return {
            ok: false,
            reason: "missing iter-5.4.1-ci composed/tree-path serial lines",
        };
    }
    const expectedPath = expectedClusterNodeTreePath(parsed.maintainer, parsed.nodeHostname);
    if (parsed.treePath !== expectedPath) {
        return {
            ok: false,
            reason: `tree-path ${parsed.treePath} != expected ${expectedPath}`,
        };
    }
    return { ok: true, parsed };
}
