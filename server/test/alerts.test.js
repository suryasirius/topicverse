// Notification switches: all on by default, saved per person, bad input refused. Starts a real server on a throwaway data folder.
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");

const PORT = 5100 + Math.floor(Math.random() * 90), BASE = `http://127.0.0.1:${PORT}`;
let srv, dir, ip = 1, A;
const headers = cookie => ({ "content-type": "application/json", "x-tt": "1", "x-forwarded-for": `10.80.0.${ip++ % 250}`, ...(cookie ? { cookie } : {}) });
const post = async (u, p, body) => (await fetch(BASE + p, { method: "POST", headers: headers(u && u.cookie), body: JSON.stringify(body) })).status;

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tt-alerts-"));
  srv = spawn(process.execPath, ["server.js"], { cwd: path.join(__dirname, ".."), stdio: "ignore", env: { ...process.env, PORT: String(PORT), HOST: "127.0.0.1", DATA_DIR: dir, SEED_DIR: path.join(dir, "no-seed") } });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE + "/healthz")).ok) break; } catch { } await new Promise(r => setTimeout(r, 100)); }
  const r = await fetch(BASE + "/api/signup", { method: "POST", headers: headers(), body: JSON.stringify({ username: "alert_tester", password: "password123" }) });
  A = { cookie: r.headers.get("set-cookie").split(";")[0], id: (await r.json()).me.id };
});
after(() => { srv?.kill(); fs.rmSync(dir, { recursive: true, force: true }); });

test("saving switches needs a login", async () => { assert.equal(await post(null, "/api/push/prefs", { off: [] }), 401); });
test("a list of switched-off categories is saved, an empty list turns everything back on", async () => {
  assert.equal(await post(A, "/api/push/prefs", { off: ["like", "group"] }), 200);
  assert.equal(await post(A, "/api/push/prefs", { off: [] }), 200);
});
test("bad input is refused", async () => {
  assert.equal(await post(A, "/api/push/prefs", { off: "like" }), 400);
  assert.equal(await post(A, "/api/push/prefs", {}), 400);
  assert.equal(await post(A, "/api/push/prefs", { off: new Array(50).fill("like") }), 400);
});
