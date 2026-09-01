# SimpliSchedule

A small, self-hostable Cal.com alternative. Connect any number of Google accounts, define bookable
booking links with weekly availability, share short booking links, and copy pasteable availability
text ("Here's my availability (PDT)… or book directly here: …") from the dashboard or from Raycast.

- **Next.js 16** (App Router) · **bun** · **shadcn/ui** · **Drizzle** on Postgres · **better-auth**
- Everything lives in a dedicated `scheduling` Postgres schema, so it can share a database
  (Supabase, RDS, a local container) with other apps without touching their tables.
- Multi-user from day one: every user sees only their own accounts, booking links and bookings.
  The first account created becomes admin and can close signups, or set `SINGLE_USER=true` to lock
  the instance to that one account.

## Getting started (local dev)

You need [bun](https://bun.sh) and Docker. No Google credentials required.

```bash
bun install
cp .env.example .env           # then set CALENDAR_PROVIDER=none to skip Google for now
docker compose up -d           # Postgres on localhost:5439
bun run db:migrate             # creates the `scheduling` schema + tables
bun dev                        # http://localhost:3000
```

The defaults in `.env.example` already point at the Docker database, and `CALENDAR_PROVIDER=none`
lets you exercise signup → booking link → booking without any Google account. Open
http://localhost:3000/signup and create the first user; it becomes admin.

To test the real Google Calendar integration locally, follow [Google Cloud setup](#1-google-cloud-setup)
below with `APP_URL=http://localhost:3000`, then set `CALENDAR_PROVIDER=google`.

## Deployment

The app is a standard Next.js server. It needs a Postgres database, a public HTTPS URL, and a
Google OAuth client. Work through these in order.

### 1. Google Cloud setup

You need this for connecting calendars. It takes about ten minutes.

1. Go to https://console.cloud.google.com and create a project (or pick an existing one).
2. **Enable the Calendar API:** *APIs & Services → Library*, search "Google Calendar API", click **Enable**.
3. **Configure the consent screen:** *APIs & Services → OAuth consent screen* (called *Google Auth Platform* in newer consoles).
   - App name: anything, e.g. `Scheduling`. Support email and developer contact: your email.
   - Audience / User type: **External** (or **Internal** if everyone is in one Google Workspace org; Internal skips the verification hassle entirely).
   - Scopes: click *Add or remove scopes* and add these three:
     - `https://www.googleapis.com/auth/calendar.readonly`
     - `https://www.googleapis.com/auth/calendar.events`
     - `https://www.googleapis.com/auth/userinfo.email`
   - Test users: while the app's publishing status is **Testing**, add every Google account you plan to connect. Accounts not on this list get a "This app is blocked" error.
4. **Create the OAuth client:** *APIs & Services → Credentials → Create credentials → OAuth client ID*.
   - Application type: **Web application**.
   - Authorized redirect URIs, replacing `https://sched.example.com` with your real `APP_URL`:
     - `https://sched.example.com/api/google/callback` (connecting calendars, always required)
     - `https://sched.example.com/api/auth/callback/google` (only if you turn on `GOOGLE_LOGIN_ENABLED`)
   - Save and copy the **Client ID** and **Client secret**. These become `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
5. **Publish the app before relying on it.** With status **Testing**, Google expires refresh tokens
   after 7 days, so connected calendars silently stop working weekly. Go to the consent screen and
   click **Publish app**. For personal use you can ignore the verification prompt; users just see an
   "unverified app" warning once when connecting. Internal (Workspace) apps do not have this problem.

Redirect URIs must match `APP_URL` exactly, including scheme and no trailing slash. Google only
allows `http://` for `localhost`; everything else must be `https://`.

### 2. Database

Any Postgres 14+ works. Create a database (or reuse one; the app only touches the `scheduling`
schema) and grab its connection string.

- **Supabase:** *Project Settings → Database → Connection string*. Use **Direct connection** or
  **Session pooler**. The transaction pooler (port 6543) does not work with migrations.
- **Neon / RDS / Railway / your own box:** the normal `postgres://user:pass@host:5432/db` URL.

Do not add a `?schema=` parameter to the URL. The app hardcodes the `scheduling` schema in its
table definitions and migrations, so it never depends on the connection's search path, and a
`schema=` query parameter is not something Postgres or this driver understands. Just point it at
the database. If your password has special characters like `#`, `!` or `@`, URL-encode them.

Run the migrations from your machine against the production database:

```bash
DATABASE_URL="postgres://..." bun run db:migrate
```

Re-run this whenever you deploy a version with new files in `drizzle/`.

### 3. Environment variables

Set these on your host. Generate the two secrets with `openssl rand -base64 32`.

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Connection string from step 2. |
| `APP_URL` | Public URL, e.g. `https://sched.example.com`. No trailing slash. Must match the redirect URIs from step 1. |
| `BETTER_AUTH_SECRET` | Random 32+ character string. Changing it logs everyone out. |
| `ENCRYPTION_KEY` | Random 32+ character string. Encrypts Google refresh tokens. Changing it breaks all connected calendars. |
| `GOOGLE_CLIENT_ID` | From step 1. |
| `GOOGLE_CLIENT_SECRET` | From step 1. |
| `GOOGLE_LOGIN_ENABLED` | `true` to show "Continue with Google" on the login page. Default `false`. |
| `CALENDAR_PROVIDER` | `google` (default). |
| `SINGLE_USER` | `true` to lock the instance to one account. The first signup becomes admin, then every signup path is disabled. Default `false`. |

### 4. Run it

**Vercel** (or Netlify, Railway, Render, Fly). Connect the repo, add the env vars above, deploy. The
build is `bun run build`; hosts detect `bun.lock` automatically. Migrations are not run on deploy,
so run step 2 yourself.

**Any server with bun:**

```bash
bun install --frozen-lockfile
bun run build
PORT=3000 bun run start
```

Put it behind a reverse proxy (Caddy, nginx, Cloudflare Tunnel) that terminates TLS at `APP_URL`.

### 5. First run

1. Open `{APP_URL}/signup` and create your account. The first user becomes admin.
2. Lock it down: set `SINGLE_USER=true` if it is just you, or go to **Dashboard → Admin** and turn off
   signups if a few people share the instance.
3. **Dashboard → Calendars → Connect Google account.** Pick the calendars that should block
   availability with the "check for conflicts" switch.
4. Create an booking link, pick the calendar bookings should land on, and share the `/b/...` link.

Bookings create a Google Calendar event with a Meet link and invite the booker.

## Copy availability

Dashboard → Overview has a widget that renders text like the below and copies it as plain text plus
rich text, so each time block is a link to the booking page for that day and block:

```
Here's my availability (PDT) over the next few days:

• Mon, Sep 1: 9:00am–11:30am, 1:00pm–3:00pm
• Tue, Sep 2: 10:00am–12:00pm

Or book directly here: https://your-host/b/k3j9x
```

The same text is served by `GET /api/availability/text`:

| Query param | Meaning |
| --- | --- |
| `eventType` | slug, id or short code. Defaults to your oldest active booking link. |
| `days` | how far ahead to look (1–30, default 5) |
| `tz` | IANA timezone for the output (default: the booking link's timezone) |
| `format=html` | same content with each time block linked to the booking page for that day/block |
| `format=json` | return `{ text, html, slots, errors }` instead of plain text |

Authenticate with your session cookie or `Authorization: Bearer sched_…` using an API key from
**Dashboard → Settings**.

### Raycast

`raycast/copy-availability.sh` is a [Raycast script command](https://github.com/raycast/script-commands).

1. Create an API key in Settings and save the config:
   ```bash
   mkdir -p ~/.config/scheduling
   cat > ~/.config/scheduling/env <<'EOT'
   SCHEDULING_URL=https://your-host
   SCHEDULING_API_KEY=sched_...
   SCHEDULING_EVENT_TYPE=intro          # optional default slug
   SCHEDULING_TZ=America/Los_Angeles    # optional
   EOT
   ```
2. In Raycast: *Extensions → Script Commands → Add Directories* and pick the `raycast/` folder.
3. Run **Copy Availability**, optionally passing days / slug / timezone. The text lands on your clipboard
   as plain text plus rich text, so pasting into Mail, Gmail or Notion links each time block to the
   booking page.

## Development

```bash
bun run typecheck
bun run test          # availability engine (vitest)
bun run lint
bun run db:generate   # after editing src/db/schema.ts, then bun run db:migrate
bun run db:studio     # browse the database
```

## Layout

```
src/db/schema.ts             all tables, in the `scheduling` pg schema
src/auth/                    better-auth server/client + session helpers
src/lib/availability/        pure slot engine (windows → slots → text) with tests
src/lib/google/              OAuth, free/busy, event insert
src/lib/booking.ts           open slots + create booking
src/app/(dashboard)/         authenticated UI + server actions
src/app/[username]/[slug]    public booking page;  /b/[code] short link;  /booking/[id] confirmation
src/app/api/                 auth, google oauth, slots, book, availability/text
drizzle/                     SQL migrations;  scripts/migrate.ts applies them
raycast/                     script command
```

## Roadmap

Outlook / CalDAV providers · reschedule links · custom booking questions · organizations (tenancy
groups) via better-auth's organization plugin.
