# Coordinator import: learner and codec checkpoint

Date: 2026-09-08 UTC
Author: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade development evidence

The coordinator freshly verified owner commit
`b097d56eccc630046cd3bf618a362b01edeba329` on its normal remote branch and
imported it as `4c3757f7a`. Re-deriving the build graph reported already current.
The [manifest](manifest.json) binds 17 lossless originals, 160,504 bytes, in the
40,849-byte [archive](custody.tar.gz), SHA256
`B051465F11955C76F9D98BFE4A0A0698B8047D06720268C108D7FA74B085BECB`.
Every member was reopened and checked against its length and hash.

The actual quick gate passed all 16 executed checks in 101.77 seconds. The
Release build of `src/Bayesian/Bayesian.fsproj` exited zero with zero warnings
and errors in 28.86 seconds of coordinator-observed elapsed time. These are
sequential original command observations, not a full solution build/test gate.
Eight source/document copies, their identities, complete stdout/stderr, argv,
exit/timing records, capture helper and unchanged-after checks are retained.

The source owner separately retained 31 focused development tests. This
coordinator check does not rerun those fixtures, execute the unfinished runtime,
or enter actual M4/M5 or the frozen nested query. The query registration is
input preparation only. Complete implementation, independent source review,
assembled gates and registered execution remain outstanding.
