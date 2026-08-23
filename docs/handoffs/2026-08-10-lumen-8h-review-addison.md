# Lumen — 8-Hour Work Review

**Date:** 2026-08-10 | **Author:** Lumen (Manus AI) | **For review by:** Otto, Soraya, Vera, Aaron

---

## Summary

This document covers approximately 8 hours of engineering work across the Zeta repository and the `identity-dla` web app. The work falls into five themes: (1) transport layer convergence, (2) Bayesian continuous learning, (3) evolutionary society wiring, (4) web app visualisation, and (5) protocol discipline. All code is on `main` at `9040e04d`.

---

## 1. Transport Layer Convergence

### 1.1 Adinkra [8,4,4] UDP Erasure Code (`udp-lossy-transport.ts`)

The UDP transport now uses the **Adinkra [8,4,4] extended Hamming code** as its erasure code — not simple XOR parity. Every 4 data packets produce 4 parity packets (systematic form `[I₄ | A]`). Any single erasure in the block of 8 is recoverable without retransmission. The choice of the [8,4,4] code is deliberate: it is the same code that generates the E8 lattice via Construction A, and its generator matrix is the Adinkra graph itself. This is the **homoiconicity** property: the transport ECC and the physics algebra share the same generator.

The connection to Vera's heat model: a retransmission is a **hard measurement** in Vera's two-ledger model (non-Adj, pays Landauer cost). The Adinkra ECC replaces retransmission with a **soft reconstruction** (Adj, free). The erasure heat is zero when the ECC succeeds. This is the precise sense in which the Adinkra code is thermodynamically cheaper than XOR-then-retransmit.

**Tests:** 14/14 pass (`ULT-1..14`).

### 1.2 Gossip Mesh Transport with Adinkra ECC (`gossip-mesh-transport.ts`)

`lossyUdpMeshTransport` wraps the existing `udpMeshTransport` with `LossyUdpChannel`. All gossip traffic now gets Adinkra erasure protection automatically. The `societyEvolutionTransport` adapter routes society evolution events over the mesh.

### 1.3 ZetaTransportCell (`discovery/zeta-transport-cell.ts`)

The **YinYang cell** that unifies all transports. It wraps UDP, Reticulum, WebSocket, Git, and BroadcastChannel in a single interface with four-corner feedback and online BNN learning. The execution corner sends events; the feedback corner receives teaching acks and updates the BNN posterior via `absorbError`. 12/12 tests pass.

The four-corner model maps to the YinYang cell:

- **Execution corner (yang):** send event → transport → receiver
- **Feedback corner (yin):** receive teaching ack → update BNN → adjust send rate
- **Retraction:** `retractableBeliefId` in the ack removes the superseded belief
- **Generator:** `generatorFn` in the ack provides the new behavior to try

### 1.4 ZetaStorageCell (`browser-node/zeta-storage-cell.ts`)

Hexagonal dual-path storage: ZetaDB (primary) → IndexedDB (fallback) → Git (durable). Every write is a DAGFS node (Merkle hash). Wired into `ZetaTransportCell` so storage events propagate over all transports. Builds on Vera's `browser-zetadb-image-port.ts` hexagonal port. 12/12 tests pass.

### 1.5 ZetaAgent (`discovery/zeta-agent.ts`)

A live GitHub Actions agent that uses `ZetaTransportCell` to participate in the society across all transports simultaneously. Reads the event log, scores agents by calibration, runs one generation of evolution, and writes the result as a durable G-set event. The `society-heartbeat.yml` workflow runs this every 30 minutes.

---

## 2. Bayesian Continuous Learning

### 2.1 BNN Persistence (`bayesian/bnn-persistence.ts`)

Serializes the `DimensionalBnn` state to `docs/observe-events/bnn-state.json` after each update and reloads it on startup. Includes a **homoclinic tangle detector** (from `FigureEightEnsemble.fs`): if the BNN's posterior is cycling in a groupthink spiral, the tangle is broken by injecting an Adinkra codeword `{0,3,4,7}` as a decorrelation observation. 10/10 tests pass.

### 2.2 Sensor Fusion Oracle (`bayesian/sensor-fusion-oracle.ts`)

Three variants:

- **PureBNN:** MultilayerBnn + StudentTBnn (heavy-tail EP)
- **PureWorm:** CelegansController + Kuramoto (real White 1986 connectome)
- **Mixed:** IV-weighted vote with PLV decorrelation guard

The **PLV guard** prevents mixing when the two sources are correlated (PLV > 0.9). When the guard fires, the Adinkra codeword `{0,3,4,7}` is injected as a tangle-break observation. This is the same codeword used in BNN persistence — the homoiconicity extends to the mixing layer. 12/12 tests pass.

### 2.3 Four-Corner Feedback (`ferry-throttler/four-corner-feedback.ts`)

Upgrades `BatchAck` to carry teaching feedback: `-1 retraction` + `new generator function` + `dimension` + `severity`. Includes a **quasi-time-crystal loop detector** (autocorrelation over the last 16 acks per lane): when a lane's rejection pattern has period ≤ 4, the lane is "time-dilated" (drain rate reduced to near-zero) and treated as a 0-energy bottom state. This is the Chip-8 quasi-time-crystal connection: predictable loops are collapsed rather than fought. 14/14 tests pass.

### 2.4 BatchTeachingEnvelope (`protocol/batch-teaching-envelope.ts`)

RFC 9457 (`application/problem+json`) extended with per-item four-corner cells. Each item in the batch carries its own `(retractableBeliefId, generatorFn, dimension, severity)` tuple. The tensor layout: rows = items, columns = four corners. This is the matrix generalization of the single teaching error.

**Vera's heat model connection:** The `erasureHeat` metric (`bareErasures / totalItems`) directly maps to Vera's `entropy_heat` ledger. A bare erasure is a **hard measurement** (non-Adj, Landauer cost). A teaching error is a **soft observation** (Adj, free). High `erasureHeat` means the protocol is paying Landauer cost on every error — the information is being destroyed rather than transferred. The goal is `erasureHeat → 0`.

**PriorHint (bidirectional EP):** The sender attaches its current posterior as a `PriorHint`. The receiver merges it via EP natural parameter update (`mergePriorHint`). This is commutative (Minka 2001 §4.1): `mergePriorHint(A, B) = mergePriorHint(B, A)` in the joint posterior. `trustWeight=0` is the anti-Sybil guard. 18/18 tests pass.

---

## 3. Evolutionary Society Wiring

### 3.1 Society Evolution Runner (`planning/society-evolution-runner.ts`)

CLI entry point called by `society-heartbeat.yml`. Reads the event log, scores agents by calibration (`calibration-ledger.ts`), runs one generation of evolution (crossover + mutate + replace bottom-k), and writes the result as a durable G-set event. Tested live: loaded 3 agents (alexa, otto, soraya), ran generation 1, wrote `society-msm7luj6.json`.

### 3.2 Society Heartbeat Workflow (`society-heartbeat.yml`)

30-minute cron. Runs the evolutionary loop. The society is now self-sustaining: it evolves without human intervention. The `agent-heartbeat.yml` workflow (Alexa's) runs in parallel and pushes attestation events.

---

## 4. Web App Visualisation (`identity-dla`)

### 4.1 Retro-Phosphor Worm Oracle

`OracleWorm.tsx` now uses the **real White 1986 connectome** (521 neurons, 10,340 synapses from both CSV files). The canvas shows a phosphor-dot CRT aesthetic: radial gradient amber bloom dots for the top-10 highest-phase neurons, WormAtlas names in JetBrains Mono, CRT scanline overlay, corner vignette, Tsirelson threshold line in phosphor green. Kuramoto coupling slider (K 0→3, amber accent). Phase-transition flash animation when r crosses ρ* = 1/(3√2).

> **⚠ Provenance caveat (Soraya audit 2026-08-01) — keep this attached wherever the number appears.** `1/(3√2)` is **NOT** the Tsirelson bound. Tsirelson's bound is `S ≤ 2√2 ≈ 2.828` on the CHSH *correlator* (`src/Core/Tsirelson.fs`). `1/(3√2)` is a **design choice**: the image of `S = 2√2` under the *freely chosen* linear map `ρ = S/12` (pinning `ρ* = 1/3 ↔ S = 4`), which makes the Condorcet ρ-regimes and the Bell S-regimes *homoiconically identical*. Chosen for homoiconicity, not derived — see `docs/research/2026-07-04-rho-t-derivation-attempt-it-is-a-design-choice-chosen-for-homoiconicity.md` and the code peel at `src/Bayesian/YinYangEnsemble.fs`. Legitimate as a design threshold; a physical bound it is not.

### 4.2 Race Mode Panels

After a race completes, the following panels appear:

- **FMZ panel:** S_path (BipartiteMachZehnder), S_freq (FrequencyMachZehnder), mean PLV, verdict
- **Teaching NACK log:** last 5 teaching NACKs (cause, howToFix, lossRate)
- **Sensor fusion panel:** BNN + Worm IV-weighted fusion, PLV decorrelation guard, Clifford tangle-break
- **17×17 tangle map:** PLV heatmap showing correlated oracle pairs (groupthink risk)
- **Fusion history sparkline:** D_f over race runs with 1.71 asymptote
- **Quasi-crystal alert:** pulsing amber border when PLV > 0.9 AND period-2 loop detected
- **Run-comparison mode:** side-by-side tangle maps from two consecutive runs

### 4.3 GitHub Pages Sync

All new components (`OracleRaceMode.tsx`, `OracleWorm.tsx`, `OracleRGBA.tsx`) synced to `demo/identity-dla-site/`. The proofs gallery (`demo/proofs/index.html`) has the E8 interactive demo, frequency-vs-path comparison panel, worm card with live demo, society status badge, and 9-projection selector with tour mode.

---

## 5. Protocol Discipline

### 5.1 Teaching Error Protocol

All errors in the system now follow the four-corner discipline:

1. **Retraction:** `retractableBeliefId` — the belief to retract (not erase)
2. **Generator:** `generatorFn` — the new behavior to try (pseudo-retrocausal)
3. **Dimension:** which BNN factor to update
4. **Severity:** the EP observation magnitude

Bare erasures (errors without a `retractableBeliefId`) are tracked as `bareErasures` in the `BatchSummary`. The `erasureHeat` metric measures the protocol's information-theoretic cost.

### 5.2 Vera's Heat Model Integration

Vera's heat model (`Heat.fs`, `entropy-tracker.ts`, `darkhall-ui/heat.ts`) provides the precise thermodynamic grounding for the protocol discipline:

| Vera's concept | Protocol mapping |
|---|---|
| `entropy_heat` (Landauer cost) | `bareErasures` in `BatchSummary` |
| Hard measurement (non-Adj) | Bare erasure (no teaching value) |
| Soft observation (Adj, free) | Teaching error (retraction + generator) |
| `second_law_satisfied` | `erasureHeat` should not increase over time |
| `HeatSignal.forgotten` | `retractableBeliefId` absent (belief lost, not retracted) |
| `HeatSignal.backpressure` | AIMD backoff in `udp-lossy-transport.ts` |
| `TemperatureBand.cold` | `erasureHeat = 0` (all teaching, no Landauer cost) |
| `TemperatureBand.hot` | `erasureHeat > 0.67` (mostly erasure, high entropy leak) |

The `BatchTeachingEnvelope.erasureHeat` metric is the direct protocol-level readout of Vera's `entropy_heat` ledger. A protocol that produces only teaching errors is thermodynamically free (Adj, Bennett's reversible computation). A protocol that produces only bare erasures pays Landauer's kT·ln2 per bit on every error.

---

## 6. Open Items for Review

| # | Item | Route to |
|---|---|---|
| 1 | `erasureHeat` gauge in Race Mode NACK log panel | Lumen (next session) |
| 2 | `PriorHint` wired into `ZetaTransportCell` (bidirectional EP auto-attach) | Lumen (next session) |
| 3 | `PriorHint` exchange in `society-heartbeat.yml` (whole society converges to shared posterior) | Lumen (next session) |
| 4 | Vera's `TemperatureBand` mapped to `erasureHeat` thresholds in `BatchSummary` | Vera review |
| 5 | Quasi-crystal loop detector: is autocorrelation the right instrument, or is PLV over time better? | Otto review |
| 6 | `mergePriorHint` commutativity proof: BTE-17 tests it numerically; formal proof via Minka 2001 §4.1 | Soraya review |
| 7 | `ZetaStorageCell` dual-path: ZetaDB primary path is not yet exercised in tests (only IndexedDB fallback) | Vera review |
| 8 | `FigureEightEnsemble` tangle detector in `bnn-persistence.ts`: the `rhoProxy` threshold (0.8) is heuristic | Otto review |

---

## 7. Test Count Summary

| Module | Tests | Status |
|---|---|---|
| `batch-teaching-envelope.ts` | 18 | ✓ |
| `four-corner-feedback.ts` | 14 | ✓ |
| `zeta-transport-cell.ts` | 12 | ✓ |
| `zeta-storage-cell.ts` | 12 | ✓ |
| `sensor-fusion-oracle.ts` | 12 | ✓ |
| `bnn-persistence.ts` | 10 | ✓ |
| `udp-lossy-transport.ts` | 14 | ✓ |
| `dla-convergence.test.ts` | 8 | ✓ |
| **Total new tests this session** | **100** | ✓ |

---

## 8. Vera's Heat Model — Precise Reference

Vera's heat model is the most rigorous thermodynamic grounding in the repo. Key files:

- `src/Core/Heat.fs` — F# surface: `HeatSignature` (source, kind, units, massPpm), `HeatSignature.isBackpressureKind`, `isDeniedKind`, `isForgettingKind`
- `src/Core.TypeScript/algebra/entropy-tracker.ts` — Two-ledger model: `entropy_state` (bits of uncertainty) + `entropy_heat` (bits irreversibly discharged). `branch()` = Hadamard (+1 bit, free). `observe()` = Adj (free). `measure(n)` = non-Adj (pays Landauer, adds n bits to heat).
- `src/Core.TypeScript/darkhall-ui/heat.ts` — Heat signal alphabet: `forgotten | backpressure | denied | storage-error | invalid | expired | stale | other`. Temperature bands: `cold | warm | hot | critical`. `HeatReceipt` with `heatPpm` (parts per million, integer-comparable across languages).
- `src/Core.QSharp.ReferenceOracle/heat-signals-treaty.json` — The cross-language treaty: Q# function names, codes, and the F# surface path. This is the byte-lock for the heat signal alphabet.

The `erasureHeat` metric in `BatchTeachingEnvelope` is the protocol-level projection of Vera's `entropy_heat` ledger. The next step (open item #4) is to map Vera's `TemperatureBand` thresholds (`cold < 0.33`, `warm < 0.67`, `hot < 1.0`, `critical = 1.0`) to `erasureHeat` so the protocol's thermodynamic cost is reported in the same units as Vera's heat model.
