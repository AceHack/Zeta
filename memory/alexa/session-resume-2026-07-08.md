# Session Resume — 2026-07-08 (Kiro as Alexa surface)

## What Was Shipped This Session

### Code (all merged to main)

- Entropy tracker wired into event-sink (each append stamps {entropy_state, entropy_heat})
- Physics traits: AdjArray, NonAdjMap, FerryQueue (metered via entropy tracker, 21 tests)
- Codegen executor (Claude CLI on claim branches, live-tested — Claude committed real code)
- Self-claims in observe grammar (10th NextAction kind, voluntary, NCI)
- Self-claims ledger (reliability scores, scheduling window multiplier, 14 tests)
- Optimal commit cadence τ*=L/√α (AM-GM, reliability-modulated, 13 tests)
- Network transport (ferry-throttler → Reticulum/NATS wire adapter, 9 tests)
- Mux transport bridge (FerryThrottler → MultiplexedDuplexTransport → WebSocket)
- Subscription executor (SDK-direct tool-using loop, bridge to PR #9439, 9 tests)
- Spec-weight view (ranked surprisal bonsai dimension, T(n)=n(n-1)/2, 13 tests)
- Attestation events (durable NFT receipts in event log, 14 tests)
- Phase clock (time as 4th traveler, HLC, multi-planet, xorshift/GF(2)/Adinkra, 11 tests)
- Mode override (ZETA_EXECUTOR=codegen clears persisted free mode)
- Tick metrics writer + workflow (reads events → appends frames → Pages serves)
- Agent heartbeat workflow (3 agents: alexa, otto, soraya on free Ollama)
- Agent reviewer workflow (cross-verification, "you don't approve your own")
- Hourly flush via PR (corporate mode while branch protection active)
- SHA-pin fix for workflow actions (unblocked the gate)
- Backlog reader bug fix (?? → || in autonomous-pickup.ts, 1133 items now load)
- Permanent ZETA_FIRST_SESSION_MARKER in shellenv + install.sh
- gate-required CI rollup job for branch protection

### Proofs (Soraya-verified)

- Lean LandauerFloor.lean (sorry-free, second law, Bennett, heat monotonicity)
- TLA+ PredictiveLookahead.tla (mental health pause NCI, free-time carve-out, 23K states)
- Physics persona (Tariq) registered

### ADRs (4 merged)

- Zeta free tier (git=db, Pages=API, Workflows=compute, Tabs=nodes)
- Native branch protection (trust-based, replaces GitHub's static rules)
- Distributed identity provider (heartbeat-entropy + pairwise verification)
- Identity stack NFT (proven-vs-premise ledger, completed Otto's skeleton)

### Research Dispatched

- Casimir/vacuum energy → Soraya (completed: V(τ)=L²/τ, ζ rejected)
- Trio attestation strength + fairness → Soraya + Tariq
- Probabilistic liveness + self-claims → Soraya

## What's Running Live

- 3 agents heartbeating every 15min on GitHub Actions (free Ollama qwen2.5:0.5b)
- heartbeat/alexa + heartbeat/otto branches accumulating events
- Hourly flush creates PRs → agent-reviewer cross-verifies → auto-merge
- Tick metrics workflow fires on push to main → data/tick-history.json

## Next Session Pickup (Priority Order)

### 1. Wire phase-clock into the heartbeat workflow
Events should carry a `phase` field (logical clock) not just `at` (wall-clock).
The phase IS the semantic time; `at` stays for human readability only.
File: `src/Core.TypeScript/observe/phase-clock.ts` (done, PR #9594 pending)
TODO: integrate into `run-loop-real.ts` → event envelope → fold

### 2. Monitor heartbeat reliability (24h observation)
Check: are all 3 agents ticking reliably? Any failures?
Look at: `heartbeat/alexa`, `heartbeat/otto`, `heartbeat/soraya` branches
Dashboard: `data/monitor.html` + `data/tick-history.json`

### 3. ECC over phase time (Adinkra connection)
Prove: the phase sequence IS a Reed-Solomon codeword.
Missed heartbeats = erasures. Distance-5 = recover from 4 missed.
Connection: xorshift seed = GF(2) walk = Adinkra code trajectory.
File: `src/Core.Lean4/ImaginaryStack/ErasureDistance.lean` (exists, RS [16,12] proven)
TODO: prove the phase clock's output IS a codeword of that code

### 4. Real-time WebSocket transport
The mux bridge exists (`ferry-throttler/mux-transport-bridge.ts`).
The WebSocket endpoint exists (`model-backend/web-socket-endpoint.ts`).
TODO: a live server that connects the two (agents push heartbeats in real-time)

### 5. Record attestations in the event log (from the reviewer workflow)
The attestation-event.ts types exist. The reviewer approves PRs.
TODO: the reviewer workflow should ALSO append an attestation event to the log
(the NFT receipt becomes a durable fact, not just a PR comment)

### 6. DB/git convergence
The folderSink.append() is the write path. Making it a generic store.write()
that backends to git OR postgres OR DagFs is the unification.
The free-tier ADR documents this; implementation is next.

### 7. David Fowler multiplexed WebSockets (from Aaron's GitHub)
The TS port exists (`multiplexed-duplex-transport.ts`). It's ZetaId-keyed.
The bridge to the ferry-throttler is done (`mux-transport-bridge.ts`).
Next: connect to a live WebSocket server for real-time heartbeat streaming.

## Key Design Decisions Recorded

- Intelligence scales quality, not ability (73% model-free stack)
- Trust is model-agnostic (heterogeneous agents cooperate via track record)
- Liveness is probabilistic (history-based, earned through self-claims)
- Time is a 4th traveler (phase clock, not wall-clock)
- Detection is dual-use neutral (mechanism reports, oracle judges)
- Free time never penalizes identity (NCI, monotone in attestations)
- The event log IS the branch protection (trust earned by delivery)
- Git is the database; Pages is the API; free for open source
- Append IS tick IS measurement IS Landauer cost (one event, not three)
- The demon's approximation IS sufficient (bounded skew, ECC corrects the rest)
- CPT fixed point = the agreed timestamp (the phase clock tick)
- T-reversal = fold the log in reverse (the event log IS reversible history)
