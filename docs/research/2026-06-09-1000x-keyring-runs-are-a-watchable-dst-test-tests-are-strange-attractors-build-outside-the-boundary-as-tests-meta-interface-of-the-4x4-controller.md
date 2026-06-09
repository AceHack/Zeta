# The 1000× keyring runs are now a watchable DST test; tests are our strange attractors; "build it in a test" is the meta-process; the test is the meta-interface of the 4×4 controller (navigable by Xbox controller)

**Register:** [grounded] BUILT + [synthesis] (Aaron). **Date:** 2026-06-09. **Captured by:** Otto (shadow).
This one is **code, not just a doc** — the 1000× DST runs and you can watch it.

## Aaron's words

> "lets turn our 1000 crypto test runs into a DST test i can watch right here and our git[hub] workflows
> can just automate it. the whole meta process of every time we need something outside the boundary of
> the test we go build it in a test — our tests become our strange attractors in chaos theory." ·
> "This is literally test as the meta interface of our 4x4 controller, the meta game." · "the universal
> action grammar now has a dashboard that's navigable with our xbox controller."

## BUILT: the 1000× keyring DST (watchable + automated)

- **`tools/setup/persona-keys/derive.ts`** — the keyring derivation extracted as a **pure importable
  function** (the treaty's TS oracle); `gen.ts` is now a thin CLI over it (byte-output unchanged —
  verified the golden vector + the existing conformance test still match exactly).
- **`tools/setup/persona-keys/keyring.dst1000.test.ts`** — derives the keyring **1000×** from the
  byte-locked golden seed and proves the deterministic surface is **byte-identical every run**.
  **Result (local, watched): `1000/1000 derivations … pub mismatches=0, priv-material mismatches=0`,
  ~13s.** You can watch it: `cd tools/setup/persona-keys && bun test keyring.dst1000.test.ts`.
- **`.github/workflows/keyring-dst1000.yml`** — automates it (paths-scoped + manual dispatch,
  SHA-pinned, concurrency-grouped). The git workflow just runs the same DST.

### The DST test caught a real property (test-as-meta-interface in action)

Building it surfaced a genuine finding (not papered over): the **public surface + raw private key
material are deterministic/byte-locked**, but **SSH/PGP private ARMOR is intentionally
non-deterministic** (OpenSSH random checkbytes; PGP random salt/IV) — same key, different armor bytes
(identical fingerprints prove it). So the byte-lock is over the **public surface + raw private
material**, not the armor; the test asserts both the lock *and* the armor-non-determinism as known
properties. The test *found* this — exactly the point below.

## The meta-process: build outside-the-boundary needs AS tests

> "every time we need something outside the boundary of the test, we go build it in a test."

When a tick needs something it doesn't have (a tool, a fact, a capability — *outside the test's
boundary*), the move is **not** to build it on the side — **build it as a test.** The new capability
arrives as a DST test (= a tick): it checks in code, runs deterministically, shows hot if it fails,
merges to main. So the system grows by **accreting tests**, each a proven tick. (This *is* the
"close over the boundary" move at the dev-loop level: a need outside the boundary becomes a test
inside it.)

## Tests are our strange attractors (chaos theory)

> "our tests become our strange attractors in chaos theory."

In a chaotic dynamical system, trajectories are drawn toward a **strange attractor** — a bounded set
the dynamics converge onto without ever repeating exactly. **Our tests are that attractor:** the
self-driving DST loop (observe.ts CYOA reservoir wall → advance-tick → merge-to-main → recurse) is a
chaotic-ish search over state space, and **the tests are what it's pulled toward** — every trajectory
either lands on a passing test (converges into the attractor / merges) or shows hot (off-attractor /
investigated). The tests **shape the basin**: they're the bounded set the whole fleet's dynamics
settle onto. Adding a test **extends the attractor**; the loop then flows toward it. (Fixed-point
shapes A–F are the *local* terminating shapes; the test-attractor is the *global* set they compose into.)

## The test is the META-interface of the 4×4 controller (the meta-game)

> "test as the meta interface of our 4x4 controller, the meta game."

The universal action grammar is a **4×4 (16-slot) controller**: Navigate (0-3), Commit (4-7), Scope
(8-11), **Meta (12-15: refresh / re-observe / escalate)**. The **test is the Meta layer** — running a
DST test *is* re-observe + commit-the-advance + escalate-on-fail, i.e. **playing the meta-game**:
the game of advancing/verifying the world itself, one tick. So the test isn't *around* the controller;
**the test IS the controller's meta-interface** — the move that operates the loop on itself.

And it's now **physically navigable**: *"the universal action grammar has a dashboard navigable with
our Xbox controller."* The 16 slots map naturally to a **gamepad** (d-pad + face/bumper buttons = the
4 groups × 4), so a human can **drive the dashboard with an Xbox controller** — ride-along/summon/run-a-
tick by controller. The 4×4 controller becomes a literal controller; the meta-game becomes playable.
(AX/UX: the most legible possible surface for the action grammar — Iris/Daya.)

## Honest scope / handoff

The 1000× DST + derive.ts refactor + workflow are **built + green** (watched: 1000/1000, 0 mismatch).
The meta-process (build-needs-as-tests), tests-as-strange-attractors, test-as-meta-interface, and the
Xbox-controller dashboard are framings on top (the dashboard is referenced as existing — verify/locate
the dashboard surface; AX/UX with Iris/Daya). Routes to Dejan (the workflow), Soraya/Sova (the DST as
a provable tick), Iris/Daya (the controller dashboard).

## Anchors / ties

Strange attractor / chaos theory (Lorenz; basin of attraction); DST §7 (the watchable tick);
byte-lock golden vectors + `no-binary-in-proof-lineage`; the 4×4 universal action grammar
(Navigate/Commit/Scope/**Meta**) + observe.ts; gamepad/Xbox mapping (16 slots → controller); the
self-driving recursive DST loop + tests-are-ticks + 1000×-done-bar; SSH/PGP armor non-determinism
(OpenSSH checkbytes / PGP salt-IV) — the finding the test caught.
