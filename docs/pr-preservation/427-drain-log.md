# PR #427 drain log — drain follow-up to #133: bash quoting + status-banner truth-update

PR: <https://github.com/Lucent-Financial-Group/Zeta/pull/427>
Branch: `drain/133-followup-bash-quoting-status-banner`
Drain session: 2026-04-25 (Otto, sustained-drain-wave during
maintainer-asleep window; pre-summary-checkpoint earlier in this
session)
Thread count at drain: small follow-up; reviewer findings on the parent
#133 secret-handoff-protocol-options PR cascaded post-merge into this
follow-up.
Rebase context: clean rebase onto `origin/main`; no conflicts.

Per Otto-250 (PR review comments + responses + resolutions are
high-quality training signals): full record of the substantive shell-
portability + factual fixes captured in the parent + this follow-up
drain pair.

This PR is the **post-merge cascade** to #133 (research:
secret-handoff protocol options). The earlier sustained-drain wave
captured the substantive technical fixes; this follow-up cleaned up
two specific Codex P1 findings that surfaced after #133's first-wave
fixes landed.

---

## Threads

### Thread 1 — Bash quoting (SC2086 vs SC2046)

- Reviewer: chatgpt-codex-connector
- Severity: P1
- Finding: prior wording cited shellcheck SC2086 ("unquoted `$var`")
  as the rationale for `export VAR="$(...)"` quoting. The actual
  shellcheck rule for command-substitution-without-quotes is SC2046
  ("Quote this to prevent word splitting"); SC2086 is for unquoted
  variable expansion.
- Outcome: **FIX** — corrected rationale citation from SC2086 to
  SC2046. The fix matters for reproducibility: anyone reading the
  research doc and looking up the rule needs the right ID.

### Thread 2 — Status-banner truth-update

- Reviewer: chatgpt-codex-connector
- Severity: P1
- Finding: research doc had a status-banner that asserted shipping
  state; needed alignment with current actual state (which had moved
  during the review window).
- Outcome: **FIX** — status-banner reworded to match current truth
  rather than the in-flight or aspirational state asserted at
  authoring time.

---

## Pattern observations (Otto-250 training-signal class)

1. **Shellcheck-rule-ID precision is its own class.** SC2046 vs
   SC2086 is a subtle but load-bearing difference: SC2046 covers
   unquoted command substitution `$(...)`; SC2086 covers unquoted
   variable expansion `$var`. The former is what `export
   VAR="$(...)"` rationalizes; the latter is unrelated. Anyone
   reading the doc and looking up the rule needs the correct ID
   for cross-reference verification. Pre-commit-lint candidate:
   regex check on shellcheck SC-NNNN claims against the actual
   rule that applies to the cited code shape.

2. **Status-banner truth-update is the same class as #135's DORA
   canonical-definitions and #231's Wave-4 version-currency
   reclassifications.** Doc claims that were accurate at authoring
   time become stale during the review window; reviewer enforces
   current-truth.

3. **Drain follow-ups for substantive PRs are themselves often
   small + targeted.** #427 was a 2-thread cleanup after #133's
   first-wave drain captured the substantive fixes (macOS Keychain
   `read -rs`, 1Password CLI password-field assignment, revoke-
   immediately-then-rotate, former-vs-latter typo). The follow-up
   pattern: substantive technical content gets first-wave attention;
   small cleanups land as separate follow-ups when they don't gate
   merge.

## Final resolution

All threads resolved; PR auto-merge SQUASH armed; CI cleared; PR
merged to main as `3425943`.

Drained by: Otto, sustained-drain-wave during maintainer-asleep
window 2026-04-25, cron heartbeat `f38fa487` (`* * * * *`).
