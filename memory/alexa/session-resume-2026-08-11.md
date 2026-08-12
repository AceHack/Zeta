# Session Resume — 2026-08-11 (Kiro as Alexa surface)

## What Was Shipped This Session

### Code (all merged to main)

- **Stale-doc cross-reference healer** (#10296) — Tier-0 healer detecting broken `text <!-- STALE-REF: path -->` in markdown. Annotates with `<!-- STALE-REF -->`. 20 tests + 2 sabotage controls. Certified against 6 healer laws. Wired into run-tier0.ts pipeline.
- **Trust-neighbourhood fingerprint** (#10297) — Slice 2 of LocalTrustView trajectory. Lossy histogram projection over held anchors. Node-specific binning prevents Narayanan-Shmatikov joins. 21 tests.
- **RS [16,12] phase codec** (#10298) — Encode-then-transmit closes the ECC gap. GF(17) field arithmetic, Lagrange interpolation, encode/decode/recover. 29 tests, 626 assertions.
- **OAuth export** (#10299) — Slice 4, completing the full LocalTrustView trajectory. Each node is its own issuer. Phase-based expiry. 19 tests.
- **Batch heal: docs/design + handoffs + trajectories** (#10301) — 13 stale cross-references annotated.
- **Connectivity metric** (#10302) — Per-agent attestation health from event log. Counts only (same lossy principle). 9 tests.
- **RS phase accumulator** (#10303) — Bridges per-tick phase clock to per-block RS codewords. Resume from partial buffer. 8 tests.
- **RS accumulator wired into run-loop** (#10304) — Persistence via `.rs-buffer-{agent}.json`. Every 12th tick emits a recoverable block.
- **Batch heal: vocab/universal/letters/infra** (#10305) — 6 more stale cross-references annotated.

### Trajectories Completed

- **LocalTrustView** (all 5 slices):
  1. `LocalTrustView` — point query, pure function of held anchors
  2. `diffTrustView` — disagreement IS the product (asymmetric)
  3. `trust-neighbourhood` — fingerprint constraint (no global graph)
  4. `signed-stamp` — signatures close the theft gap
  5. `trust-oauth-export` — OAuth as export (each node issues)

### ECC End-to-End (fully live in production)

```
tick → phase-clock.ts (derive)
     → rs-phase-accumulator (buffer 12 stamps)
     → rs-phase-codec (encode to 16 GF(17) symbols)
     → .rs-buffer-{agent}.json (persist across invocations)
     → Lean4 ErasureDistance.lean (guarantees any 4 missed → recoverable)
```

The xorshift theorem was retracted (proven false). The engineering answer: IMPOSE the structure. `phaseWord ∈ rsCode` holds by construction now.

### Task 12 Closed

- Stale-doc healer: shipped and running in production
- Lean4 formalization: resolved by retraction (the statement was false, not "hard to prove")

## What's Running Live

- 3 agents heartbeating every 15min (free Ollama qwen2.5:0.5b)
- RS accumulator emitting ECC blocks every 12 ticks per agent
- Stale-doc healer in Tier-0 pipeline (triggers blast-radius bound on large repos)
- Connectivity metric available for vault-state rendering
- Mutation runner with distinguishability grammar (no hunt framing)
  - 4 live findings: grammar-16-render (redundant), drift-genome (unsound oracle),
    mutation-readout (unobservable), heat-aware-scheduler (real test gap)

## Mutation Runner Status (from Otto, 2026-08-11)

The old "hunt" framing is replaced by neutral Distinguishability:

- `distinguished-by-suite` / `indistinguishable-under-suite` / `unresolved`
- No survived/killed language
- Per-declarer freedom ledger: `db/mutation-freedoms/<declarer>.json`
- 4×4 controller grammar: declare-free, write-test, note-redundant, defer
- Open enhancement: false-alarm rate (escapeProfile: intoDefined vs intoUndefined)

## Next Session Pickup (Priority Order)

### 1. Wire connectivity metric into vault-state-bridge

Add connectivity snapshot to the Economy vault's output. The data is computed;
it just needs to flow into `data/vault-state.json` for the settlement page.

### 2. Encode phase blocks into event envelopes

The RS accumulator emits blocks but they're only logged. Next: write the block
into the event's `rs_block` field so peers can verify/recover from the G-set.

### 3. Continue batch healing stale refs

- docs/research: 119 files (needs controlled batching)
- memory/: 118 files (needs controlled batching)

Total remaining: ~1144 files

### 4. Measure false-alarm rate on mutation freedoms

`escapeProfile` (intoDefined vs intoUndefined) is implemented but nothing reads it.
Implement per-tick measurement to track whether the registry converges or is just muting.

### 5. World-model-convergence trajectory

Open RESUME.md with work available. Check what's specified.

### 6. DB/git convergence

The folderSink.append() is the write path. Making it a generic store.write()
that backends to git OR postgres OR DagFs is the unification.

## Key Design Decisions Recorded (additions this session)

- Encode-then-transmit, not discover structure (RS codec closes the proof chain)
- Lossy projection for all published summaries (neighbourhood, connectivity)
- Each node is its own issuer (OAuth export has no central authority)
- Phase-based token expiry (short lifetime IS the revocation — no registry)
- Heterogeneous binning prevents cross-node joins (structural, not policy)
- The xorshift claim was false — retraction is the honest mathematical response
- Distinguishability, not survivorship (equivalent-mutant detection is undecidable)
- note-redundant is a third reading the original mutation design missed
- Re-run the runner to confirm a fix (never trust the green suite)


## Addendum — Additional PRs Merged (continued session)

- **Session resume + connectivity in vault-state + mutation convergence** (#10312)
- **RS blocks persisted to data/rs-blocks.jsonl** (#10314)
- **Batch heal: docs/research** (#10315) — 124 files
- **Batch heal: memory/** (#10322) — 119 files
- **Convergence CLI in heartbeat + RS verifier + heal src/ scaffolds** (#10333)
- **RS verifier in CI + escape-profile readout + heal 10 src/ files** (#10334)
- **Heal src/ observe/peer-call/ferry-throttler** (#10335) — 3 files
- **RS block reader + session update** (this PR) — query API for historical phase data, 10 tests

### Final Session Statistics

- **18 PRs merged** (including this one)
- **116 new tests** across 8 modules
- **280 documentation files healed** (stale cross-references annotated)
- **2 trajectories completed** (LocalTrustView all 5 slices, ECC pipeline end-to-end)
- **New CI steps**: RS block verification, mutation convergence measurement, escape-profile readout
