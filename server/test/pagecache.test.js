// The app page carries a validator, so an unchanged page is answered with 304 and no body.
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");

const PORT = 5800 + Math.floor(Math.random() * 90), BASE = `http://127.0.0.1:${PORT}`;
let srv, dir;
before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tt-pagecache-"));
  srv = spawn(process.execPath, ["server.js"], { cwd: path.join(__dirname, ".."), stdio: "ignore", env: { ...process.env, PORT: String(PORT), HOST: "127.0.0.1", DATA_DIR: dir, SEED_DIR: path.join(dir, "no-seed") } });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE + "/healthz")).ok) break; } catch { } await new Promise(r => setTimeout(r, 100)); }
});
after(() => { srv?.kill(); fs.rmSync(dir, { recursive: true, force: true }); });

test("the page is sent in full the first time, with a validator and no-cache", async () => {
  const r = await fetch(BASE + "/"), body = await r.text();
  assert.equal(r.status, 200);
  assert.ok(body.length > 100000);
  assert.match(r.headers.get("etag"), /^W\/"/);
  assert.equal(r.headers.get("cache-control"), "no-cache");
});
test("an unchanged page is answered with an empty 304", async () => {
  const etag = (await fetch(BASE + "/")).headers.get("etag");
  for (const sent of [etag, etag.replace(/^W\//, ""), `"other", ${etag}`]) {
    const r = await fetch(BASE + "/", { headers: { "if-none-match": sent } });
    assert.equal(r.status, 304);
    assert.equal((await r.text()).length, 0);
  }
});
test("a different validator still gets the full page", async () => {
  const r = await fetch(BASE + "/", { headers: { "if-none-match": 'W/"stale"' } });
  assert.equal(r.status, 200);
  assert.ok((await r.text()).length > 100000);
});
