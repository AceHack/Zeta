---
name: Orphan role-ref after name-stripping — Aaron 2026-04-28 — when stripping named attribution leaves a role-ref that no longer makes sense, REMOVE the comment / attribution-clause entirely instead of leaving the orphan
description: Aaron 2026-04-28 caught a recurring failure mode in name-attribution corrections — when the original code/comment/doc mentions a named source ("Amara ferry-12") and the role-ref discipline strips the name, the resulting orphan ("courier-ferry-12 absorb") doesn't carry the same semantic weight. Two paths forward (a) recover the named source on a history surface, (b) remove the comment / attribution-clause entirely. The middle ground (orphan role-ref) is worse than either. Aaron explicit verbatim 2026-04-28 in PR #24 review
type: feedback
---

# Orphan role-ref after name-stripping

## Verbatim quote (Aaron 2026-04-28)

> "courier-ferry-5 absorb this does not really make sense with amamras
> name, we could remove the comment all together"

> "not sure if you can update to find things like that that don't make
> sense in the future like look for courrier-ferrrrry or whatever IDK
> just thinking out out for your future self and the review agentsd"

## The pattern

When applying the Otto-279 history-surface-vs-code-surface discipline to
strip named attribution from code (scripts, behavioural docs, public
prose), the mechanical replacement `<Name> ferry-N` → `courier-ferry-N
absorb` produces an **orphan role-ref**: a phrase that points at a
substrate source-anchor whose source-name has been removed.

Examples caught in PR #24:

| Original (history-surface OK) | Mechanical strip (orphan)             | Better path |
|------------------------------|---------------------------------------|-------------|
| `Amara ferry-12`              | `courier-ferry-12 absorb`             | Remove the parenthetical; the class name stands alone |
| `Grok ferry-16 invariant`     | `courier-ferry-16 absorb invariant`   | Use the principle name directly: "Substrate Truth Principle invariant" |
| `Per Amara ferry-7 evidence-pointer rule` | `Per courier-ferry-7 absorb evidence-pointer rule` | Drop "Per ferry-N" entirely; the rule is in the spec |
| `Gemini ferry-8's example draft` | `courier-ferry-8 absorb example draft` | Replace with role-ref class: "any external example draft" |

The orphan form fails because:

1. **Numbered ferry IDs are meaningful only with the named source.**
   "ferry-12" is Amara-specific terminology in this factory; without
   "Amara" it's just a number with no resolvable referent.
2. **The role-ref form `courier-ferry-N` is verbose without adding
   meaning.** Readers who don't know the substrate vocabulary see noise.
3. **Removing the substrate-source-anchor entirely is usually OK** —
   the technical content (class name, principle name, rule shape)
   stands on its own. The named source belongs in commit-message
   trailers / history-surface docs / memory files, not in code
   comments.

## The discipline

When stripping named attribution from a code comment / FAIL message /
script header:

1. **First check:** does the resulting text still make sense without
   the named source?
2. **If yes** (e.g., the principle name is self-explanatory) → the
   strip is fine
3. **If no** (orphan role-ref, missing referent) → remove the
   attribution clause entirely. Don't keep half-attribution.

## Detection (future structural fix)

Aaron's framing 2026-04-28: *"not sure if you can update to find things
like that that don't make sense in the future ... for your future self
and the review agents"* — suggesting a lint that catches the pattern.

Candidate detector regex (for code-surface files only — `tools/`,
`docs/` excluding history-surfaces, behavioural docs):

```
\bcourier-ferry-\d+\b
\bferry-\d+\b
\bferry-\d+'s?\b
```

Plus the inverse: `\b<Person>\s+ferry-\d+\b` (Amara/Grok/Gemini etc
+ ferry-N) to catch un-stripped name attribution that should have
been stripped on code-surface.

The lint composes with the `prompt-protector` skill's invisible-Unicode
lint shape (write-time scan). Backlog candidate: B-NNNN — extend the
existing `audit-*` scripts under `tools/hygiene/` to flag these
patterns with a fix-suggestion: "remove the attribution clause OR
move to history-surface OR replace with a self-contained principle
name."

## What this does NOT mean

- Does NOT mean named attribution is forbidden everywhere — it's
  the correct framing on history surfaces (`memory/`,
  `docs/research/`, `docs/ROUND-HISTORY.md`, `docs/DECISIONS/`,
  hygiene-history, commit messages) per the Otto-279 carve-out at
  `docs/AGENT-BEST-PRACTICES.md` "history-surface name attribution
  exemption" section.
- Does NOT mean automatic strip-attribution scripts are dangerous
  — they're useful when paired with a downstream check that catches
  orphans.
- Does NOT mean every cross-source citation needs to be removed —
  citations to canonical principles (e.g., "Substrate Truth Principle",
  "Otto-279 carve-out") that have their own resolvable name are fine
  on code surfaces.

## Composition with prior substrate

- **Otto-279** history-surface name-attribution carve-out at
  `docs/AGENT-BEST-PRACTICES.md` ~287-348 — the rule that defines
  WHICH surfaces get named attribution
- **`feedback_otto_357_no_directives_aaron_makes_autonomy_first_class_accountability_mine_2026_04_27.md`**
  — the pre-write self-scan rule for forbidden-token detection;
  this orphan-role-ref rule is the same shape (write-time scan)
  applied to a different category
- **Otto-341 mechanism-over-vigilance** — the lint detector composes
  with the discipline; vigilance-only enforcement is structurally
  insufficient
- **`prompt-protector` skill** — invisible-Unicode lint shape;
  orphan-role-ref lint would compose at the same write-time-scan
  layer

## Triggers for retrieval

- Aaron 2026-04-28: "courier-ferry-5 absorb this does not really make
  sense with amamras name"
- Aaron 2026-04-28: "look for courrier-ferrrrry or whatever IDK just
  thinking out out for your future self and the review agentsd"
- Pattern: orphan role-ref after name-stripping
- Detection regex: `\bcourier-ferry-\d+\b`, `\bferry-\d+\b` on
  code-surface files
- Better path when stripping name from `<Name> ferry-N`: remove the
  attribution clause entirely OR replace with self-contained principle
  name
- Composes with Otto-279 carve-out + Otto-357 pre-write self-scan +
  Otto-341 mechanism-over-vigilance + prompt-protector skill
