---
id: 081KT07NV0008QG0R0016XR9J1
priority: P2
status: open
title: "Ace slice 3.1 — pave the strict-by-default road (lower signature friction)"
created: 2026-06-01
last_updated: 2026-06-01
parent: 081KR2E4K0008QG0R002YE3MMD
depends_on: [081KR2E4K0008QG0R002YE3MMD]
classification: buildable-now
decomposition: atomic
owners: [developer-experience-engineer, security-researcher]
type: feature
---

# 081KT07NV0008QG0R0016XR9J1 — Ace slice 3.1: pave the strict-by-default road

Follow-on to Ace slice 3 (Ed25519 authenticity; signed-enforced install gate,
`--allow-no-signature` opt-out). Operator-authorized deferred follow-on
(the operator 2026-06-01): *"you can push it through it can be a later follow on …
it's better to build strict first in my mind and back off later cause of friction
instead of the other way around."*

## Decision context — the default is CONFIRMED strict; this row is the paving

The operator reopened the cost-benefit on the default enforcement posture
(strict-by-default + `--allow-no-signature` switch vs loose-default + opt-in `--strict`).
Ran it by the team + web research; **all lenses converged on KEEP strict-by-default**:

- **Security (security-researcher):** "Pick A. Do not change the default." Loose-default
  on an untrusted distribution surface = unauthenticated write-then-install (the exact
  attack); fail-closed is correct; the empty-bundled-trust bootstrap *strengthens* the
  argument (the first experience sets the mental model). Loose-default flagged Important
  (teaches the wrong reflex), not a shipped P0 (bundled trust is empty today).
- **DX (developer-experience-engineer):** strict is the correct posture; the risk is
  *friction*, not the default — a strict path that's too painful makes `--allow-no-signature`
  the reflexive de-facto mode (strictness becomes theater). Verdict: keep strict, **pave
  the road**.
- **Web research (search-first):** secure-defaults UX — users stick with defaults;
  "disabling a security feature should require justification" (opt-out > opt-in);
  BUT "when security is difficult/noisy, people bypass the controls" (paved-road) —
  so reduce the friction of strict, don't abandon it.
  Sources: [NCSC Secure by Default](https://www.ncsc.gov.uk/information/secure-default),
  [ReversingLabs secure-by-default](https://www.reversinglabs.com/blog/secure-by-default-a-painless-way-to-harden-your-appsec),
  [Semgrep — security as path of least resistance](https://semgrep.dev/blog/2026/security-should-be-the-path-of-least-resistance/).

The default stays strict (shipped in the slice-3 build PR). This row tracks the
"make strict the easy path" work so the escape hatch doesn't become the norm.

## Acceptance criteria (paving items, ranked by leverage)

1. **Golden-path refusal messages** — the unsigned-install refusal should name the
   remediation FIRST (`ace trust add <pub>` / where to get the publisher `.pub`),
   not lead with `--allow-no-signature`. (Slice 3 already enriched the *untrusted-key*
   refusal + trust-list-empty hint; extend the same to the *unsigned* refusal +
   make the `--allow-no-signature` WARNING nudge toward `ace trust add`.)
2. **Root-key custody ceremony (the big one)** — bundled `tools/ace/trusted-keys.json`
   ships empty, so out-of-box every install needs `trust add`/`--allow-no-signature`.
   Until the real Zeta root key is provisioned (per the
   [agent-native key-custody design](../../research/2026-05-31-agent-native-key-custody-design-otto-holds-key-aaron-cant-access-wont-lose-threshold-attestation-honest-debug-dump-limit.md)),
   strict-default is theater for Zeta-store packages. This is the highest-impact
   paving step — once a real key is in the bundled anchor, the typical signed
   install just works. (Operator custody ceremony — gated on the operator.)
3. **`ace trust add` ergonomics** — a convenience path (e.g. `--from-url`) so trusting
   a well-known publisher key is one command, not a key-retrieval-and-pipe dance.
4. **`ace sign` CI ergonomics** — signing a package in a CI pipeline should be a single
   obvious command, so publishers sign by default rather than skip.
5. **`--allow-no-signature` telemetry** — a counter in the store log of `--allow-no-signature`
   installs, as a signal if the escape hatch is becoming the de-facto default
   (the degradation-without-policy-change risk both reviewers named).
6. **Quickstart** — a two-command golden path in `CONTRIBUTING.md`/SKILL so a dev
   doesn't have to read the design doc to learn the trust→install flow.

## Out of scope (further-out)

Key rotation/revocation/expiry; order-independent `content_hash`; guardian-AI
oversight; minisign/sigstore interop (all per slice-3 design §10). Also the open
operator resolved 2026-06-01: the install opt-out flag was RENAMED from `--allow-unsigned` to `--allow-no-signature` (clearer that it only covers genuinely-unsigned, never a present signature). The slice-3 cluster shipped the rename across code + tests + docs, not just a help-text gloss.

## Composes with

- 081KR2E4K0008QG0R002YE3MMD (Ace CLI parent) · slice 3 build (Ed25519 authenticity) · the slice-3 design
  `docs/agendas/ace-package-manager/2026-06-01-ace-cli-slice3-authenticity-signature-verify-design.md`
  §6 (gate) + §8 (threat model) + §10 (follow-ons).
- `.claude/rules/automated-tests-are-the-shield-assert-dont-skip.md` (the false-green
  discipline that frames "strict path must be paved, not just present").
