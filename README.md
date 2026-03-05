# 🧰 工具箱 - GitHub Pages 静态工具集合

一个基于 GitHub Pages 的静态工具集合网站，支持自动识别和展示各类实用小工具。

## ✨ 特性

- 🎨 **现代化设计** - 简洁美观的响应式界面
- 🔍 **智能搜索** - 实时搜索工具名称、描述和标签
- 🏷️ **标签筛选** - 按分类标签快速筛选工具
- 📱 **响应式布局** - 完美适配桌面和移动设备
- ⚡ **自动发现** - 通过 `tools.json` 配置自动展示工具
- 🛠️ **易于扩展** - 简单的添加新工具流程
- 🌐 **国际化支持** - 自动根据浏览器语言切换简体中文/英文，支持手动切换

## 📁 项目结构

```
.
├── index.html              # 主页面（工具导航）
├── tools.json              # 工具配置文件
├── css/
│   └── style.css          # 主样式文件
├── js/
│   ├── i18n.js            # 国际化模块
│   ├── main.js            # 主页面脚本（搜索、筛选、渲染）
│   └── locales/           # 语言文件
│       ├── zh-CN.json     # 简体中文
│       └── en.json        # 英文
├── tools/                  # 工具目录
│   ├── base64-tool/        # Base64 编解码工具
│   ├── json-formatter/     # JSON 格式化工具
│   ├── color-picker/       # 颜色选择器
│   ├── timestamp-converter/# 时间戳转换器
│   └── remove-background/  # 背景去除工具
└── README.md
```

## 🚀 如何使用

### 1. 在 GitHub 上部署

1. Fork 或复制本项目到你的 GitHub 仓库
2. 仓库名命名为 `yourusername.github.io`（用户页面）或任意名称（项目页面）
3. 进入仓库 **Settings** → **Pages**
4. 选择分支（通常是 `main`）并保存
5. 访问 `https://yourusername.github.io` 即可查看

### 2. 添加新工具

#### 方式 A：全自动（推荐）

在 `tools/` 目录下创建新文件夹，然后运行：

```bash
node scripts/scan-tools.js
```

脚本会自动：
- 扫描 `tools/` 目录下的所有子文件夹
- 自动提取 HTML 中的标题和描述
- 智能猜测图标和标签
- 更新 `tools.json`

如果你使用 GitHub Actions（已配置），每次推送后会**自动**更新 `tools.json`。

#### 方式 B：手动编辑（传统）

编辑 `tools.json` 文件，手动添加工具信息。

#### 详细步骤

无论哪种方式，都需要先创建工具目录：

在 `tools/` 目录下创建一个新文件夹：

```bash
tools/
└── your-tool-name/
    └── index.html
```

#### 步骤 2: 编写工具页面

参考以下模板创建工具页面：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>你的工具名称</title>
    <link rel="stylesheet" href="../../css/style.css">
    <style>
        /* 工具专用样式 */
        .tool-page {
            max-width: 900px;
            margin: 0 auto;
            padding: 40px 24px;
        }
        .back-link {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            color: var(--primary-color);
            text-decoration: none;
            font-size: 0.9375rem;
            margin-bottom: 24px;
        }
        /* ... 其他样式 */
    </style>
</head>
<body>
    <div class="tool-page">
        <a href="../../index.html" class="back-link">返回首页</a>
        
        <div class="tool-header-detail">
            <h1>🔧 工具名称</h1>
            <p>工具的简短描述</p>
        </div>
        
        <div class="tool-content">
            <!-- 工具内容区域 -->
        </div>
    </div>
    
    <script>
        // 工具脚本
    </script>
</body>
</html>
```

#### 步骤 3: 注册工具

编辑 `tools.json` 文件，在 `tools` 数组中添加新工具的信息：

```json
{
  "tools": [
    {
      "id": "your-tool-name",
      "name": "工具显示名称",
      "description": "工具的简短描述，会显示在卡片上",
      "icon": "🔧",
      "path": "tools/your-tool-name/index.html",
      "tags": ["标签1", "标签2", "标签3"],
      "date": "2026-03-05"
    }
  ]
}
```

字段说明：
- `id` - 工具的唯一标识（建议小写，用连字符分隔）
- `name` - 显示名称
- `description` - 简短描述（建议不超过 50 字）
- `icon` - 表情符号或图标字符
- `path` - 工具页面的相对路径
- `tags` - 标签数组，用于分类和筛选
- `date` - 创建日期（YYYY-MM-DD 格式）

#### 步骤 4: 提交更改

提交更改到 GitHub，等待 GitHub Pages 自动部署（通常需要 1-2 分钟）。

```bash
git add .
git commit -m "添加新工具: XXX"
git push
```

## 🎨 内置工具

目前包含以下工具：

| 工具 | 描述 | 标签 |
|------|------|------|
| 🔐 Base64 编解码 | Base64 编码和解码，支持文本转换 | 编码、解码、Base64 |
| 📋 JSON 格式化 | JSON 格式化、美化和压缩 | JSON、格式化、工具 |
| 🎨 颜色选择器 | 颜色选择和转换，支持 HEX、RGB、HSL | 颜色、设计、工具 |
| ⏰ 时间戳转换器 | Unix 时间戳与日期时间相互转换 | 工具、计算 |
| 🖼️ 背景去除工具 | 智能图片背景去除，支持白色/纯色背景 | 图片、设计、工具 |

## 🔧 自定义配置

### 修改主题色

编辑 `css/style.css` 中的 CSS 变量：

```css
:root {
    --primary-color: #4f46e5;    /* 主色调 */
    --primary-hover: #4338ca;    /* 悬停色 */
    --primary-light: #eef2ff;    /* 浅色 */
    /* ... */
}
```

### 修改页面信息

编辑 `index.html` 修改标题和描述：

```html
<title>工具箱 | 实用小工具集合</title>
<h1 class="logo">🧰 工具箱</h1>
<p class="subtitle">实用、便捷的在线工具集合</p>
```

### 国际化 (i18n)

本项目支持简体中文和英文自动切换。系统会：
1. 自动检测浏览器语言偏好
2. 保存用户语言选择到 localStorage
3. 支持页面右上角手动切换语言

如需添加新的翻译语言：
1. 在 `js/locales/` 目录下创建新的语言文件（如 `ja.json`）
2. 复制 `en.json` 的内容并翻译
3. 在 `js/i18n.js` 中添加语言到 `supportedLangs` 列表
4. 在 `js/i18n.js` 的 `langNames` 中添加语言显示名称

## 📝 开发说明

### 本地预览

由于使用 ES6 模块和 Fetch API，建议使用本地服务器预览：

```bash
# 使用 Python 3
python -m http.server 8000

# 或使用 Node.js
npx serve .

# 或使用 VS Code Live Server 插件
```

然后访问 `http://localhost:8000`

### 浏览器兼容性

- Chrome/Edge 80+
- Firefox 75+
- Safari 13.1+
- 不支持 IE11

## 📄 许可证

MIT License - 自由使用和修改

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

Built with ❤️ for GitHub Pages
