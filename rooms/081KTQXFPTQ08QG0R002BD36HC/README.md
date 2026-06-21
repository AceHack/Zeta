# Room: 081KTQXFPTQ08QG0R002BD36HC (ZetaId Generation Oracle Room)

A bounded, replayable verification room seating every oracle on the ZetaId layout, anchored around `WorkItem(cat 8)-V1` and verified across 6 core language compilers plus MUMPS, bit-level fields, and compiler toolchains.

## Oracles Enrolled

1. **TypeScript (TS)**
2. **F# Reference**
3. **C# Port**
4. **Rust Port**
5. **Python Port**
6. **Go Port**
7. **MUMPS Reference Oracle** (Simulated execution of the `mumps_zeta_id.m` bit operations)

---

## Verification Summary

All 7 oracles successfully agree on 13 flat test vectors including the newly locked `workitem-v1-standard` vector. Bit-field layout checks match the exact offsets of the 128-bit ZetaId structure.

```text
Cross-verification across implementations:
  TS:    13 vectors
  F#:    13 vectors
  C#:    13 vectors
  Rust:  13 vectors
  Py:    13 vectors
  Go:    13 vectors
  MUMPS: 13 vectors

Bit-field Oracle Verification:
✅ All 13 vectors passed bit-field layout oracle assertions.
```

---

## Compiler / Toolchain Matrix

| Tool / OS    | Version                                        |
| ------------ | ---------------------------------------------- |
| OS Platform  | Darwin 25.4.0 (arm64)                          |
| Bun          | 1.3.13                                         |
| Node.js      | v26.3.0                                        |
| .NET (F#/C#) | 10.0.203                                       |
| Rust (rustc) | rustc 1.96.0 (ac68faa20 2026-05-25) (Homebrew) |
| Go           | go version go1.26.2 darwin/arm64               |
| Python       | Python 3.14.5                                  |

✅ All cross-verification, MUMPS, and bit-field assertions PASSED successfully.
