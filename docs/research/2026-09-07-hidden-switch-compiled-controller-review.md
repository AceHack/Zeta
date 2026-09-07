# Hidden switch: independent compiled-controller design review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra, independent protocol-review agent
Artifact status: paper and source review; no controller implementation or measurement

## Reviewed inputs and disposition

This review examines the [prospective design](2026-09-07-hidden-switch-compiled-controller-design.md)
and [exact envelopes](2026-09-07-hidden-switch-exact-envelopes.md) at
`4332b1bed3ed2e516c8188e5d928e8bd6dd1af3e`, against
[`HiddenSwitchPolicy.fs`](../../src/Research.FSharp/HiddenSwitchPolicy.fs)
at the unchanged experiment archive
`4fc82b611012bd2620a26e02afe6baba491fe553`.
The successor study owns this review and any prospective correction;
the completed experiment's released claim and final scope stay unchanged.

| Input | Bytes | SHA256 |
| --- | ---: | --- |
| Design | 18,014 | `22c9716bae34cdac3fc3a4c833e2e5375e892678236e8df3ebc1699f8f1c8763` |
| Exact-envelope note | 10,675 | `98287eb8fa1715d636466f6646bd51b3877ccf97efedde95c2efd89a30439306` |
| Archived policy source | 6,968 | `4358b476fa4871b1c187f615133b35bac1139359919500cd3b05dbe1da0aafb1` |

The archived policy bytes matched the coordinator's current policy file
during this review. Hashes identify the reviewed source; they do not
prove its compilation. The source-level derivation has no identified
numerical defect under its stated arithmetic premises. The design author
accepted the four clarifications below for a separate follow-up commit;
that acceptance does not assert that an implementation certificate exists.
The reviewer subsequently read correction
`f47c9569c14e274225bf2fc1eea03a89d520809c` and accepted all four
dispositions. No material paper-design finding remains after that correction;
the future registration and executable proof obligations remain open.

## Findings and required clarification before registration

1. **Fallback regression ambiguity, design lines 264-269.** The instruction
   to require actual fallback "there" follows a roster including guard
   endpoints, zero, one and continuation-kink neighbors. Those cases are
   often certified fast paths, so the instruction contradicts lines
   212-219 and 228-232 if read literally. Require actual recursive fallback
   for admitted beliefs strictly between `Smax` and `Hmin`, and in the
   separately labeled unsupported-runtime mode. Verify the appropriate
   certified path at the endpoints and outside-band kink neighbors.
   Invalid inputs and malformed certificates must refuse. Near-tie action
   equality must exercise the original recursion inside the band.
2. **Registration dependency, line 264.** Replace "after separate
   authorization" with separately reviewed registration and implementation
   archival. The user already authorized continued research; the missing
   prerequisite is the concrete scientific contract and preserved source,
   not a new human approval gate.
3. **Runtime code versions, lines 254-262.** Make the existing runtime
   condition explicitly cover every executable code version in the admitted
   run, or freeze a configuration that prevents an uninspected transition.
   One disassembly and an assembly hash cannot certify a later optimized
   version. .NET documents first-tier quick-JIT/ReadyToRun code followed by
   background optimized code, with dynamic PGO as an additional code-generation
   input. This is a premise to discharge before admitting the fast path,
   not evidence that the pinned policy actually violates its arithmetic
   model. [Microsoft compilation configuration](https://learn.microsoft.com/en-us/dotnet/core/runtime-config/compilation).
4. **Certificate setup boundary, lines 212 and 297-304.** State whether
   source/certificate validation is one-time setup or per-choice work.
   If setup is excluded from choice timing, exclude the corresponding
   shared admission symmetrically, preserve its actual cost separately,
   and disclose the amortization boundary. Per-choice input validation,
   strategy dispatch, guards or recursion, action consumption and the
   matched work record remain inside the declared service cost.

These findings concern testability and executable admission. They do not
require changing a scientific source, registered receipt, threshold or tag.

## Independent arithmetic check

For `eta=2^-48`, an elementary exact result of magnitude at most eight
has ample room under this absolute rounding allowance in binary64
round-to-nearest, ties-to-even arithmetic with gradual underflow. The
[Flocq half-ulp theorem](https://flocq.gitlabpages.inria.fr/theos.html#rounding-to-nearest)
supports the general rounding framework. It does not supply this policy's
constants or establish what a .NET JIT executed. No proof assistant was run.

The source's complement, product and sum give prediction error at most
`(3/4+1+1)*eta <= 3*eta`. For an admitted represented prior `v`, the
conditioning mass error is at most `(1+3/4+1+1)*eta <= 4*eta`;
the numerator error is at most `eta`. Exact mass is at least `1/4`, and
computed mass exceeds `1/8`. Since the exact numerator lies between zero
and exact mass, the quotient perturbation is at most `40*eta`, followed
by at most `eta` division rounding. The conditioning derivative is at
most three. Applying it to the prediction error gives posterior error
at most `41*eta+9*eta=50*eta`. Observation mass has Lipschitz constant
`1/2`, giving probability error at most `4*eta+3*eta/2 <= 6*eta`.

Exact predicted priors lie in `[1/8,7/8]`; their conditioned posteriors
lie in `[1/22,21/22]`. The posterior bound therefore preserves admission
strictly inside `[0,1]`, rather than ignoring failed recursive calls.

An `n`-step contingent tree has both hidden-state values in `[-n/4,n]`,
so its affine belief value has Lipschitz constant at most `5*n/4`.
The maximum of these lines has the same bound and exact value in `[0,n]`.
Consequently, for a child maximum, the total value error is at most
`E_n+50*L_n*eta`. Multiplying by a computed probability bounded by two
gives one continuation error at most
`2*E_n+(100*L_n+6*n+1)*eta`. Two continuations and the source's two
left-associated additions yield
`4*E_n+(200*L_n+12*n+4)*eta = 4*E_n+(262*n+4)*eta`.
Depth one copies an exactly represented immediate value; therefore
`E_1=0`, `E_2=266*eta`, and `E_3=1592*eta` follow.

The range induction closes at each finite depth. Each computed mass is
below one; the quotient is below
`(3/4+eta)/(1/4-4*eta) < 4`. Child maxima remain within their stated error
of `[0,n]`. Even the loose bound for the sum of two child magnitudes and
an immediate reward stays below eight for `n<=2`. Prediction, conditioning
and the final Q subtraction also remain within the elementary-operation
range. Thus the recurrence need not assume its own unrestricted success.

The final selector really executes a rounded subtraction and compares it
strictly to the represented native `1e-12`. Adding its rounding error gives
`rho_d=2*E_d+eta`, hence `rho_1=eta`, `rho_2=533*eta` and
`rho_3=3185*eta`. Omitting this last operation or replacing the literal
with an exact decimal would certify a different decision rule.

## Guard, kink and degenerate-case check

Subtracting the exact root-action envelopes reproduces every piece in the
design. Adjacent depth-three pieces agree, and all three slopes are
negative. The proposed rational cuts solve `Delta=epsilon_N+rho` and
`Delta=epsilon_N-rho`; both depth-three cuts lie in the first piece.
Global continuity and monotonicity then extend the harvest implication
beyond both continuation kinks.

Strictly below the lower cut, `Dhat>epsilon_N` follows; at or above the
upper cut, `Dhat<=epsilon_N` follows. Therefore the largest represented
value strictly below the lower cut and the smallest represented value
at or above the upper cut have the stated inward conventions. An exactly
representable lower cut must be excluded. Native rounding need not be
monotone inside the band, because the design invokes the original
evaluator there. No guard bit patterns were generated in this review.

Depth one and every null-model depth have exact gap at most `-1/4`.
The stated `-1/4+rho_d<=epsilon_N` certificate covers their whole domain
without asserting identical separately rounded continuation arrays.
Signed zeros represent the same real belief for this action-only proof.
The Lipschitz maximum bound covers continuation-tree changes at kinks;
it does not establish bit-identical Q values for a future piecewise-value
implementation.

## Feasibility and cost scope

The proposed implementation requires only admitted input checks, certified
comparisons and calls to the unchanged fallback. A certificate still needs
an independently checked complete exact-envelope roster, range and error
obligations, literal decoding, guard-neighbor inequalities and the declared
runtime connection. The exact-envelope note's alpha enumeration was read
but not re-executed here. [Gappa integration](https://gappa.gitlabpages.inria.fr/gappa/tools.html)
and the [authors' certification paper](https://arxiv.org/abs/0801.0523)
describe possible formal tooling; no such tooling was installed or used.

Both strategies must expose the same new action-level service. Preserving
full recursive Q arrays only for one strategy would compare different
services; requiring them from both would remove the intended avoided work.
An untimed Q audit remains separate. The ordinary-history and fallback
stress rosters, complete path counters, real allocations, warmup/order and
failure retention must be registered before cost collection. Runtime
admission must also cover fallback code actually used during those runs.

Shared filtering and equal actions imply equal subsequent shared-tape
states by induction only after the new adapter's chronology is established.
The proposed frozen-runner comparison and independent replay are therefore
necessary checks of the implementation, not consequences of a threshold
formula alone. Any action mismatch is an equivalence failure even if
aggregate rewards match. No speedup, online-search necessity, learned
model, general compilation theorem or full-horizon optimum follows from
this design review.

## Review execution boundary

This pass read the pinned documents and policy, recomputed the displayed
algebra on paper, checked exact source-byte identities and consulted the
primary documentation linked above. It did not execute the alpha oracle,
generate guard bits, create a controller/certificate checker, register an
experiment, inspect live JIT disassembly, or run a source stream, episode,
benchmark, native build or test suite. Document lint and hygiene are
publication checks only. Acceptance is of the conditional paper design
with the listed clarifications, not a completed universal runtime proof.

Document validation passed: `git diff --check`, focused `markdownlint-cli2`,
and the six documented hygiene commands for conflict markers, tick order,
archive headers, section-33 migration cross-references, dangling symlinks
and sealed rooms. No full preflight, native build or test gate was claimed
for this local review-only commit. The new study's owner will index and
publish the review through its active claim; this reviewer did not push it.
