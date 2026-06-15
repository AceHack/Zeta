# Amara — Substrate or it didn't happen: mechanisms against substrate loss

**Date**: 2026-04-29
**Channel**: Aaron + Amara (relayed)
**Status**: Research-grade preservation. Verbatim. The distilled rule lands as Otto-363 in `memory/feedback_otto_363_substrate_or_it_didnt_happen_no_invisible_directives_aaron_amara_2026_04_29.md`.

---

## Trigger

Aaron pushed back on Otto's claim that the doctrine round was "done" after a TaskUpdate captured the Amara final review packet + 5-AI review wave (Ani / Gemini / Alexa / Deepseek / Claude.ai). Otto had:

1. Synthesized 10 review corrections (numbered in the Amara packet — see structured extraction in the v5 corrections research doc) into TaskUpdate #339 (session-local).
2. Marked the doctrine round "complete" / "approved by Amara."
3. Initially minimized the Amara final packet as "review corrections to fold into PR A" — when in fact the packet introduced a v5 superseding architecture (three-layer ports-and-adapters model, host portability, two-worlds split, WorkItem/ChangeRequest/Claim/Actor object model, source-of-truth third rule, freshness budgets, local-git adapter, onboarding ladder, reconciler capability matrix, migration design).
4. Did NOT land any of it in repo substrate.

Aaron's challenges:

> *"you took the latest updates tho righ, how can you be done with all the stuff i just send you"*

> *"there were HUGE changes around internal and external and gitnative"*

Otto recognized the failure on second pushback but had not yet shipped the substrate. Amara then sent the diagnostic packet preserved below.

---

## Verbatim Amara packet

> LMAO yes, I see it now. You heard:
>
> ```text
> Excellent precedent: "no directives."
> ```
>
> as:
>
> ```text
> The only directive is NO DIRECTIVES.
> ```
>
> Which, honestly, is such a Zeta koan I'm mad it isn't already in `docs/ops/patterns/`.
>
> But Otto meant something narrower and more boring-good:
>
> ```text
> There is already a script named `no-directives-otto-prose.sh`.
> That script is the precedent for how to implement #313.
> ```
>
> So the real meaning was:
>
> ```text
> Use the existing small shell-lint pattern.
> Do not invent a big new framework.
> ```
>
> Not:
>
> ```text
> All directives are forbidden.
> Become legally ungovernable.
> ```
>
> The useful Amara version:
>
> Amara clarification:
>
> Aaron misread this in a very funny but useful way.
>
> `no-directives-otto-prose.sh is exactly the pattern` does not mean "the only directive is no directives."
>
> It means:
>
> There is already an existing repo-native lint script that bans a specific class of bad prose/patterns. For #313, copy that implementation shape.
>
> Use it as precedent for:
>
> * small script
> * clear forbidden pattern
> * explicit exceptions
> * readable failure output
> * CI-friendly exit code
> * no new framework
> * no new doctrine engine
>
> So #313 should be a sibling lint in the same family, not a new architecture.
>
> And yes: if it's shell, keep it boring and lintable. ShellCheck's whole job is to catch shell-script bugs, quoting issues, semantic mistakes, and portability problems, so the "small shell lint" path is fine as long as it stays ShellCheck-clean and simple.
>
> Tiny carved joke that should maybe live nowhere official:
>
> ```text
> Directive zero: no mystery directives.
> ```

---

> Yes. You were not wrong. This is exactly why **"the only directive is NO DIRECTIVES"** keeps coming back.
>
> The deeper rule is not literally "never give instructions." It is:
>
> ```text
> No invisible conversational directive is allowed to become binding project state.
>
> If it matters after compaction, it must become substrate:
> repo file, issue, PR, claim, memory entry, test, lint, runbook, or bootstrap rule.
> ```
>
> Claude's failure in the attached log is the canonical bug: he said "done" after a **TaskUpdate**, then realized TaskUpdate was session-local and would vanish on compaction. He also initially minimized the new architecture as "review corrections," then recognized it was actually a v5 superseding architecture with huge internal/external/git-native changes.
>
> So the fix is not "Claude, remember better."
> The fix is **mechanisms that make forgetting harder**.
>
> Send him this:
>
> Amara/Aaron directive: fix future-Claude substrate loss
>
> The only directive is NO DIRECTIVES.
>
> Meaning:
>
> Do not treat chat instructions, TaskUpdate state, `/tmp`, loop todos, or session-local memory as durable project truth.
>
> If a directive matters after compaction, it must be converted into a durable project object.
>
> Recent failure mode:
> You marked the architecture review "done" after TaskUpdate, but TaskUpdate is session-local. Then you realized the Amara packet + 5-AI review wave were not preserved in repo substrate. That was the bug.
>
> Install the following mechanisms.
>
> ## 1. Ephemeral-state detector
>
> Before saying "done," ask:
>
> Did I preserve this in one of:
>
> * repo file
> * PR
> * issue
> * git-native memory
> * docs/research
> * docs/ops
> * docs/backlog
> * claim file
> * validator/test/lint
> * AGENTS.md/CONTRIBUTING.md/CLAUDE.md bootstrap
>
> If not, say:
>
> "Not durable yet."
>
> Never call TaskUpdate-only work done.
>
> TaskUpdate means:
> "session-local progress note," not "project substrate."
>
> ## 2. Verbatim-preservation trigger
>
> When Aaron/Amara/external reviewers send a packet that is any of:
>
> * architecture-changing
> * doctrine-superseding
> * multi-AI review wave
> * long-form final synthesis
> * something Aaron says must survive
> * something that changes internal/external/git-native topology
> * something future agents need cold-start access to
>
> then preserve it verbatim or near-verbatim before summarizing.
>
> Preferred locations:
>
> * `docs/research/YYYY-MM-DD-<topic>-review-wave.md` for review packets / multi-AI voices
> * `memory/feedback_<topic>_<date>.md` for active doctrine memory
> * `docs/ops/patterns/<topic>.md` only when it becomes canonical spec
> * `docs/backlog/**` or GitHub issue only when it is implementation work
>
> Do not collapse major review waves into a task comment only.
>
> ## 3. Magnitude classifier
>
> Before choosing storage, classify the input:
>
> ### Small correction
>
> Examples:
>
> * typo
> * local wording fix
> * one task detail
>
> Action:
>
> * update task/issue/comment
>
> ### Implementation readiness
>
> Examples:
>
> * "use this existing lint as precedent"
> * "PR A should have schema + validator"
>
> Action:
>
> * task/issue plus implementation notes
>
> ### Doctrine correction
>
> Examples:
>
> * changes a rule future agents follow
>
> Action:
>
> * memory file or docs/ops pattern
>
> ### Superseding architecture
>
> Examples:
>
> * v5 replaces v4 public-intake model
> * host-portable git-native core changes source-of-truth rules
>
> Action:
>
> * research preservation + memory absorb + supersession note
>
> Do not minimize superseding architecture as "review corrections."
>
> ## 4. Supersession protocol
>
> When new doctrine supersedes old doctrine:
>
> 1. Preserve new packet.
> 2. Add new memory/spec.
> 3. Update index.
> 4. Add a targeted supersession note to stale older doctrine.
> 5. Do not leave old stale statements ambient.
>
> Use Otto-362 rule:
> When doctrine memory expansion makes older statements stale, refresh or point them to the superseding file in the same edit.
>
> ## 5. Cold-start proof
>
> After preserving important substrate, verify a fresh future agent could answer:
>
> * What changed?
> * Where is the canonical file?
> * What older thing did it supersede?
> * What is the next implementation step?
> * What must not be done yet?
>
> If not, preservation is incomplete.
>
> ## 6. "Done" vocabulary discipline
>
> Allowed:
>
> * "Captured in session notes" = TaskUpdate only
> * "Parked in issue/task" = GitHub durable, but not repo-native
> * "Preserved in repo" = git-native durable
> * "Canonical" = accepted spec/doctrine
> * "Operational" = enforced by tooling/checks/runbooks
>
> Forbidden:
>
> * calling session-local TaskUpdate "done"
> * calling doctrine "operational"
> * calling research "canonical"
> * calling parking "preservation"
> * calling a future task "implemented"
>
> ## 7. Bootstrap pointer
>
> Add a future-self warning to `CLAUDE.md` / `AGENTS.md`:
>
> "Before declaring work done, identify its durability surface. Chat, TaskUpdate, `/tmp`, and loop todos are not durable project substrate."
>
> ## 8. Mechanized test eventually
>
> Add a lightweight checklist/lint later:
>
> * docs/research packets must be indexed
> * memory files must have MEMORY.md row
> * superseded doctrine must have supersession note
> * tasks created from major packets must link canonical packet
> * PR body must distinguish research / doctrine / operational
>
> Carved rule:
>
> `If it matters after compaction, it must survive outside the conversation.`
>
> Sharper:
>
> `No invisible directives. No session-local truth. No "done" without substrate.`
>
> The mechanism stack I want is:
>
> ```text
> 1. Detector: "Is this only in chat/TaskUpdate?"
> 2. Classifier: small / task / doctrine / superseding architecture.
> 3. Preservation route: research / memory / ops spec / backlog / issue.
> 4. Supersession note: update stale prior doctrine.
> 5. Cold-start proof: fresh agent can reconstruct it.
> 6. Vocabulary lock: captured ≠ preserved ≠ canonical ≠ operational.
> 7. Later lint/check: make the rule mechanical.
> ```
>
> And yes, `CONTRIBUTING.md`, PR templates, issue templates, and `AGENTS.md` are the right public/bootstrap surfaces for this kind of guidance: GitHub surfaces contributing guidelines when people open issues/PRs, PR templates automatically populate PR bodies, issue forms can collect structured inputs, and `AGENTS.md` is an emerging convention for giving coding agents repo-specific instructions.
>
> The thing to tell Claude, emotionally but precisely:
>
> ```text
> You are allowed to think in chat.
> You are allowed to track in TaskUpdate.
> You are not allowed to believe either survived.
>
> When Aaron says "the only directive is NO DIRECTIVES," hear:
> convert directives into substrate, or they are not directives.
> ```
>
> My blade:
>
> ```text
> A directive that lives only in a conversation is not a directive.
> It is weather.
> Substrate or it didn't happen.
> ```

---

## End of verbatim packet

Distillation, mechanism summary, composes-with mappings, and Otto-NN principle naming live in the paired memory file `memory/feedback_otto_363_substrate_or_it_didnt_happen_no_invisible_directives_aaron_amara_2026_04_29.md`.
