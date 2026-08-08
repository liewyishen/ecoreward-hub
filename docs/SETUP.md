# Setup

Running EcoReward Hub locally.

← back to [README](../README.md) · [API](API.md) · [Schema](SCHEMA.md) · [Stack](STACK.md) · [Security](SECURITY.md) · [Engineering notes](ENGINEERING.md)

---

## Prerequisites

- **Node.js ≥ 18** — developed and tested on v24.15.0
- **MySQL ≥ 8.0 or MariaDB ≥ 10.2** — the schema uses a window function and inline `CHECK (json_valid(...))`
- **A Google Gemini API key** — required; scanning and the chatbot both fail without it

Optional, each disabling only its own feature:

- Google OAuth 2.0 credentials — "Sign in with Google"
- A Google Maps JavaScript API key — the facility map
- SMTP credentials — welcome and approval emails

---

## 1. Database

```bash
mysql -u root -p -e "CREATE DATABASE ecoreward_db;"
```

**The SQL dump is not distributed with this repository.** The working database held real user rows — addresses and bcrypt password hashes — so the dump was excluded from the repository rather than scrubbed. There is no `server/ecoreward_db.sql` to import.

Build the schema from **[SCHEMA.md](SCHEMA.md)** instead. It documents all 12 base tables and `view_leaderboard` at field level: every column with its type, nullability, default, constraint, index, and foreign key, plus the two inline `CHECK (json_valid(...))` constraints and the window function in the view. That is the authoritative reference — it was transcribed from the same database the dump came from.

Four tables need seed rows before the app behaves correctly:

| Table | Seed data | Consequence if empty |
|---|---|---|
| `item_type_stats` | 6 rows, one per `item_type`, each with `base_points` (E-waste 25, Metal 15, Glass 12, Plastic 10, Paper 8, Organic 5) | Scan submission cannot compute points |
| `achievements` | 6 rows | Achievement evaluation silently unlocks nothing |
| `rewards` | Any number; the reference set is 5 | The rewards catalogue and the chatbot redemption flow have nothing to offer |
| `recycling_facilities` | Any number with `is_verified = 1`; the reference set is 4 around Kuala Lumpur | The facility map renders no markers and scan submission has no drop-off to select |

Users, scans, and posts are not fixtures — no code depends on any particular row. Register through the UI to create your own.

---

## 2. Server

```bash
cd server
npm install
cp .env.example .env
```

Generate a real secret rather than inventing a phrase:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Fill in `.env`:

```env
PORT=5000

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=ecoreward_db

JWT_SECRET=            # paste the generated value

GEMINI_API_KEY=

# Optional — Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# Optional — email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

FRONTEND_URL=http://localhost:5173
```

**`SMTP_FROM` is missing from the committed `.env.example`** but is read by every mailer. Add it manually if you want outbound email.

```bash
npm run dev      # nodemon
# or
npm start
```

On a successful boot the server logs `✅ Database connected successfully`. If the pool cannot connect, `config/db.js` calls `process.exit(1)` — the process will not start in a degraded state.

---

## 3. Client

```bash
cd client
npm install
```

Create `client/.env` for the map:

```bash
cp .env.example .env     # then fill in VITE_GOOGLE_MAPS_API_KEY
```

```bash
npm run dev
```

The app runs on `http://localhost:5173`, the API on `http://localhost:5000`. The API URL is currently hardcoded in the client rather than read from an environment variable.

> `client/.gitignore` does not list `.env`, unlike `server/.gitignore`. The root `.gitignore` covers the gap — it ignores `.env` and `*/.env` at every level while re-including `.env.example` — so the asymmetry cannot leak a key. It is still worth fixing at source: a subdirectory `.gitignore` that omits `.env` is a trap for anyone who copies it into another project.
>
> Note also that `VITE_GOOGLE_MAPS_API_KEY` is not a secret in the first place. Vite inlines `VITE_*` variables into the bundle at build time, so the key ships to every visitor. It is protected by HTTP referrer restrictions in the Google Cloud Console, not by being kept out of the repository — see `client/.env.example`.

---

## 4. Create an admin

Registration always creates a regular user — the server ignores any role in the request body. Promote an account directly:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

No logout is required. `verifyToken` reads `role` from the database on every request, so an existing session gains admin access on its next call. Demotion works the same way in reverse.

---

## Verifying the install

```bash
# health check — no auth
curl http://localhost:5000/

# public endpoint — should return the 5 seeded rewards
curl http://localhost:5000/api/rewards

# protected endpoint without a token — should return 401
curl -i http://localhost:5000/api/user/profile
```

Register through the UI, then confirm the account landed correctly:

```sql
SELECT user_id, username, role, is_active, total_points FROM users ORDER BY user_id DESC LIMIT 1;
```

A new account should show `role = 'user'`, `is_active = 1`, and `total_points = 150` from the welcome bonus.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| Server exits immediately with a connection error | `config/db.js` calls `process.exit(1)` when the pool cannot connect. Check that MySQL is running and `DB_*` are correct |
| Every authenticated request returns 500 | `verifyToken` cannot reach the database. It fails closed by design rather than letting requests through — check the pool, not the token |
| `401 Account is inactive or no longer exists` | `users.is_active = 0` for that account, or the row was deleted. Bans take effect on the next request, not at token expiry |
| `403 Access denied. Admin only.` | Authenticated, but `users.role` is not `'admin'`. Distinct from 401 — the token itself is valid |
| `401 Invalid or expired token` right after changing `.env` | `JWT_SECRET` changed. Every previously issued token is now invalid; log in again |
| Scan analysis returns 500 | Check `GEMINI_API_KEY` and quota. `config/gemini.js` logs the underlying error |
| Scan analysis returns `type: "Unknown"` | Gemini returned unparseable output. The route returns the fallback object with `success: false` rather than throwing |
| Registration succeeds but no email arrives | Email is fire-and-forget and never blocks registration. Check `SMTP_*`, including `SMTP_FROM` |
| Map renders blank | `VITE_GOOGLE_MAPS_API_KEY` missing from `client/.env`, or the key lacks Maps JavaScript API access |
| Paginated endpoint returns `ER_WRONG_ARGUMENTS` | Should not happen — all six were fixed. If it reappears, a new query is binding `LIMIT` as a placeholder. See [ENGINEERING.md § 1](ENGINEERING.md#1-limit-placeholders-and-er_wrong_arguments) |
| Facility map shows no markers | `GET /api/facilities/nearby` only returns rows with `is_verified = 1`, and only within `?radius` metres of the given coordinates. Defaults centre on TARUMT |
| `npm test` fails | Expected. It is the unmodified npm placeholder that exits 1; there are no tests |
