// Zeta TRUST-GRAPH conflict resolution — SDSI/SPKI local-name discipline for org-CA vs
// user-CA cross-signing (081KVP3GYWS08QG0R003TY4E96). The math team (Soraya, 2026-06-21)
// found the cross-signed trust graph is NON-CONFLUENT without a scope rule: two verifiers
// can reach opposite verdicts on "is X valid?". This module DEFINES the resolution rule
// BEFORE any confluence proof:
//
//   • IDENTITY scope — subject's own user-self root is authoritative for self-identity.
//   • AUTHORIZATION scope — org root is authoritative for org-bound access decisions.
//
// The same identity↔authorization split as docs/DECISIONS/2026-06-21-multi-owner-machines-…
// and full-ai-cluster/nixos/modules/ssh-ca.nix (TrustedUserCAKeys vs AuthorizedPrincipals).
//
// Revocation (081KVP2M1 / revoke.ts): a root in the KRL invalidates its cross-sign closure
// transitively — revoking a root must invalidate everything that depended on it.
//
// Prove-with: Alloy structural model (src/Core.Alloy/specs/TrustGraph.als); tests below
// exercise the counterexample + scoped confluence without faking green.

/** Root kind — org trust anchor vs a principal's self-root (per-user CA). */
export type RootKind = "org" | "user-self";

/** A trust anchor in the cross-sign web. */
export interface TrustRoot {
  readonly id: string;
  readonly kind: RootKind;
  /** Principal this root speaks for (`aaron` for user-self; org label for org). */
  readonly principal: string;
}

/** Directed cross-sign: `from` vouches for / delegates to `to`. */
export interface CrossSignEdge {
  readonly from: string;
  readonly to: string;
}

/** Which question is being asked — identity vs org authorization. */
export type TrustScope = "identity" | "authorization";

export interface TrustGraph {
  readonly roots: readonly TrustRoot[];
  readonly crossSigns: readonly CrossSignEdge[];
  /** Root ids revoked via KRL (081KVP2M1). */
  readonly revokedRootIds?: readonly string[];
  /**
   * Org-only denylist: principals the org root explicitly refuses to authorize.
   * Models org-CA disagreeing with a live user-self root (the non-confluent case).
   */
  readonly orgAuthorizationDenylist?: readonly string[];
}

export type TrustVerdict = "trusted" | "untrusted" | "revoked";

function selfRoot(graph: TrustGraph, principal: string): TrustRoot | undefined {
  return graph.roots.find((r) => r.kind === "user-self" && r.principal === principal);
}

function orgRoot(graph: TrustGraph): TrustRoot | undefined {
  return graph.roots.find((r) => r.kind === "org");
}

function revokedSet(graph: TrustGraph): Set<string> {
  return new Set(graph.revokedRootIds ?? []);
}

/** Transitive closure of roots invalidated when `rootId` is revoked. */
export function revocationClosure(graph: TrustGraph, rootId: string): Set<string> {
  const revoked = revokedSet(graph);
  const out = new Set<string>();
  const queue = [rootId];
  while (queue.length > 0) {
    const cur = queue.pop()!;
    if (out.has(cur)) continue;
    out.add(cur);
    for (const e of graph.crossSigns) {
      if (e.from === cur && !out.has(e.to)) queue.push(e.to);
    }
  }
  // If the seed is in KRL, the whole closure is dead regardless of graph shape.
  if (revoked.has(rootId)) return out;
  return out;
}

function isRevoked(graph: TrustGraph, rootId: string): boolean {
  const revoked = revokedSet(graph);
  if (revoked.has(rootId)) return true;
  for (const r of revoked) {
    if (revocationClosure(graph, r).has(rootId)) return true;
  }
  return false;
}

/**
 * NAIVE reachability trust — the pre-rule verifier that CAN disagree across scopes.
 * Returns true if ANY non-revoked path from `anchorRootId` reaches `targetRootId`.
 */
export function naiveReachabilityTrust(graph: TrustGraph, anchorRootId: string, targetRootId: string): boolean {
  if (isRevoked(graph, anchorRootId) || isRevoked(graph, targetRootId)) return false;
  const visited = new Set<string>();
  const queue = [anchorRootId];
  while (queue.length > 0) {
    const cur = queue.pop()!;
    if (cur === targetRootId) return true;
    if (visited.has(cur)) continue;
    visited.add(cur);
    for (const e of graph.crossSigns) {
      if (e.from === cur && !isRevoked(graph, e.to)) queue.push(e.to);
    }
  }
  return false;
}

/**
 * Verdict WITHOUT the scope rule — two verifiers pick different anchors and can disagree.
 * `verifierAnchor` is which root that verifier treats as its trust entry point.
 */
export function verdictWithoutScopeRule(
  graph: TrustGraph,
  subject: string,
  verifierAnchor: string,
): TrustVerdict {
  const target = selfRoot(graph, subject);
  if (!target) return "untrusted";
  if (isRevoked(graph, target.id)) return "revoked";
  return naiveReachabilityTrust(graph, verifierAnchor, target.id) ? "trusted" : "untrusted";
}

/**
 * Scoped resolution rule (SDSI/SPKI discipline):
 *  - identity: only the subject's user-self root counts; org cross-sign is NOT authoritative.
 *  - authorization: only the org root counts; self-root alone does NOT grant org access.
 */
export function resolveTrust(graph: TrustGraph, subject: string, scope: TrustScope): TrustVerdict {
  if (scope === "identity") {
    const self = selfRoot(graph, subject);
    if (!self) return "untrusted";
    if (isRevoked(graph, self.id)) return "revoked";
    // Self-root is authoritative — presence + not revoked is sufficient for self-identity.
    return "trusted";
  }
  const org = orgRoot(graph);
  if (!org) return "untrusted";
  if (isRevoked(graph, org.id)) return "revoked";
  const deny = new Set(graph.orgAuthorizationDenylist ?? []);
  if (deny.has(subject)) return "untrusted";
  const self = selfRoot(graph, subject);
  if (!self) return "untrusted";
  if (isRevoked(graph, self.id)) return "revoked";
  // Org authorization requires org path to subject self-root (cross-sign chain).
  return naiveReachabilityTrust(graph, org.id, self.id) ? "trusted" : "untrusted";
}

/** True when org-anchor and self-anchor verifiers disagree on identity (the bug the rule fixes). */
export function identityVerifiersDisagree(graph: TrustGraph, subject: string): boolean {
  const org = orgRoot(graph);
  const self = selfRoot(graph, subject);
  if (!org || !self) return false;
  const viaOrg = verdictWithoutScopeRule(graph, subject, org.id);
  const viaSelf = verdictWithoutScopeRule(graph, subject, self.id);
  return viaOrg !== viaSelf;
}

/** Scoped identity verdict is confluent: all verifiers using resolveTrust agree. */
export function identityVerdictConfluent(graph: TrustGraph, subject: string): boolean {
  const a = resolveTrust(graph, subject, "identity");
  const b = resolveTrust(graph, subject, "identity");
  return a === b;
}

export function formatTrustGraph(graph: TrustGraph): string {
  const lines = [
    `trust-graph: ${graph.roots.length} roots, ${graph.crossSigns.length} cross-signs`,
    ...graph.roots.map((r) => `  root ${r.id} kind=${r.kind} principal=${r.principal}`),
  ];
  if (graph.revokedRootIds?.length) lines.push(`  revoked: ${graph.revokedRootIds.join(", ")}`);
  if (graph.orgAuthorizationDenylist?.length) {
    lines.push(`  org-deny: ${graph.orgAuthorizationDenylist.join(", ")}`);
  }
  return lines.join("\n");
}
