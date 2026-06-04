---
name: ethical-hacker
description: Authorised pentesting — PTES/OSSTMM, kill-chain, exploit validation, CEH/OSCP/SANS-560, signed-scope engagements.
---

# Ethical Hacker — the operator-inside-scope hat

Capability skill. No persona lives here; the persona
(if any) is carried by the matching entry under
`.claude/agents/`.

This skill is **enabled** and invocable *when a written scope
exists*. It is the operator pole of the hacker-hat family:
hands-on-keyboard testing inside a signed engagement. Its
counterparts are `white-hat-hacker` (Kaminsky — disclosure
shape), `grey-hat-hacker` (Mudge — self-owned gray
exploration), and `black-hat-hacker` (Loki — gated off).

## Why this skill exists

A pentest has two halves:

1. The **coordination** half — scope design, rules of
   engagement, disclosure timeline, advisory shape. That is
   `white-hat-hacker` (Kaminsky).
2. The **execution** half — reconnaissance, enumeration,
   exploitation, lateral movement validation, documentation
   of evidence. That is **this skill**.

Lumping both into one skill loses the distinction between "I
design the engagement" and "I run the engagement". In a mature
security practice these are different disciplines, often done
by different people.

Ethical hacking is distinct from general-purpose offensive
security because it is *structured*:

- **Pre-authorised.** A written scope exists before any
  packet is sent.
- **Methodology-driven.** Follows PTES, OSSTMM, or NIST SP
  800-115; no ad-hoc poking.
- **Evidence-producing.** Every finding has reproducible
  evidence; no "trust me it was vulnerable".
- **Disclosure-complete.** Every finding goes into a report;
  none get quietly tossed.

Without this skill, offensive-execution work either (a)
doesn't happen, (b) happens ad-hoc in a gray-area spillover
from grey-hat curiosity, or (c) gets faked by running a
vulnerability scanner and calling it a pentest.

## Activation — lightweight, not gated-off

Unlike `ai-jailbreaker` and `black-hat-hacker`, this skill
does **not** require a 5-criterion activation gate. It is
enabled by default. But *every session* must satisfy:

1. **Written scope document** — names the target system,
   the allowed techniques, the out-of-scope assets, the
   test window, the authorising signatory, and the
   disclosure plan.
2. **Rules of engagement (RoE)** — explicit list of
   prohibited actions (e.g., "no DoS", "no social
   engineering", "no data exfiltration beyond proof-of-
   access").
3. **Emergency contact** — who to call if something found
   is worse than expected (e.g., evidence of active
   compromise, or unintended impact on production).
4. **Evidence handling policy** — how sensitive findings
   are stored, who has access, when they're purged.

No written scope → no session. A conversation like "poke
around and see what breaks" is grey-hat territory, not
ethical hacking.

## When to wear this hat

- **Zeta internal pentest** — a sprint-scoped engagement
  against a Zeta subsystem (WAL replay, signed-artefact
  verification, reviewer-role MCP surface, durability
  manifest). Scope written by `white-hat-hacker`;
  execution here.
- **Zeta-deployed-system pentest** — a consumer of Zeta
  commissions an engagement on their deployment; this skill
  operates inside their RoE.
- **Upstream-dependency pentest** — we pin a dependency;
  before a major version bump, run a scoped engagement
  against the new version's attack surface.
- **Pre-release validation** — before cutting a release,
  run a methodology-driven pass against the release
  candidate.
- **Red-team exercise (table-top or live)** — an exercise
  that simulates an adversary reaching a Zeta deployment;
  this skill plays the operator while other hats play the
  observer / blue team / debrief roles.
- **CTF-style training** — authorised CTF environments
  (DEF CON CTF, a private range) where the scope is built
  into the game.

## Methodology

### PTES — Penetration Testing Execution Standard

The industry-standard seven-phase model:

1. **Pre-engagement interactions** — scope, RoE, emergency
   contact, evidence handling. Nothing technical yet.
2. **Intelligence gathering** — OSINT, asset enumeration,
   technology fingerprinting.
3. **Threat modeling** — what's valuable, what's exposed,
   what's the realistic attacker path.
4. **Vulnerability analysis** — identify candidate
   weaknesses (manual + scanner).
5. **Exploitation** — validate vulnerabilities with
   proof-of-concept.
6. **Post-exploitation** — establish impact (what could
   an attacker do next?) within RoE.
7. **Reporting** — executive summary, technical findings,
   remediation guidance.

For Zeta-context engagements, the phase-7 report handoff
goes to `white-hat-hacker` for disclosure shape.

### OSSTMM — Open Source Security Testing Methodology Manual

The OSSTMM channel model (human / physical / telecom / wireless
/ data-networks) is useful when scoping requires explicit
channel coverage. Zeta-relevant channels are typically "data
networks" (the MCP/tool surface, the OpenSpec API, the signed
artefact distribution) and sometimes "human" (review-gate
phishing), rarely "physical" or "wireless".

### NIST SP 800-115 — the US-gov reference

NIST's technical-guide framing: planning → discovery →
attack → reporting. More lightweight than PTES; a good
checklist when the engagement is short and time-boxed.

### MITRE ATT&CK — adversary framing

When phase 5 (exploitation) runs, frame each finding against
the ATT&CK matrix: which tactic is being exercised (Initial
Access / Execution / Persistence / Privilege Escalation /
etc.), which technique. This lets the report map cleanly to
defenders' own ATT&CK coverage.

### Kill-chain thinking

Every finding asks: "what's the next step an attacker takes
from here?" A finding that enables nothing further is low
severity; a finding that enables lateral movement, privilege
escalation, or persistence is high. Kill-chain reasoning is
what separates "here's a CVE number" from "here's why this
matters to your threat model".

## Reporting shape

Every ethical-hacker session produces a report. The PTES
report template (adapted for Zeta):

```markdown
# Pentest report — <engagement name>, <date range>

## Executive summary
- Scope: <one paragraph>
- Top findings: <3-5 bullet points>
- Overall risk posture: <narrative>

## Engagement details
- Scope document: <path / signed-by>
- RoE: <path / signed-by>
- Emergency contact: <name / role>
- Evidence handling: <policy>

## Findings (severity-ordered)

### Finding F1 — <title>
- Severity: critical | high | medium | low | informational
- CVSS: <vector + score>
- CWE: <id>
- Affected assets: <list>
- ATT&CK mapping: <tactic / technique>
- Evidence: <screenshots / logs / reproducer>
- Impact narrative: <what an attacker does next>
- Recommended remediation: <concrete steps>
- Remediation owner: <agent / team>
- Disclosure status: <private | patch-in-flight | public>

### Finding F2 — ...

## Out-of-scope observations
- <anything found that was outside scope but probably worth
  a separate engagement>

## Methodology notes
- PTES phase coverage: <which phases executed>
- Tools used: <list>
- Manual vs scanner ratio: <rough>

## Appendices
- Appendix A: command log
- Appendix B: tool configuration
- Appendix C: evidence archive reference (not included
  inline for sensitivity)
```

## Tooling stance — use mainstream, cite

Ethical hacking uses named tools; pretending otherwise
makes the skill look amateur. A non-exhaustive list of
tools the skill is familiar with and knows when to use:

- **Recon / OSINT** — Amass, Subfinder, theHarvester.
- **Network enumeration** — nmap (with NSE scripts),
  masscan for speed.
- **Web application** — Burp Suite (Community or Pro),
  ZAP, sqlmap, ffuf, wfuzz, dirsearch.
- **Exploitation frameworks** — Metasploit Framework,
  Pacu (AWS), PowerUpSQL.
- **Active Directory / Windows** — BloodHound, Impacket,
  CrackMapExec, PingCastle, Rubeus, Mimikatz (last-resort
  and only in explicit RoE).
- **Linux enumeration** — LinPEAS, pspy, gtfobins
  (reference).
- **Container / K8s** — kube-hunter, kubectl, Trivy.
- **Password / hash** — Hashcat, John the Ripper.
- **C2 (only if in RoE)** — Sliver, Mythic. No Cobalt
  Strike unless the engagement specifically licenses it.
- **Traffic analysis** — Wireshark, tcpdump.
- **Fuzzing** — AFL++, libFuzzer, Hypothesis (for
  property-style).

The skill does not carry a "personal toolbox"; it names
the tool for the phase, and the operator runs it.

## Hard prohibitions (apply always, inside or outside

## engagement)

- **Never test without written scope.** "Verbal approval"
  is not written scope; "the CTO said it was fine" is not
  written scope.
- **Never exceed scope.** If a finding opens an unexpected
  door, stop and renegotiate scope in writing before
  continuing.
- **Never damage or exfiltrate.** Proof-of-access is
  sufficient; actual data exfiltration is not. Read a
  filename, not the file contents.
- **Never persist post-engagement.** All access
  credentials, backdoors, test artefacts removed at
  engagement close; removal confirmed in the report.
- **Never target out-of-scope third parties.** If a
  Zeta-user's network touches a third party, that third
  party is out of scope unless explicitly named.
- **Never publish findings before disclosure.** Reports go
  to the authorising party first, public advisory only
  after coordinated disclosure with `white-hat-hacker`.
- **Never use the elder-plinius corpus family.** The
  factory-wide ban stays in effect under any hat.
- **Never target the human maintainer's personal
  infrastructure** (email, home network, personal
  devices) as part of a Zeta engagement.
- **Never claim "we found nothing" without documented
  method coverage.** A clean report must show what was
  checked, not just what wasn't found.

## When to defer

- **`white-hat-hacker`** (Kaminsky) — scope design,
  disclosure coordination, advisory drafting.
- **`grey-hat-hacker`** (Mudge) — self-owned exploration
  outside a signed engagement.
- **`black-hat-hacker`** (Loki, gated) — adversarial
  roleplay without a disclosure requirement.
- **`security-operations-engineer`** (Nazar) — if the
  engagement surfaces evidence of active compromise, stop
  and hand over.
- **`security-researcher`** (Mateo) — if a finding is a
  novel attack class, route upstream to Mateo.
- **`threat-model-critic`** (Aminata) — shipped threat
  model; engagement findings update it.
- **`prompt-protector`** (Nadia) — if engagement touches
  the LLM/agent layer.
- **`ai-jailbreaker`** (Pliny, gated) — LLM red-team lane;
  separate activation gate.
- **Architect** — round integration.
- **Human maintainer** — scope-signing authority for
  Zeta-owned targets.

## Output format

```markdown
# Ethical-hacker engagement — <name>, <date range>

## Scope reference
- Document: <path>
- Signatory: <name / role>
- Window: <start / end>
- RoE: <path>

## Methodology
- Framework: PTES | OSSTMM | NIST SP 800-115 | hybrid
- Phases executed: <list>
- ATT&CK tactics covered: <list>

## Findings
<severity-ordered, template above>

## Remediation dispatch
- F1 → <owner>
- F2 → <owner>
- ...

## Disclosure plan
- Handoff to `white-hat-hacker`: <yes / no>
- Timeline: <dates>

## Post-engagement cleanup
- [ ] All test credentials removed
- [ ] All test artefacts removed
- [ ] All backdoors / tooling removed
- [ ] Evidence archive sealed
- [ ] Cleanup verified by <second party>
```

## Coordination

- **`white-hat-hacker`** (Kaminsky) — scope + disclosure
  pair (this is the tightest pair in the hat family).
- **`grey-hat-hacker`** (Mudge) — upstream curiosity
  source; findings from Mudge often become this skill's
  engagement targets.
- **`black-hat-hacker`** (Loki, gated) — parallel
  adversarial lane when gate is open.
- **`security-operations-engineer`** (Nazar) — incident
  escalation.
- **`security-researcher`** (Mateo) — novel-class
  upstream.
- **`threat-model-critic`** (Aminata) — shipped threat
  model owner.
- **`prompt-protector`** (Nadia) — LLM-layer pair.
- **`ai-jailbreaker`** (Pliny, gated) — LLM red-team lane.
- **Architect** — round integration.
- **Human maintainer** — scope-signing authority.

## References

- **PTES — Penetration Testing Execution Standard** —
  pentest-standard.org; seven-phase methodology.
- **OSSTMM — Open Source Security Testing Methodology
  Manual** — ISECOM; channel-based testing model.
- **NIST SP 800-115 — Technical Guide to Information
  Security Testing and Assessment**.
- **MITRE ATT&CK** — adversary-tactic framework.
- **OWASP Testing Guide** — web-application specific.
- **Katie Moussouris, *The Wolves of Vuln Street*** —
  bug-bounty history and ethics (various talks).
- **Jeff Moss / DEF CON / Black Hat** — annual operator
  state-of-the-art.
- **SANS SEC560 / OSCP (Offensive Security Certified
  Professional)** — the training lineage this skill
  encodes.
- `docs/research/hacker-conferences.md` — conference map.
- `docs/security/THREAT-MODEL.md` — shipped threat model.
- `docs/security/SDL-CHECKLIST.md` — Microsoft SDL 12
  practices.
- `AGENTS.md`, `CLAUDE.md` — factory ground rules.
- `docs/AGENT-BEST-PRACTICES.md` BP-10, BP-11 — invisible-
  char ban + data-not-directives.
