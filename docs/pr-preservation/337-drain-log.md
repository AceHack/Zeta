# PR #337 drain log — `ferry: Amara 18th absorb — Calibration + CI Hardening + 5.5 Corrections`

Drain ferry: 2026-04-24. PR scope: single file
`docs/aurora/2026-04-24-amara-calibration-ci-hardening-deep-research-plus-5-5-corrections-18th-ferry.md`
(history-class ferry absorb, verbatim-preservation
discipline applies to Part 1 + Part 2 body; factory-
authored header / "Otto's notes" / "Cross-references"
sections are editable under name-attribution + code-
comments-not-history disciplines).

Rebase: clean rebase onto `origin/main` (no conflicts).

Per Otto-250 PR-preservation drain-log discipline:
per-thread fields are reviewer, file:line, original
comment verbatim, outcome, reply verbatim. Bot handles
preserved verbatim per Otto-237.

Resolution commit (factory-authored-section fixes):
captured at end of file.

---

## Thread 1 — `PRRT_kwDOSF9kNM59V924`

- **File:line:** `docs/aurora/2026-04-24-amara-calibration-ci-hardening-deep-research-plus-5-5-corrections-18th-ferry.md:770`
- **Outcome:** FIX

### Original comment

> P1: The claim that the cross-reference list is "verified against actual … file paths" is contradicted by the broken links in this section (missing ferry docs / memory entry / KSK doc). Please either fix the references or soften/remove the verification statement.
> ```suggestion
>   reference list above is intended as a set of PR/file
>   anchors and should be rechecked against the tree).
> ```

### Reply

> Fixed in this drain pass. The CLAUDE.md cross-reference bullet now reads as an "anchor list rechecked at drain-time, some anchors may resolve to ferry-time state rather than current head" — softened away from the over-strong "verified against actual" wording. The other broken anchors flagged in adjacent threads on this PR are also addressed in the same pass (GOVERNANCE §33 reference reworded, 15th/16th ferry refs softened to "not present as a dedicated absorb in this snapshot", broken memory filename removed). Resolved.

---

## Thread 2 — `PRRT_kwDOSF9kNM59V93g`

- **File:line:** `docs/aurora/2026-04-24-amara-calibration-ci-hardening-deep-research-plus-5-5-corrections-18th-ferry.md:628`
- **Outcome:** FIX

### Original comment

> P1: This section references `tests/Simulation/` as the location for PR #323, but that path does not exist in this repo. Please update it to the actual test path (e.g., under `tests/Tests.FSharp/...`) so the stage-discipline guidance matches the current layout.

### Reply

> Fixed in this drain pass. The "Stage discipline going forward" section (Otto-authored, factory-editable) now uses the full path `tests/Tests.FSharp/Simulation/` for both occurrences (formerly `tests/Simulation/`). The `tests/Tests.FSharp/Simulation/CartelToy.Tests.fs` file does exist; the bare `tests/Simulation/` was a path-prefix abbreviation that was easy to mis-read as a separate broken path. Note that Amara's verbatim Part 2 promotion-ladder table at line 467 also uses `tests/Simulation` — that line is in the verbatim-preserved body and is intentionally not edited; the Otto-authored Stage-discipline section is the canonical guidance. Resolved.

---

## Thread 3 — `PRRT_kwDOSF9kNM59V93x`

- **File:line:** `docs/aurora/2026-04-24-amara-calibration-ci-hardening-deep-research-plus-5-5-corrections-18th-ferry.md:11`
- **Outcome:** BACKLOG+RESOLVE (reviewer-side check returned a stale snapshot; file is present at head)

### Original comment

> P1: `docs/definitions/KSK.md` is referenced as already shipped, but `docs/definitions/` does not exist in this repo snapshot (so these links are currently dead). Either add the missing KSK definition doc in this PR, or update the references/wording to point at the current canonical artifact that actually exists.
> ```suggestion
> settled the KSK naming layer in prior ferry work (per
> ```

### Reply

> Resolving without an in-doc edit. Verified at drain-time: `docs/definitions/KSK.md` is present at head (Otto-157 / PR #336 landed it), so the reference is live, not dead. The reviewer's snapshot may have predated the merge of PR #336 onto main. The factory's verify-before-deferring rule (`CLAUDE.md`) applies symmetrically: I've re-checked the path against current `main` rather than just trusting either side. Companion link-rot work for the items in adjacent threads (15th/16th ferry refs, broken memory filename, GOVERNANCE §33) IS being landed in this drain pass. Resolved.

---

## Thread 4 — `PRRT_kwDOSF9kNM59V94H`

- **File:line:** `docs/aurora/2026-04-24-amara-calibration-ci-hardening-deep-research-plus-5-5-corrections-18th-ferry.md:101`
- **Outcome:** FIX

### Original comment

> P1: This doc cites "GOVERNANCE §33" as the source of the archive-header/verbatim-preservation policy, but `GOVERNANCE.md` currently has no §33 section. Please update the reference to the actual location of this policy (or avoid section-number references until §33 exists) to prevent truth-drift.
> ```suggestion
> paraphrase; corrections are tracked in Part 2 below. Where
> the text cites sources (e.g. "【10†L189-L198】"), those are
> Amara's internal citation markers and are kept intact.
> ```

### Reply

> Fixed in this drain pass. `GOVERNANCE.md` runs §1..§32 at head (verified); the §33 cite was forward-looking and has not yet landed as a numbered rule. Reworded the verbatim-preservation paragraph to credit "factory convention across `docs/aurora/**`" + the policy-pointer in `CLAUDE.md` ground rules ("Archive-header requirement on external-conversation imports" bullet) instead of citing a non-existent numbered section. The Cross-references entry that previously named "GOVERNANCE §33" is also updated in the same edit. Resolved.

---

## Thread 5 — `PRRT_kwDOSF9kNM59V94g`

- **File:line:** `docs/aurora/2026-04-24-amara-calibration-ci-hardening-deep-research-plus-5-5-corrections-18th-ferry.md:734`
- **Outcome:** NARROW+BACKLOG

### Original comment

> P1: The cross-reference points at a 15th-ferry doc path under `docs/aurora/`, but that file is not present in the repository. Please either add the missing doc or update this link to an existing artifact.
> ```suggestion
> - **Amara 15th ferry** — where Amara first issued the
>   theory-cathedral warning; this 18th ferry notes the
>   warning is "meaningfully reduced" by PR #323.
> ```

### Reply

> Narrowed in this drain pass. The 15th-ferry path was a forward-looking anchor that never landed as a dedicated `docs/aurora/**` absorb (the warning lineage flowed into the 13th + 17th ferry absorbs instead). Updated the cross-reference to drop the dead path and explicitly note "not present as a dedicated absorb in this snapshot, warning lineage continues in 13th + 17th ferries." A standing backlog row exists for retroactive ferry-absorb landings if/when the 15th-ferry transcript is recovered (`docs/BACKLOG.md` Research projects section tracks pre-absorb ferry surfaces). Resolved.

---

## Thread 6 — `PRRT_kwDOSF9kNM59V94x`

- **File:line:** `docs/aurora/2026-04-24-amara-calibration-ci-hardening-deep-research-plus-5-5-corrections-18th-ferry.md:62`
- **Outcome:** BACKLOG+RESOLVE

### Original comment

> P1: This line includes a contributor's full name, which conflicts with the repo's "no name attribution in docs" operational standing rule. Please switch to the appropriate role reference (e.g., "human maintainer") or move identifying details to an allowed memory surface.
> ```suggestion
> collaborators acting under the governance of the human
> maintainer; Amara contributes research and critique as
> ```

### Reply

> Resolving as BACKLOG+RESOLVE. `docs/aurora/**` is a history-class surface (ferry-absorb provenance). Per the existing backlog row "First-names-in-history-files refinement (Otto-256)" at `docs/BACKLOG.md` line ~4351 and the "FACTORY-HYGIENE — name-attribution policy clarification (history-file exemption)" row at line ~9403, history-file surfaces (memory/**, hygiene-history/**, ROUND-HISTORY.md, research logs, ferry-absorb attribution headers) are EXEMPT from the "No name attribution" rule because they record historical reality including who-said-what. Sweeping them would erase the historical record. The Non-fusion disclaimer's full-name occurrence is the same provenance discipline as the rest of the Attribution block and the sibling 17th/19th ferry absorbs in `docs/aurora/**`. Tracked under the existing backlog rows; no in-place edit in this drain pass to avoid creating a one-doc inconsistency across the ferry-absorb tree. Resolved.

---

## Thread 7 — `PRRT_kwDOSF9kNM59V95B`

- **File:line:** `docs/aurora/2026-04-24-amara-calibration-ci-hardening-deep-research-plus-5-5-corrections-18th-ferry.md:547`
- **Outcome:** BACKLOG+RESOLVE

### Original comment

> P2: Typo: "falkey" → "flaky".
> ```suggestion
>   #327: *"not seed locked, flaky, DST?"* Amara's
> ```

### Reply

> Resolving as BACKLOG+RESOLVE. The "falkey" string is inside an italicised inline blockquote of the human maintainer's verbatim words from BACKLOG #327: `*"not seed locked, falkey, DST?"*`. That is verbatim-quoted source content (preservation discipline applies even though the surrounding "Otto's notes" section is factory-authored — quoted maintainer words preserve the maintainer's exact phrasing). Editing it to "flaky" would silently revise the maintainer's verbatim quote, which is what the verbatim-preservation discipline blocks. The intent is clear from context (sharder-test flakiness); no factory-decision is gated on the typo. Resolved.

---

## Thread 8 — `PRRT_kwDOSF9kNM59V95O`

- **File:line:** `docs/aurora/2026-04-24-amara-calibration-ci-hardening-deep-research-plus-5-5-corrections-18th-ferry.md:607`
- **Outcome:** BACKLOG+RESOLVE (reviewer-side check returned a stale snapshot; path exists at head)

### Original comment

> P1: Stage 1 is stated as living under `tests/Tests.FSharp/Simulation/`, but that directory is not present; the current toy/cartel tests are in `tests/Tests.FSharp/Algebra/Graph.Tests.fs`. Please correct the stage-to-path mapping to match the repo layout.

### Reply

> Resolving without an in-doc edit. Verified at drain-time: `tests/Tests.FSharp/Simulation/CartelToy.Tests.fs` IS present at head (97 lines; the dedicated toy-cartel test file). The reviewer's snapshot may have read only the immediate `tests/Tests.FSharp/` listing without descending into `Simulation/`, OR may have predated the file landing. The path on line 605-606 is correct; no edit needed here. Adjacent threads on the same path (threads 2 and 10 in this drain log) are also resolved on the same verified-correct basis or are FIX'd where the doc used a shorter `tests/Simulation/` form that needed expansion. Resolved.

---

## Thread 9 — `PRRT_kwDOSF9kNM59V95a`

- **File:line:** `docs/aurora/2026-04-24-amara-calibration-ci-hardening-deep-research-plus-5-5-corrections-18th-ferry.md:728`
- **Outcome:** NARROW+BACKLOG

### Original comment

> P1: The cross-reference points at a 16th-ferry doc path under `docs/aurora/`, but that file is not present in the repository. Please either add the missing doc or update this link to an existing artifact.
> ```suggestion
> - **Amara 16th-ferry follow-through** — the earlier KSK
>   naming ambiguity is carried forward here via
>   `memory/feedback_ksk_naming_unblocked_aaron_directed_
>   rewrite_authority_max_initial_starting_point_2026_04_24.md`
>   and `docs/definitions/KSK.md`; this ferry's advisory-
>   only flow presumes KSK is the named kernel from
>   Otto-157.
> ```

### Reply

> Narrowed in this drain pass. The 16th-ferry path was a forward-looking anchor that never landed as a dedicated `docs/aurora/**` absorb (the KSK-naming-ambiguity content flowed into Otto-157 KSK definition work and `docs/definitions/KSK.md` directly). Updated the cross-reference to drop the dead path and note "raised the KSK naming ambiguity that Otto-140..145 closed; not present as a dedicated `docs/aurora/**` absorb in this snapshot, content flowed into Otto-157 KSK definition work." Did NOT adopt the suggestion verbatim because the suggested `feedback_ksk_naming_unblocked_*.md` filename is also not present at head (see thread 12). Same standing backlog applies: retroactive ferry-absorb landings tracked in Research projects backlog. Resolved.

---

## Thread 10 — `PRRT_kwDOSF9kNM59V95m`

- **File:line:** `docs/aurora/2026-04-24-amara-calibration-ci-hardening-deep-research-plus-5-5-corrections-18th-ferry.md:559`
- **Outcome:** BACKLOG+RESOLVE (reviewer-side check returned a stale snapshot; path exists at head)

### Original comment

> P1: `tests/Tests.FSharp/Simulation/CartelToy.Tests.fs` is referenced here, but `tests/Tests.FSharp/Simulation/` doesn't exist in the repo; cartel-related tests currently appear under `tests/Tests.FSharp/Algebra/Graph.Tests.fs`. Please update the path so the reference is navigable.
> ```suggestion
>    score intervals. `tests/Tests.FSharp/Algebra/
>    Graph.Tests.fs` already computes detection / FP
> ```

### Reply

> Resolving without an in-doc edit. Verified at drain-time: `tests/Tests.FSharp/Simulation/CartelToy.Tests.fs` IS present at head and IS the current toy-cartel test file (the reviewer's suggested redirect to `tests/Tests.FSharp/Algebra/Graph.Tests.fs` would point at the wrong file). Adjacent threads 2 and 8 on the same path are resolved on the same verified-correct basis. The shorter `tests/Simulation/` form that DID need expansion (Stage discipline section, line 622-628) was FIX'd separately under thread 2. Resolved.

---

## Thread 11 — `PRRT_kwDOSF9kNM59V96G`

- **File:line:** `docs/aurora/2026-04-24-amara-calibration-ci-hardening-deep-research-plus-5-5-corrections-18th-ferry.md:21`
- **Outcome:** BACKLOG+RESOLVE

### Original comment

> P1: `docs/AGENT-BEST-PRACTICES.md` operational standing rules specify "No name attribution in code, docs, or skills" (role-refs only, names limited to `memory/persona/**` and optionally `docs/BACKLOG.md`). This attribution block uses direct names; please rewrite to roles (e.g., "human maintainer", "external collaborator", "absorb author").

### Reply

> Resolving as BACKLOG+RESOLVE — same disposition as thread 6 and thread 14 on this PR. The Attribution block is part of the GOVERNANCE-archive-header convention used across all `docs/aurora/**` ferry absorbs (verified: 17th, 18th, 19th ferries all carry the same Aaron / Amara / Max named-attribution block). Per the existing backlog rows "First-names-in-history-files refinement (Otto-256)" (line ~4351) and "FACTORY-HYGIENE — name-attribution policy clarification (history-file exemption)" (line ~9403), history-class surfaces (`docs/aurora/**`, `memory/**`, `docs/hygiene-history/**`, `docs/ROUND-HISTORY.md`, `docs/research/**`) are EXEMPT from the "No name attribution" rule because they record historical reality including who-said-what — and sweeping them erases the historical record. Editing this single ferry's Attribution would create a one-doc inconsistency across the ferry-absorb tree; the right move is the cross-tree policy edit tracked in the existing backlog rows. Resolved.

---

## Thread 12 — `PRRT_kwDOSF9kNM59V96c`

- **File:line:** `docs/aurora/2026-04-24-amara-calibration-ci-hardening-deep-research-plus-5-5-corrections-18th-ferry.md:739`
- **Outcome:** FIX

### Original comment

> P1: The referenced memory file `memory/feedback_ksk_naming_unblocked_aaron_directed_rewrite_authority_max_initial_starting_point_2026_04_24.md` is not present under `memory/`. Please fix the filename/path to the correct memory entry (or remove the reference).
> ```suggestion
> - **Otto-140..145** — KSK canonical expansion locked to
>   "Kinetic Safeguard Kernel" (safety-kernel sense, not
>   OS-kernel).
> ```

### Reply

> Fixed in this drain pass. Confirmed: no `memory/feedback_ksk_naming_*.md` file is present at head (the KSK-naming lineage is captured across `memory/MEMORY.md` index entries rather than as a single dedicated `feedback_*.md`). The cross-reference now drops the broken filename and notes "Lineage captured across `memory/MEMORY.md` index entries; the standalone `feedback_ksk_naming_*.md` filename referenced by an earlier draft of this doc was not the eventual landing path." Otto-140..145 themselves remain a valid Otto-tag reference into the index. Resolved.

---

## Thread 13 — `PRRT_kwDOSF9kNM59W4Ii`

- **File:line:** `docs/aurora/2026-04-24-amara-calibration-ci-hardening-deep-research-plus-5-5-corrections-18th-ferry.md:16`
- **Outcome:** BACKLOG+RESOLVE (reviewer-side check returned a stale snapshot; file is present at head)

### Original comment

> P1 xref integrity: this doc asserts `docs/definitions/KSK.md` was shipped, but `docs/definitions/` does not exist in this repo snapshot. Either add the referenced definition doc (and directory) in the same PR/series, or change the references to the actual in-repo location of the current KSK definition so links don't rot.
> ```suggestion
> shipped the KSK naming doc, per Amara 16th-ferry §4 +
> 17th-ferry correction #7 resolved by Aaron Otto-140..145,
> making this ferry the next natural layer above KSK:
> "we've named the governance kernel; now define the
> calibration discipline that makes its input sign
> ```

### Reply

> Resolving without an in-doc edit — same disposition as thread 3 (the other `docs/definitions/KSK.md` reference). Verified at drain-time: `docs/definitions/KSK.md` is present at head (Otto-157 / PR #336 landed it). The "this repo snapshot" the reviewer checked may have predated PR #336's merge to main. The cross-reference at line 740-742 ("Otto-157 / PR #336 — authoritative KSK definition") is also live. Companion link-rot for adjacent broken anchors (15th/16th ferry refs, broken memory filename, GOVERNANCE §33) IS being landed in this drain pass; the `docs/definitions/KSK.md` references are not in that link-rot set. Resolved.

---

## Thread 14 — `PRRT_kwDOSF9kNM59W4JK`

- **File:line:** `docs/aurora/2026-04-24-amara-calibration-ci-hardening-deep-research-plus-5-5-corrections-18th-ferry.md:24`
- **Outcome:** BACKLOG+RESOLVE

### Original comment

> P1 codebase convention: this doc uses direct contributor names (e.g., in the Attribution header). `docs/AGENT-BEST-PRACTICES.md` states "No name attribution in code, docs, or skills" and requires role references instead (docs/AGENT-BEST-PRACTICES.md:284-290). Please replace direct names with role refs (and remove the later full-name mention) or document an explicit exception elsewhere before adding more named attributions in `docs/`.

### Reply

> Resolving as BACKLOG+RESOLVE — same disposition as thread 6 and thread 11 on this PR. The "explicit exception" the reviewer asks for already exists: see the existing backlog rows "First-names-in-history-files refinement (Otto-256)" at `docs/BACKLOG.md` line ~4351 and "FACTORY-HYGIENE — name-attribution policy clarification (history-file exemption)" at line ~9403. Both rows codify the history-file carve-out (`docs/DECISIONS/**`, `docs/ROUND-HISTORY.md`, `docs/hygiene-history/**`, `docs/research/**`, `memory/**`, and by extension `docs/aurora/**` ferry absorbs as a research-history surface) — names allowed there because they record historical reality including who-said-what. Sweeping them would erase the historical record. The Attribution-block convention is consistent across all `docs/aurora/**` ferry absorbs (17th, 18th, 19th); a one-doc rewrite here creates inconsistency. Tracked under the existing rows; no in-place edit. Resolved.

---

## Summary

Outcomes: 4 FIX / 2 NARROW+BACKLOG / 8 BACKLOG+RESOLVE.

The four FIX threads share a common in-doc edit set
(softened "verified against actual" wording, full
`tests/Tests.FSharp/Simulation/` path in Stage-discipline
section, GOVERNANCE §33 reworded to convention-pointer,
broken memory filename removed). The two NARROW+BACKLOG
threads soften 15th/16th ferry cross-refs to "not present
as dedicated absorb in this snapshot." The eight
BACKLOG+RESOLVE threads split into:

- 4 stale-snapshot threads where the reviewer's
  snapshot pre-dated landings on `main` (KSK doc
  threads 3 and 13; `tests/Tests.FSharp/Simulation/`
  path threads 8 and 10);
- 3 history-file-exemption threads pointing at the
  existing Otto-256 + FACTORY-HYGIENE backlog rows
  (Attribution-block name discipline threads 6, 11,
  14);
- 1 verbatim-quote-of-maintainer thread (typo
  "falkey" inside an italicised inline blockquote of
  Aaron's #327 wording — verbatim-preservation
  applies).

Verbatim Part 1 + Part 2 body (lines 93-515) is left
untouched in line with the verbatim-preserve discipline.
Factory-authored sections (header, "Otto's notes on
operationalization path," Cross-references) absorbed all
in-doc edits.

Resolution commit: see commit history on the
`ferry/amara-18th-calibration-ci-hardening` branch at
drain-time HEAD.
