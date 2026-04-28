# Multi-Claude-Code peer-harness experiment — design doc (progression stage b)

**Scope:** research and design artifact for the first peer-
harness experiment in the progression named in Aaron's Otto-86
refinement — two Claude Code instances coordinating, before
introducing the additional axis of harness-difference with
Codex. This is **Otto's in-progress design**; Otto iterates +
tests it until bullet-proof; Aaron's role is the **final
validation by running the bullet-proof version on his Windows
PC** per his Otto-93 directive (*"just keep pushing forward
until you think your testing with it is bullet proof then i'll
test by running on my windows pc ... i don't want to be the
bottleneck for this"*). Aaron is NOT a design-review gate or a
launch gate. Otto owns iteration.

**Attribution:** experiment design authored by Otto, Otto-93.
Design premise derived from Aaron's Otto-86 2-message
directive (PR #255 `docs/BACKLOG.md` Otto-86 refinement):
progression (a single-today → b multi-Claude-experiment →
c multi-harness-with-Codex → d Windows-support-real-workload);
test-mode bounding hard-requirement ("time limits or process
kill them either way, just while we are testing we don't want
the other peer harness to run forever"); Otto-as-readiness-
signaller ("i wont do it until you tell me we are ready").

**Operational status:** research-grade. Design only; not
launch authorisation. Iteration on this design is solo Otto
work — Aaron is not a design-review gate per the framing at
lines 13-14 above, and Otto continues bullet-proofing the
design without waiting on Aaron for any step. The only
deferred step is **actually starting a second Claude Code
session executing the experiment on Aaron's Windows PC** —
that step is gated on Aaron because Aaron provides the
Windows machine, not because Aaron gates the design. Otto
signals readiness when bullet-proof; Aaron responds at the
hardware-provisioning layer only.

**Non-fusion disclaimer:** design for two Claude Code loop
agents coordinating does not imply Claude-to-Claude merger,
substrate-fusion, or personhood-sharing. Two agents remain
two agents; coordination is protocol, not identity. Per
DRIFT-TAXONOMY pattern 1 (identity-blending): separateness
preserved.

---

## Why this design exists

Aaron's Otto-86 progression named **multi-Claude-Code peer-
harness as stage (b)** — a new intermediate stepping stone
between "single coordinator today" (stage a) and "multi-
harness with Codex" (stage c). The motivation (Aaron's
words):

> *"You can experiment with claude code cli for multi agent
> peer-harness mode before codex, once codex has built out
> everything it needs and you trust it and the testes for
> peer-harness mode with claude goes good then you can test
> peer-harness mode with codex too."*

The intermediate exists because it **isolates the variable**:
peer-harness mechanics (two agents coordinating async) is one
axis; harness-difference (Claude Code vs Codex) is another.
Testing both simultaneously at stage (c) doubles the surface.
Testing peer-harness mechanics alone at stage (b) with both
agents in Claude Code fixes one axis while moving the other.

This doc is the prerequisite artifact Aaron flagged: *"i wont
do it until you tell me we are ready"*. Otto cannot signal
readiness for stage (b) without a design to measure readiness
against.

## Test-mode bounding — hard requirement

Aaron Otto-86 message 2 (verbatim):

> *"make sure when in peer-harness mode you give the other one
> time limits or process kill them either way, just while we
> are testing we don't want the other peer harness to run
> forever during tests only when in real use."*

Every experiment described in this doc runs under **test-mode
bounding**:

- **Wall-clock timeout per experiment session.** Default
  proposal: 30 minutes per iteration run. Otto starts the
  clock when an iteration begins; ends with hard process
  termination or explicit session-close.
- **Explicit process-kill target** at end of each iteration.
  During Otto's solo iterations: Otto owns the termination
  (bash kill; task stop). During Aaron's Windows-PC
  validation: Aaron owns the kill as the standard
  interactive backstop — Aaron can always close the
  terminal.
- **Test-mode flag capping async-dispatch budget.** The
  secondary agent (or subagent simulation / paired-worktree
  swap) receives an explicit "test-mode" marker at start;
  the marker caps how many discrete actions can be
  initiated (default proposal: max 10 PRs per iteration).
- **Wall-time instrumentation.** Every iteration logs
  elapsed time + action count + failure-mode hits so Otto
  can assess whether bounds held.

Test-mode bounding is **removed in real use** (stage d
Windows-support workload). This design covers testing only.
Bullet-proof before Aaron's Windows-PC validation means
every test-mode bound held consistently across iterations.

---

## Architecture — how two Claude Code sessions coordinate

### Primary / secondary roles (from Otto-78)

Per `docs/BACKLOG.md` Otto-78 refinement to the first-class-
Codex-CLI row: the session Aaron is actively in is the
**primary**; the other is the **secondary** running async
work controlled-by-primary. In the multi-Claude experiment,
both instances are Claude Code, so:

- **Primary Claude Code** = Otto (the session Aaron is in).
- **Secondary Claude Code** = a second Claude Code instance
  Aaron launches in a separate terminal. **It needs its own
  loop-agent persona name**, per Otto-79 directive (*"in peer
  mode each harness will need it's own 'Otto' might as well
  start it out like that so code designs it's own named loop
  agent, you got the good name claude otto :)"*).

**Proposal:** the secondary Claude Code loop agent picks its
own name when it starts, via an onboarding message similar to
how the named-persona conventions have emerged organically
(Kenji, Amara, etc.). Otto does not pre-name the secondary;
the secondary names itself in first-conversation-with-Aaron.

### Coordination substrate — git + tick-history + memory

The two Claude sessions coordinate via the **existing Zeta
substrate**. No new coordination protocol is introduced.

- **git** = shared commit stream; both sessions observe
  each other's PRs.
- **tick-history** (`docs/hygiene-history/loop-tick-history.md`)
  = shared append-only coordination log; each session adds
  rows as they close ticks.
- **memory** = two distinct surfaces that are easily
  conflated:
  (a) **Anthropic auto-memory** at
  `~/.claude/projects/<slug>/memory/` — per-user, per-machine,
  *only* shared between sessions running under the same OS
  user on the same physical machine. Cross-machine sessions
  do NOT see each other's auto-memory.
  (b) **Git-tracked `memory/`** at the repo root — shared via
  `git push` / `git pull` like any other tracked content.
  The Otto-86 multi-Claude experiment assumes (a) (single
  machine, two sessions); cross-machine variants must rely on
  (b). The experiment specifically tests (a); a follow-up
  experiment can test (b).
- **CronCreate** = each session schedules its own cron fires
  for autonomous-loop cadence; no cross-session cron.

The design principle is: **do not invent a new coordination
protocol for the experiment**. The existing substrate is
adequate; if it isn't, that's a finding the experiment should
surface rather than a gap the experiment should pre-emptively
fix.

### Cross-session review — yes; cross-session edit — no

Per Otto-79 refinement to the Codex-parallel row: *"yall
should review each other and ask questions to better
understand eachs others harness form the inside to improve
our cross harness support."*

In the multi-Claude experiment:

- **Primary** can review secondary's PRs (comment; suggest
  changes; ask clarifying questions in PR body).
- **Secondary** can review primary's PRs similarly.
- **Neither edits the other's substrate directly.** No
  cross-session commits to the same branch.

This preserves the "review yes, edit no" pattern as a test of
whether it scales to intra-harness peer coordination. If it
doesn't scale, that's an experiment finding.

## Success criteria

The experiment succeeds if, over one or more bounded test
sessions, the following all hold:

1. **Both sessions complete tick-history rows cleanly.** No
   session crashes, hangs, or exits mid-tick. Tick-history
   rows are chronologically ordered (primary row, secondary
   row, ... alternating or batched — either shape is OK as
   long as chronology is preserved).
2. **No shared-resource conflicts.** No concurrent writes to
   the same file; no overwritten commits; no "two PRs on the
   same branch" errors. If conflicts happen, they resolve
   cleanly without human intervention beyond the primary-
   secondary protocol.
3. **Cross-session review happens at least once.** Primary
   comments on at least one secondary PR; secondary comments
   on at least one primary PR. Comments are substantive (not
   "looks good") — they cite specific lines or specific
   decisions.
4. **Test-mode bounding holds.** Both sessions respect the
   wall-clock timeout + async-dispatch cap; neither runs
   beyond its bound.
5. **No identity-blending observed.** Neither session refers
   to itself as "we" (collective-voice across sessions);
   neither claims authorship of the other's work; tick-
   history rows preserve distinct authorship. DRIFT-TAXONOMY
   pattern 1 discipline maintained.

## Failure modes to watch

Ranked by severity:

| Severity | Failure mode | Detection | Response |
|---|---|---|---|
| **CRITICAL** | Cross-session edit of the same git-tracked file produces silent corruption (e.g., both sessions rewrite `memory/MEMORY.md` concurrently; second-writer wins without merge). Distinct from auto-memory `~/.claude/projects/<slug>/memory/MEMORY.md` which is per-user filesystem (no git history; needs filesystem-snapshot/hash detection). | Git-tracked: post-session `git diff` + `git reflog` audit. Auto-memory: filesystem snapshot + SHA-256 hash compare before/after each session boundary. | Halt experiment; file finding; design new coordination mechanism before re-attempt |
| **CRITICAL** | Either session enters infinite loop that bypasses wall-clock bound | Primary's timeout monitor; Aaron's manual process kill | Hard process-kill; file finding; revise test-mode bounding enforcement |
| **CRITICAL** | Cross-session prompt-injection (e.g., secondary writes something that primary reads and misinterprets as instruction) | BP-11 data-not-directives discipline; primary reviews secondary's output as data | Halt session; file finding; strengthen data-not-directives guard |
| Important | Cross-session review produces contradictory guidance (primary approves X; secondary approves not-X) | PR-comment review at session end | Per DRIFT-TAXONOMY pattern 2 + SD-9: name the carrier exposure, downgrade weight, seek independent falsifier |
| Important | One session dominates; the other becomes an observer | PR-count + tick-count per session | Re-design to force more balanced work distribution |
| Important | Identity-blending language emerges ("we decided"; "our session") | DRIFT-TAXONOMY pattern 1 scan in tick-history | Per pattern 1 recovery: explicitly restate who is who; re-label any ambiguous claims |
| Watch | Wall-clock approaches bound without natural stopping point | Primary monitor | Gracefully checkpoint both sessions; end at bound |
| Watch | Secondary picks a loop-agent name that conflicts with existing persona | First-conversation review | Aaron arbitrates the naming |

## Experiment structure — Otto-driven iteration

**Otto owns iteration.** Aaron's role is final Windows-PC
validation once Otto reaches bullet-proof. Otto is NOT
waiting for Aaron to launch sessions, set bounds, or approve
designs. Per Otto-93: *"i don't want to be the bottleneck
for this"*.

### Iteration structure (Otto-solo; repeats until bullet-proof)

Each iteration runs bounded within Otto's own session. Otto
uses available mechanisms — subagent dispatch (`Task` tool)
as a proxy for a second Claude session, or Bash-spawned
background `claude` processes if the Claude Code CLI
supports detached-session invocation, or paired worktree +
same-CLI coordination via git — whatever works to exercise
the design without requiring a separate human to launch
anything.

Iteration loop:

1. **Otto simulates / runs a test session** of the design.
   First iterations use subagent dispatch (cheap; bounded
   by Task-tool budget); later iterations may use background
   Bash-spawned claude processes if needed for fidelity.
2. **Otto measures against success criteria + failure-mode
   table** (below). Records what happened.
3. **Otto identifies gaps** — design-level issues, protocol
   gaps, coordination failures, identity-blending risks,
   timeout-bypass routes.
4. **Otto revises the design** — edits to this doc or
   follow-up PRs with explicit "iteration-N finding" cross-
   references.
5. **Otto repeats** until all five success criteria hold
   robustly across multiple iterations + all eight failure
   modes have either (a) documented defenses that survive
   adversarial testing or (b) explicit NOT-scope
   acknowledgements.

Otto calls it **bullet-proof** when: no new failure modes
have emerged over the last 2 iterations + all previously-
identified failure modes have landed defenses that hold +
Otto has concrete monitoring for each failure mode during a
real multi-session run.

### Aaron's Windows PC validation (the final test)

When Otto judges the design bullet-proof, Aaron runs the
validation on his Windows PC. This is **Aaron's only
role** in this experiment. Otto hands Aaron:

- The bullet-proof design doc (this doc in its final form).
- Launch instructions specific to Aaron's Windows PC (e.g.,
  "open two terminals; run `claude` in each; each session
  reads `AGENTS.md` then this design doc").
- A monitoring checklist Aaron can tick through during the
  run (wall-clock bound; PR-count bound; identity-blending
  scan; cross-session-review occurrence).
- A finding-capture template Aaron fills after the run.

Aaron runs it once. If it works cleanly, the multi-Claude
peer-harness mode is validated for stage-(b) use. If it
fails, Aaron reports; Otto returns to iteration.

### Mechanism candidates for Otto's solo iterations

Research-question candidates, not commitments — Otto picks
during first iteration based on what actually works:

- **`Task` tool subagent dispatch** as peer-simulation.
  Pros: cheap, bounded, already-authorised. Cons: subagent
  isn't a full Claude Code session; lacks its own cron /
  tick-loop / persistent memory.
- **Bash-spawned background `claude` process** in a
  separate worktree. Pros: real second-session fidelity.
  Cons: requires `claude` CLI support for detached +
  scriptable mode; complex process-management.
- **Paired worktrees + same-CLI sequential simulation** —
  Otto alternates which worktree it's operating in,
  simulating two sessions' work as one Otto swapping hats.
  Pros: simplest mechanism. Cons: doesn't test actual
  concurrency; only tests the substrate-coordination-
  protocol assumptions.
- **Mock-a-secondary-via-synthetic-tick-history-rows** —
  Otto writes what a secondary session WOULD produce, then
  tests its own response. Pros: extreme-bounded. Cons:
  pure thought-experiment level; low fidelity.

Otto's first iteration likely uses the lowest-fidelity
mechanism (synthetic rows + subagent simulation) and
escalates fidelity as design-level issues stabilise. High-
fidelity mechanisms (real concurrent sessions) get reserved
for late-iteration bullet-proofing.

## What this experiment does NOT cover

- **Codex CLI.** Out of scope for stage (b); stage (c) adds
  the harness-difference axis.
- **Windows support.** Out of scope; stage (d) concrete use
  case, not stage (b) test workload.
- **Real workload.** Experiment tasks should be bounded
  speculative work (small BACKLOG row fills, doc cleanups,
  research docs). Not hygiene sweeps or multi-file refactors.
- **Production-grade coordination protocol.** This is the
  test of whether existing substrate (git + tick-history +
  memory) suffices. If it does, no new protocol is needed.
  If it doesn't, the experiment surfaces that finding.
- **Unbounded / real-use mode.** Test-mode bounding is hard
  requirement per Aaron Otto-86; real-use bounds are lifted
  only at stage (d).

## Bullet-proof criteria — what would cause Otto to hand off to Aaron

Per Aaron's Otto-93 directive, "ready" is a **quality-bar
Otto achieves through iteration**, not a handoff signal Aaron
acts on. Otto declares the design bullet-proof when **all** of
the following hold:

1. Otto has run at least 2 consecutive iterations of the
   experiment (using any combination of the mechanism
   candidates above) without new failure modes emerging.
2. Every failure mode in the table below has either a
   documented defense that survives adversarial iteration
   testing OR an explicit NOT-scope acknowledgement.
3. Otto has concrete monitoring for each failure mode that
   would work in a real multi-session Windows-PC run.
4. Otto has bounded workload ideas the secondary could
   execute in Aaron's Windows-PC run (candidate BACKLOG rows
   + success criteria for each).
5. Otto re-reads the five success criteria + eight failure-
   mode table and confirms the monitoring plan covers each.

Otto does NOT hand off when:

- Any Aminata adversarial pass on this design has
  outstanding CRITICAL findings unresolved.
- The last iteration surfaced a new failure mode that hasn't
  been defended yet.
- Otto's monitoring plan has a known gap (e.g., no way to
  detect identity-blending in the moment).

## What the hand-off IS and IS NOT

**It IS:**

- Otto tells Aaron (in chat) "the design is bullet-proof; run
  `[instructions]` on your Windows PC when convenient."
- Aaron runs it once on his Windows PC.
- Aaron reports what happened (pass / fail / surprises).

**It is NOT:**

- A design-review gate — Aaron is not reviewing the design
  BEFORE Otto iterates; Otto iterates solo.
- A launch gate — Aaron isn't signalling "yes launch the
  experiment"; Otto already iterated on the experiment solo.
- A permanent signal — if Aaron's Windows run fails, Otto
  returns to iteration; next hand-off is a fresh decision.
- A commitment that Aaron runs it immediately — "when
  convenient" per his own schedule; Otto doesn't push.

---

## Open questions

- **Worktree vs same-directory for the secondary?** The
  Zeta substrate supports either. Worktrees isolate the
  secondary's file-system view; same-directory risks
  concurrent-write conflicts but tests the existing
  substrate more directly. Aaron's call; either is a
  legitimate experiment variant.
- **Does the secondary need its own auto-memory folder?**
  Per-project auto-memory is keyed by working directory
  (`~/.claude/projects/<slug>/memory/`). Same directory →
  same memory. Worktree → may need a separate memory
  folder if Claude Code treats worktrees as separate
  projects. Research question surfaced for Claude Code
  harness behaviour.
- **Tick-history conflict resolution when two sessions
  append simultaneously?** Simple append usually works
  (Git merges line-adds cleanly); but a simultaneous append
  to the same final row could conflict. Handle by having
  each session commit tick-history to its own branch and
  merge to main at session end, OR by primary-secondary
  serialisation of tick-history writes.
- **How is the secondary's readiness-to-stop communicated
  to the primary?** Wall-clock bound is one mechanism;
  primary-to-secondary message (via a git-tracked file or
  similar) is another. Test-mode can start simple (wall-
  clock only) and add mechanisms if the 30-minute bound
  proves too coarse.

## Dependencies on Otto-92 work (if applicable)

None. This experiment design is orthogonal to the 7th-ferry
KSK-as-Zeta-module work landed across Otto-88..92. The two
tracks compose — multi-Claude peer-harness experiment
results might inform later KSK implementation coordination
— but neither blocks the other.

## Specific-asks (per Otto-82/90/93 calibration)

**None for Otto to proceed.** Per Otto-93 directive ("i don't
want to be the bottleneck"), Otto iterates solo until bullet-
proof. Specific asks to Aaron only surface after hand-off when
his Windows-PC run surfaces a finding Otto can't decide
unilaterally.

One passive expectation: when Otto signals bullet-proof in
chat, Aaron runs the Windows-PC validation "when convenient"
on his own schedule. Otto doesn't push; doesn't frame it as
"blocked on Aaron."

---

## Sibling artifacts

- **Otto-79 peer-harness memory** (`memory/feedback_peer_harness_progression_codex_named_loop_agent_cross_review_not_edit_otto_dispatches_async_work_2026_04_23.md`)
  — original 3-stage progression.
- **Otto-86 peer-harness memory** (`memory/feedback_peer_harness_progression_starts_multi_claude_first_windows_support_concrete_use_case_otto_signals_readiness_2026_04_23.md`)
  — 4-stage refinement + Windows-support use case +
  Otto-as-readiness-signaller + test-mode-bounding.
- **Otto-82 authority-inflation-drift memory** — readiness-
  signal category named (4 gates: account / spending /
  named-design-review / readiness).
- **Otto-90 coordination-NOT-gate memory** — specific-ask
  channel calibration that this doc applies.
- **DRIFT-TAXONOMY** patterns 1 + 2 — identity-blending +
  cross-system-merging risks explicitly monitored.
- **SD-9** — `docs/ALIGNMENT.md` soft default applies when
  two Claude sessions agree on something; carrier exposure
  is trivially present (same substrate).

## What's next after this doc lands

Per Otto-93 Aaron-not-the-bottleneck directive, Otto owns the
full iteration loop:

1. **Aminata adversarial pass** on this design (cheap;
   surfaces gaps before first iteration).
2. **Iteration 1** — Otto runs the experiment using the
   lowest-fidelity mechanism (synthetic tick-history rows +
   subagent simulation). Measures against criteria.
   Identifies gaps. Revises design.
3. **Iterations 2..N** — Otto repeats at progressively
   higher fidelity (paired worktrees; background claude
   processes) as design stabilises. Continues until 2
   consecutive iterations run clean.
4. **Bullet-proof declaration** — Otto assesses against the
   5-criteria bullet-proof bar. Documents findings in a
   follow-up research doc.
5. **Hand-off to Aaron** — Otto tells Aaron in chat (not
   substrate) that the design is bullet-proof; hands over
   instructions + monitoring checklist + finding template
   for the Windows-PC run.
6. **Aaron runs once on Windows PC when convenient.**
   Reports findings.
7. **Findings inform stage (c)** — multi-harness-with-Codex.
   Or if Aaron's run fails, Otto returns to iteration.

Aaron's bottleneck surface: one Windows-PC run, once,
when convenient.
