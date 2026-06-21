// Zeta dual-key set — the "no single key, >=2 to rotate" treaty, as a PURE oracle.
// Invariant (ISM/SKMS "never just one key"): a KeyringSet always holds exactly one
// ACTIVE keyring and >=1 STANDBY keyring, each derived from its OWN seed (no shared
// seed -> compromise of one seed never takes both). Rotation is GAPLESS: the standby
// is promoted to active (byte-identical continuity, already provisioned + trusted),
// the retiring active is recorded for revocation, and a fresh standby is minted -- so
// at NO point are there fewer than two keys. Operational logic lives HERE (the typed
// boundary oracle), not in bash: bash only calls the edge. Deterministic -> DST-replayable.
import { deriveKeyring, freshMnemonic } from "./derive.js";
function slot(state, mnemonic, user) {
    return { state, mnemonic, keyring: deriveKeyring(mnemonic, user).full };
}
/** Build a fresh dual-key set: one active + one standby, each from its own fresh seed. */
export function freshKeyringSet(user = "zeta") {
    return makeKeyringSet(freshMnemonic(), freshMnemonic(), user);
}
/** Build a set from explicit seeds (>=2). First = active, rest = standby. Deterministic. */
export function makeKeyringSet(activeMnemonic, standbyMnemonic, user = "zeta", ...moreStandby) {
    const seeds = [activeMnemonic, standbyMnemonic, ...moreStandby];
    assertDistinctSeeds(seeds);
    return {
        user,
        active: slot("active", activeMnemonic, user), // === seeds[0]; named form satisfies noUncheckedIndexedAccess
        standby: seeds.slice(1).map((m) => slot("standby", m, user)),
        retired: [],
    };
}
/**
 * Gapless rotation: promote a standby to active, retire the old active, mint a fresh
 * standby -- so the count never drops below 2. The promoted keyring is byte-identical
 * to what it was as standby (continuity: already provisioned, already trust-anchored).
 * Pure: pass the fresh standby seed in (the only randomness) for DST-replayability.
 */
export function rotate(set, freshStandbyMnemonic) {
    const promote = set.standby[0];
    if (promote === undefined)
        throw new Error("malformed set: no standby to promote (single-key state forbidden)");
    const restStandby = set.standby.slice(1);
    assertDistinctSeeds([promote.mnemonic, ...restStandby.map((s) => s.mnemonic), freshStandbyMnemonic, set.active.mnemonic]);
    const newActive = { ...promote, state: "active" }; // continuity: same bytes
    const newStandby = slot("standby", freshStandbyMnemonic, set.user);
    const retiredNow = { ...set.active, state: "retired" };
    return {
        user: set.user,
        active: newActive,
        standby: [...restStandby.map((s) => ({ ...s, state: "standby" })), newStandby],
        retired: [...set.retired, retiredNow],
    };
}
/** The invariant the whole treaty enforces. Throws if the set is malformed. */
export function assertWellFormed(set) {
    if (set.active.state !== "active")
        throw new Error("malformed set: active slot not active");
    if (set.standby.length < 1)
        throw new Error("malformed set: single-key state forbidden (>=2 required to rotate)");
    if (!set.standby.every((s) => s.state === "standby"))
        throw new Error("malformed set: non-standby in standby list");
    assertDistinctSeeds([set.active.mnemonic, ...set.standby.map((s) => s.mnemonic)]);
}
function assertDistinctSeeds(seeds) {
    if (new Set(seeds).size !== seeds.length)
        throw new Error("malformed set: seeds must be distinct (one compromise must not take two)");
}
/** Public-only projection of the whole set (pubkeys are the trust roots; privates stay out).
 *  Projects from the already-derived keyring in each slot -- no re-derivation (cheap, DST-fast). */
export function publicSet(set) {
    const pub = (s) => {
        const k = s.keyring;
        return {
            state: s.state, user: set.user,
            ssh: { public: k.ssh.public, fingerprint: k.ssh.fingerprint, path: k.ssh.path },
            pgp: { keyId: k.pgp.keyId, fingerprint: k.pgp.fingerprint, public: k.pgp.public, path: k.pgp.path },
            nostr: { npub: k.nostr.npub, pub_hex: k.nostr.pub_hex, path: k.nostr.path },
            eth: { address: k.eth.address, path: k.eth.path },
            btc: { address: k.btc.address, path: k.btc.path },
            sol: { address: k.sol.address, path: k.sol.path },
        };
    };
    return { user: set.user, active: pub(set.active), standby: set.standby.map(pub), retired: set.retired.map(pub) };
}
