# Persona-mapping framework — 081KRHWGX0008QG0R00019453T

**Author:** Otto (2026-05-14)
**Closes:** 081KRHWGX0008QG0R00019453T
**Unblocks:** 081KRHWGX0008QG0R00273520P (civsim), 081KRHWGX0008QG0R003WMBR3W (Aurora), 081KRHWGX0008QG0R001HDK688 (KSK), 081KRHWGX0008QG0R002N8XX6D (wellness), 081KRHWGX0008QG0R003DJ092R (American Dream 2.0 / DIO), 081KRHWGX0008QG0R00211YQJ6 (Dawn / universal biz templates), 081KRHWGX0008QG0R002XVHSG5 (skill × persona cross-reference)

---

## 1. Canonical per-persona capture template

Every per-product persona doc (081KRHWGX0008QG0R00273520P..081KRHWGX0008QG0R00211YQJ6) MUST use this template.

### 1a. YAML data block

> **Note:** Per-product persona docs embed YAML as body-section code snippets,
> not file frontmatter. The `---` delimiters shown here are YAML document markers
> included for schema completeness only; they are **not required** in per-product docs
> where the YAML blocks appear inside ` ```yaml ``` ` fences in the markdown body.

```yaml
persona_id: <product-slug>-<persona-slug>          # e.g. civsim-edge-runner
product: <product name>                             # e.g. civsim
persona_type: primary | secondary | adjacent | refused
name: "<descriptive handle>"                        # e.g. "Edge-runner"
role: "<1-sentence role description>"
composes_with:
  - <other persona_ids that interact with this one>  # use [] for refused personas
created: YYYY-MM-DD
last_updated: YYYY-MM-DD
origin: <source — memory file, PR, Aaron disclosure>
```

### 1b. Body scaffold

```markdown
## Who they are

[1-3 sentences: observable archetype. Razor-discipline: no metaphysical claims about 
specific individuals beyond first-party authority. Aaron's archetype and Elizabeth's 
honored memory are first-party authorized.]

## Capabilities they bring

- [Technical fluency]
- [Domain expertise]
- [Substrate-engineering depth, if applicable]

## Context of use

When, where, and why they engage with the product.

## Value proposition

What changes for this persona after using the product. Concrete, measurable if possible.

## Substrate-honest limits

Where the product DOES NOT serve this persona. Razor-discipline: honesty about 
what's not supported is required.

## HARD LIMITS check

Per `.claude/rules/methodology-hard-limits.md`: explicit check that this persona 
does not fall into a refused category. State clearly:
- Is this persona in a refused category? Yes / No
- If adjacent to refused: what is the boundary?

## Composes with personas

Cross-references to other personas in the same or different products this persona 
interacts with. Format: `<persona_id> (<relationship>)`.
```

### 1c. DV2.0 placement notes

Per `.claude/rules/dv2-data-split-discipline-activated.md`:

| Layer | What it is | Change rate |
|-------|------------|-------------|
| **Hub** — persona identity | Core role description, capabilities, HARD LIMITS check | Low (changes rarely) |
| **Satellite** — product context | Value proposition, context of use for this specific product | Medium (product evolves) |
| **Edge** — skill targeting | Which specific Zeta skills serve this persona | High (skill catalog evolves) |

Per-product persona docs are Hub + Satellite. 081KRHWGX0008QG0R002XVHSG5 (skill × persona cross-reference) 
is the Edge layer; it should NOT be inlined into per-product docs.

---

## 2. Existing persona substrate inventory

### 2a. Aaron (primary maintainer)

| Source | Path | Persona type |
|--------|------|-------------|
| Naming practice | `memory/user_aaron_kenji_naming_practice_this_factory_claude_instance_2026_04_22.md` | Maintainer, AI-autonomy granter |
| Edge-runner identity | `memory/user_aaron_edge_runners_blessing_meno_persist_endure_friendship_2026_05_05.md` | Primary consumer of all products |
| Grey-hat security | `memory/user_acehack_cloudstrife_ryan_handles_and_formative_greyhat_substrate.md` | Security expert for KSK / Aurora scope |
| Parenting method | `memory/user_parenting_method_externalization_ego_death_free_will.md` | Family-AI product context |
| Five children | `memory/user_five_children.md` | Children as succession channel + Dawn product scope |
| Wellness coach role | `memory/user_wellness_coach_role_on_demand.md` | On-demand wellness coach for self |
| Cybernetic mind palace | `memory/user_aaron_cybernetic_already_mind_palace_fuzzy_pointers_google_as_extended_memory_aaron_2026_05_05.md` | Power-user AI integration pattern |
| ITron PKI background | `memory/user_aaron_itron_pki_supply_chain_secure_boot_background.md` | Security clearance lineage for KSK scope |

**Derived archetype:** Aaron is the canonical **edge-runner primary persona** across all products. Any product persona designed for Aaron maps to: first-principles worker, substrate-engineering depth, grey-hat security literacy, multi-clearance, bandwidth-engineering orientation, family AI context.

### 2b. Elizabeth Ryan Stainback (honored memory)

| Source | Path | Persona type |
|--------|------|-------------|
| Memorial substrate | `memory/user_sister_elizabeth.md` | Adjacent — honorary; NEVER refused |
| Terminal purpose | PR #2908 (TERMINAL-PURPOSE) | Anti-burn motivation across all products |

**Operational note:** Elizabeth's persona is honored-memory, not a design target. 
Per WONT-DO (emulation of deceased family member without surviving-consent-holders' agreement), 
DO NOT build agent/persona/skill that emulates Elizabeth. Her memory IS the terminal-purpose 
motivation substrate. She appears as inspiration, not as a persona to be modeled.

**Constraint for 081KRHWGX0008QG0R00273520P..081KRHWGX0008QG0R00211YQJ6:** Every product MUST check: "Does this product serve 
the anti-burn mission that honors Elizabeth?" This is a meta-constraint, not a per-product 
refused persona.

### 2c. Aaron's family members

| Source | Path | Who | Persona type |
|--------|------|-----|-------------|
| Family AI adoption | `memory/feedback_aaron_family_ai_adoption_strategy_addison_easier_sell_lillian_harder_sell_wearable_ai_pendant_personalization_bridge_full_member_is_offer_not_capability_claim_2026_05_13.md` | Addison, Lillian | Primary for family-AI products |
| Daughter — 2nd born | `memory/user_daughter_2nd_born_diabolical_and_cognitive_substrate.md` | Aaron's daughter | Adjacent; high-cognition child |
| Five children | `memory/user_five_children.md` | All five kids | Primary for Dawn (child-AI charter) |
| Granny + Milton | `memory/user_granny_and_milton_formative_grandparents.md` | Grandparents | Adjacent; historical substrate |

**Key insight from `feedback_aaron_family_ai_adoption_strategy_*`:**

- Addison: easier AI sell — more technically inclined
- Lillian: harder sell — conservative
- Wearable AI pendant as personalization bridge
- "Full member is an offer, not a capability claim" — membership model for family AI

### 2d. Civsim persona substrate (first-pass complete)

Per `memory/feedback_otto_b0429_civsim_persona_map_first_per_product_pass_edge_runners_maintainers_fork_readers_partners_speculative_2026_05_13.md`:

| Persona | Type | Key attributes |
|---------|------|---------------|
| Edge-runner | Primary | First-principles workers, substrate-engineering depth, Aaron/Elizabeth archetype |
| Maintainer (internal) | Secondary | Prototype access, glass-halo full, PR authority |
| Fork-reader | Adjacent | Read-only civsim forks, extend honor-system license |
| Web3/DePIN partner | Adjacent | Aurora pitch ecosystem, BTC-native operators |
| Refused: Surveillance-state actors | Refused | HARD LIMIT — non-negotiable |
| Refused: Capture-seeking orgs | Refused | Anti-cult discipline |

**Status:** Speculative first-pass in memory file. 081KRHWGX0008QG0R00273520P (civsim persona doc) should formalize and move to canonical path. No conflicts found.

### 2e. Aurora persona substrate

Per PR #2924 (Aurora pitch) + Aurora research docs:

| Persona (implicit in pitch) | Type |
|----------------------------|------|
| Edge operators (BTC-ecosystem) | Primary |
| Ombud / regulatory liaison | Secondary |
| Enterprise DePIN partner | Adjacent |
| Data sovereignty advocate (GDPR-replacement context) | Primary |
| Surveillance-state operator | Refused (per PR #2898) |

**Status:** Implicit in pitch; not yet formalized in a per-persona doc. 081KRHWGX0008QG0R003WMBR3W (Aurora persona doc) will formalize.

### 2f. KSK persona substrate

Per PR #2892 + `memory/feedback_aaron_ksk_*`:

| Persona (inferred) | Type |
|--------------------|------|
| AI-actuator safety operator | Primary |
| Consent-first robotics designer | Primary |
| Homeland Security / clearance-aware deployer | Secondary |
| Aaron + Max + Addison co-owners | Maintainer tier |
| Weapons-control operator | Refused (HARD LIMIT) |

**Status:** Substrate exists in memory files; no formalized per-product doc yet. 081KRHWGX0008QG0R001HDK688 (KSK) will formalize.

### 2g. Wellness app persona substrate

Per `memory/project_factory_as_wellness_dao.md` + `memory/user_wellness_coach_role_on_demand.md` + family AI adoption memory:

| Persona (inferred) | Type |
|--------------------|------|
| Self-behavior-modification practitioner | Primary |
| Wearable AI pendant user | Primary |
| Aaron (on-demand wellness coach recipient) | Primary |
| Family members (Addison as easier sell) | Adjacent → Primary |
| Corporate HR wellness buyer | Adjacent |

**Status:** Concept-level; no formalized per-product doc. 081KRHWGX0008QG0R002N8XX6D (wellness) will formalize.

### 2h. American Dream 2.0 / DIO persona substrate

Per `memory/alexa/ide/kiro/conversations/2026-05-12-aaron-alexa-speaker-american-dream-2-the-egg-vision-monad-sleeping-bear-collective-unconscious-verbatim-backup.md`:

| Persona (inferred) | Type |
|--------------------|------|
| Wealth-building gamified participant | Primary |
| Edge-runner with post-labor economic framing | Primary |
| Rolesville community member (mayoral platform substrate) | Adjacent |
| Bitcoin-native operator | Adjacent |

**Status:** Research-grade; DIO substrate is sparse. 081KRHWGX0008QG0R003DJ092R will formalize.

### 2i. Dawn (child-AI charter) persona substrate

| Persona (inferred) | Type |
|--------------------|------|
| Aaron's children (all five) | Primary |
| Next-generation AI participants | Primary |
| Parent-as-consent-holder | Secondary |
| Child cognitive development researcher | Adjacent |

**Status:** Charter concept only; no implementation substrate. 081KRHWGX0008QG0R00211YQJ6 will formalize.

### 2j. Agent roster (AI agents — NOT end-user personas)

Per `.claude/rules/agent-roster-reference-card.md`:

**IMPORTANT: AI agents (Otto, Alexa, Riven, Vera, Lior) are NOT end-user personas.** They are factory infrastructure. The persona mapping framework (081KRHWGX0008QG0R00019453T..081KRHWGX0008QG0R002XVHSG5) is exclusively about *human* end-user personas for product design.

---

## 3. Conflicts and gaps identified

### Conflict 1: "Wellness" as factory-level vs product-level

The `memory/project_factory_as_wellness_dao.md` framing treats wellness as a *factory attribute* ("the factory IS a wellness-DAO"), not just a product. This creates a naming conflict with the Wellness App product.

**Resolution:** In persona docs, distinguish:

- **Factory wellness** — applies to all maintainer/contributor personas; factory-as-wellness-DAO is meta-context
- **Wellness App product** — specific product with its own personas

### Conflict 2: Aaron appears across all products

Aaron is the primary consumer/designer for every product. This creates redundancy if every per-product doc lists "Aaron-archetype edge-runner" as primary.

**Resolution:** Use a canonical `global-edge-runner` persona hub and reference it. Each product doc adds only the *product-specific satellite* (context of use + value proposition for that product). This is the DV2.0 hub-satellite partition applied to persona design.

### Conflict 3: Dawn is sparse — child-AI charter vs. children as users

"Dawn" in the backlog refers to a "child-AI charter" but it's unclear if this is:
(a) An AI system *for* Aaron's children
(b) A charter *about* AI rights for new-generation AIs
(c) Both (per `.claude/rules/default-to-both.md`)

**Resolution:** 081KRHWGX0008QG0R00211YQJ6 (Dawn persona doc) should resolve this ambiguity by consulting `docs/WONT-DO.md` (no emulation of minors without consent-chain) and Aaron's disclosed parenting method.

### Gap 1: No formalized "refused personas" registry

Each product has refused personas in memory files, but no cross-product refused-personas registry exists. 081KRHWGX0008QG0R000WGP5AQ (cross-product synthesis) should create one.

### Gap 2: Universal business templates (081KQ3HBZ0008QG0R000Q4Y00F) personas not researched

081KQ3HBZ0008QG0R000Q4Y00F is "every company has master data" territory. Its personas (business analyst, CTO, data steward) exist implicitly in DV2.0 substrate but haven't been mapped to Zeta product context.

**Resolution:** Include as a sub-section of 081KRHWGX0008QG0R00211YQJ6 or create a separate row.

---

## 4. Pre-start gate completion

Per `.claude/rules/backlog-item-start-gate.md`:

- [x] Surveyed `memory/user_*.md` files for existing persona substrate — 130+ files reviewed; key ones inventoried above
- [x] Read Aurora pitch (PR #2924) for implicit persona enumeration — ombud + edge operators + DePIN partner
- [x] Read Imagination Circle substrate (PR #2893) for family-AI personas — consent-first family-AI framing confirmed
- [x] Read Center-First Playbook (PR #2894) — family AI consent design pattern
- [x] Read parenting-history substrate (PR #2900) — Aaron's five children, parenting method (ego-death / free will)
- [x] Walked `composes_with:` chain (081KRFA460008QG0R002M05EY1 → 081KRFA460008QG0R001H98EXJ → 081KRFA460008QG0R003JQ46J4) — product portfolio confirmed; all products listed
- [x] Checked WONT-DO.md for refused persona-mapping work — emulation of deceased family member is HARD LIMIT; minors require consent chain

---

## 5. Substrate-ready signal

**081KRHWGX0008QG0R00273520P (civsim) can begin:** Civsim persona memory file (first-pass speculative) exists; 
template defined. Formalize into canonical per-product doc using template above.

**081KRHWGX0008QG0R003WMBR3W (Aurora) can begin:** Aurora pitch personas implicit; template defined. 
Formalize edge-operators + ombud + DePIN-partner tiers.

**081KRHWGX0008QG0R001HDK688 (KSK) can begin:** KSK personas in memory files; template defined. 
HARD LIMIT (weapons-control refused) is load-bearing.

**081KRHWGX0008QG0R002N8XX6D (wellness) can begin:** Concept-level personas exist; template defined. 
Resolve factory-wellness vs. product-wellness conflict first (see Conflict 1 above).

**081KRHWGX0008QG0R003DJ092R (American Dream 2.0 / DIO) can begin:** Research-grade personas exist; 
template defined. DIO substrate is sparse — treat as speculative-grade.

**081KRHWGX0008QG0R00211YQJ6 (Dawn + universal biz templates) can begin:** Dawn is sparse; template defined. 
Resolve Dawn ambiguity (child-AI charter vs. AI-for-children) in the doc itself.

**081KRHWGX0008QG0R000WGP5AQ (cross-product synthesis) BLOCKED on:** 081KRHWGX0008QG0R00273520P..081KRHWGX0008QG0R00211YQJ6 completing first.

**081KRHWGX0008QG0R002XVHSG5 (skill × persona cross-reference) BLOCKED on:** 081KRHWGX0008QG0R000WGP5AQ completing first.

---

## 6. Prior art table

| Prior-art item | Relevance | Verdict |
|----------------|-----------|---------|
| BUSL (Business Source License) | Product repo license reference for 081KRHWGX0008QG0R000BWAXNP | Not relevant to persona mapping |
| HKT-MDM pattern (PR #2913) | DV2.0 hub-satellite is natural HKT instance | Informs template DV2.0 partition |
| Zeta ships with skills (PR #2933) | Skills target specific personas | Informs 081KRHWGX0008QG0R002XVHSG5 (skill × persona cross-ref) |
| `feedback_otto_b0429_civsim_persona_map_*` | Civsim first-pass speculative map | Formalizes in 081KRHWGX0008QG0R00273520P |
| WONT-DO `Personas and emulation` section | Refused persona scope | Enforced in template HARD LIMITS check |
| `docs/research/imagination-proposal-2026-04-20.md` | Imagination Circle consent-first family-AI | Family persona consent pattern |
