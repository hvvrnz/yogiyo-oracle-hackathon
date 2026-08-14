import { useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/common.css';

import homeTemplate from '../../static/index.html?raw';
import landingScript from '../../static/landing/app.js?raw';
import customerTemplate from '../../static/customer/index.html?raw';
import merchantTemplate from '../../static/merchant/index.html?raw';
import riderTemplate from '../../static/rider/index.html?raw';
import demoTemplate from '../../static/demo/index.html?raw';
import commonScript from '../../static/common.js?raw';
import backendClientScript from '../../static/backend-client.js?raw';
import mapDataScript from '../../static/map-data.js?raw';
import customerScript from '../../static/customer/app.js?raw';
import merchantScript from '../../static/merchant/app.js?raw';
import riderScript from '../../static/rider/app.js?raw';
import demoScript from '../../static/demo/app.js?raw';

const pageByPath = {
  '/': { template: homeTemplate, script: landingScript, title: '요기요 AI 조리·배달 동기화 데모' },
  '/customer': { template: customerTemplate, script: customerScript, title: '요기요 AI 실속배달 · 고객' },
  '/merchant': { template: merchantTemplate, script: merchantScript, title: '요기요 AI 조리·배달 동기화 · 사장님' },
  '/rider': { template: riderTemplate, script: riderScript, title: '요기요 AI 조리·배달 · 라이더' },
  '/demo': { template: demoTemplate, script: demoScript, title: '요기요 AI 통합 시연 콘솔' },
};

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

window.__YGY_CONFIG__ = Object.freeze({
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '',
  wsBaseUrl: import.meta.env.VITE_WS_BASE_URL || '',
  useMock: String(import.meta.env.VITE_USE_MOCK ?? 'false').toLowerCase() === 'true',
  defaultOrderId: import.meta.env.VITE_DEFAULT_ORDER_ID || '1',
  defaultStoreId: import.meta.env.VITE_DEFAULT_STORE_ID || '892',
  defaultRiderId: import.meta.env.VITE_DEFAULT_RIDER_ID || 'rider_102',
  apiPaths: parseJson(import.meta.env.VITE_API_PATHS, {}),
});

function splitTemplate(template) {
  const documentNode = new DOMParser().parseFromString(template, 'text/html');
  const styles = [...documentNode.head.querySelectorAll('style')].map((node) => node.textContent).join('\n');
  documentNode.body.querySelectorAll('script').forEach((node) => node.remove());
  return { html: documentNode.body.innerHTML, styles };
}

function execute(code) {
  // Screen behavior is loaded after React commits the unchanged page structure.
  // Function executes in the browser global scope so the existing API/WebSocket contract stays intact.
  new Function(code)();
}

function Screen({ page }) {
  const host = useRef(null);
  const content = useMemo(() => splitTemplate(page.template), [page.template]);

  useEffect(() => {
    let disposed = false;
    document.title = page.title;
    if (!page.script) return undefined;
    const boot = async () => {
      execute(commonScript);
      if (window.__YGY_CONFIG__.useMock) {
        const { default: mockClientScript } = await import('../../static/mock-client.js?raw');
        if (disposed) return;
        execute(mockClientScript);
      } else {
        execute(backendClientScript);
      }
      if (disposed) return;
      execute(mapDataScript);
      execute(page.script);
    };
    boot();
    return () => {
      disposed = true;
      window.Yogiyo?.dispose?.();
      delete window.Yogiyo;
    };
  }, [page]);

  return <div ref={host} dangerouslySetInnerHTML={{ __html: content.html }} />;
}

const page = pageByPath[window.location.pathname] ?? pageByPath['/'];
createRoot(document.getElementById('root')).render(
  <>
    {page.template && <style>{splitTemplate(page.template).styles}</style>}
    <Screen page={page} />
  </>,
);
