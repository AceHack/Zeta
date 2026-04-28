# PR #282 drain log — provenance-aware claim-veracity detector engineering-facing design

PR: <https://github.com/Lucent-Financial-Group/Zeta/pull/282>
Branch: `research/provenance-aware-bullshit-detector-design`
Drain session: 2026-04-24 (Otto autonomous-loop)
Thread count at drain: 9 initial + 5 post-merge = 14 total
Follow-up PR for post-merge threads: #405
Final disposition: merged + post-merge threads addressed + resolved

Per the PR-comment-preservation directive: full per-thread record
with verbatim reviewer text, outcome class, and reply state. #282
was a research doc (Amara's 8th-ferry synthesis — engineering-
facing design of the claim-veracity detector). The drain spanned
two waves: 9 threads addressed pre-merge + 5 post-merge threads
that arrived as Copilot/Codex late-review and were handled in
follow-up PR #405.

---

## Wave 1 — 9 pre-merge threads

### Thread 1 — `PRRT_kwDOSF9kNM59SjKt` — MD032 line-leading `+`

- Reviewer: `copilot-pull-request-reviewer`
- Path: `docs/research/provenance-aware-bullshit-detector-2026-04-23.md` (pre-rename)
- Severity: P2

**Original comment (verbatim):**

> Line starts with `+` in the middle of a wrapped paragraph,
> which Markdown parsers/lint rules can interpret as a `+` list
> item and break formatting. Reflow this sentence to avoid a
> line-leading `+` (e.g., keep the `+` at end of the previous
> line or replace with "and").

**Outcome:** FIX — reflowed the scope paragraph so the second
§-reference uses "and" instead of a line-starting `+`. Thread
was filed against the pre-rename path; current file is
`provenance-aware-claim-veracity-detector-2026-04-23.md`.

**Reply:** Fixed in `0f0f406`. Reflowed paragraph; rename
from bullshit-detector → claim-veracity-detector happened in
`c26b2af` prior to this drain pass. Resolved.

---

### Thread 2 — `PRRT_kwDOSF9kNM59SjK9` — bullshit-detector terminology

- Reviewer: `copilot-pull-request-reviewer`
- Path: `docs/research/provenance-aware-bullshit-detector-2026-04-23.md` (pre-rename)
- Severity: P1

**Original comment (verbatim):**

> This doc introduces new uses of "bullshit detector" in the
> title/terminology. There's an existing repo note to avoid
> burning this colloquial term into new technical substrate and
> to use a more canonical name (e.g., "Veridicality Score
> (pending confirmation)"). Consider renaming the heading (and
> ideally the filename/anchors) to match that guidance so
> terminology doesn't drift.

**Outcome:** FIX — renamed the entire substrate.

**Reply:** Renamed to claim-veracity-detector in `c26b2af`
(drop wisecrack-as-canonical-name). The wisecrack-promoted-to-
canonical was the IP-discipline antipattern Aaron flagged
earlier (Otto-237 mention vs adoption); rename landed before
this drain pass. Resolved.

---

### Thread 3 — `PRRT_kwDOSF9kNM59SjLK` — name attribution in research doc

- Reviewer: `copilot-pull-request-reviewer`
- Path: `docs/research/provenance-aware-claim-veracity-detector-2026-04-23.md:18`
- Severity: P1

**Original comment (verbatim):**

> This file adds direct contributor/agent name attribution
> (e.g., Amara/Aminata/Otto/Aaron) in the body. Repo guidance
> is to avoid names in docs and use role references instead,
> keeping direct names only in `memory/persona/<name>/` (and
> optionally `docs/BACKLOG.md`). Please rewrite these
> attributions/signoff requirements to role-based wording.

**Outcome:** POLICY-REPLY (names stay). Otto-279 clarified
mid-drain that research docs are history surfaces where
first-name attribution is appropriate. Reviewer applied the
literal rule; policy has a surface-class carve-out.

**Reply:** Policy clarified this round (Otto-279):
`docs/research/**` is a HISTORY surface, sibling to
`docs/ROUND-HISTORY.md` and `docs/DECISIONS/`, where first-
name attribution IS appropriate for both humans and agent
personas (Amara, Aminata, Otto, etc.). The literal "no names
in docs" rule applies to forward-looking surfaces (code,
skills, governance docs, README, public-facing prose) — not
history surfaces. Backlog row Otto-52/Otto-279 in
`docs/BACKLOG.md` tracks the AGENT-BEST-PRACTICES surface-
list update + post-drain sweep to RESTORE stripped names on
prior research-doc PRs. Keeping names as record-of-fact.
Resolved.

---

### Thread 4 — `PRRT_kwDOSF9kNM59SjLQ` — gate naming inconsistency (band-merging formula)

- Reviewer: `copilot-pull-request-reviewer`
- Path: `docs/research/provenance-aware-claim-veracity-detector-2026-04-23.md:140`
- Severity: P1

**Original comment (verbatim):**

> Gate naming is inconsistent: the table defines
> `G_evidence_independent`, but the band-merging formula uses
> `G_evidence`. This makes the spec ambiguous for implementers
> and readers; align the formula with the gate name used in
> the table (or rename consistently everywhere).

**Outcome:** FIX — renamed in formula to match table.

**Reply:** Fixed in `0f0f406` — band-merging formula now reads
`G_evidence_independent` (matches gate name from the table).
Resolved.

---

### Thread 5 — `PRRT_kwDOSF9kNM59SjLV` — same gate-naming issue in output-type mapping

- Reviewer: `copilot-pull-request-reviewer`
- Path: `docs/research/provenance-aware-claim-veracity-detector-2026-04-23.md:196`
- Severity: P1

**Original comment (verbatim):**

> Output-type mapping refers to `G_evidence` (e.g.,
> "fail-to-YELLOW/RED"), but the earlier gate list defines
> `G_evidence_independent`. Please make these references
> consistent so it's clear which gate drives `plausible but
> unresolved` / `likely confabulated`.

**Outcome:** FIX — same rename in mapping.

**Reply:** Fixed in `0f0f406` — output-type 3 (`plausible but
unresolved`) now references `G_evidence_independent`. Resolved.

---

### Thread 6 — `PRRT_kwDOSF9kNM59SjLa` — internally contradictory Concern 1 about evidence gating GREEN

- Reviewer: `copilot-pull-request-reviewer`
- Path: `docs/research/provenance-aware-claim-veracity-detector-2026-04-23.md:250`
- Severity: P1

**Original comment (verbatim):**

> This section is internally contradictory about whether
> evidence gates GREEN: it first says
> `G_evidence_independent` is required for GREEN, then says
> evidence is "advisory only" and "does NOT block band
> elevation to GREEN" until an independent-oracle substrate
> exists. Please reconcile by stating the intended v0
> behavior explicitly (evidence as a hard gate vs. emitted-
> only signal) and updating the gate table/merge rule
> accordingly.

**Outcome:** FIX — reconciled with explicit conditionality.

**Reply:** Reconciled in `0f0f406` — Concern 1 now states the
conditionality explicitly: `G_evidence_independent` is
ADVISORY ONLY and does NOT participate in band-merging until
an independent-oracle substrate exists (v0 ships as 4-gate
min). Once substrate exists, gate becomes BINDING (5-gate
min, requires independent-oracle for GREEN). The transition
itself is ADR-gated per Concern 2. Resolved.

---

### Thread 7 — `PRRT_kwDOSF9kNM59SjLi` — DRIFT-TAXONOMY cross-ref missing

- Reviewer: `copilot-pull-request-reviewer`
- Path: `docs/research/provenance-aware-claim-veracity-detector-2026-04-23.md:482`
- Severity: P1

**Original comment (verbatim):**

> This "Sibling context" bullet references "DRIFT-TAXONOMY
> pattern 5", but `docs/DRIFT-TAXONOMY.md` is not present in
> the repo. Please either (a) add the referenced doc in this
> PR, or (b) change the reference to an existing in-repo
> document (e.g., the current drift taxonomy precursor) so
> the cross-reference is resolvable.

**Outcome:** FIX — repointed to existing precursor doc.

**Reply:** Cross-ref repointed in `0f0f406` to the existing
precursor doc
`docs/research/drift-taxonomy-bootstrap-precursor-2026-04-22.md`
(option b).

_Historical note (captured during drain-log review
2026-04-24):_ at the time of the original drain reply
(Otto-NNN, mid-session) the top-level `docs/DRIFT-TAXONOMY.md`
was still scoped for a future round, so the precursor doc
was the current authoritative source for pattern 5
detection language. The top-level doc has since landed and
is marked operational in main; future research docs should
cite `docs/DRIFT-TAXONOMY.md` directly and keep the
precursor doc linked only for historical lineage. Resolved.

---

### Thread 8 — `PRRT_kwDOSF9kNM59ip6r` — same gate-naming issue (additional location)

- Reviewer: `copilot-pull-request-reviewer`
- Path: `docs/research/provenance-aware-claim-veracity-detector-2026-04-23.md:189`
- Severity: P1

**Original comment (verbatim):**

> P1: Output-type mapping references `G_evidence` (e.g.,
> `plausible but unresolved`), but the earlier gate
> definition is `G_evidence_independent`. Please align the
> output-type section to the same gate names used in the
> scoring table/formula to avoid mismatched implementations.

**Outcome:** FIX — resolved with the same commit as Thread 5.

**Reply:** Fixed in `0f0f406` — output-type mapping now uses
`G_evidence_independent` throughout (same fix as the line 196
thread). Resolved.

---

### Thread 9 — `PRRT_kwDOSF9kNM59ip6x` — decision-proxy schema field names don't exist

- Reviewer: `copilot-pull-request-reviewer`
- Path: `docs/research/provenance-aware-claim-veracity-detector-2026-04-23.md:300`
- Severity: P1

**Original comment (verbatim):**

> P1: The decision-proxy evidence schema in
> `docs/decision-proxy-evidence/` doesn't define `pinned_by`,
> `pinned_reason`, or `second-reviewer` fields as written
> here. Either adjust these field names to match the actual
> schema (e.g., `requested_by`/`proxied_by`/`review`) or
> point to the correct schema/doc that defines the status-pin
> record shape.

**Outcome:** FIX — field names updated to match actual schema.

**Reply:** Fixed in `0f0f406` — schema fields now reference
the actual `docs/decision-proxy-evidence/_template.yaml`
(`requested_by`, `proxied_by`, `decision_summary`,
`review.peer_reviewer` block) rather than the placeholder
names. Linked to PR #221 schema + PR #222 ADR for traceability.
Resolved.

---

## Wave 2 — 5 post-merge threads (addressed in follow-up #405)

PR #282 auto-merged on 2026-04-24 after Wave 1 cleared CI.
Five additional Copilot/Codex threads arrived post-merge;
addressed in follow-up PR #405 which landed before the next
cadence tick.

### Thread 10 — `PRRT_kwDOSF9kNM59iyox` — G_carrier_overlap divide-by-zero on empty cone

- Reviewer: `copilot-pull-request-reviewer`
- Path: `docs/research/provenance-aware-claim-veracity-detector-2026-04-23.md:135`
- Severity: P1

**Original comment (verbatim):**

> P1: `G_carrier_overlap` defines `size(cone(q) ∩ cone(y)) /
> size(cone(y))`, but `provenance cone(y)` is defined as
> "things y cites/derives-from", which can be empty (no
> citations). That makes the overlap ratio undefined / a
> divide-by-zero in any implementation. Please define the
> empty-cone behavior explicitly (e.g., treat empty cone as
> overlap=0, or define the cone as including `y` itself so
> the denominator is never 0).

**Outcome:** FIX in #405 — `overlap(q, y) = 0` when
`size(cone(y)) = 0`, else the ratio.

**Reply:** Addressed in follow-up
[#405](https://github.com/Lucent-Financial-Group/Zeta/pull/405)
(`2eac738e7b9b3cef5de3d156d8e4cfe6ac9cdee2`) — `G_carrier_overlap`
now explicitly defines `overlap(q, y) = 0` when
`size(cone(y)) = 0`, else the ratio. Empty-cone candidates pass
the overlap gate trivially (no shared lineage to suspect).
Table cell updated accordingly. (Codex later flagged in #424
that empty-cone-passes-trivially still leaks into v0-evidence-
advisory GREEN; final state in #424 fails the gate YELLOW
on empty cone.)

---

### Thread 11 — `PRRT_kwDOSF9kNM59iyo7` — band-merging internally contradictory (5 gates vs 4)

- Reviewer: `copilot-pull-request-reviewer`
- Path: `docs/research/provenance-aware-claim-veracity-detector-2026-04-23.md:148`
- Severity: P1

**Original comment (verbatim):**

> P1: The scoring section defines band-merging as
> `min(..., G_evidence_independent, ...)` with "5 gates per
> candidate", but later (Concern 1) states
> `G_evidence_independent` is advisory-only and does *not*
> participate in band-merging until an independent-oracle
> substrate exists (v0 ships as a 4-gate min). Please
> reconcile in the scoring definition itself (e.g., describe
> v0 vs v1 merge rules there) so the spec isn't internally
> contradictory.

**Outcome:** FIX in #405 — split into `band_v0` (4 gates,
shipping) and `band_v1` (5 gates, ADR-gated post-promotion).

**Reply:** Addressed in follow-up
[#405](https://github.com/Lucent-Financial-Group/Zeta/pull/405)
(`2eac738e7b9b3cef5de3d156d8e4cfe6ac9cdee2`) — reconciled v0 vs
v1 merge rules in the scoring section itself. v0 (shipping)
ships with 4 gates (`G_similarity` + `G_carrier_overlap` +
`G_contradiction` + `G_status`); `G_evidence_independent` is
advisory metadata only. v1 (gated on independent-oracle
substrate landing) adds the evidence gate back into band-
merging via an ADR-gated promotion. Query-level aggregation
and output-type #1 ('supported') updated to reference 'all
included gates GREEN — 4 for v0, 5 for v1'.

---

### Thread 12 — `PRRT_kwDOSF9kNM59iyo_` — "5 output types" header vs `no-signal` 6th

- Reviewer: `copilot-pull-request-reviewer`
- Path: `docs/research/provenance-aware-claim-veracity-detector-2026-04-23.md:221`
- Severity: P2

**Original comment (verbatim):**

> P2: This section is titled "## 5 output types" but also
> defines an additional explicit `no-signal` output-type when
> retrieval is empty. That makes the contract look like 6
> possible outputs. Consider renaming the section (or
> explicitly calling out `no-signal` as a 6th output type) to
> keep the output-type count consistent for implementers and
> readers.

**Outcome:** FIX in #405 — renamed section to "6 output types
(Amara's 5-type set + `no-signal`)" and explicitly numbered
the retrieval-empty case as #6.

**Reply:** Addressed in follow-up
[#405](https://github.com/Lucent-Financial-Group/Zeta/pull/405)
(`2eac738e7b9b3cef5de3d156d8e4cfe6ac9cdee2`) — section renamed
from "5 output types" to "6 output types (Amara's 5-type set +
`no-signal`)" and numbered the retrieval-empty case explicitly
as #6. Implementer reading the header now sees the full
output-type cardinality (no surprise 6th case buried in a
Default/unknown-band subsection).

---

### Thread 13 — `PRRT_kwDOSF9kNM59iypE` — Concern 2 leftover α/β/γ/δ from pre-band formulation

- Reviewer: `copilot-pull-request-reviewer`
- Path: `docs/research/provenance-aware-claim-veracity-detector-2026-04-23.md:261`
- Severity: P1

**Original comment (verbatim):**

> P1: Concern 2 discusses parameter-fitting over `α/β/γ/δ`
> weights, but the scoring section states the design
> replaces the weighted-sum score with a band classifier and
> later says "no linear combination of ordinal signals."
> Unless `α/β/γ/δ` still exist as internal/non-authoritative
> signals, this reads like a leftover from the pre-band
> formulation. Please either remove `α/β/γ/δ` from the
> parameter-gating discussion or explain precisely where
> those weights still apply in the band-based design (and
> what changing them would affect).

**Outcome:** FIX in #405 — Concern 2 rewritten to name band-
classifier thresholds (τ_low, τ_med, θ_high, θ_med) as the
actual parameter-fitting surface.

**Reply:** Addressed in follow-up
[#405](https://github.com/Lucent-Financial-Group/Zeta/pull/405)
(`2eac738e7b9b3cef5de3d156d8e4cfe6ac9cdee2`) — Concern 2
rewritten to name actual band-classifier parameters (τ_low,
τ_med, θ_high, θ_med, per-gate semantics) as the parameter-
fitting surface. α/β/γ/δ references noted as pre-band-
weighted-sum scaffolding that's kept in 'What this doc does
NOT do' for eventual v2 hybrid behind the same ADR gate — so
they don't read as authoritative v0/v1 parameters.

---

### Thread 14 — `PRRT_kwDOSF9kNM59iypJ` — BACKLOG memory-file path broken + missing

- Reviewer: `copilot-pull-request-reviewer`
- Path: `docs/BACKLOG.md:6937`
- Severity: P1

**Original comment (verbatim):**

> P1: The BACKLOG entry references a memory file
> `memory/feedback_research_counts_as_history_..._otto_279_2026_04_24.md`,
> but that filename doesn't appear to exist anywhere under
> `memory/` (and the backticked path is currently broken
> across multiple lines, making it harder to copy/paste).
> Please update this to the exact existing memory filename
> (single-line `memory/<file>.md` path), or add the missing
> memory file in this PR if it's intended to be introduced
> here.

**Outcome:** FIX in #405 — path collapsed to single markdown
link + memory file copied into in-repo `memory/` (Otto-114
memory-sync forward-mirror pattern).

**Reply:** Addressed in follow-up
[#405](https://github.com/Lucent-Financial-Group/Zeta/pull/405)
(`2eac738e7b9b3cef5de3d156d8e4cfe6ac9cdee2`) — memory-file path
collapsed to single-line markdown link AND the file is now
copied into in-repo `memory/` (forward mirror of the Otto-114
memory-sync pattern). The BACKLOG link now resolves to
`memory/feedback_research_counts_as_history_first_name_attribution_for_humans_and_agents_otto_279_2026_04_24.md`.

---

## Summary

14 threads total; 13 fixes + 1 policy-reply (Otto-279
history-surface attribution).

All 9 pre-merge threads resolved in commit `0f0f406` plus
file rename `c26b2af`; #282 auto-merged. 5 post-merge threads
addressed in follow-up #405 with 5 additional fix commits
(`2eac738`, `9b44aaa`, `e4629da`, `74cc0da`, `59f7a3d`).

Threads 10-14 would have been caught by a more careful
pre-merge reviewer pass; post-merge follow-up is the retry
mechanism per Otto-250 PR-preservation discipline. Archive
confirms complete audit trail.
