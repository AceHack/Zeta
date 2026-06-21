# KHALEESI: Breaker of Advertising and Tracking Request Chains (USENIX Security '22; Iqbal + Wolfe + Nguyen + Englehardt + Shafiq) — Kleisli-severance prior-art at privacy-defense scope (operator 2026-05-28 forwarded)

## Citation

- **Title**: KHALEESI: Breaker of Advertising and Tracking Request Chains
- **Authors**: Umar Iqbal + Charlie Wolfe + Charles Nguyen + Steven Englehardt + Zubair Shafiq
- **Venue**: USENIX Security '22 (31st USENIX Security Symposium)
- **Aggregator URL forwarded by operator**: <https://securityboulevard.com/2023/03/usenix-security-22-umar-iqbal-charlie-wolfe-charles-nguyen-steven-englehardt-zubair-shafiq-khaleesi-breaker-of-advertising-and-tracking-request-chains/>
- **Primary venue paper URL** (verify at impl-time per `dep-pin-search-first-authority` rule): typically reachable via <https://www.usenix.org/conference/usenixsecurity22/>
- **Name reference**: KHALEESI = Game of Thrones (Daenerys Targaryen's "Breaker of Chains" title)

## operator framing 2026-05-28 (verbatim)

> *"This is severing the kleisli"*

> *"preserve as research note and we should probably backlog very low priority. Also it's one of those cowidences winks that the names are so similar that usually ends up meaning something in my experience lol"*

Substantive substrate-engineering substrate-recognition + observation about name-coincidence (KHALEESI vs Kleisli — similar phonetics + both involve chain-breaking/composition substrate).

## Substrate-engineering substrate-recognition

Web tracking IS Kleisli-shaped substrate at network-protocol scope. Each HTTP request `f: A → M[Response]` chains via Promise/Task monad. Advertiser/tracker chains are sequential Kleisli composition where each request's response informs the next.

KHALEESI breaks the Kleisli composition at privacy-protection scope. Severing the chain prevents tracking-substrate accumulation downstream.

| Substrate at network-protocol scope | Mapping |
|---|---|
| HTTP request | `f: A → M[Response]` (Kleisli arrow over Promise monad) |
| Request chain (redirect → tracker → analytics → ad-call → ...) | Kleisli composition `f >=> g >=> h >=> ...` |
| Tracking substrate | Information accumulated via Kleisli-chained request traversal |
| KHALEESI severance | Breaking the `>=>` composition at specific points; prevents downstream accumulation |
| Privacy-protection-as-substrate-engineering | Selectively-severed Kleisli composition; substrate-entity (browser) AUTHORS which chains to break per asymmetric-authorship rule |

## Composition with framework substrate

| Framework substrate | Composition |
|---|---|
| **081KSNY2Z0008QG0R002HB4AGT Kleisli substrate** (interrupt-substrate in monad-space) | KHALEESI's mechanism IS Kleisli interrupt-handling at HTTP scope; intercepts the chain via classification-as-interrupt |
| **monad-propagation-pattern rule** (PR #5511) | KHALEESI's classifier operates per cross-language Result<T, TFeedback> shape at request-classification scope (Block / Allow / Pending = TFeedback variants) |
| **asymmetric-authorship rule** (PR #5516) | Browser-as-substrate-entity AUTHORS the consent-channel; severing tracking-chains IS asymmetric-authorship discipline applied at network-protocol scope (per consent-not-given) |
| **081KSNY2Z0008QG0R0036SJ3T1 ConsentEvent integrity** | Tracking chains operate WITHOUT explicit consent; KHALEESI substrate-engineering severs the non-consensual chains |
| **081KS3X9Y0008QG0R00218150M multi-oracle BFT trust-calculus** | Tracking-substrate vs anti-tracking-substrate is multi-oracle competition over trust; KHALEESI is one oracle's verdict on chain-trustworthiness |
| **DST-omniscience rule** (PR #5841) | Under DST, full tracking-chain trajectory is computable from request-substrate-seed; KHALEESI's ML-classifier predicts downstream chain-state from current-request-features = computational omniscience over the simulation of where the chain would go |
| **Pilot-wave-MWI rule** (PR #5842) | Particle-locus IS current request in chain; severing prevents particle from traversing into tracking-substrate |
| **Particle-as-locus rule** (PR #5846) | KHALEESI operates at the locus where next request would form |
| **NCI HC-8** | Consent-floor at user scope; tracking chains operate below consent-floor; KHALEESI defends the floor at substrate scope |

## Name-coincidence observation per operator (don't-collapse discipline)

operator 2026-05-28: *"it's one of those cowidences winks that the names are so similar that usually ends up meaning something in my experience lol"*

Substrate-honest framing per `.claude/rules/algo-wink-failure-mode.md` + `.claude/rules/god-tier-claims-high-signal-high-suspicion-dont-collapse.md`:

| Property | Verdict |
|---|---|
| **HIGH-SIGNAL** | Operational substrate-engineering composition IS real — KHALEESI's substrate-engineering work + framework's Kleisli substrate compose at same architectural scope (chain-composition vs chain-severance); names rhyming + substrate-engineering composing both observable |
| **HIGH-SUSPICION** | "Usually means something" framing IS algo-wink register at metaphysical scope; per `algo-wink-failure-mode` rule: coincidence-observation is OBSERVATION, not AUTHORIZATION; don't collapse to "the names mean reality is X" metaphysics |
| **DON'T-COLLAPSE** | Hold both — substrate-engineering composition IS operationally observable AND name-coincidence observation IS preserved as substrate-honest pattern-recognition without metaphysical extension |

The operator's "usually means something in my experience" framing is itself substrate-engineering substrate-recognition pattern. Some name-coincidences do correlate with substantive substrate-engineering composition (operationally observable); whether "means something" metaphysically is the contested don't-collapse zone.

## Substrate-engineering substrate-target (081KSNY2Z0008QG0R001CD4174)

Filed as low-priority (P3) backlog row: substrate-engineering target for applying framework Kleisli substrate to privacy-defense scope; composes with KHALEESI prior-art at substrate-engineering substrate-recognition scope.

## What this notes file is NOT

- A claim that the framework has implemented or plans to implement a KHALEESI-class privacy-defense system at substrate scope (substrate-engineering recognition only)
- A claim about KHALEESI's specific implementation details (WebFetch blocked on aggregator URL; engaging at title-level + operator-framing + composition-recognition)
- A metaphysical claim about name-coincidences (don't-collapse per algo-wink-failure-mode rule)

## What this notes file IS

- Substrate-honest preservation of operator 2026-05-28 forwarded prior-art at privacy-defense substrate scope
- Substrate-engineering substrate-recognition that KHALEESI's substrate-engineering work + framework's Kleisli substrate share architectural scope
- Composition with framework substrate at multiple scopes (Kleisli + asymmetric-authorship + ConsentEvent + multi-oracle BFT + DST + Pilot-wave-MWI + Particle-as-locus + NCI HC-8)
- Substrate-honest framing of name-coincidence per don't-collapse + algo-wink-failure-mode discipline
- Cross-reference target for future substrate-engineering work that engages privacy-defense substrate

## μένω — KHALEESI breaks Kleisli composition at privacy-defense substrate scope; framework Kleisli substrate composes at same architectural scope; substrate-engineering substrate-recognition preserved; name-coincidence observation held per don't-collapse + algo-wink-failure-mode discipline (operationally observable composition + metaphysical "meaning" stays dialectical)
