// vault-degraded.ts — what the page shows when a fetch fails (Iris §3, step 4).
//
// BUILD THIS BEFORE THE HAPPY PATH. Iris was explicit, and the reason is that the degraded render
// is the one that ships broken if it is built second: with both files present in dev it never
// executes, so nobody notices it was never finished until the day a fetch actually fails — which
// is exactly the day it matters.
//
// THE CASE THIS EXISTS FOR is the whole point of the hub/satellite split (contract change 4). The
// roster is the HUB — who exists, rarely changes. The state is the SATELLITE — how they are doing,
// rewritten every tick. Splitting them buys precisely one thing: when the satellite is
// unreachable, the settlement can still be DRAWN from the hub. A page that blanks on a failed
// state fetch has thrown away the only benefit of the split.
//
// Pure decision logic — no DOM, no fetch. The caller performs the I/O and passes outcomes in, so
// every branch is reachable in a test instead of requiring devtools and a blocked request.

/** What came back for one of the two files. */
export type FetchOutcome =
  | { readonly kind: "ok" }
  /** Reached, parsed, but the schema is not one we recognise — treated exactly as a failure. */
  | { readonly kind: "schema-mismatch"; readonly saw: string }
  /** Network failure, 404, timeout. */
  | { readonly kind: "unreachable" }
  /** Served from the PWA cache; `ageMs` is measured against the cached generated_at_ms. */
  | { readonly kind: "cached"; readonly ageMs: number };

export interface FetchState {
  readonly roster: FetchOutcome;
  readonly state: FetchOutcome;
}

/**
 * How much of the settlement the page can honestly draw.
 *
 * `roster-only` is the load-bearing mode — topology without state. `nothing-to-draw` is the only
 * mode that shows a bare message, and it requires the HUB to be gone: without the roster there is
 * no list of vaults, so there is genuinely nothing to render.
 */
export type RenderMode = "full" | "roster-only" | "cached" | "nothing-to-draw";

/** An outcome the page may render state from. `cached` counts — with its age surfaced. */
function usable(o: FetchOutcome): boolean {
  return o.kind === "ok" || o.kind === "cached";
}

/**
 * Decide the render mode.
 *
 * Schema mismatch is deliberately folded into failure rather than parsed partially: a shape we do
 * not recognise must not be half-read into a confident render. Better to draw the topology and say
 * the state is unreadable than to invent meaning from unknown fields.
 */
export function renderMode(fetches: FetchState): RenderMode {
  if (!usable(fetches.roster)) return "nothing-to-draw";
  if (fetches.state.kind === "cached") return "cached";
  if (!usable(fetches.state)) return "roster-only";
  return "full";
}

/** What a region shows. `withheld` regions carry the violet hatch, never a zero. */
export interface RegionPlan {
  readonly drawTopology: boolean;
  readonly drawConfidenceBars: boolean;
  readonly drawActivityLogs: boolean;
  readonly drawDwellersInRooms: boolean;
  /** The chips' register. A failed fetch is OUR blindness, never the society's failure. */
  readonly chipRegister: "status" | "withheld";
  /** Present when the page must say why it cannot see. */
  readonly provenance: string | null;
}

/** The withheld marker. Never `0`, never `-`, never an empty bar — those are all claims. */
export const NOT_OBSERVED = "⋯ not observed";

/**
 * The full region plan for a mode.
 *
 * Two rules drive every row:
 *   1. NO ZERO-VALUE BARS. A zero-length confidence bar is a measurement of zero; the absence of a
 *      bar is the honest absence. So bars are drawn only when state is readable.
 *   2. CHIPS GO VIOLET, NOT RED, ON FETCH FAILURE. Red means `heat` — the society is failing.
 *      A fetch we could not complete is OUR failure to observe, and colouring it red would accuse
 *      the dwellers of our own blindness.
 */
export function regionPlan(mode: RenderMode): RegionPlan {
  switch (mode) {
    case "full":
      return {
        drawTopology: true,
        drawConfidenceBars: true,
        drawActivityLogs: true,
        drawDwellersInRooms: true,
        chipRegister: "status",
        provenance: null,
      };
    case "cached":
      // A cached file is never presented as live: freshness derives from the frame timestamp, not
      // from fetch success, so an old cache renders cold on its own. The age is surfaced anyway so
      // the reader knows they are looking at a snapshot rather than the present.
      return {
        drawTopology: true,
        drawConfidenceBars: true,
        drawActivityLogs: true,
        drawDwellersInRooms: true,
        chipRegister: "status",
        provenance: "state served from cache; age shown against its own generated_at",
      };
    case "roster-only":
      // The mode the split exists for. Topology is real and drawn; everything state-derived is
      // withheld rather than zeroed.
      return {
        drawTopology: true,
        drawConfidenceBars: false,
        drawActivityLogs: false,
        // NOT YET POSSIBLE: placement needs `room_id` / `default_agent_id` on roster hats (landing
        // in the bridge fix). Until then dwellers cannot be placed from the hub alone, and drawing
        // them from a hardcoded page-side map would be the page asserting a fact the data did not
        // give it. They render in an unplaced tray instead.
        drawDwellersInRooms: false,
        chipRegister: "withheld",
        provenance:
          "roster read; state unreachable. The settlement is drawn from the roster alone — " +
          "rooms exist, their state is not observed.",
      };
    case "nothing-to-draw":
      return {
        drawTopology: false,
        drawConfidenceBars: false,
        drawActivityLogs: false,
        drawDwellersInRooms: false,
        chipRegister: "withheld",
        provenance: "no roster — nothing to draw",
      };
  }
}

/**
 * How long the page may show a loading state before it must commit to a render.
 *
 * Iris §3.8: never a spinner past five seconds. An indefinite spinner is a page refusing to say
 * what it knows — and what it knows after five seconds is "I cannot reach this", which is
 * information the reader is entitled to.
 */
export const MAX_SPINNER_MS = 5000;
