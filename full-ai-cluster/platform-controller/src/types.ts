// full-ai-cluster/platform-controller/src/types.ts
//
// Shared types for the Zeta platform controller — the deterministic "Cell" that
// reconciles platform.zeta.io Custom Resources into concrete Kubernetes objects.
// (Intelligent ops — diagnose/repair/optimize — is the Persona/agent layer; see
// COLLABORATION-MODEL.md. This controller is the mechanical reconcile only.)

/** A plain Kubernetes object (manifest). Applied via server-side apply. */
export type K8sObject = {
  apiVersion: string;
  kind: string;
  metadata: Record<string, unknown> & { name: string; namespace?: string };
  [k: string]: unknown;
};

/** The AI-native block present on every platform resource (see the CRDs). */
export interface AiBlock {
  admin?: string; // persona that operates this resource (otto/lior/vera/…)
  policy?: string; // Policy CR name governing agent autonomy
  room?: "enabled" | "disabled";
}

export interface CustomResource<Spec> {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace: string;
    uid?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec: Spec;
  status?: Record<string, unknown>;
}

export const GROUP = "platform.zeta.io";
export const VERSION = "v1alpha1";
export const API_VERSION = `${GROUP}/${VERSION}`;
export const MANAGED_BY = "zeta-platform-controller";

/** ownerReference so deleting the CR cascades to its children. */
export function ownerRef(cr: { metadata: { name: string; uid?: string }; kind: string }): Record<string, unknown> {
  return {
    apiVersion: API_VERSION,
    kind: cr.kind,
    name: cr.metadata.name,
    uid: cr.metadata.uid ?? "",
    controller: true,
    blockOwnerDeletion: true,
  };
}

/** Standard labels every child object carries (and the AI admin, for the portal). */
export function labels(crName: string, kind: string, ai?: AiBlock): Record<string, string> {
  return {
    "app.kubernetes.io/name": crName,
    "app.kubernetes.io/managed-by": MANAGED_BY,
    [`${GROUP}/${kind.toLowerCase()}`]: crName,
    ...(ai?.admin ? { [`${GROUP}/admin`]: ai.admin } : {}),
  };
}
