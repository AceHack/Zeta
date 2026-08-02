# Claim - task-windows-mise-runtime-path

- **Session ID:** codex/8f2a61c4
- **Harness:** OpenAI Codex - Vera (GPT-5.5 max)
- **Claimed at:** 2026-08-02T17:56:34Z
- **ETA:** 2026-08-02T19:00:00Z
- **Scope:** Persist mise-managed runtime bin paths after the Windows declarative installer so later GitHub Actions steps can invoke Bun and the other pinned runtimes directly.
- **Durable target:** `tools/setup/install.ps1`, the source-owned Windows installer smoke tests under `src/Core.TypeScript/ci/`, and this claim.
- **Platform mirror:** GitHub pull request.

## Evidence

- Gate run `30759163840`, Windows jobs `91527282297` and `91527282311`, installed runtimes successfully and then failed in the next step because `bun` was not on `PATH`.
- `tools/setup/install.ps1` invokes Bun through `mise exec` during installation but does not export `mise bin-paths` to the current process or `$GITHUB_PATH` for later Actions steps.

## Exit

- Focused TypeScript tests, PowerShell parsing, TypeScript checking, and repository preflight pass.
- The path-sensitive Windows workflow and post-merge Windows gate confirm that a subsequent workflow step can invoke `bun` directly.
