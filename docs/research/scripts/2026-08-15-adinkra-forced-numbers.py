#!/usr/bin/env python3
"""Compute the numbers the adinkra structure FORCES, against the repo's own definitions.

Mirrors src/Core/AdinkraCode.fs and src/Core/AdinkraViz.fs exactly.
Nothing here is asserted; everything is computed and printed so it can come out wrong.
"""
from itertools import permutations, combinations

# ---- AdinkraCode.generator, verbatim from src/Core/AdinkraCode.fs -------------
GEN = [
    [1, 0, 0, 0, 0, 1, 1, 1],
    [0, 1, 0, 0, 1, 0, 1, 1],
    [0, 0, 1, 0, 1, 1, 0, 1],
    [0, 0, 0, 1, 1, 1, 1, 0],
]
LENGTH, DIM = 8, 4


def encode(msg):
    return [sum(msg[i] & GEN[i][j] for i in range(DIM)) % 2 for j in range(LENGTH)]


def bits(cw):
    v = 0
    for i, b in enumerate(cw):
        if b:
            v |= 1 << i
    return v


codewords = [encode([(m >> i) & 1 for i in range(DIM)]) for m in range(16)]
codeset = {bits(c) for c in codewords}
weights = [sum(c) for c in codewords]

print("=== [n,k] code identification (AdinkraCode.fs) ===")
print("n (length)                 :", LENGTH)
print("k (dimension)              :", DIM)
print("|C|                        :", len(codeset))
print("weight enumerator          :", sorted({w: weights.count(w) for w in set(weights)}.items()))
print("doubly even (all w%4==0)   :", all(w % 4 == 0 for w in weights))
print("min distance (nonzero wt)  :", min(w for w in weights if w > 0))
# self-dual: C == C^perp
def dot(a, b):
    return sum(x & y for x, y in zip(a, b)) % 2
selfdual = all(dot(a, b) == 0 for a in codewords for b in codewords) and 2 * DIM == LENGTH
print("self-dual                  :", selfdual)

# ---- FORCED NUMBER 1: |Aut(C)| under coordinate permutations ------------------
def applyperm(perm, c):
    r = 0
    for i in range(8):
        if (c >> i) & 1:
            r |= 1 << perm[i]
    return r


auts = [p for p in permutations(range(8)) if all(applyperm(p, c) in codeset for c in codeset)]
print("\n=== FORCED NUMBER 1: automorphism group order ===")
print("|Aut(C)| (coordinate perms):", len(auts), "  [claim in AdinkraOrbits.Tests.fs: AGL(3,2), 1344]")
print("1344 == 8*168 == |AGL(3,2)|:", len(auts) == 1344)

# ---- The N-cube adinkra (AdinkraViz.fs uses N=4) -----------------------------
def cube_numbers(N):
    V = 2 ** N
    E = N * 2 ** (N - 1)
    faces = (N * (N - 1) // 2) * 2 ** (N - 2)  # C(N,2) * 2^(N-2) distinct 2-colored 4-cycles
    cycle_dim = E - V + 1
    cobound_dim = V - 1
    return dict(N=N, V=V, E=E, faces=faces, cycle_dim=cycle_dim, cobound_dim=cobound_dim,
                pairs=N * (N - 1) // 2)


print("\n=== FORCED NUMBER 2: N-cube adinkra counts ===")
for N in (1, 2, 4, 8):
    d = cube_numbers(N)
    print(f"  N={N}: vertices={d['V']:>4} edges={d['E']:>4} 2-colored faces={d['faces']:>5} "
          f"anticommuting pairs C(N,2)={d['pairs']:>2} "
          f"cycle-dim={d['cycle_dim']:>4} coboundary-dim={d['cobound_dim']:>4}")

# ---- AdinkraViz N=4: enumerate edges, faces, standardDashing -----------------
N = 4
alledges = [(v, b) for v in range(16) for b in range(4) if not (v & (1 << b))]
assert len(alledges) == 32


def canon(v, b):
    return (v if not (v & (1 << b)) else v ^ (1 << b), b)


standard = {(v, b) for (v, b) in alledges if bin(v & ((1 << b) - 1)).count("1") % 2 == 1}


def is_dashed(d, v, b):
    return canon(v, b) in d


def face_odd(d, v, i, j):
    vi, vj = v ^ (1 << i), v ^ (1 << j)
    cnt = sum([is_dashed(d, v, i), is_dashed(d, vi, j), is_dashed(d, vj, i), is_dashed(d, v, j)])
    return cnt % 2 == 1


# distinct faces: (base vertex with bits i,j clear, i, j)
distinct_faces = [(v, i, j) for i, j in combinations(range(4), 2)
                  for v in range(16) if not (v & (1 << i)) and not (v & (1 << j))]
print("\n=== FORCED NUMBER 3: holonomy of every 2-colored 4-cycle (N=4) ===")
print("distinct 2-colored faces   :", len(distinct_faces), " [predicted C(4,2)*2^2 = 24]")
print("all faces ODD under stdDash:", all(face_odd(standard, v, i, j) for (v, i, j) in distinct_faces))
print("holonomy per face (-1)^odd :", {(-1) ** sum([is_dashed(standard, v, i), is_dashed(standard, v ^ (1 << i), j),
                                                   is_dashed(standard, v ^ (1 << j), i), is_dashed(standard, v, j)])
                                      for (v, i, j) in distinct_faces})
# also the redundant enumeration AdinkraViz.allFacesOdd actually performs
redundant = [(v, i, j) for v in range(16) for i in range(4) for j in range(i + 1, 4)]
print("AdinkraViz.allFacesOdd checks:", len(redundant), "(each face from each of its 4 corners: 24*4=96)")

# ---- FORCED NUMBER 4: the dashing torsor ------------------------------------
# gauge move: flip all 4 edges at a vertex
def flip_vertex(v, d):
    d = set(d)
    for b in range(4):
        e = canon(v, b)
        d ^= {e}
    return frozenset(d)


# enumerate the full gauge orbit of `standard` under the 2^16 vertex-flip subsets
orbit = set()
base = frozenset(standard)
for mask in range(1 << 16):
    # incremental would be faster; do it via XOR of coboundary vectors
    pass

# faster: coboundary space = span of the 16 vertex-flip vectors over GF(2)
edge_index = {e: k for k, e in enumerate(alledges)}


def vec(dashset):
    v = 0
    for e in dashset:
        v |= 1 << edge_index[e]
    return v


gens = []
for v in range(16):
    m = 0
    for b in range(4):
        m |= 1 << edge_index[canon(v, b)]
    gens.append(m)

# rank of the coboundary space
basis = []
for g in gens:
    x = g
    for b in basis:
        x = min(x, x ^ b)
    if x:
        basis.append(x)
        basis.sort(reverse=True)
cobound_rank = len(basis)

# span it
span = {0}
for b in basis:
    span |= {s ^ b for s in span}

base_vec = vec(base)
gauge_orbit = {base_vec ^ s for s in span}

# now count ALL valid dashings by solving the face-parity system directly:
# a dashing is valid iff (dashing XOR standard) is orthogonal to every face cycle,
# i.e. lies in the space of edge-sets meeting every 4-cycle evenly = coboundary space.
face_vecs = []
for (v, i, j) in distinct_faces:
    m = 0
    for e in [canon(v, i), canon(v ^ (1 << i), j), canon(v ^ (1 << j), i), canon(v, j)]:
        m ^= 1 << edge_index[e]
    face_vecs.append(m)

fbasis = []
for f in face_vecs:
    x = f
    for b in fbasis:
        x = min(x, x ^ b)
    if x:
        fbasis.append(x)
        fbasis.sort(reverse=True)
cycle_rank = len(fbasis)

print("\n=== FORCED NUMBER 4: the dashing torsor (N=4) ===")
print("edges                      :", len(alledges))
print("rank of face-cycle space   :", cycle_rank, " [predicted E-V+1 = 17]")
print("rank of coboundary (gauge) :", cobound_rank, " [predicted V-1 = 15]")
print("cycle_rank + cobound_rank  :", cycle_rank + cobound_rank, " [must equal E = 32]")
print("valid dashings = 2^(E-cyc) :", 2 ** (len(alledges) - cycle_rank), " [predicted 2^15 = 32768]")
print("gauge orbit of stdDashing  :", len(gauge_orbit))
print("ONE ORBIT (free+transitive):", len(gauge_orbit) == 2 ** (len(alledges) - cycle_rank))

# brute-force cross-check on a sample: every element of the gauge orbit is a valid dashing
import random
rng = random.Random(4)
sample = rng.sample(sorted(gauge_orbit), 200)
def vec_to_set(x):
    return {e for e, k in edge_index.items() if (x >> k) & 1}
ok = all(all(face_odd(vec_to_set(x), v, i, j) for (v, i, j) in distinct_faces) for x in sample)
print("sample 200 orbit members valid:", ok)

# ---------------------------------------------------------------------------
# RETRACTED CHECK — kept visible on purpose (shadow, 2026-08-15).
#
# The original script asked "is there a valid dashing OUTSIDE the gauge orbit?" by drawing
# 2000 random 32-bit vectors and counting valid ones not in the orbit. It printed 0 and that
# number was WORTHLESS: there are 2^15 valid dashings in a space of 2^32, so 2000 draws expect
# ~0.015 hits. The check would have printed 0 whether the claim was true or false. A check that
# cannot fail is not a check.
#
# The real verification is the two-route SET comparison in
#   docs/research/scripts/2026-08-15-dashing-torsor-two-routes.py
# which solves the face-parity system independently and compares the solution set to the gauge
# orbit exhaustively (32768 vs 32768, sets equal), with a working negative control.
# ---------------------------------------------------------------------------
p_hit = 2 ** (len(alledges) - cycle_rank) / 2 ** len(alledges)
print("RETRACTED random-sampling check: expected hits in 2000 draws =",
      round(2000 * p_hit, 4), "-> the old '0 outside' result was vacuous;",
      "see 2026-08-15-dashing-torsor-two-routes.py")

# ---- FORCED NUMBER 5: what N does the repo's own code imply? ----------------
print("\n=== FORCED NUMBER 5: which N ===")
print("Doran et al.: code LENGTH = N (number of colors/supercharges); adinkra has 2^(N-k) nodes")
print("  code length 8, dim 4  =>  N =", LENGTH, " nodes = 2^(n-k) =", 2 ** (LENGTH - DIM),
      "=", 2 ** (LENGTH - DIM) // 2, "bosons +", 2 ** (LENGTH - DIM) // 2, "fermions")
print("  anticommuting pairs at N=8 : C(8,2) =", 8 * 7 // 2)
print("  anticommuting pairs at N=4 : C(4,2) =", 4 * 3 // 2, " (AdinkraViz's 4-cube)")
print("  anticommuting pairs at N=1 : C(1,2) =", 0, " (AdinkraClock)")
