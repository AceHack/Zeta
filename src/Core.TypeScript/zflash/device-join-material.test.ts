import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ZFLASH_ALLOWED_FLAGS } from "./allowed-flags.ts";
import { firstbootRoleFromFlags, planFirstbootConfFileContent } from "./firstboot-role.ts";

const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();

describe("the device path carries join material (B5)", () => {
  // Aaron 2026-09-08: "for dev we want the cluster join materials ... as long as
  // it's going to help us test cases for real hardware". The value is a real
  // two-node join on real hardware; until now that path existed only in a NixOS
  // VM test and on `file-backed.ts`, which writes an IMAGE rather than a device.
  const JOIN_FLAGS = ["--role", "--flake-host", "--join-server-url", "--join-token"] as const;

  it("the device CLI accepts every join flag", () => {
    for (const flag of JOIN_FLAGS) {
      expect(ZFLASH_ALLOWED_FLAGS.has(flag)).toBe(true);
    }
  });

  it("the first-boot remedy is now runnable — the flag it names exists", () => {
    // This is the B5 loop closing. `first-boot-remedy-flags.test.ts` asserts no
    // printed remedy names a rejected flag; this asserts the converse direction,
    // that the flag the operator actually needs is the one the CLI takes.
    expect(ZFLASH_ALLOWED_FLAGS.has("--role")).toBe(true);
  });

  // ── The two surfaces must not drift ───────────────────────────────────────
  //
  // The device path REUSES `firstbootRoleFromFlags` and
  // `planFirstbootConfFileContent` rather than re-implementing them. A second
  // renderer would be two spellings of one file format, and `zeta-first-boot.sh`
  // sources whichever it finds. These pin the reuse by asserting the shared
  // validator's refusals, which the device path therefore inherits.

  it("refuses --join-server-url without --role joiner, on both surfaces", () => {
    const r = firstbootRoleFromFlags({ joinServerUrl: "https://control-plane:6443" });
    expect(r.ok).toBe(false);
  });

  it("refuses --join-token without --role joiner", () => {
    const r = firstbootRoleFromFlags({ joinTokenSourcePath: "/tmp/token" });
    expect(r.ok).toBe(false);
  });

  it("a control plane needs no server URL and renders a conf", () => {
    const r = firstbootRoleFromFlags({ role: "first-control-plane" });
    expect(r.ok).toBe(true);
    if (!r.ok || r.value === undefined) throw new Error("expected a role");
    const planned = planFirstbootConfFileContent(r.value);
    expect(planned.ok).toBe(true);
  });

  it("no flags at all yields NO join material, not a default one", () => {
    // A permissive parser that invented a role here would flash sticks that
    // silently found clusters -- the exact failure zeta-first-boot.sh's
    // DECLARED/DEFAULTED distinction exists to prevent.
    const r = firstbootRoleFromFlags({});
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.value).toBeUndefined();
  });

  it("cli.ts wires the constitutional rail, not around it", () => {
    // Extending secret-material-on-ESP from a QEMU image to a stick someone
    // carries is a real change in exposure. The rail that prints
    // "SECRET MATERIAL IN PLAINTEXT ON THE ESP" must run on this path too.
    //
    // MUST match the CALL, not the identifier. A first draft used
    // `toContain("railFindingsForEspWrites")` and passed against a mutant that
    // deleted both the call and the import -- because the name still appeared in
    // the comment directly above it. Mentions are not executions; this is the
    // third instance of that same mistake in one session (see the first-boot
    // remedy guard and `firstCodeLine` in preflights-precede-the-wipe).
    const cli = readFileSync(join(REPO_ROOT, "src/Core.TypeScript/zflash/cli.ts"), "utf8");
    const code = cli
      .split("\n")
      .filter((l) => {
        const t = l.trimStart();
        return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
      })
      .join("\n");
    expect(code).toMatch(/railFindingsForEspWrites\s*\(/);
    expect(code).toMatch(/planFirstbootConfFileContent\s*\(/);
    // and it must not have grown its own renderer
    expect(code).not.toMatch(/composeFirstbootConfFileContent\s*\(/);
  });
});
