// Zeta Portal SPA — vanilla, dependency-free. Fetches the BFF view models and
// renders the three views: Resources (top-down), Create (catalog), Needs me.
"use strict";

const main = document.getElementById("main");
const navButtons = [...document.querySelectorAll(".nav")];
const badge = document.getElementById("needsme-badge");

const api = (p, opts) => fetch(p, opts).then((r) => r.json());
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const avatar = (id) => `<span class="persona"><span class="av">${esc(id[0] || "?").toUpperCase()}</span>${esc(id)}</span>`;
const healthBadge = (h, phase) => `<span class="health h-${h}"><span class="dot"></span>${esc(phase)}</span>`;

const views = { resources: renderResources, catalog: renderCatalog, needsme: renderNeedsMe };
let current = "resources";

navButtons.forEach((b) =>
  b.addEventListener("click", () => {
    current = b.dataset.view;
    navButtons.forEach((n) => n.classList.toggle("active", n === b));
    render();
  }),
);

async function render() {
  main.innerHTML = '<div class="loading">Loading…</div>';
  try {
    await views[current]();
  } catch (e) {
    main.innerHTML = `<div class="empty">Failed to load: ${esc(e.message)}</div>`;
  }
  refreshBadge();
}

async function refreshBadge() {
  try {
    const { items } = await api("/api/needs-me");
    if (items.length) {
      badge.textContent = items.length;
      badge.classList.remove("hidden");
    } else badge.classList.add("hidden");
  } catch {}
}

// ── Resources (top-down, grouped by category) ──────────────────────────
async function renderResources() {
  const { groups } = await api("/api/resources");
  let html = `<h1>Resources</h1><p class="sub">Everything you and your agents have deployed, top-down.</p>`;
  if (!groups.length) html += `<div class="empty">No resources yet. Use <b>Create</b> to deploy from a blueprint.</div>`;
  for (const g of groups) {
    html += `<div class="cat-head">${esc(g.category)} <span class="cat-count">${g.count}</span></div><div class="grid">`;
    for (const r of g.resources) {
      html += `<div class="card">
        <div class="card-top"><span class="card-title">${esc(r.name)}</span>${healthBadge(r.health, r.phase)}</div>
        <div class="card-rows">
          <div class="row"><span class="k">blueprint</span><span>${esc(r.blueprint)}</span></div>
          <div class="row"><span class="k">namespace</span><span>${esc(r.namespace)}</span></div>
          <div class="row"><span class="k">expose</span><span>${esc(r.expose)}${r.host ? " · " + esc(r.host) : ""}</span></div>
          <div class="row"><span class="k">operated by</span><span>${avatar(r.admin)}</span></div>
          ${r.message ? `<div class="row"><span class="k">note</span><span class="h-error">${esc(r.message)}</span></div>` : ""}
        </div>
        ${r.children.length ? `<div class="chips">${r.children.map((c) => `<span class="chip">${esc(c)}</span>`).join("")}</div>` : ""}
      </div>`;
    }
    html += `</div>`;
  }
  main.innerHTML = html;
}

// ── Create (the blueprint catalog) ─────────────────────────────────────
async function renderCatalog() {
  const { catalog } = await api("/api/catalog");
  let html = `<h1>Create</h1><p class="sub">Deploy from a blueprint. New types are data — the same engine renders them all.</p><div class="grid">`;
  for (const e of catalog) {
    html += `<div class="card">
      <div class="card-top"><span class="card-title">${esc(e.blueprint)}</span><span class="chip">${esc(e.category)}</span></div>
      <div class="card-rows">
        <div class="row"><span class="k">image</span><span>${esc(e.image)}</span></div>
        <div class="row"><span class="k">kind</span><span>${e.stateful ? "stateful" : "stateless"}</span></div>
        <div class="row"><span class="k">expose</span><span>${esc(e.defaultExpose)}</span></div>
      </div>
      ${e.variables.length ? `<div class="chips" style="flex-direction:column;align-items:stretch">${e.variables.map((v) => `<div class="var"><span>${esc(v.name)}</span><span class="muted">${esc(v.default ?? "—")}</span></div>`).join("")}</div>` : ""}
      <div class="actions"><button class="btn" disabled title="provisioning flow lands with the persona runtime">Deploy</button></div>
    </div>`;
  }
  html += `</div>`;
  main.innerHTML = html;
}

// ── Needs me (pending human authorizations across all rooms) ────────────
async function renderNeedsMe() {
  const { items } = await api("/api/needs-me");
  let html = `<h1>Needs me</h1><p class="sub">Agents proposed these; only a human authorizes a gated action (source ≠ authorization).</p>`;
  if (!items.length) { main.innerHTML = html + `<div class="empty">Nothing waiting on you. Agents are operating within standing authority.</div>`; return; }
  html += `<div class="grid">`;
  for (const it of items) {
    html += `<div class="card needsme-card">
      <div class="card-top"><span class="card-title">${esc(it.resource)}</span>${it.gated ? `<span class="gated">gated: ${esc(it.gated)}</span>` : ""}</div>
      <div class="card-rows">
        <div class="row"><span class="k">proposed by</span><span>${avatar(it.proposedBy)}</span></div>
        <div class="row"><span class="k">action</span><span>${esc(it.summary)}</span></div>
      </div>
      <div class="actions">
        <button class="btn" data-grant="1" data-res="${esc(it.resource)}" data-req="${esc(it.requestId)}">Approve</button>
        <button class="btn danger" data-grant="0" data-res="${esc(it.resource)}" data-req="${esc(it.requestId)}">Deny</button>
      </div>
    </div>`;
  }
  html += `</div>`;
  main.innerHTML = html;
  main.querySelectorAll("[data-grant]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const res = btn.dataset.res, req = btn.dataset.req, granted = btn.dataset.grant === "1";
      btn.disabled = true;
      await fetch(`/api/rooms/${res.replace("/", "~")}/grant`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: req, by: "you", granted }),
      });
      render();
    }),
  );
}

render();
