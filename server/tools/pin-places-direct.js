// Adds a verified map pin (lat/lng) to specific places, matched by exact title, by writing
// straight to the database file - no login/password, no API key. The coordinates below all
// come from the OpenStreetMap data already fetched for server/tools/import-osm-places.js
// (Overpass API, 28 Oct 2026) - real, not guessed.
//
// Only places with a genuinely confirmed location are listed here. Web search did not turn up
// reliable, specific coordinates for the rest (mostly IFSC/directory pages, or - in one case -
// a same-named business in a different town), so those are intentionally left out rather than
// risk a wrong pin. Add those by hand from each shop's own "Add map pin" menu option, which
// lets you place the pin by pointing at the map directly instead of geocoding a name.
//
// Safe to run more than once: a place that already has a pin is left alone.
//
// Run on the droplet, from the project root:
//   DATA_DIR=/var/lib/topictalk node server/tools/pin-places-direct.js
// Then restart the service: systemctl restart topictalk
"use strict";
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
// [exact title as added, lat, lng] - from the OSM dataset in import-osm-places.js
const PINS = [
  ["Varshi Hondas", 13.092383, 79.660005],
  ["Bharathidasan School", 13.093421, 79.66722],
  ["SMS Vimal Matriculation Higher Secondary School", 13.097335, 79.655865],
  ["Parampara Academy CBSE Higher Secondary School", 13.106684, 79.665969],
  ["Ambari Vidya Mandir", 13.100133, 79.676329],
  ["Selvam Matric Higher Secondary School", 13.105767, 79.666574],
];

const dbFile = path.join(DATA_DIR, "topictalk.db");
if (!require("fs").existsSync(dbFile)) { console.error("Database not found at " + dbFile + " - check DATA_DIR."); process.exit(1); }
const sql = new DatabaseSync(dbFile);

const upsert = sql.prepare("INSERT INTO docs (col, id, data, updated) VALUES ('topics', ?, ?, ?) ON CONFLICT (col, id) DO UPDATE SET data = excluded.data, updated = excluded.updated");

let pinned = 0, skipped = 0, notFound = 0;
for (const [title, lat, lng] of PINS) {
  const rows = sql.prepare("SELECT id, data FROM docs WHERE col = 'topics'").all();
  const row = rows.find(r => { try { const d = JSON.parse(r.data); return d.kind === "place" && d.title === title; } catch { return false; } });
  if (!row) { notFound++; console.log("not found, skipped: " + title); continue; }
  const d = JSON.parse(row.data);
  if (d.geo) { skipped++; console.log("already pinned: " + title); continue; }
  d.geo = { lat, lng };
  upsert.run(row.id, JSON.stringify(d), Date.now());
  pinned++; console.log("pinned: " + title);
}
sql.close();
console.log(`\nDone. Pinned ${pinned}, already had a pin ${skipped}, not found ${notFound}.`);
console.log("Now restart the service so the site picks these up: systemctl restart topictalk");
