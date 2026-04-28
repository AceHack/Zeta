# PR #219 drain log — aurora absorb of Amara's 3rd courier ferry (decision-proxy + technical review)

PR: <https://github.com/Lucent-Financial-Group/Zeta/pull/219>
Branch: `aurora/amara-decision-proxy-technical-review-absorb`
Drain session: 2026-04-25 (Otto, post-summary continuation autonomous-loop)
Thread count at drain start: 12 unresolved (Codex P2 + Copilot P1/P2)
Rebase context: clean rebase onto `origin/main`; no conflicts.

Per Otto-250 (PR review comments + responses + resolutions are
high-quality training signals): full per-thread record with reviewer
authorship, severity, outcome class.

This PR absorbed Amara's 3rd courier ferry (decision-proxy framing +
technical review of memory-substrate sites). Drain was high-density
on real fixes plus several stale-resolved-by-reality citations and
two Otto-279 history-surface name-attribution responses.

---

## Thread-by-thread record

### Thread 1 — `:41` — Memory file dangling (Codex P2)

- Reviewer: chatgpt-codex-connector
- Thread ID: `PRRT_kwDOSF9kNM59QUj3`
- Severity: P2
- Outcome: **STALE-RESOLVED-BY-REALITY** —
  `memory/project_lfg_is_demo_facing_acehack_is_cost_cutting_internal_2026_04_23.md`
  exists in-tree per Otto-114 forward-mirror.

### Thread 2 — `:46` — Inline code path split across newline (Copilot)

- Thread ID: `PRRT_kwDOSF9kNM59QVgQ`
- Severity: P1
- Outcome: **FIX** — reflowed the inline code span so the full
  `memory/project_lfg_is_demo_facing_*.md` path lives on a single
  line; copyable + unambiguous. Commit `fdad14f`.

### Thread 3 — `:267` — "Aaron" name in Attribution section (Copilot)

- Thread ID: `PRRT_kwDOSF9kNM59QVgc`
- Severity: P1
- Outcome: **OTTO-279 SURFACE-CLASS** — aurora-archive surfaces are
  history-class per Otto-279; Attribution section preserves provenance
  (named ferry-and-absorb chain: Amara / Aaron / Otto / Kenji) rather
  than setting current-state operational policy. Explicit note added
  at the end of Attribution section linking decision back to Otto-279.

### Thread 4 — `:266` — `CURRENT-amara.md` repo-location reference (Copilot)

- Thread ID: `PRRT_kwDOSF9kNM59QVgj`
- Severity: P1
- Outcome: **FIX** — reference now points at `memory/CURRENT-amara.md`
  as a clickable relative link, with explicit "out-of-repo
  per-maintainer distillation" annotation matching the file's
  character (file lives at `memory/CURRENT-amara.md` in-repo as a
  forward-mirror of the per-maintainer projection-over-time pattern).
  Commit `fdad14f`.

### Thread 5 — `:143` — Typo "adheardce" (Copilot)

- Thread ID: `PRRT_kwDOSF9kNM59QVgq`
- Severity: P2
- Outcome: **FIX** — `adheardce` → `adherence`. Commit `fdad14f`.

### Thread 6 — `:32` — Inline code path split across newline (Copilot)

- Thread ID: `PRRT_kwDOSF9kNM59QVg1`
- Severity: P1
- Outcome: **FIX** — reflowed `docs/hygiene-history/nsa-test-history.md`
  reference to a single-line inline code span. Commit `fdad14f`.

### Thread 7 — `:278` — Missing verifiable citations for external sources (Codex P2)

- Reviewer: chatgpt-codex-connector
- Thread ID: `PRRT_kwDOSF9kNM59Q6Ea`
- Severity: P2
- Finding: section states external sources were "preserved as Amara's
  grounding" but doc had no resolvable citations (URLs, bibliographic
  entries, or identifiers) for the OpenAI help-center docs, DBSP paper,
  or provenance-semiring paper.
- Outcome: **FIX** — added concrete citations:
  - OpenAI help-center branching FAQ URL
    (<https://help.openai.com/en/articles/9624314-conversation-branching-faq>)
  - DBSP paper full bibliographic + arXiv:2203.16684
    (Budiu / Chajed / McSherry / Ryzhyk / Tannen, PVLDB 16(7) 2023)
  - Provenance-semiring paper full bibliographic + DOI link
    (Green / Karvounarakis / Tannen, PODS 2007)
  Reviewers can now verify Amara's grounding directly. Commit
  `fdad14f`.

### Thread 8 — `:162` — Phase-numbering inconsistency (Copilot)

- Thread ID: `PRRT_kwDOSF9kNM59Q7oD`
- Severity: P1
- Finding: text said review should add a "fifth phase" but described
  it as "Phase 6 — catalogue-expansion" after listing 5 existing
  phases.
- Outcome: **FIX** — reworded to "sixth phase ... after five existing
  phases" + new phase correctly numbered Phase 6. Commit `fdad14f`.

### Thread 9 — `:141` — "Aaron" name in section header (Copilot)

- Thread ID: `PRRT_kwDOSF9kNM59Q7oK`
- Severity: P1
- Outcome: **OTTO-279 SURFACE-CLASS** — same reply pattern as Thread
  3; aurora-archive is history-class; first-name attribution preserves
  provenance.

### Thread 10 — `:34` — Inline code path split across newline (Copilot)

- Thread ID: `PRRT_kwDOSF9kNM59Q7oS`
- Severity: P1
- Outcome: **FIX** — same single-line reflow as Thread 6;
  `docs/hygiene-history/nsa-test-history.md` no longer crosses a
  newline. Commit `fdad14f`.

### Thread 11 — `:46` — Memory file dangling + inline-code line split (Copilot)

- Thread ID: `PRRT_kwDOSF9kNM59Q7oY`
- Severity: P1
- Outcome: **FIX + STALE-RESOLVED-BY-REALITY** — combined both
  concerns: memory file now exists per Otto-114; inline code reflowed
  to single line. Commit `fdad14f`.

### Thread 12 — `:143` — Typo "adheardce" (Copilot dup)

- Thread ID: `PRRT_kwDOSF9kNM59Q7oc`
- Severity: P2
- Outcome: **FIX** — same correction as Thread 5; `adheardce` →
  `adherence`. Commit `fdad14f`.

---

## Pattern observations (Otto-250 training-signal class)

1. **External-source verifiability is a research-doc discipline.**
   Thread 7's finding caught a reproducibility gap: claiming Amara
   grounded her review in "OpenAI help-center docs / DBSP paper /
   provenance-semiring paper" without resolvable identifiers fails
   reviewer verification. Adding URLs + arXiv IDs + DOIs is one-line-
   each but converts the doc from "Amara grounded somewhere" into
   "reviewers can verify Amara's grounding." Same pattern surfaces in
   any research doc that cites prior art.

2. **Inline-code-span line-wrap is the most-recurring formatting bug
   in this drain wave.** Four threads on this PR (2, 6, 10, 11) flagged
   the same pattern — same as on #191, #195. The fix template (single-
   line code spans or markdown links) should be a pre-commit lint
   eventually.

3. **Otto-279 history-surface uniformity is now a one-paragraph stamp
   reply.** Two threads here (3, 9) got the same Otto-279 explanation:
   aurora-archive is history-class (alongside research / decisions /
   round-history / pr-preservation / aurora); Attribution section
   preserves provenance, not policy. Mature one-paragraph reply.

4. **Phase-numbering / count consistency findings recur.** Thread 8
   ("fifth phase" + "Phase 6" + 5 listed phases) is the same shape as
   the L549 "18 audits" finding on #191 (count vs surface list
   mismatch). Both are catchable via a future doc-lint pass that
   checks claim-vs-list cardinality.

## Final resolution

All 12 threads resolved at SHA `fdad14f` (7 FIX + 3 STALE-RESOLVED-
BY-REALITY + 2 OTTO-279). PR auto-merge SQUASH armed; CI cleared;
merge pending.

Drained by: Otto, post-summary autonomous-loop continuation, cron
heartbeat `f38fa487` (`* * * * *`).
