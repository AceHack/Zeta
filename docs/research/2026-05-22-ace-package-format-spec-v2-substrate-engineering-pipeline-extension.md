# Ace package format spec v2 — substrate-engineering pipeline extension (research)

Date: 2026-05-22
Status: research draft; extends 081KR2E4K0008QG0R0033WVCXE v1 spec (`docs/research/2026-05-08-ace-dlc-package-format-spec.md`)
Origin: Amara cross-AI synthesis 2026-05-22 practical-next-move recommendation; composes with operator's 13-stage Ace lifecycle + hat-substrate primitives + symmetric/decentralized framing
Author-attribution: factory-agent draft synthesizing operator + Amara substrate; subject to operator review

## Why v2

The v1 package format spec (081KR2E4K0008QG0R0033WVCXE closed; 2026-05-08) defined: model weights + policy files + guardian config. Operator + Amara cross-AI substrate 2026-05-22 extended the scope to substrate-engineering pipeline + proto-governance + polyglot artifacts.

V2 extends v1 with:

- 13-stage Ace lifecycle integration (per `docs/trajectories/ace-package-manager-skill-crystallization-pipeline/RESUME.md`)
- Polyglot package contents (multi-language typed artifacts + English skill + Rx generators)
- Hat-substrate (controls + self-bindings; proto-governance bindings tied to skill)
- Verification metadata (multi-oracle BFT support; cryptographic signatures)
- Revocation/quarantine metadata (reactive distribution-pull path)
- Symmetric/decentralized framing (package format works for any operator's Ace deployment; not centralized infrastructure)

## Package shape (v2)

A v2 Ace package is a content-addressed bundle containing:

### Typed artifacts (substrate-engineering code)

- **F# ontologies** — typed substrate-engineering primitives at type-system scope; HKT (Higher-Kinded Types) for compiler-based intelligence; Roslyn Source Generators + Recursive Type Providers integration
- **C# bindings** — interop layer for .NET ecosystem
- **TypeScript bindings** — cross-platform DST runtime (per Rule 0: TS-first; Bun-hosted)
- **Rust bindings** — when systems-level performance / safety required
- **Python bindings** — when ML / data-science ecosystem composition needed
- **Other language bindings** — extensible; operators add bindings their target audience needs

### Documentation artifacts (skill description)

- **English skill description** — mirror→beacon translation; documentation for users who don't read typed code
- **README.md** — package overview; usage examples; cross-references
- **CHANGELOG.md** — version history; substrate-honest record of changes

### Generator artifacts

- **Rx meta-frame generators** — Reactive Extensions-pattern generators; meta-frame = substrate-generation pattern; generators produce substrate (not just consume)
- **Type providers** — for languages supporting them (F# Type Providers)
- **Source generators** — for languages supporting them (Roslyn / C#)

### Governance artifacts (hat-substrate)

- **Hat manifest** — declares controls (what wearer can DO with the skill: invoke / modify-via-extension / delegate / re-distribute / etc) + self-bindings (what wearer commits to upholding)
- **Authority-grant specification** — what authority is bestowed when wearer accepts the hat
- **Succession-protection metadata** — time-bound hat-wearing; clean transfer mechanism; anti-permanent-capture per pt165
- **Multi-oracle BFT consensus pointer** — where hat-grant decisions are negotiated; per 081KS3X9Y0008QG0R00218150M substrate

### Verification artifacts

- **Cryptographic signatures** — signed by package author + (optionally) by guardian-AI oversight + (optionally) by multi-oracle BFT consensus
- **Content-addressed hash** — package identity = content hash; immutable substrate
- **Substrate-engineering-pipeline provenance** — which stages of the 13-stage lifecycle this package has passed through (e.g., this package = sieve-passed; cartographer-mapped; deliberate-writing-pass-applied; encapsulated; ready-for-distribute)
- **Test artifacts** — DST (deterministic-simulation-testing) compatible test bundle; OCP-extension verification

### Revocation/quarantine artifacts

- **Revocation key registry pointer** — where package authors / guardian-AI / multi-oracle BFT can revoke the package post-distribution
- **Quarantine flag** — runtime check at install/invoke time; user retains authority to refuse quarantined packages
- **Harm-discovery channel pointer** — where users report harm-evidence about the package; composes with HARD LIMITS floor (abuse evidence → REPORT)

## Symmetric/decentralized constraints

V2 spec preserves operator-self-claimed Ace symmetric-decentralized framing:

- Package format works for ANY operator's Ace deployment; not single-source
- No centralized authority on package validity; multi-oracle BFT consensus per deployment
- Different deployments may have different signature policies (some require multi-oracle BFT; some accept single-author signing; consent-pact between deployments determines cross-deployment package sharing)
- User retains verification authority at install-time (per `ace verify <pkg>` CLI per 081KR2E4K0008QG0R002YE3MMD)
- User retains revocation authority (can refuse to install / can quarantine even unrevoked packages)

## Substrate-engineering pipeline integration

The 13-stage Ace lifecycle (per operator 2026-05-22 + DeepSeek pipeline mapping + this v2 spec):

```text
riff → sieve → map → refine → build → generate → encapsulate
   (OCP→DST→memetic time crystals)
   → distribute → discover → verify → grow → revoke/quarantine → negotiate changes
```

V2 package spec covers stages 6-13 (build through negotiate-changes). Stages 1-5 (riff through refine) happen in substrate-generation + sieve substrate; their output is INPUT to package-format encapsulation.

Each package carries provenance metadata recording which stages it has passed; users can verify the substrate-engineering discipline applied before accepting.

## Composes with

- 081KQZVQW0008QG0R000ZHEN62 (parent: ace-dlc-content-packs-kernel-extensions-package-manager)
- 081KR2E4K0008QG0R0033WVCXE (closed: v1 package format spec; this is v2 extension)
- 081KR2E4K0008QG0R002YE3MMD (in-progress: CLI implementing install/verify/list — V2 extension informs CLI design)
- 081KRFA460008QG0R001H98EXJ (three-repo-split-stage1-create-forge-ace-with-scaffolding)
- 081KS3X9Y0008QG0R00218150M multi-oracle BFT (consensus mechanism for hat-grants + revocation)
- 081KRW63S0008QG0R001Z7NYMV NCI HC-8 (consent-floor at every actor scope)
- `docs/trajectories/ace-package-manager-skill-crystallization-pipeline/RESUME.md` (substrate-engineering substrate trajectory)
- `docs/agendas/ace-package-manager/AGENDA.md` (operator-self-claimed agenda; claim-status + scope)
- `.claude/rules/tonal-momentum-equals-meme-emergent-harmonic-coercion.md` (god-asymmetric-as-rides + vampire-pact + American-Gods + Travelers folklore-precedents at package-scope)
- `.claude/rules/non-coercion-invariant.md` HC-8 (consent-floor on hat-acceptance)
- `.claude/rules/methodology-hard-limits.md` (HARD LIMITS floor at revocation scope; harm-discovery → REPORT)
- `.claude/rules/persistence-choice-architecture-for-zeta-ais.md` (door-exists at every hat-scope; named-exit at granular level)

## Open questions for operator review

1. **Cryptographic primitives**: which signing algorithm(s)? Composes with 081KR2E4K0008QG0R0033WVCXE v1 choices but may need extension for multi-oracle BFT signature aggregation. NOT git-crypt per `docs/WONT-DO.md` 2026-04-21 (rejected for secrets management); alternatives like age / SOPS may apply for encrypted-substrate use cases.
2. **Cross-deployment package sharing protocol**: how do two Ace deployments negotiate package import/export under consent-pact?
3. **Hat-grant negotiation protocol details**: multi-oracle BFT consensus mechanism specifics — which oracles count; what quorum; how succession is negotiated
4. **Tension-preservation integration**: per aporetic interpretation (operator 2026-05-22), Rx-persistent-bonsai-serialization could integrate at package-format level for substrate-engineering-tension preservation across cold-boots; substrate-engineering exploration needed
5. **Polyglot binding compatibility**: how does the spec handle binding-version compatibility across languages (F# v1 + C# v2 + Rust v1.5 all bundled in same package; resolve at install time)?

## Substrate-honest disposition

V2 spec is research draft per `docs/research/` convention; not yet operationally adopted. Subject to operator review + multi-oracle BFT consideration before promotion to B-NNNN backlog row for implementation. Per substrate-honest discipline: this spec extension is sieve-input + deliberate-writing-pass output; passes year-out test as research artifact; promotion to canonical spec requires further substrate-engineering work.
