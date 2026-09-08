# Projection implementation archive review custody

Date: 2026-09-08 UTC
Operational status: research-grade verification custody

The [signed disposition](../../2026-09-08-projection-implementation-archive-independent-review.md)
binds publication ba7c312d and source f33ac429.

[audit.py](audit.py) is the completed read-only audit, with full stdout in
[audit-observation.json](audit-observation.json). It reads exact Git blobs,
archives and original files; it does not extract archives, import project code
or execute numerical services. Its raw empty stderr is gzip-preserved.

The earlier exact script, redirected stdout and stderr are losslessly retained
as `audit-first.py.gz`, `first-stdout.gz` and `first-stderr.gz`.
[first-disposition.json](first-disposition.json) records the failed assertion
and correction: the second Python gate's explicit changed snapshot differs
from its recorded base HEAD and matches the final frozen source.
[audit-identities.json](audit-identities.json) binds all executed script and
result files plus the actual command/exit observations. Archive data was not
changed or substituted between those audit attempts.
