/**
 * mutation-readout.ts — the 4×4 controller grammar for a mutation finding.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS A MENU AND NOT A FLAG
 *
 * The freedom ledger (`mutation-freedoms.ts`) could be read but not written, because `--declare
 * --reason "..."` is an **unbounded write path**: nothing constrains what an agent may do at that
 * point, a free-text call is not reconstructible so DST cannot replay it, and it records a
 * destination without a fork.
 *
 * The answer is not a more careful flag. The write is a **cell in a bounded menu** — the universal
 * controller grammar the room loop already uses (`observe -> choose -> execute -> append`,
 * `src/Core/DarkHallRoomLoop.fs:291`; `DarkHallCabinetRuntime.ControllerReadout`).
 *
 * NOTE ON LANGUAGES, stated because getting this wrong is a category error the session already made
 * once: `ControllerReadout` is F# over `DarkHall` rooms and this is TypeScript over mutation
 * findings. There is **no code path between them** and this does not pretend otherwise. What
 * transfers is the GRAMMAR — bounded cells, deterministic construction, a total escape, an
 * appended transcript — not the type.
 *
 * ## The properties that make it better than a flag
 *
 *   BOUNDED       16 cells. An agent cannot invent a response; the undecidable gap-vs-freedom call
 *                 stays the agent's, but the SHAPE of the answer is fixed.
 *   DETERMINISTIC `rulesApplied` records how the menu was built, so a run replays.
 *   RECORDED      choosing appends, so the FORK is history — not just the destination.
 *
 * ## Cell 16 is the escape, and it is TOTAL
 *
 * The last cell is never an action — it is escape to a wider grid (16 -> 256 -> 65,536, each level
 * squaring, one cell per level paying for the next). Same pattern this repo already ships as
 * `Category.Extended = 15uy` and the `Raw` escapes on `Authority` / `Momentum`.
 *
 * **The escape is a total function; the destination need not be.** Cell 16 always works, with no
 * precondition. The level it opens may be PARTIAL — some cells defined, some empty, possibly never
 * finished. The door is complete; the room behind it is not, and claiming otherwise would be an
 * overclaim.
 *
 * **And escaping into undefined space is not an error — it is how the grammar grows.** Whoever
 * first needs a cell that does not exist is the one who defines it. So escape frequency is not only
 * a warning; split by destination it is a FRONTIER MAP:
 *
 *   escape -> a DEFINED cell      the visible vocabulary was too narrow; widen the menu
 *   escape -> an UNDEFINED region the frontier; the system is growing here, and the escaper defines it
 *
 * Summing those two would hide the distinction that makes the metric useful.
 */

import { hasher } from "../blake3/blake3";
import { toHex } from "../merkle/merkle";
import { freedomKey, type DeclarerLedger, type Freedom } from "./mutation-freedoms";
import type { Finding } from "./mutation-runner";

/** A finding is a ROOM; the readout is what may be done about it. */
export interface FindingRoom {
  readonly source: string;
  readonly test: string;
  readonly mutation: string;
}

export function roomOf(f: Finding): FindingRoom {
  return { source: f.source, test: f.test, mutation: f.mutation };
}

/**
 * The closed action grammar.
 *
 * `escape` is always present and always last. `undefined-cell` is what an escape can land on: a
 * slot in the wider grid that nobody has defined yet — reachable, recorded, and an invitation.
 */
export type CellAction =
  | { readonly kind: "declare-free"; readonly reason: string }
  | { readonly kind: "write-test" }
  /**
   * A reading of the IMPLEMENTATION, not of the specification — orthogonal to the other two, which
   * is why it needs its own cell. When a guard is masked by another guard deciding the same thing,
   * no test can hold it and no freedom honestly describes it. See the mutants-coexist research §3a.
   */
  | { readonly kind: "note-redundant"; readonly reason: string }
  | { readonly kind: "supersede-mine"; readonly reason: string }
  | { readonly kind: "defer" }
  | { readonly kind: "read-declarer"; readonly declarer: string }
  | { readonly kind: "escape" }
  | { readonly kind: "undefined-cell"; readonly level: number; readonly index: number };

export interface Cell {
  readonly index: number;
  readonly label: string;
  readonly action: CellAction;
}

export interface Readout {
  readonly room: FindingRoom;
  /** Exactly `GRID_SIZE` slots. `undefined` = an empty slot at this level, not an error. */
  readonly grid: readonly (Cell | undefined)[];
  /** How the menu was CONSTRUCTED — the determinism record, so a choice replays. */
  readonly rulesApplied: readonly string[];
  /** Which level of the escape ladder this readout sits on. Level 0 is the base 4×4. */
  readonly level: number;
}

export const GRID_SIZE = 16;
/** The escape is ALWAYS the last slot, at every level, with no precondition. */
export const ESCAPE_INDEX = GRID_SIZE - 1;

/**
 * Observe a finding into a menu.
 *
 * Deterministic: the same room, the same ledgers and the same declarer always produce the identical
 * grid, and `rulesApplied` says why. Nothing here reads a clock, the filesystem, or the network.
 */
export function observeFinding(
  room: FindingRoom,
  me: string,
  ledgers: readonly DeclarerLedger[],
  level = 0,
): Readout {
  const key = freedomKey(room);
  const live = (f: Freedom) => f.supersededAt === undefined;
  const mine = ledgers.find((l) => l.declarer === me)?.freedoms.find((f) => freedomKey(f) === key && live(f));
  const others = ledgers
    .filter((l) => l.declarer !== me && l.freedoms.some((f) => freedomKey(f) === key && live(f)))
    .map((l) => l.declarer)
    .sort();

  const rules: string[] = [`level=${level}`, `declarer=${me}`, `ledgers=${ledgers.length}`];
  const grid: (Cell | undefined)[] = new Array(GRID_SIZE).fill(undefined);
  let next = 0;
  const place = (label: string, action: CellAction) => {
    if (next >= ESCAPE_INDEX) return; // never overwrite the escape; a full level escapes instead
    grid[next] = { index: next, label, action };
    next += 1;
  };

  if (mine) {
    // Already declared free by me: the useful actions are to withdraw or to leave it alone.
    place("record: no longer free (supersede mine)", { kind: "supersede-mine", reason: "" });
    rules.push("mine=declared -> supersede offered, declare withheld");
  } else {
    place("declare free (reason required)", { kind: "declare-free", reason: "" });
    place("write the test", { kind: "write-test" });
    rules.push("mine=undeclared -> declare + write-test offered");
  }

  // Offered in BOTH branches: this judges the code, not the spec, so it stays available whether or
  // not the dimension is already declared free. An indistinguishable mutant that resists both of the
  // readings above is usually evidence about the implementation.
  place("record: the guard looks redundant", { kind: "note-redundant", reason: "" });
  rules.push("redundant=always_offered");

  place("defer, explicitly", { kind: "defer" });

  // One cell per DISAGREEING declarer, so contradicting someone requires having been shown them.
  for (const d of others) {
    place(`read ${d}'s reason`, { kind: "read-declarer", declarer: d });
  }
  rules.push(`others_declaring=${others.length ? others.join("|") : "none"}`);

  grid[ESCAPE_INDEX] = {
    index: ESCAPE_INDEX,
    label: "escape to a wider grid",
    action: { kind: "escape" },
  };
  rules.push(`escape=always@${ESCAPE_INDEX}`);

  return { room, grid, rulesApplied: rules, level };
}

/** Thrown when a choice is off the menu. The bound is structural, not advisory. */
export class OffMenuError extends Error {}

/**
 * Choose a cell.
 *
 * An index outside the grid is refused — that is the bound. An EMPTY slot is NOT refused: it is an
 * undefined cell, and choosing it is how the frontier gets defined. Those two are different, and
 * conflating them would turn "I need something that does not exist yet" into an error.
 */
export function choose(readout: Readout, index: number): CellAction {
  if (!Number.isInteger(index) || index < 0 || index >= GRID_SIZE) {
    throw new OffMenuError(`choice ${index} is off the ${GRID_SIZE}-cell menu — the bound is structural`);
  }
  const cell = readout.grid[index];
  if (cell) return cell.action;
  return { kind: "undefined-cell", level: readout.level, index };
}

/** Escaping opens the next level. Total: no precondition, at any level. */
export function escapeTo(readout: Readout, me: string, ledgers: readonly DeclarerLedger[]): Readout {
  return observeFinding(readout.room, me, ledgers, readout.level + 1);
}

/**
 * One appended transcript entry.
 *
 * `offered` records what was AVAILABLE, not merely what was taken — that is what makes the entry a
 * fork rather than a destination, and what lets an unchosen branch be returned to later.
 */
export interface TranscriptEntry {
  readonly room: FindingRoom;
  readonly declarer: string;
  readonly level: number;
  readonly chosenIndex: number;
  readonly action: CellAction;
  readonly offered: readonly string[];
  readonly rulesApplied: readonly string[];
  /** Content address of everything above. Identical decisions dedup to one address. */
  readonly address: string;
}

/** Stable, sorted-key encoding so the same decision always yields the same address. */
function canonical(o: unknown): string {
  if (Array.isArray(o)) return `[${o.map(canonical).join(",")}]`;
  if (o && typeof o === "object") {
    return `{${Object.entries(o as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  }
  return JSON.stringify(o) ?? "null";
}

export function recordChoice(
  readout: Readout,
  declarer: string,
  chosenIndex: number,
  action: CellAction,
): TranscriptEntry {
  const body = {
    room: readout.room,
    declarer,
    level: readout.level,
    chosenIndex,
    action,
    offered: readout.grid.map((c) => (c ? c.label : "")),
    rulesApplied: readout.rulesApplied,
  };
  // toHex, NOT .toString(): MerkleHash is a { hi, lo } record whose default toString is
  // "[object Object]" — which would give EVERY entry the same address and silently defeat both
  // dedup and distinctness. Caught by the tests below, which is why they assert both directions.
  const address = toHex(hasher.hash(new TextEncoder().encode(canonical(body))));
  return { ...body, address } as TranscriptEntry;
}

/**
 * The frontier map — escape counts split by where they LAND.
 *
 * Deliberately two numbers rather than one: an escape into a defined cell says the visible
 * vocabulary was too narrow, and an escape into undefined space says the system is growing there.
 * Summing them would hide exactly the distinction that makes the metric worth having.
 */
export interface EscapeProfile {
  readonly intoDefined: number;
  readonly intoUndefined: number;
}

export function escapeProfile(entries: readonly TranscriptEntry[]): EscapeProfile {
  let intoDefined = 0;
  let intoUndefined = 0;
  for (const e of entries) {
    if (e.action.kind === "escape") intoDefined += 1;
    else if (e.action.kind === "undefined-cell") intoUndefined += 1;
  }
  return { intoDefined, intoUndefined };
}

/**
 * Execute a chosen cell and produce the transcript entry.
 *
 * `execute` is deliberately the ONLY writer: `observeFinding` and `choose` are pure, so the whole
 * decision replays from `(room, declarer, ledgers, index)` and the side effect happens in exactly
 * one place. That is what makes the loop `observe -> choose -> execute -> append` rather than a
 * function that quietly writes while it looks.
 *
 * A `reason` is REQUIRED for the two cells that change the ledger. An undecidable call recorded
 * without a stated reason is a mute button, and the ledger already refuses one — this refuses it
 * earlier, where the message can name the cell.
 */
export interface ExecuteDeps {
  readonly declare: (f: Freedom) => void;
  readonly supersede: (room: FindingRoom, reason: string) => void;
  readonly append: (entry: TranscriptEntry) => void;
  /** Injected, never ambient — the entry must replay under DST. */
  readonly now: () => string;
}

export class ReasonRequiredError extends Error {}

export function execute(
  readout: Readout,
  declarer: string,
  index: number,
  reason: string,
  deps: ExecuteDeps,
): TranscriptEntry {
  const chosen = choose(readout, index);

  // Carry the operator-supplied reason into the action, so the transcript records WHY and not just
  // WHICH. The grid's placeholder reason is empty by construction — the menu cannot know it.
  let action: CellAction = chosen;
  if (
    chosen.kind === "declare-free" ||
    chosen.kind === "supersede-mine" ||
    // Writes no ledger, but it is still a CLAIM about the code that a later reader must be able to
    // check — "redundant" with no reason is indistinguishable from silence.
    chosen.kind === "note-redundant"
  ) {
    if (reason.trim() === "") {
      throw new ReasonRequiredError(
        `cell ${index} (${chosen.kind}) records a judgement and requires a reason — ` +
          `an undecidable call recorded without one is a mute button`,
      );
    }
    action = { ...chosen, reason: reason.trim() };
  }

  switch (action.kind) {
    case "declare-free":
      deps.declare({ ...readout.room, reason: action.reason, declaredAt: deps.now() });
      break;
    case "supersede-mine":
      deps.supersede(readout.room, action.reason);
      break;
    // write-test, note-redundant, defer, read-declarer, escape and undefined-cell change no ledger
    // state — note-redundant deliberately so: it is a claim to be checked, not a grant. They are
    // still APPENDED: "I looked and chose to do nothing here" is a fact worth keeping, and it is
    // what distinguishes a deferred finding from an ignored one.
    default:
      break;
  }

  const entry = recordChoice(readout, declarer, index, action);
  deps.append(entry);
  return entry;
}
