#!/usr/bin/env python3
"""Does a bounded propagation horizon really give NON-TRANSITIVE connectedness?

Mirrors src/Core/TravelerFrame.fs:
  Frame          = actor -> versionstamp (missing = 0 = bottom)
  dominates a b <=> for every actor k, a[k] >= b[k]
  concurrent a b <=> not (dominates a b) and not (dominates b a)

CORRECTION (shadow, 2026-08-15): the first version of witness 2 defined the horizon as
"how far a must ADVANCE to dominate b", which is 0 whenever a already dominates b -- so a
general always 'reached' the boy and the test reported non-transitivity as FALSE. That
measured the wrong direction. Recall reaches BACKWARD; the horizon is a bound on how far
back, not on how far forward. Fixed below, with the failing version kept as a control.
"""
import itertools

ACTORS = ["x", "y", "z"]


def coord(f, k):
    return f.get(k, 0)


def dominates(a, b):
    return all(coord(a, k) >= coord(b, k) for k in set(a) | set(b))


def concurrent(a, b):
    return not dominates(a, b) and not dominates(b, a)


def comparable(a, b):
    return dominates(a, b) or dominates(b, a)


# ---- witness 1: causal COMPARABILITY is not transitive -----------------------
A = {"x": 1, "y": 0}
B = {"x": 1, "y": 1}
C = {"x": 0, "y": 1}
print("=== witness 1: causal comparability (TravelerFrame.dominates) ===")
print("A =", A, " B =", B, " C =", C)
print("A comparable B :", comparable(A, B), "  (B dominates A)")
print("B comparable C :", comparable(B, C), "  (B dominates C)")
print("A comparable C :", comparable(A, C), "  <- must be False")
print("A concurrent C :", concurrent(A, C))
print("NON-TRANSITIVE :", comparable(A, B) and comparable(B, C) and not comparable(A, C))

print("\n=== negative control: directed dominance IS transitive (it is a partial order) ===")
frames = [dict(zip(ACTORS, v)) for v in itertools.product(range(3), repeat=3)]
viol = sum(1 for a, b, c in itertools.permutations(frames, 3)
           if dominates(a, b) and dominates(b, c) and not dominates(a, c))
print("transitivity violations of `dominates` over", len(frames), "frames:", viol, "(must be 0)")

# ---- witness 2: bounded BACKWARD horizon (Reid's brave officer) --------------
H = 1


def backward_reach(a, b, H):
    """a directly recalls b: b is causally behind a, and no further back than H."""
    if not dominates(a, b):
        return False
    gap = sum(coord(a, k) - coord(b, k) for k in set(a) | set(b))
    return gap <= H


def forward_dist_WRONG(a, b):
    """the first (wrong) version: how far a must ADVANCE to dominate b."""
    return sum(max(0, coord(b, k) - coord(a, k)) for k in set(a) | set(b))


boy, officer, general = {"t": 0}, {"t": 1}, {"t": 2}
print("\n=== witness 2: bounded BACKWARD horizon, H =", H, "(Reid's brave officer) ===")
print("officer recalls boy      :", backward_reach(officer, boy, H))
print("general recalls officer  :", backward_reach(general, officer, H))
print("general recalls boy      :", backward_reach(general, boy, H), " <- must be False")
print("NON-TRANSITIVE           :",
      backward_reach(officer, boy, H) and backward_reach(general, officer, H)
      and not backward_reach(general, boy, H))

print("\n  [control] the WRONG forward metric that failed first time:",
      "general 'reaches' boy =", forward_dist_WRONG(general, boy) <= H,
      "-> reports non-transitivity as False. Direction matters.")


# ---- the Parfit repair: overlapping chains restore the connection ------------
def chain_reaches(a, b, nodes, H):
    seen, frontier = [a], [a]
    while frontier:
        cur = frontier.pop()
        if cur == b:
            return True
        for n in nodes:
            if n not in seen and backward_reach(cur, n, H):
                seen.append(n)
                frontier.append(n)
    return False


nodes = [general, officer, boy]
print("\ngeneral -> boy via OVERLAPPING CHAINS (Parfit continuity):",
      chain_reaches(general, boy, nodes, H), " <- must be True")

# ---- negative control: remove the delay and the separation disappears --------
print("\n=== negative control: unbounded horizon (no delay) ===")
print("H = 99: general recalls boy directly :", backward_reach(general, boy, 99))
print("=> with no propagation delay every node reaches every other directly;")
print("   the relation becomes transitive and the individuation vanishes.")
