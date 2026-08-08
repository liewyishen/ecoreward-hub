# API Reference

44 endpoints across 11 route modules.

- **Auth** — requires `verifyToken`: a valid JWT signature, and an account row with `is_active = 1`.
- **Admin** — additionally requires `verifyAdmin`: `role === 'admin'`, read from the database on every request rather than from the JWT claim.

Failure codes are split by meaning: **401** for no token, bad signature, expired token, or a banned/deleted account; **403** for an authenticated caller who is not an admin.

← back to [README](../README.md)

---

## Authentication — `/api/auth`

| Method | Path | Auth | Admin | Notes |
|---|---|:--:|:--:|---|
| POST | `/api/auth/register` | – | – | `multipart/form-data`, optional `profile_picture`. Grants a 150-point welcome bonus. Always creates `role = 'user'` |
| POST | `/api/auth/login` | – | – | Returns JWT + user object. Rejects Google-only accounts (`password_hash IS NULL`) |
| GET | `/api/auth/check-username/:username` | – | – | Case-insensitive availability check |
| GET | `/api/auth/google` | – | – | Starts OAuth 2.0, forces account selection |
| GET | `/api/auth/google/callback` | – | – | Redirects to `FRONTEND_URL/dashboard?token=…` |

**Register** — `multipart/form-data`

```
username   string   3–20 chars, ^[a-zA-Z0-9_]{3,20}$
email      string   validated by regex, must be unique
password   string   ≥ 6 chars
profile_picture  file  optional, jpeg/jpg/png, ≤ 5 MB
```

`role` is never read from the request body. See [ENGINEERING.md](ENGINEERING.md#2-anyone-could-register-as-an-administrator).

**Login** — `application/json`

```jsonc
// request
{ "email": "user@example.com", "password": "…" }

// response
{
  "success": true,
  "token": "<jwt>",
  "user": { "user_id": 7, "username": "…", "email": "…",
            "total_points": 800, "profile_picture": "…" }
}
```

JWT: HS256, 7-day expiry, claims `{ user_id, email, role }`.

---

## Scanning — `/api/scan`

| Method | Path | Auth | Admin | Notes |
|---|---|:--:|:--:|---|
| POST | `/api/scan/analyze` | ✅ | – | `multipart/form-data`, field `image`. Classification only — no DB write, no points |
| POST | `/api/scan/submit` | ✅ | – | Writes a `pending` scan, updates the streak |
| GET | `/api/scan/history` | ✅ | – | `?limit` (1–50, default 20), `?offset` (≥ 0) |
| GET | `/api/scan/:scan_id` | ✅ | – | Scoped to the owner; 404 otherwise |

**Analyze** — response

```jsonc
{
  "success": true,
  "data": {
    "item_type": "Plastic",          // Plastic|Metal|Glass|Paper|Organic|E-waste|Non-recyclable
    "item_subtype": "PET Bottle",
    "confidence": 0.99,              // clamped to [0,1]
    "recyclable": true,
    "points_earned": 10,             // round(base_points × confidence)
    "tips": "…",
    "image_url": "/uploads/scan_20260808_101718_7.jpg",
    "image_path": "/uploads/scan_20260808_101718_7.jpg",
    "gemini_raw_response": "{…}"
  }
}
```

`Non-recyclable` is permitted by the prompt but is not a member of the `scans.item_type` ENUM — see [ENGINEERING.md](ENGINEERING.md#limitations).

**Submit** — `application/json`

```jsonc
{
  "facility_id": 4,                  // required
  "item_type": "Plastic",            // required
  "item_subtype": "PET Bottle",      // required
  "confidence": 0.99,
  "points_earned": 10,
  "image_path": "/uploads/…",
  "recycling_tips": "…",
  "gemini_raw_response": "{…}"       // validated as JSON before insert
}
```

Returns the new `scan_id`, `verification_status: "pending"`, and the updated streak. Points are **not** granted here.

---

## User — `/api/user`

| Method | Path | Auth | Admin | Notes |
|---|---|:--:|:--:|---|
| GET | `/api/user/stats` | ✅ | – | Dashboard payload; lazily expires a stale streak |
| GET | `/api/user/recent-scans` | ✅ | – | `?limit` (1–50, default 3) |
| GET | `/api/user/profile` | ✅ | – | Includes rank and unlocked achievement count |
| PUT | `/api/user/profile` | ✅ | – | `multipart/form-data`; replaces the old avatar file on disk |

`GET /api/user/stats` doubles as the streak-expiry check: if `last_scan_date` is more than two days old (or exactly two with the grace already spent), `current_streak_days` is reset to 0 before the response is built. There is no scheduled job.

---

## Statistics — `/api/stats`

| Method | Path | Auth | Admin | Notes |
|---|---|:--:|:--:|---|
| GET | `/api/stats/global` | – | – | Landing-page counters |
| GET | `/api/stats/item-types` | – | – | Per-category totals from `item_type_stats` |

---

## Facilities — `/api/facilities`

| Method | Path | Auth | Admin | Notes |
|---|---|:--:|:--:|---|
| GET | `/api/facilities/nearby` | – | – | `?lat` `?lng` `?radius` (metres, default 5000) |
| GET | `/api/facilities/:id` | – | – | Verified facilities only |

Defaults are TARUMT: `lat=3.2167`, `lng=101.7333`. Distance is a Haversine expression evaluated in SQL and filtered with `HAVING distance < ?`:

```sql
(6371 * acos(
   cos(radians(?)) * cos(radians(latitude))
   * cos(radians(longitude) - radians(?))
   + sin(radians(?)) * sin(radians(latitude))
)) * 1000 AS distance
```

`accepted_types` is a MySQL `SET` and is split into an array in the response; `opening_hours` is JSON and is parsed.

---

## Leaderboard — `/api/leaderboard`

| Method | Path | Auth | Admin | Notes |
|---|---|:--:|:--:|---|
| GET | `/api/leaderboard` | ✅ | – | `?limit` (1–100, default 10). Top N plus the caller's own rank |
| GET | `/api/leaderboard/stats` | – | – | Global aggregates |

Ranking comes from the `view_leaderboard` view, so "my rank" is a single indexed lookup rather than a scan in application code.

---

## Rewards — `/api/rewards`

| Method | Path | Auth | Admin | Notes |
|---|---|:--:|:--:|---|
| GET | `/api/rewards` | – | – | Active catalogue, cheapest first |
| POST | `/api/rewards/redeem` | ✅ | – | Transactional; deducts points immediately, creates a `pending` redemption |
| GET | `/api/rewards/history` | ✅ | – | `?limit` (1–50, default 20) |
| GET | `/api/rewards/stats` | – | – | Completed-redemption aggregates |

**Redeem** — body `{ "reward_id": 5 }`. Inside one transaction: re-read the reward requiring `is_active = TRUE`, check the balance, check stock (`-1` means unlimited), deduct points, insert a `pending` redemption with `redemption_code = NULL`, decrement stock. Points leave the balance at request time so a pending redemption cannot be double-spent.

Seeded catalogue:

| ID | Reward | Cost | Type | Stock |
|---|---|---|---|---|
| 1 | RM5 Touch 'n Go Reload | 500 | `tng_cashback` | unlimited |
| 2 | RM10 Touch 'n Go Reload | 900 | `tng_cashback` | unlimited |
| 3 | RM20 Touch 'n Go Reload | 1700 | `tng_cashback` | unlimited |
| 4 | Eco Tote Bag | 300 | `physical_gift` | limited |
| 5 | Coffee Voucher | 200 | `voucher` | limited |

---

## Achievements — `/api/achievements`

| Method | Path | Auth | Admin | Notes |
|---|---|:--:|:--:|---|
| GET | `/api/achievements` | ✅ | – | All achievements with the caller's unlock status |
| POST | `/api/achievements/check` | ✅ | – | Re-evaluates conditions and unlocks any newly met |

Six achievements, with the conditions hardcoded in JavaScript rather than read from the table:

| ID | Name | Condition | Bonus | Rarity |
|---|---|---|---|---|
| 1 | First Step | `total_scans ≥ 1` | 10 | common |
| 2 | Eco Warrior | `total_scans ≥ 10` | 50 | common |
| 3 | Century Club | `total_scans ≥ 100` | 200 | rare |
| 4 | Plastic Hunter | 50 approved Plastic scans | 100 | rare |
| 5 | Week Streak | `current_streak_days ≥ 7` | 150 | epic |
| 6 | Point Millionaire | `lifetime_points ≥ 1000` | 300 | legendary |

The same list is duplicated inside the scan-approval handler, so achievements also unlock automatically when an admin approves a scan.

---

## Community — `/api/community`

| Method | Path | Auth | Admin | Notes |
|---|---|:--:|:--:|---|
| GET | `/api/community/posts` | – | – | `?limit` (1–50, default 20) |
| POST | `/api/community/posts` | ✅ | – | `multipart/form-data`; ≤ 280 chars, optional image |
| POST | `/api/community/posts/:postId/like` | ✅ | – | Toggle; transactional |
| GET | `/api/community/posts/:postId/comments` | – | – | `?limit` (1–50, default 10) |
| POST | `/api/community/posts/:postId/comments` | ✅ | – | ≤ 500 chars |
| GET | `/api/community/posts/:postId/check-like` | ✅ | – | Whether the caller liked this post |

Post images accept `image/webp` in addition to jpeg/png. The like toggle is protected by the composite primary key on `post_likes (user_id, post_id)`.

---

## Admin — `/api/admin`

All twelve are protected by `router.use(verifyToken, verifyAdmin)` at the top of the module — there is no per-route guard to forget.

| Method | Path | Auth | Admin | Notes |
|---|---|:--:|:--:|---|
| GET | `/api/admin/stats` | ✅ | ✅ | Users, items, points issued, pending queue sizes |
| GET | `/api/admin/trends` | ✅ | ✅ | Scans per day, last 7 days |
| GET | `/api/admin/category-distribution` | ✅ | ✅ | Scans grouped by item type |
| GET | `/api/admin/pending-redemptions` | ✅ | ✅ | Redemption approval queue |
| POST | `/api/admin/redemptions/:id/approve` | ✅ | ✅ | Generates a voucher code, sets `completed_at`, emails the user |
| POST | `/api/admin/redemptions/:id/reject` | ✅ | ✅ | Sets `cancelled`, refunds `points_spent` |
| GET | `/api/admin/low-confidence-scans` | ✅ | ✅ | AI audit: `confidence_score < 0.7`, capped at 20 |
| GET | `/api/admin/users` | ✅ | ✅ | User management list, capped at 100 |
| POST | `/api/admin/users/:id/toggle-status` | ✅ | ✅ | Ban / unban via `is_active = NOT is_active`; effective on the next request |
| GET | `/api/admin/pending-scans` | ✅ | ✅ | Scan verification queue, oldest first |
| POST | `/api/admin/scans/:id/approve` | ✅ | ✅ | Awards points, increments `total_scans`, evaluates achievements, emails the user |
| POST | `/api/admin/scans/:id/reject` | ✅ | ✅ | Marks `rejected`; no points were granted, so nothing is reversed |

`POST /api/admin/scans/:id/approve` is the largest single transaction in the project: it updates the scan, credits `total_points` and `lifetime_points`, increments `total_scans`, then evaluates all six achievement conditions and credits any bonus points — all before commit. The confirmation email is sent afterwards, fire-and-forget, so a mail failure cannot roll back a verified scan.

---

## Chatbot — `/api/chatbot`

| Method | Path | Auth | Admin | Notes |
|---|---|:--:|:--:|---|
| POST | `/api/chatbot/message` | ✅ | – | Body `{ message, history }` |

```jsonc
// request
{
  "message": "how many points do I have?",
  "history": [ { "role": "user|assistant", "content": "…" } ]   // last 10 turns are kept
}

// response
{
  "success": true,
  "data": {
    "message": "You have 800 points 🌱",
    "functionResult": {                 // present only when a DB function ran
      "type": "getUserPoints",          // getUserPoints | getAvailableRewards
                                        // | getAffordableRewards | confirmRedemption
                                        // | redeemReward
      "data": { "current_points": 800, "lifetime_points": 170 }
    }
  }
}
```

`functionResult` carries the raw database result so the UI renders balances and reward cards from data rather than from parsed prose. Architecture is documented in the main [README](../README.md#ai-implementation).

---

## Not part of the API surface

| Method | Path | Auth | Admin | Notes |
|---|---|:--:|:--:|---|
| GET | `/` | – | – | Health check |
| GET | `/uploads/*` | – | – | `express.static` — **unauthenticated**, see [ENGINEERING.md](ENGINEERING.md#limitations) |

---

## Conventions

**Response envelope.** Every route returns `{ success: boolean, … }`. Errors carry `message`; internal detail appears in an `error` field only when `NODE_ENV !== 'production'`.

**Pagination.** `?limit` and `?offset` are parsed with `parseInt` and clamped before use. Out-of-range values are silently corrected, not rejected. Why they are interpolated rather than bound is covered in [ENGINEERING.md](ENGINEERING.md#1-limit-placeholders-and-er_wrong_arguments).

**Uploads.** All file fields accept `image/jpeg`, `image/jpg`, `image/png` (community posts also `image/webp`), capped at 5 MB. The MIME type checked is the client-declared `Content-Type`; contents are not sniffed.

**Request bodies.** JSON and URL-encoded bodies are capped at 10 MB.
