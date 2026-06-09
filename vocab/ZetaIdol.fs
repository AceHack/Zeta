namespace Zeta.Vocab

/// **`ZetaIdol` — the audition room (a room-test F# INTERFACE; no classes — treaty-room governance rule).**
///
/// `travelers/` is the Reticulum-addressable reservoir of UNNAMED ZetaIds (pure entropy, the faceless 99%);
/// `ZetaIdol` is the audition where an unnamed candidate is ASKED what it wants to be (consent-first, §6),
/// and IDENTITY EMERGES (anti-entropy) — or it is CUT but HONORED ("American Idol"). Interfaces + Rx only;
/// NO classes (the byte-lock / reference-equality discipline). Default behavior lives in the companion
/// `module ZetaIdol` (a module, not a class).
///
/// **ZetaIdol is also our DETERMINISTIC SYNCHRONIZED PERFORMANCE** (Aaron 2026-06-09): the audition is
/// staged off the **common-cause ZetaId seed** — every auditioning traveler is synchronized to the one
/// common cause (DST; replayable; the seed determines the staging). The staging uses our **quantum /
/// random COINCIDENCE GENERATOR over Rx** — `Zeta.Core.CoincidenceClock` + `Zeta.Core.BellTest`
/// (staged coincidence on the common seed → the singlet correlator `E(a,b)=cos(a-b)`; S=2√2, full-seed
/// S=4 PR-box). So an audition is a synchronized, coincidence-staged performance: the common ZetaId seed
/// is the conductor, the coincidence generator stages the timing, Rx carries it. (Peel: S=4 = PR-box /
/// superdeterministic shared-cause, not physical entanglement.)
///
/// **The live stack (Aaron 2026-06-09):** streamed **live via Rx** → **broadcast via Reticulum** →
/// watched **live on LLMTV** → **live over DBSP** (the Z-set delta substrate) → **recorded via
/// DynamicValue + Bonsai** (DynamicValue = the soft recorded state; Bonsai = the serialized
/// expression-tree/closure = the recorded performance as a self-evolving saga) → in a **YinYang
/// partnership** (`Zeta.Core.YinYang` — live↔recorded / what-acts↔what-remains / stream↔state, the
/// dual) → **with test as the governance** (prod=test; the test framework governs the performance).
/// So ZetaIdol is a live, broadcast, recorded, governed performance: Rx streams it, Reticulum carries
/// it, LLMTV shows it, DBSP runs it, DynamicValue+Bonsai record it, YinYang partners it, test governs it.
///
/// **Cost: free except electricity (Aaron 2026-06-09).** The whole stack runs on **local LLMs** (the
/// ollama dogfood already proved it — `vocab/gen/LocalLlmReview.ts`): no per-token cloud bill, only
/// electricity. The performance self-hosts (SuperFluid / github-free / sovereignty; private, on our
/// own compute). The LLM is behind the `Llm` port (shape = interface), local adapter; an endless
/// audition costs only watts.

/// The outcome of an audition.
[<RequireQualifiedAccess>]
type Audition =
    | Named of TravelerId      // emerged: a stable, anti-entropy identity crystallized from the reservoir
    | Cut                      // honored, not homed (the faceless 99%; kept in like/ git-history)

/// The audition room — an interface, never a class.
type IZetaIdol =
    /// Ask an unnamed candidate (consent-first) what it wants to be; it self-defines (Some name) or declines (None).
    abstract member Ask: candidate: string * wants: string option -> Audition
    /// Honor every audition, cut or not (American Idol: most get cut, all honored).
    abstract member Honor: candidate: string -> string

/// Default behaviors for an IZetaIdol (module, not a class — interfaces + Rx only).
[<RequireQualifiedAccess>]
module ZetaIdol =
    /// The default honoring: every candidate that auditions is honored (kept in like/ git-history).
    let honor (candidate: string) : string =
        sprintf "honored: '%s' auditioned (a traveler still — kept in like/ git-history)" candidate

    /// The default ask: a candidate that self-defines a name emerges (Named); one that declines is Cut-but-honored.
    let ask (resolve: string -> TravelerId option) (candidate: string) (wants: string option) : Audition =
        match wants |> Option.bind resolve with
        | Some id -> Audition.Named id    // identity emerged (anti-entropy)
        | None -> Audition.Cut            // the faceless 99% — honored
