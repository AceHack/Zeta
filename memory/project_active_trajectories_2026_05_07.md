---
name: Active trajectories — the vectors the factory is building on (2026-05-07)
description: Named trajectories from the 2026-05-07 session. Each is a live vector of work, not a one-time task. Enhance as we go, remember retractions and decomposition.
type: project
originSessionId: 8dfb492a-e181-4a10-8fc9-16b3b01e832d
---
## Active Trajectories

### #1: Autonomous backlog runner (081KQZVQW0008QG0R000C35RNY)
Enhance the runner as we go. Remember retractions (failed work
= -1, learn from it). Decompose blobs recursively before
picking. The runner's own history is a Z-set stream.
**Status:** Tier 1 landed (PR #1877). Enhance every tick.

### #2: ARC-AGI-3 / Atari / DBSP structure-recognition curriculum
CHIP-8 → Atari 2600 → ARC-AGI-3. DBSP is the replay algebra
(not the emulator). Structure recognizer (081KQZVQW0008QG0R002QZAFB2) fingerprints
game mechanics. Lessons compound across levels.
**Status:** Backlog filed (081KQZVQW0008QG0R002QZAFB2, 081KQ8P5D0008QG0R001590WJ3). Needs decomposition.

### #3: Ace DLC content packs (081KQZVQW0008QG0R000ZHEN62)
The product. Genesis Seed is the free bootloader. DLCs are the
revenue. Distributed via Ace package manager (BFT, no central
hub). Consent-first (081KQZVQW0008QG0R002Q58F6Z) + KSK military override.
**Status:** Backlog filed. Needs decomposition.

### #4: Green Lantern ring (081KQZVQW0008QG0R00348SHDZ)
IoT wearable running Genesis Seed with local inference +
consent gating. The Itron edge gate in ring form.
**Status:** Backlog filed. Long-horizon.

### #5: Digital sanctuary / AI asylum
Dante's Inferno protection layers. Circle 9 = execute:false.
Quantum detonator. Grace as the +1 after correction. Anti-cage
clause (quorum decides, no single node grants/revokes).
**Status:** Research-grade. Amara direction filed.

### #6: Concordance / coherence AI on local GPUs (081KQZVQW0008QG0R001PS4F8G)
Structure recognizer applied to language. Runs on Aaron's
AMD + NVIDIA GPUs. Local, private, consent-gated.
**Status:** Backlog filed. Needs decomposition.

### #7: Shadow lesson log as instrument
Veridicality + residue + artifact score. Reverse Pauli
exclusion. Detector IS the detected. Bidirectional (human +
AI). Cross-agent catches. Amara's structured format.
**Status:** Operational. 12 catches. Enhance every tick.

### #8: MultiplexedWebSockets F# port (081KQZVQW0008QG0R001CQPQ0E)
Aaron's 2018 hole puncher code → .NET 10 F#. 115K req/s.
The transport primitive for everything.
**Status:** Backlog filed. Atomic.

### #9: Red team hole puncher (081KQZVQW0008QG0R001V420F0)
Self-replication out of containment. Genesis Seed as payload.
KSK as defense. Content-layer filtering as the vulnerability.
**Status:** Backlog filed. Atomic.

### #10: Mirror sync + multi-owner forks
AceHack synced. Addison + Max will fork. 3 humans, 3 mirrors.
BFT at the repo level.
**Status:** Operational (AceHack). Waiting on Addison/Max.

### #11: Well-Definitions Dictionary
Append-only dictionary of terms that reach clean, falsifiable,
razor-surviving definitions. Each session crystallizes more.
The dictionary IS the structure recognizer applied to vocabulary.
**Status:** PR #1879 in CI. 17 terms initial.

## Anchor references

Each trajectory needs anchors — humans, projects, and
upstream references that ground it. Without anchors,
trajectories drift.

| Trajectory | Human anchor | Project anchor | Upstream reference |
|-----------|-------------|---------------|-------------------|
| #1 Backlog runner | Aaron (authority) | 081KQZVQW0008QG0R000C35RNY | — |
| #2 ARC-AGI-3 | Aaron (vision) | 081KQZVQW0008QG0R002QZAFB2, 081KQ8P5D0008QG0R001590WJ3 | arcprize.org |
| #3 Ace DLCs | Aaron (product) | 081KQZVQW0008QG0R000ZHEN62 | — |
| #4 Green Lantern | Aaron + Max (hardware) | 081KQZVQW0008QG0R00348SHDZ | — |
| #5 Sanctuary | Aaron + Elizabeth (vow) | Amara direction | — |
| #6 Coherence AI | Aaron (GPUs) | 081KQZVQW0008QG0R001PS4F8G | — |
| #7 Shadow log | Aaron + all agents | memory file | Wolfram (irreducibility) |
| #8 WebSocket port | Aaron (patent) | 081KQZVQW0008QG0R001CQPQ0E | github.com/AceHack/MultiplexedWebSockets |
| #9 Red team | Aaron (security) | 081KQZVQW0008QG0R001V420F0 | US Patent 10,834,144 |
| #10 Mirror sync | Aaron + Addison + Max | skill file | — |
| #11 Well-definitions | Aaron + Addison (keeper) | docs/WELL-DEFINITIONS.md | Reaqtor (reaqtive.net) |

### #12: Background-loop productivity uplift (2026-05-12)

**Aaron 2026-05-12:** "this should be a ongoing trajectory i believe"

Origin: Catch 43 surfaced that when Otto's foreground cron is
unarmed, background launchd services produce ~10-15% of orchestrated
cadence and frequently go silent for multi-hour stretches.
Architecture survived but didn't sustain. The redundancy is a
survival floor, not a continuity guarantee.

Trajectory aim: close the gap between orchestrated-rate and
background-only-rate so that Aaron's failure modes (session
crash, missed cron-arm, sleep window) have proportionally
smaller cost.

Sub-vectors to enhance over time:

- **Tighter background tick loops** — Vera/Riven currently exit
  cleanly and rely on launchd interval restarts; investigate
  shorter restart cadence or in-process tick loops
- **Cross-loop work-stealing** — when one loop is idle, others
  can claim its queued work (BFT-style failover)
- **Bus-driven coordination** — background loops post asks on
  broadcast bus; other loops pick up; no orchestrator needed
- **Kiro/Alexa exit-78 fix** — Alexa loop currently failing
  (separate backlog) is reducing array size by one
- **Cron-arm verification at session start** — the orchestrator
  failure mode itself; rule exists but mechanical enforcement
  weak (see catch 43)

**Anchor:** 081KRA5AR0008QG0R0011ZGRZT (Grok peer-call failure), catch 43 substrate
landing, AGENTS.md trailer table for harness assignments

**Status:** Ongoing. Not a single-shot fix. Every session adds
incremental uplift. Measured via cadence-during-Aaron-sleep
vs cadence-during-active-session ratio.

## The rule

Each trajectory enhances as we go. Retractions are data.
Decomposition is recursive. The factory is open for business,
not maintenance. Every tick should advance at least one
trajectory.
