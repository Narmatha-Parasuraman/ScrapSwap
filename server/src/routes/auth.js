import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { db } from '../db.js';
import { signToken } from '../lib/jwt.js';

export const authRouter = Router();

const ROLES = ['poster', 'collector', 'center'];

function userResponse(user, areas) {
  return {
    token: signToken({ id: user.id, role: user.role, centerId: user.center_id ?? null }),
    userId: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    areas: areas ?? [],
    centerId: user.center_id ?? null,
  };
}

authRouter.post('/signup', (req, res) => {
  const { name, phone, password, role, areas, centerId, joinCode, centerName, centerAreaName, acceptedCategories } = req.body;
  if (!name || !phone || !password || !role) {
    return res.status(400).json({ error: 'name, phone, password, and role are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters' });
  }
  if (!ROLES.includes(role)) {
    return res.status(400).json({ error: 'role must be poster, collector, or center' });
  }
  if (role === 'collector' && (!Array.isArray(areas) || areas.filter((a) => a && a.trim()).length === 0)) {
    return res.status(400).json({ error: 'collectors must cover at least one area' });
  }

  let resolvedCenterId = null;
  let newCenterJoinCode = null;
  if (role === 'center') {
    if (centerId) {
      // joinCode is a shared secret only existing staff/the center creator
      // know -- required so knowing/guessing a public centerId (GET /centers
      // is intentionally unauthenticated) isn't enough to register as staff
      // and gain the ability to confirm deliveries and trigger reward payouts.
      if (!joinCode) return res.status(400).json({ error: 'joinCode is required to join an existing center' });
      const center = db.prepare('SELECT id, join_code FROM recycle_centers WHERE id = ?').get(centerId);
      if (!center) return res.status(404).json({ error: 'recycle center not found' });
      if (center.join_code !== joinCode) return res.status(403).json({ error: 'invalid joinCode for this center' });
      resolvedCenterId = center.id;
    } else if (centerName && centerAreaName) {
      newCenterJoinCode = randomBytes(6).toString('hex');
      const insertCenter = db.prepare(
        'INSERT INTO recycle_centers (name, area_name, accepted_categories, join_code) VALUES (?, ?, ?, ?)'
      );
      const categories = Array.isArray(acceptedCategories) ? acceptedCategories.join(',') : (acceptedCategories || 'plastic,paper,metal,e_waste,glass');
      resolvedCenterId = insertCenter.run(centerName, centerAreaName.trim(), categories, newCenterJoinCode).lastInsertRowid;
    } else {
      return res.status(400).json({ error: 'center role requires either centerId + joinCode (join existing) or centerName + centerAreaName (create new)' });
    }
  }

  try {
    const passwordHash = bcrypt.hashSync(password, 10);
    const insertUser = db.prepare(
      'INSERT INTO users (name, phone, password_hash, role, center_id) VALUES (?, ?, ?, ?, ?)'
    );
    const { lastInsertRowid: userId } = insertUser.run(name, phone, passwordHash, role, resolvedCenterId);

    let resolvedAreas = [];
    if (role === 'collector' && Array.isArray(areas)) {
      const insertArea = db.prepare(
        'INSERT OR IGNORE INTO collector_areas (collector_id, area_name) VALUES (?, ?)'
      );
      for (const areaName of areas) {
        const trimmed = areaName.trim();
        if (trimmed) insertArea.run(userId, trimmed);
      }
      resolvedAreas = db.prepare('SELECT area_name FROM collector_areas WHERE collector_id = ?').all(userId).map(r => r.area_name);
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    const response = userResponse(user, resolvedAreas);
    // Only returned once, to the staffer who just created the center -- they
    // must pass it along to any coworker signing up to join the same center.
    if (newCenterJoinCode) response.centerJoinCode = newCenterJoinCode;
    res.status(201).json(response);
  } catch (err) {
    if (err.code === 'ERR_SQLITE_ERROR' && err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'phone already registered' });
    }
    throw err;
  }
});

authRouter.post('/login', (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) return res.status(400).json({ error: 'phone and password are required' });

  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  // Same generic error whether the phone doesn't exist or the password is
  // wrong -- avoids leaking which phone numbers are registered.
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'invalid phone or password' });
  }

  const areas = user.role === 'collector'
    ? db.prepare('SELECT area_name FROM collector_areas WHERE collector_id = ?').all(user.id).map(r => r.area_name)
    : [];

  res.json(userResponse(user, areas));
});
