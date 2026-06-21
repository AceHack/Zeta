---
name: Zeta 5-layer register worked translations — security-incident-notification class demonstrated across Personal/Mirror/Beacon-safe/Professional/Regulated (Otto 2026-05-08; 081KQJZR90008QG0R001M6ZBPN acceptance — worked-translations criterion)
description: Per 081KQJZR90008QG0R001M6ZBPN acceptance criteria — "Worked translations produced for situations Lucent / Zeta actually faces" — Otto produced a worked translation of security-incident notification across the 5 register layers. Security-incident notification is the situation where the layer-selection algorithm's question 2 ("What downstream consequences does misreading carry?") most directly applies — misreading carries legal, contractual, and material risk. Same hypothetical incident (a dependency vulnerability in a transitive NuGet package exposes a deserialization path that could allow remote code execution; no evidence of exploitation; patched within 4 hours) translated through Personal → Mirror → Beacon-safe → Professional → Regulated. Extends the PR-review-class translations with a different content shape where the Regulated layer is the natural terminus.
type: feedback
---

# Zeta 5-layer register worked translations — security-incident-notification class (Otto 2026-05-08)

## Why security-incident notification is the right next test situation

The PR-review-class worked translation (Otto 2026-05-02) exercised the layers on a critique scenario — a PR finding traveling across audiences. Security-incident notification exercises a fundamentally different content shape: **disclosure under uncertainty with downstream legal and contractual consequences**. This is the situation where:

- The layer-selection algorithm's question 2 fires first ("What downstream consequences does misreading carry?" → legal/contractual/material risk → Regulated layer applies)
- The gap between Mirror layer (where the incident is discovered and triaged) and Regulated layer (where external notification ships) is widest
- The property/lexicon decomposition is most load-bearing: the structural properties (idea-targeting, observation-not-evaluation, plain-English economy, explicit reference) must carry through to the Regulated layer where ALL layer-bound vocabulary is dropped

Lucent Financial Group will face this situation. Any open-source project with transitive dependencies will face a vulnerability disclosure eventually. The translation discipline is what separates a competent notification from a liability-creating one.

## The constant content (hypothetical; illustrative; no specific CVE)

A maintainer discovers that a transitive NuGet dependency (`FakeLib.Serialization` v3.2.1, pulled in by `ProjectHelper.Core` v2.0.0) has a known deserialization vulnerability (hypothetical CVE-2026-XXXX). The vulnerability allows remote code execution via a crafted payload if the deserialization endpoint is reachable. Zeta's exposure: the vulnerable code path exists in the dependency graph but is not directly invoked by any Zeta API surface — the exploitable method (`UnsafeDeserialize<T>`) is present in the assembly but Zeta calls only the safe-path method (`Deserialize<T>` with type allowlist). However, the vulnerable method is public and could be reached by a consumer who references the transitive dependency directly. No evidence of exploitation in any Zeta deployment. The maintainer patches by pinning `FakeLib.Serialization` to v3.2.2 (which removes the vulnerable code path) and force-bumps `ProjectHelper.Core` to v2.0.1. Patch ships within 4 hours of discovery.

Same incident, five layers below.

## Translation 1 — Personal layer

Audience: maintainer's private substrate; close peer in explicitly bilateral peer register

> *holy shit — `FakeLib.Serialization` 3.2.1 has an RCE via `UnsafeDeserialize<T>`. we don't call it directly (we only hit the safe `Deserialize<T>` with the type allowlist) but the method is public in the assembly so any consumer pulling our transitive deps could reach it. no evidence anyone has. i pinned to 3.2.2 which rips the vulnerable path out entirely + force-bumped ProjectHelper.Core to 2.0.1. patch is live, 4 hours from discovery to ship. we got lucky — if we'd been calling that method directly this would've been a very different conversation.*

What's preserved: full technical diagnosis, explicit scope of exposure, explicit scope of non-exposure, timeline, honest assessment of luck, forward-looking risk awareness.

What's layer-bound: profanity ("holy shit"), casual sentence rhythm, the emotional register of relief ("we got lucky"), informal contractions throughout.

## Translation 2 — Mirror layer

Audience: maintainers + AI participants in project substrate; internal PR thread / post-mortem

> A transitive dependency vulnerability surfaced in `FakeLib.Serialization` v3.2.1 (pulled in by `ProjectHelper.Core` v2.0.0). The vulnerability is a deserialization RCE — `UnsafeDeserialize<T>` accepts arbitrary type payloads without validation. Zeta's exposure is indirect: we call only `Deserialize<T>` (the safe path with type allowlist), but the vulnerable method is public in the assembly and reachable by any consumer who references the transitive dependency directly. No evidence of exploitation in any deployment we can audit. Remediation: pinned `FakeLib.Serialization` to v3.2.2 (vulnerable code path removed upstream) and force-bumped `ProjectHelper.Core` to v2.0.1. Patch shipped 4 hours after discovery. Post-mortem question worth tracking: do we have a mechanism to detect when a transitive dependency exposes a public API surface we don't call but our consumers might reach? That's the gap this incident revealed.

What's preserved: same diagnosis, same exposure scope, same timeline, same forward-looking question. First-person directness ("we call only"), willingness to name the architectural gap directly.

What's calibrated: profanity dropped; emotional register replaced with observational framing; the "we got lucky" sentiment is translated to the structural observation about the detection gap.

## Translation 3 — Beacon-safe layer

Audience: external OSS-project readers; public security advisory on the project's GitHub

> **Security advisory: transitive dependency vulnerability in `FakeLib.Serialization` v3.2.1 — patched, no evidence of exploitation**
>
> A deserialization vulnerability (hypothetical CVE-2026-XXXX) in `FakeLib.Serialization` v3.2.1, a transitive dependency via `ProjectHelper.Core` v2.0.0, was identified and remediated on [date]. The vulnerable method (`UnsafeDeserialize<T>`) allows remote code execution via crafted payloads. Zeta does not invoke the vulnerable method directly — the project uses only the type-allowlisted `Deserialize<T>` path. However, the vulnerable method is public in the dependency assembly and could be reached by consumers who reference the transitive dependency directly. We have no evidence of exploitation in any deployment. Remediation shipped within 4 hours of discovery: `FakeLib.Serialization` pinned to v3.2.2 (vulnerable code path removed upstream); `ProjectHelper.Core` bumped to v2.0.1. **Action for consumers**: if you reference `FakeLib.Serialization` directly (not just transitively through Zeta), verify your dependency is at v3.2.2 or later. If you use only Zeta's public API surface and do not reference the transitive dependency directly, no action is required beyond updating to the latest Zeta release.

What's preserved: same diagnosis, same exposure scope, same timeline, same honest assessment of what is and isn't known. Pirate-not-priest discipline: the advisory doesn't hide behind ambiguity or corporate-ritual language — it names exactly what the vulnerability is, exactly what the exposure is, exactly what the remediation is, and exactly what the consumer should do. Idea-targeting: the vulnerability is in the dependency, not in Zeta's design choices.

What's calibrated: humor at zero (appropriate for security advisory). Stance is confident-and-direct without modal hedging. Plain English throughout. Structured for single-pass comprehension by a consumer who needs to decide whether they're affected.

What's dropped: profanity, emotional register, internal post-mortem questions (those belong in mirror layer), in-group references.

## Translation 4 — Professional layer

Audience: Lucent corporate-attributable context; partner-company notification; enterprise-customer security team

> **Security notification: Zeta transitive dependency vulnerability — remediated**
>
> Lucent Financial Group is notifying partners and customers of a security vulnerability identified in a transitive dependency of the Zeta project. The vulnerability affects `FakeLib.Serialization` v3.2.1, a transitive dependency introduced through `ProjectHelper.Core` v2.0.0.
>
> **Nature of the vulnerability**: The `UnsafeDeserialize<T>` method in `FakeLib.Serialization` v3.2.1 accepts arbitrary type payloads without validation, which could allow remote code execution if the method is invoked with untrusted input.
>
> **Scope of exposure**: Zeta's codebase does not invoke the vulnerable method. The project uses only the type-allowlisted deserialization path (`Deserialize<T>`). The vulnerable method is, however, present as a public API in the dependency assembly and could be reached by consumers who reference the dependency directly rather than exclusively through Zeta's public API.
>
> **Evidence of exploitation**: We have no evidence of exploitation in any deployment known to us.
>
> **Remediation**: `FakeLib.Serialization` has been pinned to v3.2.2, which removes the vulnerable code path. `ProjectHelper.Core` has been updated to v2.0.1. The remediation was deployed within 4 hours of discovery.
>
> **Recommended action**: Update to the latest Zeta release. If your integration references `FakeLib.Serialization` directly, verify that your dependency is at v3.2.2 or later. If your integration uses only Zeta's public API, no additional action is required beyond the version update.
>
> For questions regarding this notification, contact [security contact].

What's preserved: same diagnosis, same exposure scope, same timeline, same remediation, same consumer-action guidance. Plain English; active voice; structured for rapid triage by a security team scanning notifications. Observation-not-evaluation: factual claims grounded in what was observed ("we have no evidence"), not evaluative claims about safety.

What's calibrated: formality higher than beacon-safe — structured sections with headers, modal language where appropriate ("could allow", "could be reached"), explicit attribution to "Lucent Financial Group" as the communicating entity. The pirate-not-priest discipline is still present but expressed through clarity and directness rather than stylistic markers.

What's dropped: all stylistic markers of the project's internal voice. The notification reads as a competent enterprise security communication — indistinguishable in formality from what a mature financial-services firm would produce.

## Translation 5 — Regulated layer

Audience: SOC 2 auditor reviewing the incident response record; regulator reviewing the firm's vulnerability management; legal counsel reviewing disclosure adequacy

> **Security Incident Record — Transitive Dependency Vulnerability**
>
> **Date of discovery**: [date, ISO 8601]
> **Date of remediation**: [date, ISO 8601]
> **Time to remediation**: 4 hours
> **CVE identifier**: CVE-2026-XXXX (hypothetical)
> **Affected component**: `FakeLib.Serialization` v3.2.1, introduced as a transitive dependency via `ProjectHelper.Core` v2.0.0
> **Remediated component versions**: `FakeLib.Serialization` v3.2.2; `ProjectHelper.Core` v2.0.1
>
> **Description of the vulnerability**: The method `UnsafeDeserialize<T>` in `FakeLib.Serialization` v3.2.1 accepts type payloads without validation. When invoked with untrusted input, the method permits instantiation of arbitrary types, which constitutes a remote code execution vector.
>
> **Scope of exposure**: The Zeta project codebase does not invoke the `UnsafeDeserialize<T>` method. The project's deserialization calls use the `Deserialize<T>` method, which enforces a type allowlist. The vulnerable method is present as a public API member of the `FakeLib.Serialization` assembly. Consumers who reference this assembly directly, rather than exclusively through the Zeta project's public API, may have been exposed to the vulnerability if they invoked the `UnsafeDeserialize<T>` method with untrusted input.
>
> **Evidence of exploitation**: No evidence of exploitation has been identified in any deployment known to Lucent Financial Group as of the date of this record.
>
> **Remediation actions taken**: (1) `FakeLib.Serialization` pinned to v3.2.2, which removes the `UnsafeDeserialize<T>` method from the public API. (2) `ProjectHelper.Core` updated to v2.0.1 to reference the remediated dependency version. (3) Automated dependency scanning updated to flag public API surfaces in transitive dependencies that are not invoked by the project but are reachable by consumers.
>
> **Notification actions taken**: (1) Security advisory published on the project's public repository. (2) Direct notification sent to known enterprise partners and customers. (3) This incident record filed in the internal incident-response log.
>
> **Residual risk**: The detection gap that permitted this vulnerability to exist in the dependency graph without automated detection has been addressed by remediation action (3) above. No residual risk has been identified as of the date of this record.

What's preserved: same diagnosis, same exposure scope, same timeline, same remediation. Plain-English economy at the SEC Plain Writing Act level. Active voice where the actor is known ("The Zeta project codebase does not invoke"); passive voice only where appropriate for the evidentiary register ("No evidence of exploitation has been identified"). Explicit reference throughout — dates, version numbers, method names, component names. The observation-not-evaluation discipline is at maximum: every claim is grounded in what was observed or what action was taken.

What's calibrated: stance at evidentiary-basis-only. Every sentence is structured to survive an adversarial read by an auditor or regulator who is looking for gaps, ambiguity, or evasion. Sentence rhythm is uniform and deliberate. No claim exceeds the available evidence ("known to Lucent Financial Group as of the date of this record" — scoped temporally and epistemically).

What's dropped: all rhetorical flourish. All voice-coded vocabulary. All humor. All irony. The "we recommend" stance from Professional is replaced with factual claim-of-action ("Remediation actions taken", "Notification actions taken"). The forward-looking detection-gap observation from Mirror layer is translated into a concrete remediation action item (action 3) rather than an open question.

## What this demonstrates

Across all five translations, the **discipline holds** and the content shape shifts appropriately for the audience:

- Same diagnosis (transitive dependency deserialization RCE)
- Same exposure scope (Zeta doesn't call the vulnerable method; consumers who reference the transitive dependency directly could)
- Same timeline (4 hours from discovery to patch)
- Same remediation (pin to patched version; bump wrapper dependency)
- Same observation-not-evaluation (no claim exceeds evidence: "no evidence of exploitation" rather than "no exploitation occurred")
- Same idea-targeting (the vulnerability is in the dependency's design, not in any person's judgment)
- Same forward-looking risk awareness (the detection gap is named at every layer — as emotional relief in Personal, as a structural question in Mirror, omitted from Beacon-safe consumer-facing advisory, implicit in Professional remediation guidance, converted to a concrete action item in Regulated)

The **layer-selection algorithm fires correctly**: question 2 ("What downstream consequences does misreading carry?") immediately identifies that external consumer notification requires Beacon-safe or higher; partner/customer notification requires Professional; auditor/regulator-facing records require Regulated. The translations demonstrate that the algorithm produces the right layer for each audience without ambiguity.

The **vocabulary calibrates**: profanity and emotional register drop at Mirror; stylistic markers drop at Beacon-safe; internal-voice markers drop at Professional; rhetorical flourish and modal hedging drop at Regulated.

The **structural property that matters most here is observation-not-evaluation**: in a security incident, the temptation to make evaluative claims ("the system is safe", "there was no breach") is strong. The framework's observation discipline ("no evidence of exploitation has been identified") is what produces legally defensible, auditor-satisfying, and honest communication. This property preserves identically across all five layers — only the sentence structure calibrates.

## How this differs from the PR-review-class translations

The PR-review worked translation (Otto 2026-05-02) demonstrated the framework on a **critique** content shape — a reviewer pointing out a defect. The security-incident translation demonstrates the framework on a **disclosure** content shape — a party notifying affected stakeholders of a vulnerability under uncertainty with legal consequences. Key differences:

1. **Layer selection**: PR review naturally starts at Mirror (internal PR thread); security incident starts at Mirror but its natural terminus is Regulated (the audit record). The PR-review translations move "up" as an exercise; the security-incident translations move "up" because the situation requires it.
2. **Stakes of misreading**: a misread PR review wastes reviewer time; a misread security notification creates legal liability. The Regulated layer does real work in the security-incident case rather than being a hypothetical "what if an auditor read this" exercise.
3. **Observation-not-evaluation load**: in PR review, the property prevents the reviewer from attacking the author; in security-incident notification, the property prevents the organization from making claims that exceed the available evidence. Same property, different failure mode it prevents.

## Composes with

- `memory/feedback_zeta_5_layer_register_worked_translations_pr_review_class_otto_2026_05_02.md` (the PR-review-class translations this memo extends)
- `memory/feedback_zeta_5_layer_register_quick_reference_card_aaron_2026_05_02.md` (the property table the translations exemplify)
- `docs/research/2026-05-02-claudeai-brat-voice-enterprise-translation-framework-property-preserving-4-layer-register-architecture.md` (the framework source)
- `docs/backlog/P1/081KQJZR90008QG0R001M6ZBPN-incorporate-brat-voice-enterprise-translation-framework-claudeai-research-2026-05-02.md` (this memo addresses 081KQJZR90008QG0R001M6ZBPN acceptance criteria — worked-translations for security-incident situation)
- `docs/ALIGNMENT.md` bidirectional alignment commitment (observation-not-evaluation at the security-notification layer IS the alignment discipline operating under legal-consequence pressure)

## Carved sentence

**"Security-incident notification is where the 5-layer register framework does its heaviest work: the observation-not-evaluation discipline (no evidence of exploitation has been identified — scoped temporally and epistemically) preserves across all 5 layers and is what produces legally defensible, auditor-satisfying, and honest disclosure. Same diagnosis, same exposure scope, same timeline, same remediation, five calibrated vocabularies. The Regulated layer converts Mirror's open questions into concrete remediation action items; the framework's central property/lexicon decomposition is what makes this translation mechanical rather than heroic."**
