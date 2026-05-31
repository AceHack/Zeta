# Phase 1 proofs — client/anon path (run from a terminal with `curl`)

These cover the two parts of Phase 1's proof set that do **not** run in the SQL
editor:

- **Proof #3** — unauthenticated (anon) reads return nothing on every sensitive
  table.
- **Proof #1 (client path)** — a real logged-in user is **refused by RLS** when
  trying to UPDATE/DELETE `change_log` (returns 0 rows; the literal immutability
  error is shown by the privileged path in `phase1_proofs.sql`).

> **Key hygiene:** the value below is the **publishable** (anon) key — public by
> design, safe in client code. It is NOT a secret. **Never** put the
> `service_role` / `sb_secret_…` key in any command. Set the public key in your
> shell so it isn't pasted around:
>
> ```bash
> export SUPABASE_URL="https://mdtbgreryqddloluhdmm.supabase.co"
> export ANON="sb_publishable_…"   # your publishable key
> ```

---

## Proof #3 — anon returns nothing (RLS default-deny)

```bash
for t in items profiles field_definitions change_log; do
  printf '== %s ==\n' "$t"
  curl -s "$SUPABASE_URL/rest/v1/$t?select=*" \
    -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
  printf '\n'
done
```

**Expected:** each table prints `[]` (an empty JSON array). With RLS ON and no
policy granting the `anon` role, every row is filtered out — the safe default the
spec wants ("RLS on and no policy = inaccessible").

> Why `[]` and not `401`: Supabase grants `anon` table-level access by default and
> relies on RLS as the gate, so the request succeeds but returns zero rows. An
> optional Phase-7 hardening can additionally `REVOKE` anon table privileges
> (turning these into outright permission errors); not needed for the Phase-1 gate.

---

## Proof #1 (client path) — logged-in user cannot mutate change_log

Needs (1) a change_log row to target and (2) a user access token.

**Step 1 — get a user JWT** (you have the admin password; never log the token):

```bash
ACCESS=$(curl -s "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"email":"addisonstainback@gmail.com","password":"YOUR_ADMIN_PASSWORD"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
```

**Step 2 — confirm the session reads its own role** (sanity: single-source role):

```bash
curl -s "$SUPABASE_URL/rest/v1/rpc/current_user_role" -X POST \
  -H "apikey: $ANON" -H "Authorization: Bearer $ACCESS" -H "Content-Type: application/json"
# expected: "admin"
```

**Step 3 — find a change_log row id** (admin can SELECT change_log):

```bash
curl -s "$SUPABASE_URL/rest/v1/change_log?select=id,item_id,action&limit=1" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ACCESS"
# note an id, call it <ID>. (If empty, first insert/edit an item as admin so the
#  audit trigger writes a row.)
```

**Step 4 — attempt to mutate it (must be refused):**

```bash
# UPDATE
curl -s -X PATCH "$SUPABASE_URL/rest/v1/change_log?id=eq.<ID>" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ACCESS" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"action":"TAMPERED"}'
# expected: []   (RLS has no UPDATE policy -> row filtered -> 0 rows changed)

# DELETE
curl -s -X DELETE "$SUPABASE_URL/rest/v1/change_log?id=eq.<ID>" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ACCESS" \
  -H "Prefer: return=representation"
# expected: []   (RLS has no DELETE policy -> 0 rows deleted)
```

**Step 5 — confirm nothing changed:**

```bash
curl -s "$SUPABASE_URL/rest/v1/change_log?id=eq.<ID>&select=id,action" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ACCESS"
# expected: the row, with its ORIGINAL action (e.g. "INSERT") — unchanged.
```

The client is refused by the database (RLS), not by any UI. The explicit
`change_log is immutable` error for the privileged path is shown by
`phase1_proofs.sql`.
