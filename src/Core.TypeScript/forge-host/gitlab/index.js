/**
 * forge-host/gitlab/index.ts — GitLab adapter exports + auto-registration.
 */
import { registerAdapter } from "../registry";
import { GitLabAdapter } from "./gitlab-adapter";
export { GitLabAdapter } from "./gitlab-adapter";
registerAdapter(/gitlab/, (owner, repo) => new GitLabAdapter(owner, repo));
