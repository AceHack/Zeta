import { describe, expect, test } from "bun:test";
import { createNativeBroadcastTabChannel } from "./browser-broadcast-channel";
import { BROWSER_TAB_COORDINATOR_SCHEMA } from "./browser-tab-coordinator";

function presence(tabId: string, sequence: number, state: "foreground" | "background" | "suspended" | "dark") {
  return {
    schema: BROWSER_TAB_COORDINATOR_SCHEMA,
    nodeId: "llmtv-room-a",
    kind: "presence" as const,
    presence: { tabId, sequence, state },
  };
}

describe("native BroadcastChannel adapter", () => {
  test("returns typed feedback when the API is absent or access is blocked", () => {
    expect(createNativeBroadcastTabChannel({}, "zeta-tabs")).toMatchObject({
      ok: false,
      feedback: { code: "broadcast-channel-unavailable", severity: "backpressure" },
    });

    const blocked = Object.defineProperty({}, "BroadcastChannel", {
      get: () => {
        throw new Error("denied");
      },
    });
    expect(createNativeBroadcastTabChannel(blocked, "zeta-tabs")).toMatchObject({
      ok: false,
      feedback: { code: "broadcast-channel-blocked", severity: "heat" },
    });

    class HostileChannel {
      get postMessage(): never {
        throw new Error("denied");
      }
      addEventListener(): void {
        return undefined;
      }
      removeEventListener(): void {
        return undefined;
      }
      close(): void {
        return undefined;
      }
    }
    expect(createNativeBroadcastTabChannel({ BroadcastChannel: HostileChannel }, "zeta-tabs")).toMatchObject({
      ok: false,
      feedback: { code: "broadcast-channel-blocked", severity: "heat" },
    });
  });

  test("publishes, receives, unsubscribes, and closes through the structural port", () => {
    const posted: unknown[] = [];
    const listeners = new Set<(event: { data?: unknown }) => void>();
    let closeCount = 0;
    class NativeChannel {
      postMessage(message: unknown): void {
        posted.push(message);
      }
      addEventListener(_type: "message", listener: (event: { data?: unknown }) => void): void {
        listeners.add(listener);
      }
      removeEventListener(_type: "message", listener: (event: { data?: unknown }) => void): void {
        listeners.delete(listener);
      }
      close(): void {
        closeCount += 1;
      }
    }

    const result = createNativeBroadcastTabChannel({ BroadcastChannel: NativeChannel }, "zeta-tabs");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const received: unknown[] = [];
    const subscription = result.value.subscribe((message) => received.push(message));
    expect(subscription.ok).toBe(true);
    expect(result.value.publish(presence("tab-a", 1, "foreground")).ok).toBe(true);
    for (const listener of listeners) listener({ data: "peer-message" });

    expect(posted).toHaveLength(1);
    expect(received).toEqual(["peer-message"]);
    if (subscription.ok) expect(subscription.value.unsubscribe().ok).toBe(true);
    expect(result.value.close().ok).toBe(true);
    expect(listeners.size).toBe(0);
    expect(closeCount).toBe(1);
  });
});
