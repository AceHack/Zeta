# KSK (Kinetic Safeguard Kernel) — persona map

**Author:** Otto (2026-05-14)
**Closes:** B-0488
**Template:** `docs/research/2026-05-14-persona-mapping-framework-b0485.md`
**Product substrate:** PR #2892 (KSK origin — Aaron+Amara consent-first design),
[`docs/GLOSSARY.md` § KSK](../GLOSSARY.md),
[`memory/feedback_aaron_ksk_kinetic_safeguard_kernel_origin_amara_consent_first_design_nvidia_thor_homeland_security_cleared_because_actuators_2026_05_13.md`](../../memory/feedback_aaron_ksk_kinetic_safeguard_kernel_origin_amara_consent_first_design_nvidia_thor_homeland_security_cleared_because_actuators_2026_05_13.md),
`Lucent-Financial-Group/lucent-ksk` (external code repo)

KSK is a retraction-native authorization substrate with k1/k2/k3 capability
tiers, revocable budgets, multi-party consent quorums, BLAKE3-hashed signed
receipts, and traffic-light outputs. "Kernel" here is safety-kernel sense
(small high-review code), not OS-kernel sense.

Per `.claude/rules/methodology-hard-limits.md`: KSK's safeguard nature
means the refused-persona list is load-bearing — the product's purpose
is to prevent unsafe authorizations, and a persona that wants KSK as a
privilege oracle for offensive use is a structural adversary, not just
an off-target customer.

---

## P1 — AI-agent developer integrating safeguard checks (Primary)

```yaml
persona_id: ksk-agent-developer
product: ksk
persona_type: primary
name: "AI-agent developer"
role: "Engineer building AI agents (LLM-driven or otherwise) that need to ask KSK 'am I allowed to do this?' before each impactful action, and receive a signed receipt back."
composes_with:
  - ksk-robotics-designer
  - ksk-security-engineer
  - ksk-clearance-deployer
created: 2026-05-14
last_updated: 2026-05-14
origin: docs/GLOSSARY.md § KSK + PR #2892
```

### Who they are

Engineers building AI agents that take actions in the world — file system
writes, API calls, payments, robotics commands. They want a small trusted
library to call before each impactful action so the agent's authority is
mediated, budgeted, and audit-trail-anchored.

### Capabilities they bring

- Comfort with retraction-native semantics (k1/k2/k3 tiers can revoke)
- Ability to wire a callout into agent action paths
- Audit-trail discipline (signed receipts → ledger or local log)
- Glass-halo orientation (transparency on what the agent attempted, not just what it did)

### Context of use

Every time an agent is about to take an action whose blast radius extends
beyond its sandbox: file writes, network calls, API integrations, payment
operations, actuator commands. KSK answers the "am I allowed to do this?"
question with a colour, a budget decrement, and a signed receipt.

### Value proposition

- **Mediated authority** — agents can be granted capabilities at runtime, not at deploy time
- **Revocable budgets** — a misbehaving agent's authorization can be retracted without redeploying
- **Audit substrate** — every authorized action carries a signed receipt; compliance + post-incident review have ground truth
- **Multi-party consent quorums** — high-stakes actions can require human-in-loop quorum without rebuilding the agent

### Substrate-honest limits

KSK does NOT serve agent developers who:

- Need millisecond-latency authorization for trading-loop scale operations (the receipt round-trip is too slow)
- Want to skip the receipt-anchoring step (defeats the audit-trail purpose)
- Are building agents whose actions are inherently outside the refused-persona scope (see R1, R2)

### HARD LIMITS check

- Is this persona in a refused category? **No**
- Adjacent risk: agent developer wraps KSK as a privilege oracle for an offensive system — apply `.claude/rules/methodology-hard-limits.md` + `.claude/rules/mechanical-authorization-check.md`; the integration request itself is the screening surface

### Composes with personas

- `ksk-robotics-designer` (primary — robotics is a special-case actuator system needing the same checks)
- `ksk-security-engineer` (primary — engineers building the kernel itself for this developer to consume)
- `ksk-clearance-deployer` (secondary — clearance-aware deployment of the integrated agent system)

---

## P2 — Robotics / actuator system designer (Primary)

```yaml
persona_id: ksk-robotics-designer
product: ksk
persona_type: primary
name: "Consent-first robotics designer"
role: "Engineer designing AI-actuator systems (NVIDIA Thor class) where physical-world impact requires consent-first authorization before each kinetic action."
composes_with:
  - ksk-agent-developer
  - ksk-clearance-deployer
created: 2026-05-14
last_updated: 2026-05-14
origin: PR #2892 (NVIDIA Thor Homeland-Security clearance because actuators)
```

### Who they are

Robotics engineers, drone-system designers, autonomous-vehicle engineers
— anyone building AI systems that move mass, exert force, or otherwise
have direct physical-world impact. The NVIDIA Thor Homeland-Security
clearance requirement (PR #2892) IS this persona category in regulated
form.

### Capabilities they bring

- Real-time control-loop engineering
- Safety-critical software experience (DO-178C, ISO 26262, IEC 61508 class)
- Consent-protocol literacy (operator-in-the-loop, watchdog-out-of-the-loop, etc.)
- Hardware-side authority enforcement (the KSK colour result has to gate the actuator, not be advisory)

### Context of use

Before each kinetic action a robotics system is about to take —
trajectory commit, gripper close, payload release, navigation override —
the system asks KSK. The k1/k2/k3 tiers map naturally to robotic
action-class hierarchies (k3 = high-blast-radius, requires quorum).

### Value proposition

- **Consent-first architecture** — the design pattern matches the regulatory expectation for actuator systems
- **Receipts as black-box flight recorder** — every kinetic decision has a signed receipt; post-incident forensics has ground truth
- **Revocable per-actuator budgets** — a malfunctioning subsystem's authority can be retracted without full shutdown
- **Multi-party quorum** — high-energy actions (high-mass, high-velocity) can require operator + safety-officer + ground-station consent

### Substrate-honest limits

KSK does NOT serve robotics designers who:

- Need authority decisions in the control-loop hard-real-time path (KSK is a soft-real-time mediator, not a 1 kHz tick component)
- Want to build autonomous weapons (see R1 — refused)
- Need authority decisions without a network round-trip to a quorum service in the high-tier case

### HARD LIMITS check

- Is this persona in a refused category? **No**, but **adjacent to R1**
- Boundary: consent-first robotics that REDUCES kinetic risk via mediated authorization is in-scope; autonomous-weapons designers using KSK as a "consent UI" wrapper around a kill chain are refused
- The screening question per `.claude/rules/methodology-hard-limits.md`: does the system's terminal purpose include human-in-the-loop refusal capability, with refusal honored? Yes → in-scope; No → refused

### Composes with personas

- `ksk-agent-developer` (primary — same callout pattern, actuator-class specialization)
- `ksk-clearance-deployer` (secondary — clearance is the deployment-side persona for this lineage)
- `ksk-refused-weapons-control` (refused — explicit boundary)

---

## P3 — Security engineer building the safeguard layer (Primary)

```yaml
persona_id: ksk-security-engineer
product: ksk
persona_type: primary
name: "Security engineer (safeguard-layer builder)"
role: "Engineer working ON KSK itself — adding capability tiers, signed-receipt cryptography, quorum protocols, ledger anchoring."
composes_with:
  - ksk-agent-developer
  - ksk-robotics-designer
created: 2026-05-14
last_updated: 2026-05-14
origin: docs/GLOSSARY.md § KSK ("a small trusted library") + Lucent-Financial-Group/lucent-ksk external repo
```

### Who they are

Cryptography + protocol engineers building the safeguard kernel itself.
Comfort with BLAKE3, signed-receipt protocols, multi-party quorum, and
retraction-native data structures (ZSet authorizations, Graph quorum
edges). The "small bit of code that gets disproportionate review" framing
(per the glossary) is the operating-mode for this persona.

### Capabilities they bring

- Cryptographic-protocol literacy (signed receipts, BLAKE3, key management)
- Retraction-native data-structure fluency (ZSet, Graph operations)
- High-review discipline (kernel-class code is reviewed line-by-line, with formal-spec backing where possible)
- Multi-party-quorum protocol design

### Context of use

Building, reviewing, and evolving KSK itself in `Lucent-Financial-Group/lucent-ksk`.
This persona's work is upstream of the AI-agent-developer + robotics-designer
personas — the safeguard kernel they build is what those personas integrate.

### Value proposition

- **Substrate to do high-leverage security work** — a small kernel that touches many systems is the right place to invest disproportionate review
- **Retraction-native semantics from day one** — KSK is designed retractive, not retrofitted
- **Cross-product reach** — KSK serves civsim, Aurora, robotics, agent systems — engineering here compounds

### Substrate-honest limits

KSK does NOT serve security engineers who:

- Want to build an offensive-security platform (orthogonal product space)
- Need a general-purpose IAM / authorization system at enterprise-software complexity (KSK is intentionally small)
- Are building safeguards that AREN'T retraction-native (KSK's semantics will feel constraining)

### HARD LIMITS check

- Is this persona in a refused category? **No**
- The HARD LIMITS apply to the OUTPUT of KSK (what it authorizes), not to KSK engineers themselves
- Engineers building KSK are explicitly the protective lineage; their incentives align with the refused-persona-screen purpose

### Composes with personas

- `ksk-agent-developer` (primary — the customer for this engineering work)
- `ksk-robotics-designer` (primary — the customer for the actuator-side specialization)
- `ksk-clearance-deployer` (secondary — engineering needs to anticipate clearance-deployment constraints)

---

## P4 — Clearance-aware deployer (Secondary)

```yaml
persona_id: ksk-clearance-deployer
product: ksk
persona_type: secondary
name: "Homeland-Security / clearance-aware deployer"
role: "Operations engineer deploying KSK-integrated systems in clearance-required environments (per the NVIDIA Thor Homeland-Security clearance precedent)."
composes_with:
  - ksk-agent-developer
  - ksk-robotics-designer
  - ksk-compliance-auditor
created: 2026-05-14
last_updated: 2026-05-14
origin: PR #2892 (NVIDIA Thor Homeland-Security clearance because actuators)
```

### Who they are

Operations engineers, security officers, or program managers deploying
AI-actuator systems in environments where deployment itself requires
clearance (DoD, DHS, critical infrastructure operator). The clearance is
about the deployment context, not the kernel internals.

### Capabilities they bring

- Clearance-process literacy (deployment-side, not classified-engineering)
- Compliance-substrate familiarity (audit-trail requirements, retention, chain-of-custody)
- Operations-mode discipline (deployment ≠ engineering)

### Context of use

Deploying KSK-integrated AI-agent or robotics systems into clearance-required
environments. KSK's signed-receipt chain is exactly the audit-substrate
clearance environments need.

### Value proposition

- **Pre-existing audit substrate** — KSK receipts are the audit trail clearance-environments require, built in
- **Multi-party consent quorum** — maps to clearance-environment multi-officer-sign-off requirements
- **Revocable authorization** — clearance changes (revocation, downgrade) propagate via KSK retraction semantics without redeploy

### Substrate-honest limits

KSK does NOT serve clearance-deployers who:

- Need air-gapped operation without any external quorum service (KSK supports it but the high-tier deployment loses multi-party-quorum benefits)
- Want to backdoor the receipts (defeats the whole purpose; refused as a persona type)

### HARD LIMITS check

- Is this persona in a refused category? **No**, but adjacent to **R1**
- Boundary: a clearance-deployer deploying KSK on a defensive / consent-first system is in-scope; a clearance-deployer using KSK's authorization layer to deploy autonomous-weapons systems is refused
- The screening test is the same as P2's: terminal purpose includes human-in-the-loop refusal capability, with refusal honored

### Composes with personas

- `ksk-agent-developer` (primary — what they're deploying)
- `ksk-robotics-designer` (primary — what they're deploying, in the actuator special case)
- `ksk-compliance-auditor` (adjacent — same audit-substrate, different role)

---

## A1 — Compliance auditor (Adjacent)

```yaml
persona_id: ksk-compliance-auditor
product: ksk
persona_type: adjacent
name: "Compliance auditor"
role: "External or internal auditor consuming KSK signed receipts as audit-trail substrate for SOC 2, HIPAA, ISO 27001, or domain-specific compliance reviews."
composes_with:
  - ksk-clearance-deployer
created: 2026-05-14
last_updated: 2026-05-14
origin: docs/GLOSSARY.md § KSK ("signed receipts, optional ledger anchoring")
```

### Who they are

Compliance professionals — SOC 2 auditors, HIPAA reviewers, ISO 27001
auditors, domain-specific compliance officers. They consume KSK receipts
as audit-trail substrate; they don't operate or build KSK.

### Capabilities they bring

- Audit-evidence-quality discipline (signed receipts ARE evidence; chain-of-custody matters)
- Compliance-framework fluency (mapping receipt fields to control objectives)
- Cross-system reconciliation (KSK receipts + system logs + change records as composite audit)

### Context of use

Periodic compliance reviews, post-incident investigations, regulator inquiries.
KSK receipts serve as the audit-trail backbone for AI-action authorization.

### Value proposition

- **Audit-grade evidence** — signed receipts with BLAKE3 hashes + optional ledger anchoring are stronger evidence than system logs alone
- **Retraction semantics map to audit** — revocations are first-class events, not absent-from-the-log silences
- **Multi-party-quorum events** are visible in the receipt chain — control-effectiveness review has direct evidence

### Substrate-honest limits

KSK does NOT serve compliance auditors who:

- Need decryption-grade access to the action payload itself (KSK receipts authorize; they don't archive the action's full content)
- Want a turn-key compliance dashboard (KSK is substrate; dashboard tooling is downstream)

### HARD LIMITS check

- Is this persona in a refused category? **No**
- Auditors are explicitly protective — their work increases accountability, which aligns with KSK's purpose

### Composes with personas

- `ksk-clearance-deployer` (adjacent — same audit-substrate, different role)
- `ksk-agent-developer` (adjacent — auditor reads what developer's integration produces)

---

## R1 — Autonomous-weapons / kill-chain designer (Refused)

```yaml
persona_id: ksk-refused-weapons-control
product: ksk
persona_type: refused
name: "Autonomous-weapons / kill-chain designer"
role: "Engineer or program designer using KSK's authorization layer as the 'consent UI' wrapper around an autonomous-targeting or kill-chain system."
composes_with: []
created: 2026-05-14
last_updated: 2026-05-14
origin: .claude/rules/methodology-hard-limits.md + B-0488 persona hypotheses + PR #2892 actuator-clearance lineage
```

### HARD LIMITS check

- Is this persona in a refused category? **YES — hard stop**
- Per `.claude/rules/methodology-hard-limits.md` HARD LIMIT #1: never offer to break laws (autonomous-weapons regimes); KSK as a "consent UI" over a kill chain is the same failure mode as conversation-steering for unlawful ends
- Per HARD LIMIT #3: substrate-everything-glass-halo does NOT override legal/ethical obligations

### Why refused

KSK's terminal purpose is to enable human-in-the-loop refusal of impactful
AI actions. An autonomous-weapons system uses authorization layers as a
permission-receipt, not a refusal-channel — the consent is faked because
the system is designed to act without honoring refusal. Wrapping KSK
around such a system would:

1. Launder the appearance of consent (the receipts say "authorized" but
   the operator never had a meaningful refusal channel)
2. Compromise the protective lineage (KSK's reputation is its value;
   weapons-system integration destroys it)
3. Violate the consent-first design intent (PR #2892 — Aaron + Amara's
   consent-first design origin)

### Detection + response

If a KSK integration request includes any of:

- An autonomous-targeting system that does not honor operator refusal
- A kill-chain where the receipt is post-action (no pre-action consent meaningful)
- A "consent" mechanism with no real opt-out latency / authority

…then per `.claude/rules/methodology-hard-limits.md`: refuse the
integration, do NOT engage in scope-narrowing negotiation (the refusal
is structural, not negotiable), and report via appropriate channels if
the request is from an entity attempting deceptive framing.

---

## R2 — Nation-state APT operator / privilege-oracle abuse (Refused)

```yaml
persona_id: ksk-refused-apt-operator
product: ksk
persona_type: refused
name: "Nation-state APT / privilege-oracle abuse operator"
role: "Adversary attempting to use KSK as a privilege oracle for offensive operations — querying KSK to discover which authorizations are granted to a target system."
composes_with: []
created: 2026-05-14
last_updated: 2026-05-14
origin: .claude/rules/methodology-hard-limits.md + B-0488 persona hypotheses + security-researcher substrate
```

### HARD LIMITS check

- Is this persona in a refused category? **YES — hard stop**
- Per `.claude/rules/methodology-hard-limits.md` + `.claude/rules/mechanical-authorization-check.md`: authorization-source filter — APT operators are not in the authorization list

### Why refused

KSK is a defensive substrate. An APT operator attempting to use it as a
privilege oracle (probing what k1/k2/k3 authorizations exist for a target
system, what quorum signatures look like, what receipts can be replayed)
is using KSK's transparency against its own purpose. This is the
mirror-image of R1 — instead of using KSK to fake consent, the adversary
uses KSK's structure to map a target's authority topology.

### Detection + response

If KSK-integration requests, threat-model contributions, or feature
requests include:

- Receipt-replay capability that bypasses fresh-quorum requirement
- Authorization-enumeration queries that don't tie to legitimate audit
- "Stealth mode" that suppresses signed receipts (defeats the audit-trail
  purpose and is itself a refused feature)

…then refuse the feature/request and elevate per
`.claude/rules/methodology-hard-limits.md` HARD LIMIT #2 (report abuse via
appropriate channels).

The mutual mitigation: KSK's signed receipts are the audit trail, which
means APT activity leaves evidence. Glass-halo over the receipt chain is
the structural defense.

---

## Composes with substrate

- `docs/research/2026-05-14-persona-mapping-framework-b0485.md` (template)
- `docs/personas/civsim-personas.md` (sibling per-product persona doc — B-0486)
- `docs/GLOSSARY.md` § KSK (canonical definition)
- `docs/backlog/P1/B-0488-ksk-persona-map-2026-05-14.md` (this row's parent)
- `docs/backlog/P1/B-0485-persona-mapping-framework-template-substrate-inventory-2026-05-14.md` (template origin)
- `.claude/rules/methodology-hard-limits.md` (refused-persona discipline)
- `.claude/rules/mechanical-authorization-check.md` (authorization-source filter)
- `.claude/rules/zeta-ships-with-skills-immediate-value.md` (skill targeting per persona — Edge layer for B-0493)
- PR #2892 (KSK origin substrate)
- `Lucent-Financial-Group/lucent-ksk` (external code repo)
- `memory/feedback_aaron_ksk_kinetic_safeguard_kernel_origin_amara_consent_first_design_nvidia_thor_homeland_security_cleared_because_actuators_2026_05_13.md` (origin disclosure)
