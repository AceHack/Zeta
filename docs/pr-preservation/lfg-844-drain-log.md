# PR-preservation drain-log — LFG #844

**PR:** Lucent-Financial-Group/Zeta#844
**Title:** ops(0-0-0): post-reset cleanup — stale-prose fixes + protection-config memory
**Opened:** 2026-04-29T14:14Z
**Closed:** 2026-04-29T14:18:52Z (NOT MERGED — closed in favor of canonical AceHack-first reopening)
**Reason for close:** Aaron correction — *"without the double-hop in a few hours we'll be right back to where we started — that's load-bearing to get right"*. PR went LFG-first; canonical pattern is AceHack-first → LFG forward-sync → AceHack absorbs LFG squash-SHA. Reopened on AceHack as #101.

## Threads (5 total: 1 resolved, 4 unresolved at close)

### Thread 1 — Codex P2 — `gh api --input` syntax (RESOLVED via commit f6d6a94)

**Author:** chatgpt-codex-connector
**Path:** memory/feedback_protection_config_dual_layer_legacy_deleted_rulesets_canonical_2026_04_29.md
**Filed:** 2026-04-29T14:16:33Z
**Outcome class:** FIX

> **<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Use supported gh api request-body syntax**
>
> The `Executed` commands document `gh api ... --input '{"enforcement": "disabled"}'`, but `gh api` treats `--input` as a file argument (manual: `--input <file>`, use `-` for stdin), so this form is interpreted as a filename and is not reproducible as written. Because this memory file is positioned as an operational reference for future protection toggles, the current command text can cause failed retries during incident handling; use a real file/stdin body or field flags instead.

**My response (commit f6d6a94, 2026-04-29T14:17:34Z):** Fixed memory-file documentation. Replaced `gh api --input '{json}'` with the actual heredoc-from-stdin pattern that was used live: `gh api ... --input - <<'EOF'` + JSON body + `EOF`. Added clarifying note about gh CLI flag semantics (`--input <file>`, `--input -` for stdin, `-f`/`-F` for typed inline fields).

### Thread 2 — Copilot — `gh api --input` (UNRESOLVED at close, addressed in carry-forward to #101 + LFG forward-sync)

**Author:** copilot-pull-request-reviewer
**Path:** memory/feedback_protection_config_dual_layer_legacy_deleted_rulesets_canonical_2026_04_29.md (line 42)
**Filed:** 2026-04-29T14:19:27Z
**Outcome class:** FIX (duplicate finding, same root cause as Codex Thread 1)

> The `gh api ... --input '{"enforcement": ...}'` invocations won't work as written: `gh api --input` expects a file path (or stdin via `--input -`), not an inline JSON string. Use `-f enforcement=...`/`-F enforcement=...`, or pass JSON via stdin (e.g., `--input -`) so this is copy/paste-correct for future audits.

**Resolution path:** Already addressed by the same f6d6a94 commit (which Copilot didn't see at filing time). The memory file now shows the correct heredoc-stdin pattern AND mentions `-f`/`-F` as alternatives. Carry-forward to AceHack #101 means the corrected text is already on the branch.

### Thread 3 — Copilot — internal consistency on legacy DELETE response (UNRESOLVED, FIX in carry-forward)

**Author:** copilot-pull-request-reviewer
**Path:** memory/feedback_protection_config_dual_layer_legacy_deleted_rulesets_canonical_2026_04_29.md (line 43)
**Filed:** 2026-04-29T14:19:28Z
**Outcome class:** FIX

> The step list appears internally inconsistent: the earlier GH006 rejection indicates legacy branch protection was active, but the subsequent `gh api -X DELETE .../branches/main/protection` line claims a 404 "Branch not protected" response (which typically means there was no classic protection to delete). To keep this memory reliable, please reconcile this (e.g., clarify an intermediate UI/API change, confirm the endpoint/repo/branch used, or update the recorded responses).
>
> ```suggestion
> # Delete legacy branch protection (this removed the GH006 blocker)
> gh api -X DELETE repos/AceHack/Zeta/branches/main/protection
> # → 204 No Content
> ```

**Resolution path (commit forthcoming on LFG forward-sync):** Real bug — the 404 came from my POST-DELETE verification GET, not from the DELETE itself. The DELETE returned rc=0 (success / 204 No Content); a subsequent `gh api repos/AceHack/Zeta/branches/main/protection` (GET) returned `{"message":"Branch not protected","status":"404"}` because the branch was no longer protected. The memory file now reflects this two-step accurately:
> ```bash
> # Delete legacy branch protection (this removed the GH006 blocker)
> gh api -X DELETE repos/AceHack/Zeta/branches/main/protection
> # → success (rc=0, no body printed; GitHub returns 204 No Content)
> # Subsequent verification GET returns 404 "Branch not protected":
> #   gh api repos/AceHack/Zeta/branches/main/protection
> #   → {"message":"Branch not protected", "status":"404"}
> ```

### Thread 4 — Copilot — "Task #305" ambiguous reference (UNRESOLVED, FIX in carry-forward)

**Author:** copilot-pull-request-reviewer
**Path:** memory/feedback_protection_config_dual_layer_legacy_deleted_rulesets_canonical_2026_04_29.md (line 82)
**Filed:** 2026-04-29T14:19:28Z
**Outcome class:** FIX (real ambiguity — wrong reference)

> References to "Task #305" here are ambiguous in-repo (this repo already has a PR #305, and backlog rows use `B-####` IDs under `docs/backlog/**`). Consider replacing "Task #305"/"#305-adjacent" with the actual backlog-row ID (if any) or a direct URL so readers don't chase the wrong artifact.

**Resolution path (commit forthcoming on LFG forward-sync):** Two-part real fix:
1. The reference was actually wrong — should be **task #275** ("Set up acehack-first development workflow") in the in-session TaskList tracker, not #305. Updated.
2. Added clarifying parenthetical noting the distinction between the in-session TaskList numbers vs PR numbers vs backlog `B-####` row IDs — different namespaces, easy to confuse.

### Thread 5 — Copilot — wording nit "the only rulesets ruleset" (UNRESOLVED, FIX in carry-forward)

**Author:** copilot-pull-request-reviewer
**Path:** memory/feedback_protection_config_dual_layer_legacy_deleted_rulesets_canonical_2026_04_29.md (line 18)
**Filed:** 2026-04-29T14:19:28Z
**Outcome class:** FIX (small)

> Minor wording nit: "the only rulesets ruleset" reads like a duplication. Consider rephrasing to "the only ruleset" / "the only rulesets entry" for clarity.

**Resolution path (commit forthcoming on LFG forward-sync):** Adopted the suggested rephrasing — "the only ruleset (id=15524390 "Default"...)".

## Issue-level comments

- **Otto/AceHack 14:17:34Z** — fix-note for Codex P2 thread (commit f6d6a94)
- **Otto/AceHack 14:18:51Z** — close-note explaining double-hop pivot per Aaron's correction

## Outcome class summary

- 5 threads total: 1 RESOLVED-AS-FIXED + 4 UNRESOLVED-CARRIED-FORWARD-AS-FIX
- 0 threads classified STALE-RESOLVED-BY-REALITY / OTTO-279-SURFACE-CLASS / DEFERRED-TO-MAINTAINER / VERBATIM-PRESERVATION-DECLINED
- All threads are operational-correctness / documentation-accuracy class; no policy or attribution disputes

## Lessons for future PRs

1. **Documented commands need to be runnable as-written.** Memory files act as operational reference at cold-start; bad command syntax becomes muscle-memory hazard. (Echoes _patterns.md FIX class.)
2. **Two-step API operations need explicit step recording** — DELETE vs verification GET responses look different; conflating them creates false internal-inconsistency findings.
3. **Cross-namespace reference ambiguity** — repo has PR numbers, backlog `B-####` rows, in-session TaskList #####, hygiene-history shards, all using different conventions. Always disambiguate when referencing a numbered artifact.
4. **"The only X X"** — duplication patterns in attempted-precise prose. The Codex/Copilot review pass catches these reliably; worth a self-pass-before-commit if writing dense technical doc.

## Carry-forward to AceHack #101 + LFG forward-sync PR

All four UNRESOLVED Copilot findings + the one already-RESOLVED Codex finding produced corrections that are now committed to the `post-0-0-0-cleanup-2026-04-29` branch. The branch is on AceHack as #101 (merged 14:19:41Z) and is being repushed to LFG as the forward-sync PR.
