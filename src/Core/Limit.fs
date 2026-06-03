namespace Zeta.Core

open System


/// Result of checking an operation against a Limit boundary.
[<RequireQualifiedAccess>]
type PermissionState =
    | Deny
    | Allow


/// Validation failures for constructing Limit primitives.
[<RequireQualifiedAccess>]
type LimitValidationError =
    | BlankOperation
    | BlankGrantId


/// Stable operation identity checked by the Limit primitive.
[<Struct>]
type LimitOperation =
    private
    | LimitOperation of value: string

    member this.Value =
        let (LimitOperation value) = this
        value


[<RequireQualifiedAccess>]
[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module LimitOperation =

    /// Build an operation identity. Blank or whitespace-only input is
    /// malformed and therefore cannot become an allowable operation.
    let tryCreate (value: string) : Result<LimitOperation, LimitValidationError> =
        if String.IsNullOrWhiteSpace value then
            Error LimitValidationError.BlankOperation
        else
            Ok (LimitOperation(value.Trim()))

    /// True only when the operation carries a canonical (non-blank, already
    /// trimmed) value. Guards the allow path against bypasses that skip
    /// `tryCreate` — e.g. `Unchecked.defaultof<LimitOperation>` yields a
    /// null-valued struct. Fail-closed: non-canonical operations are never
    /// grantable or allowable.
    let isCanonical (operation: LimitOperation) : bool =
        let value = operation.Value
        not (String.IsNullOrWhiteSpace value) && value = value.Trim()


/// Opaque identifier for the explicit grant evidence opening one boundary.
[<Struct>]
type LimitGrantId =
    private
    | LimitGrantId of value: string

    member this.Value =
        let (LimitGrantId value) = this
        value


[<RequireQualifiedAccess>]
[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module LimitGrantId =

    /// Build a grant evidence identifier. Blank evidence remains no
    /// evidence; callers must supply a concrete positive grant.
    let tryCreate (value: string) : Result<LimitGrantId, LimitValidationError> =
        if String.IsNullOrWhiteSpace value then
            Error LimitValidationError.BlankGrantId
        else
            Ok (LimitGrantId(value.Trim()))

    /// True only when the grant evidence identifier carries a canonical
    /// (non-blank, already trimmed) value. Guards direct evidence paths
    /// against bypasses that skip `tryCreate`.
    let isCanonical (grantId: LimitGrantId) : bool =
        let value = grantId.Value
        not (String.IsNullOrWhiteSpace value) && value = value.Trim()


/// Explicit evidence that one operation is currently allowed.
type LimitGrantEvidence =
    private
        { Operation: LimitOperation
          GrantId: LimitGrantId
          GrantedAt: DateTimeOffset }


[<RequireQualifiedAccess>]
[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module LimitGrantEvidence =

    /// Build valid grant evidence. Construction requires already-valid
    /// operation and grant identifiers, so malformed input cannot be
    /// smuggled into the allow path.
    let create
        (operation: LimitOperation)
        (grantId: LimitGrantId)
        (grantedAt: DateTimeOffset) : LimitGrantEvidence =
        { Operation = operation
          GrantId = grantId
          GrantedAt = grantedAt }

    /// Operation opened by this grant evidence.
    let operation (evidence: LimitGrantEvidence) : LimitOperation =
        evidence.Operation

    /// Identifier of the explicit grant evidence.
    let grantId (evidence: LimitGrantEvidence) : LimitGrantId =
        evidence.GrantId

    /// Timestamp supplied by the caller when the grant was established.
    let grantedAt (evidence: LimitGrantEvidence) : DateTimeOffset =
        evidence.GrantedAt

    /// True only when both operation and grant identifier are canonical.
    /// Malformed evidence is no evidence for a deny-default boundary.
    let isCanonical (evidence: LimitGrantEvidence) : bool =
        not (isNull (box evidence))
        && LimitOperation.isCanonical evidence.Operation
        && LimitGrantId.isCanonical evidence.GrantId


/// Limit boundary. The default is not stored as mutable state: it is always
/// `Deny`, and only explicit valid grants create white patches.
type LimitBoundary =
    private
    | LimitBoundary of explicitGrants: Map<LimitOperation, LimitGrantEvidence>

    member _.Default =
        PermissionState.Deny

    member this.ExplicitGrants =
        let (LimitBoundary grants) = this
        grants


[<RequireQualifiedAccess>]
[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module LimitBoundary =

    /// Closed-by-default Limit boundary.
    let defaultLimit : LimitBoundary =
        LimitBoundary Map.empty

    /// Attach one explicit grant to a boundary. Malformed direct evidence is
    /// ignored fail-closed so bypassed grant identifiers cannot open a
    /// boundary.
    let withGrant (evidence: LimitGrantEvidence) (boundary: LimitBoundary) : LimitBoundary =
        if not (LimitGrantEvidence.isCanonical evidence) then
            boundary
        else
            let (LimitBoundary grants) = boundary
            LimitBoundary (Map.add (LimitGrantEvidence.operation evidence) evidence grants)

    /// Validate raw grant input and attach it when it is explicit and valid.
    /// A non-canonical operation (e.g. an `Unchecked.defaultof<LimitOperation>`
    /// bypass) is malformed and rejected fail-closed before any grant attaches.
    let tryWithGrant
        (operation: LimitOperation)
        (grantId: string)
        (grantedAt: DateTimeOffset)
        (boundary: LimitBoundary) : Result<LimitBoundary, LimitValidationError> =
        if not (LimitOperation.isCanonical operation) then
            Error LimitValidationError.BlankOperation
        else
            match LimitGrantId.tryCreate grantId with
            | Error error -> Error error
            | Ok validGrantId ->
                Ok (withGrant (LimitGrantEvidence.create operation validGrantId grantedAt) boundary)

    /// Check an operation. Absence of a matching valid grant always denies, and
    /// a non-canonical operation can never be allowed regardless of map state.
    let checkOperation (operation: LimitOperation) (boundary: LimitBoundary) : PermissionState =
        if not (LimitOperation.isCanonical operation) then
            PermissionState.Deny
        else
            let (LimitBoundary grants) = boundary

            match Map.tryFind operation grants with
            | Some evidence when LimitGrantEvidence.isCanonical evidence ->
                PermissionState.Allow
            | None -> PermissionState.Deny
            | Some _ -> PermissionState.Deny
