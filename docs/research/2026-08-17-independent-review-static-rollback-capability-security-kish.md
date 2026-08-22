# Independent Review: Static Rollback Claims, Operator Capabilities, and Clustered Effective Count

**Review date:** 2026-08-17  
**Scope:** Three bounded questions routed for independent review: (1) the P3 novelty claim about static effect structure and speculative rollback, (2) the Pages passkey-to-gated-commit capability boundary, and (3) the reported effective-probe-count arithmetic.  
**Recommendation:** **Adopt the P3 prior-art correction immediately; treat the capability findings as two bounded security hardening tasks; and label the reported count as a clustering design-effect result, not a general Kish weighting result.**

> This document is a review record, not a proof certificate. It separates established literature, inspected implementation properties, and policy choices. A finding that a test or implementation is currently consistent with an assertion is not evidence that the assertion is generally true.

## 1. Decision Summary

| Review lane | Independent conclusion | Confidence | Required wording or action |
|---|---|---:|---|
| P3: static effects and rollback | A broad novelty claim is **falsified by direct prior art**. | High | Describe any Zeta contribution only as a project-specific integration or heuristic until an exact differentiator has been formally scoped and searched. |
| Capability boundary | WebAuthn/RP/origin/signature checks are materially sound, but challenge replay is process-local and revocation is not immediate for an already-minted capability. | High for the code-path findings | Move challenge consumption to an atomic shared store and decide/document the desired capability-revocation latency. |
| Effective count | `DEFF = 5.557` and `8 / DEFF = 1.4396` are correct **under equal-size, exchangeable-cluster assumptions**. | High | Call this a clustering-induced effective count. Do not call it a Kish unequal-weight calculation without weight variance. |

## 2. P3 Novelty: Static Information and Speculative Rollback

The broad proposition that static program information can identify speculation that does not need rollback is already established. Prabhu, Ramalingam, and Vaswani define speculative composition and iteration over mutable state, specify correctness against a non-speculative execution, and explicitly state conditions under which rollback can be avoided; they also implement a static safety checker.[1] The paper therefore directly defeats a claim of first discovery of the general pattern.

> “We describe a set of conditions under which such rollback can be avoided. We present a static analysis that checks if a given program satisfies these conditions.” [1]

Earlier real-time work also provides compiler transformation rules for identifying speculative-execution opportunities, while discussing the relationship between deterministic timing and speculative execution with rollback.[2] This is independent prior art against any claim that the use of static structure to make speculation safe or profitable is new in principle.

> “The paper proposes a set of compiler transformation rules to identify opportunities for speculative execution and transform the code.” [2]

The defensible remaining statement is narrow: a Zeta component may combine known techniques—such as effect annotations, branch-local retractions, bitemporal evidence, or a particular scheduling rule—in a codebase-specific configuration. That may be useful engineering, but neither the cited work nor this review establishes an algorithmic novelty claim for the combination. Absence evidence cannot upgrade that weaker, truthful description into a general novelty claim.

| Claim form | Review outcome | Reason |
|---|---|---|
| “Static effect structure enables rollback-free speculation.” | **Do not use as novel.** | Directly anticipated by static safety conditions and checking in prior work.[1] |
| “Zeta discovered a new general rollback theorem.” | **Unsupported.** | No theorem statement, proof, or differentiating search criterion was supplied. |
| “This implementation uses static structure to constrain its own speculative work.” | **Potentially defensible if demonstrated.** | This is an implementation-scoped statement, not a claim about the field. |
| “No prior art found.” | **Do not use for the broad premise.** | Relevant prior art was found.[1] [2] |

## 3. Adversarial Review: Pages Operator Capability Boundary

The reviewed implementation correctly preserves several important boundaries. The server checks the declared Pages origin, validates `webauthn.get` client data and `crossOrigin === false`, compares the RP-ID hash against the GitHub Pages RP ID, requires both user presence and user verification, and verifies an ES256 assertion after strict DER-to-raw-P-256 normalization. These are substantive authentication checks, rather than a UI-only assertion.[3] The proposal route also keeps repository-writing credentials out of the browser: the browser submits a bounded patch carrier and server-side dispatch invokes the scoped executor.

The review nevertheless found two architecture-level hardening gaps. First, consumed challenge IDs live in an in-memory `Map`. That gives replay protection only within the process that receives both requests. With a horizontally scaled or restarted service, two requests using the same still-valid challenge token can be accepted by different instances before either instance observes the other’s consumption. The route should use a server-shared atomic **put-if-absent with TTL** keyed by challenge JTI. The atomic transition must be testable with a double-submit negative control, not merely a process-local unit test.

Second, the public author registry is loaded from the mutable `main` branch when authorization occurs. The capability records the registry sequence, but proposal submission verifies only the signed capability; it does not re-fetch the registry or establish that the credential has remained unrevoked. This does not create a browser-held repository key, but it makes revocation eventual: a capability minted just before a registry revocation can remain usable until its configured expiration. The correct mitigation is a conscious policy decision, not an accidental claim of immediate revocation. Either accept and document the bounded delay, or consult an immutable registry revision / revocation epoch at proposal time.

| Surface | Existing control | Finding | Bounded correction |
|---|---|---|---|
| Assertion origin and RP ID | Exact Pages-origin and RP-ID-hash checks | Sound primary boundary for the reviewed path. | Retain regression controls for wrong origin, RP ID, and `crossOrigin`. |
| ES256 signature shape | Strict DER parser plus WebCrypto P-256 verification | Rejects malformed/truncated assertion shapes before acceptance. | Retain negative vectors for trailing DER data and invalid positive padding. |
| Challenge replay | Process-local `usedChallengeIds` TTL map | **Not reliable across instances or process restart.** | Shared atomic JTI reservation with five-minute TTL and a two-instance/race fault test. |
| Registry integrity | HTTPS fetch of `main` registry at authorization | Registry is mutable and capability issuance is not revision-pinned. | Bind issuance to a reviewed immutable revision or verified digest. |
| Registry revocation | Registry checked during authorization, not proposal submission | Revocation latency is up to capability expiry. | Define a revocation SLA; enforce fresh registry/epoch lookup if immediate effect is required. |
| CORS | Exact allowed origin and `Vary: Origin` | Useful browser exposure control, **not** bearer-token authentication. | Keep origin enforcement but do not rely on it against a non-browser sender. |

The current security claim should therefore remain limited to: **a user-verified, reviewed passkey can mint a short-lived proposal capability from the intended Pages origin; the browser does not receive a repository write credential.** It must not claim distributed one-time challenge enforcement or instantaneous passkey revocation until those properties have dedicated, failure-capable controls.

## 4. Effective-Probe Arithmetic

For an equally sized exchangeable cluster of size \(m\) with intraclass correlation \(\rho\), the usual clustering design effect is:

\[
DEFF_{cluster} = 1 + (m - 1)\rho.
\]

Substituting \(m = 8\) and \(\rho = 0.651\):

\[
DEFF_{cluster} = 1 + 7(0.651) = 5.557,
\]

and the effective count **per eight-measurement cluster** is:

\[
n_{eff,cluster} = \frac{8}{5.557} = 1.439625 \approx 1.44.
\]

The arithmetic is correct. Its interpretation requires the assumptions in the formula: eight equally sized members, an exchangeable within-cluster correlation of 0.651, and a design-effect approximation appropriate to the estimator. Under that model, eight nominal measurements carry variance information comparable to only about 1.44 independent observations from the same cluster. The result is a warning about correlation-induced redundancy; it is not a claim that there are literally 1.44 physical probes.

The term **Kish** needs precision. Kish’s one-stage unequal-weight design effect is associated with variation in sampling weights; clustered design effects arise from intraclass correlation. Modern survey-methods work treats weighting and clustering as distinct sources that can be combined only under stated assumptions.[5] The report must therefore name this value `DEFF_cluster` unless it actually has weight coefficients or a joint sampling design available.

> Clustered observations can otherwise make an analysis “overestimate the effective sample size”; increasing the number of clusters is generally more efficient for power than merely increasing observations inside a cluster.[4]

| Quantity | Calculation | Valid reading | Invalid shortcut |
|---|---:|---|---|
| Nominal measurements per cluster | \(8\) | Count of observed values | Count of independent values |
| Intraclass correlation | \(0.651\) | Model parameter describing shared variation | A weighting coefficient |
| Cluster design effect | \(5.557\) | Variance inflation relative to independent observations | A universal design effect without assumptions |
| Effective count | \(1.439625\) | Approximate independent-information equivalent per cluster | Literal number of sensors, trials, or agents |

## 5. Actionable Follow-Through

The P3 register should close the broad novelty wording as falsified and preserve only implementation-specific claims that can be demonstrated. The capability subsystem should add two failure-capable checks before its security narrative is strengthened: a distributed/racy challenge-consumption test against the selected shared store, and a test proving the declared revocation policy for a capability issued immediately before revocation. The statistical report should attach the cluster assumptions alongside every effective-count value and report the number of clusters separately from the number of within-cluster measurements.

None of these recommendations requires a metaphysical or physics interpretation. They are ordinary boundaries between a literature-backed claim, an implementation property, and an operational policy choice.

## References

[1]: [Prabhu, Ramalingam, and Vaswani, “Safe Programmable Speculative Parallelism,” PLDI 2010](https://doi.org/10.1145/1809028.1806603)

[2]: [Younis, Marlowe, Stoyen, and Tsai, “Statically Safe Speculative Execution for Real-Time Systems,” IEEE Transactions on Software Engineering, 1999](https://doi.org/10.1109/32.815328)

[3]: [W3C, Web Authentication: An API for Accessing Public Key Credentials Level 2](https://www.w3.org/TR/webauthn-2/)

[4]: [Killip, Mahfoud, and Pearce, “What Is an Intracluster Correlation Coefficient?,” Annals of Family Medicine, 2004](https://pmc.ncbi.nlm.nih.gov/articles/PMC1466680/)

[5]: [Chen and Rust, “An Extension of Kish’s Formula for Design Effects to Two- and Three-Stage Designs with Stratification,” Journal of Survey Statistics and Methodology, 2017](https://pmc.ncbi.nlm.nih.gov/articles/PMC10426793/)
