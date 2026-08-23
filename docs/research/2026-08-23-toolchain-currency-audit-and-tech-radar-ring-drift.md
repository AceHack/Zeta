# Toolchain currency audit + tech-radar ring drift (2026-08-23)

> Aaron 2026-08-22: _"lets update the radar, make sure we are using the latest versions not
> old ones"_.

Two halves. **§1** fixes the radar rows whose claims the repo can no longer support. **§2** is
the currency table with deltas. Nothing here bumps a toolchain — where a bump is warranted a
workitem carries the evidence, because a pin moved without a build beside it is the same
unwitnessed claim the radar drift is made of.

Everything below is **measured on 2026-08-23** against `Lucent-Financial-Group/Zeta@main`
(branch cut from `3d40e45891d71d9314240265fe2608d7b944b57c`), upstream release APIs, and the
GitHub Actions run history. Register: **Mirror is not enough here** — a currency claim is
outward-facing by construction, so every number below is a Beacon claim with its source named.

---

## §1 — Radar: claims the repo can no longer support

Soraya found two on 2026-08-22. Auditing the rest of `docs/TECH-RADAR.md` found five more.
The common shape: **a row asserted something about the repo, the repo moved, and nothing could
notice.** That is the vacuity class — a green square for a check that never ran.

### 1.1 `fast-check` was in use with no ring at all

Pinned `4.8.0` in `package.json` (devDependencies), imported by five tracked test files, and
**absent from the radar**. The only property-testing row was _"FsCheck 3 property tests |
Adopt"_ — which is **.NET**, while the code using fast-check is TypeScript.

An in-use tool with no ring is the radar failing at its one job. But the sharper half is what
the missing row was **hiding**, and it changes the ring we would otherwise have written:

|                | FsCheck 3 (.NET)                                                                      | fast-check (TypeScript)                   |
| -------------- | ------------------------------------------------------------------------------------- | ----------------------------------------- |
| files using it | 156 under `tests/`                                                                    | 5 under `src/Core.TypeScript/`            |
| runs in CI     | **yes** — `dotnet test Zeta.sln -c Release` in `gate.yml`'s blocking `build-and-test` | **no** — no workflow runs any of the five |
| honest ring    | **Adopt**                                                                             | **Trial**                                 |

Every `bun test` invocation across `.github/workflows/*.yml` is path-targeted
(`hygiene/`, `ace/`, `inventory/`, `cluster/`, named files); there is no bare `bun test`; and
none of `cover-acyclicity/`, `peer-call/`, `discovery/`, `ferry-throttler/`, `observe/`
appears in any workflow. Checked by grepping every invocation.

So fast-check landed at **Trial**, not Adopt — the same "live code path, no CI wiring"
condition that already holds Alloy at Trial. The one row standing in for two languages had let
one tool's Adopt ring launder another tool's ungated status. Tracked:
`081M0Q9Y69F087G0R000FBK4JA`.

### 1.2 TLA+/TLC: `Adopt` ring, dark lane — both recorded, ring NOT downgraded

`gh run list --workflow tlaps-proof.yml`:

- last **success 2026-07-01T21:52Z**; seven weeks dark
- last 100 runs: **16 success · 22 failure · 62 cancelled**; last 12: **0 success**

The two failure modes are different, and separating them required reading **step** conclusions
rather than run conclusions:

**(a) `cancelled` is the 60-minute job timeout, and it fires in the wrong step.**
`timeout-minutes: 60` in `tlaps-proof.yml`. Runs 32605525115 / 32603717600 / 32546617239 /
32430624660 / 32387521966 each ran 60m14s±20s and every one was cut inside
**`Install toolchain via three-way-parity script`** — the opam source-build of `tlapm`.
`Verify TLAPS toolchain` and `Prove all TLAPS obligations` are both `skipped`.

> This answers half of Soraya's first prerequisite with evidence rather than inference: it is
> **not** "a model that grew" — the prover never runs. It is the build. Whether the build got
> slower or the `~/.opam` cache stopped hitting is still open, and there is a suspicious
> coupling to look at first: the cache key hashes `tools/setup/manifests/**`, which is _also_ a
> trigger path for the workflow, so a manifest edit both fires the lane and busts its cache in
> the same commit.

**(b) `failure` is `exit 127`, i.e. `command not found` — not an unproved obligation.**

```text
proving NciSafetyProofs with tlapm...
  FAIL: NciSafetyProofs (exit 127)
  FAIL: NciNonUrgencyProofs (exit 127)
summary: 0 proved, 2 failed, 0 missing-from-catalogue (out of 2 catalogued)
```

**And the preceding `Verify TLAPS toolchain` step concluded `success` in both runs.** That is a
gate passing for a toolchain that is not invocable. `checkToolchain()` in
`src/Core.TypeScript/formal-verification/run-tlaps.ts` has a third branch that returns non-null
on the mere presence of `opam`:

```ts
const opam = which("opam");
if (opam !== null) {
  return { cmd: opam, preArgs: ["exec", `--switch=${TLAPS_SWITCH}`, "--", "tlapm"], specsPath };
}
```

`opam` existing does not imply the `tlaps-build` switch holds a built `tlapm`. The check proves
the wrapper exists; the prove step discovers the payload does not.

**The ring stays Adopt on purpose.** A ring is a claim about what we would start new work with,
and TLA+/TLC still is. Silently writing `Hold` would replace a visible discrepancy with an
invisible one — the honest move is to carry the measured lane state _beside_ the ring so the
gap is legible and priced. Soraya's read, _"Hold in practice despite an Adopt ring"_, is now
written on the row in those words, with her three restoration prerequisites. Tracked:
`081M0Q9Y62A087G0R003FZ6TM7`.

The row's old note — _"6 specs validated; 7 more with `.cfg` pending"_ — is **retired as
unsupportable**: `src/Core.TLA/specs/` now holds **36** `.tla` files and **53** `.cfg` files,
and no artifact in the repo records which 6 the number meant.

### 1.3 Five more, found by auditing the rest

| row                  | claim                                                              | measured 2026-08-23                                                                                                                                                                                                                                                                                                                                              |
| -------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Alloy**            | jar at `tools/alloy/alloy.jar`; _"no CI wiring yet — hence Trial"_ | jar is at `src/Core.Alloy/alloy.jar`. And there **is** wiring: `Alloy.Runner.Tests.fs` is xUnit inside `Zeta.sln`, so `dotnet test` runs it. What it does **not** do is fail when Alloy is absent — the runner returns early on `not (File.Exists alloyJarPath)`. Trial stays, for the _conditional-skip_ reason, not the _no-wiring_ one.                       |
| **Semgrep**          | _"12 rules; runs externally"_                                      | **15** rules in `.semgrep.yml` + **2** in `.semgrep-floor.yml` (+ per-scaffold rulesets), and it runs **inside `gate.yml`** — a blocking floor job plus a `lint (semgrep drift)` job. Understated in both halves.                                                                                                                                                |
| **Stryker.NET**      | _"Mutation testing config shipped"_                                | Also a dedicated `.github/workflows/stryker-mutation.yml` lane. Ring stays Trial on its own real limit: Stryker.NET throws `NotSupportedException: Language not supported: Fsharp`, so the **F# core is not mutation-tested**.                                                                                                                                   |
| **Lean 4 + Mathlib** | _"26 `.lean` files under `src/Core.Lean4/Lean4/`"_                 | **32** under `Lean4/`, **57** under `src/Core.Lean4/` overall. See §2.1 for the pin.                                                                                                                                                                                                                                                                             |
| **bun + TypeScript** | `Trial`, with graduation conditions                                | Conditions long past — **1,187** tracked `*.test.ts`; 266 files in `hygiene/` alone. And this same document's **center** names **TypeScript** an essential primitive. A Trial ring on a center primitive is a contradiction inside one file. Ring left unchanged (promoting the center is a bigger call than a drift-fix); tracked `081M0Q9Y6AP087G0R002BV88T7`. |

Two rows also cited paths that do not exist — `tools/alloy/alloy.jar` and
`tools/invariant-substrates/tally.ts` (now `src/Core.TypeScript/invariant-substrates/tally.ts`).
That is the class §3 closes mechanically.

**Adjacent, not fixed here:** `docs/CURRENT-ROUND.md` reads _"Current Round — 36 (open)"_ while
`docs/BACKLOG.md` carries round-43 and round-45 hand-offs and the radar has round-42/43 rows.
The round counter is itself drifted. Named because the radar's `Round` column depends on it —
which is why the rows added here carry a **date** and `—` for round.

---

## §2 — Toolchain currency

### 2.1 Lean — the one to look at first, and it is not urgent

|                     | value                                      | source                                     |
| ------------------- | ------------------------------------------ | ------------------------------------------ |
| our toolchain pin   | **`leanprover/lean4:v4.30.0-rc1`**         | `src/Core.Lean4/lean-toolchain`            |
| our Mathlib rev     | `0c154d67103f74be3a0f2c509f72ccbf5be9f2a7` | `lake-manifest.json`                       |
| that rev's identity | **exactly** the Mathlib tag `v4.30.0-rc1`  | checked against upstream tags, not assumed |
| **v4.30.0 final**   | **2026-05-26**                             | `leanprover/lean4` releases                |
| **current stable**  | **v4.33.1** (2026-08-21)                   | `gh api …/releases/latest`                 |

We ship a **release candidate** as a durable pin, of a line whose final landed ~3 months ago,
three minors behind current stable.

**Cost estimate, with its one datapoint named as one datapoint:** the `Zeta23/LinAlg` port
landed 2026-08-22 from upstream `v4.33.0-rc2` / Mathlib `51e6992efd06` — verified: that hash
_is_ the mathlib `v4.33.0-rc2` tag — and **built at our pin with zero proof edits**. Three
minors of Mathlib churn did not touch what we use. That is evidence the move is cheap; it is
not a proof, which is why the workitem is P2 and not P0.

Two candidate moves, deliberately different sizes:

1. **`v4.30.0-rc1` → `v4.30.0`** — RC to final, same minor. Removes "we ship on an RC" without
   importing three minors. The fallback if the full move stalls.
2. **`v4.30.0-rc1` → `v4.33.1`** — current stable. The real fix.

**Not bumped here.** A toolchain move needs its own change carrying a full `lake build` +
`AxiomAudit.lean` before/after + `lean-proof.yml` green. Tracked `081M0Q9Y63V087G0R0007RX4E8`.

### 2.2 .NET — this one outranks Lean on urgency

|                        | value                                             |
| ---------------------- | ------------------------------------------------- |
| `global.json`          | SDK `10.0.302`, `rollForward: latestPatch`        |
| `.mise.toml`           | `dotnet = "10.0.302"` — an **exact** pin          |
| 10.0.302 ships         | runtime **10.0.10**, 2026-07-14                   |
| latest in the 3xx band | **10.0.303**, runtime **10.0.11**, **2026-08-11** |

**The 2026-08-11 release is `"security": true` and carries 10 CVEs** (CVE-2026-62898, -62899,
-62900, -62901, -62886, -62871, -70354, -62902, -62897, -62909). Aaron asked whether we are on
the latest; on the SDK the concrete answer is _one security servicing roll behind_.

**And `rollForward: latestPatch` does not save us.** mise pins `10.0.302` **exactly** and mise
is what installs the SDK, so only one SDK exists on the box and `rollForward` has nothing to
roll to. **The effective pin is the `.mise.toml` line, not `global.json`** — bumping only
`global.json` would change nothing. Corroborating: `Directory.Packages.props` already carries
`Microsoft.Extensions.DependencyInjection` / `System.IO.Hashing` / `System.Numerics.Tensors` at
**10.0.11**; the libraries moved and the SDK did not. Tracked `081M0Q9Y658087G0R002ZWZNSF`.

### 2.3 mise-managed runtimes

| tool                                      | pin                           | latest                  | delta                             |
| ----------------------------------------- | ----------------------------- | ----------------------- | --------------------------------- |
| **rust**                                  | `1.87.0`                      | **1.98.0** (2026-08-20) | **11 releases, ~15 months**       |
| **zig**                                   | `0.13.0`                      | 0.15.2                  | 2 minors (0.13.0 is ~2 years old) |
| **uv**                                    | `0.11.21`                     | 0.12.5                  | 1 minor                           |
| **go**                                    | `1.26.4`                      | 1.27.0                  | 1 minor + 3 patches               |
| **golangci-lint**                         | `2.12.2`                      | 2.13.1                  | 1 minor                           |
| **semgrep**                               | `1.161.0`                     | 1.174.0                 | 13 patches                        |
| **ruff**                                  | `0.15.17`                     | 0.16.4                  | 1 minor                           |
| **mypy**                                  | `2.1.0`                       | 2.3.1                   | 2 minors                          |
| **bun**                                   | `1.3` (range)                 | 1.4.0                   | range excludes 1.4                |
| node                                      | `24`                          | 26.7.0                  | **correct** — 24 is Active LTS    |
| java · yamllint · actionlint · shellcheck | 26 · 1.38.0 · 1.7.12 · 0.11.0 | same                    | **current**                       |

**Rust is the outlier.** `src/Core.Rust.*` is one of the byte-lock oracles; an oracle fifteen
months behind is decorrelated for the wrong reason.

Two **semver-invisible couplings** that make these non-trivial, both already written down in
the tree — this is the class where the fix is a documented constraint, not a bump:

- `.mise.toml` states that a rust bump must also move the `1.87.0-*` rustup cache globs in
  `gate.yml` + `installer-unit-tests.yml`; _"a stale glob silently degrades the offline path to
  a CDN fetch."_
- `src/wasm-dla/bytelock/dla-canonical-zig.wasm` is byte-locked at 1,314 bytes under **zig
  0.13.0** (sha256 `c28210dc…`, verified byte-identical on rebuild 2026-08-17). A zig bump moves
  those bytes and must move the golden vectors deliberately, in the same change.

Tracked `081M0Q9Y66W087G0R003115PN3`.

### 2.4 npm / bun packages

| package                                                                                                    | pin       | latest    | delta                                                          |
| ---------------------------------------------------------------------------------------------------------- | --------- | --------- | -------------------------------------------------------------- |
| **typescript**                                                                                             | `6.0.3`   | **7.0.2** | **a major**                                                    |
| **z3-solver**                                                                                              | `4.16.0`  | **5.2.0** | a major                                                        |
| **@noble/post-quantum**                                                                                    | `0.6.1`   | 0.7.0     | minor (crypto)                                                 |
| **micro-key-producer**                                                                                     | `0.8.6`   | 0.10.0    | 2 minors (crypto)                                              |
| **cborg**                                                                                                  | `5.1.1`   | 6.1.1     | a major                                                        |
| eslint                                                                                                     | `10.2.1`  | 10.9.0    | 7 minors                                                       |
| typescript-eslint                                                                                          | `8.59.0`  | 8.67.0    | 8 minors                                                       |
| eslint-plugin-sonarjs                                                                                      | `4.0.3`   | 4.2.0     | 2 minors                                                       |
| stylelint                                                                                                  | `17.12.0` | 17.14.1   | 2 minors                                                       |
| markdownlint-cli2                                                                                          | `0.22.1`  | 0.23.2    | 1 minor (**also pinned in `.mise.toml`** — must move together) |
| @noble/{curves,hashes,ciphers}                                                                             | `2.2.0`   | 2.3.0     | 1 minor                                                        |
| @scure/{base,bip32,bip39}                                                                                  | `2.2.0`   | 2.3.0     | 1 minor                                                        |
| pg                                                                                                         | `8.21.0`  | 8.23.0    | 2 minors                                                       |
| prettier                                                                                                   | `3.8.3`   | 3.9.6     | 1 minor                                                        |
| semver                                                                                                     | `7.8.1`   | 7.8.5     | 4 patches                                                      |
| @types/bun                                                                                                 | `1.3.12`  | 1.4.0     | the documented lag, now a minor                                |
| quantum-circuit                                                                                            | `0.9.247` | 0.9.250   | 3 patches                                                      |
| jiti                                                                                                       | `2.6.1`   | 2.7.0     | 1 minor                                                        |
| yaml                                                                                                       | `^2.9.0`  | 2.9.0     | current                                                        |
| playwright · @eslint/js · prettier-plugin-toml · stylelint-config-standard · @nats-io/\* · epub-gen-memory | —         | same      | **current**                                                    |

`globals` is pinned `17.5.0` against a latest of `17.11.0` — worth a look, since a _higher_
pin than upstream's latest usually means a yanked release.

### 2.5 NuGet — the control that shows the mechanism works

Checked against `api.nuget.org`: `benchmarkdotnet` 0.15.8, `apache.arrow` 23.0.0,
`yamldotnet` 18.1.0, `system.reactive` 7.0.0, `libgit2sharp` 0.32.0, `messagepack` 3.1.8,
`google.protobuf` 3.36.0 are **all at latest**. `microsoft.z3` 4.12.2 **is** the newest on
NuGet — the Z3 team's NuGet publishing lags their GitHub releases, so the stale look is
upstream, not us. (Noted on the radar: the TS binding `z3-solver` is a _separate_ pin at a
_different_ version. Two Z3s across two oracles is a real skew and is now visible.)

Two pins are deliberately behind and **must stay that way**:

- `FsCheck` / `FsCheck.Xunit.v3` at `3.3.4` (latest 3.4.0) — 3.4.0 transitively demands
  xunit.v3 **4.x** while we pin 3.2.2.
- `Microsoft.CodeAnalysis.*` at `5.6.0` — coupled to the SDK's Roslyn; a newer generator
  cannot be **loaded** (CS9057).

`FSharp.Core 10.1.400` vs latest `11.0.100` is the same class: 11.0.100 rides the SDK's **4xx**
feature band, so it moves with a deliberate SDK band change, not on its own.

### 2.6 The finding that explains §2.4 — Dependabot points at two ecosystems

`.github/dependabot.yml` declares **`nuget`** and **`github-actions`**. That is all. §2.5 is the
control: where it is pointed, everything is at latest.

| ecosystem                                       | manifests in tree                                                 | coverage                     |
| ----------------------------------------------- | ----------------------------------------------------------------- | ---------------------------- |
| npm / bun                                       | root `package.json` + 8 nested                                    | **none**                     |
| cargo                                           | many `src/Core.Rust.*/Cargo.toml`                                 | **none**                     |
| gomod                                           | `src/Core.Go/`, `src/wasm-dla/bytelock/`, the hat-system operator | **none**                     |
| pip / uv                                        | `src/Core.Python/pyproject.toml`                                  | **none**                     |
| `.mise.toml` · `global.json` · `lean-toolchain` | the pins in §2.1–2.3                                              | **no such ecosystem exists** |

TypeScript being a whole major behind was never going to be noticed by anything. The last row
is the honest part: some pins are not coverable by any bot, and the answer there is a
**scheduled currency report** that prints the delta — not a bot that does not exist. Tracked
`081M0Q9Y686087G0R000QK0H1R`.

**The two existing `ignore:` entries are load-bearing and were not touched.** Each was added
_after_ the widened version broke the build (PR #13590 for CodeAnalysis; #13653/#13696 for the
FsCheck family — where the first attempt ignored only the follower and Dependabot re-opened the
PR 21 minutes later). Any new semver-invisible coupling gets the same treatment: a documented
`ignore` with a `LIFTS WHEN:` clause, never a bump that hopes.

---

## §3 — The mechanical check

A radar is prose and prose rots silently, which is the whole reason it drifted. So the class is
closed, not the two instances: `src/Core.TypeScript/hygiene/audit-tech-radar-claims.ts`, wired
into the `cross-verify` floor job in `gate.yml`, offline, ~1s.

**Check A — every path the radar cites resolves.** Any backticked token that looks like a repo
path must exist. Zero judgement, zero allowlist. A path a row _proposes_ rather than _reports_
is marked `(planned)` on the same line. This is what catches the `tools/alloy/alloy.jar` class.

**Check B — a devDependency used to verify must carry a ring.** Every root-`package.json`
`devDependencies` entry statically imported by a tracked `*.test.ts` must be named in
`docs/TECH-RADAR.md`. This is what catches the `fast-check` class. The scope is **derived, not
hand-listed**, and both halves matter: `devDependencies` is the manifest's own declaration of
"tooling, not shipped product", and "imported by a test file" is the mechanical proxy for "part
of how we verify" — which is exactly what the radar's Tools/infra section is about.

**What was deliberately NOT checked, and why.** Runtime `dependencies` are out of scope. A
radar is an evaluation register, not an SBOM; requiring a row for `pg` and `@scure/bip39` would
produce ~25 findings nobody intends to act on, and a check people route around is worse than no
check.

**Honest limits, stated in the file rather than hidden:**

1. Static imports only. `src/Core.TypeScript/ace/solver.z3.test.ts` loads Z3 via
   `require('z3-solver/build/node.js')` inside a spawned Node process, and the audit cannot see
   it. It **under-reports; it does not invent.**
2. Root `package.json` only — the nested manifests are not scanned.
3. A row that merely _mentions_ a tool satisfies check B. Deciding whether it is a _good_ row is
   a human call, and pretending otherwise would be a check that cannot fail honestly.
4. **Neither check can tell you a ring is wrong.** TLA+ sat at Adopt with a dark lane for seven
   weeks and this audit would have stayed green the whole time. Lane liveness is a different
   measurement and belongs in a different check. §1.2 was found by a human reading run history,
   and nothing here changes that.

**It went red on `main` when written — 7 findings, measured against `origin/main`'s radar:**
4 dead paths (`specs/Spine.als`, `tools/alloy/alloy.jar`, `docs/research/scratch-zeta-parity.md`,
`tools/invariant-substrates/tally.ts`) and 3 unringed devDependencies (`fast-check`,
`quantum-circuit`, `semver`). Every one is a real finding — including `scratch-zeta-parity.md`,
which is a _proposed_ deliverable and is now marked `(planned)` rather than silenced by an
allowlist. Green on this branch after the corrections, so **no baseline file exists**:
`AUDIT-LIFECYCLE.md`'s cleanup-to-zero path, since the surface is a mutable markdown doc.

---

## §4 — Two things found on the way that are not radar rows

### 4.1 `main` was red — and half of it fixed itself while this was being written

**Measured 2026-08-23T12:35Z.** `bun src/Core.TypeScript/lint/lint-typescript.ts` — the exact
command the `lint (TS)` gate job runs — exited 1 on `origin/main`:

```text
src/apps/twitch-ai/src/swarm.worker.ts(40,24): error TS2345:
  Argument of type '{ apiKey: any; baseUrl: any; model: string; }'
  is not assignable to parameter of type 'number'.
```

`gate.yml` run **32639819848** on `main` (`ba965f8636`) failed `test (TS hermetic)`,
`lint (TS)`, and therefore **`gate (required)`**. Introduced by `3d40e4589` (#14159).

**Corrected at 13:40Z — and the correction is the point of writing this section at all.**

- The `lint (TS)` half was fixed on `main` by **`7a2339db3`** (#14169) roughly thirty minutes
  later. The current source now reads `await swarm.init();` with the reason written beside it:
  _"SwarmController.init takes a UDP drop-rate number, not LLM settings."_ Verified: run
  **32641157957** at `7a2339db36` has `lint (TS)` **green**. That is also the answer to the
  intent question this audit declined to guess at, and the resolving commit answered it the
  other way from the call site.
- **`test (TS hermetic)` is still red on `main`** at that same commit, for an unrelated reason
  (the bootstrap/`db/mutation-findings/` measurement suite), so `gate (required)` remains red.

**And a methodological catch worth keeping.** This branch's CI passed `lint (TS)` while a local
run on the same branch failed, and the two are both correct: `actions/checkout` on a
`pull_request` event resolves `refs/pull/N/merge` — **head merged into base** — so CI was
testing a tree that already contained `main`'s fix, and the local checkout was not. A branch-only
local run and a PR CI run disagree by exactly the contents of the base. That is the
_verify-the-tree-not-just-the-command_ discipline in a new costume: same command, two trees, two
truthful answers.

The workitem `081M0QC66N5087G0R003R3ARYH` is retargeted accordingly — the twitch-ai half is
recorded as **resolved by `7a2339db3`**, the `test (TS hermetic)` half stays open.

### 4.2 `lint (TS)` announces three checks and runs one

Started as "prettier is a script nothing runs". It is worse than that, and the sharper form is
the best single instance of this whole document's theme.

`src/Core.TypeScript/lint/lint-typescript.ts` **is** the `lint (TS)` gate job, in full:

```ts
const STEPS: readonly Step[] = [{ label: "TypeScript type check: tsc", cmd: TYPESCRIPT_COMPILER_COMMAND }];

function main(): number {
  for (const step of STEPS) {
    if (!run(step)) return 1;
  }
  console.log("✓ TypeScript, Prettier, and style checks passed successfully!");
  return 0;
}
```

**One step; three checks claimed.** The file header says _"orchestration of TypeScript tools
(tsc, eslint, prettier, stylelint)"_ and only `tsc` is in the list. Nothing else runs them
either: `grep -rn "format:check\|prettier --check" .github/workflows/` returns nothing, no
workflow invokes `stylelint`, and `gate.yml:1665` installs _"the eslint stack"_ and then never
calls eslint.

Not a regression — `git log -S"STEPS: readonly Step[]"` returns exactly one commit, `4f3d20a25`
(2026-06-13, the file's first), and the message has claimed Prettier and style checks since then
with `STEPS` tsc-only from the start. **It was never true.**

Measured consequence, found the hard way: `docs/TECH-RADAR.md` on `main` is not prettier-clean,
and running `--write` over it turned a 12-line content diff into a 211-line one. That was
reverted and the radar edits re-applied to the pristine file — **a drift-fix PR whose point is
legibility must not bury its own changes in whitespace**, and formatting 100+ untouched rows
under a docs-correction commit is a change nobody reviewed.

This is the same shape as §1.2's `--check-toolchain` reporting success for a `tlapm` that then
exits 127, and the same shape as an Adopt ring over a dark lane: **an unenforced guarantee reads
exactly like a guarantee.** Not fixed here — turning three repo-wide linters on is its own
change with its own baseline. Tracked `081M0QDHQQQ087G0R002JE1JMA`, with the cheap half split
out: _make the message stop lying today_, enforce later.

## Ledger of what this change did and did not do

**Did:** corrected 7 radar rows; added 3 rows (`fast-check`, `quantum-circuit`, `semver`);
recorded the TLA+ lane state beside its ring; wrote the audit (2 checks) + 29 unit tests; minted
**9** workitems with the evidence attached.

**Did not:** bump any toolchain; change any ring except by _adding_ rows; remove either
Dependabot `ignore:`; change `docs/CURRENT-ROUND.md`; reformat the radar with prettier (§4.2);
fix the `main`-is-red TS error (§4.1);
turn on the three unenforced linters (§4.2).

**Anchors (Beacon).** Property testing: Claessen & Hughes, _QuickCheck_ (ICFP 2000) — fast-check
is the TypeScript descendant, FsCheck the .NET one. Ring/blip vocabulary: the ThoughtWorks
Technology Radar. Mutation testing as falsifier: DeMillo, Lipton & Sayward (1978).

## Composes with

- `docs/TECH-RADAR.md` — the corrected rows
- `src/Core.TypeScript/hygiene/audit-tech-radar-claims.ts` + `.test.ts` — §3
- `src/Core.TypeScript/hygiene/AUDIT-LIFECYCLE.md` — the pattern followed
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — unmetered is the honest default; a
  ring without a falsifier is a claim without one
- `.claude/rules/anchor-to-human-prior-art.md` — anchors are **checked**, not cited; every
  upstream version above was resolved against the registry, and the Mathlib revs were verified
  to _be_ the tags they are claimed to be
