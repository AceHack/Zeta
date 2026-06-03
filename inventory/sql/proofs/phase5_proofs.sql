-- =============================================================================
-- Inventory — Phase 5 proofs (SQL editor / privileged owner path)
-- Run AFTER inventory/sql/phase1.sql, phase4.sql AND phase5.sql, in the Supabase
-- SQL editor. Runs in ONE transaction that ROLLS BACK -> no artifacts (the
-- throwaway field_definitions rows + items + change_log rows all vanish).
--
-- Proves (privileged/owner path; the DB trigger is the real machinery):
--   #1  ACCEPT: a valid value of every type (text/number/date/dropdown/boolean)
--       is accepted into items.custom_fields.
--   #2  REJECT (per-type, broken-vs-fixed): a malformed value of each type is
--       REJECTED by the validation trigger (the write raises) — NOT stored.
--   #3  REJECT unknown key: a custom_fields key with no field_definitions row is
--       rejected (zero-trust; the client cannot stuff arbitrary keys).
--   #4  TYPED SORT (the "10 < 9" trap): ordering a number custom field by raw
--       JSON text is LEXICOGRAPHIC (10, 100, 9 — wrong); ordering by the value
--       CAST to numeric is correct (9, 10, 100). Proves the casting principle is
--       authoritative at the DB, not just in the client.
--   #5  NO PERMISSIVE POLICY snuck in on items or field_definitions
--       (qual/with_check are role-gated, never `true`).
--
-- HOW TO READ: one results table; rows starting "PASSED" are satisfied
-- assertions. Any "FAILED"/"UNEXPECTED" -> STOP, do not mark the gate passed.
-- =============================================================================

begin;

create temporary table _p5_results (seq int, step text, result text) on commit drop;

do $$
declare
  v_item   bigint;
  v_a      bigint;
  v_b      bigint;
  v_c      bigint;
  lex      text;
  num      text;
begin
  -- SETUP: one field definition of each of the five types (owner bypasses RLS).
  insert into public.field_definitions (key, label, type, options, required, is_active) values
    ('__p5_text__',   'P5 Text',     'text',     null,                       false, true),
    ('__p5_number__', 'P5 Number',   'number',   null,                       false, true),
    ('__p5_date__',   'P5 Date',     'date',     null,                       false, true),
    ('__p5_drop__',   'P5 Dropdown', 'dropdown', array['red','green','blue'], false, true),
    ('__p5_bool__',   'P5 Boolean',  'boolean',  null,                       false, true);

  insert into public.items (name, status, notes)
  values ('__phase5_proof_item__', 'In Storage', 'orig')
  returning id into v_item;
  insert into _p5_results values (0, 'setup', format('item id=%s + 5 typed field defs created', v_item));

  -- ---- PROOF #1: ACCEPT a valid value of every type --------------------------
  begin
    update public.items
       set custom_fields = jsonb_build_object(
             '__p5_text__',   'hello',
             '__p5_number__', 42,
             '__p5_date__',   '2024-02-29',     -- a real leap day
             '__p5_drop__',   'green',
             '__p5_bool__',   true)
     where id = v_item;
    insert into _p5_results values (1, '#1 ACCEPT all five valid',
      'PASSED: text/number/date/dropdown/boolean valid values accepted');
  exception when others then
    insert into _p5_results values (1, '#1 ACCEPT all five valid',
      format('FAILED: valid values were rejected: %s', sqlerrm));
  end;

  -- ---- PROOF #2: REJECT a malformed value of each type -----------------------
  -- number must be a JSON number, not a string:
  begin
    update public.items set custom_fields = '{"__p5_number__": "not-a-number"}'::jsonb where id = v_item;
    insert into _p5_results values (2, '#2 REJECT number<-string',
      'FAILED: a STRING was accepted into a number field (validation missing!)');
  exception when others then
    insert into _p5_results values (2, '#2 REJECT number<-string',
      format('PASSED: rejected (%s)', sqlerrm));
  end;

  -- boolean must be a JSON boolean, not a string:
  begin
    update public.items set custom_fields = '{"__p5_bool__": "yes"}'::jsonb where id = v_item;
    insert into _p5_results values (3, '#2 REJECT boolean<-string',
      'FAILED: a STRING was accepted into a boolean field');
  exception when others then
    insert into _p5_results values (3, '#2 REJECT boolean<-string',
      format('PASSED: rejected (%s)', sqlerrm));
  end;

  -- date must be a real YYYY-MM-DD:
  begin
    update public.items set custom_fields = '{"__p5_date__": "2024-13-40"}'::jsonb where id = v_item;
    insert into _p5_results values (4, '#2 REJECT date<-bad',
      'FAILED: an impossible date (2024-13-40) was accepted');
  exception when others then
    insert into _p5_results values (4, '#2 REJECT date<-bad',
      format('PASSED: rejected (%s)', sqlerrm));
  end;

  -- dropdown must be one of the configured options:
  begin
    update public.items set custom_fields = '{"__p5_drop__": "purple"}'::jsonb where id = v_item;
    insert into _p5_results values (5, '#2 REJECT dropdown<-not-an-option',
      'FAILED: an out-of-list dropdown value was accepted');
  exception when others then
    insert into _p5_results values (5, '#2 REJECT dropdown<-not-an-option',
      format('PASSED: rejected (%s)', sqlerrm));
  end;

  -- text must be a JSON string, not a number:
  begin
    update public.items set custom_fields = '{"__p5_text__": 123}'::jsonb where id = v_item;
    insert into _p5_results values (6, '#2 REJECT text<-number',
      'FAILED: a NUMBER was accepted into a text field');
  exception when others then
    insert into _p5_results values (6, '#2 REJECT text<-number',
      format('PASSED: rejected (%s)', sqlerrm));
  end;

  -- ---- PROOF #3: REJECT an unknown key ---------------------------------------
  begin
    update public.items set custom_fields = '{"__p5_unknown__": "x"}'::jsonb where id = v_item;
    insert into _p5_results values (7, '#3 REJECT unknown key',
      'FAILED: a key with no field_definitions row was accepted');
  exception when others then
    insert into _p5_results values (7, '#3 REJECT unknown key',
      format('PASSED: rejected (%s)', sqlerrm));
  end;

  -- confirm the rejected writes left the valid PROOF#1 value intact (no overwrite)
  if (select custom_fields ->> '__p5_text__' from public.items where id = v_item) = 'hello' then
    insert into _p5_results values (8, '#2/#3 value intact after rejects',
      'PASSED: custom_fields still {text:hello,...} — rejected writes changed nothing');
  else
    insert into _p5_results values (8, '#2/#3 value intact after rejects',
      'FAILED: a rejected write leaked through');
  end if;

  -- ---- PROOF #4: typed sort (10 < 9 trap) ------------------------------------
  insert into public.items (name, status, custom_fields) values
    ('__p5_sort_a__', 'In Storage', '{"__p5_number__": 9}'::jsonb)   returning id into v_a;
  insert into public.items (name, status, custom_fields) values
    ('__p5_sort_b__', 'In Storage', '{"__p5_number__": 10}'::jsonb)  returning id into v_b;
  insert into public.items (name, status, custom_fields) values
    ('__p5_sort_c__', 'In Storage', '{"__p5_number__": 100}'::jsonb) returning id into v_c;

  select string_agg(custom_fields ->> '__p5_number__', ',' order by custom_fields ->> '__p5_number__')
    into lex
    from public.items where id in (v_a, v_b, v_c);

  select string_agg(custom_fields ->> '__p5_number__', ',' order by (custom_fields ->> '__p5_number__')::numeric)
    into num
    from public.items where id in (v_a, v_b, v_c);

  insert into _p5_results values (9, '#4 LEXICOGRAPHIC (raw ->> text)',
    format('order by ->>text  = [%s]  (the "10 < 9" bug)', lex));
  if num = '9,10,100' and lex = '10,100,9' then
    insert into _p5_results values (10, '#4 TYPED (cast ::numeric)',
      format('PASSED: order by (->>text)::numeric = [%s]  (correct numeric order)', num));
  else
    insert into _p5_results values (10, '#4 TYPED (cast ::numeric)',
      format('CHECK: typed=[%s] lex=[%s] (expected typed 9,10,100 / lex 10,100,9)', num, lex));
  end if;
end
$$;

-- ---- PROOF #5: no permissive policy on items OR field_definitions -----------
insert into _p5_results
select 11,
       '#5 no permissive policy',
       case when count(*) = 0
            then 'PASSED: 0 items/field_definitions policies with USING(true)/WITH CHECK(true)'
            else format('FAILED: %s permissive policy(ies): %s', count(*), string_agg(policyname, ', '))
       end
from pg_policies
where schemaname = 'public'
  and tablename in ('items', 'field_definitions')
  and (coalesce(qual, '') = 'true' or coalesce(with_check, '') = 'true');

select seq, step, result from _p5_results order by seq;

rollback;  -- discards the throwaway field defs + items + change_log rows + tampers

-- Expected result rows (all PASSED, plus the lexicographic demo row):
--   0   setup                          item id=... + 5 typed field defs created
--   1   #1 ACCEPT all five valid       PASSED: ... valid values accepted
--   2   #2 REJECT number<-string       PASSED: rejected (custom field "__p5_number__" (number) must be a JSON number ...)
--   3   #2 REJECT boolean<-string      PASSED: rejected (...)
--   4   #2 REJECT date<-bad            PASSED: rejected (...)
--   5   #2 REJECT dropdown<-not-option PASSED: rejected (...)
--   6   #2 REJECT text<-number         PASSED: rejected (...)
--   7   #3 REJECT unknown key          PASSED: rejected (unknown custom field "__p5_unknown__" ...)
--   8   #2/#3 value intact after rejects  PASSED: custom_fields still {text:hello,...}
--   9   #4 LEXICOGRAPHIC               order by ->>text  = [10,100,9]  (the bug)
--   10  #4 TYPED (cast ::numeric)      PASSED: order by (->>text)::numeric = [9,10,100]
--   11  #5 no permissive policy        PASSED: 0 ... policies with USING(true)/WITH CHECK(true)
-- =============================================================================
