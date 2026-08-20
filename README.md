# ScrapSwap ♻️

A two-sided recycling pickup app connecting **posters** (households with
recyclable items) to **collectors** who pick them up and deliver them to a
**recycle center**. Rewards points are credited automatically once a center
confirms delivery. v1 is deliberately simplified — area names instead of
maps/GPS.

**Live app:** https://narmatha-parasuraman.github.io/ScrapSwap/
**API:** https://panpraswap.onrender.com

> The backend runs on Render's free tier, which spins down after inactivity
> — the first request after a while may take ~30s to wake up. It also has
> no persistent disk, so the database resets on every redeploy. Fine for a
> demo; see [Known limitations](#known-limitations) before relying on it
> for real data.

## Features

- **Three roles, one app**: poster, collector, recycle-center staff — each
  gets a role-specific dashboard, nav, and permissions.
- **Live updates over Socket.IO**: a posted item appears in matching
  collectors' job lists instantly, no refresh. Status changes
  (`posted → accepted → picked_up → delivered`) push live to everyone
  involved.
- **Reward points via a DB trigger**: credited the moment a center confirms
  delivery — 10 pts/kg to the collector, 3 pts/kg (min 1) to the poster.
  Can't be double-fired or forgotten, since it's not app code.
- **Center staff join by invite code**: a recycle center's `join_code` is a
  shared secret, so knowing a center's public ID isn't enough to register
  as staff and start confirming deliveries.

See [scarpswap.md](scarpswap.md) for the full concept doc — data model, all
API routes, Socket.IO event reference, and the SQLite schema.

## Tech stack

| | |
|---|---|
| Client | React 18, React Router (`HashRouter`), Vite, socket.io-client |
| Server | Node.js ≥24, Express, Socket.IO, `node:sqlite`, JWT auth, bcrypt |
| Hosting | Client on GitHub Pages (via GitHub Actions); server on Render |

## Project structure

```
client/    React SPA (Vite)
server/    Express API + Socket.IO + SQLite
scarpswap.md   Full concept doc: data model, API routes, schema
render.yaml    Render blueprint for the backend
```

## Running locally

Requires **Node ≥24** (the server imports `node:sqlite`, which needs the
`--experimental-sqlite` flag or Node 24+ to run unflagged).

```bash
# Terminal 1 — backend, http://localhost:4000
cd server
npm install
npm run dev

# Terminal 2 — frontend, http://localhost:5173
cd client
npm install
npm run dev
```

The client reads its API/socket URLs from `client/.env.local`
(see `client/.env.example`) — copy it and it'll default to
`http://localhost:4000`, matching the backend above.

## Deployment

- **Client → GitHub Pages**: `.github/workflows/deploy-pages.yml` builds
  `client/` and publishes it on every push to `main`. Build-time env vars
  `VITE_API_URL` / `VITE_SOCKET_URL` are set as repo Actions variables
  (Settings → Secrets and variables → Actions → Variables) and get baked
  into the bundle at build time.
- **Server → Render**: `render.yaml` describes the service (Node 24, no
  persistent disk on the free plan). Required environment variables:
  `NODE_ENV=production`, `JWT_SECRET` (random string), `CORS_ORIGIN` (must
  exactly match the GitHub Pages origin, no trailing slash).

## Known limitations

- **Ephemeral database**: Render's free plan has no persistent disk, so the
  SQLite file resets on every redeploy/restart. Move to a paid plan with a
  mounted disk (or a hosted Postgres) before this holds real user data.
- **Cold starts**: the free-tier backend sleeps after inactivity; the first
  request after a while takes longer while it wakes up.
- **No photo upload, no geolocation** — v1 uses a free-text area name
  instead of maps. See [scarpswap.md](scarpswap.md#next-steps-later-phases)
  for the planned next phases.
