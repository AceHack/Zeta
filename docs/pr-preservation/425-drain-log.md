# PR #425 drain log — drain follow-up to #357: CommonMark 4-space-indent limit on fence detection

PR: <https://github.com/Lucent-Financial-Group/Zeta/pull/425>
Branch: `drain/357-followup-fence-indent`
Drain session: 2026-04-25 (Otto, sustained-drain-wave during maintainer-
asleep window; pre-summary-checkpoint earlier in this session)
Thread count at drain: 1 substantive Codex finding on the parent #357
fence-detection logic.
Rebase context: clean rebase onto `origin/main`; no conflicts.

Per Otto-250 (PR review comments + responses + resolutions are
high-quality training signals): abbreviated Otto-268-wave record
of the CommonMark parser-correctness fix. The abbreviated shape
preserves reviewer/severity/outcome/commit metadata but does NOT
preserve verbatim original-comment + reply text — see
`docs/pr-preservation/_patterns.md` "Otto-250-canonical vs
Otto-268-abbreviated shape divergence" for the full divergence
framing and the canonical-shape contrast (e.g.
`docs/pr-preservation/108-drain-log.md` /
`docs/pr-preservation/395-drain-log.md`).

This PR is the **post-merge cascade** to #357 (which introduced
fence-detection logic for some markdown-aware operation). The
cascade caught a single substantive correctness finding: the
parent's fence-detection didn't respect CommonMark's 4-space-indent
limit, producing a quiet-failure mode where tab-indented or
deeply-indented fence-shaped lines were misclassified.

---

## Threads

### Thread 1 — `lstrip(' ')` + explicit tab-rejection on fence detection

- Reviewer: chatgpt-codex-connector
- Severity: P1 (parser correctness)
- Finding: parent #357's fence-detection used `raw_line.lstrip()`
  (which silently consumes tabs) before checking the marker. Per
  CommonMark §4.5, code fences are recognized only when the opening
  marker is preceded by **at most 3 spaces** (not tabs; tabs in this
  position make the line a code-block-content line, not a fence
  marker). The unconditional `.lstrip()` consumed both spaces and
  tabs, producing two failure modes:
  - 4+ spaces of indent: silently treated as fence (CommonMark says
    it should NOT be a fence at this indent — should be code-block
    content).
  - Tab indent: silently treated as fence (CommonMark says tabs
    in this position make it not-a-fence).
- Outcome: **FIX** — fence-detection now uses `lstrip(' ')` (space-
  only, not whitespace) + explicit tab-rejection check. Tab-indented
  fence-shaped lines correctly fail the marker check. 4+ spaces of
  indent correctly fail the marker check (only 0-3 spaces of indent
  are valid fence-marker-prefix per CommonMark §4.5).

---

## Pattern observations (Otto-250 training-signal class)

1. **CommonMark spec compliance is its own findings class.** Custom
   markdown parsers easily diverge from CommonMark §4.5 (fences),
   §6.1 (code spans cannot contain newlines), §3.1 (thematic break
   indent limit), etc. Codex catches this class reliably when the
   parser code is in a PR. Fix template: cite the specific CommonMark
   section being violated; pick the spec-compliant primitive
   (`lstrip(' ')` for space-only stripping, `lstrip()` for whitespace
   including tabs — but match the spec section's expected behavior).

2. **`lstrip()` vs `lstrip(' ')` is a subtle but load-bearing
   distinction in markdown parsing.** Python's `.lstrip()` with no
   argument strips all whitespace including tabs; with `' '` it
   strips only spaces. The CommonMark spec consistently distinguishes
   the two — many indent-related primitives (`lstrip()` analogues
   in any language) need to be space-aware not whitespace-aware.
   Pre-commit-lint candidate: regex check on markdown-parser code
   for unconditional `.lstrip()` calls suggesting `' '` arg.

3. **Quiet-failure modes in markdown parsers are the most-dangerous
   bug class.** Tab-indented fence-shaped lines being silently
   misclassified produced no exception, no warning, no test
   failure — just wrong-output rendered downstream. The fix
   prevents the silent misclassification by making the
   spec-compliance explicit. Pattern generalizes: any parser that
   silently misclassifies-vs-rejects on edge cases needs explicit
   reject-paths for known-tricky inputs.

## Final resolution

All threads resolved at SHA `1596a8f` (this PR's only commit).
PR auto-merge SQUASH armed; CI cleared; merged to main as
`693e171`.

Drained by: Otto, sustained-drain-wave during maintainer-asleep
window 2026-04-25, cron heartbeat `f38fa487` (`* * * * *`).
