// Account type at signup, profession/interests fields, and direct "askhelp"/"playcall" notifications.
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");

const PORT = 5600 + Math.floor(Math.random() * 90), BASE = `http://127.0.0.1:${PORT}`;
let srv, dir, ip = 1, A, B, C;
const headers = cookie => ({ "content-type": "application/json", "x-tt": "1", "x-forwarded-for": `10.86.0.${ip++ % 250}`, ...(cookie ? { cookie } : {}) });
const post = async (u, p, body) => (await fetch(BASE + p, { method: "POST", headers: headers(u && u.cookie), body: JSON.stringify(body) })).status;
const postJ = async (u, p, body) => { const r = await fetch(BASE + p, { method: "POST", headers: headers(u && u.cookie), body: JSON.stringify(body) }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const all = async u => (await (await fetch(BASE + "/api/all", { headers: headers(u && u.cookie) })).json()).cols;
const signup = async (name, extra) => { const r = await fetch(BASE + "/api/signup", { method: "POST", headers: headers(), body: JSON.stringify({ username: name, password: "password123", agree: true, ...extra }) }); return { cookie: r.headers.get("set-cookie").split(";")[0], id: (await r.json()).me.id }; };
const w = (u, op, col, id, data) => post(u, "/api/write", { op, col, id, data });

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tt-profile2-"));
  srv = spawn(process.execPath, ["server.js"], { cwd: path.join(__dirname, ".."), stdio: "ignore", env: { ...process.env, PORT: String(PORT), HOST: "127.0.0.1", DATA_DIR: dir, SEED_DIR: path.join(dir, "no-seed") } });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE + "/healthz")).ok) break; } catch { } await new Promise(r => setTimeout(r, 100)); }
  A = await signup("acc_personal");
  B = await signup("acc_business", { accountType: "business" });
  C = await signup("acc_third");
});
after(() => { srv?.kill(); fs.rmSync(dir, { recursive: true, force: true }); });

test("accountType is recorded at signup, defaulting to personal", async () => {
  const ha = (await all(A)).handles.find(x => x.id === A.id);
  const hb = (await all(B)).handles.find(x => x.id === B.id);
  assert.equal(ha.data.accountType, "personal");
  assert.equal(hb.data.accountType, "business");
});
test("profession and interests can be set within limits", async () => {
  assert.equal(await w(A, "update", "handles", A.id, { profession: "Teacher", professionOn: true }), 200);
  assert.equal(await w(A, "update", "handles", A.id, { profession: "x".repeat(31) }), 400);
  assert.equal(await w(A, "update", "handles", A.id, { interests: ["cricket", "chess"], interestsOn: true }), 200);
  assert.equal(await w(A, "update", "handles", A.id, { interests: ["a", "b", "c", "d", "e", "f"] }), 400);
  assert.equal(await w(A, "update", "handles", A.id, { interests: ["x".repeat(25)] }), 400);
  assert.equal(await w(A, "update", "handles", A.id, { mutedInterests: ["cricket"] }), 200);
});
test("someone else can't set your profession", async () => {
  assert.equal(await w(C, "update", "handles", A.id, { profession: "Hacker" }), 403);
});
test("asking a listed person for help creates a notification, with a block check", async () => {
  const id = `n_ask_${Date.now()}`;
  assert.equal(await w(C, "set", "notifs", id, { to: A.id, from: C.id, type: "askhelp", text: "Need help with my pipes", createdAt: Date.now(), read: false }), 200);
  const notifs = (await all(A)).notifs;
  assert.ok(notifs.some(n => n.id === id && n.data.type === "askhelp" && n.data.from === C.id));
  // too long a message is refused
  assert.equal(await w(C, "set", "notifs", "n_long", { to: A.id, from: C.id, type: "askhelp", text: "x".repeat(241), createdAt: Date.now(), read: false }), 400);
  // can't forge the sender
  assert.equal(await w(C, "set", "notifs", "n_forge", { to: A.id, from: A.id, type: "askhelp", text: "hi", createdAt: Date.now(), read: false }), 403);
  // blocked: B blocks C, so an ask from C to B is quietly dropped (consistent with how blocked notifications already behave)
  assert.equal(await w(B, "set", "blocks", `${B.id}__${C.id}`, { blockerId: B.id, blockedId: C.id, createdAt: Date.now() }), 200);
  assert.equal(await w(C, "set", "notifs", "n_blocked", { to: B.id, from: C.id, type: "askhelp", text: "hi", createdAt: Date.now(), read: false }), 200);
  assert.ok(!(await all(B)).notifs.some(n => n.id === "n_blocked"), "the blocked ask was never actually written");
});
test("other notification types can't be forged by a client", async () => {
  assert.equal(await w(C, "set", "notifs", "n_fake_like", { to: A.id, from: C.id, type: "like", createdAt: Date.now(), read: false }), 403);
});
test("a player call-out invite needs a real topic", async () => {
  assert.equal(await w(A, "set", "topics", "turf1", { title: "Need 4 for cricket Saturday", category: "Sports", location: "Arakkonam", authorId: A.id, kind: "question", createdAt: Date.now() }), 200);
  assert.equal(await w(A, "set", "notifs", "n_play1", { to: C.id, from: A.id, type: "playcall", topicId: "turf1", text: "Join us Saturday 6pm", createdAt: Date.now(), read: false }), 200);
  assert.equal(await w(A, "set", "notifs", "n_play2", { to: C.id, from: A.id, type: "playcall", topicId: "nope", text: "hi", createdAt: Date.now(), read: false }), 400);
});
