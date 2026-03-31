const MAX_LOGS = 250;
const SESSION_TTL_MS = 5 * 60 * 1000;

const sessionStore = new Map();
const recentLogs = [];

function cleanupSessions() {
  const now = Date.now();

  for (const [token, session] of sessionStore.entries()) {
    if (!session || now - session.lastSeenAt > SESSION_TTL_MS) {
      sessionStore.delete(token);
    }
  }
}

function createLogId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getSessionKey({ userId = null, username = '' } = {}) {
  if (userId !== null && userId !== undefined && userId !== '') {
    return `user:${userId}`;
  }

  const normalizedUsername = String(username || '').trim().toLowerCase();
  return normalizedUsername ? `name:${normalizedUsername}` : '';
}

function getActiveSessionForUser({ userId = null, username = '' } = {}) {
  cleanupSessions();

  const targetKey = getSessionKey({ userId, username });
  if (!targetKey) return null;

  let activeSession = null;
  for (const session of sessionStore.values()) {
    if (getSessionKey(session) !== targetKey) continue;

    if (!activeSession || session.lastSeenAt > activeSession.lastSeenAt) {
      activeSession = session;
    }
  }

  return activeSession ? { ...activeSession } : null;
}

function isLoggedInSession(session = {}) {
  const username = String(session.username || '').trim();
  const hasIdentity = session.userId !== null && session.userId !== undefined && session.userId !== '';

  return Boolean(session.token)
    && session.role !== 'system'
    && (hasIdentity || (username && username !== 'Пользователь'));
}

function logEvent({ action, details = '', username = 'system', userId = null, role = 'system' }) {
  const entry = {
    id: createLogId(),
    action: String(action || 'Системное событие').trim(),
    details: String(details || '').trim(),
    username: String(username || 'system').trim(),
    userId,
    role: String(role || 'system').trim(),
    timestamp: new Date().toISOString(),
  };

  recentLogs.unshift(entry);
  if (recentLogs.length > MAX_LOGS) {
    recentLogs.length = MAX_LOGS;
  }

  return entry;
}

function touchSession({ token, userId = null, username = 'Пользователь', role = 'user' }) {
  if (!token) {
    return getActivitySnapshot();
  }

  cleanupSessions();

  const sessionKey = getSessionKey({ userId, username });
  if (sessionKey) {
    for (const [savedToken, session] of sessionStore.entries()) {
      if (savedToken !== token && getSessionKey(session) === sessionKey) {
        sessionStore.delete(savedToken);
      }
    }
  }

  sessionStore.set(token, {
    token,
    userId,
    username: String(username || 'Пользователь').trim(),
    role: String(role || 'user').trim(),
    lastSeenAt: Date.now(),
  });

  return getActivitySnapshot();
}

function removeSession(token) {
  if (token) {
    sessionStore.delete(token);
  }

  cleanupSessions();
  return getActivitySnapshot();
}

function getActiveUsers() {
  cleanupSessions();

  const uniqueUsers = new Map();
  for (const session of sessionStore.values()) {
    if (!isLoggedInSession(session)) continue;

    const key = session.userId ? `user:${session.userId}` : `name:${session.username}`;
    const existing = uniqueUsers.get(key);

    if (!existing || session.lastSeenAt > existing.lastSeenAt) {
      uniqueUsers.set(key, { ...session });
    }
  }

  return Array.from(uniqueUsers.values())
    .sort((left, right) => right.lastSeenAt - left.lastSeenAt)
    .map(({ token, ...safeSession }) => safeSession);
}

function getRecentLogs(limit = 40) {
  const normalizedLimit = Math.max(1, Number(limit) || 40);
  return recentLogs.slice(0, normalizedLimit);
}

function getActivitySnapshot(limit = 40) {
  const activeUsers = getActiveUsers();

  return {
    activeUsersCount: activeUsers.length,
    activeUsers,
    logs: getRecentLogs(limit),
  };
}

const cleanupTimer = setInterval(cleanupSessions, 60_000);
if (typeof cleanupTimer.unref === 'function') {
  cleanupTimer.unref();
}

module.exports = {
  SESSION_TTL_MS,
  getActivitySnapshot,
  getActiveSessionForUser,
  getActiveUsers,
  getRecentLogs,
  logEvent,
  removeSession,
  touchSession,
};
