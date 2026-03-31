const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { getActiveSessionForUser, getActiveUsers, logEvent, removeSession, touchSession } = require('../services/activityService');

const getServerErrorMessage = (err) => {
  const databaseErrorCodes = new Set(['ECONNREFUSED', '28P01', '3D000', '42P01']);
  return databaseErrorCodes.has(err.code) ? 'Ошибка подключения к базе данных' : 'Ошибка сервера';
};

const formatManagedUser = (user, onlineUserIds = new Set()) => ({
  id: user?.id,
  username: user?.username,
  email: user?.email,
  role: user?.role || 'user',
  created_at: user?.created_at,
  isOnline: onlineUserIds.has(Number(user?.id)),
});

const register = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: 'Пользователь с таким логином или email уже существует' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, email, passwordHash]
    );

    logEvent({
      action: 'Зарегистрировал пользователя',
      details: result.rows[0]?.email || '',
      userId: result.rows[0]?.id,
      username: result.rows[0]?.username,
      role: 'user',
    });

    return res.status(201).json({
      message: 'Регистрация успешна',
      user: result.rows[0]
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ message: getServerErrorMessage(err) });
  }
};

const login = async (req, res) => {
  const { username, email, password } = req.body;
  const loginValue = (username || email || '').trim();

  if (!loginValue || !password) {
    return res.status(400).json({ message: 'Введите логин и пароль' });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ message: 'JWT_SECRET не настроен' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $1 LIMIT 1',
      [loginValue]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Неверный логин или пароль' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ message: 'Неверный логин или пароль' });
    }

    const activeSession = getActiveSessionForUser({
      userId: user.id,
      username: user.username,
    });

    if (activeSession) {
      logEvent({
        action: 'Заблокирован повторный вход',
        details: 'Пользователь уже в системе',
        userId: user.id,
        username: user.username,
        role: user.role || 'user',
      });

      return res.status(409).json({
        message: 'Этот пользователь уже вошёл в систему. Сначала выйдите из другого устройства или подождите 5 минут.',
      });
    }

    const role = user.role || 'user';
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    touchSession({
      token,
      userId: user.id,
      username: user.username,
      role,
    });

    logEvent({
      action: 'Вошел в систему',
      details: `Роль: ${role}`,
      userId: user.id,
      username: user.username,
      role,
    });

    return res.json({
      message: 'Успешный вход',
      token,
      user: {
        id: user.id,
        username: user.username,
        role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: getServerErrorMessage(err) });
  }
};

const logout = (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  removeSession(token);
  logEvent({
    action: 'Вышел из системы',
    userId: req.user?.id,
    username: req.user?.username,
    role: req.user?.role,
  });

  return res.json({ message: 'Выход выполнен' });
};

const listUsers = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, username, email, role, created_at, password_hash
      FROM users
      ORDER BY created_at DESC, id DESC
    `);

    const onlineUserIds = new Set(
      getActiveUsers()
        .map((user) => Number(user.userId))
        .filter(Number.isFinite)
    );

    return res.json(result.rows.map((user) => formatManagedUser(user, onlineUserIds)));
  } catch (err) {
    console.error('Users fetch error:', err);
    return res.status(500).json({ message: getServerErrorMessage(err) });
  }
};

const updateManagedUser = async (req, res) => {
  const targetUserId = Number(req.params.id);

  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    return res.status(400).json({ message: 'Некорректный идентификатор пользователя' });
  }

  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : undefined;
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : undefined;
  const roleInput = typeof req.body?.role === 'string' ? req.body.role.trim().toLowerCase() : undefined;
  const passwordInput = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
  const allowedRoles = new Set(['admin', 'user']);

  if (roleInput !== undefined && !allowedRoles.has(roleInput)) {
    return res.status(400).json({ message: 'Допустимые роли: admin или user' });
  }

  if (email !== undefined && email && !email.includes('@')) {
    return res.status(400).json({ message: 'Введите корректный email' });
  }

  if (passwordInput && passwordInput.length < 4) {
    return res.status(400).json({ message: 'Новый пароль должен содержать минимум 4 символа' });
  }

  try {
    const existingUserResult = await pool.query(
      'SELECT id, username, email, role, created_at, password_hash FROM users WHERE id = $1 LIMIT 1',
      [targetUserId]
    );

    if (existingUserResult.rows.length === 0) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    const currentUser = existingUserResult.rows[0];
    const nextUsername = username === undefined ? currentUser.username : username;
    const nextEmail = email === undefined ? currentUser.email : email;
    const nextRole = roleInput === undefined ? (currentUser.role || 'user') : roleInput;

    if (!nextUsername || !nextEmail) {
      return res.status(400).json({ message: 'Логин и email не должны быть пустыми' });
    }

    if (Number(req.user?.id) === targetUserId && nextRole !== 'admin') {
      return res.status(400).json({ message: 'Нельзя снять роль admin у своей активной учетной записи' });
    }

    const duplicateUser = await pool.query(
      'SELECT id FROM users WHERE (username = $1 OR email = $2) AND id <> $3 LIMIT 1',
      [nextUsername, nextEmail, targetUserId]
    );

    if (duplicateUser.rows.length > 0) {
      return res.status(409).json({ message: 'Пользователь с таким логином или email уже существует' });
    }

    const nextPasswordHash = passwordInput ? await bcrypt.hash(passwordInput, 10) : null;
    const updateResult = await pool.query(
      `UPDATE users
       SET username = $1,
           email = $2,
           role = $3,
           password_hash = COALESCE($4, password_hash)
       WHERE id = $5
       RETURNING id, username, email, role, created_at, password_hash`,
      [nextUsername, nextEmail, nextRole, nextPasswordHash, targetUserId]
    );

    const updatedUser = updateResult.rows[0];
    const onlineUserIds = new Set(
      getActiveUsers()
        .map((user) => Number(user.userId))
        .filter(Number.isFinite)
    );

    logEvent({
      action: 'Изменил пользователя',
      details: `${updatedUser.username} • роль: ${updatedUser.role}${nextPasswordHash ? ' • пароль обновлён' : ''}`,
      userId: req.user?.id,
      username: req.user?.username,
      role: req.user?.role,
    });

    return res.json({
      message: 'Данные пользователя обновлены',
      user: formatManagedUser(updatedUser, onlineUserIds),
    });
  } catch (err) {
    console.error('User update error:', err);
    return res.status(500).json({ message: getServerErrorMessage(err) });
  }
};

const deleteManagedUser = async (req, res) => {
  const targetUserId = Number(req.params.id);

  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    return res.status(400).json({ message: 'Некорректный идентификатор пользователя' });
  }

  if (Number(req.user?.id) === targetUserId) {
    return res.status(400).json({ message: 'Нельзя удалить текущую активную учетную запись' });
  }

  try {
    const deleteResult = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id, username, email, role',
      [targetUserId]
    );

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    const deletedUser = deleteResult.rows[0];

    logEvent({
      action: 'Удалил пользователя',
      details: `${deletedUser.username} • ${deletedUser.email}`,
      userId: req.user?.id,
      username: req.user?.username,
      role: req.user?.role,
    });

    return res.json({
      message: 'Пользователь удалён',
      user: deletedUser,
    });
  } catch (err) {
    console.error('User delete error:', err);
    return res.status(500).json({ message: getServerErrorMessage(err) });
  }
};

const getMe = (req, res) => {
  res.json({
    id: req.user.id,
    username: req.user.username,
    role: req.user.role
  });
};

module.exports = { register, login, logout, listUsers, updateManagedUser, deleteManagedUser, getMe };