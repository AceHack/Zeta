// hsm-authkey-model.ts — the pure model behind `lint-hsm-delegated-capability-escalation.ts`.
//
// Data in, findings out. No device, no credential, no network, no clock, no filesystem.
// Every device rule encoded here is quoted from a primary source in the lint's header; the
// rule tags R1..R6 below refer to that header.
//
// A note on the encoding, because it looks odd on purpose:
//
//   Capability names are parsed from ONE verbatim block (YH_CAPABILITY_TABLE) transcribed
//   from yh_capability[] in Yubico/yubihsm-shell lib/yubihsm.h. Keeping it as a single block
//   rather than 57 quoted object keys is what makes "diff this against upstream" a
//   two-second operation instead of a merge review. A security constant table you cannot
//   cheaply re-check against its source is one that silently goes stale.
//
//   Masks are built with 2n raised to the bit, which is the same value as a left shift.

/**
 * R1 — yh_capability[], verbatim, one "name bit" pair per line, bit in hex.
 *
 * Source: https://github.com/Yubico/yubihsm-shell lib/yubihsm.h (master, fetched
 * 2026-08-20). Yubico's docs give the same set as a "Hex Mask" column (User Guide §1.2.3,
 * "A Set of Capabilities is an 8-byte value. Each Capability is identified by a specific
 * bit"); the header gives bit INDICES, and mask = 2 raised to bit. So the doc's
 * 0x0000000000000004 for put-authentication-key is the header's bit 0x02.
 */
export const YH_CAPABILITY_TABLE = `
change-authentication-key 2e
create-otp-aead 1e
decrypt-cbc 34
decrypt-ecb 32
decrypt-oaep 0a
decrypt-otp 1d
decrypt-pkcs 09
delete-asymmetric-key 29
delete-authentication-key 28
delete-hmac-key 2b
delete-opaque 27
delete-otp-aead-key 2d
delete-public-wrap-key 37
delete-symmetric-key 31
delete-template 2c
delete-wrap-key 2a
derive-ecdh 0b
encrypt-cbc 35
encrypt-ecb 33
export-wrapped 0c
exportable-under-wrap 10
generate-asymmetric-key 04
generate-hmac-key 15
generate-otp-aead-key 24
generate-symmetric-key 30
generate-wrap-key 0f
get-log-entries 18
get-opaque 00
get-option 12
get-pseudo-random 13
get-template 1a
import-wrapped 0d
put-asymmetric-key 03
put-authentication-key 02
put-mac-key 14
put-opaque 01
put-otp-aead-key 23
put-public-wrap-key 36
put-symmetric-key 2f
put-template 1b
put-wrap-key 0e
randomize-otp-aead 1f
reset-device 1c
rewrap-from-otp-aead-key 20
rewrap-to-otp-aead-key 21
set-option 11
sign-attestation-certificate 22
sign-ecdsa 07
sign-eddsa 08
sign-hmac 16
sign-pkcs 05
sign-pss 06
sign-ssh-certificate 19
unwrap-data 26
verify-hmac 17
wrap-data 25
`;

/** Local aliases so no generic close is followed by a brace (keeps the source shell-safe). */
type CapTable = Map<string, number>;
type CapTableRO = ReadonlyMap<string, number>;
type Names = readonly string[];
function parseCapabilityTable(text: string): CapTable {
  const table: CapTable = new Map();
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.length === 0) continue;
    const parts = line.split(" ").filter((p) => p.length !== 0);
    const name = parts[0];
    const bit = parts[1];
    if (name === undefined || bit === undefined || parts.length !== 2) throw new Error("malformed row");
    const n = Number.parseInt(bit, 16);
    if (!Number.isSafeInteger(n) || !(n >= 0 && n <= 63)) throw new Error("bad bit for " + name);
    if (table.has(name)) throw new Error("duplicate capability: " + name);
    table.set(name, n);
  }
  return table;
}

/** name to bit index. Built at module load; a malformed table throws rather than degrades. */
export const CAPABILITY_BITS: CapTableRO = parseCapabilityTable(YH_CAPABILITY_TABLE);

/** 2 raised to `bit`, without a shift operator. */
function bitValue(bit: number): bigint {
  let v = 1n;
  for (let i = 0; i !== bit; i += 1) v *= 2n;
  return v;
}

export function capabilityMask(names: Names): bigint {
  let mask = 0n;
  for (const n of names) {
    const bit = CAPABILITY_BITS.get(n);
    if (bit === undefined) continue; // validated separately; never silently trusted
    mask |= bitValue(bit);
  }
  return mask;
}

export function capabilityNames(mask: bigint): Names {
  const out: string[] = [];
  for (const [name, bit] of CAPABILITY_BITS) if ((mask & bitValue(bit)) !== 0n) out.push(name);
  return out.sort();
}

/** Throws on an unknown name. A typo in a security constant must never read as "absent". */
export function capBit(name: string): bigint {
  const bit = CAPABILITY_BITS.get(name);
  if (bit === undefined) throw new Error("no such YubiHSM 2 capability: " + name);
  return bitValue(bit);
}

/** R6 - the nine per-type delete capabilities that `delete-object` is mistaken for. */
export const DELETE_FAMILY: Names = Array.from(CAPABILITY_BITS.keys())
  .filter((c) => c.startsWith("delete"))
  .sort();

/** R2 - 16 domains; domain N is bit N-1 of a 16-bit mask (User Guide section 1.2.4). */
export const ALL_DOMAINS_MASK = 0xffff;

export function domainMask(domains: readonly number[]): number {
  let mask = 0;
  for (const d of domains) {
    if (!Number.isSafeInteger(d) || !(d >= 1 && d <= 16)) continue; // validated separately
    mask |= Number(bitValue(d - 1));
  }
  return mask;
}

export function domainList(mask: number): readonly number[] {
  const out: number[] = [];
  for (let d = 1; d !== 17; d += 1) if ((mask & Number(bitValue(d - 1))) !== 0) out.push(d);
  return out;
}

/**
 * Capabilities that change who you ARE rather than what you can compute.
 *
 * Each carries the reason it is listed. `delete-object` is deliberately absent (R6); the
 * nine family members are present individually. `change-authentication-key` is listed with
 * its true, narrower meaning (R5) rather than the escalation it is easy to mistake it for.
 */
export const DANGEROUS: CapReasons = new Map([
  [
    "put-authentication-key",
    "mints authentication keys - and the minter chooses the password, which is what converts the delegated set into the effective one",
  ],
  ["put-asymmetric-key", "installs key material of the operator choosing, e.g. an attacker-known private key"],
  ["export-wrapped", "the ONLY documented path by which private key material leaves the device"],
  ["import-wrapped", "installs objects from an off-device blob; see R4 - the domain constraint is undocumented"],
  ["put-wrap-key", "installs a wrap key whose bytes the operator knows: half of an export/import laundering chain"],
  ["generate-wrap-key", "creates a wrapping authority: the other half of the same chain"],
  ["put-public-wrap-key", "installs an asymmetric wrap authority"],
  ["set-option", "changes device-global options including force-audit - an availability and audit-integrity control"],
  ["reset-device", "factory-resets the device; destroys every key and every log entry"],
  ["delete-authentication-key", "removes peer credentials - denial of service against other tenants"],
  ["delete-asymmetric-key", "destroys signing keys in any domain this key reaches"],
  ["delete-wrap-key", "destroys backup and restore authority"],
  ["delete-symmetric-key", "destroys key material in any domain this key reaches"],
  ["delete-opaque", "destroys certificates and opaque objects in any domain this key reaches"],
  ["delete-hmac-key", "destroys key material in any domain this key reaches"],
  ["delete-template", "destroys templates in any domain this key reaches"],
  ["delete-otp-aead-key", "destroys key material in any domain this key reaches"],
  ["delete-public-wrap-key", "destroys wrap authority"],
  [
    "change-authentication-key",
    "rekeys THIS session own authentication key (R5, not a peer key): a persistence primitive, not an escalation",
  ],
]);

type CapReasons = ReadonlyMap<string, string>;

// ── The declared roster ──────────────────────────────────────────────────────────────────

export type ObjectKind = "authentication-key" | "wrap-key";

export interface KeyDecl {
  readonly objectId: number;
  readonly label: string;
  readonly kind: ObjectKind;
  /** The principal this key belongs to: an agent, a ceremony operator, an auditor. */
  readonly principal: string;
  readonly domains: readonly number[];
  readonly capabilities: Names;
  readonly delegatedCapabilities: Names;
  /** Optional: which key provisioned this one. Enables the chain-realisability check. */
  readonly createdBy?: number;
  readonly note?: string;
}

/**
 * The partition being CLAIMED.
 *
 * Without it, "can A reach a domain A does not hold?" is trivially answered by A own domain
 * field. The interesting question is whether A can reach a domain belonging to SOMEONE ELSE,
 * and that needs a declared owner map. A lint without this input would be the vacuous
 * version of itself.
 */
export interface DomainPartition {
  readonly principal: string;
  readonly domains: readonly number[];
  readonly note?: string;
}

export type ProvisioningStatus =
  | "proposed-not-provisioned"
  | "provisioned-unverified"
  | "provisioned-verified-against-device";

export interface Roster {
  readonly provisioningStatus: ProvisioningStatus;
  readonly device: string;
  readonly partition: readonly DomainPartition[];
  readonly keys: readonly KeyDecl[];
  readonly note?: string;
}

export interface RosterError {
  readonly kind: string;
  readonly detail: string;
}

const VALID_STATUS: Names = [
  "proposed-not-provisioned",
  "provisioned-unverified",
  "provisioned-verified-against-device",
];

/** Hex object-id label used in every message, so findings are greppable against the device. */
export function keyAt(k: KeyDecl): string {
  return k.label + " (0x" + k.objectId.toString(16).padStart(4, "0") + ")";
}

/**
 * Structural validation. Fail-closed: the CLI refuses to report "no findings" on a roster it
 * could not parse into the device own model.
 */
export function validateRoster(r: Roster): readonly RosterError[] {
  const errs: RosterError[] = [];

  if (!VALID_STATUS.includes(r.provisioningStatus)) {
    errs.push({
      kind: "bad-provisioning-status",
      detail: "provisioningStatus must be one of " + VALID_STATUS.join(" | ") + "; got " + String(r.provisioningStatus),
    });
  }

  const seen = new Set<number>();
  for (const k of r.keys) {
    const at = keyAt(k);
    if (!Number.isSafeInteger(k.objectId) || !(k.objectId >= 1 && k.objectId <= 0xfffe)) {
      errs.push({ kind: "object-id-out-of-range", detail: at + ": object IDs are 16-bit; 0 and 0xffff are reserved" });
    }
    if (seen.has(k.objectId)) errs.push({ kind: "duplicate-object-id", detail: at + ": declared twice" });
    seen.add(k.objectId);

    if (k.domains.length === 0) {
      errs.push({ kind: "no-domains", detail: at + ": a key in no domain can reach nothing; declare the intent" });
    }
    for (const d of k.domains) {
      if (!Number.isSafeInteger(d) || !(d >= 1 && d <= 16)) {
        errs.push({
          kind: "domain-out-of-range",
          detail: at + ": domain " + String(d) + " - a YubiHSM 2 has domains 1..16",
        });
      }
    }

    if (k.kind !== "authentication-key" && k.kind !== "wrap-key") {
      errs.push({ kind: "unknown-kind", detail: at + ": kind must be authentication-key or wrap-key" });
    }
    if (k.createdBy !== undefined && !r.keys.some((o) => o.objectId === k.createdBy)) {
      errs.push({ kind: "dangling-created-by", detail: at + ": createdBy names no key in this roster" });
    }
    errs.push(...capabilityNameErrors(at, "capabilities", k.capabilities));
    errs.push(...capabilityNameErrors(at, "delegatedCapabilities", k.delegatedCapabilities));
  }

  errs.push(...partitionErrors(r));
  return errs;
}

/**
 * R6 in force: an unknown capability name is an ERROR, never a silent skip.
 *
 * A silently-ignored capability name in a security roster is a permission you only think you
 * denied - and `delete-object`, the most likely wrong name, gets its own message naming the
 * family it is mistaken for.
 */
function capabilityNameErrors(at: string, field: string, names: Names): readonly RosterError[] {
  const errs: RosterError[] = [];
  for (const n of names) {
    if (CAPABILITY_BITS.has(n)) continue;
    const hint =
      n === "delete-object"
        ? " - delete-object is a COMMAND (User Guide section 6.1.15), not a capability. There is no such bit in yh_capability[]. Name the per-type capability you mean: " +
          DELETE_FAMILY.join(", ")
        : "";
    errs.push({
      kind: "unknown-capability",
      detail: at + ": " + field + " names " + n + ", which is not a YubiHSM 2 capability" + hint,
    });
  }
  return errs;
}

/**
 * Two principals owning the same domain is not an escalation - it is the ABSENCE of a
 * partition, which makes every escalation finding downstream of it meaningless. Refused
 * loudly rather than resolved.
 */
function partitionErrors(r: Roster): readonly RosterError[] {
  const errs: RosterError[] = [];
  for (const [i, a] of r.partition.entries()) {
    for (const b of r.partition.slice(i + 1)) {
      const overlap = domainMask(a.domains) & domainMask(b.domains);
      if (overlap !== 0) {
        errs.push({
          kind: "partition-overlap",
          detail:
            "principals " +
            a.principal +
            " and " +
            b.principal +
            " both claim domain(s) " +
            domainList(overlap).join(", ") +
            " - that is not a partition",
        });
      }
    }
  }
  for (const k of r.keys) {
    if (r.partition.some((p) => p.principal === k.principal)) continue;
    errs.push({
      kind: "principal-not-in-partition",
      detail: keyAt(k) + ": principal " + k.principal + " owns no declared domains; escalation cannot be judged for it",
    });
  }
  return errs;
}

// ── The closure ──────────────────────────────────────────────────────────────────────────

/**
 * Two named device semantics. The difference between them IS a finding.
 *
 * `documented` - only R2/R3 are in force; IMPORT WRAPPED cannot move an object into a domain
 *   the session key lacks. The optimistic reading, correct if the omission in section 6.1.38
 *   is editorial.
 *
 * `doc-silent-pessimistic` - R4 silence is treated as permission: IMPORT WRAPPED may land an
 *   object in ANY domain, because the manual Required Capabilities list for that command
 *   states no domain constraint and the imported object "retains its metadata (Object ID,
 *   Domains, Capabilities, etc)".
 *
 * Both run by default and are reported separately. Their difference is exactly the question a
 * throwaway device would settle in ten minutes, and it is NOT settled here, because settling
 * it means touching hardware.
 */
export type EscalationModel = "documented" | "doc-silent-pessimistic";

/** One control point in the closure: a key the starting principal can open a session with. */
export interface Reach {
  readonly domains: number;
  readonly caps: bigint;
  readonly delegated: bigint;
  readonly kind: ObjectKind;
  /** How this was reached. First element is always the starting key label. */
  readonly via: Names;
}

/** Partial order on control points. `a` dominates `b` when it can do everything `b` can. */
export function dominates(a: Reach, b: Reach): boolean {
  return (
    a.kind === b.kind &&
    (a.domains & b.domains) === b.domains &&
    (a.caps & b.caps) === b.caps &&
    (a.delegated & b.delegated) === b.delegated
  );
}

/** Insert keeping the frontier a maximal antichain. Returns true when the frontier grew. */
function insert(acc: Reach[], next: Reach): boolean {
  if (acc.some((r) => dominates(r, next))) return false;
  for (let i = acc.length - 1; i !== -1; i -= 1) {
    const cur = acc[i];
    if (cur !== undefined && dominates(next, cur)) acc.splice(i, 1);
  }
  acc.push(next);
  return true;
}

export const CAP_PUT_AUTHKEY = capBit("put-authentication-key");
export const CAP_PUT_WRAPKEY = capBit("put-wrap-key");
export const CAP_GEN_WRAPKEY = capBit("generate-wrap-key");
export const CAP_IMPORT_WRAPPED = capBit("import-wrapped");
export const CAP_EXPORT_WRAPPED = capBit("export-wrapped");

const has = (m: bigint, c: bigint): boolean => (m & c) !== 0n;

export interface ClosureResult {
  readonly frontier: readonly Reach[];
  readonly rounds: number;
}

/**
 * Least fixed point of the delegation relation, starting from one declared key.
 *
 * Terminates because the state space is finite (16 domain bits, 56 capability bits twice) and
 * every step is monotone under `dominates`. `maxRounds` is a belt-and-braces bound that also
 * makes saturation DEPTH observable to tests: a closure that always converged in one round
 * would be a one-hop check wearing a fixpoint costume, and the test suite pins a roster that
 * genuinely needs three hops.
 */
export function delegationClosure(start: KeyDecl, model: EscalationModel, maxRounds = 16): ClosureResult {
  const seed: Reach = {
    domains: domainMask(start.domains),
    caps: capabilityMask(start.capabilities),
    delegated: capabilityMask(start.delegatedCapabilities),
    kind: start.kind,
    via: [start.label],
  };
  const frontier: Reach[] = [seed];

  let rounds = 0;
  for (; rounds !== maxRounds; rounds += 1) {
    let grew = false;
    for (const r of Array.from(frontier)) {
      if (r.kind !== "authentication-key") continue;
      if (expandFrom(frontier, r, model)) grew = true;
    }
    if (!grew) break;
  }
  return { frontier, rounds };
}

/** One round of edge expansion from a single control point. */
function expandFrom(frontier: Reach[], r: Reach, model: EscalationModel): boolean {
  let grew = false;

  // R3 - mint an authentication key. The MAXIMAL choice is taken: capabilities and delegated
  // both receive the creator full delegated set. Any lesser choice is dominated, so taking
  // the maximum loses nothing and keeps the frontier small.
  if (has(r.caps, CAP_PUT_AUTHKEY) && r.delegated !== 0n) {
    grew =
      insert(frontier, {
        domains: r.domains, // R2 - never wider than the creator
        caps: r.delegated,
        delegated: r.delegated,
        kind: "authentication-key",
        via: r.via.concat(["put-authentication-key"]),
      }) || grew;
  }

  // R3 - install or generate a wrap key.
  if ((has(r.caps, CAP_PUT_WRAPKEY) || has(r.caps, CAP_GEN_WRAPKEY)) && r.delegated !== 0n) {
    const verb = has(r.caps, CAP_PUT_WRAPKEY) ? "put-wrap-key" : "generate-wrap-key";
    grew =
      insert(frontier, {
        domains: r.domains,
        caps: r.delegated,
        delegated: r.delegated,
        kind: "wrap-key",
        via: r.via.concat([verb]),
      }) || grew;
  }

  // R4 - import under a controlled wrap key. The imported object capabilities are bounded by
  // the WRAP KEY delegated set, not the session key delegated set. That is the laundering
  // step, and it is the reason this is a closure rather than a comparison.
  if (!has(r.caps, CAP_IMPORT_WRAPPED)) return grew;
  for (const w of Array.from(frontier)) {
    if (w.kind !== "wrap-key") continue;
    if (!has(w.caps, CAP_IMPORT_WRAPPED)) continue;
    if ((w.domains & r.domains) === 0) continue; // a session reaches only shared domains
    if (w.delegated === 0n) continue;
    grew =
      insert(frontier, {
        domains: model === "doc-silent-pessimistic" ? ALL_DOMAINS_MASK : r.domains,
        caps: w.delegated,
        delegated: w.delegated,
        kind: "authentication-key",
        // The chain must count the WRAP KEY own provisioning steps too, otherwise the hop
        // count under-states the work and a genuine 2-op chain reads as 1.
        via: r.via.concat(w.via.slice(1)).concat(["import-wrapped"]),
      }) || grew;
  }
  return grew;
}

// ── Findings ─────────────────────────────────────────────────────────────────────────────

export type Severity = "high" | "medium" | "informational";

export interface Finding {
  readonly rule: string;
  readonly severity: Severity;
  readonly key: string;
  readonly principal: string;
  readonly message: string;
  /** Never rounded up. `checked` = a quoted device rule. `doc-silent-unverified` = R4. */
  readonly register: "checked" | "doc-silent-unverified";
  readonly model?: EscalationModel;
}

/** Domains owned by principals OTHER than this one. */
export function foreignDomainMask(r: Roster, principal: string): number {
  let m = 0;
  for (const p of r.partition) if (p.principal !== principal) m |= domainMask(p.domains);
  return m;
}

export function auditRoster(roster: Roster, models: readonly EscalationModel[]): readonly Finding[] {
  const out: Finding[] = [];
  for (const k of roster.keys) {
    out.push(...declarationFindings(roster, k));
    if (k.kind !== "authentication-key") continue;
    for (const model of models) out.push(...closureFindings(roster, k, model));
  }
  for (const k of roster.keys) out.push(...chainFindings(roster, k));
  return out;
}

/** Findings readable off the declaration alone - no closure needed. */
function declarationFindings(roster: Roster, k: KeyDecl): readonly Finding[] {
  const out: Finding[] = [];
  const at = keyAt(k);
  const own = domainMask(k.domains);
  const foreign = foreignDomainMask(roster, k.principal);
  const caps = capabilityMask(k.capabilities);
  const delegated = capabilityMask(k.delegatedCapabilities);

  // (0) Does this key already sit in another principal domain? Not an escalation at all - a
  // partition violation stated in the roster. Reported first, because every closure finding
  // below is downstream of it.
  const trespass = own & foreign;
  if (trespass !== 0) {
    out.push({
      rule: "declared-domain-trespass",
      severity: "high",
      key: at,
      principal: k.principal,
      register: "checked",
      message:
        "holds domain(s) " +
        domainList(trespass).join(", ") +
        ", declared as belonging to another principal. " +
        "No delegation chain is needed: a session opened with this key reaches those objects directly. " +
        "User Guide section 1.4: a session can only access objects that share at least one domain with the Authentication Key used to open it.",
    });
  }

  // (1) THE CORE THEOREM. Delegated is what you can BECOME, not merely what you can grant,
  // because the creator of an authentication key chooses its password.
  const becomable = has(caps, CAP_PUT_AUTHKEY) ? delegated & ~caps : 0n;
  const dangerousBecomable = capabilityNames(becomable).filter((c) => DANGEROUS.has(c));
  if (dangerousBecomable.length !== 0) {
    out.push({
      rule: "delegated-exceeds-capabilities",
      severity: "high",
      key: at,
      principal: k.principal,
      register: "checked",
      message:
        "holds put-authentication-key and may DELEGATE [" +
        dangerousBecomable.join(", ") +
        "], which it does not itself hold. " +
        "Because the creator of an authentication key chooses that key password, it can open a session with what it minted: " +
        "effective privilege here is capabilities UNION delegated. Keeping these out of capabilities while leaving them in " +
        "delegatedCapabilities renames the privilege; it does not reduce it.",
    });
  }
  out.push(...heldDangerousFindings(k, caps));
  out.push(...structuralFindings(k, caps, delegated));
  return out;
}

const TOP_SEVERITY: Names = ["reset-device", "export-wrapped", "put-authentication-key"];

/** (2) Dangerous capabilities held outright. */
function heldDangerousFindings(k: KeyDecl, caps: bigint): readonly Finding[] {
  const out: Finding[] = [];
  for (const c of capabilityNames(caps)) {
    const why = DANGEROUS.get(c);
    if (why === undefined) continue;
    out.push({
      rule: "dangerous-capability-held",
      severity: TOP_SEVERITY.includes(c) ? "high" : "medium",
      key: keyAt(k),
      principal: k.principal,
      register: "checked",
      message:
        "holds " +
        c +
        " - " +
        why +
        ". Yubico, User Guide section 1.4: sensitive capabilities like " +
        "reset-device and put-authentication-key should only be granted to specifically designated administrative keys.",
    });
  }
  return out;
}

/** (3) and (4): unbounded delegation, and the key-material egress frontier. */
function structuralFindings(k: KeyDecl, caps: bigint, delegated: bigint): readonly Finding[] {
  const out: Finding[] = [];
  if (has(caps, CAP_PUT_AUTHKEY) && has(delegated, CAP_PUT_AUTHKEY)) {
    out.push({
      rule: "self-perpetuating-delegation",
      severity: "medium",
      key: keyAt(k),
      principal: k.principal,
      register: "checked",
      message:
        "can mint authentication keys that can themselves mint authentication keys: put-authentication-key is in BOTH " +
        "capabilities and delegatedCapabilities. Privilege is then FLAT rather than decreasing, and revoking this key " +
        "does not revoke its descendants - which are not in this roster and cannot be.",
    });
  }
  if (has(caps, CAP_EXPORT_WRAPPED) || has(delegated, CAP_EXPORT_WRAPPED)) {
    out.push({
      rule: "key-material-egress-reachable",
      severity: "high",
      key: keyAt(k),
      principal: k.principal,
      register: "checked",
      message:
        "reaches export-wrapped (" +
        (has(caps, CAP_EXPORT_WRAPPED) ? "held" : "delegated") +
        "). " +
        "export-wrapped is the ONLY documented path by which private key material leaves a YubiHSM 2, so an operational " +
        "signing key that reaches it invalidates the key-material-never-leaves-the-device claim for its whole domain set.",
    });
  }
  return out;
}

/** (5) THE CLOSURE, per device model. */
function closureFindings(roster: Roster, k: KeyDecl, model: EscalationModel): readonly Finding[] {
  const own = domainMask(k.domains);
  const foreign = foreignDomainMask(roster, k.principal);
  const closure = delegationClosure(k, model);

  let reachedForeign = 0;
  let witness: Reach | undefined;
  for (const r of closure.frontier) {
    const cross = r.domains & foreign & ~own;
    if (cross === 0) continue;
    reachedForeign |= cross;
    if (witness === undefined || r.via.length <= witness.via.length - 1) witness = r;
  }
  if (reachedForeign === 0 || witness === undefined) return [];

  const caveat =
    model === "doc-silent-pessimistic"
      ? " REGISTER: the IMPORT WRAPPED Required Capabilities list states NO domain constraint (User Guide section 6.1.38); " +
        "this finding treats that silence as permission. It is NOT a demonstrated escalation. " +
        "Falsifier: attempt the import on a THROWAWAY device, never this one."
      : "";

  return [
    {
      rule: "domain-escalation-reachable",
      severity: "high",
      key: keyAt(k),
      principal: k.principal,
      model,
      register: model === "documented" ? "checked" : "doc-silent-unverified",
      message:
        "under the " +
        model +
        " device model, a chain of " +
        String(witness.via.length - 1) +
        " operation(s) reaches domain(s) " +
        domainList(reachedForeign).join(", ") +
        ", which belong to another principal. Chain: " +
        witness.via.join(" then ") +
        ". Closure saturated in " +
        String(closure.rounds) +
        " round(s)." +
        caveat,
    },
  ];
}

/** (6) Chain realisability - a declared parent that could not have produced this child. */
function chainFindings(roster: Roster, k: KeyDecl): readonly Finding[] {
  if (k.createdBy === undefined) return [];
  const parent = roster.keys.find((p) => p.objectId === k.createdBy);
  if (parent === undefined) return [];

  const out: Finding[] = [];
  const parentDelegated = capabilityMask(parent.delegatedCapabilities);
  const over = (capabilityMask(k.capabilities) | capabilityMask(k.delegatedCapabilities)) & ~parentDelegated;
  if (over !== 0n) {
    out.push({
      rule: "delegation-chain-unrealisable",
      severity: "medium",
      key: keyAt(k),
      principal: k.principal,
      register: "checked",
      message:
        "declares createdBy " +
        parent.label +
        ", but holds or delegates [" +
        capabilityNames(over).join(", ") +
        "] which is not in that parent delegated set. Per User Guide section 6.1.44 the device would REFUSE this " +
        "creation - so either the roster provenance is fiction, or this key was really made by a more privileged key " +
        "that is not in the roster. Both are worse than the roster reads.",
    });
  }
  const domOver = domainMask(k.domains) & ~domainMask(parent.domains);
  if (domOver !== 0) {
    out.push({
      rule: "delegation-chain-unrealisable",
      severity: "medium",
      key: keyAt(k),
      principal: k.principal,
      register: "checked",
      message:
        "declares createdBy " +
        parent.label +
        ", but sits in domain(s) " +
        domainList(domOver).join(", ") +
        " the parent does not hold. User Guide section 3.6: an object cannot be created with access to Domains that " +
        "the Authentication Key used to create it does not have access to.",
    });
  }
  return out;
}
