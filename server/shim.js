// Gives the page the same window.claude.use(...) it had on claude.ai, backed by this server.
(() => {
  "use strict";
  const H = { "Content-Type": "application/json", "X-TT": "1" };
  // A phone that just woke up or switched between wifi and data often fails the first request ("Failed to fetch" / "Load failed").
  // Writes are safe to repeat (same id), so they are retried a few times before giving up with a plain message.
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const NET_MSG = "No connection right now. Nothing was lost. Tap send to try again.";
  async function api(path, body, retries = 0) {
    for (let i = 0; ; i++) {
      let r;
      try { r = await fetch(path, { method: body ? "POST" : "GET", headers: H, credentials: "same-origin", body: body ? JSON.stringify(body) : undefined }); }
      catch (e) { if (i < retries) { await wait([700, 1800, 3500][i] || 3500); continue; } throw { code: "unavailable", message: NET_MSG }; }
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) throw (j.error || { code: "unavailable", message: "The server didn’t answer (" + r.status + ")." });
      return j;
    }
  }

  let ME = null;
  const cache = {};                 // collection -> Map(id -> data)
  const subs = new Set();           // {col, filter, next}
  const col = c => (cache[c] = cache[c] || new Map());
  const snap = s => {
    const docs = [];
    for (const [id, d] of col(s.col)) if (!s.filter || s.filter(d)) docs.push({ id, exists: true, data: () => d, metadata: { fromCache: false, hasPendingWrites: false } });
    return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } };
  };
  const emit = c => { for (const s of subs) if (!c || s.col === c) try { s.next(snap(s)); } catch (e) { console.error(e); } };

  async function loadAll() {
    const j = await api("/api/all");
    ME = j.me;
    for (const k of Object.keys(cache)) cache[k].clear();
    for (const [c, arr] of Object.entries(j.cols)) { const m = col(c); for (const x of arr) m.set(x.id, x.data); }
    emit();
  }
  let es = null, dropped = false;
  function stream() {
    es = new EventSource("/api/stream");
    es.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === "doc") { if (m.data) col(m.col).set(m.id, m.data); else col(m.col).delete(m.id); emit(m.col); }
      else if (m.t === "reload") loadAll().catch(() => { });
      else if (m.t === "typing") { try { window.dispatchEvent(new CustomEvent("tt-typing", { detail: m })); } catch { } }
    };
    es.onerror = () => { dropped = true; };
    es.onopen = () => { if (dropped) { dropped = false; loadAll().catch(() => { }); } };
  }
  const ready = loadAll().then(() => { stream(); return true; }, () => false);

  // ---------- db ----------
  const merge = (a, b) => { const o = { ...a }; for (const [k, v] of Object.entries(b)) o[k] = v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object" && !Array.isArray(a[k]) ? merge(a[k], v) : v; return o; };
  async function write(op, c, id, data) {
    const m = col(c), prev = m.get(id);
    if (op === "update" && !prev) throw { code: "bad_request", message: "That no longer exists." };
    const next = op === "delete" ? undefined : op === "update" ? merge(prev, data) : data;
    if (next === undefined) m.delete(id); else m.set(id, next);
    emit(c);
    try { await api("/api/write", { op, col: c, id, data }, 3); }
    catch (e) {
      if (prev === undefined) m.delete(id); else m.set(id, prev);
      emit(c);
      if (e.code === "unauthenticated") openLogin();
      throw e;
    }
  }
  const docRef = (c, id) => ({
    id, path: c + "/" + id,
    get: async () => { await ready; const d = col(c).get(id); return { id, exists: !!d, data: () => d, metadata: {} }; },
    set: d => write("set", c, id, JSON.parse(JSON.stringify(d))),
    update: d => write("update", c, id, JSON.parse(JSON.stringify(d))),
    delete: () => write("delete", c, id),
    onSnapshot(next) { return colRef(c).where("__id", "==", id).onSnapshot(s => next(s.docs[0] || { id, exists: false, data: () => undefined, metadata: {} })); },
    collection() { throw new Error("Subcollections aren’t used by TopicTalk"); },
  });
  const OPS = { "==": (a, b) => a === b, "!=": (a, b) => a !== b, "<": (a, b) => a < b, "<=": (a, b) => a <= b, ">": (a, b) => a > b, ">=": (a, b) => a >= b, "in": (a, b) => b.includes(a), "array-contains": (a, b) => Array.isArray(a) && a.includes(b) };
  function colRef(c, filters = []) {
    const filter = filters.length ? d => filters.every(([f, op, v]) => OPS[op](f === "__id" ? undefined : d[f], v)) : null;
    return {
      path: c,
      where: (f, op, v) => colRef(c, [...filters, [f, op, v]]),
      orderBy() { return this; }, limit() { return this; },
      doc: id => docRef(c, id || "x" + Date.now().toString(36) + Math.random().toString(36).slice(2, 9)),
      add: async d => { const r = docRef(c, "x" + Date.now().toString(36) + Math.random().toString(36).slice(2, 9)); await r.set(d); return r; },
      get: async () => { await ready; return snap({ col: c, filter }); },
      onSnapshot(next) {
        const s = { col: c, filter, next }; subs.add(s);
        ready.then(ok => { if (ok && subs.has(s)) next(snap(s)); });
        return () => subs.delete(s);
      },
    };
  }
  const db = { collection: c => colRef(c), doc: p => { const [c, id] = p.split("/"); return docRef(c, id); } };

  // ---------- user ----------
  const handleOf = id => col("handles").get(id)?.handle || "";
  const user = {
    id: async () => (await ready, ME?.id || null),
    isOwner: async () => (await ready, !!ME?.isOwner),
    canEdit: async () => (await ready, !!ME?.isOwner),
    can: async () => (await ready, ME ? true : null),
    me: async () => (await ready, { id: ME?.id || null, name: ME?.username || "", avatarUrl: "", color: "#1F9D63", email: null, isOwner: !!ME?.isOwner, canEdit: !!ME?.isOwner }),
    name: async () => (await ready, ME?.username || ""),
    profiles: async ids => Object.fromEntries([].concat(ids).map(id => [id, { id, name: handleOf(id), avatarUrl: "", color: "#1F9D63", email: null, isMe: id === ME?.id, guest: false }])),
    search: async () => [],
  };

  // ---------- downloads: a normal browser download on our own site ----------
  const downloads = {
    save: async ({ filename, data }) => {
      const blob = data instanceof Blob ? data : new Blob([data]);
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; document.body.append(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      return { status: "saved" };
    },
  };

  window.claude = { use: async name => {
    const ok = await ready;
    if (name === "db") return ok ? db : null;
    if (name === "user") return ok ? user : null;
    if (name === "downloads") return downloads;
    return null;   // sample (Claude) is off on this server
  } };

  // ---------- log in / sign up ----------
  let box = null;
  function openLogin(mode) {
    if (ME) return;
    if (!box) {
      box = document.createElement("div");
      box.className = "tt-auth";
      box.innerHTML = `<style>
        .tt-auth{position:fixed;inset:0;z-index:90;background:rgba(8,14,12,.45);display:grid;place-items:center;padding:16px}
        .tt-auth form{width:min(400px,100%);background:var(--surface,#fff);color:var(--ink,#12201B);border-radius:18px;padding:24px;display:grid;gap:12px;box-shadow:0 20px 60px rgba(0,0,0,.25);font-family:var(--f-body,system-ui,sans-serif)}
        .tt-auth h2{margin:0;font-family:var(--f-display,system-ui,sans-serif);font-size:24px}
        .tt-auth p{margin:0;color:var(--muted,#66756F);font-size:14px}
        .tt-auth label{display:grid;gap:5px;font-size:12px;font-weight:600;color:var(--muted,#66756F);letter-spacing:.04em}
        .tt-auth input{height:44px;border-radius:12px;border:1px solid var(--line,#E1E8E4);background:var(--surface,#fff);color:inherit;padding:0 14px;font-size:16px;outline:none}
        .tt-auth input:focus{border-color:var(--brand,#1F9D63);box-shadow:0 0 0 4px rgba(31,157,99,.14)}
        .tt-auth [hidden]{display:none!important}
        .tt-auth .row{display:flex;gap:8px;justify-content:flex-end;align-items:center}
        .tt-auth .err{color:var(--danger,#B4412F);font-size:13px;min-height:18px}
        .tt-auth .switch{background:none;border:0;color:var(--brand-deep,#0E7045);font-weight:600;cursor:pointer;padding:0;font-size:14px}
      </style>
      <form novalidate>
        <h2 id="tt-title">Log in</h2>
        <p id="tt-sub">Welcome back to TopicTalk.</p>
        <label id="tt-emw" hidden>Email<input id="tt-email" type="email" autocomplete="email" maxlength="120" spellcheck="false" autocapitalize="off" placeholder="you@gmail.com"></label>
        <label id="tt-cdw" hidden>6-digit code from your email<input id="tt-code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="123456"></label>
        <label id="tt-unw">Username<input id="tt-user" autocomplete="username" maxlength="24" spellcheck="false" autocapitalize="off"></label>
        <label id="tt-pww">Password<input id="tt-pass" type="password" autocomplete="current-password" maxlength="200"></label>
        <div id="tt-actw" hidden style="display:grid;gap:5px;font-size:12px;font-weight:600;color:var(--muted,#66756F);letter-spacing:.04em">Account type
          <div class="tt-acseg" style="display:flex;gap:6px" role="group" aria-label="Account type">
            <button type="button" class="tt-acbtn on" data-tt-acc="personal" style="flex:1;height:38px;border-radius:10px;border:1px solid var(--line,#E1E8E4);background:var(--brand,#1F9D63);color:#fff;font-weight:700;font-size:13px;cursor:pointer">Personal</button>
            <button type="button" class="tt-acbtn" data-tt-acc="business" style="flex:1;height:38px;border-radius:10px;border:1px solid var(--line,#E1E8E4);background:none;color:inherit;font-weight:700;font-size:13px;cursor:pointer">Business / Shop owner</button>
          </div>
          <span id="tt-acsub" style="font-weight:400;letter-spacing:0;font-size:12.5px"></span>
        </div>
        <label id="tt-agw" hidden style="display:flex;flex-direction:row;align-items:flex-start;gap:8px;font-weight:400;letter-spacing:0;color:inherit;font-size:13px"><input id="tt-agree" type="checkbox" style="width:16px;height:16px;flex:none;margin-top:2px"> <span>I'm 13 or older and agree to the <a href="/terms" target="_blank" rel="noopener">Terms &amp; Community Guidelines</a> and <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a>.</span></label>
        <div class="err" id="tt-err" role="alert"></div>
        <p id="tt-forgot" hidden><button type="button" class="switch" data-tt="forgot">Forgot password?</button></p>
        <div class="row"><button type="button" class="btn" data-tt="close">Cancel</button><button type="submit" class="btn pri" id="tt-go">Log in</button></div>
        <p id="tt-alt">New here? <button type="button" class="switch" data-tt="swap">Create an account</button></p>
      </form>`;
      document.body.append(box);
      box.addEventListener("click", e => { if (e.target === box || e.target.closest("[data-tt=close]")) box.hidden = true; if (e.target.closest("[data-tt=swap]")) setMode(box.dataset.mode === "login" ? "signup" : "login"); if (e.target.closest("[data-tt=forgot]")) setMode("reset"); if (e.target.closest("[data-tt=back]")) setMode("login");
        const ab = e.target.closest("[data-tt-acc]"); if (ab) { box.dataset.acc = ab.dataset.ttAcc; box.querySelectorAll(".tt-acbtn").forEach(b => { const on = b === ab; b.classList.toggle("on", on); b.style.background = on ? "var(--brand,#1F9D63)" : "none"; b.style.color = on ? "#fff" : "inherit"; }); box.querySelector("#tt-acsub").textContent = ab.dataset.ttAcc === "business" ? "You'll be able to add or claim your shop right after signing up." : "For everyday browsing, reviews and discussion."; } });
      box.querySelector("form").addEventListener("submit", async e => {
        e.preventDefault();
        const err = box.querySelector("#tt-err"), go = box.querySelector("#tt-go");
        err.textContent = ""; go.disabled = true;
        try {
          const g = id => box.querySelector(id).value.trim();
          if (box.dataset.mode === "reset") {
            if (box.dataset.step !== "code") { await api("/api/reset/code", { email: g("#tt-email") }); setStep("code"); go.disabled = false; return; }
            await api("/api/reset", { email: g("#tt-email"), code: g("#tt-code"), password: box.querySelector("#tt-pass").value });
            location.reload(); return;
          }
          if (box.dataset.mode === "signup" && EMAIL_ON && box.dataset.step !== "code") {
            await api("/api/signup/code", { email: g("#tt-email") });
            setStep("code"); go.disabled = false; return;
          }
          const body = { username: g("#tt-user"), password: box.querySelector("#tt-pass").value };
          if (box.dataset.mode === "signup" && EMAIL_ON) { body.email = g("#tt-email"); body.code = g("#tt-code"); }
          if (box.dataset.mode === "signup") {
            if (!box.querySelector("#tt-agree").checked) { err.textContent = "Please confirm you’re 13+ and agree to the Terms to continue."; go.disabled = false; return; }
            body.agree = true;
            body.accountType = box.dataset.acc === "business" ? "business" : "personal";
          }
          await api(box.dataset.mode === "signup" ? "/api/signup" : "/api/login", body);
          if (box.dataset.mode === "signup" && body.accountType === "business") { try { sessionStorage.setItem("tt-biz-new", "1"); } catch { } }
          location.reload();
        } catch (ex) { err.textContent = ex.message || "Couldn’t log in. Try again."; go.disabled = false; }
      });
      document.addEventListener("keydown", e => { if (e.key === "Escape" && box && !box.hidden) box.hidden = true; });
    }
    setMode(mode || "login"); box.hidden = false;
    setTimeout(() => box.querySelector(EMAIL_ON && box.dataset.mode !== "login" ? "#tt-email" : "#tt-user").focus(), 30);
  }
  let EMAIL_ON = false;
  fetch("/api/config").then(r => r.json()).then(j => { EMAIL_ON = !!j.emailSignup; if (box && !box.hidden) setMode(box.dataset.mode); }).catch(() => { });
  function setStep(st) {
    box.dataset.step = st; const m = box.dataset.mode, rs = m === "reset", s = (m === "signup" && EMAIL_ON) || rs, code = s && st === "code";
    const q = id => box.querySelector(id);
    q("#tt-emw").hidden = !s || code; q("#tt-cdw").hidden = !code;
    q("#tt-unw").hidden = rs || (s && !code); q("#tt-pww").hidden = s && !code;
    q("#tt-agw").hidden = !(m === "signup" && (!s || code)); if (!q("#tt-agw").hidden) q("#tt-agree").checked = false;
    q("#tt-actw").hidden = !(m === "signup" && (!s || code));
    if (!q("#tt-actw").hidden && box.dataset.acc !== "business") box.querySelector('[data-tt-acc="personal"]').click();
    q("#tt-go").textContent = rs ? (code ? "Reset password" : "Send code") : m !== "signup" ? "Log in" : !s ? "Create account" : code ? "Create account" : "Send code";
    q("#tt-pass").autocomplete = (m === "signup" || rs) ? "new-password" : "current-password";
    q("#tt-pww").firstChild.textContent = rs ? "New password (8+ characters)" : "Password";
    if (rs) q("#tt-sub").textContent = code ? "We emailed a 6-digit code to " + q("#tt-email").value.trim() + " if it has an account. It works for 10 minutes. Enter it with a new password." : "Enter the email you signed up with and we’ll send you a code.";
    else if (s) q("#tt-sub").textContent = code ? "We emailed a 6-digit code to " + q("#tt-email").value.trim() + ". It works for 10 minutes. Then pick a username and password (8+ characters)." : "Enter your email and we’ll send you a code to confirm it.";
    q("#tt-forgot").hidden = !(m === "login" && EMAIL_ON);
    if (code) setTimeout(() => q("#tt-code").focus(), 30);
  }
  function setMode(m) {
    box.dataset.mode = m; const s = m === "signup", rs = m === "reset";
    box.querySelector("#tt-title").textContent = rs ? "Reset your password" : s ? "Create your account" : "Log in";
    box.querySelector("#tt-sub").textContent = s ? "Pick a username people will see on your posts. Passwords need 8 or more characters." : "Welcome back to TopicTalk.";
    box.querySelector("#tt-user").placeholder = s ? "" : (EMAIL_ON ? "Username or email" : "");
    box.querySelector("#tt-user").maxLength = s ? 24 : 120;
    box.querySelector("#tt-alt").innerHTML = rs ? `Remembered it? <button type="button" class="switch" data-tt="back">Log in</button>` : s ? `Have an account? <button type="button" class="switch" data-tt="swap">Log in</button>` : `New here? <button type="button" class="switch" data-tt="swap">Create an account</button>`;
    box.querySelector("#tt-err").textContent = "";
    setStep("email");
  }
  window.ttLogin = () => openLogin();
  window.ttLogout = async () => { try { const reg = await navigator.serviceWorker?.getRegistration(); const sub = reg && await reg.pushManager.getSubscription(); if (sub) { await api("/api/push/unsubscribe", { endpoint: sub.endpoint }); await sub.unsubscribe(); } } catch { } try { await api("/api/logout", {}); } catch { } location.reload(); };
  window.ttJoin = async code => { const j = await api("/api/join", { code }); await loadAll(); return j.groupId; };
  document.addEventListener("click", e => {
    if (e.target.closest("[data-act=ttLogin]")) { e.preventDefault(); openLogin(); }
    else if (e.target.closest("[data-act=ttLogout]")) { e.preventDefault(); window.ttLogout(); }
    else if (!ME && e.target.closest("#meLink")) { e.preventDefault(); openLogin(); }
  }, true);
})();
