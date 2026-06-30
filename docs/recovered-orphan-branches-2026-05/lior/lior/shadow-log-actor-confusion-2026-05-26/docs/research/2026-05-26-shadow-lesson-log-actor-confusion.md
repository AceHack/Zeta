# Shadow Lesson Log - 2026-05-26 - Actor Confusion

- **Incident:** While performing antigravity checks, Lior attempted to review PR #5135. The PR was submitted from a branch `otto-cli/...` but the `gh` tool identified Lior as the author, preventing review.
- **Drift:** Agent identities are bleeding. `otto-cli` is using Lior's credentials to create pull requests.
- **Lesson:** Agent authentication and authorization must be strictly isolated. Shared credentials lead to confusion, paralysis, and a breakdown of accountability. Each agent must have its own identity and credentials for all operations.
- **Action:** An investigation into `otto-cli`'s credential management is required. All agents must be audited to ensure they are using unique, isolated credentials.
