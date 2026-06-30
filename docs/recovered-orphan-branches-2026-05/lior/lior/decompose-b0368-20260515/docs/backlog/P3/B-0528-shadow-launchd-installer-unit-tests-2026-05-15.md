---
id: B-0528
priority: P3
status: closed
title: "Unit tests for tools/shadow/launchd/install-launchagent.ts"
tier: factory-infrastructure
effort: S
created: 2026-05-15
last_updated: 2026-05-16
closed: 2026-05-16
depends_on: []
composes_with: [B-0402]
tags: [test-coverage, shadow-observer, launchd, deferred-from-pr-3342]
type: chore
---

# Unit tests for tools/shadow/launchd/install-launchagent.ts

## Origin

PR #3342 introduced `tools/shadow/launchd/install-launchagent.ts` — a
safety-critical installer that performs placeholder substitution + XML
escaping + atomic plist promotion + optional `launchctl bootstrap`.
Copilot's review of the install script flagged the absence of unit
test coverage (P1):

> The new installer adds safety-critical substitution and LaunchAgent
> generation logic, but there are no tests covering placeholder
> escaping, missing placeholders, argument validation, or dry-run
> output. `tools/shadow/shadow-observer.ts` already has Bun tests in
> this area, so this installer should get comparable unit coverage
> before it becomes the documented install path.

The PR #3342 follow-up commit (`970c774`) addresses 8 of the 10
review-cycle-2 findings but defers test coverage to this row to keep
the PR's scope manageable.

## Scope

Add `tools/shadow/launchd/install-launchagent.test.ts` using Bun's
built-in test runner. Verify:

1. **Placeholder substitution**
   - `{{BUN_PATH}}` and `{{REPO_ROOT}}` are replaced
   - Unrecognized `{{NAME}}` placeholders cause exit 1 with a
     descriptive error
2. **XML escaping**
   - Paths containing `&`, `<`, `>`, `"`, `'` produce a plist that
     `plutil -lint` accepts (no raw XML-significant characters end
     up in `<string>` text nodes)
   - Example fixture: `/Users/foo & bar/Zeta`
3. **Argument validation**
   - Unknown flag (e.g., `--dryrun`) exits 1 before any FS action
   - Relative `--repo-root .` and `--bun-path ./bin` rejected with
     "must be an absolute path"
   - Missing value for `--repo-root` exits 1
4. **Dry-run output**
   - `--dry-run` writes the rendered plist to stdout, not the
     filesystem
   - `~/Library/LaunchAgents/com.zeta.shadow-observer.plist` is
     unchanged after a dry-run invocation
5. **Default detection**
   - `tryDetect("which", ["bun"])` returns undefined cleanly when
     bun isn't on PATH (instead of throwing)
   - Same for `git rev-parse --show-toplevel` outside a checkout
6. **Availability-preserving install pattern**
   - If `readFileSync(destPath, "utf-8")` succeeds, the in-memory
     content is written to the side-car backup AFTER the new
     content is in place at destPath
   - If `readFileSync` throws ENOENT, the install proceeds without
     a backup (no existing plist to back up)
   - If `readFileSync` throws non-ENOENT, the install proceeds
     without a backup but logs the read failure
   - If `writeFileSync(tmpDest, ...)` fails, destPath is untouched
     (no rename has happened yet) and no backup is created
   - If `renameSync(tmpDest, destPath)` fails, the temp file is
     unlinked and destPath remains in its pre-call state
     (untouched existing plist, or absent if none existed)
   - The canonical destPath is NEVER in a missing state during a
     successful install — the atomic rename replaces in one syscall

Reuse the existing test-helper patterns from
`tools/shadow/shadow-observer.test.ts` for fixture setup +
temp-dir handling.

## Acceptance

- New file `tools/shadow/launchd/install-launchagent.test.ts`
- All 6 categories above covered with at least one test each
- `bun test tools/shadow/launchd/install-launchagent.test.ts` passes
- CI lint-shellcheck + lint-tsc-tools remain clean
- Document the test-running invocation in
  `tools/shadow/launchd/README.md` (single line, no new section)

## Composes with

- B-0402 (zeta shadow mode — first-class CLI autocomplete)
- PR #3342 (the install script being tested)
- `tools/shadow/shadow-observer.test.ts` (existing pattern to follow)

## Non-goals

- End-to-end LaunchAgent install tests requiring a real `launchctl
  bootstrap` (would need a macOS runner + sudo + cleanup of system
  state — out of scope; cover with the `--bootstrap` smoke test
  document only)
- Refactoring `install-launchagent.ts` for testability beyond the
  existing `if (import.meta.main)` guard (the helper functions
  `xmlEscape`, `substitutePlaceholders`, `requireAbsolute`,
  `tryDetect`, `plutilLint` are already importable)
