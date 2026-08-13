import { describe, expect, test } from "bun:test";
import type { BrowserTabPresence } from "./browser-node";
import { selectBrowserDatabaseReceiptPeer } from "./browser-database-receipt-peer-selection";

function presence(
  tabId: string,
  sequence: number,
  state: BrowserTabPresence["state"] = "foreground",
): BrowserTabPresence {
  return { tabId, sequence, state };
}

function select(localPeerId: string, tabs: readonly BrowserTabPresence[], maxTrackedTabs = 8) {
  return selectBrowserDatabaseReceiptPeer({ localPeerId, maxTrackedTabs, tabs });
}

describe("browser database receipt peer selection", () => {
  test("pairs two live tabs from either local perspective", () => {
    const tabs = [presence("tab-a", 1), presence("tab-b", 2, "background")];

    expect(select("tab-a", tabs)).toMatchObject({
      ok: true,
      value: {
        policy: "ordinal-successor",
        status: "selected",
        ringPeerIds: ["tab-a", "tab-b"],
        selectedPeerId: "tab-b",
      },
    });
    expect(select("tab-b", tabs)).toMatchObject({
      ok: true,
      value: { status: "selected", selectedPeerId: "tab-a" },
    });
  });

  test("forms one ordinal successor ring for every permutation of three live tabs", () => {
    const permutations = [
      ["tab-a", "tab-b", "tab-c"],
      ["tab-a", "tab-c", "tab-b"],
      ["tab-b", "tab-a", "tab-c"],
      ["tab-b", "tab-c", "tab-a"],
      ["tab-c", "tab-a", "tab-b"],
      ["tab-c", "tab-b", "tab-a"],
    ];

    for (const permutation of permutations) {
      const tabs = permutation.map((tabId, index) => presence(tabId, index + 1));
      expect(select("tab-a", tabs)).toMatchObject({ ok: true, value: { selectedPeerId: "tab-b" } });
      expect(select("tab-b", tabs)).toMatchObject({ ok: true, value: { selectedPeerId: "tab-c" } });
      expect(select("tab-c", tabs)).toMatchObject({ ok: true, value: { selectedPeerId: "tab-a" } });
    }
  });

  test("folds bounded duplicate presence and excludes suspended or dark peers", () => {
    const tabs = [
      presence("tab-c", 1),
      presence("tab-b", 1, "foreground"),
      presence("tab-a", 1),
      presence("tab-b", 2, "suspended"),
      presence("tab-c", 2, "dark"),
    ];

    expect(select("tab-a", tabs)).toEqual({
      ok: true,
      value: {
        schema: "zeta.browser-database-receipt-peer-selection.v1",
        policy: "ordinal-successor",
        status: "alone",
        localPeerId: "tab-a",
        localState: "foreground",
        ringPeerIds: ["tab-a"],
        selectedPeerId: null,
      },
    });
  });

  test("keeps a suspended local tab dormant even when another peer is live", () => {
    expect(select("tab-a", [presence("tab-a", 2, "suspended"), presence("tab-b", 3)])).toMatchObject({
      ok: true,
      value: {
        status: "dormant",
        localState: "suspended",
        ringPeerIds: ["tab-b"],
        selectedPeerId: null,
      },
    });
  });

  test("backpressures an oversized snapshot without choosing which tab to forget", () => {
    expect(select("tab-a", [presence("tab-a", 1), presence("tab-b", 1)], 1)).toEqual({
      ok: false,
      feedback: {
        severity: "backpressure",
        code: "receipt-peer-selection-capacity-exhausted",
        detail: "The receipt peer snapshot carried 2 tabs but the bounded capacity is 1.",
      },
    });
  });

  test("reports malformed or local-free snapshots as typed heat", () => {
    expect(select("tab-a", [presence("tab-b", 1)])).toMatchObject({
      ok: false,
      feedback: { severity: "heat", code: "receipt-peer-selection-local-peer-missing" },
    });
    expect(select("tab-a", [presence("", 1)])).toMatchObject({
      ok: false,
      feedback: { severity: "heat", code: "receipt-peer-selection-presence-invalid" },
    });
  });
});
