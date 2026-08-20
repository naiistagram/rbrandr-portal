# Ideas / Future Features

Draft backlog of features discussed but not yet built. Not prioritized or scoped in detail — revisit and turn into real plans when ready to build.

## Direct chat with a human (you)

A persistent chat thread per client, separate from the ticket system — client messages go straight to you rather than into a ticket queue.

- New `messages` table scoped per project, with read/write rules similar to tickets
- Client-side chat UI (message list + input, persistent thread)
- Admin-side inbox: see all clients' chats in one place, unread indicators
- Online/offline status via Supabase's built-in Presence feature (green/gray dot)
- v1 option to cut scope: skip real-time, reuse the "reply box + refresh" pattern tickets already use; add live updates + presence later
- Rough scale: comparable to everything built in the 2026-08-19/20 session combined (preview portal + multi-platform + fixes) — several focused build sessions, not one

## WhatsApp integration

Considered two angles:

- **Admin uploading content via WhatsApp** — lower priority, admin already has the portal
- **Client approve/reject/request-changes via WhatsApp** — more promising. When content hits "in review," send the client a WhatsApp message (image + caption) with Approve / Reject / Request changes buttons; a webhook resolves which `content_items` row the reply is about and calls the same status/feedback update the portal's Content page already does
- Needs: client phone number collected + verified against their portal account (to avoid spoofing), and Meta's template-approval process for any message the business sends first (replies within a 24h window are unrestricted)
- Free-text "can you change the caption to..." is the hard part — either a fixed reply menu or an LLM in the loop to parse intent

## AI chatbot (client-facing support)

Considered instead of (or alongside) the direct-chat idea above — likely superseded by the "direct chat with a human" plan, but worth remembering as an option:

- Read-only Q&A bot answering "where's my content," "how do I submit a ticket" using live portal data as context — lowest risk, weekend-scale
- Content assistant for admins (draft captions, platform variants) — internal tool, not client-facing
- "Ask your data" bot for admins (e.g. "which clients have pending content over 3 days")
- Anything that lets the bot *take actions* (reply to tickets, change status) needs the same guardrail thinking as the WhatsApp idea

## Separate design/staging environment

- Check first: Vercel likely already builds a preview URL per branch (e.g. `dev`) — may already have this for free
- Fuller version: a permanent `dev.portal.rbrandr.com`-style domain tracking the `dev` branch, optionally with its own Supabase project + fake data so nothing touched there can affect real client data
