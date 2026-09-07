# Guarded controller: committed native pure boundary review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra, independent protocol-review agent
Reviewed source: 0b323c30f1b4fa5729f884a657b8839e0ad7e4c0
Disposition: accepted within the pure implementation slice; runtime admission pending

This read-only pass reconciles the committed receipt, policy adapter,
executable/test build wiring and retained hand evidence with the
[frozen protocol](2026-09-07-hidden-switch-compiled-protocol.md).
It follows the earlier working-source pass and its assertion-census
clarification. The native writer was already drafting a graph helper;
those uncommitted edits were excluded. No build, test, policy invocation,
guard calculation, source generation, debugger or measurement ran in this
review.

## Source and interface assessment

The committed receipt defines the agreed eight-field action service,
no-Q episode and separate scalar audit. Binary64 parsing retains signed
zeros and finite subnormals; belief range admission belongs to the policy
wrapper. The shared writer emits action/path, two reserved zero bytes and
six uint32 counters in the registered little-endian order. Its bounds and
enum checks precede writes. This is not a whole-call zero-allocation claim.

The native wrapper admits finite `[0,1]` beliefs and depths one through
three, invokes the unchanged evaluator and selector once, and retains the
actual traversal counters. Its one outer recursive invocation and zero
guard comparisons match the protocol. The fixed admitted depth bounds the
native integer counters before their uint32 conversion. The restriction
does not substitute a predicted count for the returned executed counts.

The private adapter starts at prior one-half, conditions the initial cue,
commits one selected action before feedback, predicts only after that
committed action and processes the terminal observation without another
choice. Its depth sequence follows the remaining horizon. Observation
copies the supplied frame cells before decoding; policy state retains
the scalar belief, supplied model/geometry and own chronology/filter counts.
It carries no source tape, scorer, episode identity or runtime handle.
Complete native-versus-old-runner conformance remains pending beyond the
small retained hand comparison.

The four hand tests cover literal output bytes and no-write refusals,
finite bit identity, actual depth-three work/input refusals, and adapter
chronology with the old filter as a bounded comparison. The snapshot test
name now matches its assertion: caller-cell mutation leaves the retained
scalar snapshot unchanged. That assertion alone cannot distinguish copying
from immediate scalar decoding or prove absence of an unexposed heap
reference. The private record's field shape and source read support the
separate no-retained-frame statement. The one census addition preserves
this mutation-mediated witness rather than disabling its check.

## Retained evidence and build configuration

The reviewed commit's
[validation record](https://github.com/Lucent-Financial-Group/Zeta/blob/0b323c30f1b4fa5729f884a657b8839e0ad7e4c0/docs/research/hidden-switch-compiled-validation/2026-09-07/native-pure-validation.md)
preserves the initial layout, test-parser and assertion-census failures,
later successful focused attempts and the explicit executable refusal.
The two setup-check failures are labeled reconstructed accounts, not
fabricated original command logs. No full-solution pass is claimed.

Independent read-only hash/XML inspection established:

- All 23 compressed records match their stored lengths/SHA256, and their
  losslessly decompressed originals match the original lengths/SHA256.
- All 12 source/configuration entries in the final snapshot match the
  reviewed commit's bytes. Its recorded checkout HEAD is the earlier
  co-claim; the report correctly distinguishes the subsequently committed
  working files from that earlier tree.
- The three locally available CLI output files still matched the retained
  DLL, dependency-file and runtime-configuration hashes at review time.
- The final focused TRX contains four individually `Passed` results and
  an overall `Completed` summary. The reviewer did not re-execute them.

The actual matching runtime configuration specifies framework 10.0.11,
roll-forward `Disable`, tiered compilation false and tiered PGO false.
The project disables ReadyToRun publication; the registered process-launch
`DOTNET_ReadyToRun=0` remains necessary to disable consumption of existing
ReadyToRun images. All three required launch flags and actual loaded-image
checks remain future admission obligations. The entry point at this commit
unconditionally prints a refusal and exits 2; it has no study command or
policy/source initialization.

## Acceptance boundary

No material source, chronology, counter, wire or build-configuration issue
remains in this committed slice. DTO declarations do not perform whole
receipt admission. Matching output hashes do not prove a build derivation,
and hand agreement does not establish the executing arithmetic graph.
The [runtime-readiness review](2026-09-07-hidden-switch-compiled-runtime-readiness-review.md)
retains the public-source versus installed-binary distinction, callable
pointer/body limits and pending coverage requirements. The graph helper,
compiled guards, native certificate admission, complete conformance and
phase orchestration require their own review before implementation archival
or registered source generation.
