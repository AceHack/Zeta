/**
 * realtime-client.test.ts — integration test: client connects to server, pushes events,
 * receives broadcasts.
 */

import { describe, test, expect, afterEach } from "bun:test";
import { startRealtimeServer, type RealtimeServer } from "./realtime-server";
import { createRealtimeClient, type RealtimeClient } from "./realtime-client";

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

    // Should have received the broadcast back
    await new Promise((r) => setTimeout(r, 50));
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

    await new Promise((r) => setTimeout(r, 50));
    expect(client2Received).toContain("from-client1");

    client1.close();
    client2.close();
  });
});
