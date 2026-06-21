# Decision-archaeology worked example #2 — the mathematics-expert "When to defer" pattern

> Scope: worked example for the proposed `decision-archaeology` skill (081KQJZR90008QG0R002D6XYHB).
> Attribution: Otto autonomous (the `architect` hat) authored from on-repo
> evidence; original-decision attribution to the human maintainer per
> `git blame` on `.claude/skills/mathematics-expert/SKILL.md`.
> Operational status: research-grade — input to skill-creator's eventual
> SKILL.md authoring per Aarav's hybrid (b)+(c) routing recommendation
> on 081KQJZR90008QG0R002D6XYHB. Not normative discipline; demonstrative.
> Non-fusion disclaimer: the procedure walked here is generic
> decision-archaeology; the substrate paths cited
> (`.claude/skills/`, `docs/DECISIONS/`, `memory/<persona>/`) are
> Zeta-specific illustrations of the generic procedure, not part of
> the skill's portable surface.

## The question

> *"Why does the `mathematics-expert` umbrella SKILL.md have a
> `## When to defer (this is load-bearing)` block listing every
> narrow-sibling skill, and where does the convention come from?"*

This is an **existence-archaeology** question (one of the five sub-modes
Aarav recommended for the `decision-archaeology` skill body) — the
artifact exists; the question asks why it's shaped that way + what
discipline it serves. Composes with **persona-notebook-archaeology** as
a secondary mode: the answer's load-bearing layer lives in a per-persona
notebook (Aarav's), not in commits or docs proper.

## Why this is a good worked example #2

Aarav's review of 081KQJZR90008QG0R002D6XYHB named this case as one of the 3 worked-example
seeds. Three properties make it complementary to worked example #1
(double-hop abandonment, supersession-archaeology mode):

1. **Different sub-mode** — existence (why does this exist?) vs
   supersession (why was this replaced?). Demonstrates the
   skill body works across modes, not just one.
2. **Persona-notebook payoff** — the load-bearing answer lives in
   Aarav's NOTEBOOK at round 41. Without consulting persona notebooks,
   the archaeology stops at "the maintainer wrote it 2026-04-19 in
   PR #27" without explaining why it became *canonical pattern*
   later.
3. **Substantive negative at Layer 7** — the 2026-04-21
   router-coherence ADR pair exists but is about a DIFFERENT routing
   concern (claims-tester Stage-1-vs-Stage-2 flow), not the umbrella's
   defer pattern. Demonstrates the skill body must teach contributors
   to recognize when a same-period ADR is unrelated and not assume
   doctrine-elevation occurred.

## The vibe-coded reframe (Aaron 2026-05-03 correction)

The maintainer reminded me mid-tick: per `AGENTS.md` §"The
vibe-coded hypothesis", he has written **zero lines of code** —
every line in `src/**`, `tools/**`, `docs/**` is
**agent-authored**. AGENTS.md verbatim names only those three
roots. The maintainer 2026-05-03 chat extends the scope to
`.claude/skills/` separately — *"i didn't write any code all is
written by you"* — confirming SKILL.md content is agent-authored
too, even though `.claude/skills/` isn't in the AGENTS.md
verbatim scope-list. (Backporting the `.claude/skills/` extension
into AGENTS.md is itself a substrate-or-it-didn't-happen
follow-up; this paragraph cites the maintainer-chat as the
extension's source until AGENTS.md is updated.)

This makes git-blame attribution structurally misleading at the
substrate-content layer:

| Layer | What `git blame` shows | What's actually true (vibe-coded) |
|---|---|---|
| Commit-author | "the maintainer 2026-04-19" | maintainer-as-committer (principled non-coder) |
| Substrate-content-author (model + harness) | partially visible — `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` commit trailers, tick-shard `opus-4-7 / autonomous-loop continuation` model column, PR description `🤖 Generated with [Claude Code]` footers | the model + harness that produced the substrate-content |
| Substrate-content-author (specific session CoT) | **invisible** at git layer | a prior Claude session whose chain-of-thought is largely lost (sessions don't share context) |
| Decision authority | (looks like maintainer) | agent proposed; maintainer accepted (selection-not-authorship) |

So the question "why was the umbrella's defer-block written this
way?" cannot be answered by asking the maintainer — he didn't
author the substrate; he selected it. Asking himself the question
returns: "I committed an agent-authored proposal." But the model
and harness that authored the substrate IS recoverable from
agent-signature substrate (Co-Authored-By trailers; tick shards;
PR footers); only the specific session-CoT layer is the
actually-lost part.

**Decision-archaeology in vibe-coded projects has a unique
substrate-author-recovery challenge — but partial recovery is available:**

- Substrate-content-authors are agents; **model + harness IS recoverable** via agent-signature substrate (Co-Authored-By trailers, tick-shard model column, PR footers); **specific session-CoT** is the actually-lost layer.
- What remains beyond model+harness identification: the substrate the agent produced + maintainer-acceptance evidence + tick shards / persona notebooks / `docs/research/` if those captured session-context
- First-party intent on substrate-content (CoT-layer) is recoverable only via:
  1. **Past-agent introspection** — the current agent reasons about the structural choice given the substrate-context the past-agent had at write-time. Speculative but bounded by the substrate.
  2. **Tick shards / persona notebooks** that captured the past-session's context (Aarav's notebook is the rare load-bearing example for this case)
  3. **Maintainer-acceptance reasoning** — the maintainer can explain why he ACCEPTED the agent's output, which is its own first-party content (not the substrate-author's intent, but the selection-judgment intent)

### Architectural intent (first-party from maintainer 2026-05-03)

When asked directly, the maintainer provided the architectural-
decision intent:

> *"it was my decision that we would have both narrow and wide
> skills and if they accidently got routed to the wide it would
> help them route to the narrow."*

This is the **architectural intent** layer — distinct from
substrate-content intent. The maintainer decided:

1. The skill space should have **both narrow + wide skills** (two-tier design — not narrow-only, not wide-only)
2. The wide (umbrella) skill should act as **redirect-to-narrow** when accidental wide-routing happens

The substrate-content intent (specific shape: explicit enumeration of every sibling with `→ skill-name` routing) was the past Claude session's choice **within** that architecture. The architecture is the maintainer's; the implementation is the agent's.

### Past-agent introspection on the substrate-content layer

Given the architectural intent (both narrow + wide; wide-redirects-to-narrow), the substrate context the past-agent had at write-time (round 34, 2026-04-19):

1. The math substrate had 6+ narrow expert skills (category-theory, measure-theory, numerical-analysis, probability, applied-mathematics, theoretical-mathematics)
2. Skill-routing matches on description keywords; an umbrella named "mathematics-expert" would trigger on every math-flavored query (including queries that should hit a narrow sibling)
3. The architectural goal (wide-redirects-to-narrow) is satisfied by an explicit defer-block listing every sibling
4. The "this is load-bearing" emphasis flags the procedure as router-critical to future contributors

**Inferred past-agent reasoning (necessarily speculative, bounded by architectural intent + substrate-context):** explicit enumeration of every sibling rather than "defer to most-narrow matching skill" was the more conservative implementation — explicit enumeration is deterministic; "most-narrow matching" requires routing-implementation that doesn't exist. The past agent translated the architectural intent into the simplest deterministic implementation.

This inference is **bounded by the architectural intent (now first-party-confirmed) + substrate-context**, not authoritative on past-agent intent. The skill body should teach contributors:

- **Three intent layers**: architectural (maintainer's decision authority — first-party recoverable), substrate-content (past-agent — past-agent introspection bounded by architecture + substrate), selection-judgment (maintainer's commit acceptance — first-party recoverable)
- **Inference is the right tool** for vibe-coded substrate-author archaeology at the substrate-content layer; certainty about implementation-specific intent is not available
- **First-party query IS available** for architectural intent + selection-judgment; ask the maintainer for those layers

## The procedure walked, layer by layer

### Layer 1 — Frame the question

The question `"why does the mathematics-expert umbrella have a 'When to
defer' block?"` decomposes into:

- **What does the block contain?** A list of narrow-sibling skills
  (category-theory-expert, measure-theory-and-signed-measures-expert,
  numerical-analysis-and-floating-point-expert, etc.) with explicit
  "→ skill-name" routing.
- **Why is it load-bearing?** The skill itself says so (the heading
  contains "this is load-bearing"). The deeper why requires layers 7
  + 9.
- **When did it become canonical?** Different question from "when was
  it authored" — needs round-history + persona-notebook archaeology.

### Layer 2 — Surface layer: `git blame` on the canonical file

```bash
git blame -L 30,49 .claude/skills/mathematics-expert/SKILL.md
```

Returns:

```
5fdc72bf (Aaron Stainback 2026-04-19 20:01:01 -0400 30) ## When to defer (this is load-bearing)
5fdc72bf (Aaron Stainback 2026-04-19 20:01:01 -0400 31)
5fdc72bf (Aaron Stainback 2026-04-19 20:01:01 -0400 32) Defer to the narrow skill whenever a prompt cleanly lands
5fdc72bf (Aaron Stainback 2026-04-19 20:01:01 -0400 33) in its lane. The umbrella exists to *route*, not to
5fdc72bf (Aaron Stainback 2026-04-19 20:01:01 -0400 34) compete:
... (lines 35-49: 6 narrow-sibling defer-rules)
```

**Layer-2 output:** the entire "When to defer" block landed in a single
commit, `5fdc72bf`, on 2026-04-19 by the human maintainer. No subsequent
edits to the block — `git blame` shows ONE commit owns all 20 lines.

This is meaningfully different from worked example #1's supersession case
(where blame surfaced multiple commits incrementally building the marker).
Existence-archaeology often gets a single-commit blame; the load-bearing
context lives elsewhere.

### Layer 3 — Commit context: `git show 5fdc72bf`

```bash
git show --stat 5fdc72bf | head -10
```

Returns:

```
Round 34: factory + public-repo alignment + first DB tests (#27)
```

**Layer-3 output:** the umbrella SKILL.md was authored as part of "Round
34: factory + public-repo alignment + first DB tests" — a multi-area
commit covering the early skill-substrate creation. The "When to defer"
block was one piece of a larger factory-alignment effort, not a standalone
decision. PR #27 is the commit context but doesn't itself explain *why*
the block became canonical.

### Layer 4 — String archaeology

```bash
grep -l "umbrella exists to" .claude/skills/*/SKILL.md
```

Returns BOTH `.claude/skills/mathematics-expert/SKILL.md` AND
`.claude/skills/physics-expert/SKILL.md`. The "umbrella exists to"
verbatim phrase has been **replicated to a sibling umbrella** —
physics-expert carries the same pattern.

**Layer-4 output:** the pattern is canonical-by-replication. The
mathematics-expert SKILL.md is the **earlier instance** (per `git
blame` dates on each file), but it's been deliberately copied into
physics-expert. The replication itself is evidence the pattern was
treated as a canonical exemplar to follow — even though no formal
ADR canonicalized it (Layer 7 will confirm this is a substantive
negative result).

### Layer 5 — Function archaeology

Not applicable. The "When to defer" block is markdown procedure-doc, not
code; this layer no-ops for skill-body documentation.

### Layer 6 — Round-history shards

```bash
ls -1 docs/hygiene-history/ticks/2026/04/ | sort | head -3
```

Returns: `28`, `29`, `30` — the earliest tick-shard directory under
2026/04/ is `04/28`, **NINE DAYS AFTER** the umbrella SKILL.md was
authored (2026-04-19). There are no tick shards from the authoring
window because **the tick-shard discipline started later than the
umbrella authoring**.

**Layer-6 output:** substantive negative — pre-shard-discipline
substrate cannot be archaeologically traced through tick shards; it
must be traced through other layers (commit + persona-notebook +
memos; ADR-class did not canonicalize this pattern, per Layer 7
below). This teaches contributors: **substrate boundaries matter**.
The round-history surface is dense for 2026-04-28+ work but sparse /
nonexistent for earlier substrate. Decision-archaeology must
recognize when a layer is empty by-substrate-design rather than by
omission.

### Layer 7 — ADRs

```bash
grep -liE "When to defer|mathematics-expert|umbrella exists" docs/DECISIONS/*.md
```

Returns nothing. **No ADR mentions the umbrella's "When to defer"
pattern.** The router-coherence ADR pair
(`2026-04-21-router-coherence-claims-vs-complexity.md` v1 →
`2026-04-21-router-coherence-v2.md` v2) does exist, but those ADRs
are about a different routing concern entirely — the
**claims-tester** Stage-1-vs-Stage-2 routing flow (Hiroshi analytic
proof vs Daisy empirical measurement), not about the
mathematics-expert umbrella's defer-block.

**Layer-7 output:** **substantive negative** — no ADR canonicalized
the umbrella's "When to defer" pattern. This is meaningful: the
pattern is canonical-by-replication-and-notebook-recognition (per
Layer 4 + Layer 9), NOT by ADR-decree. Different elevation paths
lead to canonical-status; the skill body must teach contributors to
recognize when the elevation lives outside ADRs. **The earlier draft
of this worked example claimed the v2 ADR cited the umbrella's
pattern; that claim was empirically false** — verified empirically
via `grep -li "When to defer" docs/DECISIONS/*.md` returning no
matches. The worked example itself is now also a worked example of
the verify-then-claim drift class (semantic-equivalence drift on a
load-bearing claim about ADR content).

### Layer 8 — Named-decision memos

```bash
grep -lE "When to defer|umbrella exists to" memory/feedback_*.md
```

Returns no specific feedback memo named for the pattern. The
recognition-as-canonical lives in Aarav's notebook (Layer 9) +
the replication evidence (Layer 4), not in a named-rule memo and
not in an ADR (per Layer 7 substantive negative).

**Layer-8 output:** another substantive negative result — not every
load-bearing pattern gets a feedback memo; this one lives in
persona-notebook + replication-evidence substrate alone. The skill
body should teach contributors to read all 11 layers, not give up
when one returns nothing, and to recognize when the canonical form
spans multiple sub-canonical surfaces (notebook + replication)
without a single doctrine-elevation point.

### Layer 9 — Persona notebooks

```bash
grep -A2 -E "When to defer|umbrella has a" memory/aarav/NOTEBOOK.md
```

Returns:

```
- 2026-04-20 (round 41) -- mathematics-expert umbrella has a
  strong "When to defer" block naming every narrow sibling;
  router-coherence discipline the factory now uses widely.
  ... other umbrella skills should pattern-match on. No action,
  but worth referencing when other umbrellas are tuned.
```

**Layer-9 output:** *this is the load-bearing layer for the question.*
Aarav (skill-tune-up persona) explicitly noted at round 41 (2026-04-20,
one day after authoring) that the umbrella's defer-block IS the canonical
pattern — and named it as the model other umbrellas should follow.
Aarav's observation IS the explicit recognition-as-canonical signal;
no ADR captures it; no named-decision memo captures it. The notebook
recognition + the replication evidence (Layer 4 — physics-expert
copied the pattern) together constitute the canonical-status without
formal ADR doctrine.

This is the kind of load-bearing context that **doesn't appear at any
other layer.** Without consulting Aarav's notebook, the archaeology
stops at "the maintainer wrote it as part of round 34 factory
alignment" without explaining *why it became canonical*.

### Layer 10 — Conversation archives

`docs/research/` doesn't carry a specific worked example for this
case (other than this very document, recursively). The conversations
that produced the pattern are pre-Drive-bridge era (round 34 was
2026-04-19; Drive-bridge ferry pattern emerged later); the canonical
durable form is the SKILL.md (umbrella + replicated to physics-expert
sibling) + Aarav's persona notebook duo — NO ADR is part of the
canonical durable form, per Layer 7's substantive negative.

### Layer 11 — WONT-DO archaeology + retired-SKILL.md history

```bash
grep -iE "When to defer|mathematics-expert" docs/WONT-DO.md
```

Returns nothing. The pattern is not in WONT-DO; it's a positive-pattern
canonical-doctrine, not a deprecation.

```bash
git log --oneline --diff-filter=D --all -- .claude/skills/ | grep -iE "math"
```

Returns no deletion of math-related skills; the umbrella + narrow-siblings
are all live. No retired-SKILL.md history relevant here.

**Layer-11 output:** another substantive negative — patterns that
become canonical positive-doctrine don't show up in rejection-archaeology
surfaces. This complements worked example #1 (which DID surface negative
content via the abandonment lifecycle); the contrast is itself
substantive.

## The synthesized answer

The mathematics-expert umbrella SKILL.md's "When to defer" block exists
because:

1. **Origin (2026-04-19):** the maintainer authored it as part of round 34 factory
   + public-repo alignment (PR #27, commit 5fdc72b). The block was one
   piece of a multi-area factory-substrate creation; not a standalone
   decision.
2. **Replication to a sibling umbrella (date undetermined; ≥ 2026-04-19):**
   the same "umbrella exists to" verbatim phrase appears in
   `.claude/skills/physics-expert/SKILL.md` — the pattern was deliberately
   copied to a sibling. Replication-without-ADR is itself a canonicalization
   signal: someone treated the math-expert version as the exemplar to follow.
3. **Recognition as canonical (2026-04-20):** Aarav (skill-tune-up
   persona) noted at round 41 in his notebook that the block was a
   "strong" exemplar naming every narrow sibling, with the explicit
   observation that other umbrella skills should pattern-match on it.
   **This is the only explicit recognition-as-canonical signal** in the
   substrate; no ADR, no named-decision memo, no commit-message elevation.
4. **No ADR canonicalization (substantive negative):** despite the
   2026-04-21 router-coherence ADR pair landing 2 days after the umbrella
   authoring, those ADRs are about the **claims-tester Stage-1-vs-Stage-2
   routing flow** — a different routing concern. No ADR elevated the
   umbrella's defer-block into project-wide doctrine.
5. **Load-bearing now:** the block is "load-bearing" because every
   narrow-sibling skill exists at the same router-trigger surface;
   without an explicit defer-block, the umbrella + narrow-siblings
   would compete for routing and produce unpredictable behavior. The
   pattern is what makes the multi-skill router coherent.

The doctrine's emergence followed a **canonical-by-replication-and-notebook-recognition**
path, NOT a canonical-by-ADR-decree path. Decision-archaeology that
stops at "no ADR found" misses Layer 4 (replication evidence) + Layer 9
(persona-notebook recognition). Different elevation paths exist; the
skill body must teach contributors to recognize which path applies in
each case.

## What this worked example demonstrates

For the eventual `decision-archaeology` SKILL.md body:

1. **Single-commit blame is common for existence-archaeology cases.**
   Unlike supersession cases (worked example #1), existence-archaeology
   often gets one commit + the load-bearing context lives elsewhere.
   The skill must teach contributors to KEEP GOING past Layer 2 even
   when the blame trail is short.
2. **Persona notebooks are non-trivially load-bearing.** Layer 9 carried
   the answer here; Layer 8 (named-decision memos) returned nothing.
   The skill body should not skip persona notebooks just because they're
   "user-scope-feeling" substrate — they're factory-canonical.
3. **The doctrine emerges across layers + dates, not in a single
   moment.** Three layers (commit + notebook + ADR) span three days
   (04-19 → 04-20 → 04-21). The skill teaches contributors to walk the
   timeline, not just the origin.
4. **Substantive negatives at Layers 8 + 11 confirm + locate the
   load-bearing layer.** Negative results at multiple layers tell the
   contributor "look elsewhere" — they're directional signal, not
   wasted queries.
5. **Both worked examples (#1 supersession + #2 existence) walk all
   11 layers.** The procedure is consistent across modes; only the
   answer-shape differs (negative-result-rich for supersession;
   positive-pattern-canonical-doctrine for existence).
6. **Ask the original decision-maker rather than infer — when
   available.** Decision-archaeology can recover *what happened*, *when*,
   and *who-touched-what* from substrate; **first-party intent on
   substrate-content requires first-party query**. In traditional
   projects this means asking the original author. In vibe-coded
   projects (per Aaron 2026-05-03 correction + the vibe-coded reframe
   section above), the maintainer is principled-non-substrate-author,
   so first-party query targets the maintainer's selection-judgment +
   the past-agent's substrate-context, not the maintainer's
   substrate-author intent. The skill body should teach contributors
   to **distinguish between substrate-recoverable facts (cached) and
   first-party intent (source-of-truth) — and ask the available
   first-party source rather than infer from substrate when intent
   is the question.**

## Composes with

- **081KQJZR90008QG0R002D6XYHB** — the row this is a worked example for. References this
  artifact via the `worked-example-seeds` section.
- **`docs/research/2026-05-02-decision-archaeology-worked-example-1-double-hop-abandonment.md`** —
  worked example #1; pair-companion. Together demonstrate two distinct
  sub-modes (supersession + existence).
- **`.claude/skills/mathematics-expert/SKILL.md`** — the canonical
  artifact whose existence the question investigates.
- **`docs/DECISIONS/2026-04-21-router-coherence-claims-vs-complexity.md`** +
  **`docs/DECISIONS/2026-04-21-router-coherence-v2.md`** — Layer-7
  ADR pair establishing the elevation-to-doctrine.
- **`memory/aarav/NOTEBOOK.md`** (round 41 entry) — Layer-9
  persona-notebook substrate carrying the load-bearing recognition.

## What's next

Per Aarav's BP-14 (3 worked examples before skill-creator authors
SKILL.md):

- ✅ Worked example #1 — double-hop abandonment (supersession-archaeology
  mode) on main since 2026-05-02
- ✅ Worked example #2 — mathematics-expert "When to defer" pattern
  (existence-archaeology + persona-notebook layer demonstration; this
  document)
- ⏳ Worked example #3 — BP-24 deceased-family-emulation rule
  (attribution-archaeology mode + sacred-tier substrate handling).
  Pending; lands in a subsequent PR.

Once worked example #3 lands, skill-creator can author
`.claude/skills/decision-archaeology/SKILL.md` with confidence that
the procedure-body is grounded in 3 empirically-walked cases across 3
distinct sub-modes.
