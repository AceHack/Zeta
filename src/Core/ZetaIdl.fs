namespace Zeta.Core

open System
open System.Collections.Generic
open System.Collections.Immutable

module ZetaIdl =

    // ═══ Tokenizer ════════════════════════════════════════════════════════════════

    let tokenize (src: string) : Result<(string * string) list, string> =
        let tokens = List<string * string>()
        let mutable i = 0
        let len = src.Length
        
        let isIdentChar c = Char.IsLetterOrDigit(c) || c = '_'
        
        let rec skipWhitespaceAndComments () =
            if i < len then
                let c = src.[i]
                if Char.IsWhiteSpace(c) then
                    i <- i + 1
                    skipWhitespaceAndComments ()
                elif c = '/' && i + 1 < len && src.[i+1] = '/' then
                    // single line comment
                    i <- i + 2
                    while i < len && src.[i] <> '\n' && src.[i] <> '\r' do
                        i <- i + 1
                    skipWhitespaceAndComments ()
                elif c = '/' && i + 1 < len && src.[i+1] = '*' then
                    // multiline comment
                    i <- i + 2
                    let mutable closed = false
                    while i < len && not closed do
                        if src.[i] = '*' && i + 1 < len && src.[i+1] = '/' then
                            i <- i + 2
                            closed <- true
                        else
                            i <- i + 1
                    skipWhitespaceAndComments ()
        
        let mutable err = None
        while i < len && Option.isNone err do
            skipWhitespaceAndComments ()
            if i < len then
                let c = src.[i]
                if c = '{' then
                    tokens.Add(("LBRACE", "{"))
                    i <- i + 1
                elif c = '}' then
                    tokens.Add(("RBRACE", "}"))
                    i <- i + 1
                elif c = '(' then
                    tokens.Add(("LPAREN", "("))
                    i <- i + 1
                elif c = ')' then
                    tokens.Add(("RPAREN", ")"))
                    i <- i + 1
                elif c = ':' then
                    tokens.Add(("COLON", ":"))
                    i <- i + 1
                elif c = ';' then
                    tokens.Add(("SEMI", ";"))
                    i <- i + 1
                elif c = ',' then
                    tokens.Add(("COMMA", ","))
                    i <- i + 1
                elif c = '-' && i + 1 < len && src.[i+1] = '>' then
                    tokens.Add(("RETURNS", "->"))
                    i <- i + 2
                elif Char.IsLetter(c) || c = '_' then
                    let start = i
                    i <- i + 1
                    while i < len && isIdentChar src.[i] do
                        i <- i + 1
                    let lexeme = src.Substring(start, i - start)
                    if lexeme = "interface" then
                        tokens.Add(("INTERFACE", "interface"))
                    elif lexeme = "method" then
                        tokens.Add(("METHOD", "method"))
                    elif lexeme = "returns" then
                        tokens.Add(("RETURNS", "returns"))
                    else
                        tokens.Add(("NAME", lexeme))
                else
                    err <- Some(sprintf "Unexpected character '%c' at position %d" c i)
                    
        match err with
        | Some e -> Error e
        | None -> Ok(Seq.toList tokens)

    // ═══ Grammar ═════════════════════════════════════════════════════════════════

    module G = GrammarIr

    let private prod lhs rhs : G.Production = { Lhs = lhs; Rhs = rhs }

    let grammar: G.Grammar =
        { Id = "zeta-idl"
          Terminals =
            [ { Name = "INTERFACE"; Pattern = "interface" }
              { Name = "METHOD"; Pattern = "method" }
              { Name = "RETURNS"; Pattern = "returns" }
              { Name = "NAME"; Pattern = "NAME" }
              { Name = "LBRACE"; Pattern = "{" }
              { Name = "RBRACE"; Pattern = "}" }
              { Name = "LPAREN"; Pattern = "(" }
              { Name = "RPAREN"; Pattern = ")" }
              { Name = "COLON"; Pattern = ":" }
              { Name = "SEMI"; Pattern = ";" }
              { Name = "COMMA"; Pattern = "," } ]
          NonTerminals =
            [ { Name = "idl" }
              { Name = "decllist" }
              { Name = "decl" }
              { Name = "methodlist" }
              { Name = "method" }
              { Name = "arglist" }
              { Name = "args" }
              { Name = "arg" } ]
          Productions =
            [ prod "idl" [ G.NonTerm "decllist" ]
              prod "decllist" [ G.NonTerm "decllist"; G.NonTerm "decl" ]
              prod "decllist" [ G.NonTerm "decl" ]
              prod "decl" [ G.Term "INTERFACE"; G.Term "NAME"; G.Term "LBRACE"; G.NonTerm "methodlist"; G.Term "RBRACE" ]
              prod "methodlist" [ G.NonTerm "methodlist"; G.NonTerm "method" ]
              prod "methodlist" [ G.NonTerm "method" ]
              prod "method" [ G.Term "METHOD"; G.Term "NAME"; G.Term "LPAREN"; G.NonTerm "arglist"; G.Term "RPAREN"; G.Term "RETURNS"; G.Term "NAME"; G.Term "SEMI" ]
              prod "arglist" [ G.NonTerm "args" ]
              prod "arglist" []
              prod "args" [ G.NonTerm "args"; G.Term "COMMA"; G.NonTerm "arg" ]
              prod "args" [ G.NonTerm "arg" ]
              prod "arg" [ G.Term "NAME"; G.Term "COLON"; G.Term "NAME" ] ]
          Start = "idl" }

    // ═══ Parse Tree to AST Reification ════════════════════════════════════════════

    let rec private isLeaf (dv: DynamicValue) =
        match DynamicValue.get "term" dv with
        | Some _ -> true
        | None -> false

    let rec private ruleOf (dv: DynamicValue) =
        match DynamicValue.get "rule" dv with
        | Some(DynamicValue.String s) -> Some s
        | _ -> None

    let rec private kidsOf (dv: DynamicValue) =
        match DynamicValue.get "kids" dv with
        | Some(DynamicValue.Array xs) -> xs
        | _ -> []

    let relex (tree: DynamicValue) (lexemes: string list) : DynamicValue =
        let lex = List.toArray lexemes
        let mutable i = 0
        let rec go dv =
            if isLeaf dv then
                let lx = if i < lex.Length then lex.[i] else ""
                i <- i + 1
                DynamicValue.Object [ "term", DynamicValue.String lx ]
            else
                match ruleOf dv with
                | Some r -> DynamicValue.Object [ "rule", DynamicValue.String r; "kids", DynamicValue.Array(kidsOf dv |> List.map go) ]
                | None -> dv
        go tree

    let leafLex (dv: DynamicValue) : string =
        match DynamicValue.get "term" dv with
        | Some(DynamicValue.String s) -> s
        | _ -> ""

    let reifyArg (argNode: DynamicValue) : DynamicValue =
        match kidsOf argNode with
        | [ nameLeaf; _; typeLeaf ] ->
            DynamicValue.Object [
                ("name", DynamicValue.String(leafLex nameLeaf))
                ("type", DynamicValue.String(leafLex typeLeaf))
            ]
        | _ -> DynamicValue.Null

    let rec reifyArgs (argsNode: DynamicValue) : DynamicValue list =
        match kidsOf argsNode with
        | [ subArgs; _; argNode ] ->
            reifyArgs subArgs @ [ reifyArg argNode ]
        | [ argNode ] ->
            [ reifyArg argNode ]
        | _ -> []

    let reifyArglist (arglistNode: DynamicValue) : DynamicValue list =
        match kidsOf arglistNode with
        | [ argsNode ] -> reifyArgs argsNode
        | _ -> []

    let reifyMethod (methodNode: DynamicValue) : DynamicValue =
        match kidsOf methodNode with
        | [ _; nameLeaf; _; arglistNode; _; _; returnTypeLeaf; _ ] ->
            DynamicValue.Object [
                ("name", DynamicValue.String(leafLex nameLeaf))
                ("arguments", DynamicValue.Array(reifyArglist arglistNode))
                ("returnType", DynamicValue.String(leafLex returnTypeLeaf))
            ]
        | _ -> DynamicValue.Null

    let rec reifyMethodlist (methodlistNode: DynamicValue) : DynamicValue list =
        match kidsOf methodlistNode with
        | [ subList; methodNode ] ->
            reifyMethodlist subList @ [ reifyMethod methodNode ]
        | [ methodNode ] ->
            [ reifyMethod methodNode ]
        | _ -> []

    let reifyDecl (declNode: DynamicValue) : DynamicValue =
        match kidsOf declNode with
        | [ _; nameLeaf; _; methodlistNode; _ ] ->
            DynamicValue.Object [
                ("name", DynamicValue.String(leafLex nameLeaf))
                ("methods", DynamicValue.Array(reifyMethodlist methodlistNode))
            ]
        | _ -> DynamicValue.Null

    let rec reifyDecllist (decllistNode: DynamicValue) : DynamicValue list =
        match kidsOf decllistNode with
        | [ subList; declNode ] ->
            reifyDecllist subList @ [ reifyDecl declNode ]
        | [ declNode ] ->
            [ reifyDecl declNode ]
        | _ -> []

    let reifyIdl (idlNode: DynamicValue) : DynamicValue =
        match kidsOf idlNode with
        | [ decllistNode ] ->
            DynamicValue.Object [
                ("interfaces", DynamicValue.Array(reifyDecllist decllistNode))
            ]
        | _ -> DynamicValue.Null

    // ═══ Parser & Code Generator ══════════════════════════════════════════════════

    let private parserTables =
        match Slr.build grammar with
        | Ok tables ->
            if not (List.isEmpty tables.Conflicts) then
                failwithf "Zeta IDL grammar has SLR conflicts: %A" tables.Conflicts
            tables
        | Error e ->
            failwithf "Failed to build Zeta IDL grammar: %s" e

    /// Parse a Zeta IDL source string into the canonical DynamicValue AST.
    let parse (src: string) : Result<DynamicValue, string> =
        tokenize src
        |> Result.bind (fun tokens ->
            let classes = tokens |> List.map fst
            let lexemes = tokens |> List.map snd
            Slr.parseTree parserTables classes
            |> Result.map (fun classTree ->
                let treeWithLexemes = relex classTree lexemes
                reifyIdl treeWithLexemes))

    let mapType (t: string) : string =
        match t.ToLowerInvariant() with
        | "int" | "int64" -> "int64"
        | "float" | "double" -> "float"
        | "bool" | "boolean" -> "bool"
        | "string" -> "string"
        | "bytes" | "bytearray" -> "byte[]"
        | "void" | "null" | "unit" -> "unit"
        | other -> other

    let private getString key (dv: DynamicValue) =
        match DynamicValue.get key dv with
        | Some(DynamicValue.String s) -> s
        | _ -> ""

    let private getArray key (dv: DynamicValue) =
        match DynamicValue.get key dv with
        | Some(DynamicValue.Array xs) -> xs
        | _ -> []

    /// Generate clean, type-safe F# interface code from the DynamicValue IDL AST.
    let generateFSharp (ast: DynamicValue) : string =
        let lines = ResizeArray<string>()
        let interfaces = getArray "interfaces" ast
        for i in interfaces do
            let name = getString "name" i
            lines.Add(sprintf "type %s =" name)
            let methods = getArray "methods" i
            if List.isEmpty methods then
                lines.Add("    class end")
            else
                for m in methods do
                    let mName = getString "name" m
                    let mArgs = getArray "arguments" m
                    let retType = getString "returnType" m |> mapType
                    let argsStr =
                        if List.isEmpty mArgs then
                            "unit"
                        else
                            mArgs
                            |> List.map (fun arg ->
                                let aName = getString "name" arg
                                let aType = getString "type" arg |> mapType
                                sprintf "%s:%s" aName aType)
                            |> String.concat " * "
                    lines.Add(sprintf "    abstract member %s : %s -> %s" mName argsStr retType)
        String.concat "\n" lines
