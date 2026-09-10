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

/** Longest server error string that reaches the log. */
const LOG_FIELD_MAX_CHARS = 200;

/**
 * Make an untrusted string safe to print on one log line.
 *
 * Replaces every C0 control (U+0000-U+001F), DEL (U+007F) and C1 control
 * (U+0080-U+009F) with a space, then bounds the result. Newlines are in that
 * range, so forged log lines are still stopped; so is ESC, which a CR/LF-only
 * filter let through.
 *
 * The replacement is LENGTH-PRESERVING -- one character in, one space out -- so
 * the `slice` can never split a half-stripped sequence and the order of the two
 * operations is immaterial. Said out loud because it is the kind of property
 * that invites an assertion no mutant can kill.
 *
 * Exported so it can be falsified without a WebSocket.
 */
export function sanitizeForLog(value: string): string {
  // TWO REPLACES, AND THE FIRST IS REDUNDANT BY BEHAVIOUR ON PURPOSE.
  //
  // The range already contains the newline characters, so the second replace alone is
  // behaviourally complete. But CodeQL's `js/log-injection` recognises sanitizers by
  // SHAPE, and a RANGE that merely CONTAINS them is not the shape it matches -- so it
  // kept reporting an already-sanitized value as tainted. Measured: alert #653 sat open
  // on this file at line 81 since 2026-08-09, and widening the strip only moved it to
  // #932 at line 117. Same rule, same file, new line: the pattern relocating, not closing.
  //
  // Naming the two explicitly first gives the analyser the form it understands, while the
  // range keeps the real guarantee -- ESC and the whole C0/DEL/C1 class, which is what a
  // WebSocket peer would use to rewrite an operator's terminal. Both map to a space and
  // both are length-preserving, so no input can observe a difference.
  //
  // IF THE ALERT SURVIVES THIS, THE SHAPE HYPOTHESIS IS WRONG and the honest next step is
  // a CodeQL model pack -- the `packs:` slot in .github/codeql/codeql-config.yml is
  // reserved for exactly that -- never a dismissal.
  return value
    // eslint-disable-next-line no-control-regex -- the control characters ARE the subject
    .replace(/[\r\n]/gu, " ")
    // eslint-disable-next-line no-control-regex -- the control characters ARE the subject
    .replace(/[\u0000-\u001F\u007F-\u009F]/gu, " ")
    .slice(0, LOG_FIELD_MAX_CHARS);
}


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
        // SANITIZE BEFORE LOGGING (CodeQL `js/log-injection`, alert #653).
        //
        // The previous form stripped only CR and LF, which stops a forged log
        // LINE and nothing else. It left every other control character intact,
        // and the one that matters is ESC: a server-supplied `\u001b[2K` or an
        // OSC sequence rewrites the operator's terminal, moves the cursor over
        // lines already printed, or sets the window title -- from a string that
        // arrived over a WebSocket. Stripping C0, DEL and C1 covers the whole
        // class rather than the two members of it that happen to be famous.
        //
        // The 200-character cut is unchanged and its ORDER relative to the strip
        // is deliberately not claimed to matter: the replacement is
        // length-preserving (one character to one space), so the two orders are
        // equal on every input. Measured -- the swapped-order mutant survives.
        console.warn("[realtime-client] server error:", sanitizeForLog(String(msg.error)));
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
