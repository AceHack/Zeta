# Ian Clarke on Freenet — "the internet's honeymoon is over" (talk transcript)

> **Third-party content. Zeta claims no authorship and asserts no license.**
> Quotation-for-study with attribution, per `docs/ip-questionable/README.md`.
>
> - **Source:** <https://www.youtube.com/watch?v=3RBNboYUlVI>
> - **Speaker:** Ian Clarke (creator of Freenet; online as "sanity"). Hosted by Fudo.
>   Auto-transcribed by YouTube; timestamps and transcription artefacts are the
>   auto-transcriber's, not the speaker's.
> - **Ferried by:** Aaron, 2026-08-21, with the note: *"This is very similar to what we are
>   trying to do with our decentraization in Zeta."*
> - **Takedown:** delete this single file. Any analysis of it cites this source and does
>   **not** depend on the verbatim text remaining present.
> - **Partiality:** the talk body and the Q&A. Retained in full as ferried, because the
>   architectural detail and the Q&A answers (contract authorization model, payment
>   agnosticism, developer-community size) are the substance.

**Anchors named in the talk** (for `anchor-to-human-prior-art`): Ian Clarke (Freenet, 2000–);
k-nearest-neighbours with a learned metric ("Renegade", LGPL, Rust); Signal's double-ratchet
(named as the stronger guarantee Freenet's River deliberately does **not** provide);
Git's originally-decentralised design; WebAssembly as the contract/delegate execution substrate.

**CLEAN-ROOM NOTICE.** Per `.claude/rules/cleanroom-two-team-separation.md`: the shadow persona
has now READ this material and is therefore **barred from implementing** anything derived from
it. Any Zeta work that takes requirements from Freenet must go to a **different, named agent
that has not seen this file**, working from a functional specification that carries
*requirements, never expression* — no borrowed type names, call sequences, or structure.
Freenet is GPL-2.0-or-later; that licence is incompatible with copying its expression into this
tree regardless of the clean-room question.

---

## Transcript

*Auto-transcribed from the source above; timestamps are the transcriber's.*

Ian Clarke opens by thanking Fudo for hosting and for their support over the years, and
notes he is "sanity" online. He frames the talk as an update rather than a deep technical
dive, pointing viewers to his earlier "Freenet lives" talk (February) for the architecture.

**The premise — "the internet's honeymoon is over."** He argues that between the mid-90s and
now, Western governments took a relatively hands-off approach, in contrast to China, Iran and
Saudi Arabia. He states that era has ended, citing: ~12,000 UK arrests in 2023 over offensive
online posts (which he computes as 33/day) where "the process is really the punishment";
France arresting and charging Telegram's founder over user posts; a €120m EU fine against X
over what they would call disinformation; and California legislation mandating age/ID
verification in operating systems and app stores. He singles out UK statements about shaping
YouTube's recommendation algorithm toward "trusted sources" as *particularly insidious*,
because overt censorship is at least visible while algorithmic manipulation is not.

**The architecture.** Freenet has no servers, only peers, and no single peer is important or
controls the network. Nobody runs the network: the project writes and releases software; the
network is decentralised and self-organising. He observes this also protects the author —
"somebody could put a gun to my head and demand that I remove something from Freenet and I
simply wouldn't have the ability to do it."

Positioning against the web: normally a browser talks over HTTPS/WebSockets to servers in
data centres, and the user's own computer is merely an interface to centralised systems.
Freenet is designed as a drop-in replacement — the browser talks to a Freenet peer running
locally, which is an equal part of a global network. Shutting down peers causes the network
to transparently move work to others; he says Freenet "literally roots around censorship."

**Two primitives.**

- **Contracts** hold shared state on the peer-to-peer network. A contract is both the shared
  data and the WebAssembly code governing it: what state is valid, whether it may be
  transmitted, how and under what conditions it may be updated, and how state is efficiently
  synchronised when it changes. He likens one to a database table.
- **Delegates** hold private data on hardware you control — Freenet's privacy approach, in
  contrast to the cloud era. Superficially like browser local storage, but more powerful:
  a delegate does **not** surrender the private key. Callers ask the delegate to sign, and
  the delegate knows who is asking and may refuse. He describes this as object-oriented —
  bundling data with the code determining its behaviour.

**Onboarding.** Installers exist for major desktops, but people are reluctant to install
software from an unfamiliar nonprofit, so `freenet.org/try` runs Freenet in-browser with
nothing installed, including on phones. He acknowledges the contradiction — this piece is
centralised — but frames it as a trial path: a "move to my peer" button transfers private
data to your own peer, after which operation is fully decentralised. Private data on the
try server is encrypted at rest with a key held in the visitor's browser, so it is decryptable
only while actively in use.

**Transparency.** Shared data and the rules governing it live in public, auditable contracts.
He contrasts this with recommendation engines whose internals are unknown, so government
pressure on them would be undetectable. On X's repeated open-sourcing announcements, he notes
the published code may drift from what actually runs, and that Freenet does not have this
problem: contracts can be inspected, decompiled to WebAssembly, and vetted — including by
handing the WebAssembly to a language model.

**Application model.** UIs are downloaded to the browser (typically WebAssembly), analogous to
Gmail shipping a JavaScript application, except the UI talks to the local peer rather than to
central servers — so no app store is needed, any more than the web needs one. Native and CLI
paths exist too: `riverctl` exposes everything the River UI can do, for scripting and for LLM
agents. Freenet is written in Rust and thought of "almost like an operating system," optimised
throughout; the binary is ~11 MB.

**Routing as machine learning.** A peer must decide which of its neighbours will find a given
contract fastest — he compares this to CPU branch prediction. Freenet treats it as a
supervised-learning problem using **Renegade**, his k-nearest-neighbours algorithm with a
learned metric, open-sourced for years, in Rust, LGPL. kNN was chosen for accuracy on small
data, so a freshly-started peer with no history can learn from its neighbours; the network is
"a global network of learning peers" that adapts when conditions change (his example: a
degraded undersea cable). His design goal was an algorithm needing no tuning — good defaults,
fast, data-efficient, explicitly contrasted with neural networks' data appetite.

**Shipping today.** *River* (group chat), *Delta* ("decentralized Squarespace" — markdown pages
and blogs, with `deltactl`), *Atlas* (discovery/search — he calls it perhaps the first truly
decentralised search engine, aimed directly at the recommendation-manipulation problem, with a
default crawler and LLM-written neutral descriptions that defeat SEO framing, while letting
users choose which crawlers and labellers they trust), and *Freenet Git* (clone/fetch/push of
repositories over Freenet — he was surprised how well it worked, and frames it as a first step
toward a decentralised forge, noting GitHub also provides issues, CI and a web UI).

**River's crypto, stated with its limits.** Each room is its own contract. Private rooms use a
symmetric key chosen by the room owner and distributed to members under asymmetric encryption;
it rotates weekly or on a ban. Message content and some room metadata are encrypted. He is
explicit about what leaks: that a room exists, message timing, approximate message size, and
member count — though not friendly names. He contrasts this with Signal's double ratchet,
under which a leaked key exposes one message rather than past and future ones, and states
plainly that River is less aggressive: a leaked key exposes messages until rotation, up to a
week. He argues the things you most care about are encrypted, while calling the limitation
important to be transparent about.

**Coming next.** Freenet Mail (pre-alpha), Raven (social feed), Harvest (decentralised
marketplace, "Etsy but decentralised", in early design). He is explicit that the goal is not to
replace Etsy overnight but to demonstrate that these use cases can be built decentralised and
remain convenient.

**Interoperability by default** — the claim he considers fundamentally better than today's
internet, independent of decentralisation. Every system and every component is interoperable
because contracts are visible and composable: Freenet Git plus River for code discussion,
Delta plus River for blog comment threads, Ghost Keys (a decentralised cryptographic
proof-of-personhood) plus Harvest for store reputation. He recalls a moment around 2007 when
tech companies built APIs and then shut them down within a year or two — because they eased
spam and abuse, and because they helped competitors — concluding the internet *could* be
interoperable but deliberately is not.

**Q&A.**

- *Why River before Mail?* Group chat scales down as well as up — useful with two or five
  people — whereas email must be pervasive to be useful, and a two-person social network is
  uninteresting.
- *Can a contract stratify capability — visible to all, usable by some?* Yes. The contract is
  code and decides who may modify its state; River accepts messages only if signed by an
  authorised member. Limiting who can *read* requires encryption, which is how private rooms
  work.
- *Developer community size?* Clarke full-time, two part-time developers in Spain, plus
  volunteers; community-built apps (he cites a pastebin). Hundreds of new people per day in
  their River rooms. He notes AI lowered the barrier — Claude Code skills exist that
  understand Freenet app structure, so one can build a Freenet app without knowing Rust.
- *Payments in Harvest — fiat or otherwise?* Payment-agnostic, expected to be primarily
  cryptocurrency, handled by third parties: a vendor publishes an address and an integration
  validates payment. They are explicitly not building a cryptocurrency.
