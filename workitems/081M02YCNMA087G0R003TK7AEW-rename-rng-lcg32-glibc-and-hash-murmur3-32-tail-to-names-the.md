---
id: 081M02YCNMA087G0R003TK7AEW
type: task
state: backlog
priority: P2
slug: rename-rng-lcg32-glibc-and-hash-murmur3-32-tail-to-names-the
title: "Rename rng.lcg32_glibc and hash.murmur3_32_tail to names their ops entail (anchor-entailment defects)"
created: 2026-08-15T14:49:36.650Z
depends_on: []
composes_with: []
---

# Rename rng.lcg32_glibc and hash.murmur3_32_tail to names their ops entail (anchor-entailment defects)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M02YCNMA087G0R003TK7AEW-*.md` glob. -->

## The defect

Two registered generators are named for anchors their op lists do not implement.
Neither is an arithmetic bug — each IR computes exactly what it says — so what is
wrong is the **claim the name makes**, which is
`.claude/rules/anchor-to-human-prior-art.md`'s exact failure mode: an anchor
cited rather than checked.

**`rng.lcg32_glibc`** — computes `(1103515245*x + 12345) mod 2^32`. glibc's
TYPE_0 branch reduces **mod 2^31** and writes the masked value **back into the
state**, so its recurrence is mod 2^31 (`stdlib/random_r.c`, `__random_r`):

```c
int32_t val = ((read_state(state, 0) * 1103515245U) + 12345U) & 0x7fffffff;
write_state (state, 0, val);
```

Under that reading 4 of the 10 committed vectors differ:

| id | committed (mod 2^32) | glibc TYPE_0 (mod 2^31) |
|---|---|---|
| x-2 | 2207042835 | 59559187 |
| x-3 | 3310558080 | 1163074432 |
| x-6 | 2326136519 | 178652871 |
| x-7 | 3429651764 | 1282168116 |

Additionally, glibc's default `rand()` is not this generator at all: `random.c`
initialises `unsafe_state` with `.rand_type = TYPE_3`, the degree-31
additive-feedback trinomial. And the mod-2^32 form is not the ANSI C example
`rand()`'s **output** either — that example's state is an `unsigned long` and it
returns bits 30..16. The honest description is *a full-word 32-bit LCG carrying
the ANSI/glibc-TYPE_0 constant pair*. Candidate name: `rng.lcg32_ansi_constants`
(or any name that does not assert a specific implementation).

**`hash.murmur3_32_tail`** — computes `rotl(h,13); h = h*5 + 0xe6546b64`, which
in Appleby's `MurmurHash3_x86_32` is the **body-block** mix-combine (the last two
lines of the per-block loop, under the reference's own `// body` marker). The
section that reference labels `// tail` is the leftover-1..3-bytes path and
contains none of those three ops. Candidate name: `hash.murmur3_32_body_combine`.

## Price (measured 2026-08-15, not estimated)

`idOf name version` is a pure function of the name, so a rename moves the
generator's ZetaId, the `generator` field **inside** the content-addressed IR
document, and every golden byte derived from either. Files carrying each name,
excluding archived PR-review history:

| file | what changes |
|---|---|
| `src/Core/ZetaIrV4.fs` | the `Ir` literal's `Generator` field |
| `src/Core/GeneratorIrRegistry.fs` | the relation row + its payload |
| `src/Core/GeneratorRegistry.fs` | the `register` call |
| `src/Core/ComplexityRegistry.fs` | the complexity row key |
| `registry/complexity-registry.yaml` | same, source of truth |
| `src/Core.TypeScript/complexity/complexity-registry.gen.ts` | same, generated |
| `tests/cross-verification/_golden/zeta-ir-v4.golden.json` | **golden bytes** — the name is both the key AND embedded in the canonical-JSON value |
| `tests/cross-verification/_harness/generator-ir-registry.ts` | the KNOWN row |
| `tests/cross-verification/<name>/_gen/<name>.ir.json` | the `generator` field + the FILE NAME (discovery is `_gen/<dirname>.ir.json`) |
| `tests/cross-verification/<name>/` | the directory name itself |
| `tests/cross-verification/<name>/_gen/gen.ts`, `gen.py`, `vectors.yaml` | the `idOf(...)` lookup + the headers |
| `tests/Tests.FSharp/ZetaIrV4.Tests.fs` | (glibc only) the named binding |
| `tests/cross-verification/_harness/anchor-entailment.test.ts` | the pinned rows, which is the point — they should force this update |

11 files for murmur3, 13 for glibc, plus a directory rename each.

**`tests/cross-verification/generator-registry-id/vectors.yaml` does NOT byte-lock either name** — checked;
neither has a row there, so the id treaty lane is untouched. The
`treaty-byte-lock-vectors` pre-push floor **does** fire (any
`tests/cross-verification/` diff trips it), so the rename lands with the oracles
run locally and `ZETA_FLOOR_VECTORS_ACK=1`.

## Why it was not done in PR (this ticket's parent)

`src/Core/ZetaIrV4.fs` is owned by an agent in flight on the canonical IR
evaluator. A rename cannot be split from that file, so doing it unilaterally
would collide across an ownership boundary. Reported rather than resolved.

## Definition of done

1. Both generators renamed across the table above, directories included.
2. `zeta-ir-v4.golden.json` regenerated; the new ZetaIds recorded in the PR body.
3. `anchor-entailment.test.ts` updated so the two "anchors that DO NOT hold" rows
   become "anchors that HOLD" rows — and the glibc row either re-derives real
   glibc TYPE_0 (changing 4 vectors) or keeps mod-2^32 under a name that does not
   claim glibc. **State which**; they are different decisions.
4. `bun src/Core.TypeScript/ci/cross-verify-all.ts` and
   `bun test tests/cross-verification/_harness/` green.

## Open, deliberately unresolved

`rng.lcg64_mmix` uses increment `1442695040888963407` — the pairing
overwhelmingly cited as "Knuth MMIX", and the leading digits of
log2(e) = 1.442695040888963…, which is Knuth's habit. Wikipedia's LCG parameter
table currently gives the MMIX row as `c = 9754186451795953191`, sourced to
`rsixfour.c`. The **multiplier** 6364136223846793005 is uncontested. Which
increment Knuth's own MMIX source uses was **not** resolved here, and
`anchor-entailment.test.ts` pins both facts so the ambiguity is visible rather
than implied by silence. Resolve against a primary Knuth source before either
renaming or re-deriving this one.
