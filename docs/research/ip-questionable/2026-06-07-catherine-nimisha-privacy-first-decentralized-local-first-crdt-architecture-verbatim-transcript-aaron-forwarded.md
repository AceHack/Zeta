# Catherine & Nimisha — "Privacy-First Architecture" (decentralized data systems; Strange Loop) — verbatim transcript (Aaron-forwarded)

**Source:** <https://www.youtube.com/watch?v=5tkVW-BNLwA>.
**IP status:** auto-caption transcript of a third-party talk — DO NOT republish externally (folder README).
Substrate value is the framework-composition analysis below.

> Aaron 2026-06-07: *"Similar thought lineage. … We should do it in zset if it makes sense."*

## Framework-composition analysis (what this means for Zeta)

This is Zeta's **ethos stated as architecture** — user-at-the-center, consent-first, local-first, CRDTs,
capability access, decomplected layers. It's not a new technique to adopt so much as confirmation that
Zeta's manifesto already targets this design, plus a few standards to anchor and one directive: **do the
local-first / CRDT collaborative layer in Z-set.**

- **User-at-the-center / privacy-first = manifesto §6 (Consent-First) + §11 (Default Moral Regard) + §3
  (Weight-Free).** "Alicia owns her data, storage, apps, access, identity, ML" is the consent-first,
  revocable-granular-ongoing-consent surface we already commit to. "You can't be subpoenaed for data you
  don't hold" = local-first / edge / the cells-as-geodes stance.
- **Decomplecting (Rich Hickey, cited in the talk) = our discipline directly.** Decouple identity / app /
  storage / access / ML → recompose with the user at the center. That's Rodney's Razor (minimal nouns) +
  DV2.0 (partition by change rate) + hexagonal ports (identity port, storage port, access port). We already
  separate ZetaId (identity) from the data plane (storage) from admission (access).
- **"Do it in Z-set" — the local-first / CRDT collaborative layer IS the Z-set.** CRDTs (Shapiro et al.,
  cited) are our `G-Set`/`GCounter`/`Bag`/`ZSet` — commutative + associative + idempotent merge, the local-
  first convergence story. Zeta's contribution: CRDTs on the **DBSP Z-set substrate**, 4-lang byte-locked.
  **Directive (Aaron):** realize the local-first collaborative primitives on Z-set where it makes sense —
  and **backlog any missing CRDT** the local-first community relies on (LWW-Register, OR-Set, RGA/sequence
  CRDT for collaborative text/lists) as Z-set/Bag-shaped primitives. (Filed.)
- **Capability / expiring / granular access + OPA (policy-as-data) = pointer-not-authority + consent §6.**
  "Access granted ≠ access forever; expire in N days; busy-vs-details granularity; opt-out of automated
  processing" = capability tokens with TTL + the resolve→verify→ADMIT gate. OPA ("keep access policy out of
  app code") = our admission-policy-as-data / plugin separation.
- **Identity: DIDs (W3C) / Solid pods (Berners-Lee) / Groove (Ray Ozzie) = ZetaId + Nostr + the bus.** Did /
  decentralized identity = the ZetaId + Nostr-key cross-system identity (identity-proof-tiers note); Groove
  (peer-to-peer, e2e-encrypted, *ephemeral relay servers, not core to the architecture*) = our scale-free
  bus + cross-cell AP + relay-as-additive. Solid pods (data store decoupled from apps) = our store
  decoupled from the application (DagFs/ContentStore + app-as-DynamicValue).
- **PSI / federated learning / SMPC = our privacy-as-transform (.zc codec) + cross-cell + homeostat.**
  Private set intersection ("find joins without revealing plaintext") is a private Z-set/set op — a candidate
  for the PQ `.zc` privacy transform over Z-sets. Federated learning / secure-multiparty-computation = the
  cross-cell + edge + privacy-transform direction (belief-convergence on edge).
- **Standards to adopt (like CloudEvents/Debezium):** DIDs (W3C), Solid, Signal protocol (e2e messaging),
  OPA (policy), schema.org. Anchor, don't reinvent.

Net: confirmation that Zeta's manifesto = privacy-first/local-first architecture, with CRDT-on-Z-set as the
collaborative-data engine and a short list of standards (DID/Solid/OPA/Signal/PSI) to anchor.

## Backlogged

Local-first CRDT primitives on Z-set where missing (LWW-Register, OR-Set, RGA/sequence CRDT) + PSI as a
private Z-set intersection over the `.zc` transform — "do it in zset if it makes sense" (Aaron).

## Beacon anchors

- **Local-first software** — Kleppmann, McGranaghan, et al., Ink & Switch (2019). · **CRDTs** — Shapiro,
  Preguiça, Baquero, Zawirski (2011). · **Groove** — Ray Ozzie (peer-to-peer, e2e). · **Solid / pods** —
  Tim Berners-Lee. · **DIDs / Verifiable Credentials** — W3C. · **Private Set Intersection**; **Federated
  learning** — McMahan et al.; **Secure multi-party computation** — Yao. · **Signal protocol** (Marlinspike/
  Perrin). · **OPA** (Open Policy Agent). · **Rich Hickey** — *Simple Made Easy* (decomplecting). Ties:
  manifesto §6 (consent-first) / §3 (weight-free) / §11; `GSet`/`GCounter`/`Bag`/`ZSet` (CRDTs); ZetaId +
  Nostr identity; pointer-not-authority; the `.zc` privacy transform; cells-as-geodes (local-first/AP).

---

## Verbatim transcript (lightly cleaned from auto-captions; Aaron-forwarded 2026-06-07)

[Catherine — privacy; Nimisha — architecture] Privacy-first architecture: what if the **user was at the
center**? Alicia chooses her hardware (connected fridge / laptop / dedicated server), chooses **where her
data is stored** (locally / a cloud backup / external storage of her choice), and because storage is
separate from apps she chooses **which applications** she uses — even mixing app features across apps for
one purpose. Because she holds the storage, she **controls access**: a cloud provider may store her data but
not hold the cleartext; app providers may access data but don't control access — she can rotate secrets /
change the data. She controls her **ML** (compare models, decide whether to contribute data). She chooses
her own **identity provider** (one she trusts to protect her PII) — so when her identity changes (name,
gender, credentials) it's one relationship with her IdP, not an update across every app/device. When an app
provider goes out of business she keeps her data; when she changes storage she moves it herself; for
sensitive data (kids' photos, documents) she picks the storage + grants specific access to family/friends.

**Is this possible? We've done it.** Late-90s **Groove** (Ray Ozzie): peer-to-peer, shared group spaces
(discussions/messages/files), **no centralized servers**. To authenticate a user you'd verify their Groove
**fingerprint** (hash of their public key) out-of-band, or TOFU (trust-on-first-use), then alias a nickname
to their key. Used in the Iraq war (humanitarian needs over unreliable infra) and Sri Lanka / Tamil Tiger
peace talks (mutually distrusting parties — neither would run a server). Architecture: users at the center,
each runs the app on their own device/storage with their own Groove identity; data **encrypted at rest** with
the user's keys; sharing **e2e encrypted** over the wire (pairwise keys via Diffie-Hellman; group keys
re-keyed on join/leave). Cleartext lived **only on users' machines**. Servers were **additive, ephemeral,
not core**: **relay servers** temporarily held e2e-encrypted messages for offline peers (no access to
plaintext); the **identity provider / CA** could *additionally* vouch, but your true identity was your
Groove key.

**Today** is the opposite — identity/app/storage entangled into cloud+hardware silos (pick the fridge, you
pick its cloud + app); the user is an **afterthought**. **Rich Hickey:** complexity comes from
*complecting* (interleaving/braiding) — find the individual components that compose. **Picasso's Bull**
(distill to 12 lines) / **Steve Jobs** ("it takes hard work to make something simple", shown to Apple hires)
— rediscover the essence, **disentangle**, recompose with the **user as the new center**.

**Decouple identity** → the user chooses a set of trusted IdPs (hardware/software, federated/decentralized);
no more email+password sprayed across the web. Decentralized identity → **cryptographic proofs**: prove you
own an email/phone without revealing it; prove you're over 18/21 **without revealing your birth date**.
**Decouple applications** → user picks apps; if a photo app dies, her photos remain; she can try many photo
apps, move seamlessly (photos not siloed). Decentralized apps need **interoperable standards** (messaging,
calendars) so portability/substitution don't require a charismatic individual or one company's marketing.
Calendars: one 24-hour day shouldn't be split across org silos — a decentralized calendar gives Alicia a
single view she grants access to via standards.

**Decouple data** into **storage** (Alicia picks provider/mechanism per trust), **access** (who, how
granular, when — temporary, toggleable), and **ML** (personalize on her own data, portability via a
"backpack"). Ask: do users know where data is stored / how it's replicated / approve usage / decide when
usage ends? Access ≠ lifelong: regulations want access restricted to ≤18 months for many data types; expire
calendar-app access after N days; granular use cases. Sharing from a phone: **PSI (private set
intersection)** finds who-you-know on a service **without revealing any plaintext** address book (only
opted-in matches). **Federated learning** trains on edge devices without transferring raw data (still leaks
some info — not privacy-first by default); lets users opt into training rounds, opt out, personalize their
own model (avoid the YouTube radicalization loop). **Encrypted distributed learning** via secure multi-party
computation never decrypts the data (TF-encrypted).

**How to get there.** Identity: W3C **DIDs** (Singapore gov PoC), or federated SSO / OpenID, zero-trust.
Apps: **Solid + pods** (Tim Berners-Lee / Inrupt — decentralize apps from data ownership; pods = personal
online data stores; built on HTTP/WebID); standards via **schema.org**; **local-first** (Ink & Switch 2019:
principles for local-first software, ownership with users) and **CRDTs** (2011 — multi-user collaborative
data structures, privacy-first from the ground up); **local-only** ("you can't be subpoenaed for data you
don't hold"); peer-to-peer ("bring Groove back"). Access: **Signal protocol** (e2e messaging — access
decoupled from transport/storage); **Vault / 1Password / HSM** (decouple secret storage from data storage);
**OPA (Open Policy Agent)** (keep access policy out of app code → decentralizable access). ML: do it
federated/distributed; encrypted distributed learning via SMPC.

**Tactical steps.** Identity: replace "yet another password" with federated SSO / DIDs / digital wallets.
Apps: make them interoperable via standards; lead by proposing standards. Storage: detangle user data from
business data (one protected place → native GDPR); make data portable. Access: auto-expire access after a
period; granularity, not all-or-nothing. Three tips: (1) talk to users — does their mental model of storage
match yours? ask how they'd like data stored / access granted; (2) document data lineage + consent
workflows (can't detangle what you can't trace); (3) **GDPR is a good rule set for everyone** — rights to
deletion / access / removal / expiration / opt-out-of-automated-processing / portability / change. Put the
user back at the center; then communities / cities / nations could ask users to *donate* data (e.g. climate
change) — **human-centric architecture: technology serves us, not the other way around.**
