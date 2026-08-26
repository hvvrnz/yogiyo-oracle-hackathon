import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const demoHtml = readFileSync(
  new URL('../static/demo/index.html', import.meta.url),
  'utf8'
);
const demoSource = readFileSync(
  new URL('../static/demo/app.js', import.meta.url),
  'utf8'
);
const commonCss = readFileSync(
  new URL('../static/common.css', import.meta.url),
  'utf8'
);

const normalizeText = value =>
  value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

test('상단 설명 버튼은 발표 순서대로 4개만 존재한다', () => {
  const buttons = [...demoHtml.matchAll(
    /<button\s+type="button"\s+data-explain="([^"]+)">([\s\S]*?)<\/button>/g
  )].map(match => ({ key: match[1], label: normalizeText(match[2]) }));

  assert.deepEqual(buttons, [
    { key: 'cook', label: 'AI 조리시간 판단 보조 결과' },
    { key: 'fallback', label: '데이터 부족 매장의 조리시간 전략' },
    { key: 'cluster', label: '동선 중심 3건 클러스터링' },
    { key: 'route', label: '왜 이 방문 순서인가요?' },
  ]);
});

test('pipeline 모달 분기와 스타일은 남아 있지 않다', () => {
  assert.doesNotMatch(demoHtml, /data-explain="pipeline"/);
  assert.doesNotMatch(demoSource, /\bpipeline\b/i);
  assert.doesNotMatch(commonCss, /\.pipeline-/);
});

test('cook 모달은 실제 참고 데이터와 최종 결정 주체를 표시한다', () => {
  for (const expected of [
    'AI 조리시간 판단 보조 결과',
    '유사 사례 수',
    '평균 조리시간',
    '실제 참고한 유사 사례',
    'Cohere Embed Multilingual v3.0',
    '선택한 모델의 고정 출력 규격',
    '최종 조리시간은 사장님이 결정합니다.',
  ]) {
    assert.ok(demoSource.includes(expected), expected);
  }
});

test('fallback·cluster·route 모달은 발표 핵심 근거를 포함한다', () => {
  for (const expected of [
    '데이터 부족 매장의 조리시간 전략',
    '프랜차이즈 매장',
    '개인 매장',
    'DB 영구 축적과 자동 ML 재학습은 향후 고도화 범위입니다.',
    '동선 중심 3건 클러스터링',
    '동선이 가까운 주문을 먼저 선별한 뒤',
    'remaining_cook_time',
    '6! ÷ 2³ = 90가지',
    '라이더 대기시간',
    '가방 체류시간',
    '50.8점',
    '예상 조리완료·도착 타임라인',
    '수락하거나 거절할 수 있습니다.',
  ]) {
    assert.ok(demoSource.includes(expected), expected);
  }
});

test('모달 버튼과 닫기 동작이 모두 연결되어 있다', () => {
  for (const key of ['cook', 'fallback', 'cluster', 'route']) {
    assert.match(demoSource, new RegExp(`\\b${key}:`));
  }

  assert.match(demoSource, /explanationHandlers\[btn\.dataset\.explain\]\?\.\(\)/);
  assert.match(demoSource, /explanationCloseBtn'\)\.addEventListener\('click', closeExplanationModal\)/);
  assert.match(demoSource, /event\.target === event\.currentTarget\) closeExplanationModal\(\)/);
});

test('4개 모달이 실제로 열리고 닫힌다', async () => {
  const modalSource = demoSource.slice(
    demoSource.indexOf('const defaultCookReference')
  );
  const body = { innerHTML: '' };
  const backdropListeners = {};
  const closeListeners = {};
  const openClasses = new Set();
  const backdrop = {
    classList: {
      add: value => openClasses.add(value),
      remove: value => openClasses.delete(value),
    },
    addEventListener: (type, listener) => {
      backdropListeners[type] = listener;
    },
  };
  const closeButton = {
    addEventListener: (type, listener) => {
      closeListeners[type] = listener;
    },
  };
  const buttons = ['cook', 'fallback', 'cluster', 'route'].map(key => {
    const listeners = {};
    return {
      dataset: { explain: key },
      listeners,
      addEventListener: (type, listener) => {
        listeners[type] = listener;
      },
    };
  });
  const nodes = {
    explanationBody: body,
    explanationBackdrop: backdrop,
    explanationCloseBtn: closeButton,
  };
  const escape = (value = '') => String(value).replace(
    /[&<>'"]/g,
    character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character])
  );
  const context = vm.createContext({
    Yogiyo: {
      el: id => nodes[id],
      escape,
    },
    document: {
      querySelectorAll: () => buttons,
    },
    fetch: async url => ({
      json: async () =>
        url.includes('next-to-cook')
          ? {}
          : { candidates: [] },
    }),
  });

  vm.runInContext(modalSource, context, {
    filename: 'demo-modal-runtime.js',
  });

  const expectedTitles = [
    'AI 조리시간 판단 보조 결과',
    '데이터 부족 매장의 조리시간 전략',
    '동선 중심 3건 클러스터링',
    '왜 이 방문 순서인가요?',
  ];

  for (const [index, button] of buttons.entries()) {
    button.listeners.click();
    await new Promise(resolve => setImmediate(resolve));

    assert.ok(openClasses.has('open'), button.dataset.explain);
    assert.ok(body.innerHTML.includes(expectedTitles[index]), expectedTitles[index]);

    closeListeners.click();
    assert.ok(!openClasses.has('open'), button.dataset.explain);
  }

  backdropListeners.click({ target: backdrop, currentTarget: backdrop });
  assert.ok(!openClasses.has('open'));
});
