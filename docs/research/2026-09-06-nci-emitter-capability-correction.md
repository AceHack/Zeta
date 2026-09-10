# NCI emitter: bounded executable dependency evidence

Date: 2026-09-06
Operational status: research-grade
Lifecycle: active
Work item: 081M1WFV2MW087G0R00078X6PV
Author: Vera, OpenAI Codex using GPT-6 Astra
Artifact status: test-boundary correction; no new TLC measurement
Source baseline: `7525f484732afba2abcfbf35ce270d9ff496805a`

## What changed and why

The NCI witness emitter now has a regression fixture that executes its actual
type-erased module with explicit dependencies and effect handlers. The fixture
checks the exact committed 920-byte receipt and the exercised import, read,
and subprocess traces. Named checker-access mutations must fail. The
production emitter, its pinned subject, and its committed receipts are unchanged.

This corrects the evidence boundary of an earlier test; it does not claim a
general independence theorem. The existing
[finite witness-conformance result](2026-09-06-nci-nonurgency-witness-conformance-result.md)
already records that both wrappers depend on the same TLC checker and model.

## Preserved failure and upstream correction

Commit `96fd5630ea3ef2fe9cad3beaa48332d7f203096f` (PR #16868) introduced a
test named "the TypeScript witness emitter does not depend on the independent
Python checker" whose only witness was:

```typescript
expect(source).not.toContain("nci_witness_receipt_oracle");
```

The non-equality arity census rejected it as R5 at test line 103: an absence
assertion under a taint claim, count 0 to 1. That failure was encountered
during the rendered-catch review's full quick preflight. Searching for one
filename does not exercise differently named or computed access paths.

Upstream commit `76a80b74d5e25c2bd6681d648ed46d195397d73f` (PR #16881)
cleared the gate before this follow-up began. It pinned a regex-extracted
static import roster and an empty literal dynamic-import/require roster.
That was a static source check. The admitted `node:fs` and
`node:child_process` modules still supplied access routes outside that
assertion. The new fixture replaces the regex test with executed effect
checks, rather than adding a census allowance.

## Executed boundary

[`nci-witness-capability.test.ts`](../../src/Core.TypeScript/formal-verification/nci-witness-capability.test.ts)
reads the real emitter source and erases TypeScript types into ESM without
rewriting its receipt, validation, or runner functions. A `SourceTextModule`
linker supplies exactly four synthetic module interfaces:

| Module | Fixture capability |
| --- | --- |
| `node:crypto` | Real SHA256 computation. |
| `node:path` | Real path joining. |
| `node:fs` | Copies of the four pinned model/configuration/registry/jar inputs, through a checked in-memory read function. Other paths and encodings are refused. |
| `node:child_process` | One declared runtime/argv/options combination for `run-tlc.ts NciNonUrgency`, returning a controlled success or failure. Every other request is refused. |

The fixture invokes the real exported functions in library mode. Rendering
must read the four inputs and then the registry as UTF-8: five exact read
events. The controlled runner success must produce five reads, its one
declared subprocess request, and five further reads before emitting the
exact receipt. A controlled checker failure must produce the first six
events and the exact refusal outcome. No real subprocess or TLC run occurs
inside these tests.

The expected receipt is loaded independently from the committed artifact,
with its length and SHA256 pinned to
`d5e89f5675f478f3dbfe3ff633bc69f4f8b848ceeac15e5383730120a59a173e`.
The emitter source SHA256 at this baseline is
`6872dd43ce2e79b1e7991363b3e9ec94325ce00f479dd3a120e5b05f4cdf2c20`.

| Mutation | Actual exercised refusal |
| --- | --- |
| Additional static checker import | The module linker rejects the unknown dependency. |
| Computed dynamic import | TypeScript AST admission rejects an executable `ImportKeyword` call before VM evaluation. This is an explicit syntax restriction, not a runtime test. |
| Direct or aliased read of the Python checker | The in-memory file capability refuses the unadmitted path. |
| Computed `python3` subprocess name | The process capability refuses the command, while the static import roster remains unchanged. |
| Admitted runtime with different arguments | The process capability refuses the argv/options mismatch. |
| Catching a forbidden read's exception | The sticky denial ledger still fails the exercised synchronous call. |

The direct/aliased read, computed subprocess, changed arguments, and caught
refusal mutations all retain the original four static imports. Their failures
therefore supply evidence that the old import roster alone did not provide.

## Bun compatibility finding

The first candidate executed the computed dynamic-import mutation in the VM
and passed all 18 focused tests on installed Bun 1.3.14. Repeating the test
on the already installed CI version, Bun 1.3.13, terminated the process. The
[partial output](data/2026-09-06-nci-emitter-capability-bun-1.3.13-partial.txt)
retains the four completed cases. An isolated invocation with
`--test-name-pattern 'computed dynamic'` exited 133 after the test-file header,
without a stack trace or completed test summary. It was not a passing run.

The original candidate prepended this actual source to the emitter:

```typescript
await import(["node:", "fs/promises"].join(""));
```

It supplied a `SourceTextModule` `importModuleDynamically` callback that
threw `capability denied: dynamic-import:node:fs/promises`, then called
`module.link(...)` and `module.evaluate()`. There was no dynamic-import AST
admission in that candidate. The exit was isolated to that mutation; this
record does not identify a lower-level Bun defect or claim a general crash
classification.

The final fixture needs no dynamic imports. It traverses the parsed
TypeScript AST and refuses every executable dynamic-import call before VM
evaluation, including computed specifiers. Static imports still pass through
the actual module linker, and the effect mutations still execute through
their handlers. The production emitter and CI runtime pins remain unchanged.
The resulting [CI-version focused output](data/2026-09-06-nci-emitter-capability-focused.txt)
records 18 passing tests, zero failures, and 37 assertions on Bun 1.3.13.

## Limits and validation

The [independent review](2026-09-06-nci-emitter-capability-review.md) records
source and retained-output inspection by a separate agent, including the
executed-effect, syntax-admission, and delegated-checker boundaries.

This is a trusted-code regression fixture for the named calls and mutations.
The Node documentation explicitly says
[`node:vm` is not a security mechanism](https://nodejs.org/api/vm.html).
Its host-supplied functions are not an untrusted-code sandbox, and the tested
denial ledger does not establish a theorem over arbitrary reflection, future
asynchronous behavior, or every JavaScript escape path. Bun documents its
[VM module support and runtime differences](https://bun.com/reference/node/vm).

The controlled `run-tlc.ts` capability is an assumed component boundary. This
test does not execute its implementation, establish its transitive dependency
independence, or reproduce the historical TLC result. It validates the
emitter's exercised requests and its response to supplied checker outcomes.
The separate conformance result retains those broader measurement details.

The focused test output is preserved above. The
[final repository quick preflight](data/2026-09-06-nci-emitter-capability-preflight.txt)
passes all 16 checks, including both arity censuses and TypeScript checking.
An initial strict-indexing diagnostic was repaired by explicitly refusing an
undefined linked module; the final focused tests and preflight were rerun.
No assertion-census allowance was added.

Validation follows the TypeScript/test/documentation scope in
[`BUILD-GATES.md`](../BUILD-GATES.md). No production TypeScript emitter,
native source, emitted receipt, or cross-language primitive changed; a new
native build or TLC measurement was not run for this test-only correction.
Independent review is indexed before the standalone PR is published.

## Publication integration correction

The initial PR #16887 head,
`6774b7e1b020e1cc305574ea93159b4e1cd0b2bd`, passed quick preflight but failed
the separate `cross-verify (tech-radar-claims)` CI audit. Its
[retained failure output](data/2026-09-06-nci-emitter-capability-tech-radar-failure.txt)
names the new fixture's direct import of the existing `typescript` developer
dependency: the technology radar had no package-named ring for that verification
use. The repair adds a Trial row in [`TECH-RADAR.md`](../TECH-RADAR.md) describing
the exact AST-admission and type-erasure role, the existing 6.0.3 package pin,
and the fixture's limits. No dependency or test behavior changes. The separate
[post-correction audit output](data/2026-09-06-nci-emitter-capability-tech-radar-pass.txt)
records the same audit passing.
