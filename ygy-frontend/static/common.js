window.Yogiyo = (() => {
  const config = window.__YGY_CONFIG__ || {};
  const useMock = String(config.useMock ?? 'false').toLowerCase() === 'true';
  const apiBaseUrl = String(config.apiBaseUrl || '').replace(/\/+$/, '');
  const defaultIds = Object.freeze({
    customer: String(config.defaultOrderId || '1'),
    merchant: String(config.defaultStoreId || '892'),
    rider: String(config.defaultRiderId || 'rider_102'),
  });
  const cleanups = [];

  const request = async (path, options = {}) => {
    const headers = { Accept: 'application/json', ...(options.headers || {}) };
    if (options.body != null && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    let response;
    try {
      response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers });
    } catch {
      throw new Error('백엔드 서버에 연결할 수 없습니다. 서버 실행 상태를 확인해 주세요.');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.detail || data.message || `요청에 실패했습니다. (${response.status})`);
      error.status = response.status;
      error.payload = data;
      throw error;
    }
    return data;
  };

  const qs = (name, fallback) => new URLSearchParams(location.search).get(name) || fallback;
  const el = id => document.getElementById(id);
  const money = value => `${Number(value || 0).toLocaleString('ko-KR')}원`;
  const fmtTime = value => value ? new Date(value).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '-';
  const escape = (value = '') => String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  const toast = message => {
    const node = el('toast');
    if (!node) return;
    node.textContent = message;
    node.classList.add('show');
    window.clearTimeout(node._timer);
    node._timer = window.setTimeout(() => node.classList.remove('show'), 2600);
  };
  const pendingButtons = new WeakSet();
  const withPending = async (button, task) => {
    if (!button || pendingButtons.has(button)) return;
    const wasDisabled = button.disabled;
    pendingButtons.add(button);
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    try { return await task(); }
    finally {
      pendingButtons.delete(button);
      button.disabled = wasDisabled;
      button.removeAttribute('aria-busy');
    }
  };
  const poll = (task, onData, { intervalMs = 5000, onError } = {}) => {
    let inFlight = false;
    let stopped = false;
    const run = async () => {
      if (stopped || inFlight) return;
      inFlight = true;
      try { onData?.(await task()); }
      catch (error) { onError?.(error); }
      finally { inFlight = false; }
    };
    run();
    const timer = window.setInterval(run, intervalMs);
    const stop = () => { stopped = true; window.clearInterval(timer); };
    cleanups.push(stop);
    return stop;
  };
  const closeSheet = () => {
    const sheet = el('bottomSheet');
    const backdrop = el('sheetBackdrop');
    if (!sheet || !backdrop) return;
    sheet.classList.remove('show');
    sheet.setAttribute('aria-hidden', 'true');
    sheet.inert = true;
    backdrop.classList.remove('show');
  };
  const openSheet = () => {
    const sheet = el('bottomSheet');
    const backdrop = el('sheetBackdrop');
    if (!sheet || !backdrop) return;
    sheet.classList.add('show');
    sheet.setAttribute('aria-hidden', 'false');
    sheet.inert = false;
    backdrop.classList.add('show');
  };
  const bindSheet = () => {
    const closeButton = el('sheetClose');
    const backdrop = el('sheetBackdrop');
    closeButton?.addEventListener('click', closeSheet);
    backdrop?.addEventListener('click', closeSheet);
    cleanups.push(() => {
      closeButton?.removeEventListener('click', closeSheet);
      backdrop?.removeEventListener('click', closeSheet);
    });
  };
  const dispose = () => { while (cleanups.length) cleanups.pop()(); };

  return {
    qs, el, money, fmtTime, escape, toast, withPending, poll, openSheet, closeSheet, bindSheet, dispose,
    api: request,
    apiUrl: path => `${apiBaseUrl}${path}`,
    apiClient: Object.freeze({}),
    defaultIds,
    useMock,
  };
})();
