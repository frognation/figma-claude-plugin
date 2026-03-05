// Helper: 텍스트 노드 재귀 탐색
function findTextNodes(node, result) {
  if (node.type === 'TEXT') {
    result.push({ id: node.id, name: node.name, text: node.characters });
  } else if ('children' in node) {
    for (const child of node.children) {
      findTextNodes(child, result);
    }
  }
}

// Helper: 혼합 폰트 포함 모든 폰트 로드
async function loadAllFonts(node) {
  if (node.fontName !== figma.mixed) {
    await figma.loadFontAsync(node.fontName);
  } else {
    const fonts = new Map();
    for (let i = 0; i < node.characters.length; i++) {
      const f = node.getRangeFontName(i, i + 1);
      if (f !== figma.mixed) {
        fonts.set(`${f.family}__${f.style}`, f);
      }
    }
    for (const font of fonts.values()) {
      await figma.loadFontAsync(font);
    }
  }
}

figma.showUI(__html__, { width: 420, height: 600, title: 'Claude 번역기' });

// 초기화: API 키 로드 + 현재 선택 전달
(async () => {
  const apiKey = await figma.clientStorage.getAsync('anthropicApiKey') || '';
  figma.ui.postMessage({ type: 'init', apiKey });

  const nodes = [];
  for (const n of figma.currentPage.selection) findTextNodes(n, nodes);
  figma.ui.postMessage({ type: 'selection', nodes });
})();

// 선택 변경 실시간 감지
figma.on('selectionchange', () => {
  const nodes = [];
  for (const n of figma.currentPage.selection) findTextNodes(n, nodes);
  figma.ui.postMessage({ type: 'selection', nodes });
});

// UI 메시지 처리
figma.ui.onmessage = async (msg) => {
  switch (msg.type) {

    case 'save-api-key':
      await figma.clientStorage.setAsync('anthropicApiKey', msg.key);
      figma.ui.postMessage({ type: 'api-key-saved' });
      break;

    case 'apply-translations':
      try {
        for (const { id, translated } of msg.translations) {
          const node = figma.getNodeById(id);
          if (node && node.type === 'TEXT') {
            await loadAllFonts(node);
            node.characters = translated;
          }
        }
        figma.ui.postMessage({ type: 'apply-done', success: true });
      } catch (e) {
        figma.ui.postMessage({ type: 'apply-done', success: false, error: String(e) });
      }
      break;

    case 'close':
      figma.closePlugin();
      break;
  }
};
