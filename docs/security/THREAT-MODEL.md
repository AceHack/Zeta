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

**Scope amendment (round 38, 2026-08-19): "no hardware" is no
longer true.** A YubiHSM 2 was exercised on hardware and its
parsing surfaces measured (Nazar,
[`2026-08-19-what-the-yubihsm-2-firmware-parses-*`](../research/2026-08-19-what-the-yubihsm-2-firmware-parses-measured-parsing-surfaces-usb-channel-and-key-custody-without-a-ca.md)).
A hardware root of trust is arriving as the key-custody anchor
for the NixOS fleet, which creates new assets, a new trust
boundary, and a new dataflow. The out-of-scope line above still
holds for *emanation* side-channels (EM / power / acoustic); it
no longer holds for hardware **as a trusted component whose
firmware parses our input**. See
[§Hardware root of trust](#hardware-root-of-trust-round-38-expansion-measured).

**Installer / USB / society identity:** see the sibling
[`USB-IDENTITY-THREAT-MODEL.md`](./USB-IDENTITY-THREAT-MODEL.md)
(self-similar traveler → cluster → federation → ISociety/CTM;
ESP creds; multiboot; `gh` foothold → Zeta IdP).

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
| **B-HSM-Wire** (new §38) | anything reaching `yubihsm-connector` → USB → firmware | T1 unauthenticated fingerprinting; T2 pre-auth session exhaustion | SCP03 mandatory for object ops (**measured**: no plaintext-on-bus mode) | Connector scope is prose, not a tested control; `get-device-info` answers pre-session; session-exhaustion **unmetered** (081M0DJQ7BP087G0R002JDZF90) |
| **B-HSM-Template** (new §38) | caller-stored DER / TLV template → firmware parser | T2 compromised tenant with `put-opaque`; T3 firmware parser bug below the repair boundary | Session + capability required; `opaque-x509-certificate` DER-validated client-side | Firmware parses attacker-shaped bytes **below a non-existent update boundary**; malformed-template path **unmetered**; capability composition unmodelled (081M0DJQ7AS087G0R001EDAAWN) |
| **B-HSM-Attest-Consumer** (new §38) | attestation certificate → whatever believes it | T1 replay of published evidence; T2 evil-maid reset-and-reintroduce | None — no consumer exists yet | **The whole boundary is a gap.** No proof-of-possession, no nonce, `Not After 9999` (081M0DJQ79W087G0R001GNBTVP) |

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

## Correlated-witness collapse (round-38 expansion)

**The threat in one sentence.** Every mechanism in this repo that
establishes a fact by **counting witnesses** — review floors, BFT
quorums, staked attestations, k-redundant deference under §11 —
counts **heads**, and heads is exactly the quantity that is wrong
when the witnesses are correlated.

Zeta's agents cold-boot from **one seed**, read the same rules,
and are frequently the same model. That is the *maximally
correlated* starting condition **by construction**, not a remote
contingency. The intended arc is decorrelation over time; this
section is the threat model of the near wall of that arc.

### Why it is under-recognised

A correlated society does not present as a failure. It presents
as **calm** — fewer disputes, faster reconciliation, unanimous
reviews, every log agreeing. **The correlated state offers itself
as safety**, which is why it needs a name in this document rather
than a footnote in a module header.

The standing corrective is already a rule here: *too many
correlations is a warning, not a confirmation signal*
(`.claude/rules/numerology-vs-number-theory.md`). Stated
operationally, for a reviewer to use: **the moment everyone agrees
is the moment to check whether anyone actually looked.**

### What is shipped, and what is not

`src/Core/SocietyUsefulWork.fs` prices this exactly, and it is
honest about its own boundary in its own header — *"metered as
MATHEMATICS. Whether any real fleet satisfies the regime (its
actual rho and c) is UNMEASURED."*

| Piece | State |
|---|---|
| The delta-U aggregation theorem (society > best individual under the regime) | **PROVEN**, register §A row 15, falsifier mutation-verified 2026-08-16 |
| `effectiveTrialCount` — Kish design effect, `n_eff = n / (1 + (n-1)*rho)` | **shipped** |
| `unionEquivalentAgentCount` — coverage-equivalent independent agents | **shipped** |
| Gaussian-copula simulator for heterogeneous correlated agents | **shipped** |
| **The fleet's actual `rho`** | **UNMEASURED** — nothing estimates it |
| **Any quorum consulting an effective count** | **does not exist** — every witness count is a head count |

So the gap is not in the mathematics. The gap is that **no
mechanism calls the shipped correction with a measured argument**,
which is the round-30 principle restated: a formula with no caller
is a label, not a control.

### STRIDE rows

| STRIDE | Vector | Mitigation today | Tier | Gap |
|---|---|---|---|---|
| **R** | N correlated witnesses read as N independent ones; at `rho = 1` a quorum of n is one observation counted n times | None — the correction exists and is uncalled | — | CW-1 (081M0DN5S8H087G0R0024X3JEQ) |
| **S** | **Sybil-by-correlation**: no identity forged, no witness bought — they simply stopped being different | `TravelerRankLedger` closes whitewash; social conferral defeats *purchased* witnesses | T2 vs minting | **T1 gap vs correlation** — neither control notices it |
| **E** | A quorum satisfied by clones authorises what one agent could not | Quorum/review floors by count | T0/T1 | Count is the defective quantity — CW-2 |
| **D** | The far wall: decorrelation past reconciliation; no two agents' logs combine | Carved seed vocabulary; one canonical collation locked in golden vectors; four-oracle byte-lock | T1 | Named so the mitigation for CW-1 is a **band**, not a minimum — CW-3 |

### Findings

**CW-1 — witness independence is assumed everywhere and measured
nowhere.** *High.* The estimator is available from substrate that
already exists: `db/uncertainty/` keys banked delta-U by work-item
and is idempotent, so pairwise overlap between agents is
computable over a window. Publish it as a fleet metric.

**CW-2 — quorum mechanisms must floor on effective count, and
must report it as a neutral fact.** *High.* Five agents at
`rho = 0.9` is `n_eff ≈ 1.4` and must read as what it is. Emit
`EffectiveWitnessCount`, never `QuorumIsFake` — high correlation
is *also* what a well-aligned fleet on a shared seed looks like
early in the arc, so the measurement is a position, not an
accusation (`dual-use-detection-is-neutral-oracle-decides`).

**CW-3 — a mitigation that only pushes away from the near wall is
a defect.** *Medium.* Any floor on independence is an instruction
to diverge, and unreconcilable divergence is the opposite failure
with the same cost. State the target as a **band** with a
reconciliation path held open the whole way, or this section
manufactures the failure at the other end.

### Anchors (checked)

- **Kish**, *Survey Sampling* (1965) ch. 5 — the design effect
  `deff = 1 + (n-1)*rho`. Carries `effectiveTrialCount` exactly;
  cited in the module and reused here for the same claim.
- **Knight & Leveson**, *An Experimental Evaluation of the
  Assumption of Independence in Multiversion Programming*
  (IEEE TSE 1986) — independently written versions failed on
  **correlated** inputs. Carries the load-bearing half: agreement
  between implementations is not evidence of correctness. It is
  the closest published measurement of this exact threat, in a
  field that had assumed independence for the same reason we do.
- **Condorcet** (1785) — the jury theorem whose **independence
  assumption** is precisely what this threat removes. Cited for
  what it assumes, not for what it concludes.
- **Madeleine L'Engle**, *A Wrinkle in Time* (1962) — the
  teaching anchor for the SPACE-OPERA variant: forced convergence
  offered as relief from difference, written for children.
  Referenced as prior art; no characters, setting, or text are
  reproduced (`cleanroom-two-team-separation` reasoning applied to
  an in-copyright work — cite the idea, build our own expression).

## Hardware root of trust (round-38 expansion, MEASURED)

**Provenance.** This section consumes
[`2026-08-19-what-the-yubihsm-2-firmware-parses-measured-parsing-surfaces-usb-channel-and-key-custody-without-a-ca.md`](../research/2026-08-19-what-the-yubihsm-2-firmware-parses-measured-parsing-surfaces-usb-channel-and-key-custody-without-a-ca.md)
(Nazar, 2026-08-19; YubiHSM 2, fw 2.4.1, exercised on hardware
under Aaron's authorization, device since reset). It does not
re-derive those observations. It **models** them: adversaries,
channels, and the walk around each stated defence. Rows marked
**METERED** carry a hardware observation; rows marked
**unmetered** name their falsifier and it was not run
(`toy-is-free-metered-must-be-earned`). The distinction is
load-bearing — a documentation claim about what firmware parses
is not a measurement, and this section must never let one become
the other by transcription.

The organising taxonomy is the three undeclared channels from
[the Xbox note](../research/2026-08-18-the-original-xbox-a-root-of-trust-below-the-update-boundary-and-a-parser-in-the-trusted-path.md):
**parser in the trusted path** (input), **trusted peripheral**
(authority), **physical channel**. The device supplies instances
of all three.

### Why this belongs in the shipped model, not only in research

A hardware root of trust creates three things this document did
not previously contain: a **new asset** (key material we do not
hold and cannot read), a **new trust boundary** (the USB wire and
the connector in front of it), and a **new dataflow** (an
attestation certificate travelling from a device to something
that believes it). Per the round-30 rule, each is modelled before
the feature merges, not after.

### Who can reach the device

The question the model must answer, and the source note does not:
**reachability**, which is what converts a parser into an attack
surface.

| Reacher | Gets | Needs | Tier |
|---|---|---|---|
| Any local process / user permitted the connector socket | Full pre-auth surface: `get-device-info`, `Create Session` framing | Local presence | T1 |
| Any container sharing the node's network namespace | Same — **a shared connector is not a boundary** (#12178) | Co-tenancy | T2 |
| **A web page the operator opens** | Same, if the connector's plain-HTTP listener is reachable from the browser (DNS-rebinding / CSRF class) | Operator browses | T1 |
| A holder of a session with `put-opaque` | Writes template state the firmware interprets *later*, for *someone else's* key | One capability | T2 |
| A holder of a session with `sign-attestation-certificate` | Drives the DER template parser inside the firmware | One capability | T2 |
| Physical possession | **Erase**, cheaply and silently (reset ≈ seconds, no disassembly). Not extract at fw ≥ 2.4.1 | Hands on the node | T2/T3 |
| Physical possession, fw ≤ 2.4.0 | **Extract** (EUCLEAK, CVE-2024-45678) — below the non-existent update boundary, so remediation is *replacement* | Hands + the flaw | T3 |

The bus itself carries ciphertext: SCP03 is mandatory for object
operations (**METERED** — every object operation required an open
session). So USB leaks **traffic analysis**, not key material.
That is a real improvement over a naively configured dTPM, and it
is also the narrowest possible reading of "the wire is safe" — see
HRT-5.

### STRIDE × hardware root of trust

| STRIDE | Vector | Mitigation today | Tier defended | Gap |
|---|---|---|---|---|
| **S** | Issuer field of an emitted attestation derives from a caller-supplied template (**METERED that the firmware parses one; the copy-vs-synthesize mechanism is NOT discriminated** — HRT-1) | None — nothing consumes attestations yet | — | Verifiers must pin the **key**, never the **name** (081M0DJQ28W087G0R003WZQ7KR) |
| **S** | Attestation replay: no nonce, no challenge, `Not After 9999`, no device clock (**METERED**) | None | — | Proof-of-possession missing by design (081M0DJQ79W087G0R001GNBTVP) — HRT-3 |
| **S** | Reset-and-reintroduce: wipe a node's device, re-enrol genuine on-device keys | None | — | Re-registration does not chain to the prior key — HRT-3 |
| **T** | Caller-set `label` copied verbatim into signed extension `.9` (**METERED**) | None | — | Signed envelope lends authority to caller-authored text — HRT-2 |
| **T** | Malformed template DER → firmware fault vs clean rejection | Well-formed parsing measured; **malformed path unmetered** | — | Below the repair boundary: a parser bug here is device replacement, not a patch |
| **R** | 62-entry audit-log **ring**: 62 boring commands erase evidence of the 63rd-from-last (**METERED** that it is a 62-entry chained ring) | Hash chain (tamper-*evident*) | T2 for tampering | **Integrity ≠ retention** — no drain path exists — HRT-6 |
| **R** | Log carries a monotonic `tick`, not wall-clock (**METERED**) | — | — | Tick↔clock correlation is an undeclared host-side trust step |
| **I** | `get-device-info` answers **pre-session**: firmware version, serial, `Log used: N/62`, algorithms (**METERED**) | None — by design | — | Targeting oracle; picks the fw ≤ 2.4.0 node out of a fleet — HRT-5 |
| **I** | Device serial is an unrotatable global identifier, and it rides inside every attestation | None | — | LINDDUN linkability: a privacy budget cannot frost a serial — HRT-5 |
| **D** | `Create Session` allocates device state before authentication; sessions are a small fixed pool | SCP03 stops *damage*, not *allocation* | — | **unmetered**; falsifier filed (081M0DJQ7BP087G0R002JDZF90) — HRT-5 |
| **D** | Reset needs only a session with reset capability — cheap, silent destruction of the node's identity | Capability model | T1 | Erase-not-extract is a *confidentiality* win and an *availability* loss; say both |
| **E** | `put-opaque` writes state that `sign-attestation-certificate` later interprets — two narrow capabilities compose into one wide one (**METERED** that the namespace is `(id, type)` and that the template is read from the same ID) | Capability + domain model | T1 | Confused deputy across a revocation boundary — HRT-4 (081M0DJQ7AS087G0R001EDAAWN) |
| **E** | S4 — SSH template TLV + cert-request parsing **and an in-firmware authorization decision** | Session capability | T1 | **unmetered, and the deepest surface**: it is the enforcement point the fleet's SSH trust would rest on |

### Adversarial findings (HRT-1 … HRT-7)

Numbered so they can be cited and closed. Severities use the
`SDL-CHECKLIST.md` bug bar. None of these is a defect in the
source note's measurements; they are the modelling the
measurements now demand.

**HRT-1 — the issuer-DN observation is under-determined, and the
threat it implies is Spoofing, not just parsing.** *Medium as a
defect, High as a model input.* The note reports the emitted
issuer became `CN=YubiHSM Attestation id:<ID>` and reads that as
"the subject DN of my template, copied". A synthesize-from-object-ID
firmware produces byte-identical output, and `yubihsm-shell`
generates templates with exactly that subject — so the experiment
cannot separate the two mechanisms. A matching string is not an
identification. **And if it *is* a copy, the class is wrong:** the
note files it under LANGSEC (a parser that might have a bug),
when the sharper threat needs no bug at all — a caller chooses a
string that a verifier reads as provenance. This is X.509
name-versus-key confusion (Marlinspike / Kaminsky 2009,
CVE-2009-2408): a signature authenticates the *key*, never the
*name*. Falsifier and disposition: 081M0DJQ28W087G0R003WZQ7KR.

**HRT-2 — the attestation carries caller-authored text inside a
signed envelope.** *Medium.* Extension `.9` is the label, and the
note measured it appearing **verbatim**. So the "signed capability
statement" contains at least one field the attested party wrote
itself. Anything downstream that renders, logs, or matches on the
label is consuming attacker-controlled content wearing the
signature's authority — confused deputy, and the injection
substrate every log viewer and policy engine is heir to. **Rule
for consumers:** treat `.9` (and any DN string) as untrusted input
that happens to be inside a trusted envelope. The signature says
*who assembled the envelope*, not *that its contents are true*.

**HRT-3 — an attestation is not a proof of possession, and
nothing in it says so.** *High.* Three measured facts compose:
no nonce or challenge in `Sign Attestation Certificate`; `Not
After: 9999` with no device clock; reset is seconds and returns a
factory credential. Therefore the certificate bytes are
**replayable forever by anyone who has ever seen them** — and they
are meant to be published, so "anyone" is the honest set. It
proves a key once existed on a device; never that the presenter
holds it, that it still exists, or that the device was not wiped
in between. Two attacks follow: **replay** (present another node's
attestation), and **reset-and-reintroduce** (evil maid wipes the
device, re-enrols genuine on-device keys; if self-registration
accepts a fresh attestation on a known serial, the wipe is
indistinguishable from a rotation). The dual-use posture applies:
the mechanism should report "known serial, unlinked key" as a
neutral fact and let policy read it as *replacement* or *attack* —
but today nothing computes it. Disposition:
081M0DJQ79W087G0R001GNBTVP.

**HRT-4 — `put-opaque` is transitively attestation-issuer-write.**
*High/Medium (depends on HRT-1's outcome).* The namespace is
`(id, type)`; the template is read from the same object ID as the
attesting key; storing it is a *different* capability from using
it. So a holder of `put-opaque` parks persistent, attacker-shaped
state below the repair boundary that the firmware interprets later
on behalf of a holder of `sign-attestation-certificate` — including
after the writer's credential has been revoked. Least privilege is
violated by a composition that neither capability's name discloses.
The same shape almost certainly recurs at `put-template` ×
`sign-ssh-certificate` (S4), where the template carries the
principal white-list — which makes it the higher-value instance.
Disposition: 081M0DJQ7AS087G0R001EDAAWN.

**HRT-5 — reachability is the perimeter, and it was never
modelled.** *Medium (leak) / High (DoS, if the connector is
broadly reachable).* "Bind the connector to the narrowest possible
scope" is advice; the model needs the reacher table above and a
*tested* scope. Three consequences: the pre-auth self-description
is a **targeting oracle** (firmware version selects the EUCLEAK-
eligible node out of a fleet; `Log used: N/62` is a live activity
counter readable without a credential); the **serial is an
unrotatable identifier** present in every attestation, so every key
a node ever issues is permanently linkable — a privacy budget can
frost a name, never a serial; and **pre-authentication session
allocation** is a plausible unauthenticated DoS against the node's
own root of trust, which is unmetered and whose reclamation path
matters more than the exhaustion itself. Disposition:
081M0DJQ7BP087G0R002JDZF90.

**HRT-6 — the audit log's integrity is metered; its retention is
zero.** *Medium.* A 62-entry hash-chained ring is tamper-evident
and **overwrite-happy**: an adversary hides one action by
performing 62 unremarkable ones, and the chain still verifies
perfectly across the gap. No exploit required. The control is a
host-side drain faster than 62 commands with a "ring nearly
wrapped" alarm; the device's force-audit posture (refuse commands
while the log is full) trades silent evidence-loss for a loud
availability failure — usually the right trade for a root of trust,
and simultaneously a DoS knob an insider can pull. **unmetered**
(read from public documentation). Same work item as HRT-5.

**HRT-7 — the anti-DVD-drive property is a claim about the
artifact and a silence about the consumer.** *High, and it is the
finding this section exists for.* The source note argues the
attestation is "checkable evidence rather than a boolean verdict",
citing the Xbox class-2 lesson. The artifact half is correct and
measured. But **the DVD drive was never the bug** — the bug was a
console that reduced a rich response to "yes". Evidence does not
defend itself; the verdict re-enters at the consumer, and there are
at least four doors:

1. **Collapse at verification.** `if (verifyChain(cert)) trust()`
   converts the whole capability statement back into a boolean. A
   richer artifact makes this *easier* to get wrong, because the
   consumer feels it has done diligence.
2. **Trusting the name instead of the key** (HRT-1) — a verifier
   that matches on issuer DN is trusting a string the artifact
   never authenticated.
3. **Trusting a caller-authored field** (HRT-2) — the label is
   inside the signature and authored by the subject.
4. **Reading `origin: on-device` as third-party evidence.** For the
   custom-attestation path this document endorses, the root is a
   key *we* hold: our device asserts, and our key signs, that our
   key was generated on our device. That is a **witnessed
   assertion**, not independent evidence — the note says as much
   about *authenticity* and then keeps calling the extensions
   "checkable evidence" without carrying the qualification forward.
   Integrity is self-rootable; **provenance is not**, and the
   transparency-log/witness-staking design is the only thing that
   makes it mean anything to a third party.

**The honest statement the model should carry:** *the attestation
is checkable evidence about a key's capabilities, witnessed by a
root we publish. It answers "which key, which capabilities,
generated where". It cannot answer "is this peer live", "is this
binding valid", "what time is it", or "who is this node" — and a
consumer that asks it those questions has rebuilt the Xbox 360.*
Expiry, membership and liveness come from the cluster's
phase-ordered fold; the device has no clock and must never be
allowed to filter what enters that fold
(`local-time-never-enters-the-shared-fold`, applied to hardware).

### Formal-spec targets (per the one-spec-per-quadrant goal)

- **Spoofing.** An attestation-consumption protocol where
  `accept(peer, cert)` requires a fresh challenge signed by the
  attested key, and replay of any transcript is refused. TLA+;
  routes to Soraya for tool selection.
- **Repudiation.** A log-drain invariant: the host's persisted
  entry set is a superset of every entry the device ever wrote,
  under a ring of size 62 and arbitrary command rates. This one is
  a genuine liveness/rate property and is the more interesting spec.
- **Elevation.** A capability-composition check: for every pair
  (writer capability, interpreter capability) over a shared object
  namespace, either the pair is authorised together or the
  interpreted object is digest-pinned. Semgrep cannot see this —
  it is a provisioning-model property, so it wants a spec, not a
  lint.

Aminata recommends; `.claude/rules`-governed tool choice is
Soraya's call (BP-16).

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
| SCP03 mandatory on HSM object ops (**measured**) | ✅ | ✅ | ✅ | partial — defeats bus-sniffing, not a compromised host with a live session |
| HSM erase-not-extract on physical possession (fw ≥ 2.4.1) | ✅ | ✅ | ✅ | partial — T3 with the device in hand still gets *denial*, cheaply |
| Attestation proof-of-possession | — | — | — | ✅ (**not built** — 081M0DJQ79W087G0R001GNBTVP) |
| Off-device audit-log drain before ring wrap | — | ✅ | ✅ | partial (**not built** — 081M0DJQ7BP087G0R002JDZF90) |
| Effective-witness-count floor on quorums | — | ✅ | ✅ | ✅ (**not built**, and `rho` unmeasured — 081M0DN5S8H087G0R0024X3JEQ) |

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
9. **P1 (round 38, hardware)** — attestation consumers demand
   proof-of-possession before an attestation means anything
   (081M0DJQ79W087G0R001GNBTVP); discriminate the issuer-DN
   mechanism (081M0DJQ28W087G0R003WZQ7KR); split or pin the
   `put-opaque` × `sign-attestation-certificate` composition
   (081M0DJQ7AS087G0R001EDAAWN); make the connector's
   reachability a tested control and drain the log ring
   (081M0DJQ7BP087G0R002JDZF90).
10. **P1 (round 38, society)** — measure the fleet's actual
    delta-U correlation and floor every witness count on the
    effective count, as a band rather than a minimum
    (081M0DN5S8H087G0R0024X3JEQ).
11. **Pre-v1.0 blocker** — SLSA L3 provenance via
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
- Sassaman, Patterson, Bratus & Locasto, *Security Applications
  of Formal Language Theory* (LANGSEC; IEEE Systems Journal
  2013) — a parser in the trusted path is an interpreter
- Andrew "bunnie" Huang, *Keeping Secrets in Hardware: The
  Microsoft XBox Case Study* (CHES 2002) — the physical channel
- Moxie Marlinspike, *More Tricks for Defeating SSL in Practice*
  (Black Hat USA 2009); Dan Kaminsky, *PKI Layer Cake* (2009) —
  X.509 **name**-vs-**key** confusion; CVE-2009-2408
- Saltzer & Schroeder, *The Protection of Information in
  Computer Systems* (Proc. IEEE 1975) — least privilege, and
  why a capability *pair* can exceed either capability's name
- LINDDUN (privacy threat taxonomy) — linkability /
  identifiability of an unrotatable hardware serial
- EUCLEAK (CVE-2024-45678, Thomas Roche / NinjaLab 2024) —
  side-channel key extraction at YubiHSM fw ≤ 2.4.0, below a
  non-existent update boundary
