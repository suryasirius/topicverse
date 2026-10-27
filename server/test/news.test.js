// Local news: only the admin (the first account) can post it; others can't post it or turn their topic into news.
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");

const PORT = 5200 + Math.floor(Math.random() * 90), BASE = `http://127.0.0.1:${PORT}`;
let srv, dir, ip = 1, A, B;
const headers = cookie => ({ "content-type": "application/json", "x-tt": "1", "x-forwarded-for": `10.81.0.${ip++ % 250}`, ...(cookie ? { cookie } : {}) });
const post = async (u, p, body) => (await fetch(BASE + p, { method: "POST", headers: headers(u && u.cookie), body: JSON.stringify(body) })).status;
const signup = async name => { const r = await fetch(BASE + "/api/signup", { method: "POST", headers: headers(), body: JSON.stringify({ username: name, password: "password123" }) }); return { cookie: r.headers.get("set-cookie").split(";")[0], id: (await r.json()).me.id }; };
const topic = (u, id, extra) => post(u, "/api/write", { op: "set", col: "topics", id, data: { title: "News test " + id, category: "Local", location: "Arakkonam", authorId: u.id, createdAt: Date.now(), ...extra } });

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tt-news-"));
  srv = spawn(process.execPath, ["server.js"], { cwd: path.join(__dirname, ".."), stdio: "ignore", env: { ...process.env, PORT: String(PORT), HOST: "127.0.0.1", DATA_DIR: dir, SEED_DIR: path.join(dir, "no-seed") } });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE + "/healthz")).ok) break; } catch { } await new Promise(r => setTimeout(r, 100)); }
  A = await signup("news_admin"); B = await signup("news_member");
});
after(() => { srv?.kill(); fs.rmSync(dir, { recursive: true, force: true }); });

test("the admin can post news", async () => { assert.equal(await topic(A, "nw1", { kind: "news", tags: ["news"] }), 200); });
test("a member can't post news", async () => { assert.equal(await topic(B, "nw2", { kind: "news", tags: ["news"] }), 403); });
test("a member can't turn their own topic into news", async () => {
  assert.equal(await topic(B, "nw3", { kind: "topic" }), 200);
  assert.equal(await post(B, "/api/write", { op: "update", col: "topics", id: "nw3", data: { kind: "news" } }), 403);
});
test("a member can still post a normal local topic", async () => { assert.equal(await topic(B, "nw4", { kind: "topic" }), 200); });
