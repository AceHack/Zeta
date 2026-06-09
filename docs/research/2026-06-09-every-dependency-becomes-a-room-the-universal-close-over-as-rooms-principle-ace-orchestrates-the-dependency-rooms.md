# Every dependency becomes a room — the universal close-over-as-rooms principle (ace orchestrates the dependency-rooms)

**Register:** [grounded] generalization (Aaron). **Date:** 2026-06-09. **Captured by:** Otto (shadow).
Unifies the per-dep close-over moves (Reticulum, proof tools, crypto) into one principle.

## Aaron's words

> "every dependency becomes a room."

## The principle

We've been closing over dependencies one at a time — Reticulum in a 4×4, the proof tools (TLA+/Z3/
Lean) "closed over but available inside DST," crypto via the two-adapter port. **Generalize it:
*every* dependency becomes a room.** A dependency is not a black-box import — it's a **treaty room**
(a 6×6×n DST room) where:

- the **upstream dep is the differential oracle** (dep-as-oracle: its output is the golden the room
  byte-locks against);
- our **own port/impl** is the other adapter (own-all-interfaces; always support both);
- the dep's **interface is byte-locked** across our oracles (fs cs ts rs py go) × serializers;
- the room is a **DST tick** — replayable, checks in, asserts the canonical root, can show hot/fail.

So the dependency graph **becomes a graph of rooms**. Importing a dep = convening its room. Trusting a
dep = its room is green (byte-locked, conformance-proven). Upgrading a dep = re-running its room
against the new upstream. Replacing a dep with our own = the room's own-impl adapter passes the same
golden the upstream oracle seeded.

## Why this is the same as everything else

It's the **recursive / self-similar** shape (§9/§10) applied to dependencies: the room shape recurs at
every magnification — a serializer is a room, a proof tool is a room, Reticulum is a room, a package is
a room, a hardware intrinsic (eventually) is a room. **One mechanism** (the treaty room / DST tick)
covers byte-lock, keygen, society-sim, proof, *and* every dependency — no separate "dependency
management" pipeline that drifts from the substrate.

And it composes with the judgments-cascade: a dependency-room is a **strange attractor judged on its
quality** (is the dep sound? does its room reduce uncertainty?), and when a dep-room's judgment changes
(CVE, breakage, a better own-impl), the verdict **cascades** to the rooms that depend on it (bounded,
idempotent — the change-cascade along the dependency graph).

## ace orchestrates the dependency-rooms

> (ties to) "ace = the package manager of package managers… eventually other dep sources via ace…
> ace becomes hardware-intrinsics deployment."

**`ace` is the orchestrator of dependency-rooms.** Where a normal package manager resolves a dependency
graph of *artifacts*, ace resolves a dependency graph of *rooms*: each dep is a room with a byte-locked
conformance treaty, a lockfile pinned to the **canonical root** (not just a version hash), the upstream
as oracle, and an own-impl adapter path. ace's z3-solved lockfile becomes "which rooms, at which
canonical roots, are convened." Closing over a new dep source = adding a room template; closing over
hardware = the room's artifact is a hardware intrinsic.

## Consequences

- **Borders are rooms.** The GitHub border, the npm/nuget/crate/pip/go-mod borders, the Reticulum
  border — each is a room where uncertainty-reduction-at-the-border earns trust + leverage over time.
- **No unaudited black boxes.** A dep with no room is a dep we haven't closed over — flagged, like an
  unanchored coinage or an uncovered claim. The room is how a dependency earns its place.
- **Own-it path is always present.** Because every dep-room has the own-impl adapter, "grow our own"
  is never a rewrite-from-scratch — it's making the own adapter pass the room's existing golden.
- **The dependency graph is replayable.** Every dep-room is a DST tick → the whole supply chain is
  byte-locked + replayable (supply-chain integrity as a property of the substrate, not a bolt-on).

## Honest scope / handoff

A unifying principle on built/captured pieces (dep-as-oracle, two-adapter ports, DST rooms, ace, the
6×6 treaty, the judgment cascade). To realize: a **dependency-room template** (upstream-oracle +
own-impl adapter + byte-lock golden + canonical-root lockfile entry) and **ace** resolving the
room-graph. Routes to: ace (`tools/ace/`), the six oracle cores, Soraya/Sova (per-dep conformance
proof-rooms), Mateo/Nazar (supply-chain + the border rooms), Dejan (the dep-room CI runners).

## Anchors / ties

own-all-interfaces / two-adapter / dep-as-oracle (the per-dep close-over, now universal); DST-tests-
are-rooms + proof-tools-closed-over-inside-DST; the 6×6 treaty room; `ace` (package-manager-of-package-
managers → orchestrator of dependency-rooms; z3 lockfile → canonical-root room-graph); the judgment
cascade (dep-room re-judged → cascades, bounded+idempotent); uncertainty-reduction-at-the-border (every
border is a room); recursive §9 / self-similar §10 (the room shape recurs to every dependency);
supply-chain integrity (every dep-room is a replayable DST tick).
