---
id: 081M0N90CHX087G0R0034C7NPT
type: bug
state: backlog
priority: P2
slug: ace-s-loaddependencygraphfromfile-declines-the-sync-wave-dep
title: "ace's loadDependencyGraphFromFile declines the sync-wave dependency graph: block scalars and non-empty flow sequences are out of the hand-rolled YAML subset, and the designed vendor fallback was never wired"
created: 2026-08-22T17:41:28.253Z
depends_on: []
composes_with: []
---

# ace's loadDependencyGraphFromFile declines the sync-wave dependency graph: block scalars and non-empty flow sequences are out of the hand-rolled YAML subset, and the designed vendor fallback was never wired

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0N90CHX087G0R0034C7NPT-*.md` glob. -->

## The report

`ace`'s `loadDependencyGraphFromFile` could not read
`full-ai-cluster/k8s/sync-wave-dependency-graph.yaml`:

    YAML parse failed: UnsupportedConstruct

`src/Core.TypeScript/cluster/derive-sync-waves.ts` and `lane-partition.ts` both
route around it by importing the `yaml` npm package. So the graph is valid YAML;
only ace's own loader declined.

## The actual construct — two of them, found by bisection not by guessing

Prefix-bisecting the file through `tryReadEvents` puts the FIRST decline at line
94, `      reason: >-` — a **folded block scalar**. A full scan of the file finds
two out-of-subset constructs, not one:

| construct | occurrences |
|---|---|
| block scalars (`>-`, and the `\|` form is the same class) | 44 |
| non-empty flow sequences (`dependsOn: [cilium]`) | 28 |

Empty flow `{}` / `[]` was NOT the problem — 081KT7YW00008QG0R002T1XNWT already
tokenises those into empty container event-pairs.

## Why the parser is not the bug

The hand-rolled reader is not an accident to be replaced. It is one of SIX
byte-locked oracles (TS / F# / C# / Rust / Go / Python) and its bound is an
operator-locked decision,
`docs/agendas/ace-package-manager/2026-06-01-yaml-port-forward-only-one-pass-cross-language-primitive-design.md`
Decision 2:

> "Anchors/aliases, tags, multi-document streams, flow style (`{}` / `[]`), and
> block scalars (`|` / `>`) are **out of scope** for the hand-rolled default; the
> wrapped vendor adapter covers them when a use case needs them."

`reader.ts`'s own header says the decline exists "so a caller can fall back to a
vendor adapter", and the LOCKED contract in the implementation plan repeats it.
**The adapter half was specified and never built.** That is the defect: not a
missing construct, a missing fallback.

Widening the subset in TS alone would make TS accept what Rust refuses with no
check able to see it. 081KT7YW00008QG0R002T1XNWT — the one prior subset change —
says it in its own body: **"do NOT do unilaterally"**.

## The fix

`src/Core.TypeScript/yaml/vendor.ts` — the wrapped vendor adapter, over
`Bun.YAML` (a Bun built-in, BCL-tier, named as the TS adapter by Decision 3, and
therefore ZERO new packages in ace's closure). `ace`'s `parseYaml` calls
`parseWithFallback`: our subset reader first, the adapter only on
`UnsupportedConstruct`. `dom.parse` is untouched; the six-oracle cross-verify
regenerates `ts-output.json` byte-identically.

## Two hardenings the measurement forced

1. **The fallback answers `UnsupportedConstruct` only.** Measured:
   `Bun.YAML.parse("a:\n\tb: 1\n")` returns `{a: null, b: 1}`, silently accepting
   a tab in indentation that our reader declines and the `yaml` package rejects
   outright. A blanket "decline ⇒ vendor" would have traded a correct refusal for
   a lenient misreading.
2. **Multi-document input is refused, not flattened.** Measured:
   `Bun.YAML.parse("a: 1\n---\nb: 2\n")` returns `[{a:1},{b:2}]` — structurally
   indistinguishable from a single document whose root is a sequence. `YamlValue`
   has no stream form, so the adapter refuses on a column-0 document marker.

## Three-way agreement

`ace` (via `Bun.YAML`) vs the `yaml` package vs `lane-partition.loadGraph` vs
`derive-sync-waves.readDeclaration`: 47 nodes and the identical edge set, and the
whole parsed document deep-equal. ace's reader is independent of the other three's,
so the agreement is evidence rather than a tautology.

## Falsifiers

`src/Core.TypeScript/ace/deps-graph-parse.test.ts`, 18 tests. Four load-bearing
assertions verified to FAIL against the pre-fix `deps.ts` with exactly
`YAML parse failed: UnsupportedConstruct`. Six mutants, each byte-`cmp`-verified as
applied before its result was read and byte-`cmp`-verified as restored after:
6/6 KILLED, 0 survivors.

## Not done here

ace still cannot answer "which Helm app groups are independently testable" —
`lane-partition.ts` answers it via dependency closures. With the graph now
readable, ace is roughly a 60-100 line step from reporting those closures itself
(`resolveGraph` already builds the adjacency); that is a separate row.
