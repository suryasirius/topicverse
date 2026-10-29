// Shop owners: claim a shop, only the admin approves, verified owners post offers/news, followers get notified.
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");

const PORT = 5400 + Math.floor(Math.random() * 90), BASE = `http://127.0.0.1:${PORT}`;
let srv, dir, ip = 1, A, B, C;
const headers = cookie => ({ "content-type": "application/json", "x-tt": "1", "x-forwarded-for": `10.83.0.${ip++ % 250}`, ...(cookie ? { cookie } : {}) });
const post = async (u, p, body) => (await fetch(BASE + p, { method: "POST", headers: headers(u && u.cookie), body: JSON.stringify(body) })).status;
const all = async u => (await (await fetch(BASE + "/api/all", { headers: headers(u && u.cookie) })).json()).cols;
const signup = async name => { const r = await fetch(BASE + "/api/signup", { method: "POST", headers: headers(), body: JSON.stringify({ username: name, password: "password123" }) }); return { cookie: r.headers.get("set-cookie").split(";")[0], id: (await r.json()).me.id }; };
const w = (u, op, col, id, data) => post(u, "/api/write", { op, col, id, data });
const claim = (u, tid, extra) => w(u, "set", "claims", `${tid}__${u.id}`, { topicId: tid, userId: u.id, phone: "98765 43210", role: "owner", status: "pending", createdAt: Date.now(), ...extra });
const spost = (u, id, extra) => w(u, "set", "shopposts", id, { topicId: "s1", authorId: u.id, kind: "news", text: "New stock has arrived", createdAt: Date.now(), ...extra });

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tt-own-"));
  srv = spawn(process.execPath, ["server.js"], { cwd: path.join(__dirname, ".."), stdio: "ignore", env: { ...process.env, PORT: String(PORT), HOST: "127.0.0.1", DATA_DIR: dir, SEED_DIR: path.join(dir, "no-seed") } });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE + "/healthz")).ok) break; } catch { } await new Promise(r => setTimeout(r, 100)); }
  A = await signup("own_admin"); B = await signup("own_shopkeeper"); C = await signup("own_neighbour");
  for (const id of ["s1", "s2"]) assert.equal(await w(A, "set", "topics", id, { title: "Shop " + id, category: "Shopping", location: "Arakkonam", authorId: A.id, createdAt: Date.now(), kind: "place" }), 200);
  assert.equal(await w(C, "set", "topics", "q1", { title: "A question", category: "Other", location: "Arakkonam", authorId: C.id, createdAt: Date.now(), kind: "question" }), 200);
  assert.equal(await w(C, "set", "follows", `s1__${C.id}`, { userId: C.id, topicId: "s1", createdAt: Date.now() }), 200);
});
after(() => { srv?.kill(); fs.rmSync(dir, { recursive: true, force: true }); });

test("claims need a real shop, a phone number and the right id", async () => {
  assert.equal(await claim(B, "q1"), 400);
  assert.equal(await claim(B, "s1", { phone: "123" }), 400);
  assert.equal(await claim(B, "s1", { status: "approved" }), 400);
  assert.equal(await w(B, "set", "claims", `s1__${C.id}`, { topicId: "s1", userId: C.id, phone: "98765 43210", role: "owner", status: "pending", createdAt: Date.now() }), 403);
  assert.equal(await claim(B, "s1", { note: "Call after 11" }), 200);
});
test("a claim and its phone number are only seen by the claimant and the admin", async () => {
  assert.equal((await all(C)).claims.length, 0);
  assert.equal((await all(null)).claims.length, 0);
  assert.equal((await all(B)).claims.length, 1);
  assert.equal((await all(A)).claims[0].data.phone, "98765 43210");
});
test("the admin is notified of a new claim", async () => {
  assert.ok((await all(A)).notifs.some(n => n.data.type === "claim" && n.data.topicId === "s1"));
});
test("only the admin approves, and only the admin sets the owner", async () => {
  assert.equal(await w(B, "update", "claims", `s1__${B.id}`, { status: "approved" }), 403);
  assert.equal(await w(B, "update", "topics", "s1", { ownerId: B.id }), 403);
  assert.equal(await w(A, "update", "topics", "s1", { ownerId: "nobody" }), 400);
  assert.equal(await w(A, "update", "topics", "s1", { ownerId: B.id }), 200);
  assert.equal(await w(A, "update", "claims", `s1__${B.id}`, { status: "approved", decidedAt: Date.now() }), 200);
  assert.ok((await all(B)).notifs.some(n => n.data.type === "claimok"));
});
test("a shop with a verified owner can't be claimed again", async () => { assert.equal(await claim(C, "s1"), 400); });
test("the owner can edit shop details but nothing else", async () => {
  assert.equal(await w(B, "update", "topics", "s1", { shop: { phone: "98765 43210", hours: {}, items: [], types: ["repair", "electronics"], updatedAt: Date.now() } }), 200);
  assert.equal(await w(B, "update", "topics", "s1", { title: "Renamed" }), 403);
});
test("only the verified owner posts updates", async () => {
  assert.equal(await spost(C, "p0"), 403);
  assert.equal(await spost(B, "p0", { topicId: "s2" }), 403);
  assert.equal(await spost(B, "p1"), 200);
  assert.ok((await all(C)).notifs.some(n => n.data.type === "shopupd" && n.data.topicId === "s1"), "follower notified");
});
test("offers need an end date within 92 days; other kinds have none", async () => {
  assert.equal(await spost(B, "p2", { kind: "offer" }), 400);
  assert.equal(await spost(B, "p2", { kind: "offer", endsAt: Date.now() + 100 * 864e5 }), 400);
  assert.equal(await spost(B, "p2", { kind: "news", endsAt: Date.now() + 864e5 }), 400);
  assert.equal(await spost(B, "p2", { kind: "party" }), 400);
  assert.equal(await spost(B, "p2", { text: "" }), 400);
  assert.equal(await spost(B, "p2", { kind: "offer", text: "10% off LED TVs", endsAt: Date.now() + 7 * 864e5 }), 200);
});
test("updates can't be edited, and only the author or admin deletes", async () => {
  assert.equal(await w(B, "update", "shopposts", "p1", { text: "changed" }), 403);
  assert.equal(await w(C, "delete", "shopposts", "p1"), 403);
  assert.equal(await w(B, "delete", "shopposts", "p1"), 200);
});
test("at most 3 updates a day per shop", async () => {
  assert.equal(await spost(B, "p3"), 200);
  assert.equal(await spost(B, "p4"), 200);
  assert.equal(await spost(B, "p5"), 403);
});
test("the admin can remove the verified owner", async () => {
  assert.equal(await w(A, "update", "topics", "s1", { ownerId: null }), 200);
  assert.equal(await spost(B, "p6"), 403);
});
