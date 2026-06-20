import { describe, expect, it } from "bun:test";
import { firstSessionMarkersSatisfied } from "./qemu-first-session-phase3";

describe("qemu-first-session-phase3", () => {
  it("firstSessionMarkersSatisfied passes when begin+complete present", () => {
    const serial = ["zeta-first-session: begin", "zeta-first-session: complete"].join("\n");
    expect(firstSessionMarkersSatisfied(serial)).toBe(true);
  });

  it("firstSessionMarkersSatisfied fails when only begin present", () => {
    expect(firstSessionMarkersSatisfied("zeta-first-session: begin")).toBe(false);
  });
});
