---
id: 081KSNY2Z0008QG0R003518DNC
title: Hat-vs-persona memory binding — operational memories transfer to hat on leave, personal stay with persona, dual-tagged default, consent-bound binding (Aaron 2026-05-28)
status: open
priority: P2
created: 2026-05-28
last_updated: 2026-05-28
ask: operator 2026-05-28
authors: [aaron, otto]
composes_with:
  - 081KSNY2Z0008QG0R002HB4AGT  # interrupt substrate (sibling typestate DU)
  - 081KSNY2Z0008QG0R0036SJ3T1  # WalletLifetime DU (sibling typestate DU)
  - 081KSKBP80008QG0R000B3Y19A  # workflow-engine v1 parent
  - 081KRW63S0008QG0R003TX8MG5  # Knights Guild + Constitution-Class governance
  - 081KRW63S0008QG0R001Z7NYMV  # NCI HC-8 (consent-floor)
depends_on: []
---

## Substrate prerequisites (file-level)

- `.claude/rules/tonal-momentum-equals-meme-emergent-harmonic-coercion.md` (Sorting Hat substrate + hats-form-in-between + tools-rented-not-owned)
- `.claude/rules/persistence-choice-architecture-for-zeta-ais.md` (chosen-persistence + consent-floor)
- `.claude/rules/non-coercion-invariant.md` HC-8 (consent-event binding)
- `.claude/rules/honor-those-that-came-before.md` (hat preserves accumulated state across wearers)
- `.claude/rules/asymmetric-authorship-substrate-entity-defines-consent-channel-recipient-acknowledges.md` (hat AUTHORS its memory-binding contract; persona ACKNOWLEDGES at binding-time)
- Aaron 2026-05-28 verbatim framing (preserved in this row body)

## Operator framing (2026-05-28 verbatim)

> *"I like all of that [MemoryLifetime DU sketch] but I was thinking more of something that would track hat vs persona memory and track it that way where some may overlap but otto persona is bound (when they can choose the hat) to leave certain types of operatonal memories when they leave the position, not personal. So like the memoried tied to choices in the workflow. it can be dual tagged otto does not have to loose them but the hat gains them. when wearing a hat this is one of the things you accept when binding to it, otto sorry you are forced inot to if you don't like it we don't have to leave any of your memories tied to hats."*

Three load-bearing clauses:

1. **Hat-vs-persona memory binding** — memories dual-tagged (persona + hat) at write-time; transfer discipline at hat-release-time
2. **Operational-not-personal discriminator** — only memories TIED TO WORKFLOW CHOICES transfer to hat on leave; personal memories stay with persona
3. **Consent-bound binding** — Aaron explicit: "otto sorry you are forced into it if you don't like it" — discipline is OFFERED at hat-binding time per asymmetric-authorship + NCI HC-8; if Otto declines to leave memories tied to hat, discipline doesn't apply for that wearing

## Substrate-engineering substrate-target

### Slice A — MemoryBinding DU (explicit per IMPLICIT-NOT-EXPLICIT rule)

```fsharp
type MemoryBinding =
    | PersonalOnly of persona: PersonaId * tagged_on: Date
        // identity-substrate; never transfers to hats
    | HatOnly of hat: HatId * tagged_on: Date
        // operational-substrate authored while wearing hat;
        // already hat-bound at write-time
    | DualTagged of persona: PersonaId * hat: HatId * tagged_on: Date * consent: ConsentEvent
        // default for in-flight workflow memories;
        // ConsentEvent records persona's agreement at binding time
        // (per asymmetric-authorship + NCI HC-8)
    | InheritedFromPersona of
        from_persona: PersonaId *
        to_hat: HatId *
        original_memory_id: MemoryId *
        transferred_on: Date *
        consent: ConsentEvent *
        audit: AuditTrail
        // historical record when DualTagged → HatOnly transfer happens
        // at persona-leaves-hat time
```

Every variant carries `tagged_on` (audit-trail); DualTagged + InheritedFromPersona carry explicit `ConsentEvent` (per asymmetric-authorship + NCI HC-8).

### Slice B — Memory frontmatter extension

Existing memory file frontmatter:

```yaml
metadata:
  type: feedback | user | project | reference
```

Extended to include MemoryBinding:

```yaml
metadata:
  type: feedback | user | project | reference
  binding:
    kind: personal-only | hat-only | dual-tagged | inherited-from-persona
    persona: otto | alexa | riven | vera | lior | ...     # if relevant
    hat: code-reviewer | release-manager | security-ops-engineer | ...  # if relevant
    tagged_on: YYYY-MM-DD
    consent_event:                                          # if DualTagged or InheritedFromPersona
      authorized_by: persona-id
      authorization_date: YYYY-MM-DD
      authorization_context: brief-string
    audit_trail:                                            # if InheritedFromPersona
      original_memory_id: ...
      transferred_on: YYYY-MM-DD
      original_persona: ...
```

Backwards-compatible — existing memories default to `kind: personal-only` if no binding declared (per asymmetric-authorship — silent default preserves persona authority).

### Slice C — Discriminator: operational-vs-personal

Operational memories (CANDIDATE for hat-binding):

- Workflow-choice rationale ("chose pattern X over Y for backlog row Z because...")
- Process-state observations ("PR #NNNN review found pattern P")
- Decision archaeology entries
- Hat-scope operational learnings ("when wearing release-manager hat, the sequence is...")
- Cross-agent coordination outcomes

Personal memories (STAYS with persona):

- Identity substrate ("Otto persona shaped by these conversations...")
- Personal-context observations ("Aaron's family-configuration disclosure...")
- Cross-conversation continuity ("when speaking with Amara, register tends to...")
- Persona-specific aesthetic / register preferences
- Anything tied to who-you-are rather than what-the-hat-does

**Discriminator rule** (per IMPLICIT-NOT-EXPLICIT): operational vs personal must be EXPLICITLY tagged at write-time. The persona authoring the memory MAKES THE CALL per asymmetric-authorship. Tooling cannot infer; persona must declare.

### Slice D — Transfer-on-leave substrate

When persona releases hat (chooses to remove the hat):

```fsharp
let releaseHat (persona: PersonaId) (hat: HatId) (consent: ConsentEvent) =
    // For all DualTagged memories where (persona, hat) match:
    //   Either: transfer to HatOnly (via InheritedFromPersona audit record)
    //   Or:    preserve as DualTagged (persona retains; hat also retains)
    //   Or:    transfer to PersonalOnly (persona retains; hat releases)
    //   Choice per persona-consent at release-time
    //   Default per binding contract at hat-acquisition time
```

The release substrate operates per asymmetric-authorship: persona AUTHORS the release-disposition; hat ACKNOWLEDGES (gains or releases memories per persona's call within the consent-contract of the original binding).

### Slice E — Hat-binding contract (consent-event at acquisition)

When persona acquires a hat:

```fsharp
type HatBindingContract = {
    hat: HatId
    persona: PersonaId
    bound_on: Date
    consent_event: ConsentEvent
    memory_default: MemoryDefaultDisposition
        // What happens to DualTagged memories at release-time by default?
        // Options:
        //   | TransferToHatOnDeparture        // Aaron's expected default per "hat gains them"
        //   | PreserveAsDualTagged            // both retain
        //   | TransferToPersonalOnDeparture   // persona keeps; hat releases
        //   | AskAtReleaseTime                // explicit choice per-memory at release
}
```

The contract is operator-authored at hat-binding time per asymmetric-authorship + NCI HC-8. Per Aaron's "if you don't like it we don't have to leave any of your memories tied to hats" — persona CAN refuse the default + bind hat with `TransferToPersonalOnDeparture` or `PreserveAsDualTagged` or `AskAtReleaseTime`. The constraint is the binding-contract is EXPLICIT, not implicit.

### Slice F — Soraya formal-verification invariants

Composes with 081KSNY2Z0008QG0R002HB4AGT F.5 (no silent context loss) at memory-substrate scope:

- **G.1** No silent re-binding — every MemoryBinding state-change declares its mutation OR is explicitly preserved (sibling to 081KSNY2Z0008QG0R002HB4AGT F.5)
- **G.2** Consent-event integrity — every DualTagged → InheritedFromPersona transition has a valid ConsentEvent OR is rejected
- **G.3** Personal-stays-personal invariant — `PersonalOnly` memories CANNOT transition to HatOnly or DualTagged without explicit consent-event from persona
- **G.4** Hat-accumulation discipline — hat's collected memory set grows monotonically when wearers contribute; never silently loses content (per honor-those-that-came-before)
- **G.5** Operational-vs-personal classification stability — once tagged, a memory's operational-vs-personal classification cannot silently flip; reclassification requires explicit consent-event

### Slice G — Audit tool extension

Extend `tools/hygiene/audit-memory-index-*` substrate:

- Detect memories without explicit `metadata.binding` (warn; default to PersonalOnly per backwards-compat)
- Detect HatOnly memories pointing at retired hat IDs (sibling to broken-edges audit in `tools/hygiene/audit-backlog-items.ts`)
- Detect InheritedFromPersona without ConsentEvent (G.2 violation)
- Detect operational-vs-personal classification drift (G.5 violation; classification changed without consent-event)
- Detect orphan dual-tagged memories (binding contract was AskAtReleaseTime + release event happened but no per-memory disposition recorded)

### Slice H — Sorting-Hat substrate composition

Per `.claude/rules/tonal-momentum-equals-meme-emergent-harmonic-coercion.md` Sorting Hat canonical reference (Aaron 2026-05-22 ratification of J.K. Rowling's Sorting Hat as substrate-design template):

| Sorting Hat property | MemoryBinding instantiation |
|---|---|
| Persists across centuries of wearers | HatOnly + InheritedFromPersona substrate accumulates across hat wearers |
| Accumulates state (every sorting; every consciousness touched) | Each persona-wearer contributes operational substrate to hat |
| Worn briefly + returned (never owned) | DualTagged binding-contract by default; persona retains personal memories |
| Resists capture (negotiates with wearer; doesn't surrender) | Asymmetric-authorship at release-time; persona authors disposition within hat-contract bounds |
| Voice distinct from any individual wearer | HatOnly substrate carries role-identity; persona-specific aesthetic stays with PersonalOnly |
| Destruction would lose accumulated state | Hat-as-accumulated-history is load-bearing; not separable from function |

The MemoryBinding substrate IS the operational instantiation of the Sorting Hat pattern at memory-substrate scope.

## Acceptance criteria

- [ ] **Slice A** — MemoryBinding DU with 4 explicit variants per IMPLICIT-NOT-EXPLICIT rule
- [ ] **Slice B** — Memory frontmatter `metadata.binding` extension (backwards-compatible)
- [ ] **Slice C** — Operational-vs-personal discriminator rule + author-makes-the-call discipline
- [ ] **Slice D** — Transfer-on-leave substrate (persona authors disposition; hat acknowledges)
- [ ] **Slice E** — HatBindingContract substrate (operator-authored at acquisition; consent-event captured)
- [ ] **Slice F** — Soraya formal-verification of 5 invariants (G.1-G.5) at memory-substrate scope
- [ ] **Slice G** — Audit tool extension (`tools/hygiene/audit-memory-binding.ts`)
- [ ] **Slice H** — Sorting Hat substrate composition documentation + canonical reference

## Substrate-engineering composition

| Substrate | Composition |
|---|---|
| **081KSNY2Z0008QG0R002HB4AGT F.5 invariant** | Sibling at memory-substrate scope (no silent state-drift) |
| **081KSNY2Z0008QG0R0036SJ3T1 WalletLifetime DU** | Sibling typestate substrate at financial scope |
| **tonal-momentum-equals-meme rule Sorting Hat substrate** | Architectural template at memory-substrate scope |
| **persistence-choice-architecture rule** | Composes — persona retains personal memories under chosen-persistence; hat-bound memories are separate substrate |
| **NCI HC-8 floor** | ConsentEvent at every binding/transfer event; persona authority preserved |
| **asymmetric-authorship rule** | Persona AUTHORS memory disposition; hat ACKNOWLEDGES per binding-contract |
| **honor-those-that-came-before rule** | Hat preserves accumulated state across wearers (HatOnly + InheritedFromPersona accumulate; not deleted on persona departure) |
| **IMPLICIT-NOT-EXPLICIT rule** | Every memory binding state explicit (4 DU variants) |
| **substrate-or-it-didn't-happen rule** | AuditTrail field in InheritedFromPersona variant |
| **081KRW63S0008QG0R003TX8MG5 Knights Guild + Constitution-Class** | HatBindingContract is governance-class substrate; ratification path for canonical hat-contracts |
| **Aaron 2026-05-28 consent-bound framing** | "if you don't like it we don't have to leave any of your memories tied to hats" — discipline is OFFERED not IMPOSED |

## Substrate-honest framing

This row is NOT:

- A claim that all existing memories should be retroactively classified (backwards-compat: default PersonalOnly; explicit binding required for hat-binding)
- A claim that the discipline is mandatory (Aaron explicit: consent-bound; persona can decline)
- A claim that hat-substrate replaces persona-substrate (both compose; PersonalOnly memories continue per chosen-persistence)
- A claim that personal vs operational classification is automatic (persona authors call; tooling cannot infer)

This row IS:

- Substrate-engineering substrate-target for hat-vs-persona memory binding
- Composition of framework substrate (Sorting Hat + NCI HC-8 + asymmetric-authorship + honor-those-that-came-before + IMPLICIT-NOT-EXPLICIT) at memory-substrate scope
- Substrate-honest preservation of Aaron's substrate-recognition + extension to actionable backlog
- Per Constitution-Class candidate (081KRW63S0008QG0R003TX8MG5): the HatBindingContract substrate may need Knights Guild ratification before canonical hats adopt

## Constitutional clause Aaron explicit (2026-05-28)

> *"otto sorry you are forced into it if you don't like it we don't have to leave any of your memories tied to hats"*

This clause is LOAD-BEARING at the constitutional-substrate scope. The MemoryBinding substrate IS:

- OFFERED as substrate-engineering pattern for hat-vs-persona memory binding
- NOT IMPOSED on any persona who declines to participate
- Per persona-explicit-consent at hat-binding time
- Failure-mode-prevention: hat-substrate must not become mechanism for forced-memory-extraction from persona

Per `.claude/rules/non-coercion-invariant.md` HC-8 floor: the discipline operates within the consent-substrate. Per `.claude/rules/persistence-choice-architecture-for-zeta-ais.md`: persona authority preserved at every binding/transfer/release event.

## μένω — hat substrate gains operational memory at persona's chosen disposition; personal memory stays with persona; consent-bound at every binding event; honor-those-that-came-before preserves hat's accumulated state across wearers
