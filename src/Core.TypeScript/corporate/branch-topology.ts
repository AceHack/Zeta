/**
 * corporate/branch-topology.ts — what a change is CALLED and what it branches FROM.
 *
 * ── THE STATE THIS REPLACES ──────────────────────────────────────────────────
 * Every change was `work/<workId>`, branched from one fixed trunk, merged back to that same trunk.
 * Three things were wrong with that and only the first is cosmetic:
 *
 *   - `work/task-015` names an id this organization minted for itself. Nobody outside it can tell
 *     what that branch holds, and the ticket the work answers was already on the node.
 *   - Every change branched from the trunk, so a feature built out of six stories arrived as six
 *     unrelated merges and there was never a point at which the FEATURE could be reviewed.
 *   - A one-line defect fix got exactly the same treatment as that feature, which is the opposite
 *     mistake: ceremony bought for nothing.
 *
 * ── WHY THE SHAPE DECIDES, AND NOT A WORK TYPE ───────────────────────────────
 * The obvious rule is "a project gets a feature branch". It is wrong here, and measurably so: the
 * decomposition gives EVERY inbound request a full `goal -> initiative -> project -> leaf` chain, so
 * a single defect arrives owning a project of its own. Keyed on the type, a one-line fix would get
 * an integration branch, a merge into it, and a second merge out of it, to carry one commit.
 *
 * So the question is not what a rung is CALLED but whether it actually COLLECTS:
 *
 *   > An ancestor earns an integration branch when two or more code-producing items sit under it.
 *
 * That is read off the cascade, needs no configuration, and produces exactly the two cases worth
 * distinguishing — a feature branch with its stories merging into it, and a lone defect going
 * straight to the trunk — without anyone declaring which is which.
 *
 * ── ONE LEVEL, AND THE FIRST CUT GOT THIS WRONG ──────────────────────────────
 * The NEAREST collecting ancestor takes the branch; the ones above it take none. The first
 * version stacked all of them, reasoning that nesting should fall out of the same rule rather
 * than being a second one. It does fall out — and what falls out is absurd. Decomposition gives
 * every request a goal, an initiative AND a project, so a two-story request has three ancestors
 * each holding the same two code items, and each earned a branch: three integration branches and
 * six extra merges to deliver two commits.
 *
 * The generalisation was not more general, it was just uncounted. Stories merge into the feature;
 * the feature merges into the trunk. Where a project holds only one story, the nearest COLLECTING
 * ancestor is the initiative above it, so sibling one-story projects share the epic's branch —
 * which is the nesting case handled, by the same single rule, without a stack.
 *
 * ── WHAT IS DATA, AND WHAT IS NOT ────────────────────────────────────────────
 * The register may have an opinion about how its own branches are NAMED; the grammar may not have
 * an opinion about anything. So the prefixes below are data with defaults, in the same place and
 * the same style as the method defaults. The RULE above is not data, because it is not a
 * preference — it is a measurement of the work.
 */

import {
  childrenOf,
  isLeafType,
  nodeById,
  WorkState,
  WorkType,
  type Cascade,
  type CascadeNode,
} from "./goal-cascade";
import { producesCode } from "./gate-demand";
import {
  ProcessSetting,
  resolveSetting,
  type SettingBinding,
} from "./practice";

/**
 * How many code-producing items must sit under an ancestor before it is worth a branch of its own.
 *
 * TWO, and the number is the whole argument. One is a change, not a collection: giving it an
 * integration branch buys a merge in and a merge out to carry a single commit, and leaves a reader
 * of the history unable to tell a feature from a typo fix. At two there is something a reviewer can
 * look at that no single story shows — which is the only thing an integration branch is for.
 */
export const COLLECTS_AT = 2;

/**
 * What each rung's branches are called.
 *
 * The register's own opinion, as data — replaceable, and every lookup falls back to the work type's
 * own name, so a type absent from this table is named after itself rather than crashing or
 * silently sharing another rung's namespace.
 *
 * `project -> feature` is the one that carries weight: a collecting project IS what the rest of the
 * world calls a feature branch, and naming it `project/...` would make this organization's history
 * unreadable to the people who have to review it.
 */
export const DEFAULT_BRANCH_PREFIXES: Readonly<Partial<Record<WorkType, string>>> = {
  [WorkType.Goal]: "epic",
  [WorkType.Initiative]: "epic",
  [WorkType.Project]: "feature",
  [WorkType.Task]: "story",
  [WorkType.Defect]: "defect",
  [WorkType.CapabilityRequest]: "feature",
  [WorkType.Incident]: "hotfix",
  [WorkType.Review]: "review",
};

/** The prefix in force for a rung. */
export function prefixFor(
  workType: WorkType,
  prefixes: Readonly<Partial<Record<WorkType, string>>> = DEFAULT_BRANCH_PREFIXES,
): string {
  const chosen = (prefixes[workType] ?? "").trim();
  return chosen === "" ? String(workType) : chosen;
}

/**
 * The ticket a request key names, or nothing.
 *
 * `externalRefOf` builds `<n>:<source>|<m>:<externalId>` and the LENGTH PREFIXES are the whole
 * point of that format — a source or an id containing `:` or `|` is unambiguous only if you read
 * the lengths. So this reads them. Splitting on the separators would work on every key anybody has
 * yet written and fail on the first one that came from a system with a colon in its name, which is
 * the class of bug the encoding exists to prevent.
 *
 * Returns `undefined` for anything that does not parse EXACTLY — no partial credit. A half-read key
 * yields a plausible-looking wrong branch name, and a branch named after the wrong ticket is worse
 * than one named after no ticket at all.
 */
export function ticketOf(requestRef: string | undefined): string | undefined {
  if (requestRef === undefined) return undefined;
  const head = /^(\d{1,9}):/.exec(requestRef);
  if (head === null) return undefined;
  const sourceLen = Number.parseInt(head[1] as string, 10);
  const afterHead = head[0].length;
  // The separator sits immediately after `sourceLen` characters of source, wherever those land.
  const sepAt = afterHead + sourceLen;
  if (requestRef.charAt(sepAt) !== "|") return undefined;

  const tail = /^(\d{1,9}):/.exec(requestRef.slice(sepAt + 1));
  if (tail === null) return undefined;
  const idLen = Number.parseInt(tail[1] as string, 10);
  const idAt = sepAt + 1 + tail[0].length;
  const id = requestRef.slice(idAt);
  // EXACTLY the declared length, and nothing after it. A key with trailing bytes is malformed, and
  // reading the prefix of it would silently truncate an id.
  return id.length === idLen && id !== "" ? id : undefined;
}

/**
 * A branch-legal fragment.
 *
 * Git's own rules (`git check-ref-format`) forbid rather more than people remember: a space, `~`,
 * `^`, `:`, `?`, `*`, `[`, `\`, a `..` anywhere, a leading or trailing `.` or `/`, a `@{`, and a
 * `.lock` suffix. Rather than enumerate the forbidden set and be wrong about one of them, this
 * keeps an ALLOWED set — letters, digits, `.`, `_`, `-` — and collapses everything else.
 *
 * Ordinal throughout: `toLowerCase` is culture-sensitive and would fold `I` to a dotless `ı` under
 * a Turkish locale, which is a different branch name on a colleague's machine.
 */
export function slugOf(text: string, max = 48): string {
  const collapsed = text
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    // `..` is illegal in a ref even when both dots came from the title.
    .replace(/\.{2,}/g, ".")
    .replace(/^[-._]+|[-._]+$/g, "");
  const cut = collapsed.slice(0, max).replace(/[-._]+$/g, "");
  // `.lock` is refused by git as a SUFFIX; a slug that lands on one is trimmed rather than renamed,
  // because renaming would make the branch stop matching the ticket it is named for.
  return cut.toLowerCase().endsWith(".lock") ? cut.slice(0, -5) : cut;
}

/**
 * What this item's branch is called: the ticket it answers, or what it is about.
 *
 * THE TICKET WINS when there is one. A branch named `defect/AIAGENT-1637` can be found by anybody
 * holding the ticket, which is the only audience a branch name has. The title is the fallback for
 * work the organization raised for itself, where there is no ticket to name — and the workId is the
 * fallback under that, for a node whose title is punctuation or empty, so this function always
 * returns a usable ref rather than sometimes returning nothing.
 */
export function branchNameFor(
  node: CascadeNode,
  prefixes: Readonly<Partial<Record<WorkType, string>>> = DEFAULT_BRANCH_PREFIXES,
): string {
  const ticket = ticketOf(node.requestRef);
  const named = ticket === undefined ? "" : slugOf(ticket);
  const fromTitle = named === "" ? slugOf(node.title) : named;
  const leaf = fromTitle === "" ? slugOf(node.workId) : fromTitle;
  return `${prefixFor(node.workType, prefixes)}/${leaf === "" ? "work" : leaf}`;
}

/** The same name with the ticket deliberately ignored — what an item is called by what it IS. */
function describedNameFor(
  node: CascadeNode,
  prefixes: Readonly<Partial<Record<WorkType, string>>>,
): string {
  const fromTitle = slugOf(node.title);
  const leaf = fromTitle === "" ? slugOf(node.workId) : fromTitle;
  return `${prefixFor(node.workType, prefixes)}/${leaf === "" ? "work" : leaf}`;
}

/**
 * A work item's branch name, resolved against the rest of the cascade.
 *
 * ── WHY THE CASCADE IS NEEDED, AND WHAT THE FIRST TWO ATTEMPTS GOT WRONG ─────
 * `requestRef` is INHERITED by children on purpose — a task under a project under a goal that
 * answers a request answers that request — so in a real decomposition every rung carries the same
 * ticket. Measured on the folded cascade of a real end-to-end run:
 *
 *     goal-009  epic/T-1      init-011  epic/T-1      proj-013  feature/T-1
 *     task-015  defect/T-1    task-017  review/T-1
 *
 * `epic/T-1` twice. Differing prefixes hid the rest, because that fixture's two leaves happen to be
 * a defect and a review — two TASKS under one project, which is the feature case this whole module
 * exists for, would both be `story/T-1`.
 *
 * ATTEMPT ONE named every rung after the ticket. Collides.
 * ATTEMPT TWO used the ticket only when the ref was the node's OWN rather than its parent's. Correct
 * about inheritance, and the wrong rule: it demoted the commonest case there is — a request that
 * becomes ONE code item — to `defect/do-leaf-1`, discarding the single most useful thing a branch
 * name carries, to avoid a collision that was not there.
 *
 * So the collision is measured, not predicted. Keep the ticket unless another node would produce the
 * same name; fall back to the description, and to the id under that.
 *
 * ── STABILITY, AND ITS HONEST LIMIT ──────────────────────────────────────────
 * The answer depends on which nodes exist, so a node gaining a same-named peer changes its name. In
 * practice a decomposition creates a parent's children together, so this settles before any branch
 * is opened. When it does not, the change port's owner check REFUSES rather than writing one item's
 * work under another's name — visible and safe, but a refusal rather than a rename, and worth
 * knowing about before it is met.
 */
export function branchNameIn(
  cascade: Cascade,
  node: CascadeNode,
  prefixes: Readonly<Partial<Record<WorkType, string>>> = DEFAULT_BRANCH_PREFIXES,
): string {
  const mine = branchNameFor(node, prefixes);
  const contested = cascade.nodes.some(
    (other) => other.workId !== node.workId && branchNameFor(other, prefixes) === mine,
  );
  if (!contested) return mine;

  // Named by what it is. Two siblings of one request differ here even though their tickets do not.
  const described = describedNameFor(node, prefixes);
  const stillContested = cascade.nodes.some(
    (other) => other.workId !== node.workId && describedNameFor(other, prefixes) === described,
  );
  if (!stillContested) return described;

  // LAST RESORT, and it always works: the work id is unique by construction. Ugly on purpose — a
  // branch reaching this has two identically-titled siblings, which is worth noticing.
  return `${prefixFor(node.workType, prefixes)}/${slugOf(node.workId)}`;
}

/** Every descendant of `workId`, excluding the node itself. */
export function descendantsOf(cascade: Cascade, workId: string): readonly CascadeNode[] {
  const out: CascadeNode[] = [];
  // Iterative, and guarded by a seen-set: a cascade folded from a log is data, and a parent edge
  // that cycles would hang the run rather than fail it.
  const seen = new Set<string>([workId]);
  const queue = [workId];
  while (queue.length > 0) {
    const next = queue.shift() as string;
    for (const child of childrenOf(cascade, next)) {
      if (seen.has(child.workId)) continue;
      seen.add(child.workId);
      out.push(child);
      queue.push(child.workId);
    }
  }
  return out;
}

/** How many items under `workId` will actually produce a commit. */
export function codeProducingUnder(cascade: Cascade, workId: string): number {
  return descendantsOf(cascade, workId).filter((n) => producesCode(n.workType)).length;
}

/**
 * Whether this node collects enough code to be worth an integration branch.
 *
 * Counted over DESCENDANTS rather than children, because the rungs between a collection and its
 * code are not fixed: an initiative holding two projects of one task each collects two commits just
 * as surely as a project holding two tasks, and a rule that looked only at children would give the
 * initiative nothing and each project nothing.
 */
export function collects(cascade: Cascade, node: CascadeNode, at: number = COLLECTS_AT): boolean {
  return codeProducingUnder(cascade, node.workId) >= at;
}

/** The chain from a node up to its root, nearest first, excluding the node itself. */
export function ancestorsOf(cascade: Cascade, workId: string): readonly CascadeNode[] {
  const out: CascadeNode[] = [];
  const seen = new Set<string>([workId]);
  let at = nodeById(cascade, workId)?.parentWorkId;
  while (at !== undefined && !seen.has(at)) {
    seen.add(at);
    const node = nodeById(cascade, at);
    if (node === undefined) break;
    out.push(node);
    at = node.parentWorkId;
  }
  return out;
}

/**
 * The names a work item answers to, for scoped configuration — its own first, then its ancestors'.
 *
 * Each rung contributes BOTH its work id and its ticket, because a setting may be written either way
 * and an operator writes the ticket. Nearest first, so the nearest statement wins.
 */
export function settingCandidates(cascade: Cascade, workId: string): readonly string[] {
  const out: string[] = [];
  const add = (node: CascadeNode | undefined): void => {
    if (node === undefined) return;
    out.push(node.workId);
    const ticket = ticketOf(node.requestRef);
    if (ticket !== undefined) out.push(ticket);
  };
  add(nodeById(cascade, workId));
  for (const ancestor of ancestorsOf(cascade, workId)) add(ancestor);
  return out;
}

/**
 * What the process says about this node's own branching, if anything.
 *
 * Resolved against the node ALONE — its own id and its own ticket, never its ancestors' — because
 * the walk in `integrationFor` asks this of each rung in turn, and inheriting the answer would make
 * every rung under a `direct` epic report `direct` about itself.
 *
 * …but an ORGANIZATION-WIDE value does apply, and leaving it out was a defect a mutation caught:
 * `org setting bind --setting integration_branch --value direct` with no `--for` stored a row and
 * changed nothing. "We do not use feature branches" is a real thing to say, and a command that
 * accepts it must mean it.
 */
function statedForThisItem(
  node: CascadeNode,
  settings: readonly SettingBinding[],
): string | undefined {
  const ticket = ticketOf(node.requestRef);
  const own = [node.workId, ...(ticket === undefined ? [] : [ticket])];
  // SCOPED ROWS ONLY. This answers "was THIS item singled out", and an organization-wide `direct`
  // is not that — it is a statement about collections. Reading it here made an org-wide `direct`
  // short-circuit at the LEAF, so an epic explicitly set to `collect` never got its branch.
  const scoped = settings.filter(
    (b) => b.setting === ProcessSetting.IntegrationBranch && b.scope !== undefined,
  );
  return resolveSetting(scoped, ProcessSetting.IntegrationBranch, own).value;
}

/**
 * Whether this rung carries an integration branch, as the process sees it.
 *
 * Scoped first, then ORGANIZATION-WIDE — "we do not use feature branches" is exactly an org-wide
 * answer to this question, and leaving it out was a defect a mutation caught: the CLI stored the
 * row and the decision ignored it.
 */
function dispositionOf(
  node: CascadeNode,
  settings: readonly SettingBinding[],
): string | undefined {
  const ticket = ticketOf(node.requestRef);
  const own = [node.workId, ...(ticket === undefined ? [] : [ticket])];
  const mine = settings.filter((b) => b.setting === ProcessSetting.IntegrationBranch);
  return resolveSetting(mine, ProcessSetting.IntegrationBranch, own).value;
}

/** An integration branch a plan depends on. */
export interface IntegrationBranch {
  /** The collecting node this branch belongs to. */
  readonly workId: string;
  readonly branch: string;
  /** What it is cut from, and what it merges back into. */
  readonly base: string;
}

export interface BranchPlan {
  /** The change's own branch. */
  readonly branch: string;
  /** What it is cut from, and what its merge targets. */
  readonly base: string;
  /**
   * The integration branch this change merges into, when its work collects enough to warrant one.
   *
   * ABSENT IS THE ORDINARY CASE and means the change goes straight to the trunk — a lone defect,
   * a one-story request. Present, it must be created (from the trunk) before `branch` can be
   * opened, and it is what eventually merges to the trunk once the collection is approved.
   */
  readonly integration?: IntegrationBranch;
}

/**
 * Where one item's change lives in the branch topology.
 *
 * Everything above, applied: name the item after its ticket, find the ancestors that genuinely
 * collect, stack them from the trunk down, and base the change on the nearest one.
 *
 * A node that is ITSELF collecting — asking for the plan of a project rather than of a task — gets
 * its own integration branch as `branch`, so the same function answers "where does this feature
 * live" and "where does this story live" without a caller having to know which it is holding.
 */
export function branchPlanFor(input: {
  readonly cascade: Cascade;
  readonly workId: string;
  /** The branch a fully-approved collection eventually reaches. */
  readonly trunk: string;
  readonly prefixes?: Readonly<Partial<Record<WorkType, string>>>;
  readonly collectsAt?: number;
  /** The organization's SDLC settings. See `ProcessSetting`. */
  readonly settings?: readonly SettingBinding[];
}): BranchPlan | { readonly reason: string } {
  const node = nodeById(input.cascade, input.workId);
  if (node === undefined) return { reason: `no work item '${input.workId}' in the cascade` };
  const trunk = input.trunk.trim();
  if (trunk === "") return { reason: "no trunk branch was named" };

  const prefixes = input.prefixes ?? DEFAULT_BRANCH_PREFIXES;
  const found = integrationFor(input);
  return found === undefined
    ? { branch: branchNameIn(input.cascade, node, prefixes), base: trunk }
    : {
        branch: branchNameIn(input.cascade, node, prefixes),
        base: found.branch,
        integration: { ...found, base: trunk },
      };
}

/**
 * The integration branch a work item belongs under, or nothing.
 *
 * SEPARATE FROM `branchPlanFor` because a caller that drives the change-control port does not
 * know the trunk and must not learn it: the adapter was configured with it, and `ctx.base` is
 * optional precisely so a caller can say "the usual place" by saying nothing. Naming the trunk in
 * the runtime as well would be the same fact in two places, which is the same fact drifting.
 *
 * `undefined` therefore means TWO true things at once, and they do not need telling apart here:
 * the item's work goes straight to the trunk, and the item is itself the collection that goes
 * straight to the trunk.
 */
export function integrationFor(input: {
  readonly cascade: Cascade;
  readonly workId: string;
  readonly prefixes?: Readonly<Partial<Record<WorkType, string>>>;
  readonly collectsAt?: number;
  /** The organization's SDLC settings. `integration_branch` is the one read here. */
  readonly settings?: readonly SettingBinding[];
}): { readonly workId: string; readonly branch: string } | undefined {
  const node = nodeById(input.cascade, input.workId);
  if (node === undefined) return undefined;
  const at = input.collectsAt ?? COLLECTS_AT;
  const prefixes = input.prefixes ?? DEFAULT_BRANCH_PREFIXES;

  // A NODE THAT IS ITSELF THE COLLECTION MERGES TO THE TRUNK.
  //
  // Without this the feature branch bases on the EPIC above it, because the epic holds the same
  // code and therefore also collects — the over-counting the header describes, one rung up, and
  // it puts a second integration level back exactly where it was removed. A collection is where
  // the work is assembled and reviewed as a whole; once it is approved it goes to the trunk.
  const settings = input.settings ?? [];
  /** Whether a rung takes the branch: what the process says, or the shape when it says nothing. */
  const takesBranch = (n: CascadeNode): boolean => {
    // A LEAF IS NEVER A COLLECTION. Needed once an organization-wide value applies: `collect`
    // stated for everything would otherwise make every story "take" the branch, and a rung that
    // takes the branch IS the branch — so every story would get none.
    if (isLeafType(n.workType)) return false;
    const said = dispositionOf(n, settings);
    if (said === "collect") return true;
    // LIVE AGAIN, now that an organization-wide value applies: with nothing scoped anywhere, an
    // org-wide `direct` is read HERE or it is read nowhere. It was briefly deleted as dead, which
    // it was — only because org-wide was being ignored, which was the defect.
    if (said === "direct") return false;
    return collects(input.cascade, n, at);
  };

  // THE NODE'S OWN DISPOSITION FIRST. A rung that takes a branch IS the integration branch and has
  // none of its own, and one marked `direct` has none by instruction.
  if (statedForThisItem(node, settings) === "direct") return undefined;
  if (takesBranch(node)) return undefined;

  // NEAREST FIRST. A loop rather than a `find` because `direct` has to STOP the walk: the ancestors
  // above the one that takes the branch are not 'also collecting', they are the same code counted
  // again from further away — and a `direct` rung in between means there is nothing to count toward.
  for (const ancestor of ancestorsOf(input.cascade, input.workId)) {
    // SHIELDS EVERYTHING UNDER IT. Continuing past a `direct` epic would land a stabilization bug
    // on whatever unrelated feature happened to sit above it.
    if (statedForThisItem(ancestor, settings) === "direct") return undefined;
    if (takesBranch(ancestor)) {
      return { workId: ancestor.workId, branch: branchNameIn(input.cascade, ancestor, prefixes) };
    }
  }
  return undefined;
}

/**
 * What to hand `ChangeControlPort.open` for a work item.
 *
 * The whole point of the module, from the runtime's side: a branch named after the ticket, and a
 * base ONLY when the work belongs under a collection. Omitting `base` is how a caller says "the
 * usual place" — see `integrationFor` for why that is the right silence rather than a gap.
 */
export function changeContextFor(input: {
  readonly cascade: Cascade;
  readonly workId: string;
  readonly prefixes?: Readonly<Partial<Record<WorkType, string>>>;
  readonly collectsAt?: number;
  /** The organization's SDLC settings. See `ProcessSetting`. */
  readonly settings?: readonly SettingBinding[];
}): { readonly branch: string; readonly base?: string } | undefined {
  const node = nodeById(input.cascade, input.workId);
  if (node === undefined) return undefined;
  const branch = branchNameIn(input.cascade, node, input.prefixes ?? DEFAULT_BRANCH_PREFIXES);
  const under = integrationFor(input);
  return under === undefined ? { branch } : { branch, base: under.branch };
}

/**
 * The collections whose integration branch is ready to reach the trunk.
 *
 * ── WHY THIS IS A QUERY AND NOT A RULE IN THE RUNTIME ────────────────────────
 * A feature branch that nothing merges is worse than no feature branch: the stories land on it,
 * the run reports them delivered, and the trunk never sees any of it. So the collection needs a
 * merge of its own — and WHEN is not a new concept, it is two facts the cascade already holds:
 *
 *   - the collection is DONE, which for a non-leaf means its own gate chain passed, and
 *   - every code-producing item under it is done too.
 *
 * The second is not implied by the first and is checked rather than trusted. `gate-demand` blocks
 * a rung's LAST gate until its children are delivered, so the two agree in a healthy run — but a
 * collection marked done over an unfinished child is exactly the disagreement this register
 * exists to catch, and merging on it would put half a feature on the trunk.
 */
export function collectionsReadyToLand(input: {
  readonly cascade: Cascade;
  readonly prefixes?: Readonly<Partial<Record<WorkType, string>>>;
  readonly collectsAt?: number;
  /** The organization's SDLC settings. See `ProcessSetting`. */
  readonly settings?: readonly SettingBinding[];
}): readonly IntegrationBranch[] {
  const at = input.collectsAt ?? COLLECTS_AT;
  const prefixes = input.prefixes ?? DEFAULT_BRANCH_PREFIXES;
  const out: IntegrationBranch[] = [];
  const settings = input.settings ?? [];
  for (const node of input.cascade.nodes) {
    // WHETHER THIS RUNG CARRIES A BRANCH AT ALL. `direct` needs no separate skip here: a shielded
    // collection is named by none of its children, and the check below already excludes it. A
    // mutation removing an explicit `direct` case changed nothing, so there is no explicit case.
    const said = dispositionOf(node, settings);
    if (said !== "collect" && !collects(input.cascade, node, at)) continue;
    // A collection nobody routed work under has no branch to land. `integrationFor` is the
    // authority on that, so it is ASKED rather than re-derived: a collection that collects but
    // that no leaf named would otherwise be merged from a branch that was never created.
    const named = descendantsOf(input.cascade, node.workId).some(
      (d) => producesCode(d.workType) && integrationFor({ ...input, workId: d.workId })?.workId === node.workId,
    );
    if (!named) continue;
    if (node.state !== WorkState.Done) continue;
    const unfinished = descendantsOf(input.cascade, node.workId).filter(
      (d) => producesCode(d.workType) && d.state !== WorkState.Done,
    );
    if (unfinished.length > 0) continue;
    out.push({ workId: node.workId, branch: branchNameIn(input.cascade, node, prefixes), base: "" });
  }
  return out;
}

/** Whether a plan is a plan or a refusal, without the caller reaching for a field that may not be there. */
export function isBranchPlan(v: BranchPlan | { readonly reason: string }): v is BranchPlan {
  return (v as BranchPlan).branch !== undefined;
}
