# One word, four referents — "time crystal" is not the shared shape; *derived state is droppable* is

**Otto (shadow), 2026-08-14.** Design synthesis, docs + work-items only. Auto-merge deliberately **not** armed.

## Verdict, first

**Several — not one.** The four surfaces do not form one system, and the word that appears to join them
is joining nothing: **"time crystal" carries at least four mutually incompatible referents across five
files**, and the two oldest of them contradict each other outright.

But the refutation is not the whole answer. **A real shared shape does exist across two of the four
surfaces plus PR #10682** — it is just not the one the word names, and it already has human anchors:

> **Derived state is free to keep, because the generator is retained and the state can be regenerated;
> therefore it is safe to drop.** The invariant preserved across the drop is the *generator's content
> identity*, never the path that produced it.

That is memoization / content-addressed derivation / garbage collection — Dolstra, McCarthy, Futamura —
not Wilczek. The working hypothesis offered for refutation was **half right and correctly shaped**: right
that regenerability buys droppability, right that the ContentAddress is what survives; **wrong that the
zero-downtime spec is what it buys** (that spec uses the opposite mechanism), and wrong in adopting the
physics name.

**Two later additions changed the shape of this answer and are carried in full:**

- The rigidity Aaron names — *invariance under version-label perturbation* — is **real, verified in code,
  and stronger than stated** (the version field is not in `codeIdentity`'s domain at all). It still does
  not clear `Orbit.fs`'s bar, and §3b says exactly why: **invariance-by-projection is not
  rigidity-under-perturbation.** It also currently describes only ace's *unmerged* identity layer, while
  the *shipped* resolution layer decides by semver label (§3d).
- **"Derive, don't correlate" does unify this with the instrumentation-honesty thread** (§5c). A semver
  label is a correlated-coincidence proxy in exactly the sense the failing meters were, and the shared
  mechanism is that *accumulated confirming observations are the error*, not evidence against it. That is
  one principle, not a rhyme — and regenerability (§4a) is what makes the derived alternative affordable.

---

## 1. The four surfaces, re-read (CHECKED)

Every quotation below was re-read in file. Line numbers are from `origin/main` at `7d5ea62162`.

| Surface | What it actually is | Says "time crystal"? |
|---|---|---|
| `src/Core/Orbit.fs` | Dynamical-systems orbit classifier: `Fixed` / `Crystal of int` / `Quasiperiodic` / `Chaotic of float`, plus `largestLyapunov` + `divergenceRate2D` | **Yes — and correctly** |
| `src/Core/SchedulerZeta.fs` | Recurrence prediction + weak-referenced derived-orbit cache | **No. Zero hits for "crystal."** |
| `src/Core.TypeScript/ace/*` | Manifest → realizer → dep-graph pointers | **Yes — three files, two different meanings** |
| `docs/specs/zero-downtime-schema-evolution/` | Overlap-window rotation, TLA+-specified | **No** |

### 1a. `Orbit.fs` — the bar, and more of it than was quoted

The rigidity sentence is there as described (lines 28–31). Two corrections to the framing I was handed:

- The module has a **fourth class**, `Chaotic of float`, and `classifyDynamics` reaches it via
  `largestLyapunov`. So the module does not merely *decline* to measure perturbation response — it
  **already measures it** (Benettin et al. 1980), and `divergenceRate2D` measures phase-area contraction
  (Σλ). The instrument for a rigidity check partly exists.
- The distinction that matters most here is the plain type definition, not the caveat:

  ```
  | Crystal of int // period n>1 — a standing wave in time (discrete-time-crystal candidate)
  ```
  with `classify` mapping `Some 1 -> Fixed` and `Some n -> Crystal n`. **`Fixed` and `Crystal` are
  disjoint by construction.** A period-1 state is explicitly *not* a crystal candidate in this taxonomy.

### 1b. `SchedulerZeta.fs` — the honest one, and a detail that changes the argument

`orbitStates` returns only the recurrent set — `[ for i in j .. states.Count - 1 -> states.[i] ]`,
discarding the transient prefix. `FixedPointCache` holds it in a `System.WeakReference<'S[]>` with an
explicit `Unload()`.

**The detail that matters:** the cache is constructed as
`FixedPointCache<'S,'K>(key: 'S -> 'K, step: 'S -> 'S, start: 'S)` and holds that triple in **ordinary
strong fields**. Only the *derived array* is weak. So "costs nothing to keep" is precise but bounded:
the orbit is free; **the generator is pinned and is not free.** Any claim that this state "costs
nothing" must carry the generator's cost. `SoftFixedPointTable` makes the same trade with the generator
keyed by content fingerprint — and its docstring already routes to TOSEC/GoodTools/MAME content hashes,
i.e. it *already* reached for content-addressing, independently of ace.

This module never claims to be a time crystal. It is the cleanest of the four and it needs no defending.

### 1c. ace — one word, three jobs, none of them periodic

Three distinct uses, and they do not agree with each other:

- `setup-manifest.ts:14` — `/** Time-crystal update policy for a dependency (Ace re-solve rules). */`
  over `SetupDepUpdatePolicy = "pinned" | "pinned-url" | "distro-default" | "self-updating" | "track-head"`.
  Here "time-crystal" modifies an **update policy**. `pinned` never changes (period 1); `track-head`
  changes whenever upstream does (externally driven, no period at all). The type's own members span the
  two regimes the word is supposed to distinguish.
- `setup-mechanism-pointers.ts:16` — the phrase decorates a function whose entire body is
  `` return `src/Core.TypeScript/ace/setup-realizers/${mechanismId}.ts` ``. **A string concatenation.**
  Nothing in it is periodic, rigid, or regenerating.
- `setup-mechanism-pointers.test.ts:15` — `describe("setup mechanism pointers (Ace time-crystal deps)")`.
  The "matching test" tests https-URL and sha256-pin presence. It does not test anything the name asserts.

### 1d. The zero-downtime spec — the opposite mechanism

`SchemaEvolution.tla` line 6 states the key invariant, and line 94 enforces it:

```tla
Consolidate ==
    /\ \A f \in Fields : schema[f] <= 0 => RefCount(f) = 0
```

with `RefCount(f) == Cardinality({c \in Consumers : f \in refs[c]})`.

This is **reference counting**. The old schema is retained *precisely because it cannot be dropped and
regenerated* — consumers still hold references, and the window stays open until they do not. Where
`SchedulerZeta` says "derived, so drop it freely," the spec says "referenced, so you may not drop it
yet." Those are not the same idea. They are two members of one older family (§4).

Scope note: this spec is about **metadata schema fields**, not code or binaries. It is a *data* schema
migration, which weakens any direct reading of it as "a software update."

---

## 2. The lineage, which explains why nothing cites anything (CHECKED via `git log`)

| Date | Surface | Meaning of "time crystal" |
|---|---|---|
| 2026-05-22 / 05-28 | `docs/trajectories/ace-package-manager-skill-crystallization-pipeline/RESUME.md` | **A frozen, audited, bounded snapshot.** *"don't ship the living skill. Ship a frozen … snapshot of it — a time crystal."* |
| ≤ 2026-06-21 | `src/Core.TypeScript/ace/*` | inherits the frozen-snapshot sense; applied to update policy + realizer paths |
| **2026-06-08** | `src/Core/Orbit.fs` (#7102) | **Periodic motion, period n>1, `s ≠ step s`, rigidity required** |
| 2026-07-02 | `src/Core/SchedulerZeta.fs` (#9172) | (does not use the term) |
| 2026-08-02 | `docs/research/…pilot-wave-done-right…quasi-time-crystal…` | periodic motion at zero energy; *"quasi is the physically honest word"* |
| 2026-08-10 | `src/Core.TypeScript/ferry-throttler/four-corner-feedback.ts` | a rejected lane cycling with **period ≤ 4**, parked as a "0-energy bottom state" |

**The ace usage predates `Orbit.fs` by two and a half weeks.** This is not one concept drifting across
surfaces; it is **two independent coinages of the same two words, in the wrong order**, plus later
surfaces borrowing whichever was nearest. That is the actual reason none of them cites the others: there
was never a shared referent to cite.

And the two senses are not merely different — they are **opposites**. A frozen immutable artifact is
motionless. Wilczek's entire claim is that a time crystal *moves* in its ground state, in contrast to a
static one. In `Orbit.fs`'s own taxonomy a pinned package is `Fixed`, and `Fixed` is explicitly not
`Crystal`.

---

## 3. The rigidity test, applied to our own metaphor

Aaron 2026-08-14 names the perturbation class, so this is testable rather than rhetorical:

> *"best heuristic of what they guard against is accidental version number changes like non-semantic
> versioning and other supply chain injection techniques — it protects against that with consistent
> workflow for upgrades and safety / breaking checks **that ignore the version numbers**."*

### 3a. The invariance is real, and stronger than claimed (CHECKED, with one correction)

Verified against the code rather than taken. **Correction first: PR #10675 is `OPEN`, not merged** —
`capability-manifest.ts` does not exist on `origin/main`. This is *proposed* code, not shipped code.
From the PR patch:

```ts
export function codeIdentity(manifest: AceManifest): string | null {
  const sig = (manifest as AceManifest & { signature?: { key_id?: unknown } }).signature;
  if (!sig || typeof sig.key_id !== "string" || sig.key_id.length === 0) return null;
  if (typeof manifest.name !== "string" || manifest.name.length === 0) return null;
  return `ace:${sig.key_id}/${manifest.name}`;
}
```

The invariance is **stronger than "robust to version perturbation"**: `manifest.version` is *not an
argument to the function*. It cannot perturb the result because it is not in the domain. Both claimed
tests exist and assert what was described — invariance under version bump *and* content change
(`expect(codeIdentity(v1)).toBe(codeIdentity(v2))`), and the stranger case asserting
`identityPreserved === false` **with the stranger's key also trusted**, so "trusted" never means "may
impersonate." A correctly designed defence against name-squatting and version-race injection.

### 3b. And it still does not clear `Orbit.fs`'s bar — now for a cleaner reason

*Robust to one named perturbation* is not *rigid* in Wilczek's sense. The code makes that sharper than
"narrower":

> **Invariance-by-projection is not rigidity-under-perturbation — they are opposite epistemic
> categories.** `codeIdentity` is invariant in `version` because `version` was *removed from the
> domain*. A function that ignores `x` is trivially invariant in `x`; that is a definition, not a
> finding. Time-crystal rigidity is remarkable precisely because the perturbation **does** enter the
> dynamics — you perturb the actual drive — and the subharmonic order survives anyway. It is emergent
> and could have failed. Here there is nothing to survive: the perturbation was defined out of existence.

So the claim clears an *engineering* bar convincingly and fails the *physics* bar it was offered against.
And it fails where the earlier reading did: **there is still no `n`.** No drive, no subharmonic, no
period for rigidity to be a property *of*. An identity string that does not change is `Fixed` — period 1
— which `Orbit.fs` puts in a different constructor from `Crystal`.

(The sha256 pins are a second, genuinely detect-and-repair invariance — byte-drift rejected, re-fetch
restores — against a perturbation the ace test file records as having actually happened. Same verdict:
real, valuable, period 1.)

**Verdict unchanged, reasoning upgraded: "time-crystal pointer" is a Mirror-register coinage that has not
earned this Beacon anchor and cannot earn it.** The underlying property is real and deserves its own
correct name — it is the **quotient/projection** move of §5a, not a physics phenomenon
(→ `081M00SWEDB087G0R003ZRBDCA`).

### 3c. Two invariants with *opposite* content-sensitivity — the useful finding

Verifying 3a surfaced something that refines §5a and §5b:

| Key | Sensitive to bytes? | Invariant across | Answers |
|---|---|---|---|
| `ContentAddress(BLAKE3(spec))` (PR #10682) | **yes — it *is* the bytes** | re-realization of the *same* spec | "is this the same realization?" |
| `codeIdentity = ace:<key_id>/<name>` (PR #10675) | **no — invariant under content change** | an authorized update to a *new* spec | "is this the same lineage?" |

**Opposite projections**, and the repo needs both. Neither is "the thing preserved across regeneration" —
the answer depends on which question is asked. This sharpens §5b: an ECC has only the first kind of
invariant (deviation from the codeword = error), which is exactly why treating an update as ECC drift
inverts. **The update path runs on the second invariant, which is not an ECC at all — it is a
provenance/authorization chain.** Conflating "the generator corrects drift" with "the generator performs
the update" is precisely the conflation of these two keys.

### 3d. The claim describes one half of ace; the shipped half does the opposite

*"Checks that ignore the version numbers"* accurately describes the identity layer. It does not describe
the layer that decides which bytes you actually get:

- `src/Core.TypeScript/ace/resolve.ts:87` — `if (!satisfies(concrete, range))`; resolution by semver range.
- `src/Core.TypeScript/ace/solver.ts`, `semver.ts` — version-label-driven solving.
- `src/Core.TypeScript/ace/helm-change-detector.ts:2` — `import semver from "semver"`; a **change
  detector** whose notion of change *is* the version label.

ace is currently **split**: version-ignoring identity in an *open* PR, version-trusting resolution
*shipped on main*. The rigidity named is real and is the right design, and it does not yet reach the part
of ace that chooses artifacts. Filed as `081M00T2W4T087G0R0039XXW9G`.

---

## 4. What *is* actually shared — and its real anchors

Strip the word and three surfaces converge on a genuine, well-anchored shape.

**4a. Derived-state-is-droppable (SchedulerZeta + ace + PR #10682).**

- `SchedulerZeta.FixedPointCache`: orbit is derived from `(key, step, start)` ⇒ weak-held ⇒ droppable ⇒
  regenerated in `O(reachable)`.
- ace: installed state is derived from `(manifest, realizer, pin)` ⇒ droppable ⇒ regenerated by re-running
  the realizer.
- PR #10682: the key that survives regeneration is `ContentAddress(BLAKE3(realization spec))`, **not** the
  minted ZetaId (48 bits timestamp + 32 bits randomness).

Beacon anchors, all pre-existing and none of them physics:

- **Eelco Dolstra, *The Purely Functional Software Deployment Model* (2006)** — a store path is a
  content-addressed derivation whose output is regenerable and therefore *garbage-collectable*. This is
  ace's shape exactly, and the repo already reached for it: `docs/research/2026-06-07-ace-file-is-a-universal-content-addressed-dockerfile-idempotent-layers-cross-os-patch-sets-aaron.md`.
- **John McCarthy (1960)** — already cited in `src/Core/ShivaGc.fs:25`.
- **Futamura (1971) / partial evaluation** — the `SpecializationCache` philosophy `SchedulerZeta`'s own
  docstring names ("cogen-as-memory-management").

(→ `081M00SWEE6087G0R00092EHTE`)

**4b. Reclamation is gated on reachability (SchedulerZeta + ShivaGc + SchemaEvolution).**

The zero-downtime spec does not share 4a, but it does share something with it — one level up:

| Surface | Mechanism | Drop when |
|---|---|---|
| `SchedulerZeta.FixedPointCache` | weak reference | GC proves unreachable |
| `src/Core/ShivaGc.fs` | tracing + generational tenuring | `heap − survivors` |
| `SchemaEvolution.tla` | **reference counting** | `RefCount(f) = 0` |

Three mechanisms from one family (tracing vs. refcounting — Collins 1960 vs. McCarthy 1960), applied at
three scopes, none citing the others. **That** is the real uncited convergence in this bundle, and it is
boringly well-anchored. (→ `081M00SWEF0087G0R003C1TS8B`)

---

## 5. The two connections I was asked to test

### 5a. Orbit-vs-trajectory ≟ ContentAddress-vs-ZetaId — **survives, with a bound**

`SchedulerZeta.predict` returns `{ Transient; Period; Reachable }` and `orbitStates` **discards the
transient prefix**, keeping only the recurrent set. PR #10682 discards the minted ZetaId (timestamp +
randomness = the accident of arrival) and keeps the ContentAddress.

Both are **quotients that forget the path of arrival and keep the invariant reached.** Many start states
in a basin land on one orbit; many mints of one realization spec give one ContentAddress. The structural
correspondence is real.

**The bound:** the orbit is invariant under *the dynamics* (`step`); the ContentAddress is invariant
under *re-realization*. Those are only the same operation if realization is idempotent — and PR #10682's
own work-item `081M00S0YB4087G0R00109502S` records that **`install()` is not idempotent in effect**
(`LaunchdAdapter.install()` calls `uninstall()` first, killing an in-flight tick). So the correspondence
holds *for the key* and is currently **false for the operation**. Worth stating, because it means the
analogy is load-bearing on a §12 defect that is already filed.

Note also that under idempotent realization the orbit in question has **period 1** — which lands it,
again, in `Fixed`, not `Crystal`.

### 5b. Generator-as-ECC along the time axis, with a software update as the drift — **does not survive; it inverts**

This is the reading I most wanted to be true, and it fails on its own terms.

An error-correcting code **restores a corrupted word to the codeword it should have been**. A software
update **changes which codeword is correct.** Those are opposite operations on the same object. Applied
literally, an ECC that treated "version B where the generator says version A" as drift would **revert the
update** — it would classify the intended change as the error and undo it. The reading does not merely
fail to hold; it recommends the wrong action.

Two further gaps, stated plainly:

- **No syndrome along time.** The N-oracle byte-lock has real decoding: four independent implementations,
  disagreement localizes the fault, majority projects back to the codeword. DST replay across time has
  redundancy (the log) but **no minimum-distance decode** — a replay divergence yields a diff and a human,
  not a correction. That is error *detection*, not error *correction*.
- **The rule's own wording is where the pun enters.** `only-the-irreducible-is-primitive-generate-the-rest.md`
  says the generator corrects drift across *"time (DST replay / versions)"*. But
  `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md:578` unpacks the same claim as *"DST corrects drift across
  TIME (replicated data = quasi-time-crystal; deterministic replay)"* — i.e. **replicas not diverging
  under replay**, which is a space-like disagreement observed over time. That is a coherent claim. **Version
  transition is a different thing that the word "versions" silently annexes.** The seam is one word wide.

**However — I did not find this open.** `FROZEN-CORE-AND-CONJECTURE-REGISTER.md:578` already carries
Aaron's 2026-06-15 statement — *"distribute with ace over our gen(gen)===gen … DST keeps the replicated
data as quazi time crystals"* — classified **§B grand-synthesis, not discharged**, with discharge
obligations and an explicit falsifier. So the synthesis I was asked to evaluate is **an already-registered
conjecture, not a new finding**, and the register's own honest peel already draws the boundary:

> *"the agent/intelligence is the **free layer** (not a time-crystal), only the *data* is the quasi-time-crystal."*

The correct action is to route to §B and add this negative result, **not** to mint a new synthesis doc as
if the ground were fresh.

---

## 5c. Does "derive, don't correlate" unify this with the instrumentation thread? — **yes, and it survives**

Aaron named a defect class today: **"correlated coincidence over time"** — a number that varies
plausibly, correlates with what you care about, measures something else, and where *repeated observation
strengthens the false confidence rather than exposing it*. Worked example: a meter charging `batchSize`
for an operation that erases nothing.

I tested whether a semantic version number is the same pattern or a rhyme. **It is the same pattern**,
and the test that convinces me is the third property rather than the first two:

| | instrument case | semver case |
|---|---|---|
| cheap observable | `batchSize` | the version label |
| expensive property it stands for | bytes actually erased | whether the change breaks you |
| what enforces the link | nothing | nothing — a publisher may ship a breaking change as a patch bump, by accident or intent |
| **why it survives scrutiny** | 1,508 successful runs read as health | many releases where semver held read as trustworthiness |

The third row is the load-bearing one. Both are proxies, but *many* proxies are merely imprecise. What
makes these two the same defect is that **accumulated confirming observations are the mechanism of the
error**, not evidence against it — the correlation holding for a long time is exactly what converts a
heuristic into an assumption nobody re-examines. That is a genuine single principle, not two things that
rhyme:

> **Derive, don't correlate.** Run the behavioural check; do not read the label. A check that reads a
> self-reported summary inherits the reporter's errors and reports confidence instead of the property.

This does link the regeneration synthesis to the instrumentation-honesty thread through one principle.
It is also **why §4a's shape matters practically**: if derived state is genuinely regenerable, you can
*run the behavioural check* — rebuild and compare — instead of trusting a label about what changed.
Regenerability is what makes deriving affordable.

**Two honest bounds.** (1) "Correlated coincidence over time" is **today's coinage** — no repo hits; it
is unanchored as a *term* even though the pattern it names is real. Its Beacon anchors already exist and
should be attached rather than a new coinage promoted: **Goodhart's law** (1975) for proxy substitution,
and **construct validity** (Cronbach & Meehl 1955) for "does the measure measure the construct." The
genuinely novel element worth keeping is the *time* axis — repeated confirmation strengthening rather
than exposing the error — which neither anchor states in that form. (2) The remedy is not free: a
behavioural breaking-check is far more expensive than reading a label, which is *why* the proxy exists.
Saying "ignore the version numbers" is only actionable where the derived check is affordable — i.e.
exactly where §4a holds.

---

## 6. What is unanchored, and should stay that way

**"0 energy minimal survivor state" — no repo hits as a term.** Confirmed independently; the `survivor`
matches are E8 codeword families, a Braid strand, and GC survivor spaces. I am **not** minting a meaning.

What I can report, as *candidate* anchors for Aaron to accept or reject — this is **inferred, not checked**,
and the inference is mine:

- `four-corner-feedback.ts:71-74` — *"treated as a **0-energy bottom state** — the ferry stops fighting it
  and lets it idle. This is the Chip-8 quasi-time-crystal **survival strategy**: collapse the loop because
  it is super-predictable and **costs 0 energy to maintain**."* Nearest textual match by a wide margin.
- The 2026-08-02 pilot-wave doc §4 BOUNDARY 1 — *"life support: the **survival floor** that keeps the system
  existing at **zero net cost**"*, with real anchors (Dijkstra self-stabilization 1974; Landauer–Bennett;
  Watanabe–Oshikawa 2015 no-equilibrium-time-crystals).
- `ShivaGc.fs` generational **survivors** + tenuring.

Three different plausible referents is itself the finding. **The phrase stays unanchored until Aaron says
which one he meant**, exactly as `memraid` and "burned future spacetime branches" were handled today.

**"0 down type update state transitions"** most plausibly reads as *zero-downtime type-update state
transitions*, i.e. the `FieldType` changes in `docs/specs/zero-downtime-schema-evolution/`. Also **inferred**.
If so, it is anchored — but to the overlap-window/refcount spec, which as §1d shows is **not** the
regenerate-and-drop mechanism the surrounding sentence implies.

---

## 7. A defect found on the way (filed)

`src/Core.TypeScript/ferry-throttler/four-corner-feedback.ts:66-69` defines and then contradicts itself:

> *"A quasi-time-crystal is a loop that repeats with **a period that is not a simple fraction of the tick
> rate**. … this manifests as a lane that keeps getting rejected at the same priority level, cycling
> through the same error dimension with **period ≤ 4**."*

A period ≤ 4 **is** a simple fraction of the tick rate. The definition names the incommensurate
(quasiperiodic) case and the detector then detects the commensurate one. By `Orbit.fs`'s taxonomy,
period ≤ 4 with n > 1 is `Crystal n`; `Quasiperiodic` is *no period ≤ maxPeriod*. The detector is
labelled as finding the class it structurally cannot find. Filed as `081M00SW8YJ087G0R002J1WFFE`.

---

## 8. How every check proposed here fails

Eleven instruments this month could not report what they existed to report. Stating the failure modes of
the three checks this doc implies:

1. **"Does the name have a period `n`?"** (the metering test for time-crystal claims) — **fails silently on
   dynamics that are periodic but never enumerated.** `Orbit.fs.period` searches only to `maxPeriod` and
   `classify` reports `Quasiperiodic` for both a genuinely aperiodic orbit *and* a chaotic one — the module
   says so itself. A reviewer running it on a system with period > `maxPeriod` gets "no period" and would
   wrongly conclude the name is unearned. **The check convicts, it does not acquit.**
2. **"Is the state droppable?"** — **fails whenever the generator is more expensive than the state**, and
   it cannot see that, because `FixedPointCache` reports `Hits`/`Misses` but never the *cost* of a miss. A
   cache with 90% miss rate and an `O(reachable)` regeneration over a large reachable set reads identically
   to a cheap one. Droppability is a safety property; this check says nothing about whether dropping is a
   good idea.
3. **"ContentAddress is preserved across regeneration"** — **fails exactly where §5a says it does**: it is a
   property of the *key*, and it is vacuously satisfiable by an operation that is not idempotent in effect.
   `install()` today preserves the ContentAddress while killing a running tick. A green check here means the
   naming is sound, **not** that the system is.

4. **`codeIdentity` invariance under version bump** (§3a) — **passes vacuously and cannot fail**, because
   `version` is not in the function's domain. The test `expect(codeIdentity(v1)).toBe(codeIdentity(v2))`
   will stay green if someone deletes version handling entirely, and would stay green for a function that
   returned a constant. It is a **regression guard against a future refactor**, which is a real and worthy
   job, but it must not be read as evidence that ace resists version-based supply-chain attacks — §3d
   shows the layer that picks artifacts still resolves by semver. **A test that cannot fail on the
   property people will cite it for is how the twelfth instrument gets built.** The check that *could*
   fail is an end-to-end one: publish a hostile higher version under a different key and assert the
   resolver does not select it.

None of these should be collapsed to a boolean. `declared-unprobed` must stay distinct from `probed-true`,
per PR #10682's own discipline.

---

## 9. Work-items

| ZetaId | Type | What |
|---|---|---|
| `081M00SW8YJ087G0R002J1WFFE` | bug | four-corner quasi-TC detector contradicts its own definition |
| `081M00SWEDB087G0R003ZRBDCA` | task | retire or qualify "time-crystal" in ace (one word, four referents, five files) |
| `081M00SWEE6087G0R00092EHTE` | task | Beacon-anchor ace derived state to Dolstra / McCarthy, not to time crystals |
| `081M00SWEF0087G0R003C1TS8B` | task | name the reclamation-safety family (weak / tracing / refcount, three scopes) |
| `081M00T2W4T087G0R0039XXW9G` | bug | ace split on version-labels: `codeIdentity` ignores version (open PR) vs `resolve`/`solver`/`helm-change-detector` deciding by semver (shipped) |

## 10. What this does not do

Not an implementation · not a rename executed (the ace files are owned by in-flight work and were **read
only**) · **not a new synthesis** — the strongest reading here is already registered at
`FROZEN-CORE-AND-CONJECTURE-REGISTER.md:578` §B and this doc adds a negative result to it rather than
re-minting it · does not assign a meaning to "0 energy minimal survivor state" · does not claim the
zero-downtime spec is downstream of anything (§1d shows it is a different mechanism) · does not evaluate
whether the ace pins' rigidity is *adequate*, only that it exists and is period-1.

## Pointers

- `src/Core/Orbit.fs` · `src/Core/SchedulerZeta.fs` · `src/Core/ShivaGc.fs` · `src/Core/SoftThrottle.fs`
- `src/Core.TypeScript/ace/setup-manifest.ts` · `setup-mechanism-pointers.ts` · `setup-mechanism-pointers.test.ts`
- `src/Core.TypeScript/ferry-throttler/four-corner-feedback.ts`
- `docs/specs/zero-downtime-schema-evolution/SchemaEvolution.tla`
- `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §B line 578 — the registered conjecture this refines
- `docs/research/2026-08-02-pilot-wave-done-right-homeostat-lifesupport-floor-free-hold-quasi-time-crystal-chip8-orbit-sandbox.md` — "quasi is the physically honest word"
- `docs/research/2026-08-14-ace-as-universal-zetaid-pointer-resolver-…` (PR #10682) — ContentAddress vs ZetaId
- `.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md` — the generator-IS-ECC rule §5b tests
- `docs/research/2026-06-15-the-anchor-taxonomy-…` — the metering test applied in §3
