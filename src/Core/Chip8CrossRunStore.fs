namespace Zeta.Core

/// **`Chip8CrossRunStore` — the CROSS-RUN half of CHIP-8 self-simulation (Aaron 2026-08-17).**
///
/// `SoftChip8.lookAhead` already answers *"where is this machine `n` steps from now"* **within one run**.
/// This module is the other half: it writes run 1's computed trajectory down as **text**, so run 2 can
/// *consult* it at step 0 instead of recomputing it.
///
/// **Register discipline — read this before naming anything in here.** Aaron's framing is that the first
/// run "can affect the start of the 2nd run" in a *"2nd retrocausal way"*. That is the **Mirror** register
/// and it is his word, quoted in the design doc. The **Beacon** register — what this code actually does —
/// is **memoization of a deterministic transition function over a finite state space**. Nothing propagates
/// backward in time; a previous run's *computed* results are *stored* and later *read*. No identifier or
/// comment in this module claims physical retrocausality, and none may acquire one.
///
/// **Anchors (checked, not gestured at):**
///   - Michie, *"Memo functions and machine learning"*, Nature 218, 19-22 (1968) — the memo table.
///   - Eventual periodicity: for finite `S` and any `f : S -> S`, the orbit of `s0` has a tail `mu` and a
///     cycle `lambda` with `mu + lambda <= |S|` (pigeonhole + determinism). The "rho" shape.
///   - Brent, *"An improved Monte Carlo factorization algorithm"*, BIT 20, 176-184 (1980) SS7 — the
///     `(mu, lambda)` detector used by `orbit`, in O(1) memory.
///
/// **The tractability boundary is REAL and is recorded, not assumed.** CHIP-8's configuration space is
/// astronomically large (4096 bytes of memory alone); what is tractable is walking ONE orbit, not
/// enumerating the space. And some orbits provably do not close: `Chip8Cow`'s `Rng` is a 2^64 additive
/// counter carried *inside* the frame, so a ROM executing `CXNN` in a loop cannot revisit a state until
/// that counter wraps. Measured: `C0FF 1200` shows no repeat in 10^6 steps. Hence `Verdict.OpenAtBound`.
///
/// **The budget is an oracle, so it is injected and attributed** (Aaron 2026-08-17: *"always be on the
/// lookout where the measurement or the limit/budget becomes the oracle silently"*). There is no default
/// step bound in this module. `PrecomputeBudget` carries a mandatory `Attribution`, an empty one is
/// **refused before any work happens**, and the budget is written into the artifact so a later reader can
/// see which limit produced the result. Budget exhaustion is a *distinct constructor* from closure, so a
/// bound can never be silently promoted into a claim about the machine.
///
/// **Noninterference (SS13): this module performs ZERO file IO.** The store reaches a room as an injected
/// `Reader`; a room never fetches one. That keeps the memo a declared channel rather than an ambient side
/// door, and it is what keeps DST replay intact.
[<RequireQualifiedAccess>]
module Chip8CrossRunStore =

    open System
    open System.Globalization
    open System.Text
    open System.Text.Json

    /// Bump when `Chip8Cow.step`'s behaviour changes: it is part of the run key, because a memo table
    /// keyed without the identity of the function it memoizes is a correctness bug awaiting a refactor.
    [<Literal>]
    let StepMapVersion = "chip8cow-step-v1"

    [<Literal>]
    let Schema = "zeta.chip8.cross-run-orbit.v1"

    /// Result-over-exception: every refusal is one of these, never a throw.
    type Feedback =
        /// The budget arrived with no attribution — refused before any work (the hidden-oracle guard).
        | BudgetUnattributed
        | BudgetNotPositive of maxSteps: int
        | UnknownSchema of found: string
        | MalformedArtifact of detail: string
        | MalformedSnapshot of detail: string
        /// The body digest did not match the body — the store is corrupt and is refused, never trusted.
        | DigestMismatch of expected: string * actual: string
        /// A step beyond the recorded prefix was asked of an orbit that never closed. Answering would mean
        /// treating the precompute budget as a fact about the machine.
        | NotClosedAtBound of maxSteps: int * attribution: string
        | NegativeStep of step: int

    /// How the deterministic segment ended. `AwaitingInput` is NOT a halt: `Chip8Cow` models `FX0A` as a
    /// no-advance wait, so a blocked machine is a literal fixed point of the pure step map. Two of the five
    /// committed ROMs end this way, and calling that a "cycle of length 1" without saying why would be a
    /// store that lies by omission.
    type TerminalKind =
        | Halt
        | AwaitingInput
        | Cycle

    /// The orbit verdict. Two constructors, deliberately: **budget exhaustion is not closure**, and the
    /// type is what makes that confusion unrepresentable rather than merely discouraged.
    type Verdict =
        /// `mu` = tail length, `lambda` = cycle length, both OBSERVED.
        | Closed of mu: int * lambda: int * terminal: TerminalKind
        /// The walk hit the injected bound without ever revisiting a state. Says nothing about whether a
        /// cycle exists further out.
        | OpenAtBound of maxSteps: int

    /// The precompute bound. No default is offered anywhere in this module, on purpose.
    type PrecomputeBudget =
        { MaxSteps: int
          /// Who set this bound and why. Empty is refused.
          Attribution: string }

    /// Content-derived; no wall clock, no counter, no path (`local-time-never-enters-the-shared-fold`).
    type RunKey =
        { RomSha256: string
          Seed: uint64
          LoadAddr: int
          Dialect: string
          StepMapVersion: string }

    type Checkpoint =
        { Step: int
          StateDigest: string
          /// Full canonical frame text. Present on strided checkpoints; absent rows are digest-only.
          Snapshot: string option }

    type Artifact =
        { Schema: string
          Key: RunKey
          Budget: PrecomputeBudget
          Verdict: Verdict
          Checkpoints: Checkpoint list
          /// First step at which `Frame.Fault` became set, if ever. A fault is recorded, not fatal.
          FirstFaultStep: int option
          /// SHA-256 over the canonical body — the reader's refusal test.
          BodyDigest: string }

    /// The injected read port (SS13). A room RECEIVES one of these; it never constructs one by reaching
    /// out to a filesystem. IO adapters live outside this module.
    type Reader = { TryGet: RunKey -> Artifact option }

    /// A reader that knows nothing — the honest default for a room with no store injected.
    let emptyReader: Reader = { TryGet = fun _ -> None }

    // ── hex / canonical text ────────────────────────────────────────────────────────────────────────

    let private hex2 (b: byte) : string = b.ToString("x2", CultureInfo.InvariantCulture)
    let private hex4 (v: int) : string = (v &&& 0xFFFF).ToString("x4", CultureInfo.InvariantCulture)
    let private hex16 (v: uint64) : string = v.ToString("x16", CultureInfo.InvariantCulture)
    let private inv (n: int) : string = n.ToString(CultureInfo.InvariantCulture)

    let private hexBytes (bs: byte[]) : string =
        let sb = StringBuilder(bs.Length * 2)
        for b in bs do sb.Append(hex2 b) |> ignore
        sb.ToString()

    let private parseHexByte (s: string) : byte option =
        match Byte.TryParse(s, NumberStyles.HexNumber, CultureInfo.InvariantCulture) with
        | true, v -> Some v
        | _ -> None

    let private parseHexInt (s: string) : int option =
        match Int32.TryParse(s, NumberStyles.HexNumber, CultureInfo.InvariantCulture) with
        | true, v -> Some v
        | _ -> None

    let private parseHexU64 (s: string) : uint64 option =
        match UInt64.TryParse(s, NumberStyles.HexNumber, CultureInfo.InvariantCulture) with
        | true, v -> Some v
        | _ -> None

    let private parseDec (s: string) : int option =
        match Int32.TryParse(s, NumberStyles.Integer, CultureInfo.InvariantCulture) with
        | true, v -> Some v
        | _ -> None

    let private allHex (s: string) : bool =
        s |> Seq.forall (fun c -> (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'))

    /// SHA-256 as lowercase hex.
    let sha256Hex (bytes: byte[]) : string =
        use h = System.Security.Cryptography.SHA256.Create()
        h.ComputeHash bytes |> hexBytes

    let private sha256Text (s: string) : string = sha256Hex (Encoding.UTF8.GetBytes s)

    // ── canonical frame codec (hex-in-text; `no-binary-in-proof-lineage`) ───────────────────────────

    /// Canonical, diffable, culture-invariant text for a frame. Sparse maps stay sparse (a real ROM's
    /// snapshot is small), addresses sort NUMERICALLY (culture-free by construction), and the fault string
    /// is hex-encoded so no free text can inject a delimiter.
    let encodeFrame (f: Chip8Cow.Frame) : string =
        let sparseBytes (m: Map<int, byte>) =
            m
            |> Map.toList
            |> List.sortBy fst
            |> List.map (fun (a, b) -> hex4 a + ":" + hex2 b)
            |> String.concat ","

        let litPixels =
            f.Display
            |> Map.toList
            |> List.filter snd
            |> List.map fst
            |> List.sort
            |> List.map hex4
            |> String.concat ","

        let sb = StringBuilder()
        sb.Append("f1") |> ignore
        sb.Append("|pc=").Append(hex4 (int f.PC)) |> ignore
        sb.Append("|i=").Append(hex4 (int f.I)) |> ignore
        sb.Append("|dl=").Append(hex2 f.Delay) |> ignore
        sb.Append("|sn=").Append(hex2 f.Sound) |> ignore
        sb.Append("|pl=").Append(hex2 f.Plane) |> ignore
        sb.Append("|rng=").Append(hex16 f.Rng) |> ignore
        sb.Append("|v=").Append(hexBytes f.V) |> ignore
        sb.Append("|k=").Append(f.Keys |> Array.map (fun k -> if k then "1" else "0") |> String.concat "")
        |> ignore
        sb.Append("|st=").Append(f.Stack |> List.map (fun s -> hex4 (int s)) |> String.concat ",") |> ignore
        sb.Append("|mem=").Append(sparseBytes f.Mem) |> ignore
        sb.Append("|dsp=").Append(litPixels) |> ignore
        sb.Append("|xtr=").Append(sparseBytes f.Extra) |> ignore
        sb.Append("|flt=")
            .Append(
                match f.Fault with
                | None -> ""
                | Some t -> hexBytes (Encoding.UTF8.GetBytes t)
            )
        |> ignore
        sb.ToString()

    /// The state digest — the memo's lookup key for "have I been here before?".
    let frameDigest (f: Chip8Cow.Frame) : string = sha256Text (encodeFrame f)

    let private splitPairs (section: string) : Result<(int * byte) list, Feedback> =
        if String.IsNullOrEmpty section then
            Ok []
        else
            let mutable err = None
            let acc =
                section.Split(',')
                |> Array.choose (fun kv ->
                    let parts = kv.Split(':')
                    if parts.Length <> 2 then
                        err <- Some(MalformedSnapshot("bad pair: " + kv))
                        None
                    else
                        match parseHexInt parts.[0], parseHexByte parts.[1] with
                        | Some a, Some b -> Some(a, b)
                        | _ ->
                            err <- Some(MalformedSnapshot("bad pair: " + kv))
                            None)
                |> List.ofArray
            match err with
            | Some e -> Error e
            | None -> Ok acc

    /// Round-trip a canonical frame text back to a `Frame`. Refuses anything malformed.
    let decodeFrame (text: string) : Result<Chip8Cow.Frame, Feedback> =
        let fields =
            text.Split('|')
            |> Array.choose (fun s ->
                let i = s.IndexOf('=')
                if i < 0 then None else Some(s.Substring(0, i), s.Substring(i + 1)))
            |> Map.ofArray

        let get k =
            match Map.tryFind k fields with
            | Some v -> Ok v
            | None -> Error(MalformedSnapshot("missing field: " + k))

        let req name parser =
            get name
            |> Result.bind (fun v ->
                match parser v with
                | Some x -> Ok x
                | None -> Error(MalformedSnapshot("bad " + name + ": " + v)))

        let fixedWidth name width =
            get name
            |> Result.bind (fun v ->
                if v.Length = width then
                    Ok v
                else
                    Error(MalformedSnapshot(name + " must be " + inv width + " chars")))

        /// An even-length, all-lowercase-hex string decoded to bytes. Refuses rather than defaulting:
        /// a snapshot with a corrupt nibble must fail loudly, never decode to a plausible wrong frame.
        let hexPayload name (v: string) =
            if v.Length % 2 <> 0 || not (allHex v) then
                Error(MalformedSnapshot("not hex: " + name))
            else
                Ok(Array.init (v.Length / 2) (fun n -> (parseHexByte (v.Substring(n * 2, 2))).Value))

        let hexList name =
            get name
            |> Result.bind (fun v ->
                if String.IsNullOrEmpty v then
                    Ok []
                else
                    let parts = v.Split(',') |> List.ofArray
                    if parts |> List.forall (fun s -> (parseHexInt s).IsSome) then
                        Ok(parts |> List.map (fun s -> (parseHexInt s).Value))
                    else
                        Error(MalformedSnapshot("bad hex list: " + name)))

        if not (text.StartsWith("f1|", StringComparison.Ordinal)) then
            Error(MalformedSnapshot "bad frame prefix")
        else
            result {
                let! pc = req "pc" parseHexInt
                let! i = req "i" parseHexInt
                let! dl = req "dl" parseHexByte
                let! sn = req "sn" parseHexByte
                let! pl = req "pl" parseHexByte
                let! rng = req "rng" parseHexU64
                let! vs = fixedWidth "v" 32
                let! ks = fixedWidth "k" 16
                let! stack = hexList "st"
                let! dsp = hexList "dsp"
                let! mem = get "mem" |> Result.bind splitPairs
                let! xtr = get "xtr" |> Result.bind splitPairs
                let! flt = get "flt"

                let! v = hexPayload "v" vs
                let! faultBytes = hexPayload "flt" flt

                return
                    { Chip8Cow.Frame.Mem = Map.ofList mem
                      V = v
                      I = uint16 i
                      PC = uint16 pc
                      Stack = stack |> List.map uint16
                      Delay = dl
                      Sound = sn
                      Display = dsp |> List.map (fun p -> p, true) |> Map.ofList
                      Keys = Array.init 16 (fun n -> ks.[n] = '1')
                      Rng = rng
                      Plane = pl
                      Extra = Map.ofList xtr
                      Fault =
                        if faultBytes.Length = 0 then
                            None
                        else
                            Some(Encoding.UTF8.GetString faultBytes) }
            }

    // ── the run key ────────────────────────────────────────────────────────────────────────────────

    /// Build the run key from the ROM bytes (content-derived identity).
    let runKey (rom: byte[]) (seed: uint64) (loadAddr: int) (dialect: string) : RunKey =
        { RomSha256 = sha256Hex rom
          Seed = seed
          LoadAddr = loadAddr
          Dialect = dialect
          StepMapVersion = StepMapVersion }

    /// The key's canonical text — also the basis of the artifact filename. Content-addressed, so two
    /// writers producing the same key produce the same name (idempotency #6, lock-free #2).
    let keyText (k: RunKey) : string =
        String.concat
            "|"
            [ "k1"
              "rom=" + k.RomSha256
              "seed=" + hex16 k.Seed
              "load=" + hex4 k.LoadAddr
              "dialect=" + k.Dialect
              "stepmap=" + k.StepMapVersion ]

    /// `<first-16-hex-of-key-digest>.orbit.json` — no wall clock, no counter, no path in the name.
    let artifactFileName (k: RunKey) : string =
        (sha256Text (keyText k)).Substring(0, 16) + ".orbit.json"

    // ── precompute (the run-1 side) ────────────────────────────────────────────────────────────────

    let private terminalOf (f: Chip8Cow.Frame) (lambda: int) : TerminalKind =
        if lambda > 1 then Cycle
        elif SoftChip8.branchesOnInput f then AwaitingInput
        else Halt

    /// Validate the injected budget. Refuses an unattributed bound BEFORE any work — the whole point of
    /// the hidden-oracle guard is that nothing gets computed under an anonymous limit.
    let validateBudget (b: PrecomputeBudget) : Result<PrecomputeBudget, Feedback> =
        if String.IsNullOrWhiteSpace b.Attribution then Error BudgetUnattributed
        elif b.MaxSteps <= 0 then Error(BudgetNotPositive b.MaxSteps)
        else Ok b

    /// Walk the orbit of the pure no-input step map, recording checkpoints every `stride` steps.
    ///
    /// Detection is by state digest in a dictionary (exact `(mu, lambda)` in one pass). Brent's O(1)-memory
    /// variant is the anchor for the *quantity*; the dictionary is the implementation, chosen because we are
    /// materialising the checkpoint rows anyway.
    let precompute
        (budget: PrecomputeBudget)
        (stride: int)
        (key: RunKey)
        (rom: byte[])
        : Result<Artifact, Feedback> =
        validateBudget budget
        |> Result.bind (fun budget ->
            if stride <= 0 then
                Error(MalformedArtifact "stride must be positive")
            else
                let f0 = Chip8Cow.create key.Seed |> Chip8Cow.loadRom rom
                let seen = System.Collections.Generic.Dictionary<string, int>(StringComparer.Ordinal)
                let checkpoints = ResizeArray<Checkpoint>()

                let record (step: int) (f: Chip8Cow.Frame) (digest: string) =
                    if step % stride = 0 then
                        checkpoints.Add
                            { Step = step
                              StateDigest = digest
                              Snapshot = Some(encodeFrame f) }

                let mutable f = f0
                let mutable step = 0
                let mutable firstFault = None
                let mutable verdict = None
                let d0 = frameDigest f0
                seen.[d0] <- 0
                record 0 f0 d0

                while verdict.IsNone do
                    f <- Chip8Cow.step f
                    step <- step + 1
                    if firstFault.IsNone && f.Fault.IsSome then firstFault <- Some step
                    let d = frameDigest f
                    match seen.TryGetValue d with
                    | true, firstAt ->
                        let mu = firstAt
                        let lambda = step - firstAt
                        verdict <- Some(Closed(mu, lambda, terminalOf f lambda))
                    | _ ->
                        seen.[d] <- step
                        record step f d
                        if step >= budget.MaxSteps then
                            verdict <- Some(OpenAtBound budget.MaxSteps)

                let body =
                    { Schema = Schema
                      Key = key
                      Budget = budget
                      Verdict = Option.get verdict
                      Checkpoints = List.ofSeq checkpoints
                      FirstFaultStep = firstFault
                      BodyDigest = "" }

                Ok body)

    // ── canonical JSON (hand-rolled writer ⇒ byte-stable; parser is System.Text.Json) ───────────────

    let private jsonEscape (s: string) : string =
        let sb = StringBuilder()
        for ch in s do
            match ch with
            | '"' -> sb.Append("\\\"") |> ignore
            | '\\' -> sb.Append("\\\\") |> ignore
            | '\n' -> sb.Append("\\n") |> ignore
            | '\r' -> sb.Append("\\r") |> ignore
            | '\t' -> sb.Append("\\t") |> ignore
            | c when c < ' ' -> sb.Append("\\u").Append(((int c).ToString("x4", CultureInfo.InvariantCulture))) |> ignore
            | c -> sb.Append(c) |> ignore
        sb.ToString()

    let private q (s: string) : string = "\"" + jsonEscape s + "\""

    let private terminalText (t: TerminalKind) =
        match t with
        | Halt -> "halt"
        | AwaitingInput -> "awaiting-input"
        | Cycle -> "cycle"

    /// The canonical body text that `BodyDigest` is taken over. Everything the reader must trust is in
    /// here; the digest field itself is not (it would be self-referential).
    let private bodyText (a: Artifact) : string =
        let verdictPart =
            match a.Verdict with
            | Closed(mu, lambda, t) ->
                String.concat
                    ","
                    [ "closed"; inv mu; inv lambda; terminalText t ]
            | OpenAtBound m -> String.concat "," [ "open-at-bound"; inv m ]

        let cps =
            a.Checkpoints
            |> List.map (fun c ->
                String.concat
                    ";"
                    [ inv c.Step
                      c.StateDigest
                      (match c.Snapshot with
                       | Some s -> s
                       | None -> "") ])
            |> String.concat "\n"

        String.concat
            "\n"
            [ "b1"
              a.Schema
              keyText a.Key
              "budget=" + inv a.Budget.MaxSteps + ";" + a.Budget.Attribution
              "verdict=" + verdictPart
              "fault="
              + (match a.FirstFaultStep with
                 | Some s -> inv s
                 | None -> "")
              "checkpoints:"
              cps ]

    /// Seal an artifact: compute the body digest. Idempotent — sealing a sealed artifact is a no-op in
    /// effect, because the digest is a pure function of the body and the body excludes the digest.
    let seal (a: Artifact) : Artifact =
        { a with BodyDigest = sha256Text (bodyText { a with BodyDigest = "" }) }

    /// Canonical JSON. Hand-rolled so the bytes are stable across runtimes and mergeable in a `git` diff.
    let toJson (a0: Artifact) : string =
        let a = seal a0
        let sb = StringBuilder()
        sb.AppendLine("{") |> ignore
        sb.AppendLine("  \"schema\": " + q a.Schema + ",") |> ignore
        sb.AppendLine("  \"note\": " + q "Memoized orbit of Chip8Cow.step. Beacon register: memoization over a finite-state deterministic map (Michie 1968; eventual periodicity by pigeonhole; Brent 1980 for (mu,lambda)). NOT physical retrocausality." + ",") |> ignore
        sb.AppendLine("  \"key\": {") |> ignore
        sb.AppendLine("    \"romSha256\": " + q a.Key.RomSha256 + ",") |> ignore
        sb.AppendLine("    \"seedHex\": " + q (hex16 a.Key.Seed) + ",") |> ignore
        sb.AppendLine("    \"loadAddrHex\": " + q (hex4 a.Key.LoadAddr) + ",") |> ignore
        sb.AppendLine("    \"dialect\": " + q a.Key.Dialect + ",") |> ignore
        sb.AppendLine("    \"stepMapVersion\": " + q a.Key.StepMapVersion) |> ignore
        sb.AppendLine("  },") |> ignore
        sb.AppendLine("  \"budget\": {") |> ignore
        sb.AppendLine("    \"maxSteps\": " + inv a.Budget.MaxSteps + ",") |> ignore
        sb.AppendLine("    \"attribution\": " + q a.Budget.Attribution) |> ignore
        sb.AppendLine("  },") |> ignore

        (match a.Verdict with
         | Closed(mu, lambda, t) ->
             sb.AppendLine("  \"verdict\": \"closed\",") |> ignore
             sb.AppendLine("  \"mu\": " + inv mu + ",") |> ignore
             sb.AppendLine("  \"lambda\": " + inv lambda + ",") |> ignore
             sb.AppendLine("  \"terminalKind\": " + q (terminalText t) + ",") |> ignore
         | OpenAtBound m ->
             sb.AppendLine("  \"verdict\": \"open-at-bound\",") |> ignore
             sb.AppendLine("  \"openAtSteps\": " + inv m + ",") |> ignore)

        sb.AppendLine(
            "  \"firstFaultStep\": "
            + (match a.FirstFaultStep with
               | Some s -> inv s
               | None -> "null")
            + ","
        )
        |> ignore

        sb.AppendLine("  \"checkpoints\": [") |> ignore
        let n = List.length a.Checkpoints
        a.Checkpoints
        |> List.iteri (fun i c ->
            let tail = if i = n - 1 then "" else ","
            sb.AppendLine(
                "    { \"step\": "
                + inv c.Step
                + ", \"stateDigest\": "
                + q c.StateDigest
                + ", \"snapshot\": "
                + (match c.Snapshot with
                   | Some s -> q s
                   | None -> "null")
                + " }"
                + tail
            )
            |> ignore)
        sb.AppendLine("  ],") |> ignore
        sb.AppendLine("  \"bodyDigest\": " + q a.BodyDigest) |> ignore
        sb.Append("}") |> ignore
        sb.ToString()

    let private prop (el: JsonElement) (name: string) : Result<JsonElement, Feedback> =
        match el.TryGetProperty name with
        | true, v -> Ok v
        | _ -> Error(MalformedArtifact("missing property: " + name))

    let private str (el: JsonElement) (name: string) : Result<string, Feedback> =
        prop el name
        |> Result.bind (fun v ->
            if v.ValueKind = JsonValueKind.String then
                Ok(v.GetString())
            else
                Error(MalformedArtifact("not a string: " + name)))

    let private intOf (el: JsonElement) (name: string) : Result<int, Feedback> =
        prop el name
        |> Result.bind (fun v ->
            match v.TryGetInt32() with
            | true, n -> Ok n
            | _ -> Error(MalformedArtifact("not an int: " + name)))

    let private verdictOf (root: JsonElement) : Result<Verdict, Feedback> =
        result {
            let! vtext = str root "verdict"

            if String.Equals(vtext, "closed", StringComparison.Ordinal) then
                let! mu = intOf root "mu"
                let! lam = intOf root "lambda"
                let! tk = str root "terminalKind"

                let! terminal =
                    match tk with
                    | "halt" -> Ok Halt
                    | "awaiting-input" -> Ok AwaitingInput
                    | "cycle" -> Ok Cycle
                    | other -> Error(MalformedArtifact("bad terminalKind: " + other))

                return Closed(mu, lam, terminal)
            elif String.Equals(vtext, "open-at-bound", StringComparison.Ordinal) then
                let! m = intOf root "openAtSteps"
                return OpenAtBound m
            else
                return! Error(MalformedArtifact("bad verdict: " + vtext))
        }

    let private keyOf (root: JsonElement) : Result<RunKey, Feedback> =
        result {
            let! keyEl = prop root "key"
            let! rom = str keyEl "romSha256"
            let! seedHex = str keyEl "seedHex"
            let! loadHex = str keyEl "loadAddrHex"
            let! dialect = str keyEl "dialect"
            let! smv = str keyEl "stepMapVersion"

            let! seed =
                match parseHexU64 seedHex with
                | Some v -> Ok v
                | None -> Error(MalformedArtifact("bad seedHex: " + seedHex))

            let! load =
                match parseHexInt loadHex with
                | Some v -> Ok v
                | None -> Error(MalformedArtifact("bad loadAddrHex: " + loadHex))

            return
                { RomSha256 = rom
                  Seed = seed
                  LoadAddr = load
                  Dialect = dialect
                  StepMapVersion = smv }
        }

    let private checkpointsOf (root: JsonElement) : Result<Checkpoint list, Feedback> =
        prop root "checkpoints"
        |> Result.bind (fun cpsEl ->
            if cpsEl.ValueKind <> JsonValueKind.Array then
                Error(MalformedArtifact "checkpoints not an array")
            else
                let mutable err = None
                let cps = ResizeArray<Checkpoint>()

                for c in cpsEl.EnumerateArray() do
                    match intOf c "step", str c "stateDigest" with
                    | Ok st, Ok d ->
                        let snap =
                            match c.TryGetProperty "snapshot" with
                            | true, v when v.ValueKind = JsonValueKind.String -> Some(v.GetString())
                            | _ -> None

                        cps.Add
                            { Step = st
                              StateDigest = d
                              Snapshot = snap }
                    | Error e, _
                    | _, Error e -> if err.IsNone then err <- Some e

                match err with
                | Some e -> Error e
                | None -> Ok(List.ofSeq cps))

    /// Parse + **verify**. A body whose digest does not match is REFUSED — a corrupt memo must never be
    /// silently consulted, because a wrong memo is worse than no memo (it is confident and wrong).
    let parse (json: string) : Result<Artifact, Feedback> =
        let parsed =
            try
                Ok(JsonDocument.Parse(json))
            with ex ->
                Error(MalformedArtifact ex.Message)

        parsed
        |> Result.bind (fun doc ->
            use doc = doc
            let root = doc.RootElement

            result {
                let! schema = str root "schema"

                if not (String.Equals(schema, Schema, StringComparison.Ordinal)) then
                    return! Error(UnknownSchema schema)
                else
                    let! key = keyOf root
                    let! budgetEl = prop root "budget"
                    let! maxSteps = intOf budgetEl "maxSteps"
                    let! attribution = str budgetEl "attribution"
                    let! verdict = verdictOf root
                    let! checkpoints = checkpointsOf root
                    let! stored = str root "bodyDigest"

                    let firstFault =
                        match root.TryGetProperty "firstFaultStep" with
                        | true, v when v.ValueKind = JsonValueKind.Number ->
                            match v.TryGetInt32() with
                            | true, n -> Some n
                            | _ -> None
                        | _ -> None

                    let a =
                        { Schema = schema
                          Key = key
                          Budget =
                            { MaxSteps = maxSteps
                              Attribution = attribution }
                          Verdict = verdict
                          Checkpoints = checkpoints
                          FirstFaultStep = firstFault
                          BodyDigest = "" }

                    let actual = (seal a).BodyDigest

                    if String.Equals(actual, stored, StringComparison.Ordinal) then
                        return { a with BodyDigest = stored }
                    else
                        return! Error(DigestMismatch(stored, actual))
            })

    // ── the run-2 side: consulting what run 1 computed ─────────────────────────────────────────────

    /// Reduce an absolute step index into the recorded prefix, using the cycle when one was OBSERVED.
    ///
    /// This is the finite description of an unbounded future: past `mu`, step `n` is step
    /// `mu + ((n - mu) mod lambda)`. Under `OpenAtBound` this REFUSES rather than guessing — answering
    /// there would mean treating the injected precompute budget as a fact about the machine, which is the
    /// hidden-oracle defect this design exists to avoid.
    let reduceStep (a: Artifact) (n: int) : Result<int, Feedback> =
        if n < 0 then
            Error(NegativeStep n)
        else
            match a.Verdict with
            | Closed(mu, lambda, _) -> if n < mu then Ok n else Ok(mu + ((n - mu) % lambda))
            | OpenAtBound m ->
                let recorded =
                    a.Checkpoints |> List.map (fun c -> c.Step) |> function | [] -> 0 | xs -> List.max xs
                if n <= recorded then Ok n
                else Error(NotClosedAtBound(m, a.Budget.Attribution))

    /// The state at absolute step `n`, if the store can answer it exactly. `None` when the reduced step
    /// has no snapshot row (a digest-only checkpoint, or a step between strides) — the caller then steps
    /// the machine itself. A memo that guesses is not a memo.
    let stateAt (a: Artifact) (n: int) : Result<Chip8Cow.Frame option, Feedback> =
        reduceStep a n
        |> Result.bind (fun r ->
            match a.Checkpoints |> List.tryFind (fun c -> c.Step = r) with
            | Some { Snapshot = Some snap } -> decodeFrame snap |> Result.map Some
            | _ -> Ok None)

    /// **The room-facing lookup.** Given the frame a run is currently at, ask the injected store where
    /// this machine is `ahead` steps later. `None` means "not memoized — compute it yourself", never a
    /// guess.
    ///
    /// The falsifier: whatever this returns must be **byte-equal** to `SoftChip8.lookAhead ahead` on a
    /// deterministic segment. That is the T1 property, extended across the run boundary.
    let fastForward (reader: Reader) (key: RunKey) (current: Chip8Cow.Frame) (ahead: int) : Chip8Cow.Frame option =
        if ahead < 0 then
            None
        else
            match reader.TryGet key with
            | None -> None
            | Some a ->
                let d = frameDigest current
                match a.Checkpoints |> List.tryFind (fun c -> String.Equals(c.StateDigest, d, StringComparison.Ordinal)) with
                | None -> None
                | Some here ->
                    match stateAt a (here.Step + ahead) with
                    | Ok(Some f) -> Some f
                    | _ -> None

    /// A reader over an in-memory set of artifacts — the shape a room receives in tests and in DST runs.
    /// IO adapters construct the list; this module never touches a filesystem.
    let readerOf (artifacts: Artifact list) : Reader =
        let index =
            artifacts
            |> List.map (fun a -> keyText a.Key, a)
            |> List.fold (fun m (k, a) -> Map.add k a m) Map.empty
        { TryGet = fun k -> Map.tryFind (keyText k) index }
