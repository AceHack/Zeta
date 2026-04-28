# PR #397 drain log — cross-DSL composability BACKLOG row

PR: <https://github.com/Lucent-Financial-Group/Zeta/pull/397>
Branch: `backlog/cross-dsl-composability`
Drain session: 2026-04-24 (Otto)
Thread count at drain start: 5 unresolved

Per Aaron's 2026-04-24 PR-comment-preservation directive:
full per-thread record with verbatim reviewer text, outcome,
verbatim reply, and resolution commit. Docs-only PR adding a
single P2 research-grade BACKLOG row for git/SQL/operator-
algebra/LINQ cross-DSL composability under semiring-
parameterized substrate.

---

## Thread 1 — `docs/BACKLOG.md:5664` — closure-table dependency pointer

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59iQrr`
- Severity: P2

### Original comment (verbatim)

> **P2 Badge**  Point to an existing backlog dependency
>
> This dependency note says the work composes with a
> "Closure-table hardening" row in the same `docs/BACKLOG.md`
> section, but there is no such row anywhere in the file
> (repo-wide search in `docs/BACKLOG.md` only finds this
> mention). That leaves this item with an unresolvable
> prerequisite, which weakens planning/ordering for the
> research phases because readers cannot find the referenced
> index-hardening task to scope or schedule it.

### Outcome

FIX — pointer made concrete. The "same section" wording was
wrong; the actual matching surfaces are `src/Core/Hierarchy.fs`
(live closure-table operator) plus the "Closure-table over
DBSP" research row under `## Research projects`. Bullet
rewritten to name both targets so a reader can navigate to
either the code or the paper-grade research row.

### Reply (verbatim)

> Fixed. Pointer rewritten to name two concrete surfaces:
> `src/Core/Hierarchy.fs` (live closure-table operator) and
> the "Closure-table over DBSP" research row under
> `## Research projects` in `docs/BACKLOG.md`. The original
> "same section" wording was wrong — the dependency lives in
> two places (code + research row in a different section),
> not a single hardening row in this P2 section. Resolved.

---

## Thread 2 — `docs/BACKLOG.md:5604` — title hyphen split

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59iRTm`
- Severity: P1

### Original comment (verbatim)

> P1: The line break in the checklist title splits a hyphenated
> term (`operator-` / `algebra`), which will render as
> "operator- algebra" in Markdown. Rewrap so `operator-algebra`
> stays intact (or remove the hyphen).

### Outcome

FIX — title rewrapped so `operator-algebra` stays on one line.
Soft line break moved between `SQL /` and `operator-algebra`.

### Reply (verbatim)

> Fixed. Title rewrapped so `operator-algebra` is contiguous
> on a single line. Resolved.

---

## Thread 3 — `docs/BACKLOG.md:5626` — closure-table-hardening hyphen split

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59iRT1`
- Severity: P1

### Original comment (verbatim)

> P1: This line wrap splits "closure-table-" from "hardening",
> which will render as "closure-table- hardening". Please
> rewrap without breaking the hyphenated token (or drop the
> trailing hyphen).

### Outcome

FIX — bullet rewrapped so `closure-table-hardening` stays
contiguous on a single line. Subsequent paragraph reflowed.

### Reply (verbatim)

> Fixed. Bullet rewrapped so `closure-table-hardening` is
> contiguous on a single line; subsequent text reflowed.
> Resolved.

---

## Thread 4 — `docs/BACKLOG.md:5650` — query-optimizer-expert inline-code split

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59iRT8`
- Severity: P0

### Original comment (verbatim)

> P0: The inline-code reference to `query-optimizer-expert` is
> split across lines as `query-optimizer-` / `expert`, which
> renders incorrectly (and can break readability/search).
> Rewrap so the inline-code token stays contiguous on one line.

### Outcome

FIX — bullet rewrapped so the inline-code token
`` `query-optimizer-expert` `` stays contiguous on a single
line. Subsequent lines reflowed.

### Reply (verbatim)

> Fixed. Bullet rewrapped so the inline-code token
> `query-optimizer-expert` is contiguous on a single line;
> the surrounding text reflowed without breaking other
> inline-code tokens. Resolved.

---

## Thread 5 — `docs/BACKLOG.md:5677` — memory/ prefix on memory pointer

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59iRUJ`
- Severity: P1

### Original comment (verbatim)

> P1: The memory reference is missing the `memory/` prefix
> (`project_semiring_parameterized_...`) unlike other BACKLOG
> entries (e.g. the existing semiring row uses
> `memory/project_semiring_parameterized_...`). Using the full
> `memory/...` path here avoids ambiguous references and makes
> the pointer unambiguous.

### Outcome

FIX — `memory/` prefix added to the memory pointer to match
the existing convention used at lines 7316 and 7409 of
`docs/BACKLOG.md`.

### Reply (verbatim)

> Fixed. Added the `memory/` prefix to the pointer
> (`memory/project_semiring_parameterized_zeta_regime_change_one_algebra_to_map_others_2026_04_22.md`)
> to match the convention used by the existing semiring rows
> at lines 7316 and 7409 of `docs/BACKLOG.md`. Resolved.

---

## Rebase summary

- Branch `backlog/cross-dsl-composability` rebased cleanly
  on `origin/main` (no conflict markers, no cascade).
- Thread fixes landed as a single follow-up commit on top of
  the rebase.

## Final state

- Unresolved threads: 0
- Auto-merge: armed (squash)
- Mergeable: MERGEABLE (pending CI re-run)
