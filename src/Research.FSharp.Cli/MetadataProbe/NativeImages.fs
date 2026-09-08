namespace Zeta.Research.MetadataProbe

open System
open System.Runtime.InteropServices
open System.Text
open Admission

/// Borrowed dyld pointers are copied in a finite loop. Equal counts do not prove atomicity.
module NativeImages =
    [<DllImport("/usr/lib/system/libdyld.dylib", EntryPoint = "_dyld_image_count", ExactSpelling = true, CallingConvention = CallingConvention.Cdecl)>]
    extern uint32 private imageCount()
    [<DllImport("/usr/lib/system/libdyld.dylib", EntryPoint = "_dyld_get_image_name", ExactSpelling = true, CallingConvention = CallingConvention.Cdecl)>]
    extern nativeint private imageName(uint32 index)
    [<DllImport("/usr/lib/system/libdyld.dylib", EntryPoint = "_dyld_get_image_header", ExactSpelling = true, CallingConvention = CallingConvention.Cdecl)>]
    extern nativeint private imageHeader(uint32 index)
    [<DllImport("/usr/lib/system/libdyld.dylib", EntryPoint = "_dyld_get_image_vmaddr_slide", ExactSpelling = true, CallingConvention = CallingConvention.Cdecl)>]
    extern nativeint private imageSlide(uint32 index)

    type Row = { Index: uint32; Name: string; Header: int64; Slide: int64 }

    let private name pointer =
        if pointer = 0n then error "dyld" "null-name" "dyld returned a null borrowed name pointer"
        else
            let bytes = ResizeArray<byte>()
            let mutable finished = false
            while bytes.Count < 8192 && not finished do
                let value = Marshal.ReadByte(pointer, bytes.Count)
                if value = 0uy then finished <- true else bytes.Add value
            if not finished then error "dyld" "name-bound" "borrowed image name exceeds 8191 bytes"
            else
                try Ok(UTF8Encoding(false, true).GetString(bytes.ToArray()))
                with reason -> Error(exceptionFailure "dyld-name" reason)

    /// Injectable callbacks exercise the same snapshot, prefix publication and refusal path.
    let internal observe count read emit =
        let mutable primary = None
        try
            let before = count()
            emit (box {| Kind = "dyld-count-before"; Count = before |})
            if before = 0u || before > 1024u then error "dyld" "count-bound" "requires 1 through 1024 observed images"
            else
                let rows = ResizeArray<Row>()
                let mutable index = 0u
                while index < before && primary.IsNone do
                    match read index with
                    | Error reason -> primary <- Some reason
                    | Ok row ->
                        rows.Add row
                        if row.Index <> index || String.IsNullOrEmpty row.Name || row.Header = 0L then
                            primary <- Some(failure "dyld" "row" "image index/name/header is invalid")
                        emit (box {| Kind = "dyld-raw-image"; Data = row |})
                    index <- index + 1u
                let after = count()
                emit (box {| Kind = "dyld-count-after"; CountBefore = before; CountAfter = after
                             CopiedRows = rows.Count; Failure = primary
                             Scope = "raw names/header/slide copied before file hashing; equal counts are not atomicity or load-race exclusion" |})
                match primary with
                | Some reason -> Error reason
                | None when after <> before -> error "dyld" "count-changed" "loader count changed during the bounded observation"
                | None -> Ok(rows.ToArray())
        with reason -> Error(defaultArg primary (exceptionFailure "dyld-observation" reason))

    let snapshot emit =
        observe imageCount (fun index ->
            match name (imageName index) with
            | Error reason -> Error reason
            | Ok value -> Ok { Index = index; Name = value; Header = int64(imageHeader index); Slide = int64(imageSlide index) }) emit

    let countAfterIdentity () = imageCount()
