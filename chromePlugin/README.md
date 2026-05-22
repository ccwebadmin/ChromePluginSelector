# Chrome 文本助手插件（解释 / 翻译 / 朗读 / 润色替换）

一个基于 Chrome Manifest V3 的网页选中文本助手，支持：

1. 解释选中的段落或关键词
2. 翻译选中的段落或关键词（中英文互译）
3. 朗读选中的段落或关键词（中文/英文）
4. 润色选中文案，并支持编辑后一键替换（可编辑区域）

其中：
- 解释、翻译、润色：通过 Kimi API 完成
- 朗读：使用 Chrome 内置 `speechSynthesis`
- 快捷键：`Shift + C`

---

## 新增增强能力

- 品牌化悬浮条 UI（白色胶囊风格，贴近参考截图）
- 插件图标（`icons/icon16.png` ~ `icons/icon128.png`）
- 快捷键显示/隐藏工具条：`Shift + C`
- 翻译/润色历史记录（本地存储）
- 自动语种识别，并默认推荐中文/英文最佳朗读音色

---

## 目录结构

```text
chromePlugin/
  ├─ manifest.json
  ├─ background.js
  ├─ kimi.config.js
  ├─ content.js
  ├─ content.css
  ├─ icons/
  │  ├─ icon16.png
  │  ├─ icon32.png
  │  ├─ icon48.png
  │  └─ icon128.png
  ├─ options.html
  ├─ options.css
  ├─ options.js
  └─ README.md
```

---

## 功能与交互说明

### 1) 选中文本后自动悬浮工具条

在网页中选中关键词或段落后，会在选区附近浮出工具条，按钮顺序固定为：

`解释` → `翻译` → `朗读` → `润色`

### 2) 结果展示方式

- `解释`：结果直接显示在悬浮面板中
- `翻译`：悬浮面板中可选择目标语言（中文/英文），然后展示结果
- `润色`：结果显示在可编辑文本框中，可继续人工修改
- `朗读`：可在面板中选择中文/英文语音并播放或停止

### 3) 一键替换（润色）

- 当选中文本位于可编辑区域（`input` / `textarea` / `contenteditable`）时，可直接替换原文
- 不可编辑页面中会自动复制润色文本，方便手动粘贴替换

---

## Kimi API 配置

### 1) 独立配置文件（你要求的单独文件）

请直接编辑：`kimi.config.js`

```js
export const KIMI_FILE_CONFIG = {
  apiKey: "你的 key",
  baseUrl: "https://api.moonshot.cn/v1",
  model: "kimi-latest",
  temperature: 0.3
};
```

> 该文件是默认配置来源；选项页保存的值会覆盖默认值。

### 2) 选项页配置（可覆盖独立配置文件）

插件设置页支持以下参数：

- `API Key`
- `Base URL`（默认：`https://api.moonshot.cn/v1`）
- `Model`（默认：`kimi-latest`）
- `Temperature`（默认：`0.3`）

> 根据 Kimi 文档，聊天接口可使用 `POST /v1/chat/completions`，`baseUrl` 建议保持 `https://api.moonshot.cn/v1`。
> 当模型无权限或不存在时，插件会自动回退尝试：`kimi-latest` → `moonshot-v1-8k` → `moonshot-v1-32k`。

---

## 在 Chrome 中部署插件

1. 打开 Chrome，访问 `chrome://extensions/`
2. 右上角开启 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择本项目根目录 `chromePlugin`
5. 扩展加载成功后，点击扩展卡片中的 **详情**
6. 进入 **扩展程序选项**（或右键插件图标进入选项页）
7. 填入 Kimi API 配置并保存

完成后，在任意网页中选中文本即可使用四个功能。

快捷键：`Shift + C`（显示/隐藏悬浮工具条）

---

## 使用示例

1. 在网页选中一段英文
2. 点击 `翻译`
3. 目标语言选择 `中文`
4. 点击开始翻译
5. 结果会显示在下方面板

润色替换示例：

1. 在可编辑输入框中选中一段文案
2. 点击 `润色`
3. 在结果框中微调文本
4. 点击 `一键替换选中文本`

---

## 常见问题

### 1) 提示“尚未配置 Kimi API Key”

进入扩展 **选项页**，填写 API Key 并保存。

### 2) 翻译/解释/润色失败

请检查：

- API Key 是否有效
- Base URL 是否正确
- 模型名是否可用
- 当前网络是否可访问 Kimi 服务

### 3) 页面上没有出现悬浮工具条

请确认：

- 当前页面确实有选中文本
- 选中文本长度不超过 4000 字
- 页面没有阻止脚本注入（少数特殊页面可能受限）

---

## 后续可扩展

- 增加多模型选择（不同 Kimi 模型）
- 增加历史记录面板
- 润色支持不同风格（正式/简洁/营销/学术）
- 结果导出和快捷键支持
