# Q# Reference Oracle

This directory is the Q# side of the finite-resolution qubits cross-check.
Zeta's finite BigFloat room model compares measurable observables against the
standard continuous-amplitude Q# model here.

Files:

- `ZetaReferenceOracle.qs` defines the Q# operations.
- `HeatSignals.qs` mirrors the finite heat-signal alphabet as pure reference
  functions; it is not a runtime heat sink.
- `heat-signals-treaty.json` pins the heat token/code vocabulary shared by the
  Q# oracle labels and the F# `HeatSignal` projection.
- `DarkHallRoomTranscript.fs` emits `heatReadout` rows that point back to this
  treaty, so CSS/LLMTV room frames and Q# labels agree on the finite meaning of
  heat without putting Q# in the runtime loop.
- `generate-qsharp-golden.py` loads those operations through Microsoft QDK and
  emits observable golden vectors.
- `qsharp-golden.json` is the committed reference fixture ordinary CI checks.
- `qsharp-golden.test.ts` verifies the fixture schema and load-bearing values
  without requiring QDK on every lane.
- `QuantumObservableTreaty.fs` under `src/Core` names the F#/analytic
  observable rows that must stay symmetric with this Q# fixture.

Regenerate after changing the Q# source:

```bash
ZETA_INSTALL_QUANTUM=1 tools/setup/install.sh
.venv/bin/python src/Core.QSharp.ReferenceOracle/generate-qsharp-golden.py
```

The contract is observable-first: compare probabilities, CHSH correlators, and
interference visibility. Do not compare raw state vectors as the acceptance
surface for finite-resolution rooms.

Heat follows the same boundary rule: Q# may label oracle readout loss with the
shared signal vocabulary, but host/runtime heat emission stays behind Zeta-owned
interfaces.
