# TopicTalk

**Anything can become a topic.** A social discussion platform where people review anything, talk about it, and turn any comment into a new linked topic. The links form a *Topic Graph*.

This repository holds the site, a small self-hosted server that runs it anywhere, and the product specification. A Next.js + PostgreSQL rewrite comes later.

## What's in the prototype

| Area | Features |
|---|---|
| Topics | Create topics and questions, categories, hashtags (Tamil supported), places, follow, notifications |
| Reviews | 1–5 stars, pros and cons, community verdict, rating trend over time, rising complaints, strongest opposing review |
| Discussion | Threaded comments and replies, likes, @mentions, Top / New / Other side first sorting |
| Branching | **Branch into topic** on any comment, lineage breadcrumb, Topic Graph tree, "Sparked N topics" credit, Branch of the day |
| Battles | **Settle it**: turn an argument into an A/B vote with a timer; result posted back under the comment |
| Debate duels | 1-vs-1 debates: 3 rounds each (opening, rebuttal, final word), 150 words per round, 24-hour turns with forfeit, 48-hour "Who argued better?" voting, minimum 5 votes, win/loss records |
| Predictions | Yes/No predictions with a resolve date, "called it" record, no money |
| Groups | Private (invite code) and public groups, group topics/battles/predictions, admins, leaderboard, **Make public** with credit |
| Answers | Search a question and get a **Community answer** written from the conversations, with source posts; saved answers on topic pages |
| Local | City pages, "Your city", Tamil interface toggle, Tamil/Tanglish content |
| Sharing | Share cards (1080×1350 images) for verdicts, battles and predictions |
| Catch me up | Claude summary of long threads: what people agree on, what they still argue about |

## Repository layout

```
prototype/
  topictalk.html     The whole site: one file of HTML, CSS and JS
  seed/              Sample data, one JSON file per document, grouped by collection
server/
  server.js          Self-hosted server: accounts, SQLite document store, live updates
  shim.js            Gives the page the same data API it had on claude.ai, backed by the server
  build.js           Builds the served page from prototype/topictalk.html
deploy/
  install.sh         One-command install or update on an Ubuntu server
docs/
  SPEC.md            Full product specification
```

## Run it on your own server (DigitalOcean)

1. Create a droplet: **Ubuntu 24.04**, the smallest Basic size (1 GB RAM) is enough to start.
2. Open the droplet's **Console** in DigitalOcean and paste:

   ```
   curl -fsSL https://raw.githubusercontent.com/suryasirius/topicverse/main/deploy/install.sh | bash
   ```

   If the repo is private, use a GitHub token with read access to it:

   ```
   export GITHUB_TOKEN=<token>; curl -fsSL -H "Authorization: token $GITHUB_TOKEN" https://raw.githubusercontent.com/suryasirius/topicverse/main/deploy/install.sh | bash
   ```

3. Open the address it prints (`http://<droplet IP>`) and create your account first: **the first account becomes the owner**
   (or set `ADMIN_USERNAME=<name>` before `bash`).

Update to the newest code any time with `bash /opt/topictalk/deploy/install.sh`. Your data stays in `/var/lib/topictalk`,
with a daily backup kept for 7 days in `/var/lib/topictalk/backups`. Logs: `journalctl -u topictalk -f`.

Run it on your own computer instead: `cd server && npm start` (Node.js 22.13 or newer), then open http://localhost:3000.

### What the server does

- **Accounts:** username and password (scrypt-hashed), 60-day login cookie. Guests can read everything public.
- **Data:** every collection the page uses, stored in SQLite (`node:sqlite`, no npm packages), sent to each browser on load and kept live with Server-Sent Events.
- **Rules on every write:** people can only write as themselves; votes are one per person and only while voting is open; only authors, group admins or the owner change things; usernames are unique; ids and images are validated.
- **Real private groups:** private-group topics, comments, battles and duels are only sent to members; invite codes only to members; joining checks the code on the server.
- **Off for now:** the Claude features (community answers fall back to the top post; no thread summaries).

## How the prototype runs on claude.ai

`prototype/topictalk.html` is also published as a **Claude artifact**. It uses the claude.ai artifact runtime (`window.claude`) for:

- `db`: the shared document store (topics, comments, reviews, likes, follows, battles, votes, groups, duels, notifications)
- `user`: who is viewing
- `sample`: Claude for community answers and thread summaries
- `downloads`: saving share-card images

Opened outside claude.ai, the page loads but shows a notice and no data, because those services aren't available. The production app will replace them with a real backend.

### Data model (collections)

`topics`, `comments`, `reviews`, `likes`, `follows`, `handles`, `battles`, `bvotes`, `pvotes`, `groups`, `gmembers`, `duels`, `dvotes`, `media`, `notifs`

Key fields for the Topic Graph: `topics.parentId` (the topic it branched from) and `topics.originCommentId` (the comment it grew out of). Private groups use `topics.groupId`; `madePublic` publishes a group topic with credit.

### Seed data

`prototype/seed/<collection>/<id>.json`. Every sample document has `"seed": true`, and sample accounts have ids starting with `seed-`. The page owner can remove all sample content from **Profile → Owner tools**.

## Known limits

- **On claude.ai,** privacy is on screen only and the page is private; the self-hosted server fixes both.
- **Not indexed by Google yet.** Topics live at `/#t-<id>` links; search-friendly pages (`/topic/best-biryani-in-chennai`) come with the Next.js version.
- **HTTP only on a bare IP.** Add a domain to get HTTPS.
- **GIFs under 190 KB,** no GIF search yet.

## Later: production app

Next.js + TypeScript + Tailwind, PostgreSQL + Prisma. The collections above map one-to-one to tables, so the SQLite data can be migrated. See `docs/SPEC.md` sections 47–53 and 66–68.
