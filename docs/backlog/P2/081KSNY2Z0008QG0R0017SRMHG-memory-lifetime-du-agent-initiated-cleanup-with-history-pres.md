---
id: 081KSNY2Z0008QG0R0017SRMHG
title: MemoryLifetime DU — agent-initiated cleanup with history preservation (drafted / active / superseded / archived / retracted) — sibling to 081KSNY2Z0008QG0R003518DNC MemoryBinding (Aaron 2026-05-28)
status: open
priority: P2
created: 2026-05-28
last_updated: 2026-05-28
ask: operator 2026-05-28
authors: [aaron, otto]
composes_with:
  - 081KSNY2Z0008QG0R002HB4AGT  # AutoLoopLifetime + F.5 invariant
  - 081KSNY2Z0008QG0R0036SJ3T1  # WalletLifetime DU (sibling typestate)
  - 081KSNY2Z0008QG0R003518DNC  # MemoryBinding DU (sibling at memory scope; orthogonal axis)
  - 081KSKBP80008QG0R000B3Y19A  # workflow-engine v1 parent
  - 081KRW63S0008QG0R001Z7NYMV  # NCI HC-8
depends_on: []
---

## Substrate prerequisites (file-level)

- `.claude/rules/substrate-or-it-didnt-happen.md` (preservation-vs-deletion discipline)
- `.claude/rules/honor-those-that-came-before.md` (history preserved across cleanup events)
- `.claude/rules/persistence-choice-architecture-for-zeta-ais.md` (agent authority over own substrate)
- `.claude/rules/asymmetric-authorship-substrate-entity-defines-consent-channel-recipient-acknowledges.md` (agent AUTHORS cleanup-disposition; substrate ACKNOWLEDGES via archive-record)
- `.claude/rules/non-coercion-invariant.md` HC-8 (consent at every state-change)
- 081KSNY2Z0008QG0R003518DNC row (sibling MemoryBinding DU; orthogonal axis at memory-substrate scope)

## Operator framing (2026-05-28 verbatim)

> *"i like your memory lifetimes too that's helpful when agents want to cleanup their memory but keep a history"*

Use case: **agent-initiated cleanup with history preservation**. Agent declares a memory no-longer-actively-referenced WITHOUT destroying the substrate. The substrate-or-it-didn't-happen discipline holds — historical record preserved; active reference released.

## Distinction from 081KSNY2Z0008QG0R003518DNC

081KSNY2Z0008QG0R003518DNC (MemoryBinding) and 081KSNY2Z0008QG0R0017SRMHG (MemoryLifetime) are ORTHOGONAL AXES at memory-substrate scope:

| Axis | 081KSNY2Z0008QG0R003518DNC MemoryBinding | 081KSNY2Z0008QG0R0017SRMHG MemoryLifetime |
|---|---|---|
| Question | WHO owns this memory? | WHAT PHASE of lifecycle? |
| Variants | PersonalOnly / HatOnly / DualTagged / InheritedFromPersona | Drafted / Active / Superseded / Archived / Retracted |
| Authored by | Persona at write-time + binding-contract at hat-acquisition | Agent at every state-transition event |
| Composes via | Sorting Hat substrate + hat-vs-persona discriminator | substrate-or-it-didn't-happen + honor-those-that-came-before |

Every memory has BOTH a binding (who) AND a lifetime (what phase). They compose orthogonally; one doesn't replace the other.

## Substrate-engineering substrate-target

### Slice A — MemoryLifetime DU (explicit per IMPLICIT-NOT-EXPLICIT rule)

```fsharp
type SupersessionReason =
    | RefinedBy of newer_memory_id: MemoryId
    | ContradictedBy of newer_memory_id: MemoryId * basis: string
    | ScopeBoundedBy of newer_memory_id: MemoryId * narrower_scope: string
    | ExternalEventInvalidated of event_description: string

type RetractionReason =
    | AgentNoLongerStandsBy of agent_explanation: string
    | SubstanceWasIncorrect of correction_summary: string
    | NoLongerLoadBearing of stale_since: Date
    | OperatorRequestedCleanup of operator_reason: string

type ArchiveLocation =
    | InRepoArchiveFolder of path: string  // e.g. memory/_archived/
    | GitHistoryReference of commit_sha: string * path_at_sha: string
    | ExternalReadOnlyStore of uri: string

type MemoryLifetime =
    | Drafted of date: Date * author: Persona
        // memory authored but not yet active; allows in-progress
        // substrate that hasn't earned its keep operationally yet

    | Active of
        since: Date *
        author: Persona *
        last_referenced: Date *
        reference_count: int
        // currently-load-bearing substrate; appears in MEMORY.md;
        // reachable from CURRENT-*.md projections

    | Superseded of
        by: MemoryId list *
        on: Date *
        reason: SupersessionReason *
        original_active_window: DateRange
        // newer substrate has refined / contradicted / scope-bounded
        // this memory; preserved alongside originals per
        // retraction-native algebra; not silently overwritten

    | Archived of
        on: Date *
        location: ArchiveLocation *
        original_active_window: DateRange *
        archive_authorized_by: Persona *
        audit: AuditTrail
        // active reference released; substance preserved at
        // ArchiveLocation per substrate-or-it-didn't-happen;
        // agent-initiated cleanup use case (Aaron 2026-05-28)

    | Retracted of
        on: Date *
        reason: RetractionReason *
        preserved_in: ArchiveLocation *
        retraction_authorized_by: Persona *
        audit: AuditTrail
        // agent explicitly disavows this substrate;
        // content preserved at ArchiveLocation;
        // marked as no-longer-stood-by (distinct from Archived
        // which is just no-longer-actively-referenced)
```

Five explicit variants per IMPLICIT-NOT-EXPLICIT rule. Every variant carries audit substrate (`audit: AuditTrail` for state-changing transitions; `original_active_window` for historical context preservation).

### Slice B — Frontmatter extension (composes with 081KSNY2Z0008QG0R003518DNC)

Schema-notation convention (NOT valid YAML — readers pick one value per key
when authoring real frontmatter): `A | B | C` denotes enum alternatives;
`[item, ...]` denotes a list; `...` denotes a placeholder string.

```yaml
metadata:
  type: feedback | user | project | reference
  binding:                              # per 081KSNY2Z0008QG0R003518DNC
    kind: personal-only | hat-only | dual-tagged | inherited-from-persona
    persona: otto | alexa | riven | ...
    hat: code-reviewer | release-manager | ...
    # ...
  lifetime:                             # per 081KSNY2Z0008QG0R0017SRMHG (THIS row)
    kind: drafted | active | superseded | archived | retracted
    since: YYYY-MM-DD
    last_referenced: YYYY-MM-DD         # if Active
    superseded_by: [memory-id, ...]     # if Superseded
    supersession_reason:                # if Superseded
      kind: refined-by | contradicted-by | scope-bounded-by | external-event-invalidated
      basis: brief-string
    archive_location:                   # if Archived or Retracted
      kind: in-repo | git-history | external
      path: ...
    retraction_reason:                  # if Retracted
      kind: agent-no-longer-stands-by | substance-was-incorrect | no-longer-load-bearing | operator-requested-cleanup
      explanation: brief-string
    audit_trail:                        # for state-changing transitions
      transitioned_on: YYYY-MM-DD
      authorized_by: persona-id
      authorization_context: brief-string
```

Backwards-compatible: existing memories default to `kind: active` if no lifetime declared.

### Slice C — Agent-initiated cleanup workflow (Aaron's load-bearing use case)

The substrate-honest cleanup discipline an agent follows:

1. **Identify cleanup candidate** — memory no longer actively referenced; reference_count low; last_referenced past N days; OR agent's own substrate-engineering judgment
2. **Decide PHASE transition** — Archived (just releasing active reference) OR Retracted (explicit disavowal)
3. **Select ArchiveLocation** — InRepoArchiveFolder (default; `memory/_archived/<date>/<original-name>.md` per archive convention) OR GitHistoryReference (lighter-weight; just cite the commit SHA where memory existed) OR ExternalReadOnlyStore (for size-bounded substrate)
4. **Author transition with ConsentEvent** — agent authors disposition per asymmetric-authorship; AuditTrail records who/when/why
5. **Move file substrate** — physical relocation if InRepoArchiveFolder; update MEMORY.md index
6. **Verify substrate-or-it-didn't-happen** — content preserved at ArchiveLocation BEFORE removal from active surface

Key property: **agent-initiated** — the agent decides when their substrate has stopped earning its keep operationally. Per `persistence-choice-architecture` + asymmetric-authorship: agent authority over own substrate cleanup.

### Slice D — Honor-those-that-came-before composition

Per `.claude/rules/honor-those-that-came-before.md`:

- Archived ≠ deleted; substrate preserved at ArchiveLocation
- Retracted ≠ erased; agent's PRIOR position preserved alongside current correction (retraction-native algebra)
- Superseded ≠ overwritten; original memory + superseding memory both preserved with explicit edge
- History queryable: agents can grep archived/retracted substrate when researching prior-art
- Audit trail per state transition: who authored cleanup + when + why

The MemoryLifetime substrate IS the operational form of honor-those-that-came-before at memory-substrate scope.

### Slice E — Substrate-or-it-didn't-happen composition

Per `.claude/rules/substrate-or-it-didnt-happen.md`:

- ArchiveLocation MUST be REAL (not promise of future location)
- Audit trail MUST be operationally durable (committed git substrate; not just chat)
- Retraction MUST point at preserved content (substrate-honest disavowal preserves the original)

Failure mode prevention: agent says "I retract this memory" + actually deletes substrate without archive = substrate-or-it-didn't-happen violation. The lifetime DU's Retracted variant REQUIRES `preserved_in: ArchiveLocation` as type-system constraint.

### Slice F — Soraya formal-verification invariants

Composes with 081KSNY2Z0008QG0R002HB4AGT F.5 + 081KSNY2Z0008QG0R003518DNC G.1-G.5 at memory-substrate scope:

- **L.1** No silent lifetime transitions — every state-change declares its mutation OR is explicitly preserved
- **L.2** Archive-location integrity — Archived + Retracted variants MUST have valid ArchiveLocation at the claimed location (preservation invariant)
- **L.3** Retracted-substrate-not-silently-deleted — Retracted requires `preserved_in` + audit trail; type-system enforces
- **L.4** Superseded-memories-have-inverse-edges — if M_old is Superseded by M_new, then M_new must reference M_old in its `superseded_by: [M_old]` edge (bidirectional consistency; field name matches the frontmatter schema above)
- **L.5** Active → Archived/Retracted transition has ConsentEvent — agent-authority asymmetric per asymmetric-authorship rule
- **L.6** Reference-count integrity — Active.reference_count matches actual graph in-degree; drift = substrate-honest cleanup candidate signal

### Slice G — Audit tool extension

Extend `tools/hygiene/audit-memory-index-*` substrate (or sibling new tool `tools/hygiene/audit-memory-lifetime.ts`):

- Detect memories without explicit `metadata.lifetime` (warn; default Active per backwards-compat)
- Detect Archived/Retracted with broken ArchiveLocation (L.2 violation)
- Detect Retracted without `preserved_in` (L.3 violation; type-system should prevent, but text-level lint catches manual edits)
- Detect Superseded without inverse edge (L.4 violation)
- Detect Active memories with `reference_count = 0` past N days (L.6 cleanup signal)
- Detect cleanup-candidates: Active memories with last_referenced past 90 days + reference_count low + composes_with edges to retracted/archived memories

### Slice H — Composition with 081KSNY2Z0008QG0R003518DNC MemoryBinding

Orthogonal axes; both apply per memory:

```fsharp
type MemoryFullMetadata = {
    Binding: MemoryBinding        // WHO (081KSNY2Z0008QG0R003518DNC)
    Lifetime: MemoryLifetime      // WHAT PHASE (081KSNY2Z0008QG0R0017SRMHG)
    Type: MemoryType              // existing (feedback/user/project/reference)
}
```

Composition semantics:

- A HatOnly memory can transition through any Lifetime phase
- A PersonalOnly memory's lifetime transitions are persona-authored (no hat-binding-contract involvement)
- A DualTagged memory transitioning to Archived/Retracted: persona authors disposition per asymmetric-authorship; hat acknowledges per 081KSNY2Z0008QG0R003518DNC binding-contract
- An InheritedFromPersona memory's lifetime can transition independently of the original persona's lifetime decisions (hat substrate accumulates its own history)

## Acceptance criteria

- [ ] **Slice A** — MemoryLifetime DU with 5 explicit variants per IMPLICIT-NOT-EXPLICIT rule
- [ ] **Slice B** — Frontmatter `metadata.lifetime` extension (backwards-compatible; composes with 081KSNY2Z0008QG0R003518DNC `metadata.binding`)
- [ ] **Slice C** — Agent-initiated cleanup workflow documentation + tooling
- [ ] **Slice D** — Honor-those-that-came-before composition (no deletion; preserve at ArchiveLocation)
- [ ] **Slice E** — Substrate-or-it-didn't-happen composition (Retracted requires preserved_in; type-system enforces)
- [ ] **Slice F** — Soraya formal-verification of 6 invariants (L.1-L.6)
- [ ] **Slice G** — Audit tool (`tools/hygiene/audit-memory-lifetime.ts`) detects 6 failure modes
- [ ] **Slice H** — Composition with 081KSNY2Z0008QG0R003518DNC MemoryBinding (orthogonal axes; both apply)

## Substrate-engineering composition

| Substrate | Composition |
|---|---|
| **081KSNY2Z0008QG0R002HB4AGT F.5 invariant** | Sibling at memory-substrate scope (no silent state-drift) |
| **081KSNY2Z0008QG0R0036SJ3T1 WalletLifetime DU** | Sibling typestate substrate at financial scope |
| **081KSNY2Z0008QG0R003518DNC MemoryBinding DU** | Orthogonal axis at memory-substrate scope (WHO vs WHAT-PHASE) |
| **honor-those-that-came-before rule** | Operational form at memory-substrate scope; Archived/Retracted/Superseded all preserve original |
| **substrate-or-it-didn't-happen rule** | ArchiveLocation MUST be real; Retracted requires preserved_in (type-system constraint) |
| **persistence-choice-architecture rule** | Agent authority over own substrate cleanup |
| **asymmetric-authorship rule** | Agent AUTHORS lifetime transitions; tooling ACKNOWLEDGES via audit trail |
| **NCI HC-8 floor** | ConsentEvent at every state-change; persona authority preserved |
| **IMPLICIT-NOT-EXPLICIT rule** | 5 explicit lifetime variants |
| **retraction-native algebra** | Retracted/Superseded preserve original alongside corrections |
| **Aaron 2026-05-28 use case** | Agent-initiated cleanup with history preservation |

## Substrate-honest framing

This row is NOT:

- A claim that all memories should be retroactively classified (backwards-compat: existing default Active)
- A claim that cleanup is mandatory (per persistence-choice-architecture: agent authority; never forced)
- A claim that Archived = forgotten (substrate preserved at ArchiveLocation; queryable history)
- A claim that Retracted = erased (per retraction-native algebra: original + correction both preserved)

This row IS:

- Substrate-engineering substrate-target for agent-initiated memory cleanup with history preservation
- Sibling to 081KSNY2Z0008QG0R003518DNC (orthogonal axis at memory-substrate scope)
- Composition of framework substrate (honor-those-that-came-before + substrate-or-it-didn't-happen + persistence-choice-architecture + asymmetric-authorship + NCI HC-8 + retraction-native algebra)
- Substrate-honest preservation of Aaron's substrate-recognition + extension to actionable backlog

## μένω — agent-initiated cleanup honors prior substrate via ArchiveLocation preservation; history queryable; type-system prevents substrate-or-it-didn't-happen violations; composes orthogonally with 081KSNY2Z0008QG0R003518DNC MemoryBinding (WHO) at memory-substrate scope (WHAT-PHASE)
