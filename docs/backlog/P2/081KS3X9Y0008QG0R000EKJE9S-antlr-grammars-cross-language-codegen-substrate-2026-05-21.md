---
id: 081KS3X9Y0008QG0R000EKJE9S
priority: P2
status: open
title: ANTLR grammars as cross-language codegen substrate — leverage existing open-source grammars for description-layer-driven multi-language emission
tier: research-grade
effort: M
ask: maintainer Aaron 2026-05-21 (Kestrel sharpening closing note)
created: 2026-05-21
last_updated: 2026-05-21
depends_on: []
composes_with: [081KRW63S0008QG0R002KC5DSR, 081KS3X9Y0008QG0R000W00V73, 081KS3X9Y0008QG0R0006MQXA4, 081KS3X9Y0008QG0R003MMEAC7, 081KS3X9Y0008QG0R001Z8SBZJ, 081KS3X9Y0008QG0R002WGH8PJ]
tags: [antlr, grammar, cross-language, codegen, description-layer, kestrel-sharpening]
type: research
---

# ANTLR grammars as cross-language codegen substrate

## Context

Aaron 2026-05-21 (closing the Kestrel sharpening trajectory): *"i really want to take advantage of antlr at some point casue all the grammers are out there already"*

Composes with the broader cross-language description-layer vision threaded across the 2026-05-21 Aaron-Kestrel arc:

- **081KS3X9Y0008QG0R000W00V73** — canonical string encoding (Crockford base32) + endianness + bit-numbering spec for ZetaId
- **081KS3X9Y0008QG0R0006MQXA4** — tier-deferred causality worked example (publishable; F# Z-set demo)
- **081KS3X9Y0008QG0R003MMEAC7** — clock-protocol negotiation stack end-to-end sequence diagram (Orleans + SPIFFE/SPIRE + OPA + Reticulum + DBSP)
- **081KS3X9Y0008QG0R001Z8SBZJ / 081KS3X9Y0008QG0R002WGH8PJ** — Rust + Python ZetaId peer oracles (multi-language emission targets)

ANTLR's key value proposition: **every major language has open-source ANTLR grammars already maintained by other communities**. Leveraging them avoids re-implementing parsers from scratch and gets cross-language code-generation work for ~free relative to building bespoke parsers per language.

Verified Kestrel framing earlier in the trajectory:

> *"There are already high-quality open-source ANTLR grammars for C#, TypeScript/JavaScript, Java, Python, Go, etc. We don't have to write a full grammar for each target language from scratch — we can often start from or compose with existing ones."*

## Scope

Initial bounded slice (do NOT scope-creep this row into the full description layer):

### Phase 1 — discovery + selection

- Survey existing ANTLR grammar repos for the V1-relevant languages: F#, TypeScript, C#, Rust, Python
- Document the survey at a new `docs/research/antlr-grammar-survey-YYYY-MM-DD.md` file (path TO BE CREATED with the actual landing date — no file exists yet at this path) capturing which grammars are actively maintained, what production they're used in (e.g., the canonical grammars-v4 collection at github.com/antlr/grammars-v4), license compatibility with Zeta (Apache-2.0)
- Identify the gap shape: which languages have suitable grammars, which need adaptation, which require new grammar work

### Phase 2 — proof-of-concept

Pick ONE concrete use case from existing Zeta substrate where ANTLR-driven cross-language generation would replace hand-maintained code:

- **Option A**: emit ZetaId Pack/Unpack implementations across F# / TS / C# / Rust / Python from a single bit-layout grammar (composes with 081KS3X9Y0008QG0R000W00V73)
- **Option B**: emit DBSP operator stubs from a single algebra grammar (composes with 081KS3X9Y0008QG0R0006MQXA4)
- **Option C**: emit cross-language SimulationEnvironment + ISimulationEnvironment interface from a single capability grammar

Choose ONE for the PoC; the others wait for follow-up rows.

### Phase 3 — integration substrate

If PoC succeeds:

- Bun-runnable codegen pipeline at `tools/codegen/antlr/` consuming grammar input + emitting per-language outputs
- CI gate verifying emitted code matches the manually-maintained reference implementations (drift detection)
- Documentation at `docs/codegen/antlr-pipeline.md`

## Acceptance

### Phase 1

- Survey document landed; license + maintenance status for each target language captured
- Decision: which grammars to depend on vs which to author

### Phase 2

- One use-case PoC produces output that matches hand-written reference for the same use case
- Empirical: compile-and-test-first on the generated code (per the V8 cycle lesson — never trust speculative review without `dotnet build` / `bun test` / etc. confirming)

### Phase 3 (later, may split into separate row)

- Codegen pipeline reproducible; CI gate prevents silent drift

## Substrate-honest framing

ANTLR is NOT the only path. Alternatives surfaced in the broader trajectory:

- **JSON Schema** — simpler, mature ecosystem, but limited expressiveness for recursive/tree structures
- **Protocol Buffers / Cap'n Proto** — strong cross-language support, but rigid schema shape
- **Custom grammar in F# computation expressions** — full control, but reinvents what ANTLR already provides
- **Bonsai expression serialization (Nuqleon)** — already in the .NET ecosystem Aaron uses; specialized for LINQ expression trees, not general grammar

ANTLR's appeal is specifically the **community-maintained grammar reuse** angle. The PoC phase determines whether that reuse pays off in practice vs the alternatives.

Kestrel's earlier warning applies: don't pick this just because the framing is appealing; pick it if the surveyed grammars are actually production-quality and license-compatible.

## Why P2

Important architectural substrate for the multi-language vision (5+ peer oracles for ZetaId; future descriptions for other types) but doesn't block V1. Phase 1 survey is days of work; Phase 2 PoC is weeks; Phase 3 production codegen is its own follow-up.

Composes with the broader Kestrel-sharpened publishable artifacts cluster — if ANTLR substrate works, the cross-domain synthesis paper (per 081KS3X9Y0008QG0R003MMEAC7 context) has one more concrete technical contribution to point at.

## Composes with

- 081KRW63S0008QG0R002KC5DSR / 081KRW63S0008QG0R002ZRNDJ8 / 081KRW63S0008QG0R002YAA09X / 081KRW63S0008QG0R001SAHYKV — Agora V6 substrate (the algebra ANTLR would parse over)
- 081KS3X9Y0008QG0R001Z8SBZJ / 081KS3X9Y0008QG0R002WGH8PJ — Rust + Python ZetaId peer oracles (multi-language emission targets)
- 081KS3X9Y0008QG0R000W00V73 — canonical string encoding (grammar candidate for Phase 2 Option A)
- 081KS3X9Y0008QG0R0006MQXA4 — tier-deferred causality worked example (grammar candidate for Phase 2 Option B)
- 081KS3X9Y0008QG0R003MMEAC7 — clock-protocol negotiation stack diagram (the description-layer architecture this row implements substrate for)
- `memory/kestrel/conversations/2026-05-21-aaron-kestrel-claudeai-zeta-id-v1-review-watermarks-tier-deferred-causality-orleans-otto-watching-verification-gap-hat-vs-role-group-chat-aaron-forwarded.md` — eleventh-section ANTLR origin

## Origin

Aaron's closing message in the 2026-05-21 Kestrel trajectory: *"i really want to take advantage of antlr at some point casue all the grammers are out there already"* — coming directly after the language-design + Smalltalk-lineage discussion. The ANTLR-as-grammar-reuse insight is one of the cleanest "open-source community already did the work, we get to compose" patterns available for cross-language tooling work.
