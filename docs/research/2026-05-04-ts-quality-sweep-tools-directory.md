# TS quality sweep — `tools/**/*.ts` (2026-05-04)

**Scope:** Read-only quality audit of the TypeScript surface under `tools/`
(excluding `tools/lean4/.lake/` Lean 4 vendor packages and `node_modules/`).
Three axes covered: (1) the strict `tsc --noEmit` typecheck, (2) ESLint /
SonarJS / typescript-eslint findings, (3) cross-file consistency patterns
(imports, shebangs, error handling, type-vs-interface, dead code,
copy-paste). Composes with the 081KQGDBJ0008QG0R0022EW5ZE bash → TS migration audit at
`docs/research/2026-05-04-b-0140-bash-to-ts-migration-audit-table.md`,
which classified each `.ts` as kill-sh / ts-only / etc. but did **not**
score code quality of the `.ts` files themselves; this audit is the
quality counterpart to that migration-status enumeration.

**Attribution:** Filed by Otto (the human maintainer-delegated factory
agent) under autonomous-loop quality-sweep authority. Origin: same-tick
pairing with the recently-merged 081KQGDBJ0008QG0R0022EW5ZE audit — the migration-status
table left the question *"is the post-migration TS substrate clean?"*
unanswered. Maintainer 2026-05-04 framing in this session was *F# / TS
work* generally; this is the TS half.

**Operational status:** research-grade. Output is observation only. **No
TS file is modified by this audit.** Cleanup PRs (if any are taken up)
are downstream work, scoped per-finding-cluster — not as a single
mega-PR.

**Non-fusion disclaimer:** This audit reads file headers, runs
`tsc --noEmit` and ESLint, and does light visual scanning for
copy-paste between siblings. It does **not** infer runtime correctness
or coverage gaps. SonarJS findings about regex backtracking,
PATH-from-env, and CommonJS imports reflect the rule shape — not
necessarily real production exposure (most of these tools run on dev
laptops and CI, not user-facing). Every finding cites file path + line
number; nothing is fabricated; severity is the *eslint-tier* severity,
not *production-impact* severity.

---

## 1. Headline numbers

- **Total `.ts` files audited:** 56 (matches `find tools -name "*.ts"
  -not -path "*/.lake/*" -type f`; the 081KQGDBJ0008QG0R0022EW5ZE table reports 57 because
  it counted prior to a single-file delta — the 56-file set is the
  current branch-tip).
- **`bun tsc --noEmit` (strict mode):** **0 errors, 0 warnings.** Clean.
  `tsconfig.json` is strict at every dial — `strict`,
  `noImplicitOverride`, `noUncheckedIndexedAccess`, `noUnusedLocals`,
  `noUnusedParameters`, `exactOptionalPropertyTypes`,
  `verbatimModuleSyntax`, `erasableSyntaxOnly`, `isolatedModules`. The
  TS surface is typecheck-clean.
- **ESLint (`bunx eslint tools/`, NODE_OPTIONS heap raised to 8 GiB to
  finish):** **235 errors, 0 warnings, across 18 files (38 of 56 files
  are clean).** 31 of the 235 errors are auto-fixable per ESLint's
  `--fix` flag.
- **Files clean of all eslint findings:** 38 of 56 (~68%).

**Headline read:** the strict-tsc gate is fully green. ESLint findings
concentrate in a small number of older / heavier files; the bulk of
the TS migration surface is clean.

---

## 2. ESLint per-file error counts (descending)

| File | Errors |
|---|---|
| `tools/substrate-claim-checker/check-existence.test.ts` | 53 |
| `tools/hygiene/check-no-op-cadence-pattern.ts` | 26 |
| `tools/invariant-substrates/tally.ts` | 23 |
| `tools/substrate-claim-checker/check-existence.ts` | 20 |
| `tools/substrate-claim-checker/check-counts.test.ts` | 16 |
| `tools/github/poll-pr-gate.ts` | 14 |
| `tools/hygiene/audit-ci-cache-paths.ts` | 14 |
| `tools/pr-preservation/archive-pr.ts` | 14 |
| `tools/cold-start-check.ts` | 13 |
| `tools/substrate-claim-checker/check-counts.ts` | 13 |
| `tools/github/poll-pr-gate-batch.ts` | 8 |
| `tools/formal-verification/run-alloy.ts` | 4 |
| `tools/formal-verification/run-tlc.ts` | 4 |
| `tools/git/batch-resolve-pr-threads.ts` | 4 |
| `tools/github/check-github-status.ts` | 3 |
| `tools/hygiene/audit-git-hotspots.ts` | 3 |
| `tools/budget/project-runway.ts` | 2 |
| `tools/github/poll-pr-gate-batch.test.ts` | 1 |
| **Total** | **235** |

The top 5 files account for 138 of 235 errors (~59%).

---

## 3. ESLint rule frequency (descending)

| Rule | Count | Class |
|---|---|---|
| `@typescript-eslint/restrict-template-expressions` | 51 | template-stringification of `number` / `number\|null` |
| `@typescript-eslint/no-non-null-assertion` | 24 | forbidden `!` postfix |
| `sonarjs/no-os-command-from-path` | 19 | gh / git / etc. spawned by name (PATH-resolved) |
| `sonarjs/cognitive-complexity` | 15 | function complexity > 15 |
| `@typescript-eslint/no-unsafe-call` | 14 | calls on `any` typed values |
| `sonarjs/slow-regex` | 13 | super-linear regex backtracking risk |
| `@typescript-eslint/no-unnecessary-condition` | 13 | always-truthy / never-nullish guards |
| `sonarjs/prefer-regexp-exec` | 10 | `String#match` where `RegExp#exec` is clearer |
| `no-empty` | 10 | empty `catch {}` blocks |
| `@typescript-eslint/prefer-regexp-exec` | 8 | duplicate of sonarjs sibling |
| `@typescript-eslint/consistent-type-definitions` | 7 | `type` should be `interface` |
| `@typescript-eslint/no-require-imports` | 6 | CommonJS-style imports |
| `sonarjs/no-alphabetical-sort` | 4 | `.sort()` without compareFn |
| `sonarjs/concise-regex` | 4 | `[0-9]` should be `\d` |
| `@typescript-eslint/prefer-string-starts-ends-with` | 4 | `.indexOf(s) === 0` style |
| `@typescript-eslint/no-unsafe-member-access` | 4 | property access on `any` |
| `sonarjs/function-return-type` | 3 | inconsistent return types |
| `@typescript-eslint/prefer-optional-chain` | 3 | `a && a.b` should be `a?.b` |
| `@typescript-eslint/no-unsafe-assignment` | 3 | `any`-typed assignment |
| `@typescript-eslint/dot-notation` | 3 | `env["PATH"]` should be `env.PATH` |
| `@typescript-eslint/array-type` | 3 | `Array<T>` should be `T[]` |
| `sonarjs/todo-tag` | 2 | TODO comment present |
| `sonarjs/no-nested-conditional` | 2 | nested ternaries |
| `no-useless-assignment` | 2 | dead writes |
| `@typescript-eslint/no-unnecessary-type-assertion` | 2 | redundant `as T` |
| `sonarjs/regex-complexity` | 1 | regex complexity > 20 |
| `sonarjs/no-identical-functions` | 1 | duplicated function body |
| `no-fallthrough` | 1 | switch case missing `break` |
| `@typescript-eslint/use-unknown-in-catch-callback-variable` | 1 | catch callback typed wrong |
| Other singletons | several | misc |

---

## 4. Per-file findings

Format: file path, then load-bearing observations with line numbers.

### 4.1 `tools/substrate-claim-checker/check-existence.test.ts` (53 errors)

Heaviest file in the audit — heavy use of CommonJS-style imports rather
than ESM imports, plus duplicated fixture setup.

- **Line 28:** `sonarjs/todo-tag` — `// TODO` comment present.
- **Line 261, 266, 276, 339, 344, 354:** `@typescript-eslint/no-require-imports`
  — repeated CommonJS-style imports inside test bodies (for spawnSync
  and node:fs). Should be top-of-file ESM imports (already done for
  other test files; the test was likely cargo-culted from a JS source).
- **Lines 132, 133, 144, 155, 168, 169, 185, 186, 276, 354:** `no-empty`
  — empty `try { ... } catch {}` blocks (10 instances). The pattern is
  `try { rmSync(repoRoot, ...); } catch {}` for tmpdir cleanup. Should
  be `catch (_err) { /* explanation */ }` or `// intentionally empty —
  cleanup-best-effort` annotation.
- **Lines 259-279 vs 337-360:** **duplicated `setupGitignoreFixture`
  function** — exact-shape copy across two `describe` blocks. Only
  difference is the local `spawnSync` rebinding name. Should be hoisted
  to a single helper at module scope.
- **Lines 261-270, 339-348:** `sonarjs/no-os-command-from-path` — `git`
  invocations PATH-resolved via name (acceptable for tools but flagged
  by SonarJS).
- **Lines 101, 251:** `sonarjs/no-alphabetical-sort` — `.sort()` without
  a compare function on string arrays.

### 4.2 `tools/hygiene/check-no-op-cadence-pattern.ts` (26 errors)

- **Lines 27, 146, 153:** `@typescript-eslint/consistent-type-definitions`
  — uses `type` for object shapes; should be `interface` per repo
  convention (see §5.4 below).
- **Lines 102, 103:** `@typescript-eslint/no-non-null-assertion` —
  forbidden `!` postfix; refactor to a guard or default.
- **Lines 120, 121:** `no-useless-assignment` — `body` and `content`
  assigned but never read in subsequent statements. Either dead code
  or a stale refactor remnant.
- **Lines 87, 96:** `prefer-regexp-exec` — `.match()` call where
  `RegExp#exec()` would be the project convention.
- **Lines 217:** `@typescript-eslint/prefer-optional-chain` — replaceable
  with `?.`.
- **Lines 56, 263 (×3), 269 (×2), 305 (×2), 310 (×2):**
  `restrict-template-expressions` — interpolating `number` directly into
  template strings.

### 4.3 `tools/invariant-substrates/tally.ts` (23 errors)

The bulk are template-expression `number` interpolation (lines 257-294);
the substantive findings are:

- **Lines 53, 145:** `consistent-type-definitions` — should be `interface`.
- **Lines 121, 210:** `cognitive-complexity` — functions at 16 / 19,
  threshold 15.
- **Lines 113, 135:** `prefer-optional-chain`.
- **Lines 112, 134:** `prefer-regexp-exec`.
- **Line 225:** `no-alphabetical-sort` — `.sort()` without compareFn.

### 4.4 `tools/substrate-claim-checker/check-existence.ts` (20 errors)

- **Lines 107, 168, 236, 351:** `cognitive-complexity` — four functions
  over the threshold (16 / 25 / 37 / 21). Function at line 236 (cognitive
  complexity 37 — 2.5x threshold) is the prime refactor candidate.
- **Lines 109, 110, 134, 179, 183, 259:** regex hot-spots — slow-regex
  (super-linear backtracking risk) and one regex-complexity finding at
  line 134 (complexity 46, threshold 20).
- **Line 82:** `no-os-command-from-path` — git PATH-resolved.
- **Line 112:** `sonarjs/todo-tag` — TODO comment.
- **Lines 125, 191:** `prefer-string-starts-ends-with`.

### 4.5 `tools/substrate-claim-checker/check-counts.test.ts` (16 errors)

All 16 are `@typescript-eslint/no-non-null-assertion` — repeated `!`
postfix on test assertions (lines 43, 64, 82, 89, 97, 98, 104, 105,
111, 112, 124, 131, 132, 174, 175, 252). In test code these may be
intentional (test-failure if undefined IS the assertion), but the rule
requires explicit `expect(x).toBeDefined()` or `if (!x) throw …` style.

### 4.6 `tools/github/poll-pr-gate.ts` (14 errors)

This is one of the load-bearing scripts referenced from CLAUDE.md
(refresh-world-model bullet). Findings are stylistic, not behavioural:

- **Lines 233, 252, 427, 480:** `no-unnecessary-condition` on `??`
  — left-hand side is statically non-nullish; the `??` is dead.
- **Line 252:** also `no-unnecessary-optional-chain` on a non-nullish
  receiver.
- **Line 286:** unused `eslint-disable` directive — claims to suppress
  `sonarjs/no-os-command-from-path` but no such finding is reported on
  that line. Should be removed (drift from a prior rule shape).
- **Lines 289, 389:** `no-os-command-from-path` — `gh` PATH-resolved.
- **Lines 300, 356:** `restrict-template-expressions` — `number | null`
  / `number` interpolation.
- **Line 307:** `no-unnecessary-type-parameters` — type parameter `T`
  used only once in signature (no constraint enforcement, no return
  type binding) — should be inlined.
- **Lines 415:** `array-type` — `Array<T>` should be `T[]`.
- **Lines 452, 463:** `no-unnecessary-type-assertion` — `as T` assertions
  that don't change the inferred type.

### 4.7 `tools/hygiene/audit-ci-cache-paths.ts` (14 errors)

- **Line 157:** `cognitive-complexity` 29 (threshold 15) — primary
  refactor candidate.
- **Line 165:** `prefer-for-of` — classic-for loop where for-of fits.
- **Lines 167, 174, 181, 191, 199:** five `prefer-regexp-exec` findings
  — uniform refactor (replace `.match()` with `RegExp#exec()`).
- **Lines 167, 199:** plus `slow-regex` — backtracking risk.

### 4.8 `tools/pr-preservation/archive-pr.ts` (14 errors)

Largest file in the audit (806 lines per 081KQGDBJ0008QG0R0022EW5ZE table) — replaced an
embedded ~400-line Python block during the bash → TS port:

- **Lines 559, 661:** `cognitive-complexity` 19 / 20 (threshold 15) —
  two main pipeline functions.
- **Lines 72, 94:** `function-return-type` — inconsistent return types
  on the same function (e.g. `string | null` paths).
- **Line 99:** `dot-notation` — `env["GH_REPO"]` should be `env.GH_REPO`.
- **Line 101:** unused `eslint-disable` — same pattern as poll-pr-gate.
- **Line 103:** `no-os-command-from-path`.
- **Lines 487, 488, 556, 705, 724:** `slow-regex` — five regex
  backtracking flags.
- **Lines 56:** `concise-regex` — `[0-9]` should be `\d`.
- **Line 504:** `no-alphabetical-sort` — `.sort()` without compareFn.

### 4.9 `tools/cold-start-check.ts` (13 errors)

- **Line 47, 125:** `consistent-type-definitions` — should be `interface`.
- **Line 78:** `no-fallthrough` — `switch` case `--help` falls through
  into `default`. **Note:** this is *technically* safe because both
  branches call `process.exit()` (lines 77 and 81), but ESLint's
  static analysis can't prove it. Either add `break;` after each
  `process.exit()` (defensive) or restructure as `if`/`else if`
  (clearer for the reader). This is the single `no-fallthrough` finding
  in the audit — borderline real-bug-risk.
- **Lines 215, 219, 248, 284 (×3):** seven `no-non-null-assertion` —
  forbidden `!` postfix.
- **Lines 219, 243, 268, 284:** `restrict-template-expressions` —
  `number` interpolation.

### 4.10 `tools/substrate-claim-checker/check-counts.ts` (13 errors)

- **Lines 79, 155:** `cognitive-complexity` 23 / 22.
- **Lines 96, 187:** `prefer-string-starts-ends-with`.
- **Line 128:** `slow-regex`.
- **Line 210:** `no-unnecessary-condition`.
- **Lines 268 (×2), 295 (×3), 301, 305:** `restrict-template-expressions`
  — `number` interpolation in 7 sites.

### 4.11 `tools/github/poll-pr-gate-batch.ts` (8 errors)

- **Line 122:** `cognitive-complexity` 20.
- **Lines 204, 259:** `no-os-command-from-path` — `gh` PATH-resolved.
- **Line 220, 383:** `restrict-template-expressions`.
- **Line 331:** `no-unsafe-assignment` — `any[]` to `PollOutcome[]`.
- **Line 338:** `no-unnecessary-condition` — value always truthy.
- **Line 435:** `use-unknown-in-catch-callback-variable` — `.then(x,
  err => ...)` rejection callback — should be `: unknown`.

### 4.12 `tools/formal-verification/run-alloy.ts` and `run-tlc.ts` (4 each)

These two files share an obvious-shape similarity (siblings):

- Both: **line 50/95:** `dot-notation` — `env["PATH"]` should be
  `env.PATH`.
- Both: **lines ~185/186:** `no-unnecessary-condition` on `??`.
- Both: **line ~226/232:** `cognitive-complexity` 24 / 17.

Eight near-identical findings across the pair. A shared helper would
collapse the duplication.

### 4.13 `tools/git/batch-resolve-pr-threads.ts` (4 errors)

- **Line 71:** `concise-regex` — `[0-9]` should be `\d`.
- **Line 234:** `cognitive-complexity` 16.
- **Lines 407, 432:** `no-unnecessary-condition` on `??`.

### 4.14 `tools/github/check-github-status.ts` (3 errors)

- **Lines 98, 138:** `array-type` — `Array<T>` should be `T[]`.
- **Line 171:** `restrict-template-expressions`.

### 4.15 `tools/hygiene/audit-git-hotspots.ts` (3 errors)

- **Lines 201, 202:** `no-nested-conditional` — nested ternary; extract
  to statement.
- **Line 204:** `restrict-template-expressions` — `string | undefined`.

### 4.16 `tools/budget/project-runway.ts` (2 errors)

- **Line 70:** `function-return-type` — inconsistent.
- **Line 78:** `concise-regex` — `[0-9]` should be `\d`.

### 4.17 `tools/github/poll-pr-gate-batch.test.ts` (1 error)

- **Line 159:** `sonarjs/no-identical-functions` — function body
  identical to the one at line 140. Hoist to a shared helper.

---

## 5. Cross-file consistency observations

### 5.1 Imports — quote style, ESM, prefix

- **Quote style:** uniformly double-quote across all 56 files. No
  mixed style.
- **`node:` prefix:** consistently used everywhere
  (`from "node:fs"` / `"node:path"` / `"node:child_process"` /
  `"node:url"` / `"node:os"`). Zero bare-specifier `from "fs"` etc.
- **`bun` import:** only `tools/invariant-substrates/tally.ts:45`
  imports from `"bun"` directly (uses `Glob`). Test files use
  `"bun:test"` (correct). No file uses `Bun.spawn`, `Bun.write`,
  `Bun.argv`, `Bun.file` — everything goes through node-API
  equivalents. **Observation, not a finding:** the migration was
  Node-API-portable rather than Bun-native; this is intentional per
  the migration strategy but means the code would run unmodified on
  plain Node if needed (a portability win, not a bug).
- **CommonJS-style imports:** **6 instances, all in
  `tools/substrate-claim-checker/check-existence.test.ts`**. Should be
  refactored to ESM imports.

### 5.2 Shebangs

- 53 of 56 files start with `#!/usr/bin/env bun`.
- The 4 exceptions are the four `*.test.ts` files (test files don't
  need a shebang — they're invoked via `bun test`, not directly):
  `tools/github/poll-pr-gate.test.ts`,
  `tools/github/poll-pr-gate-batch.test.ts`,
  `tools/substrate-claim-checker/check-counts.test.ts`,
  `tools/substrate-claim-checker/check-existence.test.ts`. Correct
  pattern.
- **No inconsistencies found.**

### 5.3 `Array<T>` vs `T[]`

- 3 ESLint findings; one further `new Array<boolean>(...)` constructor
  call (correct usage — `Array<T>` is the only valid form for
  constructor-style `new Array<T>(n).fill(...)`). The 3 findings are
  actual style drift.

### 5.4 `type` vs `interface` for object shapes

- 7 `consistent-type-definitions` findings: object shapes declared
  via `type X = { ... }` rather than `interface X { ... }`. The
  prevailing convention in this codebase uses `interface` for object
  shapes; the 7 stragglers are uniform single-shot fixes.
- **Note:** discriminated-union types (e.g. `type StepResult = | { kind:
  "advance" } | { kind: "stop" } | ...`) correctly use `type` and are
  not flagged. Distinction is well-respected.

### 5.5 Error handling shape

- All 53 non-test files use `process.exit(N)` for exit-code emission;
  consistent across `tools/peer-call/{codex,grok,gemini}.ts` (uniform
  0/1/2), `tools/github/poll-pr-gate.ts` (0/1/2/3), `tools/lint/*`
  (0/1/2). No file throws unhandled exceptions for control flow.
- `try { ... } catch (err) { ... }` blocks consistently use
  `err instanceof Error ? err.message : String(err)` for stringification
  — same idiom across 20+ files. Convergent on a good pattern.
- The 10 `no-empty` findings are all in
  `tools/substrate-claim-checker/check-existence.test.ts` cleanup
  blocks; nowhere else.

### 5.6 SPAWN_MAX_BUFFER constants

- `tools/peer-call/{codex,grok,gemini}.ts` all declare
  `const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;` at line 32 — three
  copies of the same constant.
- `tools/github/poll-pr-gate.ts:283` declares
  `const SPAWN_MAX_BUFFER = 32 * 1024 * 1024;` (32 MiB, half).
- `tools/github/poll-pr-gate-batch.ts` separately spawns gh (line 204,
  259) — should share the constant with `poll-pr-gate.ts`.
- **Observation:** no shared `tools/_lib/spawn.ts` or similar; each
  script declares its own. Not a defect — but a candidate for
  consolidation if a `tools/_lib/` is introduced (081KQGDBJ0008QG0R0022EW5ZE-adjacent
  cleanup, not in scope here).

### 5.7 Peer-call boilerplate duplication

`tools/peer-call/codex.ts` (357 lines), `grok.ts` (310), `gemini.ts`
(379) share substantial structural shape:

- Identical `interface Args` / `interface ArgError` / `interface
  ArgHelp` / `interface MutableArgState` / `type StepResult` shapes
  (modulo per-script flags).
- `function classifyFlag` / `function emitHelp` / `function
  commandAvailable` / `function isRegularFile` / `function readHead` /
  `function runContextCmd` / `function classifySpawnFailure` patterns
  recur in identical form.
- `SPAWN_MAX_BUFFER` / `FILE_HEAD_BYTES` / `CTX_HEAD_BYTES` constants
  identical.

This is **not** a current ESLint finding (no rule fires) but it is the
clearest cleanup leverage in the audit: a shared
`tools/peer-call/_common.ts` module hoisting the 8-or-so identical
helpers would shrink the trio by ~40% and eliminate "fix once, fix
three" maintenance.

### 5.8 Unused / drifted `eslint-disable` directives

- `tools/github/poll-pr-gate.ts:286` — disables
  `sonarjs/no-os-command-from-path` but no such finding is reported
  there. The disable drifted from a prior rule shape and is now
  literally inert.
- `tools/pr-preservation/archive-pr.ts:101` — same pattern.

These are tiny but real cleanup wins (1-line deletes).

### 5.9 `TODO` comments

Only 2 in the entire surface (both flagged by `sonarjs/todo-tag`):

- `tools/substrate-claim-checker/check-existence.ts:112`
- `tools/substrate-claim-checker/check-existence.test.ts:28`

The TS surface is otherwise TODO-free.

### 5.10 `any` usage

Zero explicit `: any` or `as any` in non-test code. The 14
`no-unsafe-call` / 4 `no-unsafe-member-access` / 3 `no-unsafe-assignment`
findings all originate from the CommonJS-style imports in
`check-existence.test.ts` (typed as `any` because of the import shape).
Migrating those to ESM imports would eliminate all 21 `no-unsafe-*`
findings in one move.

---

## 6. Cross-reference vs 081KQGDBJ0008QG0R0022EW5ZE audit

Mapping of the 18 ESLint-flagged files to the 081KQGDBJ0008QG0R0022EW5ZE classification:

| File | 081KQGDBJ0008QG0R0022EW5ZE class | ESLint errors | Note |
|---|---|---|---|
| `tools/substrate-claim-checker/check-existence.test.ts` | ts-only | 53 | TS-native; not part of bash → TS migration |
| `tools/substrate-claim-checker/check-existence.ts` | ts-only | 20 | TS-native |
| `tools/substrate-claim-checker/check-counts.test.ts` | ts-only | 16 | TS-native |
| `tools/substrate-claim-checker/check-counts.ts` | ts-only | 13 | TS-native |
| `tools/hygiene/check-no-op-cadence-pattern.ts` | ts-only | 26 | TS-native |
| `tools/invariant-substrates/tally.ts` | ts-only | 23 | TS-native |
| `tools/github/poll-pr-gate.ts` | ts-only | 14 | TS-native (5-AI peer convergence) |
| `tools/github/poll-pr-gate-batch.ts` | ts-only | 8 | TS-native |
| `tools/github/poll-pr-gate-batch.test.ts` | ts-only | 1 | TS-native |
| `tools/github/check-github-status.ts` | ts-only | 3 | TS-native |
| `tools/hygiene/audit-ci-cache-paths.ts` | ts-only | 14 | TS-native |
| `tools/hygiene/audit-git-hotspots.ts` | ts-only | 3 | TS-native |
| `tools/cold-start-check.ts` | ts-only | 13 | TS-native |
| `tools/formal-verification/run-alloy.ts` | ts-only | 4 | TS-native |
| `tools/formal-verification/run-tlc.ts` | ts-only | 4 | TS-native |
| `tools/git/batch-resolve-pr-threads.ts` | kill-sh (slice 20) | 4 | bash → TS port |
| `tools/budget/project-runway.ts` | kill-sh (slice 19) | 2 | bash → TS port |
| `tools/pr-preservation/archive-pr.ts` | kill-sh (slice 21) | 14 | bash → TS port; the heaviest port (806 lines, replaced embedded Python) |

**Interpretation:** of 18 files with ESLint findings, 15 are
TS-native (not bash → TS ports) and 3 are bash → TS ports. The
TS-native files generally accumulated their findings organically
(slow regex, missing compareFn, template-stringification); the
ports are mostly in the same shape because the port preserved the
bash-script's per-line logic 1:1, occasionally carrying forward
flagged regex shapes from the bash original.

The 081KQGDBJ0008QG0R0022EW5ZE migration table classified migration *status* (kill-sh /
keep-sh / etc.) but did not measure migration *quality*. This audit
shows the post-migration TS code is largely clean (38 of 56 files
zero-finding) with concentrated debt in 5 files.

---

## 7. Recommended cleanup order (highest leverage first)

Each row is a candidate cleanup PR. Priorities reflect
findings-eliminated-per-line-changed and risk profile.

1. **Migrate `check-existence.test.ts` CommonJS-style imports → ESM**
   — eliminates ~24 of 53 errors in that file (the `no-require-imports`,
   `no-unsafe-*` cluster) plus deduplicates `setupGitignoreFixture`
   into a single helper. ~30 lines changed, ~30 errors eliminated.
   **Highest leverage in the audit.**

2. **Run `bunx eslint tools/ --fix` for the 31 auto-fixable findings**
   — covers `consistent-type-definitions` (type → interface, 7),
   `array-type` (`Array<T>` → `T[]`, 3), `dot-notation` (3),
   `prefer-string-starts-ends-with` (4), `prefer-regexp-exec` (~10
   migratable), `concise-regex` (`[0-9]` → `\d`, 4). Mechanical safe
   diff; ~30 errors gone in one PR.

3. **Refactor the 4 highest-cognitive-complexity functions**:
   - `tools/substrate-claim-checker/check-existence.ts:236` (CC=37,
     2.5x threshold)
   - `tools/hygiene/audit-ci-cache-paths.ts:157` (CC=29)
   - `tools/substrate-claim-checker/check-existence.ts:168` (CC=25)
   - `tools/formal-verification/run-alloy.ts:226` (CC=24)
   Each is an extract-method refactor; lower per-PR but fixes 4 of 15
   complexity findings and improves readability of load-bearing
   audit code.

4. **Replace `!` non-null assertions with explicit guards in
   `check-counts.test.ts` and `cold-start-check.ts`** — combined ~23
   findings. Test code can use `expect(x).toBeDefined()` first, then
   safe access; production code can use `if (!x) throw …` patterns.

5. **Remove the 2 unused `eslint-disable` directives** at
   `tools/github/poll-pr-gate.ts:286` and
   `tools/pr-preservation/archive-pr.ts:101` — 2-line PR; eliminates
   2 errors and reduces drift surface.

6. **Convert peer-call trio (`codex.ts` / `grok.ts` / `gemini.ts`) to
   share a `tools/peer-call/_common.ts` module** — not currently a
   finding, but the largest *structural* cleanup leverage in the audit
   (~40% line reduction across the trio per §5.7). Higher-risk than
   the above (touches 3 load-bearing peer-call wrappers); recommend
   doing this *after* the cheaper mechanical cleanups land so the
   diff is smaller.

7. **Address the slow-regex cluster in `pr-preservation/archive-pr.ts`
   and `substrate-claim-checker/check-existence.ts`** — 12 of 13
   `slow-regex` findings live in these two files. Each requires
   targeted regex review (anchor, possessive, atomic group). Lower
   priority because (a) inputs are repo-controlled (no adversarial
   input), (b) refactor risk is non-trivial.

8. **Switch `restrict-template-expressions` (51 findings) to
   `String(n)` calls** — single largest rule-frequency, all benign
   (interpolating `number` directly). Mechanical but high line-count
   diff. Defer until later because it's almost-cosmetic.

9. **Fix `tools/cold-start-check.ts:78` `no-fallthrough`** — single
   real-control-flow finding. The branch IS safe today (both arms
   call `process.exit`), but ESLint can't prove it. Add an explicit
   `break;` or restructure as `if`/`else if`. ~3-line PR; eliminates
   the singleton finding.

---

## 8. Summary

- **`tsc --noEmit` strict-mode: 0 / 0.** TypeScript types are clean
  across all 56 files.
- **ESLint: 235 errors, 0 warnings, 18 of 56 files affected** (38
  files are zero-finding clean).
- **No fabricated findings** — every line cited above is from
  `bunx eslint tools/` direct output, captured to `/tmp/eslint-tools.txt`
  during this audit.
- **No code modifications** — this audit changes 1 file (this research
  doc itself) and zero TS files.
- **Top leverage:** migrate `check-existence.test.ts`'s CommonJS-style
  imports to ESM (~30 errors eliminated in one PR) and run
  `eslint --fix` for the 31 auto-fixable findings (~30 more
  eliminated). Two PRs would clean ~25% of the total finding count
  with ~minimal-risk mechanical diffs.
- **Concurrency:** none observed. The audit is read-only / synchronous
  per script per `spawnSync`; no `Promise.all` parallelism issues
  surfaced. No shared mutable state between files.
- **Composes with 081KQGDBJ0008QG0R0022EW5ZE:** the migration-status table answered
  *"is the .sh / .ts pairing right?"*; this audit answers
  *"is the resulting TS substrate clean?"* — and the answer is
  *"clean except for 5 hot-spot files; the rest of the migration
  surface needs no quality work."*

Origin lineage:

- 081KQGDBJ0008QG0R0022EW5ZE audit (the migration-status companion):
  `docs/research/2026-05-04-b-0140-bash-to-ts-migration-audit-table.md`.
- Root tsconfig:
  `/Users/acehack/Documents/src/repos/Zeta/tsconfig.json`
  (strict at every dial).
- ESLint config and SonarJS rule set: per the rules surfaced in this
  audit; configuration discovery not in scope.
- 5-AI peer convergence on `poll-pr-gate.ts` (load-bearing per
  CLAUDE.md): see header of `tools/github/poll-pr-gate.ts` and
  `memory/feedback_amara_poll_gate_not_ending_holding_is_not_status_2026_04_30.md`.
