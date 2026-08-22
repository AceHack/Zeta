# Zeta v1.0 Security Goals — Realistic Floor

Round 32 anchor. The round-30 threat-model elevation set the
ceiling (nation-state + supply-chain adversary tiers T0-T3).
This document sets the **floor** — what Zeta commits to shipping
at v1.0, what explicitly waits for post-v1, and the rule for
deciding.

Aaron, 2026-04-18: *"we don't need hardware side-channel level
compliance in v1.0 or we will never release. Let's try to target
realistic security goals for a 0.x release, soon to be 1.0
release."* Authoritative.

## Decision rule

A control is **v1.0-required** if *all three* hold:

1. **Adversary is plausible at the Zeta consumer's threat level.**
   v1.0 consumers are F# / .NET library users embedding DBSP in
   their own pipelines. Their attacker is typically a generic
   supply-chain compromise (npm-style dep poisoning, tag-rewrite,
   maintainer-account takeover) or a curious lateral attacker
   inside the same organisation. Not Mossad.

2. **Absence is a quiet failure.** If Zeta ships without the
   control and an attacker exploits the gap, the consumer cannot
   easily tell they were hit. Examples: installer hijack, silent
   dep-poisoning. Loud failures (license-key tamper, cert error)
   are lower priority because they don't deceive.

3. **Cost is bounded.** Control takes < one round of focused work
   to ship, OR it's a ratchet (e.g., "no new un-SHA-pinned
   actions" prevents regression without retroactive labour).

A control that fails any of (1)-(3) lands in
`docs/security/SECURITY-BACKLOG.md` with a reason.

## v1.0 required (the floor)

### Supply chain

- **Third-party GitHub Actions pinned by full 40-char SHA.**
  Enforced by Semgrep rule 15 in the `lint` gate job. Blocks
  tj-actions tag-rewrite class.
- **NuGet transitive-dep lockdown via `packages.lock.json`.**
  Blocks the Time-Bomb-Package vector (a package publishes a
  malicious patch version between two `dotnet restore`s).
  Deferred to round 33 (Track B item 1) — currently on DEBT.
- **Workflow-level `permissions: contents: read` + no job
  elevation.** In place.
- **No secrets referenced in workflows.** In place; becomes
  meaningful the moment we add one.
- **Three-way-parity install script.** Dev laptop, CI runner,
  devcontainer all bootstrap via `tools/setup/install.sh`.
  Round-32 parity-swap lands the CI leg; devcontainer third
  leg remains on DEBT.

### SAST + linting

- **Semgrep-in-CI as a hard gate.** 14+ custom rules running
  with `--error`. Round 30 landing. Blocks rule-codified
  antipatterns from ever merging.
- **CodeQL on C# + F# sources.** Weekly scheduled scan minimum;
  PR-time scan if cost allows. Round 33 Track B item 5.

### Incident response

- **Disclosure policy** at `SECURITY.md`. In place.
- **Incident playbooks** at `docs/security/INCIDENT-PLAYBOOK.md`.
  Round 30 landing; covers 6 scenarios (third-party GHA
  compromise, installer hijack, NuGet poisoning, maintainer-
  account compromise, skill safety-clause regression, escalation).

### Governance

- **Branch protection required-check on `main`** once `gate.yml`
  has one week of consistent green runs. Prevents unreviewed
  PRs from landing even under the maintainer's own push.
  Round-30 proposal; trigger gates on green cadence.
- **Threat-model re-audit every round** on any security-doc
  touch. Round-30 landing (§0 of THREAT-MODEL.md).
- **Reviewer floor** (`harsh-critic` + `maintainability-reviewer`)
  mandatory on every code-landing round per GOVERNANCE §20.

## Post-v1 / explicitly out of v1.0 scope

### Hardware + side-channel

- **Power-analysis / EM / acoustic side-channel resistance.** Not
  a plausible adversary against a library consumed inside the
  host process. Revisit if Zeta ever ships a co-processor or
  becomes a cryptographic primitive boundary.
- **Constant-time implementations.** Same reasoning. Also pre-v1
  Zeta has no crypto surface to constant-time.
- **Trusted-execution-environment integration (SGX / SEV / TDX).**
  Out of scope for the DBSP algebra layer. Consumers who need
  this wrap Zeta in their own TEE.

### Nation-state bespoke malware

- **Untargeted defence against Mossad-class adversaries.** By
  definition out of scope per Mickens' observation. An attacker
  willing to spend seven figures to compromise a library consumer
  will compromise the consumer, not the library.
- **Supply-chain defence at the compiler / OS / firmware layer.**
  Trusting the .NET SDK, ubuntu-22.04 runner image, and macos-14
  runner image is a boundary we accept. SLSA Build L4 is a
  post-v1 goal.

### Cryptographic hardening

- **HSM-backed signing keys for releases.** Post-v1; software keys
  acceptable for 0.x.
- **Reproducible builds.** Desirable; Lean and F# compilers both
  need work upstream. Tracked as a v2-or-beyond goal.

### Process / compliance

- **Penetration testing / Red-team engagement.** Post-v1. Pre-v1
  the threat model + reviewer floor + incident playbook are the
  surface area worth exercising.
- **ISO 27001 / SOC 2 / FedRAMP equivalent.** Enterprise consumers
  who need these certify at their deployment layer. Zeta provides
  the evidence trail (`docs/security/THREAT-MODEL.md`,
  `INCIDENT-PLAYBOOK.md`, `SDL-CHECKLIST.md`) but does not carry
  the audit cost itself.
- **Dynamic analysis (DAST) / runtime fuzzing.** No runtime
  surface pre-v1. SDL checklist #10 already marks this deferred.

## The ratchet

Every round that ships code asks: does this change introduce a
new control obligation, or does it satisfy an existing one?

- **New obligation** (e.g., we add a network surface, or a
  secret-handling step): updated THREAT-MODEL.md + a concrete
  control before the code lands.
- **Satisfies existing** (e.g., we land `packages.lock.json` that
  this doc already names): update SDL-CHECKLIST.md status cell
  from 🔜 → ✅ and delete the DEBT entry.

No round ever *weakens* a v1.0-required control silently. A
downgrade is a design-doc event with Aaron sign-off, same
ceremony as a rule-weakening lint change.

## What "v1.0" means for this document

Publishable NuGet package under `Zeta.*` prefix at version 1.0.0,
with a documented public API surface reviewed by Ilyana
(public-api-designer) and the controls above in place. The v0.x
series is the ratchet-climb toward that state. Post-v1 releases
can add more; they cannot remove.

## Reference

- `docs/security/THREAT-MODEL.md` — adversary tiers + control
  matrix
- `docs/security/SDL-CHECKLIST.md` — Microsoft SDL compliance
  cells + honest downgrades
- `docs/security/INCIDENT-PLAYBOOK.md` — 6 response playbooks
- `docs/security/SECURITY-BACKLOG.md` — post-v1 controls with
  reasons
- `docs/security/THREAT-MODEL-SPACE-OPERA.md` — teaching variant
- `GOVERNANCE.md` §20, §24 — reviewer-floor + three-way-parity
  rules
