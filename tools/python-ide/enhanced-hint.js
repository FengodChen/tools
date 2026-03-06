/**
 * Python 智能代码提示系统 - 完全基于 Pyodide 运行时自省
 * 
 * 特点：
 * - 完全动态获取，无硬编码
 * - 支持多级属性访问（如 numpy.random.randint）
 * - 自动处理模块别名
 * - 智能缓存
 * - 支持延迟加载的模块（如 numpy.random）
 */

class PythonHintProvider {
    constructor(pyodideInstance) {
        this.pyodide = pyodideInstance;
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5分钟缓存
        
        // 常见的别名映射
        this.aliases = {
            'np': 'numpy',
            'pd': 'pandas',
            'plt': 'matplotlib.pyplot',
            'sns': 'seaborn',
            'tf': 'tensorflow',
            'torch': 'torch',
            'F': 'functools',
            'nx': 'networkx',
            'Image': 'PIL.Image',
            'datetime': 'datetime.datetime'
        };
        
        // 常见的子模块，用于处理延迟加载的情况
        this.commonSubmodules = {
            'numpy': ['random', 'linalg', 'fft', 'ma', 'polynomial', 'typing'],
            'pandas': ['plotting', 'testing', 'io', 'api', 'compat', 'core', 'util'],
            'matplotlib': ['pyplot', 'pylab', 'backends', 'artist', 'axes', 'figure'],
            'os': ['path'],
            'scipy': ['stats', 'linalg', 'optimize', 'integrate', 'spatial', 'sparse', 'signal', 'ndimage'],
            'sklearn': ['datasets', 'model_selection', 'preprocessing', 'metrics', 'linear_model', 'tree', 'ensemble']
        };
    }

    /**
     * 解析路径并获取对象信息
     * 支持多级路径如: numpy.random.randint
     */
    async resolvePath(path) {
        if (!path || typeof path !== 'string') return null;
        
        const parts = path.split('.');
        if (parts.length === 0) return null;
        
        // 处理别名
        let firstPart = parts[0];
        if (this.aliases[firstPart]) {
            const aliased = this.aliases[firstPart];
            const aliasedParts = aliased.split('.');
            parts.splice(0, 1, ...aliasedParts);
        }
        
        return parts.join('.');
    }

    /**
     * 获取对象的所有成员（支持嵌套路径）
     */
    async getMembers(path) {
        const resolvedPath = await this.resolvePath(path);
        if (!resolvedPath) return [];
        
        // 检查缓存
        const cacheKey = `members:${resolvedPath}`;
        const cached = this.cache.get(cacheKey);
        if (cached && (Date.now() - cached.time) < this.cacheTimeout) {
            return cached.data;
        }

        try {
            // 将 commonSubmodules 序列化后传入 Python
            const commonSubmodulesJson = JSON.stringify(this.commonSubmodules);
            
            const pythonCode = `
import json
import types
import sys

# 从 JS 传入的常见子模块配置
COMMON_SUBMODULES = json.loads('''${commonSubmodulesJson}''')

def get_members(path):
    try:
        parts = path.split('.')
        if not parts or not parts[0]:
            return []
        
        module_name = parts[0]
        
        # 确保模块已导入
        if module_name not in sys.modules:
            try:
                __import__(module_name)
            except ImportError:
                return []
        
        # 获取根对象
        obj = sys.modules[module_name]
        
        # 逐层获取属性
        for part in parts[1:]:
            try:
                obj = getattr(obj, part)
            except AttributeError:
                return []
        
        members = []
        member_names = set()
        
        # 首先尝试 dir()
        try:
            all_names = list(dir(obj))
        except:
            all_names = []
        
        # 添加常见子模块（处理延迟加载的情况）
        if len(parts) == 1 and module_name in COMMON_SUBMODULES:
            for sub in COMMON_SUBMODULES[module_name]:
                if sub not in all_names:
                    try:
                        # 尝试访问，如果成功则说明存在
                        getattr(obj, sub)
                        all_names.append(sub)
                    except:
                        pass
        
        for name in all_names:
            # 跳过单下划线开头的私有成员，保留双下划线魔法方法
            if name.startswith('_') and not name.startswith('__'):
                continue
            if name.startswith('__') and not name.endswith('__'):
                continue
            
            if name in member_names:
                continue
            member_names.add(name)
                
            try:
                member = getattr(obj, name)
                member_type = type(member).__name__
                is_callable = callable(member)
                is_module = isinstance(member, types.ModuleType)
                is_class = isinstance(member, type)
                
                # 特殊处理：某些对象可能不是标准模块类型但实际是模块
                if not is_module and not is_class and not is_callable:
                    if 'module' in member_type.lower() or hasattr(member, '__file__'):
                        is_module = True
                
                # 获取文档（简化处理）
                doc = ''
                try:
                    doc_obj = getattr(member, '__doc__', None)
                    if doc_obj:
                        doc = str(doc_obj).split('\\n')[0][:100]
                except:
                    pass
                
                members.append({
                    'name': name,
                    'type': member_type,
                    'callable': is_callable,
                    'is_module': is_module,
                    'is_class': is_class,
                    'doc': doc
                })
            except Exception as e:
                # 即使无法获取属性，也包含名字
                members.append({
                    'name': name,
                    'type': 'unknown',
                    'callable': False,
                    'is_module': False,
                    'is_class': False,
                    'doc': ''
                })
        
        return members[:200]
    except Exception as e:
        return []

result = get_members(${JSON.stringify(resolvedPath)})
json.dumps(result)
`;
            const result = await this.pyodide.runPythonAsync(pythonCode);
            const members = JSON.parse(result);
            this.cache.set(cacheKey, { data: members, time: Date.now() });
            return members;
        } catch (e) {
            console.warn(`Failed to get members for ${path}:`, e);
            return [];
        }
    }

    /**
     * 获取函数签名信息
     */
    async getSignature(path) {
        const resolvedPath = await this.resolvePath(path);
        if (!resolvedPath) return null;
        
        const cacheKey = `sig:${resolvedPath}`;
        const cached = this.cache.get(cacheKey);
        if (cached && (Date.now() - cached.time) < this.cacheTimeout) {
            return cached.data;
        }

        try {
            const pythonCode = `
import json
import inspect
import types
import sys

def get_signature(path):
    try:
        parts = path.split('.')
        if not parts or not parts[0]:
            return None
        
        module_name = parts[0]
        
        # 确保模块已导入
        if module_name not in sys.modules:
            try:
                __import__(module_name)
            except ImportError:
                return None
        
        # 获取根对象
        obj = sys.modules[module_name]
        
        # 逐层获取属性
        for part in parts[1:]:
            try:
                obj = getattr(obj, part)
            except AttributeError:
                return None
        
        result = {
            'name': parts[-1],
            'type': type(obj).__name__,
            'doc': '',
            'signature': '',
            'params': [],
            'is_callable': callable(obj) and not isinstance(obj, type),
            'is_class': isinstance(obj, type),
            'is_module': isinstance(obj, types.ModuleType)
        }
        
        # 获取文档
        try:
            doc = inspect.getdoc(obj)
            if doc:
                result['doc'] = doc[:500]
                result['short_doc'] = doc.split('\\n')[0][:100]
        except:
            pass
        
        # 获取签名
        if callable(obj):
            try:
                sig = inspect.signature(obj)
                result['signature'] = str(sig)
                
                for name, param in sig.parameters.items():
                    param_info = {'name': name}
                    if param.default is not param.empty:
                        try:
                            param_info['default'] = repr(param.default)[:50]
                        except:
                            param_info['default'] = '...'
                    if param.annotation is not param.empty:
                        try:
                            param_info['annotation'] = str(param.annotation)[:30]
                        except:
                            pass
                    result['params'].append(param_info)
            except (ValueError, TypeError):
                pass
        
        return result
    except Exception as e:
        return None

result = get_signature(${JSON.stringify(resolvedPath)})
json.dumps(result if result else None)
`;
            const result = await this.pyodide.runPythonAsync(pythonCode);
            const sig = JSON.parse(result);
            if (sig) {
                this.cache.set(cacheKey, { data: sig, time: Date.now() });
            }
            return sig;
        } catch (e) {
            console.warn(`Failed to get signature for ${path}:`, e);
            return null;
        }
    }

    /**
     * 生成 CodeMirror 提示
     */
    async generateHints(editor, options) {
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        const lineUntilCursor = line.slice(0, cursor.ch);
        
        // 匹配多级属性访问: obj.attr1.attr2.partial
        const dotMatch = lineUntilCursor.match(/([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\.(\w*)$/);
        
        if (dotMatch) {
            const objPath = dotMatch[1];
            const partial = dotMatch[2].toLowerCase();
            
            const members = await this.getMembers(objPath);
            
            // 过滤匹配的成员
            const completions = members
                .filter(m => {
                    if (!partial) return true;
                    return m.name.toLowerCase().startsWith(partial);
                })
                .map(m => ({
                    text: m.name,
                    displayText: m.name + (m.callable ? '()' : ''),
                    type: m.is_module ? 'module' : (m.is_class ? 'class' : (m.callable ? 'function' : 'property')),
                    doc: m.doc,
                    render: (el, self, data) => this.renderHintItem(el, data, m)
                }));
            
            return {
                list: completions,
                from: { line: cursor.line, ch: cursor.ch - partial.length },
                to: cursor
            };
        }
        
        return this.getGlobalHints(editor, options);
    }

    /**
     * 渲染提示项
     */
    renderHintItem(el, data, member) {
        const div = document.createElement('div');
        div.style.padding = '3px 0';
        
        const main = document.createElement('div');
        main.style.display = 'flex';
        main.style.alignItems = 'center';
        main.style.gap = '8px';
        
        const icon = document.createElement('span');
        if (member.is_module) {
            icon.textContent = '📦';
        } else if (member.is_class) {
            icon.textContent = 'C';
            icon.style.color = '#f1fa8c';
        } else if (member.callable) {
            icon.textContent = 'ƒ';
            icon.style.color = '#8be9fd';
        } else {
            icon.textContent = '•';
            icon.style.color = '#50fa7b';
        }
        icon.style.width = '20px';
        icon.style.textAlign = 'center';
        icon.style.fontSize = '12px';
        main.appendChild(icon);
        
        const name = document.createElement('span');
        name.textContent = data.text;
        name.style.fontWeight = '500';
        name.style.color = '#f8f8f2';
        main.appendChild(name);
        
        const typeSpan = document.createElement('span');
        typeSpan.textContent = member.type;
        typeSpan.style.fontSize = '10px';
        typeSpan.style.color = '#888';
        typeSpan.style.marginLeft = 'auto';
        typeSpan.style.fontStyle = 'italic';
        main.appendChild(typeSpan);
        
        div.appendChild(main);
        
        if (data.doc) {
            const docEl = document.createElement('div');
            docEl.textContent = data.doc;
            docEl.style.fontSize = '10px';
            docEl.style.color = '#888';
            docEl.style.marginLeft = '28px';
            docEl.style.marginTop = '2px';
            docEl.style.maxWidth = '350px';
            docEl.style.overflow = 'hidden';
            docEl.style.textOverflow = 'ellipsis';
            docEl.style.whiteSpace = 'nowrap';
            div.appendChild(docEl);
        }
        
        el.appendChild(div);
    }

    /**
     * 全局代码补全（Python 关键字）
     */
    getGlobalHints(editor, options) {
        const cursor = editor.getCursor();
        const token = editor.getTokenAt(cursor);
        const word = token.string.toLowerCase();
        
        const keywords = [
            'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue',
            'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from',
            'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not',
            'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
            'None', 'True', 'False'
        ];
        
        const completions = keywords
            .filter(k => k.toLowerCase().startsWith(word))
            .map(k => ({ text: k, type: 'keyword' }));
        
        return {
            list: completions,
            from: { line: cursor.line, ch: token.start },
            to: cursor
        };
    }

    /**
     * 获取函数调用的参数提示
     */
    async getCallSignature(editor) {
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        const textBeforeCursor = line.slice(0, cursor.ch);
        
        const funcMatch = textBeforeCursor.match(/([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s*\(([^)]*)$/);
        
        if (!funcMatch) return null;
        
        const funcPath = funcMatch[1];
        const argsText = funcMatch[2];
        
        let paramIndex = 0;
        let parenDepth = 0;
        let inString = false;
        let stringChar = null;
        
        for (let i = 0; i < argsText.length; i++) {
            const char = argsText[i];
            const prevChar = i > 0 ? argsText[i - 1] : null;
            
            if (!inString) {
                if (char === '(' || char === '[' || char === '{') {
                    parenDepth++;
                } else if (char === ')' || char === ']' || char === '}') {
                    parenDepth--;
                } else if (char === '"' || char === "'" || char === '`') {
                    inString = true;
                    stringChar = char;
                } else if (char === ',' && parenDepth === 0) {
                    paramIndex++;
                }
            } else {
                if (char === stringChar && prevChar !== '\\') {
                    inString = false;
                    stringChar = null;
                }
            }
        }
        
        const sig = await this.getSignature(funcPath);
        if (!sig) return null;
        
        return {
            ...sig,
            paramIndex,
            funcPath
        };
    }

    /**
     * 清除缓存
     */
    clearCache() {
        this.cache.clear();
    }
}

// 导出供使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PythonHintProvider;
}
