# PR 17050 review custody

Date: 2026-09-08 UTC
Operational status: research-grade verification custody

The [signed review](../../2026-09-08-pr17050-publication-independent-review.md)
binds exact publication head `e6fd8fab2bbc2b2b119f6b475761af27830b5daf`.

[audit.py](audit.py) is the actually executed second audit. Its complete stdout
is [audit-observation.json](audit-observation.json); its empty stderr is retained
losslessly as `audit-stderr.gz`. [audit-identities.json](audit-identities.json)
binds these files and the first attempt's source preimage and disposition.
The first attempt's redirected stdout was empty; its error summary is explicitly
tool-observed, not a fabricated raw stderr capture. The first source is gzip
compressed unchanged. No archive was extracted or project workload executed.

The two original publication archives and every observed source path remain in
the named publication commit. This small custody package records independent
checks rather than duplicating those payloads.
