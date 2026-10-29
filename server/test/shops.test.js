// Shop details: plain checked fields only, only the lister (or admin) edits them, questions can point at a real shop, "wrong details" reports work.
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");

const PORT = 5300 + Math.floor(Math.random() * 90), BASE = `http://127.0.0.1:${PORT}`;
let srv, dir, ip = 1, A, B, C;
const headers = cookie => ({ "content-type": "application/json", "x-tt": "1", "x-forwarded-for": `10.82.0.${ip++ % 250}`, ...(cookie ? { cookie } : {}) });
const post = async (u, p, body) => (await fetch(BASE + p, { method: "POST", headers: headers(u && u.cookie), body: JSON.stringify(body) })).status;
const signup = async name => { const r = await fetch(BASE + "/api/signup", { method: "POST", headers: headers(), body: JSON.stringify({ username: name, password: "password123", agree: true }) }); return { cookie: r.headers.get("set-cookie").split(";")[0], id: (await r.json()).me.id }; };
const topic = (u, id, extra) => post(u, "/api/write", { op: "set", col: "topics", id, data: { title: "Shop " + id, category: "Food", location: "Arakkonam", authorId: u.id, createdAt: Date.now(), kind: "place", ...extra } });
const upd = (u, id, data) => post(u, "/api/write", { op: "update", col: "topics", id, data });
const good = { address: "12, Bazaar St", phone: "98765 43210", whatsapp: true, delivery: false, hours: { 0: "closed", 1: "09:00-21:00", 2: "22:00-02:00" }, items: [{ n: "Dosa", p: "₹90" }, { n: "Coffee" }], updatedAt: Date.now() };

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tt-shops-"));
  srv = spawn(process.execPath, ["server.js"], { cwd: path.join(__dirname, ".."), stdio: "ignore", env: { ...process.env, PORT: String(PORT), HOST: "127.0.0.1", DATA_DIR: dir, SEED_DIR: path.join(dir, "no-seed") } });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE + "/healthz")).ok) break; } catch { } await new Promise(r => setTimeout(r, 100)); }
  A = await signup("shop_admin"); B = await signup("shop_lister"); C = await signup("shop_other");
  assert.equal(await topic(B, "sp1", {}), 200);
});
after(() => { srv?.kill(); fs.rmSync(dir, { recursive: true, force: true }); });

test("the lister can add valid shop details", async () => { assert.equal(await upd(B, "sp1", { shop: good }), 200); });
test("someone else can't edit the shop details", async () => { assert.equal(await upd(C, "sp1", { shop: { ...good, phone: "90000 00000" } }), 403); });
test("the admin can fix shop details", async () => { assert.equal(await upd(A, "sp1", { shop: { ...good, address: "14, Bazaar St" } }), 200); });
test("bad shop details are refused", async () => {
  for (const shop of [{ ...good, phone: "call me" }, { ...good, hours: { 1: "9am-9pm" } }, { ...good, hours: { 8: "09:00-21:00" } }, { ...good, items: [{ n: "" }] }, { ...good, items: new Array(41).fill({ n: "x" }) }, { ...good, owner: "me" }, { ...good, address: "x".repeat(201) }, "text"])
    assert.equal(await upd(B, "sp1", { shop }), 400, JSON.stringify(shop).slice(0, 60));
});
test("shop types: up to 3 known types", async () => {
  assert.equal(await upd(B, "sp1", { shop: { ...good, types: ["electronics", "mobile"] } }), 200);
  assert.equal(await upd(B, "sp1", { shop: { ...good, types: ["electronics", "mobile", "computer", "hardware"] } }), 400);
  assert.equal(await upd(B, "sp1", { shop: { ...good, types: ["spaceships"] } }), 400);
});
test("shop details only go on places", async () => { assert.equal(await topic(B, "sp2", { kind: "topic", shop: good }), 400); });
test("a question can point at a real shop, not at anything else", async () => {
  assert.equal(await topic(C, "q1", { kind: "question", about: "sp1" }), 200);
  assert.equal(await topic(C, "q2", { kind: "question", about: "nope" }), 400);
  assert.equal(await topic(C, "q3", { kind: "question", about: "q1" }), 400);
});
test("anyone can report wrong shop details once", async () => {
  const id = `${C.id}__topic__sp1`;
  assert.equal(await post(C, "/api/write", { op: "set", col: "reports", id, data: { reporterId: C.id, type: "topic", targetId: "sp1", reason: "wronginfo", note: "", createdAt: Date.now(), status: "open" } }), 200);
});
