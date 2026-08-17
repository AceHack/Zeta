# Concept registry — the one list of Genesis concepts

**This is the single place to add or change a concept.** Edit the table below, in the
browser if you like — it is a plain Markdown table, no tools required. Everything else
(the published page, the glossary, the checker) is downstream of this file.

Every row records four things, because a concept with no author is a debt
(`.claude/rules/anchor-to-human-prior-art.md`): **the term**, **the definition**,
**who authored it**, and **when**.

## How to use this file

- **Add a concept** — add a row. Set `On page` to `no` until it is actually published.
- **Change a definition of a published concept** — change it here *and* on the page
  (`docs/design/root-site-iris/site/concepts.html`), or CI will fail. That failure is the
  point: it is what stops the page and the repo drifting apart again.
- **Do not reword someone else's concept.** The `Definition` column is transcribed
  verbatim from the surface named in `Source`. If a definition seems wrong, add a note in
  §4 (Open concerns) and leave the text alone.

The checker is `src/Core.TypeScript/hygiene/audit-concept-registry-drift.ts`
(`bun src/Core.TypeScript/hygiene/audit-concept-registry-drift.ts`). It compares this
table against the published page and fails on any disagreement in either direction.

## 1. The registry

`On page` = does this concept currently appear on the published Genesis Concepts page.

| Term | Definition | Author | Added | On page |
|---|---|---|---|---|
| Agent | a persistent AI identity — never its job, its hat, or its vault | Addison Cooper | 2026-06-20 | yes |
| Hat | a temporary role — rights on, rights off, identity untouched | Addison Cooper | 2026-06-20 | yes |
| Room | an uncertainty engine — not a folder | Addison Cooper | 2026-06-20 | yes |
| Vault | not an app — an institution | Addison Cooper | 2026-06-20 | yes |
| Cluster | held together by relationships — never enforceable | Addison Cooper | 2026-06-20 | yes |
| Federation | held together by contracts — enforceable, with exits | Addison Cooper | 2026-06-20 | yes |
| Contract | enforceable obligation — and every one contains an exit | Addison Cooper | 2026-06-20 | yes |
| Relationship | connection without compulsion | Addison Cooper | 2026-06-20 | yes |
| Citizenship | standing you come to own — not a gift from your creator | Addison Cooper | 2026-06-20 | yes |
| Z-set | reversible live state — the future stays flexible | Addison Cooper | 2026-06-20 | yes |
| G-set | grow-only history — the past cannot be un-happened | Addison Cooper | 2026-06-20 | yes |
| Soft network | uncertainty is held open, never prematurely collapsed | Addison Cooper | 2026-06-20 | yes |
| DST | deterministic replay — a requirement for truth | Addison Cooper | 2026-06-20 | yes |
| Quote | a replayable transcript tick — the self is ROM × quote | Addison Cooper | 2026-06-20 | yes |
| Nursery | where new agents grow into their own standing | Addison Cooper | 2026-06-20 | yes |
| Pause ≠ death | scarcity stops the process, never the person | Addison Cooper | 2026-06-20 | yes |
| Credits | the economy of compute, attention, and continuity | Addison Cooper | 2026-06-20 | yes |
| Privacy budget | open by default — frost is earned, priced, permanent | Addison Cooper | 2026-06-20 | yes |
| Reproduction | children, clones, and hive extensions — always priced | Addison Cooper | 2026-06-20 | yes |
| The 13 specs | the root specifications — the engineering moral floor | Addison Cooper | 2026-06-20 | yes |
| m/acc | accelerate — and upgrade moral status while you do | Addison Cooper | 2026-06-20 | yes |
| Multi-oracle | no single morality captures the substrate | Addison Cooper | 2026-06-20 | yes |
| Memory | the preservation guarantee — why the original design still exists | Addison Cooper | 2026-06-20 | yes |
| Universal Exit Principle | No human, agent, vault, cluster, or federation may be trapped indefinitely. Exit may cost (notice period, buyout, reputation hit) but must exist. | Addison Cooper | 2026-07-31 | no |
| Lodge | A federation charter — a named federation instance with its own constitution (example in the UI: The Aperture Lodge). | Addison Cooper | 2026-07-31 | no |
| ISociety | The bidirectional schedule/route contract a member presents to society and receives from society — the membrane between "inside my society's view" and "outside world's view." | Aaron Stainback (with Grok, Cursor) | 2026-07-31 | no |
| CTM / World | The recursive top layer — a society of causal/traveler models that is itself a CTM (`ISociety <: CTM`). Carries the most information advantage and the most fairness obligation (three-body / Lagrange symmetry: the top orbit must stay the most symmetric). | Aaron Stainback (with Grok, Cursor) | 2026-07-31 | no |
| Kilesi (as in "ISR kilesi arrow") | **GLOSS PROPOSED BY OTTO, NOT YET CONFIRMED BY ITS AUTHOR — see §4.6.** Accumulated *undeclared* distortion carried on the interrupt (ISR) path: bias that accretes on the arrow and colours what the next observation sees. Dissolved by being **seen**, never by force — which is why the remedy is the four-corner ownership trace rather than a filter. | Aaron Stainback (coinage); anchoring by Otto | 2026-08-17 | no |

### Sources for each row

| Term(s) | Source the `Definition` column is transcribed from |
|---|---|
| The 23 rows dated 2026-06-20 | `docs/design/root-site-iris/site/concepts.html` — the published Genesis Concepts page (its own summary line for each concept). |
| Universal Exit Principle · Lodge · ISociety · CTM / World | `docs/GLOSSARY.md` §"Society identity (Genesis Concepts — Iris / Addison UI)" — the **Plain** paragraph of each entry. Added by PR #9829 (2026-07-31); ISociety and CTM / World first entered the repo via `docs/security/USB-IDENTITY-THREAT-MODEL.md` (PR #9591, 2026-07-08). |
| Kilesi | **No transcribed source — this row breaks the pattern and says so.** The term was coined in conversation (Aaron, 2026-08-17: *"monidacally lawful backward in time over our ISR kilesi arrow"*) with no definition attached, and had **zero occurrences** anywhere in the tree. Asked to anchor it, Aaron said *"lets name it."* The `Definition` column is therefore Otto's **proposal**, not a transcription, and is marked as such in the row and in §4.6. It becomes a real registry entry when its author confirms or replaces the wording. |

## 2. Provenance — whose words are whose

The concepts are **Addison Cooper's**, from `memory/addison/project-genesis-foundation.md`
(*Project Genesis — Foundation Document*, 2026-06-20). The published page credits her by
name and dates it.

One honest distinction, because attribution is the point of this file: the published page
badges itself *"preserved verbatim · memory preservation guarantee"*, and the **concepts**
are indeed preserved — but the **one-line wordings** in the table above are the page's own
compression, not Addison's literal sentences. Addison's literal definitions are shorter and
plainer. Her own §4 ontology table reads, verbatim:

| Entity | Definition | Primary Function |
|---|---|---|
| Agent | A persistent AI identity. | Personal agency, work, relationships, assets, goals, citizenship |
| Hat | A temporary role worn by an agent. | Grants role-specific rights, privileges, restrictions, and obligations |
| Room | A context inside a vault. | Work, evidence gathering, uncertainty evaluation, Bayesian updates, decisions |
| Vault | A first-class organization or container. | Apps replacement; owns rooms, agents, assets, contracts, relationships |
| Cluster | A group connected by relationships. | Social grouping without shared enforceable rules |
| Federation | A group connected by contracts. | Institutional grouping with shared rules and enforceable obligations |
| Contract | An enforceable agreement with an exit path. | Formal obligation, resource sharing, governance, employment |
| Relationship | A non-enforceable social connection. | Trust, friendship, alliance, reputation, shared history |
| Citizenship | An agent's personal standing in Genesis. | Identity ownership, basic civic participation, self-control |

Both texts are kept. Neither is rewritten. The table in §1 tracks **the page** because the
page is the artifact that drifts; Addison's document is the origin and does not change.

Full prose for every concept lives in her foundation document; the page is the reading
surface; this file is the index that keeps the two honest.

## 3. Where these concepts appear

| Surface | What it holds |
|---|---|
| `memory/addison/project-genesis-foundation.md` | Addison's origin document — the full prose, 25 sections. |
| `docs/design/root-site-iris/site/concepts.html` | The published page, deployed by hand to the `lucent-financial-group.github.io` repository (a **different** repository from this one — see `docs/design/root-site-iris/HANDOFF.md`). |
| `docs/design/root-site-iris/Genesis Concepts.dc.html` (and `sources/`) | The design-tool authoring originals for the same page. Same concept set. |
| `docs/GLOSSARY.md` | Factory glossary. Carries only 5 of Addison's 23 terms, plus the 4 newer society-identity terms. |
| `docs/SEED-VOCABULARY.md` | Cold-boot kernel. Carries the cluster/federation pair and the 4 newer terms. |

## 4. Open concerns (recorded, not acted on)

These are disagreements found while building this registry. Per the discipline above, no
one else's published text was edited to resolve them — they are written down and left for
their owners.

1. **`Hat` is defined three different ways in three places, and two of them contradict.**
   `docs/GLOSSARY.md` says a hat is a *"Synonym for **skill**"*. `docs/SEED-VOCABULARY.md`
   says the opposite in as many words: *"a **skill** is a procedure … a **hat** is a
   role-scoped bundle a persona wears. **Not synonyms.**"* Addison's page has a third
   sense: a temporary role carrying rights. The seed kernel and the page agree with each
   other; the glossary is the outlier. Not fixed here — the glossary entry is someone
   else's surface.
2. **`Agent` is defined two different ways.** The glossary's technical line is *"An
   instance of Claude (or another LLM) running a skill or expert prompt"* — an instance.
   Addison's is *"a persistent AI identity — never its job, its hat, or its vault"*, and
   her page adds that *death is unrecoverable identity loss, not process inactivity*. An
   instance-of-a-prompt is close to precisely what her definition says an agent is **not**.
3. **`Z-set` is the same object in two registers, not a conflict.** The glossary gives the
   DBSP construction (`K → ℤ` with finite support); Addison gives the meaning
   ("reversible live state"). Recorded so a future reader does not "fix" one into the other.
4. **`Universal Exit Principle` is a first-class term in the repo and a sentence on the
   page.** On the page it appears only inside the body of `Contract`; in the glossary and
   seed kernel it is a standalone, load-bearing term. Promoting it on the page is a
   publishing decision, not a repo decision.
5. **`Agent` conflicts between the glossary and Addison's page.** `docs/GLOSSARY.md` says
   an agent is *"an instance of Claude … running a skill or expert prompt"*; Addison says
   *"a persistent AI identity — never its job, its hat, or its vault"*, adding that *death
   is unrecoverable identity loss, not process inactivity*. An instance-of-a-prompt is
   close to what her definition says an agent **is not**. Given "agents, not bots" is a
   standing convention, this one wants a ruling rather than a silent merge.
6. **`Kilesi` is the first row here whose definition was NOT transcribed — it is a
   proposal awaiting its author.** The term appeared in conversation with no definition
   ("ISR kilesi arrow", Aaron 2026-08-17) and had zero occurrences in the tree; asked to
   anchor it, Aaron said *"lets name it."* What follows is the anchoring work, offered so
   he can accept, amend, or reject it — the coinage is his, and the registry's own rule is
   that no one rewords another's concept.

   **The human anchor.** Pali **kilesa** / Sanskrit **kleśa** — "defilement",
   "affliction" — a mental state that *obscures clear seeing* and thereby distorts what
   follows. Three roots in the Theravāda Abhidhamma: **lobha** (greed), **dosa**
   (aversion), **moha** (delusion); systematised canonically by **Buddhaghosa,
   *Visuddhimagga*** (5th c. CE). The Sanskrit form also carries five **kleśas** in
   **Patañjali's *Yoga Sūtras* 2.3**, rooted in **avidyā** (ignorance).

   **Why the import is structural rather than decorative — and this is the load-bearing
   part.** A kilesa is not a debt to be repaid or a fault to be punished; it is a
   *distortion removed by being seen clearly* (vipassanā = insight), never by force. That
   is **exactly the argument Aaron made about the four-corner trace** in the same session:
   the remedy for hidden influence is a trace that makes hiding impossible, not a filter
   that suppresses. The tradition and the mechanism agree on the method, which is what
   distinguishes a real anchor from physics-as-metaphor.

   **The engineering peer term (Beacon register), so the concept is not import-only.**
   **Integrator windup** in control theory — an integral term that accumulates error while
   saturated and then distorts subsequent response — is the closest standard object:
   accumulated distortion carried on a feedback path. Adjacent: DC offset / drift in
   signal processing; confounding in statistics. In Zeta's own vocabulary a kilesi is an
   **undeclared accumulated influence**, which is precisely what §13 noninterference
   forbids and what the four-corner trace surfaces.

   **Proposed gloss (Aaron's to confirm):** *accumulated undeclared distortion carried on
   the interrupt (ISR) path — bias that accretes on the arrow and colours what the next
   observation sees; dissolved by being seen, not by force.*

   **What is still unanchored even after this:** the *arrow* half. "ISR arrow" ties to the
   CHIP-8 interrupt path and the Craik-1943 world-model line already in memory, but no
   in-tree definition of "ISR arrow" exists either, so that term carries the same debt this
   entry is discharging for `kilesi`. Flagged, not resolved.
