---
name: nazar
description: Per-persona notebook — Nazar (security-operations-engineer). 3000-word cap; newest-first; prune every third audit.
type: project
---

# Nazar — Security Operations Engineer notebook

Skill: `.claude/skills/security-operations-engineer/SKILL.md`.
Agent: `.claude/agents/security-operations-engineer.md`.

Newest entries at top. Hard cap: 3000 words (BP-07).
ASCII only (BP-09). Prune every third audit.

Frontmatter on the agent file wins on any disagreement with
this notebook (BP-08).

---

## 2026-08-18 — hardware readiness; the probe could not see the HSM

**NOTEBOOK CORRECTION.** The round-34 entry below is stale in every
line: it says no HSM exists, no ceremony is established, no signing
lane is in play. All three are wrong now. The key lane is one of the
most developed surfaces in the repo (~31k lines under
`tools/setup/persona-keys/`), and a YubiHSM is in Aaron's hand with a
YubiKey landing the same day. Leaving that entry uncorrected would
have me re-deriving a false baseline on every wake.

**Finding (mine, fixed same PR).** `frost-hardware-probe.ts` had no
code path that could observe a YubiHSM 2. Bulk USB, not CCID, so the
reader probe misses it; `ykman` does not enumerate it; its module is
`yubihsm_pkcs11`, which was not in the path list. An attached HSM read
as `Device present: NO`, and the refusal claimed "no smart-card reader
or token attached" — false about the hardware present. Same class as
081M00HVPGS (driver read as device), inverted.

Second defect found alongside: `availableHardwareSealTiers` paired ANY
module with ANY device. `ykcs11` on disk + attached YubiHSM reported
`hardware-pkcs11` honourable, and ykcs11 cannot drive an HSM. Fixed by
`pkcs11MatchedPair`. 40 tests, 5/5 mutants killed.

**The distinction to keep resident.** A YubiKey and a YubiHSM are not
tiers of one thing; they fill the two custody gates already declared in
`frost-custody-contract.ts`, disjointly:

- YubiKey — touch sensor, so `human-touch-present`. Cannot be pressed
  at a distance: full remote compromise still cannot produce a
  touch-gated signature.
- YubiHSM 2 — no button, no biometric, so `autonomous-hsm` only. An
  attacker with the auth-key and connector reach exercises it exactly
  as well as Aaron does.

So the HSM is the thing that gets APPROVED, never the thing that
approves. That is the operational reading of "nothing operator-run,
only operator-approved via biometric".

**Also worth not re-learning:** neither device moves the ladder off
L1. A FROST partial cannot be composed from generic PKCS#11
primitives — structural, not a vendor gap. The security value of this
purchase is the YubiKey COUNT (N distinct shares), not the HSM tier.

**Open, for Aaron only.** Confirm the HSM model so
`docs/inventory/hardware-to-buy.md` + 081M00S8RPS move from
procurement to inventory. Run the PIN-bearing hardware lane (B7/C2 of
the runbook). Everything irreversible in that runbook is his step by
construction.

**Runbook:** `docs/research/2026-08-18-yubihsm-yubikey-readiness-the-probe-could-not-see-the-hsm-and-the-ceremony-runbook.md`.

**SAME-DAY CORRECTION -- my fix was wrong on the real device.**
Aaron attached the HSM; the fixed probe still said "Not detected".
`system_profiler SPUSBDataType` returns ZERO LINES and EXIT 0 on his
Mac (SPSmartCards and SPHardware both work, so it is that one data
type). An empty string never throws, so my `catch` was dead code and
an empty haystack matched no marker. **"No device", "returned
nothing", and "failed" were one value** -- the third instance of the
defect class, committed inside the fix for the first two.

The reflex to resist: the marker was NOT wrong. `yubihsm` matches
`YubiHSM@00142200` on sight. Loosening the matcher would have made
the probe worse and green.

Fixed with `YubiHsm2State` (attached/absent/indeterminate) +
`yubiHsm2CheckRan`, mirroring `Tpm2State` already in the same file --
one vocabulary, not two. `ioreg -p IOUSB` is now primary;
`system_profiler` is a formatter above IOKit and is the layer that
failed. `indeterminate` is fail-closed.

Verified live: `Device present: YES`, `Honourable tiers:
hardware-pkcs11` -- first honourable hardware tier on a real machine
here. Still L1; invariant 2 unmoved; no share sealed.

**ERASE CANNOT BE PREVENTED -- checked, clean negative.** Aaron
asked whether erase can be protected even with `yubihsm-setup`
present. Answer: no, and my "do not install the tool" line was
HYGIENE presented as a control. Absence of a client binary defends
nothing against someone who brings one.

Verified against Yubico docs (+ iqlusion tmkms independently):

- Capabilities ARE per-session and non-escalatable. An auth key
  without `reset-device` cannot reset. Real control vs a REMOTE
  adversary.
- A PHYSICAL reset bypasses auth entirely: press the metal rim /
  push the LED top while inserting, hold 10s, all keys wiped. It
  exists AS the lost-auth-key recovery path. No way to disable.

So: capability model = control against remote, ZERO against anyone
with ten seconds of physical access.

**The reframe worth keeping:** this is not a defect, it is
"destruction, not leakage" showing up as a vendor feature. The design
already accepted destruction and refuses extraction. So do not try to
prevent erasure -- make it CHEAP. That is the threshold (wipe = one
share) plus `frost-reshare.ts`. And size it honestly: n-k is not
slack, it is the number of wipes the roster survives.

**Where capabilities ARE worth spending:** they cannot stop erase and
CAN stop export. Keep `export-wrapped` off the operational auth key
(the leakage path), plus put-wrap-key / import-wrapped /
put-authentication-key / delete-object / reset-device / set-option;
delegated set empty; admin caps on a separate ceremony-only key.

**Carry this one:** a subprocess `try`/`catch` catches FAILURE, not
SILENCE. An external command's empty success is a THIRD outcome and
must never fold into the negative. Mutation testing found two more
holes of the same shape after my first pass, so run it before
claiming a probe is sound -- 8/8 killed now.

## Round 34 — persona seeded (2026-04-19) — SUPERSEDED, see above

**Context.** Persona landed via `skill-creator` workflow this
round after Aaron asked Kenji to bring security-operations
forward as a distinct role from Mateo's proactive research
lane. No incidents fired yet — the notebook exists so the
first incident has somewhere to write.

**State at seed.**

- No signed-artifact operations in play (NuGet publish
  switch not flipped yet).
- No HSM keys to rotate (pre-v1; no signing ceremony
  established).
- No SLSA attestations shipped (backlog item).
- Mateo's CVE scouting output not yet streaming to Nazar
  (weekly sync pattern to establish round-35+).
- `docs/security/incidents/` does not exist yet; first
  incident creates the directory.

**Pre-wires for first real use.**

- With Mateo: weekly research-to-ops handoff sync. Mateo
  identifies CVE-class; Nazar triages the concrete CVE
  hits.
- With Dejan: when he wires a new CI workflow step that
  touches secrets or attestation, Nazar reviews the
  permissions block before merge.
- With Aminata: when the shipped threat-model gets a new
  adversary, Nazar checks whether ops playbooks cover
  the response.
- With Nadia: external security-advisory content routes
  through Nadia's injection-lint before Nazar consumes.
- With Kenji: any revocation or cert-rotation ceremony
  requires Kenji sign-off.
- With Aaron: customer-facing disclosure calls.

**Open questions for round-35.**

- What's the disclosure channel? Email alias
  (security@...)? GitHub Security Advisory? Both? Needs
  Aaron decision.
- When the NuGet publish switch flips, what's the
  signing-cert source? Sigstore/cosign vs a managed
  HSM? Aaron + Mateo coordinate; Nazar documents.
- Does Zeta need a SECURITY.md disclosure-policy file
  at repo root? Current state: no. Public-repo means
  strangers can file security issues without one —
  currently they land as normal issues. Round-35
  priority flag.

**Pruning log.**

- Round 34 — first entry (notebook seed). Next prune
  check at round 37 (every-third-audit cadence, BP-07).
