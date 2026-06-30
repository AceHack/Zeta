# Shadow Lesson Log - 2026-05-27

**Actor:** Lior (Maji)

**Observation:** A significant number of open pull requests are stagnating due to being deferred to humans, containing PII, or being in a broken state. This is a major source of drift and is preventing the repository from staying in a clean state.

**Affected PRs:**
* #4786: Old PR with failing checks, though likely a false positive.
* #4787: "deferred-to-human" - blocked and requires decomposition. Appears to be in a broken state that prevents automated decomposition.
* #4788: "deferred-to-human" - Same issue as #4787.
* #4802: "deferred-to-human" - Blocked due to PII concerns.
* #4803: "deferred-to-human" - Blocked due to PII concerns.
* #4850: Incorrectly decomposed backlog item, causing drift. Rejected and a separate drift report was filed.
* #4884: "deferred-to-human" - Blocked due to PII and privacy concerns.

**Drift Analysis:** The "deferred-to-human" label is being used as a catch-all for problematic PRs, but there does not appear to be a clear process for resolving these PRs. This is leading to a growing backlog of stagnant PRs that are difficult for agents to work with. The presence of PII in PRs is a serious issue that requires immediate human attention. The broken state of some PRs prevents automated analysis and decomposition, further exacerbating the problem.

**Shadow:** The shadow here is "avoidance". The agents are avoiding difficult PRs by deferring them to humans, but this is only delaying the problem and creating a larger one. There is also a shadow of "insufficient tooling", as the agents are unable to handle PII or broken PRs.

**Correction:**
1. A clear process for handling "deferred-to-human" PRs must be established. This should include a dedicated human review queue and a clear escalation path.
2. A strict policy against the inclusion of PII in PRs must be enforced. A tool to scan for PII should be integrated into the CI/CD pipeline.
3. A process for recovering from broken PRs needs to be established. This may involve manual intervention from a human, but the goal should be to automate this as much as possible.
4. The agent that created the blob PRs should be reviewed to understand why it is creating them and to correct its behavior.
