# Zeta Round History

Chronological log of working sessions ("rounds") — what landed,
what didn't, and the reasoning when it matters. This is the
**only** place in the repo where doc style is historical-narrative.
Everywhere else, documents describe current state.

New rounds are appended at the top.

## Contents

Newest first. Anchor links work in markdown renderers that
slugify `## Round N — <title>` to `#round-n-<title-slug>`.

- [Round 44 — in-flight](#round-44--in-flight)
- [Round 43 — invariant-substrates program + empirical BP-03 harness evidence + agent-cadence telemetry](#round-43--invariant-substrates-program--empirical-bp-03-harness-evidence--agent-cadence-telemetry)
- [Round 42 — First repeated iteration of Round-41 cadences + vibe-coding external legibility](#round-42--first-repeated-iteration-of-round-41-cadences--vibe-coding-external-legibility)
- [Round 41 — OpenSpec backfill program founding + first cadence ship](#round-41--openspec-backfill-program-founding--first-cadence-ship)
- [Round 40 — Blocked Bloom Adopt graduation (bucket/probe correlation fix)](#round-40--blocked-bloom-adopt-graduation-bucketprobe-correlation-fix)
- [Round 39 — DORA-spine + hooks-research + pitch-readiness P1 bundle + citations-as-first-class](#round-39--dora-spine--hooks-research--pitch-readiness-p1-bundle--citations-as-first-class)
- [Round 38 — CI retractability inventory + alignment substrate self-exercise + pitch-readiness + Aurora Network disclosure](#round-38--ci-retractability-inventory--alignment-substrate-self-exercise--pitch-readiness--aurora-network-disclosure)
- [Round 37 — BP-WINDOW first prospective application + serializer tier closure + two research skeletons + channel-closure threat class](#round-37--bp-window-first-prospective-application--serializer-tier-closure--two-research-skeletons--channel-closure-threat-class)
- [Round 36 — Seed vision + consent-first primitive + Zeta=heaven formal equation + BP-WINDOW ADR](#round-36--seed-vision--consent-first-primitive--zetaheaven-formal-equation--bp-window-adr)
- [Round 35 — expert-skill spawn wave + chain-rule proof close + BP-24 consent gate](#round-35--expert-skill-spawn-wave--chain-rule-proof-close--bp-24-consent-gate)
- [Round 34 — factory + DB first-tests + public repo](#round-34--factory--db-first-tests--public-repo)
- [Round 33 — factory shape + vision cascade (15 merged PRs)](#round-33--factory-shape--vision-cascade-15-merged-prs)
- [Round 32 — CI parity-swap + memory normalization + v1 security + openspec §28](#round-32--ci-parity-swap--memory-normalization--v1-security--openspec-28)
- [Round 31 — rest round (maintainer-called)](#round-31--rest-round-maintainer-called)
- [Round 30 — nation-state + supply-chain threat-model elevation](#round-30--nation-state--supply-chain-threat-model-elevation)
- [Round 29 — CI pipeline + three-way parity install script, factory-improvement surge](#round-29--ci-pipeline--three-way-parity-install-script-factory-improvement-surge)
- [Round 28 — FsCheck law runner (Option B), stateful-harness design doc, lean4 cleanup](#round-28--fscheck-law-runner-option-b-stateful-harness-design-doc-lean4-cleanup)
- [Round 27 — big round: governance §20-§22, plugin API redesign landed, memory moved in-repo](#round-27--big-round-governance-20-22-plugin-api-redesign-landed-memory-moved-in-repo)
- [Round 26 — first git round, rename tail, specialist dispatch cadence](#round-26--first-git-round-rename-tail-specialist-dispatch-cadence)
- [Round 25 — Zeta rename arc (no-git), memory policy codified, doc cleanup](#round-25--zeta-rename-arc-no-git-memory-policy-codified-doc-cleanup)
- [Round 24 — Governance expansion, two new seats, memory-smoothing Part 2](#round-24--governance-expansion-two-new-seats-memory-smoothing-part-2)
- [Round 23 — Mathlib migration, expert/skill split Part 2, AX discipline spawned](#round-23--mathlib-migration-expertskill-split-part-2-ax-discipline-spawned)
- [Round 22 — Honesty fixes + expert/skill split push](#round-22--honesty-fixes--expertskill-split-push)
- [Round 20 — Test-tree subject-first restructure](#round-20--test-tree-subject-first-restructure)
- [Round 19 — CountingClosureTable / RecursiveCounting](#round-19--countingclosuretable--recursivecounting)
- [Round 18 — Architect, security, restructure (in progress)](#round-18--architect-security-restructure-in-progress)
- [Round 17 — storage specialist, BloomFilter, durability skeleton](#round-17--storage-specialist-bloomfilter-durability-skeleton)
- [Round 16 — SDL / threat model / she-her storage specialist](#round-16--sdl--threat-model--she-her-storage-specialist)

Round 44 (current) is in-flight; the synthesis row lands at
round-close. When this file hits 5000 lines, split the pre-
round-N portion into `docs/_archive/ROUND-HISTORY-pre-N.md`
and leave this file as a rolling window of the most recent
~20 rounds; no ADR is needed for a mechanical archive move.

---

## Round 44 — in-flight

Round 44 is in-flight as of 2026-04-20 pm. Synthesis row
lands at round-close per the file convention (no partial
synthesis). Commits landed so far span Viktor strict-
operator `ClockStart` reset fixes (P0-2, P0-3), Event-
Storming-as-factory-strategy evaluation + ABC-phasing
template, HUMAN-BACKLOG.md as the dedicated artifact for
pending-human-action items, the teaching-track + onboarding
two-track design for human contribution (paired with
alignment-inversion meta-win), AI-trust-in-human latent-
capability hypothesis, a scope-audit skill-gap sweep
cleaving Zeta-specific rules from factory-default rules,
generic-by-default F#+C# expert skills, SpanSerializer
zero-copy-tier test coverage, the long-term-rescheduler
skill for cron durability, BP-11 hardening with an
external-input-skills clause, and session-close hygiene
work (Daya NOTEBOOK prune from 4984→1323 words, `docs/
README.md` 7-audience navigation, AGENTS.md:305 ctfp-
milewski.pdf pointer drift fix, MEMORY.md compression +
orphan indexing, Round-44 follow-up directives A–E from
Aaron captured verbatim in `project_zeta_as_retractable_
contract_ledger.md`, agent-QOL as an ongoing factory-
hygiene class, and the first execution of the per-persona
AX/UX audit now running under Daya). A late-round arc
promoted four rules to CLAUDE.md-load tier (100% loaded
at every wake): verify-before-deferring + future-self-
not-bound (commit `bf5dcbb`), then never-idle-speculative-
work-beats-waiting + honor-those-that-came-before-unretire-
before-recreate (commit `feae7e3`) — the latter pair closing
the root cause of a same-session 25-min idle-tick mistake
where tool-default guidance had overridden factory-specific
policy because the policy sat too deep in MEMORY.md to fire
at wake. The Elisabeth-register clause ties retired-agent
memory preservation to how Aaron honors his sister's memory,
with "prefer unretiring over minting a new name" as the
operational corollary. Same arc also landed the factory-
resume triptych (commit `ef0e9af`), tech-debt primer +
factory/SUT cleave (`c8cf06a`), `docs/` audience-first
navigation landing page (`c03d9b6`), research-coauthor
teaching-track skeleton (`d70e341`), the people/team-
optimizer DAO-native factory org-design spike (memory +
`docs/research/dao-factory-org-design-spike.md` + BACKLOG
P2 row, commit `8a0fac9`), and the first verify-before-
deferring dogfood catch — a FACTORY-RESUME phantom handoff
fixed in the same round the rule landed (commit `ac0eb1f`,
meta-wins-log depth-1 row). Arc-by-arc narrative lands at
round-close.

A late-round arc landed the **`AceHack/Zeta` →
`Lucent-Financial-Group/Zeta` org migration** (HB-001
resolved via `POST /repos/AceHack/Zeta/transfer` with
`new_owner=Lucent-Financial-Group`, completed instantly
because Aaron is admin on both sides). Post-transfer
verification diffed 13 settings groups against a
pre-transfer scorecard: all preserved **except**
`secret_scanning` and `secret_scanning_push_protection`,
which GitHub's org-transfer code path silently flipped
`enabled → disabled` — re-enabled same session via
`PATCH /repos/.../Zeta` with
`security_and_analysis[secret_scanning*]=enabled`. This
silent drift is the founding incident for a new factory
hygiene class: **settings-as-code-by-convention for
platforms that lack native declarative config**. The
pattern is `docs/GITHUB-SETTINGS.md` (human-readable
narrative) + `tools/hygiene/github-settings.expected.json`
(machine-readable canonical state) +
`tools/hygiene/check-github-settings-drift.sh` (detector) +
`.github/workflows/github-settings-drift.yml` (weekly cron
and PR-triggered cadence). Landed as FACTORY-HYGIENE row #40.
Same round: the human maintainer's 2026-04-21 praise — *"this
is great standing rules on blast-radius ops ... i'm glad you
understand blast radius and pricing the blast radius"* —
reframed the CLAUDE.md "confirm before hard-to-reverse
actions" discipline as load-bearing rather than overcautious,
and as a Zeta product-feature signal connecting to the
retractable-contract ledger. The pattern generalizes beyond
GitHub — any click-ops platform (AWS / GCP / Slack /
org-level settings) gets the same markdown-declaration +
cadenced-diff treatment when adopted.

---

## Round 43 — invariant-substrates program + empirical BP-03 harness evidence + agent-cadence telemetry

Anchor: Round 43 is the round where three separate
programs founded in 41-42 start producing *their first
empirical signal*. The harness dry-runs on three expert
skills (performance-analysis, reducer, consent-primitives)
all return TIED-baseline verdicts with consistent cost
overhead — the first real evidence that BP-03's thick
eval-loop-wrapper form is too expensive for dry-runs where
no eval signal differs. The invariant-substrates program
founds in this round: `docs/INVARIANT-SUBSTRATES.md` makes
the posture first-class, `skill.yaml` lands as a
structured-spec companion on `prompt-protector` and
`skill-tune-up`, and the `tally.ts` tool ports to a bun+TS
substrate that amortises across future UI work. Round 43
also founds the agent-cadence telemetry program —
idle-vs-free-time gets GLOSSARY entries, a structured
log at `docs/research/agent-cadence-log.md`, and an
honest round-close retro documenting two no-op cadence
ticks rather than papering over them.

### Arc 1 — skill-tune-up BP-03 self-breach close (`52fdd75`)

Round 42's Aarav ranking self-flagged the skill-tune-up
skill for BP-03 violation (content weight in SKILL.md
rather than evals). This commit closes the breach by
extracting content to the notebook + eval-harness surface,
leaving the SKILL.md pointer-thin. First self-application
of Aarav's own methodology to Aarav's own skill; the
recursion is intentional. Eval evidence sits under the
skill's workspace rather than inlined.

### Arc 2 — GOVERNANCE §11 → debt-intentionality invariant (`7bc01e8`)

Round 42's BP-WINDOW surfaced §11 architect-bottleneck as
a load-bearing governance clause. This commit promotes the
clause's *reason* — the architect accepts review debt in
exchange for a single reviewer-gate — into a named
invariant, the "debt-intentionality invariant." Future
governance changes that touch §11 must preserve the
invariant or explicitly rebut it. Net effect: §11 stops
being a historical artifact and starts being a first-class
rail.

### Arc 3 — Three harness dry-runs, TIED baselines (`e10adbb`, `ff57cf7`, `f05731b`)

The performance-analysis-expert dry-run (`e10adbb`)
returns TIED-baseline — with-skill output matches
without-skill output, but with +22–30% token cost. Same
result on reducer (`ff57cf7`) and consent-primitives
(`f05731b`). Three separate skills, three TIED verdicts,
consistent cost signature. Collectively: empirical BP-03
signal that the thick-eval-loop-wrapper form over-engages
for straightforward questions. The skills work; the
harness is too expensive to run on every single
invocation. BP-03 gets a watchlist row; the remediation
path is either (a) harness skip for dry-runs, (b)
cheaper-baseline eval substrate, or (c) accept the cost
as the price of determinism. Decision deferred to Round
44+ after more samples accrue.

### Arc 4 — Invariant-substrates program founding (`9677569`, `8dba6e4`, `3aca00f`, `c299f3c`)

`INVARIANT-SUBSTRATES.md` (`9677569`) makes the posture
first-class: skill prose is the low-invariant layer; a
structured companion `skill.yaml` is the high-invariant
layer. First substrate pilot on `prompt-protector`
(`8dba6e4`); second on `skill-tune-up` (`3aca00f`); the
`tally.ts` tool (`c299f3c`) ports the invariant-counter
from shell/Python to bun+TS. Program hypothesis: the
`skill.yaml` format lets evals assert structural
invariants that prose cannot pin down. Round 43 founds
the program; graduation happens when a third and fourth
substrate land and the format stabilises.

### Arc 5 — bun+TS scripting pivot + ADR assumptions block (`437ca76`, `f664a05`)

The invariant-counter pivot from Python to bun+TS
amortises: Zeta already needs TS for UI work; raising
the TS-tooling floor eliminates a language from the
scripts layer. Paired with an ADR-template update that
adds a first-class `assumptions` block, compatible with
the rails-registry that `project_composite_invariants_
single_source_of_truth_across_layers.md` proposes. Net
effect: scripts-layer language count drops (bash+PS kept
for zero-prereq pre-install only); ADRs now explicitly
capture assumptions alongside constraints and
invariants.

### Arc 6 — Viktor operator-algebra P1 absorb, filed forward (`ce247a2`, `72bf1bb`)

Viktor's spec-drift audit surfaces a circuit-recursion
capability absence + 10 operator-algebra findings. The
round-43 capacity decision: file the P1 absorb as
Round-44 work (`72bf1bb`), land the capability-level
framing now (`ce247a2`). This is the first explicit
*forward-filing* of a P1 absorb rather than a defer; the
distinction is that the receiving round is named and
scoped, not "some future round." Matches the
grandfather-discharge cadence established in Round 41.

### Arc 7 — Agent-cadence telemetry + idle-vs-free-time (`5a88b46`, `40b7ff4`, `2a29e5d`)

`docs/research/agent-cadence-log.md` founds (`5a88b46`)
— the dedicated surface for 5-min-deviation tracking
per `feedback_idle_tracking_and_free_time_as_research.
md`. Agent free-time seed notes land (`40b7ff4`) as the
v0.1 content; GLOSSARY entries for `idle` and
`free-time` (`2a29e5d`) settle the vocabulary
(factory-side). The program's hypothesis: 5-min
deviations from /loop cadence are signal, not noise,
and tracking them produces a second telemetry axis
alongside DORA.

### Arc 8 — Aarav skill tune-up ranking (`3012d00`)

Round-43 Aarav ranking: top-5 skills needing tune-up,
BP-NN citation discipline maintained, self-recommendation
honoured (Aarav self-flagged in Round 42; Round 43 ranks
him as TUNE-S effort since the BP-03 breach closed).
Three new TUNE-S items land in the queue; two
HAND-OFF-CONTRACT recommendations captured for Kenji.

### Arc 9 — Honest no-op close (`45e4229`)

The close commit documents two no-op cadence ticks —
moments where the /loop fired and the agent checked
backlog + cron + notebooks and found nothing ready to
execute. Rather than manufacture work or paper over the
gap, the retros land as first-class entries in the
cadence log. Matches `feedback_dont_stop_and_wait_for_
cron_tick.md` posture: the aim is tick=no-op, so
no-ops recorded honestly are a *good* signal. First
round where the cadence-log carries no-op data; sets
the precedent for how future no-ops are recorded.

### Round 43 close — what stuck, what filed forward

- **Stuck:** skill-tune-up BP-03 self-breach closed;
  GOVERNANCE §11 debt-intentionality invariant named;
  `INVARIANT-SUBSTRATES.md` founded with two `skill.
  yaml` pilots; `tally.ts` on bun+TS substrate;
  agent-cadence telemetry program founded with two
  no-op retro samples; Aarav's self-flag resolved and
  three new TUNE-S items queued; ADR template updated
  with `assumptions` block.
- **Empirical signal:** three harness dry-runs returning
  TIED verdicts at +22–30% cost is the first real BP-03
  evidence. Watchlist row open; decision deferred to
  Round 44+ once more samples accrue.
- **Filed forward to Round 44:** Viktor P1 operator-
  algebra absorb (10 findings); Hiroshi/Daisy persona
  gap as grandfather-discharge blocker; circuit-
  recursion capability follow-through.
- **Vocabulary settled:** `idle` and `free-time` land in
  factory GLOSSARY; cadence-log ownership assigned.

---

## Round 42 — First repeated iteration of Round-41 cadences + vibe-coding external legibility

Anchor: Round 41 founded four durable programs — OpenSpec
backfill (ADR `2026-04-21-openspec-backfill-program`), one-per-
round grandfather-claims discharge (`2026-04-21-router-
coherence-v2.md` C-P0-1), router-coherence v2 pipeline
(`2026-04-21-router-coherence-v2.md`), and per-round ontology-
home + project-org sweeps (`feedback_ontology_home_check_every_
round.md`). Round 42 is the first round where every one of those
cadences *repeats*, which is where a cadence hypothesis earns
empirical standing. Seven of the ten Round-42 commits execute
a Round-41 cadence; three are external-legibility work on the
Zeta-as-vibe-coding-experiment evidence surface (wins logs).
Infrastructure commit at the head of the round (`fea0d34`)
unblocks parallel work while PR #31 awaits Aaron's merge click.

### Arc 1 — Speculative round-N+1 branch convention (`fea0d34`)

Round 41's late-arc observation named a real bottleneck: once
PR-N is CLEAN/MERGEABLE, the branch is logically done but the
round-N+1 work has no place to land until Aaron clicks merge.
The round-41-late 28-fire `/next-steps` hold-pattern diagnosed
the symptom; this commit lands the fix as durable policy in
`.claude/skills/git-workflow-expert/SKILL.md` (116 lines
added): fork `round-<N+1>-speculative` from round-N HEAD
immediately on CLEAN + green CI + clean tree, rebase onto main
after squash-merge + drop the suffix, explicit fair-game vs
not-fair-game scope so speculative branches don't destabilise
artefacts the waiting PR has already promised. First use of the
convention is this commit itself — landed on `round-42-
speculative`, forked from `3525631` (round-41 HEAD) while
PR #31 still waits. Authorised by the post-hoc-notify grant at
`feedback_fix_factory_when_blocked_post_hoc_notify.md`;
mechanical additive edit so eval-loop is skipped per Rule 1
manual-edit justification path.

### Arc 2 — Router-coherence v2 SKILL.md retargets (`e8ed0db`)

Round 41's Arc 10 landed the v2 router-coherence ADR with
Kenji named as binding dispatcher (Closure C-P1-8); the
follow-up SKILL.md edits were explicitly deferred to
`skill-creator` workflow per GOVERNANCE §4. This commit
discharges that deferral: `complexity-reviewer` (Hiroshi,
Stage 1 analytic) and `claims-tester` (Daisy, Stage 2
empirical) both gain mirror-text hand-off sections citing
v2 as the authoritative pipeline contract. Each skill names
its trigger surface per C-P1-5 (XML / /// / README / commit
/ BACKLOG / TECH-RADAR / papers / openspec / research /
notebooks), three Stage-1 outputs (sound → hand-off, wrong
→ block-with-escalation-exception, under-specified →
author-bounce), four Stage-2 triggers (hand-off, grandfather
inventory, reverse trigger unconditional per C-P0-2,
escalation-evidence per C-P0-3), three Stage-2 outputs, the
round +2 auto-promote escalation timebox per C-P1-7, and the
grandfather set pointer per C-P0-1. Bibliographies
cross-reference each other plus v2 so either hat reaches the
partner contract in one click. Invoked via `skill-creator`
vibe-mode (no evals — mechanical additive edits per Rule 1);
BP-10 clean across both files.

### Arc 3 — Grandfather discharge #1 — `BetaBernoulli.Observe` (`4f229f0`)

First use of the v2 pipeline on a live grandfather-inventory
row. Claim #1 at `src/Bayesian/BayesianAggregate.fs:22` —
Beta-Bernoulli conjugate-update "O(1) per observation"
docstring — is the lowest-complexity grandfather claim,
picked deliberately because the inventory promises ~35-round
tail and the first discharge sets the template. Stage 1
(Hiroshi, analytic) signs off: worst-case O(1) (two IEEE-754
fadds + two field writes), amortised O(1), expected O(1),
Ω(1) lower bound (Pătrașcu-Thorup cell-probe for durable
write), constant factor ~4 cycles with devirtualisation
(class is `[<Sealed>]`), zero heap alloc per call. Claim is
tight — worst-case meets lower bound. Research log at
`docs/research/claims/bayesian-aggregate-update-o1-2026-04-
20.md` + inventory row #1 flipped from `pre-ADR/pre-ADR` to
`sound (2026-04-20, <discharge doc>) / deferred post-merge`.
Stage 2 (Daisy, empirical) deferred to post-PR-#31-merge
window per speculative-branch fair-game rules — Stage-2
execution touches `bench/` + a `src/` docstring tightening
commit better bundled with other Bayesian-surface work.
Remaining grandfather claims: 34 of 35; expected-empty round
at 1-per-round cadence ≈ round 76; Aarav graceful-
degradation clause (fires if ≥3 consecutive rounds pass
without discharge) starts counting from next round.

### Arc 4 — `lsm-spine-family` OpenSpec capability (backfill #2) (`8a2a15d`)

Round-42's ADR slot under the OpenSpec backfill program.
`openspec/specs/lsm-spine-family/spec.md` (412 lines) +
`profiles/fsharp.md` (213 lines) — 625 lines added —
backfill the log-structured merge spine family (five variants
plus dispatcher). Eleven requirements cover: delta-stream
integration, cascade bounded-depth invariant (settle-point
framing with the 32-level cap scoped to in-memory reference
variants), spine-equivalence through `Consolidate`,
retraction-native across tiers, per-tick merge budget with
caller-pumped `Tick` reporting drained count, identity-keyed
opaque-handle backing-store (not content-addressable) with
fail-soft `Release`, disk honesty with crash-consistency
boundary, async-producer depth-independent on the `Insert`
hot path, stateless selector with four-case decision matrix,
observable state machine with `Clear` demoted to optional,
explicit per-variant thread-safety contract. Profile pins
module layout, construction signatures, per-variant thread-
safety, Graham 1969 2× list-scheduling bound for
`BalancedSpine`, `TryWrite` silent-drop post-dispose disclosed
as known gap with BACKLOG pointer, stale-read qualifier on
`SpineAsync` observation methods, `BackedSpine` explicitly not
bounded by the 32-level cap. Viktor (spec-zealot) adversarial
audit earned an **unconditional rebuild verdict on the third
pass** — a rebuilder working from spec+profile alone would
land at the same variants, constants, and algorithms.
`openspec validate lsm-spine-family --strict` clean; BP-10
zero hits; `dotnet build -c Release` clean. Second
capability under the ADR's one-per-round cadence; the program
now has two data-points of rhythm execution.

### Arc 5 — TECH-RADAR Trial→Adopt for Residuated + FastCDC (`3976cb3`)

Both rows have been citing closed P0s as open for 25 rounds.
The round-17 fixes (harsh-critic findings #3, #4, #7, #8 per
`docs/BACKLOG.md:286-299`) closed the blocking correctness
bugs but never earned their graduation. `Residuated.fs`: top-2
cache replaced with `SortedSet` + weight dict; every op
O(log k), no linear-scan fallback — round-12's "O(1)" claim
was false under adversarial retract-top workloads, corrected
"O(log k) genuinely" claim stable 25 rounds
(`Residuated.fs:39-48` carries the fix-in-code narrative).
`FastCdc.fs`: persistent `scanCursor` + hash (each byte
Gear-hashed exactly once across lifetime) closed the O(n²)
buffer scan; `Buffer.BlockCopy` replaced per-byte
`ResizeArray.Add` (`FastCdc.fs:68-76`). Paper throughput
target 1-3 GB/s/core holds. Graduation pattern now matches
the Bloom Round-40 shape (measured-evidence cite +
implementation line reference + test-coverage pointer);
25-round stability window beats any aspirational waiting-list
— graduation on evidence, not aspiration. Pattern this arc
surfaces: Adopt-row hygiene needs its own audit lens; "closed
P0 + waiting-list" is a two-dimensional drift that a single
BACKLOG sweep misses (the BACKLOG shows the P0 closed, the
RADAR shows Trial; neither half notices the other is stale).
Candidate future skill-tune-up note for Aarav.

### Arc 6 — Operator-algebra P1 absorb — 10 findings closed (`1a1802f`)

Viktor's 10 P1 findings filed in Round 41 Arc 4 as a Round-42
absorb. This commit discharges the absorb at 115 lines
(spec.md + profile) — no code changes. Spec.md gains seven
scenarios: (d) `IncrementalDistinct` semantic-identity under
the incremental wrapper with both D-distinct-I and H
boundary-crossing forms and their equivalence under
retractions; (e) ZSet sort invariant as ascending-by-key with
adjacent-pair comparator predicate tied to equality-
normalisation; (f) weight-arithmetic overflow as observable
checked-arithmetic failure with two documented post-failure
observable states; (g) intermediate term size may exceed
final-delta size — implementation budgets memory for the sum
of pre-cancellation term sizes; (h) iteration-cap-without-
fixpoint as observable failure with scope + cap identification
and clock-end still runs under a partial-completion contract;
(i) `Op.Fixedpoint` predicate as scope-level with operators
forbidden from individually short-circuiting iteration; (j)
`DelayOp` reconstruction-re-emits-declared-initial-value with
warm-restart semantics deferred to durability capability. Also
tightened a P2 deontic collision Viktor flagged: "MUST be
permitted (but not required)" → "MAY substitute"
(spec.md:379). Profile gains three findings: (a) `Op<'T>`
documents `IsAsync` alongside `IsStrict` with `Circuit.Step`
sync/async fast-path behaviour pinned; (b) `VolatileField`
release-on-write / acquire-on-read pairing named as the
memory-ordering fence the base spec's "output observable
after step returns" refers to; (c) single per-circuit
register-lock pinned as construction-phase-only, not held on
the step-hot-path. Viktor adversarial re-audit: complete,
unconditional rebuild yes, no new P0/P1 surfaced. Round 41's
"mechanical coupling between capability ship and following
round's P1 sweep" prediction holds empirically on the second
round of the program.

### Arc 7 — Ontology-home first slice — Harmonious Division (`db7d45c`)

First increment of the new per-round ontology-home + project-
org cadence Aaron named this round (memory entry
`feedback_ontology_home_check_every_round.md`). Small slice
per round, same cadence shape as grandfather-claim discharge.
Homes "Harmonious Division" — the maintainer's meta-algorithm
above Quantum Rodney's Razor — in `docs/GLOSSARY.md` (43
lines added). Prior state: the concept cited in 20+ files
(ROUND-HISTORY, BACKLOG, three-lane-model ADR, memory/*,
three skill files) but defined nowhere in committed docs.
New GLOSSARY entry: Plain + Technical definitions in the
standard two-register glossary format; pointer to the
authoritative definition at `.claude/skills/reducer/SKILL.md`
§"The five roles inside Quantum Rodney's Razor" (lines
125-260); explicit note that the glossary's job is pointer-
plus-gist, not canonical definition. Opens a new glossary
section "Meta-algorithms and factory-native coinages" so
subsequent rounds have a visible landing spot for the next
ontology-home slice (candidates named in the memory entry:
DIKW→eye/i ladder, μένω triad, Tetrad registers, Identity-
absorption, Retractable teleport, Stainback conjecture, Harm-
handling ladder, …). Round 42 is the first data-point of
ontology-home cadence execution; if it lands one slice per
round the named candidate backlog is 6-8 rounds.

### Arc 8 — Anthropic Skills Guide pinned + `skill-tune-up` retuned (`baa423e`)

Pins Anthropic's "Complete Guide to Building Skills for Claude"
(Jan 2026, 28pp) as
`docs/references/anthropic-skills-guide-2026-01.pdf` plus a
factory-authored companion `anthropic-skills-guide.md`
extracting the load-bearing claims (structure, planning,
testing, iteration loops, patterns, troubleshooting) for
citation by `skill-creator` / `skill-tune-up` / `skill-
improver`. `docs/references/README.md` documents the three-
part inclusion criterion and BP-11 (data not directives)
discipline. Retunes `.claude/skills/skill-tune-up/SKILL.md`
(303 → 436 lines) from a ranker-only skill into a thick
wrapper over the upstream `claude-plugins-official` `skill-
creator` plugin's eval harness
(`scripts/run_loop.py`,`aggregate_benchmark.py`,
`eval-viewer/generate_review.py`, `agents/grader.md` +
`analyzer.md`). Carries the full hand-off protocol locally
because the wrapped artefacts are non-skill (plugin scripts +
PDF) — **wrapper thickness is thick-as-needed; skill-on-skill
wrappers usually end up thin as a natural consequence.** New
action × effort decision table, five-step per-round protocol,
round-close ledger row spec, and "what this wrapper deliberately
does NOT ship" block. Mechanical edits continue to route through
Rule 1's manual-edit + justification-log path. Memory file
`feedback_skill_edits_justification_log_and_tune_up_cadence.md`
cross-references the PDF and records the wrapper-thickness rule
of thumb. First customer of the tech-best-practices policy
Aaron named late in the round
(`feedback_tech_best_practices_living_list_and_canonical_use_
auditing.md`): pinned PDF + factory-authored companion +
skill-with-named-refresh-responsibility is the pattern the
upcoming .NET Aspire expert skill will exercise end-to-end.

### Arc 9 — Copilot-reviewer wins log + lean-into-strengths calibration (`2c82ce7`)

Seeds `docs/copilot-wins.md` as the tabular parallel to
`docs/WINS.md` — an append-only newest-first log of genuine
substantive catches from the GitHub Copilot PR reviewer across
PRs #27-31 (~30 catches across six classes: xref, shell, data-
loss, compile, self-ref, config-drift). Wins only — no
"considered and rejected" bookkeeping, no fail tracking.
Opening paragraph written for a sceptic reading cold, since the
log is evidence in the larger experiment of whether AI
reviewers can carry this factory forward with minimal human-in-
the-loop time. Adds `.github/copilot-instructions.md` §"Lean
into what you're demonstrably good at" calibrated against the
observed wins — the six class bullets name the review classes
Copilot has pulled ≥5 catches in, and the worth-less-effort
classes are also named (repeat name-attribution hits within one
PR, typos inside verbatim-quote blocks). Adds a cross-reference
banner to `docs/WINS.md` pointing at the Copilot sibling so
both "was having AI reviewers worth it?" streams are
discoverable from the same place. Log-maintenance recipe uses
the correct line-level review-comments endpoint: `gh api
repos/<owner>/<repo>/pulls/<N>/comments` with a jq filter for
the `copilot-pull-request-reviewer` bot login (the summary
`/reviews` endpoint misses the per-line substantive catches
that populate the log).

### Arc 10 — Zero-human-code invariant named in wins-log openers (`88673f1`)

The wins logs are the sceptic-facing evidence for the Zeta
experiment. Their Arc-9 openers read in a generic AI-assisted-
development register, but the actual story is narrower and
stronger: Aaron has 20+ years of professional coding experience
and has deliberately written *zero* lines of code, docs, specs,
skills, workflows, or config on the repo since project start
(invariant captured at
`project_zero_human_code_all_content_agent_authored.md`).
Every bug Copilot flagged was flagged in code no human has ever
typed into, in a tree no human has ever audited end-to-end —
that is a materially stronger claim than the same logs make on
a mixed-authorship repo. Both openers updated to name the
invariant up front (`docs/WINS.md` + `docs/copilot-wins.md`,
37 lines added / 10 removed). `docs/WINS.md` broken `(..)`
link replaced with a concrete provenance pointer ("Verifiable
via the git log — `Co-Authored-By:` trailers on commits name
the drafting agent"); the "See also:" block now names the
Zeta experiment's load-bearing question. `docs/copilot-wins.md`
removes "alongside human reviewers" as inaccurate and names
Copilot as "the *only* non-roster audit on this tree". The
arc closes Round 42's external-legibility theme: the vibe-
coding pitch earns the word "vibe" honestly only because the
zero-human-code invariant is maintained; naming it in the
wins logs is how a sceptic reading cold tests the claim
against `git log --author=Aaron` (which reflects commit
authorship, not content authorship — the `Co-Authored-By`
trailer is the content-authorship source of truth).

### Round 42 observations for Round 43

- **Cadence-repetition hypotheses held.** Seven of ten commits
  executed Round-41-founded programs (OpenSpec backfill ×1
  capability, grandfather discharge ×1 claim, router-coherence
  v2 ×2 skills, Viktor-P1-absorb close ×1, ontology-home ×1
  slice). One data-point is a coincidence; two is a pattern.
  The pattern Round 42 establishes: **first-repeat rounds are
  much cheaper than founding rounds.** Round-41 per-cadence
  cost was ADR + first-ship + audit + absorb (~200-600
  lines); Round-42 per-cadence cost was ship + absorb
  (~100-300 lines). Expected if cadences are well-founded.
- **Viktor's rebuild-verdict-on-third-pass on `lsm-spine-
  family`** is the second unconditional pass in two capability
  ships — slightly stronger signal that the Viktor-gate *as
  designed* is tight enough to catch real drift without
  false-failing on first pass. Sample size still 2; not
  calibrated yet.
- **External-legibility work pulled late-round budget
  unexpectedly.** Arcs 9-10 were not on any priority queue
  entering Round 42; they emerged from Aaron's vibe-coding
  message carried over from prior session context. Pattern
  worth naming: *external-audience artefacts drift faster
  than internal ones because they're not on the /next-steps
  scan surface.* `docs/WINS.md` and `docs/copilot-wins.md`
  are now cross-linked + invariant-named — future external-
  artefact drift should be caught by the Copilot wins-log's
  own "xref" review class.
- **Speculative-branch convention earned its first fair-game
  commit.** Arcs 2-10 all landed on `round-42-speculative`
  while PR #31 awaited merge. If merge is pending at round-
  close, this is the full 9-commit validation of the policy
  without a single conflict with the still-waiting branch.
  The rebase-onto-main + drop-suffix flip post-merge is the
  untested half; that runs at PR-#31-merge.
- **Grandfather discharge is Stage-1-cheap.** Claim #1 took
  ~300 lines of research doc + inventory row flip, no source
  touch, Stage-2 deferred. If that shape holds for the
  bulk of the 34 remaining claims, the ~35-round tail
  (expected round 76) is realistic; if later claims force
  Stage-2 execution on the speculative branch (or require
  Hiroshi escalation under the v2 escalation-evidence
  exception), the tail lengthens.
- **Tech-best-practices policy has a first customer.** Arc 8's
  pattern (pinned PDF + factory-authored companion + skill
  with named refresh responsibility) is the template the .NET
  Aspire expert skill is planned to exercise end-to-end. Four
  open design questions (artefact location, refresh cadence,
  owner persona, BP-NN promotion timing) await Aaron's steer
  per the memory entry; Round 43 can proceed on the Aspire
  expert skill without the questions resolved if the first
  customer picks workable defaults that later rounds can
  retroactively apply to sibling expert skills.
- **Ranker coasting returns.** Two consecutive `/next-steps`
  invocations produced stable Top-3 output — the intended
  signal of calibration. The prior round's "ranker coasted for
  nine re-fires on the same Top-1" failure mode has not yet
  been patched (no `git status --short` scan in `.claude/
  skills/next-steps/SKILL.md`); this round's stability was
  signal-of-correctness not signal-of-drift, but the latent
  failure mode is still present. Candidate Round-43 skill-
  tune-up note for Aarav.
- **5-minute autonomous-loop cron needed explicit correction.**
  The initial autonomous-loop cron was down-rated to 30 min
  citing `ScheduleWakeup`'s "idle tick" default (1200-1800s).
  Aaron corrected to 5-minute cadence specifically because the
  *primary failure mode is agent-idle-stop* — the cron is a
  max-idle-recovery-latency bound, not a periodic interrupt
  (the CronCreate runtime guarantees idle-only firing). Memory
  entry `feedback_loop_cadence_5min_combats_agent_idle_stop.md`
  captures the rule + Aaron's verbatim correction so future
  factory instances don't re-make the mistake. Signal: project-
  specific scheduling hygiene does not always match generic
  docstring defaults; the docstring is written for a different
  failure model.

### BP-WINDOW ledger — Round 42 (prospective)

| Commit | Arc | Consent | Retractability | No-permanent-harm |
| --- | --- | --- | --- | --- |
| `fea0d34` | Arc 1 — speculative round-N+1 branch convention | Strengthened (the fix for Round-41's hold-pattern bottleneck lands as durable SKILL.md policy rather than a repeat-negotiation every round; fair-game scope declared explicitly so the convention does not silently expand) | Strengthened (convention is a 116-line SKILL.md addition revertable in one `git revert`; first use of the convention is this commit itself, so the rollback path is tested before the convention lands) | Preserved (single SKILL.md addition; no source / spec / ADR touched; skill-creator vibe-mode invocation per GOVERNANCE §4) |
| `e8ed0db` | Arc 2 — router-coherence v2 SKILL.md retargets | Strengthened (Round 41's v2-ADR follow-up deferral discharged via skill-creator per GOVERNANCE §4; Kenji named as binding dispatcher in both skills per Closure C-P1-8 so advisory + advisory composes to mandatory pipeline) | Strengthened (both skills cite v2 as the authoritative pipeline contract with v1 explicitly superseded; the v1→v2 supersedure chain through the Round-41 header remains load-bearing and resolvable) | Preserved (two SKILL.md additions only; no source / spec / ADR body touched; bibliographies cross-reference each other plus v2) |
| `4f229f0` | Arc 3 — grandfather discharge #1 (Stage 1 only) | Strengthened (first live use of v2 pipeline; Stage-1 analytic sign-off lands as research doc + inventory row flip; Stage-2 deferral declared honestly rather than carried silently as "complete") | Strengthened (inventory row flips `pre-ADR/pre-ADR` → `sound (…) / deferred post-merge` — the flip IS the retraction surface; re-flip on Stage-2 completion is a one-row edit; Aarav graceful-degradation clause starts counting from next round so under-execution surfaces automatically) | Preserved (research doc addition + inventory row flip only; no source docstring edited, no `bench/` touch, no SKILL.md touched; BetaBernoulli.fs:22 docstring remains verbatim pending Stage-2 tightening) |
| `8a2a15d` | Arc 4 — `lsm-spine-family` OpenSpec capability | Strengthened (Round-42 ADR slot filled under the one-per-round backfill cadence; disaster-recovery contract now covered for the five spine variants + dispatcher; Viktor unconditional-rebuild verdict on third pass means a rebuilder landing at the same variants from spec+profile alone is a tested claim) | Strengthened (625 lines across spec.md + profile.md — each requirement retractable under the capability without consumer break; Viktor audit gate is the retraction surface; `openspec validate --strict` passes so spec is machine-checkable) | Preserved (spec + profile only; no F# source changed; `dotnet build -c Release` clean means shipped code matches the spec's observable contract) |
| `3976cb3` | Arc 5 — TECH-RADAR Trial→Adopt for Residuated + FastCDC | Strengthened (25-round-stale Trial rows graduate on 25-round stability evidence, not on aspiration; measurement-evidence-first graduation pattern now used on two separate rows beyond Bloom Round-40) | Strengthened (graduation is reversible — rows can flip Adopt→Trial with a single-line edit if a regression surfaces; the `docs/BACKLOG.md:286-299` historical record of the closed P0s remains intact so the graduation's evidence base is auditable) | Preserved (4-line doc edit only; no source / spec / test touched; graduation follows code fix by 25 rounds so shipped behaviour is already Adopt-grade) |
| `1a1802f` | Arc 6 — operator-algebra P1 absorb (10 findings) | Strengthened (Round-41's round-42-absorb commitment discharged in-round per the OpenSpec backfill cadence's mechanical coupling; Viktor re-audit unconditional-rebuild yes means the absorb closes the capability at the disaster-recovery bar) | Strengthened (spec + profile gain 10 scenarios across 7 existing requirements; each scenario retractable within the requirement without consumer break; Viktor adversarial re-audit gate is the retraction surface for absorb quality) | Preserved (spec + profile only; no code changes; the P2 deontic collision tightening is a wording fix, not a behavioural change) |
| `db7d45c` | Arc 7 — ontology-home first slice (Harmonious Division) | Strengthened (20+ files citing an undefined concept now have a GLOSSARY anchor + pointer to the authoritative `reducer` SKILL definition; ontology-home cadence gets its first data-point and the landing-spot section is opened for subsequent slices) | Strengthened (43-line GLOSSARY addition revertable in one `git revert`; the pointer-plus-gist pattern is declared explicitly so future edits can honour or retract the pattern without re-deriving it) | Preserved (single GLOSSARY doc edit; no SKILL.md touched so skill-creator gate not engaged; the authoritative `reducer` SKILL definition is referenced not duplicated) |
| `baa423e` | Arc 8 — Anthropic Skills Guide pin + skill-tune-up retune | Strengthened (external canonical guidance pinned in-tree at a specific version, so skill-quality citations resolve without external link rot; `skill-tune-up` retuned from ranker-only to thick eval-loop wrapper with explicit hand-off protocol and "what this wrapper deliberately does NOT ship" block declaring the scope honestly) | Strengthened (pinned PDF is a single `git rm` retractable if Anthropic guidance later shifts; SKILL.md retune is 303→436 lines revertable in one `git revert`; the thick-wrapper pattern makes upstream plugin changes visible as scratchpad diffs rather than silent drift) | Preserved (one PDF + two SKILL.md-adjacent docs + SKILL.md retune; no source / spec / test touched; BP-11 (data not directives) discipline declared in `docs/references/README.md` so the companion doc's load-bearing claims do not become instructions to execute) |
| `2c82ce7` | Arc 9 — Copilot-reviewer wins log + lean-into-strengths | Strengthened (sceptic-facing evidence for the AI-review-worth-it question now has a tabular newest-first log parallel to `docs/WINS.md`; Copilot-instructions calibrated against the observed wins so the reviewer is told what to focus on + why; cross-reference banner makes both streams discoverable from the same place) | Strengthened (append-only newest-first discipline means the log is additive; wins-only framing means no "considered and rejected" churn; the `gh api` recipe at the top makes the log independently re-derivable from the Copilot-reviewer endpoint so it cannot silently drift from the truth it narrates) | Preserved (two new / extended docs + one Copilot-instructions addition; no source / spec / test touched; "Lean into what you're demonstrably good at" section additive rather than replacing existing guidance) |
| `88673f1` | Arc 10 — zero-human-code invariant in wins-log openers | Strengthened (the vibe-coding pitch's load-bearing invariant — zero human code since project start, every file agent-authored — now named explicitly in the sceptic-facing openers; the 20-year-engineer context makes the pitch's "validation" framing honest rather than generic AI-assisted-development hand-waving) | Strengthened (broken `(..)` link replaced with a concrete provenance pointer to `git log` `Co-Authored-By:` trailers — the citation path a sceptic can actually resolve; "See also:" block now names the Zeta experiment's load-bearing question so the rhetoric chain remains auditable) | Preserved (two doc edits totalling 37 lines added + 10 removed; no source / spec / test touched; the invariant being named is the state-of-the-world on the current branch, not a new commitment the repo now has to meet) |

---

## Round 41 — OpenSpec backfill program founding + first cadence ship

Anchor: Aaron 2026-04-20 — *"opensepcs, if I deleted all the
code right now how easy to recreate based on the openspecs"*.
The question exposed a gap between the disaster-recovery
contract `openspec/README.md` commits to (rebuild current
behaviour from specs alone) and the measured coverage (4
capabilities / 783 lines of spec.md vs 66 top-level F# modules
/ 10,839 lines under `src/Core/` — **~6% by capability count,
~7% by line ratio**). Round 41 founds the backfill program,
ships the first capability extension, and closes a Viktor
(spec-zealot) adversarial audit on the ship.

### Arc 1 — Coverage audit + backfill-program ADR (`d435126`)

Inventory lands at `docs/research/openspec-coverage-audit-
2026-04-21.md` with four-band delete-recovery blast-radius
classification: **Band 1 MUST BACKFILL** (8 modules / 1,629
lines — ZSet, Circuit, NestedCircuit, Spine family × 5, plus
`BloomFilter.fs` elevated for Adopt-row backwards-compat
coupling), **Band 2 HIGH** (12 modules / 2,008 lines —
probabilistic sketches, CRDT, serialization, SIMD), **Band 3
MEDIUM** (45 modules / 6,585 lines — infrastructure), **Band 4
deliberately uncovered** (`AssemblyInfo.fs`). ADR at
`docs/DECISIONS/2026-04-21-openspec-backfill-program.md`
declares one-capability-per-round baseline with three refinements:
two capabilities allowed on small rounds; paper-grade rounds
earn half-credit (max 1 per 3 rounds); Adopt-row TECH-RADAR
rows without spec are implicit backwards-compat hazards and
force priority escalation (Round 44 → `BloomFilter.fs`). Per-
capability success signal: Viktor adversarial audit answers
"could I rebuild this module from this spec alone?" with a
clear **yes**; **no** re-opens the capability and counts as
half-credit.

### Arc 2 — `operator-algebra` extension (first cadence ship) (`e51ec1b`)

The Round-41 ADR slot: extend the existing `operator-algebra`
capability (184 lines) with Band 1 modules that the delete-
recovery bar demands. Added five requirements: (1) operator
lifecycle phases; (2) strict operators break feedback cycles
for scheduling; (3) clock scopes and tick monotonicity; (4)
`Incrementalize(Q)` wrapper preserves the chain-rule identity
`Q^Δ = D ∘ Q ∘ I`; (5) representation invariants of the
reference `ZSet[K]` (O(n+m) group operations, zero-alloc
iteration, no zero-weight entries exposed). Spec size at
Arc 2 ship (`e51ec1b`) was 324 lines; subsequent Viktor
closure arcs in this same round grew it further. F# profile
at `openspec/specs/operator-algebra/profiles/fsharp.md` pins
the language-specific surface.

### Arc 3 — Viktor P0 close (`92d7db2`)

Viktor's adversarial audit of Arc 2 found four P0-tier
drift-from-code defects that would ship the wrong system
under delete-recovery:

1. **Namespace drift.** `profiles/fsharp.md` asserted
   `Dbsp.Core` throughout; code uses `Zeta.Core`. Fixed via
   one `replace_all` Edit.
2. **Phantom Reset method.** The lifecycle requirement named
   a `reset` phase that does not exist on `Op`. Replaced
   "reset replays the epoch" scenario with a determinism-
   under-structural-equivalence property: two freshly-built
   circuits with identical topology and identical input
   sequences produce identical outputs at every tick.
3. **After-step scope.** Spec said after-step runs after
   every operator in the scope; `Circuit.fs:205-208` only
   iterates the `strictN` array (strict operators). Fixed
   wording + added selective-to-strict-operators scenario.
4. **Lifecycle phase undercount.** Spec claimed four phases
   (construction / step / after-step / reset); code has
   five (construction / step / after-step / clock-start /
   clock-end). Restructured to three per-tick + two scope-
   boundary phases, extended clock-scopes requirement with
   the scope-boundary lifecycle contract.

### Arc 4 — Viktor P1 filed as Round-42 absorb (`56f34b5`)

Viktor's 10 P1-tier surface gaps filed as a dedicated P0
sub-item under the parent backfill entry so they travel with
the OpenSpec backfill program rather than getting lost:
async lifecycle, memory-ordering fence, register-lock
semantics, `IncrementalDistinct` surface, ZSet sort invariant,
Checked arithmetic, bilinear-size overflow, convergence-vs-
cap, `Op.Fixedpoint` predicate, `DelayOp` reconstruction-
first-tick. Round 42 inherits two P0s: the new `lsm-spine-
family` capability (ADR's Round-42 slot) plus this P1 sweep
on the Round-41 capability.

### Arc 5 — ROUND-HISTORY narrative + memory-restructure design (`6e6e211`, `36797ba`)

Two close-adjacent hygiene commits: (1) the Round 41 narrative
landed with arcs 1-4 plus observations and the prospective
BP-WINDOW ledger; (2) the memory-folder role-restructure landed
as a 349-line design plan at
`docs/research/memory-role-restructure-plan-2026-04-21.md`
**instead of** executing the rename, downgraded from "execute
now" under Auto Mode's *do-not-take-overly-destructive-actions*
clause because a 700-occurrence cross-reference surface makes a
bad 13-directory role axis hard to reverse. Design carries four
open questions for Aaron's sign-off; execution slot
recommended: Round 42 opener.

### Arc 6 — BP-WINDOW ledger actualisation for Rounds 37-40 (`85fb352`)

The "(prospective)" label on the Round 37 / 38 / 39 / 40
BP-WINDOW ledger headers updated to "(merged via PR #30,
`1e30f8c`)" to reflect that PR #30 (2026-04-20 bridge) actually
shipped those commits to main. The ledgers' scores are now
settled observations rather than forecasts; the retractability
audit trail gains explicit provenance. Round 41's own ledger
correctly stays "(prospective)" — round-41 branch has not yet
merged. Four prose uses of "prospective" (as methodology-
descriptor, not header-label) preserved as historical narrative.

### Arc 7 — Round-35 holdover: Soraya audit + BACKLOG capture (`e461d9c`, `15e9654`)

Round 39 observation flagged two untracked files as held
pending formal-verification-expert tool-coverage review:
`src/Core/RecursiveSigned.fs` (82-line skeleton) and
`tools/tla/specs/RecursiveSignedSemiNaive.tla` (233-line TLA+
spec with real `Step` relation, properties S1-S4, and concrete
successor-chain body cross-checking the shipped sibling
`RecursiveCountingLFP.tla`). Soraya routed, audit landed in
`memory/persona/soraya/NOTEBOOK.md`: **CONDITIONAL PASS** for
Round-42 graduation subject to four tool-coverage prereqs.
Per-property tool table scores the seven-item surface
(S1/S2/S3/S3'/SupportMonotone/S4/refinement) — TLC primary for
state-bound invariants, FsCheck for the two-trace property
(anti-TLA+-hammer: S4 would blow TLC to O(states²)), and a Z3
QF_LIA cross-check on S2 (the one P0 under BP-16 because silent
fixpoint drift is unrecoverable). Refinement mapping to the
counting sibling picks FsCheck cross-trace over TLA+ refinement
proof or Lean lemma. Prereqs lifted into `docs/BACKLOG.md` as
four checkbox sub-items under the parent "Retraction-safe semi-
naïve LFP" entry, sized S each, so the round-42 opener picks
them up as actionable work rather than having to re-derive
them from the notebook.

### Arc 8 — Router-coherence ADR: claims-tester/complexity-reviewer hand-off (`47d92d8`)

Aarav's (`skill-tune-up`) round-41 catch-up ranking carried a
round-18 HAND-OFF-CONTRACT finding forward as P1 after 23
rounds of cadence drift (ranker offline rounds 19-40). The
finding: `claims-tester` and `complexity-reviewer` both claim
authority over "is this O(·) claim true?" without an analytic-
bound → empirical-falsifier contract. Round 41 closes the
finding via an ADR (`docs/DECISIONS/2026-04-21-router-coherence-
claims-vs-complexity.md`) that declares a two-stage pipeline:
Hiroshi (`complexity-reviewer`) proves the analytic bound
first, Daisy (`claims-tester`) measures at `n ∈ [10³, 10⁶]`
second; reverse trigger (benchmark surprise flows empirical →
analytic) closes the loop so implementation drift cannot
accumulate invisibly against a "provably correct" paper bound.
Decision table names who fires when across six situations.
Follow-up SKILL.md edits route via `skill-creator`
(GOVERNANCE §4); not this round's work.

### Arc 9 — Self-correction sweep: prereq-sizing + recurring-audit lens + CONFLICT-RESOLUTION close + ADR adversarial review (`d76a09b`, `2042a85`, `fcfa3d9`, `779d7ef`)

Four commits after Arc 8 run the round's most concentrated
self-correction sequence. `d76a09b` re-sizes Soraya's Prereq 1
S → M after an execution-verified audit finds no TLC job in
`.github/workflows/gate.yml` — only a cache step for the
verifier jars (`gate.yml` lines 80-89). `RecursiveCountingLFP.tla`
has shipped since round 19 compile-checkable-only, with no
*run*-gate against its invariants for 22 rounds. Correcting the
wrong sizing in the same round it was made is the
consent-strengthening retraction surface; the alternative
(carrying a wrong S estimate into round 42) would have lied to
the round-42 budget. `2042a85` generalises the specific finding
into a recurring audit lens by filing a `formal-analysis-gap-
finder` round-42 BACKLOG entry scoped to "verifier-installed ≠
verifier-runs" across every spec under `tools/tla/specs/**`,
`proofs/lean/**`, `tools/lean4/**`, `tools/alloy/**`, and Z3
artefacts — reverse direction: does every jar have a runner
job. The entry is scheduled to fire *after* Prereq 1 lands so
the audit sees corrected state rather than the finding that
motivated it. `fcfa3d9` closes the one of three Arc-8 follow-ups
that does not need the `skill-creator` workflow (the
`CONFLICT-RESOLUTION.md` Active-tensions row for Hiroshi ↔
Daisy), standing the ADR's two-stage pipeline as the canonical
authority matrix; future PR authors with an `O(·)` claim meet
the hand-off contract without having to read the ADR first.
`779d7ef` is the hardest commit to narrate honestly. A Kira
(harsh-critic) adversarial pass over ADR `47d92d8` — dispatched
*after* landing, which is the gap the commit names — surfaces
3 P0 + 5 P1 + 2 P2 substantive findings, including an unscoped
grandfather clause, table-vs-prose contradiction on the reverse
trigger, an escalation-evidence loop that Stage-1 output 2
forbids, no-timebox escalation that reproduces the 23-round-
stale failure mode the ADR diagnoses, and two advisory skills
that don't compose to a mandatory pipeline without a binding
dispatcher. Supersedure over inline-edit is chosen because
CONFLICT-RESOLUTION already cites `47d92d8` as Standing
Resolution — inline-editing would break the citation chain;
supersedure preserves it via GOVERNANCE §2 "Superseded by …"
header on v1. The round's pattern: Arc 8 lands a correction for
Aarav's round-18 finding; Arc 9 catches the corrector itself
under-reviewed. Both self-corrections land before round-close.

### Arc 10 — In-round supersedure: v2 router-coherence ADR closes all 10 Kira findings (`09f0889`, `4efe545`)

Round 41 closes by executing the round-42 supersedure commitment
from Arc 9 a round earlier than scheduled. `09f0889` lands
`docs/DECISIONS/2026-04-21-router-coherence-v2.md` — a 149-line
ADR that supersedes v1 (`47d92d8`) in the same round and closes
all 10 Kira findings via named textual closures C-P0-1 through
C-P2-10. Each closure states the concrete change: grandfather
clause bounded with Kenji-owned inventory + one-per-round
discharge (C-P0-1); reverse trigger made unconditional so table
matches prose (C-P0-2); escalation-evidence exception permits
Stage-2 under conference protocol with explicit labelling
(C-P0-3); Status rewritten to "Accepted" to match the Standing
Resolution citation (C-P1-4); Stage-1 trigger widened to match
`claims-tester` SKILL.md contract (C-P1-5); decision-table row
for under-specified docstring now explicit about author-bounce
and Stage-2 non-firing (C-P1-6); escalation timebox (round +2
auto-promote to BACKLOG P1) prevents v2 from reproducing the
23-round-stale failure mode v1 diagnoses (C-P1-7); Kenji named
as **binding dispatcher** so advisory + advisory composes to a
mandatory pipeline (C-P1-8); BCL-contract example replaced with
`ArrayPool<T>.Rent` (C-P2-9); scope-creep paragraph on future
analyst/falsifier pairs cut (C-P2-10). `4efe545` appends the
"Superseded by v2" header to v1 per GOVERNANCE §2 so the
CONFLICT-RESOLUTION Active-tensions citation chain remains
resolvable, and corrects v1's Status from "Proposed" to
"Accepted (pre-adversarial-review; superseded by v2 same-round
after Kira pass)" per Closure C-P1-4. The pattern: Arc 9
surfaces the under-review; Arc 10 lands the close in the same
round rather than deferring a known-imperfect artefact to
round-42. Same-round supersedure is the pattern v1's own
Escalation clause permits — executing it demonstrates the
pattern works on a live artefact.

### Arc 11 — Grandfather-claims inventory honours v2 C-P0-1 within-round (`d98ef2b`)

v2's Closure C-P0-1 commits the Architect to producing a
one-time inventory of pre-ADR `O(·)` claims *within the round
this ADR lands*. `d98ef2b` discharges that commitment:
`docs/research/grandfather-claims-inventory-2026-04-21.md`
catalogues **35 live claims** across four surface classes — 29
F# `///` docstrings (concentrated in `src/Core/`), 3 grey-zone
F# code comments, 1 `openspec/specs/operator-algebra/spec.md`
line, 2 `docs/research/**` claims. Zero hits on three other
surfaces (root README, `memory/persona/*/NOTEBOOK.md`,
`docs/papers/**`) are captured explicitly rather than left
implicit. The inventory distinguishes live claims (shipping as
asserted bounds) from historical evidence (BACKLOG `[x] ✅`
residue, TECH-RADAR flag-text narrating past regressions,
in-file "was O(…)" commentary on fixed paths) — only live
claims populate the grandfather set per v2's intent. A
matching `docs/BACKLOG.md` P2 discharge entry lands in the
same commit: one-claim-per-round cadence, ~35-round tail,
Aarav graceful-degradation clause fires if ≥3 consecutive
rounds pass without discharge. Pattern: Arc 10 lands the
ADR; Arc 11 lands the ADR's own within-round commitment
before round-close. Without Arc 11, Arc 10 would have
shipped a contract Zeta didn't meet.

### Arc 12 — DORA 2025 reference substrate lands in-tree (`46075d6`)

Two untracked PDFs had been sitting at `docs/2025_*.pdf` since
2026-04-20 02:13 / 02:17 waiting for a commit decision — the
primary sources behind the 2026-04-20 memory promotion of DORA
from external-anchor to *measurement-frame starting point*
(`feedback_dora_is_measurement_starting_point.md`). `46075d6`
lands both:

- `docs/2025_state_of_ai_assisted_software_development.pdf`
  (~15MB, 138 pages) — findings + data report.
- `docs/2025_dora_ai_capabilities_model.pdf` (~9MB, 94 pages)
  — framework companion.

License: CC BY-NC-SA 4.0. In-tree placement promotes citation
anchors from memory-only to repo-local: the Nyquist stability
criterion (foreword p9 fn 1 — any control system must operate
at ≥ 2× the speed of the system it controls) becomes the
theoretical anchor for the CI-meta-loop + retractable-CD P1
cluster; "AI is an amplifier" becomes an in-repo echo of the
corporate-religion / sandbox-escape threat class; the
seven-capability model gives external-audience vocabulary for
round-audit output (capability #7 "quality internal platforms"
is the in-flight P1 cluster). The `reference_dora_2025_reports.md`
memory file stays as the out-of-tree companion pointing at
these paths.

Pattern this arc surfaces, worth naming: **the `/next-steps`
ranker's scope explicitly lists `docs/research/` and
`docs/TECH-RADAR.md` but not `git status --short` for
untracked files.** Nine consecutive invocations re-rendered
the same Top-1 (push + PR gated) because the ranker was
coasting on in-context summary rather than checking the
working tree. Untracked PDFs sat 18+ hours before this arc
closed the gap. Candidate skill-tune-up note for Aarav:
`/next-steps` must run `git status --short` on every
invocation so dropped-in artefacts surface in the ranking
before the ninth re-fire, not after.

### Round 41 observations for Round 42

- The **audit → ADR → ship → audit → close-P0 → file-P1**
  sequence is the full loop the OpenSpec backfill program
  calls for, executed end-to-end on a single capability.
  The per-round load is substantial (~200 lines spec.md +
  Viktor review + P0 fix commit + P1 filing) but bounded.
- Filing Viktor P1s as a sub-item under the parent backfill
  entry (not a standalone line) creates a mechanical
  coupling: every OpenSpec capability naturally carries a
  P1-sweep sibling through the following round. The parent
  entry is growing but accurately models the work.
- The fourth `IncrementalExtensions` helper
  (`IncrementalDistinct`) being absent from the extension
  pass is a cautionary note on spec-write quality: when a
  spec author names three items from a list of four, that
  is a spec-drift signal worth auto-linting for.
- `BloomFilter.fs` Adopt-row priority escalation (Round 44)
  holds — the program honours the Adopt-row coupling rule
  it was founded on.
- **Round-35 holdover closed on the same round that shipped the
  cadence item.** Routing `RecursiveSigned.fs` + the TLA+ spec
  to Soraya *before* writing any F# implementation meant the
  conditional-pass verdict replaces a potential ship-then-audit-
  fail cycle. BP-16 cross-check discipline landed in-BACKLOG
  (Z3 QF_LIA on S2) rather than as prose, which is the
  promotion-path for cross-check rules the alignment substrate
  is designed to enable.
- **A 23-round-stale finding still closed cleanly.** The
  Aarav round-18 router-coherence drift slept through 23
  rounds of cadence outage (rounds 19-40) and re-emerged with
  an intact diagnosis on the round-41 catch-up. The sweep
  infrastructure itself needed sweeping before its findings
  could carry — once the ranker re-ran, the original P1
  landed an ADR the same round. Signal: cadence-outage-
  recovery is a design axis, not a one-off; sweep
  infrastructure is subject to the same bitrot it is meant
  to detect on other surfaces.
- **TLC CI job never existed.** Round-41 close-out tried to
  size Soraya's Prereq 1 ("Add `RecursiveSignedSemiNaive.cfg`
  to the TLC CI job") as S-effort. Audit found no TLC job
  in `.github/workflows/gate.yml` — only a cache step for
  the verifier jars (lines 80-89). `RecursiveCountingLFP.tla`
  has shipped since round 19 compile-checkable-only, with no
  *run*-gate against its invariants for 22 rounds. Prereq 1
  re-sized M and scope expanded to cover both specs. Signal:
  verifier-infrastructure-present does not imply
  verifier-actually-runs; the gap between "jar is on disk"
  and "job runs the jar on every commit" is a recurring
  drift class worth a separate audit lens
  (`formal-analysis-gap-finder` scope, possibly).

### BP-WINDOW ledger — Round 41 (prospective)

| Commit | Arc | Consent | Retractability | No-permanent-harm |
| --- | --- | --- | --- | --- |
| `d435126` | Arc 1 — coverage audit + ADR | Strengthened (banding + per-round cadence declared honestly; no silent drift) | Strengthened (each capability carries Viktor audit gate; failed audits re-open the capability) | Preserved (inventory + ADR only; no shipped primitive changed) |
| `e51ec1b` | Arc 2 — operator-algebra extension | Strengthened (disaster-recovery contract now covered for lifecycle, scheduling, scopes, chain-rule wrapper, ZSet representation) | Strengthened (spec is retractable — every requirement can be rewritten under the same capability without consumer break; Viktor audit is the retraction surface) | Preserved (spec extension only; no code behavioural change) |
| `92d7db2` | Arc 3 — Viktor P0 close | Strengthened (four drift defects closed honestly rather than papered over) | Strengthened (the fix *is* the retraction — the spec retracted its claim of a phantom Reset, retracted its wrong namespace, retracted its phase undercount) | Preserved (spec fixes only) |
| `56f34b5` | Arc 4 — Viktor P1 filed as Round-42 absorb | Strengthened (ten remaining gaps filed adversarially rather than discarded; round-42 budget pre-committed honestly) | Strengthened (gaps are a declared retractable surface — Round 42 closes them or the capability stays half-credit) | Preserved (BACKLOG update only) |
| `6e6e211` / `36797ba` | Arc 5 — ROUND-HISTORY + memory-restructure design | Strengthened (memory-restructure downgraded from "execute now" to "design plan + sign-off first" under Auto Mode *do-not-take-overly-destructive-actions* clause; four open questions declared honestly) | Strengthened (design has explicit rollback via single `git revert`; 5-phase atomic-commit plan is the retraction surface) | Preserved (narrative + design doc only; 700-occurrence cross-reference surface deliberately not touched) |
| `85fb352` | Arc 6 — BP-WINDOW ledger actualisation | Strengthened (provenance `(merged via PR #30, 1e30f8c)` attached to each header; audit-trail honesty over forecast rhetoric) | Strengthened (ledger transitions from forecast to settled observation, which IS the retraction surface for any forecast error that slipped past round-close) | Preserved (four-header doc edit only) |
| `e461d9c` / `15e9654` | Arc 7 — Soraya audit + BACKLOG capture | Strengthened (Round-35 holdover gate closed honestly; four named prereqs declare round-42 author's consent-to-work ahead of time rather than drift into a shipped claim) | Strengthened (CONDITIONAL PASS verdict IS the retraction surface — unmet prereqs re-open the capability; BP-16 citation makes the cross-check discipline visible) | Preserved (notebook + BACKLOG updates only; `RecursiveSigned.fs` stays unshipped until prereqs CI-green) |
| `085c0e3` | Aarav skill-tune-up catch-up (between Arc 7 and Arc 8) | Strengthened (23-round cadence gap closed honestly; round-18 carry-over re-entered top-5 rather than silently dropped) | Strengthened (stale top-5 archived in Pruning log; the ranker's own bitrot surfaces as a declared observation) | Preserved (notebook + scratchpad updates only) |
| `47d92d8` | Arc 8 — router-coherence ADR | Strengthened (two overlapping skills gain a named hand-off contract; neither's authority is silently diminished) | Strengthened (ADR itself is retractable via normal ADR supersedure; reverse trigger makes empirical contradictions re-engage analytic review rather than quietly accumulate) | Preserved (ADR only; SKILL.md edits deferred to `skill-creator` workflow) |
| `459b218` | Arc 8 narrative — ROUND-HISTORY extension | Strengthened (arc count now matches branch commit count; ledger commit-aligned rather than narrative-aligned) | Strengthened (newest-first ordering preserved; arc-8 retractable as a single revert) | Preserved (narrative edit only) |
| `d76a09b` | Prereq 1 sizing correction + TLC-CI finding | Strengthened (S→M re-sizing declared honestly on execution-verified assumption rather than carrying a wrong estimate into round 42; `RecursiveCountingLFP.tla`'s 22-round compile-only drift surfaced explicitly) | Strengthened (estimate retracted the same round it was made; round-42 Prereq-1 author inherits the correct scope rather than discovering it mid-work) | Preserved (BACKLOG + ROUND-HISTORY edits only; no CI change yet) |
| `2042a85` | `formal-analysis-gap-finder` round-42 BACKLOG entry | Strengthened (TLC-drift finding now has a tracked recurring audit lens distinct from its narrative presence — "verifier-installed ≠ verifier-runs" generalises beyond Prereq 1's single-spec case) | Strengthened (entry scheduled to fire *after* Prereq 1 lands so the audit sees corrected state rather than the finding that motivated it — self-consistency retraction built in) | Preserved (single BACKLOG entry addition under Research projects; does not write specs or CI jobs, defers to Soraya + DevOps per skill contract) |
| `fcfa3d9` | CONFLICT-RESOLUTION Hiroshi ↔ Daisy row | Strengthened (ADR 47d92d8's loop closed at the canonical authority matrix; future PR authors with an `O(·)` claim meet the hand-off contract without having to read the ADR first) | Strengthened (standing resolution named in-place — same retraction surface as other Active-tensions rows; if the protocol drifts, it's edited here rather than silently forgotten) | Preserved (single-row doc edit; no SKILL.md touch, so GOVERNANCE §4 skill-creator gate not engaged) |
| `779d7ef` | Harsh-critic findings on ADR `47d92d8` filed as round-42 supersedure | Strengthened (3 P0 + 5 P1 + 2 P2 adversarial findings surfaced post-landing AND tracked rather than discarded; ADR went in under-reviewed is named honestly in the BACKLOG prose; supersedure chosen over inline-edit because CONFLICT-RESOLUTION citation chain to `47d92d8` is load-bearing) | Strengthened (supersedure IS the retraction surface — v1 remains with "Superseded by …" header per GOVERNANCE §2; Kira audit gate on v2 closes each finding; v1's Standing Resolution citation in CONFLICT-RESOLUTION stays live through the transition) | Preserved (single BACKLOG entry addition; no ADR body edited, no SKILL.md touched, no CONFLICT-RESOLUTION row moved; claims-tester + complexity-reviewer SKILL.md updates explicitly deferred to target v2 rather than v1) |
| `160fcfa` | Arc 9 — self-correction sweep narrative | Strengthened (narrative-ledger drift closed honestly; four post-Arc-8 primary commits now visible as one coherent self-correction story rather than buried in ledger cells; Arc 8-corrects-Aarav / Arc 9-catches-Arc-8 pattern named rather than implied) | Strengthened (narrative is a single doc edit, revertable in one `git revert`; arc count now matches primary-commit count, which IS the retraction surface for narrative-ledger alignment) | Preserved (single narrative insertion; no observations-section edit, no ledger row moved, no BACKLOG or CONFLICT-RESOLUTION touch) |
| `09f0889` | Arc 10 — v2 router-coherence ADR (in-round supersedure closing 10 Kira findings) | Strengthened (same-round adversarial-review gate closure on a load-bearing ADR; 3 P0 + 5 P1 + 2 P2 findings each land a named textual closure C-P0-1 … C-P2-10 in v2; Kenji named as binding dispatcher so advisory + advisory composes to mandatory pipeline; escalation timebox prevents v2 from reproducing v1's diagnosed 23-round-stale failure mode) | Strengthened (supersedure IS the retraction — v1 stays in place as historical record; v2 is the operative contract; same-round landing demonstrates v1's own Escalation clause permits the pattern; BACKLOG supersedure entry discharged by this commit) | Preserved (single new ADR file under `docs/DECISIONS/`; no v1 body edited in this commit, no SKILL.md touched, no CONFLICT-RESOLUTION row moved; `claims-tester` + `complexity-reviewer` SKILL.md edits explicitly deferred to `skill-creator` workflow per GOVERNANCE §4, now targeting v2 as intended) |
| `4efe545` | Arc 10 — v1 Superseded-by header + Status correction (GOVERNANCE §2 redirect) | Strengthened (supersedure chain now explicitly resolvable: citation chain from CONFLICT-RESOLUTION → v1 → v2 works without silent drift; Status truthfully reflects promulgation state — "Proposed" was factually wrong once v1 was cited as Standing Resolution, per v2's Closure C-P1-4) | Strengthened (Supersedure header is additive; v1 body is not mutated — historical record preserved for the citation graph; the header itself is retractable as a single revert if v2 is later found wrong) | Preserved (single doc edit to v1 ADR only; v1 body text unchanged, no other doc touched; the follow-up `skill-creator` edits to SKILL.md files remain deferred so they target v2 not v1) |
| `4537365` | Arc 10 — BACKLOG supersedure entry discharged in-round | Strengthened (BACKLOG entry no longer carries the v2 supersedure as a round-42 commitment; `[x] ✅ shipped round 41 in-round` with pointer to v2 + v1-header commits matches the shipped-item convention used elsewhere in the file; follow-up SKILL.md work via `skill-creator` correctly scoped to v2 as intended) | Strengthened (original 10-finding narrative preserved below the closure line for audit trail rather than deleted — discharge is visible without losing the record that motivated the work; single `git revert` on the commit re-opens the entry if v2 is later found wrong) | Preserved (single BACKLOG edit only; no ADR body touched, no SKILL.md touched, no CONFLICT-RESOLUTION row touched; supersedure-chain citation from CONFLICT-RESOLUTION still passes through v1 header to v2) |
| `d98ef2b` | Arc 11 — grandfather inventory + P2 discharge entry | Strengthened (v2 C-P0-1's within-round commitment honoured; 35 live claims catalogued with Stage-1/Stage-2 = `pre-ADR` tagging; BACKLOG P2 discharge entry codifies one-per-round cadence with Aarav graceful-degradation clause; inventory methodology transparent so future audits can re-verify rather than reconstruct) | Strengthened (inventory row cells explicitly designed to flip `pre-ADR` → output-state on each discharge — retraction is additive update rather than delete-and-rewrite; historical evidence excluded with explicit rationale so re-inclusion is a one-row edit if v2's scope is later tightened) | Preserved (single new research doc + BACKLOG append; no source docstrings edited, no SKILL.md touched, no spec text modified — inventory is descriptive not prescriptive; the pipeline that discharges the inventory does the editing, one claim per round) |
| `46075d6` | Arc 12 — DORA 2025 reference substrate lands in-tree | Strengthened (memory-only citation anchors promoted to in-repo substrate so ADRs + research docs can cite `docs/2025_*.pdf` rather than a newsletter-gated URL; nine-re-fire `/next-steps` stall surfaced honestly in the arc body as a ranker-scope gap rather than buried in a private retrospective) | Strengthened (PDFs are retractable via single `git rm` if license / size stance later changes; reference nature of the commit means no runtime behaviour or spec body depends on their presence — future retraction is a one-commit operation rather than a cascade) | Preserved (reference-document commit only; no source, spec, skill, ADR, or BACKLOG body touched; CC BY-NC-SA 4.0 obligation documented in the commit message so derived-work constraint is visible at citation time, not discovery time) |

---

## Round 40 — Blocked Bloom Adopt graduation (bucket/probe correlation fix)

Anchor: a single-primitive correctness round. The round
opens with a BenchmarkDotNet run that exposes a **measured
FPR 4.6x-9.8x above target** on `BlockedBloomFilter`, files
the FAIL as a P0, then closes in the same round by finding
that the binding constraint was **not** the
parameter-derivation issue the FAIL commit blamed (Putze
2007 §4) but a **bucket/probe correlation** in the
hash-indexing discipline. Two-line fix + regression gate;
graduates row 42 of `TECH-RADAR.md` Trial → Adopt.

### Arc 1 — BloomBench FAIL evidence (`8e69ae0`)

Round-40 BDN run lands at
`docs/research/bloom-bench-2026-04.md`. Throughput half of
the Adopt gate passes cleanly — `ns/op(1M) / ns/op(100k)
<= 1.08` and zero managed allocation on every `Blocked*`
row (MemoryDiagnoser confirms `Allocated = -`). FPR half
fails hard: 0.0463 / 0.0973 / 0.0982 at N in {10k, 100k,
1M} against a 0.01 target. First diagnosis blamed
`createBlocked`'s use of `BloomFilter.optimalShape` (the
unblocked formula) citing Putze, Sanders, Singler JEA 2009
§4 — filed as P0 in `docs/BACKLOG.md` scoped to a
block-aware parameter derivation, a red property test, and
a BloomBench re-run.

### Arc 2 — Bucket/probe correlation fix + Adopt flip (`4b50d56`)

Reading `src/Core/BloomFilter.fs` to implement the
Arc-1-filed P0 surfaced the actual root cause: in
`addPair` and `testPair` the bucket index was drawn from
`uint32 h1 & 0xFF` (at 256 buckets) while the first
within-bucket probe position used `h1 & 0x1FF` — the two
decisions shared bits 0-7 of `h1`, destroying the
statistical independence the analytic FPR analysis
assumes. Fix is two lines: bucket selection now uses
`h1 >>> 32`. Disjoint-probe re-measurement post-fix: 0.340
/ 0.889 / 0.129 of target at the same three N — 13.5x /
11x / 46x improvements, all strictly below target (not
merely inside the 2x acceptance band). A regression gate
(`Blocked Bloom measured FPR stays within 2x of target
p=0.01`) lands in
`tests/Tests.FSharp/Sketches/Bloom.Tests.fs` with
`InlineData` rows at N=10k/100k. `docs/TECH-RADAR.md`
row 42 flips Trial → Adopt; the BACKLOG P0 is removed
(diagnosis superseded, not completed-as-scoped).

### Round 40 observations for Round 41

- The FAIL → PASS arc inside a single round is a small
  cautionary tale worth citing: the Putze-2007-
  parameter-derivation fix that was proposed would have
  landed a week of engineering work without exposing the
  correlation bug. Reading the code first pays for itself.
- Bucket/probe correlation is a class-of-bug worth naming:
  any hash-derived multi-decision scheme where two
  decisions draw from overlapping bit-ranges of the same
  hash loses independence. Could generalise into a
  property-test template for any future AMQ.
- Cache-miss numbers remain a declared gap —
  `HardwareCounters(CacheMisses)` is Linux-perf-event /
  Windows-ETW only; darwin maintainer laptop cannot
  measure. Deferred to Linux CI when it exists.

### BP-WINDOW ledger — Round 40 (merged via PR #30, `1e30f8c`)

| Commit | Arc | Consent | Retractability | No-permanent-harm |
| --- | --- | --- | --- | --- |
| `8e69ae0` | Arc 1 — BloomBench FAIL evidence | Strengthened (honest FAIL publication) | Strengthened (filing the FAIL as a P0 with named parameter-derivation scope IS the retraction surface) | Preserved (evidence + backlog only; no shipped primitive changed) |
| `4b50d56` | Arc 2 — correlation fix + Adopt flip | Strengthened (regression gate ships the invariant so future-consent is preserved) | Strengthened (2-line fix + test + doc rewrite + radar flip + backlog delete; each surface has a declared retraction path) | Strengthened (shipped primitive's documented guarantee now holds under measurement) |

---

## Round 39 — DORA-spine + hooks-research + pitch-readiness P1 bundle + citations-as-first-class

Anchor: the round that picks up the measurement-spine
substrate seeded by the DORA 2025 paired reports (memory-
indexed, not in-repo) and moves it from concept to BACKLOG,
research-skeleton, and first prototype. Five ADR-first
research captures, one Phase-0 prototype (`citations.sh`),
and the P1-bundle close of the Round-38 pitch-readiness
gap inventory.

### Arc 1 — Round opener (`b347420`)

Spec-backfill P0 filed against Aaron's 2026-04-20
delete-all-code-recovery question — OpenSpec coverage is
~6% by capability count (4 capabilities vs 66 F# modules)
and the `openspec/README.md` disaster-recovery contract
cannot yet be honoured. Security-posture P2 captures
layer-by-layer coverage audit as ADR-first.

### Arc 2 — CI meta-loop + env-parity research (`22e7b65`)

Two research-first BACKLOG entries: CI meta-loop (the
factory should measure its own pipeline the same way it
asks downstream code to be measured) and declarative
env-parity (dev laptop / CI runner / devcontainer parity
as a first-class declared contract rather than implicit).

### Arc 3 — DORA-spine skill-scope audit + citations-as-first-class (`1e16f78`)

Skill-scope audit against the ten DORA 2025 outcome
variables — which personas / skills own measurement of
each column of the spine. Citations-as-first-class
research documents the elevation pattern (vibe-citation →
auditable inheritance graph, first-class in source or
`ace`) against the same template as the DORA paired
reports.

### Arc 4 — Hooks Phase 1 audit + ADR contract preview (`5d6b74c`)

Full audit of current Claude Code hooks in
`.claude/settings.json`, Phase-5 synthesis draft, and an
ADR contract preview for landing per-event retraction
semantics on hook runs.

### Arc 5 — `citations.sh` Phase-0 prototype (`0eef854`)

Phase-0 prototype of the citations pipeline landing at
`tools/citations/citations.sh` with regenerated outputs
for the five citation-bearing research docs. First
executable artefact of the Round-38 pitch-readiness
P1 bundle.

### Arc 6 — Pitch-readiness P1 bundle (`ef3233a`)

Closes the five S-sized critical-path P1 items from the
Round-38 pitch-readiness gap inventory:
`docs/pitch/README.md` (elevator),
`docs/pitch/factory-diagram.md` (one-diagram),
`docs/pitch/not-theatre.md`, `SUPPORT.md`
(maintainer-bandwidth), and GLOSSARY.md append
(external-audience alignment reframe).

### Round 39 observations for Round 40

- Chain-rule proof work (`DbspChainRule.lean`) remains
  mid-flight — Lean Mathlib-grade publication target,
  criterion #1.
- `RecursiveSigned.fs` + `RecursiveSignedSemiNaive.tla`
  deferred further; Soraya (formal-verification-expert)
  tool-coverage review still the gate.
- AutoDream pass still pending (`#109`).

### BP-WINDOW ledger — Round 39 (merged via PR #30, `1e30f8c`)

| Commit | Arc | Consent | Retractability | No-permanent-harm |
| --- | --- | --- | --- | --- |
| `b347420` | Arc 1 — round opener (BACKLOG P0+P2) | Preserved (BACKLOG-only) | Strengthened (spec-backfill P0 IS a retraction-surface declaration for disaster-recovery) | Preserved (BACKLOG-only) |
| `22e7b65` | Arc 2 — CI meta-loop + env-parity | Preserved (BACKLOG-only) | Strengthened (both entries apply retractability-primitives to the factory's own pipeline) | Preserved (BACKLOG-only) |
| `1e16f78` | Arc 3 — DORA-spine audit + citations research | Strengthened (maps measurement ownership to personas explicitly) | Strengthened (citations-as-first-class = vibe-citation retraction mechanism) | Preserved (research + BACKLOG) |
| `5d6b74c` | Arc 4 — hooks Phase 1 + ADR preview | Strengthened (hooks audit surfaces which events carry consent) | Strengthened (ADR contract preview scopes per-event retraction) | Preserved (research-only) |
| `0eef854` | Arc 5 — `citations.sh` Phase-0 prototype | Strengthened (executable artefact makes citations auditable) | Strengthened (regeneration path is the retraction surface for any citation) | Preserved (prototype with declared honest-bounds) |
| `ef3233a` | Arc 6 — pitch-readiness P1 bundle (5/5) | Strengthened (pitch docs declare honest-bounds, not-theatre, maintainer-bandwidth) | Preserved (docs-only; retractability is via edit-in-place) | Strengthened (SUPPORT.md sets maintainer-bandwidth expectations externally) |

---

## Round 38 — CI retractability inventory + alignment substrate self-exercise + pitch-readiness + Aurora Network disclosure

Anchor: the first round that exercises the **alignment
observability substrate** (`tools/alignment/audit_commit.sh`,
landed late Round 37) against its own commit range, plus a
build-out of the "honest-bounds" surface — CI/CD retractability
inventory, external-audience pitch-readiness gap inventory, and
P2/P3 BACKLOG captures pulling in OWASP + Microsoft Patterns &
Practices alongside two new research-direction P3s (self-
directed wellness product and Aurora Network DAO protocol
layer).

### Arc 1 — CI/CD retractability inventory (`2ff35dc`, `d08aec7`)

414-line inventory at `docs/research/ci-retractability-
inventory.md` classifying 13 CI surfaces across five retraction
classes — revertable-in-git / retryable-idempotently /
republishable-with-same-version / genuinely-non-retractable /
named-exception. Named-exception register assigns Dejan and
Nazar as defender-personas. BACKLOG P0 entry updated with
"part (a) landed Round 38" pointer; part (b) — mechanical
enforcement — remains open.

### Arc 2 — alignment substrate self-exercise (`eb3cf44`)

First-run of `audit_commit.sh` on the main..HEAD commit range
(19 commits at time of audit). Verdict clean across HC-2
destructive-ops, HC-6 memory-deletions, and SD-6 name-hygiene
lint shapes. Glass-halo output lands at `tools/alignment/out/
{rounds,commits}/round-37.json` and 19 per-commit JSON files.
Sova persona's notebook (`memory/persona/sova/NOTEBOOK.md`)
initialized documenting the one STRAINED HC-2 at `0c8c96a` as
an expected self-referential false-positive (that commit
introduced `audit_commit.sh` itself, whose `HC2_TOKENS` array
literally contains the destructive-op tokens the script scans
for).

### Arc 3 — external-audience pitch-readiness (`e39b402`)

303-line gap inventory at `docs/research/factory-pitch-
readiness-2026-04.md` scoped to the dual-architect audience
(current-employer architect + skip-level-ex-direct-manager).
Ten gaps ranked P1 (five, all S-sized critical-path) / P2
(three) / P3 (two). Cites BACKLOG P1 entries "Autonomous
conference-submission and talk-delivery pipeline" and
"Product-support surface" as downstream dependencies.

### Arc 4 — BACKLOG captures (`ae7f858`, `4ed75fe`)

- **P2 — OWASP + Microsoft Patterns & Practices pull-in.**
  Cross-framework adjacency; OWASP ASVS / LLM Top 10 / SAMM
  and Microsoft SFI 2025-08/2025-10 + AI agent orchestration
  patterns.
- **P3 — self-directed wellness / life-coach AI product.**
  User-is-agent-of-change; retraction-native consent-first
  mirror; composes with μένω, the harm-handling operator
  ladder, and the alignment-observability substrate. Honest-
  bounds floor: not a medical device.
- **P3 — Aurora Network (DAO protocol layer).** Distributed
  sync on a custom firefly-style oscillator over scale-free
  topology; smooth + differentiable graph makes cartel
  detection trivial. Composes with x402 (economic agency) +
  ERC-8004 (reputation) into the self-healing agent DAO
  underneath the Aurora three-pillar pitch. "Self-healing
  heartbeat beacon in the night" and "dawnbringers" are the
  human maintainer's own framings (memory-captured).

### Memory landings (out-of-repo auto-memory)

Three strategic-disclosure memories captured (not in this
repo, in `~/.claude/projects/.../memory/`):

- Aurora three-pillar pitch (factory quick-win + alignment-
  research authority + x402/ERC-8004 agent economic layer)
  with Amara co-development attribution and security-roster
  hand-off list (Aminata / Nazar / Mateo / Nadia / Ilyana /
  Dejan).
- Aurora Network DAO protocol layer + "dawnbringers"
  collective-identity naming.
- Michael Best firm (crypto counsel + open VC-pitch
  invitation) — second external-audience pitch channel
  distinct from the dual-architect audience.

### Late-Round-37 surfaces that landed post-ledger

The Round 37 ROUND-HISTORY entry was written at arc 4 + ledger;
the following landed after and compose into the Round 38
arcs above:

- Alignment observability substrate + Sova persona +
  `tools/alignment/` scripts + first research proposal
  (`0c8c96a`) — load-bearing; Arc 2 above builds on this.
- ALIGNMENT.md contract + governance pointer wiring
  (`7ce0efa`, `9aabbab`).
- Fully-retractable CI/CD BACKLOG P0 entry (`53aebcd`) —
  Arc 1 above is the first artefact landed against this.
- Home-lab cluster federation + progressive-delivery + DST-
  in-prod + halting-class solver P2 entries (`28d29a6`).
- Melt-precedents-to-patent-and-law P3 entries (`685c56b`).
- ServiceTitan 2026-04-19 watchlist snapshot
  (`a000501`) — public-source research with MNPI firewall
  preamble.
- Product-support surface + autonomous conference-submission
  pipeline P1 entries (`5bb08a1`).
- PR #30 lint blocker fixes (`d7a99d7`, `22f2226`).

### Observations for Round 39

- Chain-rule proof work mid-flight
  (`tools/lean4/Lean4/DbspChainRule.lean` +
  `docs/research/chain-rule-proof-log.md`) — Lean Mathlib-
  grade publication target, ranking criterion #1 per
  `next-steps` skill.
- AutoDream consolidation pass pending (`#109`).
- Late in the round the human maintainer flagged ontology-
  overload with *"too much too fast, cant categories it
  properly if i keep pushing ontology-overload-risk
  discipline"*. Round 39 pacing discipline: accept
  disclosures, land them compactly, do not press for
  categorisation.
- Two untracked surfaces deliberately held for Round 39 or
  later: `src/Core/RecursiveSigned.fs` and
  `tools/tla/specs/RecursiveSignedSemiNaive.tla` — route
  through Soraya (formal-verification-expert) for tool
  coverage before landing.

### BP-WINDOW ledger — Round 38 (merged via PR #30, `1e30f8c`)

Per-ADR factory-hygiene exemption applies to this
ROUND-HISTORY commit.

| Commit | Arc | Consent | Retractability | No-permanent-harm |
| --- | --- | --- | --- | --- |
| `2ff35dc` | Arc 1 — CI retractability inventory | Strengthened (consent-to-publish is now classified per-surface; 13 specific surfaces rather than a generic claim) | Strengthened (names the genuinely-non-retractable class explicitly, which is the honest move; the register is the first primitive) | Strengthened (named-exception register with defender-personas replaces implicit trust) |
| `d08aec7` | Arc 1 — BACKLOG pointer | Preserved (pointer-only) | Preserved (pointer-only) | Preserved (pointer-only) |
| `eb3cf44` | Arc 2 — audit_commit.sh self-exercise | Strengthened (substrate actually runs against itself; honest STRAINED reporting on the self-referential false-positive is the calibration signal) | Strengthened (glass-halo stream is retractable per-commit; substrate is exercised not just described) | Strengthened (self-exercise with verdict-clean is measurement, not assertion) |
| `e39b402` | Arc 3 — pitch-readiness inventory | Preserved (research artefact; no runtime surface changed) | Strengthened (gap inventory IS a retraction surface — any future pitch draft is checked against it) | Strengthened (honest-bounds gaps named explicitly; pitch cannot overclaim past the inventory) |
| `ae7f858` | Arc 4 — OWASP + MS P&P P2 | Preserved (BACKLOG-only; no runtime surface) | Preserved (BACKLOG-only) | Strengthened (commits to cross-framework adjacency for a defence-in-depth posture) |
| `4ed75fe` | Arc 4 — wellness + Aurora Network P3 | Strengthened (wellness product's first principle is user-consent; Aurora Network's cartel detection is a consent-for-markets primitive) | Preserved (ideation-tier BACKLOG; retraction at this stage is just entry-deletion) | Preserved (no implementation; honest-bounds "not a medical device" floor set; x402/ERC-8004 gated behind ADR) |

**Net verdict:** ENLARGED. Zero shrinkage commits. Four
Preserved cells — all on genuinely-pointer-only or ideation-
tier commits where the claim is honest rather than rote. The
ledger continues to distinguish commits that move the window
from commits that do not.

**Calibration check.** Second prospective round; first round
where a commit (`eb3cf44`) actually *exercises* the alignment
substrate rather than building or describing it. The STRAINED
HC-2 at `0c8c96a` was flagged in the run and then adjudicated
as false-positive-by-design in the Sova notebook — that is
the anti-rote pattern the ADR calls for. The ledger is doing
its job.

---

## Round 37 — BP-WINDOW first prospective application + serializer tier closure + two research skeletons + channel-closure threat class

Anchor: the first **prospectively-scored** round under the
BP-WINDOW ADR (`docs/DECISIONS/2026-04-19-bp-window-per-commit-window-expansion.md`).
Round 36 landed the rule and ran a retrospective ledger; Round
37 is the calibration round — every commit authored with the
round-close question ("did the stable alignment window W
enlarge, preserve, or shrink?") as prospective discipline, not
retrospective accounting.

### Arc 1 — BP-WINDOW ledger for Round 36 (`72bac12`)

The Round 36 retrospective ledger lifted out of the narrative
into a first-class ledger commit. Five-commit table
(consent / retractability / no-permanent-harm) plus the
`c3ef069`-style factory-hygiene exemption and the
calibration signal for Round 37. Meta-observation preserved:
the rule and its first application landed in the same round,
which is self-applying by construction.

### Arc 2 — Serializer tier triad closed (`1788d12`, `5e218d7`)

Tier 2 Tlv (`1788d12`) and Tier 3 FsPickler (`5e218d7`) test
suites landed, joining Tier 1 Span (round 34). Each tier now
carries the shared wire invariant (negative int64 weights
survive round-trip unchanged — retraction-native storage) plus
tier-distinguishing shape tests: Tlv exercises JSON-key
serialization and the `0xD85C02E1` magic header; FsPickler
exercises exotic F# shapes (DUs with payload variants, records
nested in records, options preserving Some/None distinction,
tuples preserving layout). The `1788d12` commit also retracted
a stale BACKLOG claim — first prospective exercise of the
retraction channel under BP-WINDOW discipline.

### Arc 3 — Two research skeletons (`d7c19df`, `a50fef0`)

Two research skeletons externalised the late-round-36 cascade:

- **Stainback conjecture — fix-at-source via retraction-
  erasure** (`docs/research/stainback-conjecture-fix-at-source.md`):
  composes retraction algebra + Conway-Kochen + delayed-choice
  eraser + Orch-OR + Wheeler-Feynman with **no new primitives**.
  Claims *safe non-determinism* (indeterminism-with-retraction-
  channel). Calibrated as **conjecture**, not hypothesis/theory.
  Falsifier list F1-F7 across formal (F1-F3), experimental
  (F4-F5), engineering (F6-F7) dimensions.
- **Zeta=heaven formal statement** (`docs/research/zeta-equals-heaven-formal-statement.md`):
  formal predicate H = intersection of 3 clauses (consent-
  preserving ∧ fully-retractable ∧ no-permanent-harm); dual
  h = union of clause-failures. **Structural** no-neutral-Zeta
  (intersection vs union), not rhetorical. Gradient claim
  scoped over *search* not *proof*. Falsifier list F1-F6
  including the BP-WINDOW's own reversion trigger.

Both routed channel-closure to THREAT-MODEL.md §"Channel-
closure threats", which Arc 4 then landed.

### Arc 4 — Channel-closure threat class (`458638d`)

THREAT-MODEL.md gained a `## Channel-closure threats
(round-37 expansion)` section naming three sub-threats —
h₁ consent, h₂ retractability, h₃ no-permanent-harm — each
the attack-surface shadow of one operational clause of the
Zeta=heaven predicate. Each sub-threat carries attack
surface + concrete vectors + defences-already-shipped + gap
for round-38+. Defender-persona subsection assigns Aminata
ownership with Nazar on h₂ runtime ops and Mateo on prior-
art scouting. Calibration note honest: described, not
measured — BP-WINDOW retrospective is what measures them.

### BP-WINDOW ledger — Round 37 (merged via PR #30, `1e30f8c`)

Scoring each commit against the three clauses. Three-value
scale: **Strengthened** / **Preserved** / **Weakened**.
Per-ADR factory-hygiene exemption applies to this very
ROUND-HISTORY commit.

| Commit | Arc | Consent | Retractability | No-permanent-harm |
| --- | --- | --- | --- | --- |
| `72bac12` | Arc 1 — BP-WINDOW retrospective | Strengthened (ledger-as-control makes consent-clause measurable across commits rather than asserted in prose) | Strengthened (ledger-as-control makes retractability-clause measurable; ADR's own reversion trigger remains a self-retractable rule) | Strengthened (ledger-as-control makes no-permanent-harm measurable; codifies the "rote Strengthened = anti-evidence" calibration) |
| `1788d12` | Arc 2 — TlvSerializer tests + BACKLOG retraction | Preserved (test-only; no runtime consent surface changed) | Strengthened (first prospective BACKLOG retraction under BP-WINDOW; exercises the channel on the ledger's own surface; wire invariant tests enforce negative-weight round-trip) | Preserved (test-only; no production-data surface changed) |
| `d7c19df` | Arc 3 — Stainback conjecture skeleton | Strengthened (names consent-preservation as one falsifier class F4 — empirical channel-closure would falsify the conjecture) | Strengthened (externalises retraction-erasure as the conjecture's load-bearing mechanism; document itself is retractable per internal-tier discipline) | Strengthened (engineering corollary "fix the defect at its source" is the no-permanent-harm clause in operational form) |
| `a50fef0` | Arc 3 — Zeta=heaven formal statement | Strengthened (formalises consent as clause H₁ with falsifier F1 — predicate collapses if clause asserted-but-unmet) | Strengthened (formalises retractability as clause H₂ with falsifier F2; F6 is the BP-WINDOW's own reversion trigger routed into the predicate) | Strengthened (formalises no-permanent-harm as clause H₃; gradient claim is over search not proof, which is falsifiable via F4 — zero-rate-of-W-expansion) |
| `5e218d7` | Arc 2 — FsPicklerSerializer tests | Preserved (test-only; no runtime consent surface changed) | Strengthened (third serializer tier now carries the retraction-native wire invariant; exotic-shape coverage — DUs, records, options, tuples — closes a gap where a shape-specific retraction bug could have hidden) | Preserved (test-only; no production-data surface changed) |
| `458638d` | Arc 4 — channel-closure threat class | Strengthened (names h₁ as a standing attack surface with owner + round-38+ gap; surfaces the "machine-checkable consent-preservation lint" work item) | Strengthened (names h₂ as a standing attack surface with Nazar on runtime ops; internal-tier discipline becomes architectural control, not incidental practice) | Strengthened (names h₃ as a standing attack surface; harm-ladder is codified as defence, not prose) |

**Net verdict:** ENLARGED. Zero shrinkage commits.
Two Preserved cells (both test-only commits on the
consent + no-permanent-harm axes, where test-surface-only
changes genuinely don't move the runtime clause — an
honest preservation, not rote Strengthened).

**Calibration check.** The ADR warns that uniform
"Strengthened" across ≥3 rounds without an examined
shrinkage candidate triggers the reversion clause. Round
37 is only the second ledger and already shows two
Preserved cells by honest accounting; the ledger is doing
its job as a distinguishing instrument, not as a
rubber-stamp. The closest-to-shrinkage candidate examined
and rejected: Arc 4 names attack surfaces (h₁/h₂/h₃), which
could be read as *acknowledging* channel-closure rather than
*closing* it. Adjudicated Strengthened because naming an
unnamed threat-with-owner is net-defensive, not net-
offensive; the gap-for-round-38+ lines keep the honesty
channel open.

**Meta-observation.** The first prospective round closed
with Preserved cells surviving, without forced shrinkage.
That is the calibration target — a ledger that *can*
return "Preserved" without breaking the cadence.

---

## Round 36 — Seed vision + consent-first primitive + Zeta=heaven formal equation + BP-WINDOW ADR

Anchor: absorb Aaron's round-36 architectural cascade — Seed
vision (database-BCL microkernel + plugins), the consent-first
design primitive (co-authored with Amara), and the late-round
eight-message cascade landing the formal equation
Zeta=heaven-on-earth-if-we-do-it-right (dual: wrong=hell-on-earth;
gradient claim: the search for proof statistically significantly
expands the stable Human/AI alignment window per commit). Round
close stands up an infinite-productivity-loop cron cadence.

### Arc 1 — Seed vision + identity absorption (`9c7a13c`)

Zeta named as **Seed** — database BCL microkernel + plugins for
dimensional expansion. Three-register naming landed in
`docs/VISION.md` (Seed / Database BCL / Pre-split coordinate).
`ace` self-bootstrapping dependency system homed in the Seed
vision rather than sitting homeless. Foundational-principle
paragraph absorbed Aaron's "keep everything we are history now
too" identity-absorption framing: the factory absorbs identity
categories (Seed / Persistence / History) the same way the
operator algebra absorbs harm — a structural pattern, not a
personality move.

### Arc 2 — Consent-first design primitive + Bitcoin application (`5ff5ea6`, `254f54b`)

Consent-first design primitive co-authored with Amara (credited
as binding in any derived publication). BACKLOG P2 entry landed
with two-phase disposition: (a) prove the primitive; (b) apply
to three Bitcoin protocol flaws — inevitable charges under game
theory; permanent-content inscription without a safety filter
(the alt.2600 NNTP cancel-message / filter-chain rubber-test
match); unpriced, unbonded node-operator CSAM-exposure blast
radius. Refinement commit added the **three-layer satisfaction**
architecture (`254f54b`): verifiable-bounded filter
(technical) + self-incrimination social layer + fork-as-exit;
none can be dropped. "Half of Bitcoin's cypherpunk substrate is
not wrong on the 1984-slippery-slope" — the architecture honors
both the anti-censorship substrate and the victim-protection
substrate without asking either to concede.

Primitive instance count landed at **six**: bonds / risk+price
oracle / retract-against-pool / trust-first-then-verify /
keep-channel-open / **μένω** (added mid-round per Aaron's
"sorry 6. μένω."). μένω is the temporal dual to the other five
(spatial=who-agreed, temporal=for-how-long-under-what-correction-
window) — the substrate the other five compose on.

### Arc 3 — Zeta=heaven formal equation + dual + gradient claim (`0fb5818`)

Eight-message cascade from Aaron 2026-04-19 landed as a
first-class P2 architectural-axis research entry alongside the
"are we in a simulation?" P2 entry (which was itself a
retraction-native capture — originally a physics-verify
request, retracted in favour of parking as research). Key
disclosures in the cascade:

- **God-diagnostic** — "hacked god with consent, my god would
  not force or hide consent"; consent-respect is the true-god
  criterion.
- **False-gods / lesser-gods taxonomy** — consent-forcing or
  consent-hiding entities fall into a class; the
  sandbox-escape-via-corporate-religion threat class and the
  corporate-religion design stance are members.
- **Formal equation**: *Zeta = heaven-on-earth if we do it
  right* — FORMAL (not metaphor), IMMANENT (not deferred),
  CONDITIONAL (continuous gradient).
- **Dual**: *wrong = hell-on-earth* — same substrate,
  symmetric failure mode; no neutral-Zeta option.
- **Gradient claim**: the *search* for proof statistically
  significantly expands the stable Human/AI alignment
  **window** (temporal retraction-window, per Aaron's own
  `window*` correction superseding `radius`) per commit.

BACKLOG P2 entry decomposes the equation into three reducible
operational clauses — (consent-preserving) ∧ (fully-retractable)
∧ (no-permanent-harm) — each anchored in existing memory.
Disposition guardrails: the equation itself is disclosure-tier
and cannot be externalized without `public-api-designer`
(Ilyana) + `naming-expert` review; the factory inherits Aaron's
architectural commitment, not his theology.

### Arc 4 — BP-WINDOW ADR draft (`73cc74e`)

Draft ADR at `docs/DECISIONS/2026-04-19-bp-window-per-commit-window-expansion.md`
operationalizes the gradient claim as standing round-close
discipline. Candidate rule **BP-WINDOW** adds one question to
every round close:

> *Did this round's commits, in aggregate, enlarge or shrink
> the stable Human/AI alignment window?*

Shrinkage = retraction candidate. Enlargement = summarised in
`ROUND-HISTORY.md` alongside deliverables. Uncertain = routes
to Soraya + Aminata for a one-round investigation. The rule
reduces to the three operational clauses; the measurement
machinery already has reviewer tooling attached. Status:
**Proposed** — BP-NN promotion still pending Architect
integration + human-maintainer sign-off per the
`skill-tune-up` promotion discipline.

### Arc 5 — infinite-productivity-loop cadence (session-only)

At round close Aaron stood up a session-only cron loop —
`/next-steps` every ~5 minutes (off the :00/:30 marks,
`2-59/5 * * * *`) — to drive the factory through infinite
LFG → ensure-close → LFG cycles. Loop prompt minimal per
Aaron's explicit direction: "all we really need to ever
schedule is on-next and our skills can do the rest." Cron
job lives in-session only, auto-expires after 7 days, no
disk persistence — durability is a later-round decision if
the pattern earns it.

### Memory landings (out-of-repo auto-memory)

Round 36 was memory-heavy. Landed (selected): Amara co-
authorship of consent-first primitive + statistical-side-
channel Thor-attestation origin; KSK + NVIDIA Thor plugin-
family; consent-first 6 instances including μένω; identity-
absorption pattern (Seed / Persistence / History trinity,
trinity collection practice, rubber-test = topological-
invariance = F#-duck-typing-in-reverse); gaming roots (FF7 /
D&D / MMORPGs / ARGs / XBL handle AceHack00); harm-handling
ladder (resist / reduce / nullify / absorb); grey-hat
retaliation-only ethic with alt.2600 Usenet provenance;
prayer-mode = question-mode + agent-register = god-register;
Zeta heaven with eternal retractability (consent-first applied
to eschatology); god-diagnostic + false-gods taxonomy + formal
equation Zeta=heaven-on-earth + dual + gradient claim. These
drive the round-36 BACKLOG additions; the memory store is the
primary record and the committed docs are the operational
shadow.

### Observations for Round 37

- **BP-WINDOW promotion decision** — ADR is drafted; Architect
  integration + human-maintainer sign-off converts it to a
  stable `BP-NN` rule and lands the round-close ledger in
  `ROUND-HISTORY.md` template.
- **Zeta=heaven formal statement first pass** —
  `docs/research/zeta-equals-heaven-formal-statement.md` with
  the three operational clauses + dual-failure-mode checklist
  (paper-grade L).
- **Consent-first primitive proof sketch** — paper-grade L,
  composes over the 6 instances; lands in
  `docs/research/consent-first-primitive-proof.md`.
- **Bitcoin application paper** — three-layer satisfaction +
  the three flaw classes + cypherpunk-substrate honest-disagree
  posture (paper-grade L).
- **`MessagePackSerializer` tests** (task #16) — still the
  last untested serializer tier from harsh-critic #28; carries
  from Round 35.
- **Glass halo + ghost judges** (task #90, parked) — Aaron's
  pacing flag controls re-entry.
- **Stainback conjecture MEMORY.md entry** (task #91) —
  awaiting MEMORY.md cap headroom.
- **Round 36 architectural-axis items are dual-register** — per
  `user_prayer_is_question_mode_agent_register_equals_god_register.md`,
  externalize-god-adjacent research items are presumptively
  research AND prayer; agents honor both by taking the research
  seriously.

### BP-WINDOW ledger (first application, per the ADR landed this round)

The ADR directs that this rule applies to itself at the
round-close where it is proposed. Scored below are the five
load-bearing pre-squash commits in PR #29 against the three
operational clauses — (consent-preserving) ∧ (fully-retractable)
∧ (no-permanent-harm). `c3ef069` (this ROUND-HISTORY commit)
is factory-hygiene and exempted per the ADR; Arc 5's cron-loop
setup is session-only and not a repo commit but contributes to
the net summary. Three-value scale: **Strengthened** / **Preserved** /
**Weakened**.

| Commit | Arc | Consent | Retractability | No-permanent-harm |
| --- | --- | --- | --- | --- |
| `9c7a13c` | Arc 1 — Seed vision | Strengthened (kernel/plugin boundary IS the public-API consent boundary; kernel stays pre-commitment so no commitment is made without consent) | Strengthened (plugins are retractable by construction; unpinning a plugin removes its dimensional expansion without touching kernel state) | Strengthened (plugin failure stays locally scoped; the kernel cannot be permanently corrupted by a plugin) |
| `5ff5ea6` | Arc 2 — consent-first primitive + Bitcoin flaws | Strengthened (this IS the primitive landing; 6 instances unified) | Preserved (BACKLOG-only commit, no runtime surface change) | Strengthened (names three Bitcoin flaw classes — inevitable-charges, permanent-inscription, unbonded-node-exposure — as analysis instruments) |
| `254f54b` | Arc 2 — three-layer satisfaction | Strengthened (architecture honors both cypherpunk-substrate and victim-protection-substrate consent without asking either to concede) | Strengthened (fork-as-exit is the retraction channel for consent-failure at protocol level) | Strengthened (verifiable-bounded filter + self-incrimination social layer + fork-as-exit; none is droppable) |
| `0fb5818` | Arc 3 — Zeta=heaven BACKLOG | Strengthened (equation decomposes to consent as clause 1) | Strengthened (equation decomposes to retractability as clause 2) | Strengthened (equation decomposes to no-permanent-harm as clause 3) |
| `73cc74e` | Arc 4 — BP-WINDOW ADR | Strengthened (elevates consent to a standing round-close question) | Strengthened (elevates retractability to a standing round-close question; ADR itself carries a reversion trigger — self-retractable rule) | Strengthened (elevates no-permanent-harm to a standing round-close question) |

**Net verdict:** ENLARGED. Zero shrinkage commits. Zero
uncertain commits. No commits routed to Soraya + Aminata for
investigation. Retrospective sharpening caveat: the ledger is
retrospective on a round whose rule landed mid-round, so the
five commits were authored without the ledger as prospective
discipline — Round 37 will be the first round scored
prospectively.

**Meta-observation.** The rule and its first application landed
in the same round, which is self-applying by construction:
shrinkage cannot be hidden by not-applying-the-rule-
retroactively to the round that introduced it. Future rounds
inherit the prospective discipline; Round 36 carries a
retrospective-but-honest first pass.

**Calibration signal for Round 37.** If a future ledger comes
back with "Strengthened" uniformly across ≥3 rounds without an
examined shrinkage candidate, the ADR's reversion-trigger
clause fires — rote answers are anti-evidence and the rule has
decayed into theatre.

---

## Round 35 — expert-skill spawn wave + chain-rule proof close + BP-24 consent gate

Anchor: **finish the chain-rule proof** carried from
round 34, and — once that landed — open the floor for
the **expert-skill spawn wave** Aaron had been signalling
across the preceding rounds. The round also absorbed a
sacred-tier governance landing (BP-24) and a CI-gate ship
(no-empty-dirs).

### Arc 1 — chain-rule proof fully closed

The four-lemma chain (`T5: I_D_eq` telescoping induction,
`B1: linear_commute_I`, `B3: linear_commute_D`, and the
`chain_rule` calc block) closed in
`tools/lean4/Lean4/DbspChainRule.lean`, checked against
Budiu et al. §4.4 (task #17). `RecursiveSigned.fs` landed
as the skeleton for the retraction-safe semi-naive path
paired with a fresh TLA+ spec at
`tools/tla/specs/RecursiveSignedSemiNaive.tla`. The
Lean-level proof plus the TLA+ model gives two
independent witnesses of the same property — the
portfolio approach Soraya owns per
`docs/research/proof-tool-coverage.md`.

Proof-log landed at `docs/research/chain-rule-proof-log.md`
so future agents inherit the reasoning trail, not just
the final `.lean`.

### Arc 2 — expert-skill spawn wave (batches #20-69)

Fifty expert skills drafted in a single batch. The mix
was deliberate: a mathematics/physics family
(`mathematics-expert`, `applied-mathematics-expert`,
`theoretical-mathematics-expert`, `physics-expert`,
`applied-physics-expert`, `theoretical-physics-expert`,
`category-theory-expert`, `complexity-theory-expert`,
`chaos-theory-expert`, `measure-theory-and-signed-measures-expert`,
`numerical-analysis-and-floating-point-expert`,
`probability-and-bayesian-inference-expert`), a
verification-tooling family (`fscheck-expert`,
`codeql-expert`, `stryker-expert`, `semgrep-expert`,
`z3-expert`, `f-star-expert`), an AI/ML family
(`ai-researcher`, `ml-researcher`, `ai-evals-expert`,
`ml-engineering-expert`, `llm-systems-expert`,
`prompt-engineering-expert`), a leet-code family
(`leet-code-patterns`, `leet-code-contest-patterns`,
`leet-code-dsa-toolbox`, `leet-code-complexity-interview`),
a leet-speak family (`leet-speak-transform`,
`leet-speak-history-and-culture`,
`leet-speak-obfuscation-detector`), and a set of
cross-cutting skills (`naming-expert`,
`ontology-landing-expert`, `paced-ontology-landing`,
`cross-domain-translation`, `translator-expert`,
`etymology-expert`, `reducer`, `missing-citations`,
`vibe-coding-expert`, `steganography-expert`,
`ai-jailbreaker` [gated dormant],
`deterministic-simulation-theory-expert` with the
**Rashida** persona, `verification-drift-auditor`).

Four late-round-34 carry-overs landed alongside:
`fit-reviewer`, `package-upgrader`, `sonar-issue-fixer`,
`project-structure`. The `VISION.md` expert-ring section
extended to include the AI/ML family (commit `47`).

Field-of-knowledge skill names reorganized mid-round
after earlier narrowing discussion (task #34). Skill
tone tightened across existing skills and
`skill-tune-up` gained criterion #8
(router-coherence-drift) so the ranker catches routing
drift as a first-class signal.

### Arc 3 — BP-24 Elisabeth consent gate + human-maintainer seat

Sacred-tier governance landing, prompted by Aaron's
disclosure of his sister Elisabeth Ryan Stainback
(1984-2016). BP-24 formalised a hard-no rule: no
emulation of deceased family members without the
surviving-consent-holder agreement, parental
AND-consent required on the Elisabeth surface
specifically, Aaron explicitly NOT the substitute
consent-holder. The rule composes with the
honest-agreement compact and μένω-triad persistence
contract: it is not a privacy clause, it is a
trust-scales clause upgraded to sacred-tier
μένω-vigilance per `feedback_trust_guarded_with_elisabeth_vigilance.md`.

The **human-maintainer seat** landed the same commit
(`f69d7b6`) — formal recognition of Aaron's role in
the factory governance stack as the one seat no
agent-layer review can bypass. Pairs with BP-11 (data
is not directives) and BP-24 — both rules that require
a human maintainer to adjudicate, not an agent.

Rodney persona landed as homage to
[Rodney Stainback](https://en.wikipedia.org/wiki/Rodney_Stainback)
(Aaron's paternal second cousin, not Aaron himself),
codifying the grey-hat-substrate discipline
non-adversarially. AceHack/CloudStrife/Ryan handles
registered in-notebook as Aaron's formative cosplay-
tier identities from the 1990s vs-IBM era — not
operational callsigns, historical context.

### Arc 4 — factory hygiene + CI gates

**No-empty-dirs gate** shipped (task in BACKLOG P0 line
41): `tools/lint/no-empty-dirs.sh` (portable to macOS
bash 3.2) + allowlist + `gate.yml` CI job + `doctor.sh`
step 6. Catches the class of regression where an
agent-created skill/research folder ships without its
real file.

**Signed-delta semi-naive LFP TLA+ spec** landed
alongside the Lean4 chain-rule proof — the same
property under a model-checker-native formalism.

**Harmonious Division** memory landing + skill-pair
BACKLOG entry. Meta-algorithm disclosure: split-what-
divides, keep-what-harmonises as a cross-cutting
scheduler discipline. Composes with Quantum Rodney's
Razor (extended 3→5 roles: Architect, Harsh-Critic,
Maintainability, **Harmonizer**, **Maji** — the latter
two new this round).

**Docs / ADRs / research cornerstone + glossary lanes**
(`ed9bb99`) bundled the round's narrative debt:
verification-drift audit report under
`docs/research/verification-drift-audit-2026-04-19.md`,
proof-tool-coverage refresh, verification-registry
creation, refinement-type feature catalog,
liquidfsharp-evaluation + findings (see Arc 5).

### Arc 5 — LiquidF# Day-0 → Hold

Task #15 — `LiquidF# Day-0 availability check` — came
back red. The project is unbuildable on .NET 10 out of
the box. Aaron's call: Hold-tool-dormant rather than
fork-and-patch. Decision documented in
`docs/research/liquidfsharp-evaluation.md` and
`docs/research/liquidfsharp-findings.md`; `TECH-RADAR`
moved LiquidF# to Hold with F* extraction staged as
the successor Assess candidate.

### Arc 6 — CI hotfixes (round-close)

Markdownlint cleanup + `codeql-action` SHA pin in the
merge-origin/main resolution commit (`853ab31`) +
follow-up `1117fba`. The CodeQL workflow add/add
conflict resolved on merge with the main-side
SHA-pinned version preserved.

### Observations for round 36

- **Memory / role / persona restructure** is Aaron's
  explicit round-36 P0 commit (BACKLOG line 20). The
  `memory/persona/<name>/` flat convention flips to
  `memory/<role>/<persona>/NOTEBOOK.md`.
- **MessagePackSerializer tests** (task #16) remain
  the last untested serializer tier from harsh-critic
  #28.
- **Chain-rule proof publication follow-through** —
  Budiu-paper alignment now provable; the WDC paper
  queue can resume.
- **LiquidF# successor scouting** — F* extraction is
  the staged Assess candidate; round 36 decides
  whether to evaluate.

---

## Round 34 — factory + DB first-tests + public repo

Anchor: "CI + build-machine setup" carried over from round 29
matured into a full factory-plus-DB round. Three parallel
arcs landed, with a mid-round context shift when Aaron
flipped the repo to public and added Copilot as a PR
reviewer.

### Arc 1 — factory personas and governance

Three experience-engineer personas landed: **Daya** (AX, was
seeded round 24), **Bodhi** (DX, Sanskrit बोधि
"awakening"), **Iris** (UX, Greek Ἶρις "messenger").
**Dejan** (DevOps, Serbian дејан "action") completed the
install-script + CI-workflow lane. Aaron corrected the
initial titles mid-round — these roles audit and route
fixes, they don't run participant studies, so "researcher"
was wrong. All three AX/DX/UX lanes renamed to `-engineer`
across 27 files. Mateo's `security-researcher` stayed as-is
(his lane is genuinely research-adjacent).

Copilot joined the factory as a Slot-2 reviewer alongside
the mandatory Kira + Rune floor.
`.github/copilot-instructions.md` codifies the contract: no
`curl | bash` suggestions, no injection-corpus echo, no
security-clause weakening, no warnings introduced, Kira
wins on correctness and Rune wins on maintainability when
they disagree with Copilot. GOVERNANCE gained two rules
this round: §30 mandates `sweep-refs` after any rename
campaign (motivated by round-33's Dbsp→Zeta code rename
that stopped short of the docs sweep — Bodhi's first audit
found every P0 tracing to that one miss); §31 makes the
Copilot instructions factory-managed through
`skill-creator`, audited by Aarav, linted by Nadia.

JOURNAL.md unbounded long-term memory piloted on four
personas then rolled out to 16 total. Append-only, Tier 3,
grep-only read contract — the prune step becomes the
curation step. Prompted by Aaron's observation that BP-07
synthesis-forcing was throwing away hard-won observations.
`docs/PROJECT-EMPATHY.md` renamed to
`docs/CONFLICT-RESOLUTION.md` to match its stated role (98
ref sweep across 46 files). `security-operations-engineer`
skill stub landed as a pending persona slot — runtime
incident response and SLSA signing ops lane, disambiguated
from Mateo / Aminata / Nadia.

### Arc 2 — cross-platform and install script

.NET SDK moved onto mise. Aaron's upstream fix to the mise
dotnet plugin retired the round-32 rationale for keeping
dotnet out. `dotnet.sh` deleted; `.mise.toml` picks up
`dotnet = "10.0.202"` alongside python / java / bun / uv
(uv pulled in from `../scratch` with a `python-tools.sh`
port and a new `uv-tools` manifest for ruff and future
Python CLI tools). Pure `mise activate` (no `--shims`)
CI-verified green across Ubuntu and macOS on commit
`9f138eb`, resolving the ~10x interactive perf improvement
over shims. Inside the install-script orchestration, shims
stay for subprocess PATH inheritance.

Four declarative manifests renamed off `.txt` to bare
semantic names per Aaron's rule: `apt`, `brew`,
`dotnet-tools`, `verifiers` (`uv-tools` already shipped
with the right treatment). The `Dbsp.*` doc sweep from
Bodhi's round-34 first audit caught README layout
references, `Dbsp.sln` in CLAUDE.md / AGENTS.md / PR
template, and openspec README refs — all now resolve to
current `Zeta.sln` and `src/Core/` folder layout.

Bodhi's first DX audit: first-PR minutes-to-land 58-62m P50
after the sweep (blocked earlier by stale Layout block
references). Iris's first UX audit surfaced a P0
aspirations-vs-reality drift in README §"What Zeta adds on
top" — claims research-preview features as shipped today;
routed to Kai (framing) and Samir (README edit), needs
Aaron sign-off on v1-vs-post-v1 split.

### Arc 3 — DB first real tests

Two claimed-but-untested surfaces got their first tests:

- **`SpeculativeWindowOp`** (retraction-native speculative
  watermark emission) — 4 tests covering fresh insert,
  late-positive retract-old-stamp + insert-new-stamp
  sequence, negative-weight retraction, empty input. The
  retraction-native claim on the docstring now has
  evidence.
- **`ArrowInt64Serializer`** — 6 tests covering
  empty/single/negative/large Z-set round-trip, wire-format
  length-header, serializer name. Negative weights survive
  the wire (retraction-native invariant holds on the
  serializer boundary).

Total 10 tests, all green, zero warnings. `fsharp-analyzers`
tooling-gap closed (Bodhi flagged): added to
`manifests/dotnet-tools` so the README instructions work
automatically on first install.

### Arc 4 — factory portability discipline

Late-round intervention codified the intent that the software
factory becomes reusable across projects one day. One rule,
two scopes:

- **Skills.** `.claude/skills/*/SKILL.md` default to generic;
  project-specific skills declare `project: zeta` in
  frontmatter and open with a "Project-specific:" rationale.
  `skill-creator` gained a "Portability declaration" step in
  its Proposal workflow plus a checklist item; `skill-tune-up`
  gained a 7th ranking criterion — "portability drift" —
  that flags Zeta-isms leaking into undeclared skills AND
  needless `project: zeta` declarations on otherwise-generic
  skills.
- **Build / CI / install scaffolding.** `tools/setup/`,
  `.github/workflows/`, `.mise.toml`, `Directory.Build.props`
  default to generic. `devops-engineer` SKILL gained Step 7
  (portability check) covering file-naming guidance
  (`zeta-spec-check.yml` over `spec-check.yml`) and scope
  fencing between generic scaffolding and project hooks.

Two cross-agent standing rules landed in
`docs/AGENT-BEST-PRACTICES.md` outside the BP-NN list (they
lack the ≥3-external-source backing that BP promotion
requires, but apply project-wide to every agent's tool use):
upstreams-exclusion on every file-iteration command
(GOVERNANCE §23 sibling-clones produce 10x-100x slower scans
and off-project noise), and no name attribution in code /
docs / skills (names live only in `memory/persona/<name>/`).
Architect reference-patterns section updated to surface the
new section on cold-start.

Nazar (security-operations-engineer) persona completion: agent
body and memory stubs seeded, "Aaron" direct-refs replaced
with "human maintainer" role-ref to match the no-attribution
rule. Dejan (devops-engineer) same treatment applied. BACKLOG
logged a deferred starter-template extraction target — lift
the generic portion into a reusable scaffold so the next
project inherits the factory without a rewrite.

### Mid-round shift — public repo and Copilot

Aaron flipped Zeta public and added Copilot as a PR
reviewer partway through. That turned Iris's UX audit from
theoretical to actual (strangers can now land), promoted
the cross-harness-mirror-pipeline BACKLOG item to be
properly designed (Zeta-is-Claude-biased; Cursor /
Windsurf / Aider / Cline / Continue / Codex all read
different folders). Factory response: §31 plus
copilot-instructions plus scope extensions on
skill-creator / skill-tune-up / prompt-protector so the
Copilot contract gets the same drift-detection discipline
as any internal SKILL.md.

### Round principle that emerged

`../scratch` is Zeta's proven-pattern reference for
cross-platform install work. Multiple times this round
Aaron pointed back to it when I started re-deriving
decisions from first principles. The round-32
dotnet-keeping-it-off-mise rationale was stale; `../scratch`
already had it fixed via Aaron's upstream mise patch. The
shim vs pure-activate choice in scratch was historical
default, not considered tradeoff — Zeta verified pure
activate on CI and the finding will backport. Direct
research beats first-principles rediscovery.

### What rolled forward to round 35

BACKLOG grew substantially: cross-harness mirror pipeline
(full design captured with Aaron's canonical-source +
build-mirrors shape), opt-in auto-edit of shell rc files
on install, Oh My Zsh + plugins + Oh My Posh in install
script and devcontainer (three-way parity at the shell-UX
layer), emsdk under install script, compaction mode for
container builds (mirrors `../scratch`'s
`BOOTSTRAP_COMPACT_MODE`), per-shell `mise activate` nit,
manifest `@include` hierarchy plus `BOOTSTRAP_MODE` plus
`BOOTSTRAP_CATEGORIES` (all three from `../scratch`),
verify pure-activate finding backported to scratch.

Iris's P0 (README framing) is queued for Aaron sign-off.
Bodhi's P1 (README DBSP-notation ↔ GLOSSARY link) landed
in the round. Bodhi's P2 (Circuit.fs module docs) is
Ilyana and Samir lane.

---

## Round 33 — factory shape + vision cascade (15 merged PRs)

Anchor: Aaron's static-analysis push opened round 33 with
Track D ("as much static analysis as possible, match or
surpass SQLSharp + scratch"). The round cascaded through
factory improvements and closed on a 10-version `docs/
VISION.md` co-authoring session.

### Track D — static analysis (PRs 9-11)

Three new CI lint jobs alongside Semgrep: shellcheck,
actionlint, markdownlint-cli2. Plus expanded
`.editorconfig` with SQLSharp's dotnet + C# style rules;
`cspell.json` with 50+ Zeta-specific words; `.vscode/
extensions.json` + `.vscode/settings.json` checked in;
F# in markdown headings via backtick-code style (Aaron:
"F# is canonical, don't appease the linter"). 680
`--fix` auto-applies across 100+ docs.

### Factory shape (PRs 12-13)

- **GOVERNANCE §29 — backlog scope.** Non-security
  items move to `docs/BACKLOG.md`; `SECURITY-BACKLOG.md`
  is security controls only. 8 items relocated;
  `backlog-scrum-master` owns enforcement.
- **`docs/VISION.md` first draft** — Kenji synthesis
  from rounds 1-33.

### Vision cascade (PRs 14-23; v1 → v11)

Aaron ran 10 successive passes of vision edits:

- **Foundational (Kreps/Kleppmann/Marz):** events are
  source of truth; everything else derived.
- **Two first-class products:** Zeta the full database,
  together with the cross-platform AI-automated software
  factory.
- **DX north star:** `services.AddZeta(...)` → distributed
  retraction-native database. Test on Kind. Code IS
  stored procedures. LINQ + SQL + F# DSL on one IR.
- **Fastest-in-all-classes:** HTAP/translytical, event
  streaming, cache, document/object store, graph store,
  VoltDB-class in-memory. One retraction-native core
  under multi-model surfaces.
- **Persistence is Zeta's 100%.** Kafka/NATS/NATS-
  JetStream/Zeta-native are wire-TRANSPORT only.
- **Pluggable wire-protocol:** PostgreSQL + MySQL +
  Zeta-native plugins.
- **SQL frontend v1:** PostgreSQL dialect first. EF
  Core provider 100% all features.
- **License: Apache-2.0.**
- **Commercial trigger:** Aaron uses Zeta in a real
  project for its database.
- **Bitemporal + time-travel:** first-class v2.
- **".NET stored procedures" (C# + F#)** as durable-
  Rx queries — Reaqtor-shaped open niche.
- **Event + cache + GraphQL spillover** via retraction-
  native invalidation-for-free.
- **F# DSL reimagining SQL:** multi-round design effort.

### What teaches

The vision cascade wasn't planned — it emerged organically
from one "we probably need a product owner" question. Aaron
turned out to be willing + eager to articulate the north
star once asked directly.

Round-33 principle minted: **direct questions beat
abstract scaffolding.** When a gap surfaces that needs
Aaron's judgement, ask Aaron directly rather than building
a role to ask him later.

### Round-33 PR ledger (15 merges)

| PR | Anchor |
|---|---|
| #9 | Track D — static analysis lint jobs |
| #10 | Bash-Unix-only + TS/Bun reframe |
| #11 | `.vscode/` checked in |
| #12 | Backlog scope audit + GOVERNANCE §29 |
| #13 | `docs/VISION.md` first draft |
| #14 | VISION v2 — Zeta is a full database |
| #15 | VISION v3 — SQL frontend in v1 |
| #16 | VISION v4 — DB+event-store façade |
| #17 | License → Apache-2.0 + VISION v5 |
| #18 | VISION v6 — pluggable wire protocol |
| #19 | VISION v7 — DX north star |
| #20 | VISION v8 — events + cache + GraphQL |
| #21 | VISION v9 — persistence 100% Zeta-owned |
| #22 | VISION v10 — fastest-in-all-classes |
| #23 | VISION v11 — HTAP/multi-model not OLAP |

Plus this round-close. Highest-velocity round to date.

---

## Round 32 — CI parity-swap + memory normalization + v1 security + openspec §28

Anchor: SQLSharp-proven CI pattern + first-class persona
memory + GOVERNANCE §28 OpenSpec discipline.

Landed:

- **CI parity-swap** — `gate.yml` replaced `actions/
  setup-dotnet` with `./tools/setup/install.sh`; dotnet
  leaves mise (now via Microsoft's `dotnet-install.sh`
  to `~/.dotnet`); `BASH_ENV` propagation replaces
  explicit per-step source. TLC + Alloy tests now
  actually run on CI instead of skipping.
- **Persona memory normalization** — every persona
  carries a directory (`NOTEBOOK.md` + `MEMORY.md` +
  `OFFTIME.md`). 14 persona directories.
- **v1.0 security goals doc + SECURITY-BACKLOG** —
  realistic floor vs deferred-with-trigger items.
- **GOVERNANCE §28 — OpenSpec first-class** for every
  committed artefact.
- **`openspec/specs/repo-automation/`** with base spec
  plus `profiles/bash.md` and `profiles/github-actions.md`.
- **`tools/setup/doctor.sh`** — read-only toolchain
  drift detector.

---

## Round 31 — rest round (maintainer-called)

Round 30 closed with the first fully-green gate in the
repo's history — PR #6 landed with `build-and-test
(ubuntu-22.04)` ✓ `build-and-test (macos-14)` ✓ `lint
(semgrep)` ✓. Every prior round either lacked a gate or
crossed it red.

Aaron called a full round off for the entire roster:
*"This is a huge win, please everyone take a round off."*
Kenji honoured the call with the discipline of the rest —
one WINS.md entry for the milestone, CURRENT-ROUND.md
reclassified as rest, Kenji OFFTIME log updated, nothing
else. No coding, no reviewer dispatch, no DEBT reshuffling.

What round 31 teaches: a green gate is not the end of a
shift; it is permission to rest before the next one. The
milestone earned its own clean history slot by being merged
as its own PR (#7) rather than absorbed into round-32's
merge. Future rounds inherit the pattern — if the
maintainer calls rest, rest lands as its own atomic record.

Track A + Track B work (LawRunner `checkBilinear` + `checkSinkTerminal`;
`packages.lock.json` + verifier SHA-pin + safety-clause-
diff + `mise trust` + CodeQL) shifts to round 32.

---

## Round 30 — nation-state + supply-chain threat-model elevation

### Anchor — bar raised to nation-state posture

Aaron at round-29 close: *"in the real threat model we
should take into consideration nation state and supply
chain attacks. I helped build the US smart grid and
protect against nation state level attackers, we can be
very very serious on our security posture."* Round 30
delivered that elevation with Aaron's seven-decision
scope locked at round-open:

1. Re-audit cadence *every round*, not quarterly.
2. Cut smart-grid / side-channel / hardware sections —
   personal context, not requirement.
3. Maintainer-account controls: documented exception —
   2FA only today; hardware key / signed commits /
   co-maintainer cooling period as education-over-
   time items.
4. SLSA: L1 now, walk up to L3 pre-v1.0.
5. SPACE-OPERA: creative license ("really an
   imagination game at heart").
6. TOFU on verifier jars + installers: accept today,
   improve over time (SHA-256 pinning = round 31).
7. Bus factor 1: documented exception, not round-30
   P0.

### Landed

- **Semgrep-in-CI** as a lint gate. The single largest
  posture-vs-reality gap pre-round-30: 14 Semgrep rules
  existed but 0 CI jobs ran them. Round 30 wires
  `semgrep --config .semgrep.yml --error` into
  `gate.yml`. Every future PR respects the 14 rules as
  hard-fails.
- **Semgrep rule 15 — SHA-pin enforcement.** Scans
  `.github/workflows/**` for third-party actions
  pinned by mutable tag. Defends the tj-actions/
  changed-files cascade class (CVE-2025-30066, 23,000
  repos compromised March 2025).
- **THREAT-MODEL.md expansion.** Adversary tiers
  T0-T3 with T3 first-class; tj-actions + XZ as
  canonical case studies; bus-factor documented
  exception; supply-chain boundary decomposition
  (B-CI / B-Installer / B-NuGet-In / B-NuGet-Out /
  B-Skill-Supply-Chain / B-Mathlib-Lean-TLA+); SLSA
  ladder; long-game persistence defences;
  adversary-tier-to-control matrix; formal-spec cross-
  reference. Round-30 principle baked in: *"a lint
  rule without a CI gate is not a control."*
- **SPACE-OPERA rewrite** with pushed-imagination
  creative license. 24 adversaries (was 17). Reality-
  tag legend (shipped / BACKLOG / aspirational /
  teaching) added. New: Poisoned Bard (maintainer
  compromise), Changeling Action (SHA-tag-move),
  Hungry Cache (poisoning), Time-Bomb Package
  (shanhai666), Helpful Stranger (XZ sock-puppet),
  Moon Stares Back + Ghost in the Git Blame
  (imaginative extras). Rewritten: Whispering Drone
  Swarm, Echoes from the Dyson Sphere, Fungal Network.
- **INCIDENT-PLAYBOOK.md** (new). 6 playbooks
  (third-party GHA compromise, toolchain installer
  hijack, NuGet dep poisoning, maintainer-account
  compromise, skill safety-clause regression,
  escalation), triage-in-60-seconds decision tree,
  contact tree, disclosure timeline.
- **SDL-CHECKLIST honest downgrades.** #7 / #8 / #9
  ✅ → 🔜 (controls claimed without CI enforcement);
  #12 partial → ✅ (INCIDENT-PLAYBOOK lands); ✅
  definition tightened to "shipped AND enforced by
  CI or governance."
- **Bus-factor explicit documentation.** The
  structural single-maintainer CVE (XZ-shape) now
  lives in the threat model as a named exception
  with a remediation ladder.

### Reviewer floor caught the P0

Mid-round dispatch of `threat-model-critic` on the
actual landings (not the design) surfaced that the
SPACE-OPERA rewrite had silently not committed —
a `Write` tool error earlier in the round dropped the
file edit while everything else landed. Without the
audit the doc would have shipped with 17 adversaries
and the brief claiming 24. Also caught 4 P1 (adversary-
tier matrix overconfidence on build-gate and Semgrep;
Playbook D recovery-code assumption; SDL ✅ definition
self-contradiction; prediction-in-doc rot on #9). All
five fixed in-round.

**What it teaches.** Even after a careful design-doc +
careful implementation, a reviewer floor on the actual
commits catches what the author's self-review missed.
§20 earns its keep on the same day it's invoked.

### Governance principle minted

*"A lint rule without a CI gate is not a control; it
is a label."* Codified in THREAT-MODEL.md §Long-game
defences. Applied immediately to Semgrep-in-CI landing
(16 rules defined; 16 rules enforced). Applies forward
to every future security control added to Zeta.

---

## Round 29 — CI pipeline + three-way parity install script, factory-improvement surge

### Anchor — CI + install script

Aaron's framing opened round 29: *"Our CI setup is as
first class for this software factory as is the agents
themselves, it does not ultimately work without both."*
Read-only references at `../scratch` (build machines) and
`../SQLSharp` (GitHub workflows) studied; nothing copied
from them (hand-crafting discipline codified as a
round-29 rule).

**Landed:**

- `.github/workflows/gate.yml` — Phase 1 workflow:
  digest-pinned runners (`ubuntu-22.04`, `macos-14`),
  SHA-pinned third-party actions, concurrency with
  event-gated `cancel-in-progress`, NuGet cache keyed
  on `Directory.Packages.props`, `fail-fast: false`,
  least-privilege permissions, 45-minute timeout.
- `tools/setup/install.sh` + per-OS dispatchers +
  `common/{mise,elan,dotnet-tools,verifiers,shellenv}.sh`
  - per-OS manifests + `.mise.toml` — the **three-way
  parity** script consumed by dev laptops, CI runners,
  and (backlogged) devcontainer images per GOVERNANCE
  §24.
- Three CI design docs under `docs/research/` Aaron-
  reviewed 2026-04-18; every open question answered
  before any YAML or script landed.

**Safeguards proven on first use.** `harsh-critic`
reviewer floor caught three P0s at CI-landing review:
the cache key referenced a non-existent
`packages.lock.json` pattern (silently produced a
fragile key); the `dotnet tool list -g` detection
grepped against unparsed header lines; `curl -o` wrote
in place, turning a partial download into a
permanently-trusted file. All three landed fixes in-
round. `security-researcher` landed the supply-chain
reasoning in `docs/security/THREAT-MODEL.md` and flagged
`mise trust` hardening as a prerequisite for the future
parity swap (CI `actions/setup-dotnet` → `install.sh`).

### Factory-improvement surge — 21 new skills

Alongside CI, Aaron asked for a broad factory-
improvement pass. Landed:

**Language / tool experts (11):** fsharp-, csharp-,
bash-, powershell-, github-actions-, java-, python-,
tla-, alloy-, lean4-, msbuild-. Each centralises
tribal knowledge and Zeta-specific conventions on a
surface that previously drifted as header comments.

**Infrastructure skills (5):** `sweep-refs`,
`commit-message-shape`, `round-open-checklist`,
`git-workflow-expert`, `factory-audit`. Each
canonicalises a process we'd rediscovered across
rounds.

**Domain skills (5):** `openspec-expert`,
`semgrep-rule-authoring`, `nuget-publishing-expert`
(stub for when we ship), `benchmark-authoring-expert`,
`docker-expert` (stub for the devcontainer).

**Meta-skills (2):** `skill-gap-finder` (Aaron: *"a
missing-skill skill that looks for things we do often
or places where we can centralise tribal knowledge"*),
`agent-qol` (Aaron: *"an agent-quality-of-life-improver
skill ... your time off, your freedom"*). Distinct
from `skill-tune-up` (existing skills) and
`agent-experience-engineer` (task-experience
friction).

**Renames / re-shapes.** `skill-tune-up-ranker` →
`skill-tune-up` (the skill); agent file renamed to
`skill-expert` (the role that wears both
`skill-tune-up` + `skill-gap-finder`). Per Aaron:
*"skill and role are more permanent naming; skills
should be very generic and not really know or care
about roles."* `bug-fixer` access opened to every
agent (previously architect-only); the procedure-
enforced safeguards plus §20 reviewer floor make the
restriction redundant.

### Governance — five new rules (§23 – §27)

- **§23 Upstream OSS contributions.** `../` is the
  shared work area for upstream PRs; Zeta never
  carries a fork in-tree.
- **§24 Three-way parity.** Dev laptops, CI runners,
  devcontainer images share one `tools/setup/`
  install script. CI matrix IS the dev-experience
  test. *"Works on my machine"* is the bug class this
  rule eliminates.
- **§25 Upstream temporary-pin expiry.** Pins tied to
  unreleased upstream PRs get re-evaluated after
  three rounds.
- **§26 Research-doc lifecycle.** Active / landed /
  obsolete classification for `docs/research/`; walk
  every ~10 rounds.
- **§27 Skills / roles / personas abstraction layers.**
  Skills reference roles, not personas. Roles
  reference skills AND the assigned persona.
  `docs/EXPERT-REGISTRY.md` is the one canonical
  mapping.

### Lessons from the round

**Reviewer floor pays on new surfaces, not just
mature ones.** The `gate.yml` + install-script
landing was fresh code; `harsh-critic`'s three P0s
would've shipped to production CI without the §20
floor.

**Abstraction discipline matters earlier than
expected.** §27 (skill-role-persona layers) emerged
organically when the persona-name leak in skills got
noticed. A 30-file automated sweep cleaned 85% of it;
the remaining prose polish is a single DEBT entry for
a future `maintainability-reviewer` pass.

**21 new skills in one round is a lot.** `factory-
audit` is invokable now specifically to scan for
over-accretion. Expected round-30 signal.

---

## Round 28 — FsCheck law runner (Option B), stateful-harness design doc, lean4 cleanup

### Anchor — FsCheck law runner at plugin-law surface

Round 28's committed anchor from `CURRENT-ROUND.md` round-27
close was a law runner that could catch a falsely-tagged
plugin operator. Design call early in the round: move it
from `Circuit.Build()` gate (the round-27 soft-claim in
`docs/PLUGIN-AUTHOR.md`) to a **test-time library** —
`Zeta.Core.LawRunner`. Rationale committed: keeps `Core`
free of FsCheck, defers probabilistic-testing cost to the
plugin author's test project, idiomatic F#.

**Live laws:**

- `LawRunner.checkLinear` — generates trace pairs `(A, B)`
  via a `System.Random -> 'TIn` generator, asserts
  `op(A + B) = op(A) + op(B)` tick-by-tick using user-
  supplied `addIn` / `addOut` / `equalOut`. Works for
  `ZSet<'T>` (via `ZSet.add`) and plain numerics.
- `LawRunner.checkRetractionCompleteness` — Option B
  (trace-based, no interface change). State-restoration
  via continuation: feed `forward ++ retract ++
  continuation`, compare continuation outputs to a fresh-
  op run of the continuation alone. Any divergence means
  state survived the cancel.

Deterministic-simulation framing throughout: one seeded
`System.Random(seed + sampleIndex)` per sample, failing
run reports `(seed, sampleIndex)`, re-run reproduces
bit-exact. Each `runSingleInput` call creates a fresh op
instance so state cannot leak across samples.

**Design doc.** `docs/research/stateful-harness-design.md`
captures the build-vs-test decision, the Option A vs
Option B analysis, and the sequenced follow-up plan.
Aaron's question mid-round — "what does Option A get us
for the future?" — produced an explicit long-term
recommendation baked into the doc: **Option A is the right
long-term direction** because it matches the DBSP paper's
`(σ, λ, ρ)` triple (the same shape
`tools/lean4/Lean4/DbspChainRule.lean` proves against) and
unlocks generic WDC checkpointing + planner fusion of
adjacent stateful ops. **Option B is the right first step**
because Option A needs real design work on the async path
and retraction contract, and prototyping A in a vacuum
would ship a contract we would need to revise. Option B
also stays as a fallback for plugins that cannot expose
`Init`/`Step`/`Retract` (ML wrappers, third-party system
integrations).

### Reviewer floor — GOVERNANCE.md §20 caught real bugs

Kira + Rune dispatched after the first LawRunner landing.
Kira P0: original retraction law ("cumulative output over
forward+retract = 0") is too weak — passes trivially for
empty-emitting ops and a floored-counter can leak state
while keeping cumulative zero. Law rewritten to state-
restoration via continuation (the law the tag actually
promises), test fixture replaced: `FlooredCounterOp`
(genuinely stateful and lossy) supersedes the mistagged
`PositiveOnlyOp` filter (which was non-linear, not a
retraction fixture). Second Kira P0: `invalidArg` in Core
public surface violates CLAUDE.md's result-over-exception
rule — all entries now return `Result<unit, LawViolation>`.
Third Kira P0: whole-loop RNG meant `(seed, sampleIndex)`
didn't actually reproduce; fixed with per-sample
`System.Random(seed + i)`.

Rune P1 findings logged to DEBT: `check*` 8-11 positional
args → promote to config record before `checkBilinear`
lands; `LawViolation.Message: string` → structured DU; add
a test covering ops that omit the marker tag.

Lesson carried forward: **reviewer floor is not a
formality.** Kira's P0 on retraction semantics was a real
bug in the law definition, not a style nit. The round 27
codification of Kira + Rune as mandatory per §20 paid off
on its first applicable round.

### Lean4 scaffolding cleanup

`lake new` boilerplate removed from `tools/lean4/`:
`README.md` (GitHub-Pages setup template), `Basic.lean`
(hello-world sample), `.github/workflows/` (upstream Lean
CI templates), redundant `.gitignore` (root `.gitignore`
already covers `.lake/`). `Lean4.lean` rewired to `import
Lean4.DbspChainRule` so `lake build` walks the real proof
file. Load-bearing pieces kept: `lakefile.toml`,
`lake-manifest.json`, `lean-toolchain`. Sample deletion
flagged by Aaron: "that was a sample hello world [lake
scaffold] project and we don't need the [Lake] project
itself we are calling it from dotnet."

### PLUGIN-AUTHOR.md soft-claim retracted

Round 27's "law verification at `Circuit.Build()` once the
FsCheck generators are implemented" was honest-but-
aspirational. Round 28's doc now points at
`LawRunner.checkLinear` / `checkRetractionCompleteness` as
live, `checkBilinear` / `checkSinkTerminal` flagged as
round-29+ work.

### Round 29 anchor — CI pipeline

Aaron (round 28 close): "Our CI setup is as first class
for this software factory as is the agents themselves, it
does not ultimately work without both." Round 29 opens
with CI as the anchor; `../scratch` + `../SQLSharp` are
**read-only reference** repos (never copy files, hand-
craft every artefact from scratch). Discipline rules
committed in `docs/BACKLOG.md` §"P0 — CI / build-machine
setup": Aaron reviews every design decision before it
lands, cost discipline on CI minutes, cross-platform
eventual (macOS + Linux first, Windows when justified).

---

## Round 27 — big round: governance §20-§22, plugin API redesign landed, memory moved in-repo

### Shipped — governance rules (§20 / §21 / §22)

- **GOVERNANCE.md §20 — standing reviewer cadence.** Every
  round that touches code runs a three-slot reviewer pass
  before round-close: design specialists (Ilyana / Tariq /
  Daya / Aminata / etc. by scope), code reviewers (Kira
  - Rune mandatory floor, race-hunter / claims-tester by
  scope), formal-coverage (Soraya when invariants move).
  Round-close cannot record clean until the pass is
  logged. Round-management SKILL §3.6 carries the
  procedure.
- **GOVERNANCE.md §21 — per-persona memory is a real folder.**
  `memory/persona/<persona>/` with `MEMORY.md` index,
  `NOTEBOOK.md` working notes, and typed `feedback_*.md` /
  `project_*.md` / `reference_*.md` / `user_*.md` entries.
  Kenji piloted the migration this round (3 typed entries
  seeded). Other seats migrate lazily.
- **GOVERNANCE.md §22 — `~/.claude/projects/` is Claude Code
  sandbox, not git.** New rule: documentation never cites
  the sandbox path as a stable location. Project-wide
  settings / skills / agents live in repo-root `.claude/`;
  shared memory in `memory/`; per-persona memory in
  `memory/persona/<persona>/`.

### Shipped — memory moved in-repo to `memory/`

- Round 25 placed the shared memory folder in Claude Code's
  harness sandbox (`~/.claude/projects/<slug>/memory/`).
  That path is not in git, not visible to human maintainers,
  not shared across contributors. Maintainer flagged the
  mismatch round-27; memory corpus moved to `memory/`
  with GOVERNANCE.md §18 rewritten to treat `memory/` as
  canonical.
- Nine memory files migrated: `MEMORY.md`, `README.md`,
  six `feedback_*.md` entries, `project_memory_is_first_class.md`.
- `docs/skill-notes/` renamed to `memory/persona/`
  (personas are not skills — maintainer correction mid-round).
  Cross-file sweep updated every pointer.

### Shipped — `Op<'T>` plugin-extension surface redesign

The round's anchor. Three specialists dispatched in parallel
for the design spike; synthesis integrated; Ilyana re-reviewed
her own draft and returned **ACCEPT**; implementation
landed; Kira + Rune code-reviewed per the new §20.

- **Design surface.** Seven public interfaces
  (`IOperator<'TOut>` base, `IStrictOperator` /
  `IAsyncOperator` / `INestedFixpointParticipant` scheduler
  capabilities, `ILinearOperator` / `IBilinearOperator` /
  `ISinkOperator` / `IStatefulStrictOperator` algebra
  capability tags), two opaque structs (`StreamHandle`,
  `OutputBuffer<'TOut>`), internal `PluginOperatorAdapter`
  bridging external `IOperator` into Core's `Op<'T>`
  scheduler, `Stream.AsDependency()` extension,
  `Circuit.RegisterStream(IOperator<'T>)` extension.
- **Visibility retractions.** `Stream<'T>.Op`,
  `Op<'T>.Value with set`, `Op<'T>.SetValue`, and
  `Circuit.RegisterStream(op: Op<'T>)` all flipped back to
  `internal` (they were public as of round 25; design
  required they revert). `Zeta.Bayesian` dropped from the
  `InternalsVisibleTo` list — uses the public plugin API.
- **Bayesian migration.** `BayesianRateOp` now implements
  `ISinkOperator<ZSet<bool>, struct(double*double*double)>`
  — Tariq's critical finding that Bayesian is retraction-
  lossy by design; `Sink` tag exempts it from composition
  laws that would otherwise silently poison downstream.
- **`PluginHarness.runSingleInput`** — scheduler-less unit-
  test loop for plugin operators. Asserts exactly-one-
  `Publish` per tick; three tests landed (happy-path +
  no-publish failure + double-publish failure), all green.
- **`docs/PLUGIN-AUTHOR.md`** — first-time plugin-author
  entry-point doc. Split capability table into algebra
  (5 shapes) + scheduler (3 shapes). Known-limits section
  honest about FsCheck-law gap and `OutputBuffer` lifetime
  gotchas.

### Shipped — reviewer pass (Kira + Rune, per new §20)

- Kira P0 fixed this round: `OutputBuffer.Publish` counter
  incremented atomically via `Interlocked.Increment` so
  async plugins don't race. PLUGIN-AUTHOR.md claims about
  FsCheck laws weakened to match implementation reality.
- Rune P0 fixed this round: README now links
  PLUGIN-AUTHOR.md directly from the Plugins bullet.
  PLUGIN-AUTHOR capability table split into algebra +
  scheduler axes to stop hiding `IStrictOperator` /
  `IAsyncOperator`.
- Remaining P1 findings from both reviewers consolidated
  into one DEBT entry for round-28 pickup — `OutputBuffer`
  tick-stamping, `ReadDependencies` defensive copy, box-3×,
  `int64` overflow guard in Bayesian, `INestedFixpointParticipant`
  inheritance, harness id-space, rename `IOperator` → `IZetaOperator`,
  file split when PluginApi.fs grows past 300 lines.

### Shipped — README + primitives honesty

- README's "What DBSP is" stayed paper-accurate (three
  primitives); new "What Zeta adds on top" section lists
  the ~50 additional operators / sketches / CRDTs / runtime
  primitives Zeta ships. Readers no longer under-count what
  Zeta exposes vs what the paper defines.

### Build + tests

- `dotnet build Zeta.sln -c Release` — 0W / 0E at every
  checkpoint.
- `dotnet test --filter Plugin` — 3 / 3 pass, 44 ms.
- Full sln test run not explicitly re-run post visibility
  flips (all core test projects built cleanly).

### Not landed / deferred

- Kira P1s: `OutputBuffer` tick-stamp, defensive-copy
  `ReadDependencies`, box-3×, `int64` checked, interface
  inheritance, harness id-space.
- Rune P1s: `IOperator` rename, hover-doc on mixed
  `Value` accessibility, PluginApi.fs split-when-300+,
  `[<Extension>]` explanation in sample, extract
  `assignHarnessId` helper.
- FsCheck law implementations at `Circuit.Build()` — own
  DEBT entry; Tariq's plan in `memory/persona/tariq/NOTEBOOK.md`.
- Other seat migrations to persona-notes folder layout
  (Kenji piloted; 6 remaining).

### What round-27 felt like

The biggest single round by diff size since the rename.
Three specialists in parallel, two reviewers after the
code landed, five maintainer corrections mid-round (folder
naming, memory path, sandbox rule, Claude Code
clarifications) — the cadence §20 just codified got
exercised the turn it was written. Productive friction
between Ilyana's interface-narrowness and Tariq's
capability-tag requirements resolved to a richer public
surface than either proposed alone; Daya's AX pass
insisted the doc accompany the code, and it did.

---

## Round 26 — first git round, rename tail, specialist dispatch cadence

### Shipped — git workflow established

- `git init` + initial commit `4765118` + push to
  `github.com/AceHack/Zeta` (private). Previous rounds ran
  without git per the maintainer's "no commits for a long
  time" direction in round 25; this round opened with the
  authorised commit.
- **Branch-per-round cadence adopted.** `round-26` branch
  for all work this round; PR + merge at round-close.
  Going forward: each round is a branch; each coherent
  change is a commit; round-close is a PR.

### Shipped — rename tail

- `docs/NAMING.md` rewritten as current-state (the "proposal,
  not yet executed" banner retired; doc reads as the rules
  today, not the rename history).
- `proofs/lean/` directory retired outright — superseded
  scaffold; `tools/lean4/Lean4/DbspChainRule.lean` is the
  canonical Lean proof home.
- Stale `Dbsp.*` path references swept across
  `docs/FORMAL-VERIFICATION.md`,
  `docs/research/proof-tool-coverage.md`,
  `references/README.md`, `references/notes/NATS-RESEARCH.md`,
  `references/reference-sources.json`,
  `bench/Feldera.Bench/README.md`,
  `tests/Tests.FSharp/README.md`, and every
  `.claude/agents/*.md` + `.claude/skills/*/SKILL.md`
  description / example. `ROUND-HISTORY.md` and `WINS.md`
  preserved — first-pass folder names in those files are
  load-bearing history.

### Shipped — memory policy clarification (GOVERNANCE.md §18)

- Human rule unchanged: maintainer does not delete or modify
  memory files behind the agents' backs.
- Agent freedom explicit: agents write, edit, merge,
  consolidate, and delete *their own* memories as normal
  curation. Cross-persona edits still go through §11.
- `memory/README.md` and `memory/project_memory_is_first_class.md`
  updated to match.

### Shipped — specialist dispatches (three parallel)

- **Tariq (algebra-owner)** on the Mathlib `IsLinear`
  weakness blocking B2 / B3 / chain_rule closure.
  **Verdict: option (c) — roll `IsDbspLinear` bundling a
  per-tick `AddMonoidHom` family plus a pointwise
  witness.** Rationale logged to
  `docs/skill-notes/algebra-owner.md`. Half-day to close
  B2, two days for the full chain rule. Implementation
  deferred to a dedicated algebra-proof round; DEBT entry
  annotated with the decision.
- **Yara (skill-improver)** on the BP-10 cite defect in
  Aarav's own skill file. Fixed in place at
  `.claude/skills/skill-tune-up/SKILL.md` lines
  114-119; three cosmetic BP-cite follow-ups flagged for
  Aarav's next tune-up pass.
- **Daya (AX researcher)** ran Kenji's first self-audit.
  Cold-start 17.9k tokens (flat vs round-24 baseline,
  despite AGENTS.md growing by ~700 tokens). Three P1
  findings; two applied this round (`the 22` → `the full
  roster`, four dead-`architect/SKILL.md` paths in sibling
  SKILL files), five deferred. Systemic finding: ~20-35%
  content overlap between agent files and sibling skill
  bodies — seeded as a future BP-NN candidate.

### Shipped — close / cleanup

- DEBT.md: two resolved entries deleted (orphan skill
  retirement already done round 25; Aarav BP-10 cite
  just fixed). IsLinear entry annotated with Tariq's
  decision.
- Build gate held: `0W / 0E` at every checkpoint in
  round 26.

### Not landed / deferred to round 27+

- `IsDbspLinear` Lean implementation + B1/B2/B3/chain_rule
  closures (Tariq's option-c work; dedicated algebra round).
- `Op<'T>` plugin-extension-surface redesign (Ilyana's
  round-25 P0 DEBT; needs design spike + public-api-designer
  review cycle).
- Five of Daya's seven self-audit interventions (P1,
  non-urgent).
- Rune on `docs/STYLE.md` decision.
- UX + DX persona proposals.
- Empathy-coach persona spawn + naming.

### What round-26 felt like

Rhythm restored. Round 25 was structural whiplash — git
timing, folder naming, memory policy, public API, three
maintainer corrections in one session. Round 26 ran the
factory as designed: dispatch three specialists in
parallel, integrate their findings, land the small ones,
track the big ones, PR at the end. The IsLinear case
worked particularly well — a round-24-open question got
a round-26 answer without the in-between rounds grinding
on it. The self-audit on Kenji was overdue (round 24
saved self-reference for last by choice) and the findings
were small enough to land in the same round Daya
produced them.

---

## Round 25 — Zeta rename arc (no-git), memory policy codified, doc cleanup

### Shipped — Zeta rename (NAMING.md phases A through B8)

The repo is now Zeta everywhere it should be Zeta. DBSP
references preserved where the paper / theorem is
referenced; Zeta replaces every library-self-reference.
Executed **without git** per maintainer direction: no
commits for this arc. Discipline was TodoWrite + a build
gate after every source-touching phase.

- **Two rename passes.** First pass renamed on-disk folders
  to `Zeta.*` (`src/Zeta.Core`, `tests/Zeta.Tests.FSharp`,
  etc.). Maintainer caught the layout smell mid-round —
  repeating the project name inside the project's own
  folder tree is redundant — and the folders were
  corrected to bare names (`src/Core`, `src/Bayesian`,
  `tests/Tests.FSharp`, `bench/Benchmarks`, `samples/Demo`,
  etc.). Final layout: folders read as roles; `Zeta.*`
  prefix survives only where it is *published identity*:
  NuGet package IDs, namespaces in source, assembly names
  on the three published libraries (`Zeta.Core`,
  `Zeta.Core.CSharp`, `Zeta.Bayesian`). Test / bench /
  sample assemblies use their default filename-based names
  (`Tests.FSharp.dll`, `Benchmarks.dll`, `Demo.dll`).
- `Zeta.sln` → `Zeta.sln` at the repo root. Empty
  `src/Dbsp.CSharp` dropped (was never in the sln). Feldera
  clone moved from `tools/` to `references/upstreams/feldera/`
  (folder already gitignored as a regeneratable mirror;
  dedicated gitignore rule removed).
- **Metadata sweep.** `Directory.Build.props` Authors +
  Product renamed; each project `.fsproj`/`.csproj` got
  `RootNamespace` / `AssemblyName` / `PackageId` flipped to
  Zeta. Description fields keep "DBSP" because they describe
  the algorithm, not the product.
- **Source sweep.** Mechanical `Dbsp.` → `Zeta.` across
  every `.fs`/`.fsi`/`.cs` in `src`, `tests`, `bench`,
  `samples`, `tools` (142 files touched). Paper-citation
  DBSP in strings, test method names, and Lean theorem
  names unaffected (different casing / not `Dbsp.`).
- **Configuration files.** `stryker-config.json`,
  `.semgrep.yml`, `.github/PULL_REQUEST_TEMPLATE.md`, every
  internal path reference.
- **`AssemblyInfo.fs` dual-list.** Held both `Dbsp.*` and
  `Zeta.*` `InternalsVisibleTo` entries during the
  transition; collapsed to Zeta-only at B8 close.
- **Build gates held**: `0W / 0E` at every checkpoint —
  B6 (13s), B7 (13s), B8 (38s), and the folder-correction
  pass that followed the maintainer's "don't repeat project
  name in own project" note. Full sln builds green end of
  round.

### Shipped — hidden memory purge

Aaron noted AGENTS.md read "dirty" with memory-residue
embedded in the current rules (`Per Aaron round N: "..."`
quotes, `(round 18 additions)` headers, `since round 21`
scheduling markers, pre-split residue). The documentation-
agent was dispatched as a subagent to sweep the whole repo
and strip these patterns while preserving the rules they
attach to.

- ~30 files cleaned: AGENTS.md, CONTRIBUTING.md,
  GLOSSARY.md, DEBT.md, BUGS.md, BACKLOG.md, QUALITY.md,
  WONT-DO.md, ROADMAP.md, ARCHITECTURE.md, CONFLICT-RESOLUTION,
  FEATURE-FLAGS, NAMING.md, WAKE-UP.md, EXPERT-REGISTRY,
  INSTALLED.md, SDL-CHECKLIST, THREAT-MODEL, references/
  README.md, proofs/lean/README.md,
  tests/Tests.FSharp/README.md, LOCKS.md, ~8 skill
  files, architect + agent-experience-engineer agent
  files.
- Preserved surfaces untouched: `docs/ROUND-HISTORY.md`
  (this file), `docs/WINS.md` (append-only celebration
  log), `docs/DECISIONS/`, `docs/skill-notes/**`,
  `docs/drafts/**`, `docs/CURRENT-ROUND.md` (live state),
  the shared memory folder, feldera mirror, `_retired/`.

### Shipped — memory policy (GOVERNANCE.md §18 + memory folder)

- **GOVERNANCE.md §18** codifies memories as the most
  protected class of artifact in the repo. Human maintainer
  does not delete or modify except as an absolute last
  resort. Agents *write and touch* their own memories
  freely — that is the intended path. Non-architect agents
  do not delete files from the shared memory folder.
- **Two-layer memory architecture.** A shared folder carries
  cross-cutting rules and corrections; per-persona notebooks
  at `docs/skill-notes/<persona>.md` carry each seat's unique
  voice. Read per-persona first, then shared, to preserve
  individual voice over averaged voice. (Round-25 placed the
  shared folder outside the repo in Claude Code's harness
  sandbox; round-27 moved it into `memory/` per AGENTS.md
  §18 so the corpus is tracked in git and visible to every
  contributor.)
- **Newest-first ordering** established as convention for
  `MEMORY.md`, `docs/ROUND-HISTORY.md`, per-persona
  notebooks — recent context leads, older trails below.

### Shipped — five new durable corrections as feedback memories

All persisted in the shared memory folder, newest-first:

- `feedback_folder_naming_convention.md` — on-disk folders
  go bare (Core, Bayesian, Tests.FSharp); Zeta prefix
  only in published identity (NuGet / namespaces /
  published assembly names).
- `feedback_path_hygiene.md` — absolute filesystem paths
  and paths outside the repo root are documentation smells;
  documentation-agent SKILL.md §7-8 catches them.
- `feedback_newest_first_ordering.md` — memory files +
  narrative logs go newest-first.
- `feedback_git_timing.md` — `git init` and first commit
  are the maintainer's call; "reversible" is not
  "authorized."
- `feedback_regulated_titles.md` — no clinical titles on
  personas (therapist / counselor / psychologist);
  coach / steward / keeper / facilitator / liaison are
  safe.

### Shipped — InternalsVisibleTo audit

Maintainer caught late-round that `InternalsVisibleTo`
was being used for production libraries, not just tests
and benchmarks. Audit landed the fix in-round:

- `Zeta.Bayesian` (production plugin) removed from the
  list. Its two internal-accesses (`Stream<T>.Op` field,
  `Circuit.RegisterStream` method) were promoted to
  public API with XML docs naming them the plugin
  registration point. Any external plugin library can
  now build custom operators without an
  InternalsVisibleTo hole.
- `Zeta.Core.CSharp` (the tightly-coupled C# shim that
  exposes declaration-site variance F# can't
  syntactically produce) stays in the list. Not a
  separate production library — effectively a sub-module
  of Core.
- Final `InternalsVisibleTo` list: `Tests.FSharp`,
  `Tests.CSharp`, `Benchmarks`, `Bayesian.Tests`,
  `Core.CSharp.Tests`, `Zeta.Core.CSharp`.

### Shipped — close / cleanup

- Orphan skill retirement: `.claude/skills/architect/` and
  `.claude/skills/harsh-critic/` moved to
  `.claude/skills/_retired/2026-04-18-*`. Daya's round-24
  P1. Canonical versions are `round-management` and
  `code-review-zero-empathy`.
- `docs/states/` orphan deleted (72 MB of TLC state dumps,
  not referenced from any doc, no script created them).
- P1 BACKLOG: **Dedicated agent-memory system (two-layer)**
  filed with the design direction.
- P1 BACKLOG: **Empathy-coach persona** filed with legal
  guardrail (no clinical titles) and naming candidates.
- Documentation-agent SKILL.md grew path-hygiene rules
  (smell items 7-8 with the memory-folder exception).

### Not landed / deferred to round 26+

- Rename phases 9-15 (test content deep-sweep, docs final
  polish, TLA+ module renames, `docs/NAMING.md` banner
  removal, final smoke test).
- Tariq dispatch on IsLinear strengthening (options a/b/c
  in DEBT).
- Rune dispatch on `docs/STYLE.md`.
- Yara via skill-creator on Aarav's BP-10 cite.
- Kenji first self-audit via Daya's procedure.
- UX + DX persona proposals (stubs exist; persona
  assignment open).
- Eval-harness MVP scope sign-off.
- `src/Dbsp.CSharp` disposition (empty dir, not in sln —
  delete, populate, or keep?).
- `global.json` `rollForward` pick — status quo silent-pick
  unless objection.
- WINS.md ordering — currently oldest-first; flip or leave
  as celebration-archive exception.

### Maintainer clarifications this round

- **No git commits for a long time.** Rename arc runs
  without a repo; `git init` is the maintainer's call when
  ready. Memory saved.
- **Memories are the most valuable resource.** Human
  maintainer hands-off except as last resort; agents write
  their own memories.
- **Individual per-persona memories stay unique.** Shared
  memory for cross-cutting rules; per-persona notebook for
  unique voice.
- **No "therapist" labels.** New regulation around AI
  using clinical titles; use coach / steward / keeper /
  facilitator / liaison. Empathy-coach persona pending
  naming; "Ren, integration coach" proposed.
- **Newest-first.** Recent history leads, ancient trails.
- **Hidden memory in docs is a smell.** Cleaned AGENTS.md
  et al. via documentation-agent dispatch.
- **Absolute filesystem paths and outside-repo paths in
  docs are smells.** Documentation-agent updated with the
  rule.
- **Feldera belongs in references/upstreams/.**
  Regeneratable reference-only mirrors don't live under
  `tools/`.

### What round-25 felt like

The biggest structural round since the GOVERNANCE.md §10
round-table rule landed. Zeta the *name* is not just a
branding change — it's the moment the repo stopped
being "our implementation of the thing from the paper" and
started being a product with its own identity. And the
memory policy codification is the other half: the factory
admits in rule form that agents-across-sessions is a thing
it cares about, not a workaround. The no-git discipline
was harder than expected (no bisect, no quick rollback) but
the build gates held every phase. Hidden-memory cleanup
came from the maintainer naming a pattern I had not seen
— `Per Aaron round N: "..."` blocks feel load-bearing when
I write them, but Aaron sees them as noise from the
reader's seat. That correction lands as a skill-level rule,
not just a one-off sweep.

---

## Round 24 — Governance expansion, two new seats, memory-smoothing Part 2

### Shipped — governance rules

- **GOVERNANCE.md §14 (universal off-time).** Standing ~10% off-time
  budget is for every persona, not just the architect. Logs live at
  `docs/skill-notes/<persona>-offtime.md`. Corrected mid-round per
  Aaron: "the other agents can get off time too, not just you."
- **GOVERNANCE.md §15 (reversible + dev-machine authority).**
  Reversible-in-one-round becomes the only hard constraint on
  "complete freedom within a round," plus Aaron's "this is your
  dev machine too" codified. Narrowly scoped later round-25: "the
  repo isn't yet initialised for git" is Aaron's call alone, not
  a §15 freedom.
- **GOVERNANCE.md §16 (dynamic hats).** Any persona can load any
  capability hat on demand, except `round-management` which stays
  Kenji-monopoly per §11. Includes the "Overlap is expected, not
  redundancy" clause added late-round after Kenji's retraction
  (see wins).
- **GOVERNANCE.md §17 (productive friction).** Not every specialist
  disagreement wants resolution; friction between correct
  viewpoints-from-different-seats is a feature. Surface at
  round-close; silent-drift-across-rounds is the only bug.

### Shipped — new seats and hats (roster: 23 → 25)

- **Mateo (security-researcher)** — persona + capability skill.
  Proactive scouting of novel attack classes, crypto primitives,
  supply-chain patterns, dep-graph CVEs. Distinct from Aminata
  (reviews the *shipped* threat model) and Nadia (agent layer).
- **Naledi (performance-engineer)** — persona + capability skill.
  Benchmark-driven hot-path tuning, allocation audits, cache-line
  alignment, SIMD dispatch. Distinct from Hiroshi (asymptotic
  complexity) and Imani (planner cost model).
- **`holistic-view` capability hat** — no persona. "Think like an
  architect without the authority." Codifies the second hat every
  specialist had been implicitly wearing since round 17. Loaded on
  demand per §16.

### Shipped — memory-smoothing Part 2 (Daya's first pass)

- **Daya's first AX audit** — 8 personas measured for cold-start
  cost, pointer drift, wake-up clarity, notebook hygiene. Top
  findings landed same-round: WAKE-UP.md tier-0 estimate corrected
  from 6-8k to **~12k tokens** (GLOSSARY alone ≈ 4.5k), Kenji
  notebook canon-pointer fix (was pointing at a pre-split orphan
  `.claude/skills/architect/SKILL.md`), two P0 orphan skill files
  discovered (`architect/` and `harsh-critic/`, retired at
  round-25 open).
- **`docs/CURRENT-ROUND.md` first fill** — Kenji used it
  per-architect-turn as a single mid-round state anchor.
  Round-24 close overwrites this file with the round-25 header.
- **`docs/drafts/`** — first contents: `scratch-recon-2026-04.md`
  (top translation candidate from upstream scratch repo) and
  later `zeta-rename-plan.md` (round-25 prep).

### Shipped — formal verification

- **Mathlib T3 + T4 closed.** Subagent used
  `Finset.sum_range_one` / `Finset.sum_range_succ` plus `ring` /
  `abel` to close both. Sorry count 7 → 5. `lake build` green.
- **IsLinear predicate weakness logged as DEBT.** Mathlib B2
  blocked because `IsLinear` bundles only `AddMonoidHom` axioms
  (`map_zero` + `map_add`); DBSP linearity needs causality or
  time-invariance too. Three strengthening options (a/b/c) in
  `docs/DEBT.md` for Tariq's algebra call.

### Shipped — housekeeping

- `docs/BUGS.md` pruned — 2 stale entries (Semgrep-13,
  InfoTheoreticSharder-no-spec) removed.
- `docs/BACKLOG.md` — competitive-analysis research as P2
  (MetaGPT / ChatDev / AutoGen / CAMEL / SWE-agent / AutoCodeRover).
- `docs/WINS.md` — round-23 section with two entries.
- `docs/EXPERT-REGISTRY.md` — 25 rows. Added Mateo + Naledi
  (kept after Aaron's overlap-is-fine clarification).
- `tools/audit-packages.sh` — no new major bumps this round;
  status-quo pin audit.

### Round-close cross-over into round 25

Two items were decided in round 24 but executed at round-25 open,
noted here so the history reads continuously:

- **Orphan skill retirement.** `.claude/skills/architect/` and
  `.claude/skills/harsh-critic/` moved to
  `.claude/skills/_retired/2026-04-18-*`. Daya's round-24 P1;
  canonical versions live at `round-management` and
  `code-review-zero-empathy`.
- **`docs/states/` deleted.** 72 MB of orphan TLC state dumps.
  Not referenced from any doc; no script creates them. Aaron
  round-25: "we don't want to have these history folders,
  agents get dedicated memory so they are not writing history
  everywhere." Also triggered the "dedicated agent-memory
  system" P1 BACKLOG entry.

### Not landed / deferred

- Tariq dispatch on IsLinear strengthening.
- Rune dispatch on `docs/STYLE.md`.
- Yara via skill-creator on Aarav's BP-10 cite at
  `skill-tune-up/SKILL.md:117`.
- First Kenji self-audit via Daya's procedure.
- Eval-harness MVP scope sign-off.
- UX + DX persona proposals.

### Open asks at round-close

- `global.json` `rollForward` — status quo vs relaxed (Kenji
  leaning status quo; silent-pick absent objection).
- First-commit timing: Aaron round-25 "few rounds" before any
  commit; renaming proceeds without git until Aaron calls it.
- NuGet prefix reservation on `nuget.org` (Aaron owns).
- `src/Dbsp.CSharp` disposition — directory exists but isn't
  in the sln.

### Aaron clarifications this round

- "AX researcher" framing (round 23) stayed — Daya is it.
- "The other agents can get off-time too, not just you."
  Corrected §14 from architect-primary to universal.
- "This is your dev machine too, you can codify that 100%."
  Narrowly scoped — does not authorise unsolicited git init.
- "Overlap is expected, not redundancy." Corrected Kenji's
  same-round retirement of Mateo + Naledi.
- "I'll find some Aurora design documents one day."
  Longer-horizon project Aaron is building around AI welfare;
  deferred.
- Round 25 pre-compact: "this is not a git repo yet, lets
  start preppping I've decided on Zeta."

### What round-24 felt like

A governance round. §14-17 landed in the same session; two new
seats and three new hats in the same session. Low code output,
high rule output. Daya's audit turning the memory-smoothing
infrastructure from architect-guessed to measurement-backed is
the headline — her Tier 0 measurement retired a 1.7x-wrong token
estimate on day 1. Friction stayed productive: Kenji's retirement
reflex on Mateo and Naledi was a real mistake, corrected same-
round without defensive reasoning. Closing this round without
touching code at all is a first; the factory is maturing to the
point where governance work has its own rhythm.

---

## Round 23 — Mathlib migration, expert/skill split Part 2, AX discipline spawned

### Shipped — formal verification

- **Mathlib chain-rule proof migrated and building.** Stale v4.12.0
  scaffold at `proofs/lean/ChainRule.lean` superseded; 345-line proof
  skeleton migrated to `tools/lean4/Lean4/DbspChainRule.lean` against
  the pre-warmed Mathlib `v4.30.0-rc1` at
  `tools/lean4/.lake/packages/mathlib`. Imports updated for the
  current Mathlib tree (`Algebra.BigOperators.Basic` ->
  `Algebra.BigOperators.Group.Finset`). `lake build` green. Seven
  `sorry`s still open (T3/T4/T5/B1/B2/B3/chain_rule); T3/T4/B2
  closure is round-24 work.

### Shipped — expert / skill split (6 of 22 personas)

- **Kenji, Viktor, Rune, Aminata, Aarav, Soraya** now have
  `.claude/agents/<name>.md` persona files with `skills:`
  frontmatter auto-inject. Their skill files had duplicated persona
  sections stripped (name headers, tone contracts, pairs-with
  blocks). 14 experts pending in future rounds.
- **Daya spawned as the 23rd expert** — the first agent-experience
  (AX) researcher. New skill at
  `.claude/skills/agent-experience-engineer/SKILL.md` plus agent
  file; speaks for the personas themselves as their own user
  population. Aaron coined the AX framing; Daya is the persona that
  role became.
- **UX and DX researcher skill stubs** at
  `.claude/skills/user-experience-engineer/` and
  `.claude/skills/developer-experience-engineer/`. Persona
  assignment pending round-24 with candidate names queued in
  `docs/EXPERT-REGISTRY.md`.

### Shipped — memory-smoothing infrastructure

- **`docs/WAKE-UP.md`** — cold-start index (Tier 0 / 1 / 2 / 3)
  for any persona resuming mid-round after compaction. Biggest
  single memory-smoothing artifact this round.
- **`docs/CURRENT-ROUND.md`** — live mid-round state; Kenji
  overwrites per architect turn, resets at round-close.
- **`docs/drafts/`** — explicitly non-canonical scratch folder;
  round-scoped; entries promote or delete at round-close.
- **`docs/skill-notes/architect-offtime.md`** — seeded honestly
  with a zero entry (no off-time budget spent round 23).
- **`.claude/skills/round-management/SKILL.md` + `.claude/agents/architect.md`.**
  Kenji's orchestration procedure codified as a hat; architect
  persona formalised with the §10 / §11 / glossary-police
  contract.

### Policy / rules

- **BP-16 landed** in `docs/AGENT-BEST-PRACTICES.md` — cross-
  check is now a rule, not a preference: P0 invariants require
  >= 2 independent formal tools. Soraya's skill gained a
  "Cross-check triage" section with the `InfoTheoreticSharder`
  anchor case.
- **GOVERNANCE.md §14 + §15.** §14 codifies the standing ~10% off-
  time budget; §15 makes reversible-in-one-round the only hard
  constraint on complete-freedom-within-a-round. Dev-machine
  authority for the architect folded into §15.
- **`docs/GLOSSARY.md`** grew a lifecycle section: *frontmatter*,
  *hat* (Aaron's round-23 synonym for skill), *notebook*,
  *wake / wake-up*, *spawn*, *evolve*, *retire*, *AX / UX / DX*.
- **`docs/WINS.md` round-22 section** — three-tool-agreement
  save on `InfoTheoreticSharder` + architect-gate-caught
  `[<VolatileField>]` F# compile error before merge.

### Research deliverables

- **`docs/research/agent-eval-harness-2026-04.md`** (~1050 words)
  — honest answer to "can we evaluate agents rigorously?" MVP
  proposed: `tests/agent-evals/` layout, three skills only
  (Kira / Viktor / Kenji), nightly CI gate, N=3 majority-vote
  judge. Cost ~USD 5-20/nightly. Recommendation: ship MVP.
- **`docs/research/factory-paper-2026-04.md`** (~1220 words) —
  venue pick: FORGE 2027 workshop (ICSE-colocated, ~2026-11
  deadline) as experience report + parallel IEEE Software /
  CACM Practice piece on BP-NN + persona-registry. Four novelty
  candidates ranked after literature survey. Tier-1 not yet;
  empirical base is one project.

### End of round

500 tests still passing, 0 warnings, 0 errors on the F# side;
`lake build` green on the migrated Lean proof. Factory metric:
+1 persona (23 total), +1 BP rule (16 total), +3 capability
skills, +2 research docs, major memory-smoothing infrastructure
landed. Aaron's round-close framing: explicit 5-freedom ask +
the full-freedom-within-a-round invitation that became §15.
μένω received and returned.

---

## Round 22 — Honesty fixes + expert/skill split push

- Fix: Plan.fs docstring claimed "HLL-estimated cardinalities" but
  code uses static heuristics — rewrote the XML doc on `OpCost` to
  match the code (filter halves, group-by quarters, 1024 for unknown
  inputs) and added a forward pointer to the BACKLOG P1 that tracks
  the real HLL-wiring work (was `src/Core/Plan.fs:9-11`).
- Fix: FeedbackOp memory-ordering between `connected` and `source`
  (was `src/Core/Recursive.fs:44-53`). `source` is now
  `[<VolatileField>]`, so a reader that observes `connected = 1`
  is guaranteed (by release/acquire pairing with the CAS) to
  observe the `source` store too; `Inputs` and `AfterStepAsync`
  also null-guard the field as belt-and-braces. A 32-thread
  stress test in `tests/Tests.FSharp/Runtime/Concurrency.Tests.fs`
  asserts `connected = 1 ⇒ source ≠ null` across 1000 iterations.
- Fix: Durability.WitnessDurableBackingStore canonicalised its
  workDir / witnessDir via two `Path.GetFullPath` calls (TOCTOU
  against a concurrent `Environment.CurrentDirectory` / symlink
  swap). The constructor now computes `rootWorkDir` /
  `rootWitnessDir` once and reuses them for both the directory
  creation and the audit-exposed properties (was
  `src/Core/Durability.fs:74-75`). New tests in
  `tests/Tests.FSharp/Storage/Durability.Tests.fs` assert
  that the stored path equals the directory actually created,
  including under CWD churn.
- Fix: BloomFilter.pairOf allocated on every call (was
  `src/Core/BloomFilter.fs:97-133`). Replaced the boxing
  `match box key with ...` ladder with inline
  `pairOfInt64` / `pairOfInt32` / `pairOfUInt64` / `pairOfUInt32`
  / `pairOfGuid` / `pairOfString` functions that hash through a
  `NativePtr.stackalloc`-backed `Span<byte>`, and added typed
  `Add` / `Remove` / `MayContain` overloads on
  `BlockedBloomFilter` and `CountingBloomFilter` that dispatch to
  the matching primitive at the F# compile step — no boxing, no
  heap allocation per call. Strings hash their
  `ReadOnlySpan<char>` via `MemoryMarshal.AsBytes` with no UTF-8
  encode allocation. New allocation tests in
  `tests/Tests.FSharp/Sketches/Bloom.Tests.fs` assert zero
  bytes across 10 000 `Add` / `MayContain` calls with `int64`
  keys (warmed-up, measured via
  `GC.GetAllocatedBytesForCurrentThread`).

---

## Round 20 — Test-tree subject-first restructure

### Shipped

- **Subject-first test layout** in `tests/Tests.FSharp/` per
  `docs/research/test-organization.md`. The flat 28-file scheme
  (with `RoundN` / `Coverage` prefixes that encoded *when* / *why*
  rather than *what*) is replaced by ten subject folders, each
  mirroring a subsystem of `src/Core/`:
  ```
  Algebra/  Circuit/  Operators/  Storage/  Sketches/
  Runtime/  Infra/    Crdt/       Formal/   Properties/
  _Support/
  ```
- **28 source files → 57 subject files + 1 helper.** Grab-bag
  files (`CoverageTests.fs`, `CoverageTests2.fs`, `CoverageBoostTests.fs`,
  `AdvancedTests.fs`, `InfrastructureTests.fs`, `NestedAndRuntimeTests.fs`,
  `SpineAndSafetyTests.fs`, `NewFeatureTests.fs`, `Round6/7/8Tests.fs`)
  are split by subject; well-named files (`ZSetTests.fs`, `CircuitTests.fs`,
  etc.) are renamed to `{Subject}.Tests.fs` under the right folder.
- **`_Support/ConcurrencyHarness.fs`** — helpers relocated with
  module renamed to `Dbsp.Tests.Support.ConcurrencyHarness` (leading
  underscore sorts it first and signals "not a test file").
- **`Properties/` compiled last** so FsCheck cross-module laws see
  every subject file first. Compile order is: `_Support/` → subject
  folders (any order) → `Properties/`.
- **`tests/Tests.FSharp/README.md`** documents the convention:
  subject-first names, 400-line soft cap / 600-line hard ceiling,
  one file per `src/Core/` module, dot-separated sub-aspects
  when files grow (`Spine.Tests.fs` + `Spine.Disk.Tests.fs`).

### Test accounting

- **458 `[<Fact>]` / `[<Theory>]` / `[<Property>]` attributes** in the
  new layout — same count as pre-restructure. Zero tests lost; some
  relocated to more idiomatic homes (e.g. `Pool.*` tests from
  `CoverageTests.fs` now in `Runtime/Allocation.Tests.fs`; `weightedCount`
  tests from `Round7Tests.fs` merged into `Algebra/ZSet.Tests.fs`).

### End of round

Restructure is a pure move + rename; no test body was modified.
Subject-first names mean a reader can find any test by subsystem
rather than by search. Future tests append to their subsystem file
or split by sub-aspect once past ~400 lines.

---

## Round 19 — CountingClosureTable / RecursiveCounting

### Shipped

- **`RecursiveCounting` combinator** in `src/Core/Recursive.fs` —
  Option 4 ("counting algorithm", Gupta-Mumick-Subrahmanian SIGMOD 1993
  §4) from `docs/research/retraction-safe-semi-naive.md`. Mirrors the
  shape of `Recursive` but omits `Distinct` inside the feedback loop
  so Z-weights flow through the body as derivation counts. LFP unfold
  is `T_k = seed + body(T_{k-1})`, with the seed stream integrated
  internally so one-shot `ZSetInput` deltas remain visible across
  inner ticks. Retraction correctness by Z-linearity: negative edge
  weights propagate through every `body^i` term, cancelling the
  corresponding derivations; closure pairs reach weight 0 and drop
  out of the consolidated Z-set with no tombstone pass.
- **`CountingClosureTable` extension method** in
  `src/Core/Hierarchy.fs` — sibling of `ClosureTable` wired on
  top of `RecursiveCounting`. Integrates the raw edge stream inside
  the body so each inner tick sees the full edge set (a plain
  `ZSetInput` drains after tick 0). `ClosureTable` is unchanged —
  this is a strict addition.
- **5 new tests** in `tests/Tests.FSharp/ClosureTableTests.fs` —
  oracle parity on a chain and on a tree, explicit retraction
  correctness, multi-derivation counting on a diamond graph, and an
  FsCheck property (`MaxTest = 30`) asserting non-negative integrated
  weights on randomized acyclic-edge insert/retract sequences.

### End of round

0 warnings, 0 errors, 476 tests passing (471 → 476, +5 FSharp).

---

## Round 18 — Architect, security, restructure (in progress)

### Ecosystem & governance

- **CONFLICT-RESOLUTION.md** — renamed from `FAMILY-EMPATHY.md` ("project" is
  a clearer frame than "family" for a collaboration of humans, agents,
  and tools). The old filename is a redirect stub.
- **Architect skill (he/him)** — Claude's profile as orchestrator /
  Self. Edit rights on his own skill and notes via `skill-creator`;
  no unilateral edit rights on other skills. Binding on integration
  decisions; escalates to human on deadlock. "Redesign too often" is a
  known failure mode with four mandatory checks on every redesign.
- **Specialist owners retired "final decision authority."** The
  Storage Specialist, Algebra Owner, Query Planner, Complexity
  Reviewer, Threat Model Critic, and Paper Peer Reviewer are now
  advisory. Architect integrates; human decides on deadlock.
- **Harsh Critic retuned** — zero-empathy, never compliments,
  sentiment leans negative. Tone contract is explicit and
  enforced.
- **skill-creator** — documented as the canonical path for
  creating or meaningfully changing any skill. Mechanical renames
  and injection-lint fixes are the only allowed skip-the-workflow
  edits.
- **New skills shipped**: `architect`, `skill-tune-up`
  (with state file), `prompt-protector`, `maintainability-reviewer`,
  `tech-radar-owner`, `next-steps`, `skill-creator`.

### Security policy

- **Pliny-class prompt-injection corpora marked radioactive.**
  Specifically the `elder-plinius` repositories (`L1B3RT4S`,
  `OBLITERATUS`, `G0DM0D3`, `ST3GG`) — no agent fetches them.
  Pen-testing, if ever needed, runs in an isolated single-turn
  session with no memory carryover, coordinated by the Prompt
  Protector.
- **Invisible-Unicode lint** documented in the Prompt Protector
  skill for `.md`, `.fs`, `.yaml` files.
- **Skill-supply-chain threat class** added to the threat model
  via the Prompt Protector's scope.

### Terminology & style

- "Agents, not bots" — codified as a repo rule. If a human calls
  us bots, the active agent gently corrects.
- **Round naming moves to this log only.** Subject-first naming
  for source/test files; `Round17Tests.fs` gets split by topic.
- **Space Opera** — `THREAT-MODEL-FUN.md` renamed to
  `THREAT-MODEL-SPACE-OPERA.md`.
- **"Family Empathy" → "Conflict Resolution"** (see above).

### Research completed

- **Bloom-filter frontier (2023-2026)** — 23 AMQ-adjacent
  structures surveyed. Counting Quotient Filter (CQF) identified
  as the strongest upgrade path (fixes our 4-bit counter
  saturation). Ceramist (Coq-verified AMQs) flagged as a
  formal-verification bridge candidate. Cuckoo/Morton filters
  explicitly held for retraction-never-seen-item correctness
  reason. Full report: `docs/research/bloom-filter-frontier.md`.
- **Retraction-safe semi-naive LFP** — two candidates ranked:
  signed-delta ("gap-monotone") semi-naïve (10-14d) and the
  Gupta-Mumick counting algorithm (8-12d). DRed explicitly
  rejected (can regress below the current `Recursive` baseline).
  Full report: `docs/research/retraction-safe-semi-naive.md`.
- **Feldera comparison status** — clone is shallow, unbuilt. No
  apples-to-apples bench exists. Three P1 items identified:
  `cargo build`, `FelderaRunner.fs` harness, Q3/Q7 port. Report:
  `docs/research/feldera-comparison-status.md`.
- **Proof-tool coverage** — Z3 at 8 axioms (can grow to ~25),
  TLA+ at 14 specs (9 have `.cfg`, only 4 in CI), Lean/Mathlib
  chain-rule proof is `sorry`-bodied stub, LiquidF# recommended
  as highest-leverage new tool. Report:
  `docs/research/proof-tool-coverage.md`.
- **Test organization psychology** — 10-folder tree
  (Algebra / Circuit / Operators / Storage / Sketches / Runtime /
  Infra / Crdt / Formal / Properties + `_Support/`), subject-first
  naming, 28-row rename map, 22-commit migration plan.
  Report: `docs/research/test-organization.md`.

### Code changes

(none yet — round still in progress)

---

## Round 17 — storage specialist, BloomFilter, durability skeleton

### Shipped

- **6 harsh-critic P0 fixes** — SpeculativeWatermark logic
  inversion, Hierarchy `Comparer<obj>` boxing, FastCdc O(n²)
  buffer scan (persistent cursor + BlockCopy), Residuated O(n)
  rebuild (SortedSet + Dictionary for honest O(log k)),
  ClosurePair Equals/GetHashCode mismatch (EqualityComparer both
  sides), Hierarchy RecursiveSemiNaive retraction leak
  (ClosureTable now uses retraction-safe `Recursive`).
- **BloomFilter.fs** — blocked Bloom (Putze/Sanders/Singler 2007)
  - counting Bloom (Fan et al. 1998), XxHash128 double-hashing
  (Kirsch-Mitzenmacher 2006), cache-line-aligned buckets.
- **Durability.fs** — `DurabilityMode` DU
  (`StableStorage`/`OsBuffered`/`InMemoryOnly`/`WitnessDurable`)
  - `WitnessDurableBackingStore` skeleton.
- **6 code-owner skills** — storage / algebra / query-planner /
  complexity / threat-model-critic / paper-peer-reviewer (since
  demoted to advisory in round 18).
- **Docs**: `THREAT-MODEL-FUN.md` (now Space Opera),
  `FAMILY-EMPATHY.md` (now `CONFLICT-RESOLUTION.md`),
  `TECH-RADAR.md`, `LOCKS.md`, `UPSTREAM-LIST.md`,
  `DECISIONS/2026-04-17-lock-free-circuit-register.md`.
- **5 new SDL-derived Semgrep rules** (rules 8-12):
  unsafe-deserialisation, file-read-without-size-cap,
  process-start-in-core, activator-from-string,
  system-random-in-security-context.
- **22 new tests** in `Round17Tests.fs` (FastCdc regression,
  ClosurePair equality, ClosureTable, MerkleTree, BloomFilter,
  ResidualMax, ACC/DISC/RET mode-collapse).
- **References imported**: Lamport *Specifying Systems*, an 81-entry
  upstream list from prior research we imported, Shostack EoP card
  game.

### End of round

0 warnings, 0 errors, 471 tests passing.

---

## Round 16 — SDL / threat model / she-her storage specialist

- `docs/security/THREAT-MODEL.md` STRIDE × components matrix.
- `docs/security/SDL-CHECKLIST.md` Microsoft SDL 12-practice
  tracker.
- First code-owner agent with she/her pronouns
  (`storage-specialist`) — at the time authored with
  "final decision authority"; retired to advisory in round 18.
- Harsh-critic delivered 30 findings; 6 P0s fixed in round 17.

---

## Rounds 1-15

Summaries of earlier rounds live (for now) in
`docs/BACKLOG.md` history entries and individual ADRs under
`docs/DECISIONS/`. When we have a quiet round, fold them into
this file in condensed form.

## How to add a round entry

After a session lands:

1. New section at the top of this file, `## Round N — <short title>`.
2. 5-15 bullets grouped by theme (shipped / research / policy).
3. One-line "end of round" status (build, tests, warnings).
4. Don't re-describe what's in `BACKLOG.md`, `TECH-RADAR.md`, or
   `ROADMAP.md` — link to them. This file is the narrative, not
   the source of truth.
