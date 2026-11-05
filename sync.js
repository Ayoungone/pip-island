/* Pip's Learning Island: automatic progress sync across devices (Firebase Firestore).
   Each family shares one secret code; progress from every device is merged, never overwritten. */
(function(){
"use strict";
const CFG = window.PIP_FIREBASE || null;
const LS_CODE = "pip-sync-code", LS_DEV = "pip-device-id";
const ALPH = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
let code = null; try { code = localStorage.getItem(LS_CODE); } catch (e) {}
let dev = "dev"; try { dev = localStorage.getItem(LS_DEV) || ""; if (!dev) { dev = Math.random().toString(36).slice(2, 10); localStorage.setItem(LS_DEV, dev); } } catch (e) {}
const SY = { ref: null, unsub: null, writing: false, dirty: false, timer: null, status: "off", last: 0, err: "", sdk: null };

/* ---------- merging ---------- */
function canon(v){ if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]"; if (v && typeof v === "object") return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}"; return JSON.stringify(v); }
function clean(S, R){ // drop anything from before a "reset all progress"
  if (!S) return null; if (!R) return S;
  if ((S.updated || 0) < R) return { updated: S.updated, name: S.name, settings: S.settings, resetAt: R };
  const o = JSON.parse(JSON.stringify(S));
  Object.keys(o.items || {}).forEach(k => { if ((o.items[k].t || 0) < R) delete o.items[k]; });
  o.log = (o.log || []).filter(e => e.t >= R); o.sessions = (o.sessions || []).filter(e => e.t >= R);
  Object.keys(o.diag || {}).forEach(k => { if (o.diag[k].t < R) delete o.diag[k]; });
  Object.keys(o.days || {}).forEach(d => { if (new Date(d + "T23:59:59").getTime() < R) delete o.days[d]; });
  return o;
}
function mergeStates(A0, B0){
  const R = Math.max((A0 && A0.resetAt) || 0, (B0 && B0.resetAt) || 0);
  const A = clean(A0, R), B = clean(B0, R); if (!A) return B; if (!B) return A;
  const newer = (A.updated || 0) >= (B.updated || 0) ? A : B;
  const o = JSON.parse(JSON.stringify(newer));
  const keys = (x, y) => [...new Set([...Object.keys(x || {}), ...Object.keys(y || {})])];
  o.items = {}; keys(A.items, B.items).forEach(k => { const x = (A.items || {})[k], y = (B.items || {})[k];
    o.items[k] = !x ? y : !y ? x : (((x.t || 0) > (y.t || 0)) || ((x.t || 0) === (y.t || 0) && (x.a || 0) >= (y.a || 0))) ? x : y; });
  const seen = new Set();
  o.log = [...(A.log || []), ...(B.log || [])].filter(e => { const k = e.k + "@" + e.t; if (seen.has(k)) return false; seen.add(k); return true; }).sort((x, y) => x.t - y.t).slice(-400);
  o.days = {}; keys(A.days, B.days).forEach(d => { const x = (A.days || {})[d], y = (B.days || {})[d];
    if (!x || !y) { o.days[d] = x || y; return; } const big = (x.n || 0) >= (y.n || 0) ? x : y;
    o.days[d] = Object.assign({}, big, { secs: Math.max(x.secs || 0, y.secs || 0), play: Math.max(x.play || 0, y.play || 0) }); });
  const st = new Set();
  o.sessions = [...(A.sessions || []), ...(B.sessions || [])].filter(s => { if (st.has(s.t)) return false; st.add(s.t); return true; }).sort((x, y) => x.t - y.t).slice(-120);
  o.stickers = [...new Set([...(A.stickers || []), ...(B.stickers || [])])];
  o.stars = Math.max(A.stars || 0, B.stars || 0); o.padCount = Math.max(A.padCount || 0, B.padCount || 0);
  o.diag = {}; keys(A.diag, B.diag).forEach(k => { const x = (A.diag || {})[k], y = (B.diag || {})[k]; o.diag[k] = !x ? y : !y ? x : (x.t >= y.t ? x : y); });
  o.updated = Math.max(A.updated || 0, B.updated || 0); if (R) o.resetAt = R;
  return o;
}
window.pipMergeStates = mergeStates;

/* ---------- Firebase ---------- */
function loadScript(src){ return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
function loadSDK(){ if (!SY.sdk) SY.sdk = (window.firebase && window.firebase.firestore ? Promise.resolve() : loadScript("vendor/firebase-app-compat.js").then(() => loadScript("vendor/firebase-firestore-compat.js"))); return SY.sdk; }
function persistLocal(){ try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {} }
function rerender(){ try { if (current === "home") renderHome(); else if (current === "parent") renderParent(); else if (current === "stickers") renderBook(); } catch (e) {} }
function stop(){ if (SY.unsub) { try { SY.unsub(); } catch (e) {} } SY.unsub = null; SY.ref = null; clearTimeout(SY.timer); }
function start(){
  stop();
  if (!CFG) { SY.status = "nosetup"; paint(); return; }
  if (!code) { SY.status = "off"; paint(); return; }
  SY.status = "connecting"; paint();
  loadSDK().then(() => {
    if (!firebase.apps.length) firebase.initializeApp(CFG);
    SY.ref = firebase.firestore().collection("families").doc(code);
    SY.unsub = SY.ref.onSnapshot({ includeMetadataChanges: false }, snap => {
      SY.status = "synced"; SY.last = Date.now(); SY.err = "";
      if (snap.metadata && snap.metadata.hasPendingWrites) { paint(); return; }
      if (!snap.exists) { schedulePush(0); paint(); return; }
      let remote = null; try { remote = JSON.parse(snap.data().json); } catch (e) {}
      if (!remote) { paint(); return; }
      const merged = normalize(mergeStates(state, remote));
      const m = canon(merged);
      if (m !== canon(state)) { state = merged; persistLocal(); rerender(); }
      if (m !== canon(normalize(remote))) schedulePush(500);
      paint();
    }, err => { SY.status = "error"; SY.err = (err && err.code) || "unknown"; paint(); });
  }).catch(() => { SY.sdk = null; SY.status = "offline"; paint(); });
}
function schedulePush(ms){ clearTimeout(SY.timer); SY.timer = setTimeout(push, ms == null ? 2000 : ms); }
async function push(){
  if (!SY.ref) return; if (SY.writing) { SY.dirty = true; return; }
  SY.writing = true; SY.dirty = false;
  try { await SY.ref.set({ json: JSON.stringify(state), updated: state.updated || Date.now(), device: dev }); SY.status = "synced"; SY.last = Date.now(); SY.err = ""; }
  catch (e) { SY.status = "error"; SY.err = (e && e.code) || "unknown"; }
  SY.writing = false; if (SY.dirty) push(); paint();
}
window.onPipSaved = () => { if (SY.ref) schedulePush(); };
addEventListener("online", () => { if (code && SY.status !== "synced") start(); });
addEventListener("offline", () => { if (code) { SY.status = "offline"; paint(); } });

/* ---------- family code ---------- */
function newCode(){ const r = new Uint32Array(16); crypto.getRandomValues(r); let s = ""; r.forEach(n => s += ALPH[n % ALPH.length]); return "PIP-" + s.match(/.{4}/g).join("-"); }
function cleanCode(t){ const raw = String(t || "").toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/^PIP/, ""); if (raw.length !== 16 || [...raw].some(c => !ALPH.includes(c))) return null; return "PIP-" + raw.match(/.{4}/g).join("-"); }
function setCode(c){ code = c; try { if (c) localStorage.setItem(LS_CODE, c); else localStorage.removeItem(LS_CODE); } catch (e) {} start(); }

/* ---------- Grown-ups panel ---------- */
const panel = document.createElement("div"); panel.className = "panel"; panel.id = "syncPanel";
panel.innerHTML = `<h3>Sync across devices</h3><div id="syncBody" style="display:flex;flex-direction:column;gap:10px"></div>`;
const settingsPanel = [...document.querySelectorAll("#parent .panel")].find(p => /Settings/.test((p.querySelector("h3") || {}).textContent || ""));
if (settingsPanel) settingsPanel.parentNode.insertBefore(panel, settingsPanel); else document.getElementById("parent").appendChild(panel);
function ago(t){ const s = Math.round((Date.now() - t) / 1000); if (s < 45) return "just now"; const m = Math.round(s / 60); if (m < 60) return m + " min ago"; return Math.round(m / 60) + " hr ago"; }
function paint(){
  const b = document.getElementById("syncBody"); if (!b) return;
  if (SY.status === "nosetup") { b.innerHTML = `<p class="empty-msg">Sync needs its one-time database setup before it can be turned on.</p>`; return; }
  if (!code) {
    b.innerHTML = `<p style="margin:0">Keep his stars, stickers and scores the same on every device he uses. Progress from each device is combined, so nothing gets lost.</p>
      <div class="btnrow"><button class="pbtn" id="syStart">Start syncing (first device)</button><button class="pbtn ghost" id="syJoinShow">Join with a code</button></div>
      <div id="syJoin" hidden style="display:flex;flex-direction:column;gap:8px"><label for="syCode" class="note">Sync code from the first device</label>
      <input type="text" id="syCode" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="PIP-XXXX-XXXX-XXXX-XXXX" style="font:inherit;font-size:18px;padding:10px;border-radius:12px;border:2px solid #e3ddcf;letter-spacing:.05em">
      <div class="btnrow"><button class="pbtn" id="syJoin2">Join</button></div><p class="note" id="syMsg" style="margin:0"></p></div>`;
    b.querySelector("#syStart").onclick = () => setCode(newCode());
    b.querySelector("#syJoinShow").onclick = () => { const j = b.querySelector("#syJoin"); j.hidden = false; j.style.display = "flex"; b.querySelector("#syCode").focus(); };
    b.querySelector("#syJoin2").onclick = () => { const c = cleanCode(b.querySelector("#syCode").value); if (!c) { b.querySelector("#syMsg").textContent = "That code doesn't look right. It has 16 letters and numbers after PIP."; return; } setCode(c); };
    return;
  }
  const line = SY.status === "synced" ? `✅ Synced ${ago(SY.last)}`
    : SY.status === "connecting" ? "Connecting…"
    : SY.status === "offline" ? "Offline. Progress saves here and syncs when this device is back online."
    : SY.status === "error" ? `Couldn't reach the sync database (${SY.err}). Progress is still saved on this device.` : "";
  b.innerHTML = `<p style="margin:0;font-weight:700">${line}</p>
    <div class="note">Sync code for this family:</div>
    <div style="font-family:ui-monospace,Menlo,monospace;font-size:22px;font-weight:700;letter-spacing:.04em;-webkit-user-select:text;user-select:text">${code}</div>
    <p class="note" style="margin:0">To add another device: install Pip there, open Grown-ups, tap <b>Join with a code</b>, and type this code. Keep it private, since anyone with it can see his progress.</p>
    <div class="btnrow"><button class="pbtn ghost" id="syCopy">Copy code</button><button class="pbtn ghost" id="syNow">Sync now</button><button class="pbtn ghost" id="syOff">Stop syncing on this device</button></div>`;
  b.querySelector("#syCopy").onclick = async function(){ try { await navigator.clipboard.writeText(code); this.textContent = "Copied!"; } catch (e) { this.textContent = "Copy didn't work"; } };
  b.querySelector("#syNow").onclick = () => { if (SY.ref) push(); else start(); };
  b.querySelector("#syOff").onclick = () => { setCode(null); };
}
const origRenderParent = renderParent;
renderParent = function(){ origRenderParent(); paint(); };
start();
setInterval(() => { if (current === "parent") paint(); }, 30000);
})();
