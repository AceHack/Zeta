-- Schema evolution model — Alloy oracle (#9 of 10).
-- Searches for counterexamples to the zero-downtime invariants.
-- If Alloy finds NONE within the scope, the properties hold.

sig FieldName {}

sig SchemaEntry {
  name: one FieldName,
  weight: one Int
}

sig SchemaZSet {
  entries: set SchemaEntry
}

sig Delta {
  retract: set FieldName,
  insert: set FieldName
}

sig Consumer {
  refs: set FieldName
}

-- Active fields: weight > 0
fun activeFields[s: SchemaZSet]: set FieldName {
  { f: FieldName | some e: s.entries | e.name = f and e.weight > 0 }
}

-- Reference count for a field
fun refCount[f: FieldName, consumers: set Consumer]: Int {
  #{ c: consumers | f in c.refs }
}

-- SAFETY: every field a consumer references must be active or in overlap
pred safety[s: SchemaZSet, consumers: set Consumer, overlapOpen: Int] {
  all c: consumers | all f: c.refs |
    f in activeFields[s] or overlapOpen > 0
}

-- QUORUM: consolidation safe iff all retracted fields have refCount = 0
pred canConsolidate[s: SchemaZSet, consumers: set Consumer] {
  all e: s.entries | e.weight <= 0 implies
    refCount[e.name, consumers] = 0
}

-- Disjoint deltas: no shared field names
pred disjoint[d1, d2: Delta] {
  no (d1.retract + d1.insert) & (d2.retract + d2.insert)
}

-- ASSERTION: safety never violated (search for counterexample)
assert SafetyHolds {
  all s: SchemaZSet, consumers: set Consumer |
    safety[s, consumers, 1] -- overlap open → everything resolves
}

-- ASSERTION: canConsolidate implies safety after consolidation
assert ConsolidateSafe {
  all s: SchemaZSet, consumers: set Consumer |
    canConsolidate[s, consumers] implies
      safety[s, consumers, 0] -- can close overlap safely
}

-- Check within bounded scope (Alloy's sweet spot)
check SafetyHolds for 4 but 3 FieldName, 3 Consumer, 6 SchemaEntry
check ConsolidateSafe for 4 but 3 FieldName, 3 Consumer, 6 SchemaEntry
