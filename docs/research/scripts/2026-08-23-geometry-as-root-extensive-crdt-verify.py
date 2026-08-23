#!/usr/bin/env python3
"""Witnesses for §11 of docs/research/2026-08-23-geometry-as-the-root-of-the-soft-regime-*.md

Aaron's mapping: "a count is CRDT, and a condition is CASPaxos or CASRaft-ish."
This checks it rather than agreeing with it. Five checks, stdlib only, deterministic.

  C1  A raw count under (+) is COMMUTATIVE and ASSOCIATIVE but NOT IDEMPOTENT.
      So extensive => commutative monoid (CmRDT / op-based), and NOT a
      join-semilattice, hence NOT a CvRDT state on its own.
  C2  The G-Counter repair: per-source keying + elementwise max IS idempotent,
      commutative and associative. The MERGE is max; the READ is sum. Two
      different operations on two different objects -- which is exactly where
      the categorical condition and the CRDT condition part.
  C3  Idempotence is a property of DELIVERY, not of the statistic. Redeliver the
      same increment: raw (+) double-counts, keyed-max does not.
  C4  An intensive quantity that is a RATIO OF EXTENSIVES needs no consensus:
      carry (sum, count), merge both, divide at read. Equals the global mean.
      => "intensive needs consensus" is FALSE for means. The Radon-Nikodym repair.
  C5  Where consensus IS required: a NON-COMMUTATIVE update genuinely diverges
      under reordering, and no merge function repairs it.

Run: python3 docs/research/scripts/2026-08-23-geometry-as-root-extensive-crdt-verify.py
Exit 0 iff every check passes.
"""

import itertools
import sys

# ---------------------------------------------------------------- C1

def c1_raw_count_is_not_a_semilattice():
    print("C1  raw count under (+): commutative + associative, NOT idempotent")
    xs = [3, 7, 11]
    comm = all(a + b == b + a for a, b in itertools.permutations(xs, 2))
    assoc = (xs[0] + xs[1]) + xs[2] == xs[0] + (xs[1] + xs[2])
    idem = all(x + x == x for x in xs if x != 0)
    print(f"    commutative={comm}  associative={assoc}  idempotent={idem}")
    print("    => a commutative MONOID (CmRDT: concurrent ops commute)")
    print("    => NOT a join-semilattice, so NOT a CvRDT state by itself")
    return comm and assoc and (not idem)

# ---------------------------------------------------------------- C2
# The in-tree shape: src/Core/Crdt.fs GCounter = ZSet keyed by replicaId,
# Merge = elementwise max, Value = sum of weights.

def gmerge(a, b):
    """elementwise max over per-replica counts -- the join."""
    return {k: max(a.get(k, 0), b.get(k, 0)) for k in set(a) | set(b)}


def gvalue(a):
    """the READ: sum over replicas -- the extensive quantity."""
    return sum(a.values())


def c2_gcounter_is_a_semilattice():
    print("C2  G-Counter (per-source keying + elementwise max)")
    A = {"r1": 3, "r2": 1}
    B = {"r2": 4, "r3": 2}
    C = {"r1": 5}
    idem = gmerge(A, A) == A
    comm = gmerge(A, B) == gmerge(B, A)
    assoc = gmerge(gmerge(A, B), C) == gmerge(A, gmerge(B, C))
    print(f"    merge idempotent={idem}  commutative={comm}  associative={assoc}"
          "   -> join-semilattice (CvRDT)")
    print(f"    MERGE is max; READ is sum -> gvalue(merge(A,B,C)) = "
          f"{gvalue(gmerge(gmerge(A, B), C))}")
    print("    the aggregation (sum) and the merge (max) are DIFFERENT operations")
    return idem and comm and assoc

# ---------------------------------------------------------------- C3

def c3_idempotence_is_about_delivery():
    print("C3  idempotence is a property of DELIVERY, not of the statistic")
    # same increment delivered twice
    raw = 0
    for _ in range(2):
        raw = raw + 5           # naive: add the increment again
    keyed = {}
    for _ in range(2):
        keyed = gmerge(keyed, {"r1": 5})   # same STATE re-merged
    print(f"    raw (+) after redelivery: {raw}  (double-counted)")
    print(f"    keyed-max after redelivery: {gvalue(keyed)}  (correct)")
    print("    => the fix is re-indexing the fibre by source, i.e. NOT quotienting")
    print("       by replica identity -- a change of carried object, not of counting")
    return raw == 10 and gvalue(keyed) == 5

# ---------------------------------------------------------------- C4

def c4_mean_needs_no_consensus():
    print("C4  a mean is a RATIO OF EXTENSIVES -> mergeable, no consensus")
    part1 = [2.0, 4.0, 9.0, 1.0, 6.0]
    part2 = [10.0, 12.0]
    allx = part1 + part2
    # carry (sum, count) -- both extensive, both merge freely
    s1, n1 = sum(part1), len(part1)
    s2, n2 = sum(part2), len(part2)
    merged_mean = (s1 + s2) / (n1 + n2)
    global_mean = sum(allx) / len(allx)
    ok = abs(merged_mean - global_mean) < 1e-12
    # the failure this repairs
    avg_of_avgs = ((s1 / n1) + (s2 / n2)) / 2
    print(f"    (sum,count) merged mean = {merged_mean:.10f}")
    print(f"    direct global mean      = {global_mean:.10f}   equal={ok}")
    print(f"    average of averages     = {avg_of_avgs:.10f}   "
          f"WRONG by {abs(avg_of_avgs - global_mean):.10f}")
    print("    => 'intensive needs consensus' is FALSE whenever the intensive")
    print("       quantity is a density dv/du: carry both measures, divide on read")
    return ok and abs(avg_of_avgs - global_mean) > 1e-6

# ---------------------------------------------------------------- C5

def c5_noncommutative_needs_consensus():
    print("C5  where consensus IS required: non-commutative updates")
    f = lambda s: s * 2          # a CAS-style read-modify-write
    g = lambda s: s + 3
    s0 = 10
    fg, gf = f(g(s0)), g(f(s0))
    print(f"    f(g(s0)) = {fg}   g(f(s0)) = {gf}   diverge={fg != gf}")
    # a commutative pair converges under either order
    h = lambda s: s + 4
    k = lambda s: s + 7
    print(f"    commutative pair: h(k(s0)) = {h(k(s0))} = k(h(s0)) = {k(h(s0))}")
    print("    => the real invariant is COMMUTATIVITY of the update, not")
    print("       extensiveness of the quantity. CAS is the canonical")
    print("       non-commutative op, hence CASPaxos (Rystsov 2018).")
    return fg != gf and h(k(s0)) == k(h(s0))


def main():
    results = [
        c1_raw_count_is_not_a_semilattice(),
        c2_gcounter_is_a_semilattice(),
        c3_idempotence_is_about_delivery(),
        c4_mean_needs_no_consensus(),
        c5_noncommutative_needs_consensus(),
    ]
    print()
    print("ALL PASS" if all(results) else "FAILED")
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
