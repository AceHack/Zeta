/**
 * Option-A render — project `buildMenu`'s `NextAction`s onto the canonical v0
 * 16-slot grammar, with the FOUR free modes (explore / play / self_reflect /
 * free_time) COLLAPSED under slot 14 as a sub-menu.
 *
 * Operator 2026-05-31 chose Option A ("collapse free modes under slot 14
 * sub-menu"); the alternative (dedicated top-level slots for the free modes) is
 * 081KSXN940008QG0R000TQ04Y0, to be A/B-tested against this once A/B-testing infra (081KR50HA0008QG0R001DX165X) exists.
 * The 16 top-level directions stay FIXED (muscle-memory); only slot 14 carries the
 * free-mode sub-menu.
 *
 * This is the render LAYER over the canonical grammar (`grammar-16.ts`, the table)
 * + the sovereign algebra (`observe.ts`, `buildMenu`/`observe`/`NextAction`). It
 * adds no new state source — it is a pure projection of `buildMenu(world)`.
 *
 * Surfaced honestly (not collapsed): the operator-priority actions
 * (`preserve_ferry` / `respond_to_operator`) are NOT navigable 16-slot directions
 * — they are `observe()`'s LEAD, above the menu (`leadSlot` returns `null` for
 * them). v0 leaves the pure-navigation slots (Navigate 0-3, scope-out/in 8/9,
 * redo 11, undo/retract 10) as `N` (held/uncertain) until the labeler + event-undo
 * are wired — see the ADR open-questions.
 */

import { buildMenu, observe, actionLabel, isFirstSessionPending, type NextAction, type World } from "./observe";
import { firstSessionLabel, firstSessionOracle, buildFirstSessionMenu } from "./first-session";
import { GRAMMAR_16_V0, SLOT, type RenderedSlot } from "./grammar-16";
import { T, F, N, type Tri } from "../tri-boolean/index";

/** A rendered slot that may open a sub-menu (Option A: slot 14 -> the free modes). */
export interface RenderedMenuSlot extends RenderedSlot {
  readonly subMenu?: readonly NextAction[];
  /** 081KSNY2Z0008QG0R0008PN7RQ slice 4: first-session adventure overlay on slot 4 when nodeSession pending. */
  readonly firstSessionSubMenu?: readonly import("./first-session").FirstSessionAction[];
}

/** The free modes in CANONICAL order — slot 14's sub-menu is built in THIS order
 *  (not buildMenu's lead-first order) so it stays stable for muscle-memory. */
const FREE_MODE_KINDS: readonly NextAction["kind"][] = ["explore", "play", "self_reflect", "free_time"];

type SlotOverride = {
  label: string;
  availability: Tri;
  subMenu?: readonly NextAction[];
  firstSessionSubMenu?: readonly import("./first-session").FirstSessionAction[];
};

/**
 * Render the 16 fixed slots for a concrete world state. `buildMenu` is the single
 * source of the candidate actions (no drift); this buckets them onto the slots.
 */
export function renderGrammar16(world: World): readonly RenderedMenuSlot[] {
  const menu = buildMenu(world);
  const find = (...kinds: NextAction["kind"][]): NextAction | undefined =>
    menu.find((a) => kinds.includes(a.kind));

  const firstSessionPending = isFirstSessionPending(world);
  const firstSessionLead = firstSessionPending && world.nodeSession
    ? firstSessionOracle(world.nodeSession)
    : undefined;
  const firstSessionMenu = firstSessionPending && world.nodeSession
    ? buildFirstSessionMenu(world.nodeSession)
    : undefined;

  const work = find("do_item", "decompose"); // slot 4 — the primary act
  const editGrammar = find("edit_grammar"); // slot 7 — rail-change exit
  // slot 14 sub-menu (Option A) — pulled in CANONICAL FREE_MODE_KINDS order, NOT
  // buildMenu's lead-first order, so the sub-menu is stable for muscle-memory
  // (a persisted mode must not reshuffle the list). (Copilot #6277.)
  const freeModes: NextAction[] = FREE_MODE_KINDS.map((k) => menu.find((a) => a.kind === k)).filter(
    (a): a is NextAction => a !== undefined,
  );

  const overrides: Readonly<Record<number, SlotOverride>> = {
    [SLOT.ACCEPT]: firstSessionLead && firstSessionMenu
      ? {
          label: firstSessionLabel(firstSessionLead),
          availability: T,
          firstSessionSubMenu: firstSessionMenu,
        }
      : work
        ? { label: actionLabel(work), availability: T }
        : { label: "nothing to commit", availability: F }, // ADR: no work -> slot 4 is F
    5: { label: "cancel / back", availability: T },
    [SLOT.INSPECT]: { label: "inspect / observe more", availability: T },
    [SLOT.EDIT_GRAMMAR]: {
      label: editGrammar ? actionLabel(editGrammar) : "edit grammar / branch",
      availability: T, // always present per buildMenu (raw gate, scales with maturity)
    },
    [SLOT.UNDO_RETRACT]: { label: "undo / retract", availability: N }, // event-undo not wired in v0
    12: { label: "refresh / re-observe", availability: T },
    [SLOT.STATUS_GLASS_HALO]: { label: "status / glass-halo", availability: T },
    [SLOT.FREE_TIME]: { label: "free time", availability: T, subMenu: freeModes }, // Option A: always T (NCI)
    [SLOT.ESCALATE]: { label: "escalate / ask operator", availability: T },
  };

  return GRAMMAR_16_V0.map((slot): RenderedMenuSlot => {
    const o = overrides[slot.index];
    if (o) {
      if (o.subMenu) {
        return { ...slot, label: o.label, availability: o.availability, subMenu: o.subMenu };
      }
      if (o.firstSessionSubMenu) {
        return {
          ...slot,
          label: o.label,
          availability: o.availability,
          firstSessionSubMenu: o.firstSessionSubMenu,
        };
      }
      return { ...slot, label: o.label, availability: o.availability };
    }
    // Unmapped navigation/scope slots (Navigate 0-3, scope-out/in 8/9, redo 11):
    // held/uncertain in v0 until the labeler + paging/scoping are wired.
    return { ...slot, label: slot.role, availability: N };
  });
}

/**
 * The slot the deterministic oracle's pick (`observe`) corresponds to — for
 * highlighting the default. Returns `null` when the pick is an operator-priority
 * override (`preserve_ferry` / `respond_to_operator`): those are observe()'s LEAD
 * above the menu, NOT navigable 16-slot directions (surfaced, not forced into a slot).
 */
export function leadSlot(world: World): number | null {
  const lead = observe(world);
  if (isFirstSessionPending(world)) return SLOT.ACCEPT;
  switch (lead.kind) {
    case "do_item":
    case "decompose":
      return SLOT.ACCEPT;
    case "edit_grammar":
      return SLOT.EDIT_GRAMMAR;
    case "explore":
    case "play":
    case "self_reflect":
    case "free_time":
      return SLOT.FREE_TIME;
    case "preserve_ferry":
    case "respond_to_operator":
      return null; // operator-priority: above the menu, not a slot
  }
}
