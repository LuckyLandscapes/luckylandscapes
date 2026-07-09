# Meta Ads — Campaign 001 Playbook

**Written:** 2026-07-08. Every platform mechanic below was researched and
fact-checked against primary sources on 2026-07-08 (Meta help pages, Meta
Transparency Center, Census ACS 2024 5-year). Meta's UI drifts fast — if a
setting named here doesn't exist on build day, the concept still applies;
find its new name, don't skip the step.

**The play:** first paid campaign. $300 total, $25/day × 12 days, Meta
Instant Forms (no pixel needed), aimed at high-income Lincoln-area
homeowners for large projects — retaining walls, paver patios, big
mulch/bed refreshes. Success = a handful of reachable, real-project leads
and ideally one closed job. One $5k wall pays for this test 16 times over.

---

## 0. Honest expectations (so nobody panics on day 4)

- **$300 buys roughly 4–10 leads** (realistic midpoint 6–8). Benchmarks:
  home-improvement lead campaigns median $41.26/lead (WordStream, 726 US
  campaigns 2024–25); home services $45.50 spend-weighted (Focus Digital);
  instant forms are the cheapest lead format (~$34). Landscaping-specific
  and hardscape-qualified leads run higher. Single digits is SUCCESS, not
  failure.
- **The campaign will sit in "Learning Limited" the whole flight.** Meta
  wants ~50 leads/week to exit learning; that's mathematically impossible
  at $25/day. Expected. Ignore the badge. Do NOT restructure mid-flight to
  "fix" it.
- **Daily results will be lumpy.** One lead Monday, zero Tue–Wed, two
  Thursday. Judge in 4–5 day blocks, never day-by-day.
- **July is the shoulder season** — spring and fall drive 60–70% of
  landscaping leads. That's why every ad sells *booking a fall install*,
  which is real intent that starts building in July.
- **Speed-to-lead is the whole ballgame.** Instant-form leads are
  low-friction and forget they applied. Contractors responding in ~2 min
  convert ~62% of leads vs ~28% at the 42-minute average; conversion drops
  ~8x after the first 5 minutes (Hatch, 132k campaigns, 2024). The
  alert-and-callback ritual in §2 matters more than any targeting choice.

## 1. One-time setup (60–90 min, do once, do calmly)

**The KPM question (added 2026-07-08):** Riley boosted KPM Property
Management posts last year. Boosts run through the booster's *personal ad
account* (every profile has one; page and ad account are separate
objects), so that account exists, is owned by Riley personally, and
carries KPM's history and his personal card. **Leave it alone — create
Lucky a fresh, business-owned account instead:**

- The "move this ad account into the portfolio?" option in setup is the
  claim flow, and it's a **one-way street** — an ad account added to a
  business portfolio can't be moved back out. Don't connect the old
  account to Lucky's portfolio at all.
- The only real perk of an aged account (higher automatic daily spending
  cap) is worthless here: $25/day fits under even the tightest
  new-account cap.
- Property-management boosts are housing-adjacent; if any ran without the
  housing ad-category declared, that history is a wildcard we don't want
  under Lucky's campaigns. Fresh account = clean slate, and Lucky's page
  having zero ad history costs nothing.
- **Preflight (2 min, Riley's login):** check Account Quality
  (business.facebook.com/accountquality, or Ads Manager → Account Quality
  in the left sidebar) — confirm his *profile* has no advertising
  restrictions from the KPM era. Restrictions attach to
  people as well as accounts, and a restricted profile bites no matter
  which ad account we use. If anything shows there, stop and deal with
  that first.

New ad accounts get flagged for sloppy setup. Do this in order, in one
sitting, then stop touching it for a few hours.

1. **Business portfolio** at business.facebook.com (Meta Business Suite),
   business info filled out completely. Add Macoy AND Riley as people.
2. **Add the Facebook Page** (facebook.com/luckylandscapes) to the
   portfolio. Riley (or whoever is Page admin) grants it. **Link the
   Instagram account** (lucky.landscapes) so IG placements run under the
   real handle.
3. **Create ONE ad account, business-owned, inside the portfolio** — USD,
   America/Chicago. Never create a second one; duplicate accounts are a
   restriction trigger. (New portfolios are limited to one ad account
   anyway until they build history — we need exactly one.)
4. **Payment:** a real credit/debit card (no prepaid/virtual), card country
   = US. Add a backup payment method. Whose card = Riley decision (it's a
   Lucky business expense).
5. **Set an account spending limit of $310** (Payment settings → Account
   spending limit). This is a lifetime hard cap — all ads stop when it's
   hit. Built-in "no surprise overspend" guard for this test.
6. **Turn on two-factor auth** for everyone in the portfolio.
7. **Do NOT bulk-create or rapid-edit anything on day one** — rapid
   unusual activity on a fresh account is a documented flag trigger.
8. New accounts carry an automatic Meta daily spend cap (reported $25–50
   for brand-new accounts). $25/day fits under it — another reason not to
   plan a mid-flight budget spike.

## 2. Lead alerts — free stack only (decided 2026-07-08: $0 on tooling)

Verified facts driving this section: leads land in **Leads Center** (Meta
Business Suite → Leads Center), **expire 90 days** after submission
(permanently undownloadable after), and **Meta sends no native per-lead
email**. Business Suite app push exists but is widely reported delayed or
dropped, especially on iOS. Paid bridges (LeadSync/Zapier) are vetoed, so
the free system is:

1. **Meta Business Suite app** on both phones, notifications ON. Treat
   push as a bonus when it works, not the system.
2. **The system is a checking ritual:** whoever's on point opens Leads
   Center at three fixed times daily for the 12 days — e.g. 7:30am, noon,
   6pm, anchored to existing habits. That bounds worst-case response to
   ~half a day instead of 5 minutes. Real cost per the §0 speed-to-lead
   data, but at ~1 lead every 1–2 days it's workable, and it's free.
3. **The real fix is our own stack:** a Meta leadgen webhook (or a
   polling cron with a Page token) into luckyapp — creates the lead row
   and fires an instant email through the Resend integration luckyapp
   already has. $0 forever and better than any paid bridge. Couple hours
   of dev plus a possible Meta app-review speed bump, so it's a parallel
   track — build it during the flight, don't block launch on it.
4. **Response SOP:** lead found → call within 15 minutes of finding it
   during work hours, same evening at the absolute latest. Open with
   their form answers ("you mentioned a retaining wall, timeline this
   fall…"), goal is booking the on-site quote visit, not quoting on the
   phone.
5. **Who's on point:** decide before launch (suggest: Macoy owns the
   checking ritual and logs into luckyapp, Riley calls). Every lead gets
   entered in luckyapp manually until the webhook lands — at single-digit
   volume that's fine.
6. **CSV habit:** download all leads from Leads Center at end of flight
   (and weekly if it ever runs longer) — the 90-day expiry is real.

### 2.3 Webhook bridge — Meta-side setup checklist

Built 2026-07-08: `/api/meta/leadgen` (webhook) + a Vercel cron polling
fallback now live in luckyapp (see `luckyapp/AGENTS.md`'s "Meta lead ads
bridge" quick map for the code side). Do this once that code is deployed —
one-time, ~30–45 min. Free forever, no paid bridge needed.

1. **Create a Meta app** at developers.facebook.com **inside Lucky's
   business portfolio** (the same one from §1) — type "Business". Add the
   **Webhooks** product.
2. **Webhooks product → Page → Subscribe:** callback URL
   `https://app.luckylandscapes.com/api/meta/leadgen`; verify token = the
   string you put in Vercel's `META_VERIFY_TOKEN`. Subscribe to the
   **`leadgen`** field. Click "Verify and Save" — this hits the route's
   `GET` handler; a failure almost always means the env var hasn't deployed
   yet or doesn't match exactly.
3. **Subscribe the Page to the app:** in Meta Business Suite (Page Settings
   → Webhooks/Advanced messaging) or via a one-time
   `POST /{page-id}/subscribed_apps?subscribed_fields=leadgen` call with a
   Page token, confirm Lucky's Page shows your app as subscribed — the
   app-level subscription in step 2 alone isn't enough.
4. **Generate a long-lived Page access token** via Graph API Explorer (pick
   the app + the Page + the `leads_retrieval` permission, plus whatever
   other Page-access scopes the tool prompts for — that list shifts, just
   grant what it asks), then exchange it for a long-lived token (the Access
   Token Debugger has an extend/"Open in Access Token Tool" option, or call
   `GET /oauth/access_token?grant_type=fb_exchange_token&...`). This is
   `META_PAGE_ACCESS_TOKEN`. Long-lived Page tokens don't expire on a timer,
   but sanity-check it periodically — it does go dead if the granting
   admin's password/permissions change.
5. **App Secret** (App Settings → Basic → Show) → `META_APP_SECRET`.
6. **Page ID** (Page → About, or Page Settings) → `META_PAGE_ID`.
7. **Set all four env vars in Vercel** (`META_VERIFY_TOKEN`,
   `META_APP_SECRET`, `META_PAGE_ACCESS_TOKEN`, `META_PAGE_ID`), redeploy,
   then finish step 2's verification.
8. **App Review:** `leads_retrieval` is a restricted permission.
   Development-mode access typically covers Pages you personally admin
   without a review — check Meta's current App Review dashboard for what it
   actually demands before assuming a full submission is needed; if it is,
   a short screen recording of a test lead landing in luckyapp is normally
   enough. **The Vercel cron polling fallback covers lead intake for real
   the whole time review is pending** (see §2 point 3) — don't block
   campaign launch on this step.
9. **Prove it before trusting it:** submit a real lead through the Instant
   Form's own preview/test tool, confirm it lands in luckyapp tagged `lead`
   / source `meta_lead_ads`, and that both Riley and Macoy get the alert
   email within a couple minutes.

## 3. The instant form (you build this from the **Create form** button
at the Ad level — §4 Level 3 step 7 — this section is the spec to follow
when that editor opens)

- **Form type: Higher Intent** (adds a review-and-confirm screen). Costs
  roughly 10–20% more per lead but kills accidental submissions — right
  trade for $5k+ projects. Known constraint (verified on Meta's own page):
  Higher Intent delivers **only on Facebook Feed + Instagram feed, mobile**.
  Acceptable — that's where most lead volume lives anyway.
- **Intro card:** headline "Tell us about your project." Short text:
  "Answer three quick questions. We'll call you back within 24 hours."
- **Questions (multiple choice only, no free text):**
  1. *What are you planning?* — Paver patio / Retaining wall / Fire pit or
     outdoor living / Mulch or garden bed refresh / Something else
  2. *When do you want it done?* — As soon as possible / In the next 1–3
     months / Next spring / Just getting prices for now
- **No budget question in v1.** At 5–10 total leads, a budget gate costs
  more signal than it saves. It's the first lever to add in campaign #2 if
  lead quality disappoints — needs Riley's real project-minimum number
  first (currently a TODO in services-pricing.md; don't invent one).
- **Contact fields:** Full name, Phone, Email. If the form builder shows a
  **"deselect autofill" toggle on the phone field, turn autofill OFF** —
  a hand-typed number is a dialable number (account-gated feature; use it
  if present).
- **Privacy policy URL (required):** https://luckylandscapes.com/privacy
- **Completion screen:** "Thanks — we'll call you within one business
  day." Button: **Call now** → the business line, plus link to
  luckylandscapes.com.
- **Name it** `LL-001-higher-intent-v1`. Published forms can't be edited —
  changes mean duplicate-and-rename (v2, v3…).

## 4. Campaign build — click by click

**First: the right front door.** Meta has TWO ad-creation surfaces and
Business Suite pushes the wrong one. The blue "Create ad" / "Boost"
buttons inside Business Suite (and on the Page) open the simplified
boost tool — if a screen offers goals like "Get more messages" or "Boost
a post," close it. Everything below happens in **Ads Manager:
adsmanager.facebook.com**, with the NEW Lucky ad account showing in the
account dropdown (top of the page). The mental model for every screen:
ads live in a three-layer stack — **Campaign** (the goal) → **Ad set**
(who sees it, budget) → **Ad** (the actual creative). The builder walks
those three levels in order, left sidebar shows which level you're on.

Since ~Feb 2026 there's one unified creation flow — everything starts as
"Advantage+" with AI defaults ON; you'll toggle several off. The
"Advantage+ On/Off" badge flipping to partial is cosmetic; the campaign
runs normally.

**Level 1 — Campaign**
1. Campaigns tab → green **+ Create** button.
2. Objective picker → **Leads** (older guides say "Lead Generation" —
   retired name, same thing) → Continue. If a "Buying type" dropdown
   appears, leave it on Auction.
3. If Meta offers a recommended/streamlined setup screen, look for the
   option to see all settings / manual setup — you want the full editor
   with Campaign → Ad set → Ad in the left column.
4. Campaign name: `LL-001-Leads-2026-07`.
5. **Special Ad Categories: declare NONE.** Landscaping is not housing/
   credit/employment. Declaring one (or tripping the classifier) kills
   zip targeting, age targeting, and income audiences. Related: the
   housing category includes "housing repairs" — ad copy never says
   "repair"; always *build / install / new / upgrade*.
6. Advantage+ campaign budget: with one ad set it behaves identically to
   an ad-set budget — set **$25/day** wherever the UI puts the budget
   field (campaign or ad set, just make sure it appears exactly once).
7. **Next**.

**Level 2 — Ad set (exactly one — never split $25/day)**
1. Ad set name: `LL-001-Lincoln-30plus`.
2. **Conversion location: Instant forms.** (Locked after publish —
   double-check before continuing.)
3. **Performance goal: "Maximize number of leads."** NOT "maximize
   number of conversion leads" — since April 2026 that one requires a
   CRM/Conversions-API hookup we don't have yet.
4. Facebook Page: Lucky Landscapes.
5. Budget & schedule: Daily budget **$25**. Start date: build day + 1
   morning. **Set an end date 12 days after start** — that plus the $310
   account cap is the double overspend guard.
6. Audience: the card defaults to **Advantage+ audience** — click the
   link/button to **"Switch to original audience"** (sometimes tucked
   below the audience card). Then:
   - Locations: clear the default "United States", then type each zip
     from the list below and pick the Nebraska match.
   - **Age: 30–65+.** Gender: all. Languages: leave as is.
   - Detailed targeting: leave EMPTY. Don't add interests.
- **Locations — enter these zips** (all verified against ACS 2024 5-year,
  median household income / median home value in parens):
  - *Lincoln core:* **68516** ($101k/$354k — the volume engine: Pine Lake,
    Williamsburg, Family Acres), **68526** ($114k/$447k — Yankee Hill
    corridor), **68512** ($104k/$322k — Wilderness Ridge, The Ridge),
    **68520** ($94k/$512k — Firethorn/HiMark; equity-rich retirees, don't
    drop it for the income number), **68523** ($142k/$509k), **68527**
    ($145k/$510k — Waterford Estates)
  - *Acreage belt:* **68430** Roca ($146k/$469k), **68461** Walton ($764k
    homes), **68402** Malcolm ($123k/$449k), **68462** Waverly
    ($120k/$323k), **68372** Hickman ($114k/$354k), **68358** Firth
    ($112k/$434k), **68339** Denton ($101k/$445k)
  - *Tiny but elite fringe (free to add):* **68532** ($180k MHI — highest
    in the metro), **68517** ($147k), **68514** ($122k)
  - Optional: 68317 Bennet. Skip Eagle, Beatrice, Seward, Fairbury.
  - Combined ≈ 38k housing units. If Ads Manager shows a zip with near-zero
    reach, replace it with a 1–3 mile pin on the same area.
  - Known limitation: targeting is "living in or recently in" — the
    residents-only option was removed in 2023. Some commuter/visitor bleed
    is unavoidable; Riley's callback filters it.
   Why empty detailed targeting: the zips are the wealth filter; creative
   and form do the qualifying. Interest stacks (Home Improvement, DIY…)
   are a campaign-#2 lever if quality is bad — and detailed-targeting
   *exclusions* no longer exist at all.
7. Placements: **leave "Advantage+ placements" selected** (Meta-
   recommended for instant forms; they open in-app so odd placements
   carry little risk).
8. **Next** — you're now at the Ad level.

**Level 3 — Ad (build Ad 1 fully, publish, then duplicate for 2 and 3)**
1. Ad name: `LL-001-Ad1-Montage`.
2. Identity: Facebook Page = Lucky Landscapes; Instagram account = the
   linked lucky.landscapes.
3. If a **"Lead Ads Terms"** acceptance appears — one-time per Page —
   accept it (needs Page admin; have Riley on hand if it blocks you).
4. Format: **Single image or video**. Upload the 4:5 montage render.
   Look for the placement preview / **"Edit placement media"** (pencil on
   the Stories/Reels preview) and swap in the 9:16 render there.
5. Find the **Advantage+ creative** (or "Optimize media") section →
   Edit → **turn every enhancement OFF** per the §5 kill-list. Do this
   on every ad, every time — they re-arm on new ads.
6. Primary text / Headline / Description: paste from §6 (one primary
   text, not both). **Call to action: Get quote.**
7. Scroll to the **Instant form** section at the bottom → **Create form**
   → build it exactly per §3 (type: Higher Intent, intro, 2 questions,
   contact fields, privacy URL, completion screen). Save.
8. **Publish** (green button, bottom right). It goes to "In review" —
   normal, usually clears within a few hours to a day.
9. Ads 2 and 3: Ads tab → tick the checkbox on Ad 1 → **Duplicate** →
   keep "same ad set" → in each copy swap the name
   (`LL-001-Ad2-BeforeAfter` / `LL-001-Ad3-Hero`), the media (carousel
   cards / hero photo — for the carousel change Format to Carousel), the
   §6 copy, and re-check the enhancements kill-list. The same LL-001
   instant form attaches to all three. Publish each.

**Done looks like:** 1 campaign → 1 ad set → 3 ads, each "In review"
then "Active." Spend starts on the schedule date. Now go set up §2's
checking ritual and don't touch anything until the day-4 checkpoint.

## 5. Creative production

**Renders needed (Macoy, ffmpeg on the 5090):**

| Asset | Cut | Formats |
|---|---|---|
| Wall build montage (timelapse segments + clips — camera position varies, that's fine) | ~15s: finished wall 2s → base prep 4s → block-laying 5s → finished + CTA 4s | 4:5 (1080×1350) for feeds + 9:16 (1080×1920) for Reels/Stories via placement asset customization |
| Before/after pairs | best 3–4 pairs | 1:1 (1080×1080) carousel cards, consistent ratio, before→after order |
| Finished hero shot | single strongest photo | 4:5 at 1440×1800 (Meta's current recommended res) |

**Timelapse edit rules (each one verified current guidance):**
- **Open on the payoff** — finished wall or the most dramatic mid-build
  moment in the first 2–3 seconds, then the build. Starting on bare dirt
  reads as "construction footage" and gets scrolled past.
- Design for **sound off**: burned-in text beats, 3–6 words each. Beat
  sketch: `Watch this wall go up` → `First: dig + base (the part that
  matters)` → `Block by block` → `Booking fall projects · Free quotes`.
- On the 9:16 render keep text in the middle band — UI chrome eats the
  top 14% and bottom ~35% on Reels.
- Photos: golden-hour lifestyle framing plus crisp workmanship (clean
  edges, tight joints). Real Lucky jobs only — never sub work, never
  stock, no crew faces.
- Before/after pairs are policy-safe: Meta's transformation-imagery
  restriction lives in the Health & Wellness standard (weight loss /
  cosmetic only — verified on the Transparency Center 2026-07-08). If an
  ad gets mis-flagged, appeal citing that scope.

**The enhancement kill-list (launch-day checklist, per ad):** new Leads
campaigns launch with ALL Advantage+ creative enhancements pre-selected
(~15–20 of them since Feb 2026), several generative. On each ad open
Advantage+ creative → Edit and **turn OFF**, at minimum: Text
improvements / text variations, Add overlays, Music, Image animation /
3D motion, Generate background, Expand image, Dynamic media, Flexible
format, Relevant comments, Site links. These are tuned for ecommerce and
will visibly mangle curated project photography (Expand image will
AI-extend your wall photos to fill 9:16). Harmless to leave: brightness/
contrast touch-ups, Enhance CTA.

## 6. Ad copy (character-checked: headline ≤27 visible, first ~125 chars
of primary text carry the whole message, description optional)

CTA button on all three: **Get quote**. Zero hashtags, zero emoji.

**Ad 1 — "The base" (timelapse video)**
- Primary A: `Most retaining walls fail because of what's under them.
  This is the base work we do before the first block gets set. Booking
  wall and patio projects around Lincoln for fall install.`
- Primary B: `Three days of wall building in thirty seconds. The first
  day is all digging and gravel. That's the part that keeps it straight
  through Nebraska winters. Booking fall projects now.`
- Headline: `Booking fall installs now` (25)
- Description: `Free quotes, Lincoln NE`

**Ad 2 — "Before/after" (carousel)**
- Primary A: `Same yards, before and after. If you've got a slope you
  can't use or beds you've given up on, tell us what you're picturing.
  You'll hear from us within 24 hours.`
- Primary B: `The before photos are why we take so many afters. Walls,
  patios, and full bed rebuilds across Lincoln. Free quotes, and you'll
  hear back within 24 hours.`
- Headline: `See the before and after` (24)
- Description: `Walls, patios, refreshes`
- Adjust the specifics to whatever the chosen pairs actually show.

**Ad 3 — "The crew that calls back" (finished hero image)**
- Primary A: `Paver patios, retaining walls, and full yard rebuilds,
  designed and built by a Lincoln crew that actually calls you back.
  Tell us what you're planning.`
- Primary B: `Projects like this start with a ten-minute conversation.
  Tell us what you're picturing and we'll take it from there. Lincoln
  and the surrounding acreages.`
- Headline: `Planning a patio project?` (25)
- Description: `Answers within 24 hours`

Copy rules baked in (don't regress): 24-hour **response**, never
"24-hour quote". No prices (Riley's numbers are TODO). No "repair". No
scarcity claims we can't back. No review counts or rot-prone trust
claims. Pick ONE primary text per ad at launch; the spare is the swap-in
if that ad dies at the day-5 checkpoint.

## 7. Flight rules — what to watch, when to act

Check Ads Manager every 1–2 days, **but only act at the checkpoints.**
Columns to add: Results, Cost per result, CPM, CTR (link), Frequency.

Sanity ranges (verified 2025–26 benchmarks): CPM $22–40 for lead
campaigns (lead objective prices ~3x above the "$14 average CPM" blogs
quote — don't be alarmed); CTR ≥1% fine, 1.9% is category median; form
submissions ÷ form opens ≥60% (below that the form has friction, not the
ad).

- **Day 1–2:** confirm all 3 ads Active (not rejected), money actually
  spending, impressions flowing. Nothing else.
- **Day 4–5 (~$100–125 spent):**
  - 0 leads → kill the worst ad (highest spend, no form opens), swap in
    the spare primary text. Do NOT touch audience, budget, or the form.
  - 1 lead → normal at this budget. Sit tight.
  - 2+ leads → on track. Touch nothing.
- **Day 8–9:** same rule once more. Also eyeball frequency — this small
  a geo will climb; >4 with fading CTR just means the flight is fatiguing
  on schedule, note it for next time.
- **Any day:** a lead comes in → the 15-minute SOP outranks everything
  else in this doc.

**Never do mid-flight:** budget changes >20%, audience edits, adding ad
sets, pausing/unpausing repeatedly, "fixing" Learning Limited. Every
significant edit resets learning and burns the remaining days.

## 8. Day-12 verdict

| Outcome | Read | Next move |
|---|---|---|
| CPL ≤ ~$40 (8+ leads), most reachable | Clearly working | Raise to $40/day in ≤20% steps or just keep $25/day rolling; remove the $310 cap deliberately |
| ~$43–60 CPL (5–7 leads), decent quality | On track | Continue with fresh creative (new hook on same timelapse body is the cheapest iteration) |
| CPL > ~$100 (≤3 leads) | Failing on cost | Stop. Fix offer/creative, then campaign #2: pixel + website-form conversions |
| Leads cheap but unreachable / all tire-kickers | Quality failure | Keep spend level; add budget-band qualifying question (needs Riley's minimum) and/or SMS verification; consider interest layer |
| ≥1 quoted $5k+ project | The actual win | The math works; formalize a monthly budget with Riley |

Whatever happens: download the leads CSV, log results in this doc
(spend, leads, CPL, reached %, quotes, jobs), and update STATE.md if
money moved.

## 9. Open blanks (Riley)

1. Whose card funds the new ad account (his personal card is already
   tangled up in the old KPM boost account — a dedicated Lucky card would
   keep the books clean).
2. Who owns the 3×-daily Leads Center check and who calls — and Saturday
   coverage (Riley has church; if that's a hole, Macoy takes Saturday).
3. (For campaign #2, not blocking) Real "projects start at $___"
   number to unlock budget-qualifying questions and price-anchored copy.

## 10. Campaign #2 backlog (deliberately NOT in this flight)

- Meta pixel + Lead event on luckylandscapes.com → website-form
  conversion campaign (higher-intent leads once there's budget/history).
- ~~Webhook bridge: Meta leads → luckyapp~~ — **built 2026-07-08, see §2.3**
  (replaces the vetoed paid alert tool). Code is done; the Meta-side setup
  checklist in §2.3 is still outstanding.
- Retargeting ad set: video viewers + IG/FB engagers (needs this flight
  to build the audience).
- Budget-band qualifying question / lead filtering gate.
- Fall push: bigger flight Aug–Oct riding peak hardscape season.

---

*Key sources: WordStream/LocaliQ FB lead benchmarks (2025-09), Focus
Digital CPL report (2025-07), Affect Group CPM 1Q26, Hatch speed-to-lead
(2024), Census ACS 2024 5-yr via Census Reporter (pulled 2026-07-08),
Meta help pages 252352181957512 (form types), 112167992830700 (learning
phase), 1526849577619206 (90-day lead expiry), Meta Transparency Center
health-wellness ad standard (before/after scope). Benchmark figures are
directional; the three primary datasets above are the only independent
ones — most "2026 benchmark" blogs recycle them.*
