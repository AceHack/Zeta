# Guarded hidden-switch compilation: independent protocol review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra, independent protocol-review agent
Artifact status: pre-registration source/document review; no experiment execution

## Inputs and scope

This pass reviews the [complete prospective protocol](2026-09-07-hidden-switch-compiled-protocol.md)
at original draft `9c54bec7407edd19f3c5f0494d55a19f78dd7709`
and corrected draft `14786d2ae10c761eb2c51695c142da88408b3b6f`, followed
by final chronology correction `75718b9a82b9e5d1d303d6a3f2cf5f83792bca1a`.
The [earlier mathematical review](2026-09-07-hidden-switch-compiled-controller-review.md)
separately records the pinned policy, conservative binary64 bound and
strict inward-guard proof. This review covers complete rosters, execution
order, matched service costs, certificate/runtime admission and receipt
bindings. It does not execute that proof as software or certify a runtime.
The final chronology correction resolves both remaining wording findings;
the conditional complete protocol is accepted with no identified material
finding remaining. This acceptance supplies a review prerequisite, not
registration or permission to bypass the preserved implementation boundary.

| Protocol revision | Bytes | SHA256 |
| --- | ---: | --- |
| `9c54bec7407edd19f3c5f0494d55a19f78dd7709` | 27,927 | `2255373cbb61842c904870a40a3111a62206bf33a0b5154a25e0108a733f143e` |
| `14786d2ae10c761eb2c51695c142da88408b3b6f` | 37,609 | `29d4042433c0919b7c523f263888710022ceb29862bc39bbeee4505837d68e24` |
| `75718b9a82b9e5d1d303d6a3f2cf5f83792bca1a` | 38,685 | `9844bb1076f434d08f8eb1432e7051f2cea33e409521f4c835edf3633c867983` |

## Findings and dispositions

The reviewer raised these concrete prefreeze findings against the original
complete draft. Revision `14786d2ae` resolves them as described:

1. **Row rotation was ambiguous.** Rotating "panel order then strategy
   order" could rotate panels, strategies or a flattened roster. Section F
   now gives explicit mode/replicate/panel/strategy loops. Panels keep their
   fixed order; only strategy order changes with replicate parity.
2. **Input-envelope substitution needed an explicit refusal.** Generic raw
   artifact hashes did not state that replay/verdict bind complete input
   envelope bytes, including admission metadata. Section H now binds exact
   hand, certificate, graph/admission, behavior, cost and setup envelopes;
   the verdict also binds exact replay bytes. Cross-phase native source,
   runtime/settings, artifact identities and chronology are checked. Python
   reports its own runtime separately. The executing entry points and task
   imports must belong to the admitted source/artifact paths.
3. **Descriptive division needed a total rule.** A zero CPU denominator
   cannot become a fabricated zero, infinity or an exception after a valid
   run. Sections G/H now constrain input counters, preserve exact medians
   and rational pairs, and label unavailable descriptive ratios. The
   required speed decision uses exact integer arithmetic with positive
   native denominators; unavailable CPU cannot weaken that decision.
4. **Trivial-path comparison wording could omit admission.** The original
   "no belief comparisons" phrase appeared to remove finite/range checks.
   Section G now says zero counted belief-to-guard comparisons while
   required input validation remains executed and timed.

The revised draft also incorporates the coordinator's independent findings:
the fresh cost-process prelude is closed; all alpha vectors are rebuilt in
a fixed complete order; the software arithmetic model preserves signed
zeros; and the source/runtime manifest has a bounded enumerated scope.
Those are attributed coordinator contributions, not discoveries claimed
by this reviewer.

Two final execution-order clarifications were requested after reading
`14786d2ae`: distinguish the coordinator's successful behavior exit and
closed-output dependency from admission inside the fresh cost process,
and start setup measurement counters before the admission work whose cost
is reported. Revision `75718b9a8` resolves both. The coordinator waits for
successful exit and closed output; the fresh cost process starts its
stage-one counters, creates the owned directory, and admits/hashes inputs
before any policy call. Every prelude stage encloses its work in its own
start/end counters, with process startup separately excluded. The reviewer
read these final bytes at `3352e3987d6053bdef5168ba7d6dc7ee23a518de` and
accepted the disposition without executing the schedule.

## Count and schedule audit

The counts follow directly from the declared ordered rosters. Duplicated
belief values remain distinct positions rather than being deduplicated.

| Surface | Independently checked count |
| --- | --- |
| Fixed and boundary beliefs | `7+12+6+12 = 37` entries |
| Scalar conformance | `37*2*3 = 222` positions, both strategies at each |
| New hand episodes / old controls | `4*2*3*2 = 48` / `4*2*3 = 24` |
| New ordinary episodes / old controls | `2*512*2 = 2,048` / `2*512 = 1,024` |
| New ordinary actions / observations | `2,048*16 = 32,768` / `2,048*17 = 34,816` |
| Ordinary tape draws | `2*512*34 = 34,816` |
| Fresh cost tapes / draws | `2*72 = 144` / `2*72*34 = 4,896` |
| Old cost-setup choices / observations | `144*16 = 2,304` / `144*17 = 2,448` |
| Ordinary-choice rows | `5*2*2 = 20` |
| Ordinary-choice measured / warmup calls | `20*64*1,024 = 1,310,720` / `20*128 = 2,560` |
| Stress rows | `5*1*2 = 10` |
| Stress measured / warmup calls | `10*4,096*10 = 409,600` / `10*16*10 = 1,600` |
| Whole-episode rows | `5*2*2 = 20` |
| Whole-cost timed / warmup episodes | `20*64 = 1,280` / `20*8 = 160` |

The five stress beliefs at each effective depth give ten tuple positions.
For each pass, six positions must invoke real fallback and four must take
certified endpoint paths. Interior membership is a certificate obligation;
if it fails, this version refuses rather than substituting a sampled point.
There are fifty fixed cost rows across the three modes. Repeated passes
and replicates reuse their declared inputs; they are not independent task
samples or a basis for an unregistered population-performance estimate.

The fixed action record is exactly `1+1+2+6*4 = 28` bytes. Both strategies
allocate their measured output buffers inside timing and write the same
record shape. Actual native internal Q allocation remains measured even
though neither strategy exposes full Q arrays as its timed output service.
Warmup records and the untimed old-runner Q audit remain separate.

For each ordinary panel, each wall/allocation ratio uses two five-row
medians. With positive native denominator, checking
`2*compiled_median<=native_median` is exactly the registered `<=0.5`
criterion. Both metrics must pass on both panels. Neither pooled medians,
median paired ratios, omitted rows nor stress/whole-episode results can
replace those four required comparisons. Recorded zero numerators do not
waive mandatory real buffer allocation or its counter-conformance checks.

## Admission and interpretation boundary

The complete alpha roster has 2, 8 and 128 tree positions at depths one,
two and three. The fixed root-action rosters have 1, 4 and 64 positions;
children range over all prior-depth trees. Complete independent
reconstruction plus endpoint dominance checks is stronger than accepting
supplied counts or selected extreme vectors. The paper error bound still
requires its own range/rounding inequalities and actual source-graph
connection; agreement of finite scalar tests alone cannot supply it.

The independently authored software binary64 model needs explicit signs,
exponents and significands, including subnormals and both zeros. Reducing
every zero to an unsigned exact rational cannot check the specified bit
contract. Conversely, numerical comparisons must retain their admitted
semantics rather than treating different zero bits as different values.
The exact alpha oracle and rounded scalar reference answer distinct checks.

The runtime configuration disables tier transitions and ReadyToRun, with
source, managed-module, native-runtime and concrete-method identities
recorded. Separate graph inspection and same-configuration measurement
remain an explicit inspection premise. Standard library, OS, loader and
hardware boundaries are disclosed; no full toolchain or JIT theorem is
claimed. The source manifest and operation-graph review must be completed
before fast-path measurement is admitted, even if all finite actions agree.

Both new strategies share a supplied decoder/model/filter and must preserve
the old runner's chronology and behavior. Exact action equality implies
equal later shared-tape states only with that adapter correspondence.
Private-band, future-suffix, caller-copy and action-before-feedback
interventions remain independent executable checks. Invalid certificates
refuse; unsupported-runtime recursion-only conformance is explicitly not
a performance arm or substitute certificate.

The protocol can establish lower cost for this supplied controller under
its new matched action-only service, admitted runtime and declared input
rosters. It cannot establish learned dynamics, general compilation,
full-horizon optimality or necessity of online search. Whole-episode and
fallback-stress costs remain descriptive even if choice-only gates pass.

## Execution boundary

This pass read the drafts and checked the displayed arithmetic and source
contracts without generating guard bits, rebuilding alpha vectors,
implementing a controller/checker, running conformance, registering the
protocol, or generating behavioral/cost sources. No native build, test,
JVM, benchmark or experiment was executed by this reviewer for this pass.
The study owner retains publication and implementation admission duties.

The local review document passed focused `markdownlint-cli2`, staged
`git diff --check`, and the documented six hygiene checks for conflict
markers, tick order, archive headers, migration cross-references, symlinks
and sealed rooms. This is a local signed review commit for integration
by the new study's claim owner; the reviewer did not push or tag it.
