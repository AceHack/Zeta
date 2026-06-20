open System
open System.IO
open System.Security.Cryptography
open System.Text
open System.Text.Json

type ProvisionalUli = {
    LanguageCode: string
    LexiconHash: string
}

type ProvisionalUii = {
    AgentId: string
    Capabilities: string[]
}

type ProvisionalUti = {
    Temperature: double
    DecayRate: double
}

type ProvisionalUtri = {
    RootHash: string
}

type ProvisionalExperienceState = {
    Uli: ProvisionalUli
    Uii: ProvisionalUii
    Uti: ProvisionalUti
    Utri: ProvisionalUtri
    RootHash: string
}

let sha256Bytes (bytes: byte[]) : string =
    use sha = SHA256.Create()
    let hash = sha.ComputeHash(bytes)
    BitConverter.ToString(hash).Replace("-", "").ToLower()

let sha256String (str: string) : string =
    sha256Bytes (Encoding.UTF8.GetBytes(str))

let hashFile (path: string) : string =
    let content = File.ReadAllBytes(path)
    let prefix = Encoding.UTF8.GetBytes("file\n")
    let buffer = Array.concat [ prefix; content ]
    sha256Bytes buffer

let hashSymlink (path: string) : string =
    let info = FileInfo(path)
    let target = info.LinkTarget
    let normalized = target.Replace("\\", "/")
    sha256String ("symlink\n" + normalized)

type ChildEntry = {
    Type: string
    Hash: string
    Name: string
}

let rec hashDirectory (path: string) : string =
    let di = DirectoryInfo(path)
    let children = di.GetFileSystemInfos()
    let entries = 
        children
        |> Array.map (fun info ->
            let isLink = info.Attributes.HasFlag(FileAttributes.ReparsePoint)
            if isLink then
                { Type = "symlink"; Hash = hashSymlink info.FullName; Name = info.Name }
            elif info.Attributes.HasFlag(FileAttributes.Directory) then
                { Type = "dir"; Hash = hashDirectory info.FullName; Name = info.Name }
            else
                { Type = "file"; Hash = hashFile info.FullName; Name = info.Name }
        )
    
    // Sort alphabetically by Name using UTF-8 byte comparison (StringComparison.Ordinal)
    let sorted = 
        entries 
        |> Array.sortWith (fun a b -> String.Compare(a.Name, b.Name, StringComparison.Ordinal))
    
    let sb = StringBuilder()
    sb.Append("directory\n") |> ignore
    for entry in sorted do
        sb.Append(sprintf "%s %s %s\n" entry.Type entry.Hash entry.Name) |> ignore
    
    sha256String (sb.ToString())

let buildProvisionalState
    (langCode: string)
    (lexHash: string)
    (agentId: string)
    (caps: string[])
    (temp: double)
    (decay: double)
    (rootDir: string)
    : ProvisionalExperienceState =
    
    let rootHash = hashDirectory rootDir
    let uli = { LanguageCode = langCode; LexiconHash = lexHash }
    let uii = { AgentId = agentId; Capabilities = caps |> Array.sort }
    let uti = { Temperature = temp; DecayRate = decay }
    let utri = { RootHash = rootHash }
    { Uli = uli; Uii = uii; Uti = uti; Utri = utri; RootHash = rootHash }

let here = __SOURCE_DIRECTORY__
let rootDir = Path.Combine(here, "fixtures", "tree1")
let state = buildProvisionalState "en-US" "a8f5c2b3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1" "agent-007" [| "speak"; "traverse" |] 0.7 0.1 rootDir

let results = Map.empty.Add("provisional-experience-v1", state)

let options = JsonSerializerOptions()
options.PropertyNamingPolicy <- JsonNamingPolicy.CamelCase
options.WriteIndented <- true

let json = JsonSerializer.Serialize(results, options)
let target = Path.Combine(here, "fsharp-output.json")
File.WriteAllText(target, json + "\n")
printfn "Wrote fsharp-output.json. Root hash: %s" state.RootHash
