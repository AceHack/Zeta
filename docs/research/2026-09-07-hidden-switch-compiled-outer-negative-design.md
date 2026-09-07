# Guarded hidden-switch compilation: coordinator negative evidence

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra
Artifact status: proposed finite implementation contract; independent review pending

## Boundary and unchanged experiment

This closes the coordinator portion of sections D, H and I of the
[frozen protocol](2026-09-07-hidden-switch-compiled-protocol.md). It specifies
92 ordered, untimed conformance cases, with positive controls and actual
boundary calls. It changes no scientific model, strategy, seed, source domain,
registered row, measurement schedule, threshold or archive tag. The coordinator
owns implementation; this writer's present work is design only.

The existing [semantic falsifier contract](2026-09-07-hidden-switch-compiled-falsifier-design.md)
and [accepted pure source](2026-09-07-hidden-switch-compiled-falsifier-validation.md)
remain intact. Their 222 scalar positions, 48 new episodes, 24 old controls,
10 invocation cases, 10 intervention cases and 53 refusal operations are
one prerequisite to replay, not 92 newly generated behavioral examples.
Earlier unit-test counts cannot substitute for the actual case artifacts.
The [first native slice comparison](2026-09-07-hidden-switch-compiled-native-slice-replay.md)
established only the three numerical/episode slices under placeholder source
bindings; it did not close the complete conformance or runtime boundary.

Two obligations remain separate from this finite artifact:

1. `native-runtime-body-closure`: the native author's actual operation-graph,
   code-version, FP-mode, loaded-image and startup-configuration admission.
2. `final-actual-envelope-chain`: the coordinator's final exact-byte and
   chronology admission of actual hand, certificate, graph, behavior, setup,
   cost, replay and verdict envelopes, when those envelopes exist.

Neither validator is claimed to exist or pass by this design. These obligations
cannot be waived by the 92 cases. The runtime-record hash mutations below test
identity comparison, not whether the native collector discovered every image
or whether executing machine code satisfies the paper's assumptions.

## Acyclic evidence graph and six-member semantic API

The final hand retains its existing exact four-member payload and the complete
seven-member `Falsifiers` object. Its `OuterNegativeEvidence` is still exactly
the six-field descriptor `File, Bytes, Sha256, Encoding, StoredBytes,
StoredSha256`. The referenced outer-negative envelope must not reference the
complete final hand back again.

Preserve these standalone inputs first: the three native hand slices; the six
semantic falsifier members without `OuterNegativeEvidence`; raw certificate
and binding bytes; native certificate-call outputs; and the separate selector
witness. The outer-negative envelope refers to these prerequisites. The final
hand then refers to the completed outer-negative envelope and retains exactly
the same admitted semantic members and slices. The final whole-hand validator
checks that equality and the actual outer descriptor. No placeholder hash or
synthetic outer-evidence descriptor is inserted into the final hand.

The coordinator requested a small independent API addition, after this design
is reviewed:

```text
replay_semantic_falsifiers(scalars, episodes, old_controls, semantic, certificate)
    -> Success[SemanticFalsifierReplay] | SemanticFalsifierFailure
```

`semantic` has exactly `Schema, ScalarCoverage, HandCoverage, InvocationCases,
InterventionCases, RefusalCases`, with the existing values and nested schemas.
The implementation reuses actual existing checking internals and replays all
three complete slices. It returns the same `Completed` counts and two actual
`MutantRefusals`, plus `NumericCertificateSha256`, but has no descriptor field.
Its fixed scope is `pure-six-member-semantic-falsifier-replay`, with
`OuterNegativeAdmission=pending-separate-coordinator-replay` and
`RuntimeAdmission=not-performed-by-pure-replay`. Its distinct failure type
retains `Code, Message, Path, Completed` and those same scope fields. The old
complete API and its 63-case history remain unchanged. This API is pending
implementation and review; constructing a fake descriptor is not an alternative.

## Exact envelope and reference schemas

The proposed outer envelope has exactly these fields:

```text
Schema, AttemptId, StartedAtUtc, FinishedAtUtc, Complete, Failure,
SourceCommit, SourceFiles, CertificateBindings, NumericCertificateSha256,
Producer, Prerequisites, Cases, Completed, SeparateObligations, Scope
```

- `Schema` is `zeta.hidden-switch.compiled.outer-negatives.v1`.
- `AttemptId` is a canonical 26-character ZetaId. Timestamps use the existing
  strict UTC nanosecond parser; start must not follow finish.
- `Complete` is exactly boolean. `Failure` is null only for all 92 completed
  cases. Otherwise its exact fields are `Stage, CaseId, Call, Code, Path,
  Detail`; case ID/call are null before a case starts. A present call is its
  zero-based index. Detail is retained nonempty text, not an oracle by itself.
- `SourceCommit` is the resolved lowercase 40-hex candidate implementation
  commit. `SourceFiles` is the complete caller-reviewed ordered roster of
  `{File, Bytes, Sha256}`. Paths, integer lengths and uppercase hashes follow
  the existing source-file admission contract. The caller supplies expected
  commit/roster independently; the envelope cannot admit its own manifest.
- `CertificateBindings` is the exact reviewed map of `ProtocolSha256` and
  finite repository-relative source/helper/build/checker paths to uppercase
  SHA256. `NumericCertificateSha256` must match actual independent certificate
  verification. Output artifacts are excluded from the source map, avoiding
  certificate/self-hash cycles.
- `Producer` has exactly `EntryModule, Arguments, PythonIdentity`.
  `EntryModule` names the actual `python -m` entry, `Arguments` is the exact
  string array, and `PythonIdentity` is a six-field artifact descriptor of
  the actual successful loaded-module identity result. The producer must
  require `EntryAdmitted=true` against the expected source roster; a copied
  self-report is insufficient. Its interpreter/loader/OS trust limits remain.
- `Prerequisites` is an ordered array of `{Id, Artifact}` using the fixed IDs
  below; `Artifact` is the exact six-field descriptor. Every referenced stored
  and decompressed byte sequence is validated by the existing strict reader.
- `Completed` has exactly nonnegative integer `Cases, Calls`. Cases counts
  whole accepted cases; Calls counts actual completed top-level operations
  in this envelope, including the prefix of the first failed case. It is not
  a policy-node or profiler count. Both are recomputed from the checked prefix.
- `SeparateObligations` is exactly the ordered two strings named above. It
  cannot be emptied to turn this bounded record into runtime admission.
- `Scope` is `untimed-coordinator-negative-conformance`.

The prerequisite IDs, in order, are `certificate`, `certificate-bindings`,
`native-certificate-calls`, `hand-slices`, `semantic-witnesses`,
`selector-witness`, `candidate-native-record`. The last is a bound native
capture used for identity-link tests; its presence does not admit its contents
as a valid runtime. The native hand-slice artifact contains exactly `Scalars,
Episodes, OldControls`; the semantic artifact has the exact six fields above.
All actual native producer envelopes/launch records supplying those slices
are retained alongside them and bound by the final actual-envelope obligation.

Every case record has exactly:

```text
Index, CaseId, ControlId, Inputs, Calls
```

`Index` is its global zero-based roster position. `CaseId` is fixed below.
`ControlId` is null for a positive control or the named earlier control.
`Inputs` is an ordered array of `{Role, Artifact}`; role names and exact bytes
are reconstructed from the corresponding fixed fixture below, not supplied
as arbitrary instructions. `Calls` is an ordered array of:

```text
Sequence, Operation, InputRoles, ResultArtifact
```

`Sequence` is the case-local zero-based actual entry index. `Operation` is
one of the source-bound operations specified for that case. `InputRoles` is
the exact ordered string roster of roles consumed by that call.
`ResultArtifact` preserves the complete original API/native result. A
producer-supplied function name is never imported or invoked dynamically.

For Python calls, encode the actual public result as exactly `{Type, Fields}`:
`Type` is its module-qualified dataclass name and `Fields` contains every
declared dataclass field. Recursively encode nested dataclasses the same way,
tuples as arrays, bytes as exactly `{BytesHex}` with uppercase even-length hex,
and JSON scalars without bool/int coercion. The admitted operation fixes the
allowed result classes and all nested fields through its pinned public API;
the decoder never instantiates a producer-named type. Compare actual replayed
result types/fields, rather than accepting the type string as execution proof.
Retain all error details and prefix fields. Operating-system observations such
as PIDs, inodes and owned absolute fixture paths are retained raw; only the
declared role/path association and stable semantic checks below are compared
across fresh fixture runs. Raw evidence is never normalized or rewritten.

Native certificate calls retain the agreed exact DTO:

```text
{InputSha256, BindingsSha256, Outcome}
Outcome = {Kind: "accepted", NumericCertificateSha256}
        | {Kind: "refused", Failure}
```

`Failure` is the full existing nine-field native failure. A launch/read/output
failure is an incomplete operation, not successful certificate rejection.
Each call hashes both actual input byte strings, executes certificate verify
once and never calls a choice service. The coordinator associates the case ID
with these hashes; the native verifier need not trust a supplied case label.

The selector witness is exactly `{Input:{QBits}, ActualAction,
Mutation:{Kind, Action}}`, with `Kind=inclusive-epsilon-comparison` and both
actions exact integers. The two native call sites and their separate results
remain source-reviewed and retained. The pure checker independently executes
the strict software subtraction/selection and submits the actual mutant action
to its exact comparator, retaining the resulting typed mismatch.

## Fixed 92-case roster and controls

Groups execute in the order printed here. IDs within each group execute in
printed order. No row is deduplicated, retried into its slot, skipped, replaced
or declared complete from a historical unit-test count. Each negative has one
specified control and an independently checked nontrivial mutation. Fixture
construction and any setup calls are recorded separately from tested API calls.

### C: 31 certificate inputs, 62 actual verifier calls

Use the exact existing `hidden_switch_compiled_certificate_cases.CASE_IDS`
in their existing order, prefixed `certificate/`:

```text
baseline, wrong-protocol-binding, wrong-source-binding, wrong-epsilon,
changed-drift, changed-effect, changed-depth, reassociated-expression,
missing-alpha-candidate, reordered-alpha-candidates, changed-alpha-value,
missing-envelope-interval, missing-gap-interval, changed-endpoint-margin,
omitted-subtraction-error, swapped-depth-two-guards, outward-depth-two-switch,
outward-depth-two-harvest, outward-depth-three-switch,
outward-depth-three-harvest, inclusive-switch-relation,
noncanonical-rational, boolean-candidate-index, extra-top-level-field,
missing-top-level-field, duplicate-schema-key, nonfinite-index,
invalid-utf8, unpaired-surrogate, empty-input, truncated-input
```

Each case consumes roles `raw, bindings` and has two actual operations in
order: `python-certificate-verify`, `native-certificate-verify`. The baseline
must be accepted by both with the same independently reconstructed numeric
digest. Every other case depends on `certificate/baseline` and must be refused
by both at its actual byte/parser/certificate boundary. The independent checker
reconstructs all 31 raw inputs, confirms they are distinct, and checks the
native input/binding hashes. The full ordered 2/8/128 candidate certificate
is reconstructed; a supplied count or equality of Passed flags is insufficient.

### S and T: complete semantics and executable epsilon strictness

| ID | Control | Actual operation and required result |
| --- | --- | --- |
| `semantic/full-hand` | null | Call the new six-member API on the actual standalone slices/witnesses; require 222/48/24, 10/10/53, 15 refusal groups, 10 delegate entries, 8 evaluator entries and both actual wrong-stub mismatches. |
| `selector/epsilon-tie` | null | Read the actual native witness; QBits are positive zero and the admitted epsilon. Execute the software strict selector and exact mutant comparator. Native actual action is 0; executed inclusive mutant is 1; the comparator must refuse that 1. |

The certificate case `inclusive-switch-relation` changes inequality text in
the proof object. It does not exercise the executable epsilon comparison.
The separate supplied-Q witness closes that distinction without adding an arm,
belief sample, source tape or measured row. Neither operation admits runtime.

### B: eight raw JSON/schema cases

The fixed positive byte fixture is the ASCII sequence
`{"Count":0,"Value":-0,"Items":[0,1]}`. The real reader pipeline is
`strict_json`, exact keys, exact nonnegative integer Count, old-number
binary64 decoding of Value, and the exact two-integer Items roster.
It must preserve Value's `8000000000000000` bits. Input role is `raw`.
Each row has one `json-fixture-pipeline` call, which preserves its actual
underlying call/refusal result; the production strict reader is not stubbed.

| ID | Control | Exact change/result |
| --- | --- | --- |
| `json/control` | null | Admit the complete fixed fixture, including lexical negative zero. |
| `json/duplicate-key` | `json/control` | Insert a second `"Count":0` member; raw reader refuses. |
| `json/nonfinite` | `json/control` | Replace Value's `-0` token with `NaN`; raw reader refuses. |
| `json/bool-integer` | `json/control` | Replace Count's `0` with `false`; schema refuses. |
| `json/extra-key` | `json/control` | Add `"Extra":0`; exact-key admission refuses. |
| `json/missing-key` | `json/control` | Delete Count; exact-key admission refuses. |
| `json/truncated` | `json/control` | Remove the final `}` byte; raw reader refuses. |
| `json/invalid-utf8` | `json/control` | Replace the first byte of `Count` with FF; raw reader refuses. |

### A: seven byte-artifact/path cases

The original positive raw bytes are ASCII `ABC`; gzip uses mtime zero.
Roles are `descriptor, stored, original`. Input descriptors always retain
the exact actual bytes; the intentionally false descriptor being tested is
a separate JSON input. Use the gzip descriptor for stored-hash, original-hash,
unrelated-gzip and truncated-gzip mutations, so an identity-encoding header
inconsistency cannot substitute for the intended byte/relation check.
Negative rows depend on `artifact/control`.

| ID | Control | Actual calls and required result |
| --- | --- | --- |
| `artifact/control` | null | Call `bind_artifact_bytes` for identity and gzip in that order; both admit ABC. |
| `artifact/stored-hash` | `artifact/control` | Actual stored ABC remains; tested StoredSha256 becomes 64 zeros; bind refuses. |
| `artifact/original-hash` | `artifact/control` | Actual original becomes ABD with the ABC descriptor; bind refuses. |
| `artifact/unrelated-gzip` | `artifact/control` | Stored gzip encodes ABD with its correct stored hash; supplied original and original hash are ABC. Both individual hashes match but the lossless relation refuses. |
| `artifact/parent-path` | `artifact/control` | Tested File is `../escape.bin`; real descriptor admission refuses. |
| `artifact/symlink-path` | `artifact/control` | Real owned leaf is a symlink to an owned sibling ABC file; `read_artifact` refuses without following it. |
| `artifact/truncated-gzip` | `artifact/control` | Drop gzip's final byte and recompute only stored length/hash; `read_artifact` refuses decompression/original binding. |

### F: seven actual source/archive cases

Construct an owned local Git fixture containing ordered `a.py` and `b.py`
with exact ASCII bytes `A = 1\n` and `B = 2\n`. Preserve its actual commit,
blob IDs and reviewed expected roster. No fixture is a task implementation
or generated environment source. Every row calls the real
`verify_source_files` against an independently supplied expected roster;
never replace its Git/file readers with producer-provided hash strings.

| ID | Control | Exact change/result |
| --- | --- | --- |
| `source/control` | null | Actual archived and current two-file bytes match and admit. |
| `source/current-bytes` | `source/control` | Change current a.py to `A = 3\n` without changing archive/expected hashes; refuse. |
| `source/wrong-archive` | `source/control` | Supply a real second commit containing `A = 3\n` while keeping the original expected roster/current bytes; refuse. |
| `source/omitted-helper` | `source/control` | Remove b.py from supplied rows but retain both independently expected paths; refuse. |
| `source/reordered` | `source/control` | Swap the two rows; refuse. |
| `source/unarchived-helper` | `source/control` | Create current c.py with `C = 3\n` and include it in both expected and supplied rosters, while it is absent from the pinned archive; refuse, never silently drop it. |
| `source/symlink` | `source/control` | Replace current a.py by an owned symlink to identical bytes; refuse. |

Fresh fixture roots prevent one mutation contaminating another. Replay checks
the actual created commit and stable file/blob/content facts in its own run;
it does not require independently created fixture Git commits or paths to be
identical. Both original and replay observations remain preserved.

### P: eight actual loaded-Python cases

Use a bounded child process and two owned temporary clones A/B with identical
reviewed package, collector and direct helper source bytes. A tiny file-backed
entry/helper fixture imports no policy or source generator. Include the actual
collector/IEEE/package modules and tiny fixtures in the expected finite map.
The child runs through real `python -m` and `admit_python_identity`; no fake
sys.modules result or self-reported path substitutes for the actual objects.

| ID | Control | Exact change/result |
| --- | --- | --- |
| `python/control` | null | Run A's entry and helper against A; require EntryAdmitted true. |
| `python/foreign-entry` | `python/control` | Execute identical entry from B while expecting A; refuse. |
| `python/foreign-helper` | `python/control` | Actually import identical helper from B while expecting A; refuse. |
| `python/missing-helper` | `python/control` | Remove the required helper from actual sys.modules before admission; refuse. |
| `python/unlisted-module` | `python/control` | Actually import an extra file-backed `zeta_interp.hidden_switch_fixture_extra` absent from expected map; refuse. |
| `python/dynamic-module` | `python/control` | Replace the required helper by an actual unbacked ModuleType object; refuse. |
| `python/changed-origin` | `python/control` | Keep A's module/file but set its actual spec.origin to B's corresponding path; refuse. |
| `python/changed-bytes` | `python/control` | After import, change one same-length helper source byte without changing expected hash; refuse. |

Each row has one child entry operation and one actual collector operation in
its retained child trace. The deadline, raw stdout/stderr/exit status and exact
fixture files are retained; timeout or child crash is not the required typed
refusal. This is ordinary loader/interpreter trust, not a hostile-Python proof.

### W: five owned storage/retention cases

Use ASCII `original` for the complete file and `replacement` as the attempted
replacement. Actual fixture operation traces preserve before/after byte hashes.
No failed output is removed or rewritten to manufacture a clean result.

| ID | Control | Actual operations and required result |
| --- | --- | --- |
| `storage/control` | null | `create_directory`, then `write_exclusive`; admit and retain original. |
| `storage/reused-attempt` | `storage/control` | Create the same owned relative attempt twice; second call refuses, original remains. |
| `storage/reused-file` | `storage/control` | Write original, then call `write_exclusive` with replacement at the same path; second call refuses and original bytes remain. |
| `storage/partial-write` | `storage/control` | Inject one write failure after the actual first three bytes `ori` are written; preserve typed primary failure and that exact prefix. A second write attempt at the same path refuses. |
| `storage/changed-read` | `storage/control` | After the first metadata observation during `read_exact`, change original to same-length `ORIGINAL`; actual changed-file admission refuses. |

Injected I/O failure and mutation hooks are explicit owned fixture mechanisms,
not operational attack-rate estimates. They must preserve the first failure,
close each owned descriptor at most once and retain partial output. A harness
exception or cleanup-only error cannot be recoded as the intended refusal.

### H: eight complete-byte/link/chronology cases

These call the same narrow binding/chronology validator used by final envelope
admission. This shared production validator is an implementation requirement,
not a new assertion that the final whole-phase validator already exists.
Do not implement a fixture-only copy whose result bypasses actual admission.

The synthetic binding fixture has exactly `Records, Expected, Timeline`.
`Records` is the ordered seven `{Role, Artifact}` rows `hand, certificate,
graph, behavior, setup, cost, replay`. `Expected` has exactly `Context, Inputs`;
Context is `{ProtocolSha256, SourceCommit, NumericCertificateSha256,
NativeRecordSha256}`, using the admitted input identities, and Inputs is the
ordered seven `{Role, Bytes, Sha256}` full-envelope byte bindings.

Each synthetic record is a complete binding subject with exactly `Role,
Context, Inputs, Payload`. Its Context has those same four exact fields;
Payload is exactly `{Witness:0}`. Its Inputs is the ordered earlier-role prefix
of `{Role, Bytes, Sha256}` records, so the fixture itself is acyclic. These are
complete synthetic binding subjects, not full scientific episode envelopes.
The real validator must bind the complete provided subject bytes and every
link/context field. Expensive scientific producers are not called here.

Timeline has exactly `BehaviorFinish, BehaviorClosed, BehaviorExit,
CostStarted, BehaviorReadStarted, BehaviorReadFinished, AdmissionFinished,
FirstPolicyCall, SetupFinished, FirstRowStarted`. The positive fixture uses
2026-09-07T00:00:00Z plus respectively 0 through 9 nanoseconds, rendered at
the existing exact timestamp precision. Require nondecreasing times in that
order: the producer closes its output before successful process exit. This is synthetic
chronology, not measured process timing or proof that policy calls occurred.

| ID | Control | Exact change/result |
| --- | --- | --- |
| `links/control` | null | Bind all seven original complete subjects, contexts, links and timeline. |
| `links/envelope-substitution` | `links/control` | Change replay's metadata Role string, recompute its descriptor, retain original independent Expected input hash and unchanged Payload; refuse complete-byte binding. |
| `links/source-substitution` | `links/control` | Change cost's SourceCommit to a different 40-hex value and refresh its byte descriptors/links, retaining expected Context; refuse identity mismatch. |
| `links/certificate-substitution` | `links/control` | Similarly change cost's numeric certificate hash while refreshing byte bindings; refuse. |
| `links/runtime-substitution` | `links/control` | Similarly change cost's complete NativeRecordSha256 while refreshing byte bindings; refuse. This tests record identity, not live runtime inspection. |
| `links/reordered-inputs` | `links/control` | Swap the final two Records and Expected rows without changing their content; refuse fixed-role order. |
| `links/cost-before-behavior` | `links/control` | Move CostStarted one nanosecond before BehaviorFinish; refuse chronology. |
| `links/replay-substitution` | `links/control` | Change the replay subject's Payload.Witness to 1, refresh its own descriptor but retain the independently expected replay-byte binding; refuse. |

The later actual verdict must additionally bind the exact real replay bytes
and native inputs. Passing these synthetic shared-validator cases does not
discharge `final-actual-envelope-chain` or permit a missing final binding.

### Q: five complete choice-buffer cases

Use actual native scalar positions 0 and 1, in that order, as the fixed tuple
cycle, repeated twice. They have different depth/action/work behavior. Build
buffers from their actual native and compiled ChoiceWork records, preserving
the 28-byte layout. Each case calls `replay_choice_buffer` for native then
compiled, with exact full certificate/source/context keys and two passes.
These are four untimed hand-derived invocations per buffer, not cost rows.

| ID | Control | Exact change/result |
| --- | --- | --- |
| `choice/control` | null | Both complete four-record buffers match every byte and work sum. |
| `choice/late-counter` | `choice/control` | Increment the Nodes uint32 in record 2 by one; actual replay refuses there, retaining two completed records. |
| `choice/truncated` | `choice/control` | Remove the final record; refuse complete length. |
| `choice/reordered` | `choice/control` | Swap records 0 and 1; refuse exact expected position. |
| `choice/reserved-byte` | `choice/control` | Set record 0's first reserved byte to 1; refuse. |

### R: five exact schedule-header cases

The fixture is all 50 registered cost headers from the fixed source contract;
it creates no source tape or timing row. Each case calls `admit_cost_schedule`.

| ID | Control | Exact change/result |
| --- | --- | --- |
| `schedule/control` | null | Admit all 50 exact ordered headers and recomputed totals. |
| `schedule/omitted` | `schedule/control` | Remove the final header; refuse. |
| `schedule/reordered` | `schedule/control` | Swap headers 0/1 and restamp Index only; refuse strategy order. |
| `schedule/warmup` | `schedule/control` | Increase row 0 WarmupCalls by one; refuse. |
| `schedule/duplicate` | `schedule/control` | Copy row 0 into row 1 and restamp Index=1; refuse the duplicated position. |

### N: six resource/decision-domain cases

The base timing fixture is exactly `WallNs=1, CpuNs=0, AllocatedBytes=0`,
with three-element all-zero `GcBefore, GcAfter, GcDelta`. The native required
allocation median for the positive control is 1. These are synthetic integer
observations; no stopwatch, allocation probe or cost claim is produced.

| ID | Control | Actual operations and required result |
| --- | --- | --- |
| `resources/control` | null | `timing(measured=true)` admits the base; descriptive zero-native-CPU produces null plus reason `zero-native-cpu`; zero compiled allocation over positive native yields exact 0/1. |
| `resources/zero-wall` | `resources/control` | Set measured WallNs=0; real timing admission refuses. |
| `resources/negative-allocation` | `resources/control` | Set AllocatedBytes=-1; refuse. |
| `resources/decreasing-gc` | `resources/control` | Set GcBefore[0]=1, GcAfter[0]=0; refuse, never take absolute value. |
| `resources/zero-native-allocation` | `resources/control` | Required five native allocation totals are all zero; required-median admission refuses. |
| `resources/half-threshold` | `resources/control` | Execute exact half-median comparison on five repeated native totals 2^54 and compiled totals 2^53, then 2^53+1. First condition is true, second false; neither is malformed data. Retain exact rational pairs. |

The descriptive-ratio helper and final required-cost admission must be shared
with production verdict computation. No fixture-only floating conversion or
test result can stand in for those actual operations.

## Replay, failure evidence and implementation review

The independent coordinator replay takes exact raw envelope bytes, an
independently admitted expected context and an owned strict artifact reader.
It checks every nested key/type, fixed ID/order/control dependency, raw artifact
relation, whole-source binding and complete prefix. It reconstructs every
specified mutation and positive control before invoking the relevant actual
Python/API boundary. Native verifier/witness outputs are checked against the
independent arithmetic and raw inputs, not described as re-executed native
code. Both producer and replay raw results are retained.

Expected invalid input must yield its named typed refusal at the actual
boundary. Unexpected success, an unrelated early failure, process crash,
timeout, missing input or missing API leaves the conformance incomplete.
Missing runtime or final actual-envelope validators remain the two separately
named obligations; their nonexistence is never converted into a successful
test count. Complete prefix accounting includes the first-case failure and
late-case failure regressions; a malformed later record cannot erase earlier
input hashes or output prefix. The attempt directory and every result file
use exclusive creation, and the first failed attempts remain preserved.

Before archive, review the actual call sites, discriminating mutant tests,
exact artifact case roster and public error/result paths. Test loss or an
implementation defect is repaired with its original evidence retained; there
is no replacement behavioral seed or changed scientific threshold. Full
runtime/graph admission and final real-byte chain validation remain required
in addition to this bounded implementation evidence.
