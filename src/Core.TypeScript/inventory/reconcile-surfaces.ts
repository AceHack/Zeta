#!/usr/bin/env bun
// reconcile-surfaces.ts — hardware-inventory cross-surface reconciliation DRIFT CHECK
// (081M00R59KS087G0R001W3837V).
//
// WHAT THIS IS NOT: it does not merge the surfaces. They are not copies of one
// list — they are different PROVENANCE CLASSES with different change rates
// (DV2.0 #5), and merging a probe result into a declaration would destroy the
// one property that makes each of them worth reading:
//
//   register     inventory/items/*.md                    identity of record; ZetaId-keyed,
//                                                        git-as-database. Slow (hub).
//   read-model   inventory/items.json                    DERIVED from the register by
//                                                        generate-items-json.ts. The only
//                                                        surface a reader actually SEES (the
//                                                        Pages viewer fetches it). Not a
//                                                        provenance class — a projection.
//   snapshot     docs/inventory/hardware-*-draft.md      a human audit at a point in time.
//                                                        Immutable; superseded wholesale.
//   declaration  docs/inventory/fleet-*.md               what the operator SAYS is deployed.
//                                                        Consent-only; never scanned.
//   wishlist     docs/inventory/hardware-to-buy.md       hardware NOT owned. Buy-side.
//   probe        maintainers/*/cluster-nodes/*/node.yaml what a machine SAID ABOUT ITSELF
//                                                        at registration. Fast (per boot).
//   hostkey      machines/*.pub                          SSH host-cert machine identity.
//   capability   docs/HARDWARE-CAPABILITY-MATRIX.md      keyed by TARGET CLASS (linux-x64,
//                                                        qemu-aarch64), NOT by asset. Not an
//                                                        inventory surface at all.
//
// A snapshot that disagrees with a probe is not necessarily an error — the audit
// is from May and the machine rebooted in June. What IS an error is a surface
// that cannot be reconciled because nothing declares what it is, or a reference
// that points at nothing, or one physical thing counted twice.
//
// Doctrine: drift detection over prevention (gate.yml — "blocking gates are
// corporate mode; drift checks are sovereign mode"). This check reports and goes
// red; it does not block, and it does not rewrite anyone's data.
//
// Known divergences we deliberately hold open live in inventory/reconciliation-open.json.
// That ledger is anti-rot by construction: an entry whose finding NO LONGER
// REPRODUCES is itself a failure, so a suppression cannot outlive its cause.

import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { join, normalize } from "node:path";
import { ITEMS_JSON_REL, readCommittedItemsJson, renderItemsJson } from "./generate-items-json";

const REPO_ROOT = normalize(join(__dirname, "..", "..", ".."));

export const CHECKS = {
  "HWR-1": "register assigned_machine resolves to a known machine identity",
  "HWR-2": "one physical NIC == one probe registration (no duplicate MAC)",
  "HWR-3": "every hardware-surface doc declares its provenance class",
  "HWR-4": "a snapshot's header (counts + body-sha256) still describes its body",
  "HWR-5": "register coverage of the audited unit count",
  "HWR-6": "a declaration's probe-nodes count matches the probe surface",
  "HWR-7": "the published read-model is what the generator derives from the register",
} as const;

export type CheckId = keyof typeof CHECKS;

export interface Finding {
  /** Which invariant. */
  check: CheckId;
  /** Stable identity of THIS finding — the suppression key. Never volatile. */
  key: string;
  /** Human-readable detail; may carry volatile numbers (never part of the key). */
  detail: string;
}

export interface OpenEntry {
  check: string;
  key: string;
  workitem: string;
  why: string;
}

/** The docs that must declare a provenance class. Adding a file here without a
 *  header fails HWR-3 — that is the anti-re-fork guard: a fourth hand-maintained
 *  hardware list cannot appear in these paths without saying what it is. */
export const SURFACE_DOC_GLOBS: readonly string[] = ["docs/inventory/", "docs/HARDWARE-CAPABILITY-MATRIX.md"];

export const HEADER_RE = /<!--\s*hardware-surface:\s*([^>]*?)\s*-->/;

/** Parse `<!-- hardware-surface: class=snapshot; units=206; lines=188 -->`. */
export function parseSurfaceHeader(text: string): Map<string, string> | undefined {
  const m = text.match(HEADER_RE);
  if (!m) return undefined;
  const out = new Map<string, string>();
  for (const part of m[1]!.split(";")) {
    const kv = part.split("=");
    if (kv.length === 2) out.set(kv[0]!.trim(), kv[1]!.trim());
  }
  return out;
}

/**
 * Count asset bullets in an audit snapshot.
 *
 * The snapshot's convention is `- Name` per physical thing, with an explicit
 * `× N` SUFFIX when one line stands for N units. The quantity regex is anchored
 * to end-of-line on purpose: `Minisforum MS-A1 Pro (with 4× 20TB IronWolf HDDs)`
 * is ONE unit whose notes mention drives, and an unanchored `×\s*(\d+)` reads it
 * as 20. That single line is the difference between 206 units and 225 — which is
 * exactly the class of error this whole check exists to catch, so it is pinned by
 * a test rather than left to the reader.
 *
 * `## Provenance` is metadata, not assets, and is excluded — which leaves a hole
 * the counts alone cannot close, and it was found by mutating the real file:
 * `## Provenance` is the LAST section, so a bullet appended at end-of-file lands
 * inside it and moves neither count. `snapshotDigest` below closes that hole; the
 * counts stay because a human reads them and a digest tells a human nothing.
 */
export function countSnapshot(text: string): { lines: number; units: number } {
  let lines = 0;
  let units = 0;
  let section = "";
  for (const raw of text.split("\n")) {
    if (raw.startsWith("## ")) {
      section = raw;
      continue;
    }
    if (!raw.startsWith("- ")) continue;
    if (section.includes("Provenance")) continue;
    lines += 1;
    const q = raw.match(/×\s*(\d+)\s*$/);
    units += q ? Number.parseInt(q[1]!, 10) : 1;
  }
  return { lines, units };
}

/**
 * SHA-256 over the snapshot body with its own `hardware-surface` header line
 * removed (otherwise the digest would have to contain itself).
 *
 * A superseded audit snapshot is an IMMUTABLE satellite: it records what someone
 * counted on a given day, and the correct way to change it is a new snapshot, not
 * an edit. So it is byte-pinned, and the pin is hex-in-text — diffable, mergeable,
 * reviewable in a `git diff` (no-binary-in-proof-lineage).
 */
export function snapshotDigest(text: string): string {
  const body = text.replace(HEADER_RE, "");
  return new Bun.CryptoHasher("sha256").update(body, "utf8").digest("hex");
}

export interface ProbeNode {
  file: string;
  hostname: string;
  mac: string;
}

/** Read `spec.hostname` and `hardware.network.mac` out of a ClusterNode manifest.
 *  Deliberately a narrow field read, not a YAML parse: the two fields we need are
 *  quoted scalars at a fixed depth, and pulling in a parser to read them would add
 *  a dependency to a drift check that must be able to run anywhere. */
export function parseProbeNode(relFile: string, text: string): ProbeNode {
  const host = text.match(/^ {2}hostname:[ \t]*"?([^"\n]+?)"?[ \t]*$/m);
  const mac = text.match(/^[ \t]+mac:[ \t]*"?([^"\n]*?)"?[ \t]*$/m);
  return {
    file: relFile,
    hostname: host ? host[1]!.trim() : "",
    mac: mac ? mac[1]!.trim().toLowerCase() : "",
  };
}

export interface Surfaces {
  registerRows: number;
  registerRealRows: number;
  registerAssignedMachines: { id: string; machine: string }[];
  snapshots: {
    file: string;
    declared: Map<string, string>;
    counted: { lines: number; units: number };
    digest: string;
  }[];
  declarations: { file: string; declared: Map<string, string> }[];
  undeclaredDocs: string[];
  probes: ProbeNode[];
  hostkeys: string[];
  /** The DERIVED surface. `derived` is what the generator emits from the register
   *  right now; `committed` is what is actually published. They are compared, never
   *  merged — and both are produced by the generator's own single derivation, so
   *  this check cannot drift from the tool that fixes it. */
  readModel: { file: string; committed: string; derived: string; errors: string[] };
}

function listMarkdown(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function collect(root: string = REPO_ROOT): Surfaces {
  // ── register (identity of record) ───────────────────────────────────────────
  const itemsDir = join(root, "inventory", "items");
  let registerRows = 0;
  let registerRealRows = 0;
  const registerAssignedMachines: { id: string; machine: string }[] = [];
  for (const f of listMarkdown(itemsDir)) {
    const text = readFileSync(join(itemsDir, f), "utf8");
    registerRows += 1;
    // `sample: true` rows are placeholders proving the file shape — the register's
    // own README says so. Counting them as assets is how "we have an audited asset
    // register" ends up meaning zero.
    if (!/^sample:[ \t]*true[ \t]*$/m.test(text)) registerRealRows += 1;
    const id = text.match(/^id:[ \t]*(\S+)[ \t]*$/m);
    const am = text.match(/^assigned_machine:[ \t]*"?([^"\n]*?)"?[ \t]*$/m);
    if (am && am[1]!.trim().length > 0) {
      registerAssignedMachines.push({ id: id ? id[1]! : f, machine: am[1]!.trim() });
    }
  }

  // ── surface docs (snapshot / declaration / wishlist / capability) ────────────
  const snapshots: Surfaces["snapshots"] = [];
  const declarations: Surfaces["declarations"] = [];
  const undeclaredDocs: string[] = [];
  const docFiles: string[] = [];
  for (const g of SURFACE_DOC_GLOBS) {
    if (g.endsWith("/")) {
      for (const f of listMarkdown(join(root, g))) docFiles.push(g + f);
    } else if (existsSync(join(root, g))) {
      docFiles.push(g);
    }
  }
  for (const rel of docFiles.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    const text = readFileSync(join(root, rel), "utf8");
    const declared = parseSurfaceHeader(text);
    if (!declared || !declared.has("class")) {
      undeclaredDocs.push(rel);
      continue;
    }
    const cls = declared.get("class")!;
    if (cls === "snapshot")
      snapshots.push({ file: rel, declared, counted: countSnapshot(text), digest: snapshotDigest(text) });
    if (cls === "declaration") declarations.push({ file: rel, declared });
  }

  // ── probe (machine self-report) ─────────────────────────────────────────────
  const probes: ProbeNode[] = [];
  const maintDir = join(root, "maintainers");
  if (existsSync(maintDir)) {
    for (const m of readdirSync(maintDir).sort()) {
      const cn = join(maintDir, m, "cluster-nodes");
      if (!existsSync(cn)) continue;
      for (const n of readdirSync(cn).sort()) {
        const y = join(cn, n, "node.yaml");
        if (!existsSync(y)) continue;
        probes.push(parseProbeNode(`maintainers/${m}/cluster-nodes/${n}/node.yaml`, readFileSync(y, "utf8")));
      }
    }
  }

  // ── hostkey (SSH host-cert machine identity) ────────────────────────────────
  const machinesDir = join(root, "machines");
  const hostkeys = existsSync(machinesDir)
    ? [
        ...new Set(
          readdirSync(machinesDir)
            .filter((f) => f.endsWith(".pub"))
            .map((f) => f.replace(/(-cert)?\.pub$/, "")),
        ),
      ].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    : [];

  // ── read-model (derived from the register) ──────────────────────────────────
  const rendered = renderItemsJson(root);

  return {
    registerRows,
    registerRealRows,
    registerAssignedMachines,
    snapshots,
    declarations,
    undeclaredDocs,
    probes,
    hostkeys,
    readModel: {
      file: ITEMS_JSON_REL,
      committed: readCommittedItemsJson(root),
      derived: rendered.json,
      errors: rendered.errors,
    },
  };
}

export function reconcile(s: Surfaces): Finding[] {
  const findings: Finding[] = [];

  // HWR-3 — a hardware-surface doc that does not say what it is.
  for (const f of s.undeclaredDocs) {
    findings.push({
      check: "HWR-3",
      key: f,
      detail: `${f} carries no <!-- hardware-surface: class=... --> header; its provenance class is unknown, so nothing can reconcile it`,
    });
  }

  // HWR-1 — a register row pointing at a machine no surface knows.
  const knownMachines = new Set<string>([...s.hostkeys, ...s.probes.map((p) => p.hostname)]);
  for (const { id, machine } of s.registerAssignedMachines) {
    if (!knownMachines.has(machine)) {
      findings.push({
        check: "HWR-1",
        key: `${id}:${machine}`,
        detail: `register item ${id} is assigned to machine '${machine}', which is neither a machines/ host key nor a self-registered cluster node`,
      });
    }
  }

  // HWR-2 — two probe registrations sharing one NIC. Either one machine
  // registered twice (the fleet count is inflated) or a manifest was copied
  // (the hardware block is fiction). Both are the same red.
  const byMac = new Map<string, string[]>();
  for (const p of s.probes) {
    if (p.mac.length === 0) continue;
    const cur = byMac.get(p.mac) ?? [];
    cur.push(p.file);
    byMac.set(p.mac, cur);
  }
  for (const [mac, files] of [...byMac.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
    if (files.length > 1) {
      findings.push({
        check: "HWR-2",
        key: mac,
        detail: `MAC ${mac} appears in ${files.length} node registrations: ${files.join(", ")}`,
      });
    }
  }

  // HWR-4 — a snapshot whose header no longer describes its own body. The counts
  // are for humans; the digest is what actually makes the pin total (a bullet
  // appended after the last `## ` heading moves neither count).
  for (const snap of s.snapshots) {
    const dl = Number.parseInt(snap.declared.get("lines") ?? "-1", 10);
    const du = Number.parseInt(snap.declared.get("units") ?? "-1", 10);
    const dd = snap.declared.get("body-sha256") ?? "";
    if (dl !== snap.counted.lines || du !== snap.counted.units) {
      findings.push({
        check: "HWR-4",
        key: snap.file,
        detail: `${snap.file} header declares lines=${dl} units=${du}; parsed lines=${snap.counted.lines} units=${snap.counted.units}`,
      });
    } else if (dd !== snap.digest) {
      findings.push({
        check: "HWR-4",
        key: snap.file,
        detail: `${snap.file} body changed without a count change — header body-sha256=${dd || "(absent)"}, actual ${snap.digest}. A superseded audit snapshot is immutable: publish a new snapshot rather than editing this one, or re-pin with --repin if the edit is editorial`,
      });
    }
  }

  // HWR-6 — a declaration that has gone stale against the probe surface.
  for (const d of s.declarations) {
    const declaredNodes = Number.parseInt(d.declared.get("probe-nodes") ?? "-1", 10);
    if (declaredNodes !== s.probes.length) {
      findings.push({
        check: "HWR-6",
        key: d.file,
        detail: `${d.file} accounts for probe-nodes=${declaredNodes}; the probe surface carries ${s.probes.length} node registrations`,
      });
    }
  }

  // HWR-7 — the published read-model no longer equals what the register derives.
  //
  // This is the one divergence on this whole map that is NOT a difference of
  // provenance: `items.json` is not another party's account of the hardware, it is
  // a PROJECTION of the register, so any difference is pure staleness and the
  // repair is mechanical (re-run the generator). It is also the surface that is
  // actually READ — the Pages viewer fetches items.json and never opens an item
  // file — so a stale projection is the one drift a human is guaranteed to see and
  // guaranteed not to notice.
  //
  // Measured before this check existed: editing an item's `value_usd` in the
  // register left the reconciler green and all 23 inventory unit tests passing,
  // because the reconciler counted the register from the .md files and nothing in
  // any workflow ran the generator's own `--check`. The published price stayed
  // wrong and every check said the inventory reconciled.
  if (s.readModel.errors.length > 0) {
    for (const e of s.readModel.errors) {
      findings.push({
        check: "HWR-7",
        key: `invalid:${e.split(":")[0]}`,
        detail: `register row rejected by the generator, so the read-model cannot be derived: ${e}`,
      });
    }
  } else if (s.readModel.committed !== s.readModel.derived) {
    findings.push({
      check: "HWR-7",
      key: s.readModel.file,
      detail:
        s.readModel.committed.length === 0
          ? `${s.readModel.file} is absent, but the register derives one — run: bun src/Core.TypeScript/inventory/generate-items-json.ts`
          : `${s.readModel.file} is not what the register derives (${s.readModel.committed.length} bytes committed, ${s.readModel.derived.length} derived) — it is a projection of inventory/items/, so re-run: bun src/Core.TypeScript/inventory/generate-items-json.ts`,
    });
  }

  // HWR-5 — the coverage gap. Reported as a single finding with a stable key so
  // the magnitude can move (Addison's re-audit will change it) without the
  // suppression silently re-arming.
  const auditedUnits = s.snapshots.reduce((n, x) => n + x.counted.units, 0);
  if (s.registerRealRows < auditedUnits) {
    findings.push({
      check: "HWR-5",
      key: "register-coverage",
      detail: `register holds ${s.registerRealRows} non-sample rows (${s.registerRows} total incl. samples) against ${auditedUnits} units audited in snapshots`,
    });
  }

  return findings.sort((a, b) =>
    a.check === b.check ? (a.key < b.key ? -1 : a.key > b.key ? 1 : 0) : a.check < b.check ? -1 : 1,
  );
}

export function loadOpen(root: string = REPO_ROOT): OpenEntry[] {
  const p = join(root, "inventory", "reconciliation-open.json");
  if (!existsSync(p)) return [];
  const parsed = JSON.parse(readFileSync(p, "utf8")) as { open?: OpenEntry[] };
  return parsed.open ?? [];
}

export interface Triage {
  unaccounted: Finding[];
  accounted: Finding[];
  /** Ledger entries whose finding no longer reproduces — a suppression that
   *  outlived its cause. This is a FAILURE: it is how a stale exception quietly
   *  becomes permanent, and it is the same shape as a check that cannot fail. */
  stale: OpenEntry[];
}

export function triage(findings: Finding[], open: OpenEntry[]): Triage {
  const key = (c: string, k: string): string => `${c}\u0000${k}`;
  const openKeys = new Set(open.map((o) => key(o.check, o.key)));
  const foundKeys = new Set(findings.map((f) => key(f.check, f.key)));
  return {
    unaccounted: findings.filter((f) => !openKeys.has(key(f.check, f.key))),
    accounted: findings.filter((f) => openKeys.has(key(f.check, f.key))),
    stale: open.filter((o) => !foundKeys.has(key(o.check, o.key))),
  };
}

/** Rewrite every snapshot header's counts + digest from its current body.
 *  The supported path for an EDITORIAL change to a snapshot (a typo, a link fix).
 *  Deliberately explicit and deliberately noisy in a diff: re-pinning is how a
 *  data change could be laundered as an editorial one, so the reviewer sees it. */
function repin(root: string = REPO_ROOT): number {
  let n = 0;
  for (const snap of collect(root).snapshots) {
    const path = join(root, snap.file);
    const text = readFileSync(path, "utf8");
    const counted = countSnapshot(text);
    const digest = snapshotDigest(text);
    const kept = [...snap.declared.entries()].filter(([k]) => k !== "units" && k !== "lines" && k !== "body-sha256");
    const header = `<!-- hardware-surface: class=${snap.declared.get("class")}; units=${counted.units}; lines=${counted.lines}; body-sha256=${digest}${kept
      .filter(([k]) => k !== "class")
      .map(([k, v]) => `; ${k}=${v}`)
      .join("")} -->`;
    writeFileSync(path, text.replace(HEADER_RE, header), "utf8");
    console.log(`re-pinned ${snap.file} — units=${counted.units} lines=${counted.lines} body-sha256=${digest}`);
    n += 1;
  }
  return n === 0 ? 1 : 0;
}

function main(): number {
  if (Bun.argv.includes("--repin")) return repin();
  const s = collect();
  const findings = reconcile(s);
  const t = triage(findings, loadOpen());

  const auditedUnits = s.snapshots.reduce((n, x) => n + x.counted.units, 0);
  console.log("hardware inventory — cross-surface reconciliation (081M00R59KS087G0R001W3837V)");
  console.log("");
  console.log("  surface          class          count");
  console.log(
    `  inventory/items/ register       ${s.registerRealRows} real (${s.registerRows} incl. sample placeholders)`,
  );
  console.log(
    `  inventory/items.json read-model ${s.readModel.committed === s.readModel.derived ? "in step with the register" : "STALE against the register"}`,
  );
  console.log(`  docs/inventory/  snapshot       ${auditedUnits} units across ${s.snapshots.length} audit snapshot(s)`);
  console.log(`  docs/inventory/  declaration    ${s.declarations.length} operator declaration(s)`);
  console.log(
    `  maintainers/     probe          ${s.probes.length} node registrations, ${new Set(s.probes.map((p) => p.mac)).size} distinct MAC(s)`,
  );
  console.log(`  machines/        hostkey        ${s.hostkeys.length} host-key machine identit(ies)`);
  const overlap = s.hostkeys.filter((h) => s.probes.some((p) => p.hostname === h)).length;
  console.log(`  hostkey ∩ probe                 ${overlap} (the two machine-identity surfaces name disjoint sets)`);
  console.log("");

  for (const f of t.accounted) {
    console.log(`  open  ${f.check} ${f.detail}`);
  }
  for (const f of t.unaccounted) {
    console.error(`✗ ${f.check} ${f.detail}`);
  }
  for (const o of t.stale) {
    console.error(
      `✗ stale suppression: inventory/reconciliation-open.json holds ${o.check} '${o.key}', which no longer reproduces — remove the entry`,
    );
  }

  if (t.unaccounted.length > 0 || t.stale.length > 0) {
    console.error("");
    console.error(
      `✗ ${t.unaccounted.length} unaccounted divergence(s), ${t.stale.length} stale suppression(s). Fix the surface, or record the divergence in inventory/reconciliation-open.json with a work-item.`,
    );
    return 1;
  }
  console.log(`✓ no unaccounted divergence (${t.accounted.length} known-open, ledgered)`);
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
