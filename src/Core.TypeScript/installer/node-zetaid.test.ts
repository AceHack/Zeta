/**
 * node-zetaid.test.ts — the byte-lock between the TypeScript node-ZetaId mint
 * and the bash-3.2 one that actually runs inside the NixOS installer ISO.
 *
 * WHY THIS FILE IS THE POINT AND NOT A FORMALITY. Two implementations of one
 * 128-bit encoding is the exact drift the four-oracle discipline exists for,
 * and the drift would be INVISIBLE: a wrong bit in the category field still
 * produces a well-formed, 26-character, sort-preserving id that no shape check
 * anywhere would reject. It would just name a different kind of thing than
 * every other id in the register. So the comparison here is character-for-
 * character over fixed vectors, including the boundaries where both are
 * required to REFUSE — a pair of oracles that agree on acceptance and disagree
 * on rejection is not byte-locked, it is byte-locked on the easy half.
 *
 * The shell block is EXTRACTED from the real zeta-install.sh (never a copy
 * pasted here), so editing the installer without editing this file goes red.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import {
  mintNodeZetaId,
  isValidNodeZetaId,
  decideNodeZetaIdProvenance,
  MAX_NODE_ZETAID_MS,
  NODE_ZETAID_PATH,
} from "./node-zetaid.ts";
import { packGeneric } from "../zeta-id/zeta-id.ts";
import { format } from "../zeta-id/encoding.ts";
import { Category } from "../zeta-id/types.ts";

const INSTALL_SH = new URL("../../../full-ai-cluster/usb-nixos-installer/zeta-install.sh", import.meta.url).pathname;
const SRC = readFileSync(INSTALL_SH, "utf8");
const BEGIN = "# ZETA-NODE-ZETAID-BEGIN";
const END = "# ZETA-NODE-ZETAID-END";

function extractBlock(): string {
  const b = SRC.indexOf(BEGIN);
  const e = SRC.indexOf(END);
  if (b < 0) throw new Error("ZETA-NODE-ZETAID-BEGIN marker missing from zeta-install.sh");
  if (e < 0) throw new Error("ZETA-NODE-ZETAID-END marker missing from zeta-install.sh");
  if (e < b) throw new Error("ZETA-NODE-ZETAID markers out of order in zeta-install.sh");
  return SRC.slice(b, e + END.length);
}

const workdir = mkdtempSync(join(tmpdir(), "zeta-nodeid-"));
const blockPath = join(workdir, "node-zetaid-block.sh");
writeFileSync(blockPath, extractBlock() + "\n", "utf8");

/** Run one command against the extracted block. Returns stdout AND status,
 *  because the refusal half of the byte-lock is carried by the status. */
function runShell(script: string): { out: string; status: number } {
  const runner = join(workdir, "runner.sh");
  writeFileSync(runner, "set -u\nsource " + blockPath + "\n" + script + "\n", "utf8");
  // NOT `| head` and NOT a pipeline: `$?` after a pipe is the LAST command's
  // status, which is how a refusal reads as a success.
  const r = spawnSync("bash", [runner], { encoding: "utf8" });
  return { out: String(r.stdout), status: r.status ?? -1 };
}

function shellMint(ms: string, randHex: string): { out: string; status: number } {
  return runShell(`zeta_node_zetaid_from_parts ${ms} ${randHex}; printf '\\n%s' "$?"`);
}

/** Split the trailing "\n<status>" the helper appends. */
function shellMintParts(ms: string, randHex: string): { id: string; rc: string } {
  const { out } = shellMint(ms, randHex);
  const i = out.lastIndexOf("\n");
  return { id: out.slice(0, i), rc: out.slice(i + 1) };
}

/** The TypeScript side, from a hex string, matching the shell's "low 78 bits
 *  of the first 20 hex chars" rule. */
function tsMint(ms: number, randHex: string): string {
  const rand78 = BigInt("0x" + randHex.slice(0, 20)) & ((1n << 78n) - 1n);
  return mintNodeZetaId(ms, rand78);
}

// Vectors chosen to move every field independently: an ordinary 2026 clock, a
// zero clock, a one-ms clock with all-ones randomness (so the category and
// version fields are the only zero bits left and a shift shows up), and the
// last representable millisecond.
const VECTORS: ReadonlyArray<{ readonly name: string; readonly ms: number; readonly hex: string }> = [
  { name: "an ordinary 2026 install", ms: 1787000000000, hex: "0123456789abcdef0123" },
  { name: "epoch, no randomness", ms: 0, hex: "00000000000000000000" },
  { name: "all-ones randomness (only version+category stay zero)", ms: 1, hex: "ffffffffffffffffffff" },
  { name: "the last representable millisecond", ms: MAX_NODE_ZETAID_MS - 1, hex: "5555555555aaaaaaaaaa" },
  { name: "uppercase hex is the same value as lowercase", ms: 1787000000001, hex: "ABCDEF0123456789ABCD" },
];

describe("node ZetaId: shell installer vs TypeScript oracle", () => {
  for (const v of VECTORS) {
    test(`byte-identical — ${v.name}`, () => {
      const { id, rc } = shellMintParts(String(v.ms), v.hex);
      expect(rc).toBe("0");
      expect(id).toBe(tsMint(v.ms, v.hex));
      expect(id).toHaveLength(26);
    });
  }

  test("the scheme IS inventory/new-item.ts's, not a lookalike", () => {
    // If this ever diverges, the installer is minting into a category the
    // register does not use, and nothing else would notice.
    const ms = 1787000000000;
    const rand78 = BigInt("0x0123456789abcdef0123") & ((1n << 78n) - 1n);
    const viaRegisterScheme = format(packGeneric(1, Category.InventoryAsset, (BigInt(ms) << 78n) | rand78));
    expect(mintNodeZetaId(ms, rand78)).toBe(viaRegisterScheme);
    const { id } = shellMintParts(String(ms), "0123456789abcdef0123");
    expect(id).toBe(viaRegisterScheme);
  });

  test("both oracles REFUSE an ms that needs more than 41 bits", () => {
    // The failure this prevents is not an error, it is a SILENT WRAP: the shell
    // would emit a 1970-shaped id that collides with a real one, forever.
    const { id, rc } = shellMintParts(String(MAX_NODE_ZETAID_MS), "0123456789abcdef0123");
    expect(rc).not.toBe("0");
    expect(id).toBe("");
    expect(() => mintNodeZetaId(MAX_NODE_ZETAID_MS, 0n)).toThrow(/41 bits/);
  });

  test("shell refuses non-hex randomness rather than encoding garbage", () => {
    const { id, rc } = shellMintParts("1787000000000", "zzzzzzzzzzzzzzzzzzzz");
    expect(rc).not.toBe("0");
    expect(id).toBe("");
  });

  test("shell refuses short randomness rather than padding it", () => {
    const { id, rc } = shellMintParts("1787000000000", "0123");
    expect(rc).not.toBe("0");
    expect(id).toBe("");
  });

  test("shell refuses a non-numeric ms", () => {
    const { id, rc } = shellMintParts("not-a-number", "0123456789abcdef0123");
    expect(rc).not.toBe("0");
    expect(id).toBe("");
  });

  test("distinct randomness gives distinct ids at the same millisecond", () => {
    const a = shellMintParts("1787000000000", "0000000000000000000a").id;
    const b = shellMintParts("1787000000000", "0000000000000000000b").id;
    expect(a).not.toBe(b);
  });

  test("later millisecond sorts later as a STRING (the whole point of Crockford)", () => {
    const early = shellMintParts("1787000000000", "0123456789abcdef0123").id;
    const late = shellMintParts("1787000009999", "0123456789abcdef0123").id;
    expect(early < late).toBe(true);
  });

  test("the impure wrapper mints through the injected seams", () => {
    const { out } = runShell(
      `ZETA_ZETAID_MS=1787000000000 ZETA_ZETAID_RANDHEX=0123456789abcdef0123 zeta_mint_node_zetaid`,
    );
    expect(out).toBe(tsMint(1787000000000, "0123456789abcdef0123"));
  });

  test("the wrapper with no seams still mints something valid", () => {
    const { out } = runShell(`zeta_mint_node_zetaid`);
    expect(isValidNodeZetaId(out)).toBe(true);
  });
});

describe("node ZetaId shape validation: shell vs TypeScript", () => {
  const CASES: ReadonlyArray<{ readonly v: string; readonly valid: boolean; readonly why: string }> = [
    { v: "0EG1300E0028TMASW9NF6YY093", valid: true, why: "a real minted id" },
    { v: "080000000000A0000000000000", valid: true, why: "the epoch vector" },
    { v: "", valid: false, why: "absent" },
    { v: "0EG1300E0028TMASW9NF6YY09", valid: false, why: "25 chars" },
    { v: "0EG1300E0028TMASW9NF6YY0933", valid: false, why: "27 chars" },
    { v: "8EG1300E0028TMASW9NF6YY093", valid: false, why: "leading char > 7: does not fit 128 bits" },
    { v: "0EG1300E0028TMASW9NF6YY09I", valid: false, why: "I is not in the Crockford alphabet" },
    { v: "0EG1300E0028TMASW9NF6YY09U", valid: false, why: "U is check-only in Crockford" },
    { v: "0eg1300e0028tmasw9nf6yy093", valid: false, why: "lowercase: written by us, never typed" },
    { v: "0EG1300E0028TMASW9NF6YY09-", valid: false, why: "punctuation" },
  ];
  for (const c of CASES) {
    test(`${c.valid ? "accepts" : "rejects"} — ${c.why}`, () => {
      expect(isValidNodeZetaId(c.v)).toBe(c.valid);
      const { status } = runShell(`zeta_pf_validate_node_zetaid ${JSON.stringify(c.v)}`);
      expect(status === 0).toBe(c.valid);
    });
  }
});

describe("provenance: recover on repair, mint on reformat", () => {
  test("a repair RECOVERS — a node that came back renamed forgot itself (§5)", () => {
    expect(
      decideNodeZetaIdProvenance({
        recovered: "0EG1300E0028TMASW9NF6YY093",
        priorInstallFound: true,
        forceReformatArmed: false,
      }),
    ).toBe("recovered");
  });

  test("a legacy repair mints, and SAYS it minted", () => {
    expect(
      decideNodeZetaIdProvenance({ recovered: "", priorInstallFound: true, forceReformatArmed: false }),
    ).toBe("minted-on-repair-legacy");
  });

  test("a force-reformat mints even when an id WAS recoverable", () => {
    expect(
      decideNodeZetaIdProvenance({
        recovered: "0EG1300E0028TMASW9NF6YY093",
        priorInstallFound: true,
        forceReformatArmed: true,
      }),
    ).toBe("minted");
  });

  test("a fresh install mints", () => {
    expect(
      decideNodeZetaIdProvenance({ recovered: "", priorInstallFound: false, forceReformatArmed: false }),
    ).toBe("minted");
  });
});

describe("the installer wiring these functions serve", () => {
  test("Step 2.7 recovers node-zetaid read-only, alongside the other keys", () => {
    expect(SRC).toContain('[ -f "$f/node-zetaid" ] && ZETA_REPAIR_ZETAID=');
    // The read-only discipline the recovery block documents must still be the
    // one it uses: a plain `-o ro` mount REPLAYS the ext4 journal, which is a
    // write to a disk consent has not been given for.
    expect(SRC).toContain('sudo mount -t ext4 -o ro,noload "$part" "$ZETA_REPAIR_ROOT_MOUNT"');
  });

  test("Step 6.65 writes the sibling file, and cluster-node-id is untouched", () => {
    expect(SRC).toContain('NODE_ZETAID_DST="/mnt' + NODE_ZETAID_PATH + '"');
    expect(SRC).toContain('HOSTNAME_DST="/mnt/etc/zeta/cluster-node-id"');
    expect(SRC).toContain('echo "$ZETA_REPAIR_NODE_ID" | sudo tee "$HOSTNAME_DST"');
  });

  test("what is written is validated first — an unchecked id becomes permanent", () => {
    expect(SRC).toContain('if zeta_pf_validate_node_zetaid "$NODE_ZETAID_VALUE"; then');
  });

  test("a force-reformat discards the recovered id so Step 6.65 mints", () => {
    expect(SRC).toContain("unset ZETA_REPAIR_NODE_ID");
    expect(SRC).toContain('ZETA_REPAIR_ZETAID=""');
  });
});
