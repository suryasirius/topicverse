# TopicTalk

**Anything can become a topic.** A social discussion platform where people review anything, talk about it, and turn any comment into a new linked topic. The links form a *Topic Graph*.

This repository holds the working prototype and the product specification. The production web app (Next.js + PostgreSQL) is the next step.

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
  topictalk.html     Single-file prototype (HTML + CSS + JS)
  seed/              Sample data, one JSON file per document, grouped by collection
docs/
  SPEC.md            Full product specification
```

## How the prototype runs

`prototype/topictalk.html` is built as a **Claude artifact**. It uses the claude.ai artifact runtime (`window.claude`) for:

- `db`: the shared document store (topics, comments, reviews, likes, follows, battles, votes, groups, duels, notifications)
- `user`: who is viewing
- `sample`: Claude for community answers and thread summaries
- `downloads`: saving share-card images

Opened outside claude.ai, the page loads but shows a notice and no data, because those services aren't available. The production app will replace them with a real backend.

### Data model (collections)

`topics`, `comments`, `reviews`, `likes`, `follows`, `handles`, `battles`, `bvotes`, `pvotes`, `groups`, `gmembers`, `duels`, `dvotes`, `notifs`

Key fields for the Topic Graph: `topics.parentId` (the topic it branched from) and `topics.originCommentId` (the comment it grew out of). Private groups use `topics.groupId`; `madePublic` publishes a group topic with credit.

### Seed data

`prototype/seed/<collection>/<id>.json`. Every sample document has `"seed": true`, and sample accounts have ids starting with `seed-`. The page owner can remove all sample content from **Profile → Owner tools**.

## Known limits of the prototype

- **Privacy is on screen only.** Anyone who can open the page could technically read all data, including private group topics and invite codes. Real privacy needs a server that checks membership.
- **Not indexed by Google.** The page is private to claude.ai. Public, search-friendly topic pages (e.g. `/topic/best-biryani-in-chennai`) come with the production app.
- Vote and counter integrity relies on one document per user per vote; a real backend should enforce it.

## Next: production app

Next.js + TypeScript + Tailwind, PostgreSQL + Prisma, email/password auth, deployed on Vercel. See `docs/SPEC.md` sections 47–53 and 66–68 for the data model, stack and security requirements.
