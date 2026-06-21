// full-ai-cluster/platform-controller/src/types.ts
//
// Shared types for the Zeta platform controller — the deterministic "Cell" that
// reconciles platform.zeta.io Custom Resources into concrete Kubernetes objects.
// (Intelligent ops — diagnose/repair/optimize — is the Persona/agent layer; see
// COLLABORATION-MODEL.md. This controller is the mechanical reconcile only.)
export const GROUP = "platform.zeta.io";
export const VERSION = "v1alpha1";
export const API_VERSION = `${GROUP}/${VERSION}`;
export const MANAGED_BY = "zeta-platform-controller";
/** ownerReference so deleting the CR cascades to its children. */
export function ownerRef(cr) {
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
export function labels(crName, kind, ai) {
    return {
        "app.kubernetes.io/name": crName,
        "app.kubernetes.io/managed-by": MANAGED_BY,
        [`${GROUP}/${kind.toLowerCase()}`]: crName,
        ...(ai?.admin ? { [`${GROUP}/admin`]: ai.admin } : {}),
    };
}
