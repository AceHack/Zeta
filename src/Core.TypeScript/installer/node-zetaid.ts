#!/usr/bin/env bun
/**
 * node-zetaid.ts — the node identity key the USB installer writes at install
 * time, and the TypeScript oracle the installer's shell mint is byte-locked
 * against.
 *
 * Aaron 2026-08-22, on the MEASURED GAP that used to sit in zeta-install.sh
 * Step 2.7 ("nothing in the tree writes a ZetaId at install time"):
 * *"yes we should move this to a zetaid."*
 *
 * ── WHY Category.InventoryAsset AND NOT A NEW CATEGORY ──────────────────
 *
 * There is no node/traveler ZetaId category today. Checked before minting one:
 * `zeta-id/types.ts` Category has Observation..Channel plus the Extended escape
 * marker, and nothing in it names a machine.
 *
 * What DOES exist is the register a cluster node is already in.
 * `inventory/reconcile-surfaces.ts` describes `inventory/items/*.md` as the
 * *register* — "identity of record; ZetaId-keyed, git-as-database" — and
 * `inventory/new-item.ts` mints exactly
 * `packGeneric(1, Category.InventoryAsset, (ms << 78n) | random78)` for it. A
 * cluster node is a physical asset; so this module REUSES that scheme rather
 * than inventing a parallel one.
 *
 * The alternative, a dedicated `ClusterNode` category slot, is a FOUR-ORACLE
 * change: TS, C#, F# and Rust all pack Category, and the C#/F# oracles already
 * lag `InventoryAsset = 10` (noted in model-backend/multiplexed-duplex-transport.ts).
 * That is a real piece of work with a real byte-lock, and it is filed rather
 * than skipped — workitems/081M0QB3HP2087G0R0029W97ZZ-*.md sizes it and states
 * what it would buy (a node distinguishable from a GPU in the register by its
 * key alone, instead of by the file it lives in).
 *
 * ── WHY A SHELL ORACLE EXISTS AT ALL ────────────────────────────────────
 *
 * The installer runs inside the NixOS ISO: no bun, no node, no network. A mint
 * that needed this file would simply not run, so zeta-install.sh carries a
 * bash-3.2 implementation of the same scheme between its ZETA-NODE-ZETAID
 * markers. Two implementations of one encoding is exactly the drift risk the
 * four-oracle byte-lock discipline exists for, so `node-zetaid.test.ts` runs
 * the extracted shell block over fixed vectors and compares it to THIS module
 * character for character.
 *
 * ── DST ─────────────────────────────────────────────────────────────────
 *
 * `mintNodeZetaId` is a pure function of (ms, random78). The clock and the
 * entropy source enter only at `SYSTEM_NODE_ID_ENV`, the same boundary shape
 * as `backlog/new-workitem.ts`'s `WorkItemEnv`.
 */

import { packGeneric } from "../zeta-id/zeta-id.ts";
import { format, CROCKFORD_ALPHABET, ZETAID_BASE32_LEN } from "../zeta-id/encoding.ts";
import { Category } from "../zeta-id/types.ts";

/** Milliseconds are packed into 41 bits (payload bits 118..78), exactly as
 *  `inventory/new-item.ts` packs them. Above this the 119-bit payload
 *  overflows and `packGeneric` THROWS — it does not truncate, deliberately,
 *  because truncation aliases distinct inputs to one id. 2039-09-07. */
export const MAX_NODE_ZETAID_MS = 2199023255552; // 2^41

/** The randomness half: 78 bits, payload bits 77..0. */
export const NODE_ZETAID_RANDOM_BITS = 78n;

/** The path on the installed node. A SIBLING of cluster-node-id, never a
 *  replacement: the hostname is what the network calls this machine, the
 *  ZetaId is what the substrate calls it, and `injected-hostname.nix` reads
 *  the former at flake-evaluation time. */
export const NODE_ZETAID_PATH = "/etc/zeta/node-zetaid";

export interface NodeZetaIdEnv {
  /** Wall-clock ms → the ZetaId's high bits → chronological sort. */
  nowMs(): number;
  /** 78 bits of randomness → the low bits → conflict-free local mint. */
  next78(): bigint;
}

/** The only place the clock and the CSPRNG enter. */
export const SYSTEM_NODE_ID_ENV: NodeZetaIdEnv = {
  nowMs: () => Date.now(),
  next78: () => {
    const buf = new BigUint64Array(2);
    crypto.getRandomValues(buf);
    return ((buf[0]! << 64n) | buf[1]!) & ((1n << NODE_ZETAID_RANDOM_BITS) - 1n);
  },
};

/**
 * The pure mint. Deterministic given (ms, random78) — the property the shell
 * parity test depends on, and the reason the shell side takes the same two
 * values as arguments.
 *
 * Throws (rather than truncating) on an out-of-range ms or random78. The shell
 * side FAILS CLOSED at the same boundary — empty output, non-zero status — so
 * the two oracles refuse the same inputs as well as accepting the same ones.
 */
export function mintNodeZetaId(ms: number, random78: bigint): string {
  if (!Number.isInteger(ms) || ms < 0) {
    throw new Error(`node-zetaid: ms must be a non-negative integer, got ${String(ms)}`);
  }
  if (ms >= MAX_NODE_ZETAID_MS) {
    throw new Error(
      `node-zetaid: ms ${String(ms)} needs more than 41 bits; the 119-bit payload would overflow. ` +
        `Truncating here would ALIAS this id onto a 1970 one, silently and forever.`,
    );
  }
  if (random78 < 0n || random78 >= 1n << NODE_ZETAID_RANDOM_BITS) {
    throw new Error(`node-zetaid: random78 must fit in 78 bits, got ${random78.toString(2).length} bits`);
  }
  const payload = (BigInt(ms) << NODE_ZETAID_RANDOM_BITS) | random78;
  return format(packGeneric(1, Category.InventoryAsset, payload));
}

/** Mint from the real clock + CSPRNG (or an injected environment). */
export function mintNodeZetaIdFrom(env: NodeZetaIdEnv = SYSTEM_NODE_ID_ENV): string {
  return mintNodeZetaId(env.nowMs(), env.next78());
}

/**
 * Shape check for an id read back off a disk — the TypeScript twin of
 * `zeta_pf_validate_node_zetaid`.
 *
 * CANONICAL CASE ONLY. Crockford's lenient decode (I/L→1, O→0, lowercase) is
 * for a human re-typing an id off a label; this file is written by the
 * installer and never typed, so a lenient-shaped value in it is evidence that
 * something ELSE wrote it. Normalising that away would hide the finding.
 *
 * The leading character must be 0..7: 26 base32 chars carry 130 bits and the
 * top two are pad, so anything above 7 is a value that does not fit 128 bits —
 * the same rejection `encoding.ts` `parse` makes.
 */
export function isValidNodeZetaId(s: string): boolean {
  if (s.length !== ZETAID_BASE32_LEN) return false;
  if (!/^[0-7]/.test(s)) return false;
  for (const c of s) {
    if (!CROCKFORD_ALPHABET.includes(c)) return false;
  }
  return true;
}

/** How a node's ZetaId came to be, as the installer reports it at Step 6.65.
 *  `mintedOnRepairLegacy` is stated separately from `minted` so a log can
 *  never claim a recovery that did not happen. */
export type NodeZetaIdProvenance = "recovered" | "minted-on-repair-legacy" | "minted";

/**
 * Which provenance applies — the decision Step 6.65 makes, as a pure function
 * so the test does not have to read shell echoes to check it.
 *
 * The two rules that matter, and they pull in opposite directions on purpose:
 *
 *  • A REPAIR must recover, never re-mint. A repaired node that came back with
 *    a new key would have forgotten itself across the repair (manifesto §5).
 *  • A FORCE-REFORMAT must mint. It is a new node by declaration, and carrying
 *    the old identity across a deliberate wipe is the opposite error — a new
 *    node wearing a dead node's name.
 */
export function decideNodeZetaIdProvenance(input: {
  readonly recovered: string;
  readonly priorInstallFound: boolean;
  readonly forceReformatArmed: boolean;
}): NodeZetaIdProvenance {
  if (input.forceReformatArmed) return "minted";
  if (input.recovered.length > 0) return "recovered";
  if (input.priorInstallFound) return "minted-on-repair-legacy";
  return "minted";
}
