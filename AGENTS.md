# 🧰 工具箱开发规范

基于 GitHub Pages 的静态工具集合，使用 HTML/CSS/JS + i18n。

## 项目结构

```
├── index.html              # 主页
├── tools.json              # 工具注册配置（必须）
├── js/
│   ├── i18n.js            # 国际化模块
│   └── locales/           # 翻译文件
│       ├── zh-CN.json
│       └── en.json
└── tools/                  # 工具目录
    └── tool-name/         # kebab-case 命名
        ├── index.html     # HTML 结构
        ├── style.css      # 样式表（CSS 分离存放）
        └── main.js        # JavaScript 代码（JS 分离存放）
```

## 开发工具三步

### 1. 创建目录和页面

目录名使用 `kebab-case`，如 `image-editor`, `github-hosts`。

必须项：i18n 支持、语言切换器、返回首页链接、本地数据处理（不上传服务器）、**代码分离（HTML/CSS/JS 分离存放）**。

### 2. 添加翻译

在 `js/locales/zh-CN.json` 和 `en.json` 中添加：

- 工具 ID 用 camelCase（如 `colorPicker`）
- 通用分组：`title`, `subtitle`, `buttons`, `labels`, `tips`, `toast`
- HTML 使用：`data-i18n="toolId.key"`
- JS 使用：`I18N.t('toolId.key')`

### 3. 注册工具

在 `tools.json` 中添加工具配置，或运行 `node scripts/scan-tools.js` 自动扫描。

## 关键规范速查

| 项目 | 规范 |
|------|------|
| 目录命名 | kebab-case: `color-picker` |
| i18n 键名 | camelCase: `colorPicker.buttons.save` |
| 图标 | Emoji，如 `🎨` `🔧` |
| 标签 | 常用：`工具`, `图片`, `设计`, `颜色`, `网络`, `计算`, `格式化` |
| 样式 | 推荐 Tailwind CSS，主色调 `#4f46e5` |
| 代码分离 | HTML/CSS/JS 分离存放，禁止内嵌大量代码 |
| 安全 | 本地处理数据，使用 `textContent` 防 XSS |

## 代码分离规范

**所有工具必须将 HTML、CSS、JavaScript 分离到单独的文件中**，禁止在 HTML 中内嵌大量 CSS 或 JS 代码。

### 文件组织

```
tools/tool-name/
├── index.html     # HTML 结构
├── style.css      # CSS 样式
└── main.js        # JavaScript 逻辑
```

### 分离原则

| 类型 | 存放位置 | 说明 |
|------|----------|------|
| HTML 结构 | `index.html` | 页面布局、元素结构，**不包含 `<style>` 和 `<script>`** |
| CSS 样式 | `style.css` | 所有自定义样式，包括动画、组件样式 |
| JavaScript | `main.js` | 所有逻辑代码、事件监听、工具函数 |

### 引用方式

```html
<head>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="../../js/i18n.js"></script>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <!-- 页面内容 -->
    <script src="main.js"></script>
</body>
```

## 路径引用规范

**所有本地资源必须使用相对路径引用**，确保在 GitHub Pages 等静态托管环境中正确加载。

### 路径规则

| 资源类型 | 路径示例 | 说明 |
|----------|----------|------|
| 同级目录文件 | `style.css`, `main.js` | 同一工具目录内的 CSS/JS |
| 上级目录资源 | `../../js/i18n.js` | 引用项目公共 JS/CSS |
| 返回首页 | `../../index.html` | 从工具目录返回首页 |
| CDN 资源 | `https://cdn.xxx.com/...` | 外部 CDN 使用绝对 URL |

### 目录层级参考

```
project-root/
├── index.html              # 首页 (根目录)
├── js/
│   ├── i18n.js            # 公共 JS
│   └── locales/
├── css/
│   └── style.css          # 公共 CSS
└── tools/
    └── tool-name/
        ├── index.html     # 工具页面
        ├── style.css      # 工具样式
        └── main.js        # 工具脚本
```

从 `tools/tool-name/index.html` 引用：
- 当前目录文件：`style.css`, `main.js`
- 公共 JS：`../../js/i18n.js`
- 公共 CSS：`../../css/style.css`
- 返回首页：`../../index.html`

## 开发经验

- **初始化渲染**：异步加载后及时更新 UI，默认状态要有占位
- **UI 一致性**：同类型按钮图标风格统一，操作后给明确反馈（Toast / 动画）
- **异步组件**：初始化耗时组件添加 Loading 遮罩，文案通过 i18n 支持多语言
- **代码编辑**：StrReplaceFile 时匹配完整代码块，避免残留
