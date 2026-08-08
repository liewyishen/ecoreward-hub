# Tech Stack

Versions are the semver ranges declared in `package.json`, not "latest".

← back to [README](../README.md) · [API](API.md) · [Schema](SCHEMA.md) · [Security](SECURITY.md) · [Setup](SETUP.md) · [Engineering notes](ENGINEERING.md)

---

## Client — `client/package.json`

| Package | Version | Role |
|---|---|---|
| react · react-dom | `^19.2.0` | UI framework |
| vite | `^7.2.4` | Build tool, dev server |
| @vitejs/plugin-react | `^5.1.1` | Fast refresh via Babel |
| @mui/material | `^7.3.5` | Component library |
| @mui/icons-material | `^7.3.5` | Icon set |
| @mui/x-data-grid | `^8.19.0` | Admin user and queue tables |
| @emotion/react | `^11.14.0` | MUI styling engine |
| @emotion/styled | `^11.14.1` | MUI styling engine |
| react-router-dom | `^7.9.6` | Client-side routing |
| axios | `^1.13.2` | HTTP client |
| recharts | `^3.4.1` | Admin dashboard charts |
| @react-google-maps/api | `^2.20.7` | Facility map |
| lottie-react | `^2.4.1` | Landing page animations |
| date-fns | `^4.1.0` | Date formatting |
| react-countup | `^6.5.3` | Animated stat counters |
| react-confetti-explosion | `^3.0.3` | Redemption success feedback |

**Dev dependencies** — `eslint ^9.39.1`, `@eslint/js ^9.39.1`, `eslint-plugin-react-hooks ^7.0.1`, `eslint-plugin-react-refresh ^0.4.24`, `globals ^16.5.0`, `@types/react ^19.2.5`, `@types/react-dom ^19.2.3`.

ESLint uses the flat config format in `client/eslint.config.js`. There is no `.eslintrc`, and no TypeScript — the `@types/*` packages are present for editor support only.

**Scripts** — `dev`, `build`, `lint`, `preview`. There is no `test` script.

Only one Vite React plugin is installed: `@vitejs/plugin-react`, which uses Babel. `@vitejs/plugin-react-swc` is not part of this project, and the React Compiler is not enabled.

---

## Server — `server/package.json`

| Package | Version | Role |
|---|---|---|
| express | `^5.1.0` | HTTP framework |
| mysql2 | `^3.15.3` | Database driver; promise pool, `connectionLimit: 10` |
| @google/genai | `^1.30.0` | Gemini SDK — image classification and chat |
| jsonwebtoken | `^9.0.2` | JWT sign and verify |
| bcrypt | `^6.0.0` | Password hashing, 10 salt rounds |
| passport | `^0.7.0` | Auth middleware for the OAuth flow |
| passport-google-oauth20 | `^2.0.0` | Google OAuth 2.0 strategy |
| express-session | `^1.18.2` | Session store for the OAuth handshake |
| multer | `^2.0.2` | Multipart file uploads to local disk |
| nodemailer | `^7.0.10` | Transactional email |
| cors | `^2.8.5` | Cross-origin configuration |
| dotenv | `^17.2.3` | Environment loading |

**Dev dependencies** — `nodemon ^3.1.11`.

**Scripts** — `start` (`node server.js`), `dev` (`nodemon server.js`), and `test`, which is the unmodified npm placeholder: `echo "Error: no test specified" && exit 1`. Running it exits 1. See [ENGINEERING.md § Limitations](ENGINEERING.md#limitations).

---

## Runtime

Neither `package.json` declares an `engines` field, so the supported Node range is not pinned anywhere in the repository. Developed and tested on **Node v24.15.0**. The floor is set by dependencies rather than by declaration: Express 5 and Multer 2 both require Node ≥ 18.

`"type": "commonjs"` on the server — all server code uses `require`. The client is `"type": "module"` and uses ESM throughout.

---

## Database

MySQL or MariaDB. The schema was developed against MariaDB and uses:

- `ENGINE=InnoDB` on every table, so foreign keys and transactions are available
- `DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
- MariaDB-style inline `CHECK (json_valid(...))` on `scans.gemini_raw_response` and `recycling_facilities.opening_hours`
- A window function (`ROW_NUMBER() OVER (...)`) in `view_leaderboard`, which requires MySQL ≥ 8.0 or MariaDB ≥ 10.2

The `json_valid()` CHECK constraints are the least portable part: MySQL 8 accepts the syntax but the function name differs from its native `JSON_VALID()` casing conventions, and older MySQL 5.7 supports neither the window function nor inline CHECK enforcement. MariaDB 10.2+ or MySQL 8.0+ is the practical requirement.

Full field-level detail: [SCHEMA.md](SCHEMA.md).

---

## External services

| Service | Used for | Required? |
|---|---|---|
| Google Gemini (`gemini-2.5-flash`) | Waste image classification; chatbot intent and phrasing | **Yes** — scanning and chat both fail without `GEMINI_API_KEY` |
| Google OAuth 2.0 | "Sign in with Google" | Optional — email/password login works without it |
| Google Maps JavaScript API | Facility map rendering | Optional — the rest of the app works, the map renders blank |
| SMTP (any provider) | Welcome, scan-verified, and redemption-approved emails | Optional — email is fire-and-forget and never blocks a request |

One model, `gemini-2.5-flash`, serves all three AI calls: image classification, chatbot intent classification, and chatbot response phrasing. The chat endpoint makes two of those calls per user message.
