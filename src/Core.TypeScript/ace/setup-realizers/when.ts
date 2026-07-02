import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

interface OsRelease {
  readonly id: string;
  readonly version: string;
}

function readOsRelease(): OsRelease {
  try {
    const text = readFileSync("/etc/os-release", "utf8");
    let id = "";
    let version = "";
    for (const line of text.split("\n")) {
      if (line.startsWith("ID=")) id = line.slice(3).replace(/^"|"$/g, "");
      if (line.startsWith("VERSION_ID=")) version = line.slice(11).replace(/^"|"$/g, "");
    }
    return { id, version };
  } catch {
    return { id: "", version: "" };
  }
}

function hostArch(): string {
  const dpkg = spawnSync("dpkg", ["--print-architecture"], { encoding: "utf8" });
  if (dpkg.status === 0 && dpkg.stdout.trim().length > 0) return dpkg.stdout.trim();
  if (process.arch === "x64") return "amd64";
  if (process.arch === "arm64") return "arm64";
  return process.arch;
}

/** Mirror tools/setup/mechanisms/_when.sh when_matches. */
export function whenMatches(spec: string | undefined, warn?: (message: string) => void): boolean {
  if (spec === undefined || spec.length === 0) return true;

  const { id, version } = readOsRelease();
  const arch = hostArch();

  for (const clause of spec.split(",")) {
    const trimmed = clause.trim();
    switch (trimmed) {
      case "ubuntu-22.04":
        if (id !== "ubuntu" || version !== "22.04") return false;
        break;
      case "ubuntu-24.04":
        if (id !== "ubuntu" || version !== "24.04") return false;
        break;
      case "amd64":
      case "arm64":
        if (arch !== trimmed) return false;
        break;
      case "linux":
        if (process.platform !== "linux") return false;
        break;
      case "darwin":
        if (process.platform !== "darwin") return false;
        break;
      default:
        warn?.(`unknown when= clause '${trimmed}'; treating as non-match`);
        return false;
    }
  }
  return true;
}

export function expandPath(raw: string): string {
  if (raw.startsWith("~/")) {
    const home = process.env.HOME ?? process.env.USERPROFILE;
    if (!home) throw new Error("HOME unset; cannot expand ~ path");
    return `${home}/${raw.slice(2)}`;
  }
  return raw;
}
