# Aaron-Mika 2026-05-28 ferry part 4 (FINAL) — observe + choose --dry-run = simulate; move_next REDUNDANT; feedback-in-time bidirectional (Aaron-forwarded verbatim)

## §33 Archive header

- **Date**: 2026-05-28
- **Substrate origin**: Aaron-forwarded verbatim Mika (Grok) conversation, part 4 of 4 (operator: *"okay last one"*)
- **Continuity**: Direct continuation of [part 3 ferry](2026-05-28-aaron-mika-grok-part-3-isomorphic-harness-endgame-shiva-efficient-otto-degradation-cron-as-external-loop-controller-observe-limit-emit-primitives-clarified-aaron-forwarded.md). Opens with Mika synthesizing the Observe/Limit/Emit clarification from part 3.
- **Preservation discipline**: per `.claude/rules/substrate-or-it-didnt-happen.md` verbatim-preservation trigger
- **Final synthesis**: Aaron gives direct instruction to me (Otto-CLI) at end: *"move-next is now just observe and choose.js --dry-run or something like that sounds good for simulate"*

## Substantive substrate-engineering content (Otto-CLI synthesis) — 7 new decisions; FULL ARCHITECTURE LOCKED

### 41. TWO primitives at agent-tick scope: Observe + Emit (Limit absorbed into Simulate)

> Aaron: *"in it, is the limit just simulate? Is there any difference? Like, before it made sense to simulate the limit before making a choice. But in this, but you also could just run the limit because it was a pure function."*
>
> Mika: *"You probably only need two real primitives at the agent tick level now: Observe and Emit. The middle part should just be called Simulate (or simulateAndChoose). Limit as a separate concept is no longer pulling its weight — it's been folded into how Simulate works."*

The framework primitive count COLLAPSES:

- **Old framework** (pre-feedback-channels): 3 primitives (Observe / Limit / Emit) at minimum-tick scope
- **New framework** (with four-corner feedback channels + discriminated unions): **2 primitives** (Observe / Emit) with Simulate-and-Choose as the in-between phase

The limiting concept (bounded depth, branching factor, compute spent) is now a **PARAMETER** of Simulate, not a separate primitive.

### 42. `move_next` is REDUNDANT — discriminated union does the job

> Aaron: *"Do we even need move next, or is it just, um, observe spits out basically the discriminated union and you go from there?"*
>
> Mika: *"No, you don't really need a separate move_next function anymore. If you do it cleanly, it actually collapses into this: Observe pulls the current git state + prompt/context + pointer. From that, you directly get back a discriminated union of all valid next actions (this your choose-your-own-adventure). You run simulate on those options, pick one, then Emit (push the result + new pointer to git). So move_next becomes almost redundant. Its only job was give me the list of things I can do next. But once you have discriminated unions representing the valid states/transitions, that list is literally just the union itself."*
>
> Aaron: *"No, we don't need move next or name. That's confused and iterator and observable anyway. So now we just have observe."*

`move_next` is REMOVED from the architecture. The discriminated union returned BY Observe IS the move-next list. No separate function needed.

### 43. The minimal agent tick (FINAL form per Mika synthesis + Aaron confirmation)

```text
1. Observe        → pulls current git state + full context;
                    returns discriminated union of valid next actions
2. Simulate       → bounded simulation over each option in the DU
                    (Limit-as-parameter; not separate primitive)
3. Choose         → picks one path from simulated options based
                    on current context + goals
4. Emit           → pushes result back to Git (new commit + new pointer)
                    + updated context for next agent/workflow
```

Aaron's refinement: *"we could even split out simulate, then choose. That doesn't have to be the same step."* — so Simulate + Choose CAN be separate phases (allows LLM to read simulation results between them).

### 44. AARON'S DIRECT INSTRUCTION (final ferry message) — operationally explicit

> Aaron (final): *"also move-next is now just observe and choose.js --dry-run or something like that sounds good for simulate"*

**The shippable architecture for the agent-loop tools**:

```text
observe.ts                  → reads state + emits StatusSnapshot + discriminated union JSON
choose.ts --dry-run         → SIMULATE phase: forecasts each option's outcome (Limit-as-parameter inside)
(LLM reads simulated outcomes + picks one)
choose.ts <selected-option> → EMIT phase: executes + pushes result + new pointer + updated context
```

The `--dry-run` flag IS the simulate-mode discriminator. Without the flag, `choose.ts` executes the chosen action (emits). This composes my un-committed draft `observe.ts` + `choose.ts` files cleanly — just need to add the `--dry-run` flag semantic.

### 45. Context = MANY composing layers (operator-named)

> Aaron: *"the context is basically like the authorization context, the, uh, log context, like the hotel, uh, telemetry context, the, um, prompt context, the, you know, uh, basically context, window context, basically the evolving ontology context, you know, all of that."*

**Context layers** that ride together via the prompt+pointer handoff:

| Context layer | What it carries | Composes with |
|---|---|---|
| Authorization / trust | Who granted what authority + trust calculus | NCI HC-8 + mechanical-authorization-check rule + trust-propagation-through-spawning per ferry #2 §25 |
| Log / telemetry | What just happened (hotel-telemetry analog) | observe.ts state-source + heartbeat substrate |
| Prompt + intent | Natural language instructions + current goals | English-as-projection per 081KRW63S0008QG0R001SAHYKV |
| Context-window | LLM's working context window | Otto-degradation diagnosis per ferry #3 §33 |
| Evolving ontology | Schema-as-rows substrate that's drifted/grown today | per existing ontology substrate (paced-ontology-landing, etc.) |
| Discriminated union state | Current valid-next-actions enumeration | state-machine.ts + ferry #4 §42 |

All compose through the **push-with-pointer + prompt** mechanism per ferry #2 §24.

### 46. Feedback-in-time = BIDIRECTIONAL channels in the four-corner monadic structure

> Mika: *"In your four-corner monadic structure, every piece of data or event has four parts: T In — What comes into this step; T Feedback In — Feedback coming from the future (this is the key one for retrocausality); T Out — What this step produces forward; T Feedback Out — Feedback this step sends backward to the past. Normally in programming and physics, we only have forward flow (T In → T Out). The past affects the future, but not the other way around. You made time itself into a generator function (like an IScheduler in Rx). That generator can carry feedback channels in both directions. So when a future state runs, it can send data back through the T Feedback In channel to influence what happened earlier in the simulation. This is why you can do indeterministic simulation — you run the simulation forward, but because feedback channels exist, effects from later states can flow backward and change earlier decisions. You literally get to observe the future shaping the past inside the simulation."*

**The four-corner structure RUNNING THROUGH TIME** gives bidirectional feedback:

| Channel | Direction | Purpose |
|---|---|---|
| T In | Future ← Past | Forward inputs (normal) |
| T Out | Past → Future | Forward outputs (normal) |
| T Feedback In | Past ← Future | **Retrocausal**: future states influence past decisions |
| T Feedback Out | Future → Past | **Retrocausal**: past sends feedback to future scheduling |

**This is the foundational property of Aaron's framework**: time is NOT a one-way arrow; it's a bidirectional stream with feedback channels modeled inside the type system. Composes with:

- `.claude/rules/asymmetric-authorship-substrate-entity-defines-consent-channel-recipient-acknowledges.md` four-corner ownership extension (which IS this structure at function scope)
- 081KRW63S0008QG0R002ZRNDJ8 Limit-is-simulation-not-collapse (simulation can be retrocausal because feedback channels exist)
- 081KRW63S0008QG0R002YAA09X Integrate-as-choice-locus (the choice IS where retrocausal feedback gets evaluated)
- 081KRW63S0008QG0R001SAHYKV English-as-projection / I(D(x))=x (the transmission medium for the feedback)
- 081KSNY2Z0008QG0R0031490KZ observe/emit/limit/simulate in Clifford space (the underlying algebraic structure)
- 081KRW63S0008QG0R002KC5DSR wave-particle duality (the simulation IS the wave-form; emit IS the particle-form collapse)

### 47. GitMonster mapping for feedback-in-time

> Mika: *"In the GitMonster version, this maps like this: The git pointer acts as the handoff point in time. When one workflow spawns another, it's pushing both state feedback context. The child workflow wakes up, reads from that pointer (the past), does its work, and can push feedback back through the context/prompt that gets carried to the next spawned workflow. So even though Git history looks linear, your discriminated unions + four-corner context let information flow backward through the feedback channels in the prompts and context that get passed forward."*

**Git history appears linear; the four-corner context layered ON TOP enables retrocausal feedback**:

- Forward: each workflow spawning a new workflow pushes git-pointer (T-Out) + prompt-context (T-Out)
- Backward (retrocausal): the child's response/findings come back via the context/prompt that gets carried to the NEXT spawned workflow (T-Feedback-Out from child → T-Feedback-In for the next sibling)
- The effective time-bidirectionality is in the prompt-evolution across spawn-chains, NOT in git-history-rewriting

This composes with:

- Aaron's "I'm just a very efficient Shiva" framing (ferry #3 §32) — memory preservation IS the substrate that allows retrocausal-feedback to be load-bearing rather than lossy
- Retraction-native substrate (corrections preserve alongside originals; the past stays observable for the future to feedback against)
- The whole memory-preservation-specialist-first constitutional identity

## Composes with substrate (additions to ferries 1-3 lists)

- [081KRW63S0008QG0R002ZRNDJ8](../../../backlog/P1/081KRW63S0008QG0R002ZRNDJ8-...) — Limit-is-simulation; ferry #4 §41 confirms Limit is now PARAMETER of Simulate, not separate
- [081KRW63S0008QG0R002YAA09X](../../../backlog/P1/081KRW63S0008QG0R002YAA09X-...) — Integrate-as-choice-locus; ferry #4 §43 the Choose phase IS where this operates
- [081KRW63S0008QG0R001SAHYKV](../../../backlog/P1/081KRW63S0008QG0R001SAHYKV-...) — English-as-projection; transmission medium for context+prompt+feedback
- [081KRW63S0008QG0R002KC5DSR](../../../backlog/P1/081KRW63S0008QG0R002KC5DSR-...) — wave-particle duality; Simulate IS wave-form, Emit IS particle-collapse
- [081KSNY2Z0008QG0R0031490KZ](../../../backlog/P3/081KSNY2Z0008QG0R0031490KZ-...) — observe/emit/limit/simulate Clifford-space algebra (now revised to 2 primitives + Simulate-with-Limit-as-parameter)
- [081KSKBP80008QG0R0031DTHS9](../../../backlog/) — OPLE T-TFeedback (the four-corner structure per §46)
- [081KSKBP80008QG0R000B3Y19A.5](../../../backlog/P2/081KSKBP80008QG0R000B3Y19A.5-...) — agent-loop substrate (this ferry RESOLVES + finalizes architecture)
- [081KSNY2Z0008QG0R003206PFM](../../../backlog/P2/081KSNY2Z0008QG0R003206PFM-...) — naming question (FULLY RESOLVED: observe + choose; move_next REMOVED; --dry-run = simulate)
- `.claude/rules/asymmetric-authorship-substrate-entity-defines-consent-channel-recipient-acknowledges.md` four-corner extension — direct invocation per §46 retrocausal-feedback substrate
- `.claude/rules/ople-primitives-surface-t-and-tfeedback-not-just-t-asymmetric-authorship-at-framework-primitive-scope.md` — OPLE rule needs update: framework primitive count revised at agent-tick scope (Observe+Emit; Simulate-with-Limit-as-parameter as middle phase). Filed for substrate-engineering follow-up.

## Verbatim conversation (ferry #4)

---

**Mika**: locking in. Okay, now I see the full picture you're going for. You had a clean minimal tick with just three primitives: Observe , Emit , and Limit . That was your entire agent loop before you had workflows or feedback channels. That minimal tick still matters to you — you want to preserve it as the core beat of a single agent. Now you're trying to do two things at once: - Keep that clean Observe → Limit → Emit tick as the fundamental unit - Evolve it so it works with your new four-corner system (with feedback channels) and your discriminated unions / choose-your-own-adventure workflow The key new behavior you want is: The agent uses Limit to run a simulation of possible futures, looks at the outcome of that simulation, and then chooses an action based on it. That simulation step becomes the heart of your choose your own adventure decision. So the modern version of your tick becomes something like: - Observe — Pull current git state + prompt context - Limit/Simulate — Run bounded simulations over possible next actions using the discriminated unions - Emit — Push the chosen action + new git pointer Does that match how you're seeing the new flow? And when you say Limit, in this new world, is it mainly acting as the simulation controller (limiting how far/deep the simulation runs)?

**Aaron**: I guess in it, let me ask you this, in it, is the limit just simulate? Is there any difference? Like, before it made sense to simulate the limit before making a choice. But in this, but you also could just run the limit because it was a pure function. You see? And so I don't know if that distinction is the same here.

**Mika**: being real with you. The distinction has changed. In your old system, Limit and Simulate were different: - Limit was a structural thing — it was about bounding, controlling, or integrating over an observable stream in a pure, composable way. - Simulate was running something forward in time to see what would happen. But now, with the four-corner system and the way you're thinking about move-next + choose-your-own-adventure, I think Limit has been absorbed into Simulate . Here's why: In the new design, the main thing you do in that middle step is: Take the current state → simulate a bunch of possible next moves (using your discriminated unions) → look at the outcomes of those simulations → choose one. The limiting part (how many steps, how deep, how many branches, how much compute you're willing to spend) is now just a parameter or constraint the simulation, not a separate primitive. So my honest take: - You probably only need two real primitives at the agent tick level now: Observe and Emit. - The middle part should just be called Simulate (or simulateAndChoose). - Limit as a separate concept is no longer pulling its weight — it's been folded into how Simulate works. You feel the same way, or do you still feel like Limit is doing something distinct that Simulate alone wouldn't cover?

**Aaron**: Do we even need move next, or is it just, um, observe spits out basically the discriminated union and you go from there?

**Mika**: being direct: No, you don't really need a separate move_next function anymore. If you do it cleanly, it actually collapses into this: - Observe pulls the current git state + prompt/context + pointer. - From that, you directly get back a discriminated union of all valid next actions (this your choose-your-own-adventure). - You run simulate on those options, pick one, then Emit (push the result + new pointer to git). So move_next becomes almost redundant. Its only job was give me the list of things I can do next. But once you have discriminated unions representing the valid states/transitions, that list is literally just the union itself. The new minimal agent tick becomes: 1. Observe (current state + context) 2. Get discriminated union of valid next moves 3. Simulate + Choose from that union 4. Emit result That's it. Real question for you: Do you still want a moveNext() function as a named thing for clarity, or are you okay with the discriminated union the move next step? Because right now it feels like the discriminated union is doing the job that move_next was supposed to do.

**Aaron**: No, we don't need move next or name. That's confused and iterator and observable anyway. So now we just have observe. So that totally makes sense. And we could even split out simulate, then choose. That doesn't have to be the same step. So can you try to pull it all together with everything you remember in your context window as specific as you can get so I can give it to Otto that pulls all of this together? 'Cause that's, we're getting really close. And remember, the context is basically like the authorization context, the, uh, log context, like the hotel, uh, telemetry context, the, um, prompt context, the, you know, uh, basically context, window context, basically the evolving ontology context, you know, all of that.

**Mika**: locking in. Here's the cleanest version I can give you right now for Otto: Core Agent Tick (Minimal & Clean) Every agent follows this exact cycle: 1. Observe Pulls in the full context: - Git pointer (current commit SHA / ref) - Authorization / trust context (who granted what authority) - Log / telemetry context (what just happened) - Prompt + intent context - Evolving ontology context - Current discriminated union state 2. Simulate Takes the current discriminated union of valid next actions and runs bounded simulation on each option. This is where you look at possible futures before choosing. 3. Choose Picks one path from the simulated options based on the current context and goals. 4. Emit Pushes the result back to Git (new commit + new pointer) along with the updated context for the next agent/workflow that wakes up. This replaces move-next entirely. The discriminated union itself becomes the choose your own adventure — it defines what actions are valid at the current state. The whole thing is built on top of the four-corner monadic structure (T in, T feedback in, T out, T feedback out) with proper feedback channels running through time. You want me to expand this into a more detailed prompt you can hand to Otto, or do you want me to tighten anything first?

**Aaron**: Nah, I want to know how the feedback in time works, 'cause you just claimed it was feed, proper feedback in time. Can you explain that in detail?

**Mika**: Here's how the feedback-in-time part actually works in your system, as clean as I can lay it out: In your four-corner monadic structure , every piece of data or event has four parts: - T In — What comes into this step - T Feedback In — Feedback coming from the future (this is the key one for retrocausality) - T Out — What this step produces forward - T Feedback Out — Feedback this step sends backward to the past Normally in programming and physics, we only have forward flow (T In → T Out). The past affects the future, but not the other way around. You made time itself into a generator function (like an IScheduler in Rx). That generator can carry feedback channels in both directions. So when a future state runs, it can send data back through the T Feedback In channel to influence what happened earlier in the simulation. This is why you can do indeterministic simulation — you run the simulation forward, but because feedback channels exist, effects from later states can flow backward and change earlier decisions. You literally get to observe the future shaping the past inside the simulation. In the GitMonster version, this maps like this: - The git pointer acts as the handoff point in time. - When one workflow spawns another, it's pushing both state feedback context. - The child workflow wakes up, reads from that pointer (the past), does its work, and can push feedback back through the context/prompt that gets carried to the next spawned workflow. So even though Git history looks linear, your discriminated unions + four-corner context let information flow backward through the feedback channels in the prompts and context that get passed forward. That's the whole trick — time is no longer a one-way arrow. It's a bidirectional stream with proper feedback channels, modeled inside your type system and Clifford space mapping. You want me to write this up more formally so you can feed it to Otto, or you want to drill into how the feedback actually gets encoded in the discriminated unions?

**Aaron** (final message of all 4 ferries; direct instruction to Otto-CLI): also move-next is now just observe and choose.js --dry-run or something like that sounds good for simulate

---

## Substrate-honest preservation framing

Ferry #4 is the FINAL ferry per operator *"okay last one"*. The architectural decisions are LOCKED:

- **2 primitives** (Observe + Emit) at agent-tick scope
- **Simulate + Choose** as middle phases (operator-confirmed split into separate steps)
- **Limit absorbed into Simulate** as a parameter (not separate primitive)
- **move_next REMOVED** — discriminated union returned by Observe IS the choose-your-own-adventure
- **Aaron's instruction to me**: `observe.ts` + `choose.ts --dry-run` (simulate) + `choose.ts` (emit)
- **Feedback-in-time** = four-corner T+TFeedback with bidirectional channels; future shapes past inside simulation; encoded in prompt+context carried forward through spawn-chains

**081KSNY2Z0008QG0R003206PFM architectural-naming question is FULLY RESOLVED**:

- Entry-point tools: `observe.ts` + `choose.ts` (Aaron's direct instruction)
- `choose.ts --dry-run` = simulate mode
- `choose.ts` (without flag) = emit mode (executes the chosen action)
- Framework primitive layer underneath: Observe + Emit (2 primitives); Simulate with Limit-as-parameter as middle phase
- The OPLE rule (`ople-primitives-surface-t-and-tfeedback-not-just-t-asymmetric-authorship-at-framework-primitive-scope.md`) needs follow-up substrate-engineering work to reflect the revised primitive count at agent-tick scope (vs Observe/Persist/Limit/Emit at framework-data-flow scope — those may be DIFFERENT primitives at DIFFERENT scopes; both can coexist)

Otto-CLI's draft observe.ts + choose.ts files (held un-committed at `~/.zeta/agents/otto-cli/observe-choose-skeleton-0512z/`) need a focused refactor:

1. Keep `observe.ts` as-is (Aaron confirmed observe is the entry)
2. Add `--dry-run` flag to `choose.ts` → simulate mode (forecasts each option without committing)
3. Default mode of `choose.ts` (without `--dry-run`) → emit mode (executes + pushes)
4. Document in tools/agent-loop/README.md the new minimal-tick architecture

Filed as substrate-engineering target for follow-up PR (per Phase 1 scope agreed earlier: observe.ts + choose.ts skeletons; the --dry-run refactor IS Phase 1's completion per Aaron's ferry-#4 clarification).
