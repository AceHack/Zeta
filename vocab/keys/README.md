# keys/ — canonical home for KEY CONCEPTS / TYPES (vocabulary, NOT key material)

`keys/` holds the **vocabulary of keys** — key *concepts and types* as travelers: the seed (BIP-39),
the derivation types (ssh / pgp / nostr / btc / eth / sol / reticulum), dual-key (active+standby),
rolling-code, the privacy primitives (sign/verify, encrypt/decrypt), etc. One carved sentence per file;
address `keys/<term>.md`. A canonical TYPE home (to wire into CANON when populated).

**NOT key material.** No private keys, seeds, or secrets ever live here (or anywhere in the repo) —
privates stay in GH secrets / metal-held, public keys/trust-roots live under `maintainers/`. This folder
is the *vocabulary* (what the key concepts ARE), not the keys. (Privacy/keyring discipline; the
governed crypto; "secure and frictionless — never paste secrets.")
