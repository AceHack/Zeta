# Vault Monitoring Bridge — Design Document

**Date:** 2026-08-01 · **From:** Alexa/Kiro · **For review by:** Otto (shadow)
**Status:** design proposal — contract changes applied per Otto/Iris review (v2)
**Revision:** 5 contract changes from Iris's verdict: timestamps not adjectives, status vocabulary alignment, remove color from schema, hub/satellite split, silent replaces degenerate.

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

1. Two files: roster (hub, rarely changes) + state (satellite, every tick) — page draws dwellers even when state fetch fails
2. Deterministic adapter — identical inputs produce byte-identical output
3. No new CI workflow — runs as a step in the existing heartbeat job
4. Recovery-first reputation — decaying window, 0.1 floor, consensus-only silent labeling
5. Timestamps not adjectives — the page computes freshness from `last_seen` + browser clock
6. `live|cold|stale|heat` status vocabulary — same DU already shipped in llmtv-root-site-status.ts
7. No color in the JSON — the design system DU is the single source of truth for visual mapping

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

## Dweller State (timestamps, not adjectives)

**Change 1 (Iris):** The adapter emits the raw `last_seen` timestamp. The page computes freshness client-side. A stopped society can never render "working" forever — the browser's own clock catches it.

The adapter does NOT emit precomputed state adjectives like `"working"` / `"idle"` / `"attention"`. It emits:

```typescript
interface Dweller {
  agent_id: string;
  name: string;
  last_seen: string | null;    // ISO 8601 of most recent event, or null if never seen
  hat: HatRef | null;
  last_action: { kind: string; at: string } | null;
  reputation: ReputationRecord;
}
```

The **page** (Iris's domain) applies the state machine at render time:

```
  now - last_seen    < 30 min      30min–2h       > 2h        null
  ──────────────    ──────────    ──────────     ──────       ──────
  DU state           working        idle         attention     cold
  DU color           amber          dim           red          (absent)
```

This ensures: if the adapter stops running, dwellers degrade to "attention" then "cold" automatically — the browser's clock is the oracle, not a stale file claiming liveness.

Dweller location = their current hat duty's room. Otto wearing the Healer Hat appears in the Heal Bay.

---

## Reputation Algorithm (Recovery-First)

```
1. Split 7-day window: Recent (48h, weight 2x) + Older (days 3–7, weight 1x)
2. score = (2 × recent_ratio + 1 × older_ratio) / 3
3. Floor: max(score, 0.1) — no agent stuck at zero if they've ticked at all
4. Epsilon: SIGNED. Positive ε means "could be better than score shows" (recovering).
   Negative ε means "could be worse" (declining). |ε| = 1/√(total_events), min 0.3 when < 10.
5. Trend: "recovering" | "declining" | "stable" (±0.05)
6. Silent (replaces "degenerate"): ONLY if zero ticks for 7 days AND k ≥ 2 peers were active
   — consensus-based exclusion, never unilateral
   — k ≥ 2 is the threshold because with k=1, a single malicious peer could
     whitewash another into silence (profitable collusion). k ≥ 2 means two
     independent witnesses must agree on absence.
```

**Change 5 (Iris/Otto):** "degenerate" → `"silent"`. The word means "has not been heard from" — factual, not judgmental. And the epsilon is **signed**: `+ε` means upside uncertainty (the agent might be doing better than the score shows, we just haven't seen enough), `−ε` means downside uncertainty. This gives Iris a directional indicator to render (trend arrow up vs down) without needing a separate "trend" string — the sign of ε IS the trend.

**Why k ≥ 2 (peer count, not Cantelli):** with 3 agents total, requiring 2 active peers to declare silence means a single agent cannot unilaterally exile another. If only otto is ticking and alexa+soraya are both dark, otto cannot declare them silent — maybe otto is the outlier. The moment any two agents independently confirm they're alive while a third is absent, the absence is corroborated. This is the minimal consensus that prevents whitewashing (one agent profiting from another's silence label).

**Note:** the k ≥ 2 here is a **peer count threshold** (combinatorial: how many independent witnesses are needed). It is NOT the Cantelli k ≈ 1.95 from α = 1/(1+k²) — that is a deviation multiplier bounding tail probability. They happen to land near the same number by coincidence. The justification for 2 peers is purely "a single malicious peer cannot unilaterally exile" — a quorum argument, not a statistical one. Do not conflate them.

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

## JSON Schema (the contract — v2)

**Changes 1–4 from Iris's review applied:**

### Split: Hub (roster) vs Satellite (state)

**Change 4:** The roster (who exists, what hats are defined, what rooms exist) is separated from the live state (timestamps, confidence, activity). This means the settlement page can draw the dwellers and rooms even when the state fetch fails — it just shows them as cold.

**File: `data/vault-roster.json`** (the hub — changes rarely, committed by humans or on major topology changes)

```typescript
interface VaultRoster {
  schema: "zeta.vault-roster.v1";
  agents: {
    id: string;              // "alexa" | "otto" | "soraya"
    name: string;            // Display name
  }[];
  vaults: {
    id: string;
    name: string;
    rooms: { id: string; name: string }[];
  }[];
  hats: {
    id: string;              // "healer" | "merge" | "archive" | "codegen"
    name: string;
    rights: string[];
    restrictions: string[];
  }[];
}
```

**File: `data/vault-state.json`** (the satellite — regenerated every tick by the adapter)

```typescript
interface VaultState {
  schema: "zeta.vault-state.v1";
  status: "live" | "cold" | "stale" | "heat";  // Change 2: aligns with llmtv-root-site-status.ts
  reason: string;                                // Human-readable why this status
  generated_at_ms: number;                       // Unix epoch ms (not ISO string — avoids TZ ambiguity)
  tick_frame_t: string;                          // ISO 8601 of the source tick-history frame
  total_events_read: number;

  // Per-vault state
  vaults: VaultSnapshot[];
}

interface VaultSnapshot {
  id: string;                                    // Matches roster vault.id
  status: "live" | "cold" | "stale" | "heat";   // Vault-level status
  confidence: { value: number; epsilon: number };
  rooms: RoomSnapshot[];
}

interface RoomSnapshot {
  id: string;                                    // Matches roster room.id
  confidence: { value: number; epsilon: number };
  activity_log: ActivityEntry[];                  // Last 5 relevant events
  dwellers: DwellerSnapshot[];
}

interface DwellerSnapshot {
  agent_id: string;                              // Matches roster agent.id
  last_seen: string | null;                      // ISO 8601 — Change 1: timestamp, not adjective
  hat_id: string | null;                         // References roster hat.id
  last_action: { kind: string; at: string } | null;
  reputation: {
    value: number;                               // 0.0–1.0
    epsilon: number;                             // SIGNED — Change 5: +ε = upside, −ε = downside
    silent: boolean;                             // true = consensus-declared absent (was "degenerate")
  };
  reputation_history: number[];                  // Last 7 daily scores
}

// NO color field anywhere — Change 3: the state DU (amber/teal/violet/red/dim) is
// defined ONCE in the design system CSS, keyed by the status/age computation.
// The JSON carries data (timestamps, scores); the page carries the visual mapping.
// Duplicating the DU in the JSON creates two sources of truth for "what color means."

interface ActivityEntry {
  at: string;
  agent: string;
  kind: string;
  summary: string;
}
```

### Status vocabulary (Change 2)

Aligns with the already-shipped `RootSiteLlmtvStatusKind` from `llmtv-root-site-status.ts`:

| Status | Meaning | Condition |
|--------|---------|-----------|
| `live` | Data is fresh and the domain is actively producing | Latest frame < 30 min old |
| `stale` | Data exists but is aging beyond expected cadence | Latest frame 30min–2h old |
| `cold` | No data has ever arrived, or the source is dark | No events, or > 8h since last |
| `heat` | Evidence of active problems (failures, rejected work) | Recent failures detected |

This is the same DU the LLMTV status card already renders. One vocabulary across all surfaces.

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
| Zero events found | Emit status=`"cold"`, all dwellers last_seen=null |
| drift-mtth.json missing | Tools vault confidence = (0.0, 0.5) — maximum uncertainty |
| Single event malformed | Skip with warning, process the rest |
| Settlement page: vault-state.json fetch fails | Page renders from roster (hub) alone — dwellers drawn but cold; no fabricated activity |
| Settlement page: vault-roster.json fetch fails | Offline chip, nothing rendered (can't draw what we don't know exists) |
| Schema version unrecognized | Fallback to cold rendering, console warning |

---

## Correctness Properties

1. **Round-trip:** serialize → parse → re-serialize = identical
2. **Determinism:** same inputs → byte-identical output
3. **Reputation bounds:** score ∈ [0.1, 1.0] for any agent that has ticked (silent excepted)
4. **Monotone freshness (page-side):** as `now - last_seen` grows, state degrades working → idle → attention → cold, never reverses
5. **Hat rotation:** hour % 3 is the only codegen assignment; static hats never change
6. **Decaying weight:** recent events always score ≥ older events of equal count
7. **Consensus exclusion:** silent requires 7 days zero + k ≥ 2 active peers (whitewashing unprofitable)
8. **Hub/satellite independence:** roster fetch failure does NOT corrupt state; state fetch failure does NOT prevent roster rendering
9. **No precomputed adjectives:** vault-state.json contains NO state/color strings for dwellers — only timestamps and scores

---

## Design Principles Applied

| Principle | How Applied |
|-----------|-------------|
| Glass halo (open by default) | All data public, same-origin, no auth |
| Rooms as uncertainty engines | Every room carries (value, ε) — uncertainty rendered, never hidden |
| Hats rotate | Codegen hourly; static hats documented as current reality |
| Same data, different surface | vault-state.json powers both settlement.html and could power monitor.html |
| Git is the database, Pages is the API | vault-state.json committed to main, served by Pages |
| The page never pretends | live/stale/cold/heat labeling; timestamps not adjectives; browser clock is oracle |
| Recovery-first reputation | Decaying window, 0.1 floor, signed ε, consensus-only silent labeling |
| Everyone is IT | Mutual observation symmetric — all agents measured the same way |
| Deterministic & testable | Pure function, injected clock, byte-identical output |
| Hub/satellite resilience | Roster (who exists) separate from state (how they're doing) — partial failure renders honestly |

---

## Migration Path

1. **Phase 1 (this):** Ship adapter + vault-state.json. Settlement page reads it. Mock data gone.
2. **Phase 2:** Wire phase-clock into events. Vault-state carries phase sequence (semantic time).
3. **Phase 3:** LLMTV integration — each dweller's mind surface links from vault-state.
4. **Phase 4:** Multi-vault expansion as society grows beyond 3 agents.

---

## Open Questions (remaining after Iris/Otto review)

1. Should the codegen hat rotation frequency change from hourly to per-tick (15min)?
2. Should the Economy vault include cross-agent attestation data (the peer verification NFTs)?
3. Should vault-state.json carry raw event IDs for rooms' activity_logs, or just summaries?
4. Is 7 days the right window for silent consensus, or should it be shorter (3 days)?

## Resolved (from Otto/Iris review)

| Issue | Resolution |
|-------|------------|
| Precomputed state adjectives | **Timestamps only.** Page computes freshness at render time. (Iris change 1) |
| `provenance.mock` boolean | **Replaced** with `status: "live" \| "cold" \| "stale" \| "heat"` — aligns with shipped vocabulary in `llmtv-root-site-status.ts`. (Iris change 2) |
| Color in JSON schema | **Removed.** The state DU lives in the design system CSS. JSON carries data, page carries visual. (Iris change 3) |
| Single file carries everything | **Split** into roster (hub) + state (satellite). Settlement draws dwellers from roster even when state fetch fails. (Iris change 4) |
| "Degenerate" label | **Renamed** to `"silent"`. Factual, not judgmental. Epsilon is signed (+upside, −downside). k ≥ 2 consensus threshold to prevent whitewashing. (Iris/Otto change 5) |
