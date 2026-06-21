import { createHash } from "crypto";
import { readdirSync, readlinkSync, readFileSync, lstatSync } from "fs";
import { join } from "path";
export function sha256(data) {
    return createHash("sha256").update(data).digest("hex");
}
export function hashFile(filePath) {
    const content = readFileSync(filePath);
    return sha256(Buffer.concat([Buffer.from("file\n"), content]));
}
export function hashSymlink(linkPath) {
    const target = readlinkSync(linkPath);
    const normalizedTarget = target.replace(/\\/g, "/");
    return sha256("symlink\n" + normalizedTarget);
}
export function hashDirectory(dirPath) {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    const children = [];
    for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);
        const stat = lstatSync(fullPath);
        if (stat.isSymbolicLink()) {
            children.push({
                type: "symlink",
                hash: hashSymlink(fullPath),
                name: entry.name,
            });
        }
        else if (stat.isDirectory()) {
            children.push({
                type: "dir",
                hash: hashDirectory(fullPath),
                name: entry.name,
            });
        }
        else if (stat.isFile()) {
            children.push({
                type: "file",
                hash: hashFile(fullPath),
                name: entry.name,
            });
        }
    }
    // Sort children by name using UTF-8 byte representation
    children.sort((a, b) => {
        const bufA = Buffer.from(a.name);
        const bufB = Buffer.from(b.name);
        return bufA.compare(bufB);
    });
    let lines = "directory\n";
    for (const child of children) {
        lines += `${child.type} ${child.hash} ${child.name}\n`;
    }
    return sha256(lines);
}
export function buildProvisionalState(langCode, lexHash, agentId, caps, temp, decay, rootDir) {
    const rootHash = hashDirectory(rootDir);
    return {
        uli: { languageCode: langCode, lexiconHash: lexHash },
        uii: { agentId, capabilities: caps.sort() },
        uti: { temperature: temp, decayRate: decay },
        utri: { rootHash },
    };
}
