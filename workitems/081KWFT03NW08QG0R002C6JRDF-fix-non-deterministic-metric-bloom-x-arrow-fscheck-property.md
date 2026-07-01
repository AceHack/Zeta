---
id: 081KWFT03NW08QG0R002C6JRDF
type: bug
state: backlog
priority: P2
slug: fix-non-deterministic-metric-bloom-x-arrow-fscheck-property
title: "Fix non-deterministic Metric/Bloom x Arrow FsCheck property test (seed-pin or real round-trip defect)"
created: 2026-07-01T21:40:11.068Z
depends_on: []
composes_with: []
---

# Fix non-deterministic Metric/Bloom x Arrow FsCheck property test (seed-pin or real round-trip defect)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KWFT03NW08QG0R002C6JRDF-*.md` glob. -->

## Site

`tests/Tests.FSharp/Metric.Serializer.Tests.fs:154` — the property
``Metric/Bloom × Arrow: state round-trips through Arrow IPC and rehydrates``.
Also tracked in `docs/BUGS.md` (P2).

## Symptom (Otto, 2026-07-01)

Surfaced while verifying Lior's direct-to-main Bucket-C push (`91d6b7661`). A full
`dotnet test tests/Tests.FSharp` run reported **1 failed / 3709 passed**, the single
failure being this Bloom×Arrow property. Re-running the Metric tests in isolation
passed **72/72**. So the failure is **non-deterministic** — it does not reproduce
on demand.

## Two hypotheses (the fix must distinguish them)

1. **Test bug (likely):** the FsCheck generator isn't seed-pinned, so a rare input
   is hit only some runs. This violates DST (manifesto §7): a property test must
   replay the same case from the same seed. Fix = pin `Replay`/seed for this
   property (or the module) so any failure reproduces deterministically.
2. **Real defect:** `SerializerLegs.arrowRT ∘ bloomToDynamic` genuinely loses state
   for some `int64 list` — the Bloom→DynamicValue→Arrow IPC→rehydrate round-trip
   drops a bit for specific inputs. If so, fix the serializer, not the test.

## Definition of done

- Reproduce deterministically (capture the failing seed/case).
- Decide hypothesis 1 vs 2 from the captured case; fix accordingly.
- Property passes deterministically across repeated full-suite runs.
- Anchor to DST determinism; remove the `docs/BUGS.md` entry on fix.

**Who:** metric-serializer owner (Naledi) or DST/formal (Soraya).
