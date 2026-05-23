---
id: B-0581
priority: P2
status: open
title: "Skill — wrap `gh auth refresh` interactive flow + record scope-grant registry (per-machine, per-human-touch)"
tier: factory-infrastructure
effort: S
created: 2026-05-16
last_updated: 2026-05-16
depends_on: []
composes_with: [B-0570, B-0571, B-0580]
tags: [skill, github, auth, oauth, scope-management, registry, human-in-the-loop]
type: feature
---

# Skill — `gh auth refresh` interactive-flow wrapper + scope-grant registry

## Origin

Aaron 2026-05-16, after Otto tried to fire `gh auth refresh` blindly via Bash tool and got blocked on the interactive Y/n prompt:

> *"we need a skill around this"*

Then, when describing the maintainer-side experience:

> *"you have to hit enter once i think to make it pop open"*

And after I confirmed the operational pattern:

> *"when we work on that backlog item i can be he human that clicks the screen to test it"*

The empirical artifact that triggered the row: a successful gh auth refresh run that surfaced the operational flow:

```text
$ gh auth refresh -h github.com -s "<comma-separated-scopes>"
? Authenticate Git with your GitHub credentials? Yes
! First copy your one-time code: 472D-B3EF
Press Enter to open https://github.com/login/device in your browser...
✓ Authentication complete.
```

Otto running this command via Bash tool either hangs at the Y/n prompt or — if it answers — burns the one-time code (`472D-B3EF`) without surfacing it to the human. The code is the load-bearing credential that the human must transfer terminal→browser.

## What

A skill (`.claude/skills/gh-auth-refresh-wrapper/SKILL.md`) that wraps the `gh auth refresh` flow so:

1. Otto knows what scopes are being requested (it constructed the command)
2. The one-time code is surfaced PROMINENTLY to the human (chat output minimum; clipboard copy + OS notification as enhancements)
3. The Enter-to-open-browser step is pumped automatically (or the human is told exactly what to type)
4. Post-approval, `gh auth status` is polled until the new scopes appear
5. The scope grant is RECORDED in a registry: which machine, which scopes, which human approved, when

## Acceptance criteria

- [ ] `.claude/skills/gh-auth-refresh-wrapper/SKILL.md` exists with carved-sentence + operational content
- [ ] Skill body documents the 6-step flow (preceding section)
- [ ] Skill includes a `tools/auth/gh-auth-refresh-wrapper.ts` helper that:
  - Spawns `gh auth refresh -h github.com -s <scope-list>` with stdin pumped to handle Y/n
  - Streams stdout; on detection of `! First copy your one-time code: <CODE>`, captures the code
  - Displays code to the human PROMINENTLY (e.g., to stdout with a large banner + macOS `osascript -e 'display notification ...'` for OS-level surfacing + `pbcopy` for clipboard)
  - Pumps Enter to trigger browser open (only after surfacing the code to give the human time to copy)
  - Polls `gh auth status` until target scopes appear (or timeout)
- [ ] Registry written to `~/.local/share/zeta/scope-grants.jsonl` (or similar) — append-only JSON-lines log of: `{machineId, scopes[], grantedBy, grantedAt, command}`
- [ ] Tests: helper-script unit tests with injected stdin/stdout streams covering: success path, Y/n refusal, OAuth timeout, code-capture regex
- [ ] Documented in the skill's body + composes-with B-0570 (scarcity tracker — scope grant affects available API budget)

## Why now

The 2026-05-16 session demonstrated the exact failure mode: Otto fired the command via Bash tool, the interactive flow hung, the user rejected the tool call, then ran it himself in his terminal and walked through the OAuth flow manually. The substrate-honest discipline says: encode this workflow in a skill so future-Otto (and future humans) follow the right shape automatically.

Composes with several recent landings:

- B-0570 (scarcity tracker) — scope grants affect what API calls Otto can make + the budget categories it can monitor
- B-0571 (GitHub App for factory automation) — the PRODUCTION-grade alternative to this human-laptop-OAuth flow; both can coexist
- B-0580 (Enterprise ruleset mgmt) — uses enterprise-scope APIs that need scope grants this skill wraps

Plus the canonical memory file: `feedback_aaron_fine_grained_pat_workflow_for_otto_human_maintainer_pattern_not_production_2026_05_16.md` (user-scope memory) — captures the full workflow + the empirical pattern this skill operationalizes.

## Decomposition into implementation slices

| Slice | Description | Effort | Status |
|-------|-------------|--------|--------|
| 1 | `tools/auth/gh-auth-refresh-wrapper.ts` — spawn gh + stdin pump + stdout regex for code capture | S | open |
| 2 | Code-surfacing UI: stdout banner + `pbcopy` + `osascript` notification | XS | open |
| 3 | Post-approval scope-status polling loop with timeout | XS | open |
| 4 | Registry write: `~/.local/share/zeta/scope-grants.jsonl` append on success | XS | open |
| 5 | `.claude/skills/gh-auth-refresh-wrapper/SKILL.md` — invoke procedure, carved sentence | XS | open |
| 6 | Tests with injected stdin/stdout streams (success / refusal / timeout / regex) | S | open |

Total: S (small overall — one short evening's work)

## Test plan

**Aaron volunteered to be the human-in-the-loop for testing**:

> *"when we work on that backlog item i can be he human that clicks the screen to test it"*

So when this row gets picked up:

1. Otto implements the slices
2. Otto invokes the wrapper from a test script targeting a minimal scope (e.g., `gist`)
3. Aaron approves in his browser
4. Verify the code was surfaced before the browser-open prompt
5. Verify `gh auth status` shows the new scope post-approval
6. Verify the registry entry got written with correct fields

## Composes with

- B-0570 (scarcity tracker — scope changes the API surface available)
- B-0571 (GitHub App for factory automation — production alternative)
- B-0580 (Enterprise ruleset management — uses scopes this skill grants)
- `feedback_aaron_fine_grained_pat_workflow_for_otto_human_maintainer_pattern_not_production_2026_05_16.md` (user-scope memory — origin substrate)
- `.claude/rules/methodology-hard-limits.md` (scope grants are budget-touching; the rule's least-privilege principle composes)
- `.claude/rules/dont-ask-permission.md` (within authority — Otto requests scopes via this skill; human-in-loop approval is built into the flow itself)
- `.claude/skills/make-persistent/SKILL.md` (sibling skill: installs persistent agent service; similarly multi-step, with operational details that need encoding)

## Substrate-honest caveats

- This skill targets the MAINTAINER-LAPTOP workflow, not production. Production should use GitHub App (B-0571).
- The registry (`~/.local/share/zeta/scope-grants.jsonl`) is per-machine local storage. Multi-machine visibility would need a separate aggregation step (probably out of scope for the first version).
- The `pbcopy` + `osascript` notifications are macOS-only. Cross-platform support (Linux/Windows) is a future slice.
- The polling for post-approval scope appearance has a timeout; if the human takes >timeout to approve, the skill should surface "approval still pending, run `gh auth status` later to verify" rather than hang or error.
- Some scope names get collapsed by GitHub's OAuth flow (e.g., `manage_billing:enterprise` may not appear in the resulting list but billing endpoints work via `admin:enterprise`). The skill should record what was REQUESTED + what's currently GRANTED — both, not just one.

## Open questions

1. **Registry location**: `~/.local/share/zeta/scope-grants.jsonl` or in-repo `docs/auth/scope-grants.jsonl`? Per-machine is JSONL-local; in-repo would need conflict-resolution. JSONL-local is simpler for v1.
2. **Human identifier**: GitHub username from `gh api user --jq .login`? Or local OS username from `whoami`? Both for cross-reference?
3. **Machine identifier**: `hostname` is human-readable; `system_profiler SPHardwareDataType` gets the hardware UUID on macOS. Probably hostname for simplicity.
4. **Code-surface UX**: should the skill PAUSE waiting for the human to confirm they've copied the code, before pumping Enter? Safer but adds an extra interaction. Alternative: surface the code prominently and wait a few seconds before pumping Enter (giving copy time without explicit confirmation).
5. **Stdin pumping for Y/n**: should the skill auto-answer Y, or surface the prompt to the human? Y is the safe default (it's the literal default), but human visibility might be preferred.

## Pre-start checklist

- [x] Prior-art search: no existing gh-auth-refresh wrapper in `tools/`
- [x] Dependency proof: depends only on `gh` CLI being installed (standard prerequisite)
- [x] Empirical: the failure mode + the successful manual flow both observed 2026-05-16 (Aaron's terminal run with one-time code `472D-B3EF`)
- [x] Human test-volunteer identified: Aaron
