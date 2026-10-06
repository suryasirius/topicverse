Yes, Surya. If you want to give **Claude a complete specification** to build this properly, don't just tell it “make a review website.” Give it the product concept, user flows, database, UI, and rules.

Your concept is basically **Reddit + reviews + maps + polls + competitions + branching discussions**, but the important differentiator is the **Topic Graph**: a discussion can turn into another topic. Reddit already dominates topic-based communities and threaded discussion, while Product Hunt focuses on discovery/ranking; your opportunity is to combine these mechanics around *anything*, not just one category. [Product Hunt](https://www.producthunt.com/products/reddit/alternatives?utm_source=chatgpt.com)

Here is the full prompt you can give Claude:

# TOPICTALK — COMPLETE PRODUCT & WEBSITE SPECIFICATION

## 1. PRODUCT NAME

**TopicTalk**

Tagline:

**Review it. Talk about it.**

Alternative tagline:

**Anything can become a topic.**

---

# 2. CORE IDEA

Build a social platform where **anything can become a topic**.

Examples:

- iPhone 17 Pro Max
- Samsung S26 Ultra
- Chennai biryani
- A particular restaurant
- A movie
- A web series
- A mobile app
- UPI apps
- A hotel
- A tourist place
- A local business
- A product
- A service
- A college
- A car
- A bike
- A cricket player
- A cricket match
- A political event
- A shopping product
- A technology
- A local issue
- A question
- A comparison
- A competition

Users can:

1. Create topics
2. Review topics
3. Comment on topics
4. Reply to comments
5. Tag people with @username
6. Use hashtags
7. Like/upvote comments
8. Branch a comment into a completely new topic
9. Tag physical places
10. Add map locations
11. Create polls
12. Create competitions
13. Follow topics
14. Share topics
15. Upload photos/videos
16. Vote
17. Build reputation
18. Discover trending discussions
19. Discover nearby topics
20. Compare things
21. Ask the community questions

---

# 3. THE MAIN DIFFERENTIATOR — TOPIC GRAPH

This must be the central concept of the product.

Normal review site:

Topic
→ Reviews

Normal forum:

Post
→ Comments
→ Replies

TopicTalk:

Topic
→ Review
→ Comment
→ Reply
→ Branch into new topic
→ New discussion
→ Poll
→ Competition
→ Another branch
→ Another topic

Example:

# iPhone 17 Pro Max

Comment:

"Samsung S26 Ultra has a better camera."

User clicks:

**Branch into topic ↗**

It creates:

# iPhone 17 Pro Max vs Samsung S26 Ultra Camera

Then someone comments:

"Actually Pixel is better at night."

They can branch again:

# Best Camera Phone for Night Photography

This creates a connected **Topic Graph**.

Every topic should store:

- parent topic
- originating comment
- child topics
- related topics
- hashtags
- location
- category

Display:

**This topic was branched from:**
iPhone 17 Pro Max

And:

**Related discussions**
→ Best camera phone
→ Samsung vs iPhone
→ Night photography
→ Best phone under ₹80,000

---

# 4. HOMEPAGE

The homepage should feel like a modern social network.

Do NOT make it look like a boring review directory.

## Header

Left:

**TopicTalk**

Center:

Large search box:

"Search anything..."

Examples:

"iPhone 17"
"restaurants in Chennai"
"best UPI app"
"Avatar movie"
"Goa hotels"

Right:

- Explore
- Notifications
- Create
- Profile

For logged-out users:

- Log in
- Sign up

---

# 5. HERO SECTION

Headline:

**Anything can become a topic.**

Subheading:

"Review it. Talk about it. Challenge opinions. Discover what the community thinks."

Buttons:

**Explore Topics**

**Start a Topic**

**Create a Poll**

**Start a Competition**

Do not make the hero excessively large.

The homepage should quickly reach actual discussions.

---

# 6. TRENDING TOPICS

Section:

🔥 **Trending Now**

Cards should display:

Topic title

Category

Rating

Number of reviews

Number of comments

Number of votes

Number of participants

Trending indicator

Example:

### iPhone 17 Pro Max

⭐ 4.6

184 reviews

💬 428 discussions

🔥 Trending

Buttons:

**Review**

**Discuss**

---

# 7. TOPIC CARD

Every topic card should have:

- Topic image
- Topic title
- Category
- Hashtags
- Rating
- Review count
- Comment count
- Vote count
- Location if applicable
- Author
- Time created
- Trending indicator
- Follow button

Example:

--------------------------------

📱 **iPhone 17 Pro Max**

Tech · Apple

⭐ 4.6 / 5

184 Reviews

💬 428 Comments

🔥 Trending

#iPhone17 #Apple #Smartphones

[Discuss] [Review]

--------------------------------

---

# 8. TOPIC PAGE

Clicking a topic opens the full discussion page.

Top:

Topic image

Topic title

Category

Location

Hashtags

Creator

Follow button

Share button

---

## Community verdict

Display:

⭐ 4.4 / 5

**82% recommend**

Breakdown:

★★★★★ 58%
★★★★ 24%
★★★ 10%
★★ 5%
★ 3%

---

# 9. REVIEW SYSTEM

Users can submit:

- 1–5 stars
- Title
- Written review
- Photos
- Video
- Pros
- Cons

Optional structured fields depending on category.

Example:

Product:

- Battery
- Camera
- Performance
- Value

Restaurant:

- Taste
- Quantity
- Price
- Service
- Ambience

Movie:

- Story
- Acting
- Direction
- Visuals

But the system must also support generic reviews.

---

# 10. COMMENTS

Under reviews:

**Community discussion**

Each comment has:

- Avatar
- Username
- Verification/reputation badge
- Comment
- Time
- Like
- Reply
- Tag
- Share
- Report
- Branch into topic ↗

Example:

User:

"Samsung has a better camera."

Actions:

👍 128

Reply

@Tag

**Branch into topic ↗**

---

# 11. BRANCH INTO TOPIC

This is one of the most important features.

Every meaningful comment should have:

**Branch into topic ↗**

When clicked:

Open modal:

"Turn this discussion into a new topic"

Fields:

Topic title

Description

Category

Hashtags

Location

Optional image

Create topic

After creation:

"This topic was branched from:

[Original Topic]"

The new topic automatically links back to the original.

---

# 12. TOPIC RELATIONSHIP GRAPH

Every topic should have:

### Related Topics

- Parent topic
- Child topics
- Similar topics
- Same location
- Same hashtag

Create a visual relationship section.

Example:

iPhone 17 Pro Max
│
├── Camera discussion
│   └── Best night camera
│
├── Battery discussion
│
├── iPhone vs Samsung
│   └── Camera comparison
│
└── Best phone under ₹1 lakh

This is the **Topic Graph**.

---

# 13. HASHTAGS

Users can create hashtags.

Examples:

#iPhone17

#ChennaiFood

#GoaTrip

#UPI

#MovieReviews

Clicking a hashtag opens a feed containing every topic using that hashtag.

Allow:

Follow hashtag

Trending hashtag

Popular discussions

---

# 14. @MENTIONS

Users can tag:

@rahul

@priya

@surya

Tagged users receive notification.

Example:

"@Rahul what do you think about this?"

---

# 15. POLLS

Users can create polls.

Example:

### Which is the best UPI app?

○ Google Pay

○ PhonePe

○ Paytm

○ BHIM

Button:

**Vote**

After voting:

Google Pay — 43%

PhonePe — 38%

Paytm — 12%

BHIM — 7%

Display:

Total votes

Percentage

Time remaining

---

# 16. YES / NO QUESTIONS

Simple community questions.

Example:

### Should Chennai have more night markets?

YES 72%

NO 28%

---

# 17. A/B BATTLES

Create direct comparisons.

Example:

### Which is better?

iPhone 17 Pro Max

VS

Samsung S26 Ultra

Users vote.

Show live percentage.

Winner:

🏆 Samsung S26 Ultra

---

# 18. COMPETITIONS

Users can create community competitions.

Example:

🏆 **Best Biryani in Chennai**

Participants:

1. Restaurant A
2. Restaurant B
3. Restaurant C
4. Restaurant D

Rule:

**First participant to reach 1,000 likes wins.**

Display:

Leaderboard

1. Restaurant A — 842 👍
2. Restaurant B — 731 👍
3. Restaurant C — 529 👍
4. Restaurant D — 311 👍

Progress bars.

Countdown.

Competition status:

LIVE

ENDING SOON

FINISHED

---

# 19. COMPETITION TYPES

Support:

### Like race

First to 1,000 likes wins.

### Vote competition

Most votes wins.

### Rating competition

Highest community rating wins.

### Challenge

Complete a challenge and collect votes.

### Photo competition

Users upload photos.

### Review competition

Best review wins.

---

# 20. COMPETITION RULES

Every competition must clearly display:

- Start date
- End date
- Winning condition
- Number of participants
- Voting method
- Anti-spam rules
- Winner

Do NOT hide rules.

---

# 21. MAP / PLACE TAGGING

Any topic can optionally have a physical location.

Examples:

Restaurant

Hotel

Shop

Cinema

Beach

Tourist attraction

Gym

College

Hospital

Local business

Users can select:

📍 Place

Search place

Address

Latitude

Longitude

---

# 22. NEARBY TOPICS

Homepage section:

📍 **Discussions Near You**

Example:

"Best biryani near me"

"New gym opening"

"Cinema experience"

"Local restaurant review"

"Best cafe"

"Traffic issue"

"Local event"

Users can switch:

Nearby

City

State

India

---

# 23. MAP PAGE

Create a dedicated:

**Explore Map**

Map markers represent topics.

Click marker:

Topic title

Rating

Number of reviews

Open topic

Filter:

Restaurants

Hotels

Food

Shopping

Movies

Services

Local

Events

Everything

For the first MVP, a simple map implementation is acceptable. Do not depend on expensive APIs.

---

# 24. ASK THE COMMUNITY

Users should be able to create questions.

Button:

**Ask the Community**

Examples:

"What is the best phone under ₹50,000?"

"Which UPI app is most reliable?"

"Where should I stay in Goa?"

"Which restaurant is best for family dinner?"

"Is this movie worth watching?"

Answers become comments.

Users vote on answers.

Best answer gets:

🏆 Community Answer

---

# 25. COMMUNITY VERDICT

Every mature topic should eventually have a community verdict.

Example:

### Community Verdict

⭐ 4.5 / 5

**87% recommend**

Most mentioned positives:

✓ Camera

✓ Battery

✓ Performance

Most mentioned negatives:

✕ Price

✕ Weight

The verdict should be calculated from reviews and community reactions.

---

# 26. REACTIONS

Do more than just Like.

Allow:

👍 Useful

❤️ Love

🔥 Agree

🤔 Unsure

👎 Disagree

😂 Funny

Users can see reaction counts.

---

# 27. FOLLOW SYSTEM

Users can follow:

- Topics
- Hashtags
- People
- Places
- Categories

Following a topic means notifications for:

- New reviews
- New comments
- Poll results
- Competition updates
- New branches
- Winner announcements

---

# 28. NOTIFICATIONS

Notification types:

Someone replied to you

Someone mentioned you

Someone liked your review

Someone followed your topic

Your topic is trending

Someone branched from your comment

Competition ending soon

You won a competition

Poll result changed

---

# 29. USER PROFILE

Profile:

Avatar

Username

Bio

Location

Followers

Following

Reputation score

Reviews

Topics

Comments

Polls

Competitions

Achievements

---

# 30. USER REPUTATION

Give users reputation based on useful contributions.

Example:

+1 comment liked

+5 review marked useful

+10 topic reaches 100 comments

+20 competition winner

+50 highly-rated reviewer

Badges:

🏆 Top Reviewer

🔥 Trending Contributor

💬 Discussion Starter

🧠 Helpful Member

📍 Local Expert

🏆 Competition Winner

---

# 31. LEVEL SYSTEM

Example:

Level 1 — New Member

Level 2 — Contributor

Level 3 — Reviewer

Level 4 — Community Expert

Level 5 — Topic Master

Do not make this childish.

Use subtle badges.

---

# 32. TRENDING ALGORITHM

Trending score can initially be:

engagement

+

recent activity

+

comments

+

reviews

+

votes

+

shares

+

growth velocity

Do NOT simply rank by total likes.

A topic with 50 likes in 10 minutes can be more trending than one with 1,000 likes accumulated over a year.

---

# 33. DISCOVERY PAGE

Create:

### Explore

Tabs:

Trending

Latest

Popular

Nearby

Most Discussed

Most Reviewed

Competitions

Polls

Questions

---

# 34. SEARCH

Search everything.

Search:

Topics

Users

Hashtags

Places

Categories

Reviews

Questions

Competitions

Autocomplete suggestions.

Example:

Search:

"iphone"

Results:

Topics

#iPhone17

Users

Places

Reviews

Polls

---

# 35. CATEGORY SYSTEM

Initial categories:

Tech

Food

Movies

Travel

Apps

Shopping

Sports

Gaming

Finance

Education

Health

Cars

Bikes

Local

Services

Entertainment

Lifestyle

Other

But users should NOT be restricted to these categories.

They can create custom categories/topics.

---

# 36. MEDIA

Allow reviews and topics to contain:

Images

Videos

GIFs

Links

Later:

Short videos / clips

Do not require media for normal posts.

---

# 37. SOCIAL SHARING

Every topic gets a shareable URL.

Example:

/topic/iphone-17-pro-max

Sharing should generate:

Topic title

Image

Rating

Community verdict

Comment count

Call to action

"Join the discussion on TopicTalk"

---

# 38. SEO

Every topic should have its own indexable page.

Example:

/topic/best-biryani-in-chennai

SEO title:

"Best Biryani in Chennai — Reviews & Community Discussion | TopicTalk"

SEO description should be generated from topic information.

Use structured data where appropriate.

---

# 39. VIRAL LOOP

The platform should naturally encourage sharing.

Example:

User creates:

"Best Biryani in Chennai"

Then shares it to WhatsApp.

Friends join.

Someone comments:

"Ambur is better."

That comment becomes:

"Ambur Biryani vs Chennai Biryani"

Then users vote.

Then someone creates:

"Best Biryani in Tamil Nadu"

This creates a network effect.

---

# 40. HOMEPAGE SECTIONS

Recommended order:

1. Header
2. Hero
3. Search
4. Trending Topics
5. Hot Discussions
6. Polls
7. A/B Battles
8. Competitions
9. Nearby Topics
10. New Topics
11. Popular Hashtags
12. Rising Creators
13. Topic Graph examples
14. Footer

---

# 41. MOBILE DESIGN

Mobile is extremely important.

Bottom navigation:

🏠 Home

🔎 Explore

➕ Create

🔥 Trending

👤 Profile

Use floating create button if appropriate.

Topic pages should be optimized for one-handed use.

Comments should feel like a social app.

---

# 42. CREATE BUTTON

One central Create button.

Click:

### What do you want to create?

📝 Topic

⭐ Review

❓ Question

📊 Poll

⚔️ A/B Battle

🏆 Competition

📍 Place Topic

This should be extremely easy.

---

# 43. LOW-COST MVP AUTHENTICATION

IMPORTANT:

Do NOT require expensive SMS OTP initially.

MVP can use:

Username + password

or

Email + password

Optional email verification later.

Guest users can browse.

Logged-in users can:

Review

Comment

Vote

Create topics

Create polls

Create competitions

This keeps initial operating costs low.

---

# 44. MODERATION

Users can report:

Spam

Harassment

Fake review

Hate

Scam

Misinformation

Copyright issue

Abuse

Each report should enter a moderation queue.

Users can block other users.

Topics can be locked.

Comments can be removed.

Competition creators cannot manipulate results after launch.

---

# 45. ANTI-SPAM

Implement basic protection:

Rate limiting

Duplicate comment detection

Vote restrictions

One vote per user per poll

Competition voting limits

Suspicious activity detection

Account reputation

Do NOT depend on SMS OTP for the MVP.

---

# 46. ADMIN PANEL

Admin dashboard:

Users

Topics

Reviews

Comments

Reports

Polls

Competitions

Trending topics

Flagged content

Banned users

Statistics

Admin can:

Delete content

Suspend users

Lock topics

Remove competitions

Resolve reports

---

# 47. DATABASE STRUCTURE

Recommended tables:

users

profiles

topics

topic_relationships

reviews

comments

comment_replies

hashtags

topic_hashtags

mentions

places

topic_places

polls

poll_options

poll_votes

competitions

competition_entries

competition_votes

reactions

follows

notifications

reports

media

user_badges

user_reputation

---

# 48. TOPIC TABLE

Fields:

id

title

slug

description

category_id

creator_id

parent_topic_id

origin_comment_id

place_id

image_url

status

created_at

updated_at

views

review_count

comment_count

vote_count

share_count

trending_score

---

# 49. COMMENTS TABLE

Fields:

id

topic_id

user_id

parent_comment_id

content

like_count

reaction_count

created_at

updated_at

is_deleted

branch_topic_id

This allows:

Comment

→ Reply

→ Branch topic

---

# 50. REVIEWS TABLE

Fields:

id

topic_id

user_id

rating

title

content

pros

cons

created_at

updated_at

helpful_count

---

# 51. POLLS

Poll:

id

topic_id

question

created_by

start_time

end_time

status

Options:

id

poll_id

option_text

vote_count

Votes:

id

poll_id

option_id

user_id

created_at

---

# 52. COMPETITIONS

Competition:

id

topic_id

title

description

target_type

target_value

start_time

end_time

status

winner_id

created_by

Entries:

id

competition_id

user_id

title

description

image

vote_count

rank

---

# 53. TOPIC GRAPH DATABASE LOGIC

Do not necessarily use a graph database.

A relational database is enough initially.

Store:

parent_topic_id

origin_comment_id

related_topic_id

Then query relationships.

Example:

Topic A

parent_topic_id = NULL

Topic B

parent_topic_id = A

Topic C

parent_topic_id = B

Topic D

parent_topic_id = A

This produces the graph.

---

# 54. DESIGN STYLE

The site must look:

Premium

Modern

Social

Trustworthy

Clean

Fast

Not corporate

Not childish

Not like an old forum

Use:

Rounded cards

Subtle shadows

Clean typography

Green primary brand color

White/light background

Optional dark mode

Strong spacing

Large readable headings

Minimal visual clutter

---

# 55. BRAND

Logo:

**TopicTalk**

"Topic" in dark text.

"Talk" in brand green.

Possible logo concept:

Speech bubble + hashtag.

---

# 56. COLOR SYSTEM

Primary:

#1F9D63

Dark green:

#0E7045

Background:

#F5F7F6

Surface:

#FFFFFF

Text:

#12201B

Muted:

#66756F

Dark mode:

#0B1110

---

# 57. IMPORTANT UX PRINCIPLE

Do NOT make every feature visible everywhere.

Keep the interface simple.

Advanced actions should appear contextually.

For example, under a comment:

Like · Reply · Share · More

Inside More:

Tag

Branch into topic

Report

---

# 58. TOPIC PAGE LAYOUT

Desktop:

LEFT:

Topic content

Reviews

Discussion

RIGHT:

Community verdict

Related topics

Location

Trending information

Competition/poll if available

Mobile:

Topic

Verdict

Reviews

Discussion

Related topics

---

# 59. TOPIC LIFECYCLE

A topic can evolve.

Example:

Day 1:

Question

↓

Day 2:

Reviews

↓

Day 3:

Discussion

↓

Day 4:

Poll

↓

Day 5:

A/B Battle

↓

Day 6:

Competition

↓

Day 7:

Winner

↓

Day 8:

New branch topics

This lifecycle should be one of the platform's strongest characteristics.

---

# 60. EXAMPLE USER JOURNEY

User searches:

"Best phone under ₹50,000"

Search results show:

10 topics

User opens:

"Best phone under ₹50,000"

Reads reviews.

Someone comments:

"Nothing Phone is better."

User branches comment.

New topic:

"Nothing Phone vs Samsung under ₹50k"

Then creates A/B poll.

Users vote.

Samsung:

54%

Nothing:

46%

Someone comments:

"Camera matters more than performance."

Branch:

"Best camera under ₹50k"

Now TopicTalk has generated multiple connected discussions from one original topic.

---

# 61. GAMIFICATION

Do not overdo it.

Reward useful participation.

Examples:

"Your review helped 50 people."

"You started a trending discussion."

"Your topic has 100 comments."

"Your answer became the community answer."

These are more meaningful than meaningless points.

---

# 62. BUSINESS MODEL — LATER

Do NOT prioritize monetization during MVP.

Possible future revenue:

Sponsored topics

Promoted local businesses

Business profiles

Premium analytics

Featured competitions

Sponsored polls

Affiliate links

Creator subscriptions

Business verification

Local advertising

---

# 63. BUSINESS PROFILES

Later allow businesses to claim their place/topic.

Example:

Restaurant:

Name

Address

Photos

Opening hours

Rating

Reviews

Community discussions

Official response

Verified badge

Businesses can respond to reviews but should NOT be able to delete criticism.

---

# 64. TRUST SYSTEM

Clearly distinguish:

Verified review

Community review

Unverified opinion

Business response

Moderator action

Do not allow businesses to manipulate ratings.

---

# 65. MVP PRIORITY

Build these first:

### PHASE 1

User accounts

Home feed

Create topic

Topic page

Reviews

Comments

Replies

Likes

Hashtags

@mentions

Search

Categories

Follow topic

Notifications

---

### PHASE 2

Branch into topic

Topic relationships

Topic Graph

Polls

A/B battles

Place tagging

Nearby topics

Map

---

### PHASE 3

Competitions

Leaderboards

Reputation

Badges

Media uploads

Community verdict

Advanced trending

---

### PHASE 4

Business profiles

Monetization

Advanced analytics

Recommendation algorithm

Mobile application

---

# 66. TECHNICAL REQUIREMENTS

Use a modern stack.

Recommended:

Frontend:

React / Next.js

TypeScript

Tailwind CSS

Backend:

Node.js

API routes / Express / Next.js backend

Database:

PostgreSQL

ORM:

Prisma

Authentication:

Email/password initially

Storage:

S3-compatible storage for media

Maps:

Use a low-cost/free map provider where possible.

Do not require paid Google services for the MVP.

---

# 67. PERFORMANCE

The application must be:

Fast

Mobile-first

SEO-friendly

Accessible

Responsive

Lazy-load images

Paginate comments

Paginate topics

Use database indexes

Avoid loading every comment at once.

---

# 68. IMPORTANT SECURITY

Implement:

Password hashing

Secure sessions

CSRF protection where applicable

Rate limiting

Input validation

SQL injection protection

XSS protection

File upload validation

Authorization checks

User blocking

Report system

Competition vote validation

Poll vote validation

Never trust frontend vote counts.

---

# 69. DO NOT BUILD IT AS A STATIC DEMO

The final product should use real persistent data.

When a user creates:

Topic

Review

Comment

Poll

Competition

Vote

Reaction

Follow

It must persist after refresh.

---

# 70. IMPORTANT FIRST VERSION

If full implementation is too large, build a polished MVP rather than pretending every feature works.

The minimum functional loop must be:

Create Topic
→ Open Topic
→ Review
→ Comment
→ Reply
→ Like
→ Branch comment
→ New Topic
→ Follow
→ Share

Then add:

Poll

A/B Battle

Competition

Map

---

# 71. FINAL PRODUCT FEEL

The user should feel:

"I can talk about literally anything here."

Not:

"This is another restaurant review website."

Not:

"This is another Reddit clone."

Not:

"This is another forum."

The core feeling should be:

**"Every opinion can become a conversation, and every conversation can become a new topic."**

That is TopicTalk.

---

# 72. CLAUDE IMPLEMENTATION INSTRUCTION

Build the website from this specification.

Do not remove features simply because the concept is broad.

Build the architecture so additional features can be added later.

Start with a production-quality responsive web application.

Prioritize:

1. Topic creation
2. Topic pages
3. Reviews
4. Discussions
5. Branching topics
6. Topic relationships
7. Polls
8. A/B battles
9. Competitions
10. Places/maps
11. User profiles
12. Search/discovery

Every major feature should be modular.

Use realistic seed data so the website does not look empty on first launch.

Create realistic examples across:

Tech

Food

Movies

Travel

Apps

Sports

Shopping

Local

Services

---

# MOST IMPORTANT PRODUCT PRINCIPLE

TopicTalk is NOT a review website.

TopicTalk is NOT a forum.

TopicTalk is NOT a polling website.

TopicTalk is NOT a competition website.

It is a **social discussion layer for everything people want to talk about.**

The fundamental unit is:

# TOPIC

Everything else grows from the topic:

Topic
→ Review
→ Discussion
→ Reaction
→ Poll
→ Battle
→ Competition
→ Branch
→ Related topic
→ Topic Graph

Build the product around this concept.

**One important recommendation:** give Claude this specification first, then ask it to build **Phase 1 only** rather than trying to build all 70 sections in one shot. The most important thing to validate is whether people actually use the **Topic → Comment → Branch → New Topic** loop. That is what can separate your idea from the existing Reddit/review ecosystem. [Product Hunt](https://www.producthunt.com/products/reddit/alternatives?utm_source=chatgpt.com)