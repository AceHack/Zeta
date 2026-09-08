# Fixed native/reference precision-kernel replay

Date: 2026-09-08 UTC
Operational status: research-grade
Status: fixed comparison and full integration gates passed; publication pending
Author: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1Z63YMC087G0R003N5FH9X

## Frozen subjects

Native library source: `7100eefea413c1dd34b899fd1b7ba639494568b7`.
Independent reference source: `9e6be94a0ec2b153ba63e100463f91418ceed4fe`.
Reference vector bytes: 21985, SHA256
`ecab012f7084e17097594faabd2ee49ec7a76aa1da8a1fa4f2204ab8df841489`.
The reference's ordered 24-row roster was committed before its retained
vector generation. This comparison plan precedes the first native invocation
against those vectors. The [kernel ADR](../DECISIONS/2026-09-08-density-consistent-precision-gate-kernels.md)
and [first native checks](precision-gate-kernels/2026-09-08/native-first-validation/README.md)
define scope. No trained system, benchmark, optimizer or random draw is involved.

## Comparison contract

The native harness reads only Input, Id and Operation from the pinned vector
file, invokes the compiled public kernels, and emits every returned field.
It does not use Outcome to choose or alter native results. Retain raw process
streams, argv, source hashes and loaded assembly byte identities. These are
observed runtime identities, not a full transitive runtime-closure claim.
Only the pinned finite vector file is accepted; this is not a general parser.

Preserve all 24 ordered IDs and operation names. For the 16 ordinary successful
rows compare every corresponding finite numeric leaf using absolute tolerance
1e-12 plus 1e-12 times the absolute reference value. This is an engineering
tolerance, not an interval enclosure or a uniform error theorem. For exact
zero reference leaves additionally require exact native zero, except the
stationary objective derivatives, whose Decimal coefficient is rounded.

Two declared DTO differences need explicit handling: native Gamma moments
RepresentedShape corresponds to exact-reference Shape; native normal messages
also return ResidualSecondMoment, which must equal twice their ToPrecision.Rate.
Do not silently drop any other field. Native errors must match the expected
failure family and relevant field, allowing the two languages' declared field
names; retaining only success/refusal would miss misclassified errors.

The seventeenth successful reference row, shape/small, is a separate encoding
observation. Exact arithmetic retains shape 1/10^16. Native must expose the
requested binary64 shape, kernel and actual represented shape, including
nonzero roundtrip drift. Check rate1, requested1e-16, positive represented
shape equal to LogPower+1, and represented shape distinct from requested.
Do not let an absolute 1e-12 tolerance conceal that discrepancy or report it
as exact cross-language agreement. The seven expected refusals stay refusals.

## Comparator controls and decision

After ordinary output, apply four independent output mutations, one at a time:
double soft/uncertain ToTau.Rate; subtract one from gamma/rate ToRate.LogPower;
replace reverse/log with reverse/exp; negate objective/general DerivativeMean.
Every mutation must be rejected. These test the comparator's discrimination;
they are not executions of a mutated library and not adversary detection.
Also reject truncation, duplicate IDs and an extra field. Preserve all results.

Any discrepancy stops numerical acceptance until explained and fixed with
original evidence retained. Passing supports these local rules and adapter
fields only. Next investment remains a separately specified mixed VMP/EP
schedule and learned module integration, followed by sealed chronological
comparisons. It does not promote conjectural geometric or societal bridges.

## Retained execution

The [native replay and corrections](precision-gate-kernels/2026-09-08/native-reference-replay/README.md)
preserve the first producer compile failure, actual24-row observations,
comparator review/fix, ten rejected controls and fresh direct assembly custody.
The original plan remains at ba40d4d0f3bdac59294ccb36fdb8131486c07a6a.

The [native equation/API review](2026-09-08-precision-gate-kernels-native-review.md)
found no material defect in the reviewed density rules. Its two test-strength
recommendations are implemented in the retained24-test pass. For improper
beliefs the native error carries only the family (Gamma or Gaussian): the
producer's Failure.Field contains that family label, not an observed parameter
locator. The reference's more specific kernel.Rate/kernel.Precision fields
remain reference facts. InvalidInput fields are compared directly using the
declared naming map.

The [independent reference review](2026-09-08-precision-gate-kernels-reference-review.md)
and [native replay review](2026-09-08-precision-gate-kernels-native-reference-replay-review.md)
accept their explicitly bounded source, numerical and custody claims. The
[full integration gate and remote preservation](precision-gate-kernels/2026-09-08/integration-validation/README.md)
retain all18 passed checks and normal push at the exact tested source cut.
