---
id: 081KZZ0K0XM087G0R003RNC0C7
type: bug
state: backlog
priority: P2
slug: demo-identity-dla-site-toolchain-lags-the-root-ts-5-6-3-vs-6
title: "demo/identity-dla-site toolchain lags the root: TS 5.6.3 vs 6.0.3 and no tsconfig target"
created: 2026-08-14T02:11:04.244Z
depends_on: []
composes_with: []
---

# demo/identity-dla-site toolchain lags the root: TS 5.6.3 vs 6.0.3 and no tsconfig target

**Filed, deliberately not fixed** — aligning versions is a dependency decision with a wider
blast radius than the incident that surfaced it.

## The durable defect

`demo/identity-dla-site` type-checks with a **different, older** toolchain than the root, so code
written against the root is accepted by the author's tools and rejected by CI. The subpackage
keeps accepting code CI rejects, and each instance looks like a one-off code error rather than
the configuration skew it is.

| surface | root | `demo/identity-dla-site` |
|---|---|---|
| TypeScript | `6.0.3` (root `package.json`) | `5.6.3` (subpackage `devDependencies`) |
| `tsconfig` `target` | set | **absent** (so `tsc` defaults to ES5) |

## The skew is not merely "lagging" — for a while it was UNSATISFIABLE

The sharpest form of this, found while clearing lint on the same file: the two toolchains had
**contradictory** requirements on one annotation, so no written spelling satisfied both.

| toolchain | `Uint8Array` | `Uint8Array<ArrayBuffer>` |
|---|---|---|
| root, TS 6.0.3 | widens to `Uint8Array<ArrayBufferLike>`, **not** assignable to `BufferSource` → **TS2322** | fine |
| site, TS 5.6.3 | fine | not generic until 5.7 → **TS2315** |

So #10501 did not have a "correct" annotation available to it: fixing `Deploy to GitHub Pages`
(TS2315, subpackage) necessarily introduced 4× TS2322 in `lint (TS)` (root). Main was green on
Pages and red on lint for the same file, at the same commit, for exactly this reason — and that
looked like two unrelated problems.

**Resolved in source by removing the annotations** and letting inference do the work:
`new Uint8Array(new ArrayBuffer(n))` infers the precise `Uint8Array<ArrayBuffer>` under 6.0.3 and
plain `Uint8Array` under 5.6.3 — one spelling, both toolchains clean. That unblocks CI but does
**not** close this item: it is a workaround that happens to exist here, not a general one. The
next cross-version type disagreement may have no such escape hatch, which is the actual argument
for aligning.

## Two CHECKED instances, both from the same skew

1. **`Uint8Array<ArrayBuffer>` — broke `Deploy to GitHub Pages` on main (#10488 → fixed in #10501).**
   The generic form requires TS ≥ 5.7; under the subpackage's 5.6.3 it is
   `error TS2315: Type 'Uint8Array' is not generic`.

2. **`for...of` over a `Uint8Array` — caught pre-merge while fixing lint in the same file.**
   With no `target` in `tsconfig.json`, `tsc` defaults to ES5 and rejects iterating a typed array:
   `error TS2802: Type 'Uint8Array' can only be iterated through when using the
   '--downlevelIteration' flag or with a '--target' of 'es2015' or higher`.
   Note this second one is **not** the TS version — it is the missing `target`. Two distinct
   facets of one class: *the subpackage's type-checking configuration silently diverges from the
   root's*.

The second instance is the evidence that this recurs: it appeared in the very next change to the
very same file, found only because verification was run with the subpackage's own toolchain.

## Why it is not fixed here

Bumping `typescript` 5.6.3 → 6.0.3 and adding a `target` re-type-checks the whole site (1641
modules) against two majors of compiler changes and stricter defaults. That is its own change with
its own review, not a rider on a lint fix.

## Repro

```bash
cd demo/identity-dla-site && bun x pnpm@10.4.1 check   # the root `tsc` does NOT reproduce
```

## Options (not decided)

- Align `typescript` to the root pin and set an explicit `target` — removes the class.
- Or pin deliberately and **make the divergence loud**: a CI check that fails when a subpackage's
  `typescript` differs from the root's, so the skew is declared rather than discovered.

Either way the ask is the same: **the subpackage's toolchain divergence should be explicit,
not incidental.**

## Pointers

- `demo/identity-dla-site/package.json` · `demo/identity-dla-site/tsconfig.json`
- #10501 (instance 1) · the lint-audit PR that found instance 2
