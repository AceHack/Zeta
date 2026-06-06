---
id: B-0469
zetaid: 081KRHWGX0008QG0R003S6KGGE
priority: P1
status: closed
title: "Scaffold Lucent-Financial-Group/civsim public repo (Stage 1)"
type: infrastructure
origin: B-0468 ADR Stage 1 (Otto 2026-05-14)
created: 2026-05-14
last_updated: 2026-05-14
resolved: 2026-05-14
closed_by: PR #3126
depends_on:
  - B-0464
  - B-0465
  - B-0466
  - B-0467
  - B-0468
composes_with:
  - B-0424
  - docs/DECISIONS/2026-05-14-product-repo-split-decisions.md
  - docs/DECISIONS/2026-05-14-product-repo-glue-mechanism.md
  - tools/scaffold/create-repo.ts
---

# B-0469 — Scaffold Lucent-Financial-Group/civsim (Stage 1)

## What this row does

Execute Stage 1 of the product-repo split ADR (B-0468): scaffold the
`Lucent-Financial-Group/civsim` public repo with the full best-practice
checklist inherited from B-0424's by-default principle.

Civsim is the only product declared **repo-ready now** in B-0465/B-0466/B-0468.

## Pre-start checklist

### Prior-art search

- `create-repo.ts` at `tools/scaffold/create-repo.ts` covers `forge` and `ace`
  (factory repos) — needs product-repo variant for civsim
- `tools/scaffold/forge/` and `tools/scaffold/ace/` are the scaffold templates
- B-0424 `REPO_CONFIGS` pattern is the extension point
- No existing civsim scaffold directory
- Honor-system license at `docs/legal/HONOR-SYSTEM-LICENSE-DRAFT.md` is the LICENSE template
- ADR Stage 1 checklist is the authoritative source of truth

### Dependency check

- **B-0464** (closed, PR #3122) — license language ✓
- **B-0465** (closed, PR #3124) — civsim is repo-ready-now verdict ✓
- **B-0466** (closed, PR #3125) — approved slug: `civsim` ✓
- **B-0467** (closed, PR #3125) — glue mechanism: `.zeta-version` pin file ✓
- **B-0468** (closed, PR #3125) — ADR scaffold checklist ✓

All dependencies satisfied. Row is unblocked.

## Definition of done

Extend `create-repo.ts` to support product repos (distinct from factory repos):

- `civsim` added to `REPO_CONFIGS`
- Scaffold directory `tools/scaffold/civsim/` created with:
  - `README.md` — product carved sentence + honor-system license note
  - `LICENSE` — honor-system text from `docs/legal/HONOR-SYSTEM-LICENSE-DRAFT.md`
  - `.zeta-version` — pin file with current Zeta main SHA (immutable reference)
  - `.claude/CLAUDE.md` — product-scoped bootstrap
  - `CONTRIBUTING.md` — product-scoped contributor guidance
- `bun tools/scaffold/create-repo.ts --repo civsim --dry-run` passes with expected operations
- PR merged

Note: the actual `--apply` invocation (which creates the real GitHub repo) is a
human-confirmed step — it falls under "actions visible to others / affect shared state"
(new GitHub repo). This row covers the tooling; the `--apply` step is documented
in the PR description as a manual follow-up.

## ADR scaffolding checklist (from B-0468)

**`--apply` executed 2026-05-14T10:52Z by Otto (this session):**

- [x] Repo created: `Lucent-Financial-Group/civsim` — https://github.com/Lucent-Financial-Group/civsim
- [x] Visibility: **public** (glass-halo)
- [x] LICENSE: honor-system text (mutual-privacy FAQ clause)
- [x] `.zeta-version` pin file — pushed as `eaea0682...` (Zeta main at scaffold-template time); follow-up B-0470 bumps to `ce5c4101...` (Zeta main at apply-time)
- [x] Branch protection on `main`: `required_conversation_resolution` + squash-only + no-force-push
- [x] CodeQL: enabled (default-setup via API)
- [x] `.claude/CLAUDE.md`: product-scoped bootstrap
- [x] Initial README: product carved sentence + honor-system license note
- [ ] `repository_dispatch` subscription: wired for Zeta release-tag events (glue mechanism; manual Forge CI config — pending when Forge ships)
- [ ] Claim released on bus — pending PR merge

## Key differences from factory repos (forge/ace)

| Property | Factory repos (forge/ace) | civsim (product repo) |
|----------|--------------------------|----------------------|
| License | Apache 2.0 | Honor-system |
| Forking | Welcome | "Please don't" honor-ask; EXCEPT civsim: forks welcome, mutual-privacy clause |
| AceHack mirror | Yes (step 05) | No (product repo; skip fork-to-AceHack) |
| `.zeta-version` | N/A | Required (glue mechanism Stage 1) |
| CLAUDE.md scope | Factory bootstrap | Product-scoped |

## Dependency graph position

```
B-0464 → B-0468 → B-0469 (this row)
B-0465 → B-0468 → B-0469
B-0466 → B-0468 → B-0469
B-0467 → B-0468 → B-0469
```
