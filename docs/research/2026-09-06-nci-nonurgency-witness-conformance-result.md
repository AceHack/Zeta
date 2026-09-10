# NciNonUrgency Finite Witness-Conformance Result

**Status:** Measured finite conformance result.  
**Date:** 2026-09-06.  
**Result:** The pinned `NciNonUrgency` TLC experiment completed with its expected
valid verdict, exit code `0`, and `512` exhaustive distinct states. The
TypeScript and independently authored Python wrappers emitted the same canonical
920-byte witness receipt.

> This result concerns exactly one bounded, fairness-conditioned TLA+ model. It
> is **not** an NCI floor, production safety theorem, policy score, consent
> record, consensus result, or authority grant.

The [2026-09-07 historical-fixture correction](2026-09-07-tlc-macos-c1-policy.md#publication-integration-historical-nci-fixture)
preserves the exact original registry after the live TLC platform policy
changes. The regression tests replay this historical subject; the current
registry still refuses the old receipt. Both measured receipts remain unchanged.

## 1. Measured witness

| Field                              | Observed or pinned value                                           |
| ---------------------------------- | ------------------------------------------------------------------ |
| Witness schema                     | `zeta.nci-witness/v1`                                              |
| Subject model                      | `NciNonUrgency`                                                    |
| Model SHA-256                      | `3444cb6e66904406460143a27fc8932f30aac4b4d78ad37d09f59dfc0822319f` |
| Config SHA-256                     | `98e80eeef8949ffd598cd29cc7ad44dc70eae1636dea6f3cf2b7954bc62340b9` |
| Registry SHA-256                   | `44f1ca2feb2c7ba9cab47f06d2fcd60c097ef6d55ed602299f0e1a645791de54` |
| TLC jar SHA-256                    | `71546dff3897a01b0ee4fa64135d9f5e9384d2b7e47b3cc20a16b655b0eb4f86` |
| Tool banner                        | `TLC2 Version 2026.05.18.174321 (rev: 8ba1027)`                    |
| Workers                            | `1`                                                                |
| Result                             | `valid`, exit code `0`, clean completion marker                    |
| Exhaustive state count             | `512`                                                              |
| State invariants                   | `TypeOK`, `NoCoercion`                                             |
| Temporal property                  | `Responsive`                                                       |
| Receipt length                     | `920` bytes, including final LF                                    |
| TypeScript receipt SHA-256         | `d5e89f5675f478f3dbfe3ff633bc69f4f8b848ceeac15e5383730120a59a173e` |
| Independent Python receipt SHA-256 | `d5e89f5675f478f3dbfe3ff633bc69f4f8b848ceeac15e5383730120a59a173e` |

The model uses exactly the configuration `Travelers = {ta, tb, tc}`,
`EventBudget = 1`, `AllowForce = FALSE`, and `TrustUrgency = FALSE`. Its
fairness assumptions remain a condition of the result. The observed scope is
therefore accurately described by the receipt label
`bounded-three-traveler-event-budget-one-fairness-conditioned`.

## 2. Cross-surface replay

The TypeScript wrapper admits the raw model, configuration, registry, and jar
bytes; invokes the existing registry-owned TLC command; and emits a canonical
receipt only after that command succeeds. The Python wrapper separately parses
the pinned registry, independently builds the direct Java invocation, checks the
banner, exit code, completion marker, and final state count, and emits the same
receipt layout. The two committed result artifacts are byte-identical.

This is a useful boundary check but **not independent checker diversity**. Both
paths rely on the same committed TLC jar, model, configuration, and registered
state-count expectation. It detects wrapper, invocation, serialization, and
admission drift; it cannot independently establish the soundness of TLC or the
model's interpretation. An alternative checker would require a new contract,
separate expected-result reconciliation, and a distinct fault model.

The subsequent
[emitter capability correction](2026-09-06-nci-emitter-capability-correction.md)
replaces an import-regex independence claim with an executable, bounded
dependency and effect fixture. It preserves the original R5 gate finding,
the upstream static-roster repair, and the fixture's explicit limits.

## 3. Observed faults

The conformance suites exercised the following named failures rather than
assuming them away.

| Mutation or fault                                                                      | Observed disposition                                                    |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| One appended model byte                                                                | `refuse-identity-mismatch` before a receipt is rendered                 |
| Changed configuration byte                                                             | `refuse-identity-mismatch` before a receipt is rendered                 |
| Changed jar byte                                                                       | `refuse-identity-mismatch` before a receipt is rendered                 |
| Changed registry worker count                                                          | `refuse-identity-mismatch` before a receipt is rendered                 |
| Reordered or incomplete valid JSON receipt                                             | `refuse-receipt-mismatch`                                               |
| Changed receipt state count from `512` to `511`                                        | `refuse-receipt-mismatch`                                               |
| Replaced `AllowForce = FALSE` with `AllowForce = TRUE` in a temporary independent copy | TLC exit `12`, `Invariant NoCoercion is violated`                       |
| JVM that does not start                                                                | `defer-checker-did-not-run`, distinct from toolchain drift or a verdict |
| Attempt to interpret receipt fields as a score or authority                            | Rejected by schema: no such fields or integration path exist            |

The final row is intentionally structural rather than moral. A field absence
does not prevent an external caller from making an unsupported claim, but the
verifier's typed receipt and contract provide no value that could be confused
with a policy ranking, authority token, or consent decision.

## 4. Current capabilities and retained limits

The repository can now attach a replayable formal-witness observation to a
caller-owned `nci-preservation` basis only when all pinned inputs and the finite
verdict agree. The current policy-admissibility module does not automatically
consume this result; a later integration would need its own narrow contract and
must preserve the `no policy selection effect` rule.

`recorded-consensus` still resolves to `defer-basis-not-implemented`. Existing
attestation checks establish only the stated bound/unbound provenance verdicts,
and existing consensus helpers are not immutable consent records. This work adds
neither a voter roster, a threshold, a decision rule, an expiry model, nor an
authority grant.

## 5. Reproduction

The committed artifacts are
`docs/research/data/2026-09-06-nci-witness-v1-typescript.json` and
`docs/research/data/2026-09-06-nci-witness-v1-python.json`. Each must be
verified as exact bytes; generic formatting is intentionally excluded for this
reason.

```text
mise exec -- bun src/Core.TypeScript/formal-verification/nci-witness-receipt.ts
PYTHONPATH=src/Core.Python/src src/Core.Python/.venv/bin/python \
  -m zeta.nci_witness_receipt_oracle
```

These are checker executions, not a policy-evaluation loop. Any enclosing
bounded tick must remain an attributed execution envelope and must not alter the
recorded TLC invocation or turn a deferred/incomplete checker run into a
success.

## References

1. [Finite NCI witness-verifier contract](2026-09-06-nci-witness-verifier-contract.md)
2. [NciNonUrgency model](../../src/Core.TLA/specs/NciNonUrgency.tla)
3. [NciNonUrgency configuration](../../src/Core.TLA/specs/NciNonUrgency.cfg)
4. [TLC invocation and verdict rule](../../src/Core.TypeScript/formal-verification/tlc-invocation.ts)
5. [TypeScript witness wrapper](../../src/Core.TypeScript/formal-verification/nci-witness-receipt.ts)
6. [Independent Python witness checker](../../src/Core.Python/src/zeta/nci_witness_receipt_oracle.py)
