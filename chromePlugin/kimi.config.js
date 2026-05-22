// Kimi 独立配置文件：
// 1) 可在这里直接配置 API 地址和密钥；
// 2) 选项页保存的配置会覆盖这里的默认值；
// 3) 建议生产环境不要把真实密钥提交到公共仓库。
export const KIMI_FILE_CONFIG = {
  apiKey: "替换自己的",
  baseUrl: "https://api.moonshot.cn/v1",
  // 建议优先使用账号可用模型；常见可用：kimi-latest / moonshot-v1-8k
  model: "kimi-latest",
  temperature: 0.3
};
