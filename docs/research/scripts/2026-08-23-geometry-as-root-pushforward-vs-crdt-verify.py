#!/usr/bin/env python3
r"""Witnesses for §12 of docs/research/2026-08-23-geometry-as-the-root-of-the-soft-regime-*.md

THE OPEN QUESTION: is "freely pushforward-able along a coarsening" EQUIVALENT to
"CRDT-mergeable", or only co-extensive on the examples?

  A = aggregations that push forward freely along every coarsening
      (commutative monoid: the aggregate is independent of how the fibre is grouped)
  B = aggregations that are CvRDT state-merges
      (join-semilattice: additionally idempotent, to survive re-delivery)

  T1  B is a STRICT subset of A.  Not equivalent, and the asymmetry is total:
      every semilattice is a commutative monoid, and (N,+) is in A \ B because
      x+x=x holds only at 0 -- so no order makes + a join.
  T2  ...but every member of A admits a CvRDT REPRESENTATION: tag operations
      uniquely, merge by SET UNION (idempotent), read by the aggregate. Shown
      for sum, which is not idempotent.
  T3  The cost of T2 is UNBOUNDED STATE. The G-Counter is the COMPRESSED case;
      compression is what "a count is CRDT" is really asserting.
  T4  Two delta regimes, opposite re-delivery properties: a delta-CRDT delta is a
      semilattice element (join, safe) while a DBSP/Z-set delta is a group element
      (add, NOT safe). Idempotence is relocated to the channel, not removed.
  T6  CALM's correction to §11.3: a mean CONVERGES wait-free but is never FINAL
      without a seal. Monotone statistics are safe to ACT on at a threshold crossing;
      non-monotone ones are not, because they can un-cross.
  T5  A faithful model of src/Core/Crdt.fs OrSet, whose Merge is ZSet.add
      (documented at ZSet.fs:73 as "SUM, NOT idempotent"). Does the
      non-idempotent state merge stay observationally safe through .Value?

Run: python3 docs/research/scripts/2026-08-23-geometry-as-root-pushforward-vs-crdt-verify.py
Exit 0 iff every check reaches its stated conclusion.
"""

import sys

# ---------------------------------------------------------------- T1

def t1_strict_containment():
    print("T1  B (semilattice) is a STRICT subset of A (commutative monoid)")
    # B subset A: a join is commutative + associative, so it pushes forward freely.
    print("    B subset A: a join is commutative + associative + has bottom")
    print("               => it IS a commutative monoid => pushforward is free.  (by inspection)")
    # A not subset B: (N,+) pushes forward freely and admits no join structure.
    fixed = [x for x in range(0, 200) if x + x == x]
    print(f"    A not-subset B: in (N,+), x+x==x holds only for x in {fixed}")
    print("               a join-semilattice requires x join x == x for ALL x,")
    print("               so no order on N makes + a join. (N,+) is in A \\ B.")
    return fixed == [0]

# ---------------------------------------------------------------- T2
# The free construction: tag every operation uniquely, keep the SET of tagged ops
# (union is idempotent/commutative/associative -> a join-semilattice), read by the
# aggregate. Works for ANY commutative monoid, including non-idempotent ones.

def gset_merge(a, b):
    return a | b


def gset_read(s, combine, unit):
    acc = unit
    for _tag, v in sorted(s):
        acc = combine(acc, v)
    return acc


def t2_free_cvrdt_representation():
    print("T2  every A-member admits a CvRDT representation via uniquely-tagged ops")
    add = lambda x, y: x + y
    # three replicas, each with local operations, uniquely tagged (replica, seq)
    r1 = {(("r1", 0), 5), (("r1", 1), 3)}
    r2 = {(("r2", 0), 7)}
    r3 = {(("r3", 0), 2), (("r3", 1), 4)}
    merged = gset_merge(gset_merge(r1, r2), r3)
    total = gset_read(merged, add, 0)
    direct = 5 + 3 + 7 + 2 + 4
    # idempotent under re-delivery of the SAME state, even though + is not idempotent
    redelivered = gset_merge(merged, r1)
    redelivered = gset_merge(redelivered, r2)
    idem = gset_read(redelivered, add, 0) == total
    # and order-independent
    other = gset_merge(r3, gset_merge(r2, r1))
    comm = gset_read(other, add, 0) == total
    print(f"    read of merged G-Set = {total}   direct sum = {direct}   equal={total == direct}")
    print(f"    re-delivering r1 and r2 changes nothing: {idem}   (union IS idempotent)")
    print(f"    merge order irrelevant: {comm}")
    print("    => A and B are co-extensive ON WHAT IS CONSTRUCTIBLE; the")
    print("       representation is not the aggregate, it is its FREE form.")
    return total == direct and idem and comm

# ---------------------------------------------------------------- T3

def gmerge(a, b):
    return {k: max(a.get(k, 0), b.get(k, 0)) for k in set(a) | set(b)}


def t3_compression_is_the_real_content():
    print("T3  the cost of T2 is unbounded state; the G-Counter is the COMPRESSED case")
    n_ops = 500
    replicas = ["r1", "r2", "r3"]
    gset = set()
    gctr = {}
    for i in range(n_ops):
        r = replicas[i % len(replicas)]
        gset.add(((r, i), 1))
        gctr[r] = gctr.get(r, 0) + 1
    gset_total = gset_read(gset, lambda x, y: x + y, 0)
    gctr_total = sum(gctr.values())
    print(f"    after {n_ops} ops:  G-Set entries = {len(gset)}   "
          f"G-Counter entries = {len(gctr)}")
    print(f"    same answer: G-Set={gset_total}  G-Counter={gctr_total}  "
          f"equal={gset_total == gctr_total}")
    print("    compression needs per-source MONOTONE contributions in an order")
    print("    with joins; then max = 'the later state' and state is O(|sources|).")
    print("    => 'a count is CRDT' is really a claim about COMPRESSIBILITY.")
    return gset_total == gctr_total and len(gset) == n_ops and len(gctr) == 3

# ---------------------------------------------------------------- T4

def t4_two_delta_regimes():
    print("T4  two delta regimes with OPPOSITE re-delivery properties")
    # delta-CRDT: the delta is a semilattice element; merge is join -> safe
    state_a = {"r1": 3}
    delta = {"r1": 5}
    once = gmerge(state_a, delta)
    twice = gmerge(once, delta)
    dcrdt_safe = once == twice
    # DBSP / Z-set: the delta is a group element; merge is + -> NOT safe
    z_once = 3 + 5
    z_twice = z_once + 5
    zset_safe = z_once == z_twice
    print(f"    delta-CRDT (join):  apply once={once}  twice={twice}  "
          f"re-delivery safe={dcrdt_safe}")
    print(f"    DBSP/Z-set (group): apply once={z_once}   twice={z_twice}    "
          f"re-delivery safe={zset_safe}")
    print("    => the group regime does not ESCAPE idempotence, it RELOCATES the")
    print("       requirement to the channel (exactly-once, or an idempotency key).")
    return dcrdt_safe and not zset_safe

# ---------------------------------------------------------------- T5
# A faithful model of src/Core/Crdt.fs OrSet:
#   Add(elem, tag)  = ZSet.add entries {(elem,tag): +1}
#   Remove(elem)    = ZSet.add entries {(elem,t): -w  for every observed (elem,t)}
#   Merge a b       = ZSet.add a.Entries b.Entries      <-- SUM, not union
#   Value           = keys with weight > 0
# ZSet.(+) prunes entries whose merged weight is zero (ZSet.fs:75-89).

def zadd(a, b):
    out = dict(a)
    for k, w in b.items():
        out[k] = out.get(k, 0) + w
        if out[k] == 0:
            del out[k]
    return out


def orset_value(e):
    return sorted({k[0] for k, w in e.items() if w > 0})


def t5_orset_model():
    print("T5  model of Crdt.fs OrSet -- Merge is ZSet.add (SUM, not union)")
    # A adds x with tag t; B replicates; A merges B's echo back (a duplicate merge).
    A = zadd({}, {("x", "t"): 1})
    B = dict(A)
    A_dup = zadd(A, B)                      # the same state merged twice
    print(f"    state after duplicate merge: {A_dup}   "
          f"(idempotent on the CARRIER: {A_dup == A})")
    print(f"    observable .Value unchanged: {orset_value(A_dup) == orset_value(A)}")
    # now B removes x, retracting the weight IT observes (1), and A merges
    B_rm = zadd(B, {("x", "t"): -1})         # -> weight 0 -> pruned -> empty
    A_after = zadd(A_dup, B_rm)
    A_clean = zadd(A, B_rm)                  # the no-duplicate-merge baseline
    print(f"    B after Remove: {B_rm}  (retraction pruned to empty)")
    print(f"    A(duplicated) merge B_rm -> {A_after}  value={orset_value(A_after)}")
    print(f"    A(clean)      merge B_rm -> {A_clean}  value={orset_value(A_clean)}")
    print("    NOTE both retain x: the retraction cancelled to zero and was PRUNED")
    print("    before transmission, so no evidence of the remove ever crosses the")
    print("    wire. That is a property of prune-on-zero + state-merge, and it is")
    print("    ORTHOGONAL to the duplicate merge. Reported as a question for audit,")
    print("    NOT as a confirmed defect: this models the F#, it does not run it.")
    carrier_not_idempotent = A_dup != A
    value_still_safe = orset_value(A_dup) == orset_value(A)
    return carrier_not_idempotent and value_still_safe



# ---------------------------------------------------------------- T6
# CALM's correction to the §11.3 result: a mean CONVERGES wait-free but is never
# FINAL without a seal. Monotone statistics are safe to ACT on the moment they
# cross a threshold; non-monotone ones are not.

def t6_converge_versus_act():
    print("T6  converge vs act -- the distinction CALM forces on §11.3")
    arriving = [90.0, 95.0, 92.0, 10.0, 12.0, 8.0, 5.0, 5.0]
    threshold = 50.0
    s = n = 0.0
    mean_crossings = []
    for x in arriving:
        s += x
        n += 1
        mean_crossings.append(s / n >= threshold)
    print(f"    stream {arriving}, threshold {threshold}")
    print(f"    'mean >= threshold' over time: {mean_crossings}")
    un_crossed = any(mean_crossings[i] and not mean_crossings[i + 1]
                     for i in range(len(mean_crossings) - 1))
    print(f"    the mean UN-crosses the threshold: {un_crossed}")
    print("    => the (sum,count) pair converges wait-free (that was §11.3, and it")
    print("       stands), but the DERIVED mean is non-monotone, so a decision taken")
    print("       when it first crossed would have been wrong. Finality needs a seal.")
    # the count, by contrast, cannot un-cross
    c = 0
    count_crossings = []
    for _ in arriving:
        c += 1
        count_crossings.append(c >= 4)
    monotone = all(count_crossings[i] <= count_crossings[i + 1]
                   for i in range(len(count_crossings) - 1))
    print(f"    'count >= 4' over time: {count_crossings}   never un-crosses: {monotone}")
    print("    => CALM's real gift is the NECESSITY direction: monotone is not just")
    print("       sufficient for coordination-freedom, it is REQUIRED for it.")
    return un_crossed and monotone


def main():
    results = [
        t1_strict_containment(),
        t2_free_cvrdt_representation(),
        t3_compression_is_the_real_content(),
        t4_two_delta_regimes(),
        t5_orset_model(),
        t6_converge_versus_act(),
    ]
    print()
    print("ALL PASS" if all(results) else "FAILED")
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
