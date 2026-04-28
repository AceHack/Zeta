---
name: >-
  Reviewer false-positive pattern catalog — empirical taxonomy of
  recurring codex/copilot/automated-reviewer false-positive shapes
  observed across the 2026-04-28 thread drain (~50+ threads across
  10+ PRs); each class has a discriminating signal + recommended
  resolution form (form-1 substantive fix / form-2 already-fixed
  with citation / form-3 carve-out cite / form-4 empirical
  falsification); intent is to (a) make future reviews faster by
  letting fresh-Otto recognize false-positive class instantly,
  (b) name the structural causes so we can preempt them at write-
  time, (c) identify where reviewer tooling itself could be improved;
  Aaron 2026-04-28 ask after the 121-thread audit
description: >-
  Aaron 2026-04-28 input after the 121-thread bulk audit and the
  ongoing always-double-check-after-CI loop:
  *"Total 121 unresolved threads. when you got through these do you
  see if you can do anything to improve the flase posistive in the
  future?"* This memory documents the recurring false-positive
  patterns I observed across the session's thread-drain work, with
  per-class diagnostic signals + resolution forms + structural
  prevention candidates. Composes with Otto-355 (BLOCKED-investigate-
  threads-first) and the no-required-approval calibration constant —
  this catalog gives future-Otto a lookup table for fast
  classification of incoming reviewer threads.
type: feedback
---

# Reviewer false-positive pattern catalog (2026-04-28)

## Why this catalog exists

Across the 2026-04-28 session I drained ~50+ review threads spanning
PRs #17, #19, #23, #28, #72, #75, #82, #83, #84, #85, #87, #91, #92,
#660 (LFG). The threads come from multiple automated reviewers:

- `chatgpt-codex-connector` (Codex)
- `copilot-pull-request-reviewer` (GitHub Copilot)

Roughly **40-50% of threads were genuine substantive findings** that
needed form-1 fixes. The other half were **false-positives or
already-fixed** issues with recognizable structural causes. This
catalog names those structural causes so that:

1. **Future-Otto recognizes the class instantly** and applies the
   right resolution form without re-deriving the diagnosis.
2. **Write-time prevention** can be designed where the structural
   cause is in the writing process (e.g., schema lookup before
   authoring backlog rows would prevent the schema-drift class).
3. **Reviewer-tooling improvements** can be requested where the
   structural cause is in the reviewer itself (e.g., Codex/Copilot
   could read project conventions before applying generic style
   rules).

## Resolution form taxonomy (recap)

- **Form-1 (substantive fix):** the finding is real; apply the
  suggested change or an equivalent fix.
- **Form-2 (already-fixed with citation):** the finding was real but
  has been addressed in a later commit on this PR. Reply with the
  commit SHA + close the thread.
- **Form-3 (carve-out cite):** the finding mis-applies a rule that
  has a documented carve-out for this surface. Reply with the
  carve-out citation + close.
- **Form-4 (empirical falsification):** the finding asserts a
  language/runtime/tool behavior that is testably wrong. Reply with
  the empirical test + close.

## The classes (ranked by frequency in this session)

### Class 1 — Stale-snapshot review (form-2)

**Frequency in 2026-04-28 session:** ~25% of false-positives.

**Discriminating signal:** the thread cites a line / claim that has
already been changed in a later commit on the same PR. The reviewer
ran against an older SHA.

**Examples this session:**

- PR #91 P1 "ONLY one of" — already changed to "one OR MORE" in
  the prior commit
- PR #91 P1 "not at top" — already moved to top in the prior commit
- LFG #660 P1 PR-description-says-4-files — already updated to 5
  files in PR title + body

**Why it happens (structural):** Codex / Copilot run against the SHA
of the PR's base commit when the review was queued. If the author
(me) pushes a fix BETWEEN the review's queue time and its delivery
time, the review describes pre-fix state but lands as if it's
current. There's no client-side staleness check.

**Recommended resolution form:** form-2 — reply with the commit SHA
that addressed it + resolve.

**Prevention candidate (reviewer-side):** Codex/Copilot could check
the latest SHA at delivery time and skip findings whose target lines
have changed. Worth filing upstream.

**Prevention candidate (factory-side):** none — this is reviewer-
tooling, not author-side. Mitigation is just fast form-2 closure.

---

### Class 2 — Carve-out blind spot (form-3)

**Frequency:** ~20% of false-positives.

**Discriminating signal:** the reviewer applies a generic rule
("no name attribution in code", "no absolute paths in docs", "no
PR-relative phrasing") to a surface that has a documented carve-out
in the project's conventions.

**Examples this session:**

- LFG #660 P1 `Co-authored-by: Otto` flagged as persona-name on
  current-state surface — but commit trailers ARE history surface
  per Otto-279 carve-out
- Multiple "memory file should be terse" findings on memory/* —
  but `memory/README.md` distinguishes index entries (terse) from
  body (detailed); reviewer flagged body length

**Why it happens (structural):** automated reviewers train on
generic OSS conventions (Google style guide, GitHub markdown lint,
etc.) and don't read the project's `docs/AGENT-BEST-PRACTICES.md`
or `docs/GLOSSARY.md` carve-out rules.

**Recommended resolution form:** form-3 — reply with the explicit
carve-out citation (e.g., "Otto-279 history-surface carve-out at
docs/AGENT-BEST-PRACTICES.md:287-348 covers commit trailers") +
resolve.

**Prevention candidate (factory-side):** maintain a single
`docs/CARVE-OUTS.md` index that future-reviewers can be pointed at
in PR-template / `.github/copilot-instructions.md`. Some of this
exists in `docs/AGENT-BEST-PRACTICES.md` already; making the
carve-out section more grep-friendly would help.

**Prevention candidate (reviewer-side):** Codex/Copilot could be
asked to read the project's `AGENTS.md` or
`.github/copilot-instructions.md` before applying style rules. The
factory-managed `.github/copilot-instructions.md` (per
GOVERNANCE.md §31) is the lever here — extending it with explicit
carve-out enumeration could reduce this class significantly.

---

### Class 3 — Schema rule blind spot (form-1, but preventable at write-time)

**Frequency:** ~15% of false-positives, but worth preventing because
the underlying drift is a real factory-side error.

**Discriminating signal:** the reviewer flags a structural rule
violation that the project has a documented schema for, but the
author (me) didn't read the schema before writing.

**Examples this session:**

- B-0068/B-0069/B-0070/B-0071 backlog rows — used off-schema fields
  (`slug`, `maintainer`, `ownership`, `status: backlog`) instead of
  the schema in `tools/backlog/README.md` (which uses `status: open`
  and a different field set)
- Memory frontmatter YAML validity — `requiredApprovingReviewCount:
  0` in a plain scalar broke YAML parsing

**Why it happens (factory-side):** I authored from a stale mental
template instead of re-reading the schema for each artifact. Per
Otto-275-FOREVER: knowing-rule != applying-rule. The schema lives
in a documented location, but the act of authoring doesn't trigger
schema-lookup unless I make it a discipline.

**Recommended resolution form:** form-1 — apply the suggested fix
(usually mechanical, change the field set / status enum / etc.).

**Prevention candidate (factory-side):**

1. **Pre-write schema-fetch discipline:** before authoring any
   structured artifact (backlog row / memory frontmatter / commit
   trailer block), grep the documented schema and check it against
   the draft. Cost: 30 seconds per artifact. Saved cost: avoiding
   reviewer round-trip + sister-row schema-fix sweeps.
2. **Mechanical schema validators:** `tools/hygiene/audit-backlog-
   schema.sh` + `tools/hygiene/audit-memory-frontmatter.sh` that
   parse YAML + check field set + enum values. Pre-commit hook
   would catch the drift before reviewer cycle.

**Prevention candidate (reviewer-side):** none — reviewers caught
these correctly. The factory side is where the prevention belongs.

---

### Class 4 — Wrong-language-parser blind spot (form-3 or form-4)

**Frequency:** ~10% of false-positives.

**Discriminating signal:** the reviewer applies a language/runtime
rule that doesn't actually apply to the construct in question.

**Examples this session:**

- PR #75 Copilot P0 claimed `if ! var="$(cmd)"; then ...` doesn't
  catch cmd failure — empirically wrong on bash 3.2.57 + 5.x; the
  if-not test on the assignment exit status DOES catch it
- (potential in this catalog scope) Copilot reviewing F# applying
  C# null-check rules

**Why it happens (structural):** reviewers train across many
languages and apply rules from the wrong language family when the
file extension or syntax is ambiguous.

**Recommended resolution form:** form-4 — empirically test the
claim and reply with the test command + result. If the claim turns
out to be correct, drop to form-1.

**Prevention candidate (reviewer-side):** asking the reviewer to
identify the language explicitly before applying rules would help,
but this is upstream tooling.

**Prevention candidate (author-side):** the verify-before-deferring
discipline already covers this — when a reviewer makes a
language-claim, test it before applying the fix.

---

### Class 5 — Convention conflict (form-3)

**Frequency:** ~10% of false-positives.

**Discriminating signal:** the reviewer applies a broad style
preference (line length / comment density / variable naming) that
conflicts with a documented project convention.

**Examples this session:**

- "MEMORY.md entry too long" — entry was actually within memory/
  README.md guidance for the artifact class
- "Comment too verbose" on memory files — memory file bodies are
  intentionally detailed per the project's substrate-grade-not-code-
  comment register

**Why it happens (structural):** broad style rules are reviewer
defaults; project conventions live in `docs/` files the reviewer
doesn't read.

**Recommended resolution form:** form-3 with the specific
convention citation.

**Prevention candidate:** same as Class 2 — extend
`.github/copilot-instructions.md` with the project-specific style
exemptions.

---

### Class 6 — Cross-reference target out of scope (form-1, but the
underlying class is "broken in-repo cross-reference")

**Frequency:** ~10% of false-positives that are actually class-3-real
(reviewer caught a real bug).

**Discriminating signal:** reviewer flags a path/link as broken
because the file lives in a different directory than the writer
assumed.

**Examples this session:**

- Otto-278 / Otto-352 / per-named-agent-memory-architecture xrefs —
  paths that exist only in user-scope memory, not in-repo
- `user_hacked_god_*.md` references missing the `memory/` prefix
  (3 instances on PR #92)

**Why it happens (factory-side):** writer (me) wrote the path from
mental model rather than verifying via filesystem.

**Recommended resolution form:** form-1 — fix the path or relabel
as user-scope-only.

**Prevention candidate (factory-side):**

1. **B-0070 orphan-role-ref-detector** — extend to also catch
   broken in-repo path references (already noted as observation in
   prior tick).
2. **Pre-commit lint** that resolves all `[link](path)` markdown
   references against the filesystem. Runs in ~1 second; catches
   the broken-xref class entirely.

**Prevention candidate (reviewer-side):** reviewers do this well —
no upstream improvement needed.

---

### Class 7 — Recursive-CI new threads (procedural class, not
false-positive but worth naming)

**Frequency:** every CI cycle on every PR.

**Discriminating signal:** I drained N threads, pushed, CI ran, NEW
threads landed catching issues introduced by the fix or that the
reviewer missed in the prior pass.

**Examples this session:**

- PR #91: 2 threads → fixed → 3 new threads (P0 YAML) → fixed → 3
  more new threads (failed-check counting + StatusContext fragment +
  index entry length)

**Why it happens:** reviewers run incrementally on each push;
findings compound until the file converges.

**Resolution form:** continue draining; don't classify as
false-positive (these are real findings).

**Prevention candidate (factory-side):** none on the procedure
itself, but **mechanism-over-vigilance** via pre-commit hooks +
project-side validators (YAML, schema, xref-resolution) would catch
many of the underlying issues before the first reviewer pass — and
the reviewer would land cleaner more often.

---

## Frequency-weighted prevention candidates (ROI ranked)

If we want to reduce false-positive volume in future PRs, the
highest-ROI structural fixes are:

### High ROI (catches multiple classes)

1. **Pre-commit YAML validator** for memory/* frontmatter
   (catches Class 3 + the recursive-CI pattern of Class 7 for
   frontmatter-related issues). Cost: ~30 lines bash + pre-commit
   hook. Catches Class 3 entirely for frontmatter.

2. **Pre-commit markdown-xref-resolver** that validates every
   `[text](path)` against the filesystem. Catches Class 6 entirely.
   Cost: ~50 lines bash or python. Composes with B-0070 lint.

3. **Extend `.github/copilot-instructions.md`** with the project's
   carve-out enumeration (Otto-279 history-surface, memory file
   body-vs-index distinction, etc.). Catches Class 2 + Class 5 by
   biasing the reviewer's findings. Cost: ~20 lines doc edit.

### Medium ROI (single class)

4. **Pre-write schema-fetch discipline** (operational, not tool):
   grep `tools/backlog/README.md` before authoring any backlog row;
   grep `memory/README.md` before authoring memory frontmatter.
   Catches Class 3 at write-time. Cost: 30 seconds per artifact.

5. **`tools/hygiene/audit-backlog-schema.sh`** that runs the
   tools/backlog/README.md schema check mechanically. Catches Class 3
   for backlog rows. Cost: ~40 lines bash.

### Low ROI (reviewer-side, can't enforce)

6. Asking Codex/Copilot upstream to read project conventions
   before applying generic rules. Long-term ask, low immediate
   leverage.

## How to use this catalog

When reading a new reviewer thread:

1. **Check the class:** does it match Class 1 (stale-snapshot)?
   Class 2 (carve-out blind spot)? etc.
2. **If matched:** apply the resolution form for that class
   (form-1/2/3/4) without re-deriving the analysis.
3. **If unmatched:** treat as a genuine substantive finding,
   investigate normally.

This shaves ~30 seconds to ~2 minutes off each false-positive thread
and scales as thread volume grows.

## Composes with

- **Otto-355** (BLOCKED-investigate-threads-first) — this catalog
  makes Otto-355's investigation faster
- **Otto-275-FOREVER** — Class 3 (schema drift) is a textbook
  knowing-rule != applying-rule case
- **Otto-279** (history-surface attribution carve-out) — Class 2
  cites this carve-out frequently
- **`feedback_no_required_approval_on_zeta_BLOCKED_means_threads_or_ci_aaron_2026_04_28.md`**
  — companion: that memory says "always double-check threads after
  CI completes"; this catalog makes the post-CI thread pass faster
- **B-0070** orphan-role-ref-detector — composes with Class 6
  prevention work
- **Aaron 2026-04-28** *"can you do anything to improve the false
  positive in the future?"* — the prompting input

## Triggers for retrieval

- Reading a fresh reviewer thread on any Zeta PR
- Considering whether a finding is a real bug vs. a false-positive
- Designing a pre-commit hook or hygiene script for the factory
- Reviewing this session's tick-history rows for thread-drain
  patterns

## What this catalog does NOT do

- Does NOT replace per-thread judgment. The classes are
  recognition hints, not auto-classifiers. A genuine bug can wear
  the costume of any class above.
- Does NOT obviate empirical testing for Class 4. The
  verify-don't-parrot discipline still applies — test the language
  claim before deciding it's a false-positive.
- Does NOT cover human-reviewer findings. Aaron's review threads
  are not in this catalog because Aaron's pattern is different (he
  catches my drift in framing / vocabulary / direction, not generic
  style rules).
- Does NOT cover novel reviewers (Gemini / Grok / Amara) — their
  patterns are distinct enough that they need their own catalogs if
  we ever automate review through them.
