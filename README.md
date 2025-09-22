# System Overload — Hotseat Card Game

- **Frontend:** React (JavaScript) + Vite — hotseat game runs fully client-side with `useState`/`useReducer`.
- **ML Bot:** Optional machine learning opponent for single-player matches.
- **Backend:** Express (JavaScript) — auth & profile only (register, login, me, email change, account delete, games played increment).
- **DB:** MongoDB Atlas (users + `gamesPlayed` only).
- **Auth:** JWT Bearer tokens (no cookies). Client stores token in memory or sessionStorage.
- **Deploy:** Option A — single AWS EC2 with Docker Compose (web + api); MongoDB Atlas is managed.

## Quick Start (Local)

1. **Backend**

```bash
cd backend
cp .env.sample .env   # fill in MONGODB_URI and JWT_SECRET
npm install
npm start
```

Optional: enable development phase flags (looser rate limits, dev-only info route):

```bash
# backend/.env
APP_PHASE=development
```

### Run Backend Tests

```bash
cd backend
npm install
npm test
```

Tip: If developing on Windows + WSL, run tests from a Bash shell (inside WSL). Running `npm test` from PowerShell/CMD against `\\wsl.localhost` paths can break Jest path resolution.

2. **Frontend**

```bash
cd ../frontend
npm install
npm run dev
```

Visit `http://localhost:5173`.

If the frontend cannot reach the API via the Vite proxy, set an explicit API base:

```bash
# in frontend/.env.development (or .env.local)
VITE_API_BASE=http://localhost:8080/api
```

Then restart `npm run dev`.

If you want to surface dev-only UI affordances in the client, set a phase:

```bash
# in frontend/.env.development (or .env.local)
VITE_APP_PHASE=development
```

The client also respects Vite's `import.meta.env.MODE` and will treat `MODE=development` as a dev phase if `VITE_APP_PHASE` is not set.

## Docker Compose (EC2 - Production)

At the repo root:

```bash
docker-compose build --pull
docker-compose up -d
```

The Nginx container serves the React build and proxies `/api/*` → Express on `:8080`.

## API Endpoints

- `POST /api/auth/register` — `{ email, username, password }`
- `POST /api/auth/login` — `{ emailOrUsername, password }` → `{ token, user }`
- `GET /api/auth/me` — (Bearer token) → `{ email, username, gamesPlayed }`
- `PUT /api/account/email` — `{ newEmail, currentPassword }`
- `PUT /api/account/username` — `{ newUsername, currentPassword }`
- `PUT /api/account/password` — `{ currentPassword, newPassword }`
- `DELETE /api/account`
- `POST /api/account/games-played` — increments `gamesPlayed`
- `POST /api/feedback` — `{ email?, message, players? }` sends a feedback email (or logs to console if SMTP not configured)

## Feedback Email Setup

To receive feedback emails from the lobby form, configure SMTP in `backend/.env`:

```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_pass
MAIL_FROM="System Overload <no-reply@example.com>"
MAIL_TO=you@example.com
```

If SMTP is not configured, the server falls back to a console transport (logs the email payload). This is useful in local development.

When `APP_PHASE=development` (or `NODE_ENV=development`), the API also exposes:

- `GET /api/dev/info` — returns minimal environment flags `{ phase, nodeEnv }` to help verify environment wiring (no secrets).

## Development Phase Switch

- Backend reads `APP_PHASE` (development | staging | production) and derives a dev mode when `APP_PHASE=development` or `NODE_ENV=development`.
- Dev mode effects:
  - Looser rate limits (auth/account) to avoid throttling local testing.
  - Adds `GET /api/dev/info` to validate environment wiring.
- Frontend reads `VITE_APP_PHASE` (optional). If unset, it falls back to Vite's `MODE`.
  - You can show a small dev badge or enable debug UI based on this flag.

Notes:

- Keep secrets out of `.env.sample`. Use real values only in local `.env` files.
- Do not enable dev endpoints in production; they are scoped by `APP_PHASE`.

## Postman Collection

- Collection: `postman/SystemOverload.postman_collection.json`
- Environment (local): `postman/SystemOverload.local_environment.json`

Usage:

- Import both files into Postman.
- Ensure backend is running and `{{base_url}}` points to `http://localhost:8080/api` (or your deploy).
- Run "POST /api/auth/register" (optional) then "POST /api/auth/login"; the test script stores `{{jwt}}` automatically.
- Subsequent requests inherit Bearer auth via `{{jwt}}`.

## Notes

- JWT lifetime: 24h (configurable).
- `gamesPlayed` increments when you POST to `/api/account/games-played` at the end of a game.
