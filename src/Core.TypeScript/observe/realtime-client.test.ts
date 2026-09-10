/**
 * realtime-client.test.ts — integration test: client connects to server, pushes events,
 * receives broadcasts.
 */

import { describe, test, expect, afterEach } from "bun:test";
import { waitUntil } from "../testing/deterministic-async";
import { startRealtimeServer, type RealtimeServer } from "./realtime-server";
import { createRealtimeClient, sanitizeForLog, type RealtimeClient } from "./realtime-client";

let server: RealtimeServer | null = null;
let client: RealtimeClient | null = null;

afterEach(() => {
  client?.close();
  server?.stop();
  client = null;
  server = null;
});

describe("realtime client ↔ server integration", () => {
  test("client connects, pushes an event, receives broadcast", async () => {
    server = startRealtimeServer({ port: 0 }); // port 0 = pick random
    const port = server.port;

    client = createRealtimeClient({ url: `ws://localhost:${port}`, timeoutMs: 3000 });
    await client.connect();
    expect(client.connected).toBe(true);
    expect(server.connections).toBe(1);

    // Set up event listener before pushing
    const received: { event: { id: string }; receipt: { eventId: string } }[] = [];
    client.onEvent((event, receipt) => received.push({ event, receipt }));

    // Push an event
    const event = {
      id: "test-event-001",
      at: new Date().toISOString(),
      by: "alexa",
      action: { kind: "heartbeat", reason: "test" },
    };

    const result = await client.push(event);
    expect(result.ok).toBe(true);

    // Should have received the broadcast back. WAS a 50ms sleep across a real localhost
    // WebSocket -- a bet that the round trip fits in 50ms, which on a contended runner it does
    // not. `waitUntil` inverts that: the deadline is an upper bound on PATIENCE, so a slow
    // machine waits longer and still passes, and a red here means the broadcast never arrived.
    // Genuine external I/O is the one case where a poll beats a barrier -- the socket is not
    // ours to instrument.
    await waitUntil(() => received.length >= 1, { describe: "the pushed event to be broadcast back" });
    // Strength preserved: still EXACTLY one, so a duplicate broadcast still fails.
    expect(received.length).toBe(1);
    expect(received[0]!.event.id).toBe("test-event-001");
  });

  test("push fails when not connected", async () => {
    client = createRealtimeClient({ url: "ws://localhost:1", timeoutMs: 100 });
    // Don't connect

    const result = await client.push({
      id: "orphan",
      at: new Date().toISOString(),
      by: "otto",
      action: { kind: "test" },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not connected");
  });

  test("multiple clients receive each other's broadcasts", async () => {
    server = startRealtimeServer({ port: 0 });
    const port = server.port;

    const client1 = createRealtimeClient({ url: `ws://localhost:${port}` });
    const client2 = createRealtimeClient({ url: `ws://localhost:${port}` });
    await client1.connect();
    await client2.connect();
    expect(server.connections).toBe(2);

    const client2Received: string[] = [];
    client2.onEvent((event) => client2Received.push(event.id));

    // Client 1 pushes
    await client1.push({
      id: "from-client1",
      at: new Date().toISOString(),
      by: "alexa",
      action: { kind: "heartbeat" },
    });

    await waitUntil(() => client2Received.length >= 1, {
      describe: "client2 to receive client1's broadcast",
    });
    expect(client2Received).toContain("from-client1");

    client1.close();
    client2.close();
  });
});

describe("sanitizeForLog — the whole control-character class, not two members of it", () => {
  test("strips CR and LF, so a forged log LINE is impossible", () => {
    expect(sanitizeForLog("real\nINFO: forged line\rmore")).toBe("real INFO: forged line more");
  });

  test("strips ESC — the one a CR/LF-only filter let through", () => {
    // `\u001b[2K` clears the operator's current terminal line; an OSC sequence
    // can rewrite the window title. Both arrive from a WebSocket peer. Narrow
    // the character class back to [\n\r] and this test dies.
    expect(sanitizeForLog("before\u001b[2Kafter")).toBe("before [2Kafter");
    expect(sanitizeForLog("t\u001b]0;pwned\u0007x")).toBe("t ]0;pwned x");
  });

  test("strips DEL and the C1 range", () => {
    expect(sanitizeForLog("a\u007Fb\u0085c\u009Bd")).toBe("a b c d");
  });

  test("leaves ordinary text, including non-ASCII, alone", () => {
    expect(sanitizeForLog("héllo — ok")).toBe("héllo — ok");
  });

  test("bounds the result at 200 characters", () => {
    expect(sanitizeForLog("x".repeat(500))).toHaveLength(200);
  });

  // NOT TESTED, because the property does not exist: whether the strip runs
  // before or after the 200-character cut. The replacement maps one character
  // to one space, so it is length-preserving and the two orders are provably
  // equal on every input. An earlier draft of this file asserted the order and
  // the swapped-order mutant SURVIVED -- a check that could not fail, dressed
  // as a falsifier. Recorded here instead of deleted silently.
});
