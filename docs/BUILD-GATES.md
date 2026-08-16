# BUILD-GATES — what "green" means (without PR gating)

We are moving to **folders-on-main / no-PR** (sovereign mode). PRs are not the
gate anymore; **this file is.** GitHub workflows still run (they're free) and
produce signal, but they **do not gate** — green is defined here and checked
locally before you push.

> Rule: before pushing to `main`, every gate below passes locally. The local
> build IS the gate (every agent is the build machine). See
> `memory/project_sovereign_no_pr_mode_local_prepush_build_gate_*`.

**One command for all of it:** `bun run preflight` runs every code-correctness
gate below (lints + tsc + build + full test) and reports **every** failure at
once — unlike CI's lint job, which short-circuits at the first failing language.
Use `bun run preflight:quick` to skip the slow dotnet build + test. Tools absent
locally report SKIP (they still run in CI). Source:
`src/Core.TypeScript/hygiene/preflight.ts`.

## The gates (run all; all must be clean)

| # | Gate | Local command | Checks |
|---|------|---------------|--------|
| 1 | **Build** | `dotnet build Zeta.sln -c Release` | 0 warnings / 0 errors (TreatWarningsAsErrors) |
| 2 | **Test** | `dotnet test Zeta.sln -c Release --no-build` | all xUnit/FsCheck/Z3 suites pass |
| 3 | **Cross-verify** | `bun src/Core.TypeScript/ci/cross-verify-all.ts` + `bun test src/Core.TypeScript/ace/` | cross-language byte-lock + golden-vector oracles + ace suite |
| 4 | **tsc (TypeScript)** | `bun --bun tsc --noEmit -p tsconfig.json` | TS source and tooling typecheck |
| 5 | **semgrep** | `semgrep --config .semgrep.yml --error --metrics=off` | static-analysis rules |
| 6 | **shellcheck** | `shellcheck` (project scripts) | shell-script lint |
| 7 | **actionlint** | `actionlint -color -ignore 'unknown permission scope "administration"'` | workflow YAML lint |
| 8 | **markdownlint** | `mise exec -- markdownlint-cli2 "**/*.md"` | markdown lint |
| 9 | **hygiene** | `bun src/Core.TypeScript/hygiene/check-no-conflict-markers.ts`; `…/check-tick-history-order.ts`; `…/check-archive-header-section33.ts`; `…/audit-section-33-migration-xrefs.ts --enforce`; `…/audit-dangling-symlinks.ts`; `…/audit-sealed-rooms.ts` | repo-structure invariants |
| 10 | **lint (files)** | `bun src/Core.TypeScript/lint/no-empty-dirs.ts`; `bun run hygiene:check-bash-retirement-inventory` | file-presence invariants |

Setup once: `bun install --frozen-lockfile`.

## Scope-aware (don't run what you didn't touch)

A docs-only change need not run the full .NET build/test (CI itself path-filters
this — 081KQGDBJ0008QG0R001MK4YPC). Minimum honest gate by change type:

- **F#/C# code** → gates 1, 2, and 3 if you touched a cross-verified primitive.
- **TS tooling** → gate 4 (+ 3 if oracle-related).
- **docs / workitems / memory** → gates 8, 9 (markdown + hygiene).
- **workflows** → gate 7.

Be honest about what you skipped — a skipped gate is stated, not silent
(`assert-don't-skip`). Slice 1 (byte-cost meter, F# + golden vector) ran gates
1–2 green; this commit is docs+code so 1, 2, 8, 9 apply.

## Source of truth

These gates mirror `.github/workflows/gate.yml` (the free, now-non-gating
signal). When CI changes a gate, update this file in the same change — the two
must agree, since this one is what we actually gate on.
