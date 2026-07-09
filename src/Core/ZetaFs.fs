namespace Zeta.Core

open System
open System.IO
open System.Text
open System.Buffers.Binary
open System.Runtime.CompilerServices

/// A name -> entry mapping using a Patricia trie.
[<NoEquality; NoComparison>]
type PatriciaNode<'T> =
    private {
        prefix: string
        value: 'T option
        children: Map<char, PatriciaNode<'T>>
    }

[<RequireQualifiedAccess>]
module Patricia =
    let empty<'T> : PatriciaNode<'T> = { prefix = ""; value = None; children = Map.empty }

    let private commonPrefix (a: string) (b: string) =
        let limit = min a.Length b.Length
        let mutable i = 0
        while i < limit && a.[i] = b.[i] do
            i <- i + 1
        i

    let rec insert (key: string) (value: 'T) (node: PatriciaNode<'T>) : PatriciaNode<'T> =
        if key = node.prefix then
            { node with value = Some value }
        elif node.prefix = "" then
            if key.Length = 0 then
                { node with value = Some value }
            else
                let firstChar = key.[0]
                match node.children.TryFind firstChar with
                | Some child ->
                    let newChild = insert key value child
                    { node with children = node.children.Add(firstChar, newChild) }
                | None ->
                    let newChild = { prefix = key; value = Some value; children = Map.empty }
                    { node with children = node.children.Add(firstChar, newChild) }
        else
            let len = commonPrefix key node.prefix
            if len < node.prefix.Length then
                let common = node.prefix.Substring(0, len)
                let remainingOld = node.prefix.Substring(len)
                let oldFirstChar = remainingOld.[0]
                let oldChild = { prefix = remainingOld; value = node.value; children = node.children }
                
                if len = key.Length then
                    { prefix = common
                      value = Some value
                      children = Map.empty.Add(oldFirstChar, oldChild) }
                else
                    let remainingNew = key.Substring(len)
                    let newFirstChar = remainingNew.[0]
                    let newChild = { prefix = remainingNew; value = Some value; children = Map.empty }
                    { prefix = common
                      value = None
                      children = Map.empty.Add(oldFirstChar, oldChild).Add(newFirstChar, newChild) }
            else
                let remainingNew = key.Substring(len)
                let firstChar = remainingNew.[0]
                match node.children.TryFind firstChar with
                | Some child ->
                    let newChild = insert remainingNew value child
                    { node with children = node.children.Add(firstChar, newChild) }
                | None ->
                    let newChild = { prefix = remainingNew; value = Some value; children = Map.empty }
                    { node with children = node.children.Add(firstChar, newChild) }

    let rec tryFind (key: string) (node: PatriciaNode<'T>) : 'T option =
        if key = node.prefix then
            node.value
        elif node.prefix = "" then
            if key.Length = 0 then
                node.value
            else
                let firstChar = key.[0]
                match node.children.TryFind firstChar with
                | Some child -> tryFind key child
                | None -> None
        elif key.StartsWith(node.prefix, StringComparison.Ordinal) then
            let remaining = key.Substring(node.prefix.Length)
            if remaining.Length = 0 then
                node.value
            else
                let firstChar = remaining.[0]
                match node.children.TryFind firstChar with
                | Some child -> tryFind remaining child
                | None -> None
        else
            None

    let rec remove (key: string) (node: PatriciaNode<'T>) : PatriciaNode<'T> =
        if key = node.prefix then
            { node with value = None }
        elif node.prefix = "" then
            if key.Length = 0 then
                { node with value = None }
            else
                let firstChar = key.[0]
                match node.children.TryFind firstChar with
                | Some child ->
                    let newChild = remove key child
                    if newChild.value.IsNone && Map.isEmpty newChild.children then
                        { node with children = node.children.Remove firstChar }
                    else
                        { node with children = node.children.Add(firstChar, newChild) }
                | None -> node
        elif key.StartsWith(node.prefix, StringComparison.Ordinal) then
            let remaining = key.Substring(node.prefix.Length)
            if remaining.Length = 0 then
                { node with value = None }
            else
                let firstChar = remaining.[0]
                match node.children.TryFind firstChar with
                | Some child ->
                    let newChild = remove remaining child
                    if newChild.value.IsNone && Map.isEmpty newChild.children then
                        { node with children = node.children.Remove firstChar }
                    else
                        { node with children = node.children.Add(firstChar, newChild) }
                | None -> node
        else
            node

    let rec toList (node: PatriciaNode<'T>) : (string * 'T) list =
        let current =
            match node.value with
            | Some v -> [ node.prefix, v ]
            | None -> []
        let childrenList =
            node.children
            |> Map.toList
            |> List.collect (fun (_, child) ->
                toList child |> List.map (fun (k, v) -> node.prefix + k, v)
            )
        current @ childrenList

    let merge (resolve: 'T -> 'T -> 'T) (a: PatriciaNode<'T>) (b: PatriciaNode<'T>) : PatriciaNode<'T> =
        let listB = toList b
        let mutable res = a
        for (k, vb) in listB do
            match tryFind k res with
            | Some va ->
                let resolved = resolve va vb
                res <- insert k resolved res
            | None ->
                res <- insert k vb res
        res

/// A filesystem entry type.
[<RequireQualifiedAccess>]
type FsEntry =
    | FileEntry of MerkleHash
    | DirEntry of MerkleHash

/// A folder-structured node stored in the content store.
[<RequireQualifiedAccess>]
type ZetaFsNode<'V> =
    | File of 'V
    | Directory of PatriciaNode<FsEntry>

[<RequireQualifiedAccess>]
module ZetaFs =

    let private serializeEntry (e: FsEntry) : byte[] =
        let buf = Array.zeroCreate<byte> 17
        match e with
        | FsEntry.FileEntry h ->
            buf.[0] <- 0uy
            BinaryPrimitives.WriteUInt64LittleEndian(Span<byte>(buf, 1, 8), h.Hi)
            BinaryPrimitives.WriteUInt64LittleEndian(Span<byte>(buf, 9, 8), h.Lo)
        | FsEntry.DirEntry h ->
            buf.[0] <- 1uy
            BinaryPrimitives.WriteUInt64LittleEndian(Span<byte>(buf, 1, 8), h.Hi)
            BinaryPrimitives.WriteUInt64LittleEndian(Span<byte>(buf, 9, 8), h.Lo)
        buf

    let private serializeDir (trie: PatriciaNode<FsEntry>) : byte[] =
        let entries = Patricia.toList trie |> List.sortBy fst
        use ms = new MemoryStream()
        use bw = new BinaryWriter(ms)
        for (name, entry) in entries do
            let nameBytes = Encoding.UTF8.GetBytes(name)
            bw.Write(nameBytes.Length)
            bw.Write(nameBytes)
            let entryBytes = serializeEntry entry
            bw.Write(entryBytes)
        ms.ToArray()

    let hashNode (hashOfVal: 'V -> MerkleHash) (node: ZetaFsNode<'V>) : MerkleHash =
        match node with
        | ZetaFsNode.File v -> hashOfVal v
        | ZetaFsNode.Directory trie ->
            let bytes = serializeDir trie
            MerkleHash.ofBytes (ReadOnlySpan<byte> bytes)

    [<NoEquality; NoComparison>]
    type Tree<'V> =
        { store: ContentStore.Store<ZetaFsNode<'V>>
          root: MerkleHash }

    let create (hashOfVal: 'V -> MerkleHash) : Tree<'V> =
        let emptyDir = ZetaFsNode.Directory Patricia.empty
        let hashFn = hashNode hashOfVal
        let store = ContentStore.create hashFn
        let rootHash, store' = ContentStore.put emptyDir store
        { store = store'; root = rootHash }

    let rec resolvePath (parts: string list) (dirHash: MerkleHash) (store: ContentStore.Store<ZetaFsNode<'V>>) : FsEntry option =
        match parts with
        | [] -> Some (FsEntry.DirEntry dirHash)
        | [name] ->
            match ContentStore.get dirHash store with
            | Some (ZetaFsNode.Directory trie) -> Patricia.tryFind name trie
            | _ -> None
        | name :: rest ->
            match ContentStore.get dirHash store with
            | Some (ZetaFsNode.Directory trie) ->
                match Patricia.tryFind name trie with
                | Some (FsEntry.DirEntry subHash) -> resolvePath rest subHash store
                | _ -> None
            | _ -> None

    let rec updatePath (parts: string list) (entry: FsEntry option) (dirHash: MerkleHash) (store: ContentStore.Store<ZetaFsNode<'V>>) : MerkleHash * ContentStore.Store<ZetaFsNode<'V>> =
        match parts with
        | [] -> dirHash, store
        | [name] ->
            match ContentStore.get dirHash store with
            | Some (ZetaFsNode.Directory trie) ->
                let trie' =
                    match entry with
                    | Some e -> Patricia.insert name e trie
                    | None -> Patricia.remove name trie
                let node' = ZetaFsNode.Directory trie'
                ContentStore.put node' store
            | _ ->
                let trie = Patricia.empty
                let trie' =
                    match entry with
                    | Some e -> Patricia.insert name e trie
                    | None -> Patricia.remove name trie
                let node' = ZetaFsNode.Directory trie'
                ContentStore.put node' store
        | name :: rest ->
            let subHash, store' =
                match ContentStore.get dirHash store with
                | Some (ZetaFsNode.Directory trie) ->
                    match Patricia.tryFind name trie with
                    | Some (FsEntry.DirEntry sHash) ->
                        updatePath rest entry sHash store
                    | _ ->
                        let emptyDir = ZetaFsNode.Directory Patricia.empty
                        let emptyHash, store'' = ContentStore.put emptyDir store
                        updatePath rest entry emptyHash store''
                | _ ->
                    let emptyDir = ZetaFsNode.Directory Patricia.empty
                    let emptyHash, store'' = ContentStore.put emptyDir store
                    updatePath rest entry emptyHash store''
            
            let trie =
                match ContentStore.get dirHash store' with
                | Some (ZetaFsNode.Directory t) -> t
                | _ -> Patricia.empty
            let trie' = Patricia.insert name (FsEntry.DirEntry subHash) trie
            let node' = ZetaFsNode.Directory trie'
            ContentStore.put node' store'

    let writePath (path: string) (value: 'V) (t: Tree<'V>) : Tree<'V> =
        let parts = path.Split('/', StringSplitOptions.RemoveEmptyEntries) |> List.ofArray
        if List.isEmpty parts then t
        else
            let fileNode = ZetaFsNode.File value
            let fileHash, store' = ContentStore.put fileNode t.store
            let rootHash', store'' = updatePath parts (Some (FsEntry.FileEntry fileHash)) t.root store'
            { store = store'' ; root = rootHash' }

    let deletePath (path: string) (t: Tree<'V>) : Tree<'V> =
        let parts = path.Split('/', StringSplitOptions.RemoveEmptyEntries) |> List.ofArray
        if List.isEmpty parts then t
        else
            let rootHash', store' = updatePath parts None t.root t.store
            { store = store'; root = rootHash' }

    let readPath (path: string) (t: Tree<'V>) : 'V option =
        let parts = path.Split('/', StringSplitOptions.RemoveEmptyEntries) |> List.ofArray
        if List.isEmpty parts then None
        else
            match resolvePath parts t.root t.store with
            | Some (FsEntry.FileEntry fileHash) ->
                match ContentStore.get fileHash t.store with
                | Some (ZetaFsNode.File v) -> Some v
                | _ -> None
            | _ -> None

    let movePath (srcPath: string) (dstPath: string) (t: Tree<'V>) : Tree<'V> =
        let srcParts = srcPath.Split('/', StringSplitOptions.RemoveEmptyEntries) |> List.ofArray
        let dstParts = dstPath.Split('/', StringSplitOptions.RemoveEmptyEntries) |> List.ofArray
        if List.isEmpty srcParts || List.isEmpty dstParts then t
        else
            match resolvePath srcParts t.root t.store with
            | None -> t
            | Some entry ->
                let rootHashDel, store' = updatePath srcParts None t.root t.store
                let rootHashAdd, store'' = updatePath dstParts (Some entry) rootHashDel store'
                { store = store''; root = rootHashAdd }

    let listFolder (path: string) (t: Tree<'V>) : (string * FsEntry) list option =
        let parts = path.Split('/', StringSplitOptions.RemoveEmptyEntries) |> List.ofArray
        match resolvePath parts t.root t.store with
        | Some (FsEntry.DirEntry dirHash) ->
            match ContentStore.get dirHash t.store with
            | Some (ZetaFsNode.Directory trie) -> Some (Patricia.toList trie)
            | _ -> None
        | _ -> None

    let rec mergeDirs (resolveFile: string -> 'V -> 'V -> 'V) (ha: MerkleHash) (hb: MerkleHash) (store: ContentStore.Store<ZetaFsNode<'V>>) : MerkleHash * ContentStore.Store<ZetaFsNode<'V>> =
        if ha = hb then
            ha, store
        else
            match ContentStore.get ha store, ContentStore.get hb store with
            | Some (ZetaFsNode.Directory trieA), Some (ZetaFsNode.Directory trieB) ->
                let listB = Patricia.toList trieB
                let mutable currentTrie = trieA
                let mutable currentStore = store
                
                for (name, eb) in listB do
                    match Patricia.tryFind name currentTrie with
                    | Some ea ->
                        match ea, eb with
                        | FsEntry.DirEntry hda, FsEntry.DirEntry hdb ->
                            let mergedSubHash, store' = mergeDirs resolveFile hda hdb currentStore
                            currentTrie <- Patricia.insert name (FsEntry.DirEntry mergedSubHash) currentTrie
                            currentStore <- store'
                        | FsEntry.FileEntry hfa, FsEntry.FileEntry hfb ->
                            let va =
                                match ContentStore.get hfa currentStore with
                                | Some (ZetaFsNode.File v) -> v
                                | _ -> failwith "invalid file node"
                            let vb =
                                match ContentStore.get hfb currentStore with
                                | Some (ZetaFsNode.File v) -> v
                                | _ -> failwith "invalid file node"
                            let resolvedVal = resolveFile name va vb
                            let fileNode = ZetaFsNode.File resolvedVal
                            let fileHash, store' = ContentStore.put fileNode currentStore
                            currentTrie <- Patricia.insert name (FsEntry.FileEntry fileHash) currentTrie
                            currentStore <- store'
                        | _ ->
                            let winner =
                                match ea with
                                | FsEntry.DirEntry _ -> ea
                                | _ -> eb
                            currentTrie <- Patricia.insert name winner currentTrie
                    | None ->
                        currentTrie <- Patricia.insert name eb currentTrie
                
                let node' = ZetaFsNode.Directory currentTrie
                ContentStore.put node' currentStore
            | _ ->
                ha, store

    let merge (resolveFile: string -> 'V -> 'V -> 'V) (a: Tree<'V>) (b: Tree<'V>) : Tree<'V> =
        let storeUnion = ContentStore.merge a.store b.store
        let rootHash, store' = mergeDirs resolveFile a.root b.root storeUnion
        { store = store'; root = rootHash }

    let extractEdges (t: Tree<'V>) : struct (MerkleHash * MerkleHash) list =
        let rec walk (dirHash: MerkleHash) (acc: struct (MerkleHash * MerkleHash) list) : struct (MerkleHash * MerkleHash) list =
            match ContentStore.get dirHash t.store with
            | Some (ZetaFsNode.Directory trie) ->
                let entries = Patricia.toList trie
                let mutable currentAcc = acc
                for (_, entry) in entries do
                    match entry with
                    | FsEntry.FileEntry hf ->
                        currentAcc <- struct (dirHash, hf) :: currentAcc
                    | FsEntry.DirEntry hd ->
                        currentAcc <- struct (dirHash, hd) :: currentAcc
                        currentAcc <- walk hd currentAcc
                currentAcc
            | _ -> acc
        walk t.root []
