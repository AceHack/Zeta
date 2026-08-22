import { describe, expect, test } from "bun:test";
import {
  CVC5_PIN,
  LINUX_PINS,
  Z3_PIN,
  hostKey,
  meetsPin,
} from "./install-pinned-smt.ts";
import { existsSync } from "node:fs";
import { join } from "node:path";

const SHA256 = /^[0-9a-f]{64}$/;
const REPO = join(import.meta.dir, "..", "..", "..", "..");

describe("install-pinned-smt pins", () => {
  test("the skip-floor is gone; these constants ARE the pin", () => {
    expect(Z3_PIN).toBe("4.16.0");
    expect(CVC5_PIN).toBe("1.3.4");
    expect(existsSync(join(REPO, "registry", "smt2-solver-floor.json"))).toBe(false);
  });

  test("every Linux pin is a checksummed GitHub release URL", () => {
    for (const [key, pins] of Object.entries(LINUX_PINS)) {
      expect(pins.length).toBe(2);
      for (const pin of pins) {
        expect(pin.url.startsWith("https://github.com/")).toBe(true);
        expect(SHA256.test(pin.sha256)).toBe(true);
        if (key.endsWith("arm64")) expect(pin.url.includes("arm64")).toBe(true);
      }
    }
  });

  test("meetsPin is a floor, not an exact match", () => {
    expect(meetsPin(null, Z3_PIN)).toBe(false);
    expect(meetsPin("4.8.12", Z3_PIN)).toBe(false);
    expect(meetsPin("4.16.0", Z3_PIN)).toBe(true);
    expect(meetsPin("4.16.1", Z3_PIN)).toBe(true);
    expect(meetsPin("1.1.2", CVC5_PIN)).toBe(false);
    expect(meetsPin("1.3.4", CVC5_PIN)).toBe(true);
  });

  test("hostKey is linux-only", () => {
    const key = hostKey();
    if (process.platform === "linux") {
      expect(key === "linux-x64" || key === "linux-arm64").toBe(true);
    } else {
      expect(key).toBeNull();
    }
  });
});
