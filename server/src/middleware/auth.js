import { verifyToken } from '../lib/jwt.js';

// Sets req.user = { id, role, centerId } from a verified JWT. Nothing about
// identity is ever trusted from the request body/query after this point --
// route handlers must read posterId/collectorId/callerId/userId from req.user,
// not from client-supplied fields.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'authentication required' });

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'invalid or expired token' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `requires role: ${roles.join(' or ')}` });
    }
    next();
  };
}
