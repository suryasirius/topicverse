// Review ratings must be whole numbers from 1 to 5. Starts a real server on a throwaway data folder.
// Run with:  cd server && npm test
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PORT = 4600 + Math.floor(Math.random() * 300);
const BASE = `http://127.0.0.1:${PORT}`;
let srv, dir, ip = 1;

const headers = cookie => ({ "content-type": "application/json", "x-tt": "1", "x-forwarded-for": `10.77.0.${ip++ % 250}`, ...(cookie ? { cookie } : {}) });
async function account(name) {
  const r = await fetch(BASE + "/api/signup", { method: "POST", headers: headers(), body: JSON.stringify({ username: name, password: "password123" }) });
  assert.equal(r.status, 200, "sign-up works");
  return { cookie: r.headers.get("set-cookie").split(";")[0], id: (await r.json()).me.id };
}
async function write(user, op, col, id, data) {
  const r = await fetch(BASE + "/api/write", { method: "POST", headers: headers(user.cookie), body: JSON.stringify({ op, col, id, data }) });
  return { status: r.status, body: await r.json().catch(() => null) };
}
const review = (user, topicId, rating, extra = {}) => {
  const d = { topicId, authorId: user.id, title: "Good", text: "Fixed it the same day.", createdAt: Date.now(), ...extra };
  if (rating !== undefined) d.rating = rating;
  return write(user, "set", "reviews", `${topicId}__${user.id}`, d);
};

let owner, topicId;
before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tt-test-"));
  srv = spawn(process.execPath, ["server.js"], { cwd: path.join(__dirname, ".."), stdio: "ignore",
    env: { ...process.env, PORT: String(PORT), HOST: "127.0.0.1", DATA_DIR: dir, SEED_DIR: path.join(dir, "no-seed") } });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE + "/healthz")).ok) break; } catch { } await new Promise(r => setTimeout(r, 100)); }
  owner = await account("rt_owner");
  topicId = "t_rating_test";
  const r = await write(owner, "set", "topics", topicId, { title: "A place to review", kind: "place", category: "Food", authorId: owner.id, createdAt: Date.now() });
  assert.equal(r.status, 200);
});
after(() => { srv?.kill(); fs.rmSync(dir, { recursive: true, force: true }); });

for (const rating of [1, 2, 3, 4, 5]) {
  test(`rating ${rating} is accepted`, async () => {
    const u = await account(`rt_ok${rating}`);
    assert.equal((await review(u, topicId, rating)).status, 200);
  });
}

const invalid = [["0", 0], ["6", 6], ["-1", -1], ["2.5 (decimal)", 2.5], ["missing", undefined], ["null", null], ["\"5\" (text)", "5"], ["\"abc\"", "abc"], ["1e9", 1e9], ["true", true]];
for (const [label, rating] of invalid) {
  test(`rating ${label} is refused with a clear message`, async () => {
    const u = await account(`rt_bad${invalid.findIndex(x => x[0] === label)}`);
    const r = await review(u, topicId, rating);
    assert.equal(r.status, 400);
    assert.equal(r.body.error.message, "Pick a rating from 1 to 5 stars.");
  });
}

test("editing your review keeps working, and can't set a bad rating", async () => {
  const u = await account("rt_edit");
  assert.equal((await review(u, topicId, 3)).status, 200);
  const id = `${topicId}__${u.id}`;
  assert.equal((await write(u, "update", "reviews", id, { rating: 4, updatedAt: Date.now() })).status, 200, "valid change accepted");
  assert.equal((await write(u, "update", "reviews", id, { text: "Edited text only" })).status, 200, "edit without touching the rating accepted");
  assert.equal((await write(u, "update", "reviews", id, { rating: 7 })).status, 400, "out-of-range change refused");
  assert.equal((await write(u, "delete", "reviews", id)).status, 200, "deleting your review still works");
});

test("someone else's review is still refused as not allowed (403), before the rating is looked at", async () => {
  const a = await account("rt_a"), b = await account("rt_b");
  assert.equal((await review(a, topicId, 5)).status, 200);
  const r = await write(b, "update", "reviews", `${topicId}__${a.id}`, { rating: 9 });
  assert.equal(r.status, 403);
});

test("only one review per person per topic is still enforced", async () => {
  const u = await account("rt_once");
  const r = await write(u, "set", "reviews", `other__${u.id}`, { topicId, authorId: u.id, rating: 5, createdAt: Date.now() });
  assert.equal(r.status, 400);
});
