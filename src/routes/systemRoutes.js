const express = require('express');

const { authenticateToken } = require('../middlewares/authMiddleware');
const { getActivitySnapshot, logEvent, touchSession } = require('../services/activityService');

const router = express.Router();

function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
}

router.use(authenticateToken);

router.get('/activity', (req, res) => {
  const token = getTokenFromRequest(req);

  touchSession({
    token,
    userId: req.user?.id,
    username: req.user?.username,
    role: req.user?.role,
  });

  return res.json(getActivitySnapshot(60));
});

router.post('/logs/client', (req, res) => {
  const token = getTokenFromRequest(req);
  const action = String(req.body?.action || '').trim();
  const details = [
    String(req.body?.page || '').trim(),
    String(req.body?.details || '').trim(),
  ].filter(Boolean).join(' • ');

  touchSession({
    token,
    userId: req.user?.id,
    username: req.user?.username,
    role: req.user?.role,
  });

  if (action) {
    logEvent({
      action,
      details,
      userId: req.user?.id,
      username: req.user?.username,
      role: req.user?.role,
    });
  }

  return res.json({
    ok: true,
    ...getActivitySnapshot(60),
  });
});

module.exports = router;
