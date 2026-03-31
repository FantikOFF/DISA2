(() => {
  const ONLINE_POLL_INTERVAL_MS = 5_000;

  const state = {
    isOpen: false,
    pageName: document.title || 'DISA',
    refreshTimer: null,
  };

  function getToken() {
    return String(localStorage.getItem('token') || '').trim();
  }

  function getAuthHeaders(extraHeaders = {}) {
    const token = getToken();
    return token ? { ...extraHeaders, Authorization: `Bearer ${token}` } : { ...extraHeaders };
  }

  function isAdminUser() {
    const role = String(localStorage.getItem('role') || '').trim().toLowerCase();
    return role === 'admin' || String(state.pageName || '').toLowerCase().includes('админ');
  }

  function escapeHtml(value) {
    return String(value ?? '-')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function injectStyles() {
    if (document.getElementById('disa-monitor-styles')) return;

    const style = document.createElement('style');
    style.id = 'disa-monitor-styles';
    style.textContent = `
      .disa-online-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 9px 12px;
        border-radius: 999px;
        border: 1px solid #2f3945;
        background: #14181d;
        color: #bfe0ff;
        font-size: 12px;
        font-weight: 700;
        white-space: nowrap;
      }

      .disa-online-pill strong {
        color: inherit;
        font-weight: 800;
      }

      .disa-logs-fab {
        position: fixed;
        right: 18px;
        bottom: 18px;
        width: 54px;
        height: 54px;
        border: none;
        border-radius: 50%;
        background: linear-gradient(135deg, #0d8bff 0%, #0065d8 100%);
        color: #ffffff;
        cursor: pointer;
        font-size: 20px;
        box-shadow: 0 14px 34px rgba(13, 139, 255, 0.35);
        z-index: 2500;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }

      .disa-logs-fab:hover {
        transform: translateY(-2px);
        box-shadow: 0 18px 36px rgba(13, 139, 255, 0.42);
      }

      .disa-logs-modal {
        display: none;
        position: fixed;
        inset: 0;
        z-index: 2600;
        align-items: center;
        justify-content: center;
        padding: 18px;
        background: rgba(2, 6, 14, 0.7);
      }

      .disa-logs-card {
        width: min(520px, 100%);
        max-height: min(78vh, 680px);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        background: #0f1318;
        border: 1px solid #26303d;
        border-radius: 18px;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
      }

      .disa-logs-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
        padding: 16px 18px 12px;
        border-bottom: 1px solid #1f2937;
      }

      .disa-logs-head h3 {
        margin: 0 0 4px;
        color: #f8fafc;
        font-size: 18px;
      }

      .disa-logs-subtitle,
      .disa-logs-status {
        color: #94a3b8;
        font-size: 12px;
      }

      .disa-logs-actions {
        display: flex;
        gap: 8px;
      }

      .disa-logs-action-btn {
        border: 1px solid #314155;
        background: #151a20;
        color: #e2e8f0;
        border-radius: 10px;
        width: 36px;
        height: 36px;
        cursor: pointer;
      }

      .disa-logs-list {
        padding: 12px 14px 16px;
        overflow-y: auto;
        display: grid;
        gap: 10px;
      }

      .disa-log-item {
        padding: 11px 12px;
        border-radius: 12px;
        border: 1px solid #26303d;
        background: #141a20;
      }

      .disa-log-line {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
        margin-bottom: 4px;
      }

      .disa-log-user {
        color: #7dd3fc;
        font-weight: 700;
        font-size: 13px;
      }

      .disa-log-time {
        color: #94a3b8;
        font-size: 11px;
        white-space: nowrap;
      }

      .disa-log-action {
        color: #f8fafc;
        font-size: 13px;
        font-weight: 600;
      }

      .disa-log-details {
        color: #aab6c5;
        font-size: 12px;
        line-height: 1.45;
        margin-top: 4px;
      }

      .disa-log-empty {
        padding: 18px 12px;
        text-align: center;
        color: #94a3b8;
        font-size: 13px;
      }

      body.light-theme .disa-online-pill {
        background: #f5f8fc;
        border-color: #d5dfeb;
        color: #2563eb;
      }

      body.light-theme .disa-logs-card {
        background: #ffffff;
        border-color: #dbe3ef;
      }

      body.light-theme .disa-logs-head {
        border-bottom-color: #e5edf7;
      }

      body.light-theme .disa-logs-head h3,
      body.light-theme .disa-log-action {
        color: #111827;
      }

      body.light-theme .disa-logs-subtitle,
      body.light-theme .disa-logs-status,
      body.light-theme .disa-log-time,
      body.light-theme .disa-log-details,
      body.light-theme .disa-log-empty {
        color: #64748b;
      }

      body.light-theme .disa-logs-action-btn,
      body.light-theme .disa-log-item {
        background: #f8fbff;
        border-color: #dbe3ef;
        color: #1f2937;
      }

      @media (max-width: 768px) {
        .disa-online-pill {
          width: 100%;
          justify-content: center;
        }

        .disa-logs-fab {
          width: 48px;
          height: 48px;
          right: 12px;
          bottom: 12px;
        }

        .disa-logs-head {
          padding: 14px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function ensureShell() {
    injectStyles();

    const userInfo = document.querySelector('.user-info');
    const existingBadge = document.getElementById('onlineUsersBadge');

    if (userInfo && isAdminUser() && !existingBadge) {
      const badge = document.createElement('div');
      badge.id = 'onlineUsersBadge';
      badge.className = 'disa-online-pill';
      badge.innerHTML = '<span>👥</span><strong id="onlineUsersCount">0 онлайн</strong>';
      const logoutButton = userInfo.querySelector('.logout-btn');
      userInfo.insertBefore(badge, logoutButton || null);
    }

    if (!isAdminUser() && existingBadge) {
      existingBadge.remove();
    }

    if (!document.getElementById('disaLogsFab')) {
      const fab = document.createElement('button');
      fab.id = 'disaLogsFab';
      fab.className = 'disa-logs-fab';
      fab.type = 'button';
      fab.title = 'Посмотреть логи';
      fab.setAttribute('aria-label', 'Посмотреть логи');
      fab.textContent = '📝';
      fab.addEventListener('click', openLogs);
      document.body.appendChild(fab);
    }

    if (!document.getElementById('disaLogsModal')) {
      const modal = document.createElement('div');
      modal.id = 'disaLogsModal';
      modal.className = 'disa-logs-modal';
      modal.innerHTML = `
        <div class="disa-logs-card">
          <div class="disa-logs-head">
            <div>
              <h3>Журнал действий</h3>
              <div class="disa-logs-subtitle" id="disaLogsOnlineWrap">Активные пользователи: <strong id="disaLogsOnline">0 онлайн</strong></div>
              <div class="disa-logs-status" id="disaLogsStatus">Обновление...</div>
            </div>
            <div class="disa-logs-actions">
              <button type="button" class="disa-logs-action-btn" id="disaLogsRefreshBtn" title="Обновить">↻</button>
              <button type="button" class="disa-logs-action-btn" id="disaLogsCloseBtn" title="Закрыть">×</button>
            </div>
          </div>
          <div class="disa-logs-list" id="disaLogsList">
            <div class="disa-log-empty">Пока действий нет.</div>
          </div>
        </div>
      `;

      modal.addEventListener('click', (event) => {
        if (event.target === modal) {
          closeLogs();
        }
      });

      document.body.appendChild(modal);
      document.getElementById('disaLogsRefreshBtn')?.addEventListener('click', () => refresh({ includeLogs: true, silent: false }));
      document.getElementById('disaLogsCloseBtn')?.addEventListener('click', closeLogs);
    }

    const onlineWrap = document.getElementById('disaLogsOnlineWrap');
    if (onlineWrap) {
      onlineWrap.style.display = isAdminUser() ? 'block' : 'none';
    }
  }

  function setStatus(text) {
    const statusNode = document.getElementById('disaLogsStatus');
    if (statusNode) {
      statusNode.textContent = text;
    }
  }

  function setOnlineUsersCount(count) {
    const safeCount = Number(count) || 0;
    const badgeNode = document.getElementById('onlineUsersCount');
    const modalNode = document.getElementById('disaLogsOnline');

    if (badgeNode) {
      badgeNode.textContent = `${safeCount} онлайн`;
    }
    if (modalNode) {
      modalNode.textContent = `${safeCount} онлайн`;
    }
  }

  function renderLogs(logs = []) {
    const listNode = document.getElementById('disaLogsList');
    if (!listNode) return;

    if (!Array.isArray(logs) || !logs.length) {
      listNode.innerHTML = '<div class="disa-log-empty">Пока действий нет.</div>';
      return;
    }

    listNode.innerHTML = logs.map((log) => {
      const time = log?.timestamp
        ? new Date(log.timestamp).toLocaleTimeString('ru-RU')
        : '--:--:--';

      return `
        <div class="disa-log-item">
          <div class="disa-log-line">
            <span class="disa-log-user">${escapeHtml(log?.username || 'system')}</span>
            <span class="disa-log-time">${escapeHtml(time)}</span>
          </div>
          <div class="disa-log-action">${escapeHtml(log?.action || 'Событие')}</div>
          ${log?.details ? `<div class="disa-log-details">${escapeHtml(log.details)}</div>` : ''}
        </div>
      `;
    }).join('');
  }

  async function refresh({ includeLogs = false, silent = true } = {}) {
    ensureShell();

    if (!getToken()) {
      setOnlineUsersCount(0);
      if (includeLogs || state.isOpen) {
        renderLogs([]);
      }
      setStatus('Пользователь не авторизован');
      return;
    }

    try {
      const response = await fetch('/api/system/activity', {
        cache: 'no-store',
        headers: getAuthHeaders(),
      });

      if (response.status === 401 || response.status === 403) {
        setOnlineUsersCount(0);
        if (includeLogs || state.isOpen) {
          renderLogs([]);
        }
        setStatus('Сессия неактивна');
        return;
      }

      if (!response.ok) {
        throw new Error('Не удалось загрузить логи');
      }

      const data = await response.json();
      setOnlineUsersCount(data.activeUsersCount || 0);

      if (includeLogs || state.isOpen) {
        renderLogs(data.logs || []);
      }

      setStatus(`Обновлено: ${new Date().toLocaleTimeString('ru-RU')}`);
    } catch (error) {
      console.warn('DISA monitor refresh error:', error);
      if (!silent) {
        setStatus('Не удалось обновить логи');
      }
    }
  }

  async function track(action, details = '') {
    if (!getToken() || !action) return;

    ensureShell();

    try {
      const response = await fetch('/api/system/logs/client', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          action,
          details,
          page: state.pageName,
        }),
      });

      if (!response.ok) return;

      const data = await response.json();
      setOnlineUsersCount(data.activeUsersCount || 0);
      if (state.isOpen) {
        renderLogs(data.logs || []);
      }
    } catch (error) {
      console.warn('DISA monitor track error:', error);
    }
  }

  function openLogs() {
    ensureShell();
    state.isOpen = true;

    const modal = document.getElementById('disaLogsModal');
    if (modal) {
      modal.style.display = 'flex';
    }

    refresh({ includeLogs: true, silent: false });
    track('Открыл просмотр логов', state.pageName);
  }

  function closeLogs() {
    state.isOpen = false;

    const modal = document.getElementById('disaLogsModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  function startAutoRefresh() {
    if (state.refreshTimer) {
      window.clearInterval(state.refreshTimer);
    }

    state.refreshTimer = window.setInterval(() => {
      refresh({ includeLogs: state.isOpen });
    }, ONLINE_POLL_INTERVAL_MS);
  }

  async function logout() {
    if (!getToken()) return;

    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      });
    } catch (error) {
      console.warn('DISA monitor logout error:', error);
    }
  }

  function init(options = {}) {
    state.pageName = options.pageName || state.pageName;
    ensureShell();
    refresh({ includeLogs: false });
    startAutoRefresh();
    track('Открыл страницу', state.pageName);
  }

  window.disaMonitor = {
    close: closeLogs,
    init,
    logout,
    open: openLogs,
    refresh,
    track,
  };
})();
