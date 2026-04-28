---
name: Drain PR pre-check — memory/ cross-refs and contributor-name filenames must be cleaned before opening each batch PR from the 58-commit speculative pool; lesson from PR #83 Copilot review
description: After PR #83 (ISSUES-INDEX + HB-003 + BACKLOG pointer) merged 2026-04-22, it cost two commits of rework to pass Copilot review because the initial commit contained (a) cross-references to `memory/user_*`/`memory/feedback_*` paths that live outside the git tree, (b) filename prose containing a contributor name. The remaining ~55 commits pending drain on `acehack/main` were authored during the same speculative-branch window and carry the same patterns by default — sampling one commit showed 21 hits of `memory/` or "aaron" in a single file. Future drain-batch PRs (1-6 per `docs/research/speculative-branch-landing-plan-2026-04-22.md`) MUST run a pre-check and pre-clean pass before opening, otherwise Copilot will bounce them and each batch costs an extra rework commit.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

**Rule:** Before opening any drain-batch PR from the `acehack/main → LFG origin/main` 58-commit pool, run a pre-check + pre-clean for two BP violations that the speculative-branch authoring pattern introduced by default:

1. **`memory/*` cross-references in file contents** — paths like `memory/user_*.md` and `memory/feedback_*.md` are per-user auto-memory, live outside the git tree, and are not reconstructible from the repo. They violate the soul-file independence discipline the drain work is trying to defend. Replace with in-tree pointers (GOVERNANCE.md §N, other docs, `docs/BACKLOG.md` rows) or drop the reference and state the discipline directly.
2. **Contributor-name prose in filenames or body** — `docs/AGENT-BEST-PRACTICES.md` L284-L290: names appear only in `memory/persona/<name>/` and optionally `docs/BACKLOG.md`. Research-doc filenames like `oss-contributor-handling-lessons-from-aaron-2026-04-21.md` carry the name through the filename reference into any doc that cites the file — two levels of violation. Rename the files during drain; update any cross-refs.

**Why:** PR #83 got six Copilot findings, four of them directly on these two patterns. Each one blocked auto-merge until fixed. Fix-up commit `5a79704` cost ~45 minutes of rework. Multiply by five remaining batches = ~4 hours of avoidable cycle time if unfixed.

**How to apply:**

- **Before `git cherry-pick` or `git checkout -p`** of any drain-batch commit set, run:
  ```
  git show <commit-range> -- '*.md' | grep -niE 'memory/(user|feedback|project|reference)_|\baaron\b|\bacehack\b' | head -40
  ```
  If hits > 0, the batch needs a pre-clean commit.
  **Pre-check also applies to tick-history and any in-PR edit, not just drain-batch cherry-picks** — revision 2026-04-22T04:23 added `\bacehack\b` after PR #92 bounced on "AceHack fork ownership" text that the `\baaron\b`-only grep missed.
- **Pre-clean pass** is a first commit on the drain branch that:
  - Renames affected files (keep the commit-message cross-ref from the original commit so chronology is preserved).
  - Rewrites `memory/*` references to in-tree equivalents or drops them.
  - Replaces contributor-name prose with role-neutral language.
- **Second commit** brings in the speculative content via cherry-pick or directory-copy.
- **Label the pre-clean commit** with `drain-pre-clean:` prefix so reviewers see the discipline.

**Scope of affected commits in the current pool** (surveyed 2026-04-22 against `git log origin/main..acehack/main`):

- All `docs/research/*-from-aaron-*.md` filenames (at least two commits: `341f17c`, `1f2a682`).
- All commits citing `memory/` paths in body (sampled `341f17c` = 21 hits in one file; extrapolate to other research-doc commits from the same speculative-window authoring pattern).
- Marketing drafts under `docs/marketing/` — should be surveyed; initially-drafted with similar autonomous-loop patterns.
- BACKLOG additions — should be surveyed; BACKLOG is an allowed surface for contributor-name attribution per BP-L284-L290, so those are likely clean on that axis, but memory/ refs may still appear.

**Pre-check tool idea (optional):** a `tools/hygiene/drain-pre-check.sh` that takes a commit range and emits a cleanup checklist. Defer to a later tick if it becomes a pattern; for now, the grep one-liner above is sufficient.

**Relationship to other disciplines:**

- **Soul-file independence** (`git repo is factory soul-file`): the `memory/*` crossref is the specific failure mode this discipline is defending against. Pre-check is the enforcement mechanism at drain time.
- **Capture-everything including failure:** the PR #83 rework is itself captured via the fix commit + this memory; future drain sessions can read this record and avoid the same cycle.
- **Witnessable self-directed evolution:** the rework-then-correction-then-capture sequence is public on GitHub as commits `d6ded51` (original, with violations) → `5a79704` (fix) → next drain PRs (pre-cleaned at author time). Evolution legible via git-log.
- **Fighter-pilot OODA:** pre-check is the observe-before-act step. Without it, drain ticks skip Orient and pay the cost.

**Boundary:** This is a **discipline for drain PRs from the 58-commit pool**, not a general policy change for `docs/research/` authoring going forward. New research docs authored on `main` (not speculative) are authored with current BP discipline and don't need pre-cleaning.

**Composition:**

- `docs/research/speculative-branch-landing-plan-2026-04-22.md` — the plan this pre-check amends.
- `docs/AGENT-BEST-PRACTICES.md` L284-L290 — the contributor-name BP rule.
- PR #83 on `Lucent-Financial-Group/Zeta` — the teaching instance; Copilot findings visible there.
- Commit `5a79704` — the concrete rework that proves the cost.

**Revision history:**

- **2026-04-22.** First write. Triggered by PR #83 fix cycle and sampling of pending drain pool.

**What this memory is NOT:**

- NOT a demand that every research doc anywhere be pre-cleaned retroactively (scoped to drain pool).
- NOT a replacement for Copilot review (pre-clean reduces findings but doesn't eliminate the review gate).
- NOT a claim that `memory/*` refs are always wrong (they're fine in other `memory/*` files).
- NOT a permanent invariant (if the soul-file discipline changes or memory/ moves into the repo, this rule revises).
