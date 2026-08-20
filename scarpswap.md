# Recycling pickup app — concept doc

A two-sided app connecting households with recyclable items to collectors who
pick them up and deliver them to a recycling center. v1 is deliberately
simplified: **area name instead of geolocation**, no maps or GPS.

## User roles

| Role | Does |
|---|---|
| **Poster** | Posts an item (description, category, weight, area). Earns points once it's delivered. |
| **Collector** | Sees pending items in the area(s) they cover, accepts a job, picks up, drops off at a recycle center. Earns points once delivery is confirmed. |
| **Recycle center** | Confirms drop-off. This confirmation is what triggers reward payout — collectors can't self-mark delivery. |

## Workflow

1. Poster posts an item with a category, weight, and **area name**.
2. Item appears **instantly** in the job list of every collector who covers that area — pushed over a live socket connection, not pull-to-refresh. Collectors join a room per covered area on connect; the server broadcasts to that room the moment the item is posted.
3. A collector accepts the job, sets a pickup time.
4. Collector picks up the item — status: `picked_up`.
5. Collector drops it off at a recycle center. Center staff confirm the drop-off.
6. Confirmation triggers reward points: **collector gets more, poster gets a smaller amount.**

## Screens (v1)

- **Dashboard** (all roles) — role-specific landing page after login: posters see item counts by status + points, collectors see job counts by status + points, center staff see pending/confirmed counts + total weight processed. Updates live.
- **Post item** (poster) — category, weight, description, area dropdown, optional photo.
- **Job list** (collector) — pending items filtered by the collector's area(s), each with an Accept button. Live-updating: new items appear as they're posted, no manual refresh.
- **Status tracker** — shows `posted → accepted → picked_up → delivered` for the poster's own items and the collector's active jobs, updating live as status changes.
- **Drop-off confirmation** (recycle center staff) — table of items picked up and awaiting confirmation, with item #, description, category, weight, area, and collector name. Confirming triggers the reward payout. Only staff of a recycle center (a distinct role from collector) can confirm.

## Data model

| Entity | Key fields |
|---|---|
| `users` | id, name, phone, password_hash, role (`poster`/`collector`/`center`), center_id (set only for role `center`), reward_points |
| `collector_areas` | collector_id, area_name — a collector can cover more than one area |
| `items` | id, poster_id, description, category, weight_kg, area_name, status |
| `recycle_centers` | id, name, area_name, accepted_categories, join_code (shared secret staff supply at signup to join this center) |
| `collection_jobs` | id, item_id (unique), collector_id, center_id, pickup_time, status, timestamps |
| `reward_transactions` | id, user_id, item_id, points, reason (`post_reward`/`collect_reward`) |

## Reward logic

Points are credited automatically the moment a job's status flips to
`delivered`, via a database trigger — not app code, so it can't be
forgotten or double-fired:

- **Collector**: 10 points per kg
- **Poster**: 3 points per kg (minimum 1 point)

Example: a 5 kg item delivered gives the collector 50 points and the poster 15 points.

## API routes

```
POST   /auth/signup                 { name, phone, password, role, areas? (collector), centerId?+joinCode? / centerName?+centerAreaName? (center) }
POST   /auth/login                  { phone, password }

# Poster side
POST   /items                       { description, category, weight, areaName }
GET    /items/mine                  -> poster's own items + status

# Collector side
GET    /jobs?area=Woodlands         -> pending items in collector's area(s)
POST   /jobs/:itemId/accept         { pickupTime }  -> creates collection_job
PATCH  /jobs/:jobId/status          { status: "picked_up" }
GET    /jobs/mine                   -> collector's active + past jobs

# Recycle center side (separate login — not the collector)
POST   /centers/:centerId/confirm   { jobId }  -> sets status "delivered", fires reward trigger

# Rewards
GET    /rewards/:userId             -> points balance + transaction history

# Dashboard (all roles — role-specific response shape)
GET    /dashboard/:userId           -> status counts/points (poster/collector), pending/confirmed/weight totals (center)
```

Note: request fields are camelCase (`areaName`, `pickupTime`), matching the JS route handlers — not the snake_case column names used in the SQLite schema below.

## Real-time events (Socket.IO)

Client connects and emits `identify` with `{ userId, role, areas }`. The
server then joins the socket to rooms and pushes events — clients never
emit domain events themselves, only route handlers do, right after the
corresponding DB write:

| Room | Who joins | Event | Fired when |
|---|---|---|---|
| `area:<area_name>` | Collectors, one room per covered area | `item:new` | `POST /items` creates an item in that area |
| `user:<userId>` | Every logged-in user | `job:update` | Job status changes (`accept`, `picked_up`, center `confirm`) — sent to both the item's poster and the job's collector |
| `user:<userId>` | Every logged-in user | `reward:credited` | The delivery trigger fires and credits that user's points |

## Database schema (SQLite)

```sql
-- Recycling app schema (SQLite)
-- Simplified version: area_name (text) instead of geolocation

PRAGMA foreign_keys = ON;

-- ==========================================
-- USERS
-- ==========================================
CREATE TABLE users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    phone         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('poster', 'collector', 'center')),
    center_id     INTEGER REFERENCES recycle_centers(id),  -- set only for role = 'center'
    reward_points INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Areas a collector covers (a collector can pick more than one).
-- Posters don't need this table -- their area lives on the item itself.
CREATE TABLE collector_areas (
    collector_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    area_name    TEXT NOT NULL COLLATE NOCASE,
    PRIMARY KEY (collector_id, area_name)
);

-- ==========================================
-- ITEMS  (posted by a "poster")
-- ==========================================
CREATE TABLE items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    poster_id   INTEGER NOT NULL REFERENCES users(id),
    description TEXT NOT NULL,
    category    TEXT NOT NULL CHECK (category IN ('plastic', 'paper', 'metal', 'e_waste', 'glass', 'other')),
    weight_kg   REAL NOT NULL CHECK (weight_kg > 0),
    area_name   TEXT NOT NULL COLLATE NOCASE,
    status      TEXT NOT NULL DEFAULT 'posted'
                CHECK (status IN ('posted', 'accepted', 'picked_up', 'delivered', 'cancelled')),
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_items_area_status ON items(area_name, status);

-- ==========================================
-- RECYCLE CENTERS  (drop-off points)
-- ==========================================
CREATE TABLE recycle_centers (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    name                TEXT NOT NULL,
    area_name           TEXT NOT NULL COLLATE NOCASE,
    accepted_categories TEXT NOT NULL  -- comma-separated, e.g. 'plastic,metal,e_waste'
);

-- ==========================================
-- COLLECTION JOBS  (one per item, once a collector accepts it)
-- ==========================================
CREATE TABLE collection_jobs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id       INTEGER NOT NULL UNIQUE REFERENCES items(id),
    collector_id  INTEGER NOT NULL REFERENCES users(id),
    center_id     INTEGER REFERENCES recycle_centers(id),
    pickup_time   TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'accepted'
                  CHECK (status IN ('accepted', 'picked_up', 'delivered')),
    accepted_at   TEXT NOT NULL DEFAULT (datetime('now')),
    picked_up_at  TEXT,
    delivered_at  TEXT
);

CREATE INDEX idx_jobs_collector ON collection_jobs(collector_id);

-- ==========================================
-- REWARD TRANSACTIONS  (credited only after center confirms delivery)
-- ==========================================
CREATE TABLE reward_transactions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    item_id    INTEGER NOT NULL REFERENCES items(id),
    points     INTEGER NOT NULL,
    reason     TEXT NOT NULL CHECK (reason IN ('post_reward', 'collect_reward')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_rewards_user ON reward_transactions(user_id);

-- ==========================================
-- REWARD TRIGGER
-- Fires the moment a job's status flips to 'delivered'.
-- Collector: 10 points/kg. Poster: 3 points/kg (min 1 point).
-- Runs once per job because of the OLD.status != 'delivered' guard.
-- ==========================================
CREATE TRIGGER trg_delivery_rewards
AFTER UPDATE OF status ON collection_jobs
WHEN NEW.status = 'delivered' AND OLD.status != 'delivered'
BEGIN
    -- Log the collector's reward
    INSERT INTO reward_transactions (user_id, item_id, points, reason)
    SELECT NEW.collector_id, NEW.item_id, CAST(ROUND(i.weight_kg * 10) AS INTEGER), 'collect_reward'
    FROM items i WHERE i.id = NEW.item_id;

    -- Log the poster's reward
    INSERT INTO reward_transactions (user_id, item_id, points, reason)
    SELECT i.poster_id, NEW.item_id, MAX(1, CAST(ROUND(i.weight_kg * 3) AS INTEGER)), 'post_reward'
    FROM items i WHERE i.id = NEW.item_id;

    -- Credit the collector's running balance
    UPDATE users SET reward_points = reward_points +
        (SELECT CAST(ROUND(weight_kg * 10) AS INTEGER) FROM items WHERE id = NEW.item_id)
    WHERE id = NEW.collector_id;

    -- Credit the poster's running balance
    UPDATE users SET reward_points = reward_points +
        (SELECT MAX(1, CAST(ROUND(weight_kg * 3) AS INTEGER)) FROM items WHERE id = NEW.item_id)
    WHERE id = (SELECT poster_id FROM items WHERE id = NEW.item_id);

    -- Mark the item itself as delivered too, so item.status and job.status stay in sync
    UPDATE items SET status = 'delivered' WHERE id = NEW.item_id;
END;

-- ==========================================
-- SEED DATA (for local testing)
-- ==========================================
INSERT INTO recycle_centers (name, area_name, accepted_categories) VALUES
    ('Woodlands Recycling Point', 'Woodlands', 'plastic,paper,metal,e_waste,glass');

-- Dev seed password for all seeded accounts below is "password123"
-- (bcrypt hash, cost 10 -- change these accounts' passwords before using
-- this schema anywhere real users can reach it).
INSERT INTO users (name, phone, password_hash, role) VALUES
    ('Ravi', '90000001', '$2a$10$FTXRaTGtQWO3RXUceTatMuBCEw6QLfCD13vw6e87NB8K4PSL3IBd2', 'poster'),
    ('Mei Ling', '10000001', '$2a$10$FTXRaTGtQWO3RXUceTatMuBCEw6QLfCD13vw6e87NB8K4PSL3IBd2', 'collector');

INSERT INTO users (name, phone, password_hash, role, center_id) VALUES
    ('Tan (center staff)', '90000003', '$2a$10$FTXRaTGtQWO3RXUceTatMuBCEw6QLfCD13vw6e87NB8K4PSL3IBd2', 'center', 1);

INSERT INTO collector_areas (collector_id, area_name) VALUES
    (2, 'Woodlands'),
    (2, 'Yishun');

INSERT INTO items (poster_id, description, category, weight_kg, area_name) VALUES
    (1, 'Flattened cardboard boxes, dry', 'paper', 5.0, 'Woodlands');
```

## Next steps (later phases)

- Browser/mobile push notifications when the app is backgrounded (in-app real-time via Socket.IO is now v1; this covers the case where the collector's tab/app isn't open)
- Replace area_name matching with geolocation + radius search
- Photo upload for posted items
- Admin dashboard for recycle centers
- Reward redemption (convert points to vouchers/cash — needs a payment provider)