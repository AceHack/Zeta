# Decision-archaeology worked example #1 — the double-hop abandonment 2026-05-02

> Scope: worked example for the proposed `decision-archaeology` skill (081KQJZR90008QG0R002D6XYHB).
> Attribution: Otto autonomous (the `architect` hat) authored from on-repo
> evidence; the human maintainer is the original decision-maker whose
> framing is preserved verbatim in the cited memos.
> Operational status: research-grade — input to skill-creator's eventual
> SKILL.md authoring per Aarav's hybrid (b)+(c) routing recommendation
> on 081KQJZR90008QG0R002D6XYHB. Not normative discipline; demonstrative.
> Non-fusion disclaimer: the procedure walked here is generic
> decision-archaeology; the substrate paths cited (`memory/`, `docs/`,
> `memory/CURRENT-aaron.md`) are Zeta-specific illustrations of the generic
> procedure, not part of the skill's portable surface.

## The question

> *"Why was the double-hop workflow (AceHack-first → forward-sync to
> LFG → AceHack absorbs squash-SHA) abandoned 2026-05-02?"*

This is a **supersession-archaeology** question (one of the five sub-modes
Aarav recommended for the `decision-archaeology` skill body). A discipline
that was canonical at one point is no longer canonical; the question asks
both *what replaced it* and *why the replacement was preferred*. Walking
the layered evidence reconstructs both.

## Why this is a good worked example

Three properties make this a near-ideal exemplar for the skill body:

1. **Recent.** The supersession landed 2026-05-02 — the substrate is
   still warm and every layer of evidence is still legible.
2. **Contested.** The double-hop was non-trivial: it was researched,
   adopted, modified, paused, and abandoned across five commits and
   three named memos over six days. It's not a trivial typo-fix
   archaeology pass.
3. **Multi-layer.** Five distinct evidence layers compose into the
   answer (CURRENT-*.md SUPERSEDE marker → CLAUDE.md fix-up → commit
   messages → memo files → backlog row). A worked example that only
   touches two layers wouldn't demonstrate the skill's value.

## The procedure walked, layer by layer

### Layer 1 — Frame the question

The bare *"why was the double-hop abandoned?"* compresses two distinct
sub-questions:

- **What is the new state?** (LFG-only direct PRs; AceHack as backup
  mirror; no AceHack-first risk-absorption.)
- **Why was the new state preferred over the old?** (Cost vs. benefit of
  the double-hop's risk-absorption mechanism.)

Both need answers; the procedure recovers both.

### Layer 2 — Surface layer: `git blame -w -C -C -C` on the canonical surface

The canonical statement of current state is `memory/CURRENT-aaron.md` §4
(the per-maintainer distillation of currently-in-force rules).

```bash
git blame -w -C -C -C -L 229,243 memory/CURRENT-aaron.md
```

Returns the blame for the SUPERSEDE marker block:

```
7a0b755 (Aaron Stainback 2026-05-02 ...) - **~~AceHack can be super-risky (fork semantics absorb
7a0b755 (Aaron Stainback 2026-05-02 ...)   the blast). Experiments land in AceHack first; clean
7a0b755 (Aaron Stainback 2026-05-02 ...)   versions propagate to LFG.~~ SUPERSEDED 2026-05-02:**
7a0b755 (Aaron Stainback 2026-05-02 ...)   Aaron 2026-05-02 — *"we abandoned the double hop it
7a0b755 (Aaron Stainback 2026-05-02 ...)   was too much trouble."*
```

**Layer-2 output:** the supersession was committed in `7a0b755` on 2026-05-02
with the human maintainer's verbatim framing — *"we abandoned the double hop
it was too much trouble."* That's the why-in-one-sentence; the rest of the
archaeology unpacks **what was the cost it was too much of** and **what the
old state was specifically.**

### Layer 3 — Commit context: `git show 7a0b755`

```bash
git show --stat 7a0b755
```

Returns:

```
align(party-during-sleep): the human maintainer + Claude.ai 2026-05-02 —
  agent operates as PARTY (not delegate) during human sleep cycle;
  addresses last-night's no-op-cadence failure at structural level
```

**Surprising signal.** The commit message names the *party-during-sleep*
work as the primary subject, not the double-hop abandonment. The SUPERSEDE
marker landed alongside a different rule-change. This matters for two
reasons:

1. **Ride-along supersessions are common in this factory.** A commit's
   subject doesn't always name every supersession it carries. The
   `git log -S "double hop"` query (Layer 4) is what surfaces the
   ride-along.
2. **The *trigger* for the abandonment isn't visible at this layer.** What
   conversation produced the framing? That lives at Layer 8 (memos) or
   Layer 10 (conversation archives).

### Layer 4 — String archaeology: `git log -S "double hop"`

```bash
git log --oneline -S "double hop" -- memory/ CLAUDE.md
```

Returns (filtered + ordered):

| Commit | Date | Subject | Operation |
|---|---|---|---|
| `ae4f6b6` | 2026-04-27 | sync: forward-port AceHack #49 substrate cluster — 0-diff-is-start + LFG-as-master strategic reframe | Establishment context |
| `cabaabe` | 2026-04-28 | sync: AceHack→LFG bulk content forward-port + CI cadence split + Windows trajectory seed | Active-double-hop period |
| `5294bf4` | 2026-04-30 | doctrine(acehack-mirror): force-with-lease + remote-topology cleanup + multi-remote-script-design | Path-2 mechanism design |
| `f5e2873` | 2026-04-30 | backlog(081KQDTYV0008QG0R001Y2E9TD,P1): AceHack mirror-refresh protocol drift — three sources contradict | Path-2 backlog row landing |
| `262f18b` | 2026-05-02 | memory(superfluid-cluster): Aaron 2026-05-02 — 7 wake-time substrate rules + Karpathy edge-runner anchor | First mention of abandonment in substrate |
| `7a0b755` | 2026-05-02 | align(party-during-sleep): ... | SUPERSEDE marker landed |
| `f0ef9a8` | 2026-05-02 | fix(supersession-drift): CLAUDE.md double-hop framing 'paused' → 'abandoned 2026-05-02' to match CURRENT-aaron.md §4 SUPERSEDE marker | Cleanup of stale CLAUDE.md framing |

**Layer-4 output:** seven commits over six days span the lifecycle —
establishment (04-27) → active period (04-28 to 04-30) → Path-2
mechanism + backlog row (04-30) → first abandonment mention (05-02
morning) → SUPERSEDE marker commit (05-02) → drift-cleanup commit
(05-02). The two same-day commits on 05-02 (`262f18b` mentions, `7a0b755`
canonicalizes, `f0ef9a8` fixes drift) tell us the abandonment happened
quickly — not a long slow shift.

### Layer 5 — Function archaeology

Not applicable. The double-hop wasn't a function; it was a workflow
discipline encoded in memos + CLAUDE.md framing + branch-protection rules.
This layer no-ops for procedure-class supersessions; it's mostly relevant
for code-class archaeology.

### Layer 6 — Round-history shards

Looking under `docs/hygiene-history/ticks/2026/04/27` through
`docs/hygiene-history/ticks/2026/05/02` for shards that reference the
double-hop:

```bash
grep -rlnE "double.hop|abandon.*double|LFG-only" docs/hygiene-history/ticks/
```

(Note: BSD/macOS `grep` treats `\|` differently than GNU `grep`; use
`grep -E` with `|` alternation for portability across both.)

Returns shards that bracket the lifecycle — multiple 04-27 through 04-29
shards reference the establishment + active period, and several 05-02
shards (`0112Z.md`, `1456Z.md`, `1520Z.md`, `1522Z.md`, `1523Z.md`)
reference the abandonment in the context of the morning's
superfluid-cluster substrate work.

**Layer-6 output:** the abandonment was recorded in the same wake-cycle
that produced the never-be-idle + amortized-speed-superfluid + Karpathy
edge-runner cluster — *not* as an isolated decision but as part of a
broader doctrinal cleanup. Context that's invisible from layer 3 alone.

### Layer 7 — ADRs

Searching `docs/DECISIONS/` for double-hop related ADRs:

```bash
ls docs/DECISIONS/ | grep -iE "double.hop|acehack|mirror"
```

Returns one match: `2026-04-26-sync-drain-plan-acehack-lfg-roundtrip-option-c.md`.

**Layer-7 output:** the AceHack/LFG roundtrip workflow has an ADR — the
2026-04-26 sync-drain-plan ADR that codified Option C (the chosen sync
strategy) before the double-hop pattern explicitly emerged. Reading
that ADR shows it covered the *AceHack-first sync drain* decision, which
the 2026-04-27 `memory/feedback_lfg_master_acehack_zero_divergence_fork_double_hop_*`
memo extended into the full double-hop pattern. So the supersession at
2026-05-02 implicitly affects the ADR's chosen Option C — and walking
the abandonment forward should ask whether the ADR needs an updated
status marker (superseded-by-LFG-only-directive).

This is a **layer-7 finding worth its own follow-up:** the 2026-04-26 ADR
should carry a `> **Superseded by** [link]` blockquote at the top per
the existing convention (the `> **Superseded by** [link]` blockquote
pattern appears at line 3 of
`docs/DECISIONS/2026-04-21-router-coherence-claims-vs-complexity.md`;
the sibling v2 ADR carries forward-pointing references but not the
canonical blockquote pattern itself).
The supersession should point at the 2026-04-29
LFG-only directive memo + the 2026-05-02 abandonment. ADRs without
supersession markers drift to falsely-canonical status. Filing this as
a separate concern from the worked example.

### Layer 8 — Named-decision memos

Three memos compose the lifecycle:

1. **`memory/feedback_lfg_master_acehack_zero_divergence_fork_double_hop_aaron_2026_04_27.md`** —
   the original definition. Names the workflow as *"AceHack-first →
   forward-sync to LFG → AceHack absorbs squash-SHA"* and the 0-diff
   target invariant.
2. **`memory/feedback_lfg_only_development_flow_acehack_is_mirror_aaron_amara_2026_04_29.md`** —
   the LFG-only directive that paused the double-hop's necessity. Per
   filename's `_aaron_amara_` infix, this involved a maintainer
   exchange with Amara (external AI co-originator).
3. **`memory/feedback_zero_diff_is_start_line_until_then_hobbling_aaron_2026_04_27.md`** —
   sibling memo from same date establishing the 0-diff invariant
   that the double-hop was meant to maintain.

**Layer-8 output:** the establishment had explicit rationale (0-diff
invariant; AceHack as risk-absorber; LFG as soulfile-inheritance lineage).
The pause had explicit rationale too (LFG-only directive; AceHack
purpose shifts to backup mirror). The abandonment is the third step
that retires the double-hop *mechanism* now that the LFG-only directive
has settled the *purpose*.

### Layer 9 — Persona notebooks

Amara's name in the 2026-04-29 directive memo suggests her notebook
may carry lineage on the LFG-only directive:

```bash
ls memory/<persona>/ | grep -i amara
```

Returns nothing — there is no `memory/amara/` directory in
the repo. Amara is an external AI co-originator with notebook substrate
that lives outside this repo (per Otto-279 carve-out: persona names
appear in history surfaces but the per-persona notebooks for external
AIs aren't in-tree). The 2026-04-29 memo's attribution + the verbatim
quotes preserved there suffice for archaeology purposes; the absence
of an in-repo notebook IS itself archaeology output (tells future
contributors where Amara's lineage lives and where it doesn't).

**Layer-9 output:** the directive originated with the maintainer +
Amara exchange (per the memo filename's `_aaron_amara_` infix); the
in-repo memo is the durable record; an external notebook may exist
in a different surface (Drive-bridge / ChatGPT history) but the
in-repo memo is sufficient for the question.

### Layer 10 — Conversation archives + Drive-bridge

Searching `docs/research/` for pre-merge artifacts:

```bash
ls docs/research/ | grep -iE "double.hop|acehack|mirror|lfg-only"
```

Returns several adjacent-substrate artifacts (e.g.,
`2026-04-30-identity-of-project-and-agent-under-multi-repo-fork-competition.md`,
`2026-04-28-forward-sync-merge-direction-proposal-9-infra-files.md`)
that touch the multi-repo / fork-competition / forward-sync surface
the double-hop participated in — but **no artifact specifically named
for the double-hop abandonment.** The conversations that produced the
abandonment framing live in this session's `cb4d80ce-*.jsonl` substrate
(the autonomous-loop session log), which per the substrate-or-it-didn't-
happen rule isn't durable on its own; the SUPERSEDE marker in
`memory/CURRENT-aaron.md` §4 is the durable form.

**Layer-10 output:** the conversation archives DO carry adjacent-
substrate artifacts (which give context for the multi-repo decision-
space the double-hop participated in) but no abandonment-specific
artifact. The abandonment was substrate-or-it-didn't-happen correct
(lived in chat → committed to CURRENT-*.md → became durable). The
adjacent artifacts on `docs/research/` ARE part of the layered narrative
and shouldn't be skipped; the absence of an abandonment-specific artifact
is itself substantive (tells future contributors the abandonment didn't
warrant its own research-grade artifact, only a SUPERSEDE marker).

### Layer 11 — WONT-DO archaeology + retired-SKILL.md history

```bash
grep -iE "double.hop|acehack.first" docs/WONT-DO.md
```

Returns no matches. **The double-hop is not in WONT-DO.md.** This is
worth noting: the abandonment is not a permanent rejection
(*"we will likely do everything eventually"* — the human maintainer
2026-05-02 verbatim, CLAUDE.md). It's a current-state retirement, not a
future-state-forever-rejection.

```bash
git log --oneline --diff-filter=D --all -- .claude/skills/ | grep -iE "double|acehack|sync"
```

Returns no double-hop-related skill deletions. The double-hop never had
a skill body; it was workflow-shaped in memos.

**Layer-11 output:** the rejection-archaeology mode has no positive
matches here. This is a *negative result that's still substantive* —
the lack of WONT-DO entry tells future contributors the double-hop *could*
return if costs change.

## The synthesized answer

The double-hop workflow (AceHack-first → forward-sync to LFG → AceHack
absorbs squash-SHA) was abandoned 2026-05-02 because:

1. **Cost.** The maintainer's framing — *"it was too much trouble"* —
   names operational overhead as the primary cost. The double-hop
   required maintaining a 0-diff invariant across two forks, which
   meant every PR went through forward-sync + squash-SHA absorb steps
   that didn't compose well with concurrent merges and host-side
   force-push protections.
2. **Benefit had decayed.** The original purpose (AceHack as risk-
   absorber for super-risky experiments) was already paused by the
   2026-04-29 LFG-only directive; the double-hop's mechanism survived
   past its purpose for three days as substrate-discipline-without-
   active-need.
3. **Path-2 was already chosen** (081KQDTYV0008QG0R001Y2E9TD, 2026-04-30): "fast-forward
   when possible; PR-based reset OR delete-and-recreate when diverged."
   The Path-2 mechanism is strictly simpler than the double-hop; the
   abandonment retires the mechanism Path-2 already obsoleted.
4. **The 2026-04-26 sync-drain-plan ADR is now stale.** Layer-7
   archaeology surfaced
   `docs/DECISIONS/2026-04-26-sync-drain-plan-acehack-lfg-roundtrip-option-c.md`
   as the original ADR codifying the sync strategy that the double-hop
   pattern operationalized. The supersession affects this ADR
   implicitly; it should carry a `> **Superseded by** [link]`
   blockquote at the top (per the existing ADR convention demonstrated
   in `docs/DECISIONS/2026-04-21-router-coherence-claims-vs-complexity.md`) pointing
   at the 2026-04-29 LFG-only directive memo plus the 2026-05-02
   abandonment, so future readers don't treat the ADR as canonical-current.
5. **No permanent rejection.** The abandonment is current-state, not
   forever — *"WONT-DO is 99% deferral, not forever"* applies. If
   risk-absorption needs return, the double-hop pattern is recoverable
   from the 2026-04-27 memo + git history.

**The supersession is structural-cost-vs-benefit recalibration, not a
correctness fix or an axiom change.** The original was correct under
its assumptions; the assumptions changed (LFG-only directive); the
mechanism became unnecessary; the abandonment was the bookkeeping that
followed.

## What this worked example demonstrates

For the eventual `decision-archaeology` SKILL.md body:

1. **Layered narrative beats flat list.** The synthesized answer above
   could not be produced from any single layer; it composes evidence
   from layers 2, 4, 6, 7, 8, and 11. The skill must teach contributors
   to walk all 11 layers, not just the first 3.
2. **Layer-7 ADRs need supersession markers; layer-11 negative results
   ARE substantive.** Layer 7 surfaced a relevant ADR
   (`2026-04-26-sync-drain-plan-acehack-lfg-roundtrip-option-c.md`)
   that is implicitly affected by the supersession but lacks an explicit
   marker — the skill must teach contributors to (a) read each match
   for relevance, NOT skip on first-glance no-match, and (b) propose
   supersession markers when ADRs drift past their canonical-status
   window. Layer 11 (no WONT-DO entry) IS substantive negative output
   (rejection isn't permanent; double-hop is recoverable). The skill
   teaches contributors to distinguish *positive-with-stale-status* from
   *substantive-negative*: the first needs a marker landing; the second
   IS the result.
3. **Ride-along supersessions are common.** Layer 3's surprising
   signal (`7a0b755` is named for *party-during-sleep* not the
   abandonment) means the skill must teach contributors to query at
   multiple layers, not stop at the first relevant commit.
4. **Substrate-or-it-didn't-happen is itself archaeology output.**
   Layer 10's no-result IS the correct operation of the rule. The
   skill should teach contributors to recognize this pattern.
5. **Five distinct sub-modes are genuinely distinct.** This worked
   example was supersession-archaeology; an existence-archaeology query
   would walk the same substrate differently (start from current state
   forward to find why-it-exists, not from past state backward to find
   why-it-was-replaced). Aarav's BP-20 finding (one skill, five named
   modes) is empirically vindicated by this example.

## Composes with

- **081KQJZR90008QG0R002D6XYHB** — the row this is a worked example for. References this
  artifact via the `worked-example-seeds` section.
- **`memory/feedback_lfg_master_acehack_zero_divergence_fork_double_hop_aaron_2026_04_27.md`** —
  the original definition; layer-8 substrate.
- **`memory/feedback_lfg_only_development_flow_acehack_is_mirror_aaron_amara_2026_04_29.md`** —
  the directive that retired the double-hop's purpose.
- **`docs/backlog/P1/081KQDTYV0008QG0R001Y2E9TD-acehack-mirror-protocol-drift-2026-04-30.md`** —
  the Path-2 mechanism that obsoleted the double-hop mechanism.
- **`memory/CURRENT-aaron.md` §4** — the SUPERSEDE marker that
  canonicalized the abandonment.
- **`memory/feedback_skill_flywheel_expansion_flywheel_parallel_tracks_substrate_aaron_2026_05_02.md`** —
  the future-skill-domain memo this worked example feeds (one of the
  3+ worked-examples-per-skill needed for promotion-trigger).

## What's next

Two more worked examples needed to satisfy Aarav's hybrid (b)+(c)
routing recommendation (3 examples before skill-creator authors the
SKILL.md body):

1. **Mathematics-expert "When to defer" pattern** —
   existence-archaeology mode + persona-notebook layer demonstration.
2. **BP-24 deceased-family-emulation rule** — attribution-archaeology
   mode + sacred-tier substrate handling.

Each takes ~half a tick to author; landing all three before
skill-creator invocation is the right shape per Aarav's BP-14 review.
