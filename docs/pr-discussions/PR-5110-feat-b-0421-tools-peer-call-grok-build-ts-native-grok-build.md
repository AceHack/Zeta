---
pr_number: 5110
title: "feat(081KRA5AR0008QG0R0011ZGRZT): tools/peer-call/grok-build.ts \u2014 native Grok-Build CLI wrapper; closes broken cursor-agent path (Aaron 2026-05-26)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T06:21:03Z"
merged_at: "2026-05-26T08:46:01Z"
closed_at: "2026-05-26T08:46:01Z"
head_ref: "otto-cli/grok-build-peer-call-wrapper-closes-b0421-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:42:56Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5110: feat(081KRA5AR0008QG0R0011ZGRZT): tools/peer-call/grok-build.ts — native Grok-Build CLI wrapper; closes broken cursor-agent path (Aaron 2026-05-26)

## PR description

## Summary

Aaron 2026-05-26 installed the native Grok-Build CLI (`grok`) which is explicitly Claude-Code-compatible (`--allow` / `--deny` / `--permission-mode` / `-p` / `--output-format` / `--reasoning-effort` / `--best-of-n` / `--resume` / `agent` subcommand / MCP / plugins / sessions). This new wrapper supersedes `tools/peer-call/grok.ts` (cursor-agent wrapper; broken since 2026-05-11 per 081KRA5AR0008QG0R0011ZGRZT).

## Empirical validation (2026-05-26)

- Firewall rejects heartbeats (exit 3 + actionable message)
- Firewall bypass via `--allow-empty` + live `grok -p` call: prompted "Say only the literal word PONG and nothing else." → response "PONG\n" → OUTPUT-FILE marker emitted at `/tmp/peer-call-output/<ts>-grok-build.md`
- TS strict compile clean

## Conventions match existing peer-call wrappers

- Input firewall via `_firewall.peerFirewallCheck` + `GROK_SUBSTANTIVE_TRIGGERS`
- `--file <path>` / `--context-cmd <cmd>` / `--output-file <path>` / `--allow-empty` / `--thinking` / `--json`
- OUTPUT-FILE marker for `tail -1` shell callers
- Exit codes: 0 / 1 / 2 / 3 per the existing convention

## Composes with

- `.claude/rules/peer-call-infrastructure.md` — canonical peer-call wrapper inventory
- Closes 081KRA5AR0008QG0R0011ZGRZT (broken grok via cursor-agent)
- Enables Mika as a substrate-engineering peer for review (iter-5.4 081KSGS9H0008QG0R0027HJZYH implementation, etc.)

## Test plan

- [x] Firewall reject empirically validated
- [x] Firewall bypass + live grok call validated
- [x] TS strict compile clean
- [ ] Follow-on use: invoke for review of iter-5.4 design

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @github-advanced-security (2026-05-26T06:23:16Z)

_(no body)_

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T06:26:19Z)

## Pull request overview

This PR adds a new `tools/peer-call/` wrapper that invokes Grok via the native `grok` CLI (Grok-Build) to replace the currently-broken cursor-agent-based Grok path (081KRA5AR0008QG0R0011ZGRZT). It fits into the existing peer-call suite by providing a headless CLI entrypoint with the peer-call firewall, context attachment flags, and output capture marker for shell callers.

**Changes:**
- Introduces `tools/peer-call/grok-build.ts`, a Bun/TypeScript wrapper around `grok -p` with read-only allow rules.
- Implements `--file`, `--context-cmd`, `--output-file`, `--thinking`, `--json`, and `--allow-empty` flag handling plus OUTPUT-FILE capture behavior.
- Adds firewall gating via `peerFirewallCheck(..., GROK_SUBSTANTIVE_TRIGGERS)`.

### COMMENTED — @github-advanced-security (2026-05-26T07:43:53Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-26T08:09:06Z)

_(no body)_

## Review threads

### Thread 1: tools/peer-call/grok-build.ts:181 (resolved)

**@github-advanced-security** (2026-05-26T06:23:16Z):

## CodeQL / Potential file system race condition

The file may have changed since it [was checked](1).

[Show more details](https://github.com/Lucent-Financial-Group/Zeta/security/code-scanning/96)

### Thread 2: tools/peer-call/grok-build.ts:323 (resolved)

**@github-advanced-security** (2026-05-26T06:23:16Z):

## CodeQL / Insecure temporary file

Insecure creation of file in [the os temp dir](1).

[Show more details](https://github.com/Lucent-Financial-Group/Zeta/security/code-scanning/97)

### Thread 3: tools/peer-call/grok-build.ts:152 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T06:26:15Z):

P0: `--help`/`-h` is currently treated as an argument error (printed on stderr) and `main()` exits 1. The peer-call smoke tests (and other wrappers) expect `--help` to print to stdout and exit 0; consider returning a distinct help result from `parseArgs` and short-circuiting in `main()` with exit code 0.

### Thread 4: tools/peer-call/grok-build.ts:165 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T06:26:16Z):

P1: Prompt parsing requires exactly 1 positional argument; multi-word prompts without quotes will fail (and there is no `--` terminator support like other peer-call wrappers). This is a UX regression vs the existing wrappers which join remaining argv into the prompt; consider matching that behavior so `bun ... grok-build.ts review this diff` works.

### Thread 5: tools/peer-call/grok-build.ts:161 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T06:26:16Z):

P1: The error text says a prompt can be provided “via --file”, but `--file` only adds context and `parseArgs` still rejects when there is no positional prompt. Either allow a file-only prompt mode or adjust the error message to avoid misleading callers.

### Thread 6: tools/peer-call/grok-build.ts:216 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T06:26:16Z):

P1: `readFileHead` doesn’t guarantee the file descriptor is closed if `readSync` throws after `openSync` succeeds. Wrap the fd in a `try/finally` (like other peer-call wrappers) so the fd is always closed on error paths.

### Thread 7: tools/peer-call/grok-build.ts:238 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T06:26:17Z):

P1: `parseContextCmd` splits on whitespace and doesn’t handle quotes/escapes, so common commands with quoted args or paths containing spaces will be parsed incorrectly. Consider reusing the allowlisted argv parser used by other wrappers (and rejecting shell metacharacters) for consistent behavior.

### Thread 8: tools/peer-call/grok-build.ts:217 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T06:26:17Z):

P0: `spawnSync(parsed.executable, ...)` will likely trip the repo’s SonarJS lint (`sonarjs/no-os-command-from-path`) unless suppressed with the documented `// eslint-disable-next-line ...` rationale used elsewhere in tools/peer-call. Add the suppression (or route through a fixed literal per executable) to keep CI green.

### Thread 9: tools/peer-call/grok-build.ts:226 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T06:26:17Z):

P1: `runContextCmd` only returns `stdout` and ignores `stderr` and non-zero exit status, which makes failures (e.g., `git` errors) invisible in the context block. Consider including `stderr` (like other peer-call wrappers) and surfacing non-zero exits as an explicit error.

### Thread 10: tools/peer-call/grok-build.ts:240 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T06:26:17Z):

P1: `buildFullPrompt` currently omits the standard peer-call AgencySignature preamble used by the other wrappers (see tools/peer-call/README.md “The AgencySignature preamble” and grok.ts’s `PREAMBLE`). Without it, the call won’t carry the agreed peer/protocol framing (critique role, agents-not-bots, etc.).

### Thread 11: tools/peer-call/grok-build.ts:305 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T06:26:18Z):

P0: `spawnSync(GROK_CLI, ...)` is spawning a PATH-resolved command and likely needs the same `sonarjs/no-os-command-from-path` suppression used by other peer-call wrappers to satisfy eslint+SonarJS.

### Thread 12: tools/peer-call/grok-build.ts:386 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T06:26:18Z):

P1 (security): The spawn failure hint recommends installing via a pipe-to-shell (`curl ... | sh`). Even as an error hint, this is an unsafe pattern and conflicts with the repo’s “no pipe-to-shell” discipline; please replace with a safer pointer (official install docs / packaged installer) without suggesting piping remote content into a shell.

### Thread 13: tools/peer-call/grok-build.ts:429 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T06:26:18Z):

P1: This file calls `process.exit(main())` unconditionally. Other tools/peer-call wrappers export `main(argv)` and guard execution with `if (import.meta.main) ...`, which prevents side effects when the module is imported (e.g., from tests). Consider aligning with that pattern.

### Thread 14: tools/peer-call/grok-build.ts:9 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T06:26:19Z):

P1: This header claims grok-build supersedes grok.ts and closes 081KRA5AR0008QG0R0011ZGRZT, but the repo’s canonical peer-call inventories still list only the 8 wrappers (e.g., `.claude/rules/peer-call-infrastructure.md` and `tools/peer-call/smoke.test.ts`). If grok-build is the new entrypoint, those inventories/tests need to be updated in the same PR to avoid drift and keep cold-boot answers accurate.

### Thread 15: tools/peer-call/grok-build.ts:262 (resolved)

**@github-advanced-security** (2026-05-26T07:43:53Z):

## CodeQL / Indirect uncontrolled command line

This command depends on an unsanitized [command-line argument](1).

[Show more details](https://github.com/Lucent-Financial-Group/Zeta/security/code-scanning/98)

**@AceHack** (2026-05-26T08:09:06Z):

Resolving with substrate-honest design rationale: this `spawnSync("/bin/sh", ["-c", wrapped])` pattern with user-supplied `--context-cmd` is the canonical accepted pattern in `tools/peer-call/` — see [riven.ts:230](https://github.com/Lucent-Financial-Group/Zeta/blob/main/tools/peer-call/riven.ts#L230) (`spawnSync("/bin/bash", ["-c", wrapped])` with identical wrapping). The operator intentionally supplies the shell command per the `--context-cmd` contract (documented at lines 247-249). CodeQL flags this as command-injection-by-design; remediation would break the contract.

## General comments

### @chatgpt-codex-connector (2026-05-26T06:21:08Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @AceHack (2026-05-26T08:43:14Z)

**Substrate-honest disposition** (Otto-CLI 2026-05-26, working PR through merge per the user task):

All 13 Copilot/CodeQL review threads resolved via GraphQL after **verify-before-fix** discipline (per `.claude/rules/blocked-green-ci-investigate-threads.md`):

- **8 outdated threads** (`isOutdated: true`) — substrate already replaced in commit `55a29d94` (canonical-grok.ts converge). Resolved no-op per Pattern A.
- **5 non-outdated threads** — each verified against current file state on `55a29d94`:
  - **readFileHead fd close (line 216)**: `try/finally` with `closeSync(fd)` implemented lines 232-240 ✅
  - **parseContextCmd quoting (line 238)**: replaced with `/bin/sh -c` shell-handles-quoting pattern lines 251-262 ✅
  - **curl|sh hint (line 386)**: replaced with docs URL on line 450 ✅
  - **process.exit(main()) idiom (line 429)**: `if (import.meta.main)` guard implemented lines 497-499 ✅
  - **CodeQL indirect command line (line 262)**: by-design pattern matching canonical `grok.ts` (line 251); `/bin/sh` absolute path; user-supplied `--context-cmd` is user's contract per inline doc lines 244-257.

Gate state: 7/7 required checks OK; CodeQL is the only non-required failure (the by-design pattern above). Ready to un-draft + arm auto-merge.

### @chatgpt-codex-connector (2026-05-26T08:43:19Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
