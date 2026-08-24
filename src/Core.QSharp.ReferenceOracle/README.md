# Q# Reference Oracle

This directory is the Q# side of the finite-resolution qubits cross-check.
Zeta's finite BigFloat room model compares measurable observables against the
standard continuous-amplitude Q# model here.

Files:

- `ZetaReferenceOracle.qs` defines the Q# operations.
- `HeatSignals.qs` mirrors the finite heat-signal alphabet as pure reference
  functions; it is not a runtime heat sink. Its temperature helpers also expose
  a dimensionless black-body lane: normalized information radiance follows
  `T^4`, while peak frequency follows `T`.
- `heat-signals-treaty.json` pins the heat token/code vocabulary shared by the
  Q# oracle labels and the F# `HeatSignal` projection.
- `DarkHallRoomTranscript.fs` emits `heatReadout` rows that point back to this
  treaty, so CSS/LLMTV room frames and Q# labels agree on the finite meaning of
  heat without putting Q# in the runtime loop.
- `CssStabilizerCodes.qs` is the QEC syndrome-extraction layer: the stabiliser rows for Steane
  [[7,1,3]] and the quantum Reed-Muller [[16,6,4]], ancilla-based X/Z stabiliser measurement, and
  the CSS commutation predicate. Its parameters are computed in `src/Core/CssCode.fs`; **the file
  writes down a circuit and makes no claim that Zeta holds an encoded qubit.**
- `css-stabilizer-treaty.json` is the golden vector set for that layer, hex-in-JSON, produced by the
  F#. It carries `register: "structural"` in its own body, because a demarcation that lives only in
  a doc becomes a physical claim the first time the JSON is quoted without it.
- `css-stabilizer.test.ts` is the **second oracle**: it re-derives Reed-Muller, duals and the CSS
  parameters in TypeScript without calling the F#, then checks its answers against the treaty and
  against the rows the Q# source declares. It runs on every lane; QDK is not required.
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

The black-body lane follows that rule too. It is a treaty over emitted
information heat, not a claim that Q# is simulating SI-temperature radiation or
thermal quantum field dynamics.
