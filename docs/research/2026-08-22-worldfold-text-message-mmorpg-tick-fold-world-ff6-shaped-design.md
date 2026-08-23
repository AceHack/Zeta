# Worldfold — an MMORPG played in turn-based text messages

> **Origin** — Aaron 2026-08-22: *"write up an MMORPG based on turn-based text messages,
> compatible with Android and Apple, that can invite anyone at any time; make it feel like FF6 —
> you have 2–10 minutes to explore the world in each turn."*
>
> **Follow-up** — Aaron 2026-08-22: *"the text message should be playable and rewatchable — like
> the turn-based games Apple has, to play between messages. Not just text: little programs/images
> that go back and forth."*
>
> **Status: toy / unmetered design.** Nothing below is measured; every number is a hypothesis
> with a named falsifier (§Metering). Working title "Worldfold" pending naming-expert review.

---

## The pitch

A persistent fantasy world advances in shared **ticks** (a few times a day). When your turn
opens, you step inside for **2–10 minutes** — walk the roads, talk, shop, delve, fight — and
everything you did compresses back into **a text message**. The world folds everyone's messages
into the next tick, and the story moves. It reads like a group chat with a 16-bit JRPG living
inside it: an ensemble cast the size of a server, battles with filling gauges, growth you socket
and shape, and one mid-season event that breaks the world in half.

Anyone with a phone number can be **summoned** into the current story at any moment — first
turns playable by SMS reply before any install. In rich threads the turn is not prose at all: it
is a **playable balloon** — a small program living in the message, tapped to play your window,
tapped by anyone to rewatch the battle. iPhone and Android replay the *same battle from
the same 160 characters*, byte-for-byte, because combat is a deterministic fold over the same
ring algebra this repo already byte-locks across seven languages.

**The message is the game. The fold is the world. The cap is the fairness.**

```text
Worldfold · tick 1842 · Vesper Reach
▸ The tide-gate opened at dawn. Marrow's party took the west stair —
  they left you the lantern.
▸ Bram is 1 tick from the Colossus. He asked you to hold the east front.
Your window is open: 24 AP · closes at the 20:00 fold.
Step in: wf.example/t/K7Q2-1842
```

---

## Design pillars

| # | Pillar | Meaning |
|---|--------|---------|
| P1 | **The message is the game** | A turn is a small text envelope. Push, SMS, chat thread, even a git commit are just ports on the same envelope. If it can't be said in ~2 SMS segments + a link, it isn't a turn. In rich threads the envelope *renders as a small program* — playable, rewatchable — but the program is a costume; the envelope stays canonical. |
| P2 | **Ten minutes is sacred** | Every traveler gets the same bounded window per tick. Nobody can grind 6 hours; nobody falls behind by living a life. The cap is the *egalitarian mechanic*, not a paywall lever. |
| P3 | **Anyone can be summoned mid-story** | Joining is coordination-free: a new traveler is a new keyed delta in the world fold. No reset, no season gate, no lobby. Your friend spawns *near you*, this tick. |
| P4 | **16-bit ensemble feel** | No single protagonist — the server is the cast. Gauge-timed battles, socketed growth, learned-from-the-world abilities, a scheduled world-flip. Writing-forward: text was always the true medium of the 16-bit JRPG. |
| P5 | **Deterministic to the byte** | All resolution derives from (seed, tick, phase-ordered inputs). Any client replays any battle from its envelope; disputes settle by re-execution. Local clocks never touch the shared fold. |

---

## The turn loop

The world advances on a fixed cadence per shard (**tempo**): Adagio = 1 tick/day, Andante = 3/day
*(default, toy)*, Allegro = every 2h. A tick is a **fold**: all committed turn envelopes since the
last tick resolve simultaneously into the next world state.

Your turn, inside one tick:

1. **The digest** (~30s of reading) — what the world did while you were away, written as messages
   in your party thread: outcomes of the last fold, what party-mates did, what's moving toward you.
2. **The window** (2–10 min live) — free-roam spend from an **AP pool** *(24 AP, toy)*: travel,
   town scenes, dungeon rooms, encounters, trade. Exploration is client-local and deterministic
   from the tick seed, so it's instant and offline-tolerant.
3. **The commit** (one tap) — your action log compresses into a turn envelope and submits. Your
   closing choice sets next tick's hook — every window ends on a cliffhanger the next digest pays
   off (serial-fiction cadence: the Dickens installment, not the errand list).
4. **The fold** — at tick close, all envelopes resolve *simultaneously* (arrival order is
   irrelevant by construction — Diplomacy-style simultaneous orders). Contested outcomes resolve
   by deterministic rules + seeded rolls, never by who clicked first or whose network was faster.

Miss a tick → your traveler **camps**: a safe default action plus a two-line vignette in the
digest. No corpse, no decay, no streak shame. Going on vacation is a montage, not a punishment.

**Standing orders** — parties can pin conditional orders ("if I miss the fold, follow Ryn";
"spend my gauge on Ward if the Colossus targets Bram"). Play-by-mail lineage (VGA Planets);
it's how a raid survives a timezone.

### The 2–10 minute contract

- **2 is a floor of content, not a timer**: even a camp turn yields a real vignette. Every window
  guarantees ≥1 discovery, ≥1 consequential choice, ≤1 unsought combat, and 1 hook.
- **10 is a hard cap of presence**: the window closes; the commit stands. The cap is what makes a
  *massively* multiplayer turn-based world fair — everyone's tick is the same size.
- **AP, never reading speed**: slow readers lose nothing. Time gates presence; AP gates action.
  Charms and stats modify AP and cadence — never another player's reading pace.

---

## Combat — asynchronous ATB

Gauge-timed combat in the shape Ito built (Square's 1992 ATB patent — long expired; the homage is
mechanical only), stretched across two timescales:

- **Solo encounters resolve inside your window.** The client plays the battle out gauge-by-gauge
  (deterministic from `(worldSeed, tick, travelerId, encounterIx)`); only the compressed order log
  + outcome go in your envelope. The server *re-executes* to validate — trust nothing, replay
  everything.
- **Party battles and raids span ticks.** Each combatant's gauge fills in *ticks*; each window you
  queue actions for the gauges that are ready; the fold interleaves all sides by speed. A boss is
  a standing multi-tick entity that acts in every fold.

```text
Tick 1843 — The Hollow Colossus · east front
Gauges  you ████░ ready · Bram ██░░░ +1 tick · Colossus ███░░ acts at fold
Queue for this tick (≤ ready gauges): CLEAVE · WARD BRAM · BRACE
```

- **Raids are linked parties on N fronts** — three parties, three simultaneous fronts, one boss
  timeline (the three-party final-assault structure, as homage-by-shape).
- **Provably fair dice**: every roll's seed lineage is in the envelope (commit-reveal). "The fight
  was rigged" has a mechanical answer: replay it. A reproducible divergence between clients is a
  priced bug (§Economy).
- **Defeat is a swept turn, not a death spiral**: lose the window's spoils, wake at the last camp,
  keep story progress. Hardcore shards can opt into permadeath; the default world cannot afford
  corpse-runs inside a 10-minute cap.

---

## Growth and identity

| System | Shape | Homage shape | Substrate it lands on |
|--------|-------|--------------|----------------------|
| **Hats** | Jobs/roles a traveler *wears*, revocable, bounded-duration; role-conditional powers | Job/class ensemble | `hats/` — a hat grants claims while worn (same semantics as the repo's hat system) |
| **Facets** | Socketed growth stones; the socketed facet shapes *per-tick* stat growth and teaches while equipped | Esper/magicite growth | Per-tick fold: growth is applied at fold time, deterministic |
| **Log-learning** | Witness an ability in the world's event log → it becomes learnable; your kit is literally mined from replay | Rage/Lore learning | Event-sourced world log; learning = a query over it |
| **Charms** | Rule-benders worn in 1–2 slots: +6 AP, +1 standing order, dawn-window priority, "camp twice, keep the hook" | Relics | Envelope-validation rules parameterized per traveler |
| **Renown** | The *only* endgame currency. Not grindable: it accrues **only from other travelers' attestations** ("they held the east front"). Titles, opera casting, and shard-history mentions flow from renown | The ensemble's fame | The naming eigenvector / privacy-budget construction: socially conferred, never self-minted, Sybil-priced by design |

Identity itself: every traveler — human or agent — is a **persona** (the durable thing, a ZetaId);
each turn-window session is an **actor** acting on its behalf. That's not metaphor-borrowing; it is
the repo's persona/actor split applied literally, and it's what makes "play my turn from my
partner's phone" and "let my agent camp for me this week" coherent and safe.

---

## World, story, ensemble

- **Shards ("worlds")** of ~500–5,000 travelers share one fold; tempo is chosen at shard birth.
  Personas are cross-shard; renown is per-shard (fame is local, the name is global).
- **The scene engine** writes the digest: it weaves *player outcomes* into ensemble prose. Two
  parties crossing the same room in the same tick get a shared scene scheduled next tick ("you
  hear footsteps on the stair below").
- **The Opera Tick** — a scheduled spotlight event: one party's scene plays in every traveler's
  digest that tick (consent-gated; casting weighted by renown). The server-wide shared moment is
  the point: an MMO's opera house is the whole audience knowing it happened *to someone real*.
- **The Worldfold** — mid-season (week 5 of 10, toy), a scheduled cataclysm re-shapes the shared
  map: routes sever, towns move, the tone darkens, the soundtrack changes key. The
  world-of-balance → world-of-ruin flip as a *live-ops beat*: same cast, broken world, second act.
- **NPCs are agents.** Innkeepers, rivals, and the caravan-master can be Zeta agents wearing hats,
  with persistent memory of *you* across weeks. The port they act through carries a **closed
  command set** — an NPC agent can name any of the game's verbs and define none of them, so a
  runaway or compromised agent is bounded by construction.
- **The party thread is a group chat** (2–6 travelers). Plans get pinned, votes fold as CRDT
  majorities, summons are one tap. We never depend on carrier MMS group threads (cross-platform
  quicksand); the thread lives on the envelope layer and *mirrors out* to SMS for text-only players.

---

## Invite anyone, at any time

The summon is diegetic — being invited *is* a scene:

```text
Kestra summoned you into Worldfold — a world that moves once every
few hours, and waits for you.
You wake in the Shrine of the Second Bell. Rain. A key in your hand.
Reply LOOK to open your eyes, or step through: wf.example/j/K7Q2
```

- **T0 — SMS only**: the first turns play by reply keyword (`LOOK`, `GO N`, `FIGHT`, `RUN`). No
  install, works on a flip phone. The envelope codec is the whole client.
- **T1 — the PWA**: the link opens the full client — installable on both platforms from the web,
  push-capable (iOS ≥16.4 web push; Android natively). Zero app-store friction to *play*.
- **T2 — store apps**: the native tier (contacts for summons, richer push) — and on iOS the
  **iMessage app**, where turns are playable balloons in the thread itself. GamePigeon proved the
  loop; §The playable balloon adopts it wholesale.
- **Join semantics are coordination-free**: a summon mints a ZetaId locally, spawns the newcomer
  *adjacent to the summoner* in the current tick, and party-links them — one delta in the next
  fold. No account gate before first play; the persona hardens (recovery keys, device links)
  *after* the hook is set.
- **Agents are invitable too.** A party can summon a Zeta agent into an empty slot (a camp-sitter,
  a chronicler, a rival). Same traveler intake, same consent surface, same closed verb set.

---

## Platforms and transports

One canonical **turn envelope**; every surface is a port (hexagonal — literally the repo's
`IPort<T>`/`ICodec` shapes):

| Port | Direction | Notes |
|------|-----------|-------|
| Push (APNs/FCM/web-push) | out | The digest *is* the notification (Lifeline lineage) |
| SMS (A2P) | in/out | Invites + T0 play. At-least-once delivery, duplicates expected → turn keys are idempotent **because the medium demands it**. Segment budget: digest ≤3, commit ≤2. Real costs (A2P 10DLC registration, per-segment pricing) confine SMS to summons + text-only players by default |
| PWA thread | in/out | The primary client; offline-tolerant (window is client-local; commit syncs) |
| iMessage app (MSMessage + MSSession) | in/out | The **playable balloon**: one interactive balloon per encounter, updated in place turn-by-turn; play your full window inside Messages (GamePigeon model) |
| App Clip / Play Instant / Live Activities | out | Tap-to-play without install outside Messages; a standing raid's filling gauges on the lock screen between ticks |
| Git port | in/out | Agents can play by commit — a turn envelope in a file. The factory's own agents are players with no extra machinery |

### The playable balloon — little programs that go back and forth

The GamePigeon lesson, adopted wholesale: on iOS the turn renders as an **interactive message
balloon** (Apple's Messages framework — `MSMessage` + `MSSession`), and the session semantics are
the important part: **one balloon per encounter, updated in place** as turns land, so a battle is
a single evolving object in the thread, not a spam of texts. The balloon shows a poster frame —
the scene, the gauges, whose turn it is — and tapping it opens the extension *inside Messages*,
where you play your full 2–10 minute window without leaving the thread. Non-participants in the
chat see the summary line ("Kestra cleared the tide-cave").

**Rewatchable is free because replay is deterministic.** The balloon carries only the envelope
(seed + order log — kilobytes, never state, never video); any client re-executes it into the same
cinematic. So *tap-to-rewatch* costs no storage and no server round-trip — and the rewatch on an
Android phone is outcome-identical to the iPhone that recorded it, which is the byte-lock earning
its keep as a *feature*, not just a test. Replays are shareable beyond the party, consent-gated
(glass halo).

Android has no iMessage, so parity comes from the same renderer behind different doors: the
in-app party thread renders the identical balloon natively; a summon or turn card shared into any
Android messenger deep-links to **instant play** (the PWA today; Google Play Instant if
warranted) with the balloon as its landing state; RCS rich cards carry the poster frame + link
where the carrier supports them. On iOS outside Messages, **App Clips** fill the same
instant-play role.

The architectural line that keeps all of this honest: **the balloon is a renderer, never a
transport of state.** The canonical turn stays the tiny text envelope; the images and the
interactivity are derived from its replay. Presentation tiers are that one truth in three
costumes — T0 prose (SMS players remain first-class citizens of the same world) → T1 thread +
choice chips → T2 the 16-bit-style viewport animating the deterministic battle.

---

## The wire format — the turn envelope

Outbound digest (above). Inbound commit:

```text
WF t1842 K7Q2 ack:9f3a
GO ferry-dock; TALK bosun; BUY rope; DELVE tide-cave:2;
ATB slash/eddy/ward/slash; LOOT chest:brine-charm; CAMP cliff
sig:kestra#a41c seed:c0ffee12
```

- **Idempotency key** = `(travelerId, tick)` — resend a lost SMS forever, world unchanged.
- **`ack`** = hash of the last seen fold (detects a stale client before it commits nonsense).
- **`sig`** = persona signature; **`seed`** = the roll-lineage echo enabling third-party replay.
- **Golden vectors**: canonical envelopes + their folded outcomes live as hex/JSON text fixtures
  (never binary — proof-lineage rule), replayed by every client implementation in CI.

---

## Why the Zeta substrate is unusually good at this

| Game concept | Substrate primitive | Why it holds |
|---|---|---|
| World tick | Phase-ordered logical clock | The **local-time rule** verbatim: your 2–10 min wall-clock window gates *only local action*; the shared fold sees only phase-ordered envelopes. Two orders, never crossed — this is the theorem that makes async MMO turns converge |
| World state | Keyed Z-sets (`WeightedSet`) | Join/leave/loot/trade are signed deltas; corrections are retractions, not mutations |
| Turn commit | Idempotent keyed delta batch | SMS is at-least-once; `(traveler, tick)` upsert makes every transport safe |
| Simultaneous resolution | Commutative fold + deterministic contest rules | Arrival order *cannot* matter; no fastest-finger advantage anywhere in the design |
| Battle math | Ring-generic algebra (`ISemiring`/`IStarRing`) | One combat kernel; damage/heal as signed weights, stacking as ring ops |
| Client parity | The 7-language cross-verify byte-lock | An iPhone (Swift/TS), an Android (Kotlin/TS), and the server (F#) derive the identical battle from the same envelope — the oracle work is the *anti-cheat foundation* |
| Encounter RNG | splitmix64 from `(worldSeed, tick, partyId)` | Already golden-vectored cross-language; provably-fair dice for free |
| Identity | ZetaId | Locally mintable, coordination-free — "invite anyone at any time" without an ID allocator |
| Jobs | Hats | Role-scoped, revocable, bounded-duration grants — the game's job system is the repo's hat system |
| Renown | Naming-eigenvector / attestation economy | Endgame fame only others can confer; Sybil-priced by the same construction as the privacy budget |
| Spectating/streams | Glass halo + frost | Consent-first observation; a battle is watchable only where its participants left it clear |
| NPC agents | Traveler intake + closed command set | Agents name verbs, never define them; compromise is bounded at the port |
| Balance & load | DST | Simulate 10,000 travelers × a full season deterministically; tune drop rates and boss timelines from replays *before* live |
| Anti-cheat & disputes | Re-execution | The message is the proof. A client/server divergence is a reproducible, **priced** bug |

---

## Fairness, economy, refusals

- **Market**: one sealed-bid **batch auction per tick**, uniform clearing price. No sniping, no
  HFT meta — the tick *is* the market maker's clock.
- **PvP**: consensual duels + declared contested objectives resolved in-fold. No open-world
  ganking; you cannot be attacked while living your life. Turn-based means nobody is ever killed
  for being asleep.
- **Divergence bounty**: any player who produces an envelope whose replay differs across clients
  has found a real bug; the economy of `every-bug-has-economic-value` applies in-world (renown +
  charm-grade rewards).

**Refusals (the game's WONT-DO):** no purchasable AP or window time (selling the cap kills P2);
no loot boxes; no red-badge guilt loops or streak shame; no ads inside turn messages; no
reading-speed pressure anywhere.

---

## IP posture

Homage at the level of *shape*, never *expression* — the cleanroom discipline applied to creative
work: ensemble cast, gauge combat, socketed growth, learned-from-the-world abilities, a
mid-season world flip are mechanics and structures (not copyrightable; the ATB patent is long
expired). No FF6 names, characters, script, art, or music. Original setting throughout
("Worldfold", Vesper Reach, the Second Bell).

---

## Anchors (Beacon)

- **Final Fantasy VI** (Square 1994; Kitase/Ito direction, Uematsu score) — the named inspiration:
  ensemble-not-protagonist, ATB (Ito; Square's 1992 patent, expired), esper-shaped growth,
  opera-house shared moment, the world-flip second act.
- **BBS door games** (TradeWars 2002, Legend of the Red Dragon) — turns/day text multiplayer; the
  direct genre ancestor of "2–10 minutes, come back at the next tick".
- **Urban Dead** (Chandler 2005) & **Kingdom of Loathing** (2003) — AP-per-day browser MMOs; the
  egalitarian action-budget cap, proven for years at scale.
- **Diplomacy** (Calhamer 1959) & play-by-mail (VGA Planets) — simultaneous order resolution and
  standing orders; the fairness core of the fold.
- **Lifeline** (3 Minute Games 2015) — a game lived through notifications; **GamePigeon** on
  Apple's Messages framework (`MSMessage`/`MSSession`) — the playable, in-place-updated balloon
  and the invite-in-the-thread loop; **App Clips / Google Play Instant** — tap-to-play without
  install; **chat fiction** (Hooked) — message-thread narrative at scale.
- **Neptune's Pride** (Iron Helmet 2010) — slow-real-time multiplayer strategy; cautionary anchor
  on cadence-induced burnout (why the cap and camp-forgiveness exist).
- **Serialized fiction** (Dickens installments) — the digest/cliffhanger sandwich.
- **Substrate**: DBSP (Budiu et al.), CRDTs (Shapiro et al.), FoundationDB-style DST, HLC
  (Kulkarni et al.), commit-reveal provable fairness — all already load-bearing in this repo.

---

## Metering plan — what promotes this from toy

Falsifiers, named up front (all thresholds toy until a playtest exists):

1. **The window claim**: p25–p75 of actual window duration lands inside 2–10 min across a 2-week
   playtest; p95 < 12 min. Fails → the content contract or AP pool is wrong.
2. **The tick claim**: ≥60% of active travelers commit ≥1 envelope per day at Andante tempo in
   week 2. Fails → cadence or digest quality is wrong.
3. **The summon claim**: ≥25% of SMS summons produce a first commit; ≥40% of those reach the PWA
   by turn 5. Fails → T0 is theater, cut it honestly.
4. **The parity claim**: 0 replay divergences across TS/Swift-host/Kotlin-host clients over 10k
   DST-generated battles. Fails → the byte-lock isn't covering the combat kernel yet (the known
   gap #3 of the interface-matrix reviews — this game is that gap's forcing function).
5. **The fairness claim**: outcome distribution of contested folds is independent of envelope
   arrival time (statistical test over DST runs). Fails → local time leaked into the fold.
6. **The balloon claim**: on balloon-capable surfaces, ≥40% of turns are played without leaving
   the thread, and shared battles average ≥2 rewatches. Fails → the balloon is decoration; keep
   the plain thread and cut the extension honestly.

## MVP cut (v0.1, one shard)

One region (Vesper Reach, ~12 locations, one 5-room delve, one town), 4 hats, solo encounters +
one 2-party cross-tick boss, Andante tempo, summon-by-SMS → PWA, the web **playable balloon**
(tap-to-play, tap-to-rewatch) as the PWA's turn card, camp + standing orders, batch market with
one commodity. Explicitly deferred: raids, Opera Tick, the Worldfold event, the native iMessage
extension and other store wrappers, agent NPCs beyond one innkeeper.

Build sketch on the existing tree: envelope codec + fold as `src/Core.TypeScript` first (the
green column), golden envelope vectors under `tests/cross-verification/worldfold/`, combat kernel
over the existing `StarRing`/`ISemiring` instances, DST season-sim harness before any live shard,
PWA client served from the Pages surface this repo already keeps green.

## Open questions

1. Tick tempo default — 3/day is folklore until falsifier 2 runs.
2. Scene-engine authorship — templated + agent-written digest prose needs a moderation stance
   before agent NPCs write to strangers.
3. SMS economics — A2P costs may confine T0 to summons-only in some regions; USSD is the
   fallback worth studying for carrier-priced markets.
4. Combat kernel language for native clients — TS-host everywhere first (byte-lock is proven
   there), Swift/Kotlin ports only behind the cross-verify oracle.

---

*Provenance: interactive design session, Aaron + Claude, 2026-08-22. No workitem minted yet —
mint via `new-workitem.ts` on adoption. This document is a satellite (DV2): the carved sentence,
if one is ever needed, is "the message is the game; the fold is the world; the cap is the
fairness."*
