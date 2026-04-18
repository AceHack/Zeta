# Zeta.Core Microsoft SDL Compliance Checklist

Pre-v1 greenfield; applies the SDL to the subset that makes sense
for an embedded F# library with no network surface yet.

| # | SDL practice | In scope? | Status | Artifact |
|---|---|---|---|---|
| 1 | Provide security training | yes | 🔜 | reviewer skills require STRIDE + EoP study — Adam Shostack's EoP card game (upstream only, not vendored) |
| 2 | Define security requirements | yes | ✅ | `docs/security/THREAT-MODEL.md` §Adversary model + trust boundaries |
| 3 | Define metrics & compliance reporting | partial | 🔜 | bug bar to add in this file (below) |
| 4 | Perform threat modeling | yes | ✅ | `docs/security/THREAT-MODEL.md` STRIDE × components matrix |
| 5 | Establish design requirements | yes | ✅ | `docs/ROADMAP.md` + `AGENTS.md` greenfield policy |
| 6 | Define cryptography standards | yes | 🔜 | `docs/security/CRYPTO.md` (CRC32C vs SHA-256 rationale) — P1 |
| 7 | Manage third-party component risk | yes | ✅ | `tools/audit-packages.sh` + `.claude/skills/package-auditor/SKILL.md` |
| 8 | Use approved tools | yes | ✅ | `.semgrep.yml` + G-Research + Ionide + Meziantou analyzers |
| 9 | Static Analysis (SAST) | yes | ✅ | Semgrep 12 rules + analyzers; CodeQL config P1 |
| 10 | Dynamic Analysis (DAST) | **defer** | N/A | no runtime surface pre-v1 — revisit when multi-node ships |
| 11 | Penetration testing | **defer** | N/A | post-v1 |
| 12 | Incident response plan | partial | ✅ | `SECURITY.md` disclosure policy at repo root |

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

- ✅ = shipped + evidenced by a file/test
- 🔜 = next-round P1 with concrete artifact target
- 🔮 = post-v1
- ⏭️ = explicitly declined with reason
