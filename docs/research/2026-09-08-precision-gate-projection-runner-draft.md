# Fixed projection runner: integration draft

Date: 2026-09-08
Author: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade
Status: draft; not an accepted or executed final evaluation

The [runner](../../src/Interp.Python/zeta_interp/precision_gate_projection_run.py)
uses the fixed 40-ID/88-slot case plan and three source-bound service callbacks.
Its [13-fixture validation](precision-gate-projection/2026-09-08/run-draft-validation/README.md)
checks complete actual return retention, failed-launch versus crash/exception,
original-failure preservation after encoding/storage/finalization faults,
unchanged certified-baseline dependency, fresh mutations, forwarding of numeric
subject IDs and refusal to modify an already-used evidence store.

CollectionAndCriteriaPassed is deliberately a local recording/criteria field.
It is not source/archive admission, a physical-invocation attestation, a global
posterior result, a learned-system score or state-of-the-art performance.
The complete source archive and the actual native preparation/launch wrapper
remain external requirements before a real run can earn component admission.

The store uses the registered 256 MiB combined limit, 8 MiB final journal and
512 slots. One additional ordinary slot and 2 MiB combined space are reserved
within that total for a bounded terminal envelope. Every call's full actual
return or raised type/message is placed in memory before any parsing, encoding,
retention or criterion check. Raw native receipts and process metadata occupy
separate artifacts; the full original NativeObservation also remains in memory.
Terminal metadata links artifacts once, without recursive Store snapshots.

A primary process/API failure is recorded before attempting bounded retention
of that same current return. Later serialization failures remain secondary.
The next service never starts after an infrastructure failure. Once a StoreFailed
occurs, no new ordinary artifact or terminal append is attempted; only the
reserved, once-only journal finalization remains. In-memory retention is stated
explicitly when a complete result could not be encoded or stored. A fresh-store
admission refusal never finalizes or writes another run's store.

The original reference source 51a96 is present in the integration branch as a
draft dependency. Its root component is separately accepted, but the complete
certificate still has pending bare-API-failure and native trace-prefix repairs.
The accepted native candidate bf2da has a subsequently reproduced malformed
Unicode wire issue, separately undergoing fix-forward validation. The new
process launcher has no final source pin yet. These open findings bar the final
evaluation; no result is filled in from the synthetic fixtures.


## Independent review repairs

The [follow-up validation](precision-gate-projection/2026-09-08/run-followup-validation/README.md)
preserves four actual failing controls and the corrected 22-test pass. Public
Services configuration is checked before work. Preparation, snapshot,
comparison and per-slot calls are observed before admission; failures retain
the actual callback return and prefix. Minimal receipt shape precedes the
complete-receipt count, while full schema/source/custody remain separate.
The final-envelope fallback returns the original entries if metadata assembly
itself raises, and never repeats an already-entered finalization.

The reference certificate follow-up at ae37ac066 is independently accepted in
review 527ff454; importing that exact corrected dependency is the next integration
step. Native Unicode correction and process-adapter integration remain pending.
No final roster or numerical comparison has been opened.
