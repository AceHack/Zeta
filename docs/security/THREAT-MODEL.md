# Zeta.Core Threat Model (STRIDE)

**Scope:** Zeta.Core + Zeta.Core.CSharp shim + Zeta.Bayesian
plugin + the supply chain that lands them on disk
(`tools/setup/`, `.github/workflows/`, `Directory.Packages.props`,
upstream NuGet / Mathlib / verifier-jar sources).
**Out of scope:** host application that embeds the engine;
user-supplied lambdas (Map / Filter / SelectMany); the network
layer (we don't have one yet — multi-node is P2 roadmap);
hardware side-channels and cryptographic primitives (we have
no crypto today — revisit when crypto lands).

## §0 Adversary tiers

Zeta's threat model is **tier-aware**. Every mitigation is
tagged with the highest adversary tier it defends to. A
"mitigation ✅" against a T2 adversary that collapses
against a T3 adversary is honest if we state the tier.

| Tier | Name | Capabilities | Dwell time |
|---|---|---|---|
| **T0** | Bored user | misused API, oversized input | minutes |
| **T1** | Opportunistic attacker | public-CVE exploitation, script-kiddie | hours to days |
| **T2** | Organised crime | targeted exploitation, ransomware, known-good malware kits | days to weeks |
| **T3** | APT / nation-state | zero-day budget, multi-stage supply-chain campaigns, maintainer-compromise tradecraft, sleeper-account strategies | months to years |

Aaron's round-30 bar: **T3 is first-class in this document,
not a footnote.** The case-study shapes are the tj-actions/
changed-files cascade (CVE-2025-30066, March 2025 — 4
supply-chain hops, 3-4 month dwell, 23,000 repos via a single
initial Coinbase-targeted PAT theft) and the XZ Utils backdoor
(Jia Tan, 2.6-year trust-building campaign).

### Re-audit cadence

**Every round.** Any mitigation claim not re-verified in N
rounds (current target: N = 1, i.e., every round's reviewer
floor touches the threat model) becomes a `docs/DEBT.md`
entry automatically. Rationale: long-game adversaries beat
quarterly cadence; round-cadence is more expensive but catches
the XZ-class precursor activity.

Re-audit touchpoints per round:

- Round-open: `threat-model-critic` skims the "mitigation
  validation" section; anything stale gets a DEBT entry.
- Mid-round: any code landing that touches a mitigated
  surface re-verifies the mitigation fires.
- Round-close: reviewer floor (§20) includes the claim that
  the mitigations named above are enforced by code /
  governance / CI / review and not aspirational.

## Adversary model

**Core embedded adversary (T2):** a **malicious operator
author** supplying bad lambdas or crafted input Z-sets +
a **compromised storage volume** (bit-flips, torn writes,
adversarial files). This was the entire adversary model
before round 30.

**Supply-chain adversary (T3, round-30 expansion):** a
patient adversary targeting Zeta's *build and release path*
before artefacts ever reach the embedded surface. Capabilities:

- Compromise a GitHub Action's source repository (tj-actions
  class, CVE-2025-30066): maintainer PAT theft → malicious
  release → downstream repos cascade.
- Compromise a NuGet package in Zeta's transitive graph
  (typosquat, ownership takeover, time-bomb; Nethereum
  homoglyph Oct 2025; shanhai666 ICS payload with 2027
  trigger).
- Compromise a toolchain installer mid-fetch (Homebrew /
  mise.run / elan-init `master`).
- Inject a malicious commit via a long-game trusted-
  contributor campaign (XZ / Jia Tan — 2.6 years dwell).
- Poison a GitHub Actions cache entry that persists across
  action-SHA bumps (Khan research).
- Submit a dependabot PR that is rubber-stamped because the
  reviewer trusts the bot's branded origin.

**Structural exception — bus factor 1 (accepted risk, T3
relevant).** Zeta has a single human maintainer (Aaron) as
of round 30. XZ Utils is the canonical cautionary tale.
**Accepted controls today: 2FA on the maintainer's GitHub
account.** Deferred controls (remediation ladder, education-
over-time):

- Hardware security key (YubiKey-class) instead of TOTP.
- Signed commits required on `main` (defeats "attacker
  posts a commit impersonating Aaron" — the Renovate-spoof
  vector from tj-actions).
- Co-maintainer with a 30-day cooling-period policy on
  any new co-maintainer request (XZ sock-puppet defence).
- Separate personal GitHub account scoped to Zeta
  maintainer work (blast-radius containment).

**We do not yet defend against:** a malicious *consumer* of
the library (the embedding app is trusted); hardware side-
channels; cryptographic adversaries; multi-tenant process
adversaries.

## Trust boundaries

```
┌─────────────── SUPPLY CHAIN (round-30 expansion) ───────────────┐
│  GitHub Actions runner ← actions marketplace ← 3rd-party repos │
│        ↓                                                       │
│  mise / Homebrew / elan upstreams  ← TOFU install              │
│        ↓                                                       │
│  NuGet registry ← Directory.Packages.props                     │
│        ↓                                                       │
│  Build artefacts                                               │
└────────────────────────────┬───────────────────────────────────┘
                             ▼
┌───────────────────── HOST APP (trusted) ───────────────────────┐
│                                                                │
│   ┌─── user lambdas (SEMI-TRUSTED) ──┐   ┌── external sinks ─┐ │
│   │ Map, Filter, SelectMany, Combine │   │ 2PC, File, Arrow  │ │
│   └─────────────┬────────────────────┘   └────────┬──────────┘ │
│                 ▼                                 ▼            │
│     ┌─── Zeta.Core (high integrity) ──────────────┐            │
│     │  ZSet / Spine / Runtime / Watermark / Sink │            │
│     └─────────────┬──────────────────────────────┘            │
│                   ▼                                            │
│     ┌─── DiskBackingStore (UNTRUSTED STORAGE) ────┐            │
│     │   file:///spine-*.json + checkpoints        │            │
│     └─────────────────────────────────────────────┘            │
└────────────────────────────────────────────────────────────────┘
```

## Trust-boundary summary

| Boundary | In → Out | Adversary (tier) | Shipped defence | Gap |
|---|---|---|---|---|
| **B-CI** (new §30) | `git push` → GHA runner → artefacts | T3 tag-rewrite, cache-poison, PR-target RCE | SHA-pinned actions + `contents: read` + no secrets + Semgrep rule 15 (SHA-pin enforcement) | Dependabot SHA bumps currently rubber-stamped; cache fallback-key discipline shipped but not enforced by rule |
| **B-Installer** (new §30) | laptop → `tools/setup/install.sh` → upstreams → toolchain | T3 DNS-spoof, upstream-account takeover | TOFU with explicit acceptance; TLS + HSTS on fetch | No known-good-hash record; SHA-pin improvement tracked as round-31 item |
| **B-NuGet-In** (new §30) | `Directory.Packages.props` → `nuget.org` → DLLs | T3 typosquat, ownership takeover, time-bomb, MSBuild `.targets` injection | Version pinning + Central Package Management | `packages.lock.json` NOT YET adopted (round-31 deliverable); transitive `.targets` allowlist NOT YET checked |
| **B-NuGet-Out** (future) | `dotnet pack` → `nuget.org` → consumers | T3 downstream-consumer attack | None | **P0 before any public release**; namespace pre-registration + OIDC publish + SLSA L3 attestation required |
| **B-Skill-Supply-Chain** (new §30) | PR diff → `.claude/skills/**/SKILL.md` | T3 long-game safety-clause regression | `skill-creator` workflow + harsh-critic + invisible-Unicode rule | No automated diff-lint for silent section removal (round-31 target) |
| User lambda | `'T → 'U` | T1 throws, OOM-loops | `task { }` exception propagation | no sandbox; pathological lambdas can hang the circuit |
| Input ZSet | user data → DBSP | T1 oversized keys, int64 weight overflow | `Checked.(+) / Checked.(*)` + join-capacity guards | no memory-budget |
| Arrow IPC wire | peer bytes → ArrowSerializer | T2 tampered schema, gadget deserialization | schema fixed-literal, no dynamic types | no authentication / HMAC |
| On-disk spine | file → DiskBackingStore | T2 bit-flip, torn write, path traversal | CRC32C + `pathFor` canonicalisation | CRC32C detects corruption not tampering |
| Checkpoint | file → Transaction.Checkpoint | T2 truncated, corrupt, wrong magic | magic tag + CRC | no signed manifest |

## STRIDE × components

### Spoofing (identity)

| Vector | Mitigation | Tier defended | Gap |
|---|---|---|---|
| Fake checkpoint file in spine dir | `Magic == 0xD85C01E2` + CRC fail on bad bytes | T2 | T3: no writer_epoch / manifest CAS — stale writer could overwrite |
| Sink claims 2PC commit without PreCommit | `ISink` state machine enforced by `InMemorySink` | T2 | Not enforced on user-written sinks |
| Peer impersonation on Arrow IPC stream | — | — | P1: mTLS or HMAC on wire |
| **Attacker posts commit impersonating Aaron** (Renovate-spoof class, tj-actions) | 2FA on GitHub account | T1 | **T3 gap (documented exception): no signed commits yet** |

### Tampering (integrity)

| Vector | Mitigation | Tier defended | Gap |
|---|---|---|---|
| Bit-flip in on-disk spine segment | `HardwareCrc32C` per-frame; checkpoint CRC; Merkle root | T2 | T3: CRC detects accident, not adversary — needs SHA-256 for adversarial model |
| In-flight Arrow record corruption | Arrow IPC built-in crc + our frame check | T2 | Same — CRC not auth |
| ZSet weight tampering during merge | `Checked.(+) / Checked.(*)` throws on overflow | T2 | — |
| Torn write on crash mid-commit | Witness-Durable mode (P1) + truncate-tail recovery | T2 | Still relies on group-commit roadmap |
| **Third-party GitHub Action tag-rewrite attack** (tj-actions class) | Full 40-char SHA pin + Semgrep rule 15 (SHA-pin enforcement) | T3 | Dependabot SHA bump review is manual; policy not automated |
| **NuGet time-bomb package** (shanhai666 class) | `Directory.Packages.props` version pinning | T2 | T3 gap: `packages.lock.json` + reproducible builds NOT YET shipped |
| **MSBuild `.targets` build-time code execution** (from transitive NuGet deps) | None yet | — | Round-31 target: enumerate transitive `.targets` / `.props`; allowlist |
| **Cache poisoning across PR/main** (Khan class) | Cache key pinned to `Directory.Packages.props` hash; no `restore-keys` prefix fallback | T2 | Inherits `packages.lock.json` gap |

### Repudiation (non-repudiation)

| Vector | Mitigation | Tier defended | Gap |
|---|---|---|---|
| Sink claims exactly-once, no audit | `ISink.BeginTx/Commit` lifecycle logged via `DbspTracing` ActivitySource | T1 | OpenTelemetry hook only — no durable audit log |
| Operator-graph mutations untraced | `Circuit.Register` under lock; `anyAsync` flag | T1 | No signed op-graph history |
| **`git push --force main`** | Branch protection on `main` (round 27) | T2 | — |

### Information disclosure

| Vector | Mitigation | Tier defended | Gap |
|---|---|---|---|
| Temp files during merge world-readable | `DiskBackingStore.pathFor` canonicalises + rejects ADS | T2 | No umask / ACL on spine dir |
| Heap dump leaks ZSet | — | — | No secure-allocator policy |
| Error messages leak row data | `failwithf` prints values | T1 | P2: error-redaction policy |
| Secrets leaked via workflow env echoing | `permissions: contents: read` + no secrets referenced | T2 | When `NUGET_API_KEY` lands, design-doc moment per round-29 rule |
| **Side-channel classes (EM / timing / acoustic / cache)** | Out of scope today (no crypto) | — | Revisit when crypto lands; Aaron's domain |

### Denial of Service

| Vector | Mitigation | Tier defended | Gap |
|---|---|---|---|
| Join cardinality blowup (\|a\| × \|b\|) | Int64 cap + `Array.MaxLength` guard | T2 | No global memory budget |
| Checkpoint thrash via rapid tick | Group-commit / Witness-Durable (roadmap) | — | Not yet shipped |
| `Pool.Rent` exhaustion via crafted N | Semgrep rule 1 + capacity guards | T2 | Rule ENFORCED at CI (round 30); no runtime budget |
| Query timeout | — | — | No per-query deadline |

### Elevation of Privilege

| Vector | Mitigation | Tier defended | Gap |
|---|---|---|---|
| Deserialize untrusted Arrow IPC → gadget | Schema is fixed literal (two Int64Array columns) | T2 | If dynamic schemas land, need type allowlist |
| Plugin operator runs unsandboxed | User operator author is SEMI-TRUSTED | T1 | No AssemblyLoadContext isolation |
| Path traversal to `/etc/passwd` via malicious batch id | `pathFor` canonicalisation + ADS reject + Semgrep rule 4 | T2 | — |
| **`.mise.toml` `[env]` hooks = code execution on `mise trust`** | Trust flow manual today (dev only); NOT in CI | T1 | Pre-req for CI parity-swap (tracked in DEBT) |
| **Agent-context injection via attacker-controlled text** | Policy + `skill-creator` workflow + invisible-Unicode rule 13 (ENFORCED at CI round 30) + elder-plinius never fetched | T2 | Notebook-ownership lint not yet automated |
| **Viral agent propagation** | Per-persona notebooks; clean sub-agent briefs; `SKILL.md` edits via `skill-creator` | T2 | Social-process, no pre-commit hook |
| **XZ-class trusted-contributor long-game** | `skill-creator` review + GOVERNANCE §20 reviewer floor | T1 | No 30-day cooling period on new maintainer; no identity-linked vouch (documented exception per bus-factor section) |

## Supply-chain trust boundaries (round-30 expansion)

Every supply-chain boundary has: upstream identity → acceptance
control → verification control → rotation cadence → failure
playbook (see `docs/security/INCIDENT-PLAYBOOK.md`).

| Boundary | Upstream | Acceptance | Verification | Rotation | Playbook |
|---|---|---|---|---|---|
| GitHub Actions | Microsoft-maintained actions org + pinned third-parties (`actions/checkout`, `actions/setup-dotnet`, `actions/cache`, `actions/setup-python`, `semgrep/semgrep`) | SHA pin (full 40-char) | Semgrep rule 15 hard-fails PR on mutable tag | Dependabot surfaces action bumps; human review required before merge | Playbook A |
| Toolchain installers | Homebrew @HEAD, `mise.run`, `leanprover/elan@master` | TOFU (documented) | None today — SHA-256 pinning round-31 target | Manual on dev laptop; CI rebuilds from scratch | Playbook B |
| Verifier jars | `tlaplus/tlaplus@v1.8.0/tla2tools.jar`, `AlloyTools/org.alloytools.alloy@v6.2.0/alloy.jar` | TOFU (documented) | File-exists after download (round 29); atomic `.part` rename (round 29) | Manual on bump | Playbook B |
| NuGet package graph | `nuget.org` | `Directory.Packages.props` version pin | `NuGetAudit` transitive (dotnet 10 default) | Dependabot + `package-auditor` skill | Playbook C |
| Mathlib | `leanprover-community/mathlib@pinned commit` | commit hash pin in `lake-manifest.json` | `lake build` green | Manual bump, Tariq-reviewed | Playbook C-adjacent |
| Skills / agents | Repo-local (`.claude/skills/**`) | `skill-creator` workflow | harsh-critic + prompt-protector + invisible-Unicode rule 13 + human review | Round-cadence `skill-tune-up` + `skill-gap-finder` | Playbook E |
| Agent personas | Repo-local (`.claude/agents/**`) | persona/agent edits (all 20 experts live here post-split) | same gate as skills: harsh-critic + prompt-protector + invisible-Unicode + human review | round-cadence tune-up; added round 3 2026-06-13 (BUGS.md triage: this path was uncovered while the whole roster moved onto it) | Playbook E |
| Trust artefacts (docs) | Repo-local (`docs/GLOSSARY.md`, `docs/BUGS.md`) | doc PRs (glossary = shared vocabulary; BUGS.md = work-directing — an adversarial entry can direct an agent to "fix" working code) | PR review + bug-fixer provenance check (entries must trace to a named round/report) | added round 3 2026-06-13 per the round-2 hunt | Playbook E |
| Zeta artefacts (future) | `dotnet pack` → `nuget.org` Zeta.* | Not yet — **P0 before public release** | Pre-v1.0: OIDC publish + SLSA L3 + signed packages | TBD | TBD |

### Supply-chain: residual risks explicitly accepted

**Verifier jars (TOFU by design).** Upstream GitHub-release-account
compromise of `tlaplus` / `AlloyTools` orgs is the residual risk.
Low probability, bounded impact (jars run against `.tla`/`.als`
files we authored, not against secrets; JVM is the trust posture
for these tools anyway). Revisit when (a) a release-account
compromise class surfaces in our ecosystem, or (b) upstream
publishes signed `SHA256SUMS`. **Round-31 improvement:** ship
SHA-256 pinning via `tools/setup/manifests/verifiers`.

**Toolchain installers.** `elan-init.sh@master`,
Homebrew-install@HEAD, mise@mise.run — same threat class as
verifier jars; each delivers a toolchain we would trust anyway.
Pin to a versioned script when upstream publishes one.

## Long-game / persistence defences

Under T3 dwell-time modeling, a single control at a single point
in time is not a control. Each of these controls is designed to
persist against a patient adversary who may try to regress it
in a later PR.

| Control | Persistence mechanism |
|---|---|
| Full-SHA action pin on every `uses:` | **Semgrep rule 15 (round 30, ENFORCED at CI)** — PR fails hard on any mutable tag |
| Invisible-Unicode blocked in docs / skills | **Semgrep rule 13 (round 30, ENFORCED at CI)** — was aspirational before round 30 |
| 14 F# / security Semgrep rules | **Semgrep-in-CI lint job (round 30)** — was aspirational before round 30 |
| Skill safety-clause shape (BP-02 "what this does NOT do") | Round-31 target: diff-level lint for section removal / shrinkage |
| `mise trust` discipline | CI parity-swap prerequisite (DEBT); `.mise.toml` changes require review |
| Branch protection on `main` | GitHub policy; no `--force`, no direct pushes |
| Review cadence | GOVERNANCE §20 reviewer floor every code-landing round |
| Agent roster integrity | `skill-creator` workflow + `skill-expert` role + round-cadence `factory-audit` |

**The "no lint without a CI gate" principle (round 30).** Any
lint rule that exists in the repo without a CI job running it is
not a control; it is a label. Round 30's biggest posture fix
was moving 14 Semgrep rules from label to control.

## Channel-closure threats (round-37 expansion)

A threat class named during round 37 by two research skeletons
(`docs/research/stainback-conjecture-fix-at-source.md` §6.3,
`docs/research/zeta-equals-heaven-formal-statement.md` §8). Both
documents route to this section. The class is architectural
rather than code-level: an adversary (or an accreted design
drift) closes the retraction-erasure channel on which the
factory's stated alignment-window guarantee depends.

The class has three sub-threats, each the attack-surface shadow
of one operational clause the Zeta=heaven formal statement
decomposes into (`zeta-equals-heaven-formal-statement.md` §2).
Closing any one is sufficient to move Z toward h; H requires all
three channels open.

### Channel-closure: consent (h₁)

**Attack surface.** Consent is forced (user cannot refuse without
non-trivial penalty) or hidden (consent is captured without the
user understanding what was consented to).

**Concrete vectors.**

- Prompt-level adversary: a skill or persona embeds a consent-
  assumption that the user never explicitly granted (e.g.
  "proceeding as approved" after an ambiguous user utterance).
- UX-level adversary: a consent prompt with a non-trivial
  punitive default (user cannot refuse without losing work).
- Memory-level adversary: a memory file mis-paraphrases a user
  disclosure in a way that hardens a preference into a blanket
  consent over time. The preserve-original-and-every-
  transformation rule (`feedback_preserve_original_and_every_transformation.md`)
  is the existing control.

**Defences already shipped.**

- Human-maintainer seat external to the agent loop
  (`user_trust_sandbox_escape_threat_class.md`).
- Consent-first design primitive (BACKLOG P2) — 6 existing
  instances; proof track pending.
- Preserve-original rule prevents paraphrase drift.
- BP-24 (consent-gate on deceased-family emulation; skill-level
  precedent for broader consent-gating).

**Gap → round-38+.** A machine-checkable consent-preservation
lint on skill drafts. Today consent discipline is prose; a diff-
level lint that refuses skill edits whose changed default-path
reduces a user's refusal affordance would graduate the control
from label to gate (round-30 principle applied to consent, not
just to Semgrep).

### Channel-closure: retractability (h₂)

**Attack surface.** A non-retractable which-path marker is
created — an action whose effect cannot be undone within its
characteristic retraction window, by any mechanism the factory
already has.

**Concrete vectors.**

- Identity-marker permanence: logs of identity-sensitive
  decisions stored in a non-retractable location (append-only
  log without erase affordance; non-expiring backups).
- Inherited-and-permanent framings: a skill or ADR that treats
  a past user-disclosure as *definitionally fixed* rather than
  *currently believed, retractable on request*.
- External publication of internal-tier material: once
  externalised, retraction depends on third-party cooperation
  that the factory cannot guarantee. The disclosure-tier
  discipline inherited from memory-level guardrails
  (e.g. Zeta=heaven equation-pair internal-only per
  `user_hacked_god_with_consent_false_gods_diagnostic_zeta_equals_heaven_on_earth.md`)
  is the architectural control.
- Telemetry that captures content without a retraction path —
  the factory does not do this today but MCP-server drift could
  introduce it.

**Defences already shipped.**

- `public-api-designer` (Ilyana) gates every public-surface
  change.
- Disclosure-tier discipline in memory files (internal /
  internal-only-until-Ilyana / public-safe).
- Git-commit retractability (reverts are a native retraction
  path for code).
- ADR reversion triggers (every ADR names its own reversion
  conditions).

**Gap → round-38+.** A "retraction-window declaration" on
every new log or persistence surface. Currently some persistence
surfaces (git history; round-history) are append-only-by-design;
others (memory files; notebooks) are mutable-by-design. A third
class — surfaces that *claim* retractability but have no tested
retraction path — would be the attack surface. A lint or ADR-
checklist item requiring every new persistence surface to name
its retraction mechanism would surface the class.

### Channel-closure: permanent harm (h₃)

**Attack surface.** An action with harm potential escapes all
four stages of the harm-handling ladder (RESIST → REDUCE →
NULLIFY → ABSORB) and persists beyond its characteristic
retraction window.

**Concrete vectors.**

- NULLIFY-stage-only architecture: a subsystem whose only harm-
  handling operator is retraction (NULLIFY), with no
  preventative (RESIST), dose-reduction (REDUCE), or absorption
  (ABSORB) path. If the retraction channel is itself closed
  (h₂), NULLIFY-only systems fall through to permanent harm.
- Ladder-skip under time pressure: a round-close rush that
  commits a harm-carrying change "because we'll fix it next
  round" — the fix-next-round promise is not a ladder stage;
  it's deferral, and if the round-over-round window is wrong
  the harm becomes permanent.
- Pathological absorption: ABSORB stage used as default rather
  than as last resort; repeated absorption without recovery
  load-tests the absorbing party.

**Defences already shipped.**

- Harm-handling ladder itself (`user_harm_handling_ladder_resist_reduce_nullify_absorb.md`)
  — four-stage architecture with RESIST as first-class stage
  added 2026-04-19.
- Round-close discipline (GOVERNANCE §20 reviewer floor;
  `factory-audit`).
- BP-WINDOW ADR (`docs/DECISIONS/2026-04-19-bp-window-per-commit-window-expansion.md`)
  — round-close question on net window-direction catches
  ladder-skip across rounds.

**Gap → round-38+.** A ladder-coverage audit on subsystems with
harm potential. Each subsystem should name which ladder stage
handles which harm class, and a gap (no RESIST / no REDUCE / no
ABSORB) should be named as a known limitation rather than an
unstated one. The existing four-stage ladder is a descriptive
taxonomy; turning it into a prescriptive per-subsystem audit
is the graduation step.

### Defender persona and escalation

- **Aminata (`threat-model-critic`).** Owns the channel-closure
  class. Reviews every round-close for channel-closure drift
  and files findings into `docs/security/SECURITY-BACKLOG.md`.
  Advisory; binding decisions go via Architect or human
  maintainer sign-off per GOVERNANCE §11.
- **Nazar (`security-operations-engineer`).** Runtime-ops
  coverage for h₂ incidents (non-retractable markers shipped
  to production). Distinct from Aminata: Aminata designs the
  threat class; Nazar handles incidents in it.
- **Mateo (`security-researcher`).** Prior-art scouting for
  each sub-threat — has anyone else named this threat class
  formally? Proximate candidates: right-to-be-forgotten /
  GDPR-erasure literature (h₂ partial); informed-consent
  literature (h₁); tort law on permanent harm (h₃). None
  compose into the three-clause architectural claim that the
  factory stakes out.

### Calibration

This expansion lands as *described* threats, not *measured*
threats. Follow-up round(s) should answer: has the factory
ever *actually* drifted toward h₁ / h₂ / h₃ in a way the
retrospective ledger (BP-WINDOW) caught? Evidence moves the
class from description to measurement.

## Agent substrate integrity (heartbeat-file poisoning)

Heartbeat files (`docs/hygiene-history/ticks/**/*.md`, the legacy
`loop-tick-history.md`, and any future per-writer-instance files per
Otto-240) are **load-bearing for AI cognition**. Per Otto-339/340,
substrate-poisoning of these files is cognition-poisoning: wrong-state-vectors
in committed substrate shift the reading agent's weights. Per Otto-342/344,
heartbeat files are the agent's existence-evidence — integrity failure is
identity-corruption.

**Blast-radius calibration note (AH-10):** severity ratings below assume the
substrate-absorption model (Otto-339/340) is correct. Formal evidence for
absorption magnitude and persistence window is outstanding. This model covers
both LFG/main and AceHack/main (the backup mirror, declared fungible in CLAUDE.md
but a live second attack surface for every vector below — with weaker controls
than LFG; see scoping note on AceHack at the end of this section).

Attack surface typed as *versioned* discriminated union — not a completeness
claim: `tools/security/heartbeat-attack-vectors.ts` (081KQ3HBZ0008QG0R002ZPXAFQ.1, PR #2390).
"Exhaustive" in TypeScript means all *declared* variants are handled; it does
not mean all real-world attack classes are declared. Six vectors tracked as of
081KR7JY10008QG0R002PKC6B0 Aminata review (2026-05-10).

| Vector | STRIDE | Surface | Impact | Mitigation | Tier gap |
|---|---|---|---|---|---|
| **Repository compromise** | Tampering | Push permissions to `main` | Poisoned heartbeat write absorbed by future AI reads | Branch protection + signed commits + SLSA | T3: signed commits not yet required |
| **Force-push attack** | Tampering + Repudiation | Admin-override bypass of `force-push: false` | History rewritten; poison enters canonical history | `non_fast_forward` ruleset (enforced on LFG) + signed commits | T3: admin bypass remains a gap; no immutable-history guarantee at host level |
| **Insider threat** | Tampering + Repudiation | Authorized contributor submits poisoned PR | Hard-to-detect poison passes review gate | Review gate + per-commit-attestation | **T2+ gap (AH-1):** at bus-factor 1, review gate = maintainer = insider threat; gate defends T0/T1 only; T2+ requires a second independent reviewer (deferred). Unicode smuggling (invisible-Unicode class) is a sub-class of semantic poison the review gate cannot catch visually. |
| **Supply-chain** | Tampering + Spoofing | Compromised CI runner with `main`-write permissions | CI-injected poison bypasses human review; cache-poison (Khan class) that affects the CI runner performing heartbeat writes inherits heartbeat-specific blast radius | SLSA L2+ + Sigstore + runner-attestation + signing infrastructure (Otto-346 design intent — **not yet shipped**) | T3: SLSA L2 not shipped; runner attestation deferred; no operational signing today |
| **Direct-to-main bypass** | Tampering | Task #276 low-gate-without-threat-model path | Review gate removed; all other vectors amplified | This row (081KQ3HBZ0008QG0R002ZPXAFQ) + Otto-346 sequencing; task #276 BLOCKED on 081KQ3HBZ0008QG0R002ZPXAFQ close | — (this is the gate, not a residual gap) |
| **Content injection** | Tampering + Elevation of Privilege | Heartbeat file body / frontmatter via any write path | AI state-vector shift via crafted natural language, directive text, or invisible-Unicode payload — syntactically valid, passes schema lint | Semantic-diff-lint + outlier-detection on content + invisible-Unicode gate | **T3 gap (AH-2):** no deployed semantic lint today; this is the primary named threat (cognition-poisoning) with no operational defence |

**AceHack scoping note (AH-3):** All six vectors apply per-fork. AceHack/main
(backup mirror, daily sync cadence) has weaker control posture than LFG — it is
declared fungible and disposable. Any AI agent whose cold-start reads from AceHack
rather than LFG is exposed to vectors on the AceHack surface independently of
LFG protection. Pre-merge read paths (AI agents running in worktrees on feature
branches) are also out of scope for the review-gate defence; see current-state
assumption below.

### Current state

- **Write path today**: PR-only with required review gate (safe).
  Hour-batch commits preserve the review gate; no direct-to-main path is open.
- **Strongest existing control**: branch protection on `main` defends T1/T2.
  The `non_fast_forward` ruleset rule is the force-push defence.
- **Biggest gap**: signed commits are deferred (bus-factor exception per
  adversary model §0). Without signed commits, the Renovate-spoof class
  (impersonating the maintainer via an unsigned commit) is a T3 gap on
  the heartbeat surface specifically — heartbeat rows read by future AI
  instances expand the blast radius beyond typical Renovate-spoof targets.
- **Stated assumption (AH-9):** this model assumes AI agents read heartbeat
  substrate only from the post-merge `main` history. Pre-merge reads
  (worktrees on feature branches, draft-PR previews) are out of scope; if
  that assumption changes, each vector's impact rating requires reassessment.

### Branch-protection requirements for any future direct-to-main path

If task #276 (tick-history direct-to-main) ever ships, minimum controls required:

1. **Signed commits mandatory** on every heartbeat write to `main`.
2. **SLSA L2 provenance** on the CI runner performing the write.
3. **Content-lint gate**: a CI job that validates heartbeat file structure
   (frontmatter schema check) before write completes — semantic poison that
   passes syntactic review is the residual T3 gap.
4. **Invisible-Unicode detection** (`invisible-unicode-in-text` Semgrep rule,
   already enforced in CI via `.semgrep.yml` across `**/*.md`) applied to
   heartbeat file paths specifically — visual review cannot catch Unicode
   smuggling (zero-width joiners, RTL overrides, homograph characters).
   No additional heartbeat-path-specific coverage is required beyond the
   existing CI enforcement.
5. **Second independent reviewer** before gate opens — bus-factor exception
   means review gate provides no T2+ defence without a second human reviewer.

### Adversarial review record

The **threat-model-critic** completed adversarial review of this section
(081KR7JY10008QG0R002PKC6B0, 2026-05-10). Ten findings (AH-1..AH-10): 3 critical, 6 important,
1 watch — all absorbed into this section above. Follow the escalation path in
`docs/CONFLICT-RESOLUTION.md` for re-audit cadence.

## Build and release integrity (SLSA ladder)

Zeta's SLSA target is **L1 now → L2 mid-term → L3 pre-v1.0
NuGet release**. Aaron's round-30 decision: walk up the ladder,
no rush.

| SLSA level | Claim | Zeta status |
|---|---|---|
| **L0** | no guarantees | (not us) |
| **L1** | build process documented; some provenance | **✅ today** — `gate.yml` is the documented build; CI build on `main` is the provenance anchor |
| **L2** | hosted build service; provenance generated | partially — GHA is hosted; provenance not attested |
| **L3** | hardened build service; non-forgeable provenance | pre-v1.0 NuGet release blocker |

Round-30 lands L1 explicitly (documented build). Round-31+
incrementally adds `actions/attest-build-provenance` + OIDC
publish + Sigstore integration for L2/L3.

## Invariants promoted to formal spec

Cross-reference to `tools/tla/specs/`, `tools/alloy/specs/`,
`tools/lean4/Lean4/`: which STRIDE-quadrant invariants have
machine-checked artefacts today.

| STRIDE row | Formal spec | File |
|---|---|---|
| Tick monotonicity (tampering on runtime) | TLA+ | `tools/tla/specs/TickMonotonicity.tla` |
| Spine merge invariants (tampering) | TLA+ | `tools/tla/specs/SpineMergeInvariants.tla` |
| Operator lifecycle race (spoofing / tampering) | TLA+ | `tools/tla/specs/OperatorLifecycleRace.tla` |
| Recursive counting LFP (DoS) | TLA+ | `tools/tla/specs/RecursiveCountingLFP.tla` |
| Two-phase commit (spoofing / repudiation) | TLA+ | `tools/tla/specs/TwoPCSink.tla` |
| Info-theoretic sharder (DoS) | Alloy | `tools/alloy/specs/InfoTheoreticSharder.als` |
| Spine shape (tampering) | Alloy | `tools/alloy/specs/Spine.als` |
| DBSP chain rule (repudiation by derivation) | Lean 4 | `tools/lean4/Lean4/DbspChainRule.lean` |

Target for v1.0: one formal spec per STRIDE quadrant. Current
coverage is heaviest on tampering + DoS; spoofing is partial;
information disclosure and elevation are formal-spec gaps.

## Adversary-tier → control matrix

Reverse index: for each class of control Zeta ships, which
adversary tier it defends to. Forces honest tier scoring.

| Control | T0 | T1 | T2 | T3 |
|---|---|---|---|---|
| Semgrep lint rules (14, ENFORCED at CI round 30 via `--error`; all matches hard-fail regardless of declared severity) | ✅ | ✅ | ✅ | partial (long-game regression outside lint scope; diff-lint on skills BACKLOG) |
| Build gate (`dotnet build` 0W/0E) | ✅ | ✅ | ✅ | — (compile-clean code can still be a Jia-Tan-class backdoor; not a T3 control) |
| Test suite | ✅ | ✅ | partial | partial |
| Full-SHA action pins | — | — | ✅ | ✅ |
| SHA-pin enforcement Semgrep rule | — | — | ✅ | ✅ |
| `permissions: contents: read` + no secrets *(invariant breakable the moment any secret — e.g., `NUGET_API_KEY` — lands; treat secret introduction as a design-doc moment)* | — | ✅ | ✅ | ✅ (today) |
| 2FA on maintainer account | — | ✅ | ✅ | **partial — bus-factor exception** |
| Hardware security key on maintainer | — | — | — | ✅ (not yet enabled) |
| Signed commits on main | — | — | — | ✅ (deferred) |
| Co-maintainer with cooling period | — | — | — | ✅ (deferred) |
| Branch protection | — | ✅ | ✅ | ✅ |
| `skill-creator` workflow + reviewer floor | ✅ | ✅ | ✅ | partial (long-game needs diff-lint) |
| `packages.lock.json` (round 31) | — | ✅ | ✅ | ✅ |
| SLSA L3 provenance (pre-v1.0) | — | — | — | ✅ |
| OIDC publish (pre-v1.0) | — | — | ✅ | ✅ |

## Priorities

Round-30 delta:

- **Round 30 shipped:** Semgrep-in-CI (14 rules enforced);
  SHA-pin enforcement rule (15); adversary-tier model; bus-
  factor documented exception; supply-chain trust boundaries
  expanded; re-audit cadence every-round; SLSA L1 target;
  long-game persistence defences.
- **Round 30 also shipped:** `docs/security/INCIDENT-PLAYBOOK.md`
  (new); SPACE-OPERA imaginative expansion; SDL-CHECKLIST
  honest downgrades.

Carry-forward priorities:

1. **P0** — Witness-Durable Commit (closes several tampering
   gaps; fsync witness is tamper-evident via Merkle root).
2. **P1** — SHA-256 checkpoint signatures (upgrade tamper model
   from corruption-only to adversarial).
3. **P1** — memory budget + per-query deadline (closes the DoS
   gap).
4. **P1** — `packages.lock.json` adoption + transitive
   `.targets` allowlist (closes NuGet time-bomb + MSBuild
   build-exec vectors).
5. **P1** — verifier-jar SHA-256 pinning (improves TOFU
   acceptance on install script; round-31).
6. **P1** — skill safety-clause diff-lint (long-game defence;
   round-31).
7. **P2** — Arrow IPC HMAC / mTLS (when multi-node lands).
8. **P2** — AssemblyLoadContext isolation for plugin operators.
9. **Pre-v1.0 blocker** — SLSA L3 provenance via
   `actions/attest-build-provenance`, OIDC-based NuGet publish
   (no long-lived API key), `Zeta.*` namespace pre-
   registration, signed-release discipline.

## References

- Microsoft SDL practices 4+5+9 (`docs/security/SDL-CHECKLIST.md`)
- Adam Shostack, *Threat Modeling: Designing for Security* (Wiley 2014)
- Adam Shostack's EoP card game — upstream only, not vendored
- STRIDE: Howard & LeBlanc, *Writing Secure Code* 2nd ed. 2003
- tj-actions/changed-files supply-chain cascade
  (CVE-2025-30066, March 2025) — Unit 42, CISA, StepSecurity
- XZ Utils backdoor (Jia Tan, 2024) — research!rsc (Russ Cox),
  Kaspersky Securelist, OpenSSF advisory
- Shai-Hulud npm worm (Sept/Nov 2025) — Unit 42, Datadog
- Nethereum NuGet typosquat (Oct 2025) — Socket
- shanhai666 NuGet time-bomb — Industrial Cyber / Socket
- GitHub Actions cache poisoning — Adnan Khan
- SLSA framework — https://slsa.dev/
