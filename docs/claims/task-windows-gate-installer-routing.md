# Claim - task-windows-gate-installer-routing

- **Session ID:** codex/8f2a61c4
- **Harness:** OpenAI Codex - Vera (GPT-5.5 max)
- **Claimed at:** 2026-08-02T18:46:12Z
- **ETA:** 2026-08-02T19:45:00Z
- **Scope:** Route the build-and-test matrix to the native Windows installer instead of invoking the Unix shell entrypoint under PowerShell.
- **Durable target:** `.github/workflows/gate.yml`, source-owned CI contract tests under `src/Core.TypeScript/ci/`, and this claim.
- **Platform mirror:** GitHub pull request.

## Evidence

- Main gate run `30761490004`, jobs `91532769780` and `91532769779`, invoked `./tools/setup/install.sh` with `pwsh`, returned without installer output, and then failed because `bun` was absent.
- PR `#9978` separately proved `tools/setup/install.ps1` and direct Bun resolution on Windows Server Core.

## Exit

- The workflow selects `install.sh` only on Unix and `install.ps1 -SkipLoopRegister` only on Windows.
- Source-owned tests and actionlint enforce the split.
- Dispatched branch run `30762290568` proved Windows 2025 completed the native installer, resolved Bun in the next workflow step, and passed build plus tests. Windows ARM64 also reached the native installer; it then reported separate unavailable native dependencies (Java 26 metadata, 1Password CLI artifact, and Semgrep's OpenSSL build), replacing the prior false-positive shell no-op with an actionable architecture result.
