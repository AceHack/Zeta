const COMPOSED_RE = /\[iter-5\.4\.1-ci\] composed ClusterNode maintainer=(\S+) node=(\S+)/, TREE_PATH_RE = /\[iter-5\.4\.1-ci\] tree-path=(maintainers\/\S+\/cluster-nodes\/\S+\/node\.yaml)/, PREVIEW_RE = /\[iter-5\.4\.1-ci\] preview=(\S+)/;
export const POST_BOOT_SELF_REGISTER_MARKERS = [
  "zeta-self-register: begin",
  "zeta-self-register: ci-dry-run",
  "zeta-self-register: complete"
];
const POST_BOOT_COMPOSED_RE = /zeta-self-register: composed maintainer=(\S+) node=(\S+)/, POST_BOOT_TREE_PATH_RE = /zeta-self-register: tree-path=(maintainers\/\S+\/cluster-nodes\/\S+\/node\.yaml)/, POST_BOOT_PREVIEW_RE = /zeta-self-register: preview=(\S+)/;
export function parseSelfRegCiSerial(serialOutput) {
  const composed = serialOutput.match(COMPOSED_RE), tree = serialOutput.match(TREE_PATH_RE);
  if (!composed || !tree)
    return null;
  const preview = serialOutput.match(PREVIEW_RE);
  return {
    maintainer: composed[1],
    nodeHostname: composed[2],
    treePath: tree[1],
    ...preview ? { previewPath: preview[1] } : {}
  };
}
export function parsePostBootSelfRegCiSerial(serialOutput) {
  const composed = serialOutput.match(POST_BOOT_COMPOSED_RE), tree = serialOutput.match(POST_BOOT_TREE_PATH_RE);
  if (!composed || !tree)
    return null;
  const preview = serialOutput.match(POST_BOOT_PREVIEW_RE);
  return {
    maintainer: composed[1],
    nodeHostname: composed[2],
    treePath: tree[1],
    ...preview ? { previewPath: preview[1] } : {}
  };
}
export function expectedClusterNodeTreePath(maintainer, nodeHostname) {
  return `maintainers/${maintainer}/cluster-nodes/${nodeHostname}/node.yaml`;
}
export function validateSelfRegCiCoherent(serialOutput) {
  const parsed = parseSelfRegCiSerial(serialOutput);
  if (!parsed)
    return {
      ok: !1,
      reason: "missing iter-5.4.1-ci composed/tree-path serial lines"
    };
  const expectedPath = expectedClusterNodeTreePath(parsed.maintainer, parsed.nodeHostname);
  if (parsed.treePath !== expectedPath)
    return {
      ok: !1,
      reason: `tree-path ${parsed.treePath} != expected ${expectedPath}`
    };
  return { ok: !0, parsed };
}
export function validatePostBootSelfRegCiCoherent(serialOutput) {
  const missing = POST_BOOT_SELF_REGISTER_MARKERS.filter((m) => !serialOutput.includes(m));
  if (missing.length > 0)
    return {
      ok: !1,
      reason: `missing post-boot self-register markers: ${missing.join("; ")}`
    };
  const parsed = parsePostBootSelfRegCiSerial(serialOutput);
  if (!parsed)
    return {
      ok: !1,
      reason: "missing zeta-self-register composed/tree-path serial lines"
    };
  const expectedPath = expectedClusterNodeTreePath(parsed.maintainer, parsed.nodeHostname);
  if (parsed.treePath !== expectedPath)
    return {
      ok: !1,
      reason: `post-boot tree-path ${parsed.treePath} != expected ${expectedPath}`
    };
  return { ok: !0, parsed };
}
export function postBootSelfRegMarkersSatisfied(serialOutput) {
  return validatePostBootSelfRegCiCoherent(serialOutput).ok;
}
