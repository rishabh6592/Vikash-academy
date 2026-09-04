const jwt = require('jsonwebtoken');

/**
 * Reads "Authorization: Bearer <token>", verifies it, and attaches
 * { id, role } to req.user. Rejects the request with 401 if the token
 * is missing or invalid — this is what makes routes actually protected,
 * unlike the old localStorage version where anyone could fake a session.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Login required.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, role, iat, exp }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Session expired or invalid. Please log in again.' });
  }
}

/**
 * Use after requireAuth. Only lets the request through if the logged-in
 * user's role is in the allowed list.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to do this.' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
