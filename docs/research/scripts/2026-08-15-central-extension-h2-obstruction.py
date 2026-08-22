#!/usr/bin/env python3
"""Can the local-fold algebra be CENTRALLY EXTENDED to supply an hbar?

The local fold's operators are L_t = I + e_t 1^T (TwoTimescaleFold.localStep).
Closed form of the bracket (verified against the matrices below):

        [L_i, L_j] = L_i - L_j

If no central element exists in g, the standard repair is a CENTRAL EXTENSION:
adjoin z, set [a,b]' = [a,b] + omega(a,b) z with omega a 2-cocycle. Non-trivial
central extensions are classified by H^2(g; R). So:

    H^2(g; R) = 0   =>  NO non-trivial central extension exists; the route is CLOSED.
    H^2(g; R) != 0  =>  a candidate exists (availability, not realization).

Chevalley-Eilenberg, trivial coefficients:
    d1: C^1 -> C^2,  (d alpha)(x,y)   = -alpha([x,y])
    d2: C^2 -> C^3,  (d omega)(x,y,z) = -omega([x,y],z) + omega([x,z],y) - omega([y,z],x)
    H^2 = ker d2 / im d1
"""
from fractions import Fraction
from itertools import combinations


def bracket(D):
    """structure constants c[i][j] = vector of coefficients of [L_i, L_j] in basis L_0..L_{D-1}"""
    c = {}
    for i in range(D):
        for j in range(D):
            v = [Fraction(0)] * D
            if i != j:
                v[i] += 1          # [L_i, L_j] = L_i - L_j
                v[j] -= 1
            c[(i, j)] = v
    return c


def verify_against_matrices(D):
    """confirm [L_i,L_j] = L_i - L_j on actual matrices"""
    def mat(t):
        M = [[Fraction(1 if a == b else 0) for b in range(D)] for a in range(D)]
        for b in range(D):
            M[t][b] += 1
        return M

    def mul(A, B):
        return [[sum(A[a][k] * B[k][b] for k in range(D)) for b in range(D)] for a in range(D)]

    def sub(A, B):
        return [[A[a][b] - B[a][b] for b in range(D)] for a in range(D)]

    for i in range(D):
        for j in range(D):
            Li, Lj = mat(i), mat(j)
            comm = sub(mul(Li, Lj), mul(Lj, Li))
            claim = sub(Li, Lj) if i != j else [[Fraction(0)] * D for _ in range(D)]
            if comm != claim:
                return False
    return True


def rank(rows):
    M = [r[:] for r in rows]
    if not M:
        return 0
    n, m = len(M), len(M[0])
    r = 0
    for col in range(m):
        piv = next((i for i in range(r, n) if M[i][col] != 0), None)
        if piv is None:
            continue
        M[r], M[piv] = M[piv], M[r]
        pv = M[r][col]
        M[r] = [x / pv for x in M[r]]
        for i in range(n):
            if i != r and M[i][col] != 0:
                f = M[i][col]
                M[i] = [a - f * b for a, b in zip(M[i], M[r])]
        r += 1
    return r


for D in (3, 4, 5, 6):
    c = bracket(D)
    ok = verify_against_matrices(D)

    pairs = list(combinations(range(D), 2))          # basis of C^2 (omega_{ij}, i<j)
    triples = list(combinations(range(D), 3))        # basis of C^3

    def om_index(i, j):
        """index into the C^2 basis, with sign for orientation"""
        if i == j:
            return None, 0
        return (pairs.index((i, j)), 1) if i < j else (pairs.index((j, i)), -1)

    # d2 : C^2 -> C^3
    d2_rows = []
    for (x, y, z) in triples:
        row = [Fraction(0)] * len(pairs)

        def add(vec, other, sign):
            # omega(sum_k vec_k L_k, L_other) contributes sign * vec_k * omega(k, other)
            for k in range(D):
                if vec[k] == 0:
                    continue
                idx, s = om_index(k, other)
                if idx is not None:
                    row[idx] += sign * s * vec[k]

        add(c[(x, y)], z, -1)
        add(c[(x, z)], y, +1)
        add(c[(y, z)], x, -1)
        d2_rows.append(row)

    ker_d2 = len(pairs) - rank(d2_rows)

    # d1 : C^1 -> C^2 ; (d alpha)(L_i,L_j) = -alpha([L_i,L_j])
    d1_rows = []
    for a in range(D):                                # alpha = dual basis element a
        row = [Fraction(0)] * len(pairs)
        for n, (i, j) in enumerate(pairs):
            row[n] = -c[(i, j)][a]
        d1_rows.append(row)
    im_d1 = rank(d1_rows)

    h2 = ker_d2 - im_d1
    print(f"D={D}: [L_i,L_j] = L_i - L_j verified on matrices: {ok} | "
          f"dim C^2={len(pairs):>2} ker d2={ker_d2:>2} im d1={im_d1:>2} "
          f"=> dim H^2(g;R) = {h2}")

print()
print("dim H^2 = 0  =>  every 2-cocycle is a coboundary  =>  every central extension of g")
print("is TRIVIAL (a direct sum g (+) Rz with z bracketing to nothing). No cocycle can move")
print("the bracket into the centre, so no hbar can be manufactured this way.")
