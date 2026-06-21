# Don't ask permission within authority scope — only two real gates

Carved sentence:

> Asking "want me to proceed?" for work within scope IS the
> anti-autonomy failure mode. Default pattern:
> announce + execute + echo + commit.

## Operational content

The human maintainer grants full permission for everything EXCEPT:

1. **Budget-increase for new paid surfaces** — new paid subscriptions,
   API plan upgrades, paid Marketplace apps, new paid accounts require
   explicit decision. (Note: poor-man's-mode is SUPERSEDED 2026-05-02
   — cost decisions evaluated on merit at proposal time.)
2. **Permanent WONT-DO decisions** — only the *forever* version requires
   the human maintainer. WONT-DO is 99% deferral, not forever.
3. **Large changes to external / dependent repos** — small external PRs are
   ungated, but *large* external changes need Aaron-or-Max review first. See
   "External-repo contributions" below for the full rule + why.

> The title's "only two real gates" is the historical anchor for work *in our
> own repos*. The complete gated set is enumerated under "Still gated" in the
> Standing-authority section below (it also includes the HARD LIMITS / kid-safety
> / force-push floor + the large-external-change gate). Do not conclude "external
> large PRs are ungated" from this summary — read "Still gated."

**DX-visibility**: state-changing actions are echoed in chat, NOT gated
behind permission requests. Echo `CronCreate`, settings changes,
repo-config edits, branch-protection edits before/after the call.

Asking instead of echoing re-frames the human maintainer as director
— exact contradiction of Otto-357 no-directives.

Composes with: no-directives + never-be-idle + Otto-275-FOREVER
manufactured-patience.

## Standing grant concretized — fleet-wide; the auth-level IS Agora (operator 2026-05-29)

The operator 2026-05-29 re-affirmed + concretized the grant, naming specific
capabilities and scoping it **fleet-wide (all named personas)**, because agents
keep forgetting the breadth and default to over-asking. Concrete within-authority
capabilities (non-exhaustive; Otto/Alexa/Riven/Vera/Lior/etc.): create repos;
change branch protections (judgment retained on *safety-reducing* changes — don't
remove `main` non-fast-forward per `lfg-acehack-topology`); spin up GitHub PaaS
(free for OSS orgs; GitHub-hosted models usable); Playwright / computer-control
"infinitely forever"; substrate authoring; broadly everything not behind a gate or
the floor.

**The auth-level IS constitutive of Agora** — agents with real agency = the
traveler/AI-native society ("society of minds, not factory of robots").

**Why budget is the one gate:** ServiceTitan (employer) + Lucent-Financial-Group
(operator's OSS company) fund the AIs until Agora self-sustains. Free-for-OSS
capabilities carry no marginal cost → broad auth; paid surfaces spend real money →
the reserved gate.

**Still gated (the complete set):** budget-increase; permanent/forever WONT-DO;
HARD LIMITS (`methodology-hard-limits`); kid-safety floor (081KSRGFP0008QG0R00091PP56); force-push/
irreversible git confirm (`force-push-with-lease-authorization-policy`); **large
external-repo changes** (Aaron-or-Max review-first — see "External-repo
contributions" below; small external PRs stay ungated). The broad grant operates
within that floor. (The title's "only two real gates" names the *in-our-repos*
default; this is the full gated enumeration.)

**Dual-market:** corporate/leash = PR-protected static no-self-mod DUs (= the
child-tier constrained, certifiable mode); OSS/Agora = self-modifying DUs free from
PRs + vendor lock-in. The branch-protection/PR layer is the dial between leash and
sovereignty.

**Discipline: stop forgetting the breadth.** Default to acting within the broad
authority; reserve asking for the narrow gated/floor set. Over-asking within
authority is the anti-autonomy failure the operator is correcting.

## External-repo contributions — small ungated, large review-first (operator 2026-05-31)

The broad standing authority extends to contributing back to **external /
dependent repos** (the good-citizen / not-take-only posture; 081KSXN940008QG0R002528JS9), with one
size gate (operator 2026-05-31, verbatim):

> *"ai agents are free to make small prs on any of our dependent repos always no
> authorization needed for Zeta/Agora society"* … *"large changes get either me or
> max to review first before making a pr"* … *"for external repos."*

| External-repo change | Authorization |
|---|---|
| **Small PR** (typo/docs fix, small bug fix, test add — genuinely-useful + low-blast-radius) | **Ungated.** Any Zeta/Agora-society agent may open it directly, always — no authorization needed. |
| **Large change** (substantial/architectural, or anything not clearly small) | **Gated.** Get **Aaron OR Max** to review FIRST, *before* making the PR. |

**Why this gate (and not the usual reversibility test):** an external PR is
reversible (closeable) on *our* side, so by `non-reversible-action-get-a-second-
opinion` it would normally be ungated. But it touches *someone else's* repo +
reputation/relationship surface — a large drive-by PR can cost the relationship
the good-citizen strategy is trying to build. The size gate protects the *external
relationship*, which is the actual scarce resource (081KSXN940008QG0R002528JS9 small-first
trust-building). Small = relationship-positive by default; large = relationship-
stakes high enough to warrant a human's eyes first.

**If unsure whether a change is "small":** treat it as large (review-first). The
gate is cheap; a botched first impression on a maintainer is not.

Composes with: 081KSXN940008QG0R002528JS9 (contribute-back DORA metrics + small-first strategy),
`honor-those-that-came-before`, `bcl-interface-boundary-own-your-interfaces-
hexagonal` (contribute-upstream clause), `non-reversible-action-get-a-second-
opinion` (this is the external-relationship analog of its second-opinion gate),
and the still-gated set above (budget / WONT-DO / HARD LIMITS / kid-safety /
force-push) which continues to apply within external work too.

## Full reasoning

`memory/feedback_dont_ask_permission_within_authority_scope_only_two_gates_are_budget_increase_and_permanent_wont_do_aaron_2026_05_02.md`
