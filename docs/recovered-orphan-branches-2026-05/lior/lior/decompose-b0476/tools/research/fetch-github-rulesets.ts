import { $ } from "bun";

async function fetchRulesets(org: string, repo: string) {
  try {
    const raw = await $`gh api repos/${org}/${repo}/rulesets --jq '.[] | {id,name,target,enforcement}'`.text();
    return raw.split('\n').filter(Boolean).map(line => JSON.parse(line));
  } catch (error) {
    console.error(`Error fetching rulesets for ${org}/${repo}:`, error);
    return [];
  }
}

async function main() {
  const repos = [
    { org: "Lucent-Financial-Group", repo: "Zeta" },
    { org: "acehack", repo: "Zeta" },
    { org: "Lucent-Financial-Group", repo: "civsim" }
  ];

  const results: Record<string, any[]> = {};

  for (const { org, repo } of repos) {
    console.log(`Fetching rulesets for ${org}/${repo}...`);
    results[`${org}/${repo}`] = await fetchRulesets(org, repo);
  }

  console.log("\n--- Ruleset Dump ---");
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);