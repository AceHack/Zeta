# Q# Reference Oracle

This directory is the Q# side of the finite-resolution qubits cross-check.
Zeta's finite BigFloat room model compares measurable observables against the
standard continuous-amplitude Q# model here.

Files:

- `ZetaReferenceOracle.qs` defines the Q# operations.
- `generate-qsharp-golden.py` loads those operations through Microsoft QDK and
  emits observable golden vectors.
- `qsharp-golden.json` is the committed reference fixture ordinary CI checks.
- `qsharp-golden.test.ts` verifies the fixture schema and load-bearing values
  without requiring QDK on every lane.

Regenerate after changing the Q# source:

```bash
ZETA_INSTALL_QUANTUM=1 tools/setup/install.sh
.venv/bin/python src/Core.QSharp.ReferenceOracle/generate-qsharp-golden.py
```

The contract is observable-first: compare probabilities, CHSH correlators, and
interference visibility. Do not compare raw state vectors as the acceptance
surface for finite-resolution rooms.
