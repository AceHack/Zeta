import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ContentHash256 } from "./blake3";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const vectorsYamlPath = join(__dirname, "../../../tests/cross-verification/blake3-256/vectors.yaml");
const outputPath = join(__dirname, "../../../tests/cross-verification/blake3-256/ts-output.json");
async function run() {
    const yamlContent = readFileSync(vectorsYamlPath, "utf8");
    const parsed = Bun.YAML.parse(yamlContent);
    const results = {};
    for (const vec of parsed.vectors) {
        let bytes;
        if (vec.input_utf8 !== undefined) {
            bytes = new TextEncoder().encode(vec.input_utf8);
        }
        else if (vec.input_hex !== undefined) {
            const hex = vec.input_hex;
            bytes = new Uint8Array(hex.length / 2);
            for (let i = 0; i < bytes.length; i++) {
                bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
            }
        }
        else {
            throw new Error(`Vector ${vec.id} must have input_utf8 or input_hex`);
        }
        const hash = ContentHash256.ofBytes(bytes);
        results[vec.id] = hash.toHex();
    }
    writeFileSync(outputPath, JSON.stringify(results, null, 2) + "\n", "utf8");
    console.log(`Generated TS oracle outputs at: ${outputPath}`);
}
run().catch((err) => {
    console.error(err);
    process.exit(1);
});
