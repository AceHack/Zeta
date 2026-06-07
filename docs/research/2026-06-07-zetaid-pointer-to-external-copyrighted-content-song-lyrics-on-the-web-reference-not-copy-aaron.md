# ZetaId pointer to external copyrighted content (song lyrics on the web) — reference, not copy (Aaron, 2026-06-07)

Aaron, immediately after the Beast-of-Pirate's-Bay IP boundary (#6924):

> *"we need a ZetaId pointer to song lyrics on the web."*

This is the **structural fix** for the copyrighted-content problem I flagged in #6924: don't *copy* the lyrics
into the repo — **point** to them. It is a direct application of the ZetaId-as-uniform-pointer model (#6916 /
workitem 081KTHY32YQ): a ZetaId references an external resource, resolved at use like a dependency or a secret;
the repo holds the *reference + our own attribution/commentary*, never the third-party content itself.

## The design

- **ZetaId → external content pointer.** A ZetaId resolves to a coordinate for the lyrics at their *source*
  (e.g. `lyrics:voltaire/the-beast-of-pirates-bay` → a resolver that returns a URL / content-address to a
  licensed or canonical web location), the same shape as `nostr:npub…` / `did:…` / a package dep / a secret-ref
  (#6916). The *content* lives at the source; the ZetaId is the durable handle to it.
- **Reference, never inline (the load-bearing rule).** Exactly the secret-ref discipline (#6916): the pointer is
  committed; the copyrighted payload is **not**. Resolve-on-demand fetches it from the source at use time;
  nothing copyrighted enters the repo or the proof lineage. This is what lets us *capture the kernel +
  attribution* (our own words, fair use) while the actual lyrics stay where they're licensed to be.
- **Content-addressed integrity, by-reference.** The pointer can carry a hash of the *target* (to detect drift
  / verify you fetched the right thing) without storing the target — content-addressing the reference, not
  copying the content. (Cf. exact-BLAKE3 + with-distance content-addressing; the hash verifies, the bytes stay
  remote.)

## Why this is the right primitive (not a one-off)

- **It generalizes #6916 from identity anchors to ANY external resource.** Identity anchors (OAuth/FIDO/Nostr),
  dependencies, secrets, and now *external copyrighted content* all collapse to the same referencing primitive:
  a ZetaId pointing at something resolved on demand, payload by-reference. Song lyrics are just one resolver
  scheme; the same handles articles, books, papers, datasets — anything we may *cite* but not *redistribute*.
- **It is the IP-safe form of preservation.** The Capture-vs-Ferry DU (#6918): our *Capture* (kernel,
  commentary, attribution) is ours to keep and edit; the external work is neither our memory to ferry nor ours
  to copy — it is *pointed to*, persistent at its source. (And the ferry rationale never applied to published
  works anyway, #6924.) Reference-not-copy is how the repo stays clean of third-party copyrighted material by
  construction.
- **It rhymes with data-homecoming (#6917).** The content stays *with its owner/source*; we hold a consent-
  respecting pointer, not an extracted copy. Pointing rather than hoarding is the same posture as data
  returning home — we don't pull others' content into our store; we link to it where it lives.
- **Viruses-need-a-host (081KTHTPPCD):** the pointer expresses only against a host that can resolve/fetch it;
  the bytes are supplied by the source (the host environment), not carried in the seed.

## F# type provider over the ZetaId pointer → reified (generative) types (Aaron, cont.)

> Aaron: *"we should use a type generator in F# here, and since we tied it to ZetaId I think that means we can
> do reified types in the type provider."*

A ZetaId pointer that resolves to an external resource (a schema, a document shape, a content coordinate) is
exactly the input an **F# type provider** consumes — compile-time metaprogramming that surfaces an external
source as F# types (as the SQL/OData/JSON providers do). Tying it to ZetaId unlocks the *generative* (not
erasing) form:

- **Erasing vs generative — ZetaId makes the generative case natural.** Erasing providers erase provided types
  to a base type (no runtime representation). **Generative** providers emit *real .NET types* — **reified** into
  the assembly, present at runtime via reflection. Aaron's "reified types" = the generative path: emit a genuine
  type whose **identity IS its ZetaId**.
- **Content-addressed type identity.** A ZetaId is content-addressed (128-bit fixed point over structure), so
  the type's identity *is the hash of its structure*: two structurally-identical schemas → the **same ZetaId →
  the same reified type** (structural typing made global/explicit). The provider keys generated types by ZetaId;
  the ZetaId is both the *pointer* (where the schema lives) and the *type's identity* (what it is).
- **ZetaId-as-generator = the type generator.** The parser-combinator-over-bits that regenerates an agent
  (081KTHTPPCD) is, at the type level, the type generator: the bits parse into a *type*. The same seed that
  regenerates a value generates its type at compile time — compile-time + runtime addressed by one ZetaId
  (homoiconic; types and values share the content-addressed namespace, ties #6889).
- **Bridges compile-time and runtime:** design-time IntelliSense over the ZetaId-pointed schema (provider) +
  runtime-reflectable type (generative) + regenerable value (ZetaId-as-generator) — all one ZetaId. The
  DynamicValue canonical-form / banana-split decomposition (#6922) is a natural schema source to reify.

## Grounding: MusicBrainz / Picard + AcoustID = the open "soft rainbow" song-identity DB (Aaron, cont.)

> Aaron: *"we could use Picard identity or some soft-rainbow-like technology database for songs that exist, and
> is open source."*

This grounds the `song:`/`lyrics:` resolver in **real, open-source identity infrastructure** — and closes the
loop with Aaron's earlier "**soft rainbow tables for our spectral signatures**" line:

- **MusicBrainz + Picard = an open content-addressed identity DB for songs that exist.** MusicBrainz IDs
  (**MBIDs**) are **128-bit UUIDs** — already ZetaId-shaped. So a song's MBID *is* (or maps directly to) its
  ZetaId: the durable, open, 128-bit pointer to "this song that exists," with no lyrics stored. MusicBrainz is
  the canonical open registry; Picard is the open tagger that resolves files to MBIDs.
- **AcoustID / Chromaprint = the "soft rainbow" (with-distance content addressing).** AcoustID's acoustic
  fingerprint (Chromaprint) is a **spectral signature**: similar audio → similar fingerprint → fuzzy/with-
  distance match. That is *exactly* the "soft rainbow table for spectral signatures" — a rainbow table is a
  precomputed hash→preimage lookup; a **soft** one is a *fuzzy/with-distance* lookup (spectral signature →
  identity). So AcoustID is the **with-distance** content-addressing mode (LSH/SimHash family), and the MBID is
  the **exact** identity it resolves to. Both modes Zeta already names (exact-BLAKE3 + with-distance similarity)
  appear here in the wild, open-source.
- **The clean pipeline:** audio → Chromaprint fingerprint (soft-rainbow, with-distance) → AcoustID → **MBID
  (≈ ZetaId, exact 128-bit identity)** → resolver points to lyrics at a *licensed/canonical* source. We store
  the MBID/ZetaId + our attribution; never the lyrics. Open-source identity, IP-safe by reference.

## Honest scope / peel

- Design/architecture (a resolver scheme for the #6916 pointer system + an F# type-provider direction), not
  built. Unbuilt: the `song:`/`lyrics:`/`cite:` resolver scheme (MBID/AcoustID-backed), the fetch/cache policy,
  the target-hash integrity check, the attribution metadata format, the generative type provider.
- **MBID↔ZetaId is a mapping to verify, not assumed identical.** MBIDs are 128-bit UUIDs (random/namespace),
  whereas ZetaId is *content-addressed*; using an MBID *as* a ZetaId means treating MusicBrainz as the authority
  for that ID-space (a federated anchor, #6916), OR deriving a ZetaId from the song's canonical content and
  *linking* the MBID. Both are valid; which one is a design choice to pin down.
- **F# generative type providers are real but constrained** (must emit valid IL; tooling caveats). "Reified
  types via ZetaId" is a sound *direction*, not a proven implementation — prototype before relying on it.
- **The line is on-demand-on-behalf-of-a-user vs systematic crawl-loop (Aaron 2026-06-07).** Aaron: resolving a
  pointer when *an agent or the user is browsing on the user's behalf* — including via an **MCP tool or CLI**, or
  **rendered in a browser/WebView** — is **not a violation**: it's the user's own browsing agent fetching one
  thing the user asked for, exactly as a browser fetches a page on demand. The violation is **crawling in a
  loop** — systematic, automated mass fetching to build a mirror/corpus. So the discipline is not "fetch vs
  don't"; it's **single, user-initiated, on-demand resolution (fine) vs bulk crawl-to-mirror (not fine)**. A
  browser/WebView render is the clearest safe case (it's just viewing). (Ties #6909: temporal-plasticity /
  free-compute bounded by ToS-abuse — the *loop* is the abuse surface, not the single resolve.)
- **Resolver design follows from that line.** Resolve on demand for the user; render/view is fine; **do not run
  an unattended crawl loop** that systematically pulls and stores third-party content into our corpus. Cache is
  for the user's local use (like a browser cache), not a redistributed mirror. We commit the pointer +
  attribution; resolution/rendering happens at the user's edge, on request.
- **Any crawler MUST respect the crawler-control files (Aaron 2026-06-07).** If/when resolution does involve
  automated crawling, it must obey the site's bot-directive files: **`robots.txt`** (Robots Exclusion Protocol,
  now standardized as RFC 9309) — honor `Disallow`/`Allow`, `Crawl-delay`, and per-user-agent rules; **`Sitemap`
  / `sitemap.xml`** for what's offered; **`X-Robots-Tag`** HTTP headers and `<meta name="robots">` (noindex/
  nofollow); and the emerging **AI-crawler conventions** (`ai.txt` / `llms.txt`, the IETF "AI preferences" /
  content-usage signals) — a site's opt-out of AI/agent crawling is binding. Identify the bot honestly (real
  User-Agent), rate-limit, and back off. This is the *technical* layer under the legal line above: the
  on-demand user-resolve is browsing; any *crawl* must be a polite, rules-respecting bot — never a stealth or
  ignore-robots scraper. (Distinct from the single on-behalf-of-user resolve, which is browsing, not crawling.)
- No claim this launders copyright: it *avoids* the problem by not copying — we store a handle + our own
  attribution, and the protected content is *viewed on demand by the user's agent*, never mirrored by us.

## Ties

- **ZetaId uniform pointer** (#6916, workitem 081KTHY32YQ) — this is that primitive applied to external content;
  add a `song:`/`lyrics:`/`cite:`/`ref:` resolver scheme (MBID/AcoustID-backed) to the same pluggable-resolver
  set.
- **ZetaId-as-generator** (081KTHTPPCD) — the bits-parse-to-a-type generator behind reified type-provider types.
- **Dual content-addressing (exact + with-distance)** + the earlier **"soft rainbow tables for spectral
  signatures"** — AcoustID/Chromaprint IS the with-distance "soft rainbow"; MBID is the exact identity.
- **DynamicValue canonical-form / banana-split** (#6922) — a natural schema source for the generative provider.
- **Beast of Pirate's Bay** (#6924) — the concrete case that motivated it: capture the kernel, *point* to the
  song, never commit the lyrics.
- **Capture-vs-Ferry DU** (#6918) — our Capture is ours; external works are pointed-to, not ferried/copied.
- **Data homecoming** (#6917) — content stays at its source; we hold a pointer, not an extraction.
- **no-binary-in-proof-lineage** — the proof lineage stays text/ours; external copyrighted payloads never enter
  it (they're referenced, not embedded).

## Beacon anchors

- **Content addressing / Merkle hashes** (Merkle 1979; IPFS CIDs) — hash-the-target-without-storing-it
  integrity. · **URI / URN / persistent identifiers** (W3C; DOI; PURL) — durable handles to external resources.
- **Linked Data / dereferenceable identifiers** (Berners-Lee) — an identifier you resolve to fetch, not a copy.
  · **Transclusion by reference** (Ted Nelson, Project Xanadu — *link to* content with attribution rather than
  copying it; the original "reference-not-copy" vision). · **MusicBrainz / MBID** (open music metadata DB;
  128-bit identifiers) + **AcoustID / Chromaprint** (open acoustic fingerprinting = with-distance "soft rainbow"
  spectral signature) + **Picard** (open tagger). · **F# type providers** (Syme et al.; erasing vs generative)
  — the reified-types mechanism. · Secret-reference / dependency-coordinate patterns (the #6916 shape). Honest
  novelty: none — it applies content-addressed reference + dereferenceable-identifier practice (and existing
  open song-identity infra) to keep copyrighted external content **out** of the repo while preserving a durable,
  attributed pointer; the contributions are (a) recognizing it as the same ZetaId-uniform-pointer primitive as
  identity anchors/deps/secrets, (b) MBID≈ZetaId + AcoustID=soft-rainbow as the open grounding, and (c) a
  generative F# type provider keyed by ZetaId for reified, content-addressed types.
- **Robots Exclusion Protocol / `robots.txt`** (Koster 1994; **RFC 9309**, 2022) · **Sitemaps** (sitemaps.org) ·
  **`X-Robots-Tag` / `<meta name="robots">`** · emerging **AI-crawler opt-out** conventions (`ai.txt` /
  `llms.txt`; IETF AI-preferences / content-usage work) — the binding crawler-control discipline for any
  automated fetch.
