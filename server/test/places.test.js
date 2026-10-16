// Place pins: only a valid lat/lng is stored, and the short-link helper only follows Google Maps links. Starts a real server on a throwaway data folder.
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");

const PORT = 5000 + Math.floor(Math.random() * 90), BASE = `http://127.0.0.1:${PORT}`;
let srv, dir, ip = 1, A;
const headers = cookie => ({ "content-type": "application/json", "x-tt": "1", "x-forwarded-for": `10.79.0.${ip++ % 250}`, ...(cookie ? { cookie } : {}) });
const post = async (u, p, body) => (await fetch(BASE + p, { method: "POST", headers: headers(u && u.cookie), body: JSON.stringify(body) })).status;
const place = (id, extra) => post(A, "/api/write", { op: "set", col: "topics", id, data: { title: "Pin test " + id, kind: "place", category: "Food", location: "Arakkonam", authorId: A.id, createdAt: Date.now(), ...extra } });

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tt-places-"));
  srv = spawn(process.execPath, ["server.js"], { cwd: path.join(__dirname, ".."), stdio: "ignore", env: { ...process.env, PORT: String(PORT), HOST: "127.0.0.1", DATA_DIR: dir, SEED_DIR: path.join(dir, "no-seed") } });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE + "/healthz")).ok) break; } catch { } await new Promise(r => setTimeout(r, 100)); }
  const r = await fetch(BASE + "/api/signup", { method: "POST", headers: headers(), body: JSON.stringify({ username: "pin_tester", password: "password123" }) });
  A = { cookie: r.headers.get("set-cookie").split(";")[0], id: (await r.json()).me.id };
});
after(() => { srv?.kill(); fs.rmSync(dir, { recursive: true, force: true }); });

test("a place can be saved with a pin, or without one", async () => {
  assert.equal(await place("tp1", { geo: { lat: 13.081542, lng: 79.665812 } }), 200);
  assert.equal(await place("tp2", {}), 200);
});
test("a bad pin is refused", async () => {
  assert.equal(await place("tp3", { geo: { lat: 95, lng: 79 } }), 400);
  assert.equal(await place("tp4", { geo: { lat: "13", lng: 79 } }), 400);
  assert.equal(await place("tp5", { geo: { lat: 13, lng: 79, name: "Google data" } }), 400, "nothing but the two numbers");
  assert.equal(await place("tp6", { geo: "13,79" }), 400);
});
test("the short-link helper needs a login", async () => {
  assert.equal(await post(null, "/api/maps-expand", { url: "https://maps.app.goo.gl/abc" }), 401);
});
test("the short-link helper only takes Google Maps short links", async () => {
  for (const url of ["https://example.com/x", "http://maps.app.goo.gl/abc", "https://goo.gl/other", "https://127.0.0.1/", "not a link", "https://www.google.com/maps/@13,79,15z"])
    assert.equal(await post(A, "/api/maps-expand", { url }), 400, url);
});
test("the leaflet map files are served", async () => {
  for (const f of ["/leaflet.js", "/leaflet.css"]) { const r = await fetch(BASE + f); assert.equal(r.status, 200, f); }
});
