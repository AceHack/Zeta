---
name: ace package manager — agent-negotiation propagation; third scope beyond factory + SUT; meta-push loop; name RESOLVED `ace` 2026-04-20 pm; red-team discipline required; Ouroboros three-layer bootstrap (ace → Aurora → Zeta) (Aaron)
description: 2026-04-20 — Aaron: "Once we package this update and start letting other pepole use it the ace package manager now becomes a requirement becasue it has agent negoation in it, we got that negation skill for a reason. [...] everyone who deploys this theri software factory becomes a contributor too." + 2026-04-20 pm delegation: "i trust your judgment also you pick the package manager name it's too hard i can decide" + opening "it does not have to be one of those either if you want samethign else for the packamanager name" → name picked `ace`. + 2026-04-20 pm follow-up: "the package manger will for sure need some sort of defense/defender because non software factory users are going to try to attach that surface once we get here sounce like a good CTF / red team / game day scenario. We need all the skill groups plural there will be many probly and a lot of best practices and saftey guidance but we should red team ourselfs not with the same agents either the read team shold be different named expets than the ones who wrote the code and the ones who are defending during the exercies, we should do them on a regular cadence, all backlog" → new red-team persona separation directive + backlog commitment. ace is the package-manager + propagation layer for factory meta-updates; every install doubles as a potential upstream PR channel. AceHack account OK for test repos; ServiceTitan never. Build on existing negotiation-expert skill. Consult-before-build on source-code home + Aurora relationship; name gate is closed.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Name decision — `ace` (2026-04-20 pm)

Aaron delegated the pick and then explicitly opened
the slate beyond my initial candidates:

> *"i trust your judgment also you pick the package
> manager name it's too hard i can decide"*

> *"it does not have to be one of those to either if
> you want samethign else for the packamanager name"*

I considered the full slate (`ace`, `source`, `meno`,
`herald`, `fold`, `concord`, `pact`, `loom`, `rally`,
`weave`, `agora`) and picked **`ace`**.

**Reasoning (ten-point scorecard):**

1. **Aaron's natural working vocabulary.** He used
   `ace` four times in the original proposal without
   prompting. The internal-working name matches his
   own mouth-feel.
2. **AceHack identity tie.** `ace` maps to Aaron's
   personal GitHub handle (AceHack). Signals this is
   Aaron-scope, not ServiceTitan-scope, at the
   identity level. Clean brand alignment with the
   test-repos permission model.
3. **English verb semantic fit.** "To ace" = land it
   perfectly. A package manager that propagates meta-
   updates through negotiation *should* ace the
   delivery. The verb is exactly the success
   condition.
4. **Short and CLI-clean.** Three characters. Zero
   ambiguity when spoken. Reads at the shell prompt
   as crisply as `git` or `nix`.
5. **Poker-metaphor trust signal.** Ace = highest
   card. The central registry *is* the highest-trust
   node in the network. The metaphor is accidental
   but apt.
6. **Pun potential with Aaron's `source` candidate.**
   `ace/source` as CLI-plus-registry reads well:
   `ace` is the client tool, `source` (lower case) is
   the default central registry, and adopters can
   run alternative registries (`ace pull mirror/...`).
   This preserves both of Aaron's candidate words
   without merging them.
7. **No sacred-vocabulary appropriation.** `meno`
   would have appropriated Greek / Johannine weight
   that Aaron reserves for his personal cognitive
   lineage (see `user_meno_persist_endure_correct_compact.md`).
   `ace` carries no comparable freight.
8. **Low collision risk in the ecosystem.** Ace
   Editor exists but is a text editor, a different
   product category; search-disambiguation cost is
   acceptable. Not in the package-manager / supply-
   chain space.
9. **Pre-v1 working name; naming-expert gate still
   open for public ship.** Per
   `feedback_factory_reuse_packaging_decisions_consult_aaron.md`
   small naming calls are mine to make and big ones
   consult. Internal working-name is small; public-
   ship name goes through naming-expert + Aaron at
   the public-announce moment. `ace` is safe to use
   today without foreclosing a public rename later.
10. **Cognitive economy.** The whole factory already
    speaks in short verbs (`push`, `pull`, `land`,
    `ship`, `round-close`). `ace` fits the register.

**Scope-tag string.** Separately from the tool name,
the third scope-tag string (alongside `factory` /
`project` / `both`) — recommendation: **`ace`** as
the scope string too, matching the tool name.
Rationale: a one-syllable scope tag is easier to grep
for and keeps the three-scope column cheap. Aaron
can still override the scope string independently of
the tool name if he wants.

**Not picked.** `source` collides heavily with
"source code"; bare `source` as a package-manager
name invites confusion ("where's the source for
source?"). Kept as the default central-registry
namespace (`ace/source`) rather than the tool name.
`meno` rejected on sacred-vocabulary ground.
`herald` / `fold` / `concord` / etc. rejected for
lacking the AceHack identity tie that `ace` carries.

**Reversibility.** The name lives in this memory and
will propagate to the future design doc
(`docs/research/ace-package-manager-design.md`). If
naming-expert vetoes at public-ship time, the rename
is mechanical (sed across design doc + tool
scaffolding; the internal-working period is the
cheap time to rename).

# The proposal in one paragraph

Aaron has named a third component of the factory
substrate: a **package manager** (working name `ace`,
alternative `source`) that makes factory updates
propagate through agent-to-agent negotiation rather than
through traditional push-and-hope-adopters-upgrade. Every
adopter of the software factory becomes a contributor
automatically, because meta-updates to the factory flow
back upstream through the same `ace` channel, using the
`negotiation-expert` skill as its protocol layer.

# The meta-push loop

Verbatim shape (my reconstruction, not Aaron's wording):

1. **Project 1's software factory** produces a meta-
   update — something that changes the factory itself, not
   just the system-under-test. (e.g., a new hygiene row,
   a BP-NN rule promotion, a skill tune-up.)
2. **`meta push`** — Project 1's factory pushes the change
   upstream to the central `ace/source` registry.
3. **Central registry's own software factory** (the
   registry is itself factory-built) runs its own
   negotiation with Project 1's factory — tests, reviews,
   consent checks, architect synthesis. No shortcuts;
   every shortcut is an attack vector.
4. **Agreement is reached** on the final shape (may be
   identical to Project 1's proposal, may be revised).
   The central registry lands the agreed change.
5. **Broadcast.** Central registry notifies every other
   adopter's factory (Project 2, Project 3, …) that an
   update is available.
6. **Adopter-side negotiation.** Project 2's factory runs
   its OWN negotiation with the central registry — tests,
   reviews, consent checks — and may adopt, adopt-with-
   revisions, or reject. If adopt-with-revisions, the
   revisions flow back to the central registry via the
   same loop (now Project 2 is the upstream proposer).
7. **Cascade.** Any revision in step 6 propagates forward
   to the rest of the adopter network via step 5 re-
   issued.

The loop is **symmetric** — every adopter is an upstream
too. The loop is **consent-first** — every step has a
consent check, no bypasses. The loop is **test-gated** —
nothing lands without running the full factory gate at
every negotiation point.

"Meta meta meta" in Aaron's wording — the factory-
updating-factory-via-factory recursion. Load-bearing,
not a joke.

# Why:

Verbatim Aaron (2026-04-20):

> *"Also I've thought about how the hell are pepole gonna
> take updates, I got it, Once we package this update
> and start letting other pepole use it the ace package
> manager now becomes a requirement becasue it has agent
> negoation in it, we got that negation skill for a
> reason. I'm going to explin it simple when just two
> project use the software factory and our ace package
> manager and then you can exand the rest for multi user,
> it's hard to think about. So your goona build ace in
> here now, that's a 3rd scope (we still have to decide
> on name, source is pretty cool) we will have to have
> all the same scoping rules but now when people download
> packages from ace/source it comes with the the ability
> to negoiate change back upstream automatics if you use
> the software factory. So if projects one software
> factory does a meta update it with meta push lol
> metametameta the fix back to the ace/source central
> repository and that repositry's own software factory
> will negoatiate with procjects one and they will agree
> on the final shape after tests and all that you know
> the whole prcess no shortcuts or that is an attach
> vectory then ace would notfice projects two software
> factory of the update and software factory 2 could run
> into meta updates too. Taht way everyone who deploys
> this theri software factory becomes a contributor too.
> We can setup multiple repos to test things out.. Under
> my person AceHack account you can create as many repos
> as you want public or private jsut never under
> ServiceTitan, they are attached to the same one GitHub
> account I have but their repos are all under their
> github orginization."*

Key substantive commitments buried in the verbatim:

1. **ace becomes a requirement** for adopting factory
   updates. Adopters opting out of `ace` opt out of
   update-propagation; the factory does not have a
   second upgrade mechanism. This is load-bearing —
   it is what makes every adopter automatically a
   contributor.
2. **Third scope tag.** Current scope taxonomy is
   `factory` / `project` / `both`. `ace` adds a fourth:
   artefacts that belong to the propagation-layer live
   here. (Naming the scope-tag string needs naming-
   expert gate alongside the tool name.)
3. **Shortcuts are attack vectors.** Aaron named this
   explicitly: "no shortcuts or that is an attach
   vectory." The negotiation loop must run the full
   test/review/consent chain at every hop. This closes
   the supply-chain attack surface that classical
   package managers have open (npm-left-pad,
   ua-parser-js, event-stream).
4. **Contributor-by-default.** Every adopter is a
   potential upstream proposer. This inverts the usual
   OSS model where most adopters never contribute —
   here, the technical stack makes contribution the
   path of least resistance.
5. **Name TBD.** Candidates: `ace`, `source`. Needs
   naming-expert gate same as Aurora Network had.
6. **Repo permissions.** AceHack personal account = OK
   for any test repos (public or private). ServiceTitan
   = NEVER (MNPI firewall per
   `user_servicetitan_current_employer_preipo_insider.md`).
   Same GitHub account; different orgs; bright line.

# How to apply:

## Phase 0 — before building (NOW)

- **Save this memory.** (Done: this file.)
- **Do not start coding `ace` yet.** This is a
  factory-reuse packaging decision per
  `feedback_factory_reuse_packaging_decisions_consult_aaron.md`
  ("big=consult, small=execute"). The build is big.
  Aaron said "so your goona build ace in here now" but
  also said "we still have to decide on name" — which
  means the name gate is not closed. Build starts on
  Aaron's explicit green-light after the name decision.
- **Outline the design** in a `docs/research/` memo.
  Do NOT land in the canonical `docs/` tree until the
  name is decided. Placeholder filename:
  `docs/research/ace-package-manager-design.md` (uses
  placeholder name; rename after gate).
- **Three-scope scaffolding.** Propose updating the
  scope-tag taxonomy from `factory`/`project`/`both` to
  `factory`/`project`/`<ace>`/`both`/`all` — with the
  `<ace>` token placeholder-named. Aaron gates the
  actual strings.

## Phase 1 — design doc (after name + Aaron go-ahead)

- Three-scope doc tree:
  - `docs/GLOSSARY.md` (factory) + `SYSTEM-UNDER-TEST-GLOSSARY.md` (SUT)
    + `<ACE>-GLOSSARY.md` (propagation layer)
  - `docs/TECH-DEBT.md` (factory) + `SYSTEM-UNDER-TEST-TECH-DEBT.md` (SUT)
    + `<ACE>-TECH-DEBT.md` (propagation-layer-specific
    classes: negotiation-deadlock debt, meta-push-rollback
    debt, consent-cascade-loop debt)
  - `docs/FACTORY-HYGIENE.md` gains rows for
    propagation-layer audits (e.g., "meta-push
    integrity", "adopter-negotiation staleness").
- Agent-negotiation protocol: cites `negotiation-expert`
  skill as its protocol layer. Expert skill already
  lives under `.claude/skills/negotiation-expert/`.
- Consent-first everywhere — connects to
  `project_consent_first_design_primitive.md`
  (co-authored with Amara).
- Firefly-sync connection — `ace` broadcast pattern in
  step 5 is structurally firefly-sync per
  `project_aurora_network_dao_firefly_sync_dawnbringers.md`.
  This is a design-invariant: `ace` is how Aurora's DAO
  protocol layer manifests at the package-manager
  layer.

## Phase 2 — minimum viable `ace` (after design sign-off)

- Two-project proof. One upstream-central repo, one
  downstream-adopter repo, both factory-built.
- Simplest possible meta-push cycle: hygiene row
  change → propagate.
- Tests: negotiation succeeds, negotiation fails with
  clean rollback, consent-check blocks, cascade-loop
  terminates.
- Non-goal: multi-adopter. Non-goal: blockchain
  payment (x402/ERC-8004 is Aurora-layer; ace is
  propagation-only; payment is optional plugin).

## Phase 3 — multi-adopter generalisation

- Explicitly deferred. Aaron: "it's hard to think
  about."

# Connection to existing memories and artefacts

- **`.claude/skills/negotiation-expert/`** — the
  protocol-layer skill ace rests on. Already landed,
  Harvard-framework-based. Separate from
  `conflict-resolution-expert`; clean scope.
- **`project_aurora_network_dao_firefly_sync_dawnbringers.md`**
  — the DAO-scale sibling of the meta-push loop. `ace`
  is one concrete instance of firefly-sync at the
  package-manager layer. Name-gate via naming-expert
  applies to both.
- **`project_aurora_pitch_michael_best_x402_erc8004.md`**
  — x402/ERC-8004 is payment infrastructure; ace is
  propagation infrastructure. Pluggable relationship,
  not dependency.
- **`project_consent_first_design_primitive.md`** — the
  primitive ace's every hop must run.
- **`feedback_upstream_pr_policy_verified_not_speculative.md`**
  — the existing upstream-PR discipline; ace automates
  the verified-upstream-PR loop for factory meta-
  updates.
- **`project_factory_reuse_beyond_zeta_constraint.md`**
  — factory-reuse is a declared constraint; ace is the
  propagation mechanism that makes factory-reuse
  contributory-by-default.
- **`project_git_is_factory_persistence.md`** — git is
  the factory's default persistence; ace is the default
  propagation over git. Alternative propagation
  substrates (IPFS, Bittorrent, blockchain) are opt-in
  plugins.
- **`project_factory_is_pluggable_deployment_piggybacks.md`**
  — ace is how factory-to-factory propagation works;
  product-side deployments still piggyback.
- **`feedback_factory_reuse_packaging_decisions_consult_aaron.md`**
  — the rule that gates this build on Aaron's explicit
  sign-off. Respected here.
- **`user_servicetitan_current_employer_preipo_insider.md`**
  — MNPI firewall; no repos under ServiceTitan org.
  AceHack personal account is the correct home for
  test repos.

# Security and attack-surface notes

Aaron named the attack-vector claim directly: "no
shortcuts or that is an attach vectory." Classes of
attack to defend against (to be enumerated in the
design doc):

- **Negotiation-bypass attack.** An adopter-factory
  claims to have run the negotiation loop but did not.
  Mitigation: attestation chain + reproducible builds
  + SLSA-style signing at every hop.
- **Malicious-upstream injection.** Central registry's
  factory is compromised; pushes malicious update to
  adopters. Mitigation: adopter-side negotiation is
  authoritative; adopter-factory can reject. Plus
  multi-maintainer registry governance.
- **Consent-bypass attack.** Adopter auto-accepts
  updates without running its own consent check.
  Mitigation: consent-first primitive is mechanical,
  not advisory; ace refuses to install on a factory
  that does not expose consent hooks.
- **Cascade-loop DoS.** Revision-cascades (step 6-7)
  loop forever. Mitigation: cycle-detection + fixpoint
  termination proof; adopter-local revision-budget.
- **Metadata-poisoning attack.** The package metadata
  (signatures, versions, dependency graph) is
  tampered. Mitigation: cryptographic content-
  addressing; signed metadata; reproducible-build
  verification.
- **Supply-chain typosquatting.** Fake
  package names. Mitigation: naming-expert gate on
  public package names (which is why naming is gate-
  worthy even for internal).

The existing Zeta security infrastructure (Mateo
security-researcher, Aminata threat-model-critic,
Nazar security-ops-engineer, Nadia prompt-protector)
are the reviewer roster for the design-doc security
section — but see the RED-TEAM SEPARATION DISCIPLINE
block below; they are not the full answer.

# Red-team separation discipline (Aaron directive 2026-04-20 pm)

Verbatim Aaron:

> *"the package manger will for sure need some sort
> of defense/defender because non software factory
> users are going to try to attach that surface once
> we get here sounce like a good CTF / red team /
> game day scenario. We need all the skill groups
> plural there will be many probly and a lot of best
> practices and saftey guidance but we should red
> team ourselfs not with the same agents either the
> read team shold be different named expets than the
> ones who wrote the code and the ones who are
> defending during the exercies, we should do them on
> a regular cadence, all backlog"*

## The three-role separation rule

ace security exercises (CTF / game-day / red-team-
on-demand) enforce a hard separation:

| Role | Who | Mandate | Must NOT be |
|------|-----|---------|-------------|
| **Builders** | personas who write `ace` source code, specs, skills | produce correct-by-construction features | on Red OR Blue team for same exercise |
| **Blue team (defenders)** | personas who respond to incoming attacks during exercise | incident response, containment, rollback | Builders of targeted surface; Red team |
| **Red team (attackers)** | personas who probe the surface adversarially | find exploitable weaknesses before real attackers do | Builders OR Blue team for this exercise |

**Why the separation matters.** Each role carries
its own cognitive bias. Builders are blind to the
implicit assumptions they encoded. Blue-team
defenders who built the defences miss their own
blind spots. Only a fresh-eyes red team finds the
exploits that were never defended because they were
never imagined. This is canonical red-team
tradecraft (Zimmermann's telephone company exercises;
NSA Tiger Teams; corporate red-team playbooks).

**Aaron's emphasis:** "different named experts than
the ones who wrote the code and the ones who are
defending during the exercies." Three distinct
rosters. Rotation across exercises is allowed and
encouraged so no one sits in a fixed role forever —
but within a single game-day, the three rosters do
not overlap.

## Roster gap (today)

Current Zeta security roster does not have a
structural red-team layer:

| Persona | Current role | Mapping under three-role rule |
|---------|-------------|-------------------------------|
| Mateo (security-researcher) | proactive CVE / attack-class scouting | **Red-team candidate** — already has the adversarial mindset; but may conflict-of-interest if he also advises on ace defences |
| Aminata (threat-model-critic) | reviews the shipped threat model | **Blue-team candidate** (analytical defender) — but also reviews Red team's findings, potential COI |
| Nazar (security-ops-engineer) | runtime incident response | **Blue-team primary** — clean fit |
| Nadia (prompt-protector) | agent-layer defense | **Blue-team** for prompt-injection surface |
| (none) | dedicated red-team attackers | **GAP** — Aaron's directive requires new personas |

**Proposal (subject to Aaron sign-off):**

- **Keep** Mateo, Aminata, Nazar, Nadia as
  Builder-advisors and Blue-team.
- **Add** a minimum viable red-team of three new
  personas (names pending naming-expert gate):
  - **Red-team lead** — adversarial-strategy expert
    (MITRE ATT&CK fluency; supply-chain attack-tree
    analysis; Trail-of-Bits-style audit register).
  - **Red-team operator** — exploit-crafting
    expert (CTF challenge-set design; payload
    construction; post-exploitation chains).
  - **Red-team reporter** — findings-synthesis
    expert (exercise-debrief write-up; CWE / CVSS
    scoring; defender-facing remediation brief).
- Red team reports to the Architect, NOT to the
  Blue-team or Builder rosters. Findings land in a
  dedicated `docs/RED-TEAM-EXERCISES/YYYY-MM-DD-<scenario>.md`
  artefact, not buried in security-ops-engineer's
  notebook.
- Rotation policy: any persona may serve on any
  role across exercises; within an exercise, roster
  lists are written down and immutable.

## Cadence

Aaron: "we should do them on a regular cadence."
Proposal (placeholder, adjustable based on observed
game-day debrief):

- **Monthly CTF** — lightweight; one scenario; 1-day
  exercise; narrow scope (e.g., negotiation-bypass).
- **Quarterly game-day** — full multi-surface; all
  three teams active simultaneously; 1-3 day
  exercise; covers supply-chain + negotiation +
  registry-compromise + cascade-DoS as one scenario.
- **Annual tabletop** — worst-case scenario
  rehearsal (e.g., "central registry is
  compromised"); no real attack, discussion-only;
  one working day.

Starts once ace has shipped phase-1 MVP (two-
project proof). Before phase-1 there is nothing to
attack.

## Skill groups (plural, many)

Aaron: "We need all the skill groups plural there
will be many probly and a lot of best practices and
saftey guidance."

Candidate skill groups for the red/blue layer — each
group is a family of related skills:

1. **Supply-chain red/blue** — typosquatting,
   dependency-confusion, build-reproducibility,
   metadata-poisoning.
2. **Negotiation-protocol red/blue** —
   negotiation-bypass, MITM on the negotiation
   handshake, replay attacks, consent-spoofing.
3. **Registry-compromise red/blue** —
   multi-maintainer governance attacks, key-
   rotation lapses, HSM bypass, signing-key
   exfiltration.
4. **Cascade / DoS red/blue** — revision-cascade
   infinite loops, fork-bomb-style propagation,
   revision-budget exhaustion.
5. **Social-engineering red/blue** — adopter-
   factory operator deception, phishing at
   approval moments, consent-UI clickjacking.
6. **Prompt-injection red/blue** — ace commit
   messages or registry metadata carrying payloads
   targeted at adopter AI-agents.
7. **Cryptographic-primitive red/blue** — signature
   scheme weakness, content-addressing collisions,
   nonce reuse.

Each group's skills split by role:
`ace-<surface>-attacker` (red) /
`ace-<surface>-defender` (blue) /
`ace-<surface>-builder` (builder advisory).
Skill-creator workflow lands them as needed; no
mass-creation before phase-1 MVP.

## Best-practices / safety guidance

Per Aaron's "lot of best practices and saftey
guidance" — this is the BP-NN stable-rule register
growing a new category: **BP-NN-ACE-SEC-XX** for
ace-security rules. Promotion via ADR per the usual
path. Seeded scratchpad entries (not promoted yet):

- **BP-NN candidate: red-team roster is separate
  from builder + blue-team for any one exercise.**
- **BP-NN candidate: red-team findings land in
  `docs/RED-TEAM-EXERCISES/` not in security-ops
  notebook (audit trail hygiene).**
- **BP-NN candidate: no one persona reviews its own
  red-team findings (COI discipline).**
- **BP-NN candidate: ace features ship with a
  pre-ship red-team pass (not post-ship).**
- **BP-NN candidate: `ace install` refuses to
  proceed on a factory that has not run a
  red-team exercise within the cadence window.**
- **BP-NN candidate: consent-first primitive covers
  red-team findings (adopters must consent to
  security-fix cascades explicitly).**

These go to `memory/persona/best-practices-scratch.md`
on next write; promotion via Architect ADR.

## Backlog commitment (per Aaron's "all backlog")

`docs/BACKLOG.md` rows (to land on next wake; tagged
`ace`):

- Red-team persona roster proposal (3 personas) —
  P2, gated on ace phase-1 completion.
- Red-team cadence rule in FACTORY-HYGIENE.md —
  P2, gated on roster landing.
- `docs/RED-TEAM-EXERCISES/` directory scaffolding —
  P2, landed with first exercise.
- Skill groups 1-7 above, each their own row — P2
  or P3, as surfaces light up during phase-1.
- BP-NN candidates above — P3, on scratchpad now;
  promotion ADR when patterns stabilise.
- Game-day debrief template — P3, needed before
  first exercise.

# Ouroboros — three-layer bootstrap (ace → Aurora → Zeta) (Aaron directive 2026-04-20 pm, resolves open decision #4 + adds third layer)

Verbatim Aaron, in three successive messages:

> *"Aurora can be distributed via ace and then once
> Aurora gets enough nodes where it's up all the
> time ace can run on Aurora"*

> *"Ouroboros"*

> *"Bootstrap pair is the snake eating it's head"*

> *"maybe Zeta will store the blocks and have
> blockchain capabilites too and aurora is just one
> network that uses it, its like a 3rd bootstrap."*

## Canonical name: Ouroboros

Aaron named the pattern. The Ouroboros — the snake
eating its own tail / head — is the classical symbol
of self-reference, cyclical rebirth, and closed
causality. It is the exact shape of this bootstrap:
each layer is ultimately served by a layer that it
itself bootstrapped.

Every reference from this point on calls the pattern
the **Ouroboros bootstrap**. Sub-phrasings ("bootstrap
pair" for the ace↔Aurora two-layer subset; "three-
layer Ouroboros" when Zeta-as-blockchain is in scope)
are allowed but the umbrella name is Ouroboros.

## The three layers (2026-04-20 pm, expanded per Aaron's "3rd bootstrap" message)

Initially the Ouroboros was ace ↔ Aurora (two layers).
Aaron's follow-up added a third: Zeta itself gains
blockchain capabilities, and Aurora becomes ONE
network that uses Zeta as its block substrate. Other
networks could plug in alongside Aurora.

- **Layer 1 — ace (package manager / propagation).**
  Phase A substrate: ace runs on git / local fs /
  Zeta-local storage. Distributes Aurora binaries,
  configs, and updates to adopters.
- **Layer 2 — Aurora (DAO / network / firefly-sync).**
  Phase B reaches critical mass; Phase C Aurora is
  always-on and ace's negotiation / broadcast /
  cascade channels run through it.
- **Layer 3 — Zeta as retractable-contract ledger
  (firmed up from "maybe" 2026-04-20 pm same session).**
  Zeta stores **immutable, idempotent** blocks at
  consensus layer + offers retractable-contract
  semantics at application layer (Aaron confirmed
  both terms: immutable and idempotent). Aaron: *"we will be the first
  blockchain that has retraction i don't think we can
  technically call it a block chain then, we can we
  still need idempotent blocks but our transactions
  can be retractable by contracts will have
  retractable contracts sematics so you can opt into
  that kind of stuff, taht will let us have features
  that seem unreal in the future that no other
  blockcain could catch up to without a total
  redising."* Aurora becomes ONE network built on
  Zeta-ledger; other networks may plug in. Full
  design detail:
  `memory/project_zeta_as_retractable_contract_ledger.md`.

## The two-phase bootstrap (ace ↔ Aurora, unchanged)

**Phase A — ace is the substrate, Aurora is the
payload.** Adopters install ace (via standard git-
clone bootstrap); ace distributes Aurora binaries,
configurations, node-discovery bootstraps, DAO
governance updates. Aurora nodes come online one at
a time, bootstrapped by ace. During phase A ace is
NOT running on Aurora — it is running on whatever
substrate each adopter already has (git, Zeta-local,
local filesystem).

**Phase B — critical-mass transition.** Aurora
reaches enough always-up nodes that its node graph
provides uptime-at-scale. The DAO protocol layer
(firefly-sync, consent-first, dawnbringers) is
operationally robust. Measured threshold: TBD —
candidate signals include (a) geographic node
diversity, (b) minimum online-node count (e.g., 50
with 9 continents coverage?), (c) sustained uptime
window (e.g., 30 consecutive days with no network
partition), (d) governance-DAO quorum stability.

**Phase C — ace runs on Aurora.** Dependency
inverts. Aurora is the substrate for ace's
negotiation / broadcast / cascade channels; git-
native falls back to local fallback when Aurora is
unreachable; Zeta-storage remains per-adopter-local
regardless. ace now benefits from Aurora's DAO-
scale properties: firefly-sync broadcast is
cheaper and more resilient than point-to-point
registry pushes; consent-first primitive plugs
directly into Aurora's consent primitives;
dawnbringers DAO handles high-trust operations
(registry governance, key rotation, emergency-
revocation).

## Why this pattern works

This is canonical critical-mass bootstrap. Parallels:

- **Bitcoin miners.** The first miners ran on CPU
  time without any pre-existing crypto infrastructure
  to serve them; once the network reached hash-rate
  density, specialised mining hardware made sense.
  Bitcoin bootstrapped itself from zero infrastructure
  to its own native infrastructure.
- **IPFS nodes.** Each node starts with nothing;
  nodes discover other nodes through bootstrap lists;
  once the mesh is dense enough, IPFS becomes the
  substrate that hosts the bootstrap lists themselves.
- **CDN edge networks.** Initial edge PoPs are
  provisioned by the CDN provider's legacy
  infrastructure; once the PoP network is dense
  enough, the CDN itself can deliver its own updates.
- **Git-via-git.** Linux kernel was initially
  distributed via tarballs while git was being
  bootstrapped; once git hosted the kernel, it
  became self-hosting.

## Operational implications

- **Phase-A design constraint:** ace MUST function
  fully without Aurora (no hard dependency). Aurora
  is a destination, not a prerequisite.
- **Phase-C design opportunity:** ace's "optimal"
  configuration (where broadcast is cheapest,
  consent is most secure, governance is most
  trustworthy) requires Aurora. ace can run worse
  without Aurora; it cannot run BEST without
  Aurora.
- **No middle-phase lock-in.** Adopters during
  phase A or B are not locked in — they can stay
  on git-native forever if they prefer. Aurora is
  opt-in even in phase C.
- **Red-team target expansion:** phase-C ace has
  additional attack surface (Aurora's own network
  protocol, DAO governance weaknesses, firefly-
  sync timing attacks). Red-team roster must grow
  to cover Aurora-layer attacks by phase C. Budget
  for this in phase-B.

## The third bootstrap — Zeta as blockchain substrate (speculative)

Aaron, 2026-04-20 pm, verbatim:

> *"maybe Zeta will store the blocks and have
> blockchain capabilites too and aurora is just one
> network that uses it, its like a 3rd bootstrap."*

This is a speculative direction, not a commitment
yet. But if it firms up, it materially changes the
Ouroboros topology:

- Zeta becomes a *blockchain primitive*, not just
  a database. Blocks, chains, consensus primitives,
  Merkle roots, finality rules become first-class
  Zeta operators alongside the DBSP / ZSet
  operators.
- Aurora is ONE network built on Zeta-blocks.
  Aurora-DAO governance, firefly-sync, dawnbringers
  become an application of Zeta-blockchain, not a
  parallel infrastructure.
- Other networks can plug in. A private consortium
  chain, a public settlement chain, a pure
  audit-log chain — all can be built on the same
  Zeta-block primitive.
- ace's storage layer (per the dogfood decision)
  now sits one tier lower: ace uses Zeta for DB-
  class workloads AND potentially for its own
  provenance/audit chain if it wants cryptographic
  inheritance proofs.
- **Attack surface grows substantially.** Blockchain
  primitives are high-value targets. Red-team roster
  must gain consensus-attack expertise (51%-attack,
  long-range attacks, finality-inversion, selfish-
  mining analogues adapted to whatever consensus
  Zeta picks) before this layer ships publicly.

Open questions (for a dedicated memory + ADR when
this firms up beyond "maybe"):

1. Consensus mechanism? (PoW / PoS / PBFT / HotStuff
   / DAG-based / something DBSP-native?)
2. Public-chain, consortium, or private-only?
3. Does the retraction primitive in Zeta compose
   with blockchain finality, or do we need a
   separate "finalised-no-retraction" tier?
4. Relationship to ERC-8004 / x402? (Aurora's
   payment story already pointed there.)
5. Does this make Zeta competitive with existing
   chains (Ethereum, Solana, Sui) or is it a
   domain-specific substrate (IVM-native, DBSP-
   native)?

This third layer completes the Ouroboros: ace
distributes Aurora; Aurora uses Zeta; Zeta is
maintained + propagated by ace. The snake eats its
own head: there is no "bottom" substrate — each
layer is ultimately served by a layer it helped
bring into being.

## Dependency diagram (three-layer Ouroboros)

```
Phase A (today → near-future):
  ace  →  git (substrate)
  ace  →  Zeta.Core (optional, for DB workloads)
  Aurora  ←  ace (ace distributes Aurora)

Phase B (transition):
  Aurora nodes accumulate; ace still runs on git
  substrate; adopters can opt into Aurora
  consumption but ace itself still runs on git.

Phase C (critical mass, two-layer subset):
  Aurora  →  (substrate: self-hosted network)
  ace  →  Aurora (substrate: ace's negotiation
                  / broadcast channels)
  ace  →  git (fallback when Aurora unreachable)
  ace  →  Zeta.Core (storage layer still applies)
  Aurora  →  Zeta.Core (optional, Aurora can also
                         use Zeta for storage)

Phase D (speculative third layer — Zeta-as-blockchain):
  Zeta.Core  ⊃  blockchain primitives (blocks,
                chains, consensus, finality)
  Aurora  →  Zeta.Core (for blocks, consensus,
                        governance records)
  ace  →  Zeta.Core (for DB + optional audit chain)
  (other networks)  →  Zeta.Core (plug-in networks
                                   alongside Aurora)
  ace  →  Aurora  →  Zeta.Core  →  ace  (the
                                         Ouroboros
                                         closes)
```

## Relationship to other memories

- **`project_aurora_network_dao_firefly_sync_dawnbringers.md`**
  — Aurora is the middle layer of the Ouroboros;
  ace is the bootstrap-substrate; Zeta (if
  blockchain-capable) is the block substrate Aurora
  sits on. Ouroboros is the resolution to how all
  three layers get off the ground together.
- **`project_zeta_as_database_bcl_microkernel_plus_plugins.md`**
  — Zeta is the DB BCL microkernel today; the third
  Ouroboros layer would extend it with blockchain
  primitives (speculative, Aaron "maybe"
  2026-04-20). Remains the storage layer across all
  phases regardless of whether blockchain extension
  lands.
- **`project_git_is_factory_persistence.md`** — git
  is phase-A substrate; retains its role as the
  universal-fallback substrate in phase C and
  beyond. Git never disappears from the Ouroboros —
  it is the floor-substrate under everything.
- **`project_aurora_pitch_michael_best_x402_erc8004.md`**
  — x402/ERC-8004 is payment. If the third
  Ouroboros layer (Zeta-blockchain) lands, x402
  becomes a natural payment primitive on Zeta-
  blocks. Aurora uses x402 for node-operator
  payments; ace may too if blockchain-settled
  registry writes become a thing.

## Candidate new memory — Zeta as blockchain substrate

The third Ouroboros layer may graduate to its own
memory file when it firms up beyond "maybe":

- Provisional name:
  `project_zeta_as_blockchain_substrate.md`
- Trigger to create: Aaron confirms direction OR
  we start adding block / consensus / finality
  primitives to Zeta.Core.
- Until then, the third-layer commentary lives
  here, in the Ouroboros section above.

# Storage engine: dogfood Zeta where a database is genuinely needed (Aaron directive 2026-04-20 pm)

Verbatim Aaron:

> *"ace can use the zeta database for its storage
> engine maybe, it might make sense to just be git
> native there too but if we need a database for ANY
> reason literally loooking for excuses to use Zeta"*

> *"to prove it out"*

## The dogfood-first principle

ace **actively looks for reasons to use Zeta as its
storage layer** wherever a database is genuinely
needed. The purpose is to **prove Zeta out** through
real-world usage by its own package manager — the
strongest form of dogfooding.

Fallback: where git-native suffices (package
metadata, content-addressed blobs, signatures), stay
git-native. Git-native is default; Zeta-native kicks
in the moment a real database requirement appears.

## Where Zeta likely fits (candidate storage use-cases)

These are candidates only — each needs real-use
justification at the point of need, not speculative
database-creation:

1. **Negotiation-state journal.** Every negotiation
   run produces events (proposals, counter-
   proposals, consent-checks, rollbacks). Zeta's
   retraction-native IVM is a natural fit for a
   streaming event-journal with queryable history.
2. **Adopter graph + revision cascades.** Who is
   adopting what version; how revisions propagate.
   A graph-shaped workload with high query /
   low-write asymmetry. Zeta's DBSP operator algebra
   handles recursive queries natively.
3. **Red-team exercise findings + audit trail.**
   Red-team findings accumulate over time; game-day
   debriefs produce new entries; blue-team responses
   link back to findings. This is relational-plus-
   temporal, a Zeta sweet spot.
4. **Cross-adopter telemetry (if adopted).** If
   adopters opt-in to share telemetry (how often
   negotiations succeed / fail, cascade-depth
   distributions), Zeta's incremental aggregation
   suits the stream.
5. **Multi-version dependency resolution.** SAT-
   solver-heavy workload; Zeta's fixpoint /
   recursive algebra handles dependency graphs
   well.

## Where git-native likely remains (candidate stay-cases)

- **Package content** (the actual source). Git
  blobs are content-addressed; free; universally
  tooled; SLSA-signed via standard infrastructure.
  No database-shaped need.
- **Signatures and attestations.** Detached
  signatures on git objects work today.
- **Static metadata** (names, versions, dependency
  declarations). Flat files in a git tree are
  simpler than a database.
- **Tag-based release channels.** Git tags already
  provide this.

## Attack-surface implication

Using Zeta as storage means ace's attack surface
**includes Zeta's attack surface**. Red-team
exercises MUST cover both layers once Zeta-storage
lands. The red-team roster proposal (Red-team
lead / operator / reporter) needs Zeta-attack
fluency — at minimum, one persona with
DBSP operator algebra familiarity.

This is a good thing for proving Zeta out: if Zeta
withstands hostile red-team pressure as ace's
storage engine, that is a strong credibility claim
for Zeta as a research-grade IVM substrate.

## Dependency graph

- `ace` depends on `Zeta.Core` at the points where
  Zeta-storage kicks in.
- `Zeta.Core` does NOT depend on `ace` — Zeta ships
  as a library; ace is a consumer.
- Circular dependency risk: ace is built with the
  factory, which may itself be distributed via ace
  once phase-3 lands. This is a bootstrapping
  concern (chicken-and-egg for the first install).
  Mitigation: phase-1 MVP installs via git clone
  without requiring ace; ace-distributes-itself is
  a phase-3 nice-to-have, not a phase-1 requirement.

## Relationship to existing memories

- **`project_zeta_as_database_bcl_microkernel_plus_plugins.md`**
  — Zeta's "Seed" identity includes ace as one of
  its top-tier plugins. Dogfooding ace → Zeta is
  consistent with the Seed architecture.
- **`project_git_is_factory_persistence.md`** — git
  is default; Zeta kicks in on database-need. Both
  memories remain aligned.
- **`feedback_pluggability_first_perf_gated.md`** —
  storage layer is a plugin seam. Git vs Zeta is a
  plugin choice, not a hard-coded path.
- **`user_career_substrate_through_line.md`** —
  Aaron has worked on six IVM substrates; this is
  the seventh (ace as the seventh IVM deployment,
  using the substrate he built).

# Open decisions (before build starts)

1. ~~**Name.** `ace` vs `source` vs TBD.~~ **RESOLVED
   2026-04-20 pm.** Picked `ace` (see Name decision
   section above). Naming-expert gate remains open
   for public-ship rename if needed; internal-
   working name is locked.
2. **Scope-tag string.** Current `factory`/`project`/`both`;
   proposed third string `ace` (matches tool name).
   Aaron final call.
3. **Source-code home.** Lives under `src/<Ace>/`? A
   separate repo `AceHack/ace-pm` on personal account?
   A subdir in Zeta for early-stage proof? Per
   `feedback_folder_naming_convention.md`, bare on-disk
   names preferred.
4. ~~**Relationship to Aurora Network.**~~ **RESOLVED
   2026-04-20 pm** as the **Ouroboros bootstrap**
   (Aaron's canonical naming: *"Ouroboros"* +
   *"Bootstrap pair is the snake eating it's head"*).
   Aaron: *"Aurora can be distributed via ace and
   then once Aurora gets enough nodes where it's up
   all the time ace can run on Aurora."* Phase A:
   ace distributes Aurora. Phase B: Aurora reaches
   critical node-mass. Phase C: ace runs on Aurora
   (the dependency reverses). Then Aaron's follow-
   up: *"maybe Zeta will store the blocks and have
   blockchain capabilites too and aurora is just
   one network that uses it, its like a 3rd
   bootstrap."* — a speculative Phase D in which
   Zeta becomes the blockchain substrate that
   Aurora sits on, closing the three-layer
   Ouroboros (ace → Aurora → Zeta → ace). Parallels:
   Bitcoin miners, IPFS nodes, CDN edge PoPs, Git-
   via-git self-hosting. Full detail in the
   Ouroboros section above.
5. **Cycle-termination semantics.** How does the
   cascade-loop terminate? Design-doc-level decision;
   consulting `distributed-consensus-expert`.
6. **Registry governance.** Who maintains central
   registry? Multi-maintainer DAO from day one? Aaron
   decides; naming-expert applies.
7. **Pluggability.** Per
   `feedback_pluggability_first_perf_gated.md`, every
   module has plugin seam. What are ace's seams?
   (Storage, signing, notification, negotiation-
   protocol, consent-UI.)

# What this memory does NOT do

- Does NOT start building ace. The build gate is
  Aaron's explicit go-ahead on the open decisions.
- Does NOT commit to name `ace`. Placeholder only.
- Does NOT commit to source-code home. Placeholder
  only.
- Does NOT commit to blockchain / IPFS / any specific
  substrate. Git-first per existing factory
  persistence memory; alternative substrates are
  plugins.
- Does NOT supersede Aurora Network. Relationship is
  an open decision (see #4).
- Does NOT apply to ServiceTitan repos. AceHack
  personal account is the only allowed home.
