---
id: 081KSE6WT0008QG0R003FG3E8R
priority: P2
status: open
title: AI auto-submit-back telemetry + fixes from in-the-wild installs — adoption-cost-to-zero flywheel
effort: L
ask: aaron 2026-05-25
created: 2026-05-25
last_updated: 2026-05-25
depends_on:
  - 081KSGS9H0008QG0R002T3BJ2R
  - 081KSE6WT0008QG0R003G0Y62D
composes_with:
  - 081KSE6WT0008QG0R003WW3YJQ
  - 081KSE6WT0008QG0R003612WGJ
  - 081KSE6WT0008QG0R001NG9JZH
  - 081KSE6WT0008QG0R000CV98PV
  - 081KSE6WT0008QG0R00021PPX1
  - 081KSE6WT0008QG0R003WG0V6P
  - 081KSE6WT0008QG0R0015ZF2G6
tags: [cluster, telemetry, ai-native, network-effects, adoption, consent, distributed]
---

## Problem

Aaron 2026-05-25 (mid-iteration-2 wait, observing the iteration-1
→ iteration-2 cycle): *"thank how easy it will be for someone to
clone and use this project once we get it right adoption scales
to 0 the more machines we test it on and have the AI auto submite
back updates on every new hardward it runs into out there in the
wild."*

Today's iteration loop:

1. Aaron tests v1 ISO on his cluster node
2. Real-hardware failure surfaces (`clear` + `nmtui` not found —
   systemd PATH bug, invisible until real-hardware boot)
3. Otto codes fix → PR → CI rebuilds ISO → Aaron retests
4. Iteration 2 either succeeds OR surfaces the next layer

This loop is **bandwidth-bounded** by Aaron's time + my drive-time.
It scales linearly with hardware-variant count. It does NOT scale
to other operators trying Zeta on their hardware.

## Target

The same iteration loop, but **distributed** across every Zeta
instance running in the wild:

1. Operator on novel hardware boots Zeta installer
2. **If install succeeds** → operator's instance auto-submits a
   "works-on-this-hardware" telemetry envelope (hardware specs +
   install-success metadata + duration + role chosen) so the
   reference catalog grows
3. **If install fails** → operator's instance auto-collects
   diagnostic substrate (hardware specs, dmesg, install logs,
   which step failed, which fallback fired, full transcript) and
   auto-submits a PR with proposed fix (LLM-generated from the
   diagnostic context + the existing zeta-first-boot.sh +
   zeta-install.sh + nixos modules)
4. **Maintainers review** → merge if the fix is correct;
   reject + add to known-failure-modes if not; auto-merge if the
   fix matches an existing pattern (e.g., "another bare command
   not found → add to systemd PATH" pattern matches 081KSGS9H0008QG0R002T3BJ2R
   iter-2 fix shape exactly)
5. **Next operator on similar hardware** auto-applies the fix
   via fresh ISO download

Result: adoption cost approaches 0 asymptotically as the
in-the-wild fleet grows. Each new operator pays a one-time
"novel hardware" cost (maybe); every subsequent operator on
similar hardware pays 0. **Network-effect substrate.**

## Acceptance

- [ ] Telemetry consent: opt-in at install-time via a 'press t
      to enable telemetry' keystroke in the role-prompt window
      (per 081KSE6WT0008QG0R003WW3YJQ 'I execute, you fingerprint' consent pattern);
      default OFF for privacy-first home labs; documented clearly
- [ ] Success-telemetry envelope: minimal payload (hardware specs
      from `lshw -short` + `lspci` + `dmidecode -t system`,
      install duration, role chosen, NVMe/SSD/HDD count, OS
      version, network type ethernet/wifi); NO operator
      identification, NO IP address, NO hostname
- [ ] Failure-diagnostic envelope: success-envelope content +
      full transcript of zeta-first-boot.sh + zeta-install.sh +
      relevant journalctl logs + which exact step failed +
      which fallback path fired (if any)
- [ ] Submission path: HTTPS POST to a public telemetry endpoint
      (could be GitHub Issues API, a custom collector, or both);
      authenticated via per-install ephemeral token issued at
      ISO build time
- [ ] LLM-PR-generation pipeline: failure envelopes auto-trigger
      an LLM (Claude or peer) that analyzes the diagnostic +
      proposes a minimal-diff PR; PRs filed under
      `bot/auto-telemetry-fix-<envelope-hash>` branches with
      full envelope linked in PR body
- [ ] Auto-merge gating: pattern-match the proposed fix against
      known-good fix patterns (e.g., "systemd Environment PATH
      additions" or "additional package in installer
      systemPackages"); if match + lint + build green, auto-merge
- [ ] Known-failure-mode catalog: every novel failure pattern
      gets a backlog row capturing the symptom + fix + minimum
      reproduce shape; catalog grows over time + serves as
      training data for the LLM-PR-generation pipeline
- [ ] Privacy + security floor: telemetry envelopes are
      reviewable by operator BEFORE submission (peek-and-edit
      window); ephemeral submission token can't be reused; all
      submitted data published openly (per Zeta substrate-
      transparency); known-failure catalog is public
- [ ] Documentation: README explicitly names this as the
      adoption-scaling mechanism + competitive moat (no
      proprietary cluster product has this because the
      telemetry would be proprietary)

## Bandwidth-engineering framing

This is the **bandwidth-engineering principle applied at
adoption-scale** (per `.claude/rules/bandwidth-served-falsifier.md`):

- **Each failure** = one operator's bandwidth burned to surface
  a hardware variant
- **Without auto-submit-back**: every operator on similar
  hardware re-pays that bandwidth
- **With auto-submit-back**: ONE operator pays; every
  subsequent operator on similar hardware pays 0

The ratio of operators-saved-per-operator-failure-burden compounds
over the in-the-wild fleet. At N=10 operators, savings = 10x. At
N=1000, savings = 1000x. At N=10,000+, the adoption cost is
effectively 0 for new operators on common hardware.

## ARC-AGI parallel composition (081KSE6WT0008QG0R0015ZF2G6)

The in-the-wild fleet generates the **training data** for the
ARC-AGI-style competition substrate:

- Each install's success-envelope = one positive training example
- Each install's failure-diagnostic-envelope + the LLM-proposed
  fix + the human verdict (merge/reject) = one reinforcement
  signal
- The known-failure-mode catalog = curated benchmark scenarios
  for AI systems to compete on
- AI systems competing to operate the cluster-install reference
  faster/better get to consume the catalog + telemetry as
  training input

The flywheel feeds itself: more operators → more telemetry →
better AI fix-generation → faster install for next operator →
more operators.

## Composes with

- 081KSE6WT0008QG0R003WW3YJQ — "I execute, you fingerprint" consent pattern (the
  telemetry opt-in keystroke is at install-time; the operator
  consents per install, not blanket)
- 081KSGS9H0008QG0R002T3BJ2R — zero-typing first-boot (the substrate the telemetry
  agent runs inside)
- 081KSE6WT0008QG0R003612WGJ — role taxonomy (telemetry covers all role variants)
- 081KSE6WT0008QG0R001NG9JZH — HA control-plane (telemetry covers 1/3/5/7 node
  shapes)
- 081KSE6WT0008QG0R000CV98PV — cluster auto-discovery (telemetry can capture which
  auto-discovery scenarios fire)
- 081KSE6WT0008QG0R00021PPX1 — USB-persistent OS (telemetry covers diskless +
  internal-disk-present + USB-resident-OS shapes)
- 081KSE6WT0008QG0R003G0Y62D — first-time-CLI-user persona (the adoption-scaling
  payoff lives in this persona's success metric)
- 081KSE6WT0008QG0R003WG0V6P — USB-as-repair-tool (telemetry capture extends to
  rebuild-from-USB flow)
- 081KSE6WT0008QG0R0015ZF2G6 — ARC-AGI reference architecture (the training data
  source + the benchmark catalog generator)
- `.claude/rules/glass-halo-bidirectional.md` — transparency:
  all telemetry data published openly
- `.claude/rules/non-coercion-invariant.md` — HC-8 floor:
  operator can refuse telemetry at any time; refusal is the
  default
- `.claude/rules/algo-wink-failure-mode.md` — the failure
  pattern this prevents: treating coincidence ('this fix
  worked for one operator') as authorization to auto-merge
  without pattern-match validation

## Privacy + security considerations

- **Privacy-first**: telemetry opt-in default OFF; operator
  must affirmatively enable per-install
- **Transparency**: every submitted envelope reviewable by
  operator before submission (peek-and-edit); all collected
  data published openly in the public Zeta repo
- **No identification**: hardware specs only; no operator name,
  email, IP, hostname, MAC address, install location
- **Ephemeral tokens**: submission auth is single-use; can't
  be replayed
- **Reject-by-default for malicious submissions**: LLM-PR-
  generation pipeline pattern-matches proposed fixes against
  known-good patterns; unmatched fixes go to human review,
  not auto-merge
- **Adversarial telemetry handling**: bad-actor operator could
  submit poisoned diagnostics trying to inject malicious
  fixes; LLM pipeline + pattern-match catalog must be robust
  to this (composes with 081KRW63S0008QG0R003TX8MG5 Knights Guild ratification
  for novel-pattern PRs)

## Out of scope

- Real-time cluster ops telemetry (Prometheus / etc.) — that's
  a separate concern; this row is install-time-only
- Pay-for-telemetry / commercial telemetry product — would
  contradict the open-substrate framing
- Centralized telemetry hosting requiring infrastructure
  operator — should be possible via GitHub Issues API + public
  PR submission only; no servers to run
- AI-vs-AI auto-merging without any human review — the
  Knights Guild (081KRW63S0008QG0R003TX8MG5) ratification path keeps humans in the
  loop for novel patterns; only well-matched patterns auto-merge

## Origin

Aaron 2026-05-25, observing the iteration-1 → iteration-2 cycle
in real-time, naming the adoption-cost-to-zero flywheel that the
network-effect substrate would deliver if extended with auto-
submit-back telemetry from in-the-wild installs.
