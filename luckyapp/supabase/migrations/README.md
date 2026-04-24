# Supabase Migrations

Run these SQL files **in order** in the Supabase SQL Editor when setting up a new database.

| # | File | Purpose |
|---|---|---|
| 001 | `001_initial_schema.sql` | Core tables: orgs, team, customers, quotes, materials, activity + RLS + triggers |
| 002 | `002_full_schema.sql` | Extended schema with services, indexes, quote sequences |
| 003 | `003_calendar_and_jobs.sql` | Jobs + calendar events tables, RLS, indexes |
| 004 | `004_time_tracking.sql` | Time entries table, hourly rates, RLS |
| 005 | `005_project_financials.sql` | Job expenses, revenue column, job→time entry link |
| 006 | `006_job_media.sql` | Job media table, storage bucket, auto-cleanup function |
| 007 | `007_invoices.sql` | Invoices table with status tracking and RLS |
| 008 | `008_calendar_assigned_to.sql` | Adds `assigned_to` column to calendar events |
| 009 | `009_storage_buckets.sql` | Quote PDF storage bucket and access policies |
| 010 | `010_fix_rls_policies.sql` | RLS policy fixes + onboarding RPC function |
| 011 | `011_fix_role_constraint.sql` | Updates allowed role values in team_members |
| 012 | `012_enable_realtime.sql` | Enables Supabase realtime for key tables |

> **Note:** Files 001 and 002 have some overlap (both create base tables). If setting up from scratch, run 001 first — its `CREATE TABLE IF NOT EXISTS` statements prevent conflicts when 002 runs.
