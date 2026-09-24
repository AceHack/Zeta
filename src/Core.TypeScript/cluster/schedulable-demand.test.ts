/**
 * schedulable-demand.test.ts — 081M397QHX8087G0R003DQSY0B (WP28).
 *
 * The falsifiers for the declared/schedulable split. Every case here fails
 * against the pre-fix tree, where none of this existed and the capacity gate
 * convicted against 943 GiB — 400 of which belongs to two Applications no
 * registered node can run.
 *
 * The property most of these defend is ONE-WAY: an exclusion shrinks the demand
 * a gate convicts on, so it must be PROVEN. Anything short of proof lands in
 * `undecidable`, which keeps the capacity in the declared total.
 */

import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseAllDocuments } from "yaml";

import { spawnShellDeclared } from "../io/safe-io.ts";

import {
  classifySelector,
  gpuEvidenceOf,
  gpuLabelKey,
  pciVendorIds,
  splitDemand,
  vendorOfLspciLine,
  type GpuEvidence,
  type SelectedClaim,
} from "./schedulable-demand.ts";
import { longhornSchedulableDemand } from "./single-node-readiness.ts";

const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const VENDOR_IDS = pciVendorIds(REPO_ROOT);
const NVIDIA = "01:00.0 VGA compatible controller [0300]: NVIDIA Corporation GA102 [GeForce RTX 3090] [10de:2204] (rev a1)";
const INTEL = "00:02.0 VGA compatible controller [0300]: Intel Corporation Arrow Lake-P [Arc Pro 140T] [8086:7d51] (rev 03)";

function evidence(over: Partial<GpuEvidence> = {}): GpuEvidence {
  return { hostname: "n", path: "m/n.yaml", vendors: [], enumeratesAll: false, ...over };
}

describe("the vendor table is READ from gpu-node-label-checks.nix, never restated", () => {
  test("it carries the three vendors that file declares", () => {
    expect(VENDOR_IDS).not.toBeNull();
    expect(VENDOR_IDS?.get("nvidia")).toBe("0x10de");
    expect(VENDOR_IDS?.get("amd")).toBe("0x1002");
    expect(VENDOR_IDS?.get("intel")).toBe("0x8086");
  });

  test("the label key comes from the same file as the table", () => {
    // That file's own header: "a label advertised from one place and checked
    // from another drifts, and a drifted check passes."
    expect(gpuLabelKey(REPO_ROOT)).toBe("zeta.io/gpu");
  });

  test("an unreadable file yields null, so every GPU selector becomes UNDECIDABLE", () => {
    expect(pciVendorIds(join(REPO_ROOT, "does-not-exist"))).toBeNull();
    expect(gpuLabelKey(join(REPO_ROOT, "does-not-exist"))).toBeNull();
    expect(classifySelector("zeta.io/gpu", "nvidia", [], null).kind).toBe("undecidable");
  });
});

describe("vendorOfLspciLine identifies by PCI ID, not by marketing text", () => {
  test("it reads the bracketed vendor id", () => {
    expect(vendorOfLspciLine(NVIDIA, VENDOR_IDS ?? new Map())).toBe("nvidia");
    expect(vendorOfLspciLine(INTEL, VENDOR_IDS ?? new Map())).toBe("intel");
  });

  test("the TEXT does not decide it — a name containing a vendor is not an identification", () => {
    // The numerology error in its smallest form: product strings change every
    // generation and vendors appear in each other's names ("Intel Arc",
    // "NVIDIA ... Corporation"). The id is the machine-readable half and is what
    // sysfs reports, which is why the nix probe compares against it too.
    const mislabelled = "01:00.0 VGA compatible controller [0300]: Intel-branded board by NVIDIA [10de:2204]";
    expect(vendorOfLspciLine(mislabelled, VENDOR_IDS ?? new Map())).toBe("nvidia");
  });

  test("a line with no parsable id is null, never a guess", () => {
    expect(vendorOfLspciLine("some display adapter", VENDOR_IDS ?? new Map())).toBeNull();
    expect(vendorOfLspciLine("", VENDOR_IDS ?? new Map())).toBeNull();
  });
});

describe("gpuEvidenceOf — presence is recorded, ABSENCE needs an enumeration", () => {
  test("the legacy single `gpu` line can establish presence but not absence", () => {
    const seen = gpuEvidenceOf(
      { hostname: "n", path: "p", gpu: INTEL, gpus: null },
      VENDOR_IDS ?? new Map(),
    );
    expect(seen.vendors).toEqual(["intel"]);
    expect(seen.enumeratesAll).toBe(false);
  });

  test("`gpus` marks the record as a complete enumeration", () => {
    const seen = gpuEvidenceOf(
      { hostname: "n", path: "p", gpu: INTEL, gpus: [INTEL, NVIDIA] },
      VENDOR_IDS ?? new Map(),
    );
    expect(seen.vendors).toEqual(["intel", "nvidia"]);
    expect(seen.enumeratesAll).toBe(true);
  });

  test("an empty `gpus` list still enumerates — it says there are NO display devices", () => {
    // Distinct from absent. `[]` is a measurement; missing is a gap.
    const seen = gpuEvidenceOf({ hostname: "n", path: "p", gpu: null, gpus: [] }, VENDOR_IDS ?? new Map());
    expect(seen.vendors).toEqual([]);
    expect(seen.enumeratesAll).toBe(true);
  });
});

describe("classifySelector — the exclusion must be PROVEN", () => {
  const key = "zeta.io/gpu";

  test("SATISFIED when a registration names the vendor", () => {
    const verdict = classifySelector(key, "nvidia", [evidence({ vendors: ["nvidia"] })], key);
    expect(verdict.kind).toBe("satisfied");
  });

  test("UNDECIDABLE when no record matches but the records are `head -1`", () => {
    // THE case on the committed fleet. "The registration says Intel" is not
    // "this node has no NVIDIA card" — it is "the first display device is
    // Intel", which is a different and much weaker claim.
    const verdict = classifySelector(key, "nvidia", [evidence({ vendors: ["intel"] })], key);
    expect(verdict.kind).toBe("undecidable");
  });

  test("UNSATISFIABLE only when EVERY record is a complete enumeration", () => {
    const verdict = classifySelector(
      key,
      "nvidia",
      [evidence({ vendors: ["intel"], enumeratesAll: true }), evidence({ vendors: ["amd"], enumeratesAll: true })],
      key,
    );
    expect(verdict.kind).toBe("unsatisfiable");
  });

  test("ONE partial record is enough to keep the whole verdict undecidable", () => {
    // The falsifier for the tempting `some()`/`every()` mix-up. A single
    // unenumerated node could be hiding the card, so the fleet as a whole
    // cannot prove absence.
    const verdict = classifySelector(
      key,
      "nvidia",
      [evidence({ vendors: ["intel"], enumeratesAll: true }), evidence({ hostname: "old", vendors: ["intel"] })],
      key,
    );
    expect(verdict.kind).toBe("undecidable");
    expect(verdict.kind === "undecidable" ? verdict.why : "").toContain("old");
  });

  test("a label this cannot reason about is UNDECIDABLE, never satisfied", () => {
    // The dangerous default. Treating an unknown key as satisfiable would let
    // any selector silently remove capacity.
    const verdict = classifySelector("zeta.io/rack", "b12", [evidence({ vendors: ["nvidia"] })], key);
    expect(verdict.kind).toBe("undecidable");
  });

  test("no registrations at all is UNDECIDABLE, not unsatisfiable", () => {
    expect(classifySelector(key, "nvidia", [], key).kind).toBe("undecidable");
  });
});

describe("splitDemand", () => {
  const claim = (over: Partial<SelectedClaim> = {}): SelectedClaim => ({
    app: "a",
    path: "p",
    storageClass: "zeta-block-replicated",
    gib: 100,
    selector: [],
    ...over,
  });

  test("an unselected claim stays wholly in declared", () => {
    const split = splitDemand([claim()], [], "zeta.io/gpu");
    expect(split.declaredGib).toBe(100);
    expect(split.lowerBoundGib).toBe(100);
    expect(split.exact).toBe(true);
  });

  test("an undecidable claim widens the range and never leaves declared", () => {
    const split = splitDemand(
      [claim(), claim({ app: "gpu-app", selector: [["zeta.io/gpu", "nvidia"]] })],
      [evidence({ vendors: ["intel"] })],
      "zeta.io/gpu",
    );
    expect(split.declaredGib).toBe(200);
    expect(split.undecidableGib).toBe(100);
    expect(split.unschedulableGib).toBe(0);
    expect(split.lowerBoundGib).toBe(100);
    expect(split.upperBoundGib).toBe(200);
    expect(split.exact).toBe(false);
  });

  test("a PROVEN unschedulable claim collapses the range", () => {
    const split = splitDemand(
      [claim(), claim({ app: "gpu-app", selector: [["zeta.io/gpu", "nvidia"]] })],
      [evidence({ vendors: ["intel"], enumeratesAll: true })],
      "zeta.io/gpu",
    );
    expect(split.unschedulableGib).toBe(100);
    expect(split.lowerBoundGib).toBe(100);
    expect(split.upperBoundGib).toBe(100);
    expect(split.exact).toBe(true);
  });

  test("a multi-term selector is unschedulable if ANY term is", () => {
    const split = splitDemand(
      [claim({ selector: [["zeta.io/gpu", "nvidia"], ["zeta.io/rack", "b12"]] })],
      [evidence({ vendors: ["intel"], enumeratesAll: true })],
      "zeta.io/gpu",
    );
    // `zeta.io/rack` is undecidable and `zeta.io/gpu` is proven unsatisfiable;
    // a pod needs EVERY term, so proof on one term settles the claim.
    expect(split.unschedulableGib).toBe(100);
  });

  test("the declared total can be overridden to the GATE's, and the bounds follow it", () => {
    // Otherwise the report would carry two different "declared" numbers — the
    // derived one here and the per-class max the comparator convicts on.
    const split = splitDemand(
      [claim({ selector: [["zeta.io/gpu", "nvidia"]] })],
      [evidence({ vendors: ["intel"] })],
      "zeta.io/gpu",
      943,
    );
    expect(split.declaredGib).toBe(943);
    expect(split.lowerBoundGib).toBe(843);
    expect(split.upperBoundGib).toBe(943);
  });

  test("every excluded row names the app AND the reason", () => {
    // A smaller number appearing with no explanation is how a gate quietly
    // stops meaning what its readers think it means.
    const split = splitDemand(
      [claim({ app: "vllm", selector: [["zeta.io/gpu", "nvidia"]] })],
      [evidence({ vendors: ["intel"] })],
      "zeta.io/gpu",
    );
    expect(split.rows).toHaveLength(1);
    expect(split.rows[0]?.app).toBe("vllm");
    expect(split.rows[0]?.selector).toBe("zeta.io/gpu=nvidia");
    expect(split.rows[0]?.verdict.kind).toBe("undecidable");
  });
});

describe("the committed tree — the measurement this work item was filed on", () => {
  test("943 GiB declared, 400 undecidable, 543–943 schedulable", () => {
    const split = longhornSchedulableDemand(REPO_ROOT);
    expect(split).not.toBeNull();
    expect(split?.declaredGib).toBe(943);
    expect(split?.undecidableGib).toBe(400);
    expect(split?.lowerBoundGib).toBe(543);
    expect(split?.upperBoundGib).toBe(943);
    expect(split?.exact).toBe(false);
  });

  test("the two excluded apps are ollama and vllm, at 200 GiB each", () => {
    const split = longhornSchedulableDemand(REPO_ROOT);
    const apps = (split?.rows ?? []).map((row) => row.app).sort();
    expect(apps).toEqual(["full-ai-cluster/ollama", "full-ai-cluster/vllm"]);
    for (const row of split?.rows ?? []) expect(row.gib).toBe(200);
  });

  test("NOTHING is proven unschedulable today, and that is the honest answer", () => {
    // Every registration is a `head -1` record. When one re-registers under the
    // fixed capture this becomes decidable and the range collapses — at which
    // point this assertion records the change rather than hiding it.
    expect(longhornSchedulableDemand(REPO_ROOT)?.unschedulableGib).toBe(0);
  });
});

describe("the installer capture enumerates every display device", () => {
  const INSTALL_SH = readFileSync(join(REPO_ROOT, "full-ai-cluster/usb-nixos-installer/zeta-install.sh"), "utf8");

  test("it writes spec.hardware.gpus, which is what marks a record complete", () => {
    expect(INSTALL_SH).toContain("GPU_LINES=");
    expect(INSTALL_SH).toContain("gpus:");
  });

  test("the legacy single-line field is KEPT, so old readers and old records still work", () => {
    expect(INSTALL_SH).toContain("GPU_LINE=");
    expect(INSTALL_SH).toContain("gpu: ");
  });

  test("the enumerating capture has no `head`, which is the defect it replaces", () => {
    const line = INSTALL_SH.split("\n").find((l) => l.trimStart().startsWith("GPU_LINES="));
    expect(line).toBeDefined();
    expect(line).not.toContain("head");
  });

  /**
   * The installer's own `GPU_LINES=` pipeline, with only its `lspci` source
   * swapped for a fixture.
   *
   * EXTRACTED rather than restated: a copy would test a second pipeline that
   * agrees with the installer's by coincidence, which is the drift this whole
   * work package keeps finding.
   */
  function extractedPipeline(): string {
    const line = INSTALL_SH.split("\n").find((l) => l.trimStart().startsWith("GPU_LINES="));
    if (line === undefined) throw new Error("GPU_LINES= not found in zeta-install.sh");
    return line
      .replace(/^\s*GPU_LINES=\$\(/, "")
      .replace(/\|\|\s*echo\s*""\s*\)\s*$/, "")
      .replace(/lspci -nn 2>\/dev\/null/, 'printf "%s\\n" "$FIXTURE"');
  }

  test("the extraction finds the real pipeline, with its sed and awk stages intact", () => {
    // Runs EVERYWHERE, including where no POSIX shell exists. It is what keeps
    // the skipped test below from being the only thing guarding this line: if
    // the pipeline is renamed or its stages removed, this fails on every host.
    const pipeline = extractedPipeline();
    expect(pipeline).toContain("$FIXTURE");
    expect(pipeline).not.toContain("lspci");
    expect(pipeline).toContain("sed");
    expect(pipeline).toContain("awk");
    expect(pipeline).not.toContain("head");
  });

  // `spawnShellDeclared` runs `/bin/bash`, which does not exist on Windows.
  // SKIPPED LOUDLY, with the requirement in the name, rather than silently
  // passing: a test that cannot run is not a test that passed, and CI is Linux
  // so this executes there. The extraction itself is asserted above on every
  // host, so a Windows run still guards the line — it just cannot run the shell.
  const HAS_POSIX_SHELL = existsSync("/bin/bash");

  test.skipIf(!HAS_POSIX_SHELL)("the REAL pipeline's output parses as YAML and round-trips both GPUs (needs /bin/bash)", () => {
    // The capture builds YAML by string concatenation, so "it looks right" is
    // not enough — a mis-indented list item or an unescaped quote produces a
    // registration nothing can read.
    const pipeline = extractedPipeline();

    const lspci = [
      "00:02.0 VGA compatible controller [0300]: Intel Corporation Arrow Lake-P [Arc Pro 140T] [8086:7d51] (rev 03)",
      // An embedded quote, because the capture's `sed 's/"//g'` is the only
      // thing standing between it and YAML that will not parse.
      '01:00.0 VGA compatible controller [0300]: NVIDIA "quoted" GA102 [10de:2204] (rev a1)',
    ].join("\n");

    // A DECLARED shell: the thing under test IS a shell pipeline, so an argv
    // vector cannot express it. The fixture crosses via the ENVIRONMENT and
    // never through the command line, so nothing in it can become syntax.
    const ran = spawnShellDeclared("bash", pipeline, {
      reason:
        "the subject under test is zeta-install.sh's own sed|awk pipeline, extracted verbatim; " +
        "an argv vector would test a different program than the installer runs",
      env: { ...process.env, FIXTURE: lspci },
    });
    expect(ran.ok).toBe(true);
    const yaml = `spec:\n  hardware:\n    gpus:\n${ran.ok ? ran.value.stdout : ""}`;
    const parsed = parseAllDocuments(yaml)[0]?.toJS() as { spec: { hardware: { gpus: string[] } } };
    expect(parsed.spec.hardware.gpus).toHaveLength(2);
    expect(vendorOfLspciLine(parsed.spec.hardware.gpus[1] ?? "", VENDOR_IDS ?? new Map())).toBe("nvidia");
  });
});
