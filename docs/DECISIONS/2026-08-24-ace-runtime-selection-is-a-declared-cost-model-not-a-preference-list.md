# Decision: ace picks its runtime from a declared cost model, not a preference list

**Date:** 2026-08-24 · **Driver:** Aaron · **Status:** proposed — NOT landed, awaiting sign-off on §7
· **Class:** infrastructure · **Owner:** dejan (devops-engineer)
· **Work-item:** 081M0TAQY5X087G0R000N681C6

## Carved sentences (Aaron 2026-08-24)

> _"can we move forware the one liner ace installer from our github public packages?"_
>
> _"ace should choose install based on what is already installed to choose the best smallest runtime"_
>
> _"so it can choose things like dotnet over rust etc based on what's there already"_
>
> _"the perference is how to recomp9le on your existing toolchian or report it missing then we do total biany only on total absence"_
>
> _"imagine every install has a cost that can be qantived that our untimatel ace depdency order on what is enables"_
>
> _"yes dotnet as a huge enablement on every os is a qualia over time not a fact"_

## 1. The decision

ace does not carry a hardcoded runtime preference. It carries a **declared cost model**, and the
install order is that model's **output**, computed against the host it is standing on. A ladder
written down is a guess; a ladder computed is an argument a reader can check.

Three modules, deliberately separated:

| module                  | answers                            | kind          |
| ----------------------- | ---------------------------------- | ------------- |
| `runtime-probe.ts`      | _which toolchains exist here_      | observation   |
| `runtime-candidates.ts` | _what each rung costs and unlocks_ | declaration   |
| `runtime-cost.ts`       | _given those, what should we do_   | pure function |

Fusing (a) and (c) is how a chooser ends up with a preference list hiding inside a probe.

## 2. Cost is a FACT, enablement is a QUALIA — and they are never fused

This is the load-bearing distinction and it comes straight from Aaron's correction.

- **Cost** — bytes added to this host. Measurable, reproducible, dated, attributed to a method.
  Either it was measured or it was not; there is no third option and no estimate.
- **Enablement** — what an install unlocks _beyond ace itself_. This is a **judgment about future
  usefulness**, held by a named observer, true-ish at a date. ".NET unlocks a lot" is not
  discoverable by inspecting a host, and its value in 2020, 2026 and 2030 differ.

So the model **refuses to emit a single blended score**. A blend hides which half is evidence and
which is opinion — exactly the defect
[`toy-is-free-metered-must-be-earned.md`](../../.claude/rules/toy-is-free-metered-must-be-earned.md)
names: a quantity that was not measured must never render like one that was.

Consequences, all enforced by tests:

1. `rank()` takes an explicit `enablementWeight`. **The ordering is conditional and says so.**
2. Every enablement carries `by`, `on`, `rationale`, and `register: "unmetered-by-nature"` —
   _not_ "unmetered because nobody got round to it", but _not the kind of thing that gets
   measured_. The distinction is the whole point of the register.
3. `sensitivity()` reports how far the judgment must move before the winner changes, so a peer can
   dispute the judgment without disputing the byte counts.
4. An `unmetered` cost **never wins on a number nobody produced** — it sorts last within its trust
   band rather than being handed a plausible figure.

## 3. The order is a TRUST order, and size is the tiebreak

Aaron's ordering is not size-minimisation and reading it that way loses the point:

> Source you recompile is source you can **verify**. A prebuilt binary is bytes you must **trust**.

So `trust.rank` dominates in `rank()`, and cost/enablement only break ties within a band. The
report states, per rung, **what you must trust** — not only what it costs, because that is the
actual decision criterion. This is the local form of Aaron's standing arc: _rewrite our
dependencies, ultimately the OS — the ultimate supply-chain control_, applied to ace's own
distribution.

## 4. "Toolchain missing" is a RETURN VALUE, not a log line

Rung 2 of Aaron's ladder is the one most easily lost. `choose()` returns a three-way `Selection`:

- `selected` — a rung was chosen;
- `toolchain-missing` — **no rung is viable, and ace did NOT quietly hand you a binary instead**;
- `indeterminate` — the probe _did not run_; absence was **not** assumed.

That third state reuses the repo's existing evidence vocabulary
(`federated-identity/ports.ts` `RootEvidenceState`) rather than coining a new one. It is
load-bearing: "this host has no .NET" and "I could not tell" license different actions, and
collapsing them is the check-that-did-not-run wearing a result.

## 5. THE COMPUTED LADDER DISAGREES WITH THE STATED LADDER — reported, not tuned

Aaron's stated ladder is: recompile → report missing → TS+wasm → .NET AOT native.

Running `runtime-plan.ts` over the declared candidates gives, on **every** host profile, either
`source-on-bun` or `TOOLCHAIN MISSING`. **Rungs 3 and 4 never appear.** Not because they rank
badly — because they are **unbuildable today**, measured:

| rung                 | state       | measured blocker                                                                                                                                                              |
| -------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `source-on-bun`      | **works**   | `ace.ts list` rc=0; keygen/trust/registry exercised                                                                                                                           |
| `source-on-node`     | **blocked** | 16 extensionless import specifiers; rc=1 `ERR_MODULE_NOT_FOUND`. Rewriting exactly those 16 made node run it (rc=0, output identical to bun). Also needs npm `@noble/hashes`. |
| `portable-wasm`      | **blocked** | TypeScript does not compile to wasm. Needs an AssemblyScript rewrite or a JS engine in wasm.                                                                                  |
| `native-dotnet-aot`  | **blocked** | ace is TypeScript — there is no .NET ace. And F# AOT itself is not ready (§6).                                                                                                |
| `native-bun-compile` | **works**   | 63,627,746 B (61 MiB), runs                                                                                                                                                   |

Per the instruction not to fit: **the judgments were declared first and the model was not adjusted
to reproduce the expected order.** The disagreement is the finding. A ladder with two real rungs
and three named blockers beats a ladder with five where three are stubs, because only the second
looks like coverage.

**Second finding: the enablement dial currently changes nothing.** `sensitivity()` reports a single
band on every profile. Trust rank dominates and only one rung is ever viable, so the entire
enablement apparatus is presently _unexercised_. It is built correctly and it is not yet earning
its keep. That is worth knowing before anyone treats the cost model as validated.

## 6. F# NativeAOT: a false green, measured

`dotnet publish -c Release -r osx-arm64 -p:PublishAot=true` on a **hello-world** F# console app:

- **publish rc=0**, produced a 1,134,392-byte binary, and emitted **zero** IL2*/IL3* trim warnings;
- **the binary crashes on execution: rc=134, `System.IO.FileNotFoundException: FSharp.Core`.**

A publish that reports success and yields a binary that cannot start is precisely the defect class
this repo treats as a bug. A mitigation (`TrimMode=partial` + `TrimmerRootAssembly FSharp.Core`)
**failed to build** (rc=1), so the crash above is from the prior artifact and the mitigation is
**unproven, not disproven**. Registered `unmetered` for ace specifically, since ace is not .NET at all.

## 7. OPEN QUESTIONS — the publish leg is NOT built, and needs one line from Aaron

Per the brief, these are named rather than guessed. **No registry entry has been created and
nothing publicly visible has been configured.**

1. **Registry namespace.** `Lucent-Financial-Group/Zeta` is the origin. Publish ace to GHCR under
   `ghcr.io/lucent-financial-group/ace`, or to npm as a public package, or as GitHub Release
   assets? _(expected answer: one of the three)_
2. **Package visibility.** Public from the first push, or private until a tag? _(expected: public / private-until-tag)_
3. **Token scope.** The live credential is a **human account** (`AceHack`) with `write:packages`.
   Should publishing use a dedicated agent credential instead? _(expected: yes-dedicated / no-reuse)_
4. **Which artifact is published?** Given §5, the only shippable artifact today is the 61 MiB
   `bun build --compile` binary. Publish that, or hold until the node rung lands and ship source?
   _(expected: binary-now / source-when-node-lands)_

## 8. `clone-at-tag-stays-sufficient` is NOT weakened

The rule says the repo must stay buildable from `git clone` at a tag **with no ace present**. This
change adds no bootstrap dependency on ace: nothing under `tools/setup/`, `.github/workflows/`,
the build props, `flake.nix` or `.cursor/` was touched, and no installer one-liner has been landed
yet. Installing ace **as a tool** is fine; making the repo's bootstrap **route through** ace is not,
and that boundary is intact.

Verified, with a control proving the check can fail:

- `lint-clone-at-tag-is-sufficient.ts` → **rc=0** (7 surfaces scanned)
- same lint with a sabotage line injected under `tools/setup/` → **rc=1**, violation named
- sabotage removed → **rc=0**

## 9. Register

- **`metered`** — every byte figure in `runtime-candidates.ts` (method, host and date recorded beside it).
- **`unmetered`** — the node and wasm rung costs; each states _why_ there is no number.
- **`unmetered-by-nature`** — every enablement score, permanently.
- **The chooser itself is `unmetered` as an installer.** It has never run on a clean host. A real
  clean-host test needs a container or VM with no bun, no node and no .NET, booted from a pinned
  image, running the one-liner and asserting the three outcomes. That does not exist and the design
  should not be called validated until it does.

## 10. ADDENDUM 2026-08-24 — the node rung landed, and two of §5's numbers did not survive re-measurement

Appended rather than edited in place: the §5 table is a dated record of what was measured then,
and overwriting it would delete the path. Work-item **081M0TKBDXN087G0R003HTKSAZ**.

### 10.1 `source-on-node` is now `buildable: yes`

The 16 extensionless specifiers now carry explicit `.ts` extensions. `node
src/Core.TypeScript/ace/ace.ts list` → **rc=0**, and output identity is **proven rather than
asserted**: `ace-node-runtime-parity.test.ts` runs the same commands under bun and node in an
identical sandbox and compares stdout **byte-for-byte** — help, empty store, error paths, and an
install/list/verify/registry transcript carrying BLAKE3 digests and an Ed25519 signature. So the
installer's source rung is real on any host with node, not only on one with bun.

### 10.2 Only ELEVEN of the 16 were load-bearing

Measured by ablation — revert one specifier at a time, run node, record `rc` directly:

|                   | count  | why                                                                     |
| ----------------- | ------ | ----------------------------------------------------------------------- |
| load-bearing      | **11** | node's ESM resolver fails: `ERR_MODULE_NOT_FOUND`, rc=1                 |
| erased at runtime | **5**  | reached only through `import type`, which node's type-stripping deletes |

All 16 are fixed regardless. Leaving five that happen to be invisible today is a trap for whoever
next converts one of those type imports to a value import. (The closure is **25** files, not 24.)

### 10.3 §5's `source-on-bun` row was a check that did not run

§5 records `source-on-bun` as **works** with `addedBytes: 0` and "no install step", and files
`@noble/hashes` as a cost of the _node_ rung. Re-measured with `node_modules` moved aside:

- `bun src/Core.TypeScript/ace/ace.ts list` → **rc=1**, `Cannot find module '@noble/hashes/blake3.js'`
- `node …` → **rc=1**, `Cannot find package '@noble/hashes'`

**Both runtimes fail identically.** The dependency belongs to the **source rung**, not to node.
The original 0 was measured on a tree that already had `node_modules` — the same trap this doc
warns about elsewhere, hit by this doc's own headline row.

The corrected figure is small and worth stating exactly, because it is the whole gap between
"clone and run" and "clone, fetch one package, run": ace's runtime closure needs **exactly one**
npm package, `@noble/hashes` 2.2.0 (MIT, **zero transitive dependencies**) — 98 files, **889,457
apparent bytes**, 1,072 KiB on disk. With a `node_modules` containing that and nothing else, both
runtimes reach rc=0. Not the 773-package dev install.

`runtime-candidates.ts` now carries both corrections with their methods.

### 10.4 One measured limit: `ace deps` + out-of-subset YAML is bun-only

Found by measurement, not predicted, and recorded because a rung's limits must be as legible as
its capabilities. `ace deps validate` on a graph that uses flow sequences (`needs: [cilium]`) or
folded block scalars (`>-`) falls out of the hand-rolled subset reader and into `yaml/vendor.ts`,
whose adapter is **`Bun.YAML`** — a Bun built-in with no node equivalent.

| input                                  | bun                   | node                                                               |
| -------------------------------------- | --------------------- | ------------------------------------------------------------------ |
| graph inside the YAML subset           | rc=0                  | rc=0, **stdout byte-identical**                                    |
| graph using flow style / block scalars | rc=0 (vendor adapter) | **rc=1, named refusal**: `Bun.YAML is unavailable on this runtime` |

This is the adapter behaving as designed — it _probes_ for the built-in and returns a named
refusal rather than a `TypeError` — and it is pinned by a test that asserts the refusal is named
and that stdout stays empty. It is not closed here: widening the TS subset unilaterally is
explicitly forbidden (081KT7YW00008QG0R002T1XNWT — the six-oracle byte-lock rests on every oracle
declining the _same_ inputs), so closing it properly means a node-side vendor adapter, which is
its own decision. Every other ace surface is at full parity.

### 10.5 What this does NOT resolve

- **`clone-at-tag` is not violated** — that rule is about `ace`-as-resolver, and the repo's own
  bootstrap already runs `bun install --frozen-lockfile`. But §5's implied story ("run the source
  you already have") is one npm fetch weaker than it reads. Vendoring a pure-TS BLAKE3 would close
  the gap; not attempted here, because it is crypto in the proof tier and deserves its own decision.
- **node prints a 4-line `MODULE_TYPELESS_PACKAGE_JSON` advisory on stderr** each run (the root
  `package.json` has no `"type"`). stdout is unaffected and parity holds. Setting `"type": "module"`
  repo-wide would silence it and was deliberately not attempted — it changes resolution for every
  `.js` in the tree.
- **§7's four publish questions are untouched**, and §7.4 now has a second option worth naming:
  with node working, "ship source" no longer means "ship source and hope bun is present".

## Pointers

- `src/Core.TypeScript/ace/runtime-cost.ts` · `runtime-candidates.ts` · `runtime-probe.ts` · `runtime-plan.ts`
- [`toy-is-free-metered-must-be-earned.md`](../../.claude/rules/toy-is-free-metered-must-be-earned.md) — the register discipline
- [`clone-at-tag-stays-sufficient.md`](../../.claude/rules/clone-at-tag-stays-sufficient.md) — the boundary §8 keeps
- [`numerology-vs-number-theory.md`](../../.claude/rules/numerology-vs-number-theory.md) — why §5 reports the disagreement instead of tuning
- `src/Core.TypeScript/ace/pinned-artifact.ts` — the existing fetch→verify→prove path any published artifact must reuse
