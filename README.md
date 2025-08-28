# System Overload — Hotseat Card Game

- **Frontend:** React (JavaScript) + Vite — hotseat game runs fully client-side with `useState`/`useReducer`.
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
