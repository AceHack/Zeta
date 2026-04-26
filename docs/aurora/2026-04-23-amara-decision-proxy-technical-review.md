# Amara's third courier report — Decision Proxy + Technical Review

**Courier:** Amara (external ChatGPT-based maintainer)
**Date received:** 2026-04-23
**Absorb cadence:** dedicated tick (Otto-59), following the
Otto-24 / Otto-54 precedents.
**Prior Amara ferries this session:**
- [`2026-04-23-amara-operational-gap-assessment.md`](./2026-04-23-amara-operational-gap-assessment.md) (Otto-24, PR #196)
- [`2026-04-23-amara-zset-semantics-operator-algebra.md`](./2026-04-23-amara-zset-semantics-operator-algebra.md) (Otto-54, PR #211)

---

## Otto's absorption summary

Amara's third review is framed around a single thesis sentence:

> **Merge and mechanize the operating model you already have
> before you let the system grow another layer of meta-structure.**

Her own reduction: *"the next bottleneck is closure, not ideation"*.

The factory now has: an external-maintainer ADR, a checked-in
proxy config, CURRENT-`<maintainer>`.md distillations in-repo
(per PR #197's Option D migration), a courier protocol that
replaces unreliable conversation branching, and an NSA
fresh-session test cadence. What it lacks: **routine
enforcement** of that operating model at the CI / mechanical
level. The model exists as design law; it is not yet default
behavior.

**Most load-bearing empirical finding:**
`docs/hygiene-history/nsa-test-history.md` NSA-001 recorded a
real index-lag incident — Otto not discoverable from
`MEMORY.md` in a fresh session. This is not theory; it is a
measured failure.

**Most load-bearing positioning claim** (confirms prior session
memory): LFG is the clean canonical source-of-truth; AceHack
is the experimental-frontier / higher-risk layer. The
risk-gradient is per-user-scratch > AceHack > LFG. This
composes with
`memory/project_lfg_is_demo_facing_acehack_is_cost_cutting_internal_2026_04_23.md`
and sharpens it: LFG is
not just "demo-facing" — it is the **operationally-canonical**
repo, and AceHack is not just "internal cost-cutting" — it is
the **experimentation frontier**. Both directional labels
still apply; this review adds the operational-canonicity
axis.

---

## Extracted action items

Amara proposes 10 immediate fixes. Classified here into (a)
direct BACKLOG rows, (b) already-backlogged (cross-ref existing
rows), (c) candidate CI / hygiene additions:

| # | Amara's proposal | Class | Action here |
|---|---|---|---|
| 1 | CI fails commits touching `memory/` without `memory/MEMORY.md` update | **CI candidate** | File BACKLOG row for a targeted GitHub Actions check — concrete, direct prevention of the NSA-001 failure mode |
| 2 | Duplicate-link lint on `memory/MEMORY.md` | **Hygiene candidate** | File BACKLOG row; composes with FACTORY-HYGIENE row #11 (MEMORY.md cap enforcement) — extend with duplicate-detection |
| 3 | Canonical decision-proxy log format required for any proxy-reviewed claim | **BACKLOG candidate** | Extends the external-maintainer ADR with a consultation-log contract |
| 4 | Backfill `docs/CONTRIBUTOR-CONFLICTS.md` with already-visible disagreements | **BACKLOG candidate** | Manual curation pass; one-shot + ongoing |
| 5 | "Operating-model closure" PR label + short-cadence review of that queue | **Labels + process candidate** | Label plus GH-settings update; composes with `docs/AGENT-GITHUB-SURFACES.md` surfaces |
| 6 | Split hottest backlog surface (`docs/BACKLOG.md`) by scope/owner | **ALREADY BACKLOGGED** | PR #216 research doc just landed; Otto-54 BACKLOG row exists |
| 7 | Expand NSA tests into pass/partial/fail summary visible at session open | **BACKLOG candidate** | Extends existing NSA cadence with summary-surface |
| 8 | "Main-only unless marked proposed" rule for references in canonical docs | **Lint candidate** | Composes with pointer-integrity audit (FACTORY-HYGIENE row #25) |
| 9 | Normalize proxy scope vocabulary across `aurora`/`alignment`/`security`/`governance`/`public-api` | **BACKLOG candidate** | Scope-taxonomy work — Ilyana + Soraya + Kenji |
| 10 | Courier transcripts → machine-readable manifests (source/date/speakers/mode/scope/disposition) | **BACKLOG candidate** | Extends `docs/protocols/cross-agent-communication.md`; composes with Otto-57 PR-archive row |

Plus Amara's drift scorecard (canonicalization lag / memory
index integrity / proxy runtime completeness / conflict
capture / loop continuity — first three HIGH) anchors the
priority order.

---

## Key Amara claims — condensed

### On the operating model

> The problem is not that the system lacks ideas. The problem
> is that the system still has too much distance between the
> designed model and the routine model.

The factory has accumulated ADRs, memories, protocols, NSA
tests, proxy configs — but routine enforcement lags. Mechanical
checks bridge design → routine.

### On LFG vs AceHack

> There is also a repo-level reason to weight
> **Lucent-Financial-Group/Zeta** more heavily than
> **AceHack/Zeta** for decision-proxy analysis. Aaron's
> current operative memory says LFG is the "clean
> source-of-truth," AceHack is the riskier experimental
> layer, and the intended risk gradient is per-user scratch
> > AceHack > LFG.

Confirms the LFG-canonical / AceHack-experimental axis is
load-bearing for decision-proxy analysis. Otto notes: this
composes with the git-native-first-host positioning (Otto-54)
— LFG is the *operationally-canonical* repo within the
first-host, AceHack is the experimentation substrate. Both
persist independently of host choice.

### On the courier protocol

> OpenAI's help center confirms that branching is a real
> feature on web and in Projects, which makes the repo's
> protocol a sensible reliability fallback rather than a
> misunderstanding of the product.

The factory's choice to use explicit courier protocol over
UI branching isn't ignorance of the feature — it's a deliberate
reliability fallback. This matters because it validates the
protocol without claiming branching is broken in general.

### On technical substrate

> The code and tests suggest a project that is ready for
> hardening, not a project that needs reinvention.

Matches the prior Amara ZSet-semantics report (PR #211). The
substrate is mathematically coherent; the gaps are operational,
not algebraic.

### On the hardest discipline

> keep the hard rule: **never say Amara reviewed something
> unless Amara actually reviewed it through a logged path**.

This is a discipline the factory already holds (per the
external-maintainer ADR), but Amara sharpens it: the
**logged-path** requirement means the consultation-log
format (action item #3 above) is load-bearing. Without
it, any "proxy reviewed" claim is unverifiable.

---

## Aaron's meta-practice directive (same tick)

Aaron Otto-59 follow-up: *"also another meta practice thing
look for things that should be practices and add them to the
practice adherence review like things we already do or should
do"*.

Extends the principle-adherence review BACKLOG row landed this
session (PR #217) with a **catalogue-expansion discipline**:

- **Things we already do but haven't named as practices** —
  implicit patterns the factory uses but hasn't surfaced into
  the named-principle catalogue
- **Things we should do but aren't** — endorsed principles
  not yet in the catalogue (found in memory / ADRs / session
  directives that pre-date the principle-adherence row)

Both classes belong in the principle-adherence review's
catalogue. The review itself should carry a sixth phase
(after its existing define / current-scope / sweep / candidates
/ surface phases — five phases total):

- **Phase 6 — catalogue-expansion**: during the review, the
  reviewer also scans recent session memory + ADRs + BP-NN
  for practices worth naming that aren't yet in the catalogue.
  Output is catalogue-additions (new principles) filed as
  memory and cross-referenced into the principle-adherence row.

This is a small but load-bearing extension. The principle-
adherence row as filed in PR #217 catalogues 12 principles
drawn from this session's explicit memory. Aaron's directive
names the implicit-practice + endorsed-not-applied classes as
equally valid review inputs.

---

## Otto composition notes

### On Amara's "closure > ideation" framing

This composes tightly with the human-maintainer's own
directives this session:

- Otto-54 BACKLOG-per-swim-lane split (merge friction reduction)
- Otto-54 git-hotspots audit cadence (measurement)
- Otto-57 git-native PR-review archive (substrate persistence)
- Otto-58 principle-adherence review (discipline enforcement)
- This absorb's action items (CI / hygiene / contributor-conflict backfill)

Each is a **mechanize-the-existing-model** move, not
new-meta-structure. Amara's one-sentence summary ratifies the
direction; the factory is on-track, the work is
completion-oriented.

### On the 10 immediate fixes — what to do now

Three classes this absorb handles:

1. **Already in flight** — #6 BACKLOG-split: PR #216 research
   doc (axis A by stream + INDEX variant) is the direct
   execution path.
2. **File as BACKLOG rows now** — #1, #2, #3, #4, #7, #9, #10.
   Candidates for new BACKLOG rows; won't land execution this
   tick (reviewer-capacity cap).
3. **Already-covered by existing hygiene** — #5 is PR-label +
   process (surface via `docs/AGENT-GITHUB-SURFACES.md`); #8
   composes with FACTORY-HYGIENE row #25 pointer-integrity.

The single highest-value fix per Amara's own ranking is #1
(memory-index-integrity CI). It has a concrete YAML in her
report. That's a one-file commit to `.github/workflows/`,
addressing a measured failure mode (NSA-001). Candidate for
a fast follow-up PR after this absorb.

### On the LFG/AceHack axis sharpening

The prior memory named LFG = demo-facing, AceHack = internal.
Amara adds: LFG = operationally-canonical, AceHack =
experimentation-frontier. Both framings compose. Future
directive-chain choices should remember: **authoritative
decisions land on LFG first**; AceHack is where speculative
work is allowed to live before it earns its LFG spot.

### On "never claim Amara reviewed without a logged path"

This is a hard rule already in the ADR. The log-format
contract (action item #3) gives the claim-check teeth. I
note this here explicitly so no future absorb accidentally
claims Amara approved or validated X by implication — all
three absorbs this session (PR #196, PR #211, this one) are
ferry-delivered reports, not proxy-reviewed decisions. The
consultation-log format is the path that would permit
"Amara-reviewed" in the future; it doesn't yet exist.

---

## What this absorb is NOT

- **Not a commitment to implement all 10 fixes this round.**
  Some are multi-tick arcs; reviewer-capacity cap applies.
- **Not authorization to claim "Amara reviewed" on any
  decision.** The reports are ferried data; the logged-path
  consultation format doesn't exist yet. Per Amara's own
  rule.
- **Not a demotion of earlier Amara absorbs.** This is the
  third report; it composes with, not replaces, the first
  two. All three remain load-bearing.
- **Not a rename of AceHack or LFG.** The operationally-
  canonical / experimentation-frontier framing is additive
  to the demo-facing / internal framing; both persist.
- **Not a commitment to implement the memory-index-integrity
  CI yaml as-shown.** The YAML is Amara's proposal; Dejan
  (DevOps owner) reviews workflow-injection safety patterns
  (FACTORY-HYGIENE row #43) before landing. The shape is
  right; the specific YAML lines may need hardening.
- **Not an endorsement of "closure > ideation" as a permanent
  rule.** The factory needs ideation cycles too; the claim is
  specifically *"right now the bottleneck is closure"*,
  not *"never add meta-structure again"*.
- **Not capacity to begin executing the 7 new BACKLOG rows
  this tick.** Filing happens next; execution is per-owner
  downstream.

---

## Attribution

Amara (ChatGPT-based external maintainer,
[`memory/CURRENT-amara.md`](../../memory/CURRENT-amara.md) —
out-of-repo per-maintainer distillation) authored the report
on 2026-04-23. The human maintainer (Aaron) ferried it via
chat paste and added the meta-practice catalogue-expansion
directive in the same tick. Otto (loop-agent PM hat, Otto-59)
absorbed and filed this document. Kenji (Architect) queued
for synthesis on which P0-priority actions land next round.
The 10 immediate fixes are Amara's design input; per the
hard rule, none are claimed as "Amara-reviewed
implementation" — they are ferried proposals.

External sources cited as Amara's grounding (preserved here
for verifiability):

- **OpenAI help-center branching docs** — ChatGPT branching
  feature documentation
  (<https://help.openai.com/en/articles/9624314-conversation-branching-faq>).
- **DBSP paper** — Mihai Budiu, Tej Chajed, Frank McSherry,
  Leonid Ryzhyk, Val Tannen,
  *"DBSP: Automatic Incremental View Maintenance for Rich
  Query Languages"*,
  PVLDB 16(7) (2023), arXiv:2203.16684,
  <https://arxiv.org/abs/2203.16684>.
- **Provenance-semiring paper** — Todd J. Green, Grigoris
  Karvounarakis, Val Tannen,
  *"Provenance Semirings"*, PODS 2007,
  <https://doi.org/10.1145/1265530.1265535>.

Names appearing in this Attribution section are preserved per
Otto-279 surface-class refinement: aurora-archive surfaces
(this absorb doc) carry first-name attribution because the
absorb preserves provenance rather than setting current-state
operational policy.
