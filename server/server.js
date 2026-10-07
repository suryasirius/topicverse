// TopicTalk server: serves the site and replaces the claude.ai runtime with
// its own accounts, document store (SQLite) and live updates (Server-Sent Events).
// No npm dependencies: needs Node.js 22.13+ (node:sqlite).
"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const { buildPage } = require("./build");
const mail = require("./mail");

const PORT = +process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const SEED_DIR = process.env.SEED_DIR || path.join(__dirname, "..", "prototype", "seed");
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || "").toLowerCase();
const TRUST_PROXY = process.env.TRUST_PROXY === "1";
const SECURE_COOKIE = process.env.SECURE_COOKIE === "1";

fs.mkdirSync(path.join(DATA_DIR, "backups"), { recursive: true });
const sql = new DatabaseSync(path.join(DATA_DIR, "topictalk.db"));
sql.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  CREATE TABLE IF NOT EXISTS docs (col TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, updated INTEGER NOT NULL, PRIMARY KEY (col, id));
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, salt TEXT NOT NULL, hash TEXT NOT NULL, created INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, uid TEXT NOT NULL, created INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
`);
try { sql.exec("ALTER TABLE users ADD COLUMN email TEXT"); } catch { }
sql.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_email ON users (email)");
const q = {
  upsert: sql.prepare("INSERT INTO docs (col, id, data, updated) VALUES (?, ?, ?, ?) ON CONFLICT (col, id) DO UPDATE SET data = excluded.data, updated = excluded.updated"),
  del: sql.prepare("DELETE FROM docs WHERE col = ? AND id = ?"),
  all: sql.prepare("SELECT col, id, data FROM docs"),
  count: sql.prepare("SELECT COUNT(*) AS n FROM docs"),
  userByName: sql.prepare("SELECT * FROM users WHERE username = ?"),
  userById: sql.prepare("SELECT * FROM users WHERE id = ?"),
  userCount: sql.prepare("SELECT COUNT(*) AS n FROM users"),
  addUser: sql.prepare("INSERT INTO users (id, username, salt, hash, created, email) VALUES (?, ?, ?, ?, ?, ?)"),
  userByEmail: sql.prepare("SELECT * FROM users WHERE email = ?"),
  addSession: sql.prepare("INSERT INTO sessions (token, uid, created) VALUES (?, ?, ?)"),
  session: sql.prepare("SELECT uid, created FROM sessions WHERE token = ?"),
  dropSession: sql.prepare("DELETE FROM sessions WHERE token = ?"),
  oldSessions: sql.prepare("DELETE FROM sessions WHERE created < ?"),
  getMeta: sql.prepare("SELECT v FROM meta WHERE k = ?"),
  setMeta: sql.prepare("INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v"),
};

// ---------- documents in memory ----------
const COLS = ["topics", "comments", "reviews", "likes", "follows", "handles", "battles", "bvotes", "pvotes", "groups", "gmembers", "duels", "dvotes", "media", "notifs"];
const DOCS = Object.fromEntries(COLS.map(c => [c, new Map()]));
function seedIfEmpty() {
  if (q.count.get().n > 0 || !fs.existsSync(SEED_DIR)) return;
  const items = [];
  for (const col of fs.readdirSync(SEED_DIR)) {
    if (!COLS.includes(col)) continue;
    for (const f of fs.readdirSync(path.join(SEED_DIR, col))) {
      if (!f.endsWith(".json")) continue;
      items.push([col, f.slice(0, -5), JSON.parse(fs.readFileSync(path.join(SEED_DIR, col, f), "utf8"))]);
    }
  }
  // move sample timestamps so the newest sample is an hour old: live battles stay live on first start
  let newest = 0;
  for (const [, , d] of items) if (typeof d.createdAt === "number") newest = Math.max(newest, d.createdAt);
  const shift = newest ? Date.now() - 3.6e6 - newest : 0;
  const KEYS = new Set(["createdAt", "endsAt", "acceptedAt", "votingEndsAt", "joinedAt", "publicAt", "at", "resolvedAt"]);
  const move = v => {
    if (Array.isArray(v)) return v.map(move);
    if (v && typeof v === "object") { const o = {}; for (const [k, x] of Object.entries(v)) o[k] = KEYS.has(k) && typeof x === "number" ? x + shift : move(x); return o; }
    return v;
  };
  sql.exec("BEGIN");
  for (const [col, id, d] of items) q.upsert.run(col, id, JSON.stringify(move(d)), Date.now());
  sql.exec("COMMIT");
  console.log(`Seeded ${items.length} sample documents`);
}
seedIfEmpty();
for (const r of q.all.all()) if (DOCS[r.col]) DOCS[r.col].set(r.id, JSON.parse(r.data));

// ---------- accounts ----------
const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString("hex");
const newId = (p, n = 16) => p + crypto.randomBytes(n).toString("base64url");
function adminUid() { return q.getMeta.get("admin")?.v || null; }
function isAdmin(uid) { return !!uid && uid === adminUid(); }
const SESSION_DAYS = 60;
function readCookie(req, name) {
  const m = (req.headers.cookie || "").split(/;\s*/).find(c => c.startsWith(name + "="));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}
function currentUser(req) {
  const t = readCookie(req, "tt_sess"); if (!t) return null;
  const s = q.session.get(t); if (!s) return null;
  if (Date.now() - s.created > SESSION_DAYS * 864e5) { q.dropSession.run(t); return null; }
  return s.uid;
}
function setSession(res, uid) {
  const token = crypto.randomBytes(32).toString("base64url");
  q.addSession.run(token, uid, Date.now());
  res.setHeader("Set-Cookie", `tt_sess=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${SECURE_COOKIE ? "; Secure" : ""}`);
}

// ---------- rate limits ----------
const hits = new Map();
function limited(key, max, windowMs) {
  const now = Date.now(), arr = (hits.get(key) || []).filter(t => now - t < windowMs);
  arr.push(now); hits.set(key, arr); return arr.length > max;
}
setInterval(() => { const now = Date.now(); for (const [k, a] of hits) if (!a.some(t => now - t < 36e5)) hits.delete(k); }, 6e5).unref();
const ipOf = req => (TRUST_PROXY && req.headers["x-forwarded-for"]?.split(",")[0].trim()) || req.socket.remoteAddress || "?";

// ---------- visibility ----------
const role = (gid, uid) => (uid && DOCS.gmembers.get(`${gid}__${uid}`)?.role) || null;
function topicVisible(t, uid) {
  if (!t || !t.groupId || t.madePublic) return true;
  const g = DOCS.groups.get(t.groupId);
  if (!g || g.visibility !== "private") return true;
  return !!role(t.groupId, uid) || isAdmin(uid);
}
function visible(col, id, d, uid) {
  switch (col) {
    case "topics": return topicVisible(d, uid);
    case "comments": case "reviews": case "battles": case "duels": return topicVisible(DOCS.topics.get(d.topicId), uid);
    case "pvotes": return topicVisible(DOCS.topics.get(d.topicId), uid);
    case "bvotes": { const b = DOCS.battles.get(d.battleId); return !b || visible("battles", d.battleId, b, uid); }
    case "dvotes": { const x = DOCS.duels.get(d.duelId); return !x || visible("duels", d.duelId, x, uid); }
    case "media": { const c = DOCS.comments.get(d.commentId); return c ? visible("comments", d.commentId, c, uid) : d.by === uid; }
    case "notifs": return !!uid && d.to === uid;
    case "gmembers": { const g = DOCS.groups.get(d.groupId); return !g || g.visibility !== "private" || !!role(d.groupId, uid) || isAdmin(uid); }
    default: return true;
  }
}
function outDoc(col, id, d, uid) {
  // a group's invite code is only for its members
  if (col === "groups" && d.invite && !role(id, uid) && !isAdmin(uid)) { const { invite, ...rest } = d; return rest; }
  return d;
}
function snapshotFor(uid) {
  const cols = {};
  for (const col of COLS) {
    const arr = [];
    for (const [id, d] of DOCS[col]) if (visible(col, id, d, uid)) arr.push({ id, data: outDoc(col, id, d, uid) });
    cols[col] = arr;
  }
  return cols;
}

// ---------- write rules ----------
const ID_RE = /^[A-Za-z0-9_\-.~:@+]{1,200}$/;
const HANDLE_RE = /^[A-Za-z0-9_]{3,24}$/;
class Deny extends Error { constructor(code, message) { super(message); this.code = code; } }
const deny = m => { throw new Deny("permission_denied", m || "You can’t change that."); };
const bad = m => { throw new Deny("bad_request", m || "That request isn’t valid."); };
const onlyKeys = (patch, keys) => Object.keys(patch).every(k => keys.includes(k));
const suffixUid = (id, uid) => id.endsWith("__" + uid);
function mergeDeep(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object" && !Array.isArray(a[k]) ? mergeDeep(a[k], v) : v;
  return out;
}
function check(op, col, id, prev, next, patch, uid) {
  const admin = isAdmin(uid);
  if (op === "delete" && admin) return;
  const same = (field) => !prev || !next || prev[field] === next[field];
  switch (col) {
    case "topics":
      if (!prev) { if (next.authorId !== uid) deny(); if (next.groupId && !role(next.groupId, uid) && !admin) deny("Join the group first."); return; }
      if (admin || prev.authorId === uid) { if (!same("authorId")) deny(); return; }
      if (op === "update" && prev.groupId && role(prev.groupId, uid) === "admin" && onlyKeys(patch, ["madePublic", "publicAt"])) return;
      if (op === "update" && onlyKeys(patch, ["answer"]) && topicVisible(prev, uid)) return;
      deny();
    case "comments": case "battles":
      if (!prev) { if (next.authorId !== uid) deny(); if (!topicVisible(DOCS.topics.get(next.topicId), uid)) deny(); if (DOCS.topics.get(next.topicId)?.deletedAt) deny("This topic was deleted."); return; }
      if (prev.authorId !== uid && !admin) deny(); if (!same("authorId")) deny(); return;
    case "reviews":
      if ((next || prev).authorId !== uid && !admin) deny();
      if (!prev && id !== `${next.topicId}__${uid}`) bad(); if (!prev && DOCS.topics.get(next.topicId)?.deletedAt) deny("This topic was deleted."); if (!same("authorId")) deny(); return;
    case "likes": case "follows":
      if (!suffixUid(id, uid) || (next && next.userId !== uid)) deny(); return;
    case "bvotes": {
      if (!suffixUid(id, uid) || (next && next.userId !== uid)) deny();
      const b = DOCS.battles.get((next || prev).battleId); if (!b || Date.now() >= b.endsAt) deny("Voting has ended."); return;
    }
    case "pvotes": {
      if (!suffixUid(id, uid) || (next && next.userId !== uid)) deny();
      const t = DOCS.topics.get((next || prev).topicId); if (!t || t.kind !== "prediction" || t.outcome || Date.now() >= t.resolveBy) deny("Voting has closed."); return;
    }
    case "dvotes": {
      if (!suffixUid(id, uid) || (next && next.userId !== uid)) deny();
      const d = DOCS.duels.get((next || prev).duelId); if (!d) bad(); if (d.challengerId === uid || d.opponentId === uid) deny("You can’t vote in your own duel.");
      if (!d.votingEndsAt || Date.now() >= d.votingEndsAt) deny("Voting isn’t open."); return;
    }
    case "handles": {
      if (id !== uid) deny();
      if (next) {
        if (next.avatar && String(next.avatar).length > 60000) bad("That photo is too large.");
        if (next.textSize && !["s", "m", "l", "x"].includes(next.textSize)) bad();
        if (!HANDLE_RE.test(next.handle || "")) bad("Use 3–24 letters, numbers or underscores.");
        for (const [hid, h] of DOCS.handles) if (hid !== uid && (h.handle || "").toLowerCase() === next.handle.toLowerCase()) deny("That username is taken.");
        const u = q.userByName.get(next.handle); if (u && u.id !== uid) deny("That username is taken.");
      }
      return;
    }
    case "groups":
      if (!prev) { if (next.ownerId !== uid) deny(); return; }
      if (role(id, uid) !== "admin" && !admin) deny("Only group admins can do that."); if (!same("ownerId")) deny(); return;
    case "gmembers": {
      const cut = id.lastIndexOf("__"); const gid = id.slice(0, cut), mu = id.slice(cut + 2); const g = DOCS.groups.get(gid);
      if (!g) bad("That group doesn’t exist.");
      if (op === "delete") { if (mu === uid || role(gid, uid) === "admin") return; deny(); }
      if (prev) deny();
      if (mu !== uid || next.userId !== uid || next.groupId !== gid) deny();
      if (next.role === "admin") { if (g.ownerId !== uid) deny(); return; }
      if (next.role !== "member") bad();
      if (g.visibility === "private") deny("Join private groups with their invite code.");
      return;
    }
    case "duels":
      if (!prev) { if (next.challengerId !== uid || next.opponentId === uid) deny(); if (!topicVisible(DOCS.topics.get(next.topicId), uid)) deny(); return; }
      if (prev.challengerId !== uid && prev.opponentId !== uid && !admin) deny(); if (!same("challengerId") || !same("opponentId")) deny(); return;
    case "media":
      if ((next || prev).by !== uid && !admin) deny(); return;
    case "notifs":
      if (!prev) { if (next.from !== uid) deny(); return; }
      if (op === "delete") { if (prev.to !== uid) deny(); return; }
      if (prev.to !== uid || !onlyKeys(patch, ["read"])) deny(); return;
  }
  deny();
}

// ---------- live updates ----------
const clients = new Set();
function send(c, obj) { try { c.res.write(`data: ${JSON.stringify(obj)}\n\n`); } catch { } }
function broadcast(col, id, d, prev) {
  for (const c of clients) {
    if (d && visible(col, id, d, c.uid)) send(c, { t: "doc", col, id, data: outDoc(col, id, d, c.uid) });
    else if (!d || (prev && visible(col, id, prev, c.uid))) send(c, { t: "doc", col, id, data: null });
  }
}
function reloadFor(pred) { for (const c of clients) if (pred(c)) send(c, { t: "reload" }); }
setInterval(() => { for (const c of clients) { try { c.res.write(": ping\n\n"); } catch { } } }, 25000).unref();

function apply(col, id, next) {
  if (next) { q.upsert.run(col, id, JSON.stringify(next), Date.now()); DOCS[col].set(id, next); }
  else { q.del.run(col, id); DOCS[col].delete(id); }
}
// fields the page puts into links and attributes must be plain ids; images must be real image data
const DATA_URL = /^data:image\/(gif|png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
function validate(col, v, key = "", depth = 0) {
  if (depth > 12) bad("That’s nested too deeply.");
  if (typeof v === "string") {
    if ((key === "id" || /Id$/.test(key)) && v !== "" && !ID_RE.test(v)) bad("Bad id in " + key + ".");
    if (((col === "media" && key === "data") || (col === "handles" && key === "avatar" && v !== "")) && !DATA_URL.test(v)) bad("Only GIF, PNG, JPG or WebP images can be saved.");
    if (v.length > 300 * 1024) bad("That’s too large to save.");
    return;
  }
  if (Array.isArray(v)) { for (const x of v) { if (["media", "sources", "tagged", "taggedGroups"].includes(key) && typeof x === "string" && !ID_RE.test(x)) bad("Bad id in " + key + "."); validate(col, x, key, depth + 1); } return; }
  if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) validate(col, x, k, depth + 1);
}
function write(uid, { op, col, id, data }) {
  if (!COLS.includes(col)) bad("Unknown collection.");
  if (typeof id !== "string" || !ID_RE.test(id)) bad("Bad document id.");
  if (!["set", "update", "delete"].includes(op)) bad();
  if (op !== "delete" && (!data || typeof data !== "object" || Array.isArray(data))) bad();
  const size = op === "delete" ? 0 : Buffer.byteLength(JSON.stringify(data));
  if (size > (col === "media" ? 280 * 1024 : 64 * 1024)) bad("That’s too large to save.");
  if (op !== "delete") validate(col, data);
  const prev = DOCS[col].get(id) || null;
  if (op === "update" && !prev) bad("That no longer exists.");
  if (op === "delete" && !prev) return;
  const next = op === "delete" ? null : op === "update" ? mergeDeep(prev, data) : data;
  if (next && JSON.stringify(next).length > 300 * 1024) bad("That’s too large to save.");
  check(op, col, id, prev, next, op === "update" ? data : next || {}, uid);
  if (prev && next && "seed" in prev && !("seed" in next)) next.seed = prev.seed;
  apply(col, id, next);
  broadcast(col, id, next, prev);
  // membership or visibility changes: affected viewers refetch everything
  if (col === "gmembers") { const mu = id.slice(id.lastIndexOf("__") + 2); reloadFor(c => c.uid === mu); }
  if (col === "topics" && prev && next && (prev.madePublic !== next.madePublic || prev.groupId !== next.groupId)) reloadFor(() => true);
}

// ---------- email codes ----------
const CODES = new Map();   // email -> { hash, exp, tries, sent }
setInterval(() => { for (const [k, v] of CODES) if (v.exp < Date.now()) CODES.delete(k); }, 6e4).unref();
const codeHash = (email, code) => crypto.createHmac("sha256", "tt-code:" + (process.env.SMTP_USER || "")).update(email + ":" + code).digest("hex");
// one canonical form per mailbox: lower case; for Gmail also ignore dots and +tags
function normEmail(raw) {
  const e = String(raw || "").trim().toLowerCase();
  if (e.length > 120 || !/^[a-z0-9._%+\-]+@[a-z0-9\-]+(\.[a-z0-9\-]+)+$/.test(e)) return null;
  let [l, d] = e.split("@");
  if (d === "googlemail.com") d = "gmail.com";
  if (d === "gmail.com") l = l.split("+")[0].replace(/\./g, "");
  return l ? l + "@" + d : null;
}

// ---------- http ----------
let PAGE = buildPage();
function json(res, code, obj, extra = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra });
  res.end(body);
}
function readBody(req, max) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on("data", c => { n += c.length; if (n > max) { reject(new Deny("bad_request", "That’s too large.")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}); } catch { reject(new Deny("bad_request", "Bad JSON.")); } });
    req.on("error", reject);
  });
}
function meFor(uid) {
  if (!uid) return null;
  const u = q.userById.get(uid); if (!u) return null;
  return { id: uid, username: u.username, isOwner: isAdmin(uid) };
}
const STATIC = {};
for (const [p, f, t] of [["/manifest.webmanifest", "manifest.webmanifest", "application/manifest+json"], ["/sw.js", "sw.js", "text/javascript; charset=utf-8"], ["/icon-192.png", "icon-192.png", "image/png"], ["/icon-512.png", "icon-512.png", "image/png"], ["/icon-maskable.png", "icon-maskable.png", "image/png"]])
  STATIC[p] = { t, b: fs.readFileSync(path.join(__dirname, "static", f)) };
const SEC = { "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin", "X-Frame-Options": "DENY" };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const p = url.pathname;
  try {
    if (req.method === "GET" && (p === "/" || p === "/index.html")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache", ...SEC });
      return res.end(PAGE);
    }
    if (req.method === "GET" && STATIC[p]) { const f = STATIC[p]; res.writeHead(200, { "Content-Type": f.t, "Cache-Control": p === "/sw.js" ? "no-cache" : "public, max-age=86400", ...SEC }); return res.end(f.b); }
    if (p === "/healthz") return json(res, 200, { ok: true, docs: COLS.reduce((a, c) => a + DOCS[c].size, 0), clients: clients.size });
    if (!p.startsWith("/api/")) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("Not found"); }

    const uid = currentUser(req);
    if (req.method === "GET" && p === "/api/config") return json(res, 200, { emailSignup: mail.enabled() });
    if (req.method === "GET" && p === "/api/all") return json(res, 200, { me: meFor(uid), cols: snapshotFor(uid) });
    if (req.method === "GET" && p === "/api/stream") {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" });
      res.write("retry: 3000\n\n");
      const c = { res, uid }; clients.add(c);
      req.on("close", () => clients.delete(c));
      return;
    }
    if (req.method !== "POST") return json(res, 405, { error: { code: "bad_request", message: "Method not allowed." } });
    if (req.headers["x-tt"] !== "1") return json(res, 403, { error: { code: "permission_denied", message: "Missing header." } });
    const body = await readBody(req, 400 * 1024);
    const ip = ipOf(req);

    if (p === "/api/signup/code") {
      if (!mail.enabled()) return json(res, 400, { error: { code: "bad_request", message: "Email sign-up isn’t switched on for this site." } });
      const email = normEmail(body.email);
      if (!email) return json(res, 400, { error: { code: "bad_request", message: "Enter a valid email address." } });
      if (limited("code-ip:" + ip, 10, 36e5) || limited("code:" + email, 5, 36e5)) return json(res, 429, { error: { code: "resource_exhausted", message: "Too many codes requested. Try again in an hour." } });
      if (q.userByEmail.get(email)) return json(res, 409, { error: { code: "permission_denied", message: "That email already has an account. Log in instead." } });
      const prev = CODES.get(email);
      if (prev && Date.now() - prev.sent < 45e3) return json(res, 429, { error: { code: "resource_exhausted", message: "A code was just sent. Wait a few seconds before asking again." } });
      const code = String(crypto.randomInt(0, 1e6)).padStart(6, "0");
      CODES.set(email, { hash: codeHash(email, code), exp: Date.now() + 10 * 6e4, tries: 0, sent: Date.now() });
      try { await mail.send(String(body.email).trim(), "Your TopicTalk code: " + code, `Your TopicTalk verification code is ${code}\n\nIt works for 10 minutes. If you didn’t ask for it, ignore this email.`); }
      catch (e) { CODES.delete(email); console.error("mail:", e.message); return json(res, 502, { error: { code: "unavailable", message: "Couldn’t send the email. Check the address and try again." } }); }
      return json(res, 200, { ok: true });
    }
    if (p === "/api/signup") {
      if (limited("signup:" + ip, 8, 36e5)) return json(res, 429, { error: { code: "resource_exhausted", message: "Too many new accounts from here. Try again later." } });
      const username = String(body.username || "").trim(), password = String(body.password || "");
      let email = null;
      if (mail.enabled()) {
        email = normEmail(body.email);
        if (!email) return json(res, 400, { error: { code: "bad_request", message: "Enter a valid email address." } });
      }
      if (!HANDLE_RE.test(username)) return json(res, 400, { error: { code: "bad_request", message: "Usernames are 3–24 letters, numbers or underscores." } });
      if (password.length < 8) return json(res, 400, { error: { code: "bad_request", message: "Use a password of at least 8 characters." } });
      const taken = q.userByName.get(username) || [...DOCS.handles.values()].some(h => (h.handle || "").toLowerCase() === username.toLowerCase());
      if (taken) return json(res, 409, { error: { code: "permission_denied", message: "That username is taken." } });
      if (email) {
        if (q.userByEmail.get(email)) return json(res, 409, { error: { code: "permission_denied", message: "That email already has an account. Log in instead." } });
        const c = CODES.get(email), given = String(body.code || "").replace(/\D/g, "");
        if (!c || c.exp < Date.now()) return json(res, 400, { error: { code: "bad_request", message: "That code has expired. Ask for a new one." } });
        if (++c.tries > 5) { CODES.delete(email); return json(res, 429, { error: { code: "resource_exhausted", message: "Too many wrong codes. Ask for a new one." } }); }
        const a = Buffer.from(codeHash(email, given), "hex"), b = Buffer.from(c.hash, "hex");
        if (!crypto.timingSafeEqual(a, b)) return json(res, 400, { error: { code: "bad_request", message: "That code isn’t right. Check your email and try again." } });
        CODES.delete(email);
      }
      const id = newId("u_"), salt = crypto.randomBytes(16).toString("hex");
      q.addUser.run(id, username, salt, hashPw(password, salt), Date.now(), email);
      if (!adminUid() && (!ADMIN_USERNAME || ADMIN_USERNAME === username.toLowerCase())) q.setMeta.run("admin", id);
      if (ADMIN_USERNAME && ADMIN_USERNAME === username.toLowerCase()) q.setMeta.run("admin", id);
      apply("handles", id, { handle: username, bio: "", createdAt: Date.now() });
      broadcast("handles", id, DOCS.handles.get(id), null);
      setSession(res, id);
      return json(res, 200, { me: meFor(id) });
    }
    if (p === "/api/login") {
      if (limited("login:" + ip, 12, 6e5)) return json(res, 429, { error: { code: "resource_exhausted", message: "Too many tries. Wait 10 minutes and try again." } });
      const who = String(body.username || "").trim(), u = (who.includes("@") ? q.userByEmail.get(normEmail(who) || "") : null) || q.userByName.get(who);
      const ok = u && crypto.timingSafeEqual(Buffer.from(hashPw(String(body.password || ""), u.salt), "hex"), Buffer.from(u.hash, "hex"));
      if (!ok) return json(res, 401, { error: { code: "unauthenticated", message: "That username and password don’t match." } });
      setSession(res, u.id);
      return json(res, 200, { me: meFor(u.id) });
    }
    if (p === "/api/logout") {
      const t = readCookie(req, "tt_sess"); if (t) q.dropSession.run(t);
      return json(res, 200, { ok: true }, { "Set-Cookie": "tt_sess=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" });
    }
    if (!uid) return json(res, 401, { error: { code: "unauthenticated", message: "Log in to do that." } });

    if (p === "/api/write") {
      if (limited("w:" + uid, 150, 6e4)) return json(res, 429, { error: { code: "resource_exhausted", message: "Slow down a little, then try again." } });
      write(uid, body);
      return json(res, 200, { ok: true });
    }
    if (p === "/api/join") {
      if (limited("join:" + uid, 20, 6e5)) return json(res, 429, { error: { code: "resource_exhausted", message: "Too many tries. Wait a few minutes." } });
      const code = String(body.code || "").trim().toUpperCase();
      const entry = [...DOCS.groups].find(([, g]) => (g.invite || "").toUpperCase() === code);
      if (!code || !entry) return json(res, 404, { error: { code: "not_found", message: "No group has that code. Check it and try again." } });
      const [gid, g] = entry, mid = `${gid}__${uid}`;
      if (!DOCS.gmembers.has(mid)) {
        apply("gmembers", mid, { groupId: gid, userId: uid, role: "member", joinedAt: Date.now() });
        broadcast("gmembers", mid, DOCS.gmembers.get(mid), null);
        for (const [, m] of DOCS.gmembers) if (m.groupId === gid && m.role === "admin" && m.userId !== uid) {
          const nid = newId("n", 9), n = { to: m.userId, from: uid, type: "joined", groupId: gid, topicId: "", text: g.name, createdAt: Date.now(), read: false };
          apply("notifs", nid, n); broadcast("notifs", nid, n, null);
        }
        reloadFor(c => c.uid === uid);
      }
      return json(res, 200, { groupId: gid });
    }
    return json(res, 404, { error: { code: "bad_request", message: "Unknown endpoint." } });
  } catch (e) {
    if (e instanceof Deny) return json(res, e.code === "permission_denied" ? 403 : 400, { error: { code: e.code, message: e.message } });
    console.error(e);
    return json(res, 500, { error: { code: "unavailable", message: "Something went wrong on the server." } });
  }
});

// daily backup, keep the last 7
function backup() {
  try {
    const f = path.join(DATA_DIR, "backups", `topictalk-${new Date().toISOString().slice(0, 10)}.db`);
    if (!fs.existsSync(f)) sql.exec(`VACUUM INTO '${f.replace(/'/g, "''")}'`);
    const all = fs.readdirSync(path.join(DATA_DIR, "backups")).filter(x => x.endsWith(".db")).sort();
    for (const old of all.slice(0, -7)) fs.unlinkSync(path.join(DATA_DIR, "backups", old));
    q.oldSessions.run(Date.now() - SESSION_DAYS * 864e5);
  } catch (e) { console.error("backup failed", e.message); }
}
setTimeout(backup, 6e4).unref(); setInterval(backup, 6 * 36e5).unref();

server.listen(PORT, HOST, () => console.log(`TopicTalk running on http://${HOST}:${PORT}`));
process.on("SIGTERM", () => { server.close(); try { sql.close(); } catch { } process.exit(0); });
