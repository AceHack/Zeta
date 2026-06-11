namespace Zeta.Core

/// CartridgeLaw — **the cartridge states its own known-answer laws, in-file, checkable in any
/// language** (Aaron 2026-06-12: "does the shape file contain all this in our format, readable in
/// all langs, as HOMOICONICALLY as possible?"). A `law` line carries an integer identity over the
/// file's OWN constants:
///
///     law	euler	vertices - edges + faces = 2
///     law	double-count	12 * 5 + 20 * 6 = 2 * edges
///
/// The evaluator is deliberately tiny — integers, constant names, `+ - *`, one `=` — so every
/// oracle language can re-implement it in a screen of code and the file means the SAME thing
/// everywhere (homoiconic to the byte: the law is data in the file AND the check that runs).
/// Laws that are not integer identities (the spiral GROWS; the fold COMMUTES) stay in module code
/// and are named from the file by `law <name> code:<module-check>` — carried honestly as
/// references, never silently absent.
[<RequireQualifiedAccess>]
module CartridgeLaw =

    /// A law's verdict: Holds (checked HERE, by this evaluator) | Delegated (documented here,
    /// checked by the NAMED tool — true-on-faith is not a thing this type can say; silent-failure
    /// hunt 2026-06-12) | Fails.
    type Status =
        | Holds
        | Delegated of tool: string
        | Fails

    type Verdict = { Law: string; Status: Status; Evidence: string }

    /// Back-compat read: does this verdict BLOCK? (Delegated does not block — and does not vouch.)
    let blocks (v: Verdict) = v.Status = Fails

    // THE DIALECT: operators MUST be space-separated (`vertices - edges + faces`), because constant
    // names are kebab-case (`meta-doors`) — an unspaced '-' is part of a NAME, never an operator.
    // Same blade as the SVG dialect: a strict form everyone parses identically in a screen of code.
    /// Evaluate one side of an identity against the constant table. Grammar: atom (op atom)* with
    /// op in {+ - *}, * binding tighter. Total: unknown name / malformed shape ⇒ None.
    let private evalSide (constants: Map<string, int>) (side: string) : int option =
        let atom (a: string) : int option =
            match System.Int32.TryParse a with
            | true, v -> Some v
            | _ -> Map.tryFind a constants
        let tokens = side.Split(' ') |> Array.filter (fun s -> s.Length > 0)
        let mutable ok = tokens.Length > 0
        let mutable total = 0
        let mutable product = 1
        let mutable sign = 1
        let mutable expectAtom = true
        for tk in tokens do
            if not ok then ()
            elif expectAtom then
                match atom tk with
                | Some v ->
                    (try product <- Checked.(*) product v
                     with :? System.OverflowException -> ok <- false) // overflow is a refusal, never a wrap (Kira #10)
                    expectAtom <- false
                | None -> ok <- false
            else
                match tk with
                | "*" -> expectAtom <- true
                | "+" ->
                    (try total <- Checked.(+) total (Checked.(*) sign product)
                     with :? System.OverflowException -> ok <- false)
                    product <- 1
                    sign <- 1
                    expectAtom <- true
                | "-" ->
                    (try total <- Checked.(+) total (Checked.(*) sign product)
                     with :? System.OverflowException -> ok <- false)
                    product <- 1
                    sign <- -1
                    expectAtom <- true
                | _ -> ok <- false
        if ok && not expectAtom then
            try Some(Checked.(+) total (Checked.(*) sign product))
            with :? System.OverflowException -> None
        else None


    /// The constant table of a document (first field of each `constant` line, integers only).
    let constantsOf (d: MediaLines.Doc) : Map<string, int> =
        MediaLines.ofKind "constant" d
        |> List.choose (fun e ->
            match e.Fields with
            | v :: _ ->
                match System.Int32.TryParse v with
                | true, i -> Some(e.Name, i)
                | _ -> None
            | [] -> None)
        |> Map.ofList

    /// Check every in-file law. A `code:` law is reported as delegated (held by module code, named
    /// here); a malformed or unresolvable law FAILS honestly (a law you cannot check is not a law).
    let check (d: MediaLines.Doc) : Verdict list =
        let constants = constantsOf d
        MediaLines.ofKind "law" d
        |> List.map (fun e ->
            let expr = e.Fields |> List.tryHead |> Option.defaultValue ""
            // DELEGATED LAWS (Aaron 2026-06-12: "abstract the laws from all our formal-analysis
            // tools — document here, CHECK them there — until checking is built in at the chip8
            // level"): `<tool>:<ref>` names the external checker (code:, z3:, tla:, lean:,
            // fscheck:, alloy:, semgrep:, …). The law is DOCUMENTED in the cartridge and HELD by
            // the named tool — never silent, never assumed checked by the evaluator itself.
            let delegated = expr.IndexOf ':'
            let knownTools =
                // the allowlist (Kira round-2 P0: any lowercase prefix used to ratify on faith —
                // `madeuptool:nothing` passed the gate). A tool not on this list FAILS the law:
                // delegation to nowhere is not documentation, it is evasion.
                Set.ofList [ "code"; "z3"; "tla"; "tlc"; "lean"; "fscheck"; "alloy"; "semgrep"; "codeql"; "stryker"; "qsharp" ]
            if delegated > 0 && expr.Substring(0, delegated) |> Seq.forall (fun ch -> System.Char.IsAsciiLetterLower ch || System.Char.IsAsciiDigit ch) then
                let tool = expr.Substring(0, delegated)
                if not (Set.contains tool knownTools) then
                    { Law = e.Name; Status = Fails; Evidence = sprintf "unknown delegation tool '%s' — not on the toolbox allowlist (delegation to nowhere is evasion)" tool }
                else
                { Law = e.Name
                  Status = Delegated tool
                  Evidence = sprintf "documented here, checked by %s: %s (delegation is not verification — the tool's own treaty line is the proof)" tool (expr.Substring(delegated + 1)) }
            else
                match expr.Split('=') with
                | [| lhs; rhs |] ->
                    match evalSide constants lhs, evalSide constants rhs with
                    | Some a, Some b ->
                        { Law = e.Name
                          Status = (if a = b then Holds else Fails)
                          Evidence = sprintf "%s: %d = %d" expr a b }
                    | _ -> { Law = e.Name; Status = Fails; Evidence = "unresolvable term in: " + expr }
                | _ -> { Law = e.Name; Status = Fails; Evidence = "a law needs exactly one '=': " + expr })

    /// Does no in-file law FAIL? (Holds and Delegated both pass this — but a consumer who needs
    /// PROOF must look for Status = Holds or the delegated tool's own treaty line; allHold never
    /// vouches for a delegation.)
    let allHold (d: MediaLines.Doc) : bool = check d |> List.forall (fun x -> x.Status <> Fails)
