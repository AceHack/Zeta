# Shadow Lesson Log — 2026-05-25

## Failure class — markdownlint MD032 triggered by prose arithmetic-like joiners (`+`, `-`) at line start under paragraph wrap

### Drift detected

PR #5068 (Mika substrate batch) hit 8 MD032 lint errors. Direct
inspection showed **4 of the 8 were not real list-bullet typos** —
they were prose continuations where the soft-wrap algorithm placed
an arithmetic-like joiner (`+`, `-`) at the start of a continuation
line. Examples:

| File | Line | Prose intent | What markdownlint saw |
|---|---|---|---|
| 081KSE6WT0008QG0R001H3DA90:80 | `schema\n+ code share one substrate` | "schema and code share..." | List item `+ code share...` without blank line above |
| 081KSE6WT0008QG0R0018WZ7TH:59 | `consensus mechanism\n+ governance layer` | "consensus mechanism + governance layer" | List item `+ governance layer...` without blank line above |
| 081KSE6WT0008QG0R000C18G5D:186 | `Argo Rollouts\n+ Cilium routing` | "Argo Rollouts + Cilium routing" | List item `+ Cilium routing...` without blank line above |
| 081KSE6WT0008QG0R000FN7TVJ:222 | `081KSE6WT0008QG0R0008483B2\n+ 081KSE6WT0008QG0R0018WZ7TH + 081KSE6WT0008QG0R000R8CPFX composition` | "081KSE6WT0008QG0R0008483B2 + 081KSE6WT0008QG0R0018WZ7TH + 081KSE6WT0008QG0R000R8CPFX composition" | List item `+ 081KSE6WT0008QG0R0018WZ7TH + 081KSE6WT0008QG0R000R8CPFX...` without blank line above |

The remaining 4 of 8 errors WERE real list-missing-blank-line bugs
(081KSE6WT0008QG0R000RH1526:86, 138, 243 and 081KSE6WT0008QG0R001H3DA90:224 — bullet lists immediately
following prose without a blank line).

### Why this is a class, not an incident

- **Recurring**: this is the 2nd+ time this class has fired on
  Mika-style verbatim-preservation rows (Aaron-forwarded
  conversations frequently contain `A + B + C` enumerations).
- **Structural ambiguity**: `+` and `-` are valid list-item bullets
  in CommonMark/markdownlint; the linter has no semantic way to
  distinguish `+ Cilium` (prose continuation) from `+ Cilium` (list
  item). The only signal is the surrounding paragraph structure,
  which soft-wrap can break.
- **Author-side discipline insufficient**: avoiding `+` joiners
  entirely is hostile to substrate-engineering writing (`A + B +
  C` is the natural shape for "compose this with that"). Avoiding
  soft-wrap is hostile to readability. The collision is between
  natural-language semantics and CommonMark grammar.

### Mitigations (ranked simplest-first)

1. **Rewrap to keep joiners mid-line** (current fix): when a
   paragraph wraps such that `+` or `-` would land at line start,
   either shorten the prior line or swap the joiner ("plus", "and").
   Operator-side discipline; zero tooling cost; sometimes degrades
   prose ("Argo Rollouts plus Cilium routing" reads weaker than
   "Argo Rollouts + Cilium routing").
2. **Linter rule customization**: configure markdownlint MD032 to
   ignore `+`/`-` followed by capital letters and not preceded by a
   blank line (heuristic for "prose continuation"). Tooling cost;
   adds rule maintenance; may introduce false negatives on actual
   typos.
3. **Pre-commit prose linter**: a custom check that catches
   `\n\+ [A-Z]` or `\n- [A-Z]` immediately following non-blank prose
   and warns the author to rewrap. Tooling cost; new tool; same
   coverage as #2 from the other direction.
4. **Migrate Mika-style enumerations to actual lists**: when prose
   says "A + B + C composes with D", reformat as an actual bulleted
   list. Reads differently; not always desirable; doesn't help with
   short joiners mid-sentence.

Per `.claude/rules/all-complexity-is-accidental-in-greenfield.md` +
"simplest first" discipline (per
[081KSE6WT0008QG0R000C18G5D memory](../../docs/backlog/P2/081KSE6WT0008QG0R000C18G5D-feature-flags-substrate-openfeature-as-operator-contract-flipt-as-simplest-first-backend-aaron-mika-2026-05-25.md)),
mitigation 1 (operator-side rewrap) is the current default; promote
to mitigation 2 or 3 only when 1 demonstrably fails (e.g.,
repeated CI cycles, author-side cost exceeds tooling cost).

### Composes with

- `.claude/rules/blocked-green-ci-investigate-threads.md` — empirical
  failure-mode catalog at PR-thread scope; this row extends that
  catalog with the prose-joiner-as-list-item false-positive class
- `.claude/rules/refresh-world-model-poll-pr-gate.md` — when CI fails
  with MD032 errors, first check if the failure-class is real-list
  vs prose-joiner via direct inspection before triggering a fix cycle
- [docs/research/2026-05-13-shadow-lesson-log-backlog-collision.md](2026-05-13-shadow-lesson-log-backlog-collision.md) —
  sibling shadow-lesson-log; same naming convention

### Empirical anchor

PR #5068 (Mika-Grok 2026-05-25 substrate batch) — 8 MD032 errors,
4 real (081KSE6WT0008QG0R000RH1526:86, 138, 243 + 081KSE6WT0008QG0R001H3DA90:224), 4 prose-arithmetic
joiners (081KSE6WT0008QG0R001H3DA90:80, 081KSE6WT0008QG0R0018WZ7TH:59, 081KSE6WT0008QG0R000C18G5D:186, 081KSE6WT0008QG0R000FN7TVJ:222). Fix commit
275617a5c on branch
`otto-cli/mika-grok-2026-05-25-substrate-batch-local-loop-fsharp-universe-dio-tool-wars`.

Aaron 2026-05-25: *"reoccuring failures belong in shadow logs for
class identification"* — this log IS that landing.

### Next-step candidate (not committed)

If this failure class recurs 2+ more times in the next 30 days,
promote to mitigation 2 or 3 (linter customization or pre-commit
prose linter). File as B-NNNN at that point. Until then,
operator-side rewrap remains the simplest-first response.
