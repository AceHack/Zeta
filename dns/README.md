# dns/ — Zeta name-resolution (ZetaId ↔ Reticulum destination ↔ name), at root

`dns/` is the **Zeta name-resolution layer** — NOT traditional DNS/IP/CA (Reticulum replaces those).
The mapping is **self-certifying**:

```text
NAME       =  ZetaId (the stable, readable 128-bit name; structured/decodable)
ADDRESS    =  the Reticulum destination (key-bound; truncated SHA-256 of the pubkey)
RESOLVE    =  announce the ZetaId → destination mapping over the discovery layer (Nostr/DHT);
              resolve a name to its current address (the announce horizon / "neighborhood")
```

So `dns/` holds the **public name↔address records** (announcements / the resolver config) — how a
traveler is found after a move, by its ZetaId. Self-certifying (the address is key-bound; no registrar,
no CA), announce-based (the mapping is published, not centrally owned), sovereign (you own your name =
your ZetaId). A root-level folder (like `/vocab`), because resolution is system-wide. (No secrets — only
public name→destination mappings; privates stay in GH secrets / metal.)

Composes: ZetaId (Identity line) + Reticulum (the addressable mesh; destination = address) + the
discovery layer (Nostr/DHT announce) + travelers/ (the ZetaId reservoir). ZetaId is the **name**; the
Reticulum destination is the **address**; `dns/` is the **name→address resolution**.
