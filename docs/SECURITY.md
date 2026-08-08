# Security

What is implemented, with the code it lives in. The four unresolved gaps are listed in the main [README § Known gaps](../README.md#known-gaps); the reasoning behind the auth design is in [ENGINEERING.md § 2](ENGINEERING.md#2-anyone-could-register-as-an-administrator) and [§ 3](ENGINEERING.md#3-a-ban-that-did-nothing--and-the-duplicate-that-caused-it).

← back to [README](../README.md) · [API](API.md) · [Schema](SCHEMA.md) · [Stack](STACK.md) · [Setup](SETUP.md) · [Engineering notes](ENGINEERING.md)

---

## Implemented

| Area | Implementation |
|---|---|
| Password storage | bcrypt with 10 salt rounds (`routes/auth.js:266`). Google-only accounts store `password_hash NULL` and are refused at password login with a message pointing at Google Sign-In |
| Session tokens | JWT, HS256, 7-day expiry (`routes/auth.js:152-158`). Claims: `user_id`, `email`, `role` |
| Privilege assignment | `role` is hardcoded to `'user'` at registration (`routes/auth.js:269`). The server never reads a role from the request body. Admin accounts are provisioned by updating `users.role` directly in the database |
| Authentication | A single implementation in `middleware/verifyToken.js`: verify the signature, then read `is_active` and `role` from the database on every protected request. Banned or deleted accounts are rejected immediately rather than at token expiry |
| Role freshness | `req.user.role` is overwritten with the database value, so the JWT claim is treated as a login-time snapshot only. Demoting an admin takes effect on their next request |
| Authorization | `middleware/verifyAdmin.js` compares `req.user.role` to `'admin'` and does nothing else — no token parsing, no database access. There is one place authentication can drift, not two |
| Status-code semantics | **401** for no token, bad signature, expired token, banned or deleted account. **403** for an authenticated non-admin. A 403 signals that retrying with the same credentials will never help |
| SQL injection | Every user-supplied *value* is a bound parameter. The only interpolated SQL is integer `LIMIT` / `OFFSET`, parsed and clamped before use — see [ENGINEERING.md § 1](ENGINEERING.md#1-limit-placeholders-and-er_wrong_arguments) |
| Ownership scoping | `GET /api/scan/:scan_id` filters on `user_id` as well as `scan_id`, so a valid token cannot read another user's scan by guessing an ID |
| Error responses | Internal messages are returned only when `NODE_ENV !== 'production'`. In production the client receives a generic message while the full error stays in the server log — 14 route call sites plus the global handler in `server.js` |
| CORS | A single allowed origin from `FRONTEND_URL`, with `credentials: true` (`server.js:33-38`) |
| File uploads | multer with a MIME allowlist (`image/jpeg`, `image/jpg`, `image/png`; community posts also accept `image/webp`) and a 5 MB cap, configured separately in four route modules |
| Upload cleanup | A failed registration, profile update, or post creation deletes the file that was already written to disk, so rejected requests do not leave orphans |
| Input validation | Username `^[a-zA-Z0-9_]{3,20}$`, email regex, password ≥ 6 characters, post content ≤ 280, comment ≤ 500, non-empty chat message, required scan fields, JSON validation before writing `gemini_raw_response`, and clamped pagination on all six paginated routes |
| Transactions | Registration, scan submission, scan approval, both redemption paths, redemption approve/reject, profile update, like toggle, comment creation, and achievement unlocking all run in explicit transactions with rollback on error and connection release in `finally` |
| Concurrency guards | Composite primary keys on `post_likes (user_id, post_id)` and `user_achievements (user_id, achievement_id)` make double-liking and double-unlocking impossible at the storage layer, independent of route logic |
| Fail-closed defaults | A database failure inside `verifyToken` returns 500 and never lets the request through. `verifyAdmin` returns 500 and logs loudly if it is ever reached without `req.user` populated, so a future mounting mistake fails closed |
| Request size limits | JSON and URL-encoded bodies capped at 10 MB (`server.js:41-44`) |

---

## The middleware chain

```js
// server/routes/admin.js
router.use(verifyToken, verifyAdmin);
```

Authentication happens once, in one file. Authorization is a separate, dependent step.

| Condition | Code | Raised by |
|---|---|---|
| No token, malformed header, bad signature, expired | 401 | `verifyToken` |
| Account banned (`is_active = 0`) or row deleted | 401 | `verifyToken` |
| Database unreachable during the account lookup | 500 | `verifyToken` — fails closed, never open |
| Authenticated, but `role !== 'admin'` | 403 | `verifyAdmin` |
| `verifyAdmin` reached without `req.user` | 500 | `verifyAdmin` — mounting bug, fails closed |

The cost of this design is one primary-key `SELECT` per authenticated request. The reason it is worth paying is documented in [ENGINEERING.md § 3](ENGINEERING.md#3-a-ban-that-did-nothing--and-the-duplicate-that-caused-it): the previous design, where `verifyAdmin` verified its own tokens, is what allowed a security fix to land in one of two duplicated code paths and leave twelve admin endpoints exposed.

---

## Trust boundaries in the chatbot

The conversational assistant is the only place where model output influences a state change, so its boundary is drawn explicitly:

- **Identity is never model-supplied.** `userId` always comes from `req.user.user_id`. The four database functions take it as a parameter from the route, not from the model's output, so no prompt can make the assistant act on another account.
- **The model decides intent, not facts.** `redeemReward` re-reads the reward, its `is_active` flag, its stock, and the user's live balance inside a transaction before deducting anything. A user who convinces the model they have 10,000 points still fails the balance check against the database.
- **Conversation history is untrusted input.** It is used only for reward-name pattern matching and as context for phrasing; nothing in it reaches a query as a value.

What this does *not* cover is concurrency — see the redemption race in [ENGINEERING.md § Limitations](ENGINEERING.md#limitations).

---

## Not implemented

Four gaps are tracked in the main [README § Known gaps](../README.md#known-gaps): no rate limiting, development-only secret handling, unauthenticated `/uploads/*`, and no token revocation. The full inventory of unresolved issues, including those outside the security surface, is in [ENGINEERING.md § Limitations](ENGINEERING.md#limitations).
