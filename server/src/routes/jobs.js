import { Router } from 'express';
import { db } from '../db.js';
import { emitJobUpdate } from '../sockets.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const jobsRouter = Router();

jobsRouter.get('/', requireAuth, requireRole('collector'), (req, res) => {
  const areaName = req.query.area;
  if (!areaName) return res.status(400).json({ error: 'area query param is required' });

  const items = db.prepare(
    `SELECT * FROM items WHERE area_name = ? AND status = 'posted' ORDER BY created_at DESC`
  ).all(areaName);
  res.json(items);
});

jobsRouter.post('/:itemId/accept', requireAuth, requireRole('collector'), (req, res) => {
  const { itemId } = req.params;
  const { pickupTime } = req.body;
  if (!pickupTime) return res.status(400).json({ error: 'pickupTime is required' });

  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId);
  if (!item) return res.status(404).json({ error: 'item not found' });
  if (item.status !== 'posted') return res.status(409).json({ error: `item is already ${item.status}` });

  const insertJob = db.prepare(
    `INSERT INTO collection_jobs (item_id, collector_id, pickup_time) VALUES (?, ?, ?)`
  );
  const { lastInsertRowid: jobId } = insertJob.run(itemId, req.user.id, pickupTime);
  db.prepare(`UPDATE items SET status = 'accepted' WHERE id = ?`).run(itemId);

  const job = db.prepare('SELECT * FROM collection_jobs WHERE id = ?').get(jobId);
  emitJobUpdate([item.poster_id, req.user.id], { ...job, itemStatus: 'accepted' });
  res.status(201).json(job);
});

jobsRouter.patch('/:jobId/status', requireAuth, requireRole('collector'), (req, res) => {
  const { jobId } = req.params;
  const { status } = req.body;
  if (status !== 'picked_up') {
    return res.status(400).json({ error: 'this endpoint only transitions a job to picked_up; delivery is confirmed by a recycle center' });
  }

  const job = db.prepare('SELECT * FROM collection_jobs WHERE id = ?').get(jobId);
  if (!job) return res.status(404).json({ error: 'job not found' });
  if (job.collector_id !== req.user.id) return res.status(403).json({ error: 'this is not your job' });
  if (job.status !== 'accepted') return res.status(409).json({ error: `job is already ${job.status}` });

  db.prepare(`UPDATE collection_jobs SET status = 'picked_up', picked_up_at = datetime('now') WHERE id = ?`).run(jobId);
  db.prepare(`UPDATE items SET status = 'picked_up' WHERE id = ?`).run(job.item_id);

  const updatedJob = db.prepare('SELECT * FROM collection_jobs WHERE id = ?').get(jobId);
  const item = db.prepare('SELECT poster_id FROM items WHERE id = ?').get(job.item_id);
  emitJobUpdate([item.poster_id, job.collector_id], { ...updatedJob, itemStatus: 'picked_up' });
  res.json(updatedJob);
});

jobsRouter.get('/mine', requireAuth, requireRole('collector'), (req, res) => {
  const jobs = db.prepare(
    `SELECT j.*, i.description, i.category, i.weight_kg, i.area_name,
            (SELECT GROUP_CONCAT(rc.name, ', ')
             FROM recycle_centers rc
             WHERE rc.area_name = i.area_name
               AND (',' || rc.accepted_categories || ',') LIKE '%,' || i.category || ',%'
            ) AS deliver_to
     FROM collection_jobs j JOIN items i ON i.id = j.item_id
     WHERE j.collector_id = ? ORDER BY j.accepted_at DESC`
  ).all(req.user.id);
  res.json(jobs);
});
