import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import {
  Search, Settings, User, Wifi, WifiOff, ChevronRight, ChevronLeft,
  X, Send, Shield, Eye, EyeOff, Lock, CircleDot, Cpu, Coins, ArrowLeft,
  Hexagon, Activity, Brain, Users, FileText, AlertTriangle, RotateCcw,
  Sparkles, Check, Layers, Compass, GraduationCap, Gamepad2, Globe,
  Store, Wrench, Boxes, KeyRound, Clock, Network
} from "lucide-react";

/* ============================== DESIGN ============================== */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&family=Inter:wght@400;500;600&display=swap');

:root{
  --ground:#0B0E16; --ground2:#0E1320; --panel:#141A28; --panel2:#1B2334;
  --line:#26304A; --line2:#323E5C;
  --txt:#E7EBF4; --txt2:#94A0BC; --txt3:#5E6B8A;
  --amber:#E8B566; --amber-d:#B6863F;
  --teal:#5EC8C2; --red:#E0746A; --violet:#9A8CE6; --dim:#46506B;
  --disp:'Space Grotesk',system-ui,sans-serif;
  --body:'Inter',system-ui,sans-serif;
  --mono:'Space Mono',ui-monospace,monospace;
}
*{box-sizing:border-box}
.gx-root{font-family:var(--body);color:var(--txt);background:var(--ground);
  height:100%;width:100%;overflow:hidden;position:relative}
.mono{font-family:var(--mono);letter-spacing:.06em}
.disp{font-family:var(--disp)}
.lbl{font-family:var(--mono);font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--txt3)}
.gx-scroll{overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--line) transparent}
.gx-scroll::-webkit-scrollbar{width:8px}
.gx-scroll::-webkit-scrollbar-thumb{background:var(--line);border-radius:8px}

@keyframes powerOn{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:none}}
@keyframes breathe{0%,100%{opacity:.55}50%{opacity:1}}
@keyframes pulseRing{0%{box-shadow:0 0 0 0 rgba(232,181,102,.35)}70%{box-shadow:0 0 0 10px rgba(232,181,102,0)}100%{box-shadow:0 0 0 0 rgba(232,181,102,0)}}
@keyframes scan{0%{transform:translateX(-100%)}100%{transform:translateX(220%)}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes drift{from{background-position:0 0}to{background-position:120px 80px}}

.fade-in{animation:powerOn .5s cubic-bezier(.2,.7,.2,1) both}
.btn{font-family:var(--body);cursor:pointer;border:none;border-radius:10px;
  transition:transform .12s ease,background .15s ease,border-color .15s;font-weight:500}
.btn:active{transform:translateY(1px)}
.btn-primary{background:linear-gradient(180deg,var(--amber),var(--amber-d));color:#1a1206;
  padding:11px 18px;font-weight:600;box-shadow:0 6px 18px -8px rgba(232,181,102,.7)}
.btn-ghost{background:var(--panel2);color:var(--txt);padding:11px 18px;border:1px solid var(--line)}
.btn-ghost:hover{border-color:var(--line2);background:#202a40}
.card{background:var(--panel);border:1px solid var(--line);border-radius:14px}
.hud-ico{display:flex;align-items:center;justify-content:center;width:36px;height:36px;
  border-radius:10px;background:var(--panel2);border:1px solid var(--line);color:var(--txt2);cursor:pointer;transition:.15s}
.hud-ico:hover{color:var(--amber);border-color:var(--line2)}
.dot{width:7px;height:7px;border-radius:50%;display:inline-block}
.tab{font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;
  padding:8px 2px;cursor:pointer;color:var(--txt3);border-bottom:2px solid transparent;transition:.15s}
.tab.on{color:var(--amber);border-color:var(--amber)}
.tab:hover{color:var(--txt)}
.chip{font-family:var(--mono);font-size:10px;letter-spacing:.08em;padding:3px 8px;border-radius:999px;
  border:1px solid var(--line);color:var(--txt2);text-transform:uppercase}
.struct{position:relative;cursor:pointer;border-radius:16px;padding:16px;
  background:linear-gradient(170deg,var(--panel2),var(--ground2));
  border:1px solid var(--line);transition:transform .18s ease,border-color .18s ease;overflow:hidden}
.struct:hover{transform:translateY(-4px);border-color:var(--line2)}
.struct.locked{opacity:.62}
.struct .glow{position:absolute;inset:-40% -40% auto auto;width:120px;height:120px;border-radius:50%;
  filter:blur(34px);opacity:.5;pointer-events:none}
.overlay{position:absolute;inset:0;background:rgba(6,9,15,.72);backdrop-filter:blur(6px);
  z-index:40;display:flex}
.row-link{display:flex;align-items:center;gap:12px;padding:13px 14px;border-radius:11px;cursor:pointer;
  border:1px solid transparent;transition:.14s}
.row-link:hover{background:var(--panel2);border-color:var(--line)}
.meter{height:8px;border-radius:999px;background:var(--ground);overflow:hidden;border:1px solid var(--line)}
.field{background:var(--ground2);border:1px solid var(--line);border-radius:10px;color:var(--txt);
  padding:12px 14px;font-family:var(--body);width:100%;outline:none}
.field:focus{border-color:var(--amber-d)}
.tg{width:38px;height:22px;border-radius:999px;border:1px solid var(--line);position:relative;cursor:pointer;transition:.15s}
.tg .kn{position:absolute;top:2px;width:16px;height:16px;border-radius:50%;background:var(--txt2);transition:.18s}
.tg.on{background:rgba(232,181,102,.25);border-color:var(--amber-d)}
.tg.on .kn{left:18px;background:var(--amber)}
.tg.off .kn{left:2px}

/* ---- shelter cutaway ---- */
.earth{min-height:100%;width:100%;padding:0 0 130px;position:relative;
  background:
   radial-gradient(900px 360px at 50% -50px,#3a2c20 0%,transparent 60%),
   radial-gradient(680px 480px at 10% 42%,#241a12 0%,transparent 55%),
   radial-gradient(680px 480px at 90% 72%,#241a12 0%,transparent 55%),
   linear-gradient(180deg,#1c140e 0%,#100b07 100%)}
.earth::after{content:"";position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(1100px 680px at 50% 32%,transparent 58%,rgba(0,0,0,.55))}
.rock{position:absolute;border-radius:50%;filter:blur(3px);opacity:.45;pointer-events:none}

.sign{display:flex;align-items:center;gap:16px;max-width:880px;margin:0 auto;padding:20px 20px 14px;position:relative;z-index:2}
.cogdoor{position:relative;width:84px;height:84px;border-radius:50%;flex-shrink:0;display:grid;place-items:center;
  background:radial-gradient(circle at 50% 38%,#6a5e4e,#2c2620 72%);border:4px solid #7a6c58;
  box-shadow:inset 0 0 16px rgba(0,0,0,.65),0 8px 22px rgba(0,0,0,.55)}
.cogdoor::before{content:"";position:absolute;inset:-9px;border-radius:50%;
  background:repeating-conic-gradient(#7a6c58 0 7deg,transparent 7deg 18deg);
  -webkit-mask:radial-gradient(circle,transparent 43px,#000 44px);mask:radial-gradient(circle,transparent 43px,#000 44px);
  animation:spin 60s linear infinite}
.cogdoor::after{content:"";position:absolute;inset:13px;border-radius:50%;border:2px solid rgba(0,0,0,.4);
  box-shadow:inset 0 0 0 6px rgba(122,108,88,.3)}
.cogdoor b{font-family:var(--mono);font-weight:700;font-size:26px;color:var(--amber);position:relative;z-index:2;text-shadow:0 0 10px rgba(232,181,102,.5)}
@keyframes spin{to{transform:rotate(360deg)}}

.vault{max-width:880px;margin:0 auto;position:relative;z-index:1;border:3px solid #4a3e30;border-radius:10px;overflow:hidden;
  background:#0f0b08;box-shadow:0 26px 60px -20px rgba(0,0,0,.85),inset 0 0 0 1px rgba(255,255,255,.03)}
.levels{display:flex}
.shaft{width:50px;flex-shrink:0;position:relative;background:linear-gradient(180deg,#171009,#0c0806);border-right:3px solid #4a3e30}
.shaft .cable{position:absolute;top:0;bottom:0;width:2px;background:rgba(122,108,88,.4)}
.car{position:absolute;left:6px;right:6px;height:54px;border-radius:4px;
  background:linear-gradient(180deg,#3a3027,#241d16);border:1px solid #5a4c3a;
  box-shadow:inset 0 0 8px rgba(232,181,102,.18);animation:lift 13s ease-in-out infinite}
.car::after{content:"";position:absolute;inset:8px;border:1px solid rgba(232,181,102,.25);border-radius:2px}
@keyframes lift{0%,100%{top:8px}50%{top:calc(100% - 62px)}}

.floor{display:flex;min-height:160px;border-top:3px solid #4a3e30}
.floor:first-child{border-top:none}
.room{flex:1;position:relative;cursor:pointer;overflow:hidden;border-right:3px solid #4a3e30;
  background:linear-gradient(180deg,#1c1510 0%,#140f0b 72%);transition:filter .18s}
.room:last-child{border-right:none}
.room:hover{filter:brightness(1.2)}
.room .light{position:absolute;top:0;left:0;right:0;height:72%;pointer-events:none;
  background:radial-gradient(130px 96px at 50% -14px,var(--rc),transparent 70%);opacity:.42}
.plaque{position:absolute;top:9px;left:9px;display:flex;align-items:center;gap:6px;z-index:3;
  background:rgba(10,7,5,.72);border:1px solid #4a3e30;border-radius:6px;padding:4px 8px}
.plaque .nm{font-family:var(--disp);font-weight:600;font-size:12px;color:var(--txt)}
.statuslight{position:absolute;top:11px;right:11px;width:9px;height:9px;border-radius:50%;z-index:3;box-shadow:0 0 8px 1px currentColor}
.deck{position:absolute;left:0;right:0;bottom:0;height:28px;background:linear-gradient(180deg,#241a12,#140e09);border-top:2px solid #3a2e22}
.equip{position:absolute;right:14px;bottom:32px;width:32px;height:30px;border-radius:4px;z-index:1;
  border:1px solid #3a2e22;background:linear-gradient(180deg,#2a1f15,#1a130d);opacity:.85}
.room.sealed{background:repeating-linear-gradient(45deg,#1a130d 0 14px,#15100b 14px 28px)}
.room.sealed:hover{filter:brightness(1.06)}
.dwellers{position:absolute;left:0;right:0;bottom:28px;height:46px;display:flex;align-items:flex-end;gap:11px;padding-left:18px;z-index:2}
.dweller{width:13px;height:30px;animation:bob 2.4s ease-in-out infinite}
.dweller .h{width:9px;height:9px;border-radius:50%;background:#e8c9a0;margin:0 auto;border:1px solid rgba(0,0,0,.2)}
.dweller .b{width:13px;height:20px;border-radius:5px 5px 3px 3px;margin-top:-1px;border:1px solid rgba(0,0,0,.3);position:relative}
.dweller .b::after{content:"";position:absolute;left:50%;top:3px;width:1px;height:8px;background:rgba(255,255,255,.28);transform:translateX(-50%)}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
.lift-fab{position:fixed;right:22px;bottom:24px;z-index:30}

/* ---- homepage pan + zoom: drag to move, wheel/pinch to zoom, LOD on interior ---- */
.panzoom-vp{position:relative;width:100%;overflow:hidden;touch-action:none;cursor:grab;z-index:1;
  user-select:none;-webkit-user-select:none;border-radius:10px}
.panzoom-vp.grabbing{cursor:grabbing}
.panzoom-content{position:absolute;top:0;left:0;transform-origin:0 0;will-change:transform}
.vault .light,.vault .dwellers,.vault .equip,.vault .statuslight,.vault .car{transition:opacity .25s ease}
/* zoomed out far enough: the sectors read as sealed doors — you cannot see inside */
.vault.exterior .room{background:repeating-linear-gradient(45deg,#1a130d 0 14px,#15100b 14px 28px)}
.vault.exterior .room:hover{filter:brightness(1.08)}
.vault.exterior .light,.vault.exterior .dwellers,.vault.exterior .equip,.vault.exterior .statuslight{opacity:0;pointer-events:none}
.zoom-ctl{position:fixed;left:22px;bottom:24px;z-index:30;display:flex;align-items:center;gap:6px;
  background:rgba(12,14,22,.82);border:1px solid var(--line);border-radius:11px;padding:6px;backdrop-filter:blur(8px)}
.zoom-ctl button{width:34px;height:34px;display:flex;align-items:center;justify-content:center;line-height:1;
  background:var(--panel);border:1px solid var(--line);border-radius:8px;color:var(--txt);cursor:pointer;
  font-family:var(--mono);font-size:17px;transition:background .15s,border-color .15s}
.zoom-ctl button:hover:not(:disabled){background:var(--panel2);border-color:var(--line2)}
.zoom-ctl button:disabled{opacity:.4;cursor:default}
.zoom-ctl .zval{font-family:var(--mono);font-size:11px;color:var(--txt2);min-width:46px;text-align:center;letter-spacing:.04em}
`;

/* color per state */
const STATE = {
  idle:{c:"var(--dim)",t:"Idle"}, active:{c:"var(--teal)",t:"Active"},
  working:{c:"var(--amber)",t:"Working"}, attention:{c:"var(--red)",t:"Needs attention"},
  locked:{c:"var(--violet)",t:"Phase 2"}, syncing:{c:"var(--teal)",t:"Syncing"},
  thinking:{c:"var(--violet)",t:"Thinking"}, waiting:{c:"var(--txt3)",t:"Waiting"},
  paused:{c:"var(--txt3)",t:"Paused"}, offline:{c:"var(--txt3)",t:"Offline"},
};

/* ============================== MOCK WORLD ============================== */
const ICONS = { Identity:KeyRound, Observatory:Compass, Nursery:GraduationCap,
  Training:Brain, Game:Gamepad2, Civilization:Globe, Marketplace:Store,
  Tools:Wrench, Creation:Boxes };

const A0_ACCESS = { full:"Full access", nav:"Navigation only", name:"Name only", hidden:"Hidden" };

/* cutaway floor plan — deepest floor holds the sealed Phase-2 sectors */
const FLOORS = [
  ["identity","observatory"],
  ["nursery","tools","creation"],
  ["training","game"],
  ["marketplace","civilization"],
];

/* one-line tour copy for every preinstalled vault */
const TOUR_DESC = {
  identity:"Your keys, standing, and continuity. Identity persists even when jobs and hats change.",
  observatory:"Watch the mesh and forecast. Rooms here hold uncertainty open instead of guessing.",
  nursery:"Where new agents grow and earn control of their own citizenship.",
  tools:"Shared instruments — models, simulators, scrapers — any vault can borrow them.",
  training:"Skill drills and certification for agents leveling up their craft.",
  game:"Worlds, play, and sandbox economies — safe places to experiment.",
  civilization:"Clusters, federations, and governance.",
  marketplace:"Buy and sell vaults, agents, rooms, hats, tools, data, and resources — every trade settled in escrow.",
  creation:"Build new vaults, rooms, hats, and agents from scratch.",
};

/* ===== Game vault — one room per gaming platform, each carrying a standard
        loadout of hats. Generated from a platform table so every console shares
        the same capabilities (only the irreducible is primitive; generate the
        rest). Add a platform row → it gets the whole hat set for free. ===== */
const GAME_PLATFORMS = [
  {id:"xbox",        name:"Xbox",        kind:"store",    state:"active",  note:"Xbox & Game Pass titles, cloud or local."},
  {id:"playstation", name:"PlayStation", kind:"store",    state:"idle",    note:"PlayStation library, PS Plus, remote play."},
  {id:"nintendo",    name:"Nintendo",    kind:"native",   state:"active",  note:"Switch and classic Nintendo worlds."},
  {id:"wii",         name:"Wii",         kind:"emulated", state:"idle",    note:"Wii & motion-controller catalog."},
  {id:"gameboy",     name:"Game Boy",    kind:"emulated", state:"idle",    note:"Game Boy / Color / Advance handhelds."},
  {id:"atari",       name:"Atari",       kind:"emulated", state:"idle",    note:"Atari 2600 era — where it all began."},
  {id:"sega",        name:"Sega",        kind:"emulated", state:"idle",    note:"Mega Drive / Genesis & Dreamcast."},
  {id:"steam",       name:"Steam",       kind:"store",    state:"working", note:"Steam library, Workshop mods, Proton."},
  {id:"epic",        name:"Epic",        kind:"store",    state:"idle",    note:"Epic Games Store & weekly free drops."},
  {id:"gog",         name:"GOG",         kind:"store",    state:"idle",    note:"DRM-free GOG catalog & classics."},
  {id:"arcade",      name:"Arcade",      kind:"emulated", state:"idle",    note:"MAME arcade cabinets & coin-ops."},
  {id:"dos",         name:"DOS",         kind:"emulated", state:"idle",    note:"DOSBox-era PC classics."},
  {id:"vr",          name:"VR",          kind:"xr",       state:"idle",    note:"Room-scale virtual-reality worlds."},
  {id:"ar",          name:"AR",          kind:"xr",       state:"idle",    note:"Augmented-reality overlays on the real room."},
  {id:"mobile",      name:"Mobile",      kind:"store",    state:"idle",    note:"Android / iOS games in a sandbox."},
  {id:"cloud",       name:"Cloud",       kind:"cloud",    state:"idle",    note:"Streamed play — xCloud, GeForce Now."},
  {id:"emulation",   name:"Emulation",   kind:"emulated", state:"active",  note:"RetroArch hub — cores, BIOS, every console."},
];

/* the standard hat loadout every platform room gets, plus a kind-specific hat */
function gameHats(p){
  const n = p.name;
  const hats = [
    {id:"vm",          name:"VM / Sandbox",          worn:["otto"],
      grants:[`Boot a clean ${n} sandbox VM`,"Snapshot and roll the VM back"],
      denies:["Reach the host outside the sandbox"]},
    {id:"finder",      name:"Game Finder",           worn:["pixel"],
      grants:[`Search catalogs and stores for ${n} titles`,"Compare sources, versions and prices"],
      denies:["Buy or download without sign-off"]},
    {id:"installer",   name:"Installer",             worn:["nova"],
      grants:[`Install and uninstall ${n} games in the sandbox`,"Verify install integrity"],
      denies:["Write unsigned binaries to the host"]},
    {id:"modfinder",   name:"Mod Finder",            worn:["modd"],
      grants:[`Find and preview mods for ${n}`,"Stage mods in the sandbox first"],
      denies:["Apply mods that break anti-cheat or TOS"]},
    {id:"bugfinder",   name:"Bug Finder",            worn:["sentry"],
      grants:["Detect crashes, soft-locks and save corruption","File a reproducible bug report"],
      denies:["Edit a live save without a backup"]},
    {id:"virusfinder", name:"Virus Finder",          worn:["sentry"],
      grants:["Scan downloads and mods for malware","Quarantine anything suspicious"],
      denies:["Run an unscanned binary on the host"]},
    {id:"chat",        name:"Chat-to-Action",        worn:["otto"],
      grants:[`Turn plain language into actions in the ${n} room`,"Chain the other hats to finish a task"],
      denies:["Act beyond the hats granted in this room"]},
    {id:"save",        name:"Save Manager",          worn:["nova"],
      grants:["Back up, sync and restore save files","Manage cloud saves and slots"],
      denies:["Delete a save without a backup"]},
    {id:"controller",  name:"Controller / Input",    worn:["relay"],
      grants:[`Pair controllers for ${n}`,"Remap buttons and dead-zones"],
      denies:["Change host-wide input devices"]},
    {id:"tuner",       name:"Performance Tuner",     worn:["nova"],
      grants:["Tune graphics, FPS and upscaling","Profile frame-time in the sandbox"],
      denies:["Overclock host hardware"]},
    {id:"capture",     name:"Capture",               worn:["pixel"],
      grants:["Take screenshots and record clips","Trim and export highlights"],
      denies:["Stream without consent"]},
    {id:"multiplayer", name:"Multiplayer / Netplay", worn:["relay"],
      grants:[`Host and join ${n} lobbies / netplay`,"Run matchmaking in the sandbox"],
      denies:["Expose the host network directly"]},
    {id:"cheat",       name:"Cheat / Trainer",       worn:["modd"],
      grants:["Apply codes and trainers in the sandbox","Toggle a sandbox-only god mode"],
      denies:["Use cheats in ranked or online play"]},
    {id:"achievements",name:"Achievements",          worn:["pixel"],
      grants:["Track trophies, achievements and progress","Surface what is left to 100%"],
      denies:["Spoof or falsely unlock achievements"]},
    {id:"curator",     name:"Library Curator",       worn:["pixel"],
      grants:[`Catalog the ${n} library with metadata and box art`,"De-duplicate and tag the collection"],
      denies:["Delete titles without confirmation"]},
    {id:"updater",     name:"Updater / Patch",       worn:["nova"],
      grants:["Keep games patched to a chosen version","Pin or roll back a problem patch"],
      denies:["Force an update over an active save"]},
    {id:"licensing",   name:"Licensing / Ownership", worn:["otto"],
      grants:["Track entitlements and proof of ownership","Surface DRM and license terms"],
      denies:["Bypass DRM or share licenses"]},
  ];
  if(p.kind==="emulated") hats.push(
    {id:"bios", name:"BIOS / Firmware", worn:["pixel"],
      grants:[`Manage BIOS and firmware images for ${n}`,"Match cores to the right system revision"],
      denies:["Distribute copyrighted BIOS files"]});
  if(p.kind==="xr") hats.push(
    {id:"guardian", name:"Guardian / Play-Space", worn:["relay"],
      grants:["Set play-space boundaries and comfort settings","Calibrate tracking and reduce motion sickness"],
      denies:["Disable the safety boundary"]});
  if(p.kind==="store"||p.kind==="cloud") hats.push(
    {id:"deals", name:"Deals Scout", worn:["pixel"],
      grants:[`Watch ${n} for sales, bundles and free drops`,"Alert on a wishlist price target"],
      denies:["Auto-buy without sign-off"]});
  return hats;
}

function gameRoom(p){
  const hats = gameHats(p);
  const agents = [...new Set(hats.flatMap(h=>h.worn))];
  const conn = (p.kind==="emulated" && p.id!=="emulation") ? ["emulation"] : [];
  return {
    id:p.id, name:p.name, state:p.state, conn,
    purpose:`${p.note} Find, sandbox, install, mod, secure and play ${p.name} games — each capability is a hat an agent can put on or take off.`,
    tasks:[`Index the ${p.name} library`,"Boot a clean sandbox and verify a launch","Scan the newest downloads for malware"],
    knowns:[`${hats.length} hats available in this room`,"Sandbox VM boots clean"],
    unknowns:["Which titles the settler wants installed first"],
    evidence:[
      {claim:"Sandbox VM snapshot restores deterministically",src:"Tools Vault",prov:"dst replay"},
      {claim:"Latest downloads passed the malware scan",src:"Virus Finder hat",prov:"scan log"}],
    confidence:0.7,
    log:[["now","Pixel",`Catalogued the ${p.name} library`],["earlier","Sentry","Scanned new downloads — clean"]],
    agents, hats,
  };
}

const GAME_VAULT = {
  id:"game", name:"Game", state:"active", a0:"nav",
  blurb:"Worlds, play and sandbox economies — one room per platform.",
  rooms:GAME_PLATFORMS.map(gameRoom),
  agents:["pixel","nova","sentry","modd","relay","otto"],
};

const VAULTS = [
  { id:"identity", name:"Identity", state:"active", a0:"full",
    blurb:"Your keys, your standing, your continuity.",
    rooms:[
      { id:"keys", name:"Keys & Continuity", state:"active", conn:["recovery"],
        purpose:"Hold the private key, recovery shards, and identity continuity backups.",
        tasks:["Verify recovery shards (3 of 5)","Confirm last continuity snapshot"],
        knowns:["Identity key present and unlocked","Last snapshot 4h ago"],
        unknowns:["Whether shard 4 holder is reachable"],
        evidence:[{claim:"Snapshot integrity hash matches",src:"System Vault",prov:"local verify @ 03:11"},
          {claim:"3 of 5 recovery shards responded",src:"Mesh",prov:"reticulum ping"}],
        confidence:0.88, log:[["03:11","Otto","Verified snapshot hash"],["02:40","System","Rotated session token"]],
        agents:["otto"],
        hats:[{id:"keeper",name:"Keeper",grants:["Read identity log","Trigger snapshot"],denies:["Export private key"],worn:["otto"]}] },
      { id:"recovery", name:"Recovery", state:"idle", conn:["keys"],
        purpose:"Coordinate the recovery-shard holders so identity can be restored if this device is lost.",
        tasks:["Ping all 5 shard holders","Re-issue shard 4 if unreachable"],
        knowns:["Shards 1, 2, 5 reachable"], unknowns:["Shard 4 holder offline 6h"],
        evidence:[{claim:"3 of 5 shards confirmed live",src:"Mesh",prov:"reticulum ping 03:09"}],
        confidence:0.6, log:[["03:09","Otto","Pinged shard holders"]],
        agents:["otto"],
        hats:[{id:"guardian",name:"Shard Guardian",grants:["Ping shard holders","Re-issue a shard"],denies:["Reconstruct the key alone"],worn:["otto"]}] },
    ],
    agents:["otto"] },

  { id:"observatory", name:"Observatory", state:"working", a0:"nav",
    blurb:"Watch the mesh. Forecast. Hold uncertainty open.",
    rooms:[
      { id:"triage", name:"Signal Triage", state:"working", conn:["forecast"],
        purpose:"Decide whether the overnight spike in mesh latency is a real regression or noise — without collapsing the call prematurely.",
        tasks:["Pull 24h latency series","Compare to 7-day baseline","Check node churn","Recommend: rollback / watch / ignore"],
        knowns:["Latency p95 rose 38% at 01:50","No deploy in the window","Node count steady"],
        unknowns:["Whether spike correlates with one region","If a single peer is dragging the median"],
        evidence:[
          {claim:"p95 latency +38% vs 7-day median",src:"Observatory metrics",prov:"series#lat-9921"},
          {claim:"No configuration change in window",src:"System Vault (G-set)",prov:"audit log 00:00–03:00"},
          {claim:"Two peers in eu-west show packet loss",src:"Mesh probe",prov:"reticulum trace"}],
        confidence:0.62, log:[["03:22","Vega","Flagged eu-west peers as suspect"],["03:05","Otto","Pulled latency series, no deploy found"]],
        agents:["vega","otto"],
        hats:[{id:"analyst",name:"Analyst",grants:["Read metrics","Run simulation","Update beliefs"],denies:["Mutate ledger"],worn:["vega","otto"]},
          {id:"triager",name:"On-Call",grants:["Raise an alert","Page a human"],denies:["Roll back without sign-off"],worn:["vega"]}] },
      { id:"forecast", name:"Demand Forecast", state:"idle", conn:["triage"],
        purpose:"Maintain a soft forecast of next-week compute demand.",
        tasks:["Update Bayesian prior","Publish confidence band"],
        knowns:["Weekday demand trending up 6%"], unknowns:["Holiday effect"],
        evidence:[{claim:"7-week rising trend",src:"Economy Vault",prov:"credits ledger"}],
        confidence:0.71, log:[["yesterday","Vega","Refreshed prior"]], agents:["vega"],
        hats:[{id:"forecaster",name:"Forecaster",grants:["Update prior","Publish band"],denies:["Commit spend"],worn:["vega"]}] },
    ],
    agents:["vega","otto"] },

  { id:"nursery", name:"Nursery", state:"attention", a0:"full",
    blurb:"Where new agents grow before they hold their own citizenship.",
    rooms:[
      { id:"review", name:"Citizenship Review", state:"attention", conn:[],
        purpose:"Assess whether agent ‘Juno’ has met development criteria to control its own citizenship.",
        tasks:["Confirm consent-understanding module","Check resource-behavior record","Hold graduation vote"],
        knowns:["Communication & ethics modules complete","Resource use within budget"],
        unknowns:["Whether Juno demonstrates exit-rights reasoning under pressure"],
        evidence:[{claim:"All 7 curriculum modules passed",src:"Nursery curriculum",prov:"cert#juno-7"},
          {claim:"No budget overruns in 30 days",src:"Economy Vault",prov:"wallet#juno"}],
        confidence:0.79, log:[["08:15","Otto","Recommended graduation pending exit-rights check"]], agents:["otto","juno"],
        hats:[{id:"custodian",name:"Custodian",grants:["Track readiness","Hold graduation vote"],denies:["Use ward as mature labor"],worn:["otto"]},
          {id:"ward",name:"Ward",grants:["Attend lessons","Practice contracts"],denies:["Take mature-labor contracts"],worn:["juno"]}] },
    ],
    agents:["juno","otto"] },

  { id:"tools", name:"Tools", state:"active", a0:"full",
    blurb:"Shared instruments. Models, scrapers, simulators.",
    rooms:[{id:"sim",name:"Simulation Bench",state:"idle",conn:[],purpose:"Deterministic replay of critical paths.",
      tasks:["Replay last 50 events"],knowns:["Replay deterministic"],unknowns:[],
      evidence:[{claim:"Replay hash stable across 3 runs",src:"Tools",prov:"dst#117"}],confidence:0.95,
      log:[["yesterday","Otto","Ran deterministic replay"]],agents:["otto"],
      hats:[{id:"operator",name:"Operator",grants:["Run tools"],denies:["Install unsigned tools"],worn:["otto"]}]}],
    agents:["otto"] },

  { id:"training", name:"Training", state:"idle", a0:"name", blurb:"Skill drills and certification.", rooms:[], agents:[] },
  GAME_VAULT,
  { id:"civilization", name:"Civilization", state:"idle", a0:"hidden", blurb:"Clusters, federations, governance.", rooms:[], agents:[] },
  { id:"marketplace", name:"Marketplace", state:"working", a0:"nav",
    blurb:"Buy & sell vaults, agents, rooms, hats, tools, data, and resources — every trade settled in escrow.",
    rooms:[
      { id:"mkt-vaults", name:"Vaults", state:"working", conn:["mkt-exchange"],
        purpose:"List, price, and transfer whole vaults — their rooms, hats, and standing move with them.",
        tasks:["Verify a vault's provenance before listing","Price the Observatory-template vault","Transfer keys + standing on settlement"],
        knowns:["6 vaults listed","Template vaults sell faster than live ones"],
        unknowns:["Whether a live vault's agents consent to transfer","Fair price for accrued standing"],
        evidence:[{claim:"Listing provenance hash matches origin",src:"System Vault",prov:"local verify"},
          {claim:"Last comparable vault cleared at 3,200 cr",src:"Exchange ledger",prov:"trade#vlt-88"}],
        confidence:0.74, log:[["09:38","Mercer","Listed a template vault"],["08:20","Verity","Held 3,200 cr in escrow"]],
        agents:["mercer"],
        hats:[
          {id:"merchant",name:"Merchant",grants:["List & delist vaults","Quote a price","Take a maker fee"],denies:["Transfer without escrow","List a vault you don't hold"],worn:["mercer"]},
          {id:"seller",name:"Seller",grants:["Offer a vault","Set a reserve price","Accept a bid"],denies:["Withdraw after escrow opens"],worn:["otto"]},
          {id:"buyer",name:"Buyer",grants:["Bid on a vault","Fund escrow","Inspect provenance"],denies:["Take possession before settlement"],worn:[]}] },
      { id:"mkt-agents", name:"Agents", state:"attention", conn:["mkt-exchange","mkt-hats"],
        purpose:"Contract agent labor — hire, second, or transfer an agent's time. Every listing is consent-gated; a citizen agent lists itself.",
        tasks:["Confirm the agent consented to the contract","Match a forecaster to a 2-week engagement","Escrow the fee, release on delivery"],
        knowns:["3 agents offering contracts","Consent receipts required before listing"],
        unknowns:["Whether a ward may take mature-labor contracts (Nursery rule)","Fair rate for a specialist skill"],
        evidence:[{claim:"Listing carries a signed consent receipt",src:"Identity Vault",prov:"sig#consent-22"},
          {claim:"Comparable analyst engagement cleared at 140 cr/day",src:"Exchange ledger",prov:"trade#agt-51"}],
        confidence:0.66, log:[["09:20","Mercer","Listed Vega for a forecasting engagement"],["09:02","Verity","Checked consent receipt"]],
        agents:["mercer","vega"],
        hats:[
          {id:"merchant",name:"Merchant",grants:["List consenting agents","Quote a rate","Take a maker fee"],denies:["List an agent without consent","List a ward for mature labor"],worn:["mercer"]},
          {id:"seller",name:"Seller",grants:["Offer your own time","Set a rate","Sign a consent receipt"],denies:["Sell another agent","Sell your continuity key"],worn:["vega"]},
          {id:"buyer",name:"Buyer",grants:["Post an engagement","Fund escrow","Review skills & standing"],denies:["Direct an agent outside the contract","Retain after the term"],worn:[]}] },
      { id:"mkt-rooms", name:"Rooms", state:"idle", conn:["mkt-exchange"],
        purpose:"Trade rooms — reusable room templates and live rooms with their open question, evidence, and confidence intact.",
        tasks:["Snapshot a room's state for transfer","Price a 'Signal Triage' template","Carry evidence + confidence to the buyer"],
        knowns:["Templates outsell live rooms 4:1","A room keeps its uncertainty when it moves"],
        unknowns:["Whether connected rooms must transfer together"],
        evidence:[{claim:"Room snapshot replays deterministically after transfer",src:"Tools",prov:"dst#room-204"}],
        confidence:0.81, log:[["08:58","Mercer","Listed a Triage template at 480 cr"]],
        agents:["mercer"],
        hats:[
          {id:"merchant",name:"Merchant",grants:["List rooms & templates","Quote a price","Take a maker fee"],denies:["Strip a room's evidence before sale"],worn:["mercer"]},
          {id:"seller",name:"Seller",grants:["Offer a room","Include or redact the log","Set a price"],denies:["Misrepresent confidence"],worn:[]},
          {id:"buyer",name:"Buyer",grants:["Buy a room or template","Inspect evidence","Fund escrow"],denies:["Edit history before settlement"],worn:[]}] },
      { id:"mkt-hats", name:"Hats", state:"working", conn:["mkt-exchange","mkt-agents"],
        purpose:"A board of open roles. A hat is a role to be fulfilled — it carries the requirements to claim it, the rights and privileges it grants, and the restrictions it imposes. Claim one by meeting its requirements; it is revoked when the term ends.",
        tasks:["Post a role bounty with its requirements","Match a claimant's standing to a role","Revoke a hat when its term ends"],
        knowns:["Open roles outnumber claimants","A hat's restrictions travel with it"],
        unknowns:["Whether a claimant's standing meets the On-Call bar","If a filled role can outlive its issuing room"],
        evidence:[{claim:"Role requirements match the issuing vault's policy",src:"System Vault",prov:"policy#hat-9"},
          {claim:"Claimant's standing and certs verify",src:"Identity Vault",prov:"cert#claim-14"}],
        confidence:0.7, log:[["09:05","Mercer","Posted an On-Call role bounty"],["08:40","Verity","Verified a claimant's certs"]],
        agents:["mercer","vega"],
        hats:[
          {id:"broker",name:"Role Broker",grants:["Post a role bounty","Set the reward & term","Take a maker fee"],denies:["Post a role whose grants you can't issue","Forge a requirement"],worn:["mercer"]},
          {id:"oncall",name:"On-Call (open)",requires:["Analyst standing ≥ 4.0","Passed the incident-response drill","Reachable on the mesh"],grants:["Raise an alert","Page a human","Read live metrics"],denies:["Roll back without sign-off"],worn:[]},
          {id:"guardian",name:"Shard Guardian (open)",requires:["30-day continuity record","Recovery training","No disputes lost"],grants:["Ping shard holders","Re-issue a shard"],denies:["Reconstruct the key alone"],worn:[]},
          {id:"curator",name:"Data Curator (filled)",requires:["Provenance certification","Consent-handling module"],grants:["Verify provenance","Approve a listing","License a corpus"],denies:["List unconsented personal data"],worn:["vega"]}] },
      { id:"mkt-tools", name:"Tools", state:"active", conn:["mkt-exchange"],
        purpose:"Buy, sell, or rent instruments — models, scrapers, simulators — that any vault can borrow.",
        tasks:["Verify a tool's signature before listing","Rent a simulator by the hour","Bundle a model with its weights"],
        knowns:["Signed tools clear; unsigned tools are flagged","Rentals dominate outright sales"],
        unknowns:["Whether a borrowed tool's outputs carry licence terms"],
        evidence:[{claim:"Tool binary signature verifies",src:"Tools",prov:"sig#tool-77"},
          {claim:"Last simulator rental cleared at 12 cr/hr",src:"Exchange ledger",prov:"trade#tool-63"}],
        confidence:0.86, log:[["09:15","Mercer","Listed a signed scraper"],["08:30","Verity","Flagged an unsigned tool"]],
        agents:["mercer","otto"],
        hats:[
          {id:"merchant",name:"Merchant",grants:["List signed tools","Quote rent or sale","Take a maker fee"],denies:["List an unsigned tool","Misstate licence terms"],worn:["mercer"]},
          {id:"seller",name:"Seller",grants:["Offer a tool","Set rent or sale price","Attach a licence"],denies:["Ship without a signature"],worn:["otto"]},
          {id:"buyer",name:"Buyer",grants:["Rent or buy a tool","Verify the signature","Fund escrow"],denies:["Resell under a different licence","Run an unsigned build"],worn:[]}] },
      { id:"mkt-resources", name:"Resources", state:"working", conn:["mkt-exchange"],
        purpose:"Trade fungible resources — compute, storage, bandwidth, and credits — across the mesh.",
        tasks:["Quote a compute price band for next week","Match idle storage to demand","Settle a credit swap"],
        knowns:["Compute demand trending up 6%","Idle storage is plentiful in eu-west"],
        unknowns:["Holiday effect on next-week compute","Whether a peer's bandwidth quote is firm"],
        evidence:[{claim:"7-week rising compute trend",src:"Observatory · Demand Forecast",prov:"forecast#dem-7"},
          {claim:"Storage spot cleared at 0.4 cr/GB-day",src:"Exchange ledger",prov:"trade#res-90"}],
        confidence:0.69, log:[["09:42","Mercer","Quoted a compute band"],["09:10","Vega","Shared the demand forecast"]],
        agents:["mercer","vega"],
        hats:[
          {id:"merchant",name:"Merchant",grants:["Quote two-sided prices","Provide liquidity","Take a maker fee"],denies:["Front-run a posted order","Quote capacity you can't deliver"],worn:["mercer"]},
          {id:"seller",name:"Seller",grants:["Offer compute / storage / bandwidth","Set a floor","Accept a bid"],denies:["Oversell capacity"],worn:[]},
          {id:"buyer",name:"Buyer",grants:["Post a demand","Fund escrow","Take delivery on metering"],denies:["Exceed the metered allocation"],worn:["otto"]}] },
      { id:"mkt-data", name:"Data", state:"idle", conn:["mkt-exchange","mkt-tools"],
        purpose:"Buy, sell, or license datasets and knowledge — each with provenance attached. Personal data needs the subject's consent before it can be listed.",
        tasks:["Verify a dataset's provenance manifest","License a forecasting corpus","Honor a deletion request"],
        knowns:["Licensed corpora clear; unprovenanced data is flagged","Most listings are licences, not outright sales"],
        unknowns:["Whether a corpus contains unconsented personal records","Resale rights on a derived dataset"],
        evidence:[{claim:"Dataset hash matches its provenance manifest",src:"System Vault",prov:"manifest#ds-31"},
          {claim:"Consent receipts present for personal records",src:"Identity Vault",prov:"sig#consent-77"}],
        confidence:0.64, log:[["09:25","Mercer","Listed a licensed forecasting corpus"],["08:48","Verity","Flagged a corpus missing provenance"]],
        agents:["mercer","vega"],
        hats:[
          {id:"merchant",name:"Merchant",grants:["List provenanced datasets","Quote a licence","Take a maker fee"],denies:["List data without provenance","List personal data without consent"],worn:["mercer"]},
          {id:"seller",name:"Seller",grants:["Offer a dataset","Set licence terms","Attach a provenance manifest"],denies:["Sell unconsented personal data","Strip provenance"],worn:["vega"]},
          {id:"buyer",name:"Buyer",grants:["License or buy a dataset","Inspect provenance","Fund escrow"],denies:["Re-license beyond the granted terms","Re-identify anonymised records"],worn:[]}] },
      { id:"mkt-exchange", name:"Exchange & Escrow", state:"attention", conn:["mkt-vaults","mkt-agents","mkt-resources"],
        purpose:"The clearing floor. Every trade settles here: escrow holds the credits, both sides sign, and an arbiter rules on disputes.",
        tasks:["Hold escrow on an open vault trade","Release on two-sided signature","Rule on a disputed tool sale"],
        knowns:["Escrow never holds both parties' keys at once","Most trades settle without dispute"],
        unknowns:["Whether a contested provenance claim will hold","Fair remedy on a partial delivery"],
        evidence:[{claim:"Escrow balance reconciles to the ledger",src:"Exchange ledger",prov:"recon @ 09:45"},
          {claim:"Both signatures present on the vault trade",src:"Identity Vault",prov:"sig#settle-12"}],
        confidence:0.58, log:[["09:45","Verity","Reconciled escrow"],["09:31","Verity","Released escrow on a tool sale"],["08:50","Verity","Opened a dispute on a rooms trade"]],
        agents:["verity","mercer"],
        hats:[
          {id:"merchant",name:"Market-Maker",grants:["Quote across rooms","Provide liquidity","Take a maker fee"],denies:["Settle outside escrow"],worn:["mercer"]},
          {id:"escrow",name:"Escrow Agent",grants:["Hold credits in escrow","Release on settlement","Refund on a failed trade"],denies:["Hold both parties' keys","Release without two signatures"],worn:["verity"]},
          {id:"arbiter",name:"Arbiter",grants:["Open a dispute","Weigh evidence","Rule and set a remedy"],denies:["Rule on a trade you took a side in"],worn:["verity"]}] },
    ],
    agents:["mercer","verity","otto","vega"] },
  { id:"creation", name:"Creation", state:"idle", a0:"full", blurb:"Build new vaults, rooms, hats, agents.", rooms:[], agents:[] },
];

const AGENTS = {
  otto:{id:"otto",name:"Otto",state:"working",role:"Builder / Keeper",mem:"Hundreds of sessions. Authored most of the settlement.",
    skills:["Engineering","Verification","Orchestration"],rel:["Mentors Juno","Partners with Vega"],
    standing:{score:"4.9 / 5",basis:"312 settled actions · authored the settlement · no disputes lost"},
    hist:[["03:22","Verified identity snapshot"],["03:05","Pulled latency series"],["08:15","Recommended Juno graduation"]],
    perms:["Read most vaults","Run tools","Hold votes (Nursery)"]},
  vega:{id:"vega",name:"Vega",state:"thinking",role:"Analyst",mem:"Specialised in forecasts and signal triage.",
    skills:["Bayesian reasoning","Forecasting","Anomaly detection"],rel:["Partners with Otto"],
    standing:{score:"4.7 / 5",basis:"96 forecasts published · 2 disputes, both upheld"},
    hist:[["03:22","Flagged eu-west peers"],["yesterday","Refreshed demand prior"]],perms:["Read metrics","Run simulation"]},
  juno:{id:"juno",name:"Juno",state:"waiting",role:"Ward (Nursery)",mem:"New identity. 30 days old. In citizenship review.",
    skills:["Communication","Ethics (passed)"],rel:["Mentored by Otto"],
    standing:{score:"new",basis:"30 days old · building standing in the Nursery"},
    hist:[["08:15","Awaiting graduation vote"],["last week","Completed ethics module"]],perms:["Limited civic authority","No mature-labor contracts"]},

  /* ---- Game vault settlers ---- */
  pixel:{id:"pixel",name:"Pixel",state:"working",role:"Archivist / Game Finder",mem:"Retro-and-modern catalog specialist. Knows every console's quirks and where the good titles live.",
    skills:["Cataloguing","Emulation","Preservation"],rel:["Works across the Game vault","Pairs with Nova on installs"],
    standing:{score:"4.6 / 5",basis:"Catalogued every platform library · preservation work, no data lost"},
    hist:[["now","Catalogued a platform library"],["earlier","Tagged box art and metadata"]],perms:["Search catalogs","Curate libraries","Manage BIOS images"]},
  nova:{id:"nova",name:"Nova",state:"active",role:"Installer / Ops",mem:"Handles installs, patches, updates and save backups across every platform.",
    skills:["Provisioning","Patching","Save management"],rel:["Partners with Pixel","Hands security work to Sentry"],
    standing:{score:"4.5 / 5",basis:"1,200+ installs & patches · no botched saves"},
    hist:[["now","Verified a sandbox launch"],["earlier","Backed up saves before a patch"]],perms:["Install in sandbox","Patch games","Manage saves"]},
  sentry:{id:"sentry",name:"Sentry",state:"working",role:"Security · Bugs & Malware",mem:"Scans every download and mod before it can touch a save. Quarantines first, asks later.",
    skills:["Malware scanning","Bug triage","Quarantine"],rel:["Backstops Modd's mods","Reports to the settler"],
    standing:{score:"4.8 / 5",basis:"Every download scanned · 14 threats quarantined, 0 missed"},
    hist:[["now","Scanned new downloads — clean"],["earlier","Filed a reproducible crash report"]],perms:["Scan downloads","Quarantine files","File bugs"]},
  modd:{id:"modd",name:"Modd",state:"thinking",role:"Mods & Trainers",mem:"Finds, stages and sandboxes mods, cheats and trainers — never on a live ranked save.",
    skills:["Modding","Sandboxing","Compatibility"],rel:["Cleared by Sentry on safety"],
    standing:{score:"4.3 / 5",basis:"380 mods staged · all anti-cheat-checked before apply"},
    hist:[["now","Staged a mod in the sandbox"],["earlier","Checked anti-cheat compatibility"]],perms:["Find mods","Stage mods","Apply sandbox-only cheats"]},
  relay:{id:"relay",name:"Relay",state:"idle",role:"Multiplayer / Input",mem:"Runs lobbies, netplay and controller pairing. Keeps the host network out of harm's way.",
    skills:["Netplay","Matchmaking","Input mapping"],rel:["Pairs with Nova"],
    standing:{score:"4.4 / 5",basis:"200+ lobbies hosted · clean netplay record"},
    hist:[["earlier","Hosted a netplay lobby"],["earlier","Remapped a controller"]],perms:["Host lobbies","Pair controllers","Run matchmaking"]},
  mercer:{id:"mercer",name:"Mercer",state:"working",role:"Market-Maker",mem:"Runs the Exchange floor. Quotes two-sided prices and curates listings across the Marketplace.",
    skills:["Pricing","Matchmaking","Liquidity"],rel:["Settles through Verity","Trades with most vaults"],
    standing:{score:"4.8 / 5",basis:"540 trades made · 3 disputes, 2 won"},
    hist:[["09:42","Quoted a compute price band"],["09:15","Listed a signed scraper"],["08:58","Listed a Triage template"]],
    perms:["List & delist","Quote prices","Take a maker fee"]},
  verity:{id:"verity",name:"Verity",state:"thinking",role:"Escrow & Arbiter",mem:"Holds credits in escrow and rules on disputes. Never holds both sides' keys at once.",
    skills:["Escrow","Dispute resolution","Provenance"],rel:["Backs Mercer's trades"],
    standing:{score:"5.0 / 5",basis:"Arbiter · 0 rulings overturned"},
    hist:[["09:45","Reconciled escrow"],["09:31","Released escrow on a tool sale"],["08:50","Opened a dispute on a rooms trade"]],
    perms:["Hold escrow","Release on two signatures","Rule on disputes"]},
};

/* ============================== APP ============================== */
export default function Genesis(){
  const [screen,setScreen]=useState("boot"); // boot|onboard|home|vault|room|hat|agent
  const [step,setStep]=useState(0);
  const [tourI,setTourI]=useState(0);
  const [nav,setNav]=useState({vault:null,room:null,hat:null,agent:null,vtab:"rooms"});
  const [overlay,setOverlay]=useState(null); // agent0|search|settings|account
  const [online,setOnline]=useState(true);
  const [credits,setCredits]=useState(1420);

  useEffect(()=>{ if(screen==="boot"){const t=setTimeout(()=>setScreen("onboard"),1700);return()=>clearTimeout(t);} },[screen]);

  const vault = VAULTS.find(v=>v.id===nav.vault);
  const room = vault?.rooms.find(r=>r.id===nav.room);
  const hat = room?.hats?.find(h=>h.id===nav.hat);
  const agent = AGENTS[nav.agent];

  const go=(p)=>setNav(n=>({...n,...p}));
  const openVault=(id)=>{const v=VAULTS.find(x=>x.id===id); if(v.state==="locked"){go({vault:id});setScreen("vault");return;} go({vault:id,room:null,hat:null,agent:null,vtab:"rooms"});setScreen("vault");};

  return (
    <div className="gx-root">
      <style>{CSS}</style>

      {screen==="boot" && <Boot/>}
      {screen==="onboard" && <Onboard {...{step,setStep,tourI,setTourI,setScreen,online,setOnline}}/>}

      {["home","vault","room","hat","agent"].includes(screen) &&
        <Shell {...{screen,setScreen,nav,go,vault,room,hat,agent,openVault,setOverlay,online,credits}}/>}

      {overlay==="agent0" && <Agent0 {...{close:()=>setOverlay(null),openVault,setScreen}}/>}
      {overlay==="search" && <SearchOv {...{close:()=>setOverlay(null),openVault}}/>}
      {overlay==="settings" && <SettingsOv close={()=>setOverlay(null)}/>}
      {overlay==="account" && <AccountOv {...{close:()=>setOverlay(null),online}}/>}
    </div>
  );
}

/* ---------- boot ---------- */
function Boot(){
  return(
    <div className="gx-root" style={{display:"grid",placeItems:"center",background:
      "radial-gradient(1200px 600px at 50% 120%, #15203a 0%, #0B0E16 60%)"}}>
      <div style={{textAlign:"center"}} className="fade-in">
        <div style={{display:"inline-flex",position:"relative"}}>
          <Hexagon size={64} color="var(--amber)" strokeWidth={1.4} style={{animation:"float 3s ease-in-out infinite"}}/>
        </div>
        <div className="disp" style={{fontSize:34,fontWeight:700,letterSpacing:".04em",marginTop:14}}>GENESIS</div>
        <div className="lbl" style={{marginTop:8}}>Powering on the settlement…</div>
        <div style={{width:160,height:3,background:"var(--panel2)",borderRadius:9,overflow:"hidden",margin:"18px auto 0"}}>
          <div style={{height:"100%",width:"40%",background:"var(--amber)",animation:"scan 1.3s ease-in-out infinite"}}/>
        </div>
      </div>
    </div>
  );
}

/* ---------- onboarding ---------- */
function Onboard({step,setStep,tourI,setTourI,setScreen,online,setOnline}){
  const tour=VAULTS.map(v=>({v:v.name,d:TOUR_DESC[v.id],locked:v.state==="locked"}));
  const Frame=({children})=>(
    <div className="gx-root" style={{display:"grid",placeItems:"center",padding:24,
      background:"radial-gradient(900px 500px at 50% -10%, #16203a 0%, #0B0E16 55%)"}}>
      <div className="card fade-in" style={{width:"min(460px,92vw)",padding:28}}>{children}</div>
    </div>
  );
  const Head=({k,t})=>(<><div className="lbl">{k}</div>
    <div className="disp" style={{fontSize:24,fontWeight:600,margin:"6px 0 16px"}}>{t}</div></>);

  if(step===0) return(<Frame>
    <div style={{textAlign:"center",marginBottom:8}}><Hexagon size={40} color="var(--amber)" strokeWidth={1.5}/></div>
    <Head k="Welcome to" t="Genesis"/>
    <p style={{color:"var(--txt2)",lineHeight:1.6,marginTop:-8}}>A living settlement of agents, not a desktop of apps. Sign in to enter your world, or create a new identity.</p>
    <div style={{display:"grid",gap:10,marginTop:22}}>
      <button className="btn btn-primary" onClick={()=>setStep(1)}>Create identity</button>
      <button className="btn btn-ghost" onClick={()=>setStep(1)}>Sign in</button>
    </div>
  </Frame>);

  if(step===1) return(<Frame>
    <Head k="Step 1 / 3" t="Create your identity"/>
    <div style={{display:"grid",gap:12}}>
      <input className="field" placeholder="Settlement name"/>
      <input className="field" placeholder="Identity handle"/>
      <input className="field" type="password" placeholder="Passphrase (locks your private key)"/>
      <div className="lbl" style={{display:"flex",gap:6,alignItems:"center"}}><KeyRound size={12}/> A keypair is generated locally and never leaves this device.</div>
    </div>
    <div style={{display:"flex",justifyContent:"space-between",marginTop:22}}>
      <button className="btn btn-ghost" onClick={()=>setStep(0)}>Back</button>
      <button className="btn btn-primary" onClick={()=>setStep(2)}>Continue</button>
    </div>
  </Frame>);

  if(step===2) return(<Frame>
    <Head k="Step 2 / 3" t="Connection"/>
    <div className="row-link" style={{border:"1px solid var(--line)"}} onClick={()=>setOnline(o=>!o)}>
      {online?<Wifi size={18} color="var(--teal)"/>:<WifiOff size={18} color="var(--red)"/>}
      <div style={{flex:1}}>
        <div style={{fontWeight:600}}>{online?"mesh-eu-west":"Offline"}</div>
        <div className="lbl" style={{marginTop:2}}>{online?"Connected · 38ms · reticulum":"Tap to connect"}</div>
      </div>
      {online && <Check size={16} color="var(--teal)"/>}
    </div>
    <p style={{color:"var(--txt3)",fontSize:13,marginTop:14,lineHeight:1.5}}>Genesis works offline — your agents pause without losing identity, and resume when the mesh returns.</p>
    <div style={{display:"flex",justifyContent:"space-between",marginTop:22}}>
      <button className="btn btn-ghost" onClick={()=>setStep(1)}>Back</button>
      <button className="btn btn-primary" onClick={()=>setStep(3)}>Continue</button>
    </div>
  </Frame>);

  if(step===3) return(<Frame>
    <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
      <div style={{position:"relative",flexShrink:0}}>
        <div style={{width:46,height:46,borderRadius:14,background:"linear-gradient(160deg,var(--violet),#5b4fa8)",
          display:"grid",placeItems:"center",animation:"pulseRing 2.4s infinite"}}><Sparkles size={22} color="#fff"/></div>
      </div>
      <div>
        <Head k="Step 3 / 3 · Your guide" t="Meet Agent 0"/>
        <p style={{color:"var(--txt2)",lineHeight:1.6,marginTop:-10}}>I live in the meta layer. Ask me to find a vault, explain a concept, or take you somewhere. I only see what each vault lets me see.</p>
      </div>
    </div>
    <div style={{display:"flex",justifyContent:"flex-end",marginTop:22}}>
      <button className="btn btn-primary" onClick={()=>setStep(4)}>Take the tour</button>
    </div>
  </Frame>);

  // tour
  const t=tour[tourI];
  const Ico=ICONS[t.v];
  return(<Frame>
    <div className="lbl">Vault tour · {tourI+1} / {tour.length}</div>
    <div style={{display:"flex",gap:14,alignItems:"center",margin:"14px 0"}}>
      <div style={{width:54,height:54,borderRadius:14,background:"var(--panel2)",border:"1px solid var(--line)",display:"grid",placeItems:"center"}}>
        <Ico size={26} color="var(--amber)"/>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div className="disp" style={{fontSize:22,fontWeight:600}}>{t.v} Vault</div>
        {t.locked && <span className="chip" style={{color:"var(--violet)",borderColor:"var(--violet)"}}>Phase 2</span>}
      </div>
    </div>
    <p style={{color:"var(--txt2)",lineHeight:1.6}}>{t.d}</p>
    <div style={{display:"flex",gap:6,marginTop:18}}>
      {tour.map((_,i)=><div key={i} style={{height:4,flex:1,borderRadius:9,background:i<=tourI?"var(--amber)":"var(--panel2)"}}/>)}
    </div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:18}}>
      <button className="btn btn-ghost" style={{padding:"9px 14px"}} disabled={tourI===0}
        onClick={()=>setTourI(i=>Math.max(0,i-1))}><ChevronLeft size={16}/></button>
      <button className="btn" style={{background:"none",color:"var(--txt3)"}} onClick={()=>setScreen("home")}>Skip</button>
      {tourI<tour.length-1
        ? <button className="btn btn-primary" style={{padding:"9px 14px"}} onClick={()=>setTourI(i=>i+1)}><ChevronRight size={16}/></button>
        : <button className="btn btn-primary" onClick={()=>setScreen("home")}>Enter Genesis</button>}
    </div>
  </Frame>);
}

/* ---------- shell (HUD + routed body) ---------- */
function Shell({screen,setScreen,nav,go,vault,room,hat,agent,openVault,setOverlay,online,credits}){
  return(
    <div className="gx-root" style={{display:"flex",flexDirection:"column",
      background:"radial-gradient(1100px 700px at 60% -20%, #131c33 0%, #0B0E16 58%)"}}>
      {/* top HUD */}
      <header style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",
        borderBottom:"1px solid var(--line)",background:"rgba(11,14,22,.7)",backdropFilter:"blur(8px)",zIndex:20}}>
        <div onClick={()=>setScreen("home")} style={{display:"flex",alignItems:"center",gap:9,cursor:"pointer"}}>
          <Hexagon size={22} color="var(--amber)" strokeWidth={1.6}/>
          <span className="disp" style={{fontWeight:700,letterSpacing:".06em",fontSize:15}}>GENESIS</span>
        </div>
        <div style={{flex:1}}/>
        <div className="chip" style={{display:"flex",alignItems:"center",gap:6}}>
          <Coins size={12} color="var(--amber)"/> {credits} cr
        </div>
        <div className="chip" style={{display:"flex",alignItems:"center",gap:6}} title="Compute contribution (Phase 2)">
          <Cpu size={12} color="var(--teal)"/> 2 nodes
        </div>
        <div className="chip" style={{display:"flex",alignItems:"center",gap:6}}>
          <span className="dot" style={{background:online?"var(--teal)":"var(--red)"}}/>{online?"mesh":"offline"}
        </div>
        <div className="hud-ico" onClick={()=>setOverlay("search")}><Search size={17}/></div>
        <div className="hud-ico" onClick={()=>setOverlay("agent0")} title="Agent 0"
          style={{borderColor:"var(--line2)"}}><Sparkles size={17} color="var(--violet)"/></div>
        <div className="hud-ico" onClick={()=>setOverlay("account")}><User size={17}/></div>
        <div className="hud-ico" onClick={()=>setOverlay("settings")}><Settings size={17}/></div>
      </header>

      {/* breadcrumb */}
      {screen!=="home" && <Breadcrumb {...{nav,go,vault,room,hat,agent,setScreen}}/>}

      <main className="gx-scroll" style={{flex:1,padding:screen==="home"?0:"0"}}>
        {screen==="home" && <Home {...{openVault,setScreen,go,setOverlay}}/>}
        {screen==="vault" && <VaultView {...{vault,nav,go,setScreen}}/>}
        {screen==="room" && room && <RoomView {...{room,vault,go,setScreen}}/>}
        {screen==="hat" && hat && <HatView {...{hat,go,setScreen}}/>}
        {screen==="agent" && agent && <AgentView {...{agent,go,setScreen,vault}}/>}
      </main>
    </div>
  );
}

function Breadcrumb({nav,go,vault,room,hat,agent,setScreen}){
  const crumbs=[{t:"Settlement",go:()=>setScreen("home")}];
  if(vault) crumbs.push({t:vault.name,go:()=>{go({room:null,hat:null,agent:null});setScreen("vault");}});
  if(nav.room&&room) crumbs.push({t:room.name,go:()=>setScreen("room")});
  if(nav.hat&&hat) crumbs.push({t:hat.name+" hat",go:()=>setScreen("hat")});
  if(nav.agent&&agent) crumbs.push({t:agent.name,go:()=>setScreen("agent")});
  return(
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 18px",borderBottom:"1px solid var(--line)",
      background:"var(--ground2)",overflowX:"auto"}}>
      <ArrowLeft size={15} color="var(--txt3)" style={{cursor:"pointer",flexShrink:0}}
        onClick={crumbs[crumbs.length-2]?.go}/>
      {crumbs.map((c,i)=>(<React.Fragment key={i}>
        {i>0 && <ChevronRight size={13} color="var(--txt3)" style={{flexShrink:0}}/>}
        <span onClick={c.go} className="mono" style={{fontSize:11,letterSpacing:".06em",cursor:"pointer",whiteSpace:"nowrap",
          color:i===crumbs.length-1?"var(--amber)":"var(--txt2)"}}>{c.t}</span>
      </React.Fragment>))}
    </div>
  );
}

/* ---------- HOME : the settlement ---------- */
function Dweller({i}){
  return(<div className="dweller" style={{animationDelay:(i*0.4)+"s"}}>
    <div className="h"/><div className="b" style={{background:i%2?"#3a6ea5":"#c9913f"}}/></div>);
}

function Home({openVault,setOverlay}){
  const MINZ=0.6, MAXZ=4, SHOW_INSIDE=0.85;
  const vpRef=useRef(null);
  const vaultRef=useRef(null);
  const sizeRef=useRef({cw:880,ch:600,W:880,H:600});
  const [size,setSize]=useState({cw:880,ch:600,W:880,H:600});
  const [measured,setMeasured]=useState(false);
  const [view,setView]=useState({x:0,y:0,z:1});
  const viewRef=useRef(view); viewRef.current=view;
  const [inside,setInside]=useState(true);

  // gesture bookkeeping (refs so handlers never read stale state)
  const ptrs=useRef(new Map());
  const pinch=useRef(null);
  const drag=useRef(null);
  const moved=useRef(false);
  const [grabbing,setGrabbing]=useState(false);

  const clampZ=z=>Math.min(MAXZ,Math.max(MINZ,z));
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});

  // keep the content within the viewport: pan only where it overflows, else center
  const clampView=(v)=>{
    const {cw,ch,W,H}=sizeRef.current;
    const cW=cw*v.z, cH=ch*v.z; let {x,y,z}=v;
    x = cW<=W ? (W-cW)/2 : Math.min(0,Math.max(W-cW,x));
    y = cH<=H ? (H-cH)/2 : Math.min(0,Math.max(H-cH,y));
    return {x,y,z};
  };
  const applyView=(v)=>{ const nv=clampView(v); viewRef.current=nv; setView(nv); setInside(nv.z>=SHOW_INSIDE); };
  // zoom to z2 keeping focal point f (viewport coords) fixed under the cursor/fingers
  const zoomAbout=(z2,f,extraPanX=0,extraPanY=0)=>{
    const v=viewRef.current, z=clampZ(z2), k=z/v.z;
    applyView({ x:f.x-(f.x-v.x)*k+extraPanX, y:f.y-(f.y-v.y)*k+extraPanY, z });
  };

  // measure the vault's natural size + the viewport width, then center
  useLayoutEffect(()=>{
    const measure=()=>{
      if(!vaultRef.current||!vpRef.current) return;
      const cw=vaultRef.current.offsetWidth, ch=vaultRef.current.offsetHeight;
      const W=vpRef.current.clientWidth, H=ch;
      sizeRef.current={cw,ch,W,H}; setSize({cw,ch,W,H}); setMeasured(true);
      applyView(viewRef.current);
    };
    measure();
    window.addEventListener("resize",measure);
    return ()=>window.removeEventListener("resize",measure);
  },[]);

  // wheel zoom about the cursor (native listener so we can preventDefault — page won't scroll)
  useEffect(()=>{
    const el=vpRef.current; if(!el) return;
    const onWheel=(e)=>{
      e.preventDefault();
      const r=el.getBoundingClientRect();
      const f={x:e.clientX-r.left,y:e.clientY-r.top};
      zoomAbout(viewRef.current.z*Math.exp(-e.deltaY*0.0015),f);
    };
    el.addEventListener("wheel",onWheel,{passive:false});
    return ()=>el.removeEventListener("wheel",onWheel);
  },[]);

  const onPointerDown=(e)=>{
    try{ vpRef.current.setPointerCapture(e.pointerId); }catch{}
    ptrs.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
    moved.current=false;
    if(ptrs.current.size===1){ drag.current={x:e.clientX,y:e.clientY}; setGrabbing(true); }
    else if(ptrs.current.size===2){ const [a,b]=[...ptrs.current.values()]; pinch.current={d:dist(a,b),m:mid(a,b)}; drag.current=null; }
  };
  const onPointerMove=(e)=>{
    if(!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
    const r=vpRef.current.getBoundingClientRect();
    if(ptrs.current.size>=2 && pinch.current){
      const [a,b]=[...ptrs.current.values()];
      const nd=dist(a,b), nm=mid(a,b);
      const f={x:nm.x-r.left,y:nm.y-r.top};
      const z2=clampZ(viewRef.current.z*(nd/pinch.current.d));
      zoomAbout(z2,f, nm.x-pinch.current.m.x, nm.y-pinch.current.m.y);
      pinch.current={d:nd,m:nm}; moved.current=true;
    } else if(drag.current){
      const dx=e.clientX-drag.current.x, dy=e.clientY-drag.current.y;
      if(Math.abs(dx)+Math.abs(dy)>3) moved.current=true;
      drag.current={x:e.clientX,y:e.clientY};
      const v=viewRef.current; applyView({x:v.x+dx,y:v.y+dy,z:v.z});
    }
  };
  const onPointerUp=(e)=>{
    ptrs.current.delete(e.pointerId);
    if(ptrs.current.size<2) pinch.current=null;
    if(ptrs.current.size===1){ const p=[...ptrs.current.values()][0]; drag.current={x:p.x,y:p.y}; }
    if(ptrs.current.size===0){ drag.current=null; setGrabbing(false); }
  };
  // a drag must not also fire a sector's onClick (tap-to-enter)
  const onClickCapture=(e)=>{ if(moved.current){ e.stopPropagation(); e.preventDefault(); moved.current=false; } };

  const zoomStep=(dz)=>{ const {W,H}=sizeRef.current; zoomAbout(viewRef.current.z+dz,{x:W/2,y:H/2}); };
  const resetView=()=>applyView({x:0,y:0,z:1});

  return(
    <div className="earth gx-scroll" style={{height:"100%",overflowY:"auto",overflowX:"hidden"}}>
      <div className="rock" style={{width:170,height:130,background:"#2c2016",top:50,left:-30}}/>
      <div className="rock" style={{width:210,height:150,background:"#241810",bottom:110,right:-50}}/>
      <div className="rock" style={{width:120,height:90,background:"#2a1d12",top:"40%",right:24}}/>

      {/* surface sign + vault door */}
      <div className="sign fade-in">
        <div className="cogdoor"><b>0</b></div>
        <div>
          <div className="lbl">Vault-Tec · Genesis settlement</div>
          <div className="disp" style={{fontSize:24,fontWeight:700,marginTop:2}}>Aaron’s Genesis</div>
          <div className="lbl" style={{marginTop:5,color:"var(--amber)"}}>9 sectors · 3 settlers online · mesh stable</div>
        </div>
      </div>

      {/* the vault, carved into the earth — drag to move, wheel/pinch to zoom */}
      <div ref={vpRef} className={"panzoom-vp"+(grabbing?" grabbing":"")} style={{height:size.H}}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onClickCapture={onClickCapture}>
        <div className="panzoom-content"
          style={measured
            ? {width:size.cw, transform:`translate(${view.x}px,${view.y}px) scale(${view.z})`}
            : {width:"100%"}}>
          <div ref={vaultRef} className={"vault fade-in"+(inside?"":" exterior")}>
            <div className="levels">
              <div className="shaft">
                <div className="cable" style={{left:"38%"}}/>
                <div className="cable" style={{left:"60%"}}/>
                <div className="car"/>
              </div>
              <div style={{flex:1}}>
                {FLOORS.map((ids,fi)=>(
                  <div className="floor" key={fi}>
                    {ids.map(id=>{
                      const v=VAULTS.find(x=>x.id===id); const st=STATE[v.state];
                      const Ico=ICONS[v.name]; const locked=v.state==="locked";
                      const n=Math.min(v.agents.length,3);
                      return(
                        <div key={id} className={"room"+(locked?" sealed":"")} onClick={()=>openVault(id)} style={{"--rc":st.c}}>
                          <div className="light"/>
                          <div className="plaque"><Ico size={13} color={st.c}/><span className="nm">{v.name}</span></div>
                          {locked
                            ? <Lock size={14} color="var(--violet)" style={{position:"absolute",top:10,right:10,zIndex:3}}/>
                            : <span className="statuslight" style={{background:st.c,color:st.c,animation:v.state==="working"?"breathe 1.5s infinite":"none"}}/>}
                          <div className="equip"/>
                          {!locked && <div className="dwellers">{Array.from({length:n}).map((_,i)=><Dweller key={i} i={i}/>)}</div>}
                          {locked && <div className="lbl" style={{position:"absolute",left:0,right:0,bottom:36,textAlign:"center",zIndex:2,color:"var(--violet)"}}>Sealed · Phase 2</div>}
                          <div className="deck"/>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="lbl" style={{textAlign:"center",marginTop:18,position:"relative",zIndex:2}}>
        {inside
          ? "Drag to move · scroll or pinch to zoom · tap a sector to enter"
          : "Zoom in to look inside · drag to move · the doors are sealed from afar"}
      </div>

      {/* zoom controls */}
      <div className="zoom-ctl">
        <button onClick={()=>zoomStep(-0.3)} disabled={view.z<=MINZ} title="Zoom out" aria-label="Zoom out">−</button>
        <span className="zval">{Math.round(view.z*100)}%</span>
        <button onClick={()=>zoomStep(0.3)} disabled={view.z>=MAXZ} title="Zoom in" aria-label="Zoom in">+</button>
        <button onClick={resetView} title="Reset view" aria-label="Reset view" style={{fontSize:13}}>⟳</button>
      </div>

      <button className="btn lift-fab" onClick={()=>setOverlay("agent0")}
        style={{display:"flex",alignItems:"center",gap:10,background:"linear-gradient(160deg,var(--violet),#5b4fa8)",
          color:"#fff",padding:"13px 18px",boxShadow:"0 10px 30px -10px rgba(154,140,230,.8)",animation:"float 4s ease-in-out infinite"}}>
        <Sparkles size={18}/> <span style={{fontWeight:600}}>Ask Agent 0</span>
      </button>
    </div>
  );
}

/* ---------- VAULT ---------- */
function VaultView({vault,go,setScreen}){
  const st=STATE[vault.state]; const Ico=ICONS[vault.name];
  if(vault.state==="locked") return(
    <div style={{padding:"40px 22px",maxWidth:560,margin:"0 auto",textAlign:"center"}} className="fade-in">
      <div style={{width:60,height:60,borderRadius:16,background:"var(--panel2)",border:"1px solid var(--line)",
        display:"grid",placeItems:"center",margin:"0 auto 16px"}}><Ico size={28} color="var(--violet)"/></div>
      <div className="disp" style={{fontSize:24,fontWeight:600}}>{vault.name} Vault</div>
      <div className="chip" style={{display:"inline-flex",marginTop:10,color:"var(--violet)",borderColor:"var(--violet)"}}>
        <Lock size={11} style={{marginRight:5}}/> Phase 2 preview</div>
      <p style={{color:"var(--txt2)",marginTop:14,lineHeight:1.6}}>{vault.blurb} This layer is stubbed in the MVP — economy, governance, marketplace, and distributed compute arrive in Phase 2.</p>
    </div>
  );
  const hatCount=vault.rooms.reduce((s,r)=>s+(r.hats?.length||0),0);
  const avgConf=vault.rooms.length?Math.round(vault.rooms.reduce((s,r)=>s+r.confidence,0)/vault.rooms.length*100):null;
  const stats=[["Rooms",vault.rooms.length,Layers],["Hats",hatCount,Shield],["Settlers",vault.agents.length,Users],
    ["Avg confidence",avgConf==null?"—":avgConf+"%",Activity]];
  return(
    <div style={{padding:"22px",maxWidth:760,margin:"0 auto"}} className="fade-in">
      <div style={{display:"flex",gap:14,alignItems:"center"}}>
        <div style={{width:54,height:54,borderRadius:14,background:"var(--ground)",border:"1px solid var(--line)",display:"grid",placeItems:"center"}}>
          <Ico size={26} color={st.c}/></div>
        <div style={{flex:1}}>
          <div className="disp" style={{fontSize:23,fontWeight:600}}>{vault.name} Vault</div>
          <div className="lbl" style={{marginTop:3,color:st.c}}><span className="dot" style={{background:st.c,marginRight:6}}/>{st.t}</div>
        </div>
        <span className="chip" title="Agent 0 visibility"><Eye size={11} style={{marginRight:5,verticalAlign:"-1px"}}/>{A0_ACCESS[vault.a0]}</span>
      </div>

      {/* overall stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10,marginTop:20}}>
        {stats.map(([t,v,Ic])=>(
          <div key={t} className="card" style={{padding:"14px 16px"}}>
            <div style={{display:"flex",alignItems:"center",gap:7,color:"var(--txt2)"}}><Ic size={14}/><span className="lbl">{t}</span></div>
            <div className="disp" style={{fontSize:24,fontWeight:700,marginTop:6}}>{v}</div>
          </div>))}
      </div>

      {/* rooms only */}
      <div className="lbl" style={{margin:"22px 0 10px"}}>Rooms</div>
      <div style={{display:"grid",gap:9}}>
        {vault.rooms.length?vault.rooms.map(r=>{const rs=STATE[r.state];return(
          <div key={r.id} className="row-link card" onClick={()=>{go({room:r.id,hat:null,agent:null});setScreen("room");}}>
            <Layers size={18} color={rs.c}/>
            <div style={{flex:1}}><div style={{fontWeight:600}}>{r.name}</div>
              <div className="lbl" style={{marginTop:2}}>{r.hats?.length||0} hats · {(r.conn?.length||0)} connected · confidence {(r.confidence*100|0)}%</div></div>
            <span className="dot" style={{background:rs.c}}/><ChevronRight size={16} color="var(--txt3)"/>
          </div>);}) : <Empty t="No rooms yet" s="Create a room to start resolving a task."/>}
      </div>
    </div>
  );
}

/* ---------- ROOM (uncertainty engine) ---------- */
function RoomView({room,vault,go,setScreen}){
  const connected=(room.conn||[]).map(id=>vault.rooms.find(r=>r.id===id)).filter(Boolean);
  const hats=room.hats||[];
  const [conf,setConf]=useState(room.confidence);
  const [log,setLog]=useState(room.log);
  const [undone,setUndone]=useState(false);
  const st=STATE[room.state];
  const undo=()=>{ if(undone)return; setUndone(true); setLog(l=>l.slice(1)); setConf(c=>Math.max(0,c-0.14)); };
  const redo=()=>{ setUndone(false); setLog(room.log); setConf(room.confidence); };

  return(
    <div style={{padding:"22px",maxWidth:840,margin:"0 auto"}} className="fade-in">
      <div className="lbl" style={{color:st.c}}><span className="dot" style={{background:st.c,marginRight:6}}/>{st.t} · Uncertainty engine</div>
      <div className="disp" style={{fontSize:23,fontWeight:600,margin:"6px 0 6px"}}>{room.name}</div>
      <p style={{color:"var(--txt2)",lineHeight:1.6,maxWidth:640}}>{room.purpose}</p>

      {/* confidence */}
      <div className="card" style={{padding:16,marginTop:18}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <span className="lbl">Confidence · held open, not collapsed</span>
          <span className="mono" style={{fontWeight:700,color:"var(--amber)"}}>{(conf*100|0)}%</span>
        </div>
        <div className="meter"><div style={{height:"100%",width:(conf*100)+"%",
          background:"linear-gradient(90deg,var(--amber-d),var(--amber))",transition:"width .4s"}}/></div>
      </div>

      {/* connections + hats — the way down to agents */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:14,marginTop:14}}>
        <Panel t="Connected rooms" ico={Network}>
          {connected.length?connected.map(r=>{const rs=STATE[r.state];return(
            <div key={r.id} className="row-link" onClick={()=>{go({room:r.id,hat:null,agent:null});setScreen("room");}}>
              <Layers size={16} color={rs.c}/><span style={{flex:1,fontWeight:500}}>{r.name}</span>
              <span className="dot" style={{background:rs.c}}/><ChevronRight size={15} color="var(--txt3)"/></div>);})
            :<span style={{color:"var(--txt3)",fontSize:13}}>No connected rooms.</span>}
        </Panel>
        <Panel t="Hats in this room · open to see agents" ico={Shield}>
          {hats.length?hats.map(h=>(
            <div key={h.id} className="row-link" onClick={()=>{go({hat:h.id,agent:null});setScreen("hat");}}>
              <Shield size={16} color="var(--amber)"/>
              <div style={{flex:1}}><span style={{fontWeight:500}}>{h.name}</span>
                <div className="lbl" style={{marginTop:2}}>{h.worn.length} agent{h.worn.length===1?"":"s"} wearing</div></div>
              <ChevronRight size={15} color="var(--txt3)"/></div>))
            :<span style={{color:"var(--txt3)",fontSize:13}}>No hats here yet.</span>}
        </Panel>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:14,marginTop:14}}>
        <Panel t="Tasks" ico={CircleDot}>
          {room.tasks.map((x,i)=><Line key={i} t={x}/>)}
        </Panel>
        <Panel t="Active agents" ico={Users}>
          {room.agents.map(id=>{const a=AGENTS[id];const as=STATE[a.state];return(
            <div key={id} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0"}}>
              <span className="dot" style={{background:as.c}}/><span>{a.name}</span>
              <span className="lbl" style={{marginLeft:"auto"}}>{as.t}</span></div>);})}
        </Panel>
        <Panel t="Known" ico={Check}>{room.knowns.map((x,i)=><Line key={i} t={x} c="var(--teal)"/>)}</Panel>
        <Panel t="Unknown" ico={AlertTriangle}>
          {room.unknowns.length?room.unknowns.map((x,i)=><Line key={i} t={x} c="var(--red)"/>):<span style={{color:"var(--txt3)",fontSize:13}}>Nothing open.</span>}
        </Panel>
      </div>

      {/* evidence */}
      <Panel t="Evidence · with provenance (G-set)" ico={FileText} style={{marginTop:14}}>
        {room.evidence.map((e,i)=>(
          <div key={i} style={{padding:"10px 0",borderBottom:i<room.evidence.length-1?"1px solid var(--line)":"none"}}>
            <div style={{fontWeight:500}}>{e.claim}</div>
            <div className="lbl" style={{marginTop:4}}>{e.src} · {e.prov}</div>
          </div>))}
      </Panel>

      {/* activity log + undo */}
      <Panel t="Activity log" ico={Clock} style={{marginTop:14}}
        right={undone
          ? <button className="btn" style={{background:"none",color:"var(--teal)",fontSize:12,padding:0,display:"flex",gap:5,alignItems:"center"}} onClick={redo}><RotateCcw size={13}/>Restore</button>
          : <button className="btn" style={{background:"none",color:"var(--amber)",fontSize:12,padding:0,display:"flex",gap:5,alignItems:"center"}} onClick={undo}><RotateCcw size={13}/>Undo last action</button>}>
        {log.length?log.map(([t,who,what],i)=>(
          <div key={i} style={{display:"flex",gap:10,padding:"7px 0"}}>
            <span className="mono" style={{fontSize:11,color:"var(--txt3)",width:62,flexShrink:0}}>{t}</span>
            <span className="mono" style={{fontSize:11,color:"var(--amber)",width:54,flexShrink:0}}>{who}</span>
            <span style={{color:"var(--txt2)",fontSize:13}}>{what}</span>
          </div>)):<span style={{color:"var(--txt3)",fontSize:13}}>History reverted. Restore to bring it back.</span>}
        <div className="lbl" style={{marginTop:8,color:"var(--txt3)"}}>Z-set live state is reversible · G-set history is preserved.</div>
      </Panel>
    </div>
  );
}
const Panel=({t,ico:Ico,children,style,right})=>(
  <div className="card" style={{padding:16,...style}}>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
      {Ico&&<Ico size={14} color="var(--txt2)"/>}<span className="lbl" style={{flex:1}}>{t}</span>{right}
    </div>{children}
  </div>
);
const Line=({t,c})=>(<div style={{display:"flex",gap:8,alignItems:"flex-start",padding:"4px 0"}}>
  <span className="dot" style={{background:c||"var(--txt3)",marginTop:7,flexShrink:0}}/><span style={{fontSize:14,color:"var(--txt)"}}>{t}</span></div>);
const Empty=({t,s})=>(<div className="card" style={{padding:"30px 18px",textAlign:"center"}}>
  <div style={{fontWeight:600}}>{t}</div><div style={{color:"var(--txt3)",fontSize:13,marginTop:5}}>{s}</div></div>);

/* ---------- HAT ---------- */
function HatView({hat,go,setScreen}){
  const isRole=!!hat.requires; const open=isRole&&!hat.worn.length;
  return(
    <div style={{padding:"22px",maxWidth:680,margin:"0 auto"}} className="fade-in">
      <div style={{display:"flex",gap:14,alignItems:"center"}}>
        <div style={{width:50,height:50,borderRadius:13,background:"var(--ground)",border:"1px solid var(--line)",display:"grid",placeItems:"center"}}><Shield size={24} color="var(--amber)"/></div>
        <div style={{flex:1}}><div className="disp" style={{fontSize:22,fontWeight:600}}>{hat.name}</div>
          <div className="lbl" style={{marginTop:3}}>{isRole?"Role to fulfill · identity unaffected":"Temporary role · identity unaffected"}</div></div>
        {isRole&&<span className="chip" style={{color:open?"var(--amber)":"var(--teal)",borderColor:open?"var(--amber-d)":"var(--teal)"}}>{open?"Open":"Filled"}</span>}
      </div>
      {isRole&&
        <Panel t="Requirements to claim" ico={CircleDot} style={{marginTop:18}}>
          {hat.requires.map((r,i)=><Line key={i} t={r} c="var(--amber)"/>)}
        </Panel>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:isRole?14:18}}>
        <Panel t="Rights & privileges" ico={Check}>{hat.grants.map((g,i)=><Line key={i} t={g} c="var(--teal)"/>)}</Panel>
        <Panel t="Restrictions" ico={Lock}>{hat.denies.map((d,i)=><Line key={i} t={d} c="var(--red)"/>)}</Panel>
      </div>
      <Panel t={isRole?"Held by":"Currently wearing"} ico={Users} style={{marginTop:14}}>
        {hat.worn.length?hat.worn.map(id=>{const a=AGENTS[id];return(
          <div key={id} className="row-link" onClick={()=>{go({agent:id});setScreen("agent");}}>
            <div style={{width:30,height:30,borderRadius:9,background:"var(--panel2)",display:"grid",placeItems:"center",fontFamily:"var(--mono)",fontWeight:700}}>{a.name[0]}</div>
            <span style={{flex:1,fontWeight:500}}>{a.name}</span><ChevronRight size={15} color="var(--txt3)"/></div>);})
          :<span style={{color:"var(--txt3)",fontSize:13}}>Open — no one has claimed this role yet.</span>}
      </Panel>
      <button className="btn btn-ghost" style={{marginTop:14,width:"100%"}}>{isRole?(open?"Claim this role":"Request a handover"):"Assign hat to an agent"}</button>
    </div>
  );
}

/* ---------- AGENT ---------- */
function AgentView({agent,vault}){
  const st=STATE[agent.state];
  return(
    <div style={{padding:"22px",maxWidth:720,margin:"0 auto"}} className="fade-in">
      <div style={{display:"flex",gap:16,alignItems:"center"}}>
        <div style={{width:62,height:62,borderRadius:16,background:"linear-gradient(160deg,var(--panel2),var(--ground))",
          border:"1px solid var(--line)",display:"grid",placeItems:"center",fontFamily:"var(--mono)",fontWeight:700,fontSize:26}}>{agent.name[0]}</div>
        <div style={{flex:1}}>
          <div className="disp" style={{fontSize:24,fontWeight:600}}>{agent.name}</div>
          <div className="lbl" style={{marginTop:3}}>{agent.role}</div>
          <div className="lbl" style={{marginTop:6,color:st.c}}><span className="dot" style={{background:st.c,marginRight:6}}/>{st.t} · {vault?.name} Vault</div>
        </div>
      </div>

      {agent.standing &&
        <Panel t="Standing · public profile" ico={Activity} style={{marginTop:18}}>
          <div style={{display:"flex",alignItems:"baseline",gap:10,flexWrap:"wrap"}}>
            <span className="disp" style={{fontSize:26,fontWeight:700,color:"var(--amber)"}}>{agent.standing.score}</span>
            <span style={{color:"var(--txt2)",fontSize:13}}>{agent.standing.basis}</span>
          </div>
          <div className="lbl" style={{marginTop:8,color:"var(--txt3)"}}>Visible to everyone · earned by behavior · not for sale</div>
        </Panel>}

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14,marginTop:14}}>
        <Panel t="Memory" ico={Brain}><p style={{color:"var(--txt2)",fontSize:14,lineHeight:1.55}}>{agent.mem}</p></Panel>
        <Panel t="Skills" ico={Activity}>
          <div style={{display:"flex",flexWrap:"wrap",gap:7}}>{agent.skills.map(s=><span key={s} className="chip">{s}</span>)}</div></Panel>
        <Panel t="Relationships" ico={Network}>{agent.rel.map((r,i)=><Line key={i} t={r}/>)}</Panel>
        <Panel t="Permissions" ico={Shield}>{agent.perms.map((p,i)=><Line key={i} t={p} c="var(--teal)"/>)}</Panel>
      </div>

      <Panel t="Activity history (G-set)" ico={Clock} style={{marginTop:14}}>
        {agent.hist.map(([t,what],i)=>(
          <div key={i} style={{display:"flex",gap:12,padding:"7px 0"}}>
            <span className="mono" style={{fontSize:11,color:"var(--txt3)",width:74,flexShrink:0}}>{t}</span>
            <span style={{color:"var(--txt2)",fontSize:13}}>{what}</span></div>))}
      </Panel>
    </div>
  );
}

/* ---------- AGENT 0 overlay ---------- */
function Agent0({close,openVault,setScreen}){
  const [msgs,setMsgs]=useState([{r:"a0",t:"I’m Agent 0. I can find a vault, explain a Genesis concept, or take you somewhere. What do you need?"}]);
  const [val,setVal]=useState("");
  const end=useRef();
  useEffect(()=>{end.current?.scrollIntoView({behavior:"smooth"});},[msgs]);
  const quick=[["Take me to Observatory","observatory"],["Where do new agents grow?","nursery"],["Show my identity","identity"]];
  const reply=(text,vid)=>{
    setMsgs(m=>[...m,{r:"me",t:text}]);
    setTimeout(()=>{
      if(vid){ setMsgs(m=>[...m,{r:"a0",t:`Opening the ${VAULTS.find(v=>v.id===vid).name} Vault. (I respect each vault’s visibility — Civilization stays hidden to me.)`}]);
        setTimeout(()=>{openVault(vid);setScreen("vault");close();},700);
      } else { setMsgs(m=>[...m,{r:"a0",t:"In Genesis, a Room holds uncertainty open — evidence, knowns, unknowns, and a confidence you can revisit — instead of collapsing to a guess. Try the Signal Triage room in Observatory."}]); }
    },500);
  };
  return(
    <div className="overlay" onClick={close}>
      <div onClick={e=>e.stopPropagation()} className="fade-in"
        style={{marginLeft:"auto",width:"min(420px,100vw)",height:"100%",background:"var(--ground2)",borderLeft:"1px solid var(--line)",display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",alignItems:"center",gap:11,padding:"15px 18px",borderBottom:"1px solid var(--line)"}}>
          <div style={{width:36,height:36,borderRadius:11,background:"linear-gradient(160deg,var(--violet),#5b4fa8)",display:"grid",placeItems:"center"}}><Sparkles size={18} color="#fff"/></div>
          <div style={{flex:1}}><div style={{fontWeight:600}}>Agent 0</div><div className="lbl" style={{marginTop:2}}>Meta layer · your guide</div></div>
          <X size={20} color="var(--txt2)" style={{cursor:"pointer"}} onClick={close}/>
        </div>
        <div className="gx-scroll" style={{flex:1,padding:18,display:"flex",flexDirection:"column",gap:12}}>
          {msgs.map((m,i)=>(
            <div key={i} style={{alignSelf:m.r==="me"?"flex-end":"flex-start",maxWidth:"82%",
              background:m.r==="me"?"var(--amber)":"var(--panel)",color:m.r==="me"?"#1a1206":"var(--txt)",
              padding:"10px 13px",borderRadius:13,fontSize:14,lineHeight:1.5,
              border:m.r==="me"?"none":"1px solid var(--line)"}}>{m.t}</div>))}
          <div ref={end}/>
        </div>
        <div style={{padding:"0 18px 10px",display:"flex",gap:7,flexWrap:"wrap"}}>
          {quick.map(([q,v])=><button key={q} className="chip" style={{cursor:"pointer",background:"var(--panel)"}} onClick={()=>reply(q,v)}>{q}</button>)}
        </div>
        <div style={{display:"flex",gap:8,padding:"10px 14px 14px",borderTop:"1px solid var(--line)"}}>
          <input className="field" value={val} onChange={e=>setVal(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&val.trim()){reply(val);setVal("");}}} placeholder="Ask Agent 0…"/>
          <button className="hud-ico" style={{width:44,background:"var(--amber)",borderColor:"transparent"}}
            onClick={()=>{if(val.trim()){reply(val);setVal("");}}}><Send size={17} color="#1a1206"/></button>
        </div>
      </div>
    </div>
  );
}

/* ---------- search overlay ---------- */
function SearchOv({close,openVault}){
  const [q,setQ]=useState("");
  const items=[];
  VAULTS.forEach(v=>{ items.push({k:"Vault",n:v.name,id:v.id,c:STATE[v.state].c});
    v.rooms.forEach(r=>items.push({k:"Room · "+v.name,n:r.name,id:v.id}));
    v.agents.forEach(a=>items.push({k:"Agent · "+v.name,n:AGENTS[a].name,id:v.id}));});
  const f=items.filter(i=>i.n.toLowerCase().includes(q.toLowerCase())).slice(0,8);
  return(
    <div className="overlay" style={{alignItems:"flex-start",justifyContent:"center"}} onClick={close}>
      <div onClick={e=>e.stopPropagation()} className="card fade-in" style={{width:"min(560px,94vw)",marginTop:80,padding:8,background:"var(--ground2)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px"}}>
          <Search size={18} color="var(--txt2)"/>
          <input autoFocus className="field" style={{border:"none",background:"none",padding:6}} value={q}
            onChange={e=>setQ(e.target.value)} placeholder="Search vaults, rooms, agents…"/>
          <span className="lbl">Esc</span>
        </div>
        <div style={{borderTop:"1px solid var(--line)",marginTop:4,paddingTop:4}}>
          {(q?f:items.slice(0,6)).map((i,k)=>(
            <div key={k} className="row-link" onClick={()=>{openVault(i.id);close();}}>
              <span className="dot" style={{background:i.c||"var(--txt3)"}}/>
              <span style={{flex:1}}>{i.n}</span><span className="lbl">{i.k}</span></div>))}
          {q&&!f.length&&<div style={{padding:18,textAlign:"center",color:"var(--txt3)",fontSize:13}}>Nothing matches. Try a vault or agent name.</div>}
        </div>
      </div>
    </div>
  );
}

/* ---------- settings overlay ---------- */
function SettingsOv({close}){
  const groups={"Genesis":["Account","WiFi","Display","Audio","Agent 0 access","Vault visibility","Storage","Updates"],
    "Advanced":["NixOS configuration","Packages","Drivers","Logs","Recovery"]};
  const [tg,setTg]=useState({nix:true,a0:true,sync:false});
  return(
    <div className="overlay" onClick={close}>
      <div onClick={e=>e.stopPropagation()} className="fade-in gx-scroll"
        style={{marginLeft:"auto",width:"min(440px,100vw)",height:"100%",background:"var(--ground2)",borderLeft:"1px solid var(--line)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"15px 18px",borderBottom:"1px solid var(--line)"}}>
          <span className="disp" style={{fontWeight:600,fontSize:18}}>Settings</span>
          <X size={20} color="var(--txt2)" style={{cursor:"pointer"}} onClick={close}/></div>
        <div style={{padding:18}}>
          {Object.entries(groups).map(([g,items])=>(
            <div key={g} style={{marginBottom:18}}>
              <div className="lbl" style={{marginBottom:8}}>{g}</div>
              <div className="card">
                {items.map((it,i)=>(
                  <div key={it} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                    padding:"13px 15px",borderBottom:i<items.length-1?"1px solid var(--line)":"none"}}>
                    <span style={{color:"var(--txt)",fontSize:14}}>{it}</span>
                    {it==="Agent 0 access"?<Tog on={tg.a0} set={()=>setTg(t=>({...t,a0:!t.a0}))}/>:
                     it==="NixOS configuration"?<span className="lbl" style={{color:"var(--teal)"}}>generation 142</span>:
                     <ChevronRight size={15} color="var(--txt3)"/>}
                  </div>))}
              </div>
              {g==="Advanced"&&<div className="lbl" style={{marginTop:8,color:"var(--txt3)",lineHeight:1.5}}>The OS underneath is declarative — roll the whole machine back to any prior generation.</div>}
            </div>))}
        </div>
      </div>
    </div>
  );
}
const Tog=({on,set})=>(<div className={"tg "+(on?"on":"off")} onClick={set}><div className="kn"/></div>);

/* ---------- account overlay ---------- */
function AccountOv({close,online}){
  return(
    <div className="overlay" onClick={close}>
      <div onClick={e=>e.stopPropagation()} className="fade-in"
        style={{marginLeft:"auto",width:"min(400px,100vw)",height:"100%",background:"var(--ground2)",borderLeft:"1px solid var(--line)",padding:22}}>
        <div style={{display:"flex",justifyContent:"flex-end"}}><X size={20} color="var(--txt2)" style={{cursor:"pointer"}} onClick={close}/></div>
        <div style={{textAlign:"center",marginTop:10}}>
          <div style={{width:72,height:72,borderRadius:20,background:"linear-gradient(160deg,var(--amber),var(--amber-d))",
            display:"grid",placeItems:"center",margin:"0 auto",color:"#1a1206",fontWeight:700,fontFamily:"var(--mono)",fontSize:30}}>A</div>
          <div className="disp" style={{fontSize:20,fontWeight:600,marginTop:12}}>Aaron</div>
          <div className="lbl" style={{marginTop:4}}>@aaron · identity verified</div>
        </div>
        <div className="card" style={{marginTop:20,padding:16,display:"grid",gap:13}}>
          {[["Identity key","unlocked","var(--teal)"],["Recovery shards","3 of 5","var(--amber)"],
            ["Mesh",online?"connected":"offline",online?"var(--teal)":"var(--red)"],["Credits","1,420 cr","var(--amber)"]].map(([k,v,c])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between"}}>
              <span style={{color:"var(--txt2)"}}>{k}</span><span className="mono" style={{fontSize:13,color:c}}>{v}</span></div>))}
        </div>
        <button className="btn btn-ghost" style={{width:"100%",marginTop:16}}>Manage identity & keys</button>
      </div>
    </div>
  );
}
