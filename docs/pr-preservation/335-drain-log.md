# PR #335 drain log — `backlog: elevate git-native PR-preservation P2→P1 + phased plan (Otto-150..154)`

Drain ferry: 2026-04-24. Resolution commit (review-thread fixes) on top of the rebased branch: `e80a326`. Auto-merge armed; rebased onto fresh `origin/main` before drain. PR scope is docs-only (single file: `docs/BACKLOG.md`).

Per Otto-250 PR-preservation drain-log discipline: per-thread fields are reviewer, file:line, original comment verbatim, outcome, reply verbatim, resolution commit. Bot handles preserved verbatim per Otto-237.

---

## Thread 1 — `PRRT_kwDOSF9kNM59VtxI`

- **Reviewer:** Copilot
- **File:line:** `docs/BACKLOG.md:4597` (diff line; the referenced "Composes with ... docs-lint/memory-no-lint policy" sentence is now at the bottom of the moved row, post-rebase)
- **Outcome:** FIX
- **Resolution commit:** `e80a326`

### Original comment

> "docs-lint/memory-no-lint policy" is referenced as if it's an established named policy, but this phrase doesn't appear elsewhere in the repo. Consider replacing it with a concrete citation (e.g., the specific config/file that enforces "docs are linted, memory is ignored") so future implementers know what rule you mean.
>
> ```suggestion
>   maintainer-owned forks (`<fork-owner>/Zeta`) AND under the
>   org account (`Lucent-Financial-Group/Zeta` main). Same
>   schema, same workflow, different event sources.
>
>   (ii) **Fork-upstream-sync obligation.** When a fork of the
>   repo runs its own Copilot / Codex
> ```

### Reply

> Fixed in e80a326. The bottom "Composes with ..." now points at the in-row "Docs/memory lint policy reference" block (added earlier in 4f330cc) and cites `.markdownlint-cli2.jsonc` + the `memory/**` ignore-pattern enforcement explicitly. The phrase now has a concrete grounding instead of standing as an unanchored named policy.

---

## Thread 2 — `PRRT_kwDOSF9kNM59Vtx0`

- **Reviewer:** Copilot
- **File:line:** `docs/BACKLOG.md` (line null on the latest diff — comment was on a since-edited block in Phase 3)
- **Outcome:** BACKLOG+RESOLVE (already addressed in commit `4f330cc` before this drain)
- **Resolution commit:** `4f330cc` (prior commit on this branch)

### Original comment

> The workflow trigger syntax in backticks (`pull_request_target: closed` with `merged == true`) reads like literal YAML, but it isn't valid GitHub Actions syntax. If this is meant as an implementation hint, rephrase to the actual `on: pull_request_target` + `types: [closed]` shape and the real merge condition (`github.event.pull_request.merged`).
>
> ```suggestion
>   Phase 2 signs off).** GHA workflow with `on:
>   pull_request_target` and `types: [closed]`, gated on
>   `github.event.pull_request.merged`, fetches threads via
>   `gh api graphql`, writes to
>   `docs/pr-discussions/PR-<N>-<slug>.md` on a de
> ```

### Reply

> Already fixed in 4f330cc on this same branch. The Phase 3 block now has a real fenced YAML example (`on: pull_request_target: types: [closed]`) plus the merge gate `if: github.event.pull_request.merged == true`. Resolving.

---

## Thread 3 — `PRRT_kwDOSF9kNM59VtyM`

- **Reviewer:** Copilot
- **File:line:** `docs/BACKLOG.md` (line null on latest diff — Phase 3 security)
- **Outcome:** NARROW+BACKLOG (security constraints landed; safer-alternative suggestions noted as Phase-1-design options)
- **Resolution commit:** `e80a326` + `4f330cc`

### Original comment

> Phase 3 proposes `pull_request_target` for an auto-archiving workflow that would write branches/PRs back to the repo. That event runs with elevated permissions and is a common footgun; the plan should explicitly constrain it to avoid checking out/executing PR-head content and consider safer alternatives (e.g., `push` on `main` after merge, or a `workflow_run` chain) if write access is required.
>
> ```suggestion
>   Phase 2 signs off).** GHA workflow on trusted post-merge
>   context (`push` on `main` after merge; `workflow_run`
>   chaining if a second write-capable workflow is needed),
>   fetches threa
> ```

### Reply

> Two-part fix. (1) Security constraints for `pull_request_target` were added in 4f330cc — MUST-NOTs on checking out PR head, MUST-NOTs on `${{ github.event.pull_request.* }}` substitution in `run:` steps, minimal `permissions:` declaration, SHA-pinning for `actions/*`. (2) e80a326 explicitly notes the reviewer's safer-alternative suggestions (`push` on `main` after merge, `workflow_run` chain) remain on the table for Phase 1 design — Phase 1 picks the mechanism, the constraint block applies if `pull_request_target` is the chosen mechanism.

---

## Thread 4 — `PRRT_kwDOSF9kNM59Vtyl`

- **Reviewer:** Copilot
- **File:line:** `docs/BACKLOG.md:4581` (diff line — old non-goal text on agent privacy)
- **Outcome:** FIX (already corrected in commit `4f330cc`)
- **Resolution commit:** `4f330cc`

### Original comment

> The non-goal "redacting Copilot / Codex-connector reviews (they're bot content without privacy concern)" is unsafe and also contradicts Phase 2's privacy questions. Bot-authored comments can still contain sensitive material (e.g., echoed secrets/URLs pasted by humans, or internal details), so Phase 2 should explicitly decide whether bot comments are included in the privacy/redaction pass (even if the outcome is "usually no redaction").

### Reply

> Already fixed in 4f330cc. The earlier non-goal phrasing was reversed — the row now states the prior phrasing was wrong, calls out that agent-authored content can still echo secrets / internal URLs / customer identifiers pasted by humans, scopes Phase 2's privacy pass to ALL archived content (agent-authored included), and explicitly does not pre-commit to "agent content archives verbatim without review." Trust posture default for agent content is documented as higher (no hand-typed free-form prose) but not zero-risk; Aminata threat-review sets the per-source posture. Resolving.

---

## Thread 5 — `PRRT_kwDOSF9kNM59YY8N`

- **Reviewer:** Copilot
- **File:line:** `docs/BACKLOG.md:4556` (diff line — broken inline-code span in the docs/memory lint policy reference block)
- **Outcome:** FIX
- **Resolution commit:** `e80a326`

### Original comment

> This inline code span is split across two lines (`...decides_` then `where_external_content_lives...`). Markdown inline code cannot contain newlines, so the rendered path/reference will be broken and the cross-reference becomes hard to use. Keep the full filename on a single line (or switch to a normal markdown link) so it reliably renders and can be searched/copied.
>
> ```suggestion
>   no-lint" split is the convention documented in `memory/feedback_docs_linted_memory_not_otto_decides_where_external_content_lives_2026_04_24.md`
>   + enforced by `.markdownlint-cli2.jsonc` (which excludes
> ```

### Reply

> Fixed in e80a326. The reference is now a markdown link with the full filename on one line, so it renders reliably and is grep-able / copy-able. Switched from inline backticks (which can't span newlines) to `[`...`](...)` link form so the reference is also a clickable anchor in rendered views.

---

## Thread 6 — `PRRT_kwDOSF9kNM59YY87`

- **Reviewer:** Copilot
- **File:line:** `docs/BACKLOG.md:4487` (diff line — row at top of P2 section declaring Priority: P1)
- **Outcome:** FIX (relocate row to P1 section)
- **Resolution commit:** `e80a326`

### Original comment

> This item is under the `## P2 — research-grade` section but declares **Priority: P1**. That creates an internal inconsistency in the backlog structure and makes it harder to find P1 work. Either move this row into the appropriate P1 section (or update the surrounding section header) so priority matches placement.
>
> ```suggestion
> - [ ] **Git-native PR-conversation preservation — extract PR review threads + comments to git-tracked files on merge, PLUS backfill of all historical PRs.** **Priority: P2.** Aaron Otto-113 originating directive: *"you probably need to resolve and save the conversations
> ```

### Reply

> Fixed in e80a326 by relocating the row, not by reverting the priority. The Otto-150..153 burst explicitly elevated this row P2 → P1, so the right move is to honor that priority and put the row under a P1 header. New home: `## P1 — Git-native hygiene cadences (Otto-54 directive cluster)` — that section's theme ("git-native posture lets git log itself detect and guide cleanup") is the closest semantic fit. Header annotation in the row records the elevation source and the relocation rationale so the audit trail survives. Resolving.

---

## Thread 7 — `PRRT_kwDOSF9kNM59YY9O`

- **Reviewer:** Copilot
- **File:line:** `docs/BACKLOG.md:4506` (diff line — Phase 2 paragraph, "+reference)" continuation)
- **Outcome:** FIX
- **Resolution commit:** `e80a326`

### Original comment

> The line break before `+reference` starts a continuation line with `+` inside a list item, which markdownlint can parse as a nested `+` bullet (MD004/ul-style) and fail CI. Reword so the wrapped line does not begin with `+` (e.g., "and reference").
>
> ```suggestion
>   and reference)? Does Aminata recommend a different trust
> ```

### Reply

> Fixed in e80a326 with the reviewer's suggested wording: "or hash and reference)". Removes the MD004 trip risk; `and` is also clearer prose than the `+` operator-style join in this context.

---

## Drain summary

- **Threads:** 7 unresolved at start, 7 resolved at end.
- **Outcome distribution:** 5 FIX (threads 1, 4, 5, 6, 7), 1 NARROW+BACKLOG (thread 3), 1 BACKLOG+RESOLVE (thread 2). Threads 2, 3, 4 were addressed by the prior commit `4f330cc` on this branch; threads 1, 5, 6, 7 land in `e80a326`.
- **Rebase:** Clean. Rebased branch from 4-commit history (`896f085`, `07336a8`, `48c5d6a`, `4f330cc`) onto fresh `origin/main`; no conflicts.
- **Final commits on branch (post-drain):** rebased base + the four original commits + `e80a326` review-thread-fix commit.
- **Build gate:** N/A — docs-only change to `docs/BACKLOG.md`.
- **Auto-merge:** armed pre-drain; expected to land once required-conversation-resolution and check-suite gates are green.
