import { Router } from 'express';
import { db } from '../db.js';
import { emitItemNew } from '../sockets.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const itemsRouter = Router();

const CATEGORIES = ['plastic', 'paper', 'metal', 'e_waste', 'glass', 'other'];

itemsRouter.post('/', requireAuth, requireRole('poster'), (req, res) => {
  const { description, category, weight, areaName } = req.body;
  if (!description || !category || weight === undefined || !areaName) {
    return res.status(400).json({ error: 'description, category, weight, areaName are required' });
  }
  if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0) {
    return res.status(400).json({ error: 'weight must be a positive number' });
  }
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(', ')}` });
  }

  const trimmedArea = areaName.trim();
  if (!trimmedArea) {
    return res.status(400).json({ error: 'areaName cannot be blank' });
  }

  const insert = db.prepare(
    `INSERT INTO items (poster_id, description, category, weight_kg, area_name)
     VALUES (?, ?, ?, ?, ?)`
  );
  const { lastInsertRowid: itemId } = insert.run(req.user.id, description, category, weight, trimmedArea);
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId);

  emitItemNew(trimmedArea, item);

  const coverageCount = db.prepare(
    'SELECT COUNT(*) AS count FROM collector_areas WHERE area_name = ?'
  ).get(trimmedArea).count;
  const warning = coverageCount === 0
    ? `No collectors currently cover "${trimmedArea}" — this item will wait until one registers for that area.`
    : null;

  res.status(201).json({ ...item, warning });
});

itemsRouter.get('/mine', requireAuth, requireRole('poster'), (req, res) => {
  const items = db.prepare('SELECT * FROM items WHERE poster_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(items);
});
