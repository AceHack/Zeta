# Zeta repo scripting — composition layer

**Scope**: Zeta automation scripts (anything under `tools/` that
operates on the repo). **Current stack**: TypeScript on Bun.

**Status**: Active. Composition-layer baseline. Combines the
language layer (`typescript.md`) and the runtime layer (`bun.md`)
into Zeta-specific conventions for automation scripts. NOT a
universal scripting standard — when a future stack joins (e.g.,
.NET console tools, F# scripts), they get their own composition
file (`repo-scripting-dotnet.md` etc.).

**Trigger**: Required to exist and be current before the *first
mutating action* on any TS/Bun port slice (TS/Bun migration
trajectory's Gate B prerequisite). Read-only scoping may happen
first; mutation waits.

## Layered references (the primitives this composition uses)

- `docs/best-practices/typescript.md` — language / type-system /
  typed-linting standard.
- `docs/best-practices/bun.md` — runtime / process / file IO /
  shell standard.

This file does NOT restate those primitives. It records the
Zeta-specific compositional choices: which patterns we adopted
from upstream / sibling repos, which we rejected, and why.

## Sibling-repo patterns adopted

Sources: `../SQLSharp` at commit `7d3d9f6` (2026-04-18),
`../scratch` at file mtime 2026-04-15. Refresh per slice.

| Pattern | SQLSharp | scratch | Zeta adopted? |
|---|---|---|---|
| Entrypoint guard | `import.meta.main` | `import.meta.main` | yes |
| CLI parse | typed `Args` interface, manual loop | minimal | yes (typed `Args`) |
| Process spawn | structured failure classifier in `tools/automation/format/process-runner.ts` (launch / termination / non-zero exit branches) | n/a | yes (mirror in `tools/hygiene/audit-md032-plus-linestart.ts:classifyGitFailure`) |
| Result/finding type | typed boundary objects (`{ file, line }`) | minimal | yes |
| File IO | atomic `readFileSync` + try/catch | minimal | yes |
| Type-only imports | `import { type SpawnSyncReturns }` | n/a | yes when boundary types involved |
| `readonly` on result arrays | yes | yes | yes |

## Zeta-specific scripting conventions

These are the conventions **this composition** layer adds on top
of the layered primitives — choices that are Zeta-shaped, not
upstream-mandated.

### Exit codes — three values

```ts
type AuditExitCode = 0 | 2 | 64;
```

- `0` — clean (or non-enforce mode with findings).
- `2` — findings present AND `--enforce` flag set.
- `64` — argument or input-file error (matches `EX_USAGE` from
  sysexits).

Rationale: enforce-mode separation lets a script run in advisory
mode by default and gate CI by re-running with `--enforce`.

### CLI flag conventions

- `--file PATH` — override default target.
- `--base DIR` — override default search base where applicable.
- `--enforce` — promote findings to non-zero exit.
- `--list` — emit machine-parseable `file:line` lines on stdout.
- `-h` / `--help` — usage on stdout, exit 0.

Unknown flags exit `64` with an error to stderr.

### Output channel discipline

- **stdout**: machine-parseable output (`--list` results,
  `--help` text).
- **stderr**: progress, summaries, error messages.

This separates pipeable data from human-facing chatter. Bash
originals followed the same convention; carry it forward.

### File-read error wording

```ts
try {
  content = readFileSync(target, "utf8");
} catch {
  process.stderr.write(`error: target file not found: ${target}\n`);
  return 64;
}
```

For audit scripts where the only useful action on read failure
is "fail loud," the simple wording is acceptable. When the
failure mode matters (permission vs missing vs directory),
capture and surface the error code per `bun.md` guidance.

### Repo-rooted invocation

Scripts that walk the repo (`git ls-files`, etc.) call
`process.chdir(repoRoot())` first, where `repoRoot()` shells
out to `git rev-parse --show-toplevel`. This makes scripts
work the same whether invoked from the repo root or a
subdirectory.

## Per-slice TS/Bun port audit checklist

This is the canonical checklist. Use it for any slice porting
bash → TS+Bun in `tools/`.

Before merging, the slice's audit (in
`docs/trajectories/typescript-bun-migration/slice-audits.md`)
must record:

- [ ] TypeScript upstream sources re-verified within currency
      window (or `typescript.md` re-verified, slice inherits)
- [ ] Bun upstream sources re-verified within currency window
      (or `bun.md` re-verified, slice inherits)
- [ ] Sibling-repo comparison points checked (paths +
      commit/mtime)
- [ ] Per-file evidence: 0 `any` uses (or each justified inline)
- [ ] Per-file evidence: 0 `as` casts (or each justified inline)
- [ ] `bun x tsc --noEmit` clean on slice files
- [ ] `eslint <slice files>` clean
- [ ] Regex match groups guarded — verified by grep
- [ ] Index accesses guarded under `noUncheckedIndexedAccess` —
      verified by grep
- [ ] File-read errors handled as typed outcomes
- [ ] No `existsSync(p) ... readFileSync(p)` TOCTOU patterns
- [ ] `import.meta.main` entry guard + named exports
- [ ] `types: ["bun"]` in tsconfig
- [ ] Bun Shell (`Bun.$`) used IF slice involves multi-stage
      shell pipelines; otherwise Node-style `spawnSync`
      acceptable (with `maxBuffer` set when output is unbounded)
- [ ] Process-spawn failures classified into launch /
      termination-without-exit / non-zero exit branches (not
      collapsed)
- [ ] Bash-vs-TS output equivalence verified for each port
      (default args and any flag modes)
- [ ] All slice files use the *same* canonical pattern (no
      one-script-typed-properly-others-loose split)
- [ ] DST-friendly: no real `Date.now()` / `Math.random()` /
      `setTimeout`-timing reliance in test paths; injected
      clock/RNG/scheduler used. For port slices that have no
      tests yet, this is a deferred check — flag as gap in
      slice-audits.md, not a free pass.
- [ ] Code coverage: any new module added by the slice has tests
      covering its public surface; CI surfaces coverage; the
      slice does not regress overall coverage. For port slices
      where the bash original had no tests, the TS port either
      adds tests OR records the gap explicitly (DST-exempt-is-
      deferred-bug discipline applies to coverage too).

## What this artifact is NOT

- **Not the language standard** — see `typescript.md`.
- **Not the runtime standard** — see `bun.md`.
- **Not a universal scripting standard** — explicitly Zeta /
  TS-on-Bun. Future stacks get their own composition file.
- **Not the full TS+Bun expert skill** — task #351 remains open;
  this is the minimum substrate the next slice needs.
- **Not a doctrine lane** — this lives inside the TS/Bun
  trajectory's Gate B; not a separate lane.
- **Not a machine-runnable audit** — the per-slice checklist is
  human-readable. Machine-script version is a follow-up. Per the
  multi-AI convergence: "if we make it mandatory now, we risk
  another infrastructure detour."

## Carved blades

```text
TypeScript is the language.
Bun is the host.
Repo scripting is the composition.
```

```text
Do not name the stack.
Name the layers.
```

(These crystallized in the multi-AI naming-correction pass
2026-04-29 — when a doc was almost named `typescript-bun.md`,
which would have set precedent for `typescript-node.md`,
`typescript-deno.md`, etc. Caught and split into the layered
shape this file is the composition of.)

## Composes with

- `docs/best-practices/typescript.md` — language layer.
- `docs/best-practices/bun.md` — runtime layer.
- `docs/trajectories/typescript-bun-migration/RESUME.md` — the
  trajectory dashboard; this file is part of its Gate B
  prerequisite.
- `docs/trajectories/typescript-bun-migration/slice-audits.md` —
  per-slice audit substrate; the checklist above is what each
  audit records.
- `docs/research/2026-04-29-multi-ai-tsbun-port-quality-two-gate-model.md`
  — verbatim multi-AI packet that produced the two-gate framing
  + the layered-naming correction.
- Otto-364 (search-first authority) — drives the currency rule.
- Otto-363 (substrate-or-it-didn't-happen) — this file IS that
  landing for the composition layer.
- Task #351 (TS+Bun expert + teaching skill) — eventual full
  skill; this is the scoped precursor.
