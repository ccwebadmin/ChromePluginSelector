import { KIMI_FILE_CONFIG } from "./kimi.config.js";

const DEFAULT_CONFIG = {
  apiKey: KIMI_FILE_CONFIG.apiKey || "",
  baseUrl: KIMI_FILE_CONFIG.baseUrl || "https://api.moonshot.cn/v1",
  model: KIMI_FILE_CONFIG.model || "kimi-latest",
  temperature: Number(KIMI_FILE_CONFIG.temperature ?? 0.3)
};

const MODEL_FALLBACKS = ["kimi-latest", "moonshot-v1-8k", "moonshot-v1-32k"];

chrome.runtime.onInstalled.addListener(async () => {
  // 初始化时把独立配置文件中的默认值写入 storage，便于 options 页面直接编辑
  const stored = await chrome.storage.sync.get(["kimiConfig"]);
  if (!stored.kimiConfig) {
    await chrome.storage.sync.set({ kimiConfig: DEFAULT_CONFIG });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "KIMI_TASK") {
    return;
  }

  handleKimiTask(message.payload)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});

async function handleKimiTask(payload) {
  // 每次请求都读取最新配置，保证 options 页保存后立即生效
  const config = await getConfig();
  if (!config.apiKey) {
    throw new Error("尚未配置 Kimi API Key，请先到插件设置页配置。");
  }

  const text = (payload?.text || "").trim();
  if (!text) {
    throw new Error("未获取到选中文本。");
  }

  const task = payload?.task;
  const targetLang = payload?.targetLang || "zh";
  const prompt = buildPrompt(task, text, targetLang);

  const candidates = buildModelCandidates(config.model);
  let lastError = "";

  for (const model of candidates) {
    const attempt = await requestChatCompletion({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model,
      temperature: Number(config.temperature ?? 0.3),
      prompt
    });

    if (attempt.ok) {
      // 如果回退模型成功，自动写回 storage，减少后续报错
      if (model !== config.model) {
        await chrome.storage.sync.set({
          kimiConfig: {
            ...config,
            model
          }
        });
      }
      return attempt.content;
    }

    lastError = attempt.error || "";
    if (!isModelUnavailableError(lastError)) {
      break;
    }
  }

  throw new Error(lastError || "Kimi 请求失败，请检查配置和网络。");
}

function buildPrompt(task, text, targetLang) {
  if (task === "explain") {
    return [
      "请用中文解释以下文本或关键词，要求：",
      "1) 先给一句核心含义；",
      "2) 再给 2-4 条简明要点；",
      "3) 若是专业词，补充一个通俗例子。",
      "",
      `文本：${text}`
    ].join("\n");
  }

  if (task === "translate") {
    const langName = targetLang === "en" ? "英文" : "中文";
    return [
      `请将以下文本翻译成${langName}。`,
      "要求：",
      "1) 忠于原意；",
      "2) 自然流畅；",
      "3) 仅输出译文。",
      "",
      `文本：${text}`
    ].join("\n");
  }

  if (task === "polish") {
    return [
      "请润色以下文本，使其更清晰、自然、专业。",
      "要求：",
      "1) 保留原意；",
      "2) 如有语病请修正；",
      "3) 仅输出润色后的文本。",
      "",
      `文本：${text}`
    ].join("\n");
  }

  throw new Error("不支持的任务类型。");
}

async function getConfig() {
  const stored = await chrome.storage.sync.get(["kimiConfig"]);
  // 独立配置文件是基础值，storage 是覆盖值
  return { ...DEFAULT_CONFIG, ...(stored.kimiConfig || {}) };
}

function buildModelCandidates(primaryModel) {
  const list = [primaryModel, ...MODEL_FALLBACKS].filter(Boolean);
  return [...new Set(list)];
}

function isModelUnavailableError(message) {
  const text = String(message || "").toLowerCase();
  return text.includes("not found the model") || text.includes("permission denied") || text.includes("resource_not_found_error");
}

async function requestChatCompletion({ apiKey, baseUrl, model, temperature, prompt }) {
  const body = {
    model,
    temperature,
    messages: [
      {
        role: "system",
        content: "你是一个专业、可靠、简洁的文本助手。输出纯文本，不要加多余解释。"
      },
      {
        role: "user",
        content: prompt
      }
    ]
  };

  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const detail = await safeReadText(response);
    return { ok: false, error: `Kimi 请求失败(${response.status})：${detail || "请检查配置和网络"}` };
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    return { ok: false, error: "Kimi 返回为空，请重试。" };
  }
  return { ok: true, content };
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || DEFAULT_CONFIG.baseUrl).replace(/\/+$/, "");
}

async function safeReadText(response) {
  try {
    return await response.text();
  } catch (_err) {
    return "";
  }
}
