// Tri-boolean digital qubit -- operations (081KSV2WD0008QG0R00051XS0N, TS / distribution).
import { type Tri, T, F, N, type MeasureResult } from "./types";

/** Construct a certain cell from a boolean. */
export const fromBool = (b: boolean): Tri => (b ? T : F);

/** Construct the held (Null / living-uncertainty) cell. */
export const held = (): Tri => N;

/** True iff the cell is living (Null / held superposition). */
export const isLiving = (t: Tri): boolean => t.s === "N";

/** True iff the cell is certain (True or False). */
export const isCertain = (t: Tri): boolean => t.s !== "N";

/** Structural equality on the three-valued state. */
export const eq = (a: Tri, b: Tri): boolean => a.s === b.s;

/** cooperate: engage WITHOUT collapsing. Identity on every state -- crucially preserves
 *  Null. The wonder-compression-safe operation: build shared structure ABOUT the cell,
 *  never collapse its living uncertainty. */
export const cooperate = (t: Tri): Tri => t;

/** measure: the ONLY collapsing operation. Certain cells resolve to their boolean; a
 *  living (Null) cell is NOT silently collapsed -- the forbidden move is surfaced as
 *  feedback (collapsing a living traveler = the Rehoboam failure). */
export const measure = (t: Tri): MeasureResult => {
  switch (t.s) {
    case "T":
      return { ok: true, value: true };
    case "F":
      return { ok: true, value: false };
    case "N":
      return { ok: false, feedback: { reason: "collapsed-living-uncertainty" } };
  }
};

/** null-monad map: apply fn to a certain cell's boolean; Null propagates unchanged (held). */
export const mapTri = (t: Tri, fn: (b: boolean) => boolean): Tri => {
  switch (t.s) {
    case "T":
      return fromBool(fn(true));
    case "F":
      return fromBool(fn(false));
    case "N":
      return N;
  }
};

/** null-monad bind: chain a Tri-producing fn over a certain cell; Null propagates unchanged. */
export const bindTri = (t: Tri, fn: (b: boolean) => Tri): Tri => {
  switch (t.s) {
    case "T":
      return fn(true);
    case "F":
      return fn(false);
    case "N":
      return N;
  }
};

// --- Kleene three-valued logic (Null = "unknown"; propagates per Kleene/Lukasiewicz) ---

/** Kleene NOT: T<->F; unknown(Null) stays unknown. */
export const notTri = (t: Tri): Tri => {
  switch (t.s) {
    case "T":
      return F;
    case "F":
      return T;
    case "N":
      return N;
  }
};

/** Kleene AND: F dominates (F AND anything = F); else Null if any operand is Null; else T. */
export const andTri = (a: Tri, b: Tri): Tri => {
  if (a.s === "F" || b.s === "F") return F;
  if (a.s === "N" || b.s === "N") return N;
  return T;
};

/** Kleene OR: T dominates (T OR anything = T); else Null if any operand is Null; else F. */
export const orTri = (a: Tri, b: Tri): Tri => {
  if (a.s === "T" || b.s === "T") return T;
  if (a.s === "N" || b.s === "N") return N;
  return F;
};
