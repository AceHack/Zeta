---
id: 081M01J3NPE087G0R000KXXQSM
type: bug
state: backlog
priority: P1
slug: an-aggregate-scan-floor-cannot-see-one-route-go-dark-convert
title: "an aggregate scan floor cannot see one route go dark -- convert multi-route floors to per-route"
created: 2026-08-15T01:55:44.462Z
depends_on: []
composes_with: []
---

# an aggregate scan floor cannot see one route go dark -- convert multi-route floors to per-route

## The defect class

A **scan floor** fails a check that inspected fewer items than a stated minimum — the
guard against a check silently becoming a no-op. It has earned itself twice here: one
guard shelled `rg`, which is absent on the CI runner, inspected 0 files, and its floor
caught it on the first CI run; `lint:markdown` linted nothing for months (#10712) until
a floor said so.

But a floor over a **total** is itself partially blind. Where the corpus arrives by
several independent routes, an aggregate floor **sums independent instruments, so it
cannot detect the failure of any one** — redundancy in the numerator hides a zero.

## The measured refinement (do not skip this)

The blindness is a property of **UNION** aggregation, not of multi-route corpora as such.
Two shapes are already sound and must not be churned:

- **Intersection corpora.** `audit-schema-key-set-parity.ts` compares only schema ids
  bound in **two** oracles at once. Killing either extractor drops the compared set to
  **0**, so its aggregate floor of 6 fires. Measured: F# route dark → exit 3, compared 0;
  TS route dark → exit 3, compared 0; both live → exit 0, compared 6.
- **A floor whose VALUE equals the mandatory route count.**
  `tests/cross-verification/_harness/cross-verify-ir.test.ts` requires ≥ 6 languages out
  of 7 attempted, where the 7th (Q#) is explicitly optional. ≥ 6 of 6 mandatory routes is
  per-route in effect. Fragile if an 8th language is added without raising the floor, but
  correct today.

## Converted (union corpora, aggregate floor, proven per-route)

| check | routes | was | now |
|---|---|---|---|
| `src/wasm-dla/bytelock/run-bytelock-ci.mjs` + `.github/workflows/bytelock.yml` | 9 substrates | `executed >= 2` | `BYTELOCK_REQUIRED_SUBSTRATES` names each required substrate; a typo in the list is a hard error |
| `src/Core.TypeScript/hygiene/no-agent-gate-bypass.test.ts` | 5 `git ls-files` roots | `files.length > 100` | a floor of ≥ 1 per root, plus a per-root readability floor |
| `full-ai-cluster/tools/k8s-manifests.test.ts` | 2 directory walks | `allYaml.length > 20` | a floor of ≥ 1 per walk |

Aggregate floors are **kept** in all three — the split raises the bar, it never lowers it.

## Two dark routes were already live on main

1. `no-agent-gate-bypass.test.ts` listed `skills` among its five search roots. Both of
   that root's tracked files are `.md`, which the check's own `ALLOWED` list excludes by
   design, so the root contributed **zero** — and `src/Core.TypeScript` alone contributes
   1678, so the floor of 100 never noticed. Removed rather than floored: a root that can
   only ever contribute excluded files is not coverage, it is the appearance of coverage.
   Executable skill surfaces live under `.claude/skills`, inside the `.claude` root.
2. The byte-lock's **Go** substrate has never executed in CI. `run-go-wasm.mjs` needs
   `dla-canonical-go.wasm`, which is not committed and is not built by the workflow, so
   it reports TOOLING-ABSENT every run — and `executed >= 2` was satisfied by the others.
   It is now **declared** absent in `bytelock.yml` rather than silently missing.

## No floor at all (reported, not blanket-fixed)

- `src/Core.TypeScript/lint/doc-comment-history-audit.ts` — 4 `SCAN_ROOTS`, no floor.
- `src/Core.TypeScript/hygiene/audit-research-docs.ts` — multi-root `DEFAULT_ROOTS`, no floor.

Adding floors to these is a judgement call per check and is deliberately left open;
an arbitrary floor that never fires is another blind instrument.

## Adjacent finding, not fixed here

`src/wasm-dla/bytelock/dla-canonical-zig.wasm` is not a WebAssembly module — it is an
`ar` archive (`!<arch>`), the unlinked `zig build-lib` intermediate. Every run reports
`expected magic word 00 61 73 6d, found 21 3c 61 72`. It is classified as a run error, so
it counts as *executed* and does not trip either floor. Rebuilding it needs a Zig
toolchain and belongs in its own change.

## The recursion

The audit shipped with this work-item (`audit-scan-floor-routes.ts`) is itself an
enumerating check, so it carries a **per-recognizer** floor: four independent recognizers,
each required to contribute ≥ 1. Its own source and test are excluded from its corpus —
measured, they self-satisfy three of the four routes, which without the exclusion would be
three floors that could never go dark.
