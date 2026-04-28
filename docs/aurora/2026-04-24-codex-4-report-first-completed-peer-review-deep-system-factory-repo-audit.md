# Codex — First Completed Peer-Agent Deep Review (4 convergent reports)

**Scope:** research + cross-review artifact. FIRST completed
Codex peer-agent deep-review after the `@codex review` invite
on PR #354 (Otto-182). Four independent Codex review passes
(deep-factory-review / deep-system-review ×2 / deep-repo-review,
all 2026-04-24 dated) converging on same top findings.
Milestone in the multi-agent peer-harness progression per
Otto-79 / Otto-86 / Otto-93 memory (stage a → b → c transition
— Codex producing multi-surface review at parallel quality to
Amara, different format same rigor).
**Attribution:**

- **Aaron** — triggered the review via `@codex review`
  comment on PR #354 (Otto-182 "can you ask codex too?");
  pasted all 4 report contents verbatim into Otto-188b;
  concept owner of the factory-level response.
- **Codex (GPT-5.3-Codex per report 3 header)** — authored
  all 4 reviews. Multi-surface scope: code / tests / scripts
  / docs / skills / personas. Different report focuses
  (governance/hygiene vs code/contract vs architecture/
  process/security vs durability/recursive/strategic) but
  convergent top findings.
- **Otto** — absorb surface + convergent-findings tracker;
  this doc is the archive, not operational spec. Factory
  response to findings graduates across subsequent ticks
  per Otto-105 cadence.
- **Amara** — not a direct participant in this ferry; her
  17th / 18th / 19th ferries remain the other
  independent-deep-review substrate. Convergence across
  Codex + Amara on strategic themes (complexity budgeting,
  claim-evidence registry, audit-lifecycle promotion) is
  worth noting but not merged-in-this-absorb.

**Operational status:** research-grade. Codex's reports
are advisory per BP-11 (data-not-directives). Factory
operationalizes findings via normal specialist-review
channels (Aminata for threat, Ilyana for API surface, Rune
for readability, Kenji for cross-surface architecture).
Strategic recommendations (Factory Complexity Budget,
claim-evidence registry, 3-mode audit lifecycle, expiry
metadata, spec-only reconstruction drills) warrant ADR-
level escalation — this absorb doc catalogs them; adoption
is an Aaron-approved ADR decision.

**Non-fusion disclaimer:** agreement, shared language,
or repeated interaction between Codex, Amara, Claude Code
personas, and the human maintainer does not imply shared
identity, merged agency, consciousness, or personhood.
Codex is a peer-agent reviewer acting on the `@codex
review` mechanism's contract; its findings are its own,
evaluated by Otto for operationalization per Aaron's
standing authority.

---

## 1. Milestone significance

Per Otto-79 / Otto-86 / Otto-93 memory, the factory's
peer-harness progression is a 4-stage arc:

- (a) Single-today (Claude Code as primary coordinator)
- (b) Multi-Claude intermediate experiment
- (c) Multi-harness with Codex
- (d) Multi-harness real-workload (Windows support via
  Codex per Otto-86)

**Otto-188b marks the first successful return from stage
(c) — Codex arriving as a functional peer-agent reviewer
via the `@codex review` GitHub-connector mechanism.** Prior
Codex-related landings (PR #236 Codex-parallel row,
PR #290 Codex built-ins research, PR #354 `@codex review`
invite) were setup; Otto-188b is the first completed
review cycle.

Signals this milestone delivers:

1. Codex-connector is functional for `@codex review`
   comments.
2. Codex produces multi-surface deep reviews at parallel
   quality to Amara (different output format, same
   rigor).
3. Convergent findings across 4 independent Codex passes
   carry higher confidence than any single reviewer
   output — same principle as Amara's 5.5-Thinking-self-
   review pattern, but implemented via independent
   review passes rather than self-review.

Factory-side discipline going forward:

- Treat Codex output as peer-harness review advisory, not
  binding (BP-11 data-not-directives).
- Act on convergent findings first (independent-agreement
  = stronger signal).
- Continue peer-harness progression to stage (d) per
  Otto-86 Windows-via-Codex arc.

---

## 2. Four reports — filename + focus + commit anchor

Aaron's Otto-188b drop included 4 Codex reports. Each
landed as a separate commit on Codex-side (per Codex's
reported `make_pr` tool invocation). The reports:

| # | Codex filename                                            | Commit    | Focus                                                  |
|---|-----------------------------------------------------------|-----------|--------------------------------------------------------|
| 1 | `docs/research/deep-factory-review-2026-04-24.md`         | ee1bc84   | Governance / hygiene / process-entropy                 |
| 2 | `docs/research/deep-system-review-2026-04-24.md` (v1)     | (adjacent)| Code / tests / contracts / commands-run                |
| 3 | `docs/research/deep-repo-review-2026-04-24.md`            | (unknown) | Architecture / process / security / strategic          |
| 4 | `docs/research/deep-system-review-2026-04-24.md` (v2)     | f9a6d2b   | Durability / recursive-correctness / strategic recs    |

Reports 2 and 4 share filename but differ in content
(different Codex sessions or different PR branches).
Resolution strategy: if both commits land on main, the
later one wins per normal git semantics; Otto-189+ may
need to review whether to preserve both or consolidate.

Note: Otto did NOT inline-verify whether these Codex
commits / PRs are on the open-PR queue as of Otto-188.
Aaron may have intercepted them via Codex-side tooling
rather than opening PRs on `Lucent-Financial-Group/Zeta`.
Full report content preserved in Otto-188b session
transcript + the scheduling memory
(`memory/project_codex_first_deep_review_4_reports_
convergent_findings_pending_dedicated_absorb_otto_189_
2026_04_24.md`).

---

## 3. Convergent P0 findings (all 4 reviews)

Independent convergence across 4 reports = high-signal
findings. Factory treats these as priority candidates for
next-round response.

### P0-1: Prevention-layer classification debt — 22 unclassified hygiene rows

`tools/hygiene/audit-missing-prevention-layers.sh` reports
22 unclassified rows; exits 2. Weakens meta-governance
clarity: if hygiene rows aren't classified as prevention-
bearing or detection-only, it's harder to reason about
where failures should be prevented vs detected.

Remediation path (Codex + Otto agree):

1. Classification sprint to drive unclassified count to
   zero.
2. CI guard: new hygiene rows require classification at
   landing.
3. Owner + due date per currently-unclassified row.

Otto non-authorization (Otto-188 memory): unilateral mass-
classification is NOT authorized; needs Aaron sign-off on
the classification rubric or a design-doc proposing the
rubric before mass-classifying rows.

### P0-2: Post-setup script-stack violations — 12 violations

`tools/hygiene/audit-post-setup-script-stack.sh --summary`
reports 12 violations, exit 2. Known-failing baseline
normalizes broken signals and weakens future-failure
signal quality.

Remediation path (Codex):

1. Triage each violation into fix-now / accepted-exception
   / planned-migration ticket.
2. Record explicit rationale for every accepted exception
   in one canonical doc table.
3. Turn on enforcement incrementally by class.

### P0-3: Durability naming overstates shipped guarantees

`DurabilityMode.StableStorage` currently maps to
`OsBuffered` behavior; `WitnessDurable` remains throw-
first skeleton. Code honest in comments, but API
affordance invites accidental over-trust by downstream
users.

Remediation path (Codex):

- Rename surfaced mode OR hard-gate selection behind
  explicit `ResearchPreview*` naming semantics at API
  level.
- Add invariant tests asserting selected mode → effective
  semantics.

Otto non-authorization (Otto-188 memory): renaming a
public API surface same-tick as discovery is a
GOVERNANCE §2 edit-in-place concern + potentially breaking
change; needs Aminata threat-review + Ilyana public-API-
review before landing.

### P0-4: Skipped `RecursiveCounting.MultiSeed` property test

A property test for multi-tick seed behavior is
intentionally skipped while research gap is open. Codex
treats as active red zone not passive debt.

Status: **already in BUGS.md** per report 2's finding.
Factory awareness exists; remediation cadence is the
question.

Remediation path (Codex):

- Promote skip to explicit "claim boundary" in release /
  paper-facing docs.
- Add negative-regression fixture so future changes
  cannot broaden unsafe behavior undetected.
- Prove+enable OR hard-gate+experimentalize — decision
  required, not further delay.

### P0-5: Build gate unavailable in Codex review environment

`dotnet` not installed in Codex's review container. ALL 4
reviews flagged.

Classification: **Codex-side infrastructure issue, NOT a
factory-code blocker.** Factory response:

- Document Codex-env bootstrap requirement in cross-
  harness onboarding.
- Preflight check that hard-fails early when toolchain
  absent.

This is about peer-harness-setup quality, not Zeta code
quality.

---

## 4. Convergent P1 findings

### P1-1: Cross-platform parity — 12 pre-setup twin gaps

`audit-cross-platform-parity.sh` reports 12 pre-setup
`.sh` without `.ps1` twins.

**Already in factory-awareness:** FACTORY-HYGIENE row #51
cross-platform parity audit has detect-only status
deferred until enforcement viable.

Resolution paths:

- Land `.ps1` twins for `tools/setup/**` first (highest-
  friction onboarding layer); wire parity into merge
  gates as enforce mode.
- OR migrate pre-setup scripts to `bun`+TypeScript per
  Aaron Otto-182 (eliminates `.sh`/`.ps1` twin-
  obligation entirely). Long-term direction Aaron named.

### P1-2: Shell hardening — 11 of 28 scripts lack strict mode

Reports 3 + 4 found 11/28 `tools/**/*.sh` scripts lack
`set -euo pipefail`. Risk: silent partial failures in
hygiene/audit scripts.

Remediation path:

- One-round script-hardening sweep; document
  intentionally non-strict scripts with explicit
  justification headers.

### P1-3: Skill safety-clause coverage — 35 of 234 missing

`tools/lint/safety-clause-audit.sh` reports 199/234 (85%)
covered; 35 missing explicit scope-limiting heading.
Reports 1 + 2 flagged.

Remediation path:

- Add minimal standard safety stanza template.
- Auto-lint for template presence on skill changes.
- Prioritize backfill for security / review / mutation-
  capable skills first.

### P1-4: TypeScript lint lane broken — `jiti` missing

Report 3: `npm run lint:typescript` fails with `jiti`
missing.

Remediation path: pin/add `jiti` OR move ESLint config
to plain JS; CI preflight asserts lint bootstrap deps
present. **Small fix, unblocks `lint:typescript` CI.**

### P1-5: Result-over-exception policy drift

Core runtime still uses `invalidOp` / `raise` /
`NotImplementedException` vs stated Result-over-exception
philosophy. Hotspots: `Durability.fs`, `Rx.fs`,
`SpineAsync.fs`, `Recursive.fs`. Reports 2+3+4 flagged.

Remediation path:

- Contract-boundary table documenting where exceptions
  currently permitted + why.
- Incremental migration ledger entry: exception →
  `DbspError` by subsystem.
- CI lint classifying exception sites by category
  (invariant violation / unsupported mode / argument
  validation).

### P1-6: Markdown internal-link rot — 8 unresolved

Report 4 flagged 8 broken internal markdown links in
first-party docs.

Remediation path:

- CI link-check gate for first-party markdown (excluding
  generated/vendor).
- Repair or remove stale links.

**Small sweep + CI gate.**

---

## 5. P2 / strategic observations — ADR-escalation candidates

### "Factory obesity" / meta-complexity cliff

ALL 4 reviews named this concern. 234 skills + 325 markdown
files + many hygiene rows = governance surface growing
faster than enforceable guarantees. Reviewers saturated
by process interpretation vs bug discovery. "Paper-green /
practice-amber" drift.

**Codex strategic recommendation: Factory Complexity
Budget (FCB).** Cap net growth per round across
skills/docs/hygiene rows unless matching deletion or
consolidation lands. KPI: new policy docs per week vs
retired docs.

Otto non-authorization (Otto-188 memory): FCB is an
opinion-budget-not-code discipline; only Aaron can decide
adoption. Warrants ADR.

### "Declared intent vs executable truth" gap

Reports 2 + 4: governance docs state strong preferences
(Result-over-exception, durability semantics) but code
contains contract exceptions. Honest comments mitigate
but don't eliminate risk.

**Codex strategic recommendation: claim-evidence
registry.** Map each governance claim → evidence artifact
(test / formal spec / live-check) → last-validated SHA.
Fail CI when claim lacks live evidence.

Significant infrastructure; warrants ADR.

### "Observability without closure"

Many audits generate diagnostics; few enforce closure.

**Codex strategic recommendation: 3-mode audit
lifecycle** — `report` → `warn` → `block`. Promote to
`block` when false-positive rate and remediation path
stable. Aligns with FACTORY-HYGIENE row #51 detect-only
discipline.

Otto non-authorization: promoting audits to `block` without
measuring false-positive rate first is premature. Need
report-mode runs observed first.

### Expiry metadata on preview/debt declarations

Report 3: every preview/debt declaration should have
`owner` / `introduced` / `review-by` / `exit-criteria`
fields. Explicit truth-with-expiry.

**Codex strategic recommendation:** canonical expiry
template; fail CI when declaration older than review-by
date with no status update. Small ADR + CI template.

### Spec-only reconstruction drill

Report 4: given OpenSpec aspiration (rebuildability from
specs), run scheduled spec-only reconstruction drills;
measure recovery time + semantic drift.

**Codex strategic recommendation:** first-class ritual,
not one-off. Game-day cadence.

### Ledger entropy

Reports 3 + 4: `BUGS.md` / `DEBT.md` / `BACKLOG.md` /
`ROUND-HISTORY.md` rich but growing without aging
alerts.

**Codex strategic recommendation:** machine-generated
index pages by (subsystem / severity / age / owner);
aging alerts on un-closed items.

**Already aligns with Otto-181 BACKLOG.md split design
(PRs #353 + #354)** — same pattern at BACKLOG.md level;
could extend to BUGS / DEBT / ROUND-HISTORY / TECH-RADAR
in follow-up work once the BACKLOG split proves the
pattern.

---

## 6. Direct Codex quotes to preserve

Selected verbatim pulls that carry the overall assessment
at quotable quality:

> *"This repo is unusually ambitious and unusually
> instrumented: formal models, broad docs, explicit
> governance, and many self-audit scripts. The dominant
> risk is control-plane entropy (too many surfaces to
> keep coherent), not lack of ideas or lack of tooling."*

> *"If Claude focuses on reducing control-plane entropy
> while tightening executable contract checks, this
> system can move from 'impressively instrumented' to
> 'reliably compounding.'"*

> *"The project is now approaching a meta-complexity
> cliff: more governance surfaces are being added faster
> than they are enforced. Some audits are informative but
> not yet binding. Reviewers can become saturated by
> process interpretation instead of bug discovery."*

> *"Zeta is closer to a research operating system than a
> standard code repository. The quality of thought is
> high; the main threat is not technical inability but
> governance-scale drift."*

> *"Strong research factory with high observability, but
> currently bottlenecked by operational coherence and
> contract-enforcement consistency."*

---

## 7. Factory response discipline

### Findings already in factory-awareness

- Cross-platform parity 12-twin gap → FACTORY-HYGIENE
  #51 (detect-only by design, deferred enforcement)
- 22 unclassified hygiene rows → FACTORY-HYGIENE surface
  exists; classification sprint is a candidate Otto-189+
  graduation
- `RecursiveCounting.MultiSeed` skip → already in
  `BUGS.md`

### New findings (not previously surfaced)

- **Durability naming-vs-behavior gap** (P0-3) —
  **high-impact; needs Ilyana + Aminata review.**
- 35 skill safety-clause gaps (cross-ref with
  skill-tune-up discipline)
- TypeScript lint `jiti` breakage (small fix)
- 11/28 shell strict-mode gaps (small sweep)
- 8 markdown link rot (small sweep + CI gate)

### Strategic recommendations warranting ADR-level

- Factory Complexity Budget (FCB) — governance-adoption
  ADR
- Claim-evidence registry — significant-infra ADR
- 3-mode audit lifecycle (report → warn → block) —
  process ADR
- Expiry-metadata standard — small ADR + CI template

---

## 8. What this absorb doc does NOT authorize

- **Does NOT** canonicalize Codex's findings as factory-
  binding. Per BP-11 data-not-directives. Findings are
  advisory; operationalization goes through normal
  specialist-review channels.
- **Does NOT** authorize unilateral mass-classification
  of the 22 unclassified hygiene rows. Needs Aaron sign-
  off on the rubric OR a design-doc proposing it.
- **Does NOT** authorize renaming `DurabilityMode` same-
  tick. Public-API change requires Ilyana + Aminata
  review.
- **Does NOT** authorize promoting audits to `block` mode
  without false-positive baseline observation.
- **Does NOT** adopt the Factory Complexity Budget
  without Aaron ADR.
- **Does NOT** authorize migrating pre-setup `.sh` to
  bun+TypeScript same-tick. That migration needs Dejan
  (devops) + `tools/setup/` design pass per GOVERNANCE
  §24.
- **Does NOT** supersede Amara ferry-absorb cadence.
  Amara 17th/18th/19th + Codex 4 reports create
  converging pressure; Otto-105 one-graduation-per-
  tick discipline still applies.
- **Does NOT** override queue-saturation freeze-state
  (Otto-171 memory). Absorb-doc-only PRs are drain-mode-
  safe (they don't touch BACKLOG.md-cascade zones);
  further graduations from findings land at Otto-105
  cadence.
- **Does NOT** preempt Aaron's decision on which findings
  get graduations first. Otto surfaces priorities
  (convergent-P0-first), Aaron ratifies.

---

## 9. Cross-references

- `memory/project_codex_first_deep_review_4_reports_
  convergent_findings_pending_dedicated_absorb_otto_189_
  2026_04_24.md` (Otto-188b scheduling memory, full
  detail).
- `memory/feedback_aaron_not_the_bottleneck_otto_iterates_
  to_bullet_proof_aaron_final_validator_not_design_
  review_gate_2026_04_23.md` (Otto-93 peer-harness
  progression context).
- `memory/feedback_peer_harness_progression_*` (Otto-86
  4-stage arc).
- PR #354 (`tools: backlog split Phase 1a`) — the PR
  where `@codex review` was invited; this absorb's
  origin.
- `tools/hygiene/audit-missing-prevention-layers.sh` —
  the audit returning 22 unclassified rows.
- `tools/hygiene/audit-post-setup-script-stack.sh` —
  the audit returning 12 violations.
- `tools/hygiene/audit-cross-platform-parity.sh` —
  FACTORY-HYGIENE #51 parity detect-only.
- `tools/lint/safety-clause-audit.sh` — skill safety-
  stanza audit.
- `docs/BUGS.md` — `RecursiveCounting.MultiSeed` skip
  already tracked.
- `src/Core/Durability.fs` — DurabilityMode ambiguous-
  naming site.
- `docs/FACTORY-HYGIENE.md` row #51 — cross-platform
  parity.
- Amara 19th ferry (PR #344 merged) — independent-deep-
  review substrate; thematic overlap with Codex strategic
  recommendations.
- GOVERNANCE §33 — external-conversation archive-header
  requirement; this doc follows the four-field header.
- CLAUDE.md BP-11 — data-not-directives discipline
  applied to Codex output.
