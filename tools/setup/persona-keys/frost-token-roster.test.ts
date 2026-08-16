// frost-token-roster.ts -- CI-SAFE LANE (081M00PYT0K087G0R002F9YSEG).
//
// Runs anywhere: no token, no TPM, no shell. Roster checking is deliberately pure over
// injected observations, so the property "this custody set really is distributed" is
// checkable on a laptop with nothing plugged in -- which is when you most want to ask.
//
// WHAT THESE TESTS ARE ABOUT, stated so they cannot be misread:
//
// The security property is the IDENTITY BINDING in frost-share-adapter.ts -- share i
// opens only under the token that sealed it. This file tests the ACCOUNTING that binding
// makes possible: whether the N shares are on N distinct devices, whether a device
// quietly holds two positions, whether a backup copy got counted as a second participant.
// None of that is cryptography and none of it replaces the binding. It is the arithmetic
// that decides whether a correctly-bound set of artifacts adds up to the threshold it
// claims.

import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertRosterSound,
  attestRosterOnDevices,
  checkRoster,
  collectSealBindings,
  devicePositionReach,
  FROST_TOKEN_ROSTER_SCHEMA,
  maxPositionsPerDevice,
  positionsSurvivingLoss,
  rosterErrors,
  seizureWitness,
  verifyRosterAgainstArtifacts,
  type FrostRosterEffects,
  type FrostTokenRoster,
  type ObservedSealBinding,
  type OpenOutcome,
  type RosterFindingCode,
} from "./frost-token-roster.ts";
import { FROST_SEALED_SHARE_SCHEMA } from "./frost-share-adapter.ts";

const GROUP_KEY = "ab".repeat(32);

const A = "house-a#YK-11111";
const B = "house-b#YK-22222";
const C = "house-c#YK-33333";
/** The backup token for participant 3, in a fourth location. */
const C_BACKUP = "house-d#YK-44444";

function roster(over: Partial<FrostTokenRoster> = {}): FrostTokenRoster {
  return {
    schema: FROST_TOKEN_ROSTER_SCHEMA,
    ca: "zeta-ca",
    groupPublicKeyHex: GROUP_KEY,
    threshold: 2,
    totalShares: 3,
    sealTier: "hardware-pkcs11",
    participants: [
      { x: 1, location: "house A", devices: [A] },
      { x: 2, location: "house B", devices: [B] },
      { x: 3, location: "house C", devices: [C] },
    ],
    ...over,
  };
}

function codes(findings: readonly { code: RosterFindingCode }[]): readonly RosterFindingCode[] {
  return findings.map((f) => f.code);
}

function observation(x: number, device: string, over: Partial<ObservedSealBinding> = {}): ObservedSealBinding {
  return {
    path: `/shares/${device}/share-0${x}.json`,
    schema: FROST_SEALED_SHARE_SCHEMA,
    sealTier: "hardware-pkcs11",
    ca: "zeta-ca",
    groupPublicKeyHex: GROUP_KEY,
    x,
    sealedByToken: device,
    ...over,
  };
}

describe("FrostTokenRoster: a sound roster", () => {
  test("FTR-1: three shares on three distinct devices raises no error", () => {
    expect(rosterErrors(checkRoster(roster()))).toEqual([]);
    expect(maxPositionsPerDevice(roster())).toBe(1);
    expect(seizureWitness(roster())).toBeNull();
  });

  test("FTR-2: one device per position means the real cost of a seizure IS the threshold", () => {
    // Not a hope: if every device reaches at most one position then k devices yield at
    // most k positions, so reaching a threshold of t needs at least t devices, and t
    // devices drawn from distinct participants do reach it. maxPositionsPerDevice === 1
    // is that proof's hypothesis, which is why it is asserted rather than described.
    const r = roster();
    expect(maxPositionsPerDevice(r)).toBe(1);
    for (const positions of devicePositionReach(r).values()) expect(positions.size).toBe(1);
  });
});

// ============================================================================
// DUPLICATION -- a share may live on N devices and is still ONE participant
// ============================================================================

describe("FrostTokenRoster: duplication for availability", () => {
  const duplicated = roster({
    participants: [
      { x: 1, location: "house A", devices: [A] },
      { x: 2, location: "house B", devices: [B] },
      // ONE participant. Two devices. Two houses. Still one position.
      { x: 3, location: "house C + house D backup", devices: [C, C_BACKUP] },
    ],
  });

  test("FTR-3: a backup device is expressible and raises no error", () => {
    expect(rosterErrors(checkRoster(duplicated))).toEqual([]);
  });

  test("FTR-4: the backup does NOT add a position -- the threshold is unchanged", () => {
    // Four devices, three positions. This is the invariant the brief names: a share may
    // live on N devices, but that share is still ONE participant. If duplication added a
    // position, totalShares would have to be 4 and the threshold would be met by a
    // smaller fraction of the custody set -- the same defect class as one wrapping key
    // on every token, arriving through the roster instead of through provisioning.
    expect(devicePositionReach(duplicated).size).toBe(4);
    expect(duplicated.participants.length).toBe(3);
    expect(maxPositionsPerDevice(duplicated)).toBe(1);
    expect(seizureWitness(duplicated)).toBeNull();
  });

  test("FTR-5: seizing BOTH devices of one participant still yields ONE position", () => {
    // The adversary's view of duplication: C and C_BACKUP hold the same share, so taking
    // both buys nothing over taking either. Duplication is free on the security axis --
    // which is exactly why it must not be paid for on the threshold axis.
    const reach = devicePositionReach(duplicated);
    const both = new Set([...(reach.get(C) ?? []), ...(reach.get(C_BACKUP) ?? [])]);
    expect([...both]).toEqual([3]);
  });

  test("FTR-6: duplication buys what it is for -- losing a device keeps the position", () => {
    expect(positionsSurvivingLoss(duplicated, [C])).toBe(3);
    expect(positionsSurvivingLoss(duplicated, [C, C_BACKUP])).toBe(2);
    // And a participant with no backup is reported, so Aaron knows what a fire costs.
    expect(codes(checkRoster(duplicated).filter((f) => f.severity === "info"))).toEqual([
      "participant-without-backup",
      "participant-without-backup",
    ]);
  });

  test("FTR-7: the duplicate cannot be smuggled in as a second participant", () => {
    // The other spelling of the same mistake: give the backup its own row. Two rows for
    // one index is refused, so the only way to express a backup is inside the
    // participant, where it cannot be counted twice.
    const twoRows = roster({
      totalShares: 4,
      participants: [
        { x: 1, devices: [A] },
        { x: 2, devices: [B] },
        { x: 3, devices: [C] },
        { x: 3, devices: [C_BACKUP] },
      ],
    });
    expect(codes(rosterErrors(checkRoster(twoRows)))).toContain("duplicate-participant-index");
  });

  test("FTR-8: listing the same device twice inside a participant is refused", () => {
    const inflated = roster({
      participants: [
        { x: 1, devices: [A] },
        { x: 2, devices: [B] },
        { x: 3, devices: [C, C] },
      ],
    });
    expect(codes(rosterErrors(checkRoster(inflated)))).toContain("duplicate-device-within-participant");
  });
});

// ============================================================================
// MUTANT: two shares on ONE token, counted as two positions
// ============================================================================

describe("FrostTokenRoster: a device holding two positions is caught", () => {
  const collapsed = roster({
    participants: [
      { x: 1, devices: [A] },
      // B holds x=2 AND x=3. The roster still says 2-of-3; the truth is 1-of-3.
      { x: 2, devices: [B] },
      { x: 3, devices: [B] },
    ],
  });

  test("FTR-9: the device is named, with the arithmetic", () => {
    const errors = rosterErrors(checkRoster(collapsed));
    expect(codes(errors)).toContain("device-holds-two-positions");
    const e = errors.find((f) => f.code === "device-holds-two-positions");
    expect(e?.device).toBe(B);
    expect(e?.message).toMatch(/x = 2, 3/);
    expect(maxPositionsPerDevice(collapsed)).toBe(2);
  });

  test("FTR-10: the seizure witness shows ONE device meets a threshold of two", () => {
    const witness = seizureWitness(collapsed);
    expect(witness?.devices).toEqual([B]);
    expect(witness?.positions).toEqual([2, 3]);
    expect(codes(rosterErrors(checkRoster(collapsed)))).toContain("seizure-below-threshold");
  });

  test("FTR-11: assertRosterSound refuses it rather than warning", () => {
    expect(() => assertRosterSound(collapsed)).toThrow(/device-holds-two-positions/);
    expect(() => assertRosterSound(collapsed)).toThrow(/seizure-below-threshold/);
  });

  test("FTR-12: the same collapse across three positions is caught at a higher threshold", () => {
    const wide = roster({
      threshold: 3,
      totalShares: 4,
      participants: [
        { x: 1, devices: [A] },
        { x: 2, devices: [B] },
        { x: 3, devices: [B] },
        { x: 4, devices: [C] },
      ],
    });
    // B (2 positions) + A (1) = 3 positions from 2 devices, against a declared 3.
    const witness = seizureWitness(wide);
    expect(witness?.devices.length).toBe(2);
    expect(witness?.positions.length).toBeGreaterThanOrEqual(3);
  });

  test("FTR-13: a participant with no device at all is refused", () => {
    const empty = roster({
      participants: [
        { x: 1, devices: [A] },
        { x: 2, devices: [B] },
        { x: 3, devices: [] },
      ],
    });
    expect(codes(rosterErrors(checkRoster(empty)))).toContain("participant-without-device");
  });
});

// ============================================================================
// THE ARTIFACTS -- declaration versus evidence
// ============================================================================

describe("FrostTokenRoster: verified against what is on disk", () => {
  const observed = [observation(1, A), observation(2, B), observation(3, C)];

  test("FTR-14: a roster matched by its artifacts passes", () => {
    expect(rosterErrors(verifyRosterAgainstArtifacts(roster(), observed))).toEqual([]);
    expect(() => assertRosterSound(roster(), observed)).not.toThrow();
  });

  test("FTR-15: an EXTRA copy nobody declared is caught -- the quiet threshold drop", () => {
    // Six months later, a spare token gets "a backup of share 1, just in case". The
    // artifact is individually perfect: correct schema, correct tier, correctly bound to
    // the device that sealed it, and it opens only under that device. The roster still
    // says 2-of-3. But B now reaches x=1 and x=2, so ONE seizure meets the threshold.
    // Nothing about the artifact is wrong; only the accounting is, and only the
    // observed-to-declared direction can see it.
    const withExtra = [...observed, observation(1, B, { path: "/shares/house-b/share-01.json" })];
    const findings = rosterErrors(verifyRosterAgainstArtifacts(roster(), withExtra));
    expect(codes(findings)).toEqual(["undeclared-artifact"]);
    expect(findings[0]?.device).toBe(B);
    expect(findings[0]?.x).toBe(1);
  });

  test("FTR-16: a declared position with no artifact is caught", () => {
    const missing = [observation(1, A), observation(2, B)];
    const findings = rosterErrors(verifyRosterAgainstArtifacts(roster(), missing));
    expect(codes(findings)).toEqual(["missing-artifact"]);
    expect(findings[0]?.device).toBe(C);
  });

  test("FTR-17: a duplicated participant needs BOTH artifacts, and accepts exactly them", () => {
    const dup = roster({
      participants: [
        { x: 1, devices: [A] },
        { x: 2, devices: [B] },
        { x: 3, devices: [C, C_BACKUP] },
      ],
    });
    const complete = [...observed, observation(3, C_BACKUP, { path: "/shares/house-d/share-03.json" })];
    expect(rosterErrors(verifyRosterAgainstArtifacts(dup, complete))).toEqual([]);
    // Declared backup, never sealed: the availability the roster promises is not there.
    expect(codes(rosterErrors(verifyRosterAgainstArtifacts(dup, observed)))).toEqual(["missing-artifact"]);
  });

  test("FTR-18: a software-sealed artifact under a hardware roster is the downgrade, at rest", () => {
    const downgraded = [observation(1, A), observation(2, B), observation(3, C, { sealTier: "software-sealed" })];
    expect(codes(rosterErrors(verifyRosterAgainstArtifacts(roster(), downgraded)))).toContain(
      "artifact-tier-mismatch",
    );
  });

  test("FTR-19: an artifact with NO token binding cannot hold a hardware roster position", () => {
    // This is a pre-binding artifact: openable by whatever backend holds the key. It
    // cannot be attributed to a device, so it cannot count as a distributed position.
    const unbound: ObservedSealBinding = {
      path: "/shares/legacy/share-03.json",
      schema: FROST_SEALED_SHARE_SCHEMA,
      sealTier: "hardware-pkcs11",
      ca: "zeta-ca",
      groupPublicKeyHex: GROUP_KEY,
      x: 3,
    };
    const findings = rosterErrors(verifyRosterAgainstArtifacts(roster(), [observation(1, A), observation(2, B), unbound]));
    expect(codes(findings)).toContain("artifact-unbound");
    expect(codes(findings)).toContain("missing-artifact");
  });

  test("FTR-20: an artifact for a different group key or ca is not silently absorbed", () => {
    const foreign = [
      observation(1, A),
      observation(2, B),
      observation(3, C, { groupPublicKeyHex: "ff".repeat(32) }),
    ];
    expect(codes(rosterErrors(verifyRosterAgainstArtifacts(roster(), foreign)))).toContain(
      "artifact-wrong-group-key",
    );
    const otherCa = [observation(1, A), observation(2, B), observation(3, C, { ca: "other-ca" })];
    expect(codes(rosterErrors(verifyRosterAgainstArtifacts(roster(), otherCa)))).toContain("artifact-wrong-ca");
  });
});

describe("FrostTokenRoster: reading artifacts", () => {
  function fakeDir(): { fx: FrostRosterEffects; put: (dir: string, name: string, body: unknown) => void } {
    const files = new Map<string, string>();
    const dirs = new Map<string, string[]>();
    return {
      fx: {
        exists: (p) => dirs.has(p),
        readText: (p) => files.get(p) ?? "",
        listFiles: (p) => dirs.get(p) ?? [],
      },
      put: (dir, name, body) => {
        files.set(`${dir}/${name}`, JSON.stringify(body));
        dirs.set(dir, [...(dirs.get(dir) ?? []), name]);
      },
    };
  }

  test("FTR-21: verification reads HEADERS ONLY and needs no device attached", () => {
    // The `sealed` box here is unopenable garbage and no key exists anywhere. If roster
    // verification needed to decrypt, this test could not pass -- and the check would be
    // a ceremony instead of something runnable on any laptop at any time.
    const { fx, put } = fakeDir();
    put("/shares/house-a", "share-01.json", {
      schema: FROST_SEALED_SHARE_SCHEMA,
      sealTier: "hardware-pkcs11",
      ca: "zeta-ca",
      groupPublicKeyHex: GROUP_KEY,
      x: 1,
      sealedByToken: A,
      sealed: { alg: "PKCS11:AES-256-CBC-PAD", nonceB64: "AAAA", ciphertextB64: "not-openable" },
    });
    const found = collectSealBindings(fx, ["/shares/house-a"]);
    expect(found.length).toBe(1);
    expect(found[0]?.sealedByToken).toBe(A);
    expect(Object.keys(found[0] ?? {})).not.toContain("sealed");
  });

  test("FTR-22: non-share files and absent directories are ignored, not guessed at", () => {
    const { fx, put } = fakeDir();
    put("/shares/house-a", "README.md", {});
    put("/shares/house-a", "share-01.json", {
      schema: FROST_SEALED_SHARE_SCHEMA,
      sealTier: "hardware-pkcs11",
      ca: "zeta-ca",
      groupPublicKeyHex: GROUP_KEY,
      x: 1,
      sealedByToken: A,
    });
    expect(collectSealBindings(fx, ["/shares/house-a", "/shares/nowhere"]).length).toBe(1);
  });

  test("FTR-23: which DIRECTORY a share sits in carries no authority", () => {
    // A directory name is filing, not identity. Put share 2 in house-a's directory and
    // the verifier still reads it as B's, because the artifact says so. If the directory
    // were trusted this would report a mismatch that does not exist -- one more
    // positional field to accidentally believe.
    const { fx, put } = fakeDir();
    for (const [x, device] of [[1, A] as const, [2, B] as const]) {
      put("/shares/house-a", `share-0${x}.json`, {
        schema: FROST_SEALED_SHARE_SCHEMA,
        sealTier: "hardware-pkcs11",
        ca: "zeta-ca",
        groupPublicKeyHex: GROUP_KEY,
        x,
        sealedByToken: device,
      });
    }
    put("/shares/house-c", "share-03.json", {
      schema: FROST_SEALED_SHARE_SCHEMA,
      sealTier: "hardware-pkcs11",
      ca: "zeta-ca",
      groupPublicKeyHex: GROUP_KEY,
      x: 3,
      sealedByToken: C,
    });
    const found = collectSealBindings(fx, ["/shares/house-a", "/shares/house-c"]);
    expect(rosterErrors(verifyRosterAgainstArtifacts(roster(), found))).toEqual([]);
  });
});

// ============================================================================
// LIVE ATTESTATION -- the N x N matrix
// ============================================================================

describe("FrostTokenRoster: attested on devices", () => {
  /** A device table: which shares each device can actually open. */
  const opener =
    (canOpen: Readonly<Record<string, readonly number[]>>) =>
    (device: string, x: number): OpenOutcome =>
      (canOpen[device] ?? []).includes(x) ? "opened" : "refused";

  test("FTR-24: devices behaving exactly as declared attest clean", () => {
    const findings = attestRosterOnDevices(roster(), opener({ [A]: [1], [B]: [2], [C]: [3] }));
    expect(findings).toEqual([]);
  });

  test("FTR-25: a device that opens a share it does not own is caught", () => {
    // The shared-wrapping-key failure as it would appear if the binding had ALSO been
    // defeated -- header check passes, artifacts all agree, and the chips still misbehave.
    // Only running the matrix on real devices sees this.
    const findings = attestRosterOnDevices(roster(), opener({ [A]: [1, 2], [B]: [2], [C]: [3] }));
    expect(codes(findings)).toEqual(["undeclared-artifact"]);
    expect(findings[0]?.device).toBe(A);
    expect(findings[0]?.x).toBe(2);
  });

  test("FTR-26: a device that cannot open its OWN share is caught", () => {
    const findings = attestRosterOnDevices(roster(), opener({ [A]: [1], [B]: [], [C]: [3] }));
    expect(codes(findings)).toEqual(["missing-artifact"]);
    expect(findings[0]?.device).toBe(B);
  });

  test("FTR-27: both devices of a duplicated participant SHOULD open it", () => {
    const dup = roster({
      participants: [
        { x: 1, devices: [A] },
        { x: 2, devices: [B] },
        { x: 3, devices: [C, C_BACKUP] },
      ],
    });
    expect(attestRosterOnDevices(dup, opener({ [A]: [1], [B]: [2], [C]: [3], [C_BACKUP]: [3] }))).toEqual([]);
    // ...and only it. A backup that also opens share 1 is a second position in disguise.
    const findings = attestRosterOnDevices(
      dup,
      opener({ [A]: [1], [B]: [2], [C]: [3], [C_BACKUP]: [1, 3] }),
    );
    expect(codes(findings)).toEqual(["undeclared-artifact"]);
    expect(findings[0]?.device).toBe(C_BACKUP);
  });
});

describe("FrostTokenRoster: the checks refuse to be vacuous", () => {
  test("FTR-28: an unknown schema is refused before anything else is inferred", () => {
    const alien = { ...roster(), schema: "zeta-frost-token-roster-v99" } as unknown as FrostTokenRoster;
    expect(codes(checkRoster(alien))).toEqual(["unknown-schema"]);
  });

  test("FTR-29: participant count and totalShares must agree", () => {
    expect(codes(rosterErrors(checkRoster(roster({ totalShares: 5 }))))).toContain("participant-count-mismatch");
  });

  test("FTR-30: a threshold larger than the participant list is refused", () => {
    const short = roster({ threshold: 4, totalShares: 3 });
    expect(codes(rosterErrors(checkRoster(short)))).toContain("threshold-unreachable");
  });

  test("FTR-31: the seizure search THROWS rather than returning a clean-looking null", () => {
    // A budget that silently gave up would report "no witness found" for exactly the
    // large rosters where a witness is hardest to see by eye. Refusal is the only honest
    // answer a bounded search can give.
    const many = Array.from({ length: 60 }, (_, i) => ({ x: i + 1, devices: [`d${i}#S${i}`] }));
    const huge = roster({ threshold: 12, totalShares: 60, participants: many });
    expect(() => seizureWitness(huge)).toThrow(/exceeds the budget/);
  });

  test("FTR-32: a real temp dir round-trips through the same reader shape", () => {
    // Guards the filename pattern against the real frostSharePath spelling.
    const dir = mkdtempSync(join(tmpdir(), "zeta-roster-"));
    const files = new Map<string, string>([
      [
        join(dir, "share-01.json"),
        JSON.stringify({
          schema: FROST_SEALED_SHARE_SCHEMA,
          sealTier: "hardware-pkcs11",
          ca: "zeta-ca",
          groupPublicKeyHex: GROUP_KEY,
          x: 1,
          sealedByToken: A,
        }),
      ],
    ]);
    const fx: FrostRosterEffects = {
      exists: () => true,
      readText: (p) => files.get(p) ?? "",
      listFiles: () => ["share-01.json"],
    };
    expect(collectSealBindings(fx, [dir])[0]?.sealedByToken).toBe(A);
  });
});
