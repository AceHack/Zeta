import { parseYaml } from "./deps";
import semver from "semver";

function extractChartSection(yamlText: string, chartName: string): string {
  const lines = yamlText.split(/\r?\n/);
  const chartHeader = `  ${chartName}:`;
  let collecting = false;
  const collectedVersions: string[] = [];
  let currentVersion: string | null = null;
  let listItemIndent: number | null = null;

  for (const line of lines) {
    const trimmed = line.trimStart();
    const indent = line.length - trimmed.length;

    if (!collecting) {
      if (line.startsWith(chartHeader)) {
        collecting = true;
      }
    } else {
      if (trimmed.length > 0) {
        if (indent <= 2 && trimmed.endsWith(":") && !trimmed.startsWith("-")) {
          break;
        }
        if (indent === 0 && !trimmed.startsWith("-")) {
          break;
        }
      }

      if (trimmed.startsWith("-")) {
        if (listItemIndent === null) {
          listItemIndent = indent;
        }

        if (indent === listItemIndent) {
          if (currentVersion !== null) {
            collectedVersions.push(`    - version: ${currentVersion}`);
            currentVersion = null;
          }
          if (trimmed.startsWith("- version:")) {
            currentVersion = trimmed.slice("- version:".length).trim();
          }
        }
      } else if (listItemIndent !== null) {
        if ((indent === listItemIndent + 2 || indent === listItemIndent) && trimmed.startsWith("version:")) {
          currentVersion = trimmed.slice("version:".length).trim();
        }
      }
    }
  }

  if (currentVersion !== null) {
    collectedVersions.push(`    - version: ${currentVersion}`);
  }

  if (collectedVersions.length === 0) {
    throw new Error(`Chart '${chartName}' not found in repository index`);
  }

  return `entries:\n  ${chartName}:\n` + collectedVersions.join("\n");
}

export async function fetchLatestVersion(repoUrl: string, chartName: string): Promise<string> {
  if (repoUrl.startsWith("oci://")) {
    throw new Error("OCI registries are not supported. Only standard HTTP/HTTPS Helm repositories are supported.");
  }
  const indexUrl = repoUrl.endsWith("/") ? `${repoUrl}index.yaml` : `${repoUrl}/index.yaml`;

  const response = await fetch(indexUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch Helm repository index from ${indexUrl}: ${response.statusText}`);
  }

  const yamlText = await response.text();
  const extractedYaml = extractChartSection(yamlText, chartName);
  const parsed = parseYaml(extractedYaml);

  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Invalid index.yaml content from ${indexUrl}`);
  }

  const entries = parsed.entries;
  if (!entries || typeof entries !== "object") {
    throw new Error(`No 'entries' found in index.yaml from ${indexUrl}`);
  }

  const chartEntries = entries[chartName];
  if (!chartEntries || !Array.isArray(chartEntries)) {
    throw new Error(`Chart '${chartName}' not found in repository index`);
  }

  const versions = chartEntries.map((e: any) => e.version).filter((v: string) => semver.valid(v));

  if (versions.length === 0) {
    throw new Error(`No valid semver versions found for chart '${chartName}'`);
  }

  const sorted = semver.rsort(versions);
  return sorted[0]!;
}

async function main() {
  const args = process.argv.slice(2);
  const jsonFlag = args.includes("--json");
  const filteredArgs = args.filter((a) => a !== "--json");

  if (filteredArgs.length < 2) {
    if (jsonFlag) {
      console.log(
        JSON.stringify({
          error:
            "Usage: bun src/Core.TypeScript/ace/helm-change-detector.ts <repoUrl> <chartName> [currentVersion] [--json]",
        }),
      );
    } else {
      console.error(
        "Usage: bun src/Core.TypeScript/ace/helm-change-detector.ts <repoUrl> <chartName> [currentVersion] [--json]",
      );
    }
    process.exit(1);
  }

  const repoUrl = filteredArgs[0]!;
  const chartName = filteredArgs[1]!;
  const currentVersion = filteredArgs[2];

  try {
    const latest = await fetchLatestVersion(repoUrl, chartName);

    let newerAvailable: boolean | undefined = undefined;
    if (currentVersion) {
      if (!semver.valid(currentVersion)) {
        throw new Error(`Invalid current version semver: '${currentVersion}'`);
      }
      newerAvailable = semver.gt(latest, currentVersion);
    }

    if (jsonFlag) {
      const output: Record<string, any> = {
        chart: chartName,
        repository: repoUrl,
        latest,
      };
      if (currentVersion !== undefined) {
        output.current = currentVersion;
        output.newerAvailable = newerAvailable;
      }
      console.log(JSON.stringify(output, null, 2));
    } else {
      if (currentVersion !== undefined) {
        console.log(`Latest version: ${latest}`);
        console.log(`Current version: ${currentVersion}`);
        console.log(`Newer version available: ${newerAvailable ? "Yes" : "No"}`);
      } else {
        console.log(`Latest version of '${chartName}' in '${repoUrl}' is: ${latest}`);
      }
    }
    process.exit(0);
  } catch (error: any) {
    if (jsonFlag) {
      console.log(JSON.stringify({ error: error.message }));
    } else {
      console.error(`Error: ${error.message}`);
    }
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
