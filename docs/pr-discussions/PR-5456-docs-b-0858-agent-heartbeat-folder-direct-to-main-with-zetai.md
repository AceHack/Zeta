---
pr_number: 5456
title: "docs(081KSKBP80008QG0R001KK9WV6): agent heartbeat folder direct-to-main with ZetaID-collision-free filenames \u2014 composes existing ZetaID + AgencySignature substrate (Aaron 2026-05-27)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T13:46:28Z"
merged_at: "2026-05-27T13:53:52Z"
closed_at: "2026-05-27T13:53:52Z"
head_ref: "backlog/b-0858-agent-heartbeat-folder-zetaid-2026-05-27"
base_ref: "main"
archived_at: "2026-05-27T19:23:48Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5456: docs(081KSKBP80008QG0R001KK9WV6): agent heartbeat folder direct-to-main with ZetaID-collision-free filenames — composes existing ZetaID + AgencySignature substrate (Aaron 2026-05-27)

## PR description

## Summary

Operator 2026-05-27 reminder pointed at existing substrate I wasn't using: ZetaID (128-bit struct ID at \`src/Core.TypeScript/zeta-id/zeta-id.ts\`) + AgencySignature Convention v1. This row mechanizes the externalized-counter fix Kira P0 named:

- Folder \`docs/agent-heartbeats/<persona>/<YYYY>/<MM>/<DD>/<zetaid>.md\`
- Branch protection path-scoped carve-out (direct-to-main; no PR for per-tick heartbeats)
- ZetaID filenames prevent cross-agent collision by construction
- Brief-ack rule's N=6 forcing function fires reliably via \`git log --since\` over the folder

## 7 sub-rows planned

.1 spec → .2 branch protection (op-side) → .3 writer tool → .4 sentinel integration → .5 rule extension → .6 cleanup policy → .7 collision verification

## Test plan

- [x] Substrate-inventory pass cited inline (found ZetaID TS + F# + C# + YAML + Kestrel review)
- [x] AgencySignature v1 trailer on commit
- [x] Per .claude/rules/agent-worktree-hygiene-never-hold-main-...: isolated worktree

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T13:54:27Z)

## Pull request overview

Adds a new P1 backlog row (081KSKBP80008QG0R001KK9WV6) proposing an `docs/agent-heartbeats/` substrate that uses ZetaID-based filenames and a path-scoped branch-protection carve-out to enable low-friction, direct-to-main heartbeat commits, then indexes the row in `docs/BACKLOG.md`.

**Changes:**
- Introduces backlog row **081KSKBP80008QG0R001KK9WV6** specifying folder layout, heartbeat schema, and planned sub-rows for tooling + enforcement.
- Documents how the proposal composes with existing ZetaID and AgencySignature substrates.
- Adds **081KSKBP80008QG0R001KK9WV6** to the P1 section of `docs/BACKLOG.md`.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 6 comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P1/081KSKBP80008QG0R001KK9WV6-agent-heartbeat-folder-direct-to-main-zetaid-filenames-no-pr-mechanism-aaron-2026-05-27.md | New backlog row describing the heartbeat-folder + ZetaID-filename design and integration plan |
| docs/BACKLOG.md | Adds the 081KSKBP80008QG0R001KK9WV6 entry to the P1 index |

## Review threads

### Thread 1: docs/backlog/P1/081KSKBP80008QG0R001KK9WV6-agent-heartbeat-folder-direct-to-main-zetaid-filenames-no-pr-mechanism-aaron-2026-05-27.md:39 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T13:54:25Z):

The bit-layout bullet list is presented as the full “128 bits”, but the named fields shown sum to 124 bits (per docs/zeta-id-v1-layout.yaml there are 4 reserved bits). Also, describing IDs as “collision-free … by construction” isn’t accurate with a 32-bit randomness field—collisions are just very low probability. Consider explicitly mentioning the reserved bits and rephrasing the collision claim (or specifying an actual uniqueness mechanism).

### Thread 2: docs/backlog/P1/081KSKBP80008QG0R001KK9WV6-agent-heartbeat-folder-direct-to-main-zetaid-filenames-no-pr-mechanism-aaron-2026-05-27.md:58 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T13:54:26Z):

This spec says the ZetaID persona field “matches the folder” and lists agent-personas like otto/alexa/etc, but the current ZetaID persona registry is role-refs (registry/personas.yaml) and does not include those agent personas. As written, the “collision-free across agents” argument doesn’t hold unless the registry (and TS/F#/C# bindings) are extended to include per-agent persona slots (or the design is changed to not rely on persona for uniqueness).

### Thread 3: docs/backlog/P1/081KSKBP80008QG0R001KK9WV6-agent-heartbeat-folder-direct-to-main-zetaid-filenames-no-pr-mechanism-aaron-2026-05-27.md:58 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T13:54:26Z):

The spec hard-codes base64url as the filename encoding for `<zetaid>`, but the existing TS cross-verification harness currently treats the canonical textual form as 32-hex (see src/Core.TypeScript/zeta-id/cross-verify.ts). To avoid cross-language drift, it would help to either (a) align with the existing hex representation for filenames, or (b) explicitly declare/justify base64url as a new canonical external form and note that writer + verifiers must implement it in TS/F#/C#.

### Thread 4: docs/backlog/P1/081KSKBP80008QG0R001KK9WV6-agent-heartbeat-folder-direct-to-main-zetaid-filenames-no-pr-mechanism-aaron-2026-05-27.md:74 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T13:54:26Z):

In the YAML example, `disposition: bounded-wait | decomposing | ...` reads like an enum declaration, but it’s actually a single YAML scalar value containing `|` characters. Consider making the example valid/unambiguous YAML (e.g., a single value plus a comment listing allowed values, or a separate `allowed:` list in the spec).

### Thread 5: docs/backlog/P1/081KSKBP80008QG0R001KK9WV6-agent-heartbeat-folder-direct-to-main-zetaid-filenames-no-pr-mechanism-aaron-2026-05-27.md:86 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T13:54:27Z):

The example `git log --since="2min ago" docs/agent-heartbeats/otto/` would be more robust with the standard path separator (`git log --since=... -- docs/agent-heartbeats/otto/`) so the directory can’t be misinterpreted as a revision name.

### Thread 6: docs/backlog/P1/081KSKBP80008QG0R001KK9WV6-agent-heartbeat-folder-direct-to-main-zetaid-filenames-no-pr-mechanism-aaron-2026-05-27.md:107 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T13:54:27Z):

The “NOT a security risk” claim is stated categorically, but a branch-protection carve-out that permits direct-to-main pushes is inherently a security/reliability tradeoff (even if the intended content is just metadata). Consider rephrasing to acknowledge the tradeoff and add concrete guardrails (e.g., schema validation/auditing, restrictions on who can push, and explicit prohibition on secrets/binary payloads) so readers don’t treat it as risk-free.

## General comments

### @chatgpt-codex-connector (2026-05-27T13:46:33Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
