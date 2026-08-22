# Zeta.Core Microsoft SDL Compliance Checklist

Pre-v1 greenfield; applies the SDL to the subset that makes sense
for an embedded F# library with no network surface yet.

| # | SDL practice | In scope? | Status | Artifact |
|---|---|---|---|---|
| 1 | Provide security training | yes | 🔜 | reviewer skills require STRIDE + EoP study — Adam Shostack's EoP card game (upstream only, not vendored) |
| 2 | Define security requirements | yes | ✅ | `docs/security/THREAT-MODEL.md` §Adversary model + trust boundaries + tier model (T0-T3) |
| 3 | Define metrics & compliance reporting | partial | 🔜 | bug bar to add in this file (below) |
| 4 | Perform threat modeling | yes | ✅ | `docs/security/THREAT-MODEL.md` STRIDE × components matrix + supply-chain expansion (round 30) |
| 5 | Establish design requirements | yes | ✅ | `docs/ROADMAP.md` + `AGENTS.md` greenfield policy + GOVERNANCE.md §23-§27 |
| 6 | Define cryptography standards | yes | 🔜 | `docs/security/CRYPTO.md` (CRC32C vs SHA-256 rationale) — P1. **Round-30 decision:** no crypto surface today, so deferred; revisit when HMAC / signed-checkpoint lands |
| 7 | Manage third-party component risk | yes | 🔜 | **Downgraded from ✅ (round 30 honest check):** `tools/audit-packages.sh` + `package-auditor` skill are manual, not CI-gated. `packages.lock.json` NOT YET adopted; transitive MSBuild `.targets` not allowlisted. Round-31 deliverables |
| 8 | Use approved tools | partial | 🔜 | **Downgraded from ✅ (round 30 honest check):** analyzers run in build (G-Research + Ionide + Meziantou), but Semgrep ran nowhere before round 30. Round 30 lands Semgrep-in-CI as a hard gate. **Now true** under nation-state bar once the gate ships on main |
| 9 | Static Analysis (SAST) | yes | 🔜 | **Downgraded from ✅ (round 30 honest check):** 14 Semgrep rules existed but no CI job ran them (pre-round-30). Round 30 lands `.github/workflows/gate.yml` `lint` job. CodeQL workflow still P1 (backlogged). Upgrade to ✅ once the lint job has one week of clean runs on `main`. |
| 10 | Dynamic Analysis (DAST) | **defer** | N/A | no runtime surface pre-v1 — revisit when multi-node ships |
| 11 | Penetration testing | **defer** | N/A | post-v1 |
| 12 | Incident response plan | yes | ✅ | `SECURITY.md` disclosure policy + `docs/security/INCIDENT-PLAYBOOK.md` (round-30 new) — 6 playbooks cover third-party-action compromise, toolchain installer hijack, NuGet dep poisoning, maintainer-account compromise, skill safety-clause regression, unknown/escalate |

## Bug bar (SDL practice 3)

For each reported security defect, assign severity:

- **Critical** — remote unauth exploit / arbitrary code execution /
  data-integrity break that a consumer would observe. Fix-within:
  **7 days**, no ship until fixed.
- **High** — local-only exploit / DoS / integrity break with adversary
  already inside the trust boundary. Fix-within: **30 days**.
- **Medium** — requires extreme conditions (full root + specific
  timing) or leaks non-PII metadata. Fix-within: **next release**.
- **Low** — info-disclosure of already-public data, cosmetic. Fix
  on backlog, no deadline.

Greenfield caveat: we have no CVE process yet. Pre-v1, "ship" means
"merge to `main`"; post-v1, it means NuGet release.

## SDL tools on macOS

- **Threat Modeling Tool (TMT)** — Windows-only. Mac users run in
  Parallels (optional); exports live in `docs/security/tmt-exports/`.
- **pytm** — primary threat-model-as-code tool (P1 to adopt). Markdown
  diffable, Graphviz DFD, STRIDE built-in.
- **OWASP Threat Dragon** — backup for visual DFDs.
- **Semgrep** — in this repo (`.semgrep.yml`); runs on laptop + CI.
- **CodeQL** — `.github/workflows/codeql.yml` P1.
- **Stryker.NET** — mutation testing; config in `stryker-config.json`.

## Compliance tracker

- ✅ = shipped + evidenced by a file/test **and enforced by CI
  or governance** (round-30 tightening: a lint rule without a
  CI gate is not a control; see `docs/security/THREAT-MODEL.md`
  §Long-game defences). For policy-based controls (incident
  response, review cadence), governance-enforcement counts.
  Technical controls require CI-enforcement.
- 🔜 = next-round P1 with concrete artifact target
- 🔮 = post-v1
- ⏭️ = explicitly declined with reason

## Round-30 honest-downgrade summary

Three cells downgraded ✅ → 🔜 in this round, on the basis of
the round-30 elevation audit: a control claimed in the
checklist must be enforced by a CI job or governance rule, not
merely present as a codified rule. Downgrades:

- **#7 third-party component risk** — `package-auditor` is
  manual, not CI-gated; `packages.lock.json` missing; MSBuild
  `.targets` surface not allowlisted. Round-31 closes these.
- **#8 approved tools** — Semgrep's 14 rules didn't run in CI.
  Round 30 lands `.github/workflows/gate.yml` `lint` job. Will
  be re-upgraded to ✅ when the gate is green on `main` for
  one week.
- **#9 SAST** — same root cause as #8; same promotion path.
  CodeQL workflow remains 🔜.

One cell upgraded 🔜 (partial) → ✅:

- **#12 incident response plan** — round-30 ships
  `docs/security/INCIDENT-PLAYBOOK.md` with 6 playbooks.
  Pairs with `SECURITY.md` disclosure policy.
