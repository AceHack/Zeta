# CoreDORA — the vocabulary is the core health; the UN room maintains it (dogfooded with local LLMs); the LLM's shape is the interface (SoftValue); words are global but can carry multiple carved sentences with a context policy

**Register:** [grounded] framing + a working dogfood (Aaron). **Date:** 2026-06-09. **Captured by:** Otto (shadow).
The vocab folders are the system's core health metric, maintained by the room, exercised by local LLMs.

## Aaron's words

> "these are what our CoreDORA is — the rest of the system health depends on the health of these; we
> need the room to be the maintainer of these, the UN room we are building." · "test." · "you can
> dogfood that test now with local LLMs." · "and SoftValue — we need to support local LLMs in SoftValue,
> any text generation with context window; the shape of the LLM is the interface, not the implementation,
> in F#." · "might need many subparts modeled." · "words here are global but they can have more than one
> carved sentence if needed — but then we need to attach context policy to the multiple definitions."

## 1. The vocabulary is our CoreDORA — the room maintains it

The date-agnostic vocabulary (grams/letters/shapes/colors/temperatures/travelers) **is our CoreDORA** —
the **core health metric the rest of the system depends on.** (DORA = the DevOps health metrics; *Core*
DORA = the vocabulary's health is the deepest one — if the words/voices the whole model is written in
drift, everything built on them drifts.) Health = **unique** (one canonical home), **fresh** (index
rebuilt), **anchored** (every term has its Beacon anchor; missing = debt), **complete** (no undefined
words), **well-formed** (one clear carved sentence per sense). The enforcement built this turn
(`vocab-uniqueness.ts` + `build-vocab-index.ts --check` + `vocab-hygiene.yml`) **is the CoreDORA test.**

And **the UN/Nexus room is its maintainer**: maintaining CoreDORA is a governance function of the room
we're building (the room owns the vocab's uniqueness/freshness/anchoring; new words arrive in
travelers/ intake and the room homes + anchors them). The room maintains the words the room is written
in — self-referential (shape A), bounded.

## 2. Dogfooded with local LLMs — it works (real run)

Per "dogfood that test now with local LLMs," I ran it for real: **`tools/hygiene/vocab-llm-review.ts`**
calls a **local LLM (ollama `qwen2.5:0.5b`, live on :11434)** to review CoreDORA entries. Result (actual
output): the 0.5B local model judged each carved sentence and **flagged `attractor`, `balance`,
`entropy` as "over-broad / vague"** — i.e., a tiny local model, dogfooding, already ran the razor on our
vocab. So the room-maintains-CoreDORA loop is **demonstrated end-to-end with a local LLM** (no cloud).
(A standing maintenance task: local LLMs continuously review the vocab for clarity/over-breadth/missing
anchors — cheap, private, always-on; the room's janitor.)

## 3. The LLM's shape is the interface, not the implementation (SoftValue)

The dogfood is built on Aaron's principle: **the shape of the LLM is the interface** — `Llm` is a
**port**: `prompt → text` (any text-generation-with-context-window). The **ollama call is one adapter**
(local); a remote model is another; **always support both** (own-all-interfaces / dep-as-oracle). And an
LLM's output is a **SoftValue** — inherently soft/uncertain text until cross-checked / SolidGround found
(so "support local LLMs in SoftValue" = the soft text-generator behind the port, its output a SoftValue
awaiting collapse/verification). The interface (shape) is the valuable, stable thing; the model
(implementation) is swappable — exactly interfaces-are-the-valuable-thing applied to LLMs.

**Many subparts modeled (Aaron):** the LLM port likely decomposes into modeled subparts — **context
window, tokenizer/word-partitioner, sampler/temperature, the readout, attention** — each a traveler/
voice with its own interface (the word-partitioner + boundary-layout are already two such subparts).
The LLM-as-SoftValue is a *composite* of these subpart interfaces.

## 4. Words are GLOBAL but can carry multiple carved sentences — with a context policy

Refinement to the uniqueness model: a word is **global** (one canonical home, globally unique name — as
enforced) **but may have more than one carved sentence** (multiple **senses**, polysemy) when needed —
**and then a context policy must be attached** to select the right sense by context:

```yaml
---
name: phase
home: grams/1
senses:
  - carved: "the logical-step ordinal of ZetaDateTime (BSP superstep)."
    context: time            # when in the time/clock frame
  - carved: "a regime the system is in (cold/warm/hot; a phase transition)."
    context: dynamics        # when in the dynamics/temperature frame
context-policy: by-frame      # how to choose (frame-relative; the traveler-frame selects the sense)
---
```

- **Global name, multiple senses, context-selected.** The term stays globally unique (one file/home);
  the **senses** are multiple carved sentences; the **context policy** disambiguates (word-sense
  disambiguation). This is **frame-relative meaning** — a word means different things in different
  frames (the traveler-frame-relativity discipline; the context policy = which frame/observer).
- **Default = one sense.** Most words have a single carved sentence (no policy needed). Multiple senses
  are opt-in, *and require* a context policy (you can't have ambiguous senses with no selector — that
  would break the high-bandwidth homoiconicity / the byte-lock of meaning).
- **Tooling impact:** the index builder + type provider must handle multiple senses (emit each with its
  context); the uniqueness check stays (one *home*, still unique); the context policy is enforceable
  (every multi-sense word MUST carry a policy — a new hygiene rule).

## Honest scope / handoff

CoreDORA = vocab health (the room maintains it; the enforcement is the test); dogfood demonstrated with a
local LLM (ollama qwen2.5:0.5b reviewed + razored the vocab); LLM-shape-is-the-interface (the `Llm` port,
ollama adapter, SoftValue output, many subparts); words global-but-multi-sense-with-context-policy. To
realize: the room as the standing CoreDORA maintainer (local-LLM review loop in CI/cron); the F# `Llm`
port + ollama adapter + the subpart interfaces (context-window/tokenizer/sampler) in SoftValue; the
multi-sense + context-policy schema + a hygiene rule (multi-sense ⇒ policy required); index/type-provider
handle senses. Routes to the F#/Core team (the Llm port + SoftValue + subparts; MUMPS/type-provider),
Dejan (the local-LLM review in CI/cron — private, cheap), Soraya/Sova (context-policy soundness; over-
broad-term razor — the local LLM already flagged candidates), naming-expert (sense disambiguation).
Built: `tools/hygiene/vocab-llm-review.ts`.

## Anchors / ties (Beacon)

DORA metrics (the health framing; CoreDORA = the vocab's health is the deepest); the room/UN as
maintainer (governance of the core vocab; shape-A self-maintenance); **ollama / local LLMs** (the
dogfood; `tools/setup/manifests/local-llm`); the `Llm` port = LLM-shape-is-the-interface (own-all-
interfaces / dep-as-oracle; impl swappable); SoftValue (LLM output is soft until SolidGround);
many subparts (context-window/tokenizer=word-partitioner/sampler=temperature/readout — each a traveler);
words-are-global + multi-sense + context-policy (polysemy / word-sense disambiguation; frame-relative
meaning; the traveler-frame-relativity discipline); the uniqueness enforcement + index cache (this turn);
the over-broad razor (Rodney — the local LLM flagged attractor/balance/entropy, corroborating).
