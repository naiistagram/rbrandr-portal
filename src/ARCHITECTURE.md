# Portal Architecture Reference

## Data Ownership Chain

All client data flows through `projects`. Nothing links directly to a user except `projects` itself.

```
profiles (users)
  └── projects          — via projects.client_id → profiles.id
        ├── content_items   — via content_items.project_id → projects.id
        ├── assets          — via assets.project_id → projects.id
        ├── documents       — via documents.project_id → projects.id
        ├── milestones      — via milestones.project_id → projects.id
        ├── forms           — via forms.project_id → projects.id
        ├── contracts       — via contracts.project_id → projects.id
        └── reports         — via reports.project_id → projects.id

profiles (users)
  └── tickets            — via tickets.submitted_by → profiles.id
  └── feedback           — via feedback.submitted_by → profiles.id
  └── notifications      — via notifications.user_id → profiles.id
```

**Rule: always query child data by `project_id`, never by a user/profile ID directly.**

To load all of a client's content: get their project IDs first, then `.in("project_id", projectIds)`.

---

## Actual DB Columns (content_items)

The source of truth is `supabase-schema.sql`. As of the current schema:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `project_id` | uuid NOT NULL | FK → projects |
| `title` | text NOT NULL | |
| `description` | text | nullable |
| `content_type` | text NOT NULL | enum: `post\|story\|reel\|ad\|email\|blog\|other` |
| `platform` | text | nullable, single value |
| `status` | text NOT NULL | enum: `draft\|in_review\|approved\|rejected\|published` |
| `scheduled_date` | date | nullable |
| `file_urls` | text[] | nullable |
| `feedback` | text | nullable |
| `created_by` | uuid | FK → profiles, nullable |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | auto-updated by trigger |

**There is no `client_id` column. There is no `platforms` (plural) column.**

---

## RLS Policies (content_items)

| Policy | Operation | Who | Condition |
|---|---|---|---|
| Project members can view content | SELECT | Clients | `projects.client_id = auth.uid()` |
| Clients can update content status/feedback | UPDATE | Clients | `projects.client_id = auth.uid()` |
| Clients can create content requests | INSERT | Clients | `projects.client_id = auth.uid()` |
| Admins can manage all content | ALL | Admins | `profiles.role = 'admin'` |

**All other tables follow a similar pattern — check `supabase-schema.sql` for the exact policies.**

---

## What NOT To Do

### 1. Don't add TypeScript fields for columns that don't exist in the DB
Adding `client_id?: string` or `platforms?: string[]` to a TypeScript interface makes them look safe to query and insert. If the column doesn't exist, every query using it fails silently (Supabase returns `null` data, no thrown error). The TypeScript type is not the DB schema.

**Rule:** only add fields to interfaces that exist in `supabase-schema.sql`.

### 2. Don't filter queries by a non-existent column
`.eq("client_id", userId)` on a table without a `client_id` column will return `{ data: null, error: { code: "42703" } }`. The code does `if (data) setItems(data)` — so it silently shows nothing.

**Rule:** before writing any `.eq("column", ...)`, confirm the column exists in `supabase-schema.sql`.

### 3. Don't add new enum values without updating the DB constraint
The `content_type` column has a CHECK constraint. Adding `"carousel"` to the TypeScript union and the UI without running:
```sql
ALTER TABLE content_items DROP CONSTRAINT content_items_content_type_check;
ALTER TABLE content_items ADD CONSTRAINT content_items_content_type_check
  CHECK (content_type IN ('post', 'story', 'reel', 'carousel', 'ad', 'email', 'blog', 'other'));
```
…means every insert with `content_type = 'carousel'` fails with a constraint violation.

**Rule:** any new enum value = a migration is required before shipping the UI change.

### 4. Don't insert non-existent columns — the whole insert fails
If you include `platforms: [...]` in a Supabase `.insert()` and the `platforms` column doesn't exist, PostgreSQL rejects the **entire** insert. No partial success. The form closes (because `setShowCreate(false)` runs unconditionally) but nothing is saved.

**Rule:** every field in an `.insert()` payload must map to a real DB column.

### 5. Don't forget INSERT RLS policies
Supabase RLS denies all operations unless a policy explicitly permits them. SELECT and UPDATE policies do not imply INSERT permission. A missing INSERT policy causes silent failures — the form submits, the UI closes, but nothing is in the database.

**Rule:** for any table where clients submit data, explicitly create a `FOR INSERT WITH CHECK (...)` policy.

### 6. Don't use client-side Supabase for admin operations
The client Supabase instance uses the anon key + the logged-in user's session. Admin operations (reading another user's data) must use `createAdminClient()` (service role key) which bypasses RLS. Using the client instance for admin operations fails RLS silently.

**Rule:** all `/api/admin/` routes use `createAdminClient()`. Client portal pages use `createClient()`.

### 7. Don't drive tab data from a project switcher
Switching the active project client-side and re-running Supabase queries can fail RLS. If it fails, all tabs go blank with no recovery except page reload. Tabs should load all data at page init (using all the client's project IDs) and not re-query when a project is clicked.

**Rule:** project selection in the admin UI is for editing project metadata only. It must not trigger content/asset/document re-fetches.
