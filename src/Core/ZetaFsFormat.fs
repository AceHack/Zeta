namespace Zeta.Core

open System
open System.Collections.Generic
open System.IO
open System.Text

/// FORMAT grammar (E3). UTF-8, LF, ordinal keys. First line is the major.
/// Required keys: ns, body, hash. Known optional: chunker, enc, polyfill.
/// Unknown major or unknown required / known-optional value => refuse.
/// Extra unknown keys are ignored. v1 is the *absence* of this file.
[<RequireQualifiedAccess>]
module ZetaFsFormat =

    [<Literal>]
    let FileName = "FORMAT"

    [<Literal>]
    let MaxBytes = 65536L

    type Major =
        | V1Implicit
        | V2

    type Namespace =
        | GitTrees
        | Bindings

    type Body =
        | Blob
        | Jumprope

    type HashAlg =
        | Blake3_256
        | Unspecified

    type Chunker =
        | FastCdcV1
        | FastCdcV1Large
        | Unspecified

    type Enc =
        | Off
        | AesGcmExplicitNonce
        | Unspecified

    type Polyfill =
        | Single
        | Unspecified

    type Manifest =
        { Major: Major
          Ns: Namespace
          Body: Body
          Hash: HashAlg
          Chunker: Chunker
          Enc: Enc
          Polyfill: Polyfill }

    type FormatError =
        | Empty
        | TooLarge
        | UnknownMajor of string
        | MissingRequiredKey of string
        | UnknownRequiredValue of key: string * value: string
        | UnknownKnownOptionalValue of key: string * value: string
        | DuplicateKey of string
        | MalformedLine of string
        | ReaderDoesNotSupport of key: string * value: string

    let v1Implicit: Manifest =
        { Major = Major.V1Implicit
          Ns = Namespace.GitTrees
          Body = Body.Blob
          Hash = HashAlg.Unspecified
          Chunker = Chunker.Unspecified
          Enc = Enc.Unspecified
          Polyfill = Polyfill.Single }

    /// What `ZetaFsStore.init` wrote for a new store in PR1 (`body=blob`).
    let pr1Default: Manifest =
        { Major = Major.V2
          Ns = Namespace.GitTrees
          Body = Body.Blob
          Hash = HashAlg.Blake3_256
          Chunker = Chunker.FastCdcV1
          Enc = Enc.Off
          Polyfill = Polyfill.Single }

    /// What `ZetaFsStore.init` writes for a new store from PR6 (`body=jumprope`).
    let pr6Default: Manifest = { pr1Default with Body = Body.Jumprope }

    /// What a new freeze volume writes. Freeze does not speak JSON trees.
    /// TagBinding objects are not this manifest.
    let bindingsDefault: Manifest = { pr6Default with Ns = Namespace.Bindings }

    let errorName (e: FormatError) : string =
        match e with
        | FormatError.Empty -> "Empty"
        | FormatError.TooLarge -> "TooLarge"
        | FormatError.UnknownMajor _ -> "UnknownMajor"
        | FormatError.MissingRequiredKey _ -> "MissingRequiredKey"
        | FormatError.UnknownRequiredValue _ -> "UnknownRequiredValue"
        | FormatError.UnknownKnownOptionalValue _ -> "UnknownKnownOptionalValue"
        | FormatError.DuplicateKey _ -> "DuplicateKey"
        | FormatError.MalformedLine _ -> "MalformedLine"
        | FormatError.ReaderDoesNotSupport _ -> "ReaderDoesNotSupport"

    let describe (e: FormatError) : string =
        match e with
        | FormatError.Empty -> "FORMAT is empty"
        | FormatError.TooLarge -> "FORMAT exceeds 64 KiB"
        | FormatError.UnknownMajor m ->
            String.Format(Globalization.CultureInfo.InvariantCulture, "unknown FORMAT major '{0}'", m)
        | FormatError.MissingRequiredKey k ->
            String.Format(Globalization.CultureInfo.InvariantCulture, "FORMAT missing required key '{0}'", k)
        | FormatError.UnknownRequiredValue(k, v) ->
            String.Format(Globalization.CultureInfo.InvariantCulture, "FORMAT unknown value for required key {0}='{1}'", k, v)
        | FormatError.UnknownKnownOptionalValue(k, v) ->
            String.Format(Globalization.CultureInfo.InvariantCulture, "FORMAT unknown value for optional key {0}='{1}'", k, v)
        | FormatError.DuplicateKey k ->
            String.Format(Globalization.CultureInfo.InvariantCulture, "FORMAT duplicate key '{0}'", k)
        | FormatError.MalformedLine line ->
            String.Format(Globalization.CultureInfo.InvariantCulture, "FORMAT malformed line '{0}'", line)
        | FormatError.ReaderDoesNotSupport(k, v) ->
            String.Format(Globalization.CultureInfo.InvariantCulture, "this reader does not support {0}={1}", k, v)

    let private parseNs (v: string) : Result<Namespace, FormatError> =
        if String.Equals(v, "git-trees", StringComparison.Ordinal) then
            Ok Namespace.GitTrees
        elif String.Equals(v, "bindings", StringComparison.Ordinal) then
            Ok Namespace.Bindings
        else
            Error(FormatError.UnknownRequiredValue("ns", v))

    let private parseBody (v: string) : Result<Body, FormatError> =
        if String.Equals(v, "blob", StringComparison.Ordinal) then
            Ok Body.Blob
        elif String.Equals(v, "jumprope", StringComparison.Ordinal) then
            Ok Body.Jumprope
        else
            Error(FormatError.UnknownRequiredValue("body", v))

    let private parseHash (v: string) : Result<HashAlg, FormatError> =
        if String.Equals(v, "blake3-256", StringComparison.Ordinal) then
            Ok HashAlg.Blake3_256
        else
            Error(FormatError.UnknownRequiredValue("hash", v))

    let private parseChunker (v: string) : Result<Chunker, FormatError> =
        if String.Equals(v, "fastcdc-v1", StringComparison.Ordinal) then
            Ok Chunker.FastCdcV1
        elif String.Equals(v, "fastcdc-v1-large", StringComparison.Ordinal) then
            Ok Chunker.FastCdcV1Large
        else
            Error(FormatError.UnknownKnownOptionalValue("chunker", v))

    let private parseEnc (v: string) : Result<Enc, FormatError> =
        if
            String.Equals(v, "none", StringComparison.Ordinal)
            || String.Equals(v, "off", StringComparison.Ordinal)
        then
            Ok Enc.Off
        elif
            String.Equals(v, "aes-gcm-explicit-nonce", StringComparison.Ordinal)
            || String.Equals(v, "aes-gcm", StringComparison.Ordinal)
        then
            Ok Enc.AesGcmExplicitNonce
        else
            Error(FormatError.UnknownKnownOptionalValue("enc", v))

    let private parsePolyfill (v: string) : Result<Polyfill, FormatError> =
        if String.Equals(v, "single", StringComparison.Ordinal) then
            Ok Polyfill.Single
        else
            Error(FormatError.UnknownKnownOptionalValue("polyfill", v))

    let parse (text: string) : Result<Manifest, FormatError> =
        if isNull text then
            Error FormatError.Empty
        else
            let stripped =
                if text.Length > 0 && text.[0] = '\uFEFF' then
                    text.Substring 1
                else
                    text

            let normalized =
                stripped
                    .Replace("\r\n", "\n", StringComparison.Ordinal)
                    .Replace("\r", "\n", StringComparison.Ordinal)

            let lines = normalized.Split '\n'
            let keys = Dictionary<string, string>(StringComparer.Ordinal)

            let rec skipEmpty i =
                if i >= lines.Length then
                    None
                elif String.IsNullOrWhiteSpace lines.[i] then
                    skipEmpty (i + 1)
                else
                    Some i

            match skipEmpty 0 with
            | None -> Error FormatError.Empty
            | Some first ->
                let majorLine = lines.[first].Trim()

                if not (String.Equals(majorLine, "zetafs/2", StringComparison.Ordinal)) then
                    if majorLine.StartsWith("zetafs/", StringComparison.Ordinal) then
                        Error(FormatError.UnknownMajor majorLine)
                    else
                        Error(FormatError.MalformedLine majorLine)
                else
                    let rec gather i =
                        if i >= lines.Length then
                            Ok()
                        elif String.IsNullOrWhiteSpace lines.[i] then
                            gather (i + 1)
                        else
                            let line = lines.[i].Trim()
                            let eq = line.IndexOf('=')

                            if eq <= 0 then
                                Error(FormatError.MalformedLine line)
                            else
                                let key = line.Substring(0, eq).Trim()
                                let value = line.Substring(eq + 1).Trim()

                                if key.Length = 0 then
                                    Error(FormatError.MalformedLine line)
                                elif keys.ContainsKey key then
                                    Error(FormatError.DuplicateKey key)
                                else
                                    keys.[key] <- value
                                    gather (i + 1)

                    match gather (first + 1) with
                    | Error e -> Error e
                    | Ok() ->
                        let tryRequired name parseFn =
                            match keys.TryGetValue name with
                            | false, _ -> Error(FormatError.MissingRequiredKey name)
                            | true, v -> parseFn v

                        match tryRequired "ns" parseNs with
                        | Error e -> Error e
                        | Ok ns ->
                            match tryRequired "body" parseBody with
                            | Error e -> Error e
                            | Ok body ->
                                match tryRequired "hash" parseHash with
                                | Error e -> Error e
                                | Ok hash ->
                                    let rec optionals remaining (chunker, enc, polyfill) =
                                        match remaining with
                                        | [] -> Ok(chunker, enc, polyfill)
                                        | key :: rest ->
                                            match keys.TryGetValue key with
                                            | false, _ -> optionals rest (chunker, enc, polyfill)
                                            | true, v ->
                                                if String.Equals(key, "chunker", StringComparison.Ordinal) then
                                                    match parseChunker v with
                                                    | Error e -> Error e
                                                    | Ok c -> optionals rest (c, enc, polyfill)
                                                elif String.Equals(key, "enc", StringComparison.Ordinal) then
                                                    match parseEnc v with
                                                    | Error e -> Error e
                                                    | Ok e -> optionals rest (chunker, e, polyfill)
                                                elif String.Equals(key, "polyfill", StringComparison.Ordinal) then
                                                    match parsePolyfill v with
                                                    | Error e -> Error e
                                                    | Ok p -> optionals rest (chunker, enc, p)
                                                else
                                                    optionals rest (chunker, enc, polyfill)

                                    match
                                        optionals
                                            [ "chunker"; "enc"; "polyfill" ]
                                            (Chunker.Unspecified, Enc.Unspecified, Polyfill.Unspecified)
                                    with
                                    | Error e -> Error e
                                    | Ok(chunker, enc, polyfill) ->
                                        Ok
                                            { Major = Major.V2
                                              Ns = ns
                                              Body = body
                                              Hash = hash
                                              Chunker = chunker
                                              Enc = enc
                                              Polyfill = polyfill }

    let render (m: Manifest) : string =
        match m.Major with
        | Major.V1Implicit -> ""
        | Major.V2 ->
            let sb = StringBuilder()
            sb.Append("zetafs/2\n") |> ignore

            let ns =
                match m.Ns with
                | Namespace.GitTrees -> "git-trees"
                | Namespace.Bindings -> "bindings"

            let body =
                match m.Body with
                | Body.Blob -> "blob"
                | Body.Jumprope -> "jumprope"

            let hash =
                match m.Hash with
                | HashAlg.Blake3_256 -> "blake3-256"
                | HashAlg.Unspecified -> "blake3-256"

            sb.Append("ns=").Append(ns).Append('\n') |> ignore
            sb.Append("body=").Append(body).Append('\n') |> ignore
            sb.Append("hash=").Append(hash).Append('\n') |> ignore

            match m.Chunker with
            | Chunker.FastCdcV1 -> sb.Append("chunker=fastcdc-v1\n") |> ignore
            | Chunker.FastCdcV1Large -> sb.Append("chunker=fastcdc-v1-large\n") |> ignore
            | Chunker.Unspecified -> ()

            match m.Enc with
            | Enc.Off -> sb.Append("enc=none\n") |> ignore
            | Enc.AesGcmExplicitNonce -> sb.Append("enc=aes-gcm-explicit-nonce\n") |> ignore
            | Enc.Unspecified -> ()

            match m.Polyfill with
            | Polyfill.Single -> sb.Append("polyfill=single\n") |> ignore
            | Polyfill.Unspecified -> ()

            sb.ToString()

    let tryRead (fs: IFileSystem) (storeDir: string) : Result<Manifest, FormatError> =
        let path = ZetaFsPath.combine2 storeDir FileName

        if not (fs.Exists path) then
            Ok v1Implicit
        else
            match FileSystemIo.tryReadBytesCapped fs MaxBytes path with
            | None ->
                // Exists but over the cap, or a torn/empty read.
                use stream = fs.OpenRead path
                if stream.Length > MaxBytes then Error FormatError.TooLarge else Error FormatError.Empty
            | Some bytes when bytes.Length = 0 -> Error FormatError.Empty
            | Some bytes -> parse (Encoding.UTF8.GetString bytes)

    /// Git-trees polyfill. PR6 wires Jumprope as a body. `ns=bindings` still
    /// refuses here; freeze volumes write `bindingsDefault` instead.
    let requireGitTrees (m: Manifest) : Result<Manifest, FormatError> =
        match m.Ns with
        | Namespace.GitTrees -> Ok m
        | Namespace.Bindings -> Error(FormatError.ReaderDoesNotSupport("ns", "bindings"))

    /// PR1 name. Alias of `requireGitTrees` — jumprope is a git-trees body from PR6.
    let requireGitTreesBlob (m: Manifest) : Result<Manifest, FormatError> = requireGitTrees m

    /// Freeze-volume reader. Refuses `ns=git-trees` so a bindings volume is
    /// not parsed as JSON trees. Does not persist TagBinding objects.
    let requireBindings (m: Manifest) : Result<Manifest, FormatError> =
        match m.Ns with
        | Namespace.Bindings -> Ok m
        | Namespace.GitTrees -> Error(FormatError.ReaderDoesNotSupport("ns", "git-trees"))

    let write (fs: IFileSystem) (storeDir: string) (m: Manifest) =
        match m.Major with
        | Major.V1Implicit -> ()
        | Major.V2 ->
            let path = ZetaFsPath.combine2 storeDir FileName
            FileSystemIo.writeAllText fs path (render m)
