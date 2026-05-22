import { KIMI_FILE_CONFIG } from "./kimi.config.js";

const DEFAULT_CONFIG = {
  apiKey: KIMI_FILE_CONFIG.apiKey || "",
  baseUrl: KIMI_FILE_CONFIG.baseUrl || "https://api.moonshot.cn/v1",
  model: KIMI_FILE_CONFIG.model || "kimi-latest",
  temperature: Number(KIMI_FILE_CONFIG.temperature ?? 0.3)
};

const form = document.getElementById("config-form");
const messageEl = document.getElementById("message");
const restoreBtn = document.getElementById("restore-defaults");

init();

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const apiKey = document.getElementById("apiKey").value.trim();
  const baseUrl = document.getElementById("baseUrl").value.trim();
  const model = document.getElementById("model").value.trim();
  const temperature = Number(document.getElementById("temperature").value || "0.3");

  await chrome.storage.sync.set({
    kimiConfig: {
      apiKey,
      baseUrl: baseUrl || DEFAULT_CONFIG.baseUrl,
      model: model || DEFAULT_CONFIG.model,
      temperature: Number.isFinite(temperature) ? temperature : DEFAULT_CONFIG.temperature
    }
  });

  messageEl.textContent = "已保存。";
  setTimeout(() => {
    messageEl.textContent = "";
  }, 1500);
});

restoreBtn.addEventListener("click", async () => {
  await chrome.storage.sync.set({ kimiConfig: DEFAULT_CONFIG });
  setFormValues(DEFAULT_CONFIG);
  messageEl.textContent = "已恢复为 kimi.config.js 中的默认值。";
});

async function init() {
  const stored = await chrome.storage.sync.get(["kimiConfig"]);
  const config = { ...DEFAULT_CONFIG, ...(stored.kimiConfig || {}) };
  setFormValues(config);
}

function setFormValues(config) {
  document.getElementById("apiKey").value = config.apiKey || "";
  document.getElementById("baseUrl").value = config.baseUrl || DEFAULT_CONFIG.baseUrl;
  document.getElementById("model").value = config.model || DEFAULT_CONFIG.model;
  document.getElementById("temperature").value = String(config.temperature ?? DEFAULT_CONFIG.temperature);
}
