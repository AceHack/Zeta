import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ZFLASH_ALLOWED_FLAGS } from "./allowed-flags.ts";

const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();

const FIRST_BOOT = join(REPO_ROOT, "full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh");

describe("operator-facing remedies name commands that exist", () => {
  // B5. `zeta-first-boot.sh` told a blocked operator to run
  //   zflash --role first-control-plane
  //   zflash --role joiner --join-server-url <url> --join-token <file>
  // and NO device-flashing entrypoint accepts `--role`. Both `cli.ts` and
  // `flash-usb.ts` run a strict allowlist and exit 2 on an unknown flag; only
  // `file-backed.ts` takes it, and that writes an IMAGE rather than a stick.
  //
  // So the single instruction printed at the moment the operator is stuck named a
  // command that cannot be run on the medium in their hand. This pins the general
  // rule rather than the one instance: a remedy must be runnable.
  const text = readFileSync(FIRST_BOOT, "utf8");

  // Only lines the operator SEES. Comments may discuss `zflash --role` freely --
  // the corrected text does exactly that, to say the flag does not exist.
  const printedLines = text
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("#"))
    .filter((line) => line.includes("echo ") || line.includes("printf "));

  it("no printed line tells the operator to run a zflash flag the CLI rejects", () => {
    const offenders: string[] = [];
    for (const line of printedLines) {
      for (const m of line.matchAll(/zflash\s+(--[a-z][a-z0-9-]*)/g)) {
        const flag = m[1];
        if (flag !== undefined && !ZFLASH_ALLOWED_FLAGS.has(flag)) {
          offenders.push(`${flag} in: ${line.trim().slice(0, 90)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the role prompt it now points at is really a DECLARED source", () => {
    // The remedy is only correct because a keypress counts as declared. If
    // `keystroke:*` ever stops satisfying ZETA_ROLE_DECLARED, the advice becomes
    // wrong again and this fails.
    expect(text).toContain('keystroke:c"');
    expect(text).toContain('keystroke:w"');
    expect(text).toMatch(/ZETA_ROLE_DECLARED=yes/);
    expect(text).toMatch(/esp:\*\|keystroke:\*\)\s*ZETA_ROLE_DECLARED=yes/);
  });
});
