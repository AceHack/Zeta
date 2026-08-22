import { buildArc3Rom } from "../src/Core.TypeScript/chip8/games/arc3-puzzle";
import * as fs from "fs";
import * as path from "path";

const romData = buildArc3Rom();
const outPath = path.join(__dirname, "../roms/arc3.ch8");

fs.writeFileSync(outPath, Buffer.from(romData));
console.log(`Successfully built arc3.ch8 to ${outPath} (${romData.length} bytes)`);
