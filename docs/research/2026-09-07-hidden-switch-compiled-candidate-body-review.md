# Guarded controller: candidate-body instrument and adapter review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra, independent protocol-review agent
Reviewed source: `5ff11d7e5df2493d6bd96853cb3dce73663a2653`
Disposition: accepted for candidate-only inspection; runtime admission pending

This follows the [prefix evidence review](2026-09-07-hidden-switch-compiled-prefix-feasibility-review.md).
The reviewer read the final native/helper/test changes and their scoped report.
No reviewer build, test, debugger target, policy invocation, guard computation,
registered stream or measurement occurred. This review precedes the first
candidate-body capture; it does not report an actual complete body match.

## Instrument findings and dispositions

The parser now requires an explicit initial offset zero, contiguous emitted
offsets and exactly the declared number of four-byte instructions. Truncation,
malformed instruction-looking lines and absent declared ends refuse. These
checks repair the earlier missing-initial-offset and malformed-line findings.

The observed ARM64 callable form is decoded narrowly: an exact literal load
into `x11`, followed by a branch through `x11`. The helper retains the stub,
literal pointer-cell address/bytes and resolved target. It requires readable
memory, executable code, aligned instructions and bounded reads contained in
the observed memory region. Unknown forms refuse rather than being normalized
into an assumed target.

A prepared type/name must select one compiler block. Its declared length is
only a candidate size. Raw target bytes are retained before comparison, and
every candidate instruction is independently decoded by LLDB with exact
contiguous addresses, width and bytes. Mapping and earlier per-method evidence
survive a later refusal. Complete agreement would establish correspondence
with the emitted candidate bytes, not an independent method-extent theorem.

PC-relative literal opcodes now require an explicit known literal binding even
when an annotation is absent or malformed. The supported double and vector
loads bind exactly eight or sixteen actual bytes to one or two declared
64-bit words. Unknown forms and unused declared literals refuse. This repairs
the earlier annotation-only check, which could miss required data. The actual
two-word vector form found in retained prefix output is supported exactly; its
initial unsupported-form refusal remains historical evidence.

The stopped-process repeat checks the pointer cell and complete candidate body.
It is a repeated observation, not an atomic or future-immutability guarantee;
literal data is separately read and compared. The branch ledger explicitly
lists its recognized transfer kinds and leaves them unclassified. It is not a
complete control-flow graph or a proof that other address/data forms are absent.

The eight hand-authored candidate tests discriminate complete scalar/vector
literal agreement, changed data, a changed repeated pointer, missing annotation,
offset/size/truncation faults, permissions and refusal preservation. The six
existing prefix/transport tests remain separate. The author's reported passing
tests and retained fixture failure are validation of the inspection instrument,
not native-produced scientific conformance.

## Shared adapter and graph preparation

`chooseWith` retains the common depth, service invocation and commit chronology.
The native and compiled callbacks return the same choice/work shape; policy
successors retain the existing bounded numeric/history fields. Callback
construction must remain within the same eventual accounted boundary. No cost
or retained-heap conclusion follows from this source review.

The preparation roster is exactly 28 direct native-wrapper calls and 36
compiled-service calls. The compiled total consists of 24 scalar points, eight
guard/adjacent points and four adapter calls. These service calls may themselves
recurse; the two reported totals are not counts of all recursive evaluations.
Certificate preparation uses explicitly named placeholder hand bindings. This
is graph preparation, not the registered hand roster or measured prelude.

The equality-census increase from one to two for
`tests/Tests.FSharp/HiddenSwitchCompiled.Tests.fs` is accepted as a specific
mutation-mediated comparison. Although both locals have the same initializer,
later snapshots contain successors returned by distinct actual native and
compiled services. Their action comparison and chronology refusals are separate
checks. This is one alternating hand history, not universal controller
equivalence. The initial census failure remains retained; this disposition does
not authorize unrelated census increases.

## Remaining admission obligations

Every candidate must retain `BodyResolved=false`, `ClosureAdmitted=false` and
`RuntimeAdmitted=false`. Independent method extents, all reachable arithmetic,
data and call roles, generated/inlined/generic code, final measurement callers,
and runtime/FP/image correspondence remain unresolved obligations.

The expanded preparation/reflection roster includes the selector, guard getters
and preparation callers. Inclusion in that roster does not prove complete
executing closure. Likewise, the earlier 23 managed assembly records all having
`Dynamic=false` does not rule out framework-generated dynamic methods: retained
JIT output names such methods. The raw dyld observation and availability of
standalone image files are separate evidence, not interchangeable image rosters.

## Reviewed file fingerprints

SHA256 values below bind the source bytes read for this acceptance. They do not
prove that a later target executed those bytes or establish source-to-binary
derivation.

| File | SHA256 |
| --- | --- |
| `src/Research.FSharp.Cli/inspect_hidden_switch_bodies.py` | `acd80bf2420d5e33568d8d856accc25b9020ddd580db93832f9b661b7331debf` |
| `src/Research.FSharp.Cli/test_inspect_hidden_switch_bodies.py` | `0ffbf4bf3b505d954fcb57a829f60d5e871e2640056a09039dd9dcec44074457` |
| `src/Research.FSharp.Cli/inspect_hidden_switch_graph.py` | `d723d356e1c49c932f65829a4311578abf71d604b0ff348c2a8c38cad36c8674` |
| `src/Research.FSharp/HiddenSwitchCompiledGraph.fs` | `7439e5d4fe9aa92591a61d13a8e407536cc3d6f699e2506f52ee92732a565c43` |
| `src/Research.FSharp/HiddenSwitchCompiledPolicy.fs` | `e2b7e916cf49f67e74053e35e808c0cd79b581c3d4de2fa9fe2fb09f90d8f187` |
| `tests/Tests.FSharp/HiddenSwitchCompiled.Tests.fs` | `0460fdaa442ca2a501a0863ac70b3743baa5f2791afc1cf7c64b1b3cb8b5cc52` |
| `src/Research.FSharp.Cli/HiddenSwitchCompiled.fsproj` | `47a77a6b337aab94be0b794dc8d7a090897f5db4726895497d4b5915cf9beb6c` |
| `tests/Tests.FSharp/Tests.FSharp.fsproj` | `ff221e1b8fab1aecf18419e740c7307e92991e24539260365d3df1edd644b98b` |
