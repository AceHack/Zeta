/**
 * state-du.ts — the state DU's NON-VISUAL channel, in ONE place.
 *
 * `zeta-state.css` owns the colour. It cannot own the rest: a screen reader, a plain-text
 * export, a commit comment and a terminal all render the same DU and none of them has a hue.
 * A distinction carried only by hue is not a distinction, so every member also carries a glyph,
 * an ASCII fallback, a label and a sentence — and they live here so the CSS and every text
 * renderer read one source of truth rather than two that drift.
 *
 * THE THREE CLAIM CLASSES. Every member is a claim, and there are exactly three kinds:
 *   observation — "we watched, and here is what we saw"      live · stale · cold · heat
 *   model       — "no valid configuration includes this"     unavailable
 *   withheld    — "something is here you may not see, or we never measured it"
 *                                                            unobserved · sealed · frost
 * ABSENT ("not applicable here") is deliberately not a member: see `ABSENT_IS_NOT_A_MEMBER`.
 *
 * ORIGIN. Aaron's ~2003 FATX renamer: *"my UI had tons of options that all composed with each
 * other or greyed out the conflicting options"* / *"it's very hard to find the grey."* The
 * enabled set is free — it is just the feature list. The disabled set costs, because the
 * conflicts live in the interactions and there are 2^n of them. The grey is the negative space
 * of the design and that negative space IS the model. Which yields the carved consequence this
 * file exists to make mechanically checkable:
 *
 *     grey must say "this cannot be", never "this is not for you."
 *
 * Anchor: feature modelling / software product lines — Kang et al., FODA (CMU/SEI-90-TR-021,
 * 1990), feature diagrams with `requires` / `excludes` edges; the modern descendants are the
 * SAT-backed configurators (Linux `Kconfig`, Eclipse p2, package-dependency resolvers). Greying
 * an option correctly is asking "is any satisfying assignment still reachable if I set this?"
 */

/** Which kind of claim a member makes. The reason the DU cannot be a flat list of colours. */
export type ClaimClass = "observation" | "model" | "withheld";

/**
 * How a member must appear to assistive technology.
 *
 * `disabled` is NOT an option and never will be: the bare HTML `disabled` attribute removes a
 * control from the tab order, so a keyboard or screen-reader user cannot reach it to learn why
 * it cannot be. An unreachable explanation is the accessibility form of the vacuity class.
 */
export type AriaTreatment =
  /** `aria-disabled="true"` + a reachable reason. Never `disabled`, never `aria-hidden`. */
  | "aria-disabled"
  /** Label only. Not disabled — unmeasured is not impossible. */
  | "labelled"
  /** Content node `aria-hidden="true"`, wrapper labelled. The blur must not be spoken through. */
  | "content-hidden";

export interface StateMember {
  /** The attribute value. The case IS the attribute (homoiconic discipline). */
  readonly id: string;
  /** `data-state` for observation+model, `data-withheld` for the withheld register. */
  readonly attribute: "data-state" | "data-withheld";
  readonly claim: ClaimClass;
  /** The CSS custom property carrying this member's colour. */
  readonly token: string;
  /** Compact visual marker. Decorative in HTML (`aria-hidden`); meaning-bearing in a terminal. */
  readonly glyph: string;
  /** Pure-ASCII fallback for ASCII-only surfaces (notebooks, logs, plain diffs). */
  readonly ascii: string;
  /** The accessible name. Short, and it is what a screen reader says. */
  readonly label: string;
  /** The reason, reachable by the user. This is the part the FATX finding is actually about. */
  readonly sentence: string;
  readonly aria: AriaTreatment;
}

/**
 * The DU. Order is the cascade order in `zeta-state.css`: observation, then model, then
 * withheld — withheld last because it outranks, and it outranks because claiming IMPOSSIBLE
 * about something merely private is a false statement about the world made by the interface,
 * and frost is earned, permanent and inviolable.
 */
export const STATE_DU: readonly StateMember[] = [
  {
    id: "live",
    attribute: "data-state",
    claim: "observation",
    token: "--state-live",
    glyph: "●",
    ascii: "(*)",
    label: "live",
    sentence: "producing on cadence",
    aria: "labelled",
  },
  {
    id: "stale",
    attribute: "data-state",
    claim: "observation",
    token: "--state-stale",
    glyph: "◐",
    ascii: "(~)",
    label: "stale",
    sentence: "aging past its declared cadence; not an alarm",
    aria: "labelled",
  },
  {
    id: "cold",
    attribute: "data-state",
    claim: "observation",
    token: "--state-cold",
    glyph: "○",
    ascii: "( )",
    label: "cold",
    sentence: "watched, and nothing is there",
    aria: "labelled",
  },
  {
    id: "heat",
    attribute: "data-state",
    claim: "observation",
    token: "--state-heat",
    glyph: "◆",
    ascii: "(!)",
    label: "heat",
    sentence: "active failures",
    aria: "labelled",
  },
  {
    id: "unavailable",
    attribute: "data-state",
    claim: "model",
    token: "--state-unavailable",
    glyph: "∅",
    ascii: "(x)",
    label: "unavailable",
    // The sentence is load-bearing, not flavour: it is what stops the reader concluding that
    // their permissions are the problem. It says what the world permits, and says nothing
    // whatsoever about who they are.
    sentence: "no valid configuration includes this",
    aria: "aria-disabled",
  },
  {
    id: "unobserved",
    attribute: "data-withheld",
    claim: "withheld",
    token: "--state-withheld",
    // SQUARE, not a circle: the base form carries the CLAIM CLASS. See THE BASE-FORM RULE below.
    // Empty, because nothing was measured — there is nothing in the box.
    glyph: "□",
    ascii: "(?)",
    label: "unobserved",
    sentence: "no measurement was written here",
    aria: "labelled",
  },
  {
    id: "sealed",
    attribute: "data-withheld",
    claim: "withheld",
    token: "--state-withheld",
    // Partial: something exists here, it just has no operational content yet.
    glyph: "▨",
    ascii: "(#)",
    label: "sealed",
    sentence: "there is nothing operational to say here yet",
    aria: "labelled",
  },
  {
    id: "frost",
    attribute: "data-withheld",
    claim: "withheld",
    token: "--state-withheld",
    // Full: content IS present and is fully withheld. The most-filled mark in the register,
    // because it is the only member with something actually behind it.
    glyph: "■",
    ascii: "(/)",
    label: "withheld",
    // Deliberately does not name what is behind it, and deliberately does not apologise for it.
    // Frost is earned; the interface reports it as a fact, not as a denial.
    sentence: "present, and deliberately withheld by its owner",
    aria: "content-hidden",
  },
] as const;

/**
 * THE BASE-FORM RULE — why the withheld register is squares and the observations are circles.
 *
 * Added 2026-08-19 after `audit-visual-confusability.ts` found that four of these glyphs
 * collided in pairs, and that BOTH pairs crossed the observation/withheld boundary this file
 * exists to hold: `cold` U+25CB and `unobserved` U+25CC both reduced to an empty ring, and
 * `stale` U+25D0 and `sealed` U+25CD both reduced to a half-filled ring.
 *
 * The test below asserting glyph uniqueness was passing throughout, because it compares
 * CODEPOINTS. U+25CB and U+25CC are different strings and the same ring. A codepoint check is
 * the machine's comparison and the machine is not the reader at risk.
 *
 * THE RULE, and it is not a preference — it falls out of a capacity bound. The mark alphabet is
 * SCARCE: under the perceptual quotient in `hygiene/visual-skeleton.ts` there are roughly 36
 * reachable cells, so base-form separation has to be spent on the boundaries that must never be
 * confused rather than spread evenly.
 *
 *     BASE FORM carries the CLAIM CLASS.  FILL FRACTION carries the gradation WITHIN a class.
 *
 *   observation -> CIRCLE    live ● full · stale ◐ partial · cold ○ empty
 *   observation -> DIAMOND   heat ◆  — deliberately breaks form; the alarm should not be a
 *                            degree of the others, and Bertin's nominal channel is the right
 *                            place to say so
 *   model       -> STRUCK    unavailable ∅ — a full-diameter strike survives blur, which is why
 *                            it does not collide with cold ○ despite sharing a silhouette
 *   withheld    -> SQUARE    unobserved □ empty · sealed ▨ partial · frost ■ full
 *
 * The withheld register's fill fraction tracks HOW MUCH IS ACTUALLY THERE, which is the honest
 * ordering: nothing was measured (empty) -> something exists with no operational content yet
 * (partial) -> content is present and deliberately withheld (full). `frost` is the most-filled
 * mark in the register because it is the only member with something behind it.
 *
 * Note this improves on the fix originally proposed in work-item 081M0DN91RK087G0R002X8MBWM,
 * which assigned `sealed` U+25A9 and left `sealed`/`frost` colliding as a within-class WARNING.
 * Ordering the register by fill removes that too, so the DU now has zero collisions of any
 * grade rather than zero errors and one warning.
 *
 * Anchor: Bertin, *Sémiologie Graphique* (1967) — shape is a NOMINAL visual variable and value
 * is an ORDERED one, which is exactly the pairing above: a categorical difference on the
 * categorical channel, a gradation on the ordered one.
 *
 * Register: the collision detection is METERED (`audit-visual-confusability.ts` fires on
 * controls, and went red on these four glyphs before this change). That a reader confuses ○ and
 * ◌ at 12px is UNMETERED — it is the quotient table's modelled claim, and no perceptual
 * threshold has been measured. See that file's REGISTER section.
 */
export const BASE_FORM_CARRIES_THE_CLAIM_CLASS =
  "base form carries the claim class; fill fraction carries the gradation within it" as const;

/**
 * ABSENT is not a member, and that is a rule rather than an oversight.
 *
 * The correct rendering of "not applicable here" is nothing: it is not in the DOM and not in the
 * text. The tempting error is to reach for `unobserved`, which files an inapplicable thing under
 * the WITHHELD register and so tells the reader something is being kept from them when there is
 * nothing to keep. If a surface needs a token for absent, the model is wrong, not the palette.
 */
export const ABSENT_IS_NOT_A_MEMBER = "absent is not a state: an inapplicable thing does not render at all" as const;

export type StateId = (typeof STATE_DU)[number]["id"];

const BY_ID = new Map(STATE_DU.map((m) => [m.id, m]));

/**
 * Look a member up. Returns `undefined` rather than a default on purpose: the CSS fail-safe
 * (unknown reads cold) is a *paint* decision, and silently substituting `cold` in a text
 * renderer would mint an observation ("we watched, nothing there") that nobody made.
 */
export function stateMember(id: string): StateMember | undefined {
  return BY_ID.get(id);
}

export interface RenderTextOptions {
  /** ASCII-only surfaces (notebooks under BP-09, logs, plain diffs). Default false. */
  readonly ascii?: boolean;
  /** Append the reason. Default true — the reason is the point. */
  readonly withReason?: boolean;
}

/**
 * Render a member for a terminal, a log line, or any surface with no colour at all.
 *
 * This is the falsifier for "a distinction carried only by hue is not a distinction": strip the
 * hue and the three grey-adjacent members must still read as three different things.
 */
export function renderStateText(id: string, options: RenderTextOptions = {}): string {
  const member = stateMember(id);
  // `unknown` is a LOOKUP FAILURE, not a DU member, so it deliberately takes a base form no
  // member uses (diamond/empty — `heat` is the only diamond and it is full). It used to render
  // as U+25CC, which under the base-form rule is now `cold`'s silhouette: a failed lookup would
  // have drawn itself as the observation "watched, and nothing is there".
  if (member === undefined) return options.ascii === true ? "(?) unknown" : "◇ unknown";
  const mark = options.ascii === true ? member.ascii : member.glyph;
  const head = `${mark} ${member.label}`;
  return options.withReason === false ? head : `${head} - ${member.sentence}`;
}

/**
 * The ARIA attributes a member requires on its wrapper, as a plain record a renderer can spread.
 *
 * `unavailable` gets `aria-disabled`, never the bare `disabled` attribute and never `aria-hidden`
 * — an impossible option a user cannot reach is indistinguishable from one that was never
 * offered, which is precisely the confusion the model register exists to remove.
 */
export function ariaAttributesFor(id: string): Readonly<Record<string, string>> {
  const member = stateMember(id);
  if (member === undefined) return {};
  const label = `${member.label} - ${member.sentence}`;
  switch (member.aria) {
    case "aria-disabled":
      return { "aria-disabled": "true", "aria-label": label };
    case "content-hidden":
      // The wrapper speaks; the blurred content node must carry aria-hidden="true" separately.
      // A blur a screen reader reads through is not frost, it is a smudge.
      return { "aria-label": label };
    case "labelled":
      return { "aria-label": label };
  }
}
