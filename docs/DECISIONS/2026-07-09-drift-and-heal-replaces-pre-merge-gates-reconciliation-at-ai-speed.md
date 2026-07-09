# ADR: Drift-and-Heal Replaces Pre-Merge Gates — Reconciliation at AI Speed

Date: 2026-07-09
Status: Proposed
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

4. **PR checks scope to the diff.** A PR reports drift only in files it
   touches. Whole-repo state never blocks an unrelated lane again. A PR that
   heals adjacent drift is celebrated, not required.

5. **The floor that remains gated — the uncompensatable class.** The
   smart-cascading-teardown design (2026-06-21) already names it: the
   genuinely-G-set residual, effects no saga can compensate. Pre-merge (or
   pre-push, in the sovereign lane's client hook) blocking remains ONLY for:
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
     unrelated lanes).

   This is the flight termination system. It is small, it is fast (no full
   toolchain bootstrap — seconds, not minutes), and it is the only check
   allowed to say "no" instead of "converging."

6. **Drift gets an SLO instead of a moral.** Red/green on main is replaced by
   MTTH (mean time to heal) per drift class, published on the dashboard. The
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
  collapses to one continuous detector plus a seconds-fast floor check;
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

## Ratification

Proposed for the treaty-adjacent consent path: signatures from the personas
whose lanes this rewires, Aaron as operator. The byte-lock floor definition
(item 5) intersects the Persona×Cell treaty's own floor — if adopted, the
floor list should be registered (a registry, not prose) so detectors, hooks,
and humans read the same source of truth.

Co-Authored-By: Claude <noreply@anthropic.com>
