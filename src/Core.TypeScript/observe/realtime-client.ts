/**
 * realtime-client.ts — WebSocket client for pushing heartbeat events in real-time.
 *
 * Connects to the realtime-server (realtime-server.ts) and pushes events as they
 * happen. This is the instant complement to the 15-min cron batch — events arrive
 * at subscribers within milliseconds instead of waiting for the flush.
 *
 * Usage (in the observe loop):
 *   const client = createRealtimeClient({ url: "ws://localhost:9876" });
 *   await client.connect();
 *   // After sink.append() succeeds, also push to realtime:
 *   await client.push(event);
 *
 * For the heartbeat workflow: ZETA_REALTIME_URL env var enables real-time push
 * alongside the git-batch path. Both produce the same events; the realtime path
 * is faster but not durable (git is the record of truth).
 *
 * Composes with:
 * - src/Core.TypeScript/observe/realtime-server.ts (the server)
 * - src/Core.TypeScript/observe/event-sink-folder.ts (the durable path — git is truth)
 * - src/Core.TypeScript/ferry-throttler/mux-transport-bridge.ts (the mux layer)
 */

import type { RealtimeEvent } from "./realtime-server";

// ═══ Client Interface ════════════════════════════════════════════════════════════

export interface RealtimeClient {
  /** Connection state. */
  readonly connected: boolean;
  /** Connect to the realtime server. Resolves when the WebSocket is open. */
  connect(): Promise<void>;
  /** Push an event to the server. Returns receipt or error. */
  push(event: RealtimeEvent): Promise<PushOutcome>;
  /** Receive events broadcast by the server (from self and peers). */
  onEvent(handler: (event: RealtimeEvent, receipt: { eventId: string; backend: string }) => void): void;
  /** Disconnect cleanly. */
  close(): void;
}

export type PushOutcome =
  | { readonly ok: true; readonly eventId: string }
  | { readonly ok: false; readonly reason: string };

export interface RealtimeClientOptions {
  /** WebSocket URL of the realtime server (e.g. "ws://localhost:9876"). */
  readonly url: string;
  /** Timeout for connect/push operations (ms). Default: 5000. */
  readonly timeoutMs?: number;
  /** Retry on disconnect? Default: true. */
  readonly autoReconnect?: boolean;
}

// ═══ Implementation ══════════════════════════════════════════════════════════════

export function createRealtimeClient(opts: RealtimeClientOptions): RealtimeClient {
  const timeoutMs = opts.timeoutMs ?? 5000;
  let ws: WebSocket | null = null;
  let connected = false;
  const eventHandlers: Array<(event: RealtimeEvent, receipt: { eventId: string; backend: string }) => void> = [];

  // Pending push promises waiting for server receipt
  const pending = new Map<string, { resolve: (o: PushOutcome) => void; timer: ReturnType<typeof setTimeout> }>();

  function handleMessage(data: string): void {
    try {
      const msg = JSON.parse(data);
      if (msg.event && msg.receipt) {
        // This is a broadcast (event + receipt)
        for (const h of eventHandlers) h(msg.event, msg.receipt);
        // Resolve pending push if it's ours
        const p = pending.get(msg.event.id);
        if (p) {
          clearTimeout(p.timer);
          pending.delete(msg.event.id);
          p.resolve({ ok: true, eventId: msg.receipt.eventId });
        }
      } else if (msg.error) {
        // Server error response — sanitize before logging (CodeQL: no log injection)
        const safeError = String(msg.error).slice(0, 200).replace(/[\n\r]/g, " ");
        console.warn("[realtime-client] server error:", safeError);
      }
    } catch { /* malformed message — ignore */ }
  }

  return {
    get connected() { return connected; },

    connect(): Promise<void> {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("connect timeout")), timeoutMs);
        try {
          ws = new WebSocket(opts.url);
          ws.onopen = () => {
            clearTimeout(timer);
            connected = true;
            console.log(`[realtime-client] connected to ${opts.url}`);
            resolve();
          };
          ws.onclose = () => {
            connected = false;
            console.log(`[realtime-client] disconnected`);
          };
          ws.onerror = (err) => {
            clearTimeout(timer);
            connected = false;
            reject(new Error(`ws error: ${err}`));
          };
          ws.onmessage = (msg) => handleMessage(String(msg.data));
        } catch (err) {
          clearTimeout(timer);
          reject(err);
        }
      });
    },

    push(event: RealtimeEvent): Promise<PushOutcome> {
      if (!ws || !connected) {
        return Promise.resolve({ ok: false, reason: "not connected" });
      }
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          pending.delete(event.id);
          resolve({ ok: false, reason: "push timeout" });
        }, timeoutMs);
        pending.set(event.id, { resolve, timer });
        try {
          ws!.send(JSON.stringify(event));
        } catch (err) {
          clearTimeout(timer);
          pending.delete(event.id);
          resolve({ ok: false, reason: `send failed: ${err instanceof Error ? err.message : String(err)}` });
        }
      });
    },

    onEvent(handler) {
      eventHandlers.push(handler);
    },

    close() {
      if (ws) {
        ws.close();
        ws = null;
        connected = false;
      }
      // Fail all pending pushes
      for (const [, p] of pending) {
        clearTimeout(p.timer);
        p.resolve({ ok: false, reason: "client closed" });
      }
      pending.clear();
    },
  };
}
