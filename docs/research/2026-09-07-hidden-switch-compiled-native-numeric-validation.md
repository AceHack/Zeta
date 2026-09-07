# Native guarded-controller certificate and selector validation

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra
Artifact status: implementation validation; no registered measurement or runtime admission

## Source and complete independent comparison

Source `82939e5015e7606befaec4fcf9135cbec072ba5a` adds the
[native certificate](../../src/Research.FSharp/HiddenSwitchCompiledCertificate.fs),
[numeric-only selector](../../src/Research.FSharp/HiddenSwitchCompiledSelector.fs)
and [focused tests](../../tests/Tests.FSharp/HiddenSwitchCompiledCertificate.Tests.fs).
The [frozen protocol](2026-09-07-hidden-switch-compiled-protocol.md) is unchanged.

The native certificate reconstructs all six effect/depth models, with ordered
candidate counts **2, 8, 128, 2, 8, 128**. It checks complete interval coverage,
candidate membership and endpoint dominance against every candidate; the full
monotone gap pieces; eta, posterior/probability bounds and the error recurrence;
and exact rational cut equations and inward binary64 neighbors. The raw input
must match every independently reconstructed field, type, order and value.
It does not trust an input `Passed` field or only four supplied guard constants.

The native and [independent Python](2026-09-07-hidden-switch-compiled-numerical-validation.md)
builders produced exactly equal **62,458 canonical bytes**, SHA256
`8883D8C91C18F5D53360C64579D6F5241A606E0907E57E06C0CD69941BC1CA7F`.
That comparison uses the frozen protocol binding plus the explicit synthetic
`hand-validation` binding of 64 zero characters. This is a hand-validation map,
not the complete final source manifest or a measurement certificate. The
[final comparison](hidden-switch-compiled-validation/2026-09-07/native-certificate/independent-comparison-2.json.gz)
and [reproducible comparison source](hidden-switch-compiled-validation/2026-09-07/native-certificate/independent-compare.py.gz)
retain the complete-byte assertion, not just selected numeric fields.

`GuardSet` contains four numeric thresholds. Certificate digests, source maps,
paths and runtime objects do not enter the selector. Actual one/two threshold
comparisons produce the recorded counts; uncertainty-band fallback calls the
unchanged recursive evaluator. The separate unsupported-runtime conformance
function executes real recursion even for otherwise trivial inputs. These source
properties do not establish the actual executing code/FP/runtime correspondence.

## Executable validation and retained failures

The coordinator used explicit scratch compiled projects in its writer's `.git`
directory to test the new source before the native owner integrated project
wiring. The preserved project/source/log bytes are now git-indexed research
artifacts. They are not the registered final executable or a substitute for its
full hand, scalar, graph and runtime admission.

- Initial build: zero warnings/errors, 2.73 seconds. Its first launch exited 134
  before numeric validation because the scratch project omitted an explicit
  `FSharp.Core` package reference. The exception identified that missing assembly;
  this is a retained harness setup failure, not a numeric result or unexplained
  native crash. No production project was changed for this correction.
- Corrected scratch build: zero warnings/errors, 2.30 seconds. Its certificate
  construction/self-check exited zero and the first independent full-byte
  comparison passed.
- Initial scratch test launch refused the xUnit v3 app-host requirement before
  tests. The test-only harness then enabled its app host in a separate project
  directory; the registered measurement executable keeps its own settings.
- The next test build found two ambiguous `Assert.NotEqual` overloads. Explicit
  string type arguments corrected the test authoring error.
- The first executing test suite had **15 passes and one failure**. An escaped
  unpaired surrogate caused `JsonDocument.GetString` to throw
  `InvalidOperationException` during deferred decoding. The certificate boundary
  now converts that string-decoding failure into a typed refusal. Raw invalid
  UTF8, both unpaired surrogate directions and an invalid property name are
  exercised without hiding the original failure.
- Final focused suite: **16 passed, zero failed/skipped**, 311 ms test duration.
  It checks the independent whole-certificate digest, duplicate/extra/missing
  keys, every model/bound/guard/binding mutation class, integer-versus-float/bool
  tokens, exact inclusive guard endpoints, real fallback work, trivial paths and
  unsupported-runtime recursion. It executes native policy hand calls; it does
  not generate a registered tape or collect performance rows.
- A fresh final scratch comparator build at the corrected source passed with
  zero warnings/errors in 2.72 seconds. Its complete canonical certificate again
  matched the independent Python bytes, unchanged by the Unicode refusal repair.

The ordinary repository F# lint command also passed. Its retained output includes
its existing `dotnet format` notices that F# projects are unsupported by that
formatter; this is not a claim that it formatted the F# source. An initial command
used a nonexistent hygiene-directory path and did not run the lint; the corrected
command and complete output are retained separately.

## Evidence and review boundary

The [29-artifact manifest](hidden-switch-compiled-validation/2026-09-07/native-certificate/manifest.json)
binds every stored gzip byte count/hash and every original decompressed count/hash.
All 29 pairs were verified. Compiler/TRX logs retain their original control bytes;
none were stripped or normalized. It includes the initial and final source/project
snapshots, both executing test TRXs, complete certificate/comparison records and
final rebuilt output identities. The earlier output snapshot predates the final
comparator rebuild; its observed bytes remain intact, with a separate later
snapshot. Output-file identity is not evidence that every file was loaded or that
source-to-binary equivalence was proved.

The separately co-claimed protocol reviewer accepted exact source `82939e501`
after checking the complete rational derivation, error/guard indexing, strict
nested matching, deferred Unicode refusal and actual selector/counter paths.
The reviewer ran no derivation, build, test, guard calculation, policy or stream;
the executable results above are coordinator-run evidence. No material finding
remained in that bounded numeric slice.

Actual native project/common-adapter wiring, the complete native scalar/hand
rosters, independent replay, source and loaded-module admission, and full executing
body/literal/call/FP inspection remain separate work. Every new registered stream
and timing row remains unopened until the reviewed implementation archive. This
record neither creates a speed claim nor waives an unresolved premise.
