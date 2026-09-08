# Projection driver independent review custody

Date: 2026-09-08 UTC
Operational status: research-grade verification custody

The [signed review](../../2026-09-08-projection-driver-independent-review.md)
binds the exact initial driver source and its controlled validation.

[audit.py](audit.py) reads pinned Git/archive bytes only. It verifies gzip
member completion, stored/raw lengths and hashes, local originals, owned source
identities, actual source/test snapshots, the fixed source roster and dependency
comparisons. It never imports project modules or executes archived code.
The exact initial invocation is `python3 audit.py
1f4db4b7ad2953648a37a38d0613bb99fc7d0633 driver-source-validation`;
[initial-audit.json](initial-audit.json) is its complete stdout. The actual
invocation used the repository-relative script path; exit was zero and stderr
empty. Command/result identities are retained separately.

The same audit script checked `53cf6cdaa75f9dcb1ab1de2c48144685fdc286d5
driver-link-resolution-validation`; [followup-audit.json](followup-audit.json)
is its complete stdout. [bindings-audit.py](bindings-audit.py) independently
compares the unchanged production source, both executed source/test pairs,
withdrawn transient edit, false-positive fixture outcomes and original normal
push/ref proof. Its stdout is [bindings-audit.json](bindings-audit.json).
All three exact commands and their executed script/result hashes are in
[audit-identities.json](audit-identities.json); raw empty stderr streams are
retained as gzip records without whitespace changes.
