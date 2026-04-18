---- MODULE SpineMergeInvariants_TTrace_1776457524 ----
EXTENDS Sequences, TLCExt, SpineMergeInvariants, Toolbox, Naturals, TLC

_expression ==
    LET SpineMergeInvariants_TEExpression == INSTANCE SpineMergeInvariants_TEExpression
    IN SpineMergeInvariants_TEExpression!expression
----

_trace ==
    LET SpineMergeInvariants_TETrace == INSTANCE SpineMergeInvariants_TETrace
    IN SpineMergeInvariants_TETrace!trace
----

_inv ==
    ~(
        TLCGet("level") = Len(_TETrace)
        /\
        totalInserted = (10)
        /\
        pendingIn = (<<>>)
        /\
        levels = ((0 :> 0 @@ 1 :> 10 @@ 2 :> 0 @@ 3 :> 0))
    )
----

_init ==
    /\ totalInserted = _TETrace[1].totalInserted
    /\ levels = _TETrace[1].levels
    /\ pendingIn = _TETrace[1].pendingIn
----

_next ==
    /\ \E i,j \in DOMAIN _TETrace:
        /\ \/ /\ j = i + 1
              /\ i = TLCGet("level")
        /\ totalInserted  = _TETrace[i].totalInserted
        /\ totalInserted' = _TETrace[j].totalInserted
        /\ levels  = _TETrace[i].levels
        /\ levels' = _TETrace[j].levels
        /\ pendingIn  = _TETrace[i].pendingIn
        /\ pendingIn' = _TETrace[j].pendingIn

\* Uncomment the ASSUME below to write the states of the error trace
\* to the given file in Json format. Note that you can pass any tuple
\* to `JsonSerialize`. For example, a sub-sequence of _TETrace.
    \* ASSUME
    \*     LET J == INSTANCE Json
    \*         IN J!JsonSerialize("SpineMergeInvariants_TTrace_1776457524.json", _TETrace)

=============================================================================

 Note that you can extract this module `SpineMergeInvariants_TEExpression`
  to a dedicated file to reuse `expression` (the module in the 
  dedicated `SpineMergeInvariants_TEExpression.tla` file takes precedence 
  over the module `SpineMergeInvariants_TEExpression` below).

---- MODULE SpineMergeInvariants_TEExpression ----
EXTENDS Sequences, TLCExt, SpineMergeInvariants, Toolbox, Naturals, TLC

expression == 
    [
        \* To hide variables of the `SpineMergeInvariants` spec from the error trace,
        \* remove the variables below.  The trace will be written in the order
        \* of the fields of this record.
        totalInserted |-> totalInserted
        ,levels |-> levels
        ,pendingIn |-> pendingIn
        
        \* Put additional constant-, state-, and action-level expressions here:
        \* ,_stateNumber |-> _TEPosition
        \* ,_totalInsertedUnchanged |-> totalInserted = totalInserted'
        
        \* Format the `totalInserted` variable as Json value.
        \* ,_totalInsertedJson |->
        \*     LET J == INSTANCE Json
        \*     IN J!ToJson(totalInserted)
        
        \* Lastly, you may build expressions over arbitrary sets of states by
        \* leveraging the _TETrace operator.  For example, this is how to
        \* count the number of times a spec variable changed up to the current
        \* state in the trace.
        \* ,_totalInsertedModCount |->
        \*     LET F[s \in DOMAIN _TETrace] ==
        \*         IF s = 1 THEN 0
        \*         ELSE IF _TETrace[s].totalInserted # _TETrace[s-1].totalInserted
        \*             THEN 1 + F[s-1] ELSE F[s-1]
        \*     IN F[_TEPosition - 1]
    ]

=============================================================================



Parsing and semantic processing can take forever if the trace below is long.
 In this case, it is advised to uncomment the module below to deserialize the
 trace from a generated binary file.

\*
\*---- MODULE SpineMergeInvariants_TETrace ----
\*EXTENDS IOUtils, SpineMergeInvariants, TLC
\*
\*trace == IODeserialize("SpineMergeInvariants_TTrace_1776457524.bin", TRUE)
\*
\*=============================================================================
\*

---- MODULE SpineMergeInvariants_TETrace ----
EXTENDS SpineMergeInvariants, TLC

trace == 
    <<
    ([totalInserted |-> 0,pendingIn |-> <<>>,levels |-> (0 :> 0 @@ 1 :> 0 @@ 2 :> 0 @@ 3 :> 0)]),
    ([totalInserted |-> 2,pendingIn |-> <<2>>,levels |-> (0 :> 0 @@ 1 :> 0 @@ 2 :> 0 @@ 3 :> 0)]),
    ([totalInserted |-> 4,pendingIn |-> <<2, 2>>,levels |-> (0 :> 0 @@ 1 :> 0 @@ 2 :> 0 @@ 3 :> 0)]),
    ([totalInserted |-> 6,pendingIn |-> <<2, 2, 2>>,levels |-> (0 :> 0 @@ 1 :> 0 @@ 2 :> 0 @@ 3 :> 0)]),
    ([totalInserted |-> 8,pendingIn |-> <<2, 2, 2, 2>>,levels |-> (0 :> 0 @@ 1 :> 0 @@ 2 :> 0 @@ 3 :> 0)]),
    ([totalInserted |-> 10,pendingIn |-> <<2, 2, 2, 2, 2>>,levels |-> (0 :> 0 @@ 1 :> 0 @@ 2 :> 0 @@ 3 :> 0)]),
    ([totalInserted |-> 10,pendingIn |-> <<2, 2, 2, 2>>,levels |-> (0 :> 2 @@ 1 :> 0 @@ 2 :> 0 @@ 3 :> 0)]),
    ([totalInserted |-> 10,pendingIn |-> <<2, 2, 2, 2>>,levels |-> (0 :> 0 @@ 1 :> 2 @@ 2 :> 0 @@ 3 :> 0)]),
    ([totalInserted |-> 10,pendingIn |-> <<2, 2, 2>>,levels |-> (0 :> 2 @@ 1 :> 2 @@ 2 :> 0 @@ 3 :> 0)]),
    ([totalInserted |-> 10,pendingIn |-> <<2, 2, 2>>,levels |-> (0 :> 0 @@ 1 :> 4 @@ 2 :> 0 @@ 3 :> 0)]),
    ([totalInserted |-> 10,pendingIn |-> <<2, 2>>,levels |-> (0 :> 2 @@ 1 :> 4 @@ 2 :> 0 @@ 3 :> 0)]),
    ([totalInserted |-> 10,pendingIn |-> <<2, 2>>,levels |-> (0 :> 0 @@ 1 :> 6 @@ 2 :> 0 @@ 3 :> 0)]),
    ([totalInserted |-> 10,pendingIn |-> <<2>>,levels |-> (0 :> 2 @@ 1 :> 6 @@ 2 :> 0 @@ 3 :> 0)]),
    ([totalInserted |-> 10,pendingIn |-> <<2>>,levels |-> (0 :> 0 @@ 1 :> 8 @@ 2 :> 0 @@ 3 :> 0)]),
    ([totalInserted |-> 10,pendingIn |-> <<>>,levels |-> (0 :> 2 @@ 1 :> 8 @@ 2 :> 0 @@ 3 :> 0)]),
    ([totalInserted |-> 10,pendingIn |-> <<>>,levels |-> (0 :> 0 @@ 1 :> 10 @@ 2 :> 0 @@ 3 :> 0)])
    >>
----


=============================================================================

---- CONFIG SpineMergeInvariants_TTrace_1776457524 ----
CONSTANTS
    MaxLevel = 3
    MaxBatchSize = 2

INVARIANT
    _inv

CHECK_DEADLOCK
    \* CHECK_DEADLOCK off because of PROPERTY or INVARIANT above.
    FALSE

INIT
    _init

NEXT
    _next

CONSTANT
    _TETrace <- _trace

ALIAS
    _expression
=============================================================================
\* Generated on Fri Apr 17 16:25:25 EDT 2026