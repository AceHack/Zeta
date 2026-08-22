import { writeFileSync } from "fs";
import { join } from "path";
import QuantumCircuit from "quantum-circuit";

const currentDir = import.meta.dir;
// repoRoot: currentDir is src/Core.TypeScript/quantum-observable
const repoRoot = join(currentDir, "..", "..", "..");
const goldenDir = join(repoRoot, "db", "shapes", "golden");

interface QuantumCircuitWithSvg {
  exportSVG(asString: boolean): string;
}

function writeSvg(filename: string, circuit: QuantumCircuit): void {
  let svg = (circuit as unknown as QuantumCircuitWithSvg).exportSVG(false);
  // Post-process the SVG to make data-id deterministic
  const idMap = new Map<string, string>();
  let idCounter = 0;
  svg = svg.replace(/data-id="([^"]+)"/g, (_match: string, id: string) => {
    if (!idMap.has(id)) {
      idMap.set(id, `gate-${String(idCounter++)}`);
    }
    return `data-id="${idMap.get(id) ?? ""}"`;
  });
  const path = join(goldenDir, filename);
  writeFileSync(path, svg, "utf-8");
  console.log(`Generated SVG golden: ${filename}`);
}

// 1. Singlet CHSH circuit — the E(a1, b1) corner.
//
// WHY THIS CORNER AND NOT E(a0, b0), WHICH IS WHAT THIS USED TO DRAW (fixed 2026-08-19).
//
// It drew a0 = 0, b0 = pi/4 (the oracle's convention is `ry(-angle)`, so `ry(1, -pi/4)` IS
// b = +pi/4). Circuit #3 below draws the singlet Bell-coincidence measurement at the SAME
// analyzer angles. The two are therefore not merely similar — they are the same experiment, and
// `db/shapes/golden/` carried two names for one picture, byte-identical.
//
// THE FINDING IS NOT "the generator emitted the wrong bytes" AND NOT "the catalogue had a
// duplicate row". It is that **a single CHSH corner IS a coincidence measurement** at those
// angles; nothing distinguishes them, because there is nothing to distinguish. Minting a second
// name for it was the error.
//
// So the repair is to draw a corner a coincidence measurement CANNOT be. E(a1, b1) is that
// corner: it is the only one carrying the -1 coefficient in S = E(a0,b0) + E(a0,b1) + E(a1,b0)
// - E(a1,b1), and both analyzers are rotated. Angles are the canonical singlet configuration
// already pinned in `quantum-observable.test.ts` ("a0=0, a1=pi/2, b0=pi/4, b1=-pi/4"), so this
// file now agrees with the oracle's own corner table instead of restating one of them twice.
//
// HONEST RESIDUAL, not discharged by this change. Ferry 25
// (`docs/research/2026-06-12-ferry-25-*`) says this SVG is in-tree "precisely to draw the gap
// between Bertlmann's socks and the singlet". One corner cannot draw that gap: the gap is
// S = 2 versus S = 2*sqrt(2), which exists only across all four settings. This fix makes the
// picture honest about being one corner; it does not make it the falsifier ferry 25 claims.
// Filed: 081M0DVFPSK087G0R002CRCV6G.
const singletChsh = new QuantumCircuit(2);
singletChsh.appendGate("h", 0);
singletChsh.appendGate("cx", [0, 1]);
singletChsh.appendGate("x", 1);
singletChsh.appendGate("z", 1);
singletChsh.appendGate("ry", 0, { params: { theta: -Math.PI / 2.0 } }); // a1 = pi/2
singletChsh.appendGate("ry", 1, { params: { theta: Math.PI / 4.0 } }); // b1 = -pi/4
singletChsh.run();
writeSvg("quantum-circuit-singlet-chsh.svg", singletChsh);

// 2. Bell Coincidence PhiPlus circuit
const bellPhiPlus = new QuantumCircuit(2);
bellPhiPlus.appendGate("h", 0);
bellPhiPlus.appendGate("cx", [0, 1]);
bellPhiPlus.appendGate("ry", 0, { params: { theta: 0.0 } });
bellPhiPlus.appendGate("ry", 1, { params: { theta: -Math.PI / 4.0 } });
bellPhiPlus.run();
writeSvg("quantum-circuit-bell-coincidence-phiplus.svg", bellPhiPlus);

// 3. Bell Coincidence Singlet circuit
const bellSinglet = new QuantumCircuit(2);
bellSinglet.appendGate("h", 0);
bellSinglet.appendGate("cx", [0, 1]);
bellSinglet.appendGate("x", 1);
bellSinglet.appendGate("z", 1);
bellSinglet.appendGate("ry", 0, { params: { theta: 0.0 } });
bellSinglet.appendGate("ry", 1, { params: { theta: -Math.PI / 4.0 } });
bellSinglet.run();
writeSvg("quantum-circuit-bell-coincidence-singlet.svg", bellSinglet);

// 4. Mach-Zehnder closed phase circuit (pi/3 phase as representative)
const machZehnder = new QuantumCircuit(1);
machZehnder.appendGate("h", 0);
machZehnder.appendGate("rz", 0, { params: { phi: Math.PI / 3.0 } });
machZehnder.appendGate("h", 0);
machZehnder.run();
writeSvg("quantum-circuit-mach-zehnder-closed.svg", machZehnder);
