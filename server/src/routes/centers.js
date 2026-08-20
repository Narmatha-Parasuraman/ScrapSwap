import { Router } from 'express';
import { db } from '../db.js';
import { emitJobUpdate, emitRewardCredited } from '../sockets.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const centersRouter = Router();

// Intentionally public -- needed during signup so an unauthenticated
// visitor picking the "center staff" role can choose which center they work
// for. join_code is deliberately excluded: it's the shared secret staff must
// supply to join a center, and must not be discoverable from this list.
centersRouter.get('/', (req, res) => {
  res.json(db.prepare('SELECT id, name, area_name, accepted_categories FROM recycle_centers').all());
});

function requireOwnCenter(req, res, next) {
  if (String(req.user.centerId) !== String(req.params.centerId)) {
    return res.status(403).json({ error: 'you are not staff of this recycle center' });
  }
  next();
}

// Jobs not yet delivered, with full detail for center staff: which collector
// has it, which item, item #. Includes 'accepted' jobs too -- a collector who
// forgot to tap "mark picked up" can still be confirmed here; the confirm
// step below auto-advances through picked_up rather than blocking on it.
// Not area-filtered -- a collector can drop an item at any center, not just
// one matching the item's posted area.
centersRouter.get('/:centerId/pending', requireAuth, requireRole('center'), requireOwnCenter, (req, res) => {
  const jobs = db.prepare(
    `SELECT j.id AS job_id, j.status, j.accepted_at, j.picked_up_at,
            i.id AS item_id, i.description, i.category, i.weight_kg, i.area_name,
            u.id AS collector_id, u.name AS collector_name
     FROM collection_jobs j
     JOIN items i ON i.id = j.item_id
     JOIN users u ON u.id = j.collector_id
     WHERE j.status IN ('accepted', 'picked_up')
     ORDER BY COALESCE(j.picked_up_at, j.accepted_at) ASC`
  ).all();

  res.json(jobs);
});

centersRouter.post('/:centerId/confirm', requireAuth, requireRole('center'), requireOwnCenter, (req, res) => {
  const { centerId } = req.params;
  const { jobId } = req.body;
  if (!jobId) return res.status(400).json({ error: 'jobId is required' });

  const job = db.prepare('SELECT * FROM collection_jobs WHERE id = ?').get(jobId);
  if (!job) return res.status(404).json({ error: 'job not found' });
  if (!['accepted', 'picked_up'].includes(job.status)) {
    return res.status(409).json({ error: `job is already ${job.status}` });
  }

  // If the collector never tapped "mark picked up", confirming delivery here
  // is proof enough it happened -- back-fill picked_up_at rather than
  // blocking the center on a step the collector forgot.
  db.prepare(
    `UPDATE collection_jobs
     SET center_id = ?, status = 'delivered', delivered_at = datetime('now'),
         picked_up_at = COALESCE(picked_up_at, datetime('now'))
     WHERE id = ?`
  ).run(centerId, jobId);

  const updatedJob = db.prepare('SELECT * FROM collection_jobs WHERE id = ?').get(jobId);
  const item = db.prepare('SELECT poster_id FROM items WHERE id = ?').get(job.item_id);

  emitJobUpdate([item.poster_id, job.collector_id], { ...updatedJob, itemStatus: 'delivered' });

  const transactions = db.prepare(
    'SELECT * FROM reward_transactions WHERE item_id = ? ORDER BY id DESC LIMIT 2'
  ).all(job.item_id);
  for (const tx of transactions) {
    emitRewardCredited(tx.user_id, tx);
  }

  res.json(updatedJob);
});
