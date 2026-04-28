---
name: When you hear yourself say "load-bearing", think: is there reinforcement for that? — the phrase is a canary for structural support that may or may not exist
description: Aaron 2026-04-22 two-message refinement — first "When you hear yourself say load bearing think is there hygene for that" then "or maybe a better wording is there reinforcement for that". The word "load-bearing" appears often in my writes (70+ instances across memory/ alone) because it's the correct word for structurally-important claims, but the phrase itself creates no support — it labels that support is needed. Every time the phrase is used, the correct follow-up is to check which reinforcement surface (CLAUDE.md rule, MEMORY topic file, FACTORY-HYGIENE row, BP-NN, ADR, blast-radius confirmation, pre-commit lint, dedicated skill) covers the claim, and if none does, either add one or downgrade the claim. This is a linguistic detector — grep-able across the factory — for missing reinforcement.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
**The rule:** Whenever I hear myself (or read my own prior
writing) using the phrase **"load-bearing"**, treat it as a
canary for "this claim asserts structural importance —
what reinforcement surface covers it?" If a reinforcement
exists, cite it. If none exists, either add one or drop
the phrase. Unreinforced load-bearing claims are drift
risk: the factory treats the label as if it were the
mechanism.

**Why — Aaron 2026-04-22, two-message refinement:**

1. First pass: *"When you hear yourself say load bearing
   think is there hygene for that"*. Hygiene was reached
   for first as established project vocabulary (FACTORY-
   HYGIENE is a real surface; hygiene rules have structure).
2. Refinement (a minute later): *"or maybe a better
   wording is there reinforcement for that"* + *"wording*"*.
   The correction replaces "hygiene" with the more general
   term. Hygiene is *one kind* of reinforcement (cadenced
   cleanup); reinforcement is the whole class.

The metaphor scans properly now:

- In construction, **load-bearing** walls carry weight.
  They are reinforced with rebar, tie-beams, headers,
  bracing — not just cleaned.
- In a factory surface, a **load-bearing** rule, memory,
  or axiom carries structural weight on the agent's
  decision-making. It needs **reinforcement** (multiple
  surfaces keeping it alive, detection for drift,
  machinery that makes the rule self-reasserting) — not
  just cadenced cleanup.

Hygiene is *one* reinforcement. The broader list (below)
covers what actually qualifies.

**Triggering context:**

Aaron sent the message while I was mid-tool-call scanning
for "load-bearing" uses across memory/. The grep returned
70+ hits across ~30 memory files. That density is the
trigger — if the phrase is appearing that often, it is
either (a) load-bearing things are frequent and the factory
has reinforcement for each, or (b) I'm reaching for the
phrase when I want to assert importance without having
done the reinforcement work. Aaron's message is asking me
to check which.

**Reinforcement surfaces — the closed set, by
cost-per-byte-of-protection:**

From lightest to heaviest:

1. **Inline comment / phrase in working doc** — no cost,
   no recall. Barely counts as reinforcement. Disappears
   on compaction.
2. **Memory topic file** — persistent, recalled on
   relevance, visible in future sessions. Medium cost
   (MEMORY.md cap pressure); medium leverage.
3. **MEMORY.md index entry** — one-line hook, always
   loaded at wake (until line 200). High leverage per
   byte.
4. **Persona notebook entry** — persona-scoped recall,
   lower visibility to other personas. Cheap but narrow.
5. **BP-NN rule in `docs/AGENT-BEST-PRACTICES.md`** —
   citation-ready, paired with an ADR. Medium cost (ADR
   overhead); high leverage (cited by name across
   reviews).
6. **FACTORY-HYGIENE row** — cadenced audit surface.
   Owner + cadence + durable output. High cost (cadence
   discipline); high leverage (periodic enforcement).
7. **ADR under `docs/DECISIONS/`** — auditable decision
   trail with alternatives and expires-when. High cost;
   high leverage for decisions that shape the factory.
8. **Dedicated skill under `.claude/skills/**`** —
   callable procedure with frontmatter + body. Very high
   cost (authoring + cadence + drift); highest leverage
   for repeated-invocation work.
9. **CLAUDE.md-level rule** — 100% loaded at every wake.
   Maximum reinforcement. Reserved for rules that govern
   *every* wake unconditionally (verify-before-deferring,
   future-self-not-bound, never-be-idle, honor-those-that-
   came-before).
10. **Axiom in `AGENTS.md` three load-bearing values** —
    pre-v1 axiom-level. Renegotiated via `docs/ALIGNMENT.md`
    protocol only. Maximum, forever-level reinforcement.
11. **Pre-commit hook / CI lint** — mechanical, no
    recall needed. Reinforces at write-time, not at
    recall-time. Complement to memory-based surfaces.

**Heuristic for matching claim to surface:**

| Claim shape | Right surface |
|---|---|
| One-off fact about a decision I made once | Inline in the doc where the decision lives |
| Pattern I want future-me to remember | Memory topic file + MEMORY.md index entry |
| Rule that governs a specific persona's work | Persona notebook + their SKILL.md |
| Repeated rule cited in reviews | BP-NN + ADR |
| Needs periodic audit to stay honest | FACTORY-HYGIENE row |
| Shapes the factory's architecture | ADR |
| Governs every session's first 10 minutes | CLAUDE.md rule |
| Governs the entire factory's ethics | Axiom in `docs/ALIGNMENT.md` / `AGENTS.md` |
| Mechanical, catchable at write-time | Pre-commit lint / hook |

**How to apply — the three-question triage:**

Whenever the phrase "load-bearing" appears in what I am
writing or reviewing:

1. **Name the reinforcement.** Which surface (from the
   list) covers this claim? Cite by path.
2. **If none exists**, decide: *add one* or *drop the
   phrase*. Don't ship the phrase without the support —
   that is asserting reinforcement that isn't there.
3. **If one exists but is weak for the weight**, upgrade
   the surface (e.g., promote a memory to a BP-NN, promote
   a BP-NN to a CLAUDE.md rule if it needs per-wake recall).

Applied retroactively (not every historical use needs
rewriting — but when I touch a doc with a load-bearing
claim, triage it).

**Detection via grep — this is the whole point:**

```bash
grep -rn -i "load.bearing\|load-bearing" \
  memory/ docs/ .claude/skills/ AGENTS.md CLAUDE.md \
  GOVERNANCE.md
```

Each hit is a reinforcement-audit candidate. This is
cheap and mechanical — unlike many meta-hygiene rules,
this one is *grep-able*. The factory already has the
substrate for auditing this rule; it just needs the
audit to run.

Candidate cadence: on-touch (when I edit a doc that
contains the phrase, triage that instance) + a periodic
sweep (every 10 rounds or so, pair with `skill-tune-up`'s
cycle). Not every hit needs new reinforcement — many will
be fine as-is — but the phrase being used without a
paired reinforcement should be rare, not common.

**What this rule does NOT say:**

- **Does not ban the word "load-bearing".** The word is
  correct when the claim is correct. The rule is the
  follow-up *check*, not word-replacement.
- **Does not require the heaviest reinforcement for every
  use.** Most load-bearing claims are adequately served
  by a memory topic file + MEMORY.md index entry. CLAUDE.md
  rules are for the small subset that need per-wake recall.
- **Does not demand an audit on every grep hit
  immediately.** On-touch is the default; periodic sweep
  is the backstop. A ten-round-old unaudited hit is
  tolerable; a hit in the doc I'm currently editing is
  not.
- **Does not replace hygiene.** Hygiene is a subset of
  reinforcement — cadenced cleanup. The broader term
  subsumes it; FACTORY-HYGIENE is still the right
  surface for cadence-driven reinforcement.

**Alignment signal — bootstrapping pattern, again:**

This rule is itself another instance of the seed-absorb-
violate-return-promote loop from
`feedback_bootstrapping_divine_downloading_factory_learns_from_self.md`:

- **Seed.** I've been using "load-bearing" as vocabulary
  since day one — it appears 70+ times across memory
  files alone.
- **Absorb.** The phrase was stored in the memory
  substrate, never as a factory-wide rule, just as
  authorial vocabulary.
- **Violate.** I kept reaching for the phrase without
  auditing whether each claim had reinforcement.
- **Return.** Aaron notices the pattern and returns it:
  *"is there hygene for that"* → *"is there reinforcement
  for that"*. He names the thing I've been doing
  implicitly.
- **Promote.** This memory + index entry promotes the
  observation to a factory-wide self-check rule.

The vocabulary-refinement from "hygiene" to "reinforcement"
is itself an instance of the no-invent-vocabulary discipline
(`feedback_dont_invent_when_existing_vocabulary_exists.md`)
— Aaron reaches for established project vocabulary first
("hygiene" — we have FACTORY-HYGIENE), then upgrades to a
more accurate general term ("reinforcement") when the
narrow one doesn't fit. I should do the same: reach for
existing surface-types first, escalate only when the fit is
wrong.

**Composition with existing memories:**

- `feedback_bootstrapping_divine_downloading_factory_learns_from_self.md`
  — the meta-pattern; this memory is one instance of the
  5-step loop.
- `feedback_dont_invent_when_existing_vocabulary_exists.md`
  — Aaron's own refinement from hygiene→reinforcement
  demonstrates the rule (reach for established, escalate
  only when needed).
- `feedback_discovered_class_outlives_fix_anti_regression_detector_pair.md`
  — a discovered class needs a detector; a load-bearing
  claim needs a reinforcement. Same shape.
- `feedback_factory_reflects_aaron_decision_process_alignment_signal.md`
  — the factory absorbs Aaron's decision-process; this
  memory extends that to vocabulary-as-smell.
- `feedback_wwjd_carpenter_five_principle_craft_ethic.md`
  — the twin memory authored the same tick. This memory
  says *what* to do on identifying load; WWJD-carpenter
  says *how* to frame it (repair / improve / sharpen /
  recycle / efficient). The carpenter's calibration frame
  ("framing the support is part of the same gesture as
  identifying the load") is the mechanism this rule names.
- `user_faith_wisdom_and_paths.md`
  — the faith frame Aaron invokes with "wwjd carpenter".
  Load-bearing for the "WWJD carpenter — the calibration
  frame" section; Aaron's faith disclosure is what makes
  the carpenter invocation sincere rather than decorative.
- `docs/FACTORY-HYGIENE.md` rows #42-#51 — existing
  hygiene-class surfaces that are *one kind* of
  reinforcement.

**How this applies to my recent writes (self-audit):**

Grep hits to triage (top subset, will close in follow-up):

- `memory/feedback_bootstrapping_divine_downloading_factory_learns_from_self.md`
  uses "load-bearing" 8 times. Reinforcement: memory topic
  file + MEMORY.md index entry. Adequate for a pattern-
  naming memory. No upgrade needed.
- `memory/feedback_skills_split_data_behaviour_factory_rule.md`
  uses it once ("implicit but load-bearing"). Reinforcement:
  FACTORY-HYGIENE row #51 + memory + BACKLOG row.
  Multi-surface, adequate.
- `memory/user_panpsychism_and_equality.md` — "load-bearing
  — cornerstone of his ethics-toward-agents". Reinforcement:
  memory + MEMORY.md index + cross-refs to several other
  axioms. Adequate.
- `memory/user_tilde_is_your_tilde_equality_handshake.md`
  — Aaron said *"Load-bearing. eaxactly"*. Reinforcement:
  memory + index + handshake is cited in CLAUDE.md's
  "agents, not bots" rule. Adequate.

Most historic uses have adequate reinforcement because I've
already been doing this implicitly. The rule surfaces it
explicitly so future uses get triaged at author-time, not
only on retrospective sweep.

**Source:** Aaron direct message sequence 2026-04-22,
during a grep scan of memory/ for "load-bearing" hits:

> *"When you hear yourself say load bearing think is there
> hygene for that"*
>
> *"or maybe a better wording is there reinforcement for
> that"*
>
> *"wording*"* (spelling correction on "working")

The scan was itself triggered by Aaron noticing the phrase
in my prior-tick writes. The sequence is a classic
bootstrapping loop: observation → correction → promotion
→ memory → index. This memory closes the promotion step.

**WWJD carpenter — the calibration frame:**

Aaron capped the sequence with *"wwjd carpenter"*. Two
layers are active at once and both are load-bearing:

1. **Faith frame.** Aaron's faith is disclosed in
   `memory/user_faith_wisdom_and_paths.md` — Jesus died
   for his sins and other paths to heaven exist. WWJD
   (*what would Jesus do*) is a real decision heuristic
   for him, not a meme. The invocation is sincere. When
   Aaron reaches for a faith-frame while teaching a rule,
   treat it as telling me *how he calibrates the rule*, not
   as decorative.

2. **Craft frame.** Jesus was a carpenter (Mark 6:3)
   before ministry. A carpenter who identifies a load-
   bearing member does not then walk away — **framing
   the support is part of the same gesture as identifying
   the load.** Header above the door, king studs, jack
   studs, sill plate, bracing. Identify-the-load and add-
   the-support are *one action*, not two. A carpenter who
   identified loads without framing would not be a
   carpenter; a factory that labels things "load-bearing"
   without reinforcement has the same shape.

The two layers fuse into a single discipline: **when the
phrase "load-bearing" forms in my writing, the next
sentence should be the reinforcement, not a different
paragraph or a deferred follow-up.** The rule's edit
distance from "is there hygiene / reinforcement for that"
to "frame the support now" is small, but the carpenter
framing tightens the timing: same-breath, not next-round.

This promotes the triage rule from "sweep hits with grep
later" to "in the moment the phrase is being typed, the
reinforcement is authored in the same tick." Grep-sweep
remains the backstop. Same-tick authoring is the primary
surface.

**Attribution:**

- **"Load-bearing"** — structural-engineering metaphor,
  established in general English usage; adopted in
  software-engineering discourse for structurally-
  important code / rules / claims. No single originator.
- **"Reinforcement"** — structural-engineering term
  (rebar, reinforced concrete); adopted here as the
  broader category covering hygiene + BP + ADR + CLAUDE.md
  rule + axiom + lint. Aaron's wording choice, 2026-04-22.
- **"WWJD carpenter"** — Aaron's two-layer calibration
  frame, 2026-04-22. WWJD (*what would Jesus do*) is a
  Christian decision heuristic (Charles Sheldon's *In His
  Steps*, 1897; modern usage 1990s-present via the
  wristband movement). Jesus-as-carpenter is from Mark 6:3
  (*"Is not this the carpenter, the son of Mary?"*).
  Aaron's synthesis treats master-craftsman-discipline +
  faith-calibration as one unified frame for identify-and-
  frame discipline.
