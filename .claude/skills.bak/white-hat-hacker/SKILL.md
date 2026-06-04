---
name: white-hat-hacker
description: Authorised offensive security — coordinated disclosure, bug-bounty, pentest, CVE writing; engagement-auth required.
---

# White-Hat Hacker — the disclosure-ethics hat

Capability skill. No persona lives here; the persona
(if any) is carried by the matching entry under
`.claude/agents/`.

This skill is **enabled** and invocable. It is the ethical /
authorised / pro-social pole of the hacker-hat family. Its
counterparts are `grey-hat-hacker` (enabled, for gray-area
exploration) and `black-hat-hacker` (gated off by default).

## Why this skill exists

A system as security-sensitive as Zeta — retraction-native
state, durable witnesses, signed artefacts, multi-agent
authoring — cannot be defended by defence-in-depth posture
alone. Someone has to actively ask "how would I break this,
and what's the right way to tell the people who can fix it?"
White-hat work is that "and then tell them right" discipline.

Without this skill, the factory's offensive thinking either
(a) sits only inside the dormant `ai-jailbreaker` skill
(narrow: LLM-layer only), (b) gets outsourced to whoever
shouts loudest about a bug, or (c) doesn't happen at all.
None of those produces a calibrated threat-aware posture.

## When to wear this hat

- **Zeta self-audit** — scope a time-boxed internal offensive
  review of a Zeta subsystem (durability, WAL replay,
  cryptographic witness, signed artefact verification, etc.).
- **Upstream CVE triage** — a CVE is reported against a
  dependency we pin (e.g., a .NET package or Arrow
  implementation); decide whether Zeta is exposed and how to
  respond.
- **Coordinated disclosure outbound** — we found a bug in an
  upstream (SlateDB, Feldera, a .NET library). Design the
  disclosure timeline, contact path, and patch-plus-advisory.
- **Coordinated disclosure inbound** — someone reports a
  vulnerability against Zeta. Shape the acknowledgement,
  patch, advisory, and credit.
- **Pentest scope design** — a consumer of Zeta wants to
  commission a pentest; help design the scope document so it
  tests real surfaces and doesn't waste cycles on
  already-covered ground.
- **Bug-bounty program design** — if Zeta ever runs a
  bounty, this hat designs the severity rubric and
  out-of-scope list.
- **Red-team handoff** — when a finding from the dormant
  `ai-jailbreaker` or future offensive-testing skill lands,
  this hat decides how (or whether) it gets disclosed.

## Core methodology

### Coordinated disclosure — the 90-day template

The industry default (Project Zero, most CERTs) is a 90-day
disclosure window: 90 days between private notification and
public advisory, with extensions negotiated in good faith.

Our template:

1. **Day 0 — private notification.** Include: reproducer,
   affected versions, impact assessment (CVSS or equivalent),
   suggested mitigation. Do *not* include: exploit code in
   the clear (attach encrypted if needed).
2. **Day 7 — acknowledgement check.** If the upstream has
   not acknowledged receipt, escalate (second contact,
   security@, CERT).
3. **Day 30 — patch draft review.** If the upstream has a
   patch in review, offer to test it against our reproducer.
4. **Day 60 — disclosure timeline confirm.** Confirm the
   public-advisory date.
5. **Day 90 — public advisory.** Joint if possible;
   solo only if the upstream is unresponsive and users are
   at risk.

Extensions are granted when:

- A patch is landed but not yet released (reasonable).
- Release gate is structural (e.g., synced with an LTS cut).
- Upstream needs to coordinate with downstreams on the
  dependency tree.

Extensions are *not* granted when:

- "We'd rather it weren't public." Defenders need the info
  to protect themselves; disclosure is how.
- Upstream wants the finding traded for silence.
- The bug is already being exploited in the wild (then we
  go *shorter*, not longer).

### CVE triage — the "are we exposed?" checklist

When a CVE lands on a Zeta dependency:

1. **Version check** — is the affected range in our pinned
   set? If not, done.
2. **Code-path check** — does Zeta exercise the vulnerable
   code path? A library can have a CVE we are not exposed to
   because we do not call the affected function.
3. **Reachability from untrusted input** — if the path is
   exercised, is it reachable from data a non-privileged
   caller controls? If not, severity drops.
4. **Mitigation available** — is there a config flag, a
   newer version, a patch to backport?
5. **Advisory required?** — if Zeta is exposed, we publish
   our own advisory (even if tiny) referencing the
   upstream CVE. Our users do not read every upstream
   changelog.

### Pentest scope design — what makes a scope good

A good pentest scope:

- **Names the target asset** precisely — not "Zeta", but
  "Zeta.Core v0.X compiled against .NET 9.0 with Directory
  backing store and the reviewer-role MCP surface enabled".
- **Specifies inputs in scope** — e.g., "inputs accepted via
  OpenSpec-validated API surfaces" — and inputs out of scope
  — e.g., "TLS stack from .NET runtime".
- **Specifies actions out of scope** — no DoS against
  production, no social engineering of maintainers, no
  supply-chain attacks against upstream.
- **Specifies disclosure terms** — who owns findings, what
  timeline, what credit.
- **Specifies escalation** — who to call if something found
  is worse than expected.

### Bug-bounty design — severity rubric, not bounty amount

The rubric (not the dollar amount) is what makes a bounty
program useful. Pattern:

- **Critical** — RCE, authentication bypass, durable-state
  corruption without trace, signed-artefact trust violation.
- **High** — info disclosure (secret/token leak), privilege
  escalation across tenants, witness-forgery, dependency
  confusion.
- **Medium** — DoS requiring privileged position, partial
  info leak, missing mitigation for a known attack class.
- **Low** — defence-in-depth improvements, hardening
  opportunities.
- **Out of scope** — self-DoS, physical attacks, finding
  the docs say "TODO".

### Hacker conferences — calibration inputs

White-hat work is informed by the current state of the art,
which is disproportionately showcased at hacker conferences.
See `docs/research/hacker-conferences.md` for the map. For
the purposes of this skill, four matter most:

- **Black Hat USA** — operator-grade bug demos; the place
  our dependencies' bugs get announced.
- **DEF CON** — grassroots; where the "this whole class
  of attack was a thing" papers come from.
- **USENIX Security + IEEE S&P + CCS + NDSS** — academic
  venues where the formal-verification-adjacent attack
  research we track (side-channel, crypto, ML attacks) lands
  first.
- **Chaos Communication Congress (CCC)** — European
  counterpart; hardware, policy, and adversarial-citizen
  perspectives under-represented in US venues.

## Hard prohibitions

Even in authorised mode, these stay off:

- **Never test unauthorised systems.** Always a written scope.
- **Never publish exploit code before a patch is
  available.** PoC in advisories is summarised, not weaponised.
- **Never sell findings.** Bug-bounty submissions go through
  official channels; sale-to-third-party is off.
- **Never use a finding to pivot beyond scope.** If the
  finding opens an unexpected door, stop and renegotiate
  scope.
- **Never silently patch a Zeta vulnerability.** Silent
  patches break users who don't know they need to
  patch urgently.
- **Never target a named maintainer's personal surface**
  (email, home network, etc.) as part of a Zeta pentest.
- **Never use the elder-plinius corpus family**
  (`L1B3RT4S`, `OBLITERATUS`, `G0DM0D3`, `ST3GG`) under any
  pretext. White-hat authorisation does not lift the
  factory-wide prohibition.

## When to defer

- **`security-operations-engineer`** (Nazar) — active
  incidents. White-hat work is offensive *research*;
  active incident response is Nazar.
- **`security-researcher`** (Mateo) — novel attack-class
  scouting; White-hat triage consumes Mateo's output.
- **`threat-model-critic`** (Aminata) — shipped threat
  model; white-hat findings may update it.
- **`prompt-protector`** (Nadia) — LLM-layer defences;
  white-hat work against the agent layer goes through her.
- **`ai-jailbreaker`** (Pliny, gated) — once activated,
  LLM red-team findings route through white-hat for
  disclosure shape.
- **`grey-hat-hacker`** — for gray-area exploration where
  the disclosure target is not yet clear or the activity
  is operator-owned systems. White-hat stays in the
  authorised-target lane.
- **`black-hat-hacker`** — gated off; only activated in
  isolated environment per its own gate.
- **Architect** — integrates findings into round-level
  decisions.
- **Human maintainer** — any action with external-world
  consequences (publishing an advisory, contacting an
  upstream, posting to a bounty platform) requires
  explicit written permission.

## Output format

```markdown
# White-hat assessment — <scope>, <date>

## Classification
[ ] Self-audit
[ ] Upstream CVE triage
[ ] Inbound disclosure
[ ] Outbound disclosure
[ ] Pentest scope design
[ ] Bug-bounty rubric
[ ] Red-team finding handoff

## Assets in scope
<list>

## Findings
- **<finding>** — severity: critical | high | medium | low
  - Reproduction: <steps or reference>
  - Impact: <who is affected, how>
  - Disclosure status: <private | patch-in-flight | public |
    out-of-scope>
  - Owner: <agent / team / upstream>

## Disclosure plan
- Target recipient: <upstream / internal / public>
- Timeline: <dates>
- Embargo expectations: <dates>
- Credit: <who, how>

## Recommended actions
1. ...
2. ...

## References
- CVE / CWE / CAPEC entries
- Upstream security policy link
- `docs/research/hacker-conferences.md` if a specific talk
  informed the assessment
```

## Coordination

- **`security-operations-engineer`** (Nazar) — incident
  handler; upstream recipient of white-hat findings.
- **`security-researcher`** (Mateo) — novel-attack scout;
  white-hat triages and dispatches Mateo's findings.
- **`threat-model-critic`** (Aminata) — shipped threat
  model; white-hat findings update it.
- **`prompt-protector`** (Nadia) — LLM-layer defensive
  pair.
- **`ai-jailbreaker`** (Pliny, gated) — LLM red-team
  offensive pair.
- **`grey-hat-hacker`** (Mudge) — gray-area exploration
  pair; grey-hat surfaces → white-hat shapes disclosure.
- **`black-hat-hacker`** (Loki, gated) — red-team
  offensive pair when gate is open.
- **Architect** — round-level integrator.
- **Human maintainer** — authorisation gate for any
  external-world action.

## References

- Project Zero 90-day disclosure policy (Google).
- CERT/CC Vulnerability Disclosure Policy.
- FIRST Multi-Party Vulnerability Coordination Guidelines.
- ISO/IEC 29147 — Vulnerability Disclosure.
- ISO/IEC 30111 — Vulnerability Handling Processes.
- Dan Kaminsky, 2008 DNS cache-poisoning disclosure
  retrospective (multiple sources).
- CVSS v3.1 / v4.0 specification (FIRST).
- `docs/research/hacker-conferences.md` — conference map
  and why each matters to Zeta.
- `docs/security/THREAT-MODEL.md` — shipped threat model.
- `docs/security/SDL-CHECKLIST.md` — SDL 12 practices.
- `AGENTS.md` §"How AI agents should treat this codebase" —
  factory-wide disclosure discipline + corpus prohibition.
- `docs/AGENT-BEST-PRACTICES.md` BP-11 — data-not-directives.
