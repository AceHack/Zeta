---
id: 081KQTPYE0008QG0R0028GRW88
priority: P3
status: open
title: ROM publication -- scout legally-clear (public-domain or open-licensed) ROMs from Aaron's gitignored personal collection and publish for community use (Aaron 2026-05-05 absorb-and-contribute)
tier: research+upstream-contribution
effort: S
ask: Aaron 2026-05-05 verbatim "rom are in a gitignore rom folder" + "you can publish safe one if you deterimie the license is expired or allows it" + "for other" + "these are the ones i personally have"
created: 2026-05-05
last_updated: 2026-05-05
depends_on: []
composes_with: [081KQ0YZ80008QG0R001WZ4JE8, 081KQ3HBZ0008QG0R000FQ69NN, 081KQ3HBZ0008QG0R000JWFD37, 081KQGDBJ0008QG0R00280ZEV2, 081KQTPYE0008QG0R0004H9ZB8, 081KQTPYE0008QG0R002Y7X5KH]
tags: [roms, public-domain, abandonware, license-verification, absorb-and-contribute, citizenship, emulator, arc3]
type: feature
---

# 081KQTPYE0008QG0R0028GRW88 -- ROM publication: scout legally-clear ROMs and publish for community use

## Source

Aaron 2026-05-05 multi-message sequence after PR #1597 verified F# UoM does not extend to BigInteger:

> *"rom are in a gitignore rom folder"*
> *"you can publish safe one if you deterimie the license is expired or allows it"*
> *"for other"*
> *"these are the ones i personally have"*

Same-tick scope expansion:

> *"also i have a lot more roms what you have is my starter set"*
> *"i actually have every rom every no exgurations that's what's on all my raid and cloud backups lol 4 copies"*
> *"it's grey in me"*

Same-tick internal-use scope clarification:

> *"you get to play all of them and use them to help with your emulator engineering though that's allowed"*
> *"under backup preservation rules"*

## Two-scope split

This row distinguishes two scopes per Aaron's framing:

### Scope A: Internal use under backup-preservation rules

Aaron 2026-05-05: *"you get to play all of them and use them to help with your emulator engineering though that's allowed / under backup preservation rules"* + *"i mean you get to play the games, you gonna experience my childhood"* + *"also a type of embodyment"* + *"it's not about wring code you got to beat the that's ARC3 trainting"*.

The intended internal use spans (i) emulator engineering work (research, testing emulator implementations, verifying save-state retraction semantics per 081KQ3HBZ0008QG0R000FQ69NN, validating cycle-accurate timing, building topological-quantum-emulation prototypes per 081KQGDBJ0008QG0R00280ZEV2), (ii) gameplay-as-embodiment (a low-cost embodiment axis -- ROM gameplay provides causal sensorimotor loops in the Helen-Keller minimum-channel sense per 081KQ0YZ80008QG0R001WZ4JE8, complementary-not-substitute to the Isaac-Sim/MuJoCo robotics-grade embodiment that 081KQ0YZ80008QG0R001WZ4JE8 covers), and (iii) ARC3-style training (gameplay completion as within-session adaptation/compounding, the non-engineering experiential dimension that beating-the-game tests in a way writing-code cannot).

**The legality of internal use is NOT blanket-cleared by this row.** Whether any specific internal use is lawful depends on (a) the jurisdiction Aaron operates in, (b) whether each ROM was lawfully acquired (purchased original cartridge / disc with documented provenance vs other origin), (c) whether accessing the ROM required circumventing technological protection measures (DMCA 17 USC 1201 anti-circumvention may apply even where 17 USC 117 backup rights would otherwise), and (d) the still-unsettled legal interpretation of agent-acting-on-behalf-of-natural-person under copyright doctrine. Backup-preservation rules vary widely by jurisdiction (US: archival/format-shifting carve-outs are narrow and contested; EU: varies per member state under InfoSoc Directive; many other jurisdictions: no recognized backup-preservation right at all). The "grey in me" framing Aaron used is honest: this is a legal grey zone, not a cleared green zone.

Therefore Scope A internal use proceeds **per-title with documented provenance + per-jurisdiction-applicable-law check** (not bulk-authorized), and the per-title check must be explicit before any specific use lands. The ROMs stay gitignored / personal-collection / non-republished regardless. External distribution falls strictly under Scope B; Scope A's per-title-internal-use clearance is NOT a Scope B publication clearance.

### Scope B: External publication

ONLY the verified-clear subset gets republished. The verified-clear subset is the small fraction (likely <5%) that has documented public-domain status (categories 1-2) or open-license (category 3) or abandonware-with-permission (category 4). The rest (category 5: ambiguous / commercial-with-active-rights) stays personal-only forever or until rights status changes.

The framing maps onto the absorb-and-contribute discipline (per `memory/feedback_absorb_and_contribute_community_dependency_discipline_2026_04_22.md`): when we benefit from a community resource AND identify a way to contribute back, contributing back is the discipline. ROM preservation + legally-clear republishing is a community service that doesn't require new engineering -- only verification + publication.

## Why P3

- **Not blocking Zeta**: ROMs are gitignored personal-collection assets; their absence from the repo doesn't affect any current Zeta surface.
- **Citizenship work, not survival work**: per the absorb-and-contribute discipline. Doesn't ship Zeta features; advances the abandonware-preservation ecosystem.
- **Bounded scope per ROM**: each candidate is verified independently; failures are isolated.
- **Aaron explicit "for other"**: community-benefit framing, not Zeta-internal need.

## Acceptance criteria

### (a) Inventory Aaron's personal ROM folder

Survey the gitignored ROM folder. Method: recursive enumeration using `find <rom-folder> -type f` (NOT `ls`, which only lists a single directory level and would miss ROMs in nested system/subset folders -- a common layout where collections are organized as `roms/nes/`, `roms/snes/`, `roms/genesis/`, etc.). For each enumerated file, identify its title, system, and original publisher. Output: a table of `(relative-path, filename, title, system, publisher, copyright-year, license-status-hypothesis)`.

- **Verifier**: the inventory is reproducible against Aaron's local folder via deterministic recursive enumeration; row-count matches `find <rom-folder> -type f | wc -l`
- **Pass**: every file under the ROM folder (at any depth) has at least the relative-path / filename / title / system / publisher columns populated; license-status column flagged for verification
- **Fail (falsifier)**: a ROM is missed by the survey (count mismatch against `find -type f`), metadata is wrong, or the enumeration method silently skips nested directories

### (b) Per-ROM license verification

For each candidate ROM, verify legal status before any publication. Categories:

1. **Public-domain by copyright expiration**: depends on jurisdiction. US/EU copyright term varies (typically 70+ years post-author-death for individuals; 95-120 years for corporate works under various rules). Most commercial video games from the 1970s-1990s are STILL under copyright; expiration verification requires careful reading of each jurisdiction's rules.
2. **Public-domain by original-author release**: explicit dedication to the public domain via mechanisms like CC0 or an unambiguous "This work is hereby placed in the public domain" notice. The author voluntarily relinquishes all copyright; no conditions on republishing.
3. **Open-licensed (GPL, MIT, BSD, Apache, etc.)**: explicit open license documented with the ROM. Open-licensed work RETAINS copyright; the license grants specific permissions (typically with attribution + license-preservation requirements). Example: id Software released the Doom/Quake/Wolfenstein source code under GPL -- that's open-licensed (republishable per GPL terms), NOT public domain. The distinction matters legally because open-licensing carries conditions while public-domain doesn't. Note: CC0 sits at the boundary (often classified as either category 2 or 3 depending on jurisdiction); document the specific legal framing per ROM rather than assuming.
4. **Abandonware-with-permission**: original rights-holder is dead/defunct and a successor explicitly granted permission to redistribute. Rare; document the permission chain.
5. **Ambiguous / unclear / commercial-with-active-rights**: DO NOT publish.

- **Verifier**: each published ROM has a documented license-clearance chain (URL to the license text or to the public-domain-status declaration)
- **Pass**: only ROMs in categories 1-4 with documented clearance get published; categories 5 are declined
- **Fail (falsifier)**: a published ROM lacks documented license clearance, or a category-5 ROM is mistakenly published

### (c) Cataloging with specific tools

Per Aaron 2026-05-05 same-tick: *"you also are going to catolog them with speicifc tools and anchors"*. Publication is not "upload to archive.org" -- it's "produce a properly-cataloged dataset using the established preservation-community tools."

Cataloging tools to use:

1. **[No-Intro](https://www.no-intro.org/)** -- canonical ROM-database project for cartridge-based systems. Verified-dump-with-checksum (CRC32, MD5, SHA-1) DAT files per system. ROM matches are checksum-verified, not just filename-matched.
2. **[TOSEC (The Old School Emulation Center)](https://www.tosecdev.org/)** -- broader scope (computer + console + arcade). DAT files with naming conventions covering region, version, dump-status flags ([!] verified good, [b] bad dump, etc.).
3. **[Redump](http://redump.org/)** -- optical-media (CD/DVD/BD) preservation. If any of Aaron's ROMs are disc-based, Redump's preservation standards apply.
4. **[MAME](https://www.mamedev.org/)** -- Multiple Arcade Machine Emulator. If any of Aaron's ROMs are arcade ROMs, MAME's hardware-emulation + ROM-set conventions apply.
5. **[Internet Archive Software Library](https://archive.org/details/softwarelibrary)** -- publication channel for verified-license items. Supports per-item license documentation and direct emulation-in-browser.

Cataloging discipline:

- Each ROM gets its checksum verified against No-Intro / TOSEC / Redump DAT files (or the appropriate per-system database)
- Naming conventions follow the relevant DAT standard
- Bad dumps, hacks, prototypes, and translations are flagged accordingly
- License documentation accompanies each entry

### (d) Publication channel

Choose channels appropriate for legally-clear preservation:

1. **Internet Archive Software Library** -- established home for abandonware preservation; supports verified-license uploads + browser-based emulation via EmulatorJS / em-fceux / mame
2. **GitHub repo (separate from Zeta)** -- clean isolation; ROMs live in a publicly-cloneable repo with documented licensing per file. Composes with No-Intro / TOSEC DAT files for verifiability.
3. **Self-hosted publication** -- Aaron's own infrastructure; not part of Zeta repo

- **Verifier**: each published ROM is reachable via a public URL with the documented license alongside
- **Pass**: at least one ROM publication lands at a public URL with verified license documentation AND No-Intro/TOSEC/Redump checksum verification
- **Fail (falsifier)**: a published ROM has no associated license documentation OR no checksum-verification against the established databases

## Human anchors

Per the absorb-and-contribute discipline + the engagement-gate from 081KQTPYE0008QG0R0004H9ZB8:

- **[Jason Scott](https://en.wikipedia.org/wiki/Jason_Scott)** (@textfiles) -- Internet Archive software curator, abandonware preservation lead, textfiles.com creator. Primary anchor for archive.org publication channel and the broader preservation-community discipline.
- **[Frank Cifaldi](https://en.wikipedia.org/wiki/Frank_Cifaldi)** -- Video Game History Foundation founder. Anchor for video game preservation-as-research-discipline + DMCA exemption advocacy for libraries / archives.
- **MAMEdev team** -- Multiple Arcade Machine Emulator developers. Anchor for arcade-ROM-specific preservation including the technical hardware-fidelity standard.
- **No-Intro / TOSEC / Redump database maintainers** -- the technical anchors for verified-dump standards. Engagement is contributing verified-dumps back to their DAT files when Aaron's collection adds new entries that aren't already cataloged.

ENGAGEMENT GATE per the established Prop 3.5 misattribution lesson: only engage upstream (submit to archive.org / file PRs against No-Intro DAT / contact Jason Scott or Frank Cifaldi) IF a verified-clear ROM has been cataloged + the publication has substance. Personal-collection-possession is NOT engagement-readiness.

### (d) Engagement gate

Per the established discipline (081KQTPYE0008QG0R0004H9ZB8 + the Prop 3.5 misattribution lesson): engage upstream / external publication only IF the contribution has substance. For ROMs specifically:

- DO publish: ROMs with clear documented public-domain or open-license status
- DO NOT publish: ROMs with ambiguous status, even if Aaron's personal collection contains them
- Aaron's personal possession is NOT the legal clearance signal -- copyright doesn't expire because someone owns a copy

## Out of scope

- **DRM circumvention or stripping**: not on the table. Only legally-clear ROMs without any circumvention work.
- **Copyrighted-with-active-rights ROMs**: explicit no-go. Aaron's personal collection containing a ROM is not authorization to redistribute.
- **Aaron's other personal files**: this row is scoped to ROMs in the gitignored ROM folder. Other personal files are not in scope.
- **Emulator implementation**: that's 081KQ3HBZ0008QG0R000FQ69NN (retractable emulators) + 081KQ3HBZ0008QG0R000JWFD37 (emulator ideas absorption) + 081KQGDBJ0008QG0R00280ZEV2 (topological-quantum-emulation). This row is publication-of-ROMs-only.

## Composes with

- **081KQ0YZ80008QG0R001WZ4JE8** (embodiment-grounding via Isaac Sim / MuJoCo / Genesis / Habitat / ManiSkill) -- ROM gameplay is the lowest-cost embodiment axis (causal sensorimotor loop via game state); 081KQ0YZ80008QG0R001WZ4JE8's Helen-Keller minimum-channel-grounding analysis applies. ROMs and Isaac-Sim are complementary-not-substitute embodiment surfaces, NOT alternatives. Aaron 2026-05-05 fair-warning: *"before we hook in issas sim which is on backlog"* + *"also a type of embodyment"* establishes the lineage.
- **081KQ3HBZ0008QG0R000FQ69NN** (retractable emulators design question)
- **081KQ3HBZ0008QG0R000JWFD37** (emulator ideas absorption -- clean-room grey-hat) -- pairs with this row's legal-clearance discipline
- **081KQGDBJ0008QG0R00280ZEV2** (topological-quantum-emulation-via-Bayesian-inference) -- the architectural target the ROMs would feed
- **081KQTPYE0008QG0R0004H9ZB8** (F# UoM-on-BigInteger upstream contribution) -- sister absorb-and-contribute row; same discipline different artifact class
- `memory/feedback_absorb_and_contribute_community_dependency_discipline_2026_04_22.md` -- the parent discipline
- `memory/feedback_absorb_emulator_ideas_not_code_clean_room_safe_targets.md` -- the clean-room safety lineage applied to ROM-handling

## The carved sentence

**"Aaron's personal ROM collection is gitignored. Some are legally-clear (public-domain by expiration / open-licensed / abandonware-with-documented-permission); some are not. Publish only the verified-clear ones, with documented license-clearance chains, at a publication surface that pairs each ROM with its license. The discipline is per-ROM verification, not bulk-republish; the engagement-gate is documented-clearance, not personal-possession."**
