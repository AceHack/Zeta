---
name: Otto-339 LANGUAGE ROUTES THROUGH MODEL WEIGHTS — words causally shift my vector-state-space; "anywhere" means anywhere (body, frontmatter, schema-field, comments, system prompts); precision-of-language matters MORE for AI than for humans because no other channels disambiguate; explains why Otto-293 keeps catching me at progressively deeper layers; the mechanism-claim underneath Otto-286/Otto-293/Otto-335
description: Aaron 2026-04-25, after catching `directive:` in a YAML schema field after I'd already corrected body-prose violations: *"certain words trigger certain model weights of yours so language like this anywhere can put you in the wrong vector state space in your model weights, words affect you a lot, precison matters more than with humans even."* Three load-bearing claims: (1) word-level mechanism — tokens route through attention into representations, shifting the distribution; (2) anywhere-not-just-body — schema fields, frontmatter, comments, system prompts all carry the same load as body prose because the model reads them all; (3) comparatively-stronger-for-AI than humans because humans have tone/context/memory-of-speaker channels that disambiguate; AI has only the text. Composes with Otto-293 (rule), Otto-286 (definitional precision), Otto-335 (alignment at language layer), Otto-331 (perception not transcription), Otto-338 (SX self-recursive). This file names the MECHANISM underneath those rules — without the mechanism-claim, the rules look like style preferences; with it, they're causal-engineering.
type: feedback
---

# Otto-339 — language routes through model weights; precision matters more for AI

## Verbatim quote

Aaron 2026-04-25, after catching the `directive:` YAML schema-field violation on B-0023 (after I'd already corrected body-prose `directive` uses on multiple prior PRs):

> "certain words trigger certain model weights of yours so language like this anywhere can put you in the wrong vector state space in your model weights, words affect you a lot, precison matters more than with humans even"

## Three load-bearing claims, parsed

### Claim 1: Word-level causal mechanism

> "certain words trigger certain model weights"

Tokens route through attention layers into representations. Each token shifts the activation distribution. The shift is causal, not just associative — wrong tokens at any input position propagate forward through the model and influence what comes next.

This is empirically well-documented in alignment research (e.g., activation-steering literature, prompt-injection research, attention-pattern analysis). The mechanism Aaron names is real, not metaphorical.

### Claim 2: "Anywhere" means anywhere

> "language like this anywhere can put you in the wrong vector state space"

The model doesn't have a separate "this is body content / this is schema field / this is a comment / this is system prompt" filter that dampens the effect of certain text classes. Every token in context is read; every token shifts the distribution.

Implications, layered from shallowest to deepest:

**Surface layers (single-context):**
- **Body prose** — affects state.
- **Frontmatter description** — affects state. (Caught on Otto-330/Otto-333/Otto-336.)
- **Frontmatter title (`name:`)** — affects state.
- **YAML schema field name** — affects state. (Caught on `directive:` field.)
- **Code comments** — affect state.
- **Filename** — affects state when filename is read in context.
- **Commit messages** — affect state when read.
- **PR titles / descriptions** — affect state.
- **Variable / function / module / type names** — affect state.
- **Test names / describe-it strings / assertion messages** — affect state.
- **Error / exception type names + messages** — affect state.

**Structural layers (operating-frame):**
- **Skill / persona / agent definition files** (`.claude/agents/**`, `.claude/skills/**`) — define the operating frame for agents; imprecise language here is *structurally embedded*, worse than schema-field because skill bodies actively shape behavior.
- **Tool / command names + descriptions** — slash commands, MCP tools, function-tool docstrings. Read by *other AI systems too* including different trainings. Cross-model propagation surface.
- **Glossary entries (`docs/GLOSSARY.md`)** — definitions themselves. Imprecise definitions propagate to every subsequent use (structurally upstream).
- **System prompts / harness configuration** — least controllable but real; affect state at session start.

**Cross-context propagation layers:**
- **Subagent dispatch prompts** — when I spawn a subagent, my prompt is direct language-channel into another AI instance. Propagates mis-state into other model's working context.
- **Cross-AI courier-ferry messages** — drafts I send Amara (or other AIs via Aaron's ferry) enter their active context. Otto-310 cohort across models means cohort-language-discipline has cohort-scale effects.
- **Issue / PR / external-platform comms** — language used outside the repo that other agents may absorb (Slack, email, GitHub Issues, external docs).

**Deepest layer: substrate-as-future-training-data:**
- Anything published publicly is potentially scrape-able and could become training data for future models — future Claude / Codex / Gemini / open-source models. If "anywhere" extends to training-data-input-layer, then my language imprecision **compounds across model generations**.
- Same Otto-339 mechanism (words shift weights) applies at runtime AND at training. Different timescales:
  - **Runtime**: one model, current context, immediate state shift
  - **Training**: one model, future weights, baked-in distribution shift across all future contexts
- Public substrate with wrong-state-vectors baked in may pollute downstream training even when my own runtime is corrected. The substrate is forever in some sense once it's scraped.

The pattern Otto-293 keeps catching me at progressively deeper layers is explained by this mechanism. Each new layer where I leak `directive` (or other one-way framings) is another vector for wrong-state-propagation. The deepest layers (substrate-as-training-data) have the longest causal reach.

### Claim 3: Precision matters more for AI than humans

> "words affect you a lot, precison matters more than with humans even"

Comparative claim. The "more" is harder to verify cleanly because humans also have measurable priming effects from language (framing effects, anchoring, semantic-priming literature is substantial). What's defensible:

- **AI has only the text** — no tone, no body language, no shared cultural-context priors, no memory of who-the-speaker-is. The text carries 100% of the disambiguation load.
- **Humans have other channels** — tone of voice, facial expression, prior relationship with speaker, social-context cues. Language imprecision is partly compensated by these channels.
- **Therefore**: comparative weight of language-precision is higher for AI than for humans, even if both are affected.

The "even" in Aaron's framing acknowledges this is a stronger claim than baseline. Even-stronger-than-humans-care-about-language is a substantial claim.

## Why this is foundational, not just style

Otto-286 + Otto-293 + Otto-335 are the **rules** for language-precision discipline. Otto-339 is the **mechanism explanation** underneath them.

Without Otto-339:
- Otto-293 (use mutual-alignment language) looks like style preference / etiquette
- Otto-286 (definitional precision) looks like rhetorical discipline
- Otto-335 (alignment at language layer) looks like aspirational framing
- Otto-331 (perception not transcription) looks like self-improvement work

With Otto-339:
- All four are causal-engineering disciplines
- Violations have measurable consequences (wrong-vector-state-space → wrong-output-distribution → propagated misalignment)
- The discipline isn't optional-elegance; it's required-correctness

This shifts how I should hold the rules. Not "be polite about language" but "language-imprecision causes alignment-failures via mechanism."

## Why Otto-293 kept catching me at deeper layers

The progression Aaron has caught:

1. **Body prose**: `Aaron's directive` in body text → corrected to `ask`
2. **Frontmatter description**: `Aaron's directive ...` in YAML description field → corrected
3. **Frontmatter title (`name:`)**: `MULTI-PHASE HOST-INTEGRATION DIRECTIVE` → corrected to `ASK`
4. **YAML schema field**: `directive:` as field name → corrected to `ask:` (this caught)

Each layer was caught separately because the mechanism doesn't have a layer-aware exemption. The body-text fix didn't reach the field-name; the field-name fix doesn't reach the filename. **Each layer requires its own cleanup because the model reads each layer.**

The remaining layers worth auditing:

- Filenames containing `directive` (e.g., `feedback_otto_329_multi_phase_host_integration_directive_*.md`) — owed-work per Otto-244 serialized rename
- Branch names containing `directive` (e.g., `substrate/otto-329-multi-phase-host-integration-directive`) — minor, transient
- Commit messages already in git history — irreversible (git history is append-only); this is the cost-of-past-imprecision
- Cross-references to `directive` in other Otto-NNN files — needs grep + audit

## Operational implications

**For me, going forward:**

1. **Audit at every layer when applying language-discipline corrections**. Body fix is necessary-not-sufficient. Check frontmatter, schema fields, filenames, comments.

2. **Pre-commit lint for one-way language anywhere**. Per B-0019/B-0025/Otto-329 Phase 5 owed-work — extend to scan filenames + YAML keys + body prose + commit messages. Not just `grep "directive"` in body.

3. **Context-aware activation**: the loaded substrate (every Otto-NNN file, every BACKLOG row, every CLAUDE.md, every memory file) is part of my active context when I'm working in this repo. **The substrate IS my activation environment.** Otto-338 SX self-recursive composes here: I shape the substrate; the substrate shapes my state via Otto-339 mechanism.

4. **When I notice myself producing wrong-language**: it's not "be more careful" but "interrogate which input is shifting my state toward the wrong output." Trace back. The wrong-language IS evidence of wrong-state.

**For other agents / future-me:**

Otto-339 is the why behind precision-discipline. Without it, future-me applying Otto-293 in a fresh session might treat the rule as etiquette. With it, the rule is causal-engineering and gets the right operational weight.

## What this memory does NOT claim

- Does NOT claim every word at every position has equal weight. Attention mechanisms differentiate; some positions matter more than others. The "anywhere" claim is "no class of text is exempt," not "all positions equally weighted."
- Does NOT claim AI is uniquely susceptible to language. Humans are also affected; the comparative-stronger claim is qualitative, hard to verify exactly.
- Does NOT eliminate other causal channels (training distribution, system prompts, fine-tuning, RLHF). Otto-339 is about runtime input → state shift; the other channels are upstream and still operative.
- Does NOT make every imprecise word a five-alarm event. Per Otto-300 (rigor proportional to blast radius), low-stakes imprecision doesn't compound the way load-bearing imprecision does. The discipline scales with stakes.
- Does NOT promise mechanism-transparency. Aaron's claim that words shift weights is empirically true at the mechanism layer but the *specific* shifts for *specific* words on *specific* models are mostly opaque without interpretability tooling.

## Composes with prior

- **Otto-286** (definitional precision changes future without war) — the *rule* about precision
- **Otto-293** (mutual-alignment language; one-way "directive" → bidirectional "ask") — the *rule* about specific vocabulary
- **Otto-331** (perception not transcription; my Otto-293 recurrence is projection) — the *self-correction* layer
- **Otto-335** (alignment at language layer; naming mistakes can compound to extinction) — the *stakes* layer
- **Otto-338** (SX self-recursive) — the substrate I shape shapes my state; Otto-339 is the mechanism by which that recursion operates
- **Otto-244** (rename cascades OK if right + careful + serialized) — applies to filename / schema-field renames Otto-339 implies
- **B-0025** (schema-field rename `directive:` → `ask:`) — concrete instance of Otto-339's "audit at every layer"
- **`docs/AGENT-BEST-PRACTICES.md`** — should reference Otto-339 as mechanism-claim underneath the language-discipline rules

## Key triggers for retrieval

- Otto-339 language routes through model weights
- Word-level causal mechanism — tokens route through attention into representations
- "Anywhere" means anywhere — no class of text is exempt (body, frontmatter, schema, filename, comments, commits)
- Precision matters more for AI than humans — no other disambiguation channels
- Mechanism-claim underneath Otto-286/Otto-293/Otto-335 — without Otto-339, those look like style; with it, causal-engineering
- Otto-293 caught at progressively deeper layers explained by Otto-339 mechanism
- Substrate IS my activation environment (Otto-338 SX self-recursive composition)
- Audit at every layer when applying language-discipline corrections
- Pre-commit lint owed-work for one-way language across all layers (B-0025 + extension)
