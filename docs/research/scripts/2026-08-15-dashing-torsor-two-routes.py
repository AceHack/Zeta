#!/usr/bin/env python3
"""Independent-route check of the dashing-torsor claim (N=4).

Route A: enumerate the gauge orbit of standardDashing (apply vertex flips).
Route B: solve the 24 face-parity constraints directly and enumerate ALL solutions.
The claim is A == B as SETS (not merely as counts). Counts alone would be numerology.

The earlier random-sampling check was VACUOUS (2000 draws from 2^32 with 2^15 solutions
expects ~0.015 hits, so "0 found outside" was guaranteed regardless of the claim).
"""
from itertools import combinations

alledges = [(v, b) for v in range(16) for b in range(4) if not (v & (1 << b))]
idx = {e: k for k, e in enumerate(alledges)}
E = len(alledges)


def canon(v, b):
    return (v if not (v & (1 << b)) else v ^ (1 << b), b)


standard = 0
for (v, b) in alledges:
    if bin(v & ((1 << b) - 1)).count("1") % 2 == 1:
        standard |= 1 << idx[(v, b)]

faces = [(v, i, j) for i, j in combinations(range(4), 2)
         for v in range(16) if not (v & (1 << i)) and not (v & (1 << j))]
face_vec = []
for (v, i, j) in faces:
    m = 0
    for e in [canon(v, i), canon(v ^ (1 << i), j), canon(v ^ (1 << j), i), canon(v, j)]:
        m ^= 1 << idx[e]
    face_vec.append(m)


def parity(x, m):
    return bin(x & m).count("1") % 2


# sanity: standard satisfies every face constraint with parity 1 (ODD)
assert all(parity(standard, m) == 1 for m in face_vec), "standardDashing is not all-odd"

# ---- Route B: all solutions of the affine system {parity(x, f) = 1 for all faces} ----
# solution set = standard XOR ker, ker = {y : parity(y, f) = 0 for all f}
# ker is the orthogonal complement of span(face_vec); compute it by Gaussian elimination
# on the 24 x 32 matrix over GF(2).
rows = list(face_vec)
pivots = {}
for r in rows:
    x = r
    for p in sorted(pivots, reverse=True):
        if (x >> p) & 1:
            x ^= pivots[p]
    if x:
        p = x.bit_length() - 1
        pivots[p] = x
rank = len(pivots)
free = [c for c in range(E) if c not in pivots]
assert rank + len(free) == E

# build a basis of the kernel: for each free column, set it to 1, back-substitute
kernel_basis = []
for f in free:
    y = 1 << f
    for p in sorted(pivots):
        # choose bit p so that the row with pivot p is satisfied (parity 0)
        if parity(y, pivots[p]) == 1:
            y ^= 1 << p
    kernel_basis.append(y)
assert all(all(parity(y, m) == 0 for m in face_vec) for y in kernel_basis), "kernel basis bad"

kernel = {0}
for b in kernel_basis:
    kernel = kernel | {s ^ b for s in kernel}
solutions_B = frozenset(standard ^ s for s in kernel)

# ---- Route A: the gauge orbit (vertex flips) ----
gauge_gens = []
for v in range(16):
    m = 0
    for b in range(4):
        m |= 1 << idx[canon(v, b)]
    gauge_gens.append(m)
span = {0}
for g in gauge_gens:
    span = span | {s ^ g for s in span}
orbit_A = frozenset(standard ^ s for s in span)

print("rank of face-constraint matrix :", rank, "  [E - rank =", E - rank, "]")
print("|solutions| (Route B, solve)   :", len(solutions_B))
print("|gauge orbit| (Route A, flips) :", len(orbit_A))
print("SETS EQUAL (not just counts)   :", orbit_A == solutions_B)
print("gauge action free (|span|=2^15):", len(span) == 2 ** 15, " |span| =", len(span))
print("gauge group is (Z/2)^16 / const:", 2 ** 16 // 2)

# exhaustive verification that every solution really is all-odd (independent of algebra)
bad = [x for x in solutions_B if not all(parity(x, m) == 1 for m in face_vec)]
print("solutions failing all-odd      :", len(bad), "(must be 0, checked on all", len(solutions_B), ")")

# NEGATIVE CONTROL: the check must be able to fail. Perturb one edge of standard.
perturbed = standard ^ 1
print("negative control (1 edge flip) :", all(parity(perturbed, m) == 1 for m in face_vec),
      "(must be False -- proves the check is not vacuous)")
