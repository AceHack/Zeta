# Zeta Security Backlog (post-v1.0)

Controls that do not make the v1.0 floor but are tracked as
post-v1 goals. Partner document to
`docs/security/V1-SECURITY-GOALS.md`.

Rule for landing on this list: the control fails at least one of
the three v1.0 gates (plausible adversary, quiet failure, bounded
cost) but is still worth shipping eventually.

## Format

```markdown
### <control>
- **Why deferred:** which v1.0 gate it fails + reasoning
- **Trigger to revisit:** the event / milestone that changes the
  calculus
- **Rough cost estimate:** S / M / L / XL
- **Priority:** P1 (start-of-v2) / P2 (when consumer demands) /
  P3 (speculative)
```

## Deferred controls

### Hardware side-channel resistance (power / EM / acoustic)

- **Why deferred:** adversary not plausible against a library
  consumed in-process. Cost XL (implementation + verification +
  constant-time-discipline across the algebra layer).
- **Trigger to revisit:** Zeta ships a co-processor or becomes a
  cryptographic primitive boundary.
- **Rough cost estimate:** XL
- **Priority:** P3

### Constant-time implementations

- **Why deferred:** no crypto surface in v1.0 to make constant-
  time. Pre-v1 the operator algebra is value-correctness-first.
- **Trigger to revisit:** addition of signing / auth / crypto
  primitive to the Zeta surface.
- **Rough cost estimate:** M per primitive
- **Priority:** P2

### TEE integration (SGX / SEV / TDX)

- **Why deferred:** wrong layer. Consumers who need TEE wrap
  Zeta in their own enclave.
- **Trigger to revisit:** a named consumer requires in-enclave
  Zeta execution and is willing to co-fund the work.
- **Rough cost estimate:** L
- **Priority:** P3

### SLSA Build L3 / L4 (reproducible builds + signed provenance)

- **Why deferred:** L1 reachable this quarter, L2 mid-term, L3
  needs upstream work on F# and Lean compilers (neither are
  reproducible today). L4 adds two-person-integrity which
  doesn't fit a one-maintainer project.
- **Trigger to revisit:** F# / Lean compilers reach reproducible-
  build parity, or a consumer requires SLSA L3 attestation.
- **Rough cost estimate:** L (per level)
- **Priority:** P1 for L2; P2 for L3; P3 for L4

### HSM-backed signing for releases

- **Why deferred:** v1.0 uses software signing keys (NuGet API
  key stored in a maintainer-held secret manager). Plausible
  adversary is a NuGet account compromise (key rotates cheaply);
  HSM protects a narrower threat.
- **Trigger to revisit:** Zeta reaches a consumer scale where key
  rotation is disruptive, or a consumer contractually requires
  HSM attestation.
- **Rough cost estimate:** M (YubiKey-based signing fits most
  needs); L (corporate HSM).
- **Priority:** P2

### Penetration testing / Red-team engagement

- **Why deferred:** pre-v1 the threat model + reviewer floor +
  playbooks are the worked surface. Paying for an external
  pen-test before the rule surface is stable wastes both sides'
  effort.
- **Trigger to revisit:** v1.0 release commit, OR a consumer
  required by their audit to prove third-party pen-test.
- **Rough cost estimate:** L (typical external engagement)
- **Priority:** P1 at v1.0 release

### Dynamic analysis (DAST) / runtime fuzzing

- **Why deferred:** no runtime surface pre-v1 (Zeta is in-process
  library). SDL checklist #10 already marks DAST deferred with
  this reasoning.
- **Trigger to revisit:** addition of a network surface or a
  user-parseable input format.
- **Rough cost estimate:** M (AFL / libFuzzer harness per input
  format)
- **Priority:** P1 the moment we add a network surface

### Reproducible builds

- **Why deferred:** F# compiler embeds timestamps + path
  dependencies; Lean has similar issues. Upstream work needed
  before Zeta can even try.
- **Trigger to revisit:** F# compiler ships reproducible-build
  mode.
- **Rough cost estimate:** L (once upstream lands) → S (once
  tooling exists)
- **Priority:** P1 once upstream is ready

### Formal compliance certifications (ISO 27001 / SOC 2 / FedRAMP)

- **Why deferred:** enterprise consumers certify at their
  deployment layer; Zeta provides the evidence trail but does
  not carry the audit cost.
- **Trigger to revisit:** named enterprise consumer willing to
  co-fund the certification.
- **Rough cost estimate:** XL
- **Priority:** P3

### `mise trust` CI hardening (allow-list / diff-vs-main / review-gate)

- **Why deferred:** meaningful only after branch-protection-on-
  main lands (PRs reviewed before merge). Until then, the
  existing `mise trust` ceremony is what it is.
- **Trigger to revisit:** branch-protection-on-main lands.
- **Rough cost estimate:** S
- **Priority:** P1 (immediate follow-up after branch protection)

### Verifier-jar SHA-256 pinning with reproducible verification

- **Why deferred:** round-30 TOFU gradient step. Manifest
  currently carries `<path> <url>`; v1.0 wants `<path> <url>
  <sha256>` and `verifiers.sh` computing + verifying. Currently
  DEBT for round 33.
- **Trigger to revisit:** round 33 Track B item 2 (already
  scheduled).
- **Rough cost estimate:** S
- **Priority:** P1

### Safety-clause-diff lint on `.claude/skills/**/SKILL.md`

- **Why deferred:** XZ-class long-game defence. Semgrep generic-
  mode regex insufficient; needs a bespoke diff-level tool.
  Currently DEBT for round 33.
- **Trigger to revisit:** round 33 Track B item 3.
- **Rough cost estimate:** M
- **Priority:** P1

<!-- Non-security engineering / factory items that previously
     lived here have been moved to docs/BACKLOG.md in round 33
     per the Aaron-raised scoping rule: SECURITY-BACKLOG holds
     security-control items only; general engineering backlog
     lives in docs/BACKLOG.md. Items moved:
     - Devcontainer / Codespaces image
     - documentation-agent cadence
     - Post-install repo automation (runtime choice research)
     - static-analysis-gap-finder skill
     - Crank lint configurations to HIGH
     - openspec-gap-finder skill
     - Declarative-manifest setup
     - Windows CI matrix
     See GOVERNANCE §29 for the scope rule. -->

### Signed-commit requirement on `main`

- **Why deferred:** Aaron round-30: bus-factor exception, 2FA
  only for now, education-over-time on signing keys.
- **Trigger to revisit:** Aaron decides to adopt hardware key +
  signed commits (standing open decision).
- **Rough cost estimate:** S (enable + CI check)
- **Priority:** P1 (maintainer-call timing)

### Prefix reservation on `nuget.org` for `Zeta.*`

- **Why deferred:** request is outstanding to nuget.org but
  depends on their response cadence. Not in Zeta's control.
- **Trigger to revisit:** first NuGet publish.
- **Rough cost estimate:** S (one email + follow-up)
- **Priority:** P1

## Graduation

When a backlog item moves to shipped, delete the entry here and
update the corresponding ✅ cell in `SDL-CHECKLIST.md`. The
backlog shrinks over time; that's the success signal.
