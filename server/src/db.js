import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { config } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isNewDb = !existsSync(config.dbPath);

export const db = new DatabaseSync(config.dbPath);
db.exec('PRAGMA foreign_keys = ON');

if (isNewDb) {
  const schema = readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  console.log(`Initialized database from schema.sql at ${config.dbPath}`);
} else {
  // Migration for DBs created before recycle_centers.join_code existed.
  const columns = db.prepare('PRAGMA table_info(recycle_centers)').all();
  if (!columns.some((c) => c.name === 'join_code')) {
    db.exec('ALTER TABLE recycle_centers ADD COLUMN join_code TEXT');
    const centers = db.prepare('SELECT id FROM recycle_centers WHERE join_code IS NULL').all();
    const setCode = db.prepare('UPDATE recycle_centers SET join_code = ? WHERE id = ?');
    for (const { id } of centers) {
      setCode.run(randomBytes(6).toString('hex'), id);
    }
    console.log(`Migrated recycle_centers: added join_code, backfilled ${centers.length} row(s).`);
  }
}
