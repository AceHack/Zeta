# PR #404 drain log — clean-room BIOS factory workflow (three-persona Chinese Wall)

PR: <https://github.com/Lucent-Financial-Group/Zeta/pull/404>
Branch: `backlog/clean-room-bios-factory-workflow`
Drain session: 2026-04-24 (Otto autonomous-loop)
Thread count: 7 (3 first-wave + 4 second-wave, all drained pre-merge)
Final disposition: merged 2026-04-25 after rebase (main moved 2×)

Per the PR-comment-preservation directive: full per-thread record
with verbatim reviewer text, outcome class, and reply state. #404
was the BACKLOG row proposing the clean-room BIOS factory workflow
(tractable-platforms-only pilot) plus the ethical-monetization
companion row. The PR carried through a mid-drain methodology
refinement (two-persona → three-persona Chinese Wall per Aaron's
autonomous-loop directive) and two rebase-through-conflict
episodes as main accumulated other BACKLOG landings.

---

## Wave 1 — 3 first-wave threads

### Thread 1 — `PRRT_kwDOSF9kNM59i5wV` — nonexistent anchor "emulator-runs-on-OS-interface BACKLOG rows"

- Reviewer: `copilot-pull-request-reviewer`
- Path: `docs/BACKLOG.md:10386`
- Severity: P2

**Original comment (verbatim):**

> P2: "emulator-runs-on-OS-interface BACKLOG rows" doesn't
> correspond to an existing row title/anchor in BACKLOG; the
> existing relevant row appears to be "Emulators as canonical
> OS-interface workload — …". Suggest referencing the exact row
> title (or a stable identifier) to keep the dependency pointer
> unambiguous.

**Outcome:** FIX — exact anchor text used.

**Reply:** Fixed — updated the Dependencies pointer to the actual
row title "Emulators as canonical OS-interface workload"
(grep-verified at `docs/BACKLOG.md:5602`) instead of the
invented "emulator-runs-on-OS-interface" phrase. Resolved.

---

### Thread 2 — `PRRT_kwDOSF9kNM59i5wZ` — GOVERNANCE §33 misreference

- Reviewer: `copilot-pull-request-reviewer`
- Path: `docs/BACKLOG.md:10355`
- Severity: P1

**Original comment (verbatim):**

> P1: The text says "GOVERNANCE §33-style archive headers apply"
> to clean-room spec files, but §33 is specifically for archived
> external conversations and its headers/field meanings (incl.
> `Non-fusion disclaimer:` and `Attribution:` as speaker labels)
> don't match what's described here. Consider removing the §33
> reference and either (a) defining a separate provenance-header
> spec for clean-room specs or (b) deferring the provenance-
> header decision.

**Outcome:** FIX — new provenance-frontmatter defined.

**Reply:** Fixed — removed the §33 cross-reference. §33 is for
archived external conversations and its fields (Non-fusion
disclaimer, Attribution as speaker label, etc.) don't match
clean-room spec provenance needs. Replaced with fresh provenance-
frontmatter spec defined for this workflow (Clean-room stage /
Reader-persona / Source material / Proprietary BIOS access
fields) so each artifact class has its own right-fit header
shape. Resolved.

---

### Thread 3 — `PRRT_kwDOSF9kNM59i5we` — roms/README.md misdescribed

- Reviewer: `copilot-pull-request-reviewer`
- Path: `docs/BACKLOG.md:10393`
- Severity: P1

**Original comment (verbatim):**

> P1: `roms/README.md` is described as containing a "removed
> platforms" list, but that file is currently a safe-ROM
> substrate/licensing guide and doesn't list removed platforms.
> Please adjust this cross-reference (or point at the actual
> removed-platforms list if it lives elsewhere).

**Outcome:** FIX — composes-with description corrected.

**Reply:** Fixed — `roms/README.md` is the safe-ROM licensing
protocol, not a removed-platforms list. BIOS-availability
status for individual platforms lives in the per-platform leaf
READMEs (e.g. `roms/atari/5200/` which was removed, `roms/atari/
800/README.md` which notes Altirra OS). Composes-with
description updated to match reality: "the safe-ROM licensing
protocol; this workflow is the path to re-adding any of the
removed platforms once a clean-room BIOS exists". Resolved.

---

## Wave 2 — 4 second-wave threads (after rebase through conflicts + methodology refinement)

Between Wave 1 and Wave 2, Aaron's autonomous-loop directive
refined the Chinese Wall methodology from two-persona to
three-persona (dirty + clean + factory-standards pass).
Supporting commits carried the refinement into the BACKLOG row
body but left the title + a couple of references behind. Wave 2
caught that debt plus a few inline-code / casing issues.

### Thread 4 — `PRRT_kwDOSF9kNM59jJ8Z` — title says two-persona, body says three-persona

- Reviewer: `copilot-pull-request-reviewer`
- Severity: P1

**Original comment (verbatim):**

> P1: This row title frames the workflow as "two-persona", but
> the Methodology section below explicitly defines a "three-
> persona Chinese Wall + factory-standards pass" and later
> refers to "two-persona workflow end-to-end". Please make the
> terminology consistent across the row (pick one number and
> stick with it).

**Outcome:** FIX — title + stale references updated.

**Reply:** Fixed — title updated to "three-persona Chinese
Wall plus factory-standards pass" to match the methodology
body (which already expanded to three-persona per Aaron's
Otto-2026-04-24 refinement). Sibling "two-persona workflow
end-to-end" in the scope section also updated to
"three-persona workflow". Resolved.

---

### Thread 5 — `PRRT_kwDOSF9kNM59jJ8k` — split inline-code identifier

- Reviewer: `copilot-pull-request-reviewer`
- Severity: P1

**Original comment (verbatim):**

> P1: The inline-code identifier for the proposed skill name is
> split across a line break (`writing-clean-room-` …
> `specs-skill`). That breaks Markdown code-span rendering and
> makes the identifier hard to copy/search. Keep the identifier
> in a single inline-code span.

**Outcome:** FIX — consolidated to single line.

**Reply:** Fixed — consolidated `writing-clean-room-specs-skill`
onto a single line so the inline-code identifier renders and is
copy/search-able. Added an explicit one-liner noting the fix
rationale. Resolved.

---

### Thread 6 — `PRRT_kwDOSF9kNM59jJ8o` — unbalanced backticks + HTML placeholders

- Reviewer: `copilot-pull-request-reviewer`
- Severity: P1

**Original comment (verbatim):**

> P1: The provenance-frontmatter examples have unbalanced
> backticks and split inline-code spans across line breaks
> (e.g., `Reader-persona:` then the placeholder on the next
> line). This will render poorly and may treat `<...>`
> placeholders as raw HTML. Please keep each field on one line
> and use a non-HTML placeholder style.

**Outcome:** FIX — each field on its own line; placeholders swapped.

**Reply:** Fixed — rewrote the provenance-frontmatter examples.
Each field now lives on its own line (code span renders cleanly,
no mid-identifier line breaks) and `<...>` placeholders swapped
for `PLACEHOLDER` style (HTML-safe, markdown won't treat as raw
HTML). Resolved.

---

### Thread 7 — `PRRT_kwDOSF9kNM59jJ8v` — ColecoVision casing

- Reviewer: `copilot-pull-request-reviewer`
- Severity: (unmarked; effectively P2/spelling)

**Original comment (verbatim):**

> Spelling: "Colecovision" should be "ColecoVision" (matches
> usage earlier in this row).

**Outcome:** FIX — casing normalized.

**Reply:** Fixed — "Colecovision" → "ColecoVision" to match the
canonical vendor-brand casing used earlier in the same row.
Resolved.

---

## Methodology evolution captured

Between the two waves of review threads, the clean-room BIOS
workflow evolved from two-persona to three-persona per Aaron's
autonomous-loop directive:

> *"if this works it will really be a 3 person casue we are
> not going to take code directly that was missing our best
> practice guidance becasue it's missing our memories, we
> would treat output as subpar and rewrire using our
> standards."*

The three personas:

1. **Dirty persona** (specifier / reader) — reads the BIOS +
   public docs, writes the behavioral spec. Reader notes NEVER
   committed; spec IS committed.
2. **Clean persona** (implementer / reference) — never sees the
   BIOS or dirty notes. Reads only the committed spec. Writes
   a reference implementation. Output treated as SUBPAR because
   the clean persona lacks factory memory (no Zeta idioms, BP
   rules, operator-algebra conventions).
3. **Standards persona** (re-implementer / factory-quality
   pass) — reads ONLY the clean persona's output. Re-writes to
   Zeta standards (F# idioms, Result-type discipline, memory-
   accumulated conventions). Sees no upstream artifact.

Chain integrity: dirty → spec → clean → standards. Each stage
sees only its predecessor's cleaned output. Standards pass is
NOT firewall-breaking because it operates fully downstream of
the clean-room boundary — equivalent to any maintainer reviewing
upstream library code.

Wave 2 threads caught the places this refinement hadn't been
carried through the prose.

## Rebase activity

#404 rebased twice through conflicts in `docs/BACKLOG.md`
(primary hot file during this session as P3 rows accumulated).
Resolution recipe (BSD sed / macOS):
`sed -i '' '/^<<<<<<< HEAD$/d;/^=======$/d;/^>>>>>>> /d' docs/BACKLOG.md`.
GNU sed (Linux CI / most dev laptops) needs the empty
backup-suffix argument OMITTED:
`sed -i '/^<<<<<<< HEAD$/d;/^=======$/d;/^>>>>>>> /d' docs/BACKLOG.md`.
— strip markers keeping both sides for append-only files. Per
Otto-228 drain-axis discipline + Otto-229 append-only.

## Summary

7 threads; 7 FIX outcomes; 100% resolved pre-merge. Two rebase
cycles. Major mid-flight methodology refinement (two → three
persona) captured in the BACKLOG row body during the drain.
#404 merged cleanly after the second rebase; no post-merge
thread swarm (unlike #402 which hit the 29-thread mass-README
pattern).
