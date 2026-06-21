/**
 * 081KSGS9H0008QG0R0011BC7T2 slice 3 — mock ArgoCD reconcile planner for ClusterNode registration.
 * Pure function: given git tree path + node.yaml body, derive the reconcile
 * shape ArgoCD iter-5.4.2 would apply (081KSGS9H0008QG0R002K93MWX). No live cluster required.
 */

import { validateClusterNodeYaml } from "./cluster-node-yaml.ts";
import {
  expectedClusterNodeTreePath,
  type SelfRegCiSerial,
} from "./self-reg-serial.ts";

export interface ClusterNodeReconcilePlan {
  readonly ok: boolean;
  readonly errors: readonly string[];
  readonly crName?: string;
  readonly namespace?: string;
  readonly nodeLabels?: Readonly<Record<string, string>>;
  readonly roles?: readonly string[];
}

const METADATA_NAME_RE = /^\s*name:\s*(\S+)\s*$/m;
const ROLES_BLOCK_RE = /roles:\s*\n((?:\s+-\s+\S+\n)+)/;
const ROLE_LINE_RE = /^\s+-\s+(\S+)\s*$/gm;

function extractMetadataName(yaml: string): string | null {
  return yaml.match(METADATA_NAME_RE)?.[1] ?? null;
}

function extractRoles(yaml: string): string[] {
  const block = yaml.match(ROLES_BLOCK_RE)?.[1];
  if (!block) {
    return [];
  }
  return [...block.matchAll(ROLE_LINE_RE)].map((m) => m[1]!);
}

/** Plan the post-merge ArgoCD reconcile for a ClusterNode registration. */
export function planClusterNodeReconcile(input: {
  readonly treePath: string;
  readonly yaml: string;
  readonly serial?: SelfRegCiSerial | null;
}): ClusterNodeReconcilePlan {
  const errors: string[] = [];
  const shape = validateClusterNodeYaml(input.yaml);
  if (!shape.ok) {
    errors.push(...shape.errors);
  }

  const crName = extractMetadataName(input.yaml);
  if (!crName) {
    errors.push("missing metadata.name");
  }

  const roles = extractRoles(input.yaml);
  if (roles.length === 0) {
    errors.push("missing spec.roles entries");
  }

  const pathMatch = input.treePath.match(
    /^maintainers\/([^/]+)\/cluster-nodes\/([^/]+)\/node\.yaml$/,
  );
  if (!pathMatch) {
    errors.push(`tree-path not under maintainers/*/cluster-nodes/*/node.yaml: ${input.treePath}`);
  } else {
    const [, maintainer, hostFromPath] = pathMatch;
    const expected = expectedClusterNodeTreePath(maintainer!, hostFromPath!);
    if (input.treePath !== expected) {
      errors.push(`tree-path canonical mismatch: got ${input.treePath}, want ${expected}`);
    }
    if (crName && crName !== hostFromPath) {
      errors.push(
        `metadata.name '${crName}' must match hostname segment in tree-path '${hostFromPath}'`,
      );
    }
    if (input.serial) {
      if (input.serial.maintainer !== maintainer) {
        errors.push(
          `serial maintainer '${input.serial.maintainer}' != tree-path maintainer '${maintainer}'`,
        );
      }
      if (input.serial.nodeHostname !== hostFromPath) {
        errors.push(
          `serial node '${input.serial.nodeHostname}' != tree-path host '${hostFromPath}'`,
        );
      }
      if (input.serial.treePath !== input.treePath) {
        errors.push("serial tree-path != supplied tree-path");
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const nodeLabels: Record<string, string> = {
    "zeta.lucent-financial-group.com/maintainer": pathMatch![1]!,
  };
  for (const role of roles) {
    nodeLabels[`zeta.lcg/role`] = role;
    if (role.includes("gpu")) {
      nodeLabels["accelerator"] = "nvidia";
    }
    if (role.includes("storage")) {
      nodeLabels["storage"] = "longhorn";
    }
  }

  return {
    ok: true,
    errors: [],
    crName: crName!,
    namespace: "zeta-cluster",
    nodeLabels,
    roles,
  };
}
