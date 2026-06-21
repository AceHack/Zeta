# ADR: Product-repo split decisions

**Status:** Accepted  
**Author:** Otto (2026-05-14T1000Z)  
**Closes:** 081KRFA460008QG0R003JQ46J4, 081KRHWGX0008QG0R000F6HE6D  
**Companion to:** [2026-04-22 three-repo-split ADR](2026-04-22-three-repo-split-zeta-forge-ace.md)

---

## Context

The factory-infrastructure three-repo split (Zeta + Forge + ace) was decided in [the 2026-04-22 ADR](2026-04-22-three-repo-split-zeta-forge-ace.md). This is the **companion ADR for the product axis** — it answers which LFG product concepts get their own public GitHub repos, in what order, under what governance.

Aaron 2026-05-13 articulated the dual-axis design:
> *"so anytihgn you don't want them to fork specifically you have in a repo can still be public and such glass halo but the licence can say no fork please respect honesty or something not enforcable"* *(verbatim; typos preserved)*

The design constraints cascade from four child rows of 081KRFA460008QG0R003JQ46J4:

| Row | Output | Merged / authored |
|-----|--------|------------------|
| 081KRHWGX0008QG0R000BWAXNP | `docs/legal/HONOR-SYSTEM-LICENSE-DRAFT.md` | PR #3122 (merged 2026-05-14) |
| 081KRHWGX0008QG0R002B2P0K0 | `docs/research/2026-05-14-product-repo-substrate-inventory-b0425.md` | PR #3124 (merged 2026-05-14) |
| 081KRHWGX0008QG0R003XHCEXT | `docs/research/2026-05-14-product-repo-naming-review-b0425.md` | Authored 2026-05-14 |
| 081KRHWGX0008QG0R00394BM1G | `docs/DECISIONS/2026-05-14-product-repo-glue-mechanism.md` | Authored 2026-05-14 |

---

## Decision

### 1. Which products get repos and when

| Product | Verdict | Approved slug | License | Timing |
|---------|---------|--------------|---------|--------|
| **Civsim** | **repo-ready now** | **`civsim`** | Honor-system (mutual-privacy FAQ clause) | Create immediately per scaffolding checklist below |
| KSK | later | `lf-ksk` (provisional) | Honor-system | After KSK strategic-encryption scope design + hardware CI design (open backlog row needed) |
| Aurora | later | `aurora-network` (provisional) | Honor-system | After Aurora Network DAO-layer design row completes |
| American Dream 2.0 | later | `american-dream` (provisional) | Honor-system | After NFT/tokenization infrastructure design |
| DIO | later | `lf-dio` (provisional, ⚠️ re-evaluate) | Honor-system | After product definition + full naming-expert re-review |
| Wellness | later | TBD | Honor-system | After product scope narrows to implementable MVP |
| Dawn | stays-in-monorepo | N/A | N/A | Home: `docs/charter/DAWN.md` in Zeta repo |

### 2. License applied to all product repos

`docs/legal/HONOR-SYSTEM-LICENSE-DRAFT.md` is the template applied to all product repo LICENSE files.

Key properties (substrate-honest):

- Repos remain **public** — glass-halo discipline preserved
- Forking is **asked against, not prohibited** — honor-system; non-enforceable
- Civsim **exception**: forks are welcome by design; the mutual-privacy clause asks forks to apply the same honor-system ask to their own strategic substrate
- Factory-infrastructure repos (Zeta, Forge, ace) keep Apache 2.0 — the honor-system license is for product-strategic substrate only

### 3. Cross-repo glue mechanism

Per the [glue mechanism ADR](2026-05-14-product-repo-glue-mechanism.md), the staged approach:

- **Stage 1 (now)**: `.zeta-version` pin file in each product repo; Forge CI emits `repository_dispatch` on Zeta release tag
- **Stage 2 (when NuGet cadence established)**: NuGet package references for product repos targeting the stable packaged API surface
- **Stage 3 (when ace ships)**: `ace.toml` + lockfile replaces pin files across all product repos

### 4. Agent/factory colocation

Each product repo carries a lightweight `.claude/` configuration (product-scoped `CLAUDE.md` + product-specific skills). Factory agents and the core skill library are not duplicated — they are accessed via `tools/peer-call/` from the factory repo.

---

## Consequences

### Positive

- **Factory-product separation of concerns**: product repos have independent CI/CD pipelines, branch protection, and CodeQL scope. Factory churn (Zeta substrate evolution) does not create noise in product repo histories.
- **Forkable ecosystem enabled for civsim**: anyone who forks plays with us; mutual-privacy clause governs strategic substrate in forks.
- **Glass-halo preserved**: all product repos public from day one; honor-system license is the substrate-honest social contract, not a legal wall.
- **Inheritance of hard-won factory practices**: each product repo inherits the full scaffolding checklist (see below) so it doesn't re-justify each item.
- **Staged glue mechanism**: no big-bang tooling requirement — Option A works today; Option B/C improve the UX as tooling matures.

### Accepted costs

- **Manual pin-file bumps** until ace ships (Stage 1 limitation).
- **DIO naming risk**: the `lf-dio` provisional slug is a stop-gap; a full naming-expert re-review is required when DIO is prioritized.
- **Aurora scaffolding blocked on scope design**: the Aurora Network DAO layer requires a dedicated planning row before scaffolding begins.

### Open questions (not blocking this ADR)

| Question | Status |
|----------|--------|
| When does ace ship? (Stage 3 trigger) | 081KRFA460008QG0R001H98EXJ Stage 3, multi-year |
| Which products are ready for public-announce vs "public but not announced"? | Deferred to per-product launch rows |
| Strategic-encryption scope: which product repos need gitcrypt? | KSK explicitly; civsim per PR #2902 authority already granted; others TBD per product |
| Aurora Network scaffolding row | Needs dedicated B-04xx decomposition |

---

## Staging timeline

### Stage 1 — Create civsim repo (immediate)

**What:** Scaffold `Lucent-Financial-Group/civsim` public repo.

**Scaffolding checklist (inherits from 081KRFA460008QG0R001H98EXJ by-default principle):**

- [ ] Repo created: `Lucent-Financial-Group/civsim`
- [ ] Visibility: **public** (glass-halo)
- [ ] LICENSE: honor-system text from `docs/legal/HONOR-SYSTEM-LICENSE-DRAFT.md` (mutual-privacy FAQ clause)
- [ ] `.zeta-version` pin file: contains an immutable reference — a pinned commit SHA or release tag (capture the current `main` HEAD SHA at creation time; update via explicit bump, not branch pointer)
- [ ] Branch protection on `main`: `required_conversation_resolution` + squash-only + no-force-push
- [ ] CodeQL: enabled (default code-scanning workflows)
- [ ] `.claude/CLAUDE.md`: product-scoped bootstrap (references Forge for factory tools; cites `.zeta-version`)
- [ ] Initial README: product carved sentence + honor-system license note
- [ ] `repository_dispatch` subscription: wired to receive Zeta release-tag events from Forge CI
- [ ] Claim released on bus: `bun tools/bus/claim.ts release --from otto --item 081KRFA460008QG0R003JQ46J4`

**Substrate to migrate from Zeta monorepo to civsim repo:**  
Not a blocker for repo creation. Substrate migration follows in a dedicated B-04xx row once the repo exists and scaffolding is verified. Factory-substrate (PRs #2841, #2832, #2869) stays in Zeta until migration row.

### Stage 2 — "Later" product repos (as each reaches repo-ready)

Each "later" product follows the same scaffolding checklist when it achieves `repo-ready now` status. Requires:

1. Re-run 081KRHWGX0008QG0R002B2P0K0-style substrate inventory check
2. Re-review provisional slug (especially DIO)
3. Apply honor-system license
4. Apply glue mechanism (Option A → B/C as available)

### Stage 3 — ace migration

When ace Stage 3 ships: migrate all `.zeta-version` pin files to `ace.toml`. No flag day required; products migrate on their own cadence.

---

## Supersession

This ADR does **not** supersede [2026-04-22 three-repo-split ADR](2026-04-22-three-repo-split-zeta-forge-ace.md). It is a **sibling document** on the product axis. The factory-infrastructure axis (Zeta + Forge + ace) is governed by the 2026-04-22 ADR. The product-portfolio axis is governed by this ADR.

---

## References

| Document | Role |
|----------|------|
| `docs/legal/HONOR-SYSTEM-LICENSE-DRAFT.md` | License template for all product repos |
| `docs/research/2026-05-14-product-repo-substrate-inventory-b0425.md` | Per-product repo-readiness verdicts |
| `docs/research/2026-05-14-product-repo-naming-review-b0425.md` | Approved and provisional repo slugs |
| `docs/DECISIONS/2026-05-14-product-repo-glue-mechanism.md` | Cross-repo version-pin and CI mechanism |
| `docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md` | Sibling factory-infrastructure ADR |
| `memory/feedback_aaron_honor_system_no_fork_license_public_glass_halo_but_please_dont_fork_honesty_not_enforceable_2026_05_13.md` | Aaron's design intent verbatim |
| `memory/feedback_aaron_civsim_forkable_pvp_raids_destiny_style_mutual_privacy_no_strategic_advantage_game_design_2026_05_13.md` | Civsim mutual-privacy design |
