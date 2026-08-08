# Engineering Notes

Four problems that actually happened during development, with what they cost and what was traded away to fix them — followed by the full list of what remains unresolved.

← back to [README](../README.md) · [API reference](API.md) · [Schema](SCHEMA.md)

---

## 1. `LIMIT` placeholders and `ER_WRONG_ARGUMENTS`

**Symptom.** Every paginated endpoint threw `ER_WRONG_ARGUMENTS (1210) — Incorrect arguments to mysqld_stmt_execute`. Six routes were affected — scan history, recent scans, redemption history, the community timeline, post comments, and the leaderboard — and the failure was total, not intermittent. Those endpoints returned 500 on every call.

**Root cause.** `mysql2`'s `execute()` uses the MySQL binary prepared-statement protocol. Placeholders are bound as typed parameters, and a parameter marker is not accepted in the `LIMIT` / `OFFSET` position for these statements — the driver sends the JavaScript number in a form the server rejects outright. The same SQL works through `pool.query()`, which uses the text protocol and escapes client-side, so the bug only appears on the `execute()` path. Nothing in the query text looks wrong, which is what made it slow to find: the SQL is valid, the parameter count matches, and the error message points at the statement executor rather than at the clause responsible.

**Fix.** Parse, clamp, then interpolate:

```js
const safeLimit  = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50);
const safeOffset = Math.max(parseInt(req.query.offset) || 0, 0);

// LIMIT/OFFSET cannot use placeholders with mysql2's prepared-statement
// protocol (ER_WRONG_ARGUMENTS). Both values are parseInt'd and clamped,
// so inlining is safe.
const [rows] = await db.execute(
  `SELECT … FROM scans WHERE user_id = ?
   ORDER BY scan_timestamp DESC
   LIMIT ${safeLimit} OFFSET ${safeOffset}`,
  [userId]
);
```

All six call sites carry the same comment, so the next reader does not have to re-derive why interpolation is present in an otherwise fully parameterised codebase.

**Why inlining is not an injection risk here.** `parseInt` returns a number or `NaN`; `NaN` is falsy, so `|| default` supplies the default; `Math.min(Math.max(n, lo), hi)` then forces the result into a bounded integer range. What reaches the template literal is always a JavaScript number, never a string derived from user input — there is no path by which caller-controlled text can reach the query. The clamp also does double duty as a denial-of-service guard: `?limit=999999999` is capped at 50 (100 for the leaderboard) instead of attempting to serialise an entire table.

**Trade-off.** String interpolation in SQL is a pattern worth being suspicious of on sight, and it now depends on a comment to stay defensible under review. The alternative — switching those six queries to `pool.query()` — would have kept the codebase uniformly placeholder-based, but would have given up prepared statements on the hottest read paths in the application. Interpolating two integers behind an explicit clamp was the smaller compromise.

**Affected call sites**

| Route | Clamp | Default |
|---|---|---|
| `GET /api/scan/history` | limit 1–50, offset ≥ 0 | 20 / 0 |
| `GET /api/user/recent-scans` | 1–50 | 3 |
| `GET /api/rewards/history` | 1–50 | 20 |
| `GET /api/community/posts` | 1–50 | 20 |
| `GET /api/community/posts/:postId/comments` | 1–50 | 10 |
| `GET /api/leaderboard` | 1–100 | 10 |

---

## 2. Anyone could register as an administrator

**Symptom.** Found during a self-audit, not reported by anyone. `POST /api/auth/register` destructured `isAdmin` from the request body and used it to set the account role. The registration page shipped it as a visible checkbox labelled "Register as Admin (Testing)". Ticking it granted immediate access to all twelve admin endpoints: the full user list with email addresses, ban controls, and both approval queues — meaning an attacker could approve their own scans and redemptions without limit.

**Root cause.** A debugging affordance that was never removed, combined with trusting a client-supplied field for an authorization decision. What makes this worth writing down is that the security control everyone would point at was working correctly the entire time: `verifyAdmin` faithfully checked the role claim and would have rejected a forged one. The problem was upstream — the server *issued* the admin role on demand. The middleware guarded the door while the window next to it stood open. Reviewing the guard tells you nothing about who is allowed to walk up to it.

**Fix.** The role is no longer derived from input at all:

```js
// routes/auth.js — isAdmin removed from the destructure entirely
const { username, email, password } = req.body;
…
// Every account created through this endpoint is a regular user.
// Admin accounts are provisioned by updating users.role directly in the DB.
const role = 'user';
```

The checkbox, its form state, its `FormData` append, and the now-unused MUI imports were all removed from `Register.jsx`. Verified by posting a registration carrying both `isAdmin=true` and `role=admin` in the body and confirming the row landed with `role = 'user'`.

**Trade-off.** There is now no in-app path to create an administrator — it requires a manual `UPDATE users SET role = 'admin' WHERE email = …`. For a project this size that is the right shape: promotion is rare, it should leave a trace, and it should not be reachable from an unauthenticated endpoint. A production deployment would want an invite flow or a bootstrap CLI instead, but a bad in-app flow is worse than no in-app flow.

---

## 3. A ban that did nothing — and the duplicate that caused it

**Symptom.** `POST /api/admin/users/:id/toggle-status` sets `is_active = 0`, but a banned user kept full access. Their existing JWT stayed valid for up to seven more days, and nothing anywhere in the request path ever consulted the database about the state of the account.

**Root cause.** Two problems stacked, and the second is the interesting one.

The first: `verifyToken` only verified the signature. Every authorization decision was therefore made against a snapshot taken at login, and a JWT with a 7-day expiry is a 7-day-stale snapshot.

The second: `verifyAdmin` was a *second, independent* authentication implementation. It extracted the bearer token itself, called `jwt.verify` itself, checked the role, and never touched `verifyToken` at all. Admin routes mounted it alone — `router.use(verifyAdmin)`. So when the obvious fix went in, adding an `is_active` lookup to `verifyToken`, it covered `/api/user/*` and every other authenticated route while leaving all of `/api/admin/*` exactly as exposed as before. A banned administrator retained every admin endpoint. Duplicated logic is precisely why the first fix was incomplete: one copy was updated, the other was not, and nothing in the type system or the tests — there are no tests — connected them.

**Fix.** Rather than copying the lookup into `verifyAdmin`, the duplication itself was removed. `verifyToken` became the single authentication implementation and now reads both fields on every protected request:

```js
const [rows] = await db.execute(
  'SELECT is_active, role FROM users WHERE user_id = ?',
  [decoded.user_id]
);
if (rows.length === 0 || !rows[0].is_active) {
  return res.status(401).json({ success: false,
    message: 'Account is inactive or no longer exists.' });
}

// The database is the authority on role; the JWT claim is a login-time snapshot.
req.user = { ...decoded, role: rows[0].role };
```

`verifyAdmin` was reduced to a role comparison with no verification of its own, and admin routes now chain both:

```js
router.use(verifyToken, verifyAdmin);
```

Reading `role` from the same row closes the matching staleness bug for free: demoting an admin in the database now takes effect on their next request instead of at token expiry. `verifyAdmin` returns 500 and logs loudly if it is ever reached without `req.user` populated, so a future mounting mistake fails closed rather than silently allowing traffic through an authorization check that thinks everyone is anonymous.

**Status codes** were separated along their standard meanings at the same time, because the old middleware returned 401 for both cases:

| Condition | Code | Raised by |
|---|---|---|
| No token, bad signature, expired token | 401 | `verifyToken` |
| Account banned (`is_active = 0`) or deleted | 401 | `verifyToken` |
| Authenticated, but not an admin | 403 | `verifyAdmin` |
| Database unreachable during the lookup | 500 | `verifyToken` — fails closed, never open |

A 403 tells the caller that retrying with the same credentials will never help; a 401 says the credentials themselves are the problem. Collapsing both into 401 sends a non-admin off to re-authenticate forever.

**Verification.** Tested against a running server and a live database across all twelve admin endpoints plus the authenticated user surface:

| Scenario | Expected | Result |
|---|---|---|
| Banned admin, old token → `/api/admin/stats` | 401 | 401 |
| Same token → `/api/user/profile` | 401 | 401 |
| Unbanned, same unchanged token → `/api/admin/stats` | 200 | 200 |
| Demoted to `user`, same token → `/api/admin/stats` | 403 | 403 |
| Demoted, same token → `/api/user/profile` | 200 | 200 |
| Restored to `admin`, same token → `/api/admin/stats` | 200 | 200 |
| Ordinary user token → `/api/admin/stats` | 403 | 403 |
| No token → `/api/admin/stats` | 401 | 401 |
| Valid admin → all 12 admin endpoints | 200 | 12/12 |

The five mutating admin endpoints were exercised against purpose-built fixture rows, and the resulting database state was checked afterwards — an endpoint that returns 200 because middleware let it through but the handler never ran would otherwise look identical to one that worked.

**Trade-off.** Every authenticated request now costs one primary-key `SELECT`. That is a real cost on the hot path, accepted because a ban that does not take effect is worse than a few milliseconds of latency, and because the alternative — trusting a claim that may be a week old — is exactly what caused the bug. If it ever shows up in profiling, the answer is a short-TTL cache or a `jti`-keyed revocation list, not deleting the check.

---

## 4. Secret handling: a deliberate development boundary

**Symptom.** No outage. Found by reading configuration during the same audit that produced note 2.

**Root cause.** Two issues that look alike but differ in blast radius:

- `server.js:49` configures express-session as `secret: process.env.JWT_SECRET || 'fallback-secret'`. With the variable missing, the app boots normally on a constant that is written in the source. To be precise about scope: this affects **only the express-session secret**, which in this application signs the cookie used during the Google OAuth handshake. The JWT path has no such fallback — `verifyToken` and the token signer both read `process.env.JWT_SECRET` directly, so a missing variable makes JWT operations throw rather than silently degrade.
- The `JWT_SECRET` in the working development `.env` is a human-authored passphrase: 56 characters, nine lowercase words joined by underscores, no digits, no mixed case, no symbols beyond the separator. It is long, which is why it survived a casual look, but it is drawn from a word list rather than from a CSPRNG. Its real search space is a few dozen bits, not 256.

**Decision.** Both are left as they are, and both are scoped to local development. This repository is not deployed and holds no real user data; the fallback exists so a fresh clone boots without a fully populated `.env`, which is a reasonable convenience for a development-only checkout and an unacceptable one anywhere else. Rather than half-fixing it — rotating a secret that lives in a local file, or removing a fallback while the deployment story does not exist yet — the boundary is stated explicitly:

> **Required before any deployment.** Remove the `|| 'fallback-secret'` fallback in `server.js` so a missing secret is a startup failure, and generate `JWT_SECRET` with `crypto.randomBytes(32).toString('hex')`. Neither the current fallback nor the current secret is suitable for an environment holding real accounts.

**Trade-off.** Removing the fallback means a misconfigured environment refuses to boot instead of starting in a weakened state, which is the correct behaviour for a secret — loud failure beats quiet insecurity. It is not the correct behaviour for a development checkout someone is trying to run for the first time, which is the tension being managed here. Rotating the secret invalidates every issued token and forces all users to sign in again, so it belongs in a deployment window alongside the fallback removal rather than in a casual commit. Recording the boundary in writing is what keeps a development convenience from silently becoming a production default.

---

## 5. A refund that could be collected twice

**Symptom.** No outage, no error, no failing request. Found while writing the redemption state diagram for [SCHEMA.md](SCHEMA.md#redemptions): drawing `pending → cancelled` meant naming what happens on that edge, which is a refund, which raised the question of what happens if the edge is taken twice. `POST /api/admin/redemptions/:id/reject` answered it by returning `200 Reward rejected and points refunded` every time and crediting `points_spent` again on each call.

**Root cause.** The handler read the row, then wrote, and never looked at `status` in between:

```js
const [redemption] = await connection.query(
  'SELECT user_id, points_spent FROM redemptions WHERE redemption_id = ?', [id]);
// ...
await connection.query(
  'UPDATE redemptions SET status = ? WHERE redemption_id = ?', ['cancelled', id]);
await connection.query(
  'UPDATE users SET total_points = total_points + ? WHERE user_id = ?',
  [points_spent, user_id]);
```

`status` was not selected, so it could not be checked. The transaction is real and the rollback is correct, but atomicity is not idempotence: each call is individually well-formed, and nothing says a well-formed call may only happen once. An admin double-clicking Reject, or a retried request after a timeout, mints points out of nothing.

Comparing the two handlers side by side is what made the shape of the problem visible. The sibling endpoint `POST /api/admin/redemptions/:id/approve` *did* have a check — `if (status === 'completed') throw` — which is why the omission in `reject` had not been noticed. That check turned out to be incomplete in its own way: it refused only `completed`, leaving `cancelled → completed` reachable, so a rejected redemption could be approved afterwards and the user would keep the refund *and* receive a voucher.

Auditing the two scan endpoints for the same shape found the same thing again. `POST /api/admin/scans/:id/approve` had no state check at all: a second approval re-ran the point award, the `total_scans` increment and the achievement evaluation. `POST /api/admin/scans/:id/reject` was harmless on repeat — it moves no points — but could flip an already-approved scan to `rejected` while the points it granted stayed on the account, leaving the row and the balance permanently disagreeing.

So one endpoint had a correct-looking guard, one had a partial guard, and two had none. This is note 3's failure mode wearing different clothes: four copies of one decision, updated independently.

**Fix.** Rather than adding a read-then-check to each handler, the state check was folded into the write. The row is claimed by an `UPDATE` whose `WHERE` clause names the state it is allowed to move from, and `affectedRows` is the authority on whether the claim succeeded:

```js
const [claim] = await connection.query(
  `UPDATE redemptions
   SET status = 'cancelled'
   WHERE redemption_id = ? AND status = 'pending'`,
  [id]
);

if (claim.affectedRows === 0) {
  const [existing] = await connection.query(
    'SELECT status FROM redemptions WHERE redemption_id = ?', [id]);
  await connection.rollback();

  if (existing.length === 0) {
    return res.status(404).json({ success: false, message: 'Redemption not found' });
  }
  return res.status(409).json({ success: false,
    message: `Redemption is already ${existing[0].status} and cannot be rejected` });
}
// only past this line does the refund run
```

There is no window between the check and the write because there is no separate check. The `UPDATE` takes an exclusive row lock, so a concurrent second request blocks until the first transaction commits and then matches zero rows — the guard holds against a retry a minute later and against two simultaneous clicks equally. The same pattern was applied to all four endpoints, with `verification_status = 'pending'` as the claimed state for scans.

**Status codes.** A state conflict is now **409**, not the 500 the previous `throw` produced, and a missing row is **404**. The distinction is the same one drawn in note 3: 409 tells the caller that the request was well-formed and will never succeed as sent, which is exactly what the admin UI needs to show "already processed" instead of "server error, try again" — retrying was the thing causing the damage.

**Verification.** Tested against a running server and a live database, using a purpose-built user seeded at 800 points with one `pending` redemption worth 200 and one `pending` scan worth 10. Each row of the table is a real HTTP call with the balance read back from the database afterwards.

| Scenario | Before | After |
|---|---|---|
| Reject a pending redemption | 200 · 800 → 1000 | 200 · 800 → 1000 |
| Reject the same redemption again | **200 · 1000 → 1200** | **409 · 1000** |
| Reject it a third time | **200 · 1200 → 1400** | **409 · 1000** |
| Approve a redemption already `cancelled` | **200 · voucher issued** | **409 · `redemption_code` stays NULL** |
| Reject a redemption id that does not exist | 500 | 404 |
| Approve a pending scan | 200 · +10 pts, `total_scans` 3 → 4 | 200 · +10 pts, `total_scans` 3 → 4 |
| Approve the same scan again | **200 · +10 pts, `total_scans` → 5** | **409 · balance and counter unchanged** |
| Reject a scan already `approved` | **200 · marked rejected, points kept** | **409 · row unchanged** |
| Approve a pending redemption (happy path) | 200 · voucher, `completed_at` set | 200 · voucher, `completed_at` set |
| Reject a pending scan (happy path) | 200 · `verified_by` set | 200 · `verified_by` set |

Three consecutive rejections took the account from 800 to 1400 on the unfixed code — 400 points that no scan ever earned — and left it at 1000 on the fixed code. The fixture user and all its rows were deleted afterwards; row counts and the sum of `total_points` across the database matched the pre-test baseline exactly.

**Trade-off.** The failure path now costs a second query, because `affectedRows === 0` says the claim failed without saying why — the row could be missing or merely in the wrong state, and 404 and 409 mean different things to the caller. Paying for that read only when the claim fails keeps the success path at one statement, which is the path that actually runs. The larger trade is that this makes the *state transition* idempotent and does nothing for the balance itself: `POST /api/rewards/redeem` still reads a balance, checks it, and writes without a lock, so the concurrent-spend race below remains open. Guarding a transition is not the same as guarding an amount, and conflating the two would have made this note read as a fix for something it does not fix.

---

## Limitations

Known and unresolved, listed so a reader does not have to find them.

**No test coverage.** There are no test files, no test framework in either `package.json`, and `npm test` in `server/` is the default placeholder — `echo "Error: no test specified" && exit 1`, which exits 1. The client has no `test` script at all. Everything documented here and in the API reference was verified by hand against a running server and a live database. This is the largest gap in the project, and it is directly responsible for note 3: nothing caught that a security fix had landed in one of two duplicated code paths.

**No rate limiting.** Neither `express-rate-limit` nor `helmet` is installed, and there is no hand-rolled limiter. Login, registration, and both Gemini-backed endpoints are unthrottled. `POST /api/chatbot/message` makes two model calls per request, so it is the most expensive thing on the surface to abuse.

**Race condition in redemption.** Both redemption paths — `POST /api/rewards/redeem` and the chatbot's `redeemReward` — read the balance and stock, check them, then write, without `SELECT ... FOR UPDATE` and without a `WHERE total_points >= ?` guard on the deduction. Under the default REPEATABLE READ isolation two concurrent requests can both pass the check and drive the balance or stock negative. The transactions guarantee atomicity, not serialisability, and the difference matters here. Correct fix: row locks on the user and reward rows, or a conditional `UPDATE` whose affected-row count is checked before commit.

**Two divergent redemption lifecycles.** `POST /api/rewards/redeem` inserts `redemption_code = NULL` and lets the admin approval generate the code; the chatbot's `redeemReward` generates a code at creation time. Same table, same `pending` status, two different lifecycles for the same column — so `redemption_code IS NULL` means "awaiting approval" for rows created one way and nothing at all for rows created the other way. Any query that tries to use the column as a state signal will be wrong for half the data.

**Images live on local disk.** Uploads are written to `server/uploads/` on the API server. There is no object store and no CDN, so nothing survives a container rebuild and the directory does not scale past one process. `/uploads/*` is additionally served by `express.static` with no access control, and filenames are predictable — `scan_YYYYMMDD_HHMMSS_<userId>.jpg` — so another user's scan images are guessable by anyone who knows the pattern.

**Denormalised counters drift.** `posts.likes_count` and `posts.comments_count` are maintained by hand alongside inserts and deletes into `post_likes` and `comments`. Nothing reconciles them, and cascading deletes do not decrement them, so deleting a user permanently inflates the counters on every post they interacted with. The seed data already disagrees with itself: post 1 records `likes_count = 5` against 2 rows in `post_likes`.

**Achievement conditions are hardcoded.** The `achievements` table carries `requirement_type`, `requirement_value`, and `item_type_required` columns that fully describe five of the six achievements, but the unlock logic ignores all three and hardcodes conditions against achievement IDs 1–6 in JavaScript — in two separate places, `routes/admin.js:514-521` and `routes/achievements.js:117-124`. Adding an achievement means editing both code paths, and the two lists can drift apart independently of the table they claim to mirror.

**A dead table.** `user_favorite_facilities` has a schema, a composite primary key, and two foreign keys with cascade rules. No route reads or writes it.

**Unescaped HTML in the chat UI.** `Chatbot.jsx:477` renders message content with `dangerouslySetInnerHTML`, and the `markdownToHtml` helper (`Chatbot.jsx:58-72`) performs regex substitution without escaping `<` and `>` first. The blast radius is genuinely limited — chat content is never persisted and never shown to another user, so this is self-inflicted only — but it is still an injection point, and the fix is to escape before substituting rather than to rely on that scoping holding forever.

**Classification can produce an out-of-range value.** The Gemini prompt in `config/gemini.js` permits `"Non-recyclable"` as a classification type, but `scans.item_type` is an `ENUM` of six values that does not include it. A submission classified that way will not insert cleanly. Either the prompt should be narrowed to the six ENUM members, or the ENUM extended and a zero-point path defined for non-recyclable items.

**Unenforced schema columns.** Six columns exist in the schema but are never read or written by any route: `rewards.max_per_user`, `rewards.valid_from`, `rewards.valid_until`, `achievements.is_hidden`, `posts.is_deleted`, and `comments.is_deleted`. The two `is_deleted` columns are the most misleading of these — every read query filters on them, so the soft-delete mechanism *appears* implemented, but nothing anywhere sets them to 1. There is no delete function for posts or comments at all.

**Facility data is seeded, not live.** Four hardcoded facilities around Setapak and Wangsa Maju, Kuala Lumpur. `google_place_id` values are placeholders and `google_rating` is never populated. There is no ingestion from the Google Places API, so coverage does not extend beyond the seeded set.

**Single-region, single-instance.** One Node process, one MySQL instance, sessions held in memory. There is no horizontal scaling story: both the session store and the uploads directory are process-local, so a second instance would break OAuth handshakes and serve 404s for half the images.

**No token revocation.** Logout is client-side only — the token is discarded, not invalidated. `is_active` and `role` are re-checked per request, which covers bans and demotions, but a token stolen from a user who remains active and unmodified stays valid for its full seven days.

> **Classification accuracy is not measured.**
> No held-out evaluation of Gemini's classification has been run. A credible table would need a labelled set of item photographs, per-category precision and recall, and a confidence-versus-correctness curve to justify the 0.7 threshold the admin audit view uses to flag scans for review. Until that work exists, no accuracy figure is claimed anywhere in this documentation.
