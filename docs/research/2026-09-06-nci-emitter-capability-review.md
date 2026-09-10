# Independent NCI emitter capability review

Date: 2026-09-06
Operational status: research-grade
Lifecycle: active
Reviewer: Vera, OpenAI Codex using GPT-6 Astra, independent reviewer agent
Work item: 081M1WFV2MW087G0R00078X6PV
Reviewed implementation: `aff9ee6a069c7924b35ac996f3d678de8bfecf41`
Status: source and evidence accepted; local focused and quick gates passed

## Scope and method

The reviewer inspected the production emitter, its existing receipt tests,
the new capability fixture, the [correction report](2026-09-06-nci-emitter-capability-correction.md),
and the retained Bun output. This was a separate agent's read-only review;
the reviewer did not run the fixture, TLC, a build, or a benchmark. The
production emitter and historical witness bytes remain unchanged.

The review concerns a bounded trusted-code regression fixture. It establishes
neither transitive independence from the delegated checker nor an untrusted
JavaScript security boundary. The official
[Node VM documentation](https://nodejs.org/api/vm.html) explicitly excludes
the latter use. Its presence here supplies execution contexts and module
linking, with reviewed host functions and controlled effect handlers.

## Source and effect assessment

The fixture reads the actual emitter source and uses TypeScript type erasure
to obtain ESM. It does not replace the emitter's receipt or validation logic
with a second implementation. Its module linker supplies exactly the four
declared interfaces: hashing, path joining, checked in-memory file access,
and a checked subprocess request returning an injected outcome.

The expected receipt is independently loaded from the committed artifact.
The reviewer verified its length of 920 bytes and SHA256
`d5e89f5675f478f3dbfe3ff633bc69f4f8b848ceeac15e5383730120a59a173e`.
The tests require equality of the entire rendered string, not just its parsed
verdict or selected fields. The original receipt tests also retain equality
with the committed Python artifact and their altered-input refusal cases.

The exact observed call expectations are coherent with the production source:

- Rendering reads the four admitted files as bytes, then the registry as
  UTF-8: five events.
- The controlled successful runner reads those five inputs, requests the
  exact declared runtime/arguments/options, and performs the same five reads
  again before rendering: eleven events.
- The controlled failed runner reads five inputs, requests the declared
  process, and returns its exact refusal before receipt revalidation: six
  events.

These are fixture requests, not real filesystem or subprocess traces. The
input bytes originate from the four pinned repository files; subsequent
emitter reads receive copies from the fixture. The subprocess handler does
not execute `run-tlc.ts` or TLC. Its success and failure results are supplied
inputs whose handling is under test.

The named executed mutations exercise failure routes absent from the earlier
static import-roster assertion. Direct and aliased checker reads, a computed
`python3` command, changed arguments for the admitted runtime, and a caught
read refusal retain the original four imports. The effect handlers reject
their requests. The sticky denial ledger also makes the caught refusal fail
the exercised synchronous exported call. The separate static-import mutation
is refused by actual module linking. The explicit undefined-module guard
agrees with TypeScript's checked indexed-access types.

## Dynamic-import correction and validation evidence

The original candidate executed a computed dynamic import through
`SourceTextModule`. The contributor reports all 18 tests passed on Bun 1.3.14,
but the CI-pinned Bun 1.3.13 process exited 133 at that case. The reviewer read
the retained partial output: four preceding cases passed, followed by no
completed summary. The report additionally records the isolated invocation,
exit status, original source snippet, and callback/evaluation sequence. There
is no retained stack trace or demonstrated lower-level crash mechanism.

The revised source walks the parsed TypeScript AST and rejects a call whose
callee is `ImportKeyword` before constructing or evaluating the VM module.
That syntactic admission includes the named computed-specifier mutation.
The resulting test is explicitly syntax-admission evidence, not an executed
dynamic-import callback refusal. The runtime callback remains a fallback;
the named test no longer exercises the Bun 1.3.13 crash route.

The reviewer inspected the retained final focused log: Bun 1.3.13 reports
18 passing tests, zero failures, and 37 assertions across both files. Its
test names distinguish syntax admission, actual linking, controlled checker
outcomes, and executed effect refusals. No additional TLC measurement is
claimed. The reviewer also inspected the preserved final quick-preflight log:
all sixteen executed checks passed, including strict TypeScript, both assertion
censuses, markdown, and the other language/hygiene gates. This test-only change
does not claim an additional full .NET build or TLC experiment.

## Findings and disposition

The reviewer requested that the denial-ledger comment describe its synchronous
scope, rather than imply detection over arbitrary later execution. The final
comment and correction report preserve that qualification. The Bun
compatibility change also preserves the distinction between the original
executed mutation and the final AST restriction.

No material source or evidence-interpretation finding remains within the
declared scope. The reviewed source commit and local validation records are
preserved with the correction report; the PR must retain its publication
checks and this indexed review.
The test does not establish a theorem about arbitrary reflection, deferred
asynchronous effects, generated code, or all JavaScript escape paths. The
reviewed literal-shaped process call and its named mutations do not make the
JSON argument comparison a general capability-security theorem. The delegated
`run-tlc.ts` component remains an explicit assumed boundary; its transitive
implementation is outside this fixture.
