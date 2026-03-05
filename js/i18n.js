/**
 * i18n - 国际化模块
 * 支持自动检测浏览器语言并切换简体中文/英文
 */

const I18N = (function() {
    'use strict';

    // 默认配置
    const config = {
        defaultLang: 'zh-CN',
        supportedLangs: ['zh-CN', 'en'],
        storageKey: 'preferred-language'
    };

    // 当前语言
    let currentLang = config.defaultLang;
    
    // 翻译数据缓存
    let translations = {};
    
    // 语言加载状态
    let isLoaded = false;
    
    // 语言名称映射（用于显示）
    const langNames = {
        'zh-CN': '简体中文',
        'en': 'English'
    };

    /**
     * 检测浏览器语言
     */
    function detectBrowserLanguage() {
        const browserLang = navigator.language || navigator.userLanguage || '';
        
        // 检查是否是中文（包括各种中文变体）
        if (browserLang.startsWith('zh')) {
            return 'zh-CN';
        }
        
        // 检查是否是英文
        if (browserLang.startsWith('en')) {
            return 'en';
        }
        
        // 默认返回中文
        return config.defaultLang;
    }

    /**
     * 获取用户偏好语言（从 localStorage 或浏览器检测）
     */
    function getPreferredLanguage() {
        // 首先检查 localStorage 中保存的偏好
        const saved = localStorage.getItem(config.storageKey);
        if (saved && config.supportedLangs.includes(saved)) {
            return saved;
        }
        
        // 否则检测浏览器语言
        return detectBrowserLanguage();
    }

    /**
     * 加载翻译文件
     */
    async function loadTranslations(lang) {
        if (translations[lang]) {
            return translations[lang];
        }
        
        // 根据当前页面路径确定翻译文件路径
        const pathPrefix = window.location.pathname.includes('/tools/') ? '../../' : '';
        
        try {
            const response = await fetch(`${pathPrefix}js/locales/${lang}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load ${lang}.json`);
            }
            translations[lang] = await response.json();
            return translations[lang];
        } catch (error) {
            console.error(`Failed to load translations for ${lang}:`, error);
            // 如果加载失败，返回空对象
            return {};
        }
    }

    /**
     * 获取嵌套对象的值
     */
    function getNestedValue(obj, key) {
        const keys = key.split('.');
        let value = obj;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return null;
            }
        }
        
        return value;
    }

    /**
     * 翻译指定键
     */
    function t(key, replacements = {}) {
        const currentTranslations = translations[currentLang] || {};
        let text = getNestedValue(currentTranslations, key);
        
        // 如果当前语言没有翻译，尝试默认语言
        if (!text && currentLang !== config.defaultLang) {
            const defaultTranslations = translations[config.defaultLang] || {};
            text = getNestedValue(defaultTranslations, key);
        }
        
        // 如果仍然没有，返回键名
        if (!text) {
            return key;
        }
        
        // 替换变量
        Object.keys(replacements).forEach(placeholder => {
            text = text.replace(new RegExp(`{{${placeholder}}}`, 'g'), replacements[placeholder]);
        });
        
        return text;
    }

    /**
     * 更新页面上的所有翻译元素
     */
    function updatePageContent() {
        // 更新 data-i18n 属性的元素
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const text = t(key);
            
            // 检查是否有特殊属性需要翻译
            const attr = element.getAttribute('data-i18n-attr');
            if (attr) {
                element.setAttribute(attr, text);
            } else if (element.getAttribute('data-i18n-html') === 'true') {
                // 支持 HTML 内容
                element.innerHTML = text;
            } else {
                element.textContent = text;
            }
        });

        // 更新 placeholder
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            element.placeholder = t(key);
        });

        // 更新 title 属性
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            element.title = t(key);
        });

        // 更新 HTML lang 属性
        document.documentElement.lang = currentLang === 'zh-CN' ? 'zh-CN' : 'en';

        // 触发自定义事件，通知页面内容已更新
        document.dispatchEvent(new CustomEvent('i18n:updated', { 
            detail: { lang: currentLang } 
        }));
    }

    /**
     * 切换语言
     */
    async function setLanguage(lang) {
        if (!config.supportedLangs.includes(lang)) {
            console.warn(`Unsupported language: ${lang}`);
            return;
        }
        
        if (lang === currentLang) {
            return;
        }
        
        currentLang = lang;
        localStorage.setItem(config.storageKey, lang);
        
        await loadTranslations(lang);
        updatePageContent();
        
        // 更新语言切换按钮状态
        updateLanguageSwitcher();
    }

    /**
     * 创建语言切换器 HTML
     */
    function createLanguageSwitcher() {
        const container = document.createElement('div');
        container.className = 'language-switcher';
        container.innerHTML = `
            <button class="lang-btn" id="langBtn" aria-label="Switch language">
                <span class="lang-icon">🌐</span>
                <span class="lang-text">${langNames[currentLang]}</span>
                <span class="lang-arrow">▼</span>
            </button>
            <div class="lang-dropdown" id="langDropdown">
                ${config.supportedLangs.map(lang => `
                    <button class="lang-option ${lang === currentLang ? 'active' : ''}" data-lang="${lang}">
                        ${langNames[lang]}
                    </button>
                `).join('')}
            </div>
        `;

        // 添加事件监听
        const btn = container.querySelector('#langBtn');
        const dropdown = container.querySelector('#langDropdown');
        
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        });

        container.querySelectorAll('.lang-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const lang = e.target.getAttribute('data-lang');
                setLanguage(lang);
                dropdown.classList.remove('show');
            });
        });

        document.addEventListener('click', () => {
            dropdown.classList.remove('show');
        });

        return container;
    }

    /**
     * 更新语言切换器状态
     */
    function updateLanguageSwitcher() {
        const btn = document.querySelector('#langBtn');
        const dropdown = document.querySelector('#langDropdown');
        
        if (btn) {
            btn.querySelector('.lang-text').textContent = langNames[currentLang];
        }
        
        if (dropdown) {
            dropdown.querySelectorAll('.lang-option').forEach(option => {
                option.classList.toggle('active', option.getAttribute('data-lang') === currentLang);
            });
        }
    }

    /**
     * 初始化语言切换器
     */
    function initLanguageSwitcher(containerSelector) {
        const container = document.querySelector(containerSelector);
        if (container) {
            const switcher = createLanguageSwitcher();
            container.appendChild(switcher);
        }
    }

    /**
     * 初始化 i18n
     */
    async function init(options = {}) {
        // 合并配置
        Object.assign(config, options);
        
        // 获取偏好语言
        currentLang = getPreferredLanguage();
        
        // 加载翻译
        await loadTranslations(currentLang);
        
        // 如果是默认语言且不是当前语言，也加载默认语言作为后备
        if (currentLang !== config.defaultLang) {
            await loadTranslations(config.defaultLang);
        }
        
        isLoaded = true;
        
        // 更新页面内容
        updatePageContent();
        
        console.log(`i18n initialized with language: ${currentLang}`);
        
        return {
            lang: currentLang,
            t: t,
            setLanguage: setLanguage
        };
    }

    // 公共 API
    return {
        init: init,
        t: t,
        setLanguage: setLanguage,
        getCurrentLang: () => currentLang,
        getSupportedLangs: () => [...config.supportedLangs],
        initLanguageSwitcher: initLanguageSwitcher,
        isLoaded: () => isLoaded
    };
})();

// 导出模块（用于 ES6 模块）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = I18N;
}
