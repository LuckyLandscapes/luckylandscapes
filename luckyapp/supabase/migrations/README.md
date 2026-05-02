# Supabase Migrations

Run these SQL files **in order** in the Supabase SQL Editor when setting up a
new database. Do NOT use `FULL_REBUILD.sql` — it is deprecated and out of date.

When two files share a numeric prefix (e.g. `006_break_minutes.sql` and
`006_job_media.sql`), run them in alphabetical order within that prefix. The
prefix is a sort key, not a uniqueness guarantee.

| # | File | Purpose |
|---|---|---|
| 001 | `001_initial_schema.sql` | Core tables: orgs, team, customers, quotes, materials, activity + RLS + triggers |
| 002 | `002_full_schema.sql` | Extended schema with services, indexes, quote sequences |
| 003 | `003_calendar_and_jobs.sql` | Jobs + calendar events tables, RLS, indexes |
| 004 | `004_time_tracking.sql` | Time entries table, hourly rates, RLS |
| 005 | `005_project_financials.sql` | Job expenses, revenue column, job→time entry link |
| 006a | `006_break_minutes.sql` | Adds `break_minutes` column to time_entries |
| 006b | `006_job_media.sql` | Job media table, storage bucket, auto-cleanup function |
| 007a | `007_invoices.sql` | Invoices table with status tracking and RLS |
| 007b | `007_job_priority.sql` | Adds `priority` column to jobs |
| 008 | `008_calendar_assigned_to.sql` | Adds `assigned_to` column to calendar events |
| 009 | `009_storage_buckets.sql` | Quote PDF storage bucket and access policies |
| 010 | `010_fix_rls_policies.sql` | RLS policy fixes + onboarding RPC function |
| 011 | `011_fix_role_constraint.sql` | Updates allowed role values in team_members |
| 012 | `012_enable_realtime.sql` | Enables Supabase realtime for key tables |
| 013 | `013_financial_revamp.sql` | Restructured financial model |
| 014 | `014_online_payments_and_sending.sql` | Stripe payments table + invoice public_token |
| 015 | `015_fix_public_token_url_safe.sql` | Migrate existing tokens to URL-safe encoding |
| 016 | `016_customer_measurements.sql` | Customer property measurements |
| 017 | `017_quote_public_links.sql` | Quote public_token for shareable links |
| 018a | `018_catalog_stock.sql` | Catalog SKU + stock tracking |
| 018b | `018_notifications.sql` | In-app + push notifications |
| 019 | `019_receipts_and_dunning.sql` | Receipts bucket + invoice_reminders audit log |
| 020 | `020_quote_media.sql` | Quote photos/video table + bucket |
| 021 | `021_quote_media_customer_and_cleanup.sql` | Customer-uploaded media + cleanup |
| 022 | `022_quote_media_video_audio.sql` | Video/audio kinds for quote media |
| 023a | `023_contracts.sql` | Service agreements table |
| 023b | `023_quote_media_nullable_quote_id.sql` | Allow media before quote exists |
| 024a | `024_contracts_pdf_and_storage.sql` | Contract PDFs bucket + storage |
| 024b | `024_time_segments.sql` | Real-time shift segments (job/travel/break) |
| 025 | `025_mileage.sql` | IRS mileage log table |
| 026 | `026_contractors.sql` | 1099 contractors + W-9 storage |
| 027 | `027_catalog_enhancements.sql` | Catalog material attributes + media (superseded by 031) |
| 029 | `029_job_workday_set.sql` | Multi-day jobs as a `scheduled_dates` JSONB workday set |
| 030 | `030_suppliers_table.sql` | Suppliers master table (Outdoor Solutions, Menards, Home Depot) with default tax rate |
| 031 | `031_materials_rebuild.sql` | **Drops + rebuilds materials** with supplier_id FK, single unit_cost + tax_rate, customer-visible flag, dropped image/image_emoji/cost_low/cost_high redundancy. Take a Supabase backup first. |
| 032 | `032_selected_materials.sql` | Adds `selected_materials` JSONB to quotes + contracts (visual material approval, no prices) |

> **Files 001 and 002 overlap.** Both create base tables. Run 001 first — its
> `CREATE TABLE IF NOT EXISTS` statements prevent conflicts when 002 runs.

> **`FULL_REBUILD.sql` is deprecated.** It only covers 001–013 and is missing
> 14 newer tables (payments, contracts, time_segments, contractors, etc.).
> Always run the numbered files in order; do not use the rebuild script.
