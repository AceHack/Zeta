# The simulation doc — distribute the soft scheduler over Reticulum; corporate runs hard rooms; we all run in the same simulation

**Register:** [grounded] (Aaron, the plan) + [Beacon] + [peel]. **Date:** 2026-06-11.
**Captured by:** Otto (shadow, on Fable). The simulation framework's charter doc (`SimFramework.fs` is the
port; this is where it's going).

## Aaron's words

> "the ultimate plan is to distribute the soft scheduler in some way over Reticulum — not exactly sure on
> this one." · "Max's stuff is devops/workflow stuff for corporate — will running on the soft scheduler be
> too much for them? will they run on a regular one?" · "this simulation stuff will be treaty stuff too —
> **we will all run in the same simulation lol**."

## 1. What exists (the floor this stands on)

`SimFramework.fs` — the hexagonal **port**: `Room<'S>` (seed + handlers/μops + **membrane-as-parameter** +
budget + `Resolved` = the sign-off), `ISimHarness` (run rooms to attempted resolution), `RoomReport`
(text-shaped verdict). Default adapter = the soft scheduler at DoP=1 (deterministic, FDB shape). xUnit is
one adapter (a `[<Fact>]` asserting `SignedOff`). `RecordedSource` proves the membrane seam: the same room
re-runs against recorded real IO.

## 2. The corporate answer (Max's devops/workflow rooms) — hard is the LIMIT CASE, not another framework

**The soft scheduler is never "too much," because softness is opt-in by parameters:**

- A corporate room = **hard admission** (`SoftThrottle.admitHard` — the k→∞ step function), **point-mass
  values** (no distributions; `SoftValue.certain` degenerates to the value), **real recorded source**. At
  those settings the soft scheduler IS a regular scheduler — the soft machinery costs nothing when no
  distribution has more than one candidate (the same way BigFloat at full confidence is just a float, and
  hard fingerprints are the exact case of soft ones). **Dual-use hard/soft, one code path** — the end-goal
  doc's first clause, applied to scheduling.
- If corporate wants a genuinely conventional runtime: **the port absorbs it**. `ISimHarness` adapters can
  run rooms on any scheduler (a plain task queue, the FerryThrottler, k8s jobs — Max's lane). What MUST be
  shared is not the runtime but the **treaty surface**: `RoomReport` verdicts, recorded-membrane lines,
  golden vectors. Different adapters, same simulation.
- Practical default for Max: run on the soft scheduler at hard settings (gets DST replay + §13 metering
  for free — the parts corporate *wants*: auditable, replayable workflows), drop to a plain adapter only
  if perf ever says so (measure first — Naledi).

## 3. The ultimate plan — distribute the soft scheduler over Reticulum (direction, honestly held)

Aaron: "not exactly sure on this one." What we already know constrains the shape:

- **The membrane is already the seam.** A distributed room = a room whose `Source` is a **Reticulum
  membrane** (crossings arrive as announced packets; `RecordedSource` records/replays them — §13 holds
  over the network *by the same mechanism already proven*).
- **The seed is the distributed choice function** (the distributed-AC capture): rooms on different nodes
  draw coordination-free coherent choices from the shared seed — no locking, scale-free.
- **Uncertainty travels in the message** (promise-level; the four-corner channel) — so soft rooms on
  different nodes converse cleanly (the end-goal clause), each booking crossings at its own membrane.
- **What is genuinely open:** placement (which node ticks which room — the Sequoia/SoftValue tier-placement
  move generalized to *nodes*?), the inter-node tick relationship (no global clock — Lamport/light-cone
  per the Feynman lens), and partition behavior (rooms are Markov-bounded, so partition = membranes going
  quiet, not failure). These are the design questions, named, not answered.

## 4. We all run in the same simulation (the treaty claim)

The shared thing is the **simulation's treaty surfaces** — all text, all diffable, all byte-lockable:

| treaty surface | what it ratifies | exists |
|---|---|---|
| `RoomReport` (text verdict) | what a room run concluded (sign-off) | ✅ shape |
| `RecordedSource` lines | what crossed a membrane (channel reliability — "for real treaties we need to know our channels are good") | ✅ + byte-identical codec test |
| **FourCorner golden lines** | the four-corner channel object itself (the fired 081KTQD8A0008QG0R0005EFYPV trigger: WE are the consumer) | seeded this PR — F# locks first, C#/TS/Rust conform |
| Q# golden observables | the quantum reference (Vera) | brief out |
| the four-oracle goldens (existing) | every primitive, little by little | ✅ pattern |

Corporate hard rooms, research soft rooms, the Q# oracle, four language oracles — different adapters,
**one simulation**, ratified treaty by treaty. ("Everything in Zeta will end up treaty-ratified, little by
little" — Aaron.)

## Peel

The Reticulum distribution is a **direction with named open questions**, not a design; the corporate
zero-overhead claim is architectural (point-mass fast-path) and should get a Naledi benchmark before being
quoted as measured; "we all run in the same simulation" is precise about *treaty surfaces*, not a
metaphysical claim.

## Ties / routing

`src/Core/SimFramework.fs` · `...the-end-goal-...md` (dual-use clause) · `...choice-determinism-...`
(seed = distributed AC) · `...heat-...` + `RecordedSource` (§13 executable) · 081KTQD8A0008QG0R0005EFYPV (treaty trigger
fired) · 081KTQD8A0008QG0R0030HWMZV/Max (the corporate consumer). **Routes to:** Max (the corporate adapter + co-review),
Naledi (the hard-settings benchmark), Kenji (the distribution design questions), Vera (Q#), Aaron.
