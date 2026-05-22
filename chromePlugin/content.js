const MAX_TEXT_LENGTH = 4000;
const HISTORY_LIMIT = 20;
const HISTORY_KEYS = {
  translate: "selHelperHistoryTranslate",
  polish: "selHelperHistoryPolish"
};

// 当前页面运行态：记录选区、UI 状态与语音列表
const state = {
  selectedText: "",
  selectionMeta: null,
  toolbarVisible: false,
  detectedLang: "zh",
  voices: []
};

const toolbar = createToolbar();
const panel = createPanel();
document.documentElement.appendChild(toolbar);
document.documentElement.appendChild(panel);

// 选区/滚动/点击/快捷键事件
document.addEventListener("mouseup", onSelectionChanged, true);
document.addEventListener("keyup", onSelectionChanged, true);
document.addEventListener("scroll", onViewportChanged, true);
window.addEventListener("resize", onViewportChanged, true);
document.addEventListener("mousedown", onDocumentPointerDown, true);
document.addEventListener("keydown", onShortcutKeydown, true);
window.speechSynthesis?.addEventListener?.("voiceschanged", loadVoices);
loadVoices();

function createToolbar() {
  const el = document.createElement("div");
  el.className = "sel-helper-toolbar";
  el.innerHTML = `
    <div class="sel-helper-brand"><span class="sel-helper-brand-dot"></span><span>AI</span></div>
    <button class="sel-helper-btn" data-action="explain"><span class="sel-helper-icon">◌</span>解释</button>
    <button class="sel-helper-btn" data-action="translate"><span class="sel-helper-icon">文</span>翻译</button>
    <button class="sel-helper-btn" data-action="speak"><span class="sel-helper-icon">♪</span>朗读</button>
    <button class="sel-helper-btn" data-action="polish"><span class="sel-helper-icon">✦</span>润色</button>
  `;

  el.addEventListener("mousedown", (event) => event.preventDefault());
  el.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }
    const action = button.dataset.action;
    if (action === "explain") {
      await handleExplain();
      return;
    }
    if (action === "translate") {
      await renderTranslatePanel();
      return;
    }
    if (action === "speak") {
      renderSpeakPanel();
      return;
    }
    if (action === "polish") {
      await handlePolish();
    }
  });
  return el;
}

function createPanel() {
  const el = document.createElement("div");
  el.className = "sel-helper-panel";
  return el;
}

function onSelectionChanged() {
  const info = getCurrentSelection();
  if (!info || !info.text) {
    hideUI();
    return;
  }

  const trimmed = info.text.trim();
  if (!trimmed) {
    hideUI();
    return;
  }
  if (trimmed.length > MAX_TEXT_LENGTH) {
    showPanel(`
      <div class="sel-helper-panel-inner">
        <div class="sel-helper-title">提示</div>
        <div class="sel-helper-muted">选中文本过长，请控制在 ${MAX_TEXT_LENGTH} 字以内。</div>
      </div>
    `);
    return;
  }

  state.selectedText = trimmed;
  state.selectionMeta = info.meta;
  state.detectedLang = detectLanguage(trimmed);
  showToolbar(info.rect);
}

function onShortcutKeydown(event) {
  // 快捷键：Shift + C，显示或隐藏悬浮条
  if (!(event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === "c")) {
    return;
  }
  if (event.repeat) {
    return;
  }
  const info = getCurrentSelection();
  if (!info || !info.text) {
    return;
  }
  event.preventDefault();
  if (state.toolbarVisible) {
    hideUI();
    return;
  }
  state.selectedText = info.text.trim();
  state.selectionMeta = info.meta;
  state.detectedLang = detectLanguage(state.selectedText);
  showToolbar(info.rect);
}

function onViewportChanged() {
  if (!state.toolbarVisible) {
    return;
  }
  const info = getCurrentSelection();
  if (!info || !info.rect) {
    hideUI();
    return;
  }
  showToolbar(info.rect);
}

function onDocumentPointerDown(event) {
  if (toolbar.contains(event.target) || panel.contains(event.target)) {
    return;
  }
  const sel = window.getSelection();
  if (!sel || !String(sel).trim()) {
    hideUI();
  }
}

function showToolbar(rect) {
  const width = 450;
  const left = clamp(rect.left + rect.width / 2 - width / 2, 8, window.innerWidth - width - 8);
  const top = clamp(rect.top - 48, 8, window.innerHeight - 44);
  toolbar.style.left = `${left}px`;
  toolbar.style.top = `${top}px`;
  toolbar.style.display = "flex";
  state.toolbarVisible = true;
  if (panel.style.display === "block") {
    layoutPanel();
  }
}

function showPanel(innerHtml) {
  panel.innerHTML = innerHtml;
  panel.style.display = "block";
  layoutPanel();
}

function layoutPanel() {
  const toolbarRect = toolbar.getBoundingClientRect();
  const margin = 8;
  const panelWidth = Math.min(620, window.innerWidth - 24);
  const panelLeft = clamp(toolbarRect.left, 12, window.innerWidth - panelWidth - 12);
  let panelTop = toolbarRect.bottom + margin;
  if (panelTop > window.innerHeight - 120) {
    panelTop = Math.max(12, toolbarRect.top - margin - 320);
  }
  panel.style.width = `${panelWidth}px`;
  panel.style.left = `${panelLeft}px`;
  panel.style.top = `${panelTop}px`;
}

function hideUI() {
  toolbar.style.display = "none";
  panel.style.display = "none";
  panel.innerHTML = "";
  state.toolbarVisible = false;
}

function setToolbarDisabled(disabled) {
  toolbar.querySelectorAll("button").forEach((btn) => {
    btn.disabled = disabled;
  });
}

async function handleExplain() {
  showLoading("解释中...");
  const result = await requestKimi("explain", { text: state.selectedText });
  if (!result.ok) {
    showError(result.error);
    return;
  }
  showPanel(`
    <div class="sel-helper-panel-inner">
      <div class="sel-helper-title">解释结果</div>
      <pre class="sel-helper-result">${escapeHtml(result.text)}</pre>
    </div>
  `);
}

async function renderTranslatePanel() {
  const guessed = state.detectedLang === "zh" ? "en" : "zh";
  const history = await getHistory("translate");
  showPanel(`
    <div class="sel-helper-panel-inner">
      <div class="sel-helper-title">翻译</div>
      <div class="sel-helper-row">
        <label class="sel-helper-muted" for="sel-helper-target-lang">目标语言</label>
        <select id="sel-helper-target-lang" class="sel-helper-select">
          <option value="zh" ${guessed === "zh" ? "selected" : ""}>中文</option>
          <option value="en" ${guessed === "en" ? "selected" : ""}>英文</option>
        </select>
        <button id="sel-helper-run-translate" class="sel-helper-btn">开始翻译</button>
      </div>
      <pre id="sel-helper-translate-result" class="sel-helper-result sel-helper-muted">请选择目标语言后翻译。</pre>
      ${renderHistoryHtml("translate", history)}
    </div>
  `);

  const runBtn = panel.querySelector("#sel-helper-run-translate");
  const resultEl = panel.querySelector("#sel-helper-translate-result");
  runBtn.addEventListener("click", async () => {
    const targetLang = panel.querySelector("#sel-helper-target-lang").value;
    runBtn.disabled = true;
    resultEl.textContent = "翻译中...";
    const result = await requestKimi("translate", { text: state.selectedText, targetLang });
    runBtn.disabled = false;
    if (!result.ok) {
      resultEl.textContent = result.error;
      return;
    }
    resultEl.classList.remove("sel-helper-muted");
    resultEl.textContent = result.text;
    await pushHistory("translate", {
      input: state.selectedText,
      output: result.text,
      targetLang,
      ts: Date.now()
    });
  });

  bindHistoryEvents("translate");
}

function renderSpeakPanel() {
  const langCode = state.detectedLang === "zh" ? "zh-CN" : "en-US";
  showPanel(`
    <div class="sel-helper-panel-inner">
      <div class="sel-helper-title">朗读</div>
      <div class="sel-helper-row">
        <label class="sel-helper-muted" for="sel-helper-speak-lang">朗读语言</label>
        <select id="sel-helper-speak-lang" class="sel-helper-select">
          <option value="zh-CN" ${langCode === "zh-CN" ? "selected" : ""}>中文（自动推荐）</option>
          <option value="en-US" ${langCode === "en-US" ? "selected" : ""}>英文（自动推荐）</option>
        </select>
      </div>
      <div class="sel-helper-actions">
        <button id="sel-helper-speak-play" class="sel-helper-btn">开始朗读</button>
        <button id="sel-helper-speak-stop" class="sel-helper-btn">停止</button>
      </div>
      <div id="sel-helper-speak-info" class="sel-helper-info">将自动匹配最接近的系统音色。</div>
    </div>
  `);

  const playBtn = panel.querySelector("#sel-helper-speak-play");
  const stopBtn = panel.querySelector("#sel-helper-speak-stop");
  const infoEl = panel.querySelector("#sel-helper-speak-info");
  playBtn.addEventListener("click", () => {
    const lang = panel.querySelector("#sel-helper-speak-lang").value;
    speakSelectedText(lang, infoEl);
  });
  stopBtn.addEventListener("click", () => {
    window.speechSynthesis.cancel();
    infoEl.textContent = "已停止朗读。";
  });
}

async function handlePolish() {
  showLoading("润色中...");
  const result = await requestKimi("polish", { text: state.selectedText });
  if (!result.ok) {
    showError(result.error);
    return;
  }

  await pushHistory("polish", {
    input: state.selectedText,
    output: result.text,
    ts: Date.now()
  });
  const history = await getHistory("polish");

  showPanel(`
    <div class="sel-helper-panel-inner">
      <div class="sel-helper-title">润色结果（可编辑）</div>
      <textarea id="sel-helper-polish-text" class="sel-helper-textarea">${escapeHtml(result.text)}</textarea>
      <div class="sel-helper-actions">
        <button id="sel-helper-replace-btn" class="sel-helper-btn">一键替换选中文本</button>
        <button id="sel-helper-copy-btn" class="sel-helper-btn">复制文本</button>
      </div>
      <div id="sel-helper-replace-info" class="sel-helper-info">仅在可编辑区域可直接替换；否则会复制到剪贴板。</div>
      ${renderHistoryHtml("polish", history)}
    </div>
  `);

  panel.querySelector("#sel-helper-replace-btn").addEventListener("click", async () => {
    const text = panel.querySelector("#sel-helper-polish-text").value;
    const info = panel.querySelector("#sel-helper-replace-info");
    const replaced = replaceSelectedText(text);
    if (replaced) {
      info.textContent = "已替换选中文本。";
      return;
    }
    await copyToClipboard(text);
    info.textContent = "当前页面不可编辑，已复制到剪贴板，可手动粘贴替换。";
  });
  panel.querySelector("#sel-helper-copy-btn").addEventListener("click", async () => {
    const text = panel.querySelector("#sel-helper-polish-text").value;
    await copyToClipboard(text);
    panel.querySelector("#sel-helper-replace-info").textContent = "已复制到剪贴板。";
  });
  bindHistoryEvents("polish");
}

function showLoading(text) {
  showPanel(`
    <div class="sel-helper-panel-inner">
      <div class="sel-helper-title">${escapeHtml(text)}</div>
      <div class="sel-helper-muted">请稍候...</div>
    </div>
  `);
}

function showError(message) {
  showPanel(`
    <div class="sel-helper-panel-inner">
      <div class="sel-helper-title">执行失败</div>
      <div class="sel-helper-result">${escapeHtml(message)}</div>
    </div>
  `);
}

async function requestKimi(task, extra) {
  setToolbarDisabled(true);
  try {
    const response = await chrome.runtime.sendMessage({
      type: "KIMI_TASK",
      payload: { task, ...extra }
    });
    if (!response?.ok) {
      return { ok: false, error: response?.error || "请求失败" };
    }
    return { ok: true, text: response.result };
  } catch (_error) {
    return { ok: false, error: "无法访问后台服务，请刷新页面后重试。" };
  } finally {
    setToolbarDisabled(false);
  }
}

function getCurrentSelection() {
  const active = document.activeElement;
  if (isTextInput(active)) {
    const start = active.selectionStart ?? 0;
    const end = active.selectionEnd ?? 0;
    if (end > start) {
      const text = active.value.slice(start, end);
      return {
        text,
        rect: active.getBoundingClientRect(),
        meta: { type: "input", element: active, start, end }
      };
    }
  }

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
    return null;
  }
  const text = String(sel).trim();
  if (!text) {
    return null;
  }
  const range = sel.getRangeAt(0).cloneRange();
  const rect = range.getBoundingClientRect();
  if (!rect || (rect.width === 0 && rect.height === 0)) {
    return null;
  }
  const editableRoot = getEditableRoot(range.startContainer);
  return {
    text,
    rect,
    meta: { type: editableRoot ? "contenteditable" : "readonly", editableRoot, range }
  };
}

function replaceSelectedText(nextText) {
  const meta = state.selectionMeta;
  if (!meta || !nextText) {
    return false;
  }
  if (meta.type === "input" && meta.element && isTextInput(meta.element)) {
    meta.element.focus();
    meta.element.setSelectionRange(meta.start, meta.end);
    meta.element.setRangeText(nextText, meta.start, meta.end, "select");
    meta.end = meta.start + nextText.length;
    return true;
  }
  if (meta.type === "contenteditable" && meta.range) {
    const range = meta.range.cloneRange();
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    range.deleteContents();
    const node = document.createTextNode(nextText);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    return true;
  }
  return false;
}

function speakSelectedText(lang, infoEl) {
  if (!("speechSynthesis" in window)) {
    infoEl.textContent = "当前浏览器不支持朗读。";
    return;
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(state.selectedText);
  utter.lang = lang;
  utter.rate = 1;
  utter.pitch = 1;
  utter.voice = pickBestVoice(lang);
  utter.onstart = () => {
    const voiceName = utter.voice?.name || "系统默认";
    infoEl.textContent = `正在朗读 (${utter.lang} / ${voiceName})...`;
  };
  utter.onend = () => {
    infoEl.textContent = "朗读完成。";
  };
  utter.onerror = () => {
    infoEl.textContent = "朗读失败，请尝试切换语言重试。";
  };
  window.speechSynthesis.speak(utter);
}

function loadVoices() {
  state.voices = window.speechSynthesis?.getVoices?.() || [];
}

function pickBestVoice(lang) {
  const list = state.voices.length ? state.voices : window.speechSynthesis.getVoices();
  if (!list.length) {
    return null;
  }
  const isZh = lang.startsWith("zh");
  const preferredKeywords = isZh ? ["xiaoxiao", "huihui", "tingting", "zh"] : ["aria", "jenny", "samantha", "en-us", "en"];
  const langMatched = list.filter((v) => v.lang && v.lang.toLowerCase().startsWith(lang.toLowerCase().slice(0, 2)));
  for (const keyword of preferredKeywords) {
    const matched = langMatched.find((v) => v.name.toLowerCase().includes(keyword));
    if (matched) {
      return matched;
    }
  }
  return langMatched[0] || list[0];
}

async function getHistory(type) {
  const key = HISTORY_KEYS[type];
  const stored = await chrome.storage.local.get([key]);
  return Array.isArray(stored[key]) ? stored[key] : [];
}

async function pushHistory(type, item) {
  const key = HISTORY_KEYS[type];
  const list = await getHistory(type);
  const next = [item, ...list].slice(0, HISTORY_LIMIT);
  await chrome.storage.local.set({ [key]: next });
}

async function clearHistory(type) {
  const key = HISTORY_KEYS[type];
  await chrome.storage.local.set({ [key]: [] });
}

function renderHistoryHtml(type, list) {
  const title = type === "translate" ? "翻译历史" : "润色历史";
  if (!list.length) {
    return `<div class="sel-helper-history"><div class="sel-helper-history-title">${title}</div><div class="sel-helper-muted">暂无历史记录</div></div>`;
  }
  const rows = list
    .slice(0, 5)
    .map((item, idx) => {
      const label = `${item.input || ""}`.replace(/\s+/g, " ").slice(0, 42);
      return `<button class="sel-helper-history-item" data-history-type="${type}" data-history-index="${idx}" title="${escapeHtml(label)}">${escapeHtml(label || "历史记录")}</button>`;
    })
    .join("");
  return `
    <div class="sel-helper-history">
      <div class="sel-helper-history-head">
        <div class="sel-helper-history-title">${title}</div>
        <button class="sel-helper-clear-history" data-clear-history="${type}">清空</button>
      </div>
      <div class="sel-helper-history-list">${rows}</div>
    </div>
  `;
}

function bindHistoryEvents(type) {
  panel.querySelectorAll(`[data-history-type="${type}"]`).forEach((btn) => {
    btn.addEventListener("click", async () => {
      const index = Number(btn.dataset.historyIndex || "-1");
      const list = await getHistory(type);
      const item = list[index];
      if (!item) {
        return;
      }
      if (type === "translate") {
        panel.querySelector("#sel-helper-translate-result").classList.remove("sel-helper-muted");
        panel.querySelector("#sel-helper-translate-result").textContent = item.output || "";
        return;
      }
      const textarea = panel.querySelector("#sel-helper-polish-text");
      if (textarea) {
        textarea.value = item.output || "";
      }
    });
  });
  panel.querySelectorAll(`[data-clear-history="${type}"]`).forEach((btn) => {
    btn.addEventListener("click", async () => {
      await clearHistory(type);
      if (type === "translate") {
        await renderTranslatePanel();
      } else {
        panel.querySelectorAll(".sel-helper-history").forEach((el) => {
          el.innerHTML = `<div class="sel-helper-history-title">润色历史</div><div class="sel-helper-muted">暂无历史记录</div>`;
        });
      }
    });
  });
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (_error) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
}

function isTextInput(el) {
  if (!el) {
    return false;
  }
  if (el instanceof HTMLTextAreaElement) {
    return !el.readOnly && !el.disabled;
  }
  if (!(el instanceof HTMLInputElement)) {
    return false;
  }
  const supported = ["text", "search", "url", "tel", "password", "email"];
  return supported.includes(el.type) && !el.readOnly && !el.disabled;
}

function getEditableRoot(node) {
  let current = node instanceof Node ? node : null;
  while (current && current !== document.body) {
    if (current.nodeType === Node.ELEMENT_NODE && current.isContentEditable) {
      return current;
    }
    current = current.parentNode;
  }
  return null;
}

function detectLanguage(text) {
  const hasChinese = /[\u3400-\u9FBF]/.test(text);
  const hasEnglish = /[A-Za-z]/.test(text);
  if (hasChinese && !hasEnglish) {
    return "zh";
  }
  if (hasEnglish && !hasChinese) {
    return "en";
  }
  return hasChinese ? "zh" : "en";
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
