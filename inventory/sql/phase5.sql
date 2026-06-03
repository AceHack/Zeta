-- =============================================================================
-- Inventory — Phase 5: Typed dynamic custom fields (CENTERPIECE)
-- Source-of-truth migration. Run ONCE in the Supabase SQL editor (owner/postgres),
-- AFTER inventory/sql/phase1.sql and inventory/sql/phase4.sql, and BEFORE
-- inventory/sql/proofs/phase5_proofs.sql. Idempotent (create-or-replace /
-- drop-if-exists / if-not-exists) — safe to re-run.
--
-- Governing contract: inventory/spec.md, inventory/CLAUDE.md, inventory/PROGRESS.md.
--
-- WHAT THIS ADDS (and ONLY this):
--   1. A GIN index on items.custom_fields (deferred from Phase 1 per decision #5).
--   2. A BEFORE INSERT/UPDATE validation TRIGGER on public.items that validates
--      every custom_fields value against its field_definitions-declared type, so a
--      malformed write — even one sent straight to PostgREST with the anon key,
--      bypassing the client — is REJECTED AT THE DATABASE. The DB is the final
--      authority; app-side validation is convenience only (zero-trust, spec.md).
--
-- WHY A TRIGGER, NOT A CHECK CONSTRAINT:
--   A column CHECK constraint cannot contain a subquery, so it cannot look up the
--   declared type in another table (public.field_definitions). The valid type is
--   row-driven by that table, so validation must be a trigger that reads it.
--
-- SECURITY — NOTHING IS LOOSENED:
--   * No new RLS policy. No `USING (true)`. No permissive policy. No GRANT/REVOKE.
--   * Adding a field_definitions row still requires admin (Phase-1 RLS, unchanged):
--       field_definitions_insert  WITH CHECK admin
--       field_definitions_update  USING/CHECK admin   (deactivate = is_active=false)
--   * Writing custom_fields on an item still requires editor/admin (Phase-1
--     items_update / items_insert, unchanged). This trigger ADDS type validation
--     on top; it never grants write access.
--   * change_log stays immutable; the Phase-1 audit trigger already logs
--     custom_fields changes (old JSON -> new JSON) as field='custom_fields'.
--   * The Phase-5 gate's RLS re-check (anon read on all four sensitive tables ->
--     []) must still pass unchanged after this runs.
--
-- VALIDATION FUNCTION — SECURITY DEFINER, search_path='':
--   Runs as the owner so it can read field_definitions regardless of the writer's
--   read policy (validation must not depend on the writer's RLS). It ONLY READS
--   field_definitions (no writes) -> no privilege-escalation surface. Everything
--   is schema-qualified (public.*) because search_path is empty; pg_catalog
--   built-ins (jsonb_each, jsonb_typeof, array_length) still resolve implicitly.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. GIN index on items.custom_fields (Phase-1 decision #5: deferred to Phase 5).
--    jsonb_path_ops: smaller/faster index supporting containment (@>) + key
--    membership lookups, the shape a future server-side custom-field search uses.
--    (Phase-5 search/sort itself runs client-side over the loaded rows, the same
--    as Phase 3; this index is additive infrastructure, not the active mechanism.)
-- -----------------------------------------------------------------------------
create index if not exists items_custom_fields_gin
  on public.items using gin (custom_fields jsonb_path_ops);

-- -----------------------------------------------------------------------------
-- 2. Validation function: every custom_fields value matches its declared type.
--    Type rules (jsonb_typeof of the value):
--      text     -> 'string'
--      number   -> 'number'
--      boolean  -> 'boolean'
--      date     -> 'string' matching YYYY-MM-DD AND a real calendar date
--      dropdown -> 'string' that is one of field_definitions.options[]
--    JSON null  -> allowed for any type (means "cleared / unset").
--    Unknown key (no field_definitions row) -> REJECTED (zero-trust: the client
--      cannot stuff arbitrary keys via PostgREST).
--    A key whose definition is INACTIVE is still validated against its type (its
--      value is preserved historical data; "deactivate" never deletes values).
-- -----------------------------------------------------------------------------
create or replace function public.validate_custom_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  k   text;
  v   jsonb;
  def record;
  vt  text;
  txt text;
begin
  -- Only validate when custom_fields is actually being set/changed. On UPDATE,
  -- if custom_fields is untouched, skip entirely: this is what lets a field be
  -- deactivated, or its options tightened, WITHOUT blocking ordinary edits of the
  -- 210 existing items (whose stored values predate the change).
  if tg_op = 'UPDATE' and new.custom_fields is not distinct from old.custom_fields then
    return new;
  end if;

  -- column is NOT NULL DEFAULT '{}'; be defensive anyway.
  if new.custom_fields is null then
    new.custom_fields := '{}'::jsonb;
    return new;
  end if;

  if jsonb_typeof(new.custom_fields) <> 'object' then
    raise exception 'custom_fields must be a JSON object (got %)', jsonb_typeof(new.custom_fields)
      using errcode = '22023';
  end if;

  for k, v in select key, value from jsonb_each(new.custom_fields) loop
    select fd.key, fd.label, fd.type, fd.options, fd.is_active
      into def
      from public.field_definitions fd
      where fd.key = k;

    if not found then
      raise exception 'unknown custom field "%": no field_definitions row exists', k
        using errcode = '23514';
    end if;

    vt := jsonb_typeof(v);

    -- JSON null = cleared/unset: allowed for every type.
    if vt = 'null' then
      continue;
    end if;

    if def.type = 'text' then
      if vt <> 'string' then
        raise exception 'custom field "%" (text) must be a JSON string (got %)', k, vt
          using errcode = '23514';
      end if;

    elsif def.type = 'number' then
      if vt <> 'number' then
        raise exception 'custom field "%" (number) must be a JSON number (got %)', k, vt
          using errcode = '23514';
      end if;

    elsif def.type = 'boolean' then
      if vt <> 'boolean' then
        raise exception 'custom field "%" (boolean) must be a JSON boolean (got %)', k, vt
          using errcode = '23514';
      end if;

    elsif def.type = 'date' then
      if vt <> 'string' then
        raise exception 'custom field "%" (date) must be a JSON string YYYY-MM-DD (got %)', k, vt
          using errcode = '23514';
      end if;
      txt := v #>> '{}';                         -- scalar text without JSON quotes
      if txt !~ '^\d{4}-\d{2}-\d{2}$' then
        raise exception 'custom field "%" (date) must match YYYY-MM-DD (got %)', k, txt
          using errcode = '23514';
      end if;
      begin
        perform txt::date;                       -- rejects e.g. 2024-13-40
      exception when others then
        raise exception 'custom field "%" (date) is not a valid calendar date (got %)', k, txt
          using errcode = '23514';
      end;

    elsif def.type = 'dropdown' then
      if vt <> 'string' then
        raise exception 'custom field "%" (dropdown) must be a JSON string (got %)', k, vt
          using errcode = '23514';
      end if;
      if def.options is null or array_length(def.options, 1) is null then
        raise exception 'custom field "%" (dropdown) has no options configured', k
          using errcode = '23514';
      end if;
      txt := v #>> '{}';
      if not (txt = any (def.options)) then
        raise exception 'custom field "%" (dropdown) value % is not an allowed option', k, txt
          using errcode = '23514';
      end if;

    else
      -- field_definitions.type already CHECK-constrained to the five; defensive.
      raise exception 'custom field "%" has unsupported declared type %', k, def.type
        using errcode = '23514';
    end if;
  end loop;

  return new;
end
$$;

drop trigger if exists items_validate_custom_fields on public.items;
create trigger items_validate_custom_fields
  before insert or update on public.items
  for each row execute function public.validate_custom_fields();

-- =============================================================================
-- End Phase 5 schema. Three BEFORE triggers now fire on items UPDATE
-- (items_validate_custom_fields + items_bump_version + items_set_updated_at);
-- they read/touch disjoint things (custom_fields validation vs version vs
-- updated_at) so firing order is irrelevant. The AFTER audit trigger still logs
-- the 14 business columns incl. custom_fields (old JSON -> new JSON).
--
-- Next: run inventory/sql/proofs/phase5_proofs.sql (owner, SQL editor) to prove
-- per-type validation (accept/reject) + numeric-cast sort (lexicographic vs
-- typed) + unknown-key reject + no-permissive-policy. Then the client-path proofs
-- in inventory/proofs/phase5-custom-fields-proofs.ts (admin + editor sessions,
-- publishable key, NO service_role).
-- =============================================================================
