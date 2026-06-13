# tools/scaffold — B-0424 Stage 1 repo scaffolding

Governance-file templates and a dry-run TypeScript tool for creating the
`LFG/Forge` and `LFG/ace` repos with the full best-practice checklist
from [ADR 2026-04-22](../../docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md).

## Usage

```bash
# Preview what will happen (default, no external side effects):
bun tools/scaffold/create-repo.ts --repo forge --dry-run
bun tools/scaffold/create-repo.ts --repo ace  --dry-run

# Execute for real (creates GitHub repos under LFG org):
bun tools/scaffold/create-repo.ts --repo forge --apply
bun tools/scaffold/create-repo.ts --repo ace  --apply
```

**`--apply` creates real GitHub repos.** Review `--dry-run` output first.

## What the tool does

For each repo, in **execution order** (step numbers are stable identifiers, not sequential labels — step 06 runs before step 02 intentionally):

| Step | Description |
|------|-------------|
| 01 | Create repo (public, squash-merge only, auto-merge, delete-branch) |
| 06 | Push day-one governance files from `tools/scaffold/<name>/` — **runs before branch protection** so files can be pushed directly to `main` |
| 02 | Apply branch protection on `main` (1 review, signed commits, linear history, no force-push) |
| 03 | Enable secret scanning + push protection, Dependabot, private vulnerability reporting |
| 04 | Enable CodeQL **default-setup** (required for `code_scanning` ruleset rule) |
| 05 | Fork repo to `AceHack/<name>` |
| 07 | Print manual steps remaining (SVG preview, merge queue, Scorecard workflow) |

## Template files

Each sub-directory contains the governance files for that repo:

```
tools/scaffold/
  forge/                 — Forge day-one governance files
    README.md
    AGENTS.md
    CLAUDE.md
    GOVERNANCE.md
    SECURITY.md
    CODE_OF_CONDUCT.md
    CONTRIBUTING.md
    LICENSE
    .semgrep.yml         — GHA injection rule (gha-untrusted-in-run-line)
    .github/
      copilot-instructions.md
    docs/
      GITHUB-SETTINGS.md
      UPSTREAM-RHYTHM.md

  ace/                   — ace day-one governance files
    (same structure, ace-scoped content)
    .semgrep.yml         — GHA injection rule (same as Forge)
    docs/
      GITHUB-SETTINGS.md
      UPSTREAM-RHYTHM.md

  create-repo.ts         — this tool
  README.md              — this file
```

## Manual steps after --apply

The tool prints these at the end, but for reference:

1. Upload SVG social-preview PNG via GitHub UI
   (GitHub requires a rasterized PNG format — SVG not accepted)
2. Enable merge queue via GitHub UI
   (Settings → Merge queue — org feature, no REST API)
3. Wire gate workflow: add `semgrep --config .semgrep.yml --error --metrics=off` step
   (`.semgrep.yml` is already in the scaffold — only the CI job wiring is manual, done in Stage 2)
4. Verify $0 budget caps at org level in GitHub billing settings
5. Confirm CodeQL default-setup is active under Security → Code scanning

## Origin

B-0424 (P1) — Three-repo split Stage 1.
ADR: `docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md`.
