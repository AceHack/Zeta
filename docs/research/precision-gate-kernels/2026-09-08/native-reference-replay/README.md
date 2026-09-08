# Native precision-kernel comparison and retained corrections

Date: 2026-09-08 UTC
Operational status: research-grade
Author: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1Z63YMC087G0R003N5FH9X

The [fixed comparison contract](../../../2026-09-08-precision-gate-kernels-native-reference-replay.md)
preceded invocation against the 24 independent reference rows. Native producer
source299abc12 failed to compile its nested tuple list (FS0001/FS3886).
Source45f86cfb corrected the separator; replay2 exited0 with empty stderr.
The kernel source itself remains byte-identical to7100eefea, SHA256
4004196cb0ade8527dfebf83fbb3e6e42bd36208e38affd09906787a84901c02.

## Results and comparison repair

All16 ordinary successful rows agree within the declared tolerance; allseven
invalid rows have the expected native error family and, where exposed, input field. The remaining
successful exact-reference row is explicitly a different encoding observation:
requested native shape1e-16 becomes represented shape1.1102230246251565e-16.
Its kernel reports that roundtrip drift. It is not called exact agreement.

Comparator1 rejected the seven preregistered output mutations but independent
review found its special DTO handling accepted booleans as numbers and could
accept infinite shape coefficients. These were checker weaknesses; the actual
observed values were finite. Comparator2 adds strict nonfinite-JSON refusal,
non-boolean finite admission for every special numeric leaf, and an explicit
requested-minus-one relation for the native encoding. Allseven original and
three added boolean/nonfinite mutations are rejected. Comparator1 and its
original acceptance output are retained; they are not silently replaced.

Replay2's direct assembly hashes are historical producer observations; later
builds changed the binary identities. Replay3 retains copies of the two direct
DLLs and verifies byte lengths and hashes before invocation, in the producer
output, and afterward. Comparator3 differs from2 only by the new native path
and again passes the unchanged numerical checks and ten controls. No old
binary claim is retroactively strengthened. This is not transitive runtime
closure, reproducible-build proof or physical provenance admission.

## Strengthened native tests

The equation/API review recommended typed-error assertions and an independent
nonstationary objective witness. Both now run: t=2,u=-1,k=3,c=exp(-2),m=1,v=2
has F=4-log(2)/2, derivative-mean2 and derivative-variance5/4, within2e-15.
The focused release suite passes24 tests after those additions; the test
SHA256 is f443e58dd8c6d5e0c017d36a432dc6de121fd040dfa68d39e877e4a4ebfefebb.
The [manifest](manifest.json) retains all actual streams, source/argv/process
records, comparator versions and direct DLL copies as lossless gzip with
original and stored hashes. Full integration gates remain a separate step.

This supports the tested local density rules. No mixed schedule, learned
network training, state-of-the-art result, societal optimum or Tsirelson
constant was measured by this comparison.
