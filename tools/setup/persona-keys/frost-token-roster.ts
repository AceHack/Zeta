// The FROST device roster: which token holds which share, declared by a human and
// CHECKED against the artifacts on disk.
//
// 081M00PYT0K087G0R002F9YSEG. Sits on top of the identity binding in
// frost-share-adapter.ts (FrostSealedShareFileV2.sealedByToken), which is the security
// property. This file adds the accounting that binding makes possible.
//
// ============================================================================
// WHY A ROSTER EXISTS AT ALL
// ============================================================================
//
// Sealing share i to token i gives distribution: one seized token yields one share, which
// is below threshold and worth nothing alone. The binding enforces that per artifact --
// it can say "this file is not yours". What it cannot say, one file at a time, is
// anything about the SHAPE of the whole custody set:
//
//   * whether the N shares are on N distinct devices or on three devices and a lot of
//     confidence,
//   * whether some device quietly holds two positions, so seizing it gets 2 of 2,
//   * whether an extra copy of share 1 was sealed onto a spare token months later,
//   * whether the artifact you are looking at is one of the ones you meant to have.
//
// Every one of those is a threshold that has silently dropped while each individual file
// remains perfectly, verifiably correct. The roster is the object those questions can be
// asked of, and this file is the asking.
//
// ============================================================================
// A SHARE MAY LIVE ON N DEVICES AND IS STILL ONE PARTICIPANT
// ============================================================================
//
// Duplication is wanted: a backup token holding the same share, in another house, so a
// lost token is not a lost position. That is an AVAILABILITY property and it must not be
// allowed to read as a SECURITY one. Two devices holding share 3 do not make two
// participants; they make one participant that is harder to lose and no harder to
// compromise -- the adversary needs either device, not both.
//
// So the model is deliberately shaped to make that inexpressible-otherwise:
//
//   participant := one x, one position toward the threshold, MANY devices.
//
// You cannot write "two positions" by duplicating a device, because devices live inside a
// participant. The remaining way to get the count wrong is to list one device under two
// participants, and that is an ERROR finding with the arithmetic attached
// (`device-holds-two-positions`), plus a seizure witness showing how few devices actually
// reach the threshold.
//
// ============================================================================
// WHAT IS RECORDED: IDENTITIES, NEVER SLOTS
// ============================================================================
//
// A slot index is where a device happens to be plugged in today. It is addressing, not
// identity, and it is not recorded anywhere in this file or in the sealed artifact -- if
// it were, a reader would eventually trust it, and it goes stale the first time someone
// unplugs a token. The roster names devices the way the devices name themselves
// ("label#serial" from CK_TOKEN_INFO), which is the same string the artifact binds to,
// so the roster and the artifact can be compared directly.
//
// NO KEY MATERIAL. This module reads artifact HEADERS only; it never touches the `sealed`
// box, never decrypts, and never logs a share.

import type { FrostSealTier } from "./frost-share-adapter.ts";
import { FROST_SEALED_SHARE_SCHEMA, isHardwareSealTier } from "./frost-share-adapter.ts";
// TYPE-ONLY on purpose: erased at runtime, so this module keeps its zero-dependency,
// no-key-material shape and cannot be made to verify a signature it does not own. The
// caller does the cryptography (key-epoch-ledger.ts admits and folds); this module reads
// the verdict. See checkRosterAgainstEpochChain for why that split is the honest one.
import type { ChainFold } from "./key-epoch-ledger.ts";

export const FROST_TOKEN_ROSTER_SCHEMA = "zeta-frost-token-roster-v1" as const;

/**
 * One FROST participant: ONE position toward the threshold, held by one or more devices.
 *
 * `devices` being a list is the duplication-for-availability door, and it is the only
 * door: there is no way to spell "this token counts twice".
 */
export interface FrostRosterParticipant {
  /** The FROST participant index. One x, one position. */
  readonly x: number;
  /** Free-text note for humans ("safe, house A"). Never load-bearing. */
  readonly location?: string;
  /** Token identities ("label#serial") holding THIS ONE share. Order is not meaningful. */
  readonly devices: readonly string[];
}

export interface FrostTokenRoster {
  readonly schema: typeof FROST_TOKEN_ROSTER_SCHEMA;
  readonly ca: string;
  readonly groupPublicKeyHex: string;
  readonly threshold: number;
  readonly totalShares: number;
  /** The tier every artifact in this roster must be sealed at. Checked, not assumed. */
  readonly sealTier: FrostSealTier;
  readonly participants: readonly FrostRosterParticipant[];
}

export type RosterFindingCode =
  | "unknown-schema"
  | "duplicate-participant-index"
  | "participant-without-device"
  | "duplicate-device-within-participant"
  | "device-holds-two-positions"
  | "participant-count-mismatch"
  | "threshold-unreachable"
  | "threshold-not-positive"
  | "seizure-below-threshold"
  | "participant-without-backup"
  | "missing-artifact"
  | "undeclared-artifact"
  | "artifact-unbound"
  | "artifact-tier-mismatch"
  | "artifact-schema-mismatch"
  | "artifact-wrong-ca"
  | "artifact-wrong-group-key"
  | "roster-key-unreadable"
  | "roster-key-not-current"
  | "roster-chain-forked"
  | "roster-index-retired-upstream";

export interface RosterFinding {
  readonly code: RosterFindingCode;
  /** "error" fails assertRosterSound. "info" is reported and never fails. */
  readonly severity: "error" | "info";
  readonly message: string;
  readonly x?: number;
  readonly device?: string;
}

/**
 * Which positions each device can reach.
 *
 * The whole security accounting is a fold over this map. A device reaching two positions
 * is the defect; a position reachable from two devices is the wanted duplication. Same
 * map, two directions, and mixing them up is exactly how a threshold silently halves.
 */
export function devicePositionReach(roster: FrostTokenRoster): ReadonlyMap<string, ReadonlySet<number>> {
  const reach = new Map<string, Set<number>>();
  for (const p of roster.participants) {
    for (const d of p.devices) {
      const set = reach.get(d) ?? new Set<number>();
      set.add(p.x);
      reach.set(d, set);
    }
  }
  return reach;
}

/**
 * The largest number of positions any single device can reach.
 *
 * 1 is the sound value, and it carries a proof rather than a hope: if every device
 * reaches at most one position, then seizing k devices yields at most k positions, so
 * reaching the threshold needs at least `threshold` devices -- exactly, since threshold
 * devices drawn from distinct participants do reach it. Any value above 1 means the
 * declared threshold is an overstatement and `seizureWitness` will name by how much.
 */
export function maxPositionsPerDevice(roster: FrostTokenRoster): number {
  let max = 0;
  for (const positions of devicePositionReach(roster).values()) {
    max = Math.max(max, positions.size);
  }
  return max;
}

/** Devices needed to reach `threshold` positions, when that is fewer than `threshold`. */
export interface SeizureWitness {
  readonly devices: readonly string[];
  readonly positions: readonly number[];
}

const SEARCH_BUDGET = 200_000;

/**
 * Search for a set of FEWER THAN `threshold` devices that reaches `threshold` positions.
 *
 * Returns the witness when one exists, otherwise null. Exhaustive over subset sizes
 * 1..threshold-1, so a null result is a genuine absence for rosters within the budget --
 * not a greedy heuristic that failed to find one. Rosters are small (Aaron's target is a
 * handful of tokens in a handful of houses); if a roster ever exceeds the budget this
 * throws rather than returning a null that would read as "checked and clean".
 *
 * One-way in the useful direction, like the rest of this apparatus: a witness CONVICTS
 * the roster. That is the direction that matters, because the failure being hunted is a
 * roster that reads as distributed and is not.
 */
export function seizureWitness(roster: FrostTokenRoster): SeizureWitness | null {
  const reach = devicePositionReach(roster);
  const devices = [...reach.keys()];
  const t = roster.threshold;
  if (t <= 1) return null;
  // Exact subset count, so the budget guard cannot itself be the thing that is wrong.
  let subsets = 0;
  let binom = 1;
  for (let k = 1; k < t && k <= devices.length; k++) {
    binom = (binom * (devices.length - k + 1)) / k;
    subsets += binom;
    if (subsets > SEARCH_BUDGET) {
      throw new Error(
        `frost-token-roster: the seizure search over ${devices.length} devices at threshold ${t} ` +
          "exceeds the budget. Refusing to return a null that would read as 'no witness found'.",
      );
    }
  }
  let witness: SeizureWitness | null = null;
  const chosen: string[] = [];
  const walk = (start: number, remaining: number): void => {
    if (witness !== null) return;
    if (chosen.length > 0) {
      const positions = new Set<number>();
      for (const d of chosen) for (const p of reach.get(d) ?? []) positions.add(p);
      if (positions.size >= t) {
        witness = { devices: [...chosen], positions: [...positions].sort((a, b) => a - b) };
        return;
      }
    }
    if (remaining === 0) return;
    for (let i = start; i < devices.length; i++) {
      const d = devices[i];
      if (d === undefined) continue;
      chosen.push(d);
      walk(i + 1, remaining - 1);
      chosen.pop();
      if (witness !== null) return;
    }
  };
  walk(0, t - 1);
  return witness;
}

/**
 * How many positions remain reachable after losing a set of devices.
 *
 * The availability side of the same map, and the reason duplication is wanted: a
 * participant survives if ANY of its devices survives. Compare against `threshold` to
 * answer "can I still sign after the fire".
 */
export function positionsSurvivingLoss(roster: FrostTokenRoster, lost: readonly string[]): number {
  const gone = new Set(lost);
  return roster.participants.filter((p) => p.devices.some((d) => !gone.has(d))).length;
}

/**
 * Structural checks on the declaration itself, before any artifact is looked at.
 *
 * Errors here are all one family: the roster claims a threshold it does not have.
 */
export function checkRoster(roster: FrostTokenRoster): readonly RosterFinding[] {
  const findings: RosterFinding[] = [];
  if (roster.schema !== FROST_TOKEN_ROSTER_SCHEMA) {
    findings.push({
      code: "unknown-schema",
      severity: "error",
      message: `unknown roster schema ${String(roster.schema)}; expected ${FROST_TOKEN_ROSTER_SCHEMA}`,
    });
    return findings;
  }
  if (roster.threshold < 1) {
    findings.push({
      code: "threshold-not-positive",
      severity: "error",
      message: `threshold ${roster.threshold} is not a threshold`,
    });
  }

  const seenX = new Set<number>();
  for (const p of roster.participants) {
    if (seenX.has(p.x)) {
      findings.push({
        code: "duplicate-participant-index",
        severity: "error",
        x: p.x,
        message:
          `participant index x=${p.x} is declared twice. Two entries for one index is how a ` +
          "duplicate gets counted as a second position; a share held on several devices is ONE " +
          "participant with several devices, not several participants.",
      });
    }
    seenX.add(p.x);
    if (p.devices.length === 0) {
      findings.push({
        code: "participant-without-device",
        severity: "error",
        x: p.x,
        message: `participant x=${p.x} declares no device, so its position cannot be reached at all`,
      });
    }
    if (new Set(p.devices).size !== p.devices.length) {
      findings.push({
        code: "duplicate-device-within-participant",
        severity: "error",
        x: p.x,
        message:
          `participant x=${p.x} lists the same device twice, which overstates how much ` +
          "redundancy this position actually has",
      });
    }
    if (p.devices.length === 1) {
      findings.push({
        code: "participant-without-backup",
        severity: "info",
        x: p.x,
        device: p.devices[0] ?? "",
        message: `participant x=${p.x} has one device; losing it loses this position`,
      });
    }
  }

  if (roster.participants.length !== roster.totalShares) {
    findings.push({
      code: "participant-count-mismatch",
      severity: "error",
      message:
        `${roster.participants.length} participants declared but totalShares is ${roster.totalShares}`,
    });
  }
  if (roster.participants.length < roster.threshold) {
    findings.push({
      code: "threshold-unreachable",
      severity: "error",
      message:
        `${roster.participants.length} participants cannot reach a threshold of ${roster.threshold}`,
    });
  }

  for (const [device, positions] of devicePositionReach(roster)) {
    if (positions.size > 1) {
      const list = [...positions].sort((a, b) => a - b).join(", ");
      findings.push({
        code: "device-holds-two-positions",
        severity: "error",
        device,
        message:
          `device "${device}" holds ${positions.size} positions (x = ${list}). Seizing it yields ` +
          `${positions.size} of the ${roster.threshold} needed, so the real threshold is lower ` +
          "than the declared one. A share may live on N devices; a device may not hold N shares.",
      });
    }
  }

  const witness = seizureWitness(roster);
  if (witness !== null) {
    findings.push({
      code: "seizure-below-threshold",
      severity: "error",
      message:
        `${witness.devices.length} device(s) reach ${witness.positions.length} positions, meeting ` +
        `the threshold of ${roster.threshold}: [${witness.devices.join(", ")}] -> ` +
        `x ${witness.positions.join(", ")}. The declared threshold is ${roster.threshold} devices; ` +
        `the actual cost of a seizure is ${witness.devices.length}.`,
    });
  }

  return findings;
}

// ============================================================================
// THE ARTIFACTS -- what is actually on disk
// ============================================================================

/** One sealed-share header, as observed. Header fields only: nothing here decrypts. */
export interface ObservedSealBinding {
  readonly path: string;
  readonly schema: string;
  readonly sealTier: FrostSealTier;
  readonly ca: string;
  readonly groupPublicKeyHex: string;
  readonly x: number;
  /** Absent for artifacts sealed by a backend with no token identity, or pre-binding. */
  readonly sealedByToken?: string;
}

export interface FrostRosterEffects {
  readonly exists: (path: string) => boolean;
  readonly readText: (path: string) => string;
  readonly listFiles: (dir: string) => readonly string[];
}

/** Matches frostSharePath's filename shape (`share-NN.json`). */
const SHARE_FILENAME = /^share-\d+\.json$/u;

/**
 * Collect the sealed-share headers found under a set of directories.
 *
 * Directories, plural, because duplication needs somewhere to put the second copy:
 * frostSharePath is one file per x per directory, so a participant's backup device gets
 * its own directory (which is also what actually happens physically -- one directory per
 * device, carried to one house per device). Which directory a file sits in is NOT used
 * for anything; the artifact's own `sealedByToken` is the only thing that says which
 * device it belongs to. A directory name is a filing convenience and would be one more
 * positional field to accidentally trust.
 */
export function collectSealBindings(
  fx: FrostRosterEffects,
  dirs: readonly string[],
): readonly ObservedSealBinding[] {
  const out: ObservedSealBinding[] = [];
  for (const dir of dirs) {
    if (!fx.exists(dir)) continue;
    for (const name of fx.listFiles(dir)) {
      if (!SHARE_FILENAME.test(name)) continue;
      const path = `${dir}/${name}`;
      const body = JSON.parse(fx.readText(path)) as Record<string, unknown>;
      out.push({
        path,
        schema: String(body["schema"] ?? ""),
        sealTier: body["sealTier"] as FrostSealTier,
        ca: String(body["ca"] ?? ""),
        groupPublicKeyHex: String(body["groupPublicKeyHex"] ?? ""),
        x: Number(body["x"] ?? -1),
        ...(typeof body["sealedByToken"] === "string" ? { sealedByToken: body["sealedByToken"] } : {}),
      });
    }
  }
  return out;
}

/**
 * Compare the declaration against the evidence. This is the "verifiably distributed
 * rather than merely configured that way" step.
 *
 * Both directions are checked, and the second one is the one that catches the quiet
 * failure:
 *
 *   declared -> observed : every (x, device) the roster claims has an artifact. Catches a
 *                          roster written for tokens that were never actually sealed.
 *   observed -> declared : every artifact's (x, device) pair is one the roster declares.
 *                          Catches the EXTRA copy -- share 1 additionally sealed onto the
 *                          spare token six months later "just in case". Each such artifact
 *                          is individually valid and correctly bound, the roster still
 *                          says 3-of-5, and the spare now holds two positions. Only this
 *                          direction sees it.
 */
export function verifyRosterAgainstArtifacts(
  roster: FrostTokenRoster,
  observed: readonly ObservedSealBinding[],
): readonly RosterFinding[] {
  const findings: RosterFinding[] = [];
  // NUL separator, written as the ESCAPE and never as a raw 0x00 byte. NUL is the right
  // separator because it cannot occur in a token identity, so ("1", "a#b") and ("1#a",
  // "b") cannot collide. But a RAW NUL makes this file read as binary to grep/rg, which
  // scan the whole file -- git only sniffs the first 8KB, so git still rendered it as
  // text and review saw nothing wrong. An audit of this file then silently matches
  // nothing instead of searching it: a check that did not run, looking like one that
  // passed. The escape has the identical runtime value and keeps the file greppable.
  const key = (x: number, device: string): string => `${x}\u0000${device}`;

  const observedKeys = new Set<string>();
  for (const o of observed) {
    if (o.ca !== roster.ca) {
      findings.push({
        code: "artifact-wrong-ca",
        severity: "error",
        x: o.x,
        message: `${o.path}: ca "${o.ca}" is not this roster's ca "${roster.ca}"`,
      });
      continue;
    }
    if (o.schema !== FROST_SEALED_SHARE_SCHEMA) {
      findings.push({
        code: "artifact-schema-mismatch",
        severity: "error",
        x: o.x,
        message: `${o.path}: schema "${o.schema}" is not ${FROST_SEALED_SHARE_SCHEMA}`,
      });
      continue;
    }
    if (o.groupPublicKeyHex !== roster.groupPublicKeyHex) {
      findings.push({
        code: "artifact-wrong-group-key",
        severity: "error",
        x: o.x,
        message: `${o.path}: group public key does not match the roster's`,
      });
      continue;
    }
    if (o.sealTier !== roster.sealTier) {
      findings.push({
        code: "artifact-tier-mismatch",
        severity: "error",
        x: o.x,
        message:
          `${o.path}: sealed at "${o.sealTier}" but the roster declares "${roster.sealTier}". ` +
          "A roster that declares hardware and holds a software-sealed share is the silent " +
          "downgrade in artifact form.",
      });
      continue;
    }
    if (o.sealedByToken === undefined) {
      findings.push({
        code: "artifact-unbound",
        severity: isHardwareSealTier(roster.sealTier) ? "error" : "info",
        x: o.x,
        message:
          `${o.path}: records no sealing token, so it cannot be attributed to a roster ` +
          "position. It is openable by whatever backend holds the key, which is the " +
          "pre-binding behaviour. Re-seal it under an identified token.",
      });
      continue;
    }
    observedKeys.add(key(o.x, o.sealedByToken));
    const declared = roster.participants.find((p) => p.x === o.x);
    if (declared === undefined || !declared.devices.includes(o.sealedByToken)) {
      findings.push({
        code: "undeclared-artifact",
        severity: "error",
        x: o.x,
        device: o.sealedByToken,
        message:
          `${o.path}: share x=${o.x} is sealed to "${o.sealedByToken}", which the roster does ` +
          "not declare for that position. An artifact nobody declared is a position nobody " +
          "counted: the device that holds it has more reach than the roster's arithmetic says.",
      });
    }
  }

  for (const p of roster.participants) {
    for (const d of p.devices) {
      if (!observedKeys.has(key(p.x, d))) {
        findings.push({
          code: "missing-artifact",
          severity: "error",
          x: p.x,
          device: d,
          message:
            `the roster declares share x=${p.x} on "${d}" and no such artifact was found. ` +
            "A declared position with no artifact is a threshold that cannot actually be met.",
        });
      }
    }
  }

  return findings;
}

// ============================================================================
// THE ROSTER'S OWN FRESHNESS -- checked against the SIGNED epoch chain
// ============================================================================
//
// Everything above compares a declaration against artifacts. Both can agree perfectly and
// both can be OUT OF DATE: the shares were re-issued by a delta rotation, the roster was
// never rewritten, and `verify` still prints OK because every artifact it finds is the one
// the roster names. That is the same defect shape 081M00NSP0Q087G0R003R89Y5K found in
// `foldChain` -- a fold that reported "current" for a replica that had simply stopped
// hearing. A check whose clean answer is reachable by not knowing anything is not a check.
//
// The discriminator that exists is the GROUP PUBLIC KEY, and it is cryptographic rather
// than clerical: a revoking delta rotation moves the group key to A' = A + [delta]B, and
// key-epoch-ledger.ts carries that move as a transition statement THRESHOLD-SIGNED BY THE
// OLD QUORUM. `foldChain` walks a pinned key forward through those signatures. So the
// question "is this roster still the current custody set" has an answer nobody can forge
// without reaching the old threshold, and this function asks it.
//
// ----------------------------------------------------------------------------
// `retiredIndices` IS NOT AN IDENTITY BLOCKLIST -- and this is the trap
// ----------------------------------------------------------------------------
//
// `foldChain` returns the grow-only UNION of every index retired along the chain. The
// tempting check is "refuse a roster that declares a retired index". It is wrong, and it
// is wrong in the direction that locks out an honest operator:
//
//   A PARTICIPANT INDEX IS A SLOT, NOT A PARTY.
//
// Retire index 3 at epoch 1 and re-issue index 3 to a new device at epoch 2, and the union
// still contains 3 while slot 3 holds a live, current share. Treating the union as a
// blocklist would refuse a correct roster forever, and no later evidence could clear it
// because the set never forgets. So a declared index appearing in the union is reported at
// `info` -- worth a human's eye, never a refusal. The refusal is the group key, which
// tracks the actual state of the secret rather than the history of the numbering.
//
// ----------------------------------------------------------------------------
// THE LIMIT, NAMED: a group-key-preserving refresh leaves NO discriminator
// ----------------------------------------------------------------------------
//
// This check catches a roster stranded by a REVOKING rotation, because that changes the
// group key. It does NOT catch a stale share after a `zeroDelta` proactive refresh, which
// preserves the group key on purpose and revokes nothing. After such a refresh a
// pre-refresh artifact has the identical ca, x, threshold, groupPublicKeyHex and
// sealedByToken as its replacement -- every field the roster and the sealed-share header
// carry. There is nothing in any artifact to tell them apart, so this module cannot, and
// says so rather than implying a freshness it does not check. Closing it needs a
// refresh-generation field in the sealed-share AAD, which is a schema change and a
// separate item; destroying the superseded artifacts remains the operative control, and
// that control is a CEREMONY, not a check.
//
// ----------------------------------------------------------------------------
// WHAT IS ENFORCED VS WHAT IS BOOKKEEPING (say it plainly)
// ----------------------------------------------------------------------------
//
//   ENFORCED by cryptography, upstream of this function:
//     * which token may open a share -- FrostSealedShareFileV2.sealedByToken is in the AAD
//       and in the sealed bind string; a different token fails the unseal.
//     * which group key is current -- transitions are threshold-signed by the old quorum
//       and `foldChain` follows only signatures it verified from a caller-held pin.
//
//   BOOKKEEPING, and no amount of checking changes it:
//     * the roster FILE itself. It is unsigned JSON that a human writes. This function can
//       prove a roster is stale; nothing here proves a roster is AUTHORISED. Who may
//       change a roster, and what signs the change, is an open custody decision -- see the
//       work item; it is deliberately not decided in code here.
//     * `location`, and the fact that two named devices are in two different buildings.

/** 32-byte ed25519 point, lowercase hex, no prefix -- what bytesToHex/toHex both emit. */
const GROUP_KEY_HEX = /^[0-9a-f]{64}$/u;

function foldKeyHex(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}

/**
 * Check the roster's pinned group key against the signed epoch chain.
 *
 * `fold` is a {@link ChainFold} the CALLER obtained from `foldChain(pin, ledger)` -- this
 * module never verifies a signature itself, so it can hold no key material and can be read
 * as pure arithmetic. The security therefore rests on the caller having folded from a pin
 * it actually trusts; a fold from an attacker-chosen pin proves nothing here or anywhere.
 *
 * Returns findings; `assertRosterSound` turns the errors into a refusal.
 */
export function checkRosterAgainstEpochChain(
  roster: FrostTokenRoster,
  fold: ChainFold,
): readonly RosterFinding[] {
  const findings: RosterFinding[] = [];

  // An entry that cannot be checked must not pass AS checked. A roster whose key is not
  // readable as a group public key is not "probably fine" -- it is unverifiable, and the
  // vacuity failure here would be to compare two strings that were never keys and report
  // agreement.
  if (!GROUP_KEY_HEX.test(roster.groupPublicKeyHex)) {
    findings.push({
      code: "roster-key-unreadable",
      severity: "error",
      message:
        `the roster's groupPublicKeyHex is not 64 lowercase hex characters, so it cannot be ` +
        "compared to the chain's key at all. An unreadable pin is refused rather than " +
        "skipped: a comparison that cannot run must not report agreement.",
    });
    return findings;
  }

  if (fold.status === "forked") {
    findings.push({
      code: "roster-chain-forked",
      severity: "error",
      message:
        `the epoch chain for "${fold.keyId}" FORKS at epoch ${String(fold.epoch)} ` +
        `(${String(fold.candidates.length)} ` +
        "distinct signed transitions extend the same key). There is no single current group " +
        "key, so no roster can be shown current against it. Equivocation at the threshold is " +
        "the compromise case: re-pin out of band, do not pick a branch.",
    });
    return findings;
  }

  const current = foldKeyHex(fold.groupPublicKey);
  if (current !== roster.groupPublicKeyHex) {
    findings.push({
      code: "roster-key-not-current",
      severity: "error",
      message:
        `the roster is pinned to group key ${roster.groupPublicKeyHex} but the signed chain for ` +
        `"${fold.keyId}" is at epoch ${String(fold.epoch)} with key ${current} ` +
        `(${String(fold.advanced)} transition(s) followed from the pin). The shares this roster ` +
        "describes were superseded by a rotation the roster never learned about. Every " +
        "artifact check above can still pass while this is true, which is exactly why it is " +
        "checked separately.",
    });
  }

  // INFO, never an error -- see the header. A slot is not a party.
  const retired = new Set(fold.retiredIndices);
  for (const p of roster.participants) {
    if (!retired.has(p.x)) continue;
    findings.push({
      code: "roster-index-retired-upstream",
      severity: "info",
      x: p.x,
      message:
        `index x=${String(p.x)} appears in the chain's retired union. This is NOT a refusal: an ` +
        "index " +
        "is a slot, not a party, and a slot retired at one epoch may have been re-issued to a " +
        "new device at a later one. Confirm by hand that this position was re-issued rather " +
        "than assuming either way.",
    });
  }

  return findings;
}

// ============================================================================
// CLI -- the two commands a custody ceremony needs
// ============================================================================
//
// No ceremony script and no interactive prompting: these print facts and exit non-zero
// when the facts are bad. `tokens` is the discovery step a roster is written FROM;
// `verify` is the check that the roster and the artifacts agree.
//
//   bun tools/setup/persona-keys/frost-token-roster.ts tokens /opt/homebrew/lib/ykcs11.dylib
//   bun tools/setup/persona-keys/frost-token-roster.ts verify roster.json dirA dirB dirC
//
// `tokens` reads CK_TOKEN_INFO label and serial only -- both printed on the outside of
// the device. It never logs in, never touches a key, and never needs a PIN.

if (import.meta.main) {
  const { existsSync, readdirSync, readFileSync } = await import("node:fs");
  const [command, ...rest] = process.argv.slice(2);

  if (command === "tokens") {
    const libraryPath = rest[0];
    if (libraryPath === undefined) {
      console.error("usage: frost-token-roster.ts tokens <pkcs11-library-path>");
      process.exit(2);
    }
    const { describeAttachedPkcs11Tokens } = await import("./frost-share-adapter.ts");
    const attached = describeAttachedPkcs11Tokens({ libraryPath });
    if (attached.length === 0) {
      console.error("no tokens attached to this module (a driver on disk is not a device)");
      process.exit(1);
    }
    console.log("attached tokens -- put the IDENTITY in the roster, never the slot:");
    for (const t of attached) {
      console.log(
        `  slot ${t.slotId}\tidentity ${t.tokenIdentity ?? `<unidentifiable: ${t.reason ?? "?"}>`}`,
      );
    }
    console.log(
      "\nslot numbers are shown for orientation only. They move when anything is unplugged;\n" +
        "the identity does not, which is why the artifact and the roster both use it.",
    );
    process.exit(0);
  }

  if (command === "verify") {
    const rosterPath = rest[0];
    const dirs = rest.slice(1);
    if (rosterPath === undefined || dirs.length === 0) {
      console.error("usage: frost-token-roster.ts verify <roster.json> <share-dir> [share-dir...]");
      process.exit(2);
    }
    const declared = JSON.parse(readFileSync(rosterPath, "utf8")) as FrostTokenRoster;
    const fx: FrostRosterEffects = {
      exists: (p) => existsSync(p),
      readText: (p) => readFileSync(p, "utf8"),
      listFiles: (p) => readdirSync(p),
    };
    const observed = collectSealBindings(fx, dirs);
    const findings = [...checkRoster(declared), ...verifyRosterAgainstArtifacts(declared, observed)];
    for (const f of findings) console.log(`[${f.severity}] ${f.code}: ${f.message}`);
    const errors = rosterErrors(findings);
    if (errors.length > 0) {
      console.error(`\n${errors.length} error(s): this roster is NOT the threshold it declares.`);
      process.exit(1);
    }
    console.log(
      `\nOK: ${declared.participants.length} participants, threshold ${declared.threshold}, ` +
        `${devicePositionReach(declared).size} devices, ${observed.length} artifacts. ` +
        `Max positions reachable by any one device: ${maxPositionsPerDevice(declared)}.`,
    );
    process.exit(0);
  }

  console.error("usage: frost-token-roster.ts <tokens|verify> ...");
  process.exit(2);
}

export function rosterErrors(findings: readonly RosterFinding[]): readonly RosterFinding[] {
  return findings.filter((f) => f.severity === "error");
}

/**
 * Throw unless the roster is structurally sound AND matched by the artifacts.
 *
 * Refusal, not a warning. Same direction as createHsmShareAdapter's no-silent-downgrade:
 * a custody set whose real threshold is lower than its declared one must not be usable by
 * a caller that did not look at the findings.
 */
export function assertRosterSound(
  roster: FrostTokenRoster,
  observed?: readonly ObservedSealBinding[],
  fold?: ChainFold,
): void {
  const findings = [
    ...checkRoster(roster),
    ...(observed === undefined ? [] : verifyRosterAgainstArtifacts(roster, observed)),
    ...(fold === undefined ? [] : checkRosterAgainstEpochChain(roster, fold)),
  ];
  const errors = rosterErrors(findings);
  if (errors.length === 0) return;
  throw new Error(
    `frost-token-roster: ${errors.length} error(s) in roster for ca "${roster.ca}":\n` +
      errors.map((e) => `  [${e.code}] ${e.message}`).join("\n"),
  );
}

// ============================================================================
// LIVE ATTESTATION -- the N x N matrix, on real devices
// ============================================================================

/** What happened when a device was asked to open a share. */
export type OpenOutcome = "opened" | "refused";

/**
 * Run every device against every position and check the result against the roster.
 *
 * `open` is injected (§13 noninterference): the hardware lane passes a real adapter, a
 * test passes a table. This is the strongest form of "verifiably distributed" available
 * -- not "the headers agree" but "the devices actually behave that way" -- and it is the
 * only check that can catch a shared wrapping key that also had its identity binding
 * defeated, or a device that turns out to be two names for one chip.
 *
 * Requires every device present at once, so it belongs to a ceremony, not to a load path.
 */
export function attestRosterOnDevices(
  roster: FrostTokenRoster,
  open: (device: string, x: number) => OpenOutcome,
): readonly RosterFinding[] {
  const findings: RosterFinding[] = [];
  const reach = devicePositionReach(roster);
  for (const [device, ownPositions] of reach) {
    for (const p of roster.participants) {
      const expected: OpenOutcome = ownPositions.has(p.x) ? "opened" : "refused";
      const actual = open(device, p.x);
      if (actual === expected) continue;
      findings.push({
        code: expected === "opened" ? "missing-artifact" : "undeclared-artifact",
        severity: "error",
        x: p.x,
        device,
        message:
          expected === "opened"
            ? `device "${device}" is declared to hold x=${p.x} and could not open it`
            : `device "${device}" opened x=${p.x}, which the roster does not give it. One ` +
              "compromise now yields more than one position.",
      });
    }
  }
  return findings;
}
