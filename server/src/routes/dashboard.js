import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

export const dashboardRouter = Router();

function countsByStatus(rows) {
  const counts = {};
  for (const row of rows) counts[row.status] = row.count;
  return counts;
}

dashboardRouter.get('/:userId', requireAuth, (req, res) => {
  const { userId } = req.params;
  if (String(req.user.id) !== String(userId)) {
    return res.status(403).json({ error: 'you can only view your own dashboard' });
  }

  const user = db.prepare('SELECT id, name, role, reward_points, center_id FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'user not found' });

  if (user.role === 'poster') {
    const statusCounts = countsByStatus(
      db.prepare(`SELECT status, COUNT(*) AS count FROM items WHERE poster_id = ? GROUP BY status`).all(userId)
    );
    const recentItems = db.prepare(
      `SELECT id, description, category, weight_kg, area_name, status, created_at
       FROM items WHERE poster_id = ? ORDER BY created_at DESC LIMIT 5`
    ).all(userId);

    return res.json({
      user: { id: user.id, name: user.name, role: user.role, points: user.reward_points },
      stats: {
        totalPosted: Object.values(statusCounts).reduce((a, b) => a + b, 0),
        pending: statusCounts.posted ?? 0,
        inProgress: (statusCounts.accepted ?? 0) + (statusCounts.picked_up ?? 0),
        delivered: statusCounts.delivered ?? 0,
      },
      recentItems,
    });
  }

  if (user.role === 'collector') {
    const statusCounts = countsByStatus(
      db.prepare(`SELECT status, COUNT(*) AS count FROM collection_jobs WHERE collector_id = ? GROUP BY status`).all(userId)
    );
    const recentJobs = db.prepare(
      `SELECT j.id AS job_id, j.status, j.accepted_at, i.description, i.category, i.weight_kg, i.area_name
       FROM collection_jobs j JOIN items i ON i.id = j.item_id
       WHERE j.collector_id = ? ORDER BY j.accepted_at DESC LIMIT 5`
    ).all(userId);
    const areas = db.prepare('SELECT area_name FROM collector_areas WHERE collector_id = ?').all(userId).map(r => r.area_name);
    const pendingInArea = areas.length === 0 ? 0 : db.prepare(
      `SELECT COUNT(*) AS count FROM items WHERE status = 'posted' AND area_name IN (${areas.map(() => '?').join(',')})`
    ).get(...areas).count;

    return res.json({
      user: { id: user.id, name: user.name, role: user.role, points: user.reward_points },
      stats: {
        totalJobs: Object.values(statusCounts).reduce((a, b) => a + b, 0),
        accepted: statusCounts.accepted ?? 0,
        pickedUp: statusCounts.picked_up ?? 0,
        delivered: statusCounts.delivered ?? 0,
        pendingInArea,
      },
      areas,
      recentJobs,
    });
  }

  // center staff
  const center = db.prepare('SELECT * FROM recycle_centers WHERE id = ?').get(user.center_id);
  const pendingCount = db.prepare(`SELECT COUNT(*) AS count FROM collection_jobs WHERE status IN ('accepted', 'picked_up')`).get().count;
  const confirmedCount = db.prepare(
    `SELECT COUNT(*) AS count FROM collection_jobs WHERE status = 'delivered' AND center_id = ?`
  ).get(user.center_id).count;
  const totalWeight = db.prepare(
    `SELECT COALESCE(SUM(i.weight_kg), 0) AS total
     FROM collection_jobs j JOIN items i ON i.id = j.item_id
     WHERE j.status = 'delivered' AND j.center_id = ?`
  ).get(user.center_id).total;
  const recentConfirmed = db.prepare(
    `SELECT j.id AS job_id, j.delivered_at, i.id AS item_id, i.description, i.category, i.weight_kg, u.name AS collector_name
     FROM collection_jobs j
     JOIN items i ON i.id = j.item_id
     JOIN users u ON u.id = j.collector_id
     WHERE j.status = 'delivered' AND j.center_id = ?
     ORDER BY j.delivered_at DESC LIMIT 5`
  ).all(user.center_id);

  res.json({
    user: { id: user.id, name: user.name, role: user.role, points: user.reward_points },
    center,
    stats: {
      pending: pendingCount,
      confirmed: confirmedCount,
      totalWeightKg: totalWeight,
    },
    recentConfirmed,
  });
});
