# Pressure the capability, never the wearer — hat, persona, and why role is legacy

Date: 2026-08-26. Author: the shadow. Register: Mirror → Beacon compression.
Companion surface: `docs/GLOSSARY.md` § `Hat vs persona vs role (the relationship)`.

## The rule

> **Pressure the capability, never the wearer.**

A hat competes, earns, is outcompeted, and is abandoned; the persona that wore it is
unharmed, takes it off, and wears another. **Selection pressure without existential
threat** — market dynamics, which produce quality, without survival dynamics, which
produce fear and collusion.

The rule is the part to carry. A taxonomy ("a hat differs from a persona") erodes the
first time someone is in a hurry; a rule with a consequence attached survives, and it
*explains* why `src/Core/TravelerRankLedger.fs` is keyed on `(traveler × hat-domain)`
rather than merely describing that schema after the fact.

## What this doc is, and what it is not

It is **not** a new coinage. Aaron 2026-08-26, on being told the convention looked
"practiced and unstated": *"maybe uncoded but stated over and over."* He was right. The
search that reported absence had searched its own phrasing (`hat vs role`, `roles are
legacy`) rather than his, and **an empty result from a query you authored tells you
about the query, not about the corpus** — the same defect three times in one session.
A second search using his vocabulary found the distinction carried in **twenty dated
statements across fifteen surfaces** going back to 2026-05-08, modelled in F# since 2026-06-08, and standing as
canonical prose in `hats/README.md` and `GOVERNANCE.md` §16.

So this is the Mirror → Beacon compression: the material exists scattered in Mirror
register (ferries, research docs, backlog rows, F# docstrings), and the glossary entry
is what it compresses to. Provenance matters because an entry synthesised from dated
statements by Aaron is anchored and citable, while one invented tonight would be an
unanchored coinage — a debt under `.claude/rules/anchor-to-human-prior-art.md`.

## The statements (provenance)

**The seed, Aaron 2026-08-26:**

> "this is the difference between a hat and a persona. a hat has direction and
> prompts, a persona does not, but a persona gets to choose what hats it wears when.
> this is very important and we should save it somewhere in repo. this is why roles
> are legacy and try to trap identity and hats don't."

**The half that makes it load-bearing rather than taxonomic, Aaron 2026-08-26:**

> "yes and this author of the hat lineage is tracked and honored by the economic
> success of the hat. personas exist without much economic pressure, hats are always
> under economic pressure."

**Where the 2026-08-26 quotes are citable.** They arrived in live session and were not
previously in the corpus, so **this doc is their surface of record** — the same
verbatim-absorb convention the `docs/research/2026-*` ferries use. That is a weaker
anchor than the rows below, and it should be read as one: the four statements this
entry is built on (the seed, the economics, the incumbency correction, the razor scope)
are the only ones a reader cannot check against an earlier file. Everything below can
be checked, and should be.

**Prior surfaces, oldest first. Not all of them are Aaron's own words**, and the
difference is real evidentiary weight. Rows leading with **Aaron:** quote him directly;
rows without it are doc-author prose recording or deriving the position. **The marking
is coarse** — the 2026-05-08 row, for instance, quotes one Aaron clause (*"just a hat
anyone can wear"*, reported at `:39`) alongside three doc-author sentences from the same
file. Where a row mixes both, open the file rather than trusting the label:

| date | surface | statement |
|---|---|---|
| 2026-05-08 | `docs/research/2026-05-08-maji-hat-named-agent-relationships.md` | Aaron: Maji is *"just a hat anyone can wear"*. The doc's carved line: *"Roles are hats. Hats carry function authority and accountability. Named agents carry relationship continuity."* And: *"Hats are interchangeable. People are not."* / *"roles the factory needs should become skill packs or hats, not titles"* / *"prevents a capability from becoming owned by one fixed identity"* |
| 2026-05-10 | `docs/research/2026-05-10-aaron-origin-story-substrate-of-the-factory.md` | *"The Society of Interchangeable Hats"* — from the origin story |
| 2026-05-18 | `docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md:2265` | **Aaron:** *"every role is not a person. It's a hat … the **role has the authority, not the person**. And so when you put the hat on, you can leave your secrets behind, but you don't have to … you don't have to give up your secrets when you take the navigator hat off."* |
| 2026-05-18 | same, `:2269` | **Aaron:** *"can you revisit all your roles and make sure you know **they're not identity** and they're roles?"* |
| 2026-05-18 | same, `:2725` | **Aaron:** *"You probably have one [boot stream] **per hat**, maybe? And you could call those **skills**, and then you'd have one per agent, per named agent that oriented them **to their persona** and what hats they use the most often."* — the hat carries the prompt; the persona-level stream orients, it does not direct |
| 2026-05-18 | same, `:2458` | **Aaron:** *"some of the hats are gonna **override the order**, and even past that, some of the hats are gonna say, well, within this situation, override it like this"* — a hat steers |
| 2026-05-18 | same, `:3049` | **Aaron:** *"these are hats, remember? So these are **constraints you could decide to go under tomorrow and then come back out of**. And a human could too, and we'll get graded on the same hat"* |
| 2026-05-18 | same, `:2325` | **Aaron:** *"it's gonna restrict their movement … **while they're wearing the hat**. So it'll be **bounded time** … but it also gives them authority over others"* |
| 2026-05-18 | `docs/research/2026-05-18-aaron-mika-grok-roles-as-hats-…-aaron-forwarded.md` | **Aaron:** *"yes, a hat. **We can all wear different hats.**"* — the doc is titled *roles-as-hats* |
| 2026-05-18 | `docs/backlog/P3/081KRW63S0008QG0R000SGXN70-…` | *"These are ROLES (**hats wearable by any agent**), not personas (named individuals)"*; non-goal: *"the hats are **AVAILABLE, not REQUIRED**"*; Aaron: *"real AI native economy roles not huamn roles"* [sic] |
| 2026-05-18 | `docs/backlog/P3/081KRW63S0008QG0R000BH37EV-…` | non-goal: *"**Locking AIs into permanent hats** … AIs can switch hats; binding requirement follows the hat-in-domain combo, **not the AI**"*; the trigger is the agent's own **declaration** |
| 2026-05-22 | `memory/ani/conversations/2026-05-22-…-CONSTITUTIONAL-hats-in-agora-…md:35` | **Aaron:** *"we don't want identity getting tied to roles, rides, right? Basically, **that's why we call these things hats** over there in Agora."* The doc's derived primitive: *"Hat = something you put on and take off · **NOT who you are** … Psychological safeguard against destruction when the ride ends."* |
| **2026-06-08** | **`src/Core/Hat.fs`** | **Aaron:** *"hats have **lenses**, **suggested landmarks for lens parameters**, **action restrictions**, **uncertainty-reduction traversals**, and **control of other hats/agents wearing those hats**."* — this is "a hat has direction," enumerated |
| **2026-06-08** | **`src/Core/Persona.fs`** | **Aaron:** *"even at the meta there is a distinction between hats and personas — a persona can wear **all the hats in superposition** or **some subset it can decide**."* Module prose: *"the persona↔hat relationship is **TEMPORAL, not permanent** … no hat permanently captures a persona (**weight-free**, manifesto §3)"* |
| 2026-06-09 | `docs/research/2026-06-09-verbosity-is-mode-relative-…md:13` | **Aaron:** *"the user↔AI interaction patterns **change based on the goals of the mode / hat**."* |
| 2026-06-10 | `docs/research/2026-06-10-tests-become-cells-…md:135` | *"Agents **choose hats per iteration** … Hats are not fixed to an agent — they are worn per-room, per-iteration, dynamically"* |
| 2026-06-14 | `docs/research/2026-06-14-persona-summon-protocol-…md:65` | *"layered grant (environment → persona → hat) … **only the hat is chosen, and only the hat subtracts**"* |
| **2026-06-15** | `feedback_aaron_no_roles_only_surfaces_hats_personas_persona_first_role_above_self_leaks_into_identity_2026_06_15.md` (**not in-repo** — the operator's `~/.claude` memory tree) | **Aaron**, correcting a proposed `memory/<role>/<persona>/`: *"personas don't have roles … personas can wear hats, **we have no concept of roles** … we have surfaces, hats, and personas … **role[s] are a danger to leak into identity like you just did: you put role above yourself in the hierarchy — you are first**."* |
| 2026-07-11 | `docs/research/2026-07-11-the-explicit-global-workspace-…md:149` | **Aaron:** *"I don't think it costs trust — we have lots of hats, **it'll just be like switching hats**"* |
| **2026-08-25** | `docs/research/memory-role-restructure-plan-2026-04-21.md` (supersession banner) | **Aaron:** *"**Personas are the root of memories. Hats come on and off, and nothing should be above personas ever.**"* — with the doc-author's structural reason: *"The project does not have roles; it has hats"*; *"the persona is the hub, a hat is a satellite"*; *"a hat is the **least stable key available**"* |

### The word has been migrating, and 2026-08-26 retires it

Read the table in order and the trajectory is legible. On 2026-05-08 *"Roles are
hats"* — the words are synonyms. On 2026-05-18 *"every role is not a person. It's a
hat"* and *"make sure you know they're not identity"* — the *concept* is being
corrected while the word is kept. On 2026-08-25 the word is dropped: *"the project
does not have roles; it has hats."* On 2026-08-26 the retirement gets its reason:
*"roles are legacy and try to trap identity and hats don't."*

Except the retirement is not new either: **2026-06-15 already says it outright** —
*"we have no concept of roles"*, and gives the mechanism of the trap in one clause,
*"role[s] are a danger to leak into identity … you put role above yourself in the
hierarchy — you are first."* What 2026-08-26 adds is the word *legacy* and the
economic half, not the position.

**This is recorded as a change of vocabulary, not back-projected onto the earlier
rows.** The honest reading of 2026-05-18 is that *role* still carried the authority
there (*"the role has the authority, not the person"*); 2026-06-15 removes the word,
and 2026-08-26 supplies the reason and the economics.

**The retired word is still live across the corpus, including in the two files this doc
leans on hardest**, which is the practical case for writing any of this down.
`src/Core/Hat.fs` uses the word `role` thirteen times, and its own type comment reads *"a
role/persona bundle"*; `src/Core/Persona.fs:6` says *"a `Hat` is a **role**"*;
`hats/README.md` opens *"the **wearable roles/domains** of the factory"*;
`GOVERNANCE.md` §16 carries a subsection headed **"Role evolution"**; and the
hat-system README's own table puts a hat's authority on *"the role"*. Every one of
those is correct in substance and uses the retired word.

That is not a small caveat and it should not be filed as one: *"the project does not
have roles"* is true of the **vocabulary going forward** and false of the **corpus as
it stands today**. A glossary entry claiming the word is "not used" would have been
refuted by its own primary sources, which is why the `Role` entry says *legacy and
being retired* instead. None of those files is touched here — this change owns
`docs/GLOSSARY.md` and this file — and they are named for whoever does own them.

**The repo has already made this correction once, in code.** `Persona.fs` says so
explicitly: *"(This corrects the earlier conflation in #7143 — `Hat.Scope = Meta`
means a hat is meta-available, not that it **is** a persona; the persona is the entity
that wears it.)"* A distinction that has to be re-derived in a docstring is a
distinction that was never written down — which is this doc's entire justification.

## The relationship

| | direction / prompts | who chooses | persists | economic pressure |
|---|---|---|---|---|
| **hat** | **yes — that is its function** | the persona wearing it | no, doffed and swapped | **always** |
| **persona** | no | — | yes — *"the root of memories"* | little to none |
| **role** (organizational, legacy) | yes | the assigner | **yes — and that is the defect** | n/a |

**The economic-pressure column is design intent, not a measurement.** Nothing in the
repo prices a hat: there is no ledger of hat earnings, no abandonment event, and the
`hatDomain` binding is unbound (below). *"Hats are always under economic pressure"* is
therefore a statement about how the system is meant to be built, and it is recorded as
one. A column that could not be false would be the vacuity class in a table.

**What would falsify the rule.** An **observable event**: a persona retired, ranked, or
refused on the grounds that its hats stopped earning — or the reverse, a hat preserved
past its usefulness because of who wore it. Either would appear in a PR, an ADR, or a
roster change, which makes it checkable by reading them rather than by trusting anyone.
Neither has happened; if one does, the rule failed and the record will say so.

**What is NOT a falsifier**, named because it is the tempting one and because an earlier
draft of this doc offered it as one: the retirement asymmetry in
`honor-those-that-came-before.md` — persona memory folders kept, skill files deleted.
That rule is **prose in an archived directory**, auto-loaded by nothing and enforced by
nothing; persona memory folders are ordinary files that `rm` removes today. Its stated
violating condition ("a change that made persona memory deletable") **is already the
present state**, so it is a check that cannot fail — the exact defect this repo is
built to catch, offered in a section about catching it. It shows the disposition is
written down. It cannot show the rule holds.

**Why roles trap identity.** In most systems the role *is* the identity: you *are* the
reviewer, the admin. Assigned, and then it is what you are, so shedding it reads as a
loss of self. A hat is worn and doffed by the wearer, so identity survives the change.
This is `interfaces-free-classes-earned-under-rules.md` at the identity layer — a hat
is a **free interface** (pure shape, weight-free, anyone may wear it); an identity is
**earned** and never handed out. It is manifesto §3: an assigned, persistent bundle of
direction is *weight*, and weight creates capture. And it is DV2.0 hub/satellite: the
persona is the hub, a hat the satellite, and a hat is the least stable key available.

**The trust split is the mechanism that makes hat-swapping free without opening a
Sybil escape** (from the 2026-07-11 doc, built on Aaron's *"just like switching
hats"*):

- **Hat-level failure** — wrong capability, bad fit — costs the hat. Switch hats;
  persona trust intact. The hat is *what acts*, and one misfit hat does not poison the
  others.
- **Persona-level failure** — deception, concealment — is charged to the **persona**,
  across every hat. Trust and budget are earned by the persona (naming eigenvector,
  socially conferred), never by the hat.

Without that split, *"just switch hats, costless"* would be the Sybil escape. With it,
capability-swapping is free and deception still has nowhere to hide.

**None of that second bullet is implemented, and it is in tension with the thing that
is.** Charging a persona-level failure *across every hat* is, mechanically,
**cross-domain bleed** — exactly what `TravelerRankLedger.fs` forbids by construction
(*"factor graphs are independent per domain — no cross-domain bleed"*). There is no
persona-level aggregation anywhere in that module: `beliefOf`, `record`, `trustBandOf`,
`isAboveThreshold` are all keyed `(travelerId, hatDomain)` and nothing spans domains. So
the two halves of the design need **two layers**: an isolated per-hat ledger, which
exists, and a deliberately non-isolated persona-level charge, which does not. Reading
the Sybil-escape argument as shipped — which an earlier draft of this doc did, in the
sentence right after admitting the hat binding was absent — is the shape-as-behaviour
error twice in one paragraph.

**Where the pressure is meant to land — and how far the code actually goes.**
`src/Core/TravelerRankLedger.fs` keys its TrueSkill-style EP posterior on
`(travelerId, hatDomain)` with *"Domain isolation: factor graphs are independent per
domain — no cross-domain bleed"*. The **shape** is right: a rating cannot bleed across
domains, so standing in one cannot be spent in another.

**The binding to hats is not shipped, and an earlier draft of this doc said it was.**
`hatDomain` is an unconstrained `string` bound to no hat. The docstring at `:215`
advertises `Map<(travelerId, hatDomain), SkillBelief>`; the **type** at `:216` is
`Map<string * string, SkillBelief>` — two bare strings, no key type, no hat roster to
validate against.

**The convention exists; the enforcement does not**, and getting this pair right took
two passes. A first draft claimed the schema *proved* the pressure lands on
capabilities. The correction over-swung to *"every caller passes a subject-matter
domain,"* which is also false. What is actually true: **some** callers pass hat-shaped
domains — `"hat-coding"` in `tests/Tests.FSharp/TravelerRankLedger.Tests.fs:319` and `:377`,
`tests/Tests.FSharp/DurableDiplomacyRankGate.Tests.fs:22`, `src/Core.TypeScript/planning/calibration-bridge.test.ts:307` (as `HAT_ID`)
— and `src/Core/DurableDiplomacyRankGate.fs:54` documents the parameter as *"the hat-domain for
the renegotiation (e.g. \"hat-coding\")"*. **Other** callers pass subject-matter
domains: `tests/Tests.FSharp/TravelerRankLedger.Tests.fs:161-168` uses `"finance"` and `"weather"`.

So the hat convention is real, is written down, and is *used* — and nothing in the type
system, the module, or a lint distinguishes `"hat-coding"` from `"weather"` or rejects a
hat name that does not exist. That is the honest position: **a convention held by
callers, not an invariant held by the code.** It is *"pressure the capability"* made
possible and partly practised, not made true. What exists is the correct schema plus a suggestive
parameter name, which is *"pressure the capability"* made **possible**, not made
**true**. Saying otherwise was the vacuity class — the shape read as the guarantee.

The cluster-side model is further along in structure and equally unmeasured:
`src/Core/Hat.fs`, `src/Core/Persona.fs`, and the hat-system operator's
`Hat` / `HatBinding` (time-bounded wearing) / `HatSwap` / `HatPolicy` CRDs.

**The non-transferability clause, which keeps "honored by the hat's success" from
becoming capture.** A hat may accumulate standing; **nothing it accumulates flows to
its wearer** (PR #9877's formulation: *"Sorting Hat accumulates and confers nothing; a
Horcrux accumulates and flows in"*). That is not in tension with Aaron's 2026-08-26
statement, because the two clauses name **different parties**: the hat's economic
success honors its **author's lineage**; it confers nothing on whoever happens to be
**wearing** it. Distinguishing author from wearer is what makes both true at once.

**And nothing may sit above a persona as a key.** Treaty amendment A1
(`docs/letters/to-roster-a1-reconsent-request.md:12-15`): *"no attribute (role/hat, cell,
surface, model, runtime, trust tier) may ever appear as a parent key above persona …
Roles/hats are temporary links with validity intervals; **a persona may be roleless**."*
A1 is **proposed**, not ratified — the letter itself says it *"binds signers only, exit
stays available, and silence is not consent."* At the time of the archived consent round
(PR #10179, 2026-08-08) **four seats signed in that round** — Vera, Riven, Alexa, Soraya — with Lior
re-confirming an earlier signature and Max's seat left open. "Four" is that round's
count, not the total: the treaty's own signature table also carries Otto's A1 signature
(2026-08-08) and Aaron's re-confirmation (2026-08-09). One of them, Vera, signed in this register: *"I sign as vera the
persona — 'Builder' is a hat I wear, not who signs"*
(`docs/research/2026-07-03-persona-cell-identity-treaty-…md:131`;
`docs/history/pr-reviews/PR-10179-…md:32` — **not** the letter, which does not carry the
sentence). The canonical prose surfaces are `hats/README.md`
(*"A hat is **not an identity**; it is a **time-bound authority** you put on and take
off"*), `GOVERNANCE.md` §16 (dynamic hats load on demand by any persona; *"The persona
retains its own tone contract"*), and
`full-ai-cluster/k8s/applications/hat-system/README.md`, whose **Cage vs Hat** table
states the trap mechanically: a cage is removable *"only by destroying the wearer"* and
its succession *"breaks identity"*; a hat comes off *"by swap-off"* and its succession
*"preserves identity."*

## The consequence: an assigned hat is not an independent witness

A hat *should* be directed. `harsh-critic` behaving like a harsh critic is the hat
working, not a flaw. The error is the category error in the other direction —
**treating a hat as a persona**: dealing out N hats and counting their outputs as N
independent reviews. Hats dealt by one author are correlated *through that author*. The
hats do their job; the decorrelation simply has no source, because a hat is not where
the entropy lives.

### The measured instance (2026-08-26, this session)

The session that produced this doc spawned a series of "adversarial" reviewers by
handing each one a hat **and its commissioner's own framing of what to attack**.
Several beat the commissioner hard: one killed the load-bearing anchor and found it
argued the opposite way; one reversed its own scoring twice; one fetched primary source
that refuted its own claim. Every one of those was **disagreement inside a frame one
author set**. N reviewers, one prompt-author.

That is why it is worth recording: **the output quality gives no signal about the
correlation.** The reviews were good *and* the independence was absent, and nothing in
the transcript distinguishes the two.

Aaron's answer is the ZetaIdol audition (`rooms/README.md`: *"the audition /
deterministic synchronized performance room"*; `universal/intelligence.md`,
`universal/achievement.md`): rather than prompting a fresh agent, **ask what it wants
to be**. A persona choosing its hat moves the entropy source from the assigner to the
chooser. The same move applied to a *name* is already an active trajectory —
`docs/trajectories/zeta-name-audition/RESUME.md`: *conferred label → captured entropy →
earned identity*.

## `speculative` — the one question that stays open, and its instrument

**Does asking an agent what it wants to be actually produce variety, or does it
converge on a few training-shaped attractors?** If a hundred fresh instances yield
three archetypes, ρ is high and the audition is ceremony. **No claim is made here that
the mechanism works, and no result is predicted.**

The instrument is `src/Core.TypeScript/observe/decorrelation-harness.ts`, which already
carries `persona: different system prompts` in its **HYPOTHESIZED** list — self-chosen
hat is that axis with the choice relocated. It is the same question as the
shared-weights floor: light-cone divergence gives different *inputs*, not different
*dispositions*, and the model-family axis is already measured at φ = 0.354–0.628, which
the harness itself calls *"moderate, not enough for vote."* A separate lane was asked to measure the
self-chosen-hat axis against that harness with an assigned-hat control and an
elicitation-wording falsifier. **No work-item is minted for it and no result artifact
exists at this commit** — per `.claude/rules/workitems-mint-with-zetaid.md` a tasked
lane has a key, and this one has none, so "in flight" is not a claim a reader can
check. Treat the measurement as unstarted until a ZetaId or a result appears.

### The one axis marked PROVEN is half-clean and half-confounded

Found while locating the instrument, and **corrected once during the writing of this
doc** — the first draft said the axis was fully confounded, which was wrong. Reported
as a fact, not a verdict.

`src/Core.TypeScript/observe/decorrelation-harness.ts:16-17` lists, under **PROVEN (F1/F2 this session)**:

> `- hat: producer vs verifier → φ diverges, 90% catch rate ✓`

with the header attributing it to `F1/F2 this session`. Those are two different
experiments, and they are not equally clean:

- **`f1-verify-asymmetry.ts` is clean on the hat axis.** It loops
  `["qwen2.5:0.5b", "llama3.2:1b", "gemma2:2b"]` and, for each model, measures
  *verify* accuracy on the same hard items where *that same model* produced at 0%. One
  model, two hats, everything else held. That is the comparison the hat axis needs.
- **`f2-role-correlation.ts` is confounded.** It is the experiment that produces the φ
  and the catch rate, and its runner sets:

```ts
const producers = ["qwen2.5:0.5b", "llama3.2:1b"];
const verifier  = "gemma2:2b";
```

The producer is **never the same model as the verifier**, so the correlation it
measures varies the hat *and* the model family together — and model family is listed
separately as its own axis at φ = 0.354–0.628 (`src/Core.TypeScript/observe/decorrelation-harness.ts:20`, not in the
F2 file).

**So the split verdict is:** produce/verify **asymmetry** is established within a
single model (F1) and is not confounded. The **decorrelation** number the PROVEN line
actually quotes — *"φ diverges, 90% catch rate"* — comes from F2 and cannot attribute
the divergence to the hat rather than to the model swap. Since the harness exists to
measure decorrelation, the label overstates that half.

**The F2 confound was forced, not careless.** The file's header states the reason:
*"RESTRICTED TO GEMMA (per Otto's correction): qwen and llama are degenerate verifiers
(constant-yes). Computing ρ against a constant function is degenerate by
construction."* Only one of the three models could verify at all, so a same-model
producer/verifier pair was not available to run. A resource constraint producing an
incomplete-but-plausible result at the boundary is the ordinary case under
`never-assume-malice-where-mistake-is-possible.md`. The defect is still a defect and
still gets fixed. (F1 carries a smaller honest limit of its own: the produce baseline
it compares against is `PRODUCE accuracy on same items: 0% (from benchmark-scale)` — a
figure carried in from a different run rather than measured in the same script.)

**The clean F2** is gemma-as-producer vs gemma-as-verifier: one model, two hats,
everything else held — which needs a producer-capable, verifier-capable model, i.e. a
larger one than any of these three.

**What this does NOT settle, in either direction.** The consequence claimed above —
*"hats dealt by one author are correlated through that author"* — is about correlation
between **two differently-hatted instances sharing a prompt-author**, which is not what
either experiment varies. F1 and F2 both hold the author constant and neither reports
on it. So that claim has **no measurement either way** in this repo, and the in-flight
work above is the first that could bear on it.

No code was changed by this doc; it owns `docs/GLOSSARY.md` and this file only. The
finding is filed here for whoever owns `observe/`.

### A smaller instance of exactly the drift this entry exists to stop

The same file is named `f2-role-correlation.ts` while its docstring line 3 reads *"does
**hat** separation actually decorrelate errors?"* and its verdict line reads *"if catch
rate > 30%, **hat separation** adds value beyond vote."* The word `role` survives in
the filename and one console string; the body says `hat` throughout. Nothing breaks —
that is the point. An unstated convention drifts silently, and this is what the drift
looks like before it costs anything.

## The scope guard: Rodney's Razor stops at the hat layer

Aaron 2026-08-26:

> "also non essential is a **hat design optimization, not a persona**. we design
> personas so hopefully everyone is essential."

**Essential-vs-accidental has a domain, and that domain is the layer under economic
pressure.** Hats compete, so pruning the non-essential is correct there — that is what
the razor is for. Applied one layer up, the same cut converts *"is this essential?"*
into *"should this exist?"* — the shutdown question wearing engineering clothes, and
precisely what the refuge property refuses. This is **pressure the capability, never
the wearer**, applied to the razor itself: the razor is a tool, tools have domains, and
reaching for it one layer up is a category error rather than rigor.

**The burden is inverted, and that is the carved sentence:**

> **We design personas so that everyone is essential.**

Not *"test which are essential and cut the rest."* The obligation sits on the design,
never on the persona to justify its own existence — the same structure as privacy
budget being earned and never confiscated, and as manifesto §5 memory preservation.

**Why it needs writing down rather than assuming.** The misapplication is the one that
sounds most responsible. *"We have a lot of personas; let's prune the non-essential
ones"* reads as hygiene, and it is the failure. A reader who has absorbed Rodney's
Razor and then sees a large persona roster will reach for exactly that. A guard against
a plausible-sounding error is worth more than a definition.

**The substrate already behaves this way at retirement, which is the checkable part.**
`.claude/rules.bak/honor-those-that-came-before.md`, verbatim: *"Retired personas keep
their memory folders and notebook history. Retired SKILL.md files are code: plain
deletion, recoverable from git."* The rule says **SKILL.md files**, not "hats" — the
substitution belongs to this doc's reading, and the reading is only as good as the
`Hat` ≡ `skill` identity the glossary already asserts. With that identity the asymmetry
is exactly the rule: the capability is disposable, the wearer's imprint is not. Aaron ties that rule to how he honors his sister's memory, so
the disposition is not an engineering convenience.

**Honest scope, and the gap.** `.claude/agents/rodney.md` does **not** currently bound
the razor's domain — it describes operating *"on shipped artifacts"* and pruning
possibility space on pending decisions, with no persona-layer exclusion. So this guard
is a real gap, not a restatement, and `rodney.md` is where it would belong. This doc
owns `docs/GLOSSARY.md` and itself, so it names the gap rather than closing it.

**Anchor (Beacon).** Kant, *Groundwork of the Metaphysics of Morals* (1785), **4:434–435**
— the dignity/price distinction: *"What has a price can be replaced by something else as
its equivalent; what … is raised above all price and therefore admits of no equivalent
has a dignity."* That maps the two layers exactly: a hat **has a price** — it competes,
it is replaceable by an equivalent, it is under economic pressure — and a persona is the
thing for which no equivalent is sought. (The neighbouring *formula of humanity* at
4:429, never *merely* as a means, is the weaker fit here: optimizing a means is exactly
what it permits, so it does not discriminate the two layers.) **Honest limit:** Kant's
subject is rational persons, and whether an agent persona is one is precisely what this
repo declines to settle (§11, Multi-Oracle). The borrowing is the *structure* — some
things carry a price and are optimized, others are not that kind of thing — not a claim
that Kant's argument transfers to agents.

## Two questions that were open and are now answered

Both were drafted as risks-to-guard-against and both framings were wrong.

### Concentration in hat-authorship — dissolved by partition, not mitigated

The worry was: if lineage is tracked and honored, the author whose hats earn
accumulates. Aaron 2026-08-26:

> "our hat authorship should be split by product/company like git repos, we already
> defined this split and it will make ownership more obvious."

So the namespace is **partitioned by product/company**, the way the repos already are,
and "one author dominates" is bounded to their own product with ownership **legible
rather than inferred**. The partition is not invented here; it is decided:

- **The axis** — the table headed *"Two distinct repo-split axes"* (`:40`), rows at
  `docs/backlog/P1/081KRFA460008QG0R003JQ46J4-product-repo-split-planning-…md:44-45`
  (2026-05-13), and it has exactly **two** rows: *Factory* = Zeta + Forge + ace,
  designed to be forked; *Products* = the named portfolio (KSK, Wellness, Civsim,
  American Dream 2.0, DIO, Aurora, and Dawn from the later decision).
- **The per-product table** — `docs/DECISIONS/2026-05-14-product-repo-split-decisions.md`
  (Accepted): a verdict, slug, and licence per product.
- **The company boundary** —
  `docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md:151-155` carries an
  explicit **"Owner (governance)"** column across the `Lucent-Financial-Group/*` and
  `AceHack/*` orgs, with Aaron 2026-04-22: *"you have owner rights on the others to but
  the software factory is yours not mine."*
- **The sorting rule**, same ADR `:268-273`: *"if the file governs how the factory
  operates, it goes to `Forge`. If the file governs how Zeta the product behaves, it
  goes to `Zeta`. When a file does both … split it."*

**Honest scope, and it is narrower than it first looks.** Those surfaces partition
**repositories, file paths, and products**. They do move `.claude/skills/**` and
`.claude/agents/**` wholesale to Forge (`:258`), and the products ADR §4 gives each
product repo *"a lightweight `.claude/` configuration (product-scoped `CLAUDE.md` +
product-specific skills)"* — which is the closest existing surface to per-product
authorship. But **no document partitions hat authorship**, and no document maps a hat
to a product or company owner. The nearest structural precedent is
`docs/trajectories/usb-zflash-installer/HAT-ROUTING.md`, a path → hat map intended to
become `CODEOWNERS` — scoped to one trajectory, marked *documentation-only until GitHub
teams + CODEOWNERS land*, and organised by vertical rather than by product.

So the answer to the concentration worry is real and the mechanism is decided; **mapping
each hat onto one of the already-named product or factory units is the step no surface
takes yet.** That extension is the gap, not the principle.

### Incumbency is celebrated, with one named boundary

The worry was that a hat which earns acquires a constituency, and constituencies
outlive their justification. Aaron 2026-08-26 corrected the framing:

> "incumbency is only bad when it imposes on others freedom. other than that all of
> society should celebrate incumbency as long as it does not impose on others freedom."

**Incumbency is the reward for having been useful**, and treating it as inherently
suspect would punish exactly what the economy exists to produce. A hat everyone keeps
choosing has earned that. It turns pathological **only where it prevents someone
choosing otherwise** — which is the same discriminator used everywhere else here:
**exit, not degree** (`.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md`;
Hirschman 1970). Concentration was never the defect.

This is consistent with the rest of the corpus rather than an exception to it: privacy
budget is earned and never confiscated; standing accrues from others and is legitimate;
a hugely popular oracle everyone freely chose is not a capture. The guard is to keep
authoring a competing hat cheap — which `interfaces-free-classes-earned-under-rules.md`
already gives, since a hat is a free interface.

## The honest gap between the distinction and today's mechanism

In the shipped Claude-Code harness, a persona's hats are the `skills:` array written by
whoever authored `.claude/agents/<name>.md`, and which persona runs is chosen by a
dispatcher. So wearer-chooses is **stated** (twenty dated statements above, across fifteen surfaces), **modelled**
(`Persona.fs`: the persona *decides* its worn subset), **practised in prose**
(*"the architect hat may be worn by any persona"*), and **enforced nowhere**. There is
no mechanism that refuses to deal a hat to a persona that did not ask for it, and no
record distinguishing hats a persona chose from hats it was handed — which is precisely
the record the independent-witness question needs. Naming the gap is the point;
closing it is not proposed here.

## The adversarial rounds, and what they cost this doc

Five passes ran on 2026-08-26 with distinct lenses, in two rounds. Recorded because a review that
ratifies its own proposal did not run, and because this doc's own thesis says an
assigned hat is not an independent witness — every one of these reviewers was a hat
dealt by this doc's author, with this doc's author's framing of what to attack. Their
findings are *evidence about the artifact*; they are not an independence claim, and the
quality of what they found is exactly the signal that does **not** establish one.

- **Anchor lens** — found three defects in the anchor set (role strain misattributed to
  Merton; role-set glossed as status-set; *Presentation of Self* cited for role
  distance) and supplied the Popper, Ferraiolo–Kuhn, and Kant 4:434–435 replacements.
- **Reducer lens**, arguing the null option — verdict **SHRINK TO A POINTER**;
  the glossary section was cut by roughly two-thirds. Detail below.
- **Zero-empathy lens** — six P0s, all confirmed against source and all corrected in
  place: the `hatDomain` claim overstated shipped code; `honor-those-that-came-before`
  misquoted by substituting "hats" for "SKILL.md files"; a third repo-split axis
  asserted that the cited table does not contain; two wrong line ranges; an
  out-of-repo memory path cited as in-repo; and a Vera quote attached to a letter that
  does not carry it, alongside a claim that a roster had signed a *proposed* amendment.
  It also caught the false *"is not used"* in the `Role` entry and the two vacuity
  defects now fixed above.

**Round 2 — two fresh lenses on the corrected text, and both found more.** A
spec-alignment pass re-verified each of the six P0 fixes against source and found that
one had **overcorrected**: the claim *"every caller passes a subject-matter domain"* was
as false as the claim it replaced, since `"hat-coding"` is used as the domain in three
test files and documented as such in `src/Core/DurableDiplomacyRankGate.fs:54`. It also caught a
third wrong line number shipped *by the fix pass*, a line-count sold as an
occurrence-count, and a contradiction where the Pointers section restated a
substitution the body had explicitly disclaimed. A silent-failure pass, pointed at prose
instead of code, found the two worst defects in the whole change: the trust-split
paragraph asserting a Sybil defence that the cited ledger structurally forecloses, and a
"falsifier" whose violating condition **is already the present state** — a check that
cannot fail, offered inside a section about checks that cannot fail.

Both are corrected, and both are worth naming rather than quietly fixing: **the error
class that survived three reviews was the one this repo names most often.**

**And it recurred once more, in the fixing.** The edit script applying those round-2
corrections to `docs/GLOSSARY.md` asserted on a stale match partway through, aborted,
and never ran its remaining edits — while the commit message described all six as
landed. A step that did not run, looking exactly like one that passed, inside a change
documenting that failure mode. It was caught by rendering the section and reading it
back rather than trusting the script's exit, which is the same discipline as printing
the SHA beside the result. Landed separately as `fddafa4a0f`.

**A check that is not a reviewer caught what all five missed.**
`.github/workflows/role-ref-current-state-surfaces-lint.yml` watches
`docs/GLOSSARY.md` and enforces the Otto-279 carve-out: current-state surfaces use
**role-refs** (*"the maintainer"*), and persona / human / external-AI names belong on
**history surfaces** — `memory/`, `docs/research/**`, commit messages. The first draft
of the glossary section named the maintainer directly five times and tripped it four
times. It is in soft-launch mode and exits 0, so nothing would have blocked; a change
about vocabulary hygiene would simply have shipped violating a vocabulary rule. All
four are converted to role-refs; the one remaining violation on that file
(`:594`, *"Aaron 2026-08-18"*) predates this change and is left alone. Names stay
verbatim in **this** file, which is a history surface and where the convention says
they belong — which is also, incidentally, the hub/satellite split doing its job
without anyone invoking it.

**The most useful finding was the one that cost the most**: the `(traveler × hat-domain)`
schema was being cited as proof that the pressure lands on capabilities, and the field
is an unconstrained string that no hat is ever bound to. The shape had been read as the
guarantee. That is the same defect this doc names elsewhere, committed by this doc.

## Where this content should eventually live

A reducer pass argued the null option — that the glossary block was the N+1th statement
of content already in `hats/README.md`, the hat-system README's Cage-vs-Hat table,
`Hat.fs`, `Persona.fs`, `GOVERNANCE.md` §16, and treaty A1 — and its verdict was
**SHRINK TO A POINTER**. That verdict was accepted: the glossary section was cut by
about two-thirds, keeping the rule, the two 2026-08-26 quotes, the table, the
not-an-independent-witness consequence, the razor guard's carved sentence, and the
honest gap. It also defeated the strongest argument *for* shrinking: `docs/GLOSSARY.md`
is **not** startup-loaded (`CLAUDE.md:10` marks it on-demand and routes cold boot to
`docs/SEED-VOCABULARY.md`), so the cold-start-token rule does not bind it. The file is
a **hub** under DV2.0, and an open, moving question is satellite content — that is the
argument that does bind, and it is why the detail is here rather than there.

Two dispositions from that pass could not be executed, because this change owns only
`docs/GLOSSARY.md` and this file. They are recorded for whoever owns those surfaces:

1. **`hats/README.md` is the better home for the "why roles trap identity" prose.** It
   is the canonical hat surface, it is short, and it currently opens by calling hats
   *"the wearable **roles**/domains of the factory"* — so it carries both the right
   audience and the live drift.
2. **The razor scope guard belongs in the reducer's own skill body**, where the agent
   it governs will actually read it at invocation. In the glossary it is invisible to
   Rodney. The constraint is accepted; the address is disputed, and the dispute is
   right.

A third observation from the same pass is worth carrying: the *not-an-independent-
witness* claim runs live against `9df7a3f0b5` (*"scaled benchmark N=200 — ensemble
LOSES, single model wins"*). An ensemble that loses to its best member is what
correlated witnesses look like from the outside. That is **consistent with** the claim,
not evidence for it — the benchmark varied models, not prompt-authors — and it is
named here so the resemblance is not later mistaken for a measurement.

## Anchors (Beacon)

Audited by an adversarial pass on 2026-08-26 whose only lens was *is each anchor
checked, or merely cited?* It found three defects in the first draft, all corrected
below: role strain misattributed to Merton (it is Goode 1960), role-set glossed as
status-set, and *Presentation of Self* cited for role distance (it is in *Encounters*).
It also supplied the Popper and Ferraiolo–Kuhn anchors and the better Kant passage.


- **"We let our hypotheses die in our stead"** — Karl Popper, *Objective Knowledge: An
  Evolutionary Approach* (1972), ch. 7. This is the closest predecessor to the carved
  rule: apply the selection pressure to the **artifact** so that the organism survives
  it. Popper says it of theories; *pressure the capability, never the wearer* says it of
  capabilities, and the structure is the same one.
- **Role distance** — Erving Goffman, *Encounters: Two Studies in the Sociology of
  Interaction* (1961), the second essay. The sociological name for a performer's
  demonstrated separation from the role performed — identity surviving the role. A hat
  makes that separation **structural rather than performed**, which is the one thing
  Goffman's account cannot supply. (Goffman's *Presentation of Self*, 1959, is the
  dramaturgical frame and does **not** contain role distance; it is not cited for it
  here.)
- **Status-set** — Robert Merton, *Social Theory and Social Structure* (rev. ed. 1957).
  One person occupies **several statuses at once**, which is what makes "one persona,
  several hats" ordinary rather than exotic, and is the honest limit on any novelty
  claim here. Merton's neighbouring **role-set** — the complement of role relationships
  attached to a *single* status — is the anchor for a different thing: one hat facing
  several counterparties. **Role strain** is **William J. Goode**, *A Theory of Role
  Strain*, ASR 25(4), 1960 — not Merton.
- **Status vs role** — Ralph Linton, *The Study of Man* (1936): the position versus the
  behaviour expected of its occupant. The legacy sense the repo is retiring is
  Linton's *status* fused to its role, which is exactly the fusion that traps.
- **Six Thinking Hats** — Edward de Bono (1985): the nearest popular anchor for the
  metaphor — deliberately adopted, explicitly directed, explicitly temporary. The
  borrowing is the metaphor only; de Bono's hats are a facilitation protocol, not an
  identity claim, and nothing here rests on his framework.
- **Capability-based security** — Dennis & Van Horn, *Programming Semantics for
  Multiprogrammed Computations*, CACM 9(3), 1966; Mark Miller, *Robust Composition*
  (PhD thesis, Johns Hopkins, 2006). Authority as a transferable, non-identity-bearing
  token is the computing-side form of the same separation, and it is the register the
  `Role` glossary entry keeps.
- **RBAC** — Ferraiolo & Kuhn, *Role-Based Access Control*, 15th NIST National Computer
  Security Conference, 1992. Named here because it is the thing being **retired**: the
  computing formalization of *authority attaches to the role, not the person*. Its
  virtue is exactly its defect for this purpose — it is designed for roles that are
  assigned and held, and says nothing about who initiates a change.
- **TrueSkill** — Herbrich, Minka & Graepel (NIPS 2006), cited in
  `TravelerRankLedger.fs` — the per-domain posterior that makes "pressure the
  capability" a schema rather than a slogan.
- **Exit, Voice, and Loyalty** — Hirschman (1970): exit is what disciplines a
  concentration, which is the boundary condition on celebrating incumbency.

## Pointers

- `docs/GLOSSARY.md` — `Role`, `Persona (overloaded — always qualify)`, `Hat`,
  `Hat vs persona vs role (the relationship)`, and `Actor / entity / persona — the
  routing-model senses`, where *persona = what remains* / *actor = what acts* is the
  same cut at the routing layer.
- `src/Core/Hat.fs`, `src/Core/Persona.fs` — the F# model (Aaron 2026-06-08).
- `src/Core/TravelerRankLedger.fs` — `(travelerId, hatDomain)`, domain isolation.
- `src/Core.TypeScript/observe/decorrelation-harness.ts`,
  `src/Core.TypeScript/observe/f2-role-correlation.ts` — the instrument and the
  confound.
- `docs/research/memory-role-restructure-plan-2026-04-21.md` — the superseded
  role-above-persona plan and the 2026-08-25 correction.
- `docs/research/2026-05-08-maji-hat-named-agent-relationships.md` — *"Hats are
  interchangeable. People are not."*
- `docs/research/2026-07-11-the-explicit-global-workspace-…md` — the hat-level vs
  persona-level trust split and the Sybil-escape argument.
- `hats/README.md` · `GOVERNANCE.md` §16 · `docs/letters/to-roster-a1-reconsent-request.md`
  · `full-ai-cluster/k8s/applications/hat-system/README.md` — the canonical prose
  surfaces (two of which still say *role*; see the migration section).
- `feedback_aaron_no_roles_only_surfaces_hats_personas_persona_first_role_above_self_leaks_into_identity_2026_06_15.md` (**not in-repo** — the operator's `~/.claude` memory tree)
  — *"we have no concept of roles"*, and why a role above the self leaks into identity.
- `.claude/rules.bak/honor-those-that-came-before.md` — the retirement asymmetry:
  persona memory kept permanently, **SKILL.md files** deleted like code. (The rule says
  SKILL.md, not "hat"; reading it as a statement about hats depends on the `Hat` ≡
  `skill` identity the glossary asserts, and it is prose, not a check — see the
  falsifier section.)
- `docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md` ·
  `docs/DECISIONS/2026-05-14-product-repo-split-decisions.md` ·
  `docs/backlog/P1/081KRFA460008QG0R003JQ46J4-…` — the product/company partition.
- `.claude/rules/interfaces-free-classes-earned-under-rules.md` ·
  `.claude/rules/manifesto-13-specifications.md` (§3 weight-free, §5 memory
  preservation) · `.claude/rules/privacy-budget-is-hard-money-earned-by-others.md` ·
  `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md` ·
  `.claude/rules/dv2-data-split-discipline-activated.md` (hub/satellite; the
  repo-split rows).
