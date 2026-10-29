// Play Store readiness basics: signup requires 13+/Terms agreement, Privacy Policy and Terms pages are served.
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");

const PORT = 5500 + Math.floor(Math.random() * 90), BASE = `http://127.0.0.1:${PORT}`;
let srv, dir, ip = 1;
const headers = () => ({ "content-type": "application/json", "x-tt": "1", "x-forwarded-for": `10.85.0.${ip++ % 250}` });
const signup = body => fetch(BASE + "/api/signup", { method: "POST", headers: headers(), body: JSON.stringify(body) });

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tt-policy-"));
  srv = spawn(process.execPath, ["server.js"], { cwd: path.join(__dirname, ".."), stdio: "ignore", env: { ...process.env, PORT: String(PORT), HOST: "127.0.0.1", DATA_DIR: dir, SEED_DIR: path.join(dir, "no-seed") } });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE + "/healthz")).ok) break; } catch { } await new Promise(r => setTimeout(r, 100)); }
});
after(() => { srv?.kill(); fs.rmSync(dir, { recursive: true, force: true }); });

test("signup is refused without agreeing to the 13+/Terms checkbox", async () => {
  assert.equal((await signup({ username: "nope_agree", password: "password123" })).status, 400);
  assert.equal((await signup({ username: "nope_agree", password: "password123", agree: false })).status, 400);
});
test("signup succeeds once agreed, and the acceptance is recorded", async () => {
  const r = await signup({ username: "yes_agree", password: "password123", agree: true });
  assert.equal(r.status, 200);
  const me = (await r.json()).me;
  const all = await (await fetch(BASE + "/api/all", { headers: { ...headers(), cookie: r.headers.get("set-cookie").split(";")[0] } })).json();
  const h = all.cols.handles.find(x => x.id === me.id);
  assert.ok(h.data.agreedAt > 0, "agreedAt timestamp recorded on the handle");
});
test("the Privacy Policy and Terms pages are served", async () => {
  const p = await fetch(BASE + "/privacy"); assert.equal(p.status, 200);
  assert.match(await p.text(), /Privacy Policy/);
  const t = await fetch(BASE + "/terms"); assert.equal(t.status, 200);
  const body = await t.text();
  assert.match(body, /Terms/);
  assert.match(body, /13/); // states the 13+ age requirement
});
