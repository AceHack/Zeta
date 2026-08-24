---
id: 081M0TKBDXN087G0R003HTKSAZ
type: task
state: backlog
priority: P2
slug: ace-runs-on-plain-node-16-extensionless-esm-specifiers-byte
title: "ace runs on plain node: 16 extensionless ESM specifiers + byte-identical output proof"
created: 2026-08-24T19:18:28.021Z
depends_on: []
composes_with: []
---

# ace runs on plain node: 16 extensionless ESM specifiers + byte-identical output proof

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0TKBDXN087G0R003HTKSAZ-*.md` glob. -->

## Why

`ace` is the one-liner installer's payload. Aaron's runtime ladder puts _recompile from
source_ above _download a trusted binary_ — "source you recompile is source you can verify;
a prebuilt binary is bytes you must trust". Before this change the only shippable ace
artifact was a **61 MiB `bun build --compile` binary**. Making node run the same source
converts the installer from "download a large trusted binary" into "run the source you
already cloned" on any host that has node — which node 24 is, on most of them.

## What was done

1. **16 extensionless relative import specifiers** across 10 files now carry explicit `.ts`
   extensions. Node's ESM resolver requires them; bun's does not; and `tsc` does not catch it
   either, because `moduleResolution: "bundler"` accepts extensionless exactly like bun. That
   is why nothing in the existing suite noticed.
2. **A regression test, `ace-node-runtime-parity.test.ts`**, with two guards: a static one
   (no extensionless specifier anywhere in ace's runtime closure, reported by name) and a
   dynamic one (the same ace commands under bun and under node produce **byte-identical
   stdout** and the same exit code).

## Measured findings — three numbers the prior audit had wrong

| claim (PR #14864 / the DECISIONS doc)                                                                | measured here                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "16 extensionless specifiers in a **24**-file closure"                                               | 16 is right; the closure is **25** files                                                                                                                                                                                                                    |
| all 16 are what blocks node                                                                          | **11** are load-bearing. Reverting each of the 16 one at a time and running node: 11 give rc=1, 5 give rc=0 because they sit behind `import type` and node's type-stripping erases them. All 16 fixed anyway — five silent traps is how the rung rots back. |
| `source-on-bun` "works", `addedBytes: 0`, "no install step"; `@noble/hashes` is a **node-rung** cost | **False.** With `node_modules` moved aside, **bun fails identically** (`Cannot find module '@noble/hashes/blake3.js'`). It is a cost of the **source rung**, not of any one runtime. The first measurement was taken with `node_modules` already on disk.   |

**The npm footprint is exactly one package.** ace's whole runtime closure needs
`@noble/hashes` 2.2.0 (MIT, **zero transitive dependencies**) — 98 files, 889,457 apparent
bytes, 1,072 KiB on disk. With a `node_modules` containing that and nothing else, **both**
runtimes reach rc=0. Not the 773-package dev install.

## Register: `metered`

"node can run ace" carries a byte-identical output comparison, so it is metered rather than
merely claimed: 13 scenarios compared byte-for-byte outside the repo, and 8 committed tests
inside it. The transcript compared is not a smoke test — it carries BLAKE3 digests computed
on both the write and read paths and an Ed25519 signature, all identical across runtimes.

## One measured limit: `ace deps` + out-of-subset YAML is bun-only

Found by measurement while closing a coverage gap (the parity scenarios did not originally
exercise the YAML modules this change touched). `ace deps validate` on a graph using flow
sequences or folded block scalars routes through `yaml/vendor.ts`, whose adapter is the Bun
built-in **`Bun.YAML`**. On node that path returns a **named refusal** (rc=1,
`Bun.YAML is unavailable on this runtime`) — not a crash, not a different answer. Subset-YAML
graphs validate byte-identically on both. Pinned by a test asserting the refusal is named and
stdout stays empty. Not closed here: widening the TS subset unilaterally is forbidden
(081KT7YW00008QG0R002T1XNWT), so the fix is a node-side vendor adapter and its own decision.

## Open — named, not silently assumed

- **`clone-at-tag` is NOT violated**, but the one-liner story is weaker than §5 implied: the
  source rung needs one npm package on any runtime. The repo's own bootstrap already runs
  `bun install --frozen-lockfile`, and the `clone-at-tag` lint is about `ace`-as-resolver, not
  about npm. Still: "run the source you already have" is really "run the source you already
  have, plus fetch one MIT package". Vendoring a pure-TS BLAKE3 would close it — not attempted
  here (it is crypto in the proof tier and deserves its own decision).
- **node prints a 4-line `MODULE_TYPELESS_PACKAGE_JSON` advisory on stderr** every run, because
  the root `package.json` has no `"type"` field. stdout is unaffected and parity holds. Setting
  `"type": "module"` repo-wide would silence it and was NOT attempted: it changes module
  resolution for every `.js` in the tree and is a separate, riskier change.
