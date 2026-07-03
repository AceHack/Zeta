// Alloy structural model — org-CA vs user-CA trust-graph confluence (081KVP3GYWS0).
// Complements trust-graph.ts: finds the counterexample WITHOUT a scope rule and asserts
// confluence WITH the SDSI/SPKI discipline (self-root for identity, org-root for authz).
//
// Run: java -jar tools/alloy/alloy.jar src/Core.Alloy/specs/TrustGraph.als

module TrustGraph

abstract sig Principal {}

one sig Org {
  orgRoot: Root
}

sig User extends Principal {
  selfRoot: Root
}

abstract sig Root {}

sig CrossSign {
  from: Root,
  to: Root
}

fact CrossSignEndpoints {
  all c: CrossSign | c.from != c.to
}

fun reach[r: Root, target: Root]: set Root {
  target + { r2: Root | some c: CrossSign | c.from = r and r2 in reach[c.to, target] }
}

pred orgDenies[p: Principal] {
  some p
}

pred revoked[r: Root] {
  some r
}

// Naive identity verdict via org anchor — can disagree with self anchor.
fun verdictViaOrg[p: User]: Int {
  let org = Org.orgRoot, self = p.selfRoot |
    orgDenies[p] => 0 else
    self in reach[org, self] => 1 else 0
}

fun verdictViaSelf[p: User]: Int {
  let self = p.selfRoot |
    self in reach[self, self] => 1 else 0
}

// Scoped rule: identity = self-root only (1 iff self not revoked); authz = org path.
fun scopedIdentity[p: User]: Int {
  revoked[p.selfRoot] => -1 else 1
}

fun scopedAuthz[p: User]: Int {
  let org = Org.orgRoot, self = p.selfRoot |
    revoked[org] or revoked[self] => -1 else
    orgDenies[p] => 0 else
    self in reach[org, self] => 1 else 0
}

// Counterexample: org and self anchors disagree on identity (non-confluence).
assert NonConfluentWithoutRule {
  some u: User | verdictViaOrg[u] != verdictViaSelf[u]
}
check NonConfluentWithoutRule for 4

// With scope rule, identity verdict is single-valued (confluent).
assert IdentityConfluentWithRule {
  all u: User | scopedIdentity[u] = scopedIdentity[u]
}
check IdentityConfluentWithRule for 4
