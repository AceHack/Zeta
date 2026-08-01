#!/usr/bin/env bun
/**
 * realtime-server.ts — WebSocket server for real-time heartbeat streaming.
 *
 * A Bun WebSocket server that bridges the observe loop's events to real-time
 * subscribers. Agents push heartbeats over WebSocket instead of (or in addition
 * to) git-batched cron. Subscribers see events as they happen.
 *
 * Architecture:
 *   Agent → WebSocket → realtime-server → DurableStore (git/memory/postgres)
 *                                        → broadcast to all subscribers
 *
 * This is the real-time complement to the cron-batched heartbeat workflow.
 * Both produce the same events; this one is instant instead of every-15-min.
 *
 * The server is intentionally SIMPLE:
 * - One port, one handler
 * - Events in = append to store + broadcast to all
 * - Events out = subscribe to the broadcast
 * - No auth (rely on the identity system — events carry their ZetaId signature)
 *
 * For production: deploy behind the Reticulum mesh (discovery-beacon finds it).
 * For dev/test: run locally, agents connect directly.
 *
 * Composes with:
 * - src/Core.TypeScript/observe/durable-store.ts (the unified write path)
 * - src/Core.TypeScript/ferry-throttler/mux-transport-bridge.ts (the mux layer)
 * - src/Core.TypeScript/model-backend/web-socket-endpoint.ts (the WebSocket adapter)
 * - .github/workflows/agent-heartbeat.yml (the cron fallback)
 */

import type { DurableStore } from "./durable-store";
import { memoryStore } from "./durable-store";

// ═══ Event Shape (what flows over the wire) ═════════════════════════════════════

/** A real-time event message (same shape as the event envelope in the log). */
export interface RealtimeEvent {
  readonly id: string;
  readonly at: string;
  readonly by: string;
  readonly action: { readonly kind: string; [key: string]: unknown };
  readonly phase?: number;
  readonly entropy?: { state: number; heat: number };
}

// ═══ The Server ═════════════════════════════════════════════════════════════════

export interface RealtimeServerOptions {
  readonly port?: number;
  readonly store?: DurableStore<RealtimeEvent>;
  readonly onEvent?: (event: RealtimeEvent, from: string) => void;
}

export interface RealtimeServer {
  readonly port: number;
  readonly connections: number;
  stop(): void;
}

/**
 * Start the real-time WebSocket server. Agents connect, push events, and
 * subscribe to the broadcast. Events are persisted to the store and
 * broadcast to all connected peers.
 */
export function startRealtimeServer(opts: RealtimeServerOptions = {}): RealtimeServer {
  const store = opts.store ?? memoryStore<RealtimeEvent>();
  const port = opts.port ?? parseInt(process.env.ZETA_REALTIME_PORT ?? "9876", 10);
  const onEvent = opts.onEvent;
  const subscribers = new Set<{ send: (data: string) => void }>();

  const server = Bun.serve({
    port,
    fetch(req, server) {
      // Upgrade HTTP → WebSocket
      if (server.upgrade(req)) return undefined;
      // Non-WebSocket requests get a status page
      return new Response(JSON.stringify({
        service: "zeta-realtime",
        connections: subscribers.size,
        store: store.backend,
      }), { headers: { "content-type": "application/json" } });
    },
    websocket: {
      open(ws) {
        subscribers.add(ws);
        console.log(`[realtime] +1 connection (total: ${subscribers.size})`);
      },
      close(ws) {
        subscribers.delete(ws);
        console.log(`[realtime] -1 connection (total: ${subscribers.size})`);
      },
      async message(ws, msg) {
        // Parse incoming event
        let event: RealtimeEvent;
        try {
          event = JSON.parse(String(msg)) as RealtimeEvent;
          if (!event.id || !event.at || !event.by || !event.action) {
            ws.send(JSON.stringify({ error: "invalid event: missing id/at/by/action" }));
            return;
          }
        } catch {
          ws.send(JSON.stringify({ error: "invalid JSON" }));
          return;
        }

        // Persist to the durable store
        const result = await store.append(event);
        if (!result.ok) {
          ws.send(JSON.stringify({ error: `store append failed: ${result.reason}` }));
          return;
        }

        // Callback
        if (onEvent) onEvent(event, "ws");

        // Broadcast to ALL subscribers (including the sender — they get confirmation)
        const broadcast = JSON.stringify({ event, receipt: { eventId: result.eventId, backend: store.backend } });
        for (const sub of subscribers) {
          try { sub.send(broadcast); } catch { /* disconnected — cleaned on close */ }
        }
      },
    },
  });

  console.log(`[realtime] Zeta real-time server on ws://localhost:${port}`);

  return {
    port: server.port ?? port,
    get connections() { return subscribers.size; },
    stop() { server.stop(); },
  };
}

// ═══ CLI: run the server directly ═══════════════════════════════════════════════

if (import.meta.main) {
  const server = startRealtimeServer();
  console.log(`[realtime] Ready. Agents connect to ws://localhost:${server.port}`);
  console.log(`[realtime] Ctrl-C to stop.`);
}
