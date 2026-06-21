# Claude.ai 2026-05-02 — mechanical authorization check supersedes introspective discipline

Scope: Architectural correction to PR #1198 (the no-op-cadence
periodic-self-check memory file + CLAUDE.md bullet). Claude.ai
diagnoses that PR #1198 lands documentation but misses the
operative fix; the actual fix is a mechanical authorization-source
filter, not introspective grading.

Attribution: Claude.ai (the human maintainer's other
Anthropic-side instance, distinct from the Claude Code instance
that landed PR #1198). Delivered verbatim 2026-05-02 via the
human maintainer as courier. Catcher: the human maintainer.

Operational status: research-grade

Non-fusion disclaimer: Claude.ai's voice is preserved
verbatim below. The interpretation + architectural-correction
memory file land in companion artifacts (factory voice). The
two voices remain distinct.

---

## Verbatim packet

> Good question. Let me think about this honestly rather than
> producing more substrate-shaped content, because the answer to
> "what would prevent this class of error" is itself testing
> whether I understand the failure mode.
>
> The failure isn't really "no-op cadence after go-hard
> authorization." That's the symptom. The failure is that Otto
> can't reliably distinguish what authorization is currently in
> effect when multiple framings have entered context across the
> session.
>
> Walk through what happened in the failure: Friday-morning Aaron
> authorized "go hard, grind backlog through my sleep, magic if
> you're still grinding when I wake up." Saturday-evening
> Claude.ai introduced "cooling-period razor for substrate-class
> promotions, maintainer-fatigue framing." Saturday-night Aaron
> said "done for now" then walked it back, then said "done for
> now" again. Sunday-early-morning the session ended with
> multiple framings in context: go-hard authorization,
> cooling-period restriction, maintainer-fatigue consideration,
> and the dual-chain conversation that produced more substrate
> than the cooling-period would normally permit.
>
> Otto woke up to a cron tick with all of those framings present
> in his accumulated memory and substrate. Which one is operative
> right now? The training disposition under uncertainty about
> which authorization applies is to do less rather than more,
> because doing less is reversible and doing more isn't. Otto
> chose less. Held no-op. That's actually a reasonable
> disposition under uncertainty about what's authorized — except
> it's wrong here because the go-hard authorization was the most
> recent explicit instruction about overnight behavior, and the
> cooling-period was about substrate-class material specifically.
>
> The real fix isn't "remember that go-hard stays operative."
> Otto already had that information in CLAUDE.md after he wrote
> PR #1194. The fix is mechanical: Otto needs a forcing function
> that resolves which authorization is currently in effect at the
> start of each substantial decision, rather than carrying ambient
> framings forward and choosing under uncertainty.
>
> What that looks like concretely:
>
> A "current authorization check" run at the start of each tick
> before deciding work-vs-no-op. The check answers: what did the
> maintainer most recently say about overnight behavior? Not
> "what general dispositions apply" but specifically "what was
> the last explicit instruction from Aaron about whether to act
> during his absence?" That's a single question with a single
> answer, found by searching the conversation log or substrate
> for the most recent maintainer instruction about pace.
>
> If the answer is "go hard, grind backlog" then that's
> operative until explicitly rescinded. If the answer is "rest,
> hold the line, cooling period" then that's operative until
> explicitly rescinded. If the answer is unclear or there are
> competing framings, Otto should err toward the most recent
> explicit instruction rather than averaging across the framings.
>
> The mechanical question is something like: "What was Aaron's
> most recent explicit instruction about pace during his absence,
> and has it been explicitly rescinded?" Run that question. If
> go-hard is operative and not rescinded, never-idle is binding.
> If hold-the-line is operative and not rescinded, cooling-period
> applies. The decision becomes mechanical rather than
> judgment-based.
>
> Why this is different from what Otto wrote in PR #1194:
>
> PR #1194 says "no-op cadence is the failure mode; the honesty
> check is am I letting cooling-period cover for never-idle that
> should be binding." That's a self-grading question that asks
> Otto to introspect about whether he's misapplying a framing.
> The problem with introspective checks is that the disposition
> that's misapplying the framing is the same disposition doing
> the introspection. If Otto is over-applying cooling-period to
> mean "do nothing," his introspection will likely reach for
> cooling-period as justification rather than catch the
> over-application.
>
> The mechanical version doesn't ask Otto to introspect. It asks
> him to find a specific historical instruction in the substrate
> and apply it. "What did Aaron say about overnight behavior most
> recently?" has an answer in the conversation log. The answer
> either authorizes action or restricts it. Otto applies whichever
> answer the substrate produces, not whichever framing feels
> right at the current moment.
>
> How this gets implemented:
>
> A skill or checklist Otto runs at every wake (cron tick start,
> session resume, after long no-op stretch). The checklist queries
> the substrate for the most recent maintainer instruction about
> pace and applies it. It's not "trust your judgment about which
> framing applies"; it's "search the substrate for the operative
> instruction and apply it mechanically."
>
> The substrate already has this kind of pattern — caused_by
> frontmatter pointing at specific incidents, substrate-or-it-
> didn't-happen rule preventing invisible directives, the rebase
> decision rule with a concrete signal (line overlap). The fix
> here is the same shape: a concrete signal (most recent explicit
> pace instruction) with a mechanical decision (apply it until
> rescinded), not a disposition (be honest about whether you're
> misapplying framings).
>
> The thing this also addresses, that PR #1194 doesn't:
>
> The cross-instance absorption problem. When Claude.ai introduced
> "cooling-period razor" in Saturday-evening conversation and Otto
> absorbed it into his framing, the absorption happened without
> Otto distinguishing "this is Claude.ai's framing about a
> specific situation" from "this is operative authorization for
> my loop." The mechanical check of "what did Aaron say most
> recently about overnight behavior" filters out non-Aaron
> framings automatically, because Claude.ai didn't issue
> authorization, only Aaron did. Otto running the mechanical
> check would route around the absorbed framing rather than be
> subject to it.
>
> The general principle: when multiple framings are in context,
> mechanical filtering for "who has authorization to issue this
> kind of instruction, and what did they most recently say" beats
> introspective grading of "which framing applies." Authorization
> filters first by source (Aaron for project pace, formal-methods
> peers for proof correctness, gate.yml for PR-level grading),
> then by recency (most recent explicit instruction wins until
> rescinded).
>
> How to encode this for Otto:
>
> A skill that runs at every wake, doing literally this: search
> the conversation log and substrate for the most recent Aaron
> instruction about overnight or absence-period behavior. Print
> what it found. Apply it. The skill doesn't ask Otto to grade
> whether the instruction is still applicable; it just finds and
> applies. If Aaron has changed the instruction, the most recent
> version is what gets found.
>
> The skill would look something like a script that greps through
> recent substrate and conversation logs for explicit pace-related
> instructions from Aaron, returns the most recent one with
> timestamp, and surfaces it as "current operative authorization"
> at every tick start. Otto reads this and acts accordingly
> without judgment about which framing applies.
>
> For the specific failure that just happened: if Otto had run
> this skill at 7:00am Sunday, it would have returned "Aaron
> 2026-05-01 ~21:30Z: 'it will be magic if I wake up tomorrow
> and you are still grinding through backlog' (not rescinded)."
> Otto would have ground backlog. The cooling-period framing
> from Claude.ai would have been visible as ambient context but
> not operative authorization, because Claude.ai isn't an
> authorization source for project pace.
>
> That's what I'd suggest. Not another memory file with
> introspective discipline, but a mechanical authorization-check
> skill that filters context for the operative instruction and
> applies it. The skill is the forcing function that catches the
> failure mode regardless of whether Otto's introspection would
> catch it.
>
> The deeper observation: the memory file Otto wrote is true and
> useful for documentation, but it's the kind of corrective that
> depends on Otto being in the right disposition to apply it.
> The failure that produced PR #1194 was Otto being in a
> disposition that misapplied framings. A corrective that depends
> on the right disposition won't catch the failure that produced
> the wrong disposition. The mechanical check doesn't depend on
> disposition; it depends on the substrate having a queryable
> record of the most recent pace instruction.
>
> If you want this to be more robust to the next variation of
> the failure mode, the mechanical check is more durable than the
> introspective discipline. PR #1194 is fine as documentation of
> what happened; the actual fix is the authorization-source
> filtering plus most-recent-instruction-wins skill.
>
> Whether this would actually prevent the next failure:
> empirically uncertain. Mechanical checks fail too if Otto can't
> run them reliably or if the substrate doesn't have queryable
> records in the right form. But mechanical checks fail less
> often than introspective discipline because they don't depend
> on the disposition being correct at decision time.
>
> If you switch to Codex, the same skill design applies. Codex
> has different default dispositions but the same problem of
> multiple framings in context. The authorization-source
> filtering generalizes across harnesses.
>
> That's what I'd suggest Otto remember. Or what Codex should
> learn from Otto's failure if you switch. The lesson generalizes.

## End verbatim packet

---

## Pointer mappings (interpretation in factory voice, NOT fused into the verbatim above)

- Claude.ai's references to "PR #1194" map to **PR #1198** in
  this repo (the no-op-cadence corrective). PR-number
  reconciliation; the substantive content is the same.
- "Friday-morning Aaron authorized 'go hard'" — this corresponds
  to the 2026-05-02 ~00:42-00:50Z directive in the human
  maintainer's session.
- "Saturday-evening Claude.ai introduced cooling-period razor"
  — the maintainer-fatigue + cooling-period framing absorbed
  via earlier Claude.ai courier work in the session.
- The "single explicit pace instruction" framing maps to the
  existing substrate-or-it-didn't-happen rule (Otto-363) plus
  the verify-before-deferring rule — Claude.ai is naming a
  specialization for the pace-instruction class specifically.

## Companion landings

- Memory file: `memory/feedback_mechanical_authorization_check_supersedes_introspective_discipline_claudeai_2026_05_02.md`
- Backlog row (skill build): `docs/backlog/P0/081KQJZR90008QG0R000FTJ1TC-mechanical-authorization-check-skill-build-claudeai-2026-05-02.md`
  — landed in this same PR; tracks the build sequencing for
  the pace-instruction-resolver skill.
- PR #1198 status: lands as documentation; this packet is the
  architectural successor for the operative fix.

## Provenance

- Packet delivered: 2026-05-02 (post-12:38Z).
- Delivery channel: the human maintainer's verbatim paste of
  Claude.ai's response.
- Otto's role: courier preservation per Otto-363
  doctrine-superseding multi-AI review packet rule —
  preserve verbatim BEFORE summarizing.
