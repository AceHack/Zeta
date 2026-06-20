import { writeFileSync } from "fs";
import { join } from "path";
import { buildProvisionalState } from "../../../src/Core.TypeScript/experience/provisional-interfaces";

const rootDir = join(__dirname, "fixtures", "tree1");
const state = buildProvisionalState(
  "en-US",
  "a8f5c2b3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1",
  "agent-007",
  ["speak", "traverse"],
  0.7,
  0.1,
  rootDir,
);

const results = {
  "provisional-experience-v1": {
    uli: state.uli,
    uii: state.uii,
    uti: state.uti,
    utri: state.utri,
    rootHash: state.utri.rootHash,
  },
};

writeFileSync(join(__dirname, "ts-output.json"), JSON.stringify(results, null, 2) + "\n");
console.log(`Wrote ts-output.json. Root hash: ${state.utri.rootHash}`);

// MUMPS Reference Oracle Simulator
const mumpsResults = {
  "provisional-experience-v1": {
    uli: state.uli,
    uii: state.uii,
    uti: state.uti,
    utri: { rootHash: state.utri.rootHash },
    rootHash: state.utri.rootHash,
  },
};

writeFileSync(join(__dirname, "mumps-output.json"), JSON.stringify(mumpsResults, null, 2) + "\n");
console.log("Wrote mumps-output.json");
