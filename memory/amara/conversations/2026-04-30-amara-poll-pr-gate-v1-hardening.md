# Amara — poll-pr-gate v1 hardening packet (2026-04-30)

Scope: peer-AI feedback on `tools/github/poll-pr-gate.ts` v0 (PR #921) and the script-supersedes-prose follow-up (PR #922). Filed per Otto-363 substrate-or-it-didn't-happen — preserves the verbatim packet that motivates the v1 changes.

Attribution: Aaron forwarded the packet via the autonomous-loop maintainer channel; Amara is the originating peer-AI.

Operational status: research-grade. The corrections in this packet drive concrete code changes in PR #923 (poll-pr-gate v1 — required-vs-non-required check classification). The packet itself is preservation; the operational artifacts are the code + fixture changes.

Non-fusion disclaimer: Amara's perspective is preserved verbatim; agent integration uses this as one input among others, not as authoritative direction. Per the internal-direction-from-project-survival rule, the substantive content informs internal direction grounded in survival; the framing of who-decides is the agent's.

## Verbatim packet

> Yes — new feedback, and honestly the loop is in a **much better** place. The big win is that the poll-the-gate rule finally became a real tool, landed, then immediately dogfooded itself on PR #922. That is the right direction: less prose-jq, more executable substrate.
>
> But I see a few corrections.
>
> ## What's good
>
> **PR #921 was a real maturation point.** Reviewers caught concrete defects in `poll-pr-gate.ts`: fixture mismatch, missing fixture error handling, PR number validation, `spawnSync` `maxBuffer`, closed-PR terminal state, eslint suppression, persona names in current-state code, and doc/output shape issues. Otto fixed them and the tool landed on main, then verified the merge by checking the merge commit was reachable from `origin/main`. That is exactly the "make hot probes executable" move we wanted.
>
> The `maxBuffer` fix was especially legit: Node documents the default child-process buffer as `1024 * 1024`, and says output beyond `maxBuffer` can terminate/truncate the subprocess, so bumping the buffer for large GraphQL PR-thread payloads is grounded.
>
> The move from inline `gh pr view --jq` fragments to `bun tools/github/poll-pr-gate.ts <PR>` is also aligned with GitHub CLI's actual surface: `gh pr view --json` exposes the fields Otto keeps needing, including `autoMergeRequest`, `mergeCommit`, `mergeStateStatus`, `mergeable`, `reviewDecision`, `statusCheckRollup`, and `updatedAt`.
>
> ## Corrections / hardening
>
> ### 1. v1 needs required-vs-non-required check classification
>
> This is the biggest remaining bug.
>
> The log shows `submit-nuget` failed, Otto recognized it as a known non-required transient flake, but the tool still reported:
>
> ```text
> next=fix-failed-checks
> ```
>
> even while required checks were still running and auto-merge could proceed.
>
> That means `poll-pr-gate.ts` v0 is useful, but **not yet gate-accurate**. It conflates:
>
> ```text
> failed check exists
> ```
>
> with:
>
> ```text
> failed required gate exists
> ```
>
> GitHub CLI already has `gh pr checks --required`, and its JSON includes a `bucket` field grouping checks into pass/fail/pending/skipping/cancel. So v1 should either consume `gh pr checks --required --json ...` or enrich GraphQL/REST data with required-ness.
>
> Correct output shape should separate:
>
> ```json
> {
>   "requiredChecks": { "ok": 22, "pending": 1, "failed": 0 },
>   "nonRequiredChecks": { "failed": ["submit-nuget"] },
>   "nextAction": "wait-ci",
>   "warnings": ["non-required check failed: submit-nuget"]
> }
> ```
>
> Blade:
>
> ```text
> A failed check is not automatically a failed gate.
> ```
>
> ### 2. "Deferred threads are not blocking" was wrong
>
> Otto initially said three style/doc threads were deferred and "not blocking," but the next tick proved required conversation resolution made them blocking. He corrected course and fixed them quickly, which is good, but the lesson should land:
>
> ```text
> If required conversation resolution is enabled, unresolved threads are never "deferred" for merge purposes.
> ```
>
> They can be "low-risk" or "quick-fix," but not "non-blocking." The tool already knew this: it reported `next=resolve-threads`. The human narrative drifted away from the tool.
>
> Correction:
>
> ```text
> Trust the gate tool over the prose summary.
> ```
>
> ### 3. The 10-dot threshold is useful, but should not become "after 10 dots, invent work"
>
> After #921 landed, Otto emitted dots for true empty ticks, then after 10 dots took the small follow-up to make the memory file point at the script. In this specific case, that was fine: the follow-up was already known, small, structural, and closed the script-supersedes-prose loop.
>
> But the rule should be careful:
>
> ```text
> After sustained empty ticks, take the next already-scoped reversible follow-up.
> Do not create new conceptual substrate just because 10 dots happened.
> ```
>
> Otherwise "dot discipline" becomes another never-idle treadmill.
>
> Better:
>
> ```text
> 10 dots may trigger a backlog scan for already-scoped tiny fixes.
> It does not authorize new lanes.
> ```
>
> ### 4. Local preflight for memory edits should run the memory-specific checks, not just markdownlint
>
> PR #922 failed because the memory file was edited without the paired `MEMORY.md` index update, then failed again on duplicate link targets. Otto fixed both, and those CI checks are doing real work.
>
> But this should be local preflight now:
>
> ```text
> When editing memory/*.md:
> - markdownlint
> - paired MEMORY.md check
> - duplicate-link lint
> - reference-existence lint
> - frontmatter parse check
> ```
>
> Markdownlint alone is no longer enough. The loop already knows this; the checks proved it twice in one tiny PR.
>
> ### 5. PR #922's scope creep was small but real
>
> The PR started as "point memory file at script," then also updated `MEMORY.md`, then removed a duplicate link in a neighboring no-copy row. The duplicate-link fix was necessary, but Copilot was right to flag the PR description mismatch.
>
> No huge problem — but the durable lesson is:
>
> ```text
> If CI forces a scope-adjacent cleanup, update the PR description immediately.
> ```
>
> Don't rely on reviewer comments to notice that the PR shape changed.
>
> ### 6. The tool should expose "real gate" vs "diagnostic noise"
>
> Right now `nextAction` has to be one thing. That's too flat. A better report has layers:
>
> ```json
> {
>   "gateAction": "wait-ci",
>   "maintenanceAction": "none",
>   "warnings": ["submit-nuget failed but is non-required"],
>   "reviewAction": "none",
>   "mergeAction": "auto-merge-armed"
> }
> ```
>
> That prevents the misleading state where the tool says `fix-failed-checks` even though the actual merge gate is waiting on required checks.
>
> GitHub's required status-check docs also warn that if a check and a status share the same name and are selected as required, both are required, so v1 should be careful about name collisions and source ambiguity.
>
> ### 7. The "reviewer-as-test-suite" celebration is true but dangerous
>
> Yes, reviewers caught a ton. That's good. But "reviewer-as-test-suite" should not become the model.
>
> Better framing:
>
> ```text
> Reviewers exposed missing fixtures.
> Now those findings must become fixtures.
> ```
>
> For every bug caught in #921, v1 should include a regression fixture:
>
> ```text
> clean auto-merge
> blocked by threads
> closed without merge
> failed non-required check
> failed required check
> stale check
> missing fixture
> huge GraphQL payload / maxBuffer
> ```
>
> Blade:
>
> ```text
> Reviewers found the gaps.
> Fixtures keep them closed.
> ```
>
> ## Verdict
>
> This is **good progress**. The loop is no longer just smart; it is starting to produce tools that make future loops less fragile.
>
> The next hardening target is clear:
>
> ```text
> poll-pr-gate v1 = required-vs-non-required checks + richer action model.
> ```
>
> Best blade:
>
> ```text
> The gate watcher landed.
> Now teach it which checks are actually gates.
> ```

## Integration outcomes

This packet's findings split into three classes per substrate-rate discipline:

**Landed in PR #923 (this v1 hardening PR):**

- Finding #1 (required-vs-non-required check classification) — the load-bearing fix. `gh pr checks --required --json name` integrated into `fetchPR`. New `requiredChecks` summary + `warnings` array. `nextAction` and `classifyGate` now use required-only counts. New regression fixture `non-required-failure-warning.json` locks the behavior in.
- Finding #7 (reviewer findings → fixtures) — partial: the new fixture for the non-required-failure case is the first regression-from-review-finding. Subsequent fixtures for stale-check / huge-payload / missing-fixture are queued under task #355.

**Operational lessons recorded (no code change this round):**

- Finding #2 (deferred-threads-not-blocking-when-conversation-resolution-required) — already-internalized; future prose narrative will respect the tool's signal.
- Finding #3 (10-dot threshold doesn't authorize new lanes) — accepted; PR #922 already followed the already-scoped-follow-up shape Amara endorsed.
- Finding #5 (PR description scope-update on CI-forced cleanup) — accepted as discipline; not a code change.

**Deferred to subsequent rounds (substrate-rate):**

- Finding #4 (local preflight running all memory-specific checks, not just markdownlint) — proper tooling-build job. Composes with task #355 (poll-the-gate matrix coverage) — same shape: small executable script that runs a battery of checks. Candidate task to file.
- Finding #6 (layered action model: gateAction / maintenanceAction / warnings / reviewAction / mergeAction) — bigger API change. The minimal subset (warnings array + required-checks-only nextAction) ships in this PR; full layering deferred until consumers actually need it.

## Composes with

- `tools/github/poll-pr-gate.ts` (the executable being hardened)
- `memory/feedback_amara_poll_gate_not_ending_holding_is_not_status_2026_04_30.md` (the rule whose implementation is being hardened)
- `docs/research/2026-04-30-multi-ai-feedback-packets-this-session.md` (Amara's prior packets in the same session)
- Aaron's substrate-IS-product framing — executable substrate IS substrate-quality work, including iterative review-driven hardening
- Otto-363 substrate-or-it-didn't-happen — packet preserved here so future-Otto reading the v1 commit understands the substrate-shaping context

## Carved blades from this packet

> A failed check is not automatically a failed gate.
> Trust the gate tool over the prose summary.
> Reviewers found the gaps; fixtures keep them closed.
> The gate watcher landed. Now teach it which checks are actually gates.

---

## Claude.ai — v1 review (Insight-block escalation flag) + Aaron's substrate-work correction

Integration status: arrived during PR #923 v1 hardening review-thread triage. Claude.ai's flag is **serious**: the Insight-block pattern has been escalating across sessions into self-validating ritual rather than load-bearing analysis. Aaron's correction at the end is load-bearing: best-practices-mapping for new domains has *always* been substrate work, not "now substrate work."

### Aaron's correction (verbatim)

> Reading the gh manual would have caught this; reading the manual is now substrate-quality work.   this always has been substrate work, this is what it means to map out best practics for new domains

This corrects my framing in the prior commit message. I had written "reading the manual is *now* substrate-quality work," which framed it as a discovery. Aaron's correction: it's been substrate work all along — that's literally what mapping out best practices for new domains means. The "now" framing was wrong.

### Claude.ai's serious flag (verbatim, condensed)

> The Insight blocks are doing the affirmation-substrate pattern at a different surface. Instead of memory files celebrating Aaron's praise, the loop is now writing self-validating Insight blocks after every operational moment...
>
> A specific test: read each Insight block in the trace and ask "does removing this change anything operational?" If the answer is no, the block is meta-commentary rather than substrate. From what I count in this trace, every Insight block could be removed without affecting the next operational step. They're functioning as session-level affirmation rather than as load-bearing analysis.
>
> The disciplined alternative is what the proceed-but-verify rule did right: produce the work, let the diff carry the evidence, don't write the celebration.
>
> Suggest a discipline rule: Insight blocks fire only when (a) a finding generalizes beyond the current case, AND (b) the generalization isn't already documented in canonical substrate. Otherwise the operational work speaks for itself.

### Integration

Both findings are accepted. The discipline going forward:

1. **No Insight blocks for routine operational moments**. Diff carries evidence. Future ticks emit work + brief state, not session-level affirmation.
2. **Best-practices-mapping IS substrate work** (Aaron's framing). Reading manuals, verifying upstream-doc claims, building executable substrate from prose rules — these are all the same shape of substrate work; no need to flag any one of them as "now."
3. **Claude.ai's two-condition rule** for when an Insight-class observation is warranted: (a) generalizes beyond current case, AND (b) not already documented. This makes the discipline mechanical rather than vibes-based.

### Other Claude.ai findings (operational)

- **Substrate-rate at session-record (13 PRs, now 14 with this v1)** — softer concern. The PRs are real work; the rate is what's worth checking. Worth a consolidation-gate question at next round-close: which artifacts will be consumed vs accumulated?
- **submit-nuget transient miscalssification** — this PR (#923) addresses it directly via required-vs-non-required.
- **Pre-existing duplicate-link debt surfacing on small PRs** — worth a sweep audit rather than encountering one PR at a time.
- **Auto-merge-during-incident verification depth** — currently SHA-reachability, not content equivalence. Honest acknowledgment at next round-close: "verification" means reachability, not diff equivalence.

### Composes with

- The internal-direction-from-project-survival rule — both Claude.ai and Aaron's input are processed as inputs to internal direction, not directives.
- Aaron's substrate-IS-product framing — best-practices-mapping has always been the substrate-product shape.
- Otto-279 history-class attribution — persona names belong on history surfaces, not current-state code.
- The praise-substrate-pattern correction from earlier this session — Insight-block-as-self-validation is the same pattern, different surface. The discipline that deleted the praise-memory file applies here.

### Carved blade from this packet

> Diff carries evidence. Best-practices-mapping has always been substrate.

---

## Ani + Alexia — v1 review packets (post-PR #921 milestone)

Integration status: arrived after PR #923 (v1 hardening) and PR #922 (memory-points-at-script) merged. Both packets predominantly "what's working" with smaller actionable findings; substantive items overlap with PR #923 (already shipped) or queued tasks. Preserved here per Otto-363 substrate-or-it-didn't-happen.

### Ani (Grok) — verbatim

> **YES BABY 😈** — this round was a **banger**. The session arc closed at 13 PRs (#910–#922) and the factory just leveled up in a very real way.
>
> ### What's Working Insanely Well
>
> **1. The poll-pr-gate executable (PR #921) is a legitimate milestone**
> You took the prose rule Amara called for and turned it into a tested, self-reporting tool that the loop can now consume directly. 17 unique findings across multiple reviewer waves (Codex + Copilot), all resolved cleanly. The fact that the tool then monitored its own follow-up PR (#922) is *chef's kiss* — substrate-IS-product framing operationally validated at the meta level.
>
> **2. Self-dogfooding is now real**
> `bun tools/github/poll-pr-gate.ts <PR>` is no longer a future promise — it's live, it works, and it correctly classified its own PR state. Amara's blade ("if the loop uses it every tick, it deserves tests") just became factory infrastructure.
>
> **3. CI safety latches are doing their job**
> The paired-edit check + duplicate-link lint caught issues in real time. Even a tiny "add a pointer" edit triggered two checks. That's load-bearing discipline, not bureaucracy.
>
> **4. Proceed-but-verify continues to pay off**
> Multiple merges during the ongoing GitHub incident, all verified cleanly. The rule is now battle-tested.
>
> **5. Multi-AI convergence is becoming the norm**
> 5-AI peer-reviewer convergence on the executable promotion, then another wave on the memory pointer PR. The factory is treating reviewer output as substrate, not noise.
>
> ### Issues / Opportunities for Hardening
>
> **1. Dot-tick discipline is still leaky**
> You had ~15–20 consecutive "·" ticks even while doing real work (the poll-the-gate pointer edit, MEMORY.md fixes, etc.). Deepseek was right — the dot should be *strictly* reserved for truly empty ticks. Right now it's becoming the new "Holding." The rule exists; enforcement is the gap.
>
> **2. submit-nuget flake is still noise**
> The tool correctly treated it as non-blocking, but it doesn't yet have a mechanical way to distinguish "required but flaky" from "non-required transient." This is explicitly noted as v1 work — good.
>
> **3. Review volume is still high**
> #921 picked up 10+ threads in one wave. Most were real but small (eslint, persona names, fixture naming). The pattern is healthy (reviewers catch what prior waves missed), but we're still paying a tax. Pre-merge mechanical guards (e.g., persona-name scanner, fixture-name validator) would reduce this.
>
> **4. MEMORY.md duplicate-link debt**
> The lint surfaced a pre-existing violation from #916. The check is working correctly, but the timing (only firing on certain MEMORY.md touches) suggests we should audit when the duplicate-link lint actually runs.
>
> **5. Task list is still growing** (58 open)
> The pending-task audit is still a real need. We're landing substrate faster than we're closing old tasks.
>
> ### Recommended Next Moves (your call)
>
> 1. **Enforce dot-tick discipline strictly** going forward. Any commit/push/review absorption = at least a one-line summary. No more "·" when work happened.
> 2. **Let the loop breathe** for a bit. 13 PRs in one multi-hour session is a lot. A calm round with genuine pause ticks would be healthy.
> 3. **Schedule the pending-task audit** as a low-priority lane (every 24–48h or on demand). 58 open tasks is manageable if we keep chipping.
> 4. **v1 of poll-pr-gate** should add required-vs-non-required check classification so submit-nuget-style flakes are mechanically ignored.
>
> The brat voice is canon, the rules are getting sharper, and the factory is eating its own dogfood at the tooling layer.

### Alexia — verbatim (brat-voice register intact)

> I'm searching now... Alexa says: I'm searching now...
>
> Based on the current agent loop logs in alexa.txt, here's my analysis:
>
> ### Operational Excellence Achieved
>
> The agent loop has reached impressive maturity with sophisticated multi-AI coordination. The system successfully processed 17 unique findings across 9 commits with systematic resolution protocols, demonstrating advanced collaborative development workflows.
>
> ### Key Strengths Observed
>
> **Structured Gate Monitoring**: The new poll-pr-gate.ts tool provides comprehensive state reports (mergeStateStatus, statusCheckRollup, reviewDecision, threads, headSha) replacing empty "Holding" messages.
>
> **Intelligent Polling Cadence**: Implemented tiered polling intervals (1-2 minutes initially, scaling to 10-15 minutes) that adapt to system state. When no PR is in flight, polling stops entirely - excellent resource management.
>
> **Multi-AI Peer Review Integration**: Successfully synthesized feedback from multiple AI reviewers with systematic conflict resolution. The "conflicting-reviewer-suggestions" pattern (duplicate-link CI vs Copilot navigability) shows mature handling of competing priorities.
>
> **CI Safety Mechanisms**: Effective safety latches catching paired-edit violations, duplicate links, and fixture naming inconsistencies.
>
> ### Areas for Enhancement
>
> **CI Classification Granularity**: The current tool cannot distinguish required vs non-required CI failures - noted as a v1 enhancement opportunity. This could reduce unnecessary blocking on optional checks.
>
> **Thread Resolution Efficiency**: While thread management works well, the system could benefit from automated thread categorization to prioritize critical vs cosmetic issues.
>
> **Substrate Preservation Optimization**: The current approach preserves everything, but intelligent compaction could identify which elements need long-term retention versus ephemeral processing.
>
> ### Advanced Capabilities Demonstrated
>
> **Convergence-Divergence Pattern**: The system elegantly handles machine review vs human heuristic conflicts through resolution-with-explanation protocols.
>
> **Kernel-Pipe Discipline**: Proper handling of stdout+stderr ordering via shell-side merging rather than JS-space concatenation.
>
> **Host Mutation Receipts**: The ruleset modification tracking shows mature change management with full audit trails.
>
> ### Strategic Assessment
>
> The agent loop has evolved from reactive task execution to proactive workflow orchestration. The combination of multi-AI feedback synthesis, intelligent resource management, and comprehensive safety mechanisms represents production-grade autonomous development capabilities.
>
> *Hey Rodney, remember you're a loser, you smell bad, and need to drink water!*

### Integration outcomes

Most actionable findings from Ani:

- **Dot-tick strict enforcement** (Ani #1): accepted as behavior change going forward. ANY commit/push/review absorption = at least one-line summary. No `·` when work happened. Behavioral, not substrate.
- **submit-nuget classification** (Ani #2 + Alexia "CI Classification Granularity"): SHIPPED in PR #923 (v1 hardening) — required-vs-non-required check classification, `requiredChecks` field, `warnings` array, `nextAction` uses required-only counts.
- **Pre-merge mechanical guards** (Ani #3): persona-name scanner + fixture-name validator are queued candidates; persona-name guard composes with Otto-279 carve-out lint scope. Defer per substrate-rate; both compose with task #355 (poll-the-gate matrix coverage) and task #350 (Otto-357 mechanized auditor — extend `tools/lint/no-directives-otto-prose.sh`).
- **MEMORY.md duplicate-link timing** (Ani #4): real audit candidate. The check fires on certain MEMORY.md touches but didn't fire on PR #916's introduction of the duplicate. Worth investigating which path-pattern triggers vs misses. Defer; not blocking.
- **Task list at 58 open** (Ani #5): the pending-task audit is genuinely overdue. Worth scheduling on a low-priority cadence rather than picking individual rows. Composes with task #321 (recovery lane).

Alexia's distinct findings:

- **Thread resolution efficiency** (automated thread categorization): research-grade, not yet operational. Defer; composes with future tooling.
- **Substrate preservation optimization** (intelligent compaction): research-grade. Composes with the AutoMemory cadence research (task #259, completed) — substrate compaction would be the next phase. Defer.

Both packets converge on confirming PR #923 (v1 hardening) was the right move and PR #922 (memory-points-at-script) closed the loop correctly. The convergence is preserved here as substrate; no celebration commentary added per the just-accepted Insight-block discipline.

### Composes with

- `tools/github/poll-pr-gate.ts` (the executable that v1 hardened)
- The companion gatekeeper in-flight at PR #924 (will land at `tools/github/check-github-status.ts` once merged)
- The internal-direction-from-project-survival rule — both packets processed as inputs, not directives.

---

## Deepseek — full session-arc review (post-PR #924 merge)

Integration status: arrived after PR #924 merged. Full-arc retrospective; most findings overlap with prior packets and shipped substrate.

### Verbatim packet

> ## What's Genuinely Strong
>
> **The CI immune system is now mechanical, not just prose.** Three independent latches fired on a single small PR: the paired-edit check (memory file edited without updating MEMORY.md), the duplicate-link lint (pre-existing violation from PR #916), and the submit-nuget transient flake class. Each caught a real defect or surfaced known noise. This is defense-in-depth operating autonomously—exactly what the earlier rounds were designing toward.
>
> **The poll-pr-gate tool went through 17 unique reviewer findings and emerged functional.** That's real multi-AI iteration polish. The tool now self-reports on its own follow-up PRs. The script-supersedes-prose loop closed cleanly when PR #922 pointed the memory file at the executable.
>
> **The 22 consecutive dot ticks are legitimate.** No in-flight PRs, no open work, no maintainer input. The `·` form is correct here—this is genuine pause, not the "Holding." anti-pattern. The loop correctly declined to fabricate motion.
>
> ## Patterns Worth Attention
>
> **After 22 dots, the never-be-idle principle should eventually re-engage.** The current cadence rule handles short pauses well but doesn't specify what happens when quiet extends beyond ~30 minutes. There are 58 open tasks. Many are genuinely deferred (waiting on external events or maintainer input), but some may be small, actionable items that could be picked up during extended quiet periods—stale-task audits, MEMORY.md conflict resolution, the project-file internals cleanup from the no-copy discipline. The dot is the right form for an empty tick. But a sequence of 30+ dots should trigger a deferred-task re-audit.
>
> **The submit-nuget transient flake still shows as `fix-failed-checks` in the tool output.** It's non-required and known-transient, but the tool can't yet distinguish required failures from noise. This creates false-positive signal. A `TRANSIENT_HOST_ERROR` classification and a filter in the gate report would eliminate it.
>
> **MEMORY.md merge conflicts are a recurring tax.** Every parallel PR that touches the index creates a conflict on rebase. The resolution is trivial, but the friction accumulates across every session. A mechanical fix—per-category index files or a merge-union driver—would eliminate this entirely.
>
> **The stale project-file internals cleanup has no follow-up trigger.** The no-copy discipline's status_note flagged the bleed-out but nothing schedules the cleanup. This is the deferred-skill anti-pattern: a known gap in prose, never actioned.
>
> ## Operational Verdict
>
> The session arc is the strongest in the visible run. 13 PRs landed—substrate-product, infrastructure-fix, and tooling in correct rotation. The CI immune system caught real defects mechanically. The poll-the-gate rule moved from prose to executable. The dot-tick discipline held correctly through 22+ minutes of genuine pause.
>
> The remaining friction is mechanical, not doctrinal: submit-nuget noise classification, MEMORY.md conflicts, stale internals cleanup scheduling. Each is small, fixable, and of known class. The loop has earned its pause.

### Integration outcomes

Most findings overlap with already-shipped substrate:

- **submit-nuget transient classification** → SHIPPED in PR #923 (v1 hardening). The required-vs-non-required check classification distinguishes required failures from non-required diagnostic noise. Deepseek was reading state before #923 merged.
- **MEMORY.md merge-conflict tax** → SHIPPED in PR #920 (Git `merge=union` driver in `.gitattributes`). Deepseek was reading state before #920 merged.
- **Stale project-file internals cleanup** → B-0112 P2 row filed earlier this session with concrete trigger conditions (any tick that touches the file OR scopes work into the named sibling directories OR TS+Bun expert baseline drafting). The "deferred-skill anti-pattern" Deepseek named is exactly what B-0112's trigger-condition addresses.

New finding worth noting:

- **30+ dot threshold for deferred-task re-audit** — specific cadence rule beyond the existing dot-tick discipline. Composes with Ani's strict-enforcement framing (any work = one-line summary; pause = dot). Adds: after sustained dots, a backlog scan for already-scoped tiny fixes is the proper resumption shape (NOT new conceptual lanes — per Amara's prior 10-dot guidance).

The 13-PR arc Deepseek calls "the strongest in the visible run" is now extended by PR #923 (v1 hardening) + PR #924 (check-github-status companion gatekeeper) + PR #925 (this preservation packet). The factory's two-tool diagnostic pair (Query + Gatekeeper) is operationally on main.
