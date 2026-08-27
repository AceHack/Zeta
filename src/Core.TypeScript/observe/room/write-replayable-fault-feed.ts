/** Generate the finite immutable replay-feed JSON under a caller-declared directory. */
import { mkdir, writeFile } from "node:fs/promises";
import { replayableRoomFaultFeedFiles } from "./replayable-fault-feed";

const outputDirectory = process.argv[2];
if (outputDirectory === undefined) throw new Error("usage: bun write-replayable-fault-feed.ts <output-directory>");

await mkdir(outputDirectory, { recursive: true });
for (const [file, payload] of replayableRoomFaultFeedFiles()) await writeFile(`${outputDirectory}/${file}`, payload, "utf8");
