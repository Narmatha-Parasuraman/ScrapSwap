import { verifyToken } from './lib/jwt.js';
import { db } from './db.js';

let ioInstance = null;

// Socket.IO room names are plain-string matches with no notion of the DB's
// COLLATE NOCASE -- normalize here so "Woodlands" and "woodlands" join the
// same room regardless of how each side typed it.
function areaRoom(areaName) {
  return `area:${areaName.trim().toLowerCase()}`;
}

export function attachSockets(io) {
  ioInstance = io;

  // Auth happens once, in the handshake, from a server-verified JWT -- not
  // from a client-emitted "identify" payload a socket could put any userId
  // into. Room membership is then derived server-side from the DB, not
  // trusted from whatever the client claims its areas are.
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('authentication required'));
      socket.data.user = verifyToken(token); // { id, role, centerId }
      next();
    } catch {
      next(new Error('invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const { id, role } = socket.data.user;
    socket.join(`user:${id}`);

    if (role === 'collector') {
      const areas = db.prepare('SELECT area_name FROM collector_areas WHERE collector_id = ?').all(id);
      for (const { area_name } of areas) {
        socket.join(areaRoom(area_name));
      }
    }
  });
}

export function emitItemNew(areaName, item) {
  ioInstance?.to(areaRoom(areaName)).emit('item:new', item);
}

export function emitJobUpdate(userIds, job) {
  for (const userId of userIds) {
    ioInstance?.to(`user:${userId}`).emit('job:update', job);
  }
}

export function emitRewardCredited(userId, transaction) {
  ioInstance?.to(`user:${userId}`).emit('reward:credited', transaction);
}
