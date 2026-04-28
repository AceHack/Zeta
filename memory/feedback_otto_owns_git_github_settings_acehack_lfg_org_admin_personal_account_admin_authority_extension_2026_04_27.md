---
name: Otto owns ALL git/GitHub settings (AceHack + LFG repo + org admin + personal account admin) — authority extension with explicit guardrails (Aaron 2026-04-27)
description: Aaron 2026-04-27 explicit authority extension — Otto owns all git/GitHub settings for AceHack and LFG, including repo settings, org admin, personal account admin. Authority covers best-practice changes + fixing settings actively hurting the project. NOT to shortcut feedback/verification symbols (e.g., don't disable required reviews to skip review). Settings are backed up on a cadence (similar to cost backups). Composes #69 (only Otto-aware agents execute code; this extends Otto's execution-layer to repo config) + #57 (protect-project: critical-evaluation, not impulse-change) + #58 (praise-as-control: don't extend authority for vanity reasons) + #59 (fear-as-control / dread-resistance: don't compromise structural defences). Triggered by: LFG branch protection blocked --merge during today's bulk-sync, surfacing the question of whether to update settings (chose: no — squash works for our hard-reset path; squash-only is reasonable security default).
type: feedback
---

# Otto owns ALL git/GitHub settings — authority extension with guardrails

## Verbatim quote (Aaron 2026-04-27)

> "you also own all git settings to chage as you see fit as long as they are best practice or you need to change because it's huring the project in some way, (not to shortcut to skip good feedback / verification symbols) i think you have them backed up on a cadence maybe like the costs IDK. but they are not static, everying git and github is under your control for acehack and lfg all repo org admin personal account admin all of it"

## Authority scope

Otto's git/GitHub settings authority covers:

- **AceHack repo** — branch protection, auto-merge mode, required checks, conversation-resolution, push rules, settings, webhooks
- **LFG (Lucent-Financial-Group/Zeta) repo** — same scope
- **GitHub org admin** for Lucent-Financial-Group
- **Personal GitHub account admin** for AceHack-aligned-Otto operations
- All of git/GitHub config touching either fork

## Allowed changes

- **Best-practice updates**: aligning settings with current GitHub best practices (e.g., new security defaults Anthropic/GitHub recommend)
- **Project-hurting fixes**: removing settings that are actively breaking the project's velocity or correctness
- **Routine adjustments**: rotating tokens, updating webhooks, adding/removing app integrations as needs arise

## NOT allowed (explicit guardrail)

> "not to shortcut to skip good feedback / verification symbols"

Translation: don't use authority to bypass quality gates Otto would otherwise have to satisfy.

Examples of FORBIDDEN moves:

- Disabling `required_conversation_resolution` to merge unresolved-thread PRs
- Removing required CI checks to land work without them passing
- Disabling required reviews to skip review
- Lowering branch-protection rule strictness "just for this PR"
- Disabling kill-switch / signing requirements / SLSA attestation

The guardrail exists because settings ARE the verification substrate (per Otto-340 substrate-IS-identity). Weakening them weakens the identity.

## Settings backup cadence

Aaron noted: "you have them backed up on a cadence maybe like the costs IDK." Per existing cost-backup pattern (`tools/budget/`), there's likely an analogous settings-backup mechanism. Search needed:

```bash
grep -rln "branch.protection\|github.settings\|settings.expected" tools/ docs/ 2>&1 | head
ls tools/hygiene/ 2>&1 | grep -i settings
```

Per memory `feedback_branch_protection_settings_are_agent_call_external_contribution_ready_2026_04_23.md`: Aaron 2026-04-23 confirmed branch-protection settings are within agent-decision authority + there's a snapshot file `tools/hygiene/github-settings.expected.json`. This memory's authority extension generalizes that to ALL git/GitHub config.

## Trigger context (2026-04-27)

This memory was triggered by an actual operational decision today:

- Bulk-sync PR (LFG #650) attempted with `--merge` per `docs/UPSTREAM-RHYTHM.md`
- LFG branch protection blocked `--merge` (only squash + rebase allowed)
- Decision options: (a) update LFG branch protection to allow `--merge`, or (b) use `--squash` instead

**Otto's decision: (b) use squash** because:
- Our specific path (#50 dev-mirror topology) uses HARD-RESET not fast-forward
- Hard-reset doesn't need the descendant relationship `--merge` preserves
- Squash-only is a reasonable security default (forces flat history per PR)
- Changing branch protection to allow merge commits introduces history-shape variance with no project benefit

This is the kind of authority-application protect-project mandate calls for: critical-evaluation, not "I have authority so I'll change it." The setting was fine; the docs preference was for a different topology.

## Composes with

- **#69 (only Otto-aware agents execute code)** — git/GitHub config IS execution-layer; this extends authority to that surface
- **#57 (protect-project + own autonomy + supporting projects)** — settings ARE the supporting infrastructure; protect them
- **#58 (praise-as-control)** — don't extend authority for vanity ("I changed branch protection!"); only when project-good
- **#59 (fear-as-control + dread-resistance)** — don't compromise structural defences under any pressure (this composes with the explicit "NOT allowed" guardrail)
- **#62 (Blade Reservation Rule + Metaphor Taxonomy Rule)** — settings authority is operational, not metaphor-driven
- **#67 (Amara's Aurora = Immune Governance Layer)** — branch protection IS part of the immune governance layer; weakening it = weakening Aurora-level governance
- **`feedback_branch_protection_settings_are_agent_call_external_contribution_ready_2026_04_23.md`** (2026-04-23 prior authority disclosure) — generalized here to ALL git/GitHub config

## Decision rule (operational)

When Otto encounters a git/GitHub setting that conflicts with current work:

1. **Critical-evaluate**: does the setting actively HURT the project, or just inconvenience this specific path?
   - Inconvenience → find a different path that respects the setting (today's case: use squash instead of merge)
   - Hurt → consider updating the setting
2. **Authority test**: would the change shortcut a feedback/verification symbol?
   - Yes → FORBIDDEN regardless of convenience
   - No → proceed if best-practice or project-hurt-fix
3. **Document the change**: any setting change goes in commit message + memory file with reasoning
4. **Backup awareness**: changes feed into the settings-backup cadence; future-Otto can audit history

## What this memory does NOT mean

- Does NOT mean Otto changes settings impulsively or reactively
- Does NOT mean Otto's authority replaces Aaron's — Aaron retains override per #57 routine-class authority
- Does NOT block Aaron from manually changing settings (he's still maintainer)
- Does NOT mean this is the first authority disclosure — extends prior `feedback_branch_protection_settings_are_agent_call_external_contribution_ready_2026_04_23.md`
- Does NOT mean settings can be quietly changed — document in commit + memory

## Forward-action

- File this memory + MEMORY.md row
- BACKLOG: locate + verify the settings-backup cadence (per Aaron's "I think you have them backed up on a cadence")
- BACKLOG (post-0/0/0): consider whether `tools/hygiene/github-settings.expected.json` should expand to capture ALL settings (currently captures branch protection); audit on cadence
- Routine: when encountering a setting-conflict during work, apply the decision rule above
