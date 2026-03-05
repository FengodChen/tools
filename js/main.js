/**
 * 工具箱主页脚本
 * 功能：自动加载工具列表、搜索、标签筛选
 */

// 全局状态
const state = {
    tools: [],
    filteredTools: [],
    allTags: [],
    activeTag: null,
    searchQuery: ''
};

// DOM 元素
const elements = {
    toolsGrid: document.getElementById('toolsGrid'),
    searchInput: document.getElementById('searchInput'),
    filterTags: document.getElementById('filterTags'),
    stats: document.getElementById('stats'),
    emptyState: document.getElementById('emptyState')
};

/**
 * 初始化应用
 */
async function init() {
    try {
        await loadTools();
        extractAllTags();
        setupEventListeners();
        render();
    } catch (error) {
        console.error('初始化失败:', error);
        showError('加载工具列表失败，请刷新页面重试');
    }
}

/**
 * 从 tools.json 加载工具列表
 */
async function loadTools() {
    try {
        const response = await fetch('tools.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        state.tools = data.tools || [];
        state.filteredTools = [...state.tools];
    } catch (error) {
        console.error('加载 tools.json 失败:', error);
        // 如果加载失败，使用空数组
        state.tools = [];
        state.filteredTools = [];
    }
}

/**
 * 提取所有唯一的标签
 */
function extractAllTags() {
    const tagSet = new Set();
    state.tools.forEach(tool => {
        if (tool.tags && Array.isArray(tool.tags)) {
            tool.tags.forEach(tag => tagSet.add(tag));
        }
    });
    state.allTags = Array.from(tagSet).sort();
}

/**
 * 设置事件监听器
 */
function setupEventListeners() {
    // 搜索输入
    elements.searchInput.addEventListener('input', handleSearch);
    
    // 搜索输入防抖
    let debounceTimer;
    elements.searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            handleSearch(e);
        }, 150);
    });
}

/**
 * 处理搜索
 */
function handleSearch(e) {
    state.searchQuery = e.target.value.trim().toLowerCase();
    filterTools();
    render();
}

/**
 * 处理标签点击
 */
function handleTagClick(tag) {
    if (state.activeTag === tag) {
        // 如果点击的是当前激活的标签，则取消筛选
        state.activeTag = null;
    } else {
        state.activeTag = tag;
    }
    filterTools();
    render();
}

/**
 * 筛选工具
 */
function filterTools() {
    state.filteredTools = state.tools.filter(tool => {
        // 标签筛选
        if (state.activeTag && (!tool.tags || !tool.tags.includes(state.activeTag))) {
            return false;
        }
        
        // 搜索筛选
        if (state.searchQuery) {
            const searchFields = [
                tool.name || '',
                tool.description || '',
                ...(tool.tags || [])
            ];
            const match = searchFields.some(field => 
                field.toLowerCase().includes(state.searchQuery)
            );
            if (!match) return false;
        }
        
        return true;
    });
}

/**
 * 渲染整个页面
 */
function render() {
    renderFilterTags();
    renderTools();
    renderStats();
}

/**
 * 渲染筛选标签
 */
function renderFilterTags() {
    if (state.allTags.length === 0) {
        elements.filterTags.innerHTML = '';
        return;
    }
    
    const tagsHtml = state.allTags.map(tag => {
        const isActive = state.activeTag === tag;
        return `
            <button class="tag ${isActive ? 'active' : ''}" 
                    data-tag="${escapeHtml(tag)}"
                    onclick="handleTagClick('${escapeHtml(tag)}')">
                ${escapeHtml(tag)}
            </button>
        `;
    }).join('');
    
    elements.filterTags.innerHTML = tagsHtml;
}

/**
 * 渲染工具卡片
 */
function renderTools() {
    if (state.filteredTools.length === 0) {
        elements.toolsGrid.innerHTML = '';
        elements.toolsGrid.style.display = 'none';
        elements.emptyState.style.display = 'block';
        return;
    }
    
    elements.toolsGrid.style.display = 'grid';
    elements.emptyState.style.display = 'none';
    
    const toolsHtml = state.filteredTools.map(tool => createToolCard(tool)).join('');
    elements.toolsGrid.innerHTML = toolsHtml;
}

/**
 * 创建工具卡片 HTML
 */
function createToolCard(tool) {
    const tagsHtml = (tool.tags || []).map(tag => 
        `<span class="tool-tag">${escapeHtml(tag)}</span>`
    ).join('');
    
    return `
        <a href="${escapeHtml(tool.path)}" class="tool-card" data-tool-id="${escapeHtml(tool.id)}">
            <div class="tool-header">
                <div class="tool-icon">${escapeHtml(tool.icon || '🔧')}</div>
                <h3 class="tool-title">${escapeHtml(tool.name)}</h3>
            </div>
            <p class="tool-description">${escapeHtml(tool.description)}</p>
            <div class="tool-tags">${tagsHtml}</div>
        </a>
    `;
}

/**
 * 渲染统计信息
 */
function renderStats() {
    const total = state.tools.length;
    const filtered = state.filteredTools.length;
    
    let statsText = '';
    if (filtered === total) {
        statsText = `共 ${total} 个工具`;
    } else {
        statsText = `显示 ${filtered} 个工具（共 ${total} 个）`;
    }
    
    if (state.activeTag) {
        statsText += ` · 标签：${state.activeTag}`;
    }
    
    elements.stats.textContent = statsText;
}

/**
 * HTML 转义，防止 XSS
 */
function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 显示错误信息
 */
function showError(message) {
    elements.toolsGrid.innerHTML = `
        <div class="empty-state" style="display: block;">
            <div class="empty-icon">⚠️</div>
            <h3>出错了</h3>
            <p>${escapeHtml(message)}</p>
        </div>
    `;
    elements.toolsGrid.style.display = 'block';
    elements.emptyState.style.display = 'none';
}

/**
 * 自动发现新工具（可选功能）
 * 尝试扫描 tools 目录，发现未在 tools.json 中注册的工具
 */
async function autoDiscoverTools() {
    // 注意：纯静态页面无法直接扫描目录
    // 这个功能需要在构建时或服务器端完成
    // 这里提供一个占位函数，用于未来扩展
    console.log('自动发现功能需要在构建时或配合服务器端实现');
}

/**
 * 导出工具列表（供其他脚本使用）
 */
window.getToolsList = () => state.tools;

// 启动应用
document.addEventListener('DOMContentLoaded', init);
