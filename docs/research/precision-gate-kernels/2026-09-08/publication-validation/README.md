# Precision-kernel fresh-main publication validation

Date: 2026-09-08 UTC
Operational status: research-grade validation receipt
Author: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1Z63YMC087G0R003N5FH9X

The publication branch starts from origin/main
38b3acd14f0fc07449ace1b78311959f249468ed. Preparation copied 212 new paths
from the root integration cut afce96353549a27937dc8b5626532c8aca5ec026,
including their Git modes. Two project patches and five existing documentation
patches used ordinary three-way application, preserving current-main additions.
The completed PR17027 publication work item and event accompany its existing
main proof; the two parent claim files are not part of this publication.
Later signed review and integration-evidence imports produce the checked cut
c1e6f0497afcc5078b03bfe8e797dc12e684cf58.

At that exact cut, full preflight passed all 18 executed checks in
634.531074 seconds, including the release build and complete test command.
The runner retains its actual summary rather than every successful child test
name. `dotnet format Zeta.sln --verify-no-changes --no-restore` exited zero in
17.264940 seconds, with explicit unsupported-F# diagnostics. That exit does
not establish F# formatting coverage; the separate F# lint passed in preflight.

The fixed [replay contract](../../../2026-09-08-precision-gate-kernels-native-reference-replay.md)
ran against the fresh publication binaries in 1.182671 seconds, exit zero.
The unchanged producer and unchanged arithmetic matched all 16 ordinary
numerical success rows and seven typed refusals. The remaining tiny-shape
encoding observation exposes its binary64 discrepancy separately. All ten
output-mutation controls were rejected; these are comparator controls, not
mutated library executions. Only the reference and native-output paths changed
in the retained comparator relative to the reviewed root comparator3.

The two directly observed assemblies were copied before invocation. Their
byte counts and SHA256 values agree before invocation, in the producer's
return, and afterward. The copies and records are retained. This witnesses
those two loaded assemblies, not a transitive runtime closure or a complete
source-to-binary derivation. The fresh assemblies differ from the prior root
build and are not relabeled as the old execution.

The inline capture harness failed in its final console summary because a
loop variable shadowed the subprocess result. Both child processes and their
process records, output streams, custody report and comparison report had
already completed successfully. An independent read verified those existing
records without rerunning the experiment. The tool-visible final exception
was not separately captured as raw stderr; its explicitly labeled transcription
is retained. It is not fabricated into a raw stream or hidden as success.

The [manifest](manifest.json) identifies all 33 losslessly compressed preparation
and validation artifacts and seven current source/project/input identities.
Original and stored hashes bind every gzip record. No learned gate, scalar
projection optimizer, chronological benchmark or state-of-the-art comparison
has run in this slice. GitHub CI and exact main ancestry remain later publication
obligations and are not inferred from these local checks.
