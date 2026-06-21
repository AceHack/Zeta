/**
 * The canonical v0 16-slot universal action grammar (Xbox-controller layout).
 *
 * ONE shared grammar. The sovereign `buildMenu()` (this package) and the corporate
 * `Menu16` (`agentic-organization/packages/application/src/observe.ts`) BOTH derive from
 * this single canonical definition — the "thing corporate retrofits onto" per the
 * canonical-retrofit (docs/DECISIONS/2026-05-31-observe-act-16-direction-universal-action-grammar-local-no-cloud-llm.md).
 *
 * Before this module the v0 grammar lived only as ADR prose + a corporate-private copy in
 * the corporate `Menu16Slot[]`. This makes it canonical code: the 16 DIRECTIONS are FIXED (muscle
 * memory); per-state LABELS + Tri availability move (see `RenderedSlot`).
 *
 * Source of truth: the ADR's "The 16-slot universal action grammar (v0 — RESOLVED 2026-05-31)"
 * table. If a slot's role is wrong, v1 changes it there first, then here (no-dogma: the whys
 * stay challengeable; `grammar-16.test.ts` is the conformance lock against the ADR).
 *
 * Per-slot availability is the canonical tri-boolean (081KSV2WD0008QG0R00051XS0N): a state that forbids
 * committing renders slot 4 as `F`; a held/uncertain option renders it `N`.
 *
 * Composes:
 *   - docs/DECISIONS/2026-05-31-observe-act-16-direction-universal-action-grammar-local-no-cloud-llm.md (the v0 layout + canonical-retrofit)
 *   - src/Core.TypeScript/tri-boolean (081KSV2WD0008QG0R00051XS0N — the `Tri` per-slot availability)
 *   - ./observe.ts (the sovereign NextAction algebra + buildMenu this grammar renders)
 */

import type { Tri } from "../tri-boolean/index";

/** The four controller groups (4 x 4 = 16). */
export type SlotGroup = "Navigate" | "Commit" | "Scope" | "Meta";

/**
 * A fixed slot in the v0 grammar. `index` + `group` + `controllerInput` + `role` are
 * STABLE (muscle memory); only the rendered label + availability move per state.
 */
export interface GrammarSlot {
  readonly index: number; // 0..15, dense
  readonly group: SlotGroup;
  readonly controllerInput: string; // "D-pad Up", "A", "LB", "Start", ...
  readonly role: string; // fixed role; the rendered label changes per state
}

/**
 * A slot rendered for a concrete world state: the fixed grammar slot + the per-state
 * label + the tri-boolean availability. This is the shared CONTRACT both the sovereign
 * render and the corporate `Menu16Slot` converge on (corporate carries extra fields —
 * `action`/`impl` — but its `index`/`availability` shape is this).
 */
export interface RenderedSlot extends GrammarSlot {
  readonly label: string; // per-state label (what this slot does right now)
  readonly availability: Tri; // T legal / F vetoed / N held-uncertain (081KSV2WD0008QG0R00051XS0N)
}

/**
 * The canonical v0 grammar — FIXED for v0 (corporate review to lock; whys stay challengeable).
 * Exactly 16 slots, dense indices 0..15, four groups of four, in the ADR's table order.
 */
export const GRAMMAR_16_V0: readonly GrammarSlot[] = [
  // Navigate (0..3) — D-pad
  { index: 0, group: "Navigate", controllerInput: "D-pad Up", role: "previous option / up a category" },
  { index: 1, group: "Navigate", controllerInput: "D-pad Down", role: "next option / down a category" },
  { index: 2, group: "Navigate", controllerInput: "D-pad Left", role: "previous context / sibling left" },
  { index: 3, group: "Navigate", controllerInput: "D-pad Right", role: "next context / sibling right" },
  // Commit (4..7) — face buttons
  { index: 4, group: "Commit", controllerInput: "A", role: "accept / commit the current option (the primary act)" },
  { index: 5, group: "Commit", controllerInput: "B", role: "cancel / back out (no state change beyond a back-event)" },
  { index: 6, group: "Commit", controllerInput: "X", role: "inspect / observe-more (expand detail; pure observe, no act)" },
  { index: 7, group: "Commit", controllerInput: "Y", role: "edit-grammar / branch — sovereign rail-change: edit the workflow itself / open an alternative line (a first-class generative exit)" },
  // Scope (8..11) — bumpers + triggers
  { index: 8, group: "Scope", controllerInput: "LB", role: "scope-out (zoom to the parent / coarser view)" },
  { index: 9, group: "Scope", controllerInput: "RB", role: "scope-in (zoom to the child / finer view)" },
  { index: 10, group: "Scope", controllerInput: "LT", role: "undo / retract (retraction-native; append a retract-event)" },
  { index: 11, group: "Scope", controllerInput: "RT", role: "redo / replay (re-apply a retracted or prior move)" },
  // Meta (12..15) — Start/View + stick clicks
  { index: 12, group: "Meta", controllerInput: "Start", role: "refresh / re-run move-next (re-observe the world)" },
  { index: 13, group: "Meta", controllerInput: "View", role: "status / glass-halo (emit a visibility signal)" },
  { index: 14, group: "Meta", controllerInput: "L3", role: "free-time / rest — give up the tick; do nothing (NCI: a valid chosen mode)" },
  { index: 15, group: "Meta", controllerInput: "R3", role: "escalate / ask-operator (hand a decision to a human)" },
] as const;

/** Slot indices for the four groups, in order (4 each). */
export const GROUP_RANGES: Readonly<Record<SlotGroup, readonly number[]>> = {
  Navigate: [0, 1, 2, 3],
  Commit: [4, 5, 6, 7],
  Scope: [8, 9, 10, 11],
  Meta: [12, 13, 14, 15],
};

/** The fixed slots of one group, in order. */
export function byGroup(group: SlotGroup): readonly GrammarSlot[] {
  return GRAMMAR_16_V0.filter((s) => s.group === group);
}

/**
 * Named v0 slot indices that carry load-bearing semantics elsewhere (the free-time NCI
 * slot + the edit-grammar rail-change exit). Use these instead of magic numbers.
 */
export const SLOT = {
  ACCEPT: 4,
  INSPECT: 6,
  EDIT_GRAMMAR: 7, // the Y / rail-change generative exit
  UNDO_RETRACT: 10,
  STATUS_GLASS_HALO: 13,
  FREE_TIME: 14, // the L3 / rest NCI slot
  ESCALATE: 15,
} as const;

/**
 * RETROFIT-TENSION (surfaced, not collapsed) — the sovereign `NextAction` algebra has FOUR
 * free modes (explore / play / self_reflect / free_time) but v0 has ONE free slot
 * (14 = free-time/rest). The full `NextAction.kind -> slot` projection is the NEXT slice;
 * it must resolve whether v0 grows dedicated explore/play/self_reflect slots or whether
 * those collapse into slot 14's label + a sub-menu. Left OPEN here on purpose — the v0
 * table is faithful to the ADR; fabricating a clean total mapping would paper over a real
 * design question. See the canonical-retrofit section of the ADR.
 */
