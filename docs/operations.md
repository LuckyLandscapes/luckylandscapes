**Last updated:** 2026-04-27
**Confidence:** Partially Known 

# Operations — How the work gets done

## Crew structure
- **Total headcount:** Full Time(1) Seasonal(6)
- **Crews / teams:** 1 Crews (4 people a crew)
- **Roles on a crew:** Crew Leader, Laborer
- **Pay structure:** Hourly $17.50 for laborers, $22.50 for crew leaders.

## Time tracking — shift + segment model
Workers use the **Today Cockpit** at [`/crew-dashboard`](../luckyapp/src/app/(dashboard)/crew-dashboard/page.js). The model:
- **One shift per day per worker** (clock in once, clock out once).
- Within a shift, workers move between **segments**, recorded in real time:
  - `job` — paid, attributed to a specific property (used for job costing)
  - `travel` — paid, indirect (driving, yard, loading)
  - `break` — unpaid, real-time start/stop (no more retroactive guessing)
- Owners see a live "who's on the clock and what are they doing" strip on the main dashboard.
- Workers can tap blocker chips ("Rain delay", "Customer not home", "Need more material") which attach a note to the current segment so issues surface without anyone having to write a paragraph at end of day.
- Schema: see [`024_time_segments.sql`](../luckyapp/supabase/migrations/024_time_segments.sql). The legacy `time_entries.break_minutes` column is now derived (sum of break-segment durations) on shift end, so older payroll math still works.

## Scheduling
- **How jobs get on the calendar:** Once a quote is approved and materials, delivery fee, etc. are paid, we schedule the job on the calendar, can pay rush fee to get moved forward. (% of of volume of work moved backwards by rush fees is unknown as of now)
- **Tool of record:** luckyapp calendar / Google Calendar (the app syncs with Google Calendar via [`src/lib/googleCalendar.js`](../luckyapp/src/lib/googleCalendar.js))
- **Routing logic:** TODO (geographic clustering? service-type batching?)
- **What blows up the schedule:** Weather, Not having enough crew members, poor planning on our part, customers not paying us. 

## Seasonal cadence
Landscaping is brutally seasonal. Spell out the year:
(This info is unknown as its our first year running the buisness)
| Period | What's running | Crew load | Cash flow |
|---|---|---|---|
| Spring (Mar–May) | TODO | TODO | TODO |
| Summer (Jun–Aug) | TODO | TODO | TODO |
| Fall (Sep–Nov) | TODO | TODO | TODO |
| Winter (Dec–Feb) | TODO (snow? off-season?) | TODO | TODO |

- **Hardest week of the year:** TODO
- **Slowest week of the year:** TODO

## Equipment
- **Owned trucks / trailers:** Own 2004 Ram 1500 2x4 shortbox, small utility trailer,12k lb 6x12 dump trailer 3ft walls (purchased brand new in 2026)
- **Major equipment (mowers, skid steer, etc.):** Echo 14'' demolition saw, one zero turn mower(toro timecutter 52" deck), Stihl commercial blowers, stihl trimmers, Stihl edger, Stihl hedge trimmers, 
- **Maintenance approach:** in house 
- **Recent / planned capex:** Buying a new truck in the near future, Enclosed Trailer

## Vendors & suppliers
| Category | Vendor | Account / contact | Notes |
|---|---|---|---|
| Mulch / soil / stone | Outdoor Solutions | TODO | TODO |
| Plants / nursery | Outdoor Solutions | TODO | TODO |
| Hardscape materials | Menards, Home Depot | TODO | TODO |
| Fuel | Any Gas Station | TODO | TODO |
| Equipment rental | (as we are both under 21 we have a sub who we can rent from.) | TODO | TODO |

## Software stack (operational)
- **Quote intake:** Google Apps Script → Google Sheet + Google Drive (photos) + Gmail. Setup details in [`scripts/SETUP-INSTRUCTIONS.md`](../scripts/SETUP-INSTRUCTIONS.md).
- **Job / customer / invoice / time tracking:** luckyapp (Next.js app on Vercel, Supabase backend).
- **Payments:** Stripe (via luckyapp).
- **Email to customers:** Resend (via luckyapp).
- **Calendar sync:** Google Calendar (via luckyapp).
- **Accounting / books:** Nothing as of now but hoping the luckyapp will have something in the near future.
- **Payroll:** Luckyapp
- **Insurance / certs:** WE HAVE TO GET THIS FIGURED OUT, NOT LEGALLY COVERED FOR ANYTHING, have LLC AND EIN

## Customer lifecycle
1. **Lead in:** Refferals, family, social media, yard signs, we rank fairly well on google for lincoln nebraska landscaping, yelp.
2. **Quote:** We go out and see the property and get measurements and assess the job, sometimes being able to do digital quotes, but usually go out and see the job, then we create a quote in the luckyapp and send it to the customer.
3. **Sold:** We require materials, delievry fee, etc upfront to secure the job, then we schedule it on the calendar.
4. **Scheduled & worked:** We usually work the job within the next week of the customer paying the deposit, we try to get as much done in one day as possible to be efficient, we try to be done with most residential jobs in 1-2 days unless its something big like hardscaping.
5. **Invoiced & paid:** We usually invoice the customer for the remaining balance upon job completion, we try to get paid within 7-14 days of the invoice date, the invoice says the have 30 days to pay, if they dont we will call them and remind them, we havent had to send anyone to collections yet.
6. **Retained:** We try to get recurring customers by doing good work and being reliable, word of mouth is our best form of marketing, we put yard signs in yards and ask for google reviews.

## Known operational pain points
Us just being young and not having any real management experience is the biggest. Being able to off load work of riley and have him just focus on quotes sales and leading crews.
