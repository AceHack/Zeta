# PR #424 drain log — drain follow-up to #405 + #411 + #413 + #415: empty-cone safeguard + GITHUB_TOKEN header + grammar + Otto-279 policy reply

PR: <https://github.com/Lucent-Financial-Group/Zeta/pull/424>
Branch: `drain/405-411-413-415-followup`
Drain session: 2026-04-25 (Otto, sustained-drain-wave during maintainer-
asleep window; pre-summary-checkpoint earlier in this session)
Thread count at drain: 4-parent cascade with mixed real-fix +
surface-class findings.
Rebase context: clean rebase onto `origin/main`; no conflicts.

Per Otto-250 (PR review comments + responses + resolutions are
high-quality training signals): full record of the post-merge
findings spanning four parent PRs simultaneously — record-breaking
multi-parent cascade in this drain wave.

This PR is the **maximum-multi-parent cascade** observed in this
drain wave: a follow-up to FOUR parent PRs simultaneously
(#405 + #411 + #413 + #415), batching the post-merge findings
into a single commit + single merge gate rather than serializing
into four separate cascades.

---

## Threads — by parent

### Parent #405 — empty-cone safeguard

#### Thread 1.1 — fail-YELLOW vs fail-RED on empty-cone

- Severity: P1 (CI safety)
- Finding: parent #405 had a script that on empty-cone (zero
  qualifying commits in the audit window) would fail-RED and
  block the merge gate; safer behavior is fail-YELLOW (warn
  but don't block) since empty-cone is structurally normal in
  certain windows (right after main resync, or during quiet
  periods).
- Outcome: **FIX** — empty-cone behavior changed to fail-YELLOW
  (exit 0 with warning to stderr) rather than fail-RED. CI still
  fires on real findings; doesn't block on empty-cone.

### Parent #411 — GITHUB_TOKEN header doc

#### Thread 2.1 — `Authorization: Bearer` vs `Authorization: token`

- Severity: P2 (docs)
- Finding: parent #411 docs cited `Authorization: Bearer
  $GITHUB_TOKEN` as the canonical header; current `gh` CLI +
  GitHub Actions API examples use `Authorization: token
  $GITHUB_TOKEN` (Bearer is also accepted but `token` is the
  GitHub-canonical example shape).
- Outcome: **FIX** — header doc updated to use `token` form
  matching GitHub-canonical examples; note that Bearer is also
  accepted preserved.

### Parent #413 — grammar

#### Thread 3.1 — downstream grammar

- Severity: P2 (typo / grammar)
- Finding: parent #413 prose had a grammar issue in the merged
  text.
- Outcome: **FIX** — grammar corrected.

### Parent #415 — Otto-279 policy reply

#### Thread 4.1 — name-attribution finding (Otto-279 surface-class)

- Severity: P1 (per repo standing rule)
- Finding: parent #415 had a name-attribution flag on a
  research/history-class surface (Otto-279 carve-out applies).
- Outcome: **OTTO-279 SURFACE-CLASS** — same one-paragraph
  stamp reply as #135 / #219 / #231 / #377. Surface is history-
  class; first-name attribution preserves provenance, not policy.

---

## Pattern observations (Otto-250 training-signal class)

1. **Maximum-multi-parent cascade observed: four parents in one
   follow-up.** #423 had two parents simultaneously; #424 has
   four (#405 + #411 + #413 + #415). The pattern composes: when N
   related parent PRs land in close proximity and post-merge
   findings span N parents, one follow-up PR with N grouped
   sections addresses all of them in one commit + one merge gate.
   Composes-vs-serializes tradeoff favors compose when the
   findings are independent (don't conflict on the same lines)
   and small (don't dominate the merge gate).

2. **fail-YELLOW vs fail-RED is its own CI-safety class.**
   When a CI check has structurally-normal empty-input cases
   (empty cone, zero qualifying findings, no diff to lint),
   fail-RED on empty-input over-blocks the merge gate. Safer
   default is fail-YELLOW (warn-but-don't-block) for
   structurally-normal cases; reserve fail-RED for genuine
   findings. Pre-commit-lint / CI-design candidate: every
   audit script should explicitly classify "empty-input"
   behavior at design time.

3. **GitHub canonical-example divergence from accepted-also
   forms is its own class.** `Authorization: Bearer
   $GITHUB_TOKEN` and `Authorization: token $GITHUB_TOKEN` both
   work, but GitHub-canonical examples use `token`. Docs that
   match the canonical-example form reduce reader friction
   when cross-referencing GitHub docs. Pattern generalizes:
   when API has multiple-accepted forms, prefer the canonical-
   example form in your own docs.

4. **Otto-279 surface-class reply is now stamp-uniform across
   the corpus.** Multi-parent cascades like #424 still benefit
   from the Otto-279 reply's consistency: identical reasoning
   applies to research / decisions / aurora / pr-preservation /
   round-history surfaces; the multi-parent grouping doesn't
   change the per-finding response.

## Final resolution

All threads resolved at SHA `1596a8f`. PR auto-merge SQUASH
armed; CI cleared; merged to main as `478b54f`.

Drained by: Otto, sustained-drain-wave during maintainer-asleep
window 2026-04-25, cron heartbeat `f38fa487` (`* * * * *`).
