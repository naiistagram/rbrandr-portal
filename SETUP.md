# rbrandr Client Portal — Setup Guide

## Step 1: Create a Supabase Project (Free)

1. Go to [supabase.com](https://supabase.com) and sign up / log in
2. Click **New Project**
3. Choose a name (e.g. `rbrandr-portal`) and a strong database password
4. Select a region close to you (Europe West is good)
5. Click **Create new project** and wait ~2 minutes

---

## Step 2: Run the Database Schema

1. In your Supabase project, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Open the file `supabase-schema.sql` from this project folder
4. Copy ALL the contents and paste into the SQL editor
5. Click **Run** (or press Cmd+Enter)

---

## Step 3: Get Your API Keys

1. In Supabase, go to **Project Settings** → **API**
2. Copy:
   - **Project URL** (e.g. `https://abcxyz.supabase.co`)
   - **anon / public key** (the long string under "Project API keys")
   - **service_role key** (click "Reveal" — keep this secret!)

---

## Step 4: Set Up Environment Variables

Open the file `.env.local` in this project and fill in your values:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For email notifications, get a free Resend API key at [resend.com](https://resend.com):
```
RESEND_API_KEY=re_your_key_here
```

---

## Step 5: Run the Portal Locally

Open your terminal, navigate to this folder, and run:

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Step 6: Create Your Admin Account

1. Go to `http://localhost:3000/signup`
2. Create your account with your rbrandr email
3. In Supabase → **Table Editor** → `profiles` table
4. Find your row and change `role` from `client` to `admin`

---

## Step 7: Add a Client

1. Share the signup link with your client: `http://localhost:3000/signup`
2. Once they sign up, go to Supabase → **Table Editor** → `projects`
3. Click **Insert row** and fill in:
   - `client_id`: the client's user ID (find in the `profiles` table)
   - `name`: project name (e.g. "Brand Refresh 2024")
   - `service_type`: `website`, `marketing`, or `both`
   - `goals`: paste their project goals text
   - `competition`: competitive landscape notes
   - `kpis`: add as JSON, e.g. `[{"label": "Monthly Reach", "value": "10,000"}, {"label": "Engagement Rate", "value": "4.5%"}]`

---

## Step 8: Deploy to Vercel (Free)

1. Push this project to a GitHub repo
2. Go to [vercel.com](https://vercel.com) and import the repo
3. In the deployment settings, add all your environment variables from `.env.local`
4. Change `NEXT_PUBLIC_APP_URL` to your Vercel domain
5. Deploy — your portal is live!

---

## How to Add Content to the Calendar

In Supabase → **Table Editor** → `content_items`, insert a row:
- `project_id`: your client's project ID
- `title`: content title
- `status`: start with `in_review` so the client can approve/reject
- `scheduled_date`: the planned post date
- `platform`: e.g. Instagram, TikTok
- `content_type`: post, reel, story, etc.
- `description`: caption or content brief

The client will be notified in real time and can approve, reject, or give feedback.

---

## How to Add a Contract

1. Upload the PDF to Supabase **Storage** → `contracts` bucket
2. Copy the file URL
3. In Supabase → `contracts` table, insert:
   - `project_id`: client's project
   - `title`: e.g. "Service Agreement — Q1 2025"
   - `file_url`: the storage URL
   - `status`: `pending`

The client will see it in their Contracts page and can sign digitally.

---

## Cost Summary

| Service | Cost |
|---------|------|
| Supabase (free tier) | £0/month |
| Vercel (hobby) | £0/month |
| Resend (3k emails/month) | £0/month |
| **Total** | **£0/month** |

Supabase free tier supports 500MB DB + 1GB storage — enough for ~10 clients.
When you scale up, Supabase Pro is $25/month.
