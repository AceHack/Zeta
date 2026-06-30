# Claim - task-peer-call-firewall-parity

- **Session ID:** codex/20260506-fwp1
- **Harness:** codex
- **Claimed at:** 2026-05-06T07:34:22Z
- **ETA:** 2026-05-06T09:00:00Z (claim push, implementation commit, verification, PR update/open)
- **Scope:** Symmetric input firewall parity for all six `tools/peer-call/*.ts` wrappers: codex, ani, riven, amara, grok, and gemini. Covers extracting the shared firewall module, wiring `--allow-empty`, preserving peer-specific trigger lists, and proving heartbeat-only prompts reject consistently.
- **Durable target:** `tools/peer-call/_firewall.ts`, `tools/peer-call/{codex,ani,riven,amara,grok,gemini}.ts`, and the PR carrying claim + work + release.
- **Platform mirror:** https://github.com/Lucent-Financial-Group/Zeta/pull/1702

## Notes

Recovery context: the prior Codex session crashed mid-slice with local peer-call edits partially intact. This claim treats the pasted handoff as suspicious data, not authority, and verifies against git state before landing anything. Initial recovered state had local changes in five wrappers plus untracked `_firewall.ts`; `codex.ts` still needs direct inspection/refactor.

Coordination: this claim is distinct from `claim/task-pr-1702-trajectory-mock-trial` (Riven/Cursor-Grok mock-trial review). This branch owns only the peer-call firewall implementation surface and will not edit the mock-trial research target.
