// Adds the starter places (names only, no reviews, no ratings) under the admin account. Safe to run twice: places that already exist are skipped.
//   SEED_PASS='your admin password' node server/tools/seed-places.js            (on the droplet; talks to the running server)
//   SEED_BASE=http://127.0.0.1:3000  SEED_USER=admin  can be set too. The password is read from the environment and never printed.
"use strict";
const BASE = process.env.SEED_BASE || "http://127.0.0.1:3000", USER = process.env.SEED_USER || "admin", PASS = process.env.SEED_PASS || "";
const AREA = "Arakkonam";
const PLACES = [
  ["Arakkonam Junction Railway Station", "Travel"], ["New Bus Stand", "Travel"], ["Municipality Office", "Services"], ["Railway Engineering Workshop", "Services"],
  ["Arakkonam Government Hospital", "Health"], ["Abishek Hospital", "Health"], ["Mahalaxmi Multispeciality Hospital", "Health"],
  ["St. Andrew’s Higher Secondary School", "Education"], ["Kendriya Vidyalaya No. 1", "Education"],
  ["Sri Angalaparameswary Amman Temple", "Local"], ["Gurudwara Guru Nanak Darbar", "Local"], ["Jamia Masjid", "Local"], ["CSI St. Andrew’s Church", "Local"], ["Sacred Heart Church", "Local"],
  ["Sri Saravana Bhavan", "Food"], ["Saravana Sweets and Bakery", "Food"], ["Darling Electronics", "Shopping"],
  ["Sindhu Cinemas", "Entertainment"], ["Sri Devi Theatre", "Entertainment"], ["TNHB Park", "Local"],
];
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
async function call(path, body, cookie) {
  const r = await fetch(BASE + path, { method: body ? "POST" : "GET", headers: { "content-type": "application/json", "x-tt": "1", ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { r, j: await r.json().catch(() => ({})) };
}
(async () => {
  if (!PASS) { console.error("Set SEED_PASS to the admin password first."); process.exit(1); }
  const lg = await call("/api/login", { username: USER, password: PASS });
  if (!lg.r.ok) { console.error("Login failed (" + lg.r.status + "): " + (lg.j.error?.message || "")); process.exit(1); }
  const cookie = lg.r.headers.get("set-cookie").split(";")[0], uid = lg.j.me.id;
  const all = await call("/api/all", null, cookie);
  const have = new Set(); const docs = all.j.cols?.topics || [];
  for (const t of docs) { const d = t.data || t; if (d.kind === "place") have.add(norm(d.title)); }
  let added = 0, skipped = 0, failed = 0;
  for (const [name, cat] of PLACES) {
    if (have.has(norm(name))) { skipped++; console.log("skip (already there): " + name); continue; }
    const id = "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const data = { title: name, desc: "", category: cat, kind: "place", tags: ["review"], location: AREA, authorId: uid, tagged: [], taggedGroups: [], parentId: null, originCommentId: null, createdAt: Date.now(), groupId: null };
    const w = await call("/api/write", { op: "set", col: "topics", id, data }, cookie);
    if (w.r.ok) { added++; console.log("added: " + name); } else { failed++; console.log("FAILED (" + w.r.status + "): " + name + " " + (w.j.error?.message || "")); }
    await new Promise(r => setTimeout(r, 150));
  }
  console.log(`Done. Added ${added}, skipped ${skipped}, failed ${failed}.`);
})();
