const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const jwt = require('jsonwebtoken');
const { touchSession } = require('../services/activityService');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Нет токена' });
  if (!process.env.JWT_SECRET) return res.status(500).json({ message: 'JWT_SECRET не настроен' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Неверный или просроченный токен' });

    req.user = user;
    touchSession({
      token,
      userId: user?.id,
      username: user?.username,
      role: user?.role,
    });

    next();
  });
};

// Только для админов
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Доступ только для администраторов' });
  }
  next();
};

module.exports = { authenticateToken, isAdmin };