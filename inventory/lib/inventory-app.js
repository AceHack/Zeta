// =============================================================================
// Zeta Inventory — application script (Phase 7 hardening: extracted from
// index.html's inline <script> so the CSP can drop script-src 'unsafe-inline').
// Served same-origin (script-src 'self'). Logic is byte-for-byte the former
// inline block; depends on globals window.supabase / window.CustomFields /
// window.InventoryExport / window.qrcode loaded by the preceding <script src> tags.
// =============================================================================
    "use strict";
    const CF = window.CustomFields;  // shared typed-custom-field logic (lib/custom-fields.js)
    const IE = window.InventoryExport;  // shared CSV/JSON + QR deep-link logic (lib/inventory-export.js)
    const QR = window.qrcode;           // vendored QR encoder (lib/qrcode-generator-1.4.4.js)
    // QR deep-link base = THIS page (sans query/hash); on Pages -> /Zeta/inventory/.
    function pageBaseUrl() { return location.origin + location.pathname; }
    // Captured ONCE at load (survives the in-page sign-in; no navigation) and
    // resolved only AFTER a verified session loads inventory. One-shot. A stranger
    // (no account) lands on the sign-in view and the deep-link never resolves -> no data leak.
    let pendingItemId = null;

    // Public, low-privilege key (publishable/anon). Safe in client code by design;
    // real security is Postgres RLS. NEVER place the service_role/secret key here.
    const SUPABASE_URL = "https://mdtbgreryqddloluhdmm.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_UjTK7ZQ0uGX_mEm9HJOT6Q_MJjPvKE3";

    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }
    });

    // In-memory state we MUST be able to clear on sign-out (shared-device safety).
    // `items` is the canonical DB copy; `view` is the derived filtered+sorted list.
    let state = { user: null, role: null, sampleItem: null, items: [], view: [], sortKeys: [],
                  showArchived: false, debug: false, fieldDefs: [] };

    const $ = (id) => document.getElementById(id);
    const signinView = $("signin-view"), appView = $("app-view"), statusEl = $("status");

    function setStatus(t) { statusEl.textContent = t || ""; }
    function showMsg(el, text, kind) { el.className = "msg " + (kind||"info"); el.textContent = text; el.classList.remove("hidden"); }
    function hide(el) { el.classList.add("hidden"); }

    // TRUST decisions always use getUser() (server-verified), never getSession().
    async function verifiedUser() {
      const { data, error } = await sb.auth.getUser();
      if (error) return null;
      return data && data.user ? data.user : null;
    }
    async function readRole() {
      const { data, error } = await sb.rpc("current_user_role");
      if (error) return null;
      return data;
    }

    // ---- columns for the wide table + multi-sort ----
    const COLUMNS = [
      { key:"id",          label:"ID",       type:"num" },
      { key:"name",        label:"Name",     type:"str" },
      { key:"brand",       label:"Brand",    type:"str" },
      { key:"model_pn",    label:"Model/PN", type:"str" },
      { key:"qty",         label:"Qty",      type:"num" },
      { key:"device_type", label:"Type",     type:"str" },
      { key:"category",    label:"Category", type:"str" },
      { key:"status",      label:"Status",   type:"str" },
      { key:"location",    label:"Location", type:"str" },
      { key:"notes",       label:"Notes",    type:"str" },
    ];
    // search spans exactly these 5 fields (Phase 3 scope; custom fields = Phase 5).
    const SEARCH_FIELDS = ["name","brand","model_pn","device_type","category"];

    // ---- Phase 5: typed dynamic custom fields ----
    // ONE select list (now incl. custom_fields) — was duplicated 4x; centralized.
    const ITEM_SELECT = "id,name,brand,model_pn,qty,device_type,category,status,location,assignment_purpose,notes,value,serial,is_archived,custom_fields,version,created_at,updated_at";

    function activeDefs() { return state.fieldDefs.filter((d) => d.is_active); }
    function customColumns() {
      return activeDefs().map((d) => ({
        key: "cf:" + d.key, label: d.label, def: d, isCustom: true,
        ctype: CF.comparatorType(d.type),
      }));
    }
    function allColumns() { return COLUMNS.concat(customColumns()); }
    function defByKey(key) { return state.fieldDefs.find((d) => d.key === key) || null; }
    // accessor + comparator type for a sort key (core OR "cf:<key>" custom).
    function colMeta(key) {
      if (key.indexOf("cf:") === 0) {
        const d = activeDefs().find((x) => x.key === key.slice(3));
        if (!d) return null;
        return { ctype: CF.comparatorType(d.type),
                 get: (it) => (it.custom_fields ? it.custom_fields[d.key] : null) };
      }
      const col = COLUMNS.find((c) => c.key === key);
      if (!col) return null;
      return { ctype: col.type === "num" ? "num" : "str", get: (it) => it[key] };
    }
    // merge form custom values onto the item's EXISTING custom_fields so INACTIVE
    // keys (not shown in the form) are PRESERVED, never dropped on save.
    function mergeCustom(origCf, formCustom) {
      const out = Object.assign({}, origCf || {});
      for (const k of Object.keys(formCustom)) {
        if (formCustom[k] === null) delete out[k]; else out[k] = formCustom[k];
      }
      return out;
    }

    function statusPillClass(s) {
      if (s === "Needs Attention") return "pill pill-attn";
      if (s === "Active/In Use") return "pill pill-active";
      return "pill pill-other";
    }

    // distinct, sorted, non-null values for a filter dropdown
    function distinct(field) {
      const set = new Set();
      for (const it of state.items) { const v = it[field]; if (v !== null && v !== undefined && v !== "") set.add(v); }
      return [...set].sort((a,b) => String(a).localeCompare(String(b), undefined, { sensitivity:"base" }));
    }
    function fillSelect(id, field) {
      const sel = $(id); const cur = sel.value;
      // keep the "All" option (first child), drop the rest, repopulate via textContent
      while (sel.children.length > 1) sel.removeChild(sel.lastChild);
      for (const v of distinct(field)) {
        const o = document.createElement("option");
        o.value = String(v); o.textContent = String(v);   // textContent => no injection
        sel.appendChild(o);
      }
      if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
    }

    function applyView() {
      const q = $("search").value.trim().toLowerCase();
      const fc = $("f-category").value, fb = $("f-brand").value, fs = $("f-status").value, fl = $("f-location").value;
      const attn = $("f-attn").checked;

      let rows = state.items.filter((it) => {
        if (!state.showArchived && it.is_archived) return false;
        if (fc && it.category !== fc) return false;
        if (fb && it.brand !== fb) return false;
        if (fs && it.status !== fs) return false;
        if (fl && it.location !== fl) return false;
        if (attn && it.status !== "Needs Attention") return false;
        if (q) {
          let hay = SEARCH_FIELDS.map((f) => (it[f] == null ? "" : String(it[f]).toLowerCase())).join("  ");
          for (const d of activeDefs()) {
            const cv = it.custom_fields ? it.custom_fields[d.key] : null;
            hay += "  " + CF.searchTextForValue(d, cv).toLowerCase();
          }
          if (!hay.includes(q)) return false;
        }
        return true;
      });

      // multi-column stable sort
      if (state.sortKeys.length) {
        rows = rows.slice().sort((a, b) => {
          for (const { key, dir } of state.sortKeys) {
            const meta = colMeta(key);
            if (!meta) continue;
            // shared typed comparator (lib/custom-fields.js): numeric/date/bool/str,
            // nulls treated as +inf so the dir flip gives the same null semantics
            // as the core columns did. Custom keys are "cf:<key>".
            const cmp = CF.compareValues(meta.ctype, meta.get(a), meta.get(b));
            if (cmp !== 0) return dir === "desc" ? -cmp : cmp;
          }
          return 0;
        });
      }
      state.view = rows;
      renderRows();
    }

    function renderHead() {
      const tr = $("inv-thead"); tr.replaceChildren();
      for (const col of allColumns()) {
        const th = document.createElement("th");
        th.textContent = col.label;             // textContent (labels are static, but keep the discipline)
        const sk = state.sortKeys.find((s) => s.key === col.key);
        if (sk) {
          const span = document.createElement("span");
          span.className = "arrow";
          const idx = state.sortKeys.length > 1 ? String(state.sortKeys.indexOf(sk) + 1) : "";
          span.textContent = (sk.dir === "desc" ? " ▼" : " ▲") + idx;
          th.appendChild(span);
        }
        th.addEventListener("click", (e) => onSort(col.key, e.shiftKey));
        tr.appendChild(th);
      }
      {
        // Actions column is ALWAYS present now: View (all roles) + writer actions.
        const ath = document.createElement("th"); ath.textContent = "Actions";
        ath.style.cursor = "default"; tr.appendChild(ath);
      }
    }

    function td(text, cls) {
      const c = document.createElement("td");
      if (cls) c.className = cls;
      c.textContent = (text == null || text === "") ? "—" : String(text);   // XSS-safe + null dash
      return c;
    }

    function renderRows() {
      const tbody = $("inv-tbody"); tbody.replaceChildren();
      const cards = $("inv-cards"); cards.replaceChildren();
      const empty = $("empty-state");

      $("count-pill").textContent =
        state.view.length === state.items.length
          ? state.items.length + " items"
          : state.view.length + " of " + state.items.length + " items";

      if (state.view.length === 0) { empty.classList.remove("hidden"); return; }
      empty.classList.add("hidden");

      // wide: table rows
      for (const it of state.view) {
        const tr = document.createElement("tr");
        if (it.is_archived) tr.className = "is-archived";
        tr.appendChild(td(it.id, "cell-id num"));
        tr.appendChild(td(it.name, "cell-name"));
        tr.appendChild(td(it.brand));
        tr.appendChild(td(it.model_pn));
        tr.appendChild(td(it.qty, "num"));
        tr.appendChild(td(it.device_type));
        tr.appendChild(td(it.category));
        // status as a pill
        const stTd = document.createElement("td");
        if (it.status) {
          const span = document.createElement("span");
          span.className = statusPillClass(it.status);
          span.textContent = it.status;            // XSS-safe
          stTd.appendChild(span);
        } else { stTd.textContent = "—"; }
        tr.appendChild(stTd);
        tr.appendChild(td(it.location));
        tr.appendChild(td(it.notes, "cell-notes"));
        for (const d of activeDefs()) {                       // Phase 5 custom columns
          const cv = it.custom_fields ? it.custom_fields[d.key] : null;
          tr.appendChild(td(CF.displayText(d, cv), d.type === "number" ? "num" : null));
        }
        {
          const atd = document.createElement("td");
          atd.appendChild(rowActions(it));
          tr.appendChild(atd);
        }
        tbody.appendChild(tr);
      }

      // narrow: cards
      for (const it of state.view) {
        const card = document.createElement("div"); card.className = "card" + (it.is_archived ? " is-archived" : "");
        const top = document.createElement("div"); top.className = "card-top";
        const left = document.createElement("div");
        const nm = document.createElement("div"); nm.className = "card-name";
        nm.textContent = (it.name == null || it.name === "") ? "(unnamed)" : String(it.name);
        const sub = document.createElement("div"); sub.className = "card-sub";
        sub.textContent = "#" + it.id + (it.brand ? " · " + it.brand : "") + (it.model_pn ? " · " + it.model_pn : "");
        left.appendChild(nm); left.appendChild(sub);
        const stWrap = document.createElement("div");
        if (it.status) { const sp = document.createElement("span"); sp.className = statusPillClass(it.status); sp.textContent = it.status; stWrap.appendChild(sp); }
        top.appendChild(left); top.appendChild(stWrap);
        card.appendChild(top);

        const kv = document.createElement("div"); kv.className = "kv";
        const pair = (k, v) => {
          const kd = document.createElement("div"); kd.className = "k"; kd.textContent = k;
          const vd = document.createElement("div"); vd.textContent = (v == null || v === "") ? "—" : String(v);
          kv.appendChild(kd); kv.appendChild(vd);
        };
        pair("Qty", it.qty); pair("Type", it.device_type); pair("Category", it.category); pair("Location", it.location);
        for (const d of activeDefs()) {                       // Phase 5 custom fields
          const cv = it.custom_fields ? it.custom_fields[d.key] : null;
          pair(d.label, CF.displayText(d, cv));
        }
        card.appendChild(kv);

        if (it.notes) { const nd = document.createElement("div"); nd.className = "card-notes"; nd.textContent = String(it.notes); card.appendChild(nd); }
        { const ca = rowActions(it); ca.classList.add("card-actions"); card.appendChild(ca); }
        cards.appendChild(card);
      }
    }

    function onSort(key, additive) {
      const existing = state.sortKeys.find((s) => s.key === key);
      if (additive) {
        if (existing) existing.dir = existing.dir === "asc" ? "desc" : "asc";
        else state.sortKeys.push({ key, dir:"asc" });
      } else {
        if (existing && state.sortKeys.length === 1) existing.dir = existing.dir === "asc" ? "desc" : "asc";
        else state.sortKeys = [{ key, dir:"asc" }];
      }
      renderHead();
      applyView();
    }

    function wireControls() {
      $("search").addEventListener("input", applyView);
      for (const id of ["f-category","f-brand","f-status","f-location"]) $(id).addEventListener("change", applyView);
      $("f-attn").addEventListener("change", applyView);
      $("reset-btn").addEventListener("click", () => {
        $("search").value = ""; $("f-attn").checked = false;
        $("f-archived").checked = false; state.showArchived = false;
        for (const id of ["f-category","f-brand","f-status","f-location"]) $(id).value = "";
        state.sortKeys = []; renderHead(); applyView();
      });
    }

    async function loadInventory() {
      const inv = $("inv-status");
      inv.classList.remove("hidden"); showMsg(inv, "Loading inventory…", "info");
      // free-tier cold-start can be slow; one gentle retry with a "waking up" note.
      let data, error;
      for (let attempt = 0; attempt < 2; attempt++) {
        ({ data, error } = await sb.from("items")
          .select(ITEM_SELECT)
          .order("id", { ascending: true }));
        if (!error) break;
        showMsg(inv, "Backend waking up… retrying", "info");
        await new Promise((r) => setTimeout(r, 1500));
      }
      if (error) { showMsg(inv, "Could not load inventory: " + error.message, "bad"); return; }
      state.items = Array.isArray(data) ? data : [];
      // populate filter dropdowns from the data
      fillSelect("f-category","category"); fillSelect("f-brand","brand");
      fillSelect("f-status","status"); fillSelect("f-location","location");
      state.sortKeys = [{ key:"id", dir:"asc" }];
      renderHead();
      applyView();
      inv.classList.add("hidden");

      // diagnostics sample item (Phase 2 scaffolding)
      state.sampleItem = state.items[0] || null;
      $("sample-item").textContent = state.sampleItem
        ? ("#" + state.sampleItem.id + " — " + (state.sampleItem.name || "(unnamed)") + " [" + (state.sampleItem.status || "—") + "]")
        : "(no items visible)";
    }

    // =========================================================================
    // Phase 4: WRITE PATH (edit / add / archive / un-archive). The DATABASE
    // (RLS items_insert/items_update = editor/admin) is the real gate; the
    // buttons below are cosmetic. Optimistic locking: every save carries the
    // loaded `version`; the server-side trigger bumps it, so a stale save
    // matches 0 rows -> rejected (never a silent overwrite).
    // =========================================================================

    function canWrite() { return state.role === "editor" || state.role === "admin"; }

    // Editable core fields ONLY. custom_fields editing is Phase 5 (excluded here).
    const STATUS_VOCAB = ["Active/In Use","In Storage","Needs Attention","In Repair",
                          "Retired (Archived)","Disposed","Missing"];
    const EDIT_FIELDS = [
      { key:"name",               label:"Name",               kind:"text",   full:true },
      { key:"brand",              label:"Brand",              kind:"text" },
      { key:"model_pn",           label:"Model / PN",         kind:"text" },
      { key:"qty",                label:"Qty",                kind:"int" },
      { key:"device_type",        label:"Device type",        kind:"text" },
      { key:"category",           label:"Category",           kind:"text" },
      { key:"status",             label:"Status",             kind:"status" },
      { key:"location",           label:"Location",           kind:"text" },
      { key:"assignment_purpose", label:"Assignment / purpose", kind:"text", full:true },
      { key:"value",              label:"Value",              kind:"num" },
      { key:"serial",             label:"Serial",             kind:"text" },
      { key:"notes",              label:"Notes",              kind:"textarea", full:true },
    ];

    // ---- modal primitives ----------------------------------------------------
    const modalOverlay = () => $("modal-overlay");
    function openModal(title) {
      $("modal-title").textContent = title;
      $("modal-body").replaceChildren();
      $("modal-foot").replaceChildren();
      hide($("modal-msg")); $("modal-msg").textContent = "";
      modalOverlay().classList.remove("hidden");
    }
    function closeModal() {
      modalOverlay().classList.add("hidden");
      $("modal-body").replaceChildren(); $("modal-foot").replaceChildren();
      state.editing = null;
    }
    function modalMsg(text, kind) { showMsg($("modal-msg"), text, kind); }
    function footBtn(label, cls, onClick) {
      const b = document.createElement("button"); b.type = "button";
      b.className = cls; b.textContent = label; b.addEventListener("click", onClick);
      return b;
    }

    function rowActions(it) {
      const wrap = document.createElement("div"); wrap.className = "actions";
      // View (read-only record + QR/label) is available to ALL signed-in roles.
      wrap.appendChild(footBtn("View", "btn-sm ghost", () => openItemRecord(it)));
      // Writer-only actions; the DATABASE (RLS) is the real gate regardless of UI.
      if (canWrite()) {
        wrap.appendChild(footBtn("Edit", "btn-sm ghost", () => openEdit(it)));
        wrap.appendChild(footBtn("History", "btn-sm ghost", () => openHistory(it)));
        if (it.is_archived) wrap.appendChild(footBtn("Un-archive", "btn-sm", () => confirmArchive(it, false)));
        else                wrap.appendChild(footBtn("Archive", "btn-sm danger", () => confirmArchive(it, true)));
      }
      return wrap;
    }

    // ---- build the edit/add form (textContent / .value only — XSS-safe) ------
    function buildForm(item) {
      const body = $("modal-body"); body.replaceChildren(); body.className = "modal-body form-grid";
      const inputs = {};
      for (const f of EDIT_FIELDS) {
        const cell = document.createElement("div"); if (f.full) cell.className = "full";
        const lab = document.createElement("label"); lab.textContent = f.label; lab.htmlFor = "fld-" + f.key;
        cell.appendChild(lab);
        let el;
        if (f.kind === "status") {
          el = document.createElement("select");
          const blank = document.createElement("option"); blank.value = ""; blank.textContent = "(none)";
          el.appendChild(blank);
          for (const v of STATUS_VOCAB) { const o = document.createElement("option"); o.value = v; o.textContent = v; el.appendChild(o); }
          el.value = item[f.key] == null ? "" : String(item[f.key]);
        } else if (f.kind === "textarea") {
          el = document.createElement("textarea");
          el.value = item[f.key] == null ? "" : String(item[f.key]);
        } else {
          el = document.createElement("input");
          el.type = (f.kind === "int" || f.kind === "num") ? "number" : "text";
          if (f.kind === "int") el.step = "1";
          if (f.kind === "num") el.step = "0.01";
          if (f.kind === "int" || f.kind === "num") el.min = "0";
          el.value = item[f.key] == null ? "" : String(item[f.key]);
        }
        el.id = "fld-" + f.key;
        cell.appendChild(el); body.appendChild(cell);
        inputs[f.key] = el;
      }
      // ---- Phase 5: typed inputs for active custom fields. Labels + dropdown
      //      options set via textContent ONLY (XSS-safe), same discipline as core.
      const customInputs = {};
      const defs = activeDefs();
      if (defs.length) {
        const sep = document.createElement("div"); sep.className = "full";
        const sh = document.createElement("div"); sh.className = "muted";
        sh.style.cssText = "border-top:1px solid var(--panel-border);padding-top:8px;font-size:.74rem;text-transform:uppercase;letter-spacing:.5px;";
        sh.textContent = "Custom fields"; sep.appendChild(sh); body.appendChild(sep);
      }
      const curCf = item.custom_fields || {};
      for (const d of defs) {
        const cell = document.createElement("div");
        const lab = document.createElement("label"); lab.textContent = d.label; lab.htmlFor = "cf-" + d.key;
        cell.appendChild(lab);
        const cur = curCf[d.key];
        let el;
        if (d.type === "dropdown") {
          el = document.createElement("select");
          const blank = document.createElement("option"); blank.value = ""; blank.textContent = "(none)"; el.appendChild(blank);
          for (const opt of (d.options || [])) { const o = document.createElement("option"); o.value = opt; o.textContent = opt; el.appendChild(o); }
          el.value = cur == null ? "" : String(cur);
        } else if (d.type === "boolean") {
          el = document.createElement("select");
          for (const ov of [["", "(none)"], ["true", "Yes"], ["false", "No"]]) { const o = document.createElement("option"); o.value = ov[0]; o.textContent = ov[1]; el.appendChild(o); }
          el.value = cur === true ? "true" : cur === false ? "false" : "";
        } else {
          el = document.createElement("input");
          el.type = d.type === "number" ? "number" : d.type === "date" ? "date" : "text";
          if (d.type === "number") el.step = "any";
          el.value = cur == null ? "" : String(cur);
        }
        el.id = "cf-" + d.key;
        cell.appendChild(el); body.appendChild(cell);
        customInputs[d.key] = el;
      }
      return { core: inputs, custom: customInputs };
    }

    // collect + type-validate; returns {ok, values, custom} or {ok:false, error}.
    // refs = { core, custom } from buildForm. `custom` maps active def key -> typed
    // value (null = cleared). The DB trigger (phase5.sql) is the FINAL authority.
    function collectForm(refs) {
      const inputs = refs.core, customInputs = refs.custom || {};
      const values = {};
      for (const f of EDIT_FIELDS) {
        const raw = inputs[f.key].value;
        if (f.kind === "int" || f.kind === "num") {
          if (raw.trim() === "") { values[f.key] = null; continue; }
          const num = Number(raw);
          if (!Number.isFinite(num) || num < 0) return { ok:false, error: f.label + " must be a non-negative number." };
          if (f.kind === "int" && !Number.isInteger(num)) return { ok:false, error: f.label + " must be a whole number." };
          values[f.key] = num;
        } else {
          const t = raw.trim();
          values[f.key] = t === "" ? null : t;
        }
      }
      const custom = {};
      for (const d of activeDefs()) {
        const el = customInputs[d.key];
        if (!el) continue;
        const r = CF.coerceFormValue(d, el.value);
        if (!r.ok) return { ok:false, error: r.error };
        custom[d.key] = r.value;
      }
      return { ok:true, values, custom };
    }

    function diffFields(orig, next) {
      const changed = {};
      for (const f of EDIT_FIELDS) {
        const a = orig[f.key] == null ? null : orig[f.key];
        const b = next[f.key];
        // normalize numbers for comparison
        const na = (f.kind==="int"||f.kind==="num") && a != null ? Number(a) : a;
        const nb = (f.kind==="int"||f.kind==="num") && b != null ? Number(b) : b;
        if (na !== nb) changed[f.key] = b;
      }
      return changed;
    }

    function showDiffConfirm(orig, changed, onConfirm) {
      const body = $("modal-body"); body.replaceChildren(); body.className = "modal-body";
      const p = document.createElement("p"); p.className = "muted";
      p.textContent = "Confirm these changes:"; body.appendChild(p);
      const dl = document.createElement("div"); dl.className = "diff-list";
      for (const k of Object.keys(changed)) {
        if (k === "custom_fields") { renderCustomDiff(orig.custom_fields || {}, changed.custom_fields || {}, dl); continue; }
        const kd = document.createElement("div"); kd.className = "k"; kd.textContent = k;
        const vd = document.createElement("div");
        const oldS = document.createElement("span"); oldS.className = "diff-old";
        oldS.textContent = orig[k] == null || orig[k] === "" ? "(empty)" : String(orig[k]);
        const arrow = document.createTextNode("  →  ");
        const newS = document.createElement("span"); newS.className = "diff-new";
        newS.textContent = changed[k] == null || changed[k] === "" ? "(empty)" : String(changed[k]);
        vd.appendChild(oldS); vd.appendChild(arrow); vd.appendChild(newS);
        dl.appendChild(kd); dl.appendChild(vd);
      }
      body.appendChild(dl);
      const foot = $("modal-foot"); foot.replaceChildren();
      foot.appendChild(footBtn("Cancel", "secondary", closeModal));
      foot.appendChild(footBtn("Save changes", "", onConfirm));
    }

    // ---- EDIT ----------------------------------------------------------------
    function openEdit(item) {
      if (!canWrite()) return;
      const orig = state.items.find((x) => x.id === item.id) || item;
      state.editing = { id: orig.id, version: orig.version };
      openModal("Edit item #" + orig.id);
      const refs = buildForm(orig);
      const foot = $("modal-foot");
      foot.appendChild(footBtn("Cancel", "secondary", closeModal));
      foot.appendChild(footBtn("Review changes", "", () => {
        const c = collectForm(refs);
        if (!c.ok) { modalMsg(c.error, "bad"); return; }
        const changed = diffFields(orig, c.values);
        const mergedCf = mergeCustom(orig.custom_fields, c.custom);
        if (JSON.stringify(mergedCf) !== JSON.stringify(orig.custom_fields || {})) changed.custom_fields = mergedCf;
        if (Object.keys(changed).length === 0) { modalMsg("No changes to save.", "info"); return; }
        showDiffConfirm(orig, changed, () => saveEdit(orig, changed));
      }));
    }

    async function saveEdit(orig, changed) {
      setStatus("Saving…");
      const { data, error } = await sb.from("items")
        .update(changed).eq("id", orig.id).eq("version", orig.version)
        .select(ITEM_SELECT);
      setStatus("");
      if (error) { modalMsg("Save failed: " + error.message, "bad"); return; }
      if (!data || data.length === 0) { await handleZeroRows(orig, "save"); return; }
      mergeRow(data[0]); applyView(); closeModal();
      setStatus("Saved #" + data[0].id + " (version " + data[0].version + ").");
    }

    // 0 rows + no error => either stale version, or RLS refusal. Re-fetch to tell apart.
    async function handleZeroRows(orig, what) {
      const { data } = await sb.from("items").select("id,version").eq("id", orig.id);
      if (!data || data.length === 0) { modalMsg("Item no longer exists (it may have been removed).", "bad"); return; }
      const fresh = data[0];
      if (fresh.version !== orig.version) {
        // stale-version conflict — offer reload (undo of the user's lost edit attempt)
        const body = $("modal-body"); body.replaceChildren(); body.className = "modal-body";
        const p = document.createElement("p");
        p.textContent = "This item was changed by someone else since you opened it (version " +
          orig.version + " → " + fresh.version + "). Your " + what + " was REJECTED, not applied " +
          "(no silent overwrite). Reload the latest and try again.";
        body.appendChild(p);
        const foot = $("modal-foot"); foot.replaceChildren();
        foot.appendChild(footBtn("Close", "secondary", closeModal));
        foot.appendChild(footBtn("Reload latest", "", async () => {
          await loadInventory();
          const latest = state.items.find((x) => x.id === orig.id);
          if (latest) openEdit(latest); else closeModal();
        }));
        hide($("modal-msg"));
      } else {
        // version unchanged but 0 rows => RLS refused (e.g. role downgraded mid-session)
        modalMsg("The database refused this " + what + " (role=" + state.role + "). RLS is the gate.", "bad");
      }
    }

    // ---- ADD -----------------------------------------------------------------
    function openAdd() {
      if (!canWrite()) return;
      const blank = {}; for (const f of EDIT_FIELDS) blank[f.key] = null;
      openModal("Add item");
      const refs = buildForm(blank);
      const foot = $("modal-foot");
      foot.appendChild(footBtn("Cancel", "secondary", closeModal));
      foot.appendChild(footBtn("Review", "", () => {
        const c = collectForm(refs);
        if (!c.ok) { modalMsg(c.error, "bad"); return; }
        if (c.values.name == null) { modalMsg("Name is required for a new item.", "bad"); return; }
        // confirm: show the non-empty fields
        const body = $("modal-body"); body.replaceChildren(); body.className = "modal-body";
        const p = document.createElement("p"); p.className = "muted"; p.textContent = "Confirm the new item:"; body.appendChild(p);
        const dl = document.createElement("div"); dl.className = "diff-list";
        for (const f of EDIT_FIELDS) {
          if (c.values[f.key] == null) continue;
          const kd = document.createElement("div"); kd.className = "k"; kd.textContent = f.key;
          const vd = document.createElement("div"); vd.className = "diff-new"; vd.textContent = String(c.values[f.key]);
          dl.appendChild(kd); dl.appendChild(vd);
        }
        for (const d of activeDefs()) {
          if (c.custom[d.key] == null) continue;
          const kd = document.createElement("div"); kd.className = "k"; kd.textContent = d.label;
          const vd = document.createElement("div"); vd.className = "diff-new"; vd.textContent = CF.displayText(d, c.custom[d.key]);
          dl.appendChild(kd); dl.appendChild(vd);
        }
        body.appendChild(dl);
        const ft = $("modal-foot"); ft.replaceChildren();
        ft.appendChild(footBtn("Back", "secondary", () => openAddPrefilled(c.values, c.custom)));
        ft.appendChild(footBtn("Create item", "", () => addItem(c.values, c.custom)));
      }));
    }
    function openAddPrefilled(values, customVals) {
      openModal("Add item");
      const seed = Object.assign({}, values, { custom_fields: customVals || {} });
      const refs = buildForm(seed);
      const foot = $("modal-foot");
      foot.appendChild(footBtn("Cancel", "secondary", closeModal));
      foot.appendChild(footBtn("Review", "", () => {
        const c = collectForm(refs);
        if (!c.ok) { modalMsg(c.error, "bad"); return; }
        if (c.values.name == null) { modalMsg("Name is required.", "bad"); return; }
        addItem(c.values, c.custom);
      }));
    }
    async function addItem(values, customVals) {
      setStatus("Adding…");
      const payload = Object.assign({}, values, { custom_fields: mergeCustom({}, customVals || {}) });
      const { data, error } = await sb.from("items").insert([payload])
        .select(ITEM_SELECT);
      setStatus("");
      if (error) { modalMsg("Add failed: " + error.message, "bad"); return; }
      if (!data || data.length === 0) { modalMsg("The database refused this insert (role=" + state.role + ").", "bad"); return; }
      state.items.push(data[0]);
      state.items.sort((a, b) => a.id - b.id);
      fillSelect("f-category","category"); fillSelect("f-brand","brand");
      fillSelect("f-status","status"); fillSelect("f-location","location");
      applyView(); closeModal();
      setStatus("Added item #" + data[0].id + ".");
    }

    // ---- ARCHIVE / UN-ARCHIVE -----------------------------------------------
    function confirmArchive(item, toArchived) {
      if (!canWrite()) return;
      const orig = state.items.find((x) => x.id === item.id) || item;
      openModal((toArchived ? "Archive" : "Un-archive") + " item #" + orig.id);
      const body = $("modal-body"); body.className = "modal-body";
      const p = document.createElement("p");
      p.textContent = toArchived
        ? "Archive \"" + (orig.name || "(unnamed)") + "\"? It will be hidden from the default view (recoverable via Un-archive)."
        : "Un-archive \"" + (orig.name || "(unnamed)") + "\"? It will return to the active inventory.";
      body.appendChild(p);
      const foot = $("modal-foot");
      foot.appendChild(footBtn("Cancel", "secondary", closeModal));
      foot.appendChild(footBtn(toArchived ? "Archive" : "Un-archive", toArchived ? "danger" : "", async () => {
        setStatus(toArchived ? "Archiving…" : "Un-archiving…");
        const { data, error } = await sb.from("items")
          .update({ is_archived: toArchived }).eq("id", orig.id).eq("version", orig.version)
          .select(ITEM_SELECT);
        setStatus("");
        if (error) { modalMsg("Failed: " + error.message, "bad"); return; }
        if (!data || data.length === 0) { await handleZeroRows(orig, toArchived ? "archive" : "un-archive"); return; }
        mergeRow(data[0]); applyView(); closeModal();
        setStatus((toArchived ? "Archived" : "Un-archived") + " #" + data[0].id + ".");
      }));
    }

    // ---- HISTORY (per-item change_log; UTC stored, local shown) --------------
    async function openHistory(item) {
      openModal("History — item #" + item.id);
      const body = $("modal-body"); body.className = "modal-body";
      const loading = document.createElement("p"); loading.className = "muted"; loading.textContent = "Loading history…";
      body.appendChild(loading);
      const foot = $("modal-foot"); foot.appendChild(footBtn("Close", "secondary", closeModal));
      const { data, error } = await sb.from("change_log")
        .select("id,actor,action,field,old_value,new_value,changed_at")
        .eq("item_id", item.id).order("id", { ascending: true });
      body.replaceChildren();
      if (error) { modalMsg("Could not load history: " + error.message, "bad"); return; }
      if (!data || data.length === 0) { const e = document.createElement("p"); e.className = "muted"; e.textContent = "No history rows."; body.appendChild(e); return; }
      const list = document.createElement("div"); list.className = "hist-list";
      for (const h of data) {
        const row = document.createElement("div"); row.className = "hist-row";
        const head = document.createElement("div");
        const action = document.createElement("strong"); action.textContent = h.action + (h.field ? " · " + h.field : "");
        head.appendChild(action);
        if (h.action === "UPDATE") {
          const d = document.createElement("div");
          const o = document.createElement("span"); o.className = "diff-old"; o.textContent = h.old_value == null ? "(empty)" : String(h.old_value);
          const ar = document.createTextNode("  →  ");
          const n = document.createElement("span"); n.className = "diff-new"; n.textContent = h.new_value == null ? "(empty)" : String(h.new_value);
          d.appendChild(o); d.appendChild(ar); d.appendChild(n); row.appendChild(head); row.appendChild(d);
        } else { row.appendChild(head); }
        const meta = document.createElement("div"); meta.className = "hh";
        const local = new Date(h.changed_at).toLocaleString();
        meta.textContent = local;                 // local display
        meta.title = "UTC stored: " + h.changed_at; // raw UTC on hover
        row.appendChild(meta);
        list.appendChild(row);
      }
      body.appendChild(list);
    }

    // ---- Phase 5: per-changed-custom-field diff rows (labels + values via
    //      textContent — XSS-safe) ----
    function renderCustomDiff(origCf, newCf, dl) {
      const keys = new Set([...Object.keys(origCf || {}), ...Object.keys(newCf || {})]);
      for (const sk of keys) {
        const ov = (origCf || {})[sk], nv = (newCf || {})[sk];
        if (JSON.stringify(ov) === JSON.stringify(nv)) continue;
        const d = defByKey(sk) || { type: "text", label: sk };
        const kd = document.createElement("div"); kd.className = "k"; kd.textContent = d.label || sk;
        const vd = document.createElement("div");
        const oS = document.createElement("span"); oS.className = "diff-old";
        oS.textContent = ov == null ? "(empty)" : CF.displayText(d, ov);
        vd.appendChild(oS); vd.appendChild(document.createTextNode("  →  "));
        const nS = document.createElement("span"); nS.className = "diff-new";
        nS.textContent = nv == null ? "(empty)" : CF.displayText(d, nv);
        vd.appendChild(nS);
        dl.appendChild(kd); dl.appendChild(vd);
      }
    }

    // =========================================================================
    // Phase 5: ADMIN custom-field management (add / deactivate / reactivate).
    // The DATABASE (field_definitions RLS: INSERT/UPDATE = admin) is the real
    // gate; this UI is cosmetic. Adding a definition makes the field appear on
    // EVERY item instantly (custom_fields default '{}'); deactivating sets
    // is_active=false and PRESERVES stored values + change_log history.
    // =========================================================================
    function isAdmin() { return state.role === "admin"; }

    async function loadFieldDefs() {
      const { data, error } = await sb.from("field_definitions")
        .select("key,label,type,options,required,is_active,created_at")
        .order("created_at", { ascending: true });
      state.fieldDefs = !error && Array.isArray(data) ? data : [];
    }

    function openManageFields() {
      if (!isAdmin()) return;
      openModal("Manage custom fields");
      renderManageFields();
    }

    function renderManageFields() {
      const body = $("modal-body"); body.replaceChildren(); body.className = "modal-body";

      const listWrap = document.createElement("div");
      const h = document.createElement("div"); h.className = "muted";
      h.style.cssText = "font-size:.74rem;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;";
      h.textContent = "Existing fields"; listWrap.appendChild(h);
      if (state.fieldDefs.length === 0) {
        const e = document.createElement("div"); e.className = "muted"; e.textContent = "No custom fields yet.";
        listWrap.appendChild(e);
      } else {
        const list = document.createElement("div"); list.className = "hist-list";
        for (const d of state.fieldDefs) {
          const row = document.createElement("div"); row.className = "hist-row row"; row.style.justifyContent = "space-between";
          const meta = document.createElement("div");
          const strong = document.createElement("strong"); strong.textContent = d.label;       // XSS-safe
          const sub = document.createElement("div"); sub.className = "hh";
          sub.textContent = d.key + " · " + d.type + (d.is_active ? "" : " · INACTIVE") +
            (d.options && d.options.length ? " · [" + d.options.join(", ") + "]" : "");  // textContent => safe
          meta.appendChild(strong); meta.appendChild(sub);
          const btn = footBtn(d.is_active ? "Deactivate" : "Reactivate", d.is_active ? "btn-sm danger" : "btn-sm", () => setFieldActive(d, !d.is_active));
          row.appendChild(meta); row.appendChild(btn);
          list.appendChild(row);
        }
        listWrap.appendChild(list);
      }
      body.appendChild(listWrap);
      body.appendChild(document.createElement("hr"));

      const addH = document.createElement("div"); addH.className = "muted";
      addH.style.cssText = "font-size:.74rem;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;";
      addH.textContent = "Add a field"; body.appendChild(addH);

      const grid = document.createElement("div"); grid.className = "modal-body form-grid";
      const mk = (labelText, el, full) => {
        const cell = document.createElement("div"); if (full) cell.className = "full";
        const lab = document.createElement("label"); lab.textContent = labelText; cell.appendChild(lab);
        cell.appendChild(el); grid.appendChild(cell); return el;
      };
      const keyEl = mk("Key (a–z, 0–9, _; starts with a letter)", document.createElement("input"));
      keyEl.placeholder = "warranty_expires";
      const labelEl = mk("Label", document.createElement("input"));
      labelEl.placeholder = "Warranty expires";
      const typeEl = document.createElement("select");
      for (const t of CF.CUSTOM_TYPES) { const o = document.createElement("option"); o.value = t; o.textContent = t; typeEl.appendChild(o); }
      mk("Type", typeEl);
      const reqEl = document.createElement("select");
      for (const rv of [["false", "Optional"], ["true", "Required (UX nudge)"]]) { const o = document.createElement("option"); o.value = rv[0]; o.textContent = rv[1]; reqEl.appendChild(o); }
      mk("Required", reqEl);
      const optsEl = document.createElement("textarea");
      optsEl.placeholder = "one option per line (dropdown only)";
      const optsCell = mk("Options", optsEl, true);
      const syncOpts = () => { optsCell.parentElement.style.display = typeEl.value === "dropdown" ? "" : "none"; };
      typeEl.addEventListener("change", syncOpts); syncOpts();
      body.appendChild(grid);

      const foot = $("modal-foot"); foot.replaceChildren();
      foot.appendChild(footBtn("Close", "secondary", closeModal));
      foot.appendChild(footBtn("Add field", "", () => {
        addFieldDef({ key: keyEl.value.trim(), label: labelEl.value.trim(), type: typeEl.value,
                      required: reqEl.value === "true", optionsText: optsEl.value });
      }));
    }

    async function addFieldDef(input) {
      if (!CF.isValidKey(input.key)) { modalMsg("Key must be a–z / 0–9 / _ and start with a letter.", "bad"); return; }
      if (!input.label) { modalMsg("Label is required.", "bad"); return; }
      let options = null;
      if (input.type === "dropdown") {
        options = CF.parseOptions(input.optionsText);
        if (options.length === 0) { modalMsg("A dropdown needs at least one option.", "bad"); return; }
      }
      setStatus("Adding field…");
      const row = { key: input.key, label: input.label, type: input.type, required: input.required };
      if (options) row.options = options;
      const { data, error } = await sb.from("field_definitions").insert([row]).select("key");
      setStatus("");
      if (error) { modalMsg("Add field failed: " + error.message, "bad"); return; }
      if (!data || data.length === 0) { modalMsg("The database refused this (admin only). RLS is the gate.", "bad"); return; }
      await loadFieldDefs();
      renderHead(); applyView();
      openManageFields();
      setStatus("Added field \"" + input.key + "\".");
    }

    async function setFieldActive(def, active) {
      if (!isAdmin()) return;
      setStatus(active ? "Reactivating…" : "Deactivating…");
      const { data, error } = await sb.from("field_definitions")
        .update({ is_active: active }).eq("key", def.key).select("key,is_active");
      setStatus("");
      if (error) { modalMsg("Update failed: " + error.message, "bad"); return; }
      if (!data || data.length === 0) { modalMsg("The database refused this (admin only). RLS is the gate.", "bad"); return; }
      await loadFieldDefs();
      renderHead(); applyView();
      renderManageFields();
      setStatus((active ? "Reactivated" : "Deactivated") + " \"" + def.key + "\".");
    }

    // ---- shared: replace a row in state.items by id -------------------------
    function mergeRow(row) {
      const i = state.items.findIndex((x) => x.id === row.id);
      if (i >= 0) state.items[i] = row; else state.items.push(row);
    }

    function applyWriteUi() {
      const w = canWrite();
      $("add-btn").classList.toggle("hidden", !w);
      $("manage-fields-btn").classList.toggle("hidden", !isAdmin());
      $("debug-wrap").classList.toggle("hidden", state.role !== "admin");
      if (state.role !== "admin") { state.debug = false; $("debug-toggle").checked = false; $("diag-panel").classList.add("hidden"); }
    }

    async function render() {
      setStatus("Connecting…");
      const user = await verifiedUser();
      if (!user) { showSignIn(); setStatus(""); return; }
      state.user = user;
      state.role = await readRole();
      $("who").textContent = user.email || "(no email)";
      $("role").textContent = "role: " + (state.role || "(none)");
      applyWriteUi();
      hide(signinView); appView.classList.remove("hidden"); hide($("probe-msg"));
      setStatus("");
      await loadFieldDefs();   // load custom-field definitions before rendering columns
      await loadInventory();
      resolvePendingDeepLink();   // Phase 6: open the QR-linked item AFTER auth + load
    }

    function showSignIn() { appView.classList.add("hidden"); signinView.classList.remove("hidden"); }

    async function onSignIn(e) {
      e.preventDefault(); hide($("signin-msg"));
      const email = $("email").value.trim(); const password = $("password").value;
      $("signin-btn").disabled = true; setStatus("Signing in…");
      const { error } = await sb.auth.signInWithPassword({ email, password });
      $("signin-btn").disabled = false; setStatus("");
      if (error) { showMsg($("signin-msg"), "Sign-in failed: " + error.message, "bad"); return; }
      $("password").value = "";
      await render();
    }

    // (Phase-2 diagnostics) attempt an UPDATE; the DB (RLS) is the gate.
    async function onProbe() {
      hide($("probe-msg"));
      if (!state.sampleItem) { showMsg($("probe-msg"), "No sample item to probe.", "info"); return; }
      setStatus("Attempting UPDATE…");
      const { data, error } = await sb.from("items")
        .update({ notes: state.sampleItem.notes }).eq("id", state.sampleItem.id).select("id");
      setStatus("");
      if (error) { showMsg($("probe-msg"), "DB REFUSED the edit (role=" + state.role + "): " + error.message, "bad"); return; }
      if (!data || data.length === 0) { showMsg($("probe-msg"), "DB REFUSED the edit (role=" + state.role + "): 0 rows — RLS filtered it.", "bad"); return; }
      showMsg($("probe-msg"), "DB ALLOWED the edit (role=" + state.role + "): row #" + data[0].id + ".", "ok");
    }

    // Sign out: end the session AND clear ALL in-memory + rendered data (shared-device).
    async function onSignOut() {
      setStatus("Signing out…");
      await sb.auth.signOut();
      state = { user:null, role:null, sampleItem:null, items:[], view:[], sortKeys:[],
                showArchived:false, debug:false, fieldDefs:[] };
      closeModal();
      $("add-btn").classList.add("hidden"); $("manage-fields-btn").classList.add("hidden"); $("debug-wrap").classList.add("hidden");
      $("diag-panel").classList.add("hidden"); $("f-archived").checked = false;
      $("who").textContent = ""; $("role").textContent = "";
      $("sample-item").textContent = "—";
      $("inv-tbody").replaceChildren(); $("inv-cards").replaceChildren();
      $("inv-thead").replaceChildren();
      $("count-pill").textContent = "—";
      hide($("probe-msg")); $("probe-msg").textContent = "";
      $("search").value = ""; $("f-attn").checked = false;
      for (const id of ["f-category","f-brand","f-status","f-location"]) {
        const sel = $(id); while (sel.children.length > 1) sel.removeChild(sel.lastChild); sel.value = "";
      }
      const stillUser = await verifiedUser();
      showSignIn();
      setStatus(stillUser ? "WARNING: session still active!" : "Signed out.");
    }

    // =========================================================================
    // Phase 6: EXPORT (CSV/JSON — ALL signed-in roles per the permission matrix)
    // + QR labels + QR deep-link resolution. Serialize/parse + URL logic lives in
    // lib/inventory-export.js (ONE SOURCE OF TRUTH with the round-trip proof).
    // QR encodes THIS page's ?item=<id>; scanning opens the record AFTER sign-in.
    // =========================================================================

    // Full export columns: core item fields + active custom fields as cf:<key>.
    // JSON export is the lossless full-fidelity backup (carries custom_fields raw);
    // CSV flattens custom fields to display strings (core string fields round-trip
    // value-exact — the unicode/comma/quote case the gate cares about).
    const EXPORT_CORE = [
      { key:"id", header:"id", kind:"int" },
      { key:"name", header:"name", kind:"string" },
      { key:"brand", header:"brand", kind:"string" },
      { key:"model_pn", header:"model_pn", kind:"string" },
      { key:"qty", header:"qty", kind:"int" },
      { key:"device_type", header:"device_type", kind:"string" },
      { key:"category", header:"category", kind:"string" },
      { key:"status", header:"status", kind:"string" },
      { key:"location", header:"location", kind:"string" },
      { key:"assignment_purpose", header:"assignment_purpose", kind:"string" },
      { key:"value", header:"value", kind:"num" },
      { key:"serial", header:"serial", kind:"string" },
      { key:"notes", header:"notes", kind:"string" },
      { key:"is_archived", header:"is_archived", kind:"bool" },
    ];
    function exportColumns() {
      const cols = EXPORT_CORE.slice();
      for (const d of activeDefs()) cols.push({ key:"cf:" + d.key, header:"cf:" + d.key, kind:"string" });
      return cols;
    }
    function exportGet(it, key) {
      if (key.indexOf("cf:") === 0) {
        const v = it.custom_fields ? it.custom_fields[key.slice(3)] : null;
        return v === undefined ? null : v;
      }
      return it[key];
    }
    function downloadFile(filename, text, mime) {
      const blob = new Blob([text], { type: mime + ";charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }
    function exportStamp() { return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19); }
    function onExportCsv() {
      if (!state.items.length) { setStatus("Nothing to export."); return; }
      const csv = IE.toCSV(state.items, exportColumns(), exportGet);
      downloadFile("zeta-inventory-" + exportStamp() + ".csv", csv, "text/csv");
      setStatus("Exported " + state.items.length + " items to CSV.");
    }
    function onExportJson() {
      if (!state.items.length) { setStatus("Nothing to export."); return; }
      const json = IE.toJSON(state.items);
      downloadFile("zeta-inventory-" + exportStamp() + ".json", json, "application/json");
      setStatus("Exported " + state.items.length + " items to JSON (full-fidelity backup).");
    }

    // ---- QR / labels ----
    function qrDataUrl(id, cell, margin) {
      const model = QR(0, "M");                 // typeNumber 0 = auto-fit; ECC level M
      model.addData(IE.itemUrl(pageBaseUrl(), id));
      model.make();
      return model.createDataURL(cell, margin); // data:image/gif (CSP img-src 'self' data:)
    }
    // Read-only item record (the QR deep-link target) — all roles. textContent ONLY.
    function openItemRecord(it) {
      openModal("Item #" + it.id + (it.name ? " — " + it.name : ""));  // title via textContent (XSS-safe)
      const body = $("modal-body"); body.replaceChildren(); body.className = "modal-body";

      const grid = document.createElement("div"); grid.className = "record-grid";
      const addRow = (k, v) => {
        const kd = document.createElement("div"); kd.className = "k"; kd.textContent = k;
        const vd = document.createElement("div"); vd.className = "v";
        vd.textContent = (v == null || v === "") ? "\u2014" : String(v);
        grid.appendChild(kd); grid.appendChild(vd);
      };
      addRow("Name", it.name); addRow("Brand", it.brand); addRow("Model/PN", it.model_pn);
      addRow("Qty", it.qty); addRow("Type", it.device_type); addRow("Category", it.category);
      addRow("Status", it.status); addRow("Location", it.location);
      addRow("Assignment", it.assignment_purpose); addRow("Value", it.value);
      addRow("Serial", it.serial); addRow("Notes", it.notes);
      addRow("Archived", it.is_archived ? "yes" : "no");
      for (const d of activeDefs()) {
        const cv = it.custom_fields ? it.custom_fields[d.key] : null;
        addRow(d.label, CF.displayText(d, cv));
      }
      body.appendChild(grid);

      const qb = document.createElement("div"); qb.className = "qr-block";
      const img = document.createElement("img");
      img.src = qrDataUrl(it.id, 5, 4); img.alt = "QR code linking to item #" + it.id;
      const qm = document.createElement("div"); qm.className = "qr-meta";
      const ql = document.createElement("div"); ql.textContent = "Scan to open this record (after sign-in):";
      const qu = document.createElement("div"); qu.className = "qr-url";
      qu.textContent = IE.itemUrl(pageBaseUrl(), it.id);
      qm.appendChild(ql); qm.appendChild(qu);
      qb.appendChild(img); qb.appendChild(qm);
      body.appendChild(qb);

      const foot = $("modal-foot"); foot.replaceChildren();
      foot.appendChild(footBtn("Close", "secondary", closeModal));
      foot.appendChild(footBtn("Print label", "", () => printLabels([it])));
      if (canWrite()) {
        foot.appendChild(footBtn("History", "ghost", () => openHistory(it)));
        foot.appendChild(footBtn("Edit", "", () => openEdit(it)));
      }
    }
    // Build a printable sheet of QR labels (multi-item per page) and open the
    // print dialog. Each label: QR (item URL) + #id + name. textContent ONLY.
    function printLabels(items) {
      if (!items || !items.length) { setStatus("No items to label."); return; }
      const sheet = $("label-sheet"); sheet.replaceChildren();
      for (const it of items) {
        const cell = document.createElement("div"); cell.className = "label";
        const img = document.createElement("img"); img.className = "label-qr";
        img.src = qrDataUrl(it.id, 4, 2); img.alt = "QR item #" + it.id;
        const meta = document.createElement("div"); meta.className = "label-meta";
        const idEl = document.createElement("div"); idEl.className = "label-id"; idEl.textContent = "#" + it.id;
        const nameEl = document.createElement("div"); nameEl.className = "label-name";
        nameEl.textContent = (it.name == null || it.name === "") ? "(unnamed)" : String(it.name);
        meta.appendChild(idEl); meta.appendChild(nameEl);
        cell.appendChild(img); cell.appendChild(meta); sheet.appendChild(cell);
      }
      const cleanup = () => {
        document.body.classList.remove("printing-labels");
        sheet.replaceChildren();
        window.removeEventListener("afterprint", cleanup);
      };
      window.addEventListener("afterprint", cleanup);
      document.body.classList.add("printing-labels");
      // double rAF so the data: QR images are laid out before the print dialog opens
      requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
      setStatus("Prepared " + items.length + " label(s) for printing.");
    }
    // One-shot: open the QR-linked item AFTER a verified session has loaded it.
    function resolvePendingDeepLink() {
      if (pendingItemId == null) return;
      const want = pendingItemId; pendingItemId = null;
      const target = state.items.find((x) => x.id === want);
      if (target) { openItemRecord(target); setStatus("Opened item #" + want + " from QR link."); }
      else { setStatus("QR-linked item #" + want + " is not in your visible inventory."); }
    }

    document.addEventListener("DOMContentLoaded", () => {
      // Phase 6: capture the QR deep-link (?item=<id>) ONCE, before sign-in. It
      // survives the in-page sign-in (no navigation) and is resolved only after a
      // verified session loads the inventory (resolvePendingDeepLink).
      pendingItemId = IE.parseItemId(location.search);
      $("signin-form").addEventListener("submit", onSignIn);
      $("probe-btn").addEventListener("click", onProbe);
      $("signout-btn").addEventListener("click", onSignOut);
      $("add-btn").addEventListener("click", openAdd);
      $("manage-fields-btn").addEventListener("click", openManageFields);
      $("export-csv-btn").addEventListener("click", onExportCsv);
      $("export-json-btn").addEventListener("click", onExportJson);
      $("print-labels-btn").addEventListener("click", () => printLabels(state.view));
      $("modal-x").addEventListener("click", closeModal);
      $("modal-overlay").addEventListener("click", (e) => { if (e.target === $("modal-overlay")) closeModal(); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("modal-overlay").classList.contains("hidden")) closeModal(); });
      $("f-archived").addEventListener("change", () => { state.showArchived = $("f-archived").checked; applyView(); });
      $("debug-toggle").addEventListener("change", () => {
        state.debug = $("debug-toggle").checked && state.role === "admin";
        $("diag-panel").classList.toggle("hidden", !state.debug);
      });
      wireControls();
      render();
    });
