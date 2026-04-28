# PR #435 drain log — drain follow-up to #148: cadenced live-lock + grammar

PR: <https://github.com/Lucent-Financial-Group/Zeta/pull/435>
Branch: `drain/148-followup-cadenced-livelock-and-grammar`
Drain session: 2026-04-25 (Otto, post-summary continuation autonomous-loop)
Total threads drained: 3 across 2 waves (2 + 1 cascade)
Rebase context: clean rebase onto `origin/main`; no conflicts.

Per Otto-250 (PR review comments + responses + resolutions are
high-quality training signals): full per-thread record with reviewer
authorship, severity, outcome class.

This PR was a drain follow-up to #148 (`docs/plans/why-the-factory-
is-different.md`) catching reviewer findings on the live-lock-smell
audit cadence claim and a heading grammar issue. The wave-2 cascade
caught a deeper issue: the doc was implying a multi-BACKLOG-item
state when only one BACKLOG row exists for live-lock cadence work.

---

## Wave 1 (initial drain — 2 threads)

### Thread 1.1 — `:111` — Cadence row in FACTORY-HYGIENE.md doesn't exist (Codex P2)

- Reviewer: chatgpt-codex-connector
- Thread ID: `PRRT_kwDOSF9kNM59kGrg`
- Severity: P2
- Finding: text said operators can run the live-lock audit "on the
  cadence row in `docs/FACTORY-HYGIENE.md`" but that file has no row
  for `tools/audit/live-lock-audit.sh`; `docs/BACKLOG.md` still
  tracks round-close wiring as unfinished.
- Outcome: **FIX (option b — reword to current-truth)** — reworded
  to factually describe current state: "audit is currently run on
  demand by operators. Promoting it to a cadenced row in
  `docs/FACTORY-HYGIENE.md` and wiring per-commit CI / hook
  integration are separate BACKLOG items." Adopted reword option
  over option a (adding the hygiene row) because the audit's
  per-commit wiring is the substantive blocker the BACKLOG tracks;
  the doc shouldn't claim cadence already shipped. Commit `2615fb4`.

### Thread 1.2 — `:112` — Same finding (Copilot P1)

- Reviewer: copilot-pull-request-reviewer
- Thread ID: `PRRT_kwDOSF9kNM59kG0t`
- Severity: P1
- Outcome: **FIX (combined with 1.1)** — same fix as Thread 1.1;
  one rephrase resolved both findings. Cross-reviewer convergence
  (Codex P2 + Copilot P1) raised confidence the issue was real.

## Wave 2 (post-#1 cascade — 1 thread)

### Thread 2.1 — `:113` — Implied multiple BACKLOG items vs actual single row (Codex P2)

- Reviewer: chatgpt-codex-connector
- Thread ID: `PRRT_kwDOSF9kNM59kKLD`
- Severity: P2
- Finding: my prior reword said "Promoting it to a cadenced row ...
  AND wiring per-commit CI / hook integration are separate BACKLOG
  items" (plural). But the only live-lock backlog entry is
  `docs/BACKLOG.md` Live-lock-smell cadence row (currently around L1452 in the P1 tooling section; line numbers drift, so the stable identifier is the heading 'Live-lock smell cadence (round 44 auto-loop-46 absorb, landed as `tools/audit/live-lock-audit.sh` + hygiene-history log)'), which tracks a single row with
  follow-ups around round-close wiring, threshold tuning, and
  PR-in-flight class. One row, multiple sub-items — not "separate
  BACKLOG items."
- Outcome: **FIX** — reworded to point at the actual single
  existing BACKLOG row (`docs/BACKLOG.md` Live-lock-smell cadence
  heading; was L1313-1328 at drain time, has since drifted to ~L1452
  per the stable-identifier-vs-line-number-xref pattern) and name
  its
  existing sub-items: round-close cadence wiring, threshold tuning,
  PR-in-flight class. Promoting to a cadenced
  `docs/FACTORY-HYGIENE.md` row composes with that same row rather
  than implying a separate BACKLOG entry. Doc is now verifiable
  against current BACKLOG state. Commit `6171ec0`.

---

## Pattern observations (Otto-250 training-signal class)

1. **Cross-reviewer convergence on Wave 1 raised quality signal.**
   Threads 1.1 (Codex P2) + 1.2 (Copilot P1) flagged the same
   missing-FACTORY-HYGIENE-row issue. Same shape as #432's
   `warn` unbound (Codex P1 + Copilot P0). When two unrelated
   reviewers converge with high confidence, the prior on "real
   bug" goes way up.

2. **My-fix-on-wave-1-introduced-the-wave-2-finding.** This is a
   clean instance of a self-induced cascade: my reword (Wave 1)
   said "separate BACKLOG items" (implying plural), Codex (Wave 2)
   caught that the actual BACKLOG state has one row with multiple
   sub-items. Pattern: when fixing a claim, verify the new claim
   is also accurate — don't just remove the bad claim, replace it
   with a verified-against-current-state claim.

3. **"Reword option (a) vs (b)" decision template.** Wave 1's
   reviewer suggestion offered two options: (a) add the hygiene
   row (mechanism-first), (b) reword to current truth (description-
   first). Option (b) was correct here because the substantive
   blocker (per-commit wiring) is the tracked BACKLOG work; the
   doc should match work-in-progress reality rather than claiming
   shipped state. The (a)-vs-(b) framing generalizes: when a doc
   asserts X but X doesn't exist, prefer reword-to-current-truth
   over add-the-thing-asserted unless the thing is small + isolated.

4. **PR-mechanics observation: 4 of the 7 PRs drained at u=0+
   reviewer-cascade in this session went through this same wave-1
   + wave-2 pattern.** #135, #231, #432, #435 all had post-merge
   cascade waves catching what wave-1 fixes exposed or what new
   reviewer-state revealed. The reviewer-cascade is a consistent
   property of the merge-trigger surface, not a per-PR oddity.

## Final resolution

All 3 threads resolved across 2 waves (`2615fb4` + `6171ec0`).
PR auto-merge SQUASH armed; CI cleared; PR merged to main as
`a5e3eff`.

Drained by: Otto, post-summary autonomous-loop continuation, cron
heartbeat `f38fa487` (`* * * * *`).
