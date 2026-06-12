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

// 1. Singlet CHSH circuit (for E(a0, b0) as a representative corner)
const singletChsh = new QuantumCircuit(2);
singletChsh.appendGate("h", 0);
singletChsh.appendGate("cx", [0, 1]);
singletChsh.appendGate("x", 1);
singletChsh.appendGate("z", 1);
singletChsh.appendGate("ry", 0, { params: { theta: 0.0 } });
singletChsh.appendGate("ry", 1, { params: { theta: -Math.PI / 4.0 } });
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
