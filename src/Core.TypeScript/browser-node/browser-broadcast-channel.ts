import type {
  BrowserTabChannel,
  BrowserTabCoordinatorFeedback,
  BrowserTabOperationResult,
} from "./browser-tab-coordinator";

interface BroadcastMessageEventLike {
  readonly data?: unknown;
}

interface BroadcastChannelLike {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: (event: BroadcastMessageEventLike) => void): void;
  removeEventListener(type: "message", listener: (event: BroadcastMessageEventLike) => void): void;
  close(): void;
}

type BroadcastChannelConstructorLike = new (name: string) => BroadcastChannelLike;

function succeeded<T>(value: T): BrowserTabOperationResult<T> {
  return { ok: true, value };
}

function failed(
  code: BrowserTabCoordinatorFeedback["code"],
  detail: string,
  severity: BrowserTabCoordinatorFeedback["severity"] = "heat",
): BrowserTabOperationResult<never> {
  return { ok: false, feedback: { severity, code, detail } };
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/** Create the thin browser adapter without requiring DOM types in pure callers. */
export function createNativeBroadcastTabChannel(
  root: unknown,
  channelName: string,
): BrowserTabOperationResult<BrowserTabChannel> {
  if (!isIdentifier(channelName)) {
    return failed("broadcast-channel-invalid", "A broadcast channel name must be a non-empty string.");
  }
  if (root === null || (typeof root !== "object" && typeof root !== "function")) {
    return failed("broadcast-channel-unavailable", "This runtime does not expose BroadcastChannel.", "backpressure");
  }

  let constructorValue: unknown;
  try {
    constructorValue = Reflect.get(root, "BroadcastChannel");
  } catch {
    return failed("broadcast-channel-blocked", "This runtime blocked access to BroadcastChannel.");
  }
  if (typeof constructorValue !== "function") {
    return failed("broadcast-channel-unavailable", "This runtime does not expose BroadcastChannel.", "backpressure");
  }

  let nativeChannel: BroadcastChannelLike;
  try {
    nativeChannel = new (constructorValue as BroadcastChannelConstructorLike)(channelName);
  } catch {
    return failed("broadcast-channel-blocked", "This runtime refused to create a BroadcastChannel.");
  }
  try {
    if (
      typeof nativeChannel.postMessage !== "function" ||
      typeof nativeChannel.addEventListener !== "function" ||
      typeof nativeChannel.removeEventListener !== "function" ||
      typeof nativeChannel.close !== "function"
    ) {
      return failed(
        "broadcast-channel-invalid",
        "The BroadcastChannel implementation does not satisfy the channel port.",
      );
    }
  } catch {
    return failed("broadcast-channel-blocked", "This runtime blocked inspection of BroadcastChannel methods.");
  }

  let closed = false;
  const listeners = new Set<(event: BroadcastMessageEventLike) => void>();
  const port: BrowserTabChannel = {
    publish: (message) => {
      if (closed) return failed("broadcast-channel-closed", "The BroadcastChannel is already closed.");
      try {
        nativeChannel.postMessage(message);
        return succeeded(null);
      } catch {
        return failed("broadcast-channel-publish-failed", "BroadcastChannel failed to publish a tab message.");
      }
    },
    subscribe: (listener) => {
      if (closed) return failed("broadcast-channel-closed", "The BroadcastChannel is already closed.");
      const nativeListener = (event: BroadcastMessageEventLike): void => {
        listener(event.data);
      };
      try {
        nativeChannel.addEventListener("message", nativeListener);
        listeners.add(nativeListener);
      } catch {
        return failed("broadcast-channel-subscribe-failed", "BroadcastChannel failed to register a listener.");
      }
      let active = true;
      return succeeded({
        unsubscribe: () => {
          if (!active) return succeeded(null);
          try {
            nativeChannel.removeEventListener("message", nativeListener);
            listeners.delete(nativeListener);
            active = false;
            return succeeded(null);
          } catch {
            return failed("broadcast-channel-unsubscribe-failed", "BroadcastChannel failed to remove a listener.");
          }
        },
      });
    },
    close: () => {
      if (closed) return succeeded(null);
      let removalFailed = false;
      for (const listener of listeners) {
        try {
          nativeChannel.removeEventListener("message", listener);
        } catch {
          removalFailed = true;
        }
      }
      listeners.clear();
      try {
        nativeChannel.close();
        closed = true;
      } catch {
        return failed("broadcast-channel-close-failed", "BroadcastChannel failed to close.");
      }
      return removalFailed
        ? failed("broadcast-channel-unsubscribe-failed", "BroadcastChannel failed to remove one or more listeners.")
        : succeeded(null);
    },
  };

  return succeeded(port);
}
