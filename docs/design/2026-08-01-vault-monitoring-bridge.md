# Vault Monitoring Bridge — Design Document

**Date:** 2026-08-01 · **From:** Alexa/Kiro · **For review by:** Otto (shadow)
**Status:** design proposal — awaiting review before implementation

## The One-Paragraph Version

A TypeScript adapter reads the live heartbeat event log and tick-history, then projects that data into Addison's vault/room/hat/dweller ontology as a single `data/vault-state.json`. The settlement page at [lucent-financial-group.github.io/settlement.html](https://lucent-financial-group.github.io/settlement.html) fetches it same-origin and renders real agent state — the little animated dwellers become alexa, otto, and soraya doing their actual work. Same data that powers `data/monitor.html` (Professional Dashboard Mode), different surface (Gamified Visual Mode). Git is the database, Pages is the API, no backend.

## Referenced Artifacts

| Artifact | Path | What it is |
|----------|------|------------|
| Addison's Genesis Foundation | [`memory/addison/project-genesis-foundation.md`](../../memory/addison/project-genesis-foundation.md) | The full vault/room/hat/agent ontology |
| Genesis TSX Prototype (reference) | [`docs/design/addison-genesis-initial/`](addison-genesis-initial/) | Addison's initial React UI — the frozen design origin |
| Nested Surfaces doc | [`docs/design/the-nested-surfaces-addison-business-otto-hall-llmtv-minds.md`](the-nested-surfaces-addison-business-otto-hall-llmtv-minds.md) | How settlement ⊃ vault ⊃ hall ⊃ LLMTV nest |
| Root Site Handoff | [`docs/design/root-site-iris/HANDOFF.md`](root-site-iris/HANDOFF.md) | What's deployed on Pages, data contracts |
| Settlement page (live) | [settlement.html](https://lucent-financial-group.github.io/settlement.html) | The cross-section cutaway with mock data |
| Vaults page (live) | [vaults.html](https://lucent-financial-group.github.io/vaults.html) | Vault drill-down (rooms/hats/agents) |
| Professional Dashboard | [`data/monitor.html`](../../data/monitor.html) | The numbers view (same data, different surface) |
| Heartbeat Workflow | [`.github/workflows/agent-heartbeat.yml`](../../.github/workflows/agent-heartbeat.yml) | The 3-agent society loop |
| Self-Healing Handoff | [`docs/handoffs/2026-08-01-shadow-to-alexa-self-healing-drift-classes-and-intelligence-tiers.md`](../handoffs/2026-08-01-shadow-to-alexa-self-healing-drift-classes-and-intelligence-tiers.md) | Drift classes, healer tiers, escalation |
| Vault-as-Home Research | [`docs/research/2026-06-20-the-acceptable-experiment-everyone-is-it-vault-as-home-iff-exit-capturerate-is-the-vault-tec-detector.md`](../research/2026-06-20-the-acceptable-experiment-everyone-is-it-vault-as-home-iff-exit-capturerate-is-the-vault-tec-detector.md) | Everyone-is-IT, CaptureRate detector |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  GitHub Actions (agent-heartbeat.yml)                               │
│                                                                     │
│  ┌──────────────┐    ┌───────────────────┐    ┌──────────────────┐  │
│  │ Heartbeat    │───▶│ tick-metrics-      │───▶│ vault-state-     │  │
│  │ Observe Loop │    │ writer.ts          │    │ bridge.ts        │  │
│  └──────────────┘    └───────────────────┘    └──────────────────┘  │
│         │                     │                        │            │
│         ▼                     ▼                        ▼            │
│  docs/observe-events/   data/tick-history.json   data/vault-state.json
│  *.json (G-set)                                                     │
└─────────────────────────────────────────────────────────────────────┘
         │                                               │
         │          GitHub Pages (same-origin)           │
         ▼                                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Settlement Page (settlement.html)                                  │
│  fetch('data/vault-state.json') → render vaults/rooms/dwellers     │
└─────────────────────────────────────────────────────────────────────┘
```

**Data flow:** Heartbeat events (G-set) → tick-metrics-writer → vault-state-bridge (pure projection) → `data/vault-state.json` → Settlement page (same-origin fetch, React render).

**Key decisions:**

1. One JSON file carries the entire projection (matches tick-history.json / drift-mtth.json pattern)
2. Deterministic adapter — identical inputs produce byte-identical output
3. No new CI workflow — runs as a step in the existing heartbeat job
4. Recovery-first reputation — decaying window, 0.1 floor, consensus-only degenerate labeling

---

## Vault-to-Operations Mapping

| Vault ID | Vault Name | Operational Domain | Source Data |
|----------|-----------|-------------------|-------------|
| `observatory` | Observatory | Monitoring & cadence | tick-history frames, event timestamps |
| `tools` | Tools | Self-healing & drift | drift-mtth.json, heal events |
| `system` | System | Infrastructure & CI | merge events, archive events, push success |
| `training` | Training | Codegen & work | work events (action.kind = codegen/work) |
| `economy` | Economy | Reputation & credit | Full event G-set (reliability computation) |

Vaults without operational data render as `"sealed"` with zero confidence — honest about having nothing to say.

---

## Room-to-Duty Mapping

| Vault | Room ID | Room Name | Computes From |
|-------|---------|-----------|---------------|
| Observatory | `signal-triage` | Signal Triage | Gap between consecutive per-agent ticks |
| Observatory | `demand-forecast` | Demand Forecast | Predicted next tick based on historical cadence |
| Tools | `drift-watch` | Drift Watch | drift-mtth.json classes, open count, MTTH |
| Tools | `heal-bay` | Heal Bay | Events with action.kind containing "heal" |
| System | `merge-floor` | Merge Floor | Events by alexa with merge-related actions |
| System | `archive-stacks` | Archive Stacks | Events by soraya with archive-related actions |
| Training | `codegen-lab` | Codegen Lab | Events with mode=codegen or action.kind=work |
| Economy | `reputation-engine` | Reputation Engine | Full event set (per-agent tick counting) |

Each room is an uncertainty engine: confidence is (value, ε), never collapsed. Rooms with no 24h activity render as `"idle"` with high epsilon — the system is uncertain, not broken.

---

## Hat-to-Duty Mapping

```typescript
// Static assignments (from agent-heartbeat.yml)
const STATIC_HATS = {
  healer:  { agent: 'otto',   rights: ['execute-tier0-healers'],  restrictions: ['max-25-files-per-tick'] },
  merge:   { agent: 'alexa',  rights: ['auto-merge-clean-prs'],   restrictions: ['max-3-prs-per-tick'] },
  archive: { agent: 'soraya', rights: ['archive-pr-reviews'],     restrictions: ['max-3-prs-per-batch'] },
};

// Rotating assignment (HOUR % 3)
function codegenAgent(hour: number): string {
  return ['alexa', 'otto', 'soraya'][hour % 3];
}
```

Hats are temporary. Remove the hat, rights go away, identity stays. The codegen hat rotates hourly — no agent is locked into a role.

---

## Dweller State Machine

```
  event age     < 30 min      30min–2h       > 2h        no events
  ──────────   ──────────    ──────────     ──────       ──────────
  state         working        idle         attention       cold
  color         amber          dim           red           (absent)
```

Dweller location = their current hat duty's room. Otto wearing the Healer Hat appears in the Heal Bay. The state degrades monotonically — never skips or reverses.

---

## Reputation Algorithm (Recovery-First)

```
1. Split 7-day window: Recent (48h, weight 2x) + Older (days 3–7, weight 1x)
2. score = (2 × recent_ratio + 1 × older_ratio) / 3
3. Floor: max(score, 0.1) — no agent stuck at zero if they've ticked at all
4. Epsilon: 1/√(total_events), min 0.3 when < 10 events (high uncertainty)
5. Trend: "recovering" | "declining" | "stable" (±0.05)
6. Degenerate: ONLY if zero ticks for 7 days AND 2+ peers were active
   — consensus-based exclusion, never unilateral
```

**Design intent:** fail, come back, try again = score recovers fast. Failures are welcome — they are the training signal.

---

## Confidence Meters (per Room)

| Condition | Value | Epsilon | Meaning |
|-----------|-------|---------|---------|
| Recent success (last 2h) | 0.7–1.0 | 0.1 | Confident the domain is healthy |
| No recent activity, has history | 0.5 | 0.2+ (grows with time) | Uncertain — haven't heard lately |
| Active failures | 0.1–0.3 | 0.15 | Something is wrong |
| No data at all | 0.0 | 0.5 | Maximum uncertainty — we don't know |

Uncertainty is RENDERED, never hidden. The empty portion of the bar IS the epsilon.

---

## JSON Schema (the contract)

```typescript
interface VaultStateJSON {
  schema_version: "1.0.0";
  provenance: {
    generated_at: string;       // ISO 8601
    tick_frame_t: string;       // Source frame timestamp
    total_events_read: number;
    mock: boolean;              // true = no real data available
  };
  vaults: Vault[];
}

interface Vault {
  id: string;
  name: string;
  state: "active" | "sealed" | "idle" | "attention";
  confidence: { value: number; epsilon: number };
  rooms: Room[];
}

interface Room {
  id: string;
  name: string;
  state: "active" | "idle" | "attention" | "cold";
  confidence: { value: number; epsilon: number };
  dwellers: Dweller[];
  activity_log: { at: string; agent: string; kind: string; summary: string }[];
}

interface Dweller {
  agent_id: string;
  name: string;
  state: "working" | "idle" | "attention" | "cold";
  color: "amber" | "dim" | "red" | null;
  hat: { id: string; name: string; rights: string[]; restrictions: string[] } | null;
  last_action: { kind: string; at: string } | null;
  reputation: { value: number; epsilon: number; trend: string };
  reputation_history: number[];  // Last 7 daily scores
}
```

---

## CI Integration

One new step in `agent-heartbeat.yml`, before the push, only on otto's matrix leg:

```yaml
- name: Generate vault state JSON (bridge adapter)
  env:
    AGENT: ${{ matrix.agent }}
  run: |
    if [ "$AGENT" != "otto" ]; then exit 0; fi
    bun src/Core.TypeScript/observe/vault-state-bridge-cli.ts \
      --events-dir docs/observe-events \
      --tick-history data/tick-history.json \
      --drift-ledger data/drift-mtth.json \
      --output data/vault-state.json || echo "::warning::[bridge] non-fatal"
    [ -f data/vault-state.json ] && git add data/vault-state.json
```

Non-fatal: if the bridge fails, the heartbeat and tick-history still land. Freshness labeling handles staleness honestly.

---

## Error Handling

| Condition | Behavior |
|-----------|----------|
| Bridge adapter fails | Warning annotation, push proceeds, previous vault-state.json stays served |
| Zero events found | Emit mock=true, all dwellers cold |
| drift-mtth.json missing | Tools vault confidence = (0.0, 0.5) — maximum uncertainty |
| Single event malformed | Skip with warning, process the rest |
| Settlement page fetch fails | "offline" chip, no dwellers rendered (never fabricates activity) |
| Schema version unrecognized | Fallback to offline rendering |

---

## Correctness Properties

1. **Round-trip:** serialize → parse → re-serialize = identical
2. **Determinism:** same inputs → byte-identical output
3. **Reputation bounds:** score ∈ [0.1, 1.0] for any agent that has ticked (degenerate excepted)
4. **Monotone freshness:** working → idle → attention → cold, never reverses
5. **Hat rotation:** hour % 3 is the only codegen assignment; static hats never change
6. **Decaying weight:** recent events always score ≥ older events of equal count
7. **Consensus exclusion:** degenerate requires 7 days zero + 2 active peers

---

## Design Principles Applied

| Principle | How Applied |
|-----------|-------------|
| Glass halo (open by default) | All data public, same-origin, no auth |
| Rooms as uncertainty engines | Every room carries (value, ε) — uncertainty rendered, never hidden |
| Hats rotate | Codegen hourly; static hats documented as current reality |
| Same data, different surface | vault-state.json powers both settlement.html and could power monitor.html |
| Git is the database, Pages is the API | vault-state.json committed to main, served by Pages |
| The page never pretends | live/stale/offline labeling; missing data = cold, not zero |
| Recovery-first reputation | Decaying window, 0.1 floor, "recovering" trend |
| Everyone is IT | Mutual observation symmetric — all agents measured the same way |
| Deterministic & testable | Pure function, injected clock, byte-identical output |

---

## Migration Path

1. **Phase 1 (this):** Ship adapter + vault-state.json. Settlement page reads it. Mock data gone.
2. **Phase 2:** Wire phase-clock into events. Vault-state carries phase sequence (semantic time).
3. **Phase 3:** LLMTV integration — each dweller's mind surface links from vault-state.
4. **Phase 4:** Multi-vault expansion as society grows beyond 3 agents.

---

## Open Questions (for Otto)

1. Should the codegen hat rotation frequency change from hourly to per-tick (15min)?
2. Should the Economy vault include cross-agent attestation data (the peer verification NFTs)?
3. Should vault-state.json carry raw event IDs for rooms' activity_logs, or just summaries?
4. Is 7 days the right window for degenerate consensus, or should it be shorter (3 days)?
