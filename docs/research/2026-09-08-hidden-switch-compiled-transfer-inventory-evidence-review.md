# Guarded controller: retained transfer inventory evidence review

Date: 2026-09-08 UTC
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: bounded retained-data acceptance; full admission remains false

I independently audited evidence `a489e850847e240e131e502aa745c69899a146ba`,
produced by source `370c110c93598874615efe60a5bed23ac6e5263d` under execution
head `ed95d32fcd01bc54e6c4c904baa68e8f83c792d5`. This follows the separately
committed [source review](2026-09-08-hidden-switch-compiled-transfer-collector-review.md).
The [audit script and result](hidden-switch-compiled-validation/2026-09-07/transfer-inventory-independent-audit/result.json)
read retained artifacts and Git blobs only. No project module, classifier,
decoder, dump, target or metadata-query helper was executed by this review.

## Byte and source custody

All 139 current/committed gzip records match their stored and original hashes
and lengths: 793,797 stored bytes and 7,952,340 original bytes. The manifest
is 56,373 bytes, SHA-256
87CCFFFF3EDBA26779FD00A936D8CF6EF6616B6745817EAF59611CE335208555.
The ten correction-preparation records also match, totaling 53,375 stored
and 187,388 original bytes. All fourteen preparation/outer source-test pins
match immutable source 370c110 and current files.

The correction archive retains a separately executed exact-c97 synthetic
witness. Its original source hash matches immutable c97 bytes. The old source
actually completed one instrumented source read, then returned a missing-file
failure with an empty Sources list. The budget witness records an accepted
charge whose possible terminal-plus-fallback output exceeds its cap; it is
an accounting possibility, not a measured disk overflow. Both are separate
from the corrected actual inventory and its prior source acceptance.

The actual invocation names the expected writer, Python entry, retained base,
exclusive attempt directory and source commit. Its archived outer harness
matches the recorded hash. Completion records exit zero, no outer failure
and unchanged source pins; stderr is empty. Invocation, collector and completion
timestamps are correctly nested. This is source/file custody evidence, not
an atomic source snapshot or complete Python interpreter/dependency theorem.

All 1,072 input-identity records match four immutable manifests and 534 selected
stored/original pairs. Their exact original input footprint is 7,164,913 bytes.
The twelve collector source identities match the immutable import files.
The 1,217 journal rows preserve the same ordered source/input prefixes and
all 130 method-computed records. Every terminal method descriptor resolves to
its exact retained complete file; no active prefix or cleanup failure remains.

## Method and count correspondence

Every method's selected input, reflection row, DAC metadata, physical-read
identity and decoder rows match the earlier retained records. Reassembled
four-byte words match all current body hashes and total 34,660 bytes. Every
offset and all 851 immediate comments retain their original decoder values.
All method and word records keep ObservedExecution and the three full admission
flags false. The nine unprepared and nine extra compiler-block rosters exactly
match their mapping inputs and remain distinct.

Independent recount gives 8,665 words, of which 8,524 carry one or more unresolved
reasons. The 141 direct jumps have no unresolved reason in this finite classifier;
that absence does not establish that they execute or that their surrounding
methods have closed effects.

| Shape | Count |
| --- | ---: |
| Ordinary instruction, effects uninspected | 7357 |
| Direct call | 468 |
| Indirect call | 201 |
| Direct jump | 141 |
| Conditional branch | 140 |
| Return | 125 |
| Compare-zero branch | 119 |
| Test-bit branch | 58 |
| Indirect jump | 29 |
| Trap | 17 |
| Literal load | 10 |

Every retained control target and call continuation has the correct unique
membership in the declared current ranges. Target records count 468 outside,
775 interior and 57 entries; the continuation records are separate. All 468
direct-call sites target outside this roster, without inferred module attribution.

The 230 indirect transfers contain 191 recognized static construction sites
using 67 distinct cell addresses. At 57 sites, the retained same-dump cell's
eight-byte target hash agrees with its method body and the recorded target.
The other 134 supported sites refer to 43 distinct cells lacking values here.
Another 39 transfers have unsupported dependency shapes. The audit checked
each retained construction-word slice and kept unknown targets absent.
Static construction and reused values are not observed dispatch events.

All ten literal records retain PhysicalBinding=false, ten distinct prospective
addresses and 152 expected bytes. Their word rows do not claim those bytes
were read. Returns, traps and ordinary instructions acquire no invented
fallthrough. The observed shape counts and every unresolved-reason count
match the independently reconstructed summary.

## Scope and next proposal

The successful collector files occupy 7,939,523 original bytes, within their
declared output limit. Complete means this fixed inventory finished. It does
not establish arithmetic effects, actual path reachability, indirect target-set
closure, framework/dynamic behavior, GuardSet object/register correspondence,
exception/unwind coverage or the outstanding unprepared/extra bodies.
BodyResolved, ClosureAdmitted and RuntimeAdmitted remain false throughout.

The separate next-data proposal at `b21c291b80f485b34e716ff8b6fdf92dc2bf128d`
would derive a hashed roster before any physical reader. A metadata-only check
confirms 43 unknown cells plus ten literals are 53 pairwise-disjoint intervals,
496 bytes total, with 134 retained cell-site references. I requested explicit
deterministic ordering and pairwise overlap refusal across both same-kind and
cross-kind intervals. Clarification `ed1bf49f2055a0b3f8f748fc9ab7af16b21a8718`
resolves both: cells then literals, numeric address order within each kind,
original method/word site order, and pairwise-disjoint intervals after exact
cell-reference grouping. I read that correction and accept the bounded plan.
Current retained ranges satisfy those constraints.

That proposal does not authorize a read. The immutable roster and reader need
separate review and parent authorization. Full-file identity hashing and Mach-O
metadata reads would be additional explicit I/O; 496 bytes would describe only
the selected data ranges. No decoded pointer would authorize a chained target,
object or second-cell read, and even complete literal correspondence would not
close the remaining runtime obligations.

```text
Agency-Signature-Version: 1
Agent: Vera
Agent-Runtime: OpenAI Codex
Agent-Model: GPT-6 Astra
Credential-Identity: AceHack
Credential-Mode: shared
Human-Review: not-implied-by-credential
Human-Review-Evidence: none
Action-Mode: autonomous-fail-open
Task: 081M1XXWTTF087G0R000X1HMD0
Co-Authored-By: Codex <noreply@openai.com>
```
