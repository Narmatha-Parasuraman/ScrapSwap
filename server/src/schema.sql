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
    accepted_categories TEXT NOT NULL,  -- comma-separated, e.g. 'plastic,metal,e_waste'
    -- Shared secret staff must supply to join this center at signup (never
    -- returned by GET /centers, which is public so the signup form can list
    -- centers by name). Prevents anyone who knows/guesses a centerId from
    -- registering as staff and confirming deliveries for a center they don't
    -- work at.
    join_code           TEXT NOT NULL
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
-- Dev seed join code for the seeded center is "join-woodlands-dev".
INSERT INTO recycle_centers (name, area_name, accepted_categories, join_code) VALUES
    ('Woodlands Recycling Point', 'Woodlands', 'plastic,paper,metal,e_waste,glass', 'join-woodlands-dev');

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
