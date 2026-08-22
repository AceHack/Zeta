/**
 * tpm-shell-parity.test.ts
 *
 * The falsifier that keeps the bash TPM classifier in zeta-self-register.sh from
 * drifting away from the TypeScript one it was ported from.
 *
 * WHY A SECOND IMPLEMENTATION EXISTS AT ALL. An unattended node has to record
 * whether it can hold a hardware seal, and it has no TypeScript runtime at
 * registration time -- the self-register script is deliberately self-contained
 * (gh + git). So the five-state rule now exists twice. Two implementations of a
 * safety rule is a drift hazard, and the answer is not "be careful": it is to
 * make one fixture set judge both.
 *
 * It EXTRACTS the block between the ZETA-TPM-PARITY markers out of the real
 * tools/installer/zeta-self-register.sh, RUNS it under bash, and compares its
 * verdict against `classifyTpm2Linux` over EVERY capture committed in
 * tools/setup/persona-keys/tpm2-linux-captures.json -- the same fixtures the
 * TypeScript probe's own suite replays.
 *
 * SCOPE OF THE PARITY CLAIM, stated so it is not read wider than it is:
 *   COVERED  -- the five-state precedence, the tpm_version_major parse, and the
 *               tpm2_getcap family parse, over every committed capture.
 *   NOT COVERED -- `zeta_tpm_read_facts`, which touches a real /sys and is
 *               outside the markers on purpose. A fixture cannot stand in for a
 *               permission denial from a kernel, so it is not pretended that one
 *               does. That half remains unverified until a Linux node runs it.
 *   NOT COVERED -- the human-readable `reason` prose. The two sides explain
 *               themselves independently and a wording difference is not a
 *               safety property.
 *
 * No TPM is contacted by this test. Nothing here proves any machine has one.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import {
  classifyTpm2Linux,
  type Tpm2LinuxCapture,
  type Tpm2State,
} from "../../../tools/setup/persona-keys/tpm2-linux-probe.ts";

const SELF_REGISTER_SH = new URL("../../../tools/installer/zeta-self-register.sh", import.meta.url).pathname;
const CAPTURES_JSON = new URL("../../../tools/setup/persona-keys/tpm2-linux-captures.json", import.meta.url).pathname;

const BEGIN = "# ZETA-TPM-PARITY-BEGIN";
const END = "# ZETA-TPM-PARITY-END";

function extractParityBlock(): string {
  const src = readFileSync(SELF_REGISTER_SH, "utf8");
  const b = src.indexOf(BEGIN);
  const e = src.indexOf(END);
  if (b < 0) throw new Error("parity BEGIN marker missing from zeta-self-register.sh");
  if (e < 0) throw new Error("parity END marker missing from zeta-self-register.sh");
  if (e < b) throw new Error("parity markers out of order in zeta-self-register.sh");
  return src.slice(b, e + END.length);
}

interface CaptureEntry {
  readonly name: string;
  readonly provenanceKind: string;
  readonly expectedState: Tpm2State;
  readonly capture: Tpm2LinuxCapture;
}

function loadCaptures(): readonly CaptureEntry[] {
  const parsed = JSON.parse(readFileSync(CAPTURES_JSON, "utf8")) as { captures: CaptureEntry[] };
  return parsed.captures;
}

/**
 * Render one capture as the line-oriented fact record the shell reads. Text
 * blobs go to FILES rather than being escaped into the record: the shell reads
 * `tpm_version_major` and `tpm2_getcap` output from files on a real host too, so
 * this keeps the fixture path and the production path reading the same way.
 */
function renderFactRecord(cap: Tpm2LinuxCapture, scratch: string, tag: string): string {
  const lines: string[] = [`platform=${cap.platform}`];

  for (const n of cap.deviceNodes) lines.push(`node=${n.path}|${n.outcome.kind}`);

  if (cap.sysClassTpm.kind === "listed") {
    lines.push(`sysclass=listed|${cap.sysClassTpm.entries.join(" ")}`);
  } else {
    lines.push(`sysclass=${cap.sysClassTpm.kind}|`);
  }

  let i = 0;
  for (const v of cap.versionMajor) {
    if (v.outcome.kind === "read") {
      const f = join(scratch, `${tag}-version-${String(i)}`);
      writeFileSync(f, v.outcome.text);
      lines.push(`version=${v.path}|read|${f}`);
    } else {
      lines.push(`version=${v.path}|${v.outcome.kind}|`);
    }
    i += 1;
  }

  const g = cap.getcapPropertiesFixed;
  if (g.kind === "ran") {
    const f = join(scratch, `${tag}-getcap`);
    writeFileSync(f, g.stdout);
    lines.push(`getcap=ran|${f}`);
  } else {
    lines.push(`getcap=${g.kind}|`);
  }

  return `${lines.join("\n")}\n`;
}

function runShellClassifier(record: string, scratch: string): string {
  const runner = join(scratch, "run-classifier.sh");
  writeFileSync(runner, `${extractParityBlock()}\nzeta_tpm_classify\n`);
  const r = spawnSync("bash", [runner], { input: record, encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(`shell classifier exited ${String(r.status)}: ${r.stderr}`);
  }
  return r.stdout.trim();
}

describe("TPM classifier: bash vs TypeScript parity over every committed capture", () => {
  const captures = loadCaptures();
  const scratch = mkdtempSync(join(tmpdir(), "zeta-tpm-parity-"));

  test("the fixture set is not empty and is not silently shrinking", () => {
    // A parity suite that iterates an empty list passes vacuously. This is the
    // guard against exactly that, and against a capture file that stops parsing.
    expect(captures.length).toBeGreaterThanOrEqual(11);
  });

  for (const entry of captures) {
    test(`${entry.name} -> ${entry.expectedState}`, () => {
      const record = renderFactRecord(entry.capture, scratch, entry.name);
      const shellState = runShellClassifier(record, scratch);
      const tsState = classifyTpm2Linux(entry.capture).state;

      // The TypeScript side is the reference implementation, so the parity claim
      // is shell == TS. The fixture's own `expectedState` -- written by whoever
      // was LOOKING at the machine -- is asserted separately so a capture that
      // both implementations get wrong still fails somewhere.
      expect(shellState).toBe(tsState);
      expect(shellState).toBe(entry.expectedState);
    });
  }

  test("the five states are all reachable through the shell path", () => {
    // Without this, a shell classifier that returned one constant could pass
    // every row above if the fixture set happened to be uniform. It is not, and
    // this is what keeps that true.
    const seen = new Set<string>();
    for (const entry of captures) {
      seen.add(runShellClassifier(renderFactRecord(entry.capture, scratch, `reach-${entry.name}`), scratch));
    }
    expect(seen.size).toBeGreaterThanOrEqual(4);
  });
});
