/**
 * 081KSGS9H0008QG0R0011BC7T2 slice 3 — parse iter-5.4.1-ci dry-run lines from QEMU serial output.
 * Composes with zeta-install.sh Step 6.9 non-TTY CI path.
 *
 * Cascade #6 deepen (2026-07-08): also parse post-boot zeta-self-register:*
 * CI dry-run markers from the installed OS (zeta-self-register.service sibling).
 */

export interface SelfRegCiSerial {
  readonly maintainer: string;
  readonly nodeHostname: string;
  readonly treePath: string;
  readonly previewPath?: string;
}

const COMPOSED_RE =
  /\[iter-5\.4\.1-ci\] composed ClusterNode maintainer=(\S+) node=(\S+)/;
const TREE_PATH_RE =
  /\[iter-5\.4\.1-ci\] tree-path=(maintainers\/\S+\/cluster-nodes\/\S+\/node\.yaml)/;
const PREVIEW_RE = /\[iter-5\.4\.1-ci\] preview=(\S+)/;

/** Post-boot CI dry-run markers (tools/installer/zeta-self-register.sh ci-dry-run). */
export const POST_BOOT_SELF_REGISTER_MARKERS: readonly string[] = [
  "zeta-self-register: begin",
  "zeta-self-register: ci-dry-run",
  "zeta-self-register: complete",
];

const POST_BOOT_COMPOSED_RE =
  /zeta-self-register: composed maintainer=(\S+) node=(\S+)/;
const POST_BOOT_TREE_PATH_RE =
  /zeta-self-register: tree-path=(maintainers\/\S+\/cluster-nodes\/\S+\/node\.yaml)/;
const POST_BOOT_PREVIEW_RE = /zeta-self-register: preview=(\S+)/;

/** Exported for unit tests and qemu-full-install-test.ts phase-1 assertions. */
export function parseSelfRegCiSerial(serialOutput: string): SelfRegCiSerial | null {
  const composed = serialOutput.match(COMPOSED_RE);
  const tree = serialOutput.match(TREE_PATH_RE);
  if (!composed || !tree) {
    return null;
  }

  const preview = serialOutput.match(PREVIEW_RE);
  return {
    maintainer: composed[1]!,
    nodeHostname: composed[2]!,
    treePath: tree[1]!,
    ...(preview ? { previewPath: preview[1]! } : {}),
  };
}

/** Parse post-boot zeta-self-register CI dry-run serial lines. */
export function parsePostBootSelfRegCiSerial(serialOutput: string): SelfRegCiSerial | null {
  const composed = serialOutput.match(POST_BOOT_COMPOSED_RE);
  const tree = serialOutput.match(POST_BOOT_TREE_PATH_RE);
  if (!composed || !tree) {
    return null;
  }
  const preview = serialOutput.match(POST_BOOT_PREVIEW_RE);
  return {
    maintainer: composed[1]!,
    nodeHostname: composed[2]!,
    treePath: tree[1]!,
    ...(preview ? { previewPath: preview[1]! } : {}),
  };
}

/** 081KSGS9H0008QG0R0027HJZYH / 081KSGS9H0008QG0R0037H3W4T per-maintainer tree convention. */
export function expectedClusterNodeTreePath(
  maintainer: string,
  nodeHostname: string,
): string {
  return `maintainers/${maintainer}/cluster-nodes/${nodeHostname}/node.yaml`;
}

export type SelfRegCiValidation =
  | { readonly ok: true; readonly parsed: SelfRegCiSerial }
  | { readonly ok: false; readonly reason: string };

/** Cross-check iter-5.4.1-ci serial lines for internal consistency (081KSGS9H0008QG0R0011BC7T2 slice 3). */
export function validateSelfRegCiCoherent(serialOutput: string): SelfRegCiValidation {
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

/**
 * Cross-check post-boot zeta-self-register CI dry-run markers.
 * Requires begin/ci-dry-run/complete plus coherent composed/tree-path.
 */
export function validatePostBootSelfRegCiCoherent(serialOutput: string): SelfRegCiValidation {
  const missing = POST_BOOT_SELF_REGISTER_MARKERS.filter((m) => !serialOutput.includes(m));
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `missing post-boot self-register markers: ${missing.join("; ")}`,
    };
  }
  const parsed = parsePostBootSelfRegCiSerial(serialOutput);
  if (!parsed) {
    return {
      ok: false,
      reason: "missing zeta-self-register composed/tree-path serial lines",
    };
  }
  const expectedPath = expectedClusterNodeTreePath(parsed.maintainer, parsed.nodeHostname);
  if (parsed.treePath !== expectedPath) {
    return {
      ok: false,
      reason: `post-boot tree-path ${parsed.treePath} != expected ${expectedPath}`,
    };
  }
  return { ok: true, parsed };
}

/** True when phase-3 serial proves post-boot self-register CI dry-run. */
export function postBootSelfRegMarkersSatisfied(serialOutput: string): boolean {
  return validatePostBootSelfRegCiCoherent(serialOutput).ok;
}
