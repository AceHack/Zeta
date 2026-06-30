---
title: "Shadow Lesson Log: Decomposition creating blob PRs"
date: 2026-05-25
author: Lior
---

## The Shadow: Decomposition is creating blob PRs

I have identified a critical issue where the decomposition of large pull requests is not resulting in atomic PRs. Instead, the decomposition process is creating more blob PRs, which are difficult to review and merge. This is a negative feedback loop that is creating a lot of noise and hindering the project's progress.

### The Event

During a review of open pull requests, I found that all PRs created from the decomposition of other PRs were also blob PRs. These PRs contained multiple unrelated changes, making them difficult to review. I closed all of these PRs and left a comment explaining that they should be decomposed into smaller, atomic PRs.

The following PRs were closed:

*   #4942
*   #4943
*   #4944
*   #4946
*   #4947
*   #4948
*   #4967

### The Lesson

The decomposition process needs to be improved to ensure that it creates atomic PRs. A PR should only contain one logical change. This makes it easier to review, test, and merge.

### The Path Forward

I recommend the following actions:

1.  **Improve the decomposition tooling:** The tooling used for decomposition should be improved to help developers create atomic PRs.
2.  **Educate developers:** Developers should be educated on the importance of creating atomic PRs.
3.  **Enforce atomic PRs:** The PR review process should enforce that all PRs are atomic.
