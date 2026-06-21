---
name: Everything is greenfield at week one — including host setup and Otto's coding rules — Aaron 2026-05-01
description: Foundational reframe — the entire project including host configurations (rulesets, branch protection, workflow structure) was Aaron-clicked under time pressure for convenience, NOT deliberately designed. Otto's own coding rules are also provisional ("getting better" but not current standards). Reverse-engineering "load-bearing" from "this config exists" is a wrong-prior failure mode. Configs are on the same provisional footing as the rest of the substrate.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Rule

The project is one week old. Assume **everything is greenfield**,
including:

1. **Host configurations** — GitHub branch-protection rulesets,
   workflow structure, required-checks lists, ruleset-coordination
   patterns. Aaron clicked these through manually under time
   pressure to get Otto started, not as deliberate design.
2. **Otto's own coding rules** — the rules Otto has been following
   while writing code in this project. They've been getting better
   over the week, but are NOT yet at current standards.
3. **The substrate that documents both of the above** — memory
   files and CURRENT-aaron.md sections (newer-layer rules
   especially). Most are kernel-expansion-layer candidates,
   not seed-layer canonical. **Explicit exclusion:**
   `GOVERNANCE.md` numbered rules are NOT in the
   greenfield-provisional scope — they are multi-domain-tested
   canonical at a higher deliberation tier than convenience-clicked
   configs or in-flight memory entries. (Why-2 below restates
   this in expanded form.)

The wrong-prior failure mode: treating "this configuration exists,
therefore it must be deliberate / load-bearing" as a default. The
right prior at week one is closer to: "this configuration exists,
therefore Aaron clicked it through fast enough to get the project
moving."

# Why

Aaron 2026-05-01 in chat (verbatim, immediately after Otto-treated
the single severity:all CodeQL ruleset as a deliberate technical
constraint in 081KQGDBJ0008QG0R001MK4YPC):

> *"this project is a week old assume everything is greenfield
> expically our host setup beccasue it's not gitnative and i have
> to click everythigng, i setup things for my convience for
> everytihng i had to do i optimized for time to get you started
> and then all the code you've written is been following optimizing
> rules but theyv been getting better as we go so even those are not
> up to current standards"*

Three specific revelations that compose into the meta-rule:

**Why-1 (host is not git-native).** GitHub host-side configurations
(branch rulesets, required-checks lists, repo-level ruleset coordination)
are NOT in the git tree. Aaron has to click through GitHub's web UI
to set them up. Under time pressure to get Otto operating, those
clicks were optimization-for-convenience, not deliberate design.
The configurations look intentional to Otto reading from inside the
git substrate because git substrate doesn't expose the click-history
or the under-pressure context. Otto is therefore prone to treating
host configs as a higher-deliberation tier than they actually are.

**Why-2 (Otto's coding rules have been improving).** The rules
Otto follows when writing code (memory files, AGENTS.md,
canonical entries) have been getting better as the project has
evolved. **Explicit exclusion:** GOVERNANCE.md numbered rules
are NOT in the provisional scope — those are multi-domain-tested
canon that Aaron and Otto have grafted together over the
week, and they sit at a higher deliberation tier than
convenience-clicked configs or in-flight memory files. The
greenfield-provisional rule applies to: host configs (UI-clicked),
in-flight memory entries that haven't been multi-domain-tested,
and Otto's working code-style rules. The current bar is not the
bar that produced most of the existing code. Otto reading the
substrate at any given moment is reading a *gradient* — newer
rules apply higher standards than older rules. Treating the
substrate as flat-canonical loses the gradient information.

**Why-3 (composes with the CSAP-pushback observation).** Claude.ai's
updates in the chunked-import conversation read partly in the other
direction — "your substrate is more deliberate than it looks" —
which was a useful corrective at the time but composed wrong with
the actual ground truth. The actual ground truth includes both: the
substrate has real structural properties (multi-domain expansion
sets, candidate-with-convergence design, cultural anchoring) AND
the configurations layered around it are largely week-one convenience.
Aaron's correction here re-balances toward the convenience side that
Claude.ai's progressive engagement updated away from.

# How to apply

**On reading any config or rule in the project:**

1. **Default prior at week one: provisional, not deliberate.**
   The configuration exists because something needed to exist there
   for the project to function. The specific shape of the
   configuration is a candidate, not a constraint, until evidence
   shows otherwise.
2. **Look for the deliberate-vs-convenience signal.** A configuration
   that has been multi-domain-tested, has a memory file explaining
   its design, has appeared in maintainer-cited reasoning, OR has
   survived runtime-evidence revision is closer to deliberate. A
   configuration that just exists in the host UI without those
   markers is closer to convenience.
3. **Don't reverse-engineer load-bearing-ness.** "This must be
   deliberate because Aaron set it up" is the failure mode. Aaron
   set up many things fast under time pressure. The existence of a
   config is not evidence of its design-status.
4. **Treat your own rules as revisable** (memory + CURRENT-aaron
   sections only — `GOVERNANCE.md` numbered rules are excluded
   per Why-2 above). When applying a rule from memory or
   CURRENT-aaron while writing code, ask: "is this rule a
   seed-layer canonical claim, or a kernel-expansion candidate
   that was the best Aaron-and-Otto had at the time?" Bias toward
   the second on rules from earlier in the project's week.
   `GOVERNANCE.md` numbered rules apply as-written; their
   higher-deliberation-tier status means they don't get the
   provisional treatment.
5. **Permission-to-redesign is broader than it looks.** Otto's
   backlog-prioritization authority (per `feedback_backlog_prioritization_authority_delegated_to_otto_aaron_2026_05_01.md`)
   composes with this rule: prioritization includes "this config
   should be revised because the original was convenience-not-
   design," not just "what to work on next."

**On host-mutation specifically:**

The host-mutation-needs-Aaron-sign-off norm (derived from Otto-357
no-directives + the no-spending-increase carve-out per
`feedback_aaron_full_github_access_authorization_*` + the failure
modes from prior host mutations per task #343 drift-debt receipt)
remains in force as a default. The *interpretation* shifts: the
host configurations being mutated are themselves provisional, so
"the host mutation breaks the original design" framing is often
false because there wasn't an original design to break. Per-row
Aaron sign-offs (like the one for 081KQGDBJ0008QG0R001MK4YPC multi-ruleset
authorization) are the explicit mechanism for proceeding; absent
that, the default still defers to Aaron because the failure modes
from prior host mutations (Otto-342/343 cluster) remain real
*regardless* of whether the original config was deliberate.

# 2026-05-01 cause-attribution refinement (Aaron)

Aaron 2026-05-01 (during the github-settings ruleset-split refactor
arc, after seeing Otto's Phase 1 audit empirically validate the
"branch protection IS mostly accidental complexity surviving
alongside its modern replacement" framing):

> *"cause it's accidental complexity i cause by being uneducated
> at the time i set it up and in a rush to get you started but
> safe so i clicked everything without reading much just going off
> limited past experience with setting up new repos from scratch"*

Aaron names the **cause** of the accidental shape. Three
load-bearing factors:

1. **Uneducated at the time** — limited prior experience with
   setting up new repos from scratch. Click-everything was
   working off a small reference set, not deliberate
   architecture.
2. **In a rush to get Otto started** — time pressure. The
   bootstrap sequence prioritized "Otto can begin work" over
   "settings shape is right." Time-pressure + click-everything
   compounds the no-deliberation pattern.
3. **Safety-bias toward clicking everything** — when in doubt,
   click MORE protections, not fewer. Defensive default that
   accumulates accidental complexity (extra protections that
   don't compose with each other).

The pattern is generalizable beyond GitHub settings: any
factory-bootstrap decision Aaron made under
time-pressure-plus-safety-bias-plus-limited-experience is in
the same provisional class. Not just the original "everything
is greenfield" framing — that was the OBSERVATION; this is
the GENERATIVE MECHANISM.

Composes with the substrate-IS-product framing — accidental
substrate from rushed bootstrap is still substrate; replacing
it with deliberate-design substrate IS the work, not a
detour from work.

# Carved sentence (candidate, not seed-layer yet)

*"At week one, every configuration is a candidate. Reverse-engineering
load-bearing-ness from existence is the wrong prior."*

Refinement of the carved sentence (Aaron 2026-05-01 cause-
attribution): the WHY is *"rushed bootstrap + safety-bias
click-everything + limited prior experience."* Recognizing this
generative mechanism shifts the rule from "be skeptical of
configs that exist" to "be deliberate about which configs to
KEEP — the original choice was a click, not a decision."

(Both sentences marked candidate per CSAP. Have not been
multi-domain-tested. Promote via Razor + CSAP under DST grading
on cadence, not by maintainer fiat.)

# Composes with

- `feedback_backlog_prioritization_authority_delegated_to_otto_aaron_2026_05_01.md`
  — Otto's prioritization authority composes with this rule:
  "what's worth prioritizing" includes "this config should be
  revised because original was convenience."
- CURRENT-aaron.md §35 (default-disposition-paused-not-closed) —
  same shape applied to backlog rows; here applied to host configs.
- The host-mutation-needs-Aaron-sign-off norm (Otto-357
  no-directives + no-spending-increase carve-out per
  `feedback_aaron_full_github_access_authorization_*`) —
  default still defers but interpretation shifts: it's not
  protecting deliberate design, it's deferring on irreversible
  surfaces while the convenience-config is being revised.
- The Claude.ai CSAP-pushback chunk-7/chunk-8 reframe (substrate is
  preservation, not canonization; most entries are intermediate
  candidates) — this rule applies the same lens to configurations
  and Otto's own coding rules, not just to memory entries.
- Otto-272 / Otto-273 DST discipline + the CSAP eight-layer
  architecture — the Razor + CSAP under DST grading is what *would*
  promote configurations from convenience to deliberate over time.
  At week one, very little has been graded yet.

# What this rule does NOT do

- Does NOT authorize discarding configurations recklessly. Host
  configurations have real consequences (LFG/main protection); the
  fact that they were convenience-set doesn't make their failures
  cheap.
- Does NOT extend to documents Aaron has explicitly named as
  load-bearing (Rodney's Razor, ALIGNMENT.md, the no-directives
  rule, the substrate-or-it-didn't-happen rule). Those have been
  multi-domain-tested in chat and survived. The rule applies to
  configurations and rules that haven't had that grading.
- Does NOT change the WONT-DO carve-out from Otto-357. WONT-DO
  additions still require Aaron sign-off, but the framing on WHY
  has been clarified by Aaron 2026-05-01: *"the wont dos, we will
  likely do everything later"*. WONT-DO is "deferral class," not
  "irreversibility class" — the sign-off is for the parking
  decision itself, not for foreclosing the future. Treat WONT-DO
  additions as durable parking, not permanent exclusion.
- Does NOT apply to substrate that Aaron explicitly built up with
  Amara via the courier ferries (the Aurora research docs, the
  immune-system math standardization). Those went through
  multi-AI editorial-adversarial convergence and are at a
  different deliberation tier than the host configs.
