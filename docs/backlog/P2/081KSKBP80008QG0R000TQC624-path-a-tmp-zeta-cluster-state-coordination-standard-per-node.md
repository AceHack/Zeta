---
id: 081KSKBP80008QG0R000TQC624
priority: P2
status: open
title: Path A — /tmp/zeta-cluster-state/ coordination standard for multi-agent per-node state advertisement (self-registered.marker / register-pr-in-flight.lock / last-seen.iso); composes with bus envelope substrate at cross-node scope (Aaron 2026-05-27)
effort: M
ask: aaron 2026-05-27
created: 2026-05-27
last_updated: 2026-05-27
depends_on: []
composes_with:
  - 081KSKBP80008QG0R000GPC0TB
  - 081KSKBP80008QG0R003Z4C0D0
  - 081KSKBP80008QG0R00248VEWT
  - 081KR7JY10008QG0R000R503K2
  - 081KSGS9H0008QG0R0037H3W4T
tags: [cluster-coordination, tmp-folder-standard, per-node-state, multi-agent, marker-files, deferred-until-needed, bus-envelope-composition, ipc, lockfile-pattern]
---

## Operator framing (Aaron 2026-05-27)

Filed per operator catch on backlog discipline: *"backlog rows should alwasy be filed you are forgetful we dont have to work on it yet until after we boot with one."*

This row is the Path A alternative 081KSKBP80008QG0R000GPC0TB explicitly deferred. Filed NOW (not when needed) because:

- Naming the substrate-engineering target is what prevents future-Otto from forgetting
- Deferred-implementation is operationally fine; deferred-naming is the forgetful failure mode
- The row IS the substrate marker; sub-row implementation work happens later

## What this row names

A `/tmp/zeta-cluster-state/` coordination directory where every cluster agent on a node advertises per-node state for multi-agent coordination. Sibling to (NOT replacement for) Path B (Otto-pushes-PR-across-finish-line per 081KSKBP80008QG0R000GPC0TB) — the two compose.

### Schema (Phase 1 proposal; refines at implementation)

```text
/tmp/zeta-cluster-state/
├── nodes/
│   └── <node-name>/
│       ├── self-registered.marker        (registration state; timestamp + PR URL)
│       ├── register-pr-in-flight.lock    (in-flight PR; PID + timestamp; TTL-based)
│       ├── last-seen.iso                 (agent heartbeat; iso8601 timestamp)
│       └── persona-<name>.state          (per-persona local state; e.g., zeta-otto.state)
└── README.md                              (schema doc + invariants)
```

Marker files are:

- **Plain text or YAML** (operator-readable; debuggable)
- **Atomic writes** (write to .tmp → rename; standard atomic-file-write pattern)
- **TTL-based for locks** (no stale-lock-forever; agent checks mtime + assumes dead if > N min)
- **Multi-writer safe** (file-level locking via `flock(2)` for any read-modify-write)

### Why /tmp and not /var/lib

Per Aaron's framing — `/tmp` is the agent-coordination surface (ephemeral; per-boot; survives across systemd service restarts within same boot). Long-lived state lives in `~/.config/zeta/` (per 081KSKBP80008QG0R000GPC0TB marker) and on origin/main (registration YAML). The `/tmp` surface is purely for in-flight coordination.

### Composes with substrate (NOT competes with)

| Substrate | Composes how |
|---|---|
| **Path B (Otto-pushes per 081KSKBP80008QG0R000GPC0TB)** | Path B is the SIMPLER form (single-source-of-truth for PR lifecycle); Path A adds per-node visibility for multi-agent cases without replacing Path B |
| **Bus envelopes** (`tools/bus/`) | Bus does cross-node coordination at scope; `/tmp` does per-node state surface; bus reads/writes marker files for state propagation across nodes |
| **081KSKBP80008QG0R003Z4C0D0 multi-vendor systemd** | Each systemd service can write its own marker; sibling services read for coordination |
| **081KSKBP80008QG0R00248VEWT persona-first scheduler** | Persona's current assignment can be advertised via `persona-<name>.state` |
| **081KR7JY10008QG0R000R503K2 claim coordinator** | The bus claim-coordinator already exists at cross-process scope; this row adds per-node-state scope as sibling |

## Sub-rows to file when implementing

- 081KSKBP80008QG0R000TQC624.1 — `/tmp/zeta-cluster-state/` directory schema + README.md doc
- 081KSKBP80008QG0R000TQC624.2 — TS helpers: `read-marker.ts`, `write-marker-atomic.ts`, `acquire-lock-with-ttl.ts`, `release-lock.ts`
- 081KSKBP80008QG0R000TQC624.3 — Self-register service integration (081KSKBP80008QG0R000GPC0TB path) — writes `self-registered.marker` after Otto pushes PR; reads `register-pr-in-flight.lock` for de-dup
- 081KSKBP80008QG0R000TQC624.4 — Heartbeat: agents touch `last-seen.iso` on tick; sibling agents read for liveness
- 081KSKBP80008QG0R000TQC624.5 — Per-persona state file integration with 081KSKBP80008QG0R00248VEWT persona-first scheduler
- 081KSKBP80008QG0R000TQC624.6 — Bus envelope integration: bus reads marker files for cross-node state propagation
- 081KSKBP80008QG0R000TQC624.7 — TTL-based stale-lock cleanup (`tools/cluster/cleanup-stale-cluster-state.ts`); systemd timer
- 081KSKBP80008QG0R000TQC624.8 — Empirical test: multi-agent on same node (Otto-CLI + Otto-Desktop + Otto-VSCode) coordinate via markers without stepping on each other

Order suggestion: 1 (schema) → 2 (TS helpers) → 4 (heartbeat — simplest user) → 3 (self-register integration) → 5 → 6 → 7 → 8.

## When to implement (NOT this row's commitment)

Per Aaron: *"we dont have to work on it yet until after we boot with one."*

Trigger conditions:

1. AFTER first successful cluster bootup (one node operational on installed OS)
2. WHEN multi-agent coordination needs the per-node state surface (e.g., second Otto surface needs to know what the first Otto surface is doing on the same node)
3. WHEN Path B (Otto-pushes per 081KSKBP80008QG0R000GPC0TB) hits a coordination edge that Path A would solve cleaner

Until then: row stays open + visible; substrate-engineering target preserved; future-Otto cold-boots see the substrate; implementation deferred.

## What this is NOT

- NOT a Path B replacement (paths compose; 081KSKBP80008QG0R000GPC0TB ships simpler form)
- NOT a backlog-row inflation (naming-deferred-substrate is the right discipline per Aaron 2026-05-27 catch)
- NOT a commitment to implementation timeline
- NOT a competition with `tools/bus/` substrate (composes at different scope)

## Composes with

- **081KSKBP80008QG0R000GPC0TB** (sibling) — Path B Otto-pushes-PR; this row adds Path A as enhancement when needed
- **081KSKBP80008QG0R003Z4C0D0** — multi-vendor systemd substrate; each agent uses markers
- **081KSKBP80008QG0R00248VEWT** — persona-first scheduler; persona state advertised via markers
- **081KR7JY10008QG0R000R503K2** — bus claim-coordinator; sibling coordination primitive at different scope
- **081KSGS9H0008QG0R0037H3W4T** — iter-5.4.1 self-registration; the marker pattern this row formalizes was prefigured here
- `tools/bus/` envelope substrate (`bus.ts`, `claim.ts`, `subscribe.ts`) — composes at cross-node scope
- `.claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md`

## Why P2

- Operator explicitly named "deferred until after first boot" — not load-bearing for immediate ISO test cycle
- Path B (081KSKBP80008QG0R000GPC0TB) ships the simpler form; this row stays available for future enhancement
- Sub-rows enumerated but no implementation work claimed yet
- Bounded scope (Phase 1 = 8 sub-rows; smallest concrete slice is .1 + .2 schema + helpers)

## Substrate-honest framing

This row is the OPERATIONAL ALTERNATIVE Path B doesn't subsume. Filing it now per Aaron's "always file backlog rows immediately even when deferred" discipline. The deferral-of-implementation is operationally fine; the deferral-of-naming would be the forgetful failure mode.

Future-Otto cold-boots will see 081KSKBP80008QG0R000GPC0TB (Path B; in-flight per PR #5412) AND 081KSKBP80008QG0R000TQC624 (Path A; deferred) in the backlog. When cluster operates + multi-agent coordination needs Path A, the row is here ready to be claimed.

## Full reasoning

Aaron 2026-05-27 catch on backlog discipline:

> *"backlog rows should alwasy be filed you are forgetful we dont have to work on it yet until after we boot with one."*

This row IS the application of that discipline at substrate-engineering scope. Composes with the new memory landed alongside this row:

- `feedback_aaron_backlog_rows_always_filed_immediately_even_when_deferred_to_prevent_forgetful_failure_mode_2026_05_27.md` (user-scope)

Substrate-inventory pass:

- Topic: per-node cluster-agent coordination / `/tmp` marker files / multi-agent state advertisement
- Searched: docs/backlog/ (081KR7JY10008QG0R000R503K2 bus claim-coordinator is closest sibling; 081KSKBP80008QG0R000GPC0TB named this as deferred path); .claude/rules/ (no prior rule); memory/ (no prior memory)
- Found: 081KSKBP80008QG0R000GPC0TB (Path B; this row's sibling), 081KR7JY10008QG0R000R503K2 (bus substrate; composes), 081KSKBP80008QG0R003Z4C0D0 + 081KSKBP80008QG0R00248VEWT (systemd substrate; consumers)
- Conclusion: no existing substrate covers Path A; this row names the substrate-engineering target + defers implementation per operator framing
