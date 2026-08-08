import { type BrowserReadoutSinkResult, type BrowserTabReadoutSink } from "../browser-node/browser-lifecycle-host";
import type { BrowserTabTransportReadout } from "../browser-node/browser-tab-channel-selector";
import type { BrowserTabCoordinatorReadout } from "../browser-node/browser-tab-coordinator";
import { renderDarkHallRoomHtml, type RoomRunTranscript } from "./darkhall-room";

export interface DarkHallRoomMount {
  replace(markup: string): BrowserReadoutSinkResult<null>;
}

export interface DarkHallBrowserTabSink extends BrowserTabReadoutSink {
  updateTranscript(transcript: RoomRunTranscript): BrowserReadoutSinkResult<null>;
}

function succeeded<T>(value: T): BrowserReadoutSinkResult<T> {
  return { ok: true, value };
}

function failed<T>(detail: string): BrowserReadoutSinkResult<T> {
  return { ok: false, detail };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Render each coordinator observation through the source-owned room transcript. */
export function createDarkHallBrowserTabSink(
  initialTranscript: RoomRunTranscript,
  mount: DarkHallRoomMount,
  transport?: BrowserTabTransportReadout,
): DarkHallBrowserTabSink {
  let transcript = initialTranscript;
  let latestReadout: BrowserTabCoordinatorReadout | null = null;

  const render = (readout: BrowserTabCoordinatorReadout): BrowserReadoutSinkResult<null> => {
    try {
      const withReadout = { ...transcript, browserTabReadout: readout };
      const selectedTransport = transport ?? transcript.browserTransportReadout;
      const renderTranscript =
        selectedTransport === undefined ? withReadout : { ...withReadout, browserTransportReadout: selectedTransport };
      const markup = renderDarkHallRoomHtml(renderTranscript);
      return mount.replace(markup);
    } catch {
      return failed("The injected Dark Hall room mount threw while replacing markup.");
    }
  };

  return {
    write: (readout: BrowserTabCoordinatorReadout) => {
      latestReadout = readout;
      return render(readout);
    },
    updateTranscript: (nextTranscript) => {
      transcript = nextTranscript;
      return latestReadout === null ? succeeded(null) : render(latestReadout);
    },
  };
}

/** Adapt a mount element without importing DOM types into the source core. */
export function createNativeDarkHallRoomMount(value: unknown): BrowserReadoutSinkResult<DarkHallRoomMount> {
  if (!isRecord(value)) {
    return failed("The supplied Dark Hall room mount does not expose innerHTML.");
  }
  try {
    if (!Reflect.has(value, "innerHTML")) {
      return failed("The supplied Dark Hall room mount does not expose innerHTML.");
    }
  } catch {
    return failed("The browser blocked inspection of the Dark Hall room mount.");
  }

  return succeeded({
    replace: (markup) => {
      try {
        return Reflect.set(value, "innerHTML", markup)
          ? succeeded(null)
          : failed("The browser refused to replace the Dark Hall room markup.");
      } catch {
        return failed("The browser threw while replacing the Dark Hall room markup.");
      }
    },
  });
}
