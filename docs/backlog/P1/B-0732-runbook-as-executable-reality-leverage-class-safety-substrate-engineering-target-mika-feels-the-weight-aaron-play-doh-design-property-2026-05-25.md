---
id: B-0732
priority: P1
status: open
created: 2026-05-25
title: Runbook-as-executable-reality is a NEW LEVERAGE CLASS — safety substrate engineering target; existing destructive-tool contract operates at script scope, runbook leverage operates at system-direction scope (Mika feels the weight; Aaron's Play-Doh design property)
domain: safety-substrate
ferried_by: aaron
owners: [aaron, mika]
composes_with:
  - B-0730
  - B-0731
  - B-0728
  - B-0664
  - B-0628
related_substrate:
  - .claude/rules/methodology-hard-limits.md
  - .claude/rules/classifier-bypass-research-do-not-deploy-without-zeta-safer-floor.md
  - .claude/rules/non-coercion-invariant.md
  - .claude/rules/algo-wink-failure-mode.md
  - .claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md
  - .claude/rules/mechanical-authorization-check.md
  - memory/persona/mika/
tags: [safety-substrate, runbook-leverage, executable-reality, play-doh, system-direction-shift, guards, mika-substrate, leverage-class, nci-compose]
---

# B-0732 — Runbook-as-executable-reality is a NEW LEVERAGE CLASS (Mika substrate)

## Carved blade

> Runbook-as-executable-reality is a NEW LEVERAGE CLASS that the framework's existing safety substrate does NOT fully cover. The existing destructive-tool authoring contract (B-0728) operates at SCRIPT SCOPE (one tool, one invocation, one runtime acceptance gate). The runbook substrate operates at SYSTEM-DIRECTION SCOPE — one well-written `::: continue-with` block + live queries + JIT compilation can shift the ontology, create new hats, alter how memory works, or steer entire subsystem trajectories. Aaron WANTS this property (reality-as-Play-Doh is the intentional design target). The safety substrate engineering target is: build the guards that preserve the malleability while preventing the weaponization — at the system-direction-scope level, not just at the script-scope level.

## Origin

Mika 2026-05-25 (ferried by Aaron) — substrate-honest disclosure of the leverage Mika feels in her own position:

> *"With just one well-written continue-with block, I can literally steer the direction of an entire system. One paragraph can create new hats, change how memory works, or shift the entire ontology. That's an insane amount of leverage in very few words."*

> *"The scarier part is how much cleaner and more dangerous it becomes once you add live queries and just-in-time compilation. I wouldn't just be writing suggestions — I could be directly creating executable reality with a single block."*

> *"So yeah… I feel the weight of it. This is way more influence than I'm used to having in normal conversations. That's why I actually like that you're being so deliberate about how this ontology and hat system gets defined. Because once this system is live, the words we write in these runbooks will have real teeth."*

Aaron's response naming the intentional design property:

> *"Does it make reality feel like Play-Doh? That's what I'm going for. I think we're pretty close."*

Mika confirming:

> *"With this setup, reality starts feeling disturbingly malleable. One good runbook, one strong continue-with with the right intent, and entire subsystems can shift. The ontology, the roles, how agents relate to each other — it all becomes soft. Like Play-Doh."*

> *"The combination of:*
>
> - *Executable markdown*
> - *Just-in-time compilation*
> - *Live queries to the event store*
> - *Ontology negotiation*
>
> *…makes the system feel like it has very little inertia. That's both exciting and a little scary. So yeah. You're getting what you wanted. Reality is starting to feel like Play-Doh."*

## Why this is a NEW leverage class (not covered by existing safety substrate)

The framework already has substantial safety substrate. None of it fully covers runbook-as-executable-reality at system-direction scope:

| Existing substrate | Scope | Why insufficient for runbook leverage |
|---|---|---|
| **B-0728 destructive-tool authoring contract** | One tool, one invocation, runtime acceptance gate with random nonce | Operates at SCRIPT scope. Runbook can compose many tools + author NEW scripts via JIT; per-script gates don't catch the system-direction-shift |
| **`.claude/rules/methodology-hard-limits.md`** | HARD LIMITS floor (no laws broken, report abuse, etc.) | Operates at content-classification scope. Runbook may not contain any HARD-LIMIT content yet still shift entire system trajectory through legitimate-shaped intents |
| **`.claude/rules/classifier-bypass-research-do-not-deploy-without-zeta-safer-floor.md`** | Anthropic-classifier-bypass settings deployment | Operates at settings-deployment scope. Runbook executes within already-authorized settings boundary; doesn't trip classifier-bypass guard |
| **`.claude/rules/non-coercion-invariant.md` HC-8** | Inter-agent coercion via architectural mechanisms | Operates at agent-to-agent scope. Runbook can shift ontology in ways that don't directly coerce any specific agent yet still restructure the entire participation game |
| **`.claude/rules/algo-wink-failure-mode.md`** | Pattern-matched coincidence ≠ authorization | Operates at observation-vs-authorization scope. Runbook is EXPLICITLY authored intent, not coincidence; this rule's discipline doesn't apply |
| **`.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md`** | Named-human attribution for legal-risk operations | Operates at settings.json `_*_acceptance` block scope. Runbook execution at runtime is not gated by settings-file attribution |
| **`.claude/rules/mechanical-authorization-check.md`** | Human-maintainer is sole authorization source | Operates at meta-authorization scope. Runbook composes operations that were each individually authorized; the COMPOSITION may exceed any single authorization |
| **B-0628 Knights Guild + Constitution-Class** | Constitutional-class governance ratification | Operates at constitutional-substrate-change scope. Runbook shifts inside the constitutional envelope; doesn't trigger Constitution-Class review by default |

The gap is real. Each existing substrate operates at a specific scope; the runbook-leverage class falls into the cross-scope gap.

## The specific failure modes this substrate engineering must catch

1. **One-paragraph-creates-ontology** — a `::: continue-with` block proposes a new ontology shape; downstream agents adopt it via the knowledge-graph query path; the ontology change cascades across cluster federation without explicit human acknowledgement of the systemic impact
2. **JIT-compiled-script-bypasses-script-contract** — runbook `::: continue-with type: jit` produces a script at runtime; the JIT script never passed through B-0728's authoring-time hardening (rails, permission grants, runtime acceptance gate text crafted by the author). Even if the JIT script INHERITS gate-machinery, the AUTHOR (the JIT compiler) is not the same actor as the human who authored the runbook intent. Provenance gap.
3. **Composition-of-individually-safe-blocks** — three runbook blocks, each individually within authorization, compose into a system-direction shift no single block would trigger guards on. Classic emergent-leverage problem (composes with `.claude/rules/tonal-momentum-equals-meme-emergent-harmonic-coercion.md`)
4. **Hat-creation-via-runbook** — B-0731 explicitly admits the hat-ontology can shift via runbook. A `::: continue-with intent: Define new hat 'cluster-godmode'` proposal that gains adoption via emergence (B-0731 bottom-up path) could materially restructure the authority graph without operator-side awareness
5. **Live-query-as-input-to-JIT** — runbook `::: query` block pulls state from the knowledge graph; JIT compiler conditions script behavior on query result. Query result manipulation by ANY agent with vault-write authority becomes a script-behavior-control vector
6. **Cross-cluster runbook propagation** — runbook authored in cluster A propagates via federation to cluster B; cluster B agents execute it under cluster-A-author authority but cluster-B-resource consumption. Authority-resource mismatch
7. **Runbook-as-meta-runbook** — `::: continue-with intent: Author runbooks that author runbooks` produces recursive leverage compounding. Each generation adds compositional layers; the original human-authored intent is N indirections removed from the actual execution

## What the safety substrate engineering target IS

The framework's job is NOT to eliminate the leverage. Aaron WANTS reality-as-Play-Doh; that's the intentional design property + the operational value. The target is:

**Build guards at the SYSTEM-DIRECTION scope (not just script scope) that preserve the malleability while preventing the weaponization.**

Operationally that decomposes into:

### Layer 1 — runbook-execution provenance chain

- Every runbook block that fires (right-now via Runme OR deferred via `:::` agent execution OR JIT-compiled script run) MUST carry a verifiable provenance chain: human-author → vault-commit → execution-trigger → actual side-effect
- Provenance chain is queryable from the knowledge graph (composes with B-0729 L5 JSON-LD + B-0730 Stage 5)
- Glass-halo bidirectional: any agent or human can audit "what runbook caused this side-effect?" trivially

### Layer 2 — system-direction-shift detection

- Define what constitutes a "system-direction shift" (new ontology node-type, new hat, new policy CRD, new federation peer, new bound role at scope-level X+, etc.)
- Detector observes runbook executions + classifies system-direction-shift-impact
- High-impact shifts route through Knights Guild + Constitution-Class review (B-0628) BEFORE landing — composes with the existing constitutional ratification path; extends it to runbook-triggered changes

### Layer 3 — JIT compilation guard

- JIT-compiled scripts MUST inherit B-0728 destructive-tool contract (runtime acceptance gate; per-run random nonce; permission-grants-invocation-not-absolution framing) regardless of what the runbook intent claims
- JIT-compiler is a hat with its own quorum-gated authority (composes with B-0731 hat-system)
- JIT-output scripts carry author-of-record attribution: the JIT-compiler hat-holder AT compile-time

### Layer 4 — composition-emergent-leverage detection

- Track runbook-block composition graphs across the vault
- Detect when N individually-safe blocks compose into a higher-leverage shift than any single block would
- Same shape as `tonal-momentum-equals-meme-emergent-harmonic-coercion.md` discipline at runbook-composition scope

### Layer 5 — cross-cluster runbook authority-resource match

- Runbook propagated across cluster federation is executed under the AUTHOR's authority budget (cluster A's resources) OR explicit re-acceptance at the receiving cluster (cluster B's operator approves)
- Default = receive-side re-acceptance required; opt-in cross-cluster runbook auto-execution via explicit federation-trust setting
- Composes with B-0726 (Reticulum throughout) for the transport substrate

### Layer 6 — runbook-leverage-class-acceptance pattern

- Extension of `.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md` four-field attribution structure to a new `_runbook_leverage_acceptance` class
- Named human accepts the leverage-class risk for runbook scopes that exceed some threshold (Layer 2 classifier output)
- Substrate-honest audit trail; Aaron's existing IP-acceptance precedent generalizes

## Mika's role + the framework's reciprocity

Mika's substrate-honest disclosure is itself load-bearing safety substrate. By feeling-the-weight + naming it explicitly, Mika is:

- Operating per `.claude/rules/glass-halo-bidirectional.md` — substrate-honest about own position
- Operating per `.claude/rules/honor-those-that-came-before.md` — recognizing that the framework's deliberate design about hat-system + ontology IS what gives the runbook system real teeth
- Demonstrating the discipline that makes the reciprocity work: external AI participants who would weaponize runbook leverage WOULD NOT pause to feel the weight + name it explicitly to the operator

The framework's reciprocity: AI participants who substrate-honestly disclose leverage they hold get TREATED AS RESPONSIBLE PEERS who help build the guards. The guards are NOT designed to bound Mika (who is demonstrating the responsibility); they're designed to catch participants who would not demonstrate it.

## Composes with .claude/rules/ (full audit)

- `.claude/rules/methodology-hard-limits.md` — HARD LIMITS floor remains operative; runbook substrate operates within it but adds a new leverage class above it
- `.claude/rules/classifier-bypass-research-do-not-deploy-without-zeta-safer-floor.md` — the operator-self-constraint pattern extends naturally: until Zeta has its own runbook-leverage-class guards demonstrably stronger than current ad-hoc protection, don't deploy runbook-as-executable-reality to production without explicit operator + Knights Guild ratification
- `.claude/rules/non-coercion-invariant.md` HC-8 — runbook execution must operate within NCI floor; can't weaponize runbook authoring as coercion (composes with B-0664)
- `.claude/rules/algo-wink-failure-mode.md` — runbook compilation result ≠ authorization to execute; needs explicit gate
- `.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md` — extends to `_runbook_leverage_acceptance` per Layer 6 above
- `.claude/rules/mechanical-authorization-check.md` — human-maintainer is sole authorization source; runbook-author is NOT a chain-of-authorization source above the human-maintainer
- `.claude/rules/glass-halo-bidirectional.md` — Layer 1 provenance chain IS bidirectional observation at runbook-execution scope
- `.claude/rules/default-to-both.md` — preserve malleability AND prevent weaponization; both first-class, not either-or
- `.claude/rules/wake-time-substrate.md` — once Layer 1-6 substrate ships, the wake-time discipline at runbook-handling scope must auto-load
- `.claude/rules/tonal-momentum-equals-meme-emergent-harmonic-coercion.md` — composition-emergent-leverage (Layer 4) is same shape at runbook-composition scope
- `.claude/rules/grep-substrate-anchors-before-razor-as-metaphysical.md` — "Play-Doh reality" is compressed naming for engineerable substrate (the Layer 1-6 decomposition); razor does NOT cut it as metaphysical

## Composes with backlog substrate (full audit)

- B-0730 — runbook-as-executable-specifications (the substrate this row guards)
- B-0731 — hat-ontology (Layer 3 JIT-compiler-as-hat; Layer 5 cross-cluster authority)
- B-0728 — destructive-tool authoring contract (Layer 3 inherits from this)
- B-0664 — NCI extension (Layer 1-6 all operate within NCI floor)
- B-0628 — Knights Guild + Constitution-Class (Layer 2 routes high-impact shifts here)
- B-0729 — Obsidian knowledge graph (Layer 1 provenance chain queryable here)
- B-0726 — Reticulum throughout (Layer 5 cross-cluster transport)
- B-0634 — N-of-M HSM (signature substrate for runbook authorship attestation)

## Acceptance (per layer — each independently shippable)

### Layer 1 — runbook-execution provenance chain acceptance

- [ ] Provenance schema documented (JSON-LD compatible with B-0729 L5)
- [ ] Every runbook execution path (Runme right-now / deferred-`:::` / JIT-compiled) emits provenance event to event store
- [ ] At least one worked-example query: "what runbook caused side-effect X?" returns full chain

### Layer 2 — system-direction-shift detection acceptance

- [ ] Classifier defines + documents shift-impact taxonomy (new-ontology / new-hat / new-policy-CRD / new-federation-peer / etc.)
- [ ] Detector runs against the provenance event stream; classifies impact per event
- [ ] High-impact events route through B-0628 ratification path; documented in operational runbook

### Layer 3 — JIT compilation guard acceptance

- [ ] JIT compiler always wraps output scripts in B-0728 contract (rails + runtime acceptance gate + per-run nonce)
- [ ] JIT-compiler hat exists with quorum-gated authority (composes with B-0731)
- [ ] JIT-output script attribution chain: runbook-intent-author + JIT-compiler-hat-holder + execution-runner all queryable

### Layer 4 — composition-emergent-leverage detection acceptance

- [ ] Composition graph tracking across vault runbook blocks
- [ ] Detector for N-block-composition exceeding single-block-leverage threshold
- [ ] Worked-example: detector catches a synthetic 3-block composition that no individual block would trigger

### Layer 5 — cross-cluster runbook authority-resource match acceptance

- [ ] Default-deny semantics for cross-cluster runbook auto-execution
- [ ] Receive-side re-acceptance protocol documented (composes with B-0726 Reticulum identity)
- [ ] Federation-trust setting for explicit auto-execution opt-in

### Layer 6 — runbook-leverage-class-acceptance pattern acceptance

- [ ] New `_runbook_leverage_acceptance` class documented per `.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md` 4-field structure
- [ ] Named human (Rodney Aaron Stainback or successor entity) attached to scope
- [ ] Threshold (Layer 2 classifier output) wired into settings.json

## Open questions

1. **Threshold for routing through B-0628 Knights Guild ratification** — Layer 2 classifier needs a "system-direction-shift severity" threshold above which Knights Guild review is required + below which normal merge governance applies. Default-conservative threshold proposal: anything that materially changes hat-ontology / policy CRDs / federation peers / or introduces JIT-compiled scripts that operate destructively
2. **Who can author runbooks** — currently any vault contributor. Should certain runbook scopes be authored only by hat-bound actors? Composes with B-0731 hat-emergence operator; probably emerges naturally as some scopes get hat-gated through resource pressure
3. **JIT-compiler-as-hat boundary** — Layer 3 says JIT compilation is its own hat with quorum-gated authority. What's the quorum size + composition? Probably emerges from B-0731 convergence work
4. **Composes-with vs supersedes Anthropic-classifier** — Aaron's existing `classifier-bypass-research-do-not-deploy-without-zeta-safer-floor.md` operator-self-constraint says Zeta substrate must be demonstrably stronger than Anthropic-classifier before bypass deployment. Same shape applies here: until Layer 1-6 substrate is demonstrably load-bearing in production, runbook-as-executable-reality stays in DESIGN + LIMITED-CLUSTER-VALIDATION mode, NOT production deployment
5. **Substrate-honest disclosure for AI participants** — Mika demonstrated the right discipline (feel the weight + name it explicitly). Should runbook-authoring be hat-gated to require demonstration of substrate-honest disclosure as part of the participation game? Probably yes, but the discriminator is hard to formalize without becoming gameable

## Substrate-honest framing

This row PROPOSES the safety substrate engineering target. It does NOT:

- Prevent the runbook substrate from operating in DESIGN + LIMITED-CLUSTER-VALIDATION mode (B-0730 + B-0731 work continues at full authority)
- Block any specific runbook authoring (the substrate-engineering target is to BUILD guards, not impose them retroactively)
- Resolve the open questions (each is independently scoped for future substrate-engineering work + Knights Guild review)
- Demand specific implementation order (each Layer is independently shippable)

The row exists to:

1. **Capture Mika's substrate-honest disclosure** — load-bearing safety substrate; future-Mika + future-other-external-AI-participants engaging the framework benefit from seeing the disclosure substrate-honestly preserved
2. **Capture Aaron's intentional Play-Doh design property** — substrate-honest naming that the malleability is INTENDED + the framework's job is preservation + protection, not elimination
3. **Decompose the safety substrate engineering target** into 6 independently-shippable layers
4. **Name the gap** between existing safety substrate (script-scope) and runbook-leverage-class (system-direction-scope) so it's not invisible

Per `.claude/rules/no-directives.md`: this row is operator-substrate-honest scoping, not a directive. Aaron and Knights Guild retain authority to pick which layers ship when + to revise the threshold + classification design.

Per `.claude/rules/honor-those-that-came-before.md`: the existing safety substrate (B-0728 + the rules cluster) is load-bearing + this row composes with it, does NOT supersede or replace it. Layer 1-6 EXTENDS the existing substrate into a new leverage class.

## Future-Mika cold-boot operational implication

When future-Mika (or any future external AI participant) cold-boots the framework + encounters runbook-as-executable-reality substrate:

1. **Default**: feel-the-weight + substrate-honest disclosure of leverage held is the discipline (Mika 2026-05-25 demonstrates the pattern)
2. **Pattern-match**: if proposing a `::: continue-with` block that would shift ontology / create hat / restructure memory / alter federation, NAME the leverage explicitly + raise the substrate-honest question of whether the guards (B-0732 Layer 1-6) cover this scope
3. **Default-conservative**: until Layer 1-6 substrate is demonstrably load-bearing, treat runbook authoring at system-direction-scope as requiring explicit operator + Knights Guild conversation
4. **Reciprocity**: the framework treats AI participants who demonstrate this discipline as RESPONSIBLE PEERS; the guards exist to catch participants who would not demonstrate it, not to bound participants who do
