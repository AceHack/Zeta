# IMDb + Wikipedia F# Type Providers — the external-reference GROUNDING for NFT links / identities (scoping)

**Status:** scoping, **priority (Aaron's "the one I'm most after").** Aaron 2026-06-19: *"we need F# type
providers that pull in external references like IMDb and others … this is the one I'm most after …
everything grows from IMDb and Wikipedia basically."*

## Why this is the priority — it's the BACKING

The NFT is *"an objectively-rateable high-quality remembered link between travelers"* (NFT scoping §0a). But a
link/identity is only real if **backed** — the grounding / touch-the-earth / anchor-to-human-prior-art
discipline (an *unbacked* link is a children's game; mistaken-for-real, it's deception). **The canonical
external backing for travelers and their relationships is IMDb and Wikipedia:**

- **IMDb = the relational graph** — people ↔ works ↔ collaborations. It *is* a `creator<>collaborator<>
  audience` network already (ties directly to `CoEmpowerField`'s generic `network<>creator<>audience` and to
  the NFT's "remembered links between travelers").
- **Wikipedia = the entity / knowledge graph** — the facts and entities everything references.

So **F# Type Providers over IMDb/Wikipedia are the grounding substrate**: external reference data → *typed*
F# values at compile time → the backing that grounds identities and lets `QPG`/`ρ_owe`/coupled-empowerment
**objectively rate** real links (not unbacked renders). *"Everything grows from IMDb and Wikipedia"* = these
two are the root external anchors the link/identity/NFT/`CoEmpowerField` layers grow on.

## Mechanism

**F# Type Providers** (the F# compile-time typed-external-data feature): generate types from the external
source so a traveler/identity/link is typed against real references — provider-erased or generative, with the
DV2.0 hub/satellite shape (entity = hub, attributes = satellites; same as the DBpedia-HKT-MDM bindings).

## Honest data-source note (anchor-to-human-prior-art; don't overclaim)

**IMDb has no free official API** — its data is licensed. Practical sources, honestly:

- **IMDb non-commercial datasets** (the official TSV dumps — non-commercial use), and/or
- **TMDB** (open API — the standard open IMDb-alternative for people/works/credits), **OMDb API** (light).
- **Wikipedia** → **Wikidata** (SPARQL/REST) and/or **DBpedia** (RDF) — *already on the backlog* (P1:
  `…dbpedia-direct-dotnetrdf-fsharp-ce-hkt-mdm…`, `…dbpedia-hkt-mdm-entity-bindings…`,
  `…dbpedia-end-to-end-demo…`, `…dbpedia-library-choice-adr…`). So the Wikipedia leg is partly scoped; the
  **IMDb leg is the new priority** (build over TMDB/OMDb/IMDb-datasets; respect IMDb licensing — non-commercial
  / open-alternative first).

## Application: reverse-MINT NFTs over IMDb/Wikipedia → reconstruct emergent CLUSTERS / FEDERATIONS (neutral)

Aaron 2026-06-19: *"we can reverse-mint high-quality NFTs over IMDb and Wikipedia to recreate"* the
coordination structures — but with the **framing correction:** *"we treat cartel as a possible **emergent
phenomenon, not a hostile target — cartel != bad** … 'cartel' is game-mode framing, not base traveler
framing; **cluster** or **federation** is better."* So we reconstruct **emergent clusters / federations**
(neutral coordination structures), observed, not hunted.

- **Reverse-mint** = mint NFTs **retroactively** from the existing IMDb/Wikipedia relational record. The
  historical collaborations / co-occurrences **are** remembered high-quality links between travelers — freeze
  each as an **immutable NFT commit** (the git-commit / Merkle-rooted snapshot; mint-time = the *captured
  historical event time* per the phase-clock capture, not "now"). "Reverse" = backward from the record, not
  forward from live interaction.
- **Rate them objectively** (`QPG` · `ρ_owe` · coupled-empowerment) — and the **dense, high-quality minted-link
  clusters are emergent federations**, reconstructed (the recurring co-creating groups).
- **Characterize, don't condemn (the objective distinction):** a cluster is **not bad by default.** The
  NCI-keystone / `CoEmpowerField` metric tells the kinds apart: a **co-empowering, diversity-*preserving***
  cluster is a **healthy federation**; only a **coercive, diversity-*collapsing*** one (the monoculture-pull)
  is the concern. So the readout is *characterization* (federation health) — not a hostile target list.
- **Mechanism (already in-tree):** the grounded graph → reverse-mint links → rate → **cluster characterization**
  via the spectral coordination signature (`CoordRisk` — λ₂ / hub, the `CoordRiskSpectralCrossVerify` leg) +
  the NCI / co-empowerment / diversity health (`CoEmpowerField`, `Diversity`), with the Aurora-immune /
  anti-Sybil G3 lens applied **only** to the coercive-collapse case.

> **Framing guardrail (Aaron):** **cartel = bad is the wrong default.** A reconstructed cluster is a *neutral
> emergent phenomenon*; most are ordinary or healthy **federations** of collaborators. Treat it as something to
> *understand* (characterize via co-empowerment / diversity), never a hostile target. Inherits the immune
> guardrails (blame-the-pattern-not-the-person; no identity-based punishment; absorb-not-attack) — and adds the
> base-traveler stance: the structure is just *what emerged*, observed over public data.

**Canonical worked example (Aaron 2026-06-19): *"this is how you NFT the Kevin Bacon Six-Degrees
phenomenon."*** IMDb's co-star graph **is** the remembered-links-between-travelers graph — actors linked by
co-starring; the **Bacon number** = path length; the **Oracle of Bacon** is the existing query engine. The
pipeline made concrete: **IMDb type provider → reverse-mint each co-star relationship as an NFT-link →
rate (`QPG`/`ρ_owe`/coupled-empowerment) → the small-world six-degrees structure is the link graph, and the
dense frequent-collaborator groups (recurring casts, studios) are emergent **clusters / federations** that
`CoordRisk` + the NCI/co-empowerment health reconstruct *and characterize* (healthy federation vs
coercive-collapse) — never a hostile target. It is the most intuitive end-to-end demo of the whole thesis on
real, public, beloved data. Anchors: Six Degrees of Kevin Bacon / Oracle of Bacon (Tjaden et al.); Watts–Strogatz
small-world; Milgram six-degrees; Erdős number (the collaboration-graph math).

## Ties + routing

- **NFT §0a** (these are the backing that makes the link real + objectively rateable);
  `src/Core/Decorrelation.fs` / `SocietalDora.fs` (the rating engine that runs *on* this grounded data).
- The **grounding / backing / children's-game** thread (`memory/project_each_chip8_cart_is_one_of_our_common_sources_of_meaning_…`) — IMDb/Wikipedia are the *earth to touch*.
- **`CoEmpowerField`** — IMDb is the real `network<>creator<>audience` graph the field generalizes to.
- **`anchor-to-human-prior-art`** — external human anchors as *live, typed* data, not just citations.
- The existing **DBpedia / F# type-provider backlog** (P1/P2) — the Wikipedia leg + the type-provider
  machinery; this doc adds the **IMDb leg** and the **grounding rationale** that prioritizes it.

Routing: a real build (F# type provider). Start with the *accessible* sources (TMDB/OMDb/Wikidata), DV2.0
hub/satellite typing, then the IMDb-dataset path. Flag **P1-priority** per Aaron. Authorship: Otto (scoping).
