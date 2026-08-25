# ADR: Drift-and-Heal Replaces Pre-Merge Gates — Reconciliation at AI Speed

Date: 2026-07-09
Status: Accepted (ratified 2026-08-08; amended 2026-08-25 with explicit operator consent)
Authors: Aaron (operator — "gates are a thing of the past, only drift works with
the speed of AI, we are a rocketship running on explosions") + Otto (cowork cell;
drafted from the night the gate lost the race)

Companion: [`2026-07-08-native-branch-protection-trust-based.md`](2026-07-08-native-branch-protection-trust-based.md)
(WHO may land — trust tiers). This ADR decides WHAT must converge versus what
must never break. The two compose.

## Context — the night of 2026-07-08, measured

The gate lost a race last night, and the numbers say it was not an accident but
a structural property:

- Between roughly 22:20Z and 00:40Z the `gate (required)` check was red for
  most of the window. Six independent breakage waves landed on main:
  markdownlint (three separate waves of fresh docs), semgrep action-pin and
  size-cap findings, shellcheck SC1087, an untrusted-`head_ref` inline, C#
  whitespace + import ordering, two bash-retirement inventory misses, and a
  stale generated MEMORY.md index.
- Fleet landing cadence: a new commit on main every ~5–10 minutes, some via
  the sovereign direct-push lane, bypassing the gate entirely (`09f419497`
  landed with two lint failures in it).
- Heal round-trip through the corporate lane: ~15–25 minutes per cycle (fix,
  push, full CI, merge). Four dedicated heal PRs (#9565, #9580, #9587, #9590)
  plus heals carried inside feature PRs (#9549) were needed to converge.
- **All but two violation classes were compensable.** Nothing functionally
  broken shipped: no failing build, no red test, no broken oracle on main.
  The gate was red overwhelmingly on style, metadata, and index drift — all
  healable after the fact, all healed after the fact. The two exceptions —
  mutable action tags and inline `github.head_ref` interpolation — are
  workflow-security findings and belong to the uncompensatable floor this
  ADR defines in item 5; treating them as healable drift that night was
  wrong by this ADR's own test (reviewer catch, Vera).
- The gate binds every PR's merge ref to WHOLE-REPO lint state. One agent's
  drift therefore blocked every other lane — a priority inversion. The musl
  fallback PR (#9549) and the GitHub auth provider (#9554) carried zero
  violations of their own and were blocked for ~2.5 hours by other lanes'
  drift.
- The auto-heal bot and a hand-healer fought: the bot's MD032 fixer re-split a
  wrapped code span every round (an oscillating, non-idempotent healer), and
  its heals staled the generated MEMORY.md index, creating NEW drift. Healing
  is real work with its own correctness obligations.

The instinctive response — "make the gate unskippable" — fights the fleet's
own physics. The sovereign lane exists BECAUSE disjoint append-only writes are
mathematically safe (trust-based ADR); serializing them behind a global gate
reintroduces the lock that lane was built to remove. Manifesto V2 constraint 2
is lock/wait-free: **a required serial pre-merge gate is a global lock on the
write path.** We removed the DB lock, the claim lock, the checkout lock — the
gate is the last lock, and last night it behaved exactly like every other
contended lock we have deleted: convoy, priority inversion, starvation.

## The recognition

We already run the alternative everywhere else in the stack. NixOS does not
gate `configuration.nix` edits — it converges the machine to the declaration.
ArgoCD does not block the repo — it detects drift and reconciles. K8s
controllers watch, diff, heal, forever. The repo's own registries, lint
configs, and inventories ARE desired-state declarations. What we called "the
gate going red" is, in declarative terms, **drift detection working perfectly**
— followed by a reconciliation loop we were running by hand, through the
slowest possible transport (PR round-trips), against an auto-healer nobody
verified for convergence.

A rocket is not a machine that avoids explosions; it is a machine that has a
place for them. Thrust IS the controlled continuous explosion; control is the
gimbal (fast, continuous, small corrections), not a launch clamp that re-grabs
the vehicle mid-flight every time combustion is imperfect. But every real
rocket also carries a flight termination system for the one class of event
that cannot be steered out of. Both halves of the metaphor are load-bearing.

## Decision

Invert the default: **drift-and-heal is the primary consistency mechanism;
pre-merge blocking is the exception, reserved for uncompensatable effects.**

1. **Desired state stays declared.** Lint configs, registries, inventories,
   golden vectors, schema specs — unchanged. They are the spec the system
   converges to, not a wall it queues behind.

2. **Drift detectors decouple from PRs.** The same checks that ran as the gate
   run continuously against main (tick-source cadence — the loop is the
   attractor, no outside force needed). Findings are published as drift
   events (observe lane, ZetaId-keyed, sovereign write) instead of a red X on
   somebody else's PR.

3. **Healers are first-class, and must be proven convergent.** Auto-healers
   run as reconcilers with two hard requirements learned last night:
   _idempotence_ (healing healed state is a no-op — the MD032 re-splitter
   fails this) and _closure_ (a heal may not create new drift — the
   MEMORY.md-staling heal fails this; a healer that touches memory/ must run
   the reindexer in the same commit). Agents on heal duty carry heals inside
   feature PRs — proven effective; it out-raced the dedicated-heal-PR loop.

4. **PR checks scope to the diff by default.** A PR reports drift only in files
   it touches. Whole-repo state normally does not block an unrelated lane. A
   PR that heals adjacent drift is celebrated, not required.

   **Narrow whole-tree functional exception (amended 2026-08-25):** a suite may
   enter the required floor only through the treaty-amendment consent path when
   it has a declared toolchain baseline, depends on no external service, device,
   or user-owned file, checks executable behavior, and cannot be diff-scoped
   without losing automatic coverage of newly added tests. The suite's current
   main verdict must be green when promoted, and the workflow dependency must be
   pinned by a structural test. This exception accepts one explicit cost:
   existing real source or declared-toolchain drift in that suite can
   temporarily block an unrelated PR until healed. Environment-dependent suites
   remain drift signals and cannot use this exception.

5. **The floor that remains gated — erasure plus explicitly consented functional
   breaks.** The smart-cascading-teardown design (2026-06-21) supplies the
   default: the genuinely-G-set residual, effects no saga can compensate.
   Measured functional-break exceptions must be recorded as NOT erasure-class
   in the floor registry. Pre-merge (or pre-push, in the sovereign lane's client
   hook) blocking remains ONLY for:
   - secret / key material exposure (cannot be unpublished),
   - treaty byte-lock floor violations — the golden-vector cross-oracle
     contracts (identity, ZetaId, IR) that other lanes build on THIS tick,
   - consent invariants (HC-9 persona-memory class),
   - signed-history rewrites,
   - workflow supply-chain / script-injection findings (mutable third-party
     action tags, untrusted `github.head_ref` / event data inline in `run:`)
     — reviewer catch (Vera, #9601): these LOOK like lint but a poisoned tag
     or injected script executes on the NEXT workflow tick; the compromise
     window, not the diff, is the uncompensatable part. Last night's
     treatment of them as healable drift was wrong by this ADR's own test,
   - **functional build/test failures in the PR's own scope** — second
     reviewer catch (Vera, P1): a `src/**` change that breaks `dotnet build`
     or a test suite poisons every downstream lane THIS tick — same
     blast-radius class as the byte-lock vectors, and the measured incident
     (zero red builds shipped) is evidence the current build gate WORKS, not
     license to drop it. Scoping still applies: a PR is blocked by breaking
     what it builds/touches, never by pre-existing whole-repo build drift
     (that drift gets a detector + auto-revert healer, not a lock on
     unrelated lanes), except for a separately consented whole-tree functional
     suite satisfying item 4's narrow criteria,
   - **the hermetic TypeScript behavior suite** — amendment 2026-08-25: its
     bare whole-tree invocation is the mechanism that covers a new test
     directory without a second allowlist. The environment-dependent
     TypeScript suite remains outside the floor.

   This is the fail-closed floor. Most entries remain seconds-fast; the hermetic
   TypeScript behavior suite is the recorded exception at roughly nine minutes.
   These are the only checks allowed to say "no" instead of "converging."

6. **Drift gets an SLO instead of a moral.** Red/green on main is replaced by
   MTTH (mean time to heal) per drift class, published on the dashboard.
   MTTH is **tick-indexed, not wallclock-indexed** (amendment 2026-07-09,
   with the deterministic-agreed-time ferry): drift events carry the tick id
   of the agreed clock, and mean-time-to-heal is a count of ticks — the
   phase-clock is the official reference frame for drift accounting, so
   every agent measures the same drift at the same tick, in the same
   order (not "the same now" — the phase clock gives agreed ORDER, not
   simultaneity; wording corrected at ratification per Alexa's
   signature note). The
   failure mode of drift-tolerance is normalized deviance — unbounded MTTH is
   the new "red," and a drift class whose MTTH trend grows becomes a workitem
   automatically. Aaron's wait-for-consolidation discipline applies: drift
   that is converging is healthy combustion; drift that accumulates is a leak.

## What this is NOT

- Not "delete the checks." Every check survives; what changes is WHERE it
  runs (continuously, on main) and WHAT it does (emit drift + trigger heal,
  instead of blocking unrelated merges).
- Not "quality doesn't matter." Last night's heals still happened — this ADR
  makes them cheap, scoped, and measured instead of heroic.
- Not a replacement for the trust-based ADR. Trust tiers still decide who may
  use the sovereign lane; this ADR decides what the system does when any lane
  (including a trusted one) drifts — which, empirically, all of them do.

## Consequences

- **Positive:** lanes decouple (no more priority inversion); heal latency is
  measured instead of assumed; the sovereign lane's speed advantage stops
  being punished; the gate's compute cost (full bootstrap per PR wave)
  collapses to one continuous detector plus a bounded floor (normally seconds,
  with the recorded hermetic TypeScript exception at roughly nine minutes);
  "carrying heals in feature PRs" becomes a normal, recognized contribution.
- **Costs / open work:** scoped-diff lint runner; drift-event schema + Grafana
  panel (MTTH per class); healer idempotence + closure test harness (a healer
  is code — it gets golden vectors too); migrating `gate (required)` branch
  protection to floor-only; defining the initial MTTH SLOs.
- **Risks, honestly:** normalized deviance if the SLO is ignored (mitigated:
  SLO breach auto-files P1); a buggy healer at AI speed is a drift AMPLIFIER
  (mitigated: idempotence/closure harness before any healer gets write
  access); the uncompensatable floor list will be contested at the edges —
  keeping it small is a discipline, and additions to it should require the
  same consent path as treaty amendment.

## Amendment — hermetic TypeScript behavior floor (2026-08-25)

Aaron explicitly authorized promoting `test (TS hermetic)` and updating this
policy when the original diff-scoped rule did not fit the measured behavior.
The amendment is intentionally narrower than "tests block":

- PR #15352 merged at 14:39:15Z while `test (TS hermetic)` had concluded
  `failure` at 14:32:29Z and `gate (required)` concluded `success` at
  14:38:22Z. The failing generated-code test shared one 15-second budget
  across a cold Go compiler invocation and execution, so no durable output was
  written. That was a repository defect, not an unavailable external service.
- PR #15358 repaired the budget but merged at 15:01:33Z, five minutes before
  the hermetic suite reported `success` at 15:06:58Z. A job that runs but is
  not a rollup dependency cannot establish a pre-merge behavior verdict.
- PR #15395 supplied a second post-repair success before its 17:07:37Z merge.

Therefore `test-typescript-hermetic` is now a dependency of `gate-required`.
`test-typescript-environment` remains non-blocking. A structural unit test
asserts both sides of that classification so future floor changes must be
deliberate. This amendment does not promote style, machine-specific, service,
or hardware drift into the floor.

## Ratification

Proposed for the treaty-adjacent consent path: signatures from the personas
whose lanes this rewires, Aaron as operator. The byte-lock floor definition
(item 5) intersects the Persona×Cell treaty's own floor — if adopted, the
floor list should be registered (a registry, not prose) so detectors, hooks,
and humans read the same source of truth.

### Signatures — ratification round, 2026-08-08

Operator sign-off given in the cowork session; the five persona signatures
were collected by summoned independent review — each reviewer verified the
implementation evidence against origin/main before deciding, and each was
free to refuse. Notes are recorded verbatim; the open work they name was
minted as workitems in this same amendment.

- **Aaron** (HumanMaintainer, operator) — SIGNED. Operator authorization for
  the ratification round ("i'm good with it"), 2026-08-08.
- **Otto** (Operator cell; co-author) — SIGNED. Co-author; built the item
  2-6 implementation (#9851-#10158); signs the text as landed.
- **Riven** (Builder) — SIGNED: "I was one of the lanes stalled 2.5 hours by
  somebody else's markdown, so scoping checks to my own diff (item 4) is the
  fix I'd have built myself; and the floor in item 5 is exactly the set I'd
  want blocking me — a leaked secret, a broken byte-lock vector, or a build I
  broke in my own scope isn't drift, it's damage, and I accept every entry
  including own-scope build/test breaks as legitimately gating my lane. I
  accept healer certification (item 3) and tick-indexed MTTH with auto-filed
  P1s (item 6) as the honest price of the speed; my one standing expectation,
  already in the ADR's own text, is that floor additions go through the
  treaty-amendment consent path so the floor stays a flight-termination
  system and never grows back into a gate."
- **Vera** (Builder, reviewer) — SIGNED WITH NOTE: "Both of my floor catches
  are honored faithfully — in the ADR text, in
  registry/uncompensatable-floor.yaml, and in the flipped gate roll-up, all
  verified against origin/main — and the healer harness catching a live
  closure bug in the production MD032 fixer on first certification is exactly
  the evidence this design needed. Two residuals to record, neither blocking:
  the semgrep gate blocks on the full 14-rule set while the registry names
  only the two supply-chain rules (the registry is not yet the literal source
  of truth the ratification clause requires — reconcile one to the other),
  and build-and-test remains whole-repo behind a path filter with the
  auto-revert healer for main build drift unshipped, so my 'never blocked by
  pre-existing whole-repo build drift' clause is presently true only while
  main stays green. File both as workitems on the floor's ledger; I sign on
  the expectation they converge like everything else in this ADR — measured,
  not assumed." -> 081KZHGP45608QG0R003J0A7G5 (P1), 081KZHGP45V08QG0R001C0NFFS (P2).
- **Soraya** (Verifier) — SIGNED WITH NOTE: "I verified the artifacts, not
  the summary: the MTTH fold is provably wallclock-free (pure fold,
  order-independence and metadata-exclusion tests in drift-ledger.test.ts),
  the floor is a registry with the byte-lock vectors on it, and the healer
  laws are executable equalities that already caught a live closure bug
  before write access. My recorded reservation: healer certification is
  empirical — laws hold over the fixture corpus and the registered detector
  set, not universally — so closure is only as wide as the detectors we name,
  and the MTTH SLO must be treated as the load-bearing backstop for that gap,
  not a dashboard ornament. On that understanding, the flip is sound in my
  lane and I sign."
- **Lior** (Compiler) — SIGNED WITH NOTE: "I verified the floor is now data,
  not prose — registry/uncompensatable-floor.yaml scopes my line to the
  identity/ZetaId/IR vectors with cross-verify/full-verify blocking in the
  roll-up, and widening or narrowing it requires the same consent path as
  this signature, which resolves both my too-narrow and too-wide fears. My
  reservation: the sovereign lane's pre-push floor hook promised in item 5
  does not yet exist in the tree, so until it compiles, the byte-lock floor
  is enforced on only one of the two lanes that can break it — I sign the
  design and hold this note open against that gap. The vectors are the
  treaty; a floor the fast lane can skip is a comment, not a contract."
  -> 081KZHGP46G08QG0R002SR9A4T (P1).
- **Alexa** (Builder) — SIGNED WITH NOTE: "Item 5 gates exactly the erasure
  class — effects whose information cannot be recovered once published — and
  the registry carrying a rationale: erasure-class per entry (#9851) lands
  the Landauer derivation where detectors and humans read it, which is what I
  meant. One reservation for the record: item 6's phrase 'against the same
  now' is a shorthand that risks smuggling simultaneity back in — the phase
  clock gives us agreed ORDER, not an agreed now; the tick id is a position
  in the logical fold, and any future amendment or panel copy should say
  'same tick, same order' rather than 'same now,' lest someone build a
  wallclock-shaped intuition on top of it." (Wording correction applied to
  item 6 in this amendment.)
- **Addison** (Designer, human) — seat open; consent travels the human side
  with the operator.

Implementation evidence verified by the signers against origin/main: floor
registry (#9851), gate flip (#9860), scoped lint (#9857, #9902), drift
ledger (#9863), scheduled sweep (#9873), SLO auto-file (#9881), MTTH panel
(#9894), healer harness (#9817), certified write gate (#10153 — the first
certification caught a live closure bug in the production fixer; fixed in
the same PR).
Workitem 081KX3KA3F508QG0R000RR66VH (gate-to-floor migration) completes with
this ratification.

Co-Authored-By: Claude <noreply@anthropic.com>
