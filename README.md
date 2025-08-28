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

2. **Frontend**

```bash
cd ../frontend
npm install
npm run dev
```

Visit `http://localhost:5173` and update `API_BASE` in `src/api.js` to `http://localhost:8080/api` for local dev.

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
- `DELETE /api/account`
- `POST /api/account/games-played` — increments `gamesPlayed`

## Notes

- JWT lifetime: 24h (configurable).
- `gamesPlayed` increments when you POST to `/api/account/games-played` at the end of a game.
