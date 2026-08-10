# Zeta Stack Status — 2026-08-10

**Author:** Lumen (Manus AI)  
**Audience:** Addison, Aaron, Otto, Soraya  
**Purpose:** Honest current-state inventory of every layer — what is wired, what is simulated, what is missing.

---

## 1. Bayesian Continuous Learning

| Module | Status | Notes |
|---|---|---|
| `MultilayerBnn.fs` | ✓ Shipped, 14/14 tests | N-layer ADF forward + EP cavity backward. Online. |
| `StudentTBnn.ts` | ✓ Shipped, 10/10 tests | Heavy-tail EP, robustness weight `w=(ν+1)/(ν+z²)`. Handles non-Gaussian signals. |
| `ShivaWeakFactorCache` (VMP Student-t) | ✓ Shipped | Factor-graph VMP for non-Gaussian signals. On-demand. |
| `DimensionalBnn` (error-bnn-bridge.ts) | ✓ Shipped | Per-dimension EP state. Absorbs teaching errors from any protocol. |
| `hl-bnn-bridge.ts` | ✓ Shipped | HL amplitude → BNN observation stream. Wired into Oracle 17. |
| `CalibrationLedger` | ✓ Shipped | Beta-Bernoulli, coverage-at-τ scoring, trustBound/exploreBound. |
| Continuous learning loop | ⚠ Partial | BNN updates on each observation, but no persistence across sessions yet. |

**Non-Gaussian status:** Both EP (StudentTBnn) and VMP (ShivaWeakFactorCache) are shipped. The Gaussian-probit approximation is still used in the DLA amplitude path (approximately correct at large N). For audio/interruption signals, the Student-t factor handles non-Gaussian correctly.

---

## 2. Evolutionary Society

| Module | Status | Notes |
|---|---|---|
| `AgentGenome.ts` | ✓ Shipped, 13/13 tests | RGB/CMYK genetic codes, crossover (k-channel bug fixed), mutate, reproduce. |
| `SocietyEvolution.ts` | ✓ Shipped, 12/12 tests | Score by calibration, select top-k, crossover+mutate, replace bottom-k. |
| `society-evolution-runner.ts` | ✓ Shipped | CLI entry point for the society-heartbeat cron. |
| `society-heartbeat.yml` | ✓ Pushed | 30-minute cron. Runs the evolutionary loop, writes G-set event. |
| `AffectivePropagation.ts` | ✓ Shipped, 10/10 tests | Friedkin-Johnsen (stubbornness anchor, non-row-normalised). |
| `ThousandBrains.fs` + `SocietyBootstrap.fs` | ✓ Shipped | Star-topology EP, IV-weighted voting, Hawkins columns. |
| Society ↔ Genome bridge | ✓ Wired | `SocietyEvolution.ts` calls `AgentGenome.crossover` + `mutate`. |
| Persistence across generations | ✓ Partial | G-set events written to `docs/observe-events/`. Not yet replayed on restart. |

---

## 3. Transport Protocols

| Module | Status | Notes |
|---|---|---|
| `udp-transport.ts` | ✓ Shipped | UDP multicast (IPv4, configurable group/port). |
| `reticulum-transport.ts` | ✓ Shipped | RNS semantic layer, self-certifying addresses, hop-by-hop announce. |
| `dht-discovery.ts` | ✓ Shipped | Kademlia DHT, XOR distance, k-bucket routing. |
| `gossip-salon.ts` | ✓ Shipped | Pure fold over rumors, idempotent, commutative. |
| `gossip-mesh-transport.ts` | ✓ Shipped | UDP multicast + Reticulum + WebSocket + Git + BroadcastChannel adapters. |
| `udp-lossy-transport.ts` | ✓ Shipped, 14/14 tests | **Adinkra [8,4,4] erasure code** (not simple XOR). AIMD backoff. Teaching NACKs. BNN integration. |
| WebSocket (Alexa) | ✓ Shipped | Realtime client wired into `run-loop-real.ts` via `ZETA_REALTIME_URL`. |
| Reticulum over LoRa/BLE | ⚠ Not yet | `reticulum-transport.ts` is the adapter; actual LoRa/BLE hardware not yet wired. |
| QUIC/WebTransport | ✗ Not started | Future: bidirectional streams with backpressure. |

**UDP lossy transport design discipline:** Every NACK is a teaching error (not a bare failure code). Includes `what`, `why`, `howToFix`, `retractableBeliefId`, and `cause` (congestion/corruption/timeout). Feeds `DimensionalBnn` transport factor. Adinkra [8,4,4] ECC recovers any 1 erasure per block of 8 packets without retransmission.

---

## 4. CLI Protocols

| Module | Status | Notes |
|---|---|---|
| `ace-cli.ts` | ✓ Shipped, 22/22 tests | install/remove/verify/list/graphRoot/bnn-status. |
| `absorbAceError` | ✓ Shipped | install/verify failures → teaching error → DimensionalBnn. |
| `bnn-status` command | ✓ Shipped | Prints posterior (μ, σ, w) per error dimension. |
| `error-envelope.ts` | ✓ Shipped, 12/12 tests | Dual-register (Beacon prose + Mirror payload), idempotency guard. |
| `error-bnn-bridge.ts` | ✓ Shipped | Per-dimension StudentTBnn, absorbError, errorRichness. |
| `empowerment-bound.ts` | ✓ Shipped, 10/10 tests | Linear-blend vacuity proof, empowermentBound, externalitySafe. |
| `run-loop-real.ts` | ✓ Wired | Realtime WS push after sink append. ZETA_REALTIME_URL env var. |

---

## 5. Frequency Domain (new)

| Module | Status | Notes |
|---|---|---|
| `FrequencyMachZehnder.fs` | ✓ Shipped, 12/12 tests | PLV-based coherence, CHSH S ceiling oracle, local-time-never-enters caveat. |
| PLV ↔ BipartiteMachZehnder unification | ✓ Documented | PLV = Born probability of DC bin = coherence resource. S_freq ≤ 2√2·PLV. |
| Frequency domain in Race Mode | ✓ Wired | Rolling PLV on convergence chart, FMZ panel in Race Mode verdict. |

---

## 6. C. elegans Worm Oracle

| Module | Status | Notes |
|---|---|---|
| `CelegansController.fs` | ✓ Shipped | Full Kuramoto model over White 1986 connectome (302 neurons). |
| `OracleWorm.tsx` | ✓ Shipped | Real connectome loader (521 neurons, 10,340 synapses from CSV). |
| Retro-phosphor rendering | ✓ Shipped | Glow dots, CRT scanlines, WormAtlas names, coupling slider. |
| Phase transition animation | ✓ Shipped | Flash when r crosses ρ* = 1/(3√2). |
| Neuron spotlight | ✓ Shipped | Click canvas to spotlight nearest top-10 neuron, WormAtlas link. |
| Worm D_f in Race Mode verdict | ✓ Shipped | Live worm panel in Race Mode, D_f reported. |

---

## 7. Open Items

| Item | Owner | Priority |
|---|---|---|
| Z-1 discharge (Soraya) | Soraya | P1 |
| §7.3 externality bound proof (Soraya) | Soraya | P2 |
| Lean4 CI check verification | Otto | P2 |
| RC-3 measured closure size (D₄⊕D₄ claim) | Otto | P2 |
| BNN persistence across sessions | Lumen | P2 |
| Reticulum over LoRa/BLE hardware | Aaron | P3 |
| QUIC/WebTransport | Lumen | P3 |

---

## 8. What "continuous learning" means in practice

The system is continuously learning in the following sense:

1. **Every error is a teaching signal** — not a bare failure code. The `DimensionalBnn` updates on every NACK, every ACE CLI failure, every calibration miss.
2. **Every oracle run updates the BNN** — the HL amplitude stream from Oracle 17 feeds `MultilayerBnn` via `hl-bnn-bridge.ts`.
3. **The society evolves every 30 minutes** — the `society-heartbeat.yml` cron runs the evolutionary loop and writes the new generation to `docs/observe-events/`.
4. **Affective propagation is Friedkin-Johnsen** — stubbornness anchor prevents full consensus collapse; trust has absolute effect.

What it is NOT yet: the BNN state is not persisted across process restarts. Each new run starts from the prior. This is the next major gap.

---

*Committed to Zeta main. Route to Otto/Soraya for review.*
