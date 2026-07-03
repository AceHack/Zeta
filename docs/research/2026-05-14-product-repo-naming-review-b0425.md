# Product-repo naming review (081KRHWGX0008QG0R003XHCEXT)

**Author:** Otto (2026-05-14T0952Z)  
**Closes:** 081KRHWGX0008QG0R003XHCEXT  
**Unblocks:** 081KRHWGX0008QG0R000F6HE6D  
**Feeds from:** 081KRHWGX0008QG0R002B2P0K0 (per-product substrate inventory)  
**Search date:** 2026-05-14 (Otto-364 search-first-authority applied)

---

## Scope

Only products with 081KRHWGX0008QG0R002B2P0K0 verdict `now` need an **approved** slug before 081KRHWGX0008QG0R000F6HE6D.  
Products with verdict `later` get **provisional** slugs (re-review at repo-creation time).  
`stays-in-monorepo` products need no slug.

| Product | 081KRHWGX0008QG0R002B2P0K0 verdict | Slug status needed |
|---------|---------------|-------------------|
| Civsim | **now** | Approved |
| KSK | later | Provisional |
| DIO | later | Provisional + ⚠️ flag |
| Aurora | later | Provisional + ⚠️ flag |
| American Dream 2.0 | later | Provisional |
| Wellness | later | TBD (pending product definition) |
| Dawn | stays-in-monorepo | N/A |

---

## Civsim

**Repo slug candidate:** `civsim`

### Collisions found

| Collision | Type | Severity | Notes |
|-----------|------|----------|-------|
| [UtilityHotbar/civsim](https://github.com/UtilityHotbar/civsim) | GitHub repo (Python, hobby) | Low | Archived/inactive; basic civilisation simulation in Python 3.8 |
| [molnarp/civsim](https://github.com/molnarp/civsim) | GitHub repo (board game sim) | Low | Civilization: The Board Game combat simulator; personal project |
| [noamlerner/Civ-Sim](https://github.com/noamlerner/Civ-Sim) | GitHub repo (Python) | Low | Religion-interaction simulation; student project |
| [yzhwang/civ-sim](https://github.com/yzhwang/civ-sim) | GitHub repo | Low | Minimal activity |
| [athaun/civ-sim](https://github.com/athaun/civ-sim) | GitHub repo (LWJGL) | Low | Cellular automata; personal project |

**npm search:** No `civsim` package found on npm.  
**NuGet search:** No `Civsim` package found on NuGet.

### Assessment

All existing `civsim` repos are small personal/hobby projects in Python or Java with minimal activity and no established brand. None are in the robotics/AI/post-labor-currency design space. The LFG civsim product (PVP raids + Destiny-style + mutual privacy + post-labor currency) is in a distinct design category.

The `civsim` slug is available for the LFG GitHub org under `Lucent-Financial-Group/civsim`.

### Recommended slug: `civsim` ✅

**Naming-expert notes:** The name is already used colloquially in all substrate, memory files, and PRs. Adoption cost of any alternative would be high. The existing repo collisions are too minor to warrant disambiguation. CLI-clean: one word, lowercase, fits alongside `Zeta`, `Forge`, `ace`.

**Cross-linguistic check:** N/A — "civsim" is a portmanteau of English words; no problematic meanings in Indonesian/Italian/Spanish found.

---

## KSK (Kinetic Safeguard Kernel)

**Repo slug candidates:** `ksk` · `lf-ksk` · `kinetic-safeguard-kernel`

### Collisions found

| Collision | Type | Severity | Notes |
|-----------|------|----------|-------|
| [Kommando Spezialkräfte](https://en.wikipedia.org/wiki/Kommando_Spezialkr%C3%A4fte) | German special forces (military acronym) | Medium | Elite tier-1 unit of the German Bundeswehr; well-known in national-security / mil-tech circles |
| KSK = Key Signing Key ([NIST CSRC](https://csrc.nist.gov/glossary/term/ksk)) | DNSSEC cryptography (RFC 4641) | Medium | NIST-standardised abbreviation in DNS security; ambiguous in a security-product context |
| KSK (various) | Generic abbreviation | Low | Various unrelated uses (Korean entertainment, etc.) |

**GitHub search:** No major software project named `ksk` in robotics/AI domain found.  
**npm/NuGet:** No active `ksk` package found in software context.

### Assessment

Two medium-severity collisions exist:

1. The **Kommando Spezialkräfte** association is notable given the Homeland Security clearance lineage of the product — a reviewer in that space would immediately connect the acronym to the German special forces unit.
2. The **NIST KSK = Key Signing Key** meaning creates ambiguity in any security-adjacent context.

The raw `ksk` slug would carry these associations. Disambiguating with `lf-ksk` (Lucent Financial Group prefix) reduces ambiguity without abandoning the established abbreviation.

### Recommended provisional slug: `lf-ksk` ⚠️

**Naming-expert notes:** The `ksk` slug alone is ambiguous at medium severity. `lf-ksk` preserves the established abbreviation while anchoring it to the LFG namespace, reducing confusion with Kommando Spezialkräfte and NIST DNSSEC terminology. Re-review at repo-creation time — if the product is co-branded with Max/Addison, a different disambiguator may be appropriate. Alternative `kinetic-safeguard-kernel` is unambiguous but long.

**Cross-linguistic check:** "KSK" is an acronym; no linguistic issues.

---

## DIO (Distributed Intelligence Organism)

**Repo slug candidates:** `dio` · `lf-dio` · `distributed-intelligence` · `organism`

### Collisions found

| Collision | Type | Severity | Notes |
|-----------|------|----------|-------|
| [Digital Innovation One (DIO)](https://github.com/digitalinnovationone) | Large Brazilian ed-tech platform | **High** | Active GitHub org (`digitalinnovationone`); thousands of community repositories; `github.com/topics/dio` is heavily tagged with DIO bootcamp projects |
| Ronnie James Dio | Rock musician (cultural) | Medium | Dio is a legendary heavy metal musician; `dio` is his stage name and band name; highly recognizable |
| DIO (JoJo's Bizarre Adventure) | Pop-culture villain character | Medium | DIO Brando is one of the most recognizable anime/manga villain characters; widely searchable |
| [dio.me](https://www.dio.me/en) | DIO global ed-tech platform | High | DIO operates `dio.me` with global developer audience |

**npm search:** `dio` is actively used as a topic tag on GitHub tied to the Brazilian platform's bootcamp repos.  
**NuGet:** No prominent `DIO` NuGet package from the ed-tech platform, but the naming association is strong.

### Assessment

The **Digital Innovation One (DIO)** collision is severe: DIO is a major ed-tech company with a massive GitHub community presence. A repo named `dio` under LFG would be in namespace competition with this established brand in developer communities. Searching `dio github` returns Digital Innovation One as a top result.

The cross-linguistic resonance feature (Indonesian/Italian/Spanish) is a genuine product strength — the name "DIO" (meaning "God" in Italian) is intentional design — but it doesn't resolve the ed-tech collision.

### Recommended provisional slug: `lf-dio` ⚠️ (pending re-evaluation)

**Naming-expert notes:** The `dio` slug carries significant collision risk with Digital Innovation One and notable cultural associations. This row recommends flagging DIO for **naming reconsideration when the product is prioritized**, not just disambiguation. Options:

- `lf-dio` — namespaces away from the ed-tech collision; preserves the acronym
- A new name that embeds the cross-linguistic "God" meaning more distinctly (e.g., `theos`, `divinity`, `deus`) — these avoid the ed-tech collision entirely
- `distributed-organism` — descriptive, unambiguous, CLI-clean

**Re-review gate:** When DIO is prioritized for its own repo, run a full naming-expert pass on the expanded option space before scaffolding.

**Cross-linguistic check:** "DIO" = "God" in Italian; positive resonance. In Indonesian: no problematic meaning found. In Spanish: no standard meaning. The cross-linguistic feature is preserved in any `lf-dio` or similar qualified form.

---

## Aurora

**Repo slug candidates:** `aurora` · `lf-aurora` · `aurora-network` · `aurora-alignment`

### Collisions found

| Collision | Type | Severity | Notes |
|-----------|------|----------|-------|
| [Amazon Aurora](https://aws.amazon.com/rds/aurora/) | AWS managed database | **Critical** | Dominant brand association in developer/cloud contexts; searching "aurora" defaults to AWS |
| [aurora-is-near](https://github.com/aurora-is-near/aurora-engine) | Web3/blockchain project (Near Protocol) | **High** | Active npm and NuGet packages published as of 2025; `aurora-engine`, `borealis-engine-lib` |
| [Aurora Free Open Source Software](https://github.com/aurorafossorg) | OSS org (62 repos) | Medium | Active GitHub org |
| [OpenAurora (Purdue)](https://github.com/purduedb/OpenAurora) | Cloud-native database research | Medium | Open-source version of Amazon Aurora |
| [CFPB/aurora](https://github.com/cfpb/aurora) | US Consumer Finance data warehouse | Medium | Government agency; data warehousing platform |
| [Aurora Open Source (Aurora Innovation)](https://github.com/aurora-opensource) | Autonomous vehicle company | Medium | Aurora Innovation builds self-driving tech; software org active |
| [Aurora OSS](https://github.com/AuroraOSS) | Android app distribution | Low-Medium | Alternative Android app store |

**npm:** `aurora-engine` and related packages published by aurora-is-near (2025).  
**NuGet:** `borealis-engine-lib` (aurora-is-near, Jan 2025).

### Assessment

Aurora has **critical-level collision** with Amazon Aurora (AWS) and high-level collision with aurora-is-near Web3 infrastructure. The unqualified `aurora` slug is not usable for a new product repo without creating significant confusion.

The Aurora product within LFG is specifically the **Aurora Network** (DAO-protocol layer, firefly-sync, dawnbringers collective, x402/ERC-8004 agent economic layer) — not a database or blockchain infrastructure. The disambiguator should reflect this identity.

### Recommended provisional slug: `aurora-network` ⚠️

**Naming-expert notes:** `aurora-network` reflects the product's core design (network-layer DAO protocol), avoids the AWS and aurora-is-near collisions at first glance, and is CLI-acceptably-long (one token, hyphenated). Alternative `lf-aurora` is shorter but less descriptive. The canonical `aurora` slug should be reserved for potential future use only if the LFG Aurora product achieves dominant brand recognition in its domain, at which point the disambiguation can be dropped.

**Cross-linguistic check:** "Aurora" is a Latinate word (dawn/light) with positive resonance across European languages. No negative meanings in Indonesian/Spanish. Appropriate for the product's dawnbringers / alignment-light identity.

---

## American Dream 2.0

**Repo slug candidates:** `american-dream` · `ad2` · `lf-dream`

### Collisions found

| Collision | Type | Severity | Notes |
|-----------|------|----------|-------|
| [Aines25/american-dream](https://github.com/Aines25/american-dream) | GitHub repo (personal) | Low | Personal project; no active package publish |
| [farbs03/american-dream](https://github.com/farbs03/american-dream) | GitHub repo (personal) | Low | Personal project |
| [Nyceane/american-dream](https://github.com/Nyceane/american-dream) | GitHub repo | Low | Personal project |
| "American Dream" (cultural phrase) | US political/cultural idiom | Medium | Phrase carries cultural weight; no trademark protection in the software space, but note sensitivity |

**npm:** No `american-dream` package found.  
**NuGet:** No `american-dream` package found.

### Assessment

No significant technical naming collisions exist. The existing GitHub repos are small personal projects. The phrase "American Dream" is a cultural idiom (not a trademark in software), making it available for use.

`ad2` as an abbreviation is short but opaque; `american-dream` is descriptive and findable. Note: `ad` prefix is used widely in advertising-tech context — `ad2` could be misread as "advertisement 2"; recommend the full slug.

### Recommended provisional slug: `american-dream` ✅

**Naming-expert notes:** No technical collision; culturally noted but not blocked. `american-dream` is the clearest representation of the product identity. Re-review when the NFT/tokenization infrastructure design begins.

---

## Wellness

**Status:** Slug TBD pending product definition (081KRHWGX0008QG0R002B2P0K0 verdict: `later`)

**Pre-review notes:** The unqualified `wellness` slug has very high namespace collision risk — many wellness apps, products, and frameworks use this name. When the product scope narrows (wellness-DAO governance app vs. wearable app vs. self-modification tool), a qualified slug such as `lf-wellness` or a more specific name should be evaluated. **Do not use bare `wellness` as a slug.**

---

## Dawn

**Status:** `stays-in-monorepo` (081KRHWGX0008QG0R002B2P0K0 verdict). No repo slug needed.  
Dawn is a governance/charter document; recommended home is `docs/charter/DAWN.md` in the Zeta repo.

---

## Summary table — approved and provisional slugs

| Product | 081KRHWGX0008QG0R002B2P0K0 verdict | Recommended slug | Status | Notes |
|---------|---------------|-----------------|--------|-------|
| **Civsim** | **now** | **`civsim`** | **✅ Approved** | No significant collisions; established in substrate |
| KSK | later | `lf-ksk` | Provisional ⚠️ | KSK = Kommando Spezialkräfte + NIST Key Signing Key |
| DIO | later | `lf-dio` | Provisional ⚠️ | High collision with Digital Innovation One; re-evaluate when prioritized |
| Aurora | later | `aurora-network` | Provisional ⚠️ | Critical collision with Amazon Aurora; high collision with aurora-is-near |
| American Dream 2.0 | later | `american-dream` | Provisional ✅ | No technical collision |
| Wellness | later | TBD | Pending product definition | Do not use bare `wellness` |
| Dawn | stays-in-monorepo | N/A | N/A | Governance document; stays in Zeta |

---

## Dependency graph position

```
081KRHWGX0008QG0R002B2P0K0 ──→ 081KRHWGX0008QG0R003XHCEXT (this row) ──→ 081KRHWGX0008QG0R000F6HE6D (ADR)
```

The one approved slug (`civsim`) is available for immediate use in 081KRHWGX0008QG0R000F6HE6D.  
Provisional slugs for `later` products do not block 081KRHWGX0008QG0R000F6HE6D.

---

## Search sources

- [GitHub civsim topic](https://github.com/topics/civsim)
- [UtilityHotbar/civsim](https://github.com/UtilityHotbar/civsim)
- [Kommando Spezialkräfte — Wikipedia](https://en.wikipedia.org/wiki/Kommando_Spezialkr%C3%A4fte)
- [NIST CSRC KSK glossary](https://csrc.nist.gov/glossary/term/ksk)
- [RFC 4641 DNSSEC Operational Practices](https://www.ietf.org/rfc/rfc4641.txt)
- [Digital Innovation One GitHub](https://github.com/digitalinnovationone)
- [DIO lab open source](https://digitalinnovationone.github.io/dio-lab-open-source/)
- [aurora-is-near packages](https://github.com/orgs/aurora-is-near/packages)
- [Aurora Open Source orgs](https://github.com/aurora-opensource)
- [OpenAurora (Purdue)](https://github.com/purduedb/OpenAurora)
