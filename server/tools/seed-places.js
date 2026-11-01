// Adds real places (names only, no reviews, no ratings - those come from real people using the app) under one account.
// Safe to run twice: places that already exist (matched by normalized title) are skipped.
//   SEED_USER=surya SEED_PASS='your password' node server/tools/seed-places.js   (on the droplet; talks to the running server)
//   SEED_BASE=http://127.0.0.1:3000 can be set too if the server isn't on the default port. SEED_USER defaults to "admin" if not set. The password is read from the environment and never printed.
"use strict";
const BASE = process.env.SEED_BASE || "http://127.0.0.1:3000", USER = process.env.SEED_USER || "admin", PASS = process.env.SEED_PASS || "";
const AREA = "Arakkonam";
// [title, category, shop types (up to 3, from the app's STYPES list - optional)]
const PLACES = [
  ["Arul Kumaran Textiles", "Shopping", ["clothing"]],
  ["Nethra Multi-Speciality Hospital", "Health", ["hospital"]],
  ["Mahalaxmi Multi-Speciality Hospital", "Health", ["hospital"]],
  ["Lal Thanga Maaligai", "Shopping", ["jewellery"]],
  ["Step In Multi Cuisine Family Restaurant", "Food", ["restaurant"]],
  ["Shalini Nursing Home", "Health", ["hospital"]],
  ["Ortho Lux Health Care", "Health", ["hospital"]],
  ["Varshi Hondas", "Bikes", ["bikes"]],
  ["Sacred Heart Church", "Local", ["worship"]],
  ["Anbu Stores", "Shopping", ["grocery"]],
  ["St. Andrew's School", "Education", ["school"]],
  ["Bharathidasan School", "Education", ["school"]],
  ["SMS Vimal Matriculation Higher Secondary School", "Education", ["school"]],
  ["GG International School", "Education", ["school"]],
  ["Sri Krishna College of Engineering and Technology", "Education", ["school"]],
  ["Ashraf Chicken", "Food", []],
  ["St. Antony's Church", "Local", ["worship"]],
  ["CSI Silver Memorial Church", "Local", ["worship"]],
  ["Darling Showroom", "Shopping", ["electronics"]],
  ["Dr. VGN Matric Higher Secondary School", "Education", ["school"]],
  ["TRS Global Public School", "Education", ["school"]],
  ["Parampara Academy CBSE Higher Secondary School", "Education", ["school"]],
  ["Ambari Vidya Mandir", "Education", ["school"]],
  ["Selvam Matric Higher Secondary School", "Education", ["school"]],
  ["Sri Devi Theatre", "Entertainment", []],
  ["T.N. Narayanasamy Kalyana Mandapam", "Local", []],
  ["Sri Saravana Bhavan", "Food", ["restaurant"]],
  ["Annapoorna Hotel", "Food", ["restaurant"]],
  ["GRT Jewels", "Shopping", ["jewellery"]],
  ["Sri Ramanas Restaurant and Party Hall (AC)", "Food", ["restaurant"]],
  ["ICICI Bank", "Finance", ["bank"]],
  ["Classic Fitness Gym and Health", "Sports", ["sports"]],
];
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
async function call(path, body, cookie) {
  const r = await fetch(BASE + path, { method: body ? "POST" : "GET", headers: { "content-type": "application/json", "x-tt": "1", ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { r, j: await r.json().catch(() => ({})) };
}
(async () => {
  if (!PASS) { console.error("Set SEED_PASS to the account's password first."); process.exit(1); }
  const lg = await call("/api/login", { username: USER, password: PASS });
  if (!lg.r.ok) { console.error("Login failed (" + lg.r.status + "): " + (lg.j.error?.message || "")); process.exit(1); }
  const cookie = lg.r.headers.get("set-cookie").split(";")[0], uid = lg.j.me.id;
  const all = await call("/api/all", null, cookie);
  const have = new Set(); const docs = all.j.cols?.topics || [];
  for (const t of docs) { const d = t.data || t; if (d.kind === "place") have.add(norm(d.title)); }
  let added = 0, skipped = 0, failed = 0;
  for (const [name, cat, types] of PLACES) {
    if (have.has(norm(name))) { skipped++; console.log("skip (already there): " + name); continue; }
    const id = "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const data = { title: name, desc: "", category: cat, kind: "place", tags: ["review"], location: AREA, authorId: uid, tagged: [], taggedGroups: [], parentId: null, originCommentId: null, createdAt: Date.now(), groupId: null };
    if (types && types.length) data.shop = { types };
    const w = await call("/api/write", { op: "set", col: "topics", id, data }, cookie);
    if (w.r.ok) { added++; console.log("added: " + name); } else { failed++; console.log("FAILED (" + w.r.status + "): " + name + " " + (w.j.error?.message || "")); }
    await new Promise(r => setTimeout(r, 150));
  }
  console.log(`Done. Added ${added}, skipped ${skipped}, failed ${failed}.`);
})();
