# Legal-entity inventory (maintainer subtree) — liability-structure substrate

## Purpose

Available legal entities the maintainer can use as **Stage-3 structural risk-holders** per [`.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md`](../../../.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md). Composes with [`memory/persona/max/PERSONA.md`](../../../memory/persona/max/PERSONA.md) "Per-maintainer scope = per-maintainer liability (today; corps/non-profits later)" — these entities are the corps that close the gap between today's per-maintainer personal-liability fallback and the long-term structural-risk-holder target.

## Consent framing

The maintainer 2026-05-25: *"all the owners are okay with being in git repo glass halo to varying degress i can get they signatures eventually and mine and check them in around glass halo consent."*

This file captures the **public-via-NC-SOS** entity-level data plus director names (which all owners have agreed to per the framing above). Owner-by-owner signed glass-halo-consent files will land alongside this inventory when the maintainer collects them; each signed file captures that specific owner's "degree" of glass-halo participation. Per [`.claude/rules/glass-halo-bidirectional.md`](../../../.claude/rules/glass-halo-bidirectional.md) (observation enables substrate emergence; symmetric disclosure preserves trust) + [`.claude/rules/non-coercion-invariant.md`](../../../.claude/rules/non-coercion-invariant.md) HC-8 (agency preserved by per-person explicit consent).

**What this file does NOT contain** (substrate-honest scope-bounding until signatures land):

- **EINs** — financial attack surface independent of glass-halo consent; held until owner-by-owner sign-off makes it explicit
- **Personal home addresses** — held until each owner's signed consent file captures their individual address-disclosure preference (per the maintainer's 2026-05-25 "varying degrees" framing)
- **Beneficial-ownership-info report content** — FinCEN BOI is held by FinCEN; not mirrored here
- **Bank account / financial-institution info** — never in repo

What IS here is information already public via the NC Secretary of State business-entity search ([sosnc.gov](https://www.sosnc.gov)). The NC-SOS lookup is the authoritative source; this file is a substrate-honest local mirror for the framework's liability-structure references.

## Entities

### Lucent Financial Group Inc

| Field | Value |
|---|---|
| **Name** | Lucent Financial Group Inc |
| **State of incorporation** | North Carolina |
| **NC SOSID** | 3093531 |
| **Filed with NC SOS** | 2025-07-25 |
| **Entity type** | Business Corporation (C-Corp; Form 1120) |
| **Authorized shares** | 1500 common (single class) |
| **Registered agent service** | Republic Registered Agent LLC (Mecklenburg County, NC) |
| **Principal office (city/state)** | Rolesville, NC (Wake County) |
| **Initial directors** | Rodney Aaron Stainback ; Maxim Chadaev ; Addison Stainback |
| **Filed-via** | Bizee (formerly Incfile) — incorporator-then-resignation pattern |

**Ownership splits**: NOT in the filed articles (articles authorize the share pool; allocation is in separate stock-issuance records). The maintainer fills from the stock-issuance ledger:

- Rodney Aaron Stainback: `fill in % or share count`
- Maxim Chadaev: `fill in % or share count`
- Addison Stainback: `fill in % or share count`

**Current attachments**:

- **Zeta repo** ownership (per [`memory/persona/max/PERSONA.md`](../../../memory/persona/max/PERSONA.md) "Ownership note": *"we are all coowners of lfg legally so we are in a corp together"*)

**Available risk classes** (maintainer fills — examples of what Stage-3 attachments might look like):

- `_zeta_repo_risk_acceptance` — IP / open-source maintenance liability for the Zeta substrate
- `_cluster_operations_risk_acceptance` — operational liability for clusters under `maintainers/aaron/clusters/`
- `<other risk classes the maintainer wants this entity to hold>`

**Status**: Active (filed 2025-07-25; first Form 1120 due 2026-04-15)

### Freeborn Flower Co

| Field | Value |
|---|---|
| **Name** | Freeborn Flower Co |
| **State of incorporation** | North Carolina |
| **NC SOSID** | 3109347 |
| **Filed with NC SOS** | 2025-08-22 |
| **Entity type** | Business Corporation (C-Corp; Form 1120) |
| **Authorized shares** | 1500 common (single class) |
| **Registered agent service** | Republic Registered Agent LLC (Mecklenburg County, NC) |
| **Principal office (city/state)** | Rolesville, NC (Wake County) |
| **Initial directors** | Rodney Aaron Stainback ; Thomas Young ; Addison Stainback |
| **Filed-via** | Bizee (formerly Incfile) — incorporator-then-resignation pattern |

**Ownership splits**: NOT in the filed articles. The maintainer fills from the stock-issuance ledger:

- Rodney Aaron Stainback: `fill in % or share count`
- Thomas Young: `fill in % or share count`
- Addison Stainback: `fill in % or share count`

**Current attachments**: (maintainer fills — what does Freeborn currently hold?)

**Available risk classes** (maintainer fills):

- `<risk classes the maintainer wants this entity to hold>`

**Status**: Active (filed 2025-08-22)

## Director-vs-owner note

The director list above (filed in NC SOS Article VIII) is the **initial board composition**, not necessarily current ownership. In a C-Corp these can diverge:

- **Directors** govern the corp (board of directors, files updated annually via NC annual report)
- **Officers** run day-to-day (CEO, CFO, etc. — typically named in corporate bylaws, not state-filed)
- **Shareholders** own the equity (named in stock issuance records; NOT public unless the corp files them; for non-public C-Corps these stay private to the corp)

Initial directors often overlap with initial shareholders for a closely-held C-Corp like these two, but the overlap isn't legally required and can change over time without re-filing articles. The maintainer's "owners" framing in conversation likely refers to **shareholders** (equity holders); the names in the director list above are the **initial board** that NC SOS has on file. The maintainer clarifies when filling the ownership splits whether the named persons are shareholders, directors, or both.

## Future substrate landings

When the maintainer has time:

1. **Owner-by-owner glass-halo consent files** under `maintainers/aaron/legal-entities/consent/<owner-handle>.md` — each owner's signed acknowledgement of their "degree" of glass-halo participation (what's OK to disclose: name, role, address, percentage, etc.); composes with `.claude/rules/glass-halo-bidirectional.md` + the bidirectional-glass-halo discipline. **Addison is authoring the consent document.** The maintainer 2026-05-25: *"Addison is going to work on the glass halo consent document later."* Once she ships the consent template (likely at `maintainers/aaron/legal-entities/consent/TEMPLATE.md` or similar; Addison picks the shape), each owner (including Aaron) fills + signs their own copy; subsequent inventory updates expand from current public-only data to whatever each owner explicitly authorized
2. **Stage-3 attachment records** — for each cluster / risk class attached to one of these entities, an `_*_acceptance` block in `.claude/settings.json` per `.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md` four-field structure naming the entity as the risk-holding party
3. **Non-profit entity entries** — the maintainer 2026-05-25 framed: *"eventually corps/societs own clusters but now the libality falls on mainteinr until we have a legal structure of multiple companies and non profits and libality minimization."* Future non-profit entities (when they exist) get inventoried here too
4. **Migration of attached substrate** — as clusters / risk classes move from per-maintainer personal-liability to corp-held Stage-3, the relevant `maintainers/<name>/clusters/<cluster>/` substrate cross-references the entity here

## Composes with

- [`.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md`](../../../.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md) — three-stage progression (per-incident → per-class → structural risk-holders); these entities are the Stage-3 substrate
- [`.claude/rules/glass-halo-bidirectional.md`](../../../.claude/rules/glass-halo-bidirectional.md) — bidirectional-transparency discipline; per-owner signed consent files extend this at owner-level
- [`.claude/rules/non-coercion-invariant.md`](../../../.claude/rules/non-coercion-invariant.md) — HC-8 floor; agency preserved by per-owner explicit consent
- [`memory/persona/max/PERSONA.md`](../../../memory/persona/max/PERSONA.md) — "Per-maintainer scope = per-maintainer liability (today; corps/non-profits later)" sub-section; this inventory is the substrate-side surface for the Stage-3 target
- [`memory/persona/aaron/`](../../../memory/persona/aaron/) — the maintainer's persona substrate (sibling)
- [`maintainers/aaron/`](../) — the maintainer's subtree top-level
- Original source PDFs at `drop/lucent *.pdf` and `drop/freeborn *.pdf` (gitignored per `drop/README.md` protocol; left in place per the maintainer's choice; the maintainer may delete when this inventory is sufficient)
