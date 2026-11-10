// Help-to-profession match notifications: opt-in required, must reference a real topic, capped per recipient per day.
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");

const PORT = 5700 + Math.floor(Math.random() * 90), BASE = `http://127.0.0.1:${PORT}`;
let srv, dir, ip = 1, A, B, C;
const headers = cookie => ({ "content-type": "application/json", "x-tt": "1", "x-forwarded-for": `10.87.0.${ip++ % 250}`, ...(cookie ? { cookie } : {}) });
const post = async (u, p, body) => (await fetch(BASE + p, { method: "POST", headers: headers(u && u.cookie), body: JSON.stringify(body) })).status;
const signup = async (name, extra) => { const r = await fetch(BASE + "/api/signup", { method: "POST", headers: headers(), body: JSON.stringify({ username: name, password: "password123", agree: true, ...extra }) }); return { cookie: r.headers.get("set-cookie").split(";")[0], id: (await r.json()).me.id }; };
const w = (u, op, col, id, data) => post(u, "/api/write", { op, col, id, data });

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tt-helpmatch-"));
  srv = spawn(process.execPath, ["server.js"], { cwd: path.join(__dirname, ".."), stdio: "ignore", env: { ...process.env, PORT: String(PORT), HOST: "127.0.0.1", DATA_DIR: dir, SEED_DIR: path.join(dir, "no-seed") } });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE + "/healthz")).ok) break; } catch { } await new Promise(r => setTimeout(r, 100)); }
  A = await signup("acc_electrician"); // will opt in
  B = await signup("acc_asker");
  C = await signup("acc_bystander"); // opts in later
  assert.equal(await w(B, "set", "topics", "help1", { title: "Need an electrician", category: "Other", location: "Arakkonam", authorId: B.id, createdAt: Date.now(), kind: "question", help: true }), 200);
});
after(() => { srv?.kill(); fs.rmSync(dir, { recursive: true, force: true }); });

test("a helpmatch notif is rejected unless the recipient opted in to alerts", async () => {
  assert.equal(await w(B, "set", "notifs", "n1", { to: A.id, from: B.id, type: "helpmatch", topicId: "help1", text: "Need an electrician", createdAt: Date.now(), read: false }), 403);
  await w(A, "update", "handles", A.id, { profession: "Electrician", professionOn: true }); // professionOn but no alerts yet
  assert.equal(await w(B, "set", "notifs", "n2", { to: A.id, from: B.id, type: "helpmatch", topicId: "help1", text: "Need an electrician", createdAt: Date.now(), read: false }), 403);
  await w(A, "update", "handles", A.id, { helpAlertsOn: true }); // now opted in fully
  assert.equal(await w(B, "set", "notifs", "n3", { to: A.id, from: B.id, type: "helpmatch", topicId: "help1", text: "Need an electrician", createdAt: Date.now(), read: false }), 200);
});

test("helpAlertsOn can't be turned on without professionOn", async () => {
  assert.equal(await w(C, "update", "handles", C.id, { helpAlertsOn: true }), 400);
  assert.equal(await w(C, "update", "handles", C.id, { profession: "Plumber", professionOn: true, helpAlertsOn: true }), 200);
});

test("a helpmatch notif must point at a real topic", async () => {
  assert.equal(await w(B, "set", "notifs", "n4", { to: C.id, from: B.id, type: "helpmatch", topicId: "nope", text: "Need a plumber", createdAt: Date.now(), read: false }), 400);
});

test("a recipient gets at most 3 helpmatch notifs a day", async () => {
  for (const id of ["n5", "n6", "n7"]) assert.equal(await w(B, "set", "notifs", id, { to: C.id, from: B.id, type: "helpmatch", topicId: "help1", text: "x", createdAt: Date.now(), read: false }), 200);
  assert.equal(await w(B, "set", "notifs", "n8", { to: C.id, from: B.id, type: "helpmatch", topicId: "help1", text: "x", createdAt: Date.now(), read: false }), 403);
});
