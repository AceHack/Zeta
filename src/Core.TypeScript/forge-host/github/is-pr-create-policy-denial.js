export const ACTIONS_CREATE_PR_POLICY_DENIAL = "GitHub Actions is not permitted to create or approve pull requests (createPullRequest)";
export function isActionsCreatePullRequestPolicyDenial(output) {
    return output.includes(ACTIONS_CREATE_PR_POLICY_DENIAL);
}
export async function main(argv) {
    if (argv.length > 1) {
        console.error("usage: bun src/Core.TypeScript/github/is-pr-create-policy-denial.ts [log-file]");
        return 2;
    }
    const logPath = argv[0];
    const output = logPath === undefined ? await new Response(Bun.stdin.stream()).text() : await Bun.file(logPath).text();
    return isActionsCreatePullRequestPolicyDenial(output) ? 0 : 1;
}
if (import.meta.main) {
    process.exit(await main(process.argv.slice(2)));
}
