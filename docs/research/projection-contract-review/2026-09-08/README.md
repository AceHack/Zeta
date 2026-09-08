# Scalar projection contract review custody

Operational status: research-grade

The [signed independent review](../../2026-09-08-projection-contract-independent-review.md)
is the entry point. [manifest.json](manifest.json) binds three lossless
contract snapshots: original ad6eab989, complete-observation/context repair
9a950c2dc and final exact-width clarification 1bf71bbac. Original findings
remain reconstructible and are not recast as observed numerical failures.

[prepare.py](prepare.py) is the exact metadata-only retention procedure.
It reads named Git blobs, checks existing dependency identities and confirms
the one reused coefficient in an already archived vector file. It imports
none of the audited modules and runs no solver, objective, vector generator,
new case serializer or native process. Its JSON output is a byte-custody
manifest, not a scientific receipt.

The signed acceptance is for the final proposed contract's design. Actual
registration, source co-claims, implementation review and finite numerical
evidence remain separate and unperformed by this review.
