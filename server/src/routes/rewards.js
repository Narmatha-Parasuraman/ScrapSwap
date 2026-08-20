import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

export const rewardsRouter = Router();

rewardsRouter.get('/:userId', requireAuth, (req, res) => {
  const { userId } = req.params;
  if (String(req.user.id) !== String(userId)) {
    return res.status(403).json({ error: 'you can only view your own rewards' });
  }

  const user = db.prepare('SELECT id, name, reward_points FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'user not found' });

  const transactions = db.prepare(
    `SELECT t.*, i.description AS item_description
     FROM reward_transactions t JOIN items i ON i.id = t.item_id
     WHERE t.user_id = ? ORDER BY t.created_at DESC`
  ).all(userId);

  res.json({ userId: user.id, name: user.name, balance: user.reward_points, transactions });
});
