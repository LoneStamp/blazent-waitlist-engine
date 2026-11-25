# Vineward — Founding Leaders Program (V4)

A responsive React + TypeScript + Vite website for recruiting and qualifying founding leaders to test Vineward with their discipleship groups.

## Stack

- React 18, TypeScript, Vite
- Framer Motion for restrained motion and reveal transitions
- Lucide icons
- Supabase for application data collection
- Custom responsive CSS (Vineward emerald / botanical visual identity)

## Run locally

```bash
npm install
cp .env.example .env.local
# Add your Supabase project URL and anon/publishable key to .env.local
npm run dev
```

## Configure Supabase (CLI-first)

This project is configured to use a dedicated table, `public.founding_leader_applications`. It does not read or modify your church's existing tables. Because this is a shared church project, review the SQL and confirm you have permission before applying it. A separate Supabase project is safer for production separation.

### 1. Install and initialize the Supabase CLI

From the website project root, initialize the local Supabase configuration if you are setting this repository up for the first time. The repository includes a minimal `supabase/config.toml` already.

Windows PowerShell (with Scoop):

```powershell
scoop install supabase
supabase --version
supabase login
```

Alternatively, use the official Supabase CLI installation instructions for your operating system.

### 2. Link this local project to your Supabase project

The supplied project URL corresponds to project ref `yifedrpireigcgizdeya`:

```powershell
supabase link --project-ref yifedrpireigcgizdeya
```

If the CLI asks for a database password, use the database password for that Supabase project. This is not the publishable key.

### 3. Apply the schema using migrations

The repository contains three ordered migrations: the baseline application table, tester verification/rewards, and private feedback-application retrieval. Apply all pending migrations with:

```powershell
supabase db push
```

This applies pending local migrations to the linked remote project. It does not upload your website files. If this Supabase project has existing migration history managed elsewhere, inspect it first with `supabase migration list` and coordinate before pushing.

### 4. Configure the website environment

Copy `.env.example` to `.env.local` and set:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

The publishable/anon key is intended for browser use when Row Level Security is correctly configured. Never put a `service_role` or secret key in a `VITE_` variable, source file, or browser bundle.

### 5. Run and deploy

```powershell
npm install
npm run build
npm run dev
```

Add the same two public environment variables to your hosting provider (for example, Vercel) before deploying.

### Alternative: SQL Editor

If you do not want to use the CLI, you can paste the complete `supabase/founding_leader_applications.sql` into the Supabase SQL Editor and run it. It includes the baseline schema and the V3 verification/reward workflow. Do not run both methods unnecessarily.

The public website can insert applications but cannot read, update, or delete applicant records. Review applications from the Supabase dashboard. Never put a Supabase `service_role` key in frontend environment variables.

## What the form collects

- Full name and email address
- Mobile platform (Android / iOS)
- Discipleship system (G12 Vision / adapting G12)
- Active disciple group size
- Optional church/ministry, leadership role, city/country, and Threads username
- Required commitments: 3+ disciples, 14+ days of use, and honest feedback
- Privacy consent
- Basic acquisition attribution from UTM parameters and document referrer

Email is normalized to lowercase and unique at the database level. The form uses the email the applicant identifies as connected to their Google Play or Apple account. Do not collect passwords or store app-store credentials.

## Attribution

Supports standard URL parameters such as:

`?utm_source=threads&utm_medium=organic&utm_campaign=founding_leaders`

These are stored with the application to help evaluate acquisition sources.

## Notes

- A successful registration is an application, not automatic selection.
- The form intentionally does not expose an applicant directory or public data retrieval endpoint.
- Add a separate authenticated admin workflow only if you need in-site application review or status management.


## Founding tester offer (version `founding-2026-v1`)

The website promises eligible, selected founding testers: (1) 12 months of premium access beginning when Vineward's public paid plans launch; (2) a digital Founding Tester badge/recognition with permission; (3) priority invitations to selected new-feature previews; and (4) opportunities to suggest and vote on improvements. Eligibility requires selection, at least 14 days of genuine testing with at least 3 participating disciples, and submission of requested feedback. It does not promise lifetime free access, permanent access to every future feature, or guaranteed future pricing. Communicate any paid plan or post-benefit offer before the free period ends.


## Founding tester verification and reward workflow (V3)

A registration checkbox is not proof of completion. The workflow separates applicant self-report from administrator-verified participation.

### What the new migrations add

- `supabase/migrations/20261125200000_add_tester_verification_and_rewards.sql`
- `supabase/migrations/20261125210000_feedback_application_retrieval.sql`

- Admin verification fields: `testing_started_at`, `testing_completed_at`, `verified_active_days`, `participating_disciple_count`, `usage_verified_at`, and `disciples_verified_at`.
- A feedback table with one final report per application.
- A public feedback RPC that validates the opaque feedback token and application email. A separate read-only RPC retrieves only the applicant details needed for the feedback confirmation screen after both values match. The feedback report is recorded but self-reported days/participants are not treated as verified.
- A database trigger that calculates `reward_eligible` only when all conditions are met:
  - application is selected/invited/active/completed;
  - testing start and completion timestamps are recorded and at least 14 days apart;
  - administrator verifies at least 14 active days;
  - administrator verifies at least 3 participating disciples;
  - usage and disciple verification timestamps are present;
  - feedback has been submitted.
- Reward approval remains manual. An admin sets `reward_approved_at` only after reviewing eligibility, then sets `premium_reward_start`. The database calculates `premium_reward_end` exactly 12 months later. It will not activate a reward while the application is ineligible or unapproved.

### Apply the new migration

From the repository root, after linking the correct Supabase project:

```powershell
supabase migration list
supabase db push
```

Do not run a migration against the church project until you have confirmed permission and reviewed the project migration history. The migration adds only Vineward-specific objects/columns; it does not alter unrelated church tables.

### Admin verification procedure (Supabase Dashboard)

Open **Table Editor → `founding_leader_applications`**. Find the application and:

1. When the leader is selected, change `status` to `selected` (or `invited`).
2. When testing actually begins, set `status = active` and `testing_started_at` to the verified start timestamp.
3. After the test period, review app activity evidence and confirm the group participation. Set:
   - `testing_completed_at` to the verified completion timestamp (must be at least 14 days after start);
   - `verified_active_days` to the number of distinct active days you verified (minimum 14);
   - `usage_verified_at` to the timestamp when you verified the activity;
   - `participating_disciple_count` to the verified number of participating disciples (minimum 3);
   - `disciples_verified_at` to the timestamp when you verified the group participation;
   - `status = completed`.
4. Ask the leader to submit the feedback form shown after application. Confirm `feedback_submitted_at` is populated. Review the report in **Table Editor → `founding_leader_feedback`**.
5. The trigger recalculates `reward_eligible`. When it becomes `true`, review the evidence and manually set `reward_approved_at` and `premium_reward_start`. The database calculates the 12-month end date in `premium_reward_end`.

Example admin SQL (replace the email and timestamps with verified values):

```sql
update public.founding_leader_applications
set
  status = 'active',
  testing_started_at = '2026-12-01T09:00:00Z'
where lower(email) = lower('leader@example.com');

-- Run only after checking actual app activity and group participation
update public.founding_leader_applications
set
  status = 'completed',
  testing_completed_at = '2026-12-15T09:00:00Z',
  verified_active_days = 14,
  usage_verified_at = now(),
  participating_disciple_count = 3,
  disciples_verified_at = now()
where lower(email) = lower('leader@example.com');

-- Only after reward_eligible = true and the feedback has been reviewed:
update public.founding_leader_applications
set
  reward_approved_at = now(),
  premium_reward_start = now()
where lower(email) = lower('leader@example.com')
  and reward_eligible = true;
```

### Important verification boundary

This website cannot independently prove how often the Vineward mobile app was used or whether three disciples really participated. Those facts must come from Vineward app telemetry, a verified participant roster, or administrator review. This version records the verification and enforces the reward rules in the database; it does not fabricate app activity or trust self-reported counts as proof. Integrate the mobile app's event data before automating usage verification end-to-end.

### Feedback privacy

The website returns no applicant directory and does not expose the feedback table. Feedback is submitted through a `SECURITY DEFINER` RPC using a random per-application feedback token plus the application email. Never expose a Supabase service-role key in the browser.


## Returning testers and application drafts (V4)

- An unfinished application is temporarily saved in `sessionStorage` for the current browser tab. It is a draft only and is not sent to Supabase until the applicant submits the form.
- After a successful application, the private feedback token is retained in `localStorage` on that browser for convenience. The application confirmation URL also contains the token so the tester can keep the private link.
- A returning tester selects **Already tested? I’m ready to give feedback**, enters the application email, and the site calls `get_founding_leader_for_feedback` with both the email and private token.
- The RPC returns only the application summary fields shown in the feedback portal. It does not expose an applicant list or grant direct table access.
- The tester can then submit one feedback report. The page displays a confirmation only after the feedback RPC succeeds.

**Email verification boundary:** this release verifies that the entered email matches the application associated with the private token. It does not send an OTP or prove inbox ownership. For true email-address ownership verification, configure an email OTP flow (for example, Supabase Auth with verified email) before describing this step as email verification. The private token must be kept confidential; anyone with both the token link and matching email can access the feedback portal.
