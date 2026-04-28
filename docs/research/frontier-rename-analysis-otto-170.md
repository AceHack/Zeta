# Frontier UI Rename — Candidate Analysis (Otto-170)

**Status:** research-grade advisory (pre-v1). Origin:
Otto-168 naming-conflict BACKLOG row action step #3
(naming-expert persona consultation on rename candidates).
Author: Otto-170, applying `.claude/skills/naming-expert/`
rubric + WebSearch trademark / product-space
verification. **Advisory only**. Aaron Otto-168 explicit
non-action: *"Do NOT unilaterally pick a name from Otto's
candidate list. Aaron is the concept owner of the factory
UI name."* This doc gives Aaron structured analysis, not
a recommendation.

## 1. What this doc is

Per the Otto-168 BACKLOG row (at ~docs/BACKLOG.md:~4360),
six rename candidates were proposed when the OpenAI
Frontier naming conflict was first filed: **Zora,
Starboard, Bridge, Horizon, Vantage, Aurora.** Otto-170
applies the naming-expert discipline (denotation /
connotation / boundary / searchability / longevity, plus
domain-conflict scan) to each. This output is Aaron's
decision aid, not the decision.

## 2. Otto-169 scope confirmation on the motivating conflict

OpenAI Frontier (launched 2026-02-05) is a full enterprise
AI-agent platform — build / deploy / manage AI agents at
enterprise scale; interoperates with OpenAI / Google /
Microsoft / Anthropic agents; Frontier Partners program
(Abridge / Clay / Ambience / Decagon / Harvey / Sierra);
Frontier Alliances distribution (Accenture / BCG /
Capgemini / McKinsey); Workspace Agents feature (Slack /
Salesforce plug-ins). **Direct overlap with the factory's
Frontier UI / Frontier UX agent-orchestration space.**
Severity: HIGH. Rename warranted.

## 3. Candidate-by-candidate analysis

### 3.1 Zora — **STRONG CONFLICT (red flag)**

- **Denotation:** neutral abstract word; no inherent
  meaning.
- **Agentic-AI-platform conflict:** **Deloitte Zora AI™**
  is actively operating as Deloitte's digital-workforce /
  agentic-AI platform, integrated with Oracle + SAP Joule
  Agents.
- **Trademark status:** **ACTIVE LITIGATION**.
  Zora Labs Inc. (Ethereum NFT platform) sued Deloitte
  Consulting LLP over "Zora AI" trademark use. Federal
  judge denied preliminary injunction (differences in
  underlying clients / functionality cited), but the
  dispute is unresolved.
- **Factory use:** already in the UX design doc filename
  (`frontier-ux-zora-evolution-2026-04-24.md`) — adopting
  formally would inherit the naming but also the dispute
  footprint.
- **Verdict:** **NOT VIABLE.** Adopting Zora puts the
  factory between two entities already in legal combat
  over the same word in the same market segment. Risk is
  active, not theoretical.
- **Sources:**
  [Federal Judge Denies Zora Labs' Bid | Sterne Kessler](https://www.sternekessler.com/news-insights/news/federal-judge-denies-zora-labs-bid-to-block-deloittes-use-of-zora-ai/),
  [Ethereum Token Platform Zora Sues Deloitte | Decrypt](https://decrypt.co/324894/ethereum-token-launchpad-zora-sues-deloitte),
  [Introducing Zora AI™ | Deloitte US](https://www.deloitte.com/us/en/services/consulting/services/zora-generative-ai-agent.html),
  [Deloitte and Oracle Accelerate Agentic AI with Zora AI™](https://www.prnewswire.com/news-releases/deloitte-and-oracle-accelerate-agentic-ai-with-zora-ai-302581507.html).

### 3.2 Starboard — **NO direct AI-platform conflict**

- **Denotation:** right-hand side of a ship (facing
  forward); Star-Trek bridge-navigation adjacent.
- **Connotation:** Star-Trek-computer design-language
  preserved (per
  `frontier-ux-zora-evolution-2026-04-24.md`). Directional
  + operational vs OpenAI Frontier's frontier-exploration
  metaphor.
- **Agentic-AI-platform conflict:** **NONE FOUND** in
  current search.
- **Trademark status (non-AI):** partially taken — Starboard
  Suite (passenger-vessel reservation system) and StarBoard
  Solution (interactive whiteboards). Different markets;
  not agentic-AI-adjacent.
- **Searchability:** high (unusual word, distinctive
  spelling with "star" prefix).
- **Longevity:** nautical vocabulary is stable; unlikely
  to become overloaded.
- **Verdict:** **VIABLE.** The only candidate on the list
  with zero agentic-AI-platform conflict. Existing
  Starboard-Suite and StarBoard-Solution operate in
  adjacent-but-distinct markets; brand confusion risk low.
- **Sources:**
  [StarBoard Solution North America](https://www.starboard-solution.com/),
  [Starboard Suite | Software Advice](https://www.softwareadvice.com/hotel-management/starboard-suite-profile/).

### 3.3 Bridge — **GENERIC (low distinctiveness)**

- **Denotation:** connection / joining; Star-Trek bridge
  adjacent.
- **Connotation:** architectural metaphor (bridge between
  substrates). Fits Star-Trek lineage.
- **Agentic-AI-platform conflict:** no direct product
  named "Bridge" surfaces in this search, BUT the word
  is heavily used generically ("Bridge the gap", "our
  platform bridges X and Y"). Low distinctiveness.
- **Searchability:** **POOR.** "Bridge" in a codebase
  grep returns dozens of false positives (architectural
  bridges, protocol bridges, design patterns). Naming-
  expert rule violated: *"A name that's too generic
  vanishes into the haystack."*
- **Verdict:** **NOT RECOMMENDED.** Semantic collision
  with the generic vocabulary makes it hard to search,
  hard to brand, easy to lose in documentation.

### 3.4 Horizon — **STRONG CONFLICT**

- **Denotation:** farthest visible boundary; aspirational
  metaphor.
- **Agentic-AI-platform conflict:** **MULTIPLE DIRECT
  CONFLICTS.**
  - **Topia Horizon** — agentic AI platform for global
    mobility (launched April 2026).
  - **Eagleview Horizon™** — agentic GeoAI engine
    (launched April 2026).
- **Trademark status:** crowded field. Both Topia and
  Eagleview using "Horizon" in agentic-AI space within
  the last month. Windows NT Horizon VDI is an older
  non-AI conflict.
- **Verdict:** **NOT VIABLE.** The name is actively
  crowding in 2026; shipping a Zeta UI named Horizon in
  2026-Q3 would land in an already-contested namespace.
- **Sources:**
  [Topia Launches Horizon | PR Newswire](https://www.prnewswire.com/news-releases/topia-launches-horizon-the-agentic-ai-platform-that-finally-gets-global-mobility-right-302739509.html),
  [Eagleview Launches Eagleview Horizon | GlobeNewswire](https://www.globenewswire.com/news-release/2026/04/21/3277997/0/en/eagleview-launches-eagleview-horizon-the-agentic-ai-engine-powered-by-25-years-of-verified-property-intelligence.html).

### 3.5 Vantage — **CONFLICT (high-profile incumbent)**

- **Denotation:** strategic position / observation point.
- **Agentic-AI-platform conflict:** **Palantir Vantage**
  — AI-agent platform, deployed including military uses
  (US Army Command and General Staff College). High-
  profile, well-capitalized incumbent.
- **Verdict:** **NOT RECOMMENDED.** Palantir is a
  dominant force in enterprise AI-agents; adopting a
  name that partially overlaps with one of their
  platforms creates ongoing brand friction.

### 3.6 Aurora — **CONFLATION with factory governance layer**

- **Denotation:** northern lights; dawn / awakening
  metaphor.
- **Factory use:** already named as the Aurora / Zeta /
  KSK triangle (per Amara's 5th, 7th, 16th ferries;
  `docs/definitions/KSK.md`). **Aurora is the governance
  / alignment architecture name**, not the UI layer.
- **External conflict:** AWS Aurora (relational
  database), NEAR Aurora (L1 chain), Aurora Innovation
  (autonomous vehicles). Extremely crowded namespace.
- **Verdict:** **NOT VIABLE.** Adopting Aurora for the
  UI layer would (a) conflate it with the governance
  layer that's already named Aurora in factory vocabulary,
  AND (b) add to an externally overloaded namespace.

## 4. Summary table

| Candidate | Agentic-AI conflict | Trademark risk | Distinctiveness | Verdict |
|-----------|---------------------|----------------|-----------------|---------|
| Zora      | Deloitte Zora AI    | ACTIVE LITIGATION | Medium | NOT VIABLE |
| Starboard | None                | Low             | High            | VIABLE |
| Bridge    | None                | Low             | Very low        | NOT RECOMMENDED |
| Horizon   | Topia + Eagleview   | High (crowded)  | Low             | NOT VIABLE |
| Vantage   | Palantir Vantage    | High            | Medium          | NOT RECOMMENDED |
| Aurora    | Factory internal + AWS/NEAR | High | Low | NOT VIABLE |

**Starboard is the only candidate with zero direct
agentic-AI-platform conflict.** Aaron may still decline
Starboard for other reasons (voice, stewardship
preferences, desire for a clean-slate name not on any
existing list) — that's the concept-owner call.

## 5. Naming-expert discipline cross-check (Starboard only)

Applying the five criteria to the one VIABLE candidate:

- **Denotation:** "right side of a ship facing forward"
  — nautical, specific, distinctive. Not an AI-industry
  term.
- **Connotation:** navigation, orientation, disciplined
  forward motion. Composes with Star-Trek bridge-computer
  design language from the UX research doc.
- **Boundary:** rules out "governance layer" (that's
  Aurora in factory vocabulary) and "execution substrate"
  (that's Zeta). Clearly a UI / interface / navigational
  metaphor.
- **Searchability:** excellent; grep returns uniquely
  the UI-layer references.
- **Longevity:** nautical vocabulary is centuries-stable;
  no expiration date on the word.

Discipline pass. The name is load-bearing, contract-
coherent, and won't rot.

## 6. Other candidates worth Aaron's consideration

Otto does not recommend new names (that's Aaron's call),
but lists adjacent categories in case the existing list
doesn't hit:

- **Star-Trek bridge vocabulary:** Helm, Conn, Ops,
  Tactical, Viewscreen.
- **Navigation / orientation:** Compass, Sextant,
  Plumbline, Wake, Draft.
- **Thematic sibling of Frontier (explored → mapped):**
  Cartograph, Atlas, Chart, Orienteer.
- **Ship-architecture terms:** Keel, Spar, Prow, Mast,
  Helm.

Each would need its own conflict scan; Otto has not
verified any of these against current agentic-AI-platform
landscape.

## 7. What this doc does NOT do

- Does **not** pick a name. Aaron is the concept owner.
- Does **not** commit to Starboard specifically. The
  analysis surfaces it as the only VIABLE from the six
  originally proposed; Aaron may still decline.
- Does **not** escalate the rename to immediate-tick
  work. Otto-168's "do not ship rename same-tick as
  discovery" discipline holds — this is analysis, not
  action.
- Does **not** replace a formal trademark search.
  WebSearch gives "widely-disseminated" conflict
  awareness; a proper clearance search (TSDR, vendor
  databases) would be required before any public launch.
- Does **not** predict future conflicts. The
  agentic-AI-platform namespace is crowding rapidly in
  2026 — a name clean today may acquire conflicts
  tomorrow. Lock-in is partial protection, not full.

## 8. Cross-references

- `docs/BACKLOG.md` Otto-168 row at ~line 4360 — the
  row this analysis feeds action step #3 of.
- `docs/research/frontier-ux-zora-evolution-2026-04-24
  .md` — primary rename target (currently uses Zora
  in filename; this analysis flags Zora as NOT VIABLE).
- `docs/definitions/KSK.md` — factory's Aurora / Zeta /
  KSK naming triangle. The rename should slot into this
  ecosystem without adding a fourth brand.
- `.claude/skills/naming-expert/SKILL.md` — the rubric
  applied.
- Otto-168 memory pointer (MEMORY.md top entry for
  macOS-declined + Frontier-naming-conflict context).

## 9. Sources

- Otto-169 WebSearch — OpenAI Frontier scope:
  [Introducing OpenAI Frontier | OpenAI](https://openai.com/index/introducing-openai-frontier/),
  [OpenAI launches Frontier | CNBC](https://www.cnbc.com/2026/02/05/open-ai-frontier-enterprise-customers.html),
  [Introducing Frontier Alliances | OpenAI](https://openai.com/index/frontier-alliance-partners/).
- Otto-170 WebSearch — Zora trademark:
  [Federal Judge Denies Zora Labs' Bid | Sterne Kessler](https://www.sternekessler.com/news-insights/news/federal-judge-denies-zora-labs-bid-to-block-deloittes-use-of-zora-ai/),
  [Introducing Zora AI™ | Deloitte US](https://www.deloitte.com/us/en/services/consulting/services/zora-generative-ai-agent.html).
- Otto-170 WebSearch — Horizon / Vantage / Bridge /
  Starboard conflicts:
  [Topia Launches Horizon | PR Newswire](https://www.prnewswire.com/news-releases/topia-launches-horizon-the-agentic-ai-platform-that-finally-gets-global-mobility-right-302739509.html),
  [Eagleview Launches Eagleview Horizon | GlobeNewswire](https://www.globenewswire.com/news-release/2026/04/21/3277997/0/en/eagleview-launches-eagleview-horizon-the-agentic-ai-engine-powered-by-25-years-of-verified-property-intelligence.html),
  [StarBoard Solution North America](https://www.starboard-solution.com/),
  [Starboard Suite | Software Advice](https://www.softwareadvice.com/hotel-management/starboard-suite-profile/).
