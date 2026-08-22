import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "bun:test";

const SUPPORT_PATH = resolve(import.meta.dir, "../../..", "docs/design/root-site-iris/support.js");
const LISTENER_START = 'window.addEventListener("message", (e) => {';
const LISTENER_END = "\n    });";
const ORIGIN_GUARD = "if (e.origin !== window.location.origin) return;";

function messageListenerBodies(source: string): readonly string[] {
  const bodies: string[] = [];
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf(LISTENER_START, cursor);
    if (start < 0) break;
    const bodyStart = start + LISTENER_START.length;
    const end = source.indexOf(LISTENER_END, bodyStart);
    if (end < 0) return [];
    bodies.push(source.slice(bodyStart, end));
    cursor = end + LISTENER_END.length;
  }
  return bodies;
}

describe("passkey page message-origin hygiene", () => {
  test("PPH-1: every root-site message listener rejects cross-origin input before reading data", () => {
    const listeners = messageListenerBodies(readFileSync(SUPPORT_PATH, "utf8"));
    expect(listeners.length).toBeGreaterThan(0);
    for (const listener of listeners) {
      const guard = listener.indexOf(ORIGIN_GUARD);
      const dataRead = listener.indexOf("e.data");
      expect(guard).toBeGreaterThanOrEqual(0);
      expect(dataRead).toBeGreaterThan(guard);
    }
  });
});
