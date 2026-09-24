/**
 * schedulable-demand.ts — 081M397QHX8087G0R003DQSY0B (WP28).
 *
 * DECLARED demand is what the roster asks for. SCHEDULABLE demand is what the
 * CURRENTLY REGISTERED fleet could ever be asked for. They differ, and today
 * they differ by a lot.
 *
 * THE MEASUREMENT THAT PROMPTED THIS
 * ----------------------------------
 * `single-node-readiness.ts`'s `longhorn-geometry` check refuses an install
 * when the partitioned Longhorn pool is below the roster's 943 GiB of
 * `driver.longhorn.io` PVCs. Measured 2026-09-24, **400 GiB of that 943 — 47% —
 * belongs to two Applications that cannot schedule on any registered node:**
 *
 *   ollama   200 GiB   nodeSelector: zeta.io/gpu: nvidia   manual-sync only
 *   vllm     200 GiB   nodeSelector: zeta.io/gpu: nvidia   manual-sync only
 *
 * Every checked-in `ClusterNode` records an Intel display adapter. And
 * `local-storage.nix` binds every capability class `WaitForFirstConsumer`, so a
 * PVC with no schedulable consumer provisions nothing and reserves nothing.
 *
 * WHY THAT MATTERS BEYOND TIDINESS. A guard that refuses an install over demand
 * nobody can generate will eventually refuse a legitimate one, and the operator
 * will then set the override reflexively. That is how a fail-closed check
 * becomes a formality — and the check is only worth having while its number
 * means something.
 *
 * THREE VERDICTS, NOT TWO, AND THE THIRD IS THE HONEST ONE TODAY
 * -------------------------------------------------------------
 * The obvious design is satisfied/unsatisfiable. That would be wrong here, and
 * wrong in the ACQUITTING direction, which is the direction this file must
 * never be wrong in: excluding a claim makes the demand SMALLER and the guard
 * WEAKER, so an exclusion has to be PROVEN rather than inferred.
 *
 * It cannot be proven from today's registrations. `zeta-install.sh` captures
 * the GPU as
 *
 *     lspci -nn | grep -iE 'vga|3d|display' | head -1
 *
 * — ONE device. A box with integrated Intel graphics AND a discrete NVIDIA card
 * records the Intel one (it sits at 00:02.0 and sorts first) and the NVIDIA
 * card is simply absent from the record. So "the registration says Intel" does
 * NOT establish "this node has no NVIDIA GPU"; it establishes "the first
 * display device is Intel", which is a different and much weaker claim.
 *
 * Hence `undecidable`: the evidence is insufficient, said out loud, rather than
 * resolved into whichever answer is convenient. The capture is fixed going
 * forward (`gpus:` records EVERY display device), so a node re-registered after
 * that change becomes decidable while the old records honestly do not.
 *
 * WHAT THIS IS A PROPERTY OF
 * --------------------------
 * The CURRENTLY REGISTERED FLEET, and nothing more permanent. A node that joins
 * tomorrow with an NVIDIA card makes those 400 GiB schedulable, and no edit to
 * any manifest is involved. So the schedulable figure is a REPORT that moves
 * with the hardware roster; `declaredGib` is the number that keeps the exit
 * code, exactly as the bring-up subset is reported and never discounted.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { stringCompare } from "../collation/collation.ts";

/** The nix module that owns the vendor -> PCI-vendor-ID table AND the label key. */
export const GPU_NODE_LABEL_CHECKS_PATH = "full-ai-cluster/nixos/modules/gpu-node-label-checks.nix";

function readIfPresent(path: string): string | null {
  // One syscall, one answer — no existsSync/read pair (`lint-check-then-use-file-races`).
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

/**
 * `{ nvidia: "0x10de", amd: "0x1002", intel: "0x8086" }`, READ out of
 * `gpu-node-label-checks.nix`.
 *
 * Read and never restated, for the reason that file states about itself: "a
 * label advertised from one place and checked from another drifts, and a
 * drifted check passes." A second copy of this table here would be a third
 * place for it to drift from.
 *
 * `null` when the file or the table cannot be read — the caller must then
 * report every GPU selector UNDECIDABLE rather than substitute a table.
 */
export function pciVendorIds(repoRoot: string): ReadonlyMap<string, string> | null {
  const text = readIfPresent(join(repoRoot, GPU_NODE_LABEL_CHECKS_PATH));
  if (text === null) return null;
  const block = /pciVendorIds\s*=\s*\{([\s\S]*?)\}\s*;/.exec(text);
  if (block === null) return null;
  const out = new Map<string, string>();
  for (const line of (block[1] ?? "").split("\n")) {
    const row = /^\s*([A-Za-z][A-Za-z0-9_-]*)\s*=\s*"(0x[0-9a-fA-F]+)"\s*;/.exec(line);
    if (row !== null) out.set(row[1] ?? "", (row[2] ?? "").toLowerCase());
  }
  return out.size === 0 ? null : out;
}

/** The label key GPU nodes are selected on, read from the same file. `null` when unreadable. */
export function gpuLabelKey(repoRoot: string): string | null {
  const text = readIfPresent(join(repoRoot, GPU_NODE_LABEL_CHECKS_PATH));
  if (text === null) return null;
  const match = /labelKey\s*=\s*"([^"]+)"\s*;/.exec(text);
  return match === null ? null : (match[1] ?? null);
}

/**
 * The vendor an `lspci -nn` line names, by its PCI VENDOR ID rather than by its
 * marketing text.
 *
 * The bracketed `[8086:7d51]` is the machine-readable half of that line and is
 * what sysfs reports; the human half ("Intel Corporation Arrow Lake-P [Arc Pro
 * 140T]") is a product string that changes with every generation. Matching on
 * the text would be the numerology error — a name that happens to contain
 * "Intel" is not an identification.
 *
 * `null` when the line carries no parsable `[vvvv:dddd]` pair.
 */
export function vendorOfLspciLine(line: string, vendorIds: ReadonlyMap<string, string>): string | null {
  const match = /\[([0-9a-fA-F]{4}):[0-9a-fA-F]{4}\]/.exec(line);
  if (match === null) return null;
  const id = `0x${(match[1] ?? "").toLowerCase()}`;
  for (const [vendor, vendorId] of vendorIds) if (vendorId === id) return vendor;
  return null;
}

/** One registration's GPU evidence, and whether it can prove ABSENCE as well as presence. */
export interface GpuEvidence {
  readonly hostname: string;
  readonly path: string;
  /** Vendors this registration establishes are PRESENT. */
  readonly vendors: readonly string[];
  /**
   * `true` only when the registration enumerates EVERY display device
   * (`spec.hardware.gpus`). A single `spec.hardware.gpu` is `lspci … | head -1`
   * and cannot establish that a second card is absent.
   */
  readonly enumeratesAll: boolean;
}

export interface RegistrationHardware {
  readonly hostname: string;
  readonly path: string;
  /** `spec.hardware.gpu` — the legacy single line. */
  readonly gpu: string | null;
  /** `spec.hardware.gpus` — every display device, written by the fixed capture. */
  readonly gpus: readonly string[] | null;
}

export function gpuEvidenceOf(
  registration: RegistrationHardware,
  vendorIds: ReadonlyMap<string, string>,
): GpuEvidence {
  const lines = registration.gpus ?? (registration.gpu === null ? [] : [registration.gpu]);
  const vendors = [
    ...new Set(lines.map((line) => vendorOfLspciLine(line, vendorIds)).filter((v): v is string => v !== null)),
  ].sort((a, b) => stringCompare(a, b));
  return {
    hostname: registration.hostname,
    path: registration.path,
    vendors,
    enumeratesAll: registration.gpus !== null,
  };
}

/** Why a selector could not be decided, or how it was. */
export type SelectorVerdict =
  | { readonly kind: "satisfied"; readonly by: readonly string[] }
  | { readonly kind: "unsatisfiable"; readonly why: string }
  | { readonly kind: "undecidable"; readonly why: string };

/**
 * Can any registered node carry `<key>=<value>`?
 *
 * Only `zeta.io/gpu` is decidable from a registration today, because it is the
 * only selector key whose value a registration carries evidence about. Every
 * other key is `undecidable` — NOT `satisfied`. A selector this cannot reason
 * about must never silently reduce the demand.
 */
export function classifySelector(
  key: string,
  value: string,
  evidence: readonly GpuEvidence[],
  labelKey: string | null,
): SelectorVerdict {
  if (labelKey === null) {
    return { kind: "undecidable", why: `${GPU_NODE_LABEL_CHECKS_PATH} could not be read, so no label key is known` };
  }
  if (key !== labelKey) {
    return {
      kind: "undecidable",
      why: `no ClusterNode registration carries evidence about the label "${key}"; only "${labelKey}" is derivable from spec.hardware`,
    };
  }
  if (evidence.length === 0) {
    return { kind: "undecidable", why: "no ClusterNode registration records a display device at all" };
  }
  const satisfiedBy = evidence.filter((node) => node.vendors.includes(value)).map((node) => node.hostname);
  if (satisfiedBy.length > 0) {
    return { kind: "satisfied", by: satisfiedBy.sort((a, b) => stringCompare(a, b)) };
  }
  // Nothing matched. That is only PROOF of unsatisfiability if every
  // registration enumerated all of its devices. Otherwise the card could be
  // there and simply unrecorded — and guessing here would shrink the demand on
  // no evidence, which is the one direction this file must not be wrong in.
  const partial = evidence.filter((node) => !node.enumeratesAll);
  if (partial.length > 0) {
    return {
      kind: "undecidable",
      why:
        `no registration names vendor "${value}", but ${String(partial.length)} of ${String(evidence.length)} ` +
        `record only spec.hardware.gpu (\`lspci … | head -1\`, ONE device), which cannot establish that a ` +
        `second card is absent: ${partial.map((node) => node.hostname).sort((a, b) => stringCompare(a, b)).join(", ")}`,
    };
  }
  return {
    kind: "unsatisfiable",
    why: `every registration enumerates all display devices (spec.hardware.gpus) and none names vendor "${value}"`,
  };
}

/** A claim, with the selector its owning workload carries. */
export interface SelectedClaim {
  readonly app: string;
  readonly path: string;
  readonly storageClass: string;
  readonly gib: number;
  /** `[key, value]` pairs from the nearest enclosing `nodeSelector`. Empty means unselected. */
  readonly selector: readonly (readonly [string, string])[];
}

export interface DemandRow {
  readonly app: string;
  readonly gib: number;
  readonly selector: string;
  readonly verdict: SelectorVerdict;
}

export interface SchedulableDemand {
  /** Everything the roster declares. Keeps the exit code. */
  readonly declaredGib: number;
  /** Claims PROVEN to have no possible node. */
  readonly unschedulableGib: number;
  /** Claims whose selector could not be decided from the registrations. */
  readonly undecidableGib: number;
  /** `declared − unschedulable − undecidable`. The most this fleet could be asked for if every undecidable turns out unschedulable. */
  readonly lowerBoundGib: number;
  /** `declared − unschedulable`. The least this fleet could be asked for. */
  readonly upperBoundGib: number;
  /** True when NOTHING is undecidable, i.e. the bounds have collapsed to one number. */
  readonly exact: boolean;
  readonly rows: readonly DemandRow[];
}

/**
 * Split declared demand into schedulable, unschedulable and undecidable.
 *
 * `lowerBoundGib === upperBoundGib` exactly when `exact` is true. Until then the
 * honest answer is a RANGE, and a caller that wants one number must say which
 * end it is using and why.
 */
export function splitDemand(
  claims: readonly SelectedClaim[],
  evidence: readonly GpuEvidence[],
  labelKey: string | null,
  declaredTotalGib: number | null = null,
): SchedulableDemand {
  const rows: DemandRow[] = [];
  let declaredGib = 0;
  let unschedulableGib = 0;
  let undecidableGib = 0;

  for (const claim of claims) {
    declaredGib += claim.gib;
    if (claim.selector.length === 0) continue;
    // A workload with several selector terms needs EVERY one satisfied, so the
    // claim is unschedulable if ANY term is, and undecidable if any term is
    // undecidable and none is outright unsatisfiable.
    const verdicts = claim.selector.map(([key, value]) => classifySelector(key, value, evidence, labelKey));
    const unsatisfiable = verdicts.find((verdict) => verdict.kind === "unsatisfiable");
    const undecidable = verdicts.find((verdict) => verdict.kind === "undecidable");
    const verdict = unsatisfiable ?? undecidable;
    if (verdict === undefined) continue;
    if (verdict.kind === "unsatisfiable") unschedulableGib += claim.gib;
    else undecidableGib += claim.gib;
    rows.push({
      app: claim.app,
      gib: claim.gib,
      selector: claim.selector.map(([key, value]) => `${key}=${value}`).join(","),
      verdict,
    });
  }

  // The DECLARED total is the GATE's, when the caller has one.
  //
  // The claims walked above are the YAML-derived ones, because they are the
  // only ones carrying a nodeSelector — the render snapshot records sizes and
  // not scheduling. But the comparator convicts against the per-class
  // `max(rendered, derived)` total, which is LARGER (943 vs 879 on 2026-09-24).
  // Reporting the derived total here would put two different "declared" numbers
  // in one report, and the smaller one next to an exclusion is exactly the
  // shape that makes a guard look weaker than it is.
  //
  // So the exclusions are measured on the derived claims and subtracted from
  // the GATE's total. The two agree on the apps that matter (ollama and vllm
  // render at 200 GiB each, the same as they declare), and where they would not
  // the subtraction is conservative: a larger declared total with the same
  // exclusion yields a larger schedulable figure, never a smaller one.
  const declaredTotal = declaredTotalGib ?? declaredGib;
  return {
    declaredGib: declaredTotal,
    unschedulableGib,
    undecidableGib,
    lowerBoundGib: declaredTotal - unschedulableGib - undecidableGib,
    upperBoundGib: declaredTotal - unschedulableGib,
    exact: undecidableGib === 0,
    rows: rows.sort((a, b) => b.gib - a.gib || stringCompare(a.app, b.app)),
  };
}
