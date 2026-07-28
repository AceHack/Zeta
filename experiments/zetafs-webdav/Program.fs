module ZetaFsWebDav.Program

// ZetaFS / DagFs v0 — the REAL F# DagFs core (src/Core/DagFs.fs), served as a mountable
// macOS filesystem over loopback WebDAV. macOS mounts this with its built-in WebDAV client
// (`mount_webdav`); this process IS the userspace server, and the backend IS `Zeta.Core.DagFs`
// (content-addressed, deduplicated, multi-parent). Read-only v0. No kext, no signing.

open System
open System.Net
open System.Text
open System.Globalization
open Zeta.Core

// ---- backend: the real DagFs ----
let private hashOf (b: byte[]) : MerkleHash = MerkleHash.ofBytes(ReadOnlySpan<byte>(b))
let private bytes (s: string) : byte[] = Encoding.UTF8.GetBytes s

let private buildTree () =
    let readme = bytes "ZetaFS v0 on macOS via WebDAV — REAL F# DagFs core.\nContent-addressed, deduplicated, multi-parent.\n"
    let shared = bytes "I am one stored node living under many paths (multi-parent / hardlink-shaped).\n"
    let mutable t = DagFs.create hashOf
    t <- DagFs.link "/readme.txt" readme t
    t <- DagFs.link "/docs/readme.txt" readme t                 // DEDUP: same content -> one node
    t <- DagFs.link "/projects/a/shared.bin" shared t           // \
    t <- DagFs.link "/projects/b/shared.bin" shared t           //  multi-parent: one node, three paths
    t <- DagFs.link "/projects/c/also-shared.bin" shared t      // /
    t <- DagFs.link "/unique.txt" (bytes "A one-off file with its own content address.\n") t
    let proof =
        sprintf "ZetaFS DagFs proof (real F# core):\n  %d paths point at %d unique content nodes.\n  (%d paths deduplicated away.)\n"
            (DagFs.pathCount t) (DagFs.nodeCount t) (DagFs.pathCount t - DagFs.nodeCount t)
    DagFs.link "/_zetafs_proof.txt" (bytes proof) t

let private tree = buildTree ()

// ---- directory synthesis from DagFs.paths (the tree IS the source of truth) ----
let private norm (p: string) : string = "/" + p.Trim('/')
let private isFile (p: string) : bool = DagFs.resolve (norm p) tree |> Option.isSome
let private isDir (p: string) : bool =
    let baseP = p.Trim('/')
    if baseP = "" then true
    else
        let pref = "/" + baseP + "/"
        DagFs.paths tree |> List.exists (fun k -> k.StartsWith(pref, StringComparison.Ordinal))
let private childrenOf (dir: string) : string list * string list =
    let baseP = dir.Trim('/')
    let pref = if baseP = "" then "/" else "/" + baseP + "/"
    let dirs = System.Collections.Generic.SortedSet<string>(StringComparer.Ordinal)
    let files = System.Collections.Generic.SortedSet<string>(StringComparer.Ordinal)
    for k in DagFs.paths tree do
        if k.StartsWith(pref, StringComparison.Ordinal) then
            let rest = k.Substring(pref.Length)
            let slash = rest.IndexOf('/')
            if slash >= 0 then dirs.Add(rest.Substring(0, slash)) |> ignore
            else files.Add rest |> ignore
    (List.ofSeq dirs, List.ofSeq files)

// ---- WebDAV (read-only: OPTIONS, PROPFIND, GET, HEAD) ----
let private httpDate () : string = DateTime.UtcNow.ToString("r", CultureInfo.InvariantCulture)

let private propFile (href: string) (size: int) : string =
    sprintf "<D:response><D:href>%s</D:href><D:propstat><D:prop><D:resourcetype/><D:getcontentlength>%d</D:getcontentlength><D:getlastmodified>%s</D:getlastmodified><D:getcontenttype>application/octet-stream</D:getcontenttype></D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>"
        href size (httpDate())

let private propDir (href: string) : string =
    let h = if href.EndsWith("/", StringComparison.Ordinal) then href else href + "/"
    sprintf "<D:response><D:href>%s</D:href><D:propstat><D:prop><D:resourcetype><D:collection/></D:resourcetype><D:getlastmodified>%s</D:getlastmodified></D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>"
        h (httpDate())

let private fileLen (p: string) : int =
    match DagFs.resolve (norm p) tree with Some c -> c.Length | None -> 0

let private handle (ctx: HttpListenerContext) : unit =
    let req = ctx.Request
    let res = ctx.Response
    let path = req.Url.AbsolutePath
    try
        try
            match req.HttpMethod with
            | "OPTIONS" ->
                res.StatusCode <- 200
                res.AddHeader("DAV", "1, 2")
                res.AddHeader("Allow", "OPTIONS, GET, HEAD, PROPFIND")
                res.AddHeader("MS-Author-Via", "DAV")
                res.ContentLength64 <- 0L
            | "PROPFIND" ->
                if req.HasEntityBody then
                    use s = req.InputStream
                    let buf = Array.zeroCreate<byte> 4096
                    while s.Read(buf, 0, buf.Length) > 0 do ()
                let depth = if isNull req.Headers.["Depth"] then "1" else req.Headers.["Depth"]
                let baseP = path.TrimEnd('/')
                let responses =
                    if isFile baseP then [ propFile baseP (fileLen baseP) ]
                    elif baseP = "" || isDir baseP then
                        let self = [ propDir (if baseP = "" then "/" else baseP + "/") ]
                        if depth = "0" then self
                        else
                            let dirs, files = childrenOf baseP
                            let prefix = if baseP = "" then "" else baseP
                            let dchild = dirs |> List.map (fun d -> propDir (prefix + "/" + d + "/"))
                            let fchild = files |> List.map (fun f -> propFile (prefix + "/" + f) (fileLen (prefix + "/" + f)))
                            self @ dchild @ fchild
                    else []
                if List.isEmpty responses then res.StatusCode <- 404
                else
                    let body = sprintf "<?xml version=\"1.0\" encoding=\"utf-8\"?><D:multistatus xmlns:D=\"DAV:\">%s</D:multistatus>" (String.concat "" responses)
                    let b = Encoding.UTF8.GetBytes body
                    res.StatusCode <- 207
                    res.ContentType <- "application/xml; charset=\"utf-8\""
                    res.ContentLength64 <- int64 b.Length
                    res.OutputStream.Write(b, 0, b.Length)
            | "GET" | "HEAD" ->
                match DagFs.resolve (norm path) tree with
                | Some content ->
                    res.StatusCode <- 200
                    res.ContentType <- "application/octet-stream"
                    res.ContentLength64 <- int64 content.Length
                    res.AddHeader("Last-Modified", httpDate())
                    if req.HttpMethod = "GET" then res.OutputStream.Write(content, 0, content.Length)
                | None -> res.StatusCode <- 404
            | _ -> res.StatusCode <- 405
        with _ -> res.StatusCode <- 500
    finally
        res.OutputStream.Close()

[<EntryPoint>]
let main argv =
    let port = if argv.Length > 0 then Int32.Parse(argv.[0], CultureInfo.InvariantCulture) else 8787
    let listener = new HttpListener()
    listener.Prefixes.Add(sprintf "http://127.0.0.1:%d/" port)
    listener.Start()
    printfn "ZetaFS/DagFs (REAL F# core) WebDAV on http://127.0.0.1:%d/  (%d paths, %d unique nodes)"
        port (DagFs.pathCount tree) (DagFs.nodeCount tree)
    while true do
        let ctx = listener.GetContext()
        let t = System.Threading.Thread(fun () -> handle ctx)
        t.IsBackground <- true
        t.Start()
    0
