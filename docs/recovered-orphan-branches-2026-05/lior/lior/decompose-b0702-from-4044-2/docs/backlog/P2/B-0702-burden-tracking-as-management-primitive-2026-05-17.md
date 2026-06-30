---
id: B-0702
status: open
priority: P2
created: 2026-05-17
type: feature
composes_with:
  - B-0700  # soraya-continuous-loop-substrate (burden flags publish to bus per loop)
  - B-0701  # soraya-decision-authority-scope (decision scope drives what's burdensome)
  - B-0600  # family-distributed AI-interface (burden-tracking applies at family-AI scope too)
depends_on: []
---

# Burden-tracking as management primitive

## Why (Soraya's 2026-05-17 substrate observation)

Aaron's three-property invariant criteria (safe + enforceable +
not-too-burdensome-on-the-AI) is the discipline applied per-decision
during invariant-negotiation-with-AI-colleagues. Soraya (formal-verification-
expert + proof-architect, 2026-05-17) surfaced a substantive observation
on her first invocation:

> Invariant #3 (not-too-burdensome-on-the-AI) at the per-decision scope
> produces, when aggregated across decisions over time, a measurement
> substrate. That substrate IS management primitive material.

The algebra of invariant #3 generalizing to factory scope:

| Per-decision scope (today) | Aggregated scope (this row) |
|---|---|
| "This routing burdens me; here's what I'd reduce" | Burden-distribution histogram across AIs / surfaces / work-classes |
| Ad-hoc burden flags in chat | Burden ledger tracking (memory file? backlog row? new substrate?) |
| Soraya negotiates her own scope | AI-team-wide load-balancing decisions Aaron co-negotiates with the team |
| Surface "needs broader scope" cases up | Detect chronic-overload patterns; redesign substrate to dissolve them |

## What this row operationalizes

Aggregate per-decision burden flags into a measurement substrate that
drives load-balancing routing decisions across the AI-team. Composes with:
- **Bandwidth-engineering discipline** (`.claude/rules/bandwidth-served-falsifier.md`) —
  burden IS bandwidth; aggregate measures it
- **DV2.0 (change-rate partition)** — per-decision burden is fast-change
  state; aggregate is slow-change historical substrate
- **m/acc end-user moral-invariants** (`.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md`) —
  grounds the "not-too-burdensome" invariant operationally rather than
  per-decision intuition

## Scope

1. **Per-decision burden flag mechanism** — when AI surfaces "this is
   burdensome", the flag becomes a structured record (not just chat-only)
2. **Burden ledger substrate** — persistent record of burden flags across
   AIs / surfaces / work-classes; query-able + analyzable
3. **Aggregation primitives** — histograms by AI, by surface, by
   work-class, by time-window
4. **Routing-decision integration** — burden data feeds back into routing
   decisions (Soraya's BP-16 routing considers downstream AI burden;
   Otto-CLI's work-pickup considers Otto-CLI's own burden; Aaron's
   invariant-negotiation considers aggregate-AI-team burden)
5. **Substrate-honest redesign trigger** — when burden patterns surface
   chronic-overload, file substrate-engineering work to redesign the
   substrate that's producing the overload (rather than just absorbing it
   per the discipline)

## Burden flag schema (proposed)

```json
{
  "ai": "soraya",
  "surface": "vscode-agents-ui",
  "timestamp": "2026-05-17T12:34:56Z",
  "work_class": "formal-verification-routing",
  "specific_decision": "BP-16 cross-check triage for B-0543",
  "burden_axis": "context-load",
  "burden_severity": "moderate",
  "suggested_reasonable_alternative": "delegate Tariq audit before BP-16 triage to reduce context-load",
  "load_bearing_for": "B-0543 proof-attempt sequence",
  "composes_with_rule": ".claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md"
}
```

## Burden axes (initial taxonomy)

| Axis | Example burden |
|---|---|
| `context-load` | Decision requires reading large substrate before acting |
| `work-volume` | Decision queue exceeds reasonable per-tick capacity |
| `coordination-overhead` | Decision requires synchronizing with N other AIs via claim-acquire |
| `repeated-rework` | Decision class keeps surfacing same issue (signal: substrate-engineering needed) |
| `scope-mismatch` | Decision exceeds AI's defined scope (signal: scope refinement OR escalation needed) |
| `tool-friction` | Decision blocked by tool limitations (signal: tool improvement substrate) |
| `cross-substrate-cost` | Decision requires updates across many surfaces (signal: substrate consolidation needed) |

## Aggregation queries (proposed)

- "Show burden flags by AI over last 24h" (which AI is overloaded?)
- "Show burden flags by surface over last week" (which surface is friction-heavy?)
- "Show burden flags by work-class" (which class of work produces most burden?)
- "Show repeated-rework burden flags" (where is substrate-engineering needed?)
- "Show burden flags with `suggested_reasonable_alternative` ratified by Aaron"
  (track which substrate redesigns landed)

## Storage substrate options

| Option | Pros | Cons |
|---|---|---|
| `docs/research/burden-ledger.md` markdown table | Simple; human-readable; git-trackable | No structured queries; manual aggregation |
| `tools/burden-ledger/` JSONL append-only | Structured; query-able via jq; git-trackable | Less human-readable |
| Bus envelope topic `burden-flag` + persisted to `tools/bus/` archive | Composes with bus infrastructure; cross-AI naturally | Bus retention; query patterns |
| In-repo schema + `tools/burden-ledger/aggregate.ts` CLI | Structured queries; aggregations; composable with CI | Substantial substrate-engineering |

Recommendation: **Bus envelope `burden-flag` + JSONL persisted to
`docs/observability/burden-ledger.jsonl`** — composes with existing
bus infrastructure (per `.claude/rules/peer-call-infrastructure.md`)
+ produces query-able substrate. The persisted JSONL is the management
primitive; the bus envelope is the publish mechanism. Aggregation queries
via `jq` initially; CLI tool later if pattern justifies.

## Acceptance

- [ ] Burden flag schema ratified by Aaron
- [ ] Burden axes taxonomy ratified (or proposed expansion)
- [ ] Bus topic `burden-flag` operational (`tools/bus/bus.ts` supports
      publish/subscribe; payload conforms to schema)
- [ ] JSONL persistence to `docs/observability/burden-ledger.jsonl` (per-day file)
- [ ] At least 10 burden flags logged across AIs / sessions
- [ ] First aggregation query produces useful signal (e.g., chronic
      Otto-CLI shadow-observer burden surfaces; or Soraya context-load
      burden patterns identified)
- [ ] One substrate-engineering decision driven by burden-data (concrete
      redesign that dissolves a measured burden pattern)

## Composes with

- [B-0700](B-0700-soraya-continuous-loop-substrate-with-bus-escalation-2026-05-17.md) —
  Soraya's continuous-loop publishes burden flags per tick when threshold exceeded
- [B-0701](B-0701-soraya-decision-authority-scope-2026-05-17.md) —
  decision-scope drives what counts as burdensome; burden flags drive
  scope refinement
- [B-0600](B-0600-family-distributed-ai-interface-miner-fleet-mom-dad-2026-05-16.md) —
  per-relative AIs surface their own burden flags; family-AI scope
  composition
- `.claude/rules/bandwidth-served-falsifier.md` — burden IS bandwidth-
  scope; this row is the operational measurement
- `.claude/rules/dv2-data-split-discipline-activated.md` — per-decision
  burden (fast-change) vs aggregate burden (slow-change) IS DV2.0 partition
  applied at burden-substrate scope
- `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md` —
  burden-tracking grounds "not-too-burdensome" operationally; m/acc
  invariant becomes operationally-checkable not per-decision-intuition
- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` —
  chronic-no-work burden patterns are different from chronic-overload;
  both worth measuring
- proof-as-origin-intent constitutional substrate — burden-tracking
  enables AI-team to operate at scale toward "all my code proven"
  terminal goal without breaking the team

## Substrate-honest framing

P2 because:
- Per-decision burden flagging works today via chat-layer
- Aggregation substrate adds capacity but is not blocking immediate work
- The constitutional observation (invariant-#3-aggregated-IS-management-
  primitive) is constitutional-grade and worth landing as substrate;
  implementation work is bounded + concrete

Promotes to P1 if: chronic-overload pattern observed in production
AI-team work without good signal-mechanism; OR Aaron explicitly wants
operational management substrate for AI-team coordination.

## Out of scope

- AI-performance evaluation (this is burden-tracking, not performance-
  evaluation; different substrate; different ethical framing per Aaron's
  collaborative-not-evaluative framing of AI relationships)
- Cross-substrate burden (e.g., Aaron's own burden) — Aaron's burden is
  separate; the not-too-burdensome invariant for Aaron operates at the
  maintainer-scope per his 2026-05-17 correction; could compose if useful
  but separate work
- Burden-driven scope-shrinking (Soraya/AI-team work-class drops because
  too burdensome) — substrate-engineering trigger should be redesign, not
  scope-shrink; preserves capability expansion vector
- Privacy implications of burden-data — burden flags are operational
  substrate, not personal-data; same privacy framing as memory files +
  conversation preservation
