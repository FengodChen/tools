#!/usr/bin/env node
/**
 * 工具目录扫描脚本
 * 自动扫描 tools/ 目录，更新 tools.json 文件
 * 
 * 使用方法:
 *   node scripts/scan-tools.js
 * 
 * 功能:
 *   - 检测新添加的工具目录
 *   - 保留已有工具的配置信息
 *   - 自动提取 HTML 中的标题和描述
 */

const fs = require('fs');
const path = require('path');

const toolsDir = path.join(__dirname, '..', 'tools');
const toolsJsonPath = path.join(__dirname, '..', 'tools.json');

// 读取现有的 tools.json
let existingTools = {};
try {
  const existing = JSON.parse(fs.readFileSync(toolsJsonPath, 'utf8'));
  existing.tools.forEach(tool => {
    existingTools[tool.id] = tool;
  });
  console.log(`✓ 已加载现有配置，共 ${Object.keys(existingTools).length} 个工具`);
} catch (e) {
  console.log('ℹ 未找到现有配置，将创建新的 tools.json');
}

// 扫描 tools 目录
const tools = [];
const entries = fs.readdirSync(toolsDir, { withFileTypes: true });
let newCount = 0;

for (const entry of entries) {
  if (entry.isDirectory()) {
    const toolId = entry.name;
    const indexPath = path.join(toolsDir, toolId, 'index.html');
    
    // 检查是否存在 index.html
    if (fs.existsSync(indexPath)) {
      // 如果已存在配置，保留现有配置
      if (existingTools[toolId]) {
        tools.push(existingTools[toolId]);
        console.log(`  ✓ ${toolId} (保留现有配置)`);
      } else {
        // 尝试从 HTML 中提取信息
        const html = fs.readFileSync(indexPath, 'utf8');
        
        // 提取标题
        const titleMatch = html.match(/<title>(.+?)<\/title>/i);
        let name = titleMatch ? titleMatch[1] : toolId;
        // 清理标题中的 emoji 和常见后缀
        name = name.replace(/[🔧🎨📋🔐🧰📦✨🔍]|工具$|Tool$/gi, '').trim();
        
        // 提取描述（从第一个 <p> 标签或 meta description）
        let description = '';
        const metaDesc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
        const pDesc = html.match(/<p[^>]*>([^<]+)<\/p>/i);
        description = metaDesc ? metaDesc[1] : (pDesc ? pDesc[1] : '');
        
        // 创建新配置
        const tool = {
          id: toolId,
          name: name || toolId,
          description: description || `${name} 工具`,
          icon: guessIcon(name, toolId),
          path: `tools/${toolId}/index.html`,
          tags: guessTags(name, description),
          date: new Date().toISOString().split('T')[0]
        };
        
        tools.push(tool);
        newCount++;
        console.log(`  + ${toolId} (新发现: "${name}")`);
      }
    }
  }
}

// 按名称排序
tools.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));

// 写入 tools.json
const output = { tools };
fs.writeFileSync(toolsJsonPath, JSON.stringify(output, null, 2) + '\n');

console.log(`\n✅ 完成！共 ${tools.length} 个工具（新增 ${newCount} 个）`);
console.log(`📄 已更新: tools.json`);

// 辅助函数：猜测图标
function guessIcon(name, toolId) {
  const iconMap = {
    'base64': '🔐', 'encode': '🔐', 'decode': '🔓',
    'json': '📋', 'format': '📋', 'color': '🎨', 'picker': '🎨',
    'time': '⏰', 'date': '📅', 'calc': '🧮', 'calculator': '🧮',
    'text': '📝', 'string': '📝', 'password': '🔑',
    'qr': '📱', 'code': '📱', 'image': '🖼️', 'img': '🖼️',
    'url': '🔗', 'link': '🔗', 'hash': '#️⃣', 'md5': '#️⃣',
    'uuid': '🔢', 'random': '🎲', 'chart': '📊', 'regex': '🔍',
    'diff': '📝', 'compare': '📝', 'convert': '🔄', 'unit': '📏'
  };
  
  const lowerName = (name + toolId).toLowerCase();
  for (const [key, icon] of Object.entries(iconMap)) {
    if (lowerName.includes(key)) return icon;
  }
  return '📦';
}

// 辅助函数：猜测标签
function guessTags(name, description) {
  const tags = ['工具'];
  const text = (name + ' ' + description).toLowerCase();
  
  const tagKeywords = {
    '编码': ['encode', 'decode', 'base64', 'url', '编码', '解码'],
    '格式化': ['format', 'json', 'xml', '格式化'],
    '设计': ['color', 'css', '设计', '颜色', 'picker'],
    '计算': ['calc', 'math', '计算', '转换'],
    '文本': ['text', 'string', '文本', '字符串'],
    '开发': ['code', 'dev', 'program', '开发', '编程'],
    '安全': ['password', 'hash', 'encrypt', '安全', '加密']
  };
  
  for (const [tag, keywords] of Object.entries(tagKeywords)) {
    if (keywords.some(kw => text.includes(kw))) {
      tags.push(tag);
    }
  }
  
  return [...new Set(tags)]; // 去重
}
