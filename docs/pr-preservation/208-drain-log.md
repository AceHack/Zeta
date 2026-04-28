# PR #208 drain log — production-tier craft ladder v0 + first module

PR: <https://github.com/Lucent-Financial-Group/Zeta/pull/208>
Branch: `craft/production-dotnet-checked-vs-unchecked-v0`
Drain session: 2026-04-24 (Otto drain subagent per Otto-228
three-axis drain)
Thread count at drain start: 4 unresolved (all Copilot P1/P2)
Axes drained: DIRTY (rebase onto main), failing CI (markdownlint
MD018), review threads (4 unresolved).

Rebase context: branch was `DIRTY` against `origin/main` via
append collision on `docs/hygiene-history/loop-tick-history.md`.
Resolved by preserving main's content in full (including the 15
round-44 rows added post-fork-point) and keeping the PR's single
auto-loop-48 row appended at end. Per Otto-229 append-only
discipline: two in-PR timestamp-edit commits (b6f64fd +
4ec930e's tick-history hunk) were skipped during rebase
because reapplying them would have constituted editing a row
that had just been introduced in the prior rebase step. Skip
was the append-only-faithful choice; the skipped metadata
(timestamp correction + line-count update) is preserved on
this row instead.

Markdownlint MD018 fix: `docs/craft/subjects/production-
dotnet/README.md:9` began with `#200` which lint parsed as an
ATX heading without space. Rewrapped so the line starts with the
word "PRs" followed by the hash inside inline-code spans.

Per Aaron's 2026-04-24 PR-comment-preservation directive
(Otto-250: PR review comments + responses + resolutions are
high-quality training signals): full per-thread record with
verbatim reviewer text, outcome, verbatim reply, and
resolution commit.

---

## Thread 1 — `docs/craft/subjects/production-dotnet/checked-vs-unchecked/module.md:77` — table leading pipes

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59bdn1`
- Severity: P1

### Original comment (verbatim)

> The table syntax has an extra leading `|` on each row (`|| ...`),
> which will render as an unintended empty first column (or render
> inconsistently). Change the table rows to start with a single `|`
> (e.g., `| Class | Definition | Default |`) and similarly update
> the separator/header rows.

### Outcome — FIX (already in branch, pre-rebase)

Already fixed in PR commit `1c7f97d` (branch's earlier
review-round). After rebase the table at lines 70-77 uses
single leading pipes:

```
| Class | Definition | Default |
|---|---|---|
| **Bounded-by-construction** | ... | unchecked (F# default) |
...
| **SIMD-candidate** | ... | unchecked with block-boundary overflow detection |
```

### Reply (verbatim)

> Already resolved on the current HEAD — the branch was fixed in
> commit `1c7f97d` during an earlier review-round. Module.md lines
> 70-77 now render a clean single-leading-pipe table. Thanks for
> catching the original syntax; closing as obsolete.

### Resolution

Resolved on branch HEAD (no new commit needed; fix was already
landed in `1c7f97d`).

---

## Thread 2 — `docs/craft/subjects/production-dotnet/README.md:44` — table leading pipes

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59bdoN`
- Severity: P1

### Original comment (verbatim)

> Same issue as the module: the table uses `||` at the start of
> each row, which creates an unintended empty column / inconsistent
> rendering. Use single leading pipes for Markdown tables (e.g.,
> `| Module | Focus | Zeta touchpoint |`).

### Outcome — FIX (already in branch, pre-rebase)

Already fixed in PR commit `1c7f97d`. README.md lines 42-44 now
use single leading pipes:

```
| Module | Focus | Zeta touchpoint |
|---|---|---|
| [`checked-vs-unchecked`](checked-vs-unchecked/module.md) | ... |
```

### Reply (verbatim)

> Already resolved — same fix as the module-table thread in
> commit `1c7f97d`. README.md lines 42-44 now render as a
> single-leading-pipe table. Closing as obsolete.

### Resolution

Resolved on branch HEAD (no new commit needed).

---

## Thread 3 — `docs/craft/subjects/production-dotnet/checked-vs-unchecked/module.md:90` — "material-ise" hyphenation

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59bdod`
- Severity: P2

### Original comment (verbatim)

> 'material-ise' looks like an accidental hyphenation; use a single
> word ('materialise' or 'materialize') to avoid reading as a
> line-break artifact.

### Outcome — FIX (this drain)

Dehyphenated `material-ise` -> `materialise` on line 90. The
preceding "SIMD-vectorisable" on line 89 is an intentional
compound; this one was a genuine line-wrap artifact.

### Reply (verbatim)

> Fixed in commit `6ae4a2b` — dehyphenated 'material-ise' to the
> single word 'materialise' on line 90. You were right that it
> read as a line-break artifact rather than intentional
> compounding.

### Resolution

Resolved after commit `6ae4a2b`.

---

## Thread 4 — `docs/craft/subjects/production-dotnet/checked-vs-unchecked/module.md:1` — PR description line-count accuracy

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59bdou`
- Severity: P2

### Original comment (verbatim)

> PR description says this module is "~260 lines", but the added
> file is 421 lines in this PR. Please update the PR description
> (or the module scope claim) so reviewers and future readers
> aren't anchored to an inaccurate size/effort statement.

### Outcome — FIX (PR body edit)

Updated PR body via `gh pr edit 208 --body-file`. The original
`~260 lines` bullet in the PR description now reads
`(~421 lines after review-round-1 corrections; v0 was ~260 lines)`
so the growth trajectory is preserved as audit-context
rather than erased.

### Reply (verbatim)

> Fixed in the PR description — updated the bullet from "~260
> lines" to "(~421 lines after review-round-1 corrections; v0 was
> ~260 lines)" so the v0 scope claim and the post-review line
> count are both preserved. Review rounds grew the module from
> ~260 to 421 by adding the Sound SIMD overflow detection
> section, the FsCheck joint-length-cap + BigInteger-reference
> bound proof, and the assert-in-production warning with three
> sound alternatives (checked the rebased file with `wc -l`: 421
> exact). Closing.

### Resolution

Resolved after PR body edit (no commit needed since PR body
lives outside the diff).

---

## Post-drain state snapshot

- Unresolved threads: 0 (all 4 drained)
- DIRTY: cleared (rebased onto main; 3 commits preserved over
  main as `9c60078` + `f2ba122` + `e06fc15` + this drain's
  `c36029c` + `6ae4a2b`).
- Failing CI: `lint (markdownlint)` fixed (MD018 on
  README.md:9) in commit `c36029c`.
- Auto-merge: armed pre-drain; will fire once checks re-run
  green.
- File count in PR: 3 (README.md + module.md +
  loop-tick-history.md one-row append).
- Module line count: 421 exact (confirmed via `wc -l`).
