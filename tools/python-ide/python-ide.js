        // Global variables
        let pyodide = null;
        let editor = null;
        let currentMode = 'ide';
        let paramHintElement = null;  // For function parameter hints
        
        // File System - Tree structure
        // Each node: { name: string, type: 'file'|'folder', content?: string, children?: {}, parent?: Node }
        let fileSystem = {
            name: 'root',
            type: 'folder',
            children: {
                'main.py': { name: 'main.py', type: 'file', content: '', parent: null }
            },
            parent: null
        };
        fileSystem.children['main.py'].parent = fileSystem;
        
        let currentPath = ['main.py'];  // Path array like ['folder1', 'file.py']
        let notebookCells = [];
        let cellCounter = 0;
        let installedPackagesList = [];
        const notebookCellEditors = {};
        
        // Context menu variables
        let contextMenuTarget = null; // 当前右键菜单的目标路径
        let longPressTimer = null;
        let isLongPress = false;
        
        // Context menu targets
        let editorContextMenuTarget = null;
        let tabContextMenuTarget = null;
        let activeContextMenu = null; // 'file', 'editor', 'tab', 'output', 'empty'
        
        // Helper to get node at path
        function getNodeAtPath(path) {
            if (path.length === 0) return fileSystem;
            let node = fileSystem;
            for (const name of path) {
                if (node.type !== 'folder' || !node.children[name]) return null;
                node = node.children[name];
            }
            return node;
        }
        
        // Helper to get full path string
        function getFullPath(path) {
            return path.join('/');
        }

        // Initialize
        document.addEventListener('DOMContentLoaded', async () => {
            await I18N.init();
            I18N.initLanguageSwitcher('.language-switcher-container');
            await initPyodide();
            initEditor();
            initNotebook();
            updateFileList();  // Initial file tree render
            initResizers();
            updateTabs();
            
            // Initialize all context menus after editor is ready
            initContextMenus();
            
            // Listen for language changes to update dynamic content
            document.addEventListener('i18n:updated', () => {
                updateDynamicI18n();
            });
        });
        
        // Update dynamic i18n content (like Pyodide status)
        function updateDynamicI18n() {
            const statusEl = document.getElementById('pyodideStatus');
            if (!statusEl) return;
            
            // Determine current state based on className
            if (statusEl.className.includes('bg-green-100')) {
                // Ready state
                statusEl.textContent = I18N.t('pythonIde.ready') || '就绪';
            } else if (statusEl.className.includes('bg-red-100')) {
                // Error state
                statusEl.textContent = I18N.t('pythonIde.error') || '加载失败';
            } else {
                // Loading state
                statusEl.textContent = I18N.t('pythonIde.loading') || '加载中...';
            }
        }

        // Initialize Pyodide
        async function initPyodide() {
            const statusEl = document.getElementById('pyodideStatus');
            try {
                pyodide = await loadPyodide({
                    stdout: (text) => appendOutput(text, 'stdout'),
                    stderr: (text) => appendOutput(text, 'stderr')
                });
                
                // Load micropip for package installation
                await pyodide.loadPackage('micropip');
                
                // Install and setup matplotlib
                await pyodide.runPythonAsync(`
import micropip
await micropip.install('matplotlib')
`);
                
                // Setup matplotlib display
                await pyodide.runPythonAsync(`
import sys
import io
import base64
import js

# Setup matplotlib for browser display
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

# Store reference to display function
_display_plot = None

def set_display_callback(callback):
    global _display_plot
    _display_plot = callback

def show_plot(*args, **kwargs):
    import matplotlib.pyplot as plt
    buf = io.BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight', dpi=100)
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode('utf-8')
    plt.close()
    html = f'<img src="data:image/png;base64,{img_base64}" style="max-width:100%;border-radius:4px;" />'
    if _display_plot:
        _display_plot(html)
    return html

plt.show = show_plot

# Also capture figure creation
_original_figure = plt.figure

def _patched_figure(*args, **kwargs):
    fig = _original_figure(*args, **kwargs)
    return fig

plt.figure = _patched_figure
`);
                
                // Set up the Python callback to display plots in browser
                pyodide.globals.get('set_display_callback')(displayPlot);
                
                statusEl.textContent = I18N.t('pythonIde.ready') || '就绪';
                statusEl.className = 'text-xs px-2 py-1 rounded bg-green-100 text-green-800';
                document.getElementById('runBtn').disabled = false;
                refreshPackages();
            } catch (error) {
                statusEl.textContent = I18N.t('pythonIde.error') || '加载失败';
                statusEl.className = 'text-xs px-2 py-1 rounded bg-red-100 text-red-800';
                console.error('Pyodide load error:', error);
            }
        }
        
        // Display plot from Python
        function displayPlot(html) {
            const plotsDiv = document.getElementById('plotsOutput');
            
            // Create container with save button
            const container = document.createElement('div');
            container.className = 'bg-white p-2 rounded relative group';
            
            // Extract image src from html
            const imgMatch = html.match(/src="([^"]+)"/);
            const imgSrc = imgMatch ? imgMatch[1] : null;
            
            // Add save button
            if (imgSrc) {
                const saveBtn = document.createElement('button');
                saveBtn.className = 'absolute top-2 right-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity';
                saveBtn.innerHTML = `💾 ${I18N.t('pythonIde.buttons.savePlot') || '保存'}`;
                saveBtn.onclick = () => saveImage(imgSrc);
                container.appendChild(saveBtn);
            }
            
            // Add image
            const imgWrapper = document.createElement('div');
            imgWrapper.innerHTML = html;
            container.appendChild(imgWrapper);
            
            plotsDiv.appendChild(container);
            
            // Auto switch to plots tab if new plot added
            if (plotsDiv.children.length > 0) {
                toggleOutputTab('plots');
            }
        }
        
        function saveImage(dataUrl) {
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `plot_${new Date().getTime()}.png`;
            link.click();
            showToast(I18N.t('pythonIde.toast.plotSaved') || '图表已保存', 'success');
        }

        // Python Keywords and Built-ins for Autocomplete
        const pythonKeywords = [
            'and', 'as', 'assert', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else',
            'except', 'exec', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is',
            'lambda', 'not', 'or', 'pass', 'print', 'raise', 'return', 'try', 'while', 'with',
            'yield', 'None', 'True', 'False', 'bool', 'bytes', 'str', 'int', 'float', 'list',
            'dict', 'tuple', 'set', 'frozenset', 'complex', 'abs', 'all', 'any', 'ascii', 'bin',
            'breakpoint', 'bytearray', 'callable', 'chr', 'classmethod', 'compile', 'delattr',
            'dir', 'divmod', 'enumerate', 'eval', 'exec', 'filter', 'format', 'getattr',
            'globals', 'hasattr', 'hash', 'help', 'hex', 'id', 'input', 'isinstance',
            'issubclass', 'iter', 'len', 'locals', 'map', 'max', 'memoryview', 'min', 'next',
            'object', 'oct', 'open', 'ord', 'pow', 'property', 'range', 'repr', 'reversed',
            'round', 'setattr', 'slice', 'sorted', 'staticmethod', 'sum', 'super', 'type',
            'vars', 'zip', '__import__'
        ];

        const pythonBuiltins = [
            'ArithmeticError', 'AssertionError', 'AttributeError', 'BaseException', 'BlockingIOError',
            'BrokenPipeError', 'BufferError', 'BytesWarning', 'ChildProcessError', 'ConnectionAbortedError',
            'ConnectionError', 'ConnectionRefusedError', 'ConnectionResetError', 'DeprecationWarning',
            'EOFError', 'Ellipsis', 'EnvironmentError', 'Exception', 'FileExistsError', 'FileNotFoundError',
            'FloatingPointError', 'FutureWarning', 'GeneratorExit', 'IOError', 'ImportError',
            'ImportWarning', 'IndentationError', 'IndexError', 'InterruptedError', 'IsADirectoryError',
            'KeyError', 'KeyboardInterrupt', 'LookupError', 'MemoryError', 'ModuleNotFoundError',
            'NameError', 'NotADirectoryError', 'NotImplemented', 'NotImplementedError', 'OSError',
            'OverflowError', 'PendingDeprecationWarning', 'PermissionError', 'ProcessLookupError',
            'RecursionError', 'ReferenceError', 'ResourceWarning', 'RuntimeError', 'RuntimeWarning',
            'StopAsyncIteration', 'StopIteration', 'SyntaxError', 'SyntaxWarning', 'SystemError',
            'SystemExit', 'TabError', 'TimeoutError', 'TypeError', 'UnboundLocalError',
            'UnicodeDecodeError', 'UnicodeEncodeError', 'UnicodeError', 'UnicodeTranslationError',
            'UnicodeWarning', 'UserWarning', 'ValueError', 'Warning', 'ZeroDivisionError'
        ];

        const commonModules = [
            'os', 'sys', 'math', 'random', 'datetime', 'time', 'json', 're', 'collections',
            'itertools', 'functools', 'typing', 'pathlib', 'inspect', 'string', 'hashlib',
            'base64', 'io', 'csv', 'xml', 'html', 'http', 'urllib', 'socket', 'sqlite3',
            'warnings', 'contextlib', 'dataclasses', 'enum', 'numbers', 'decimal', 'fractions',
            'statistics', 'numpy', 'np', 'pandas', 'pd', 'matplotlib', 'plt', 'sklearn',
            'tensorflow', 'torch', 'requests', 'flask', 'django', 'pytest', 'unittest'
        ];

        const numpyFunctions = [
            'array', 'zeros', 'ones', 'empty', 'arange', 'linspace', 'logspace', 'meshgrid',
            'eye', 'identity', 'diag', 'vstack', 'hstack', 'concatenate', 'split', 'transpose',
            'dot', 'matmul', 'inner', 'outer', 'tensordot', 'einsum', 'trace', 'det', 'inv',
            'eig', 'svd', 'solve', 'lstsq', 'mean', 'std', 'var', 'min', 'max', 'sum', 'prod',
            'cumsum', 'cumprod', 'argmin', 'argmax', 'argsort', 'sort', 'where', 'select',
            'piecewise', 'gradient', 'diff', 'cross', 'trapz', 'sin', 'cos', 'tan', 'arcsin',
            'arccos', 'arctan', 'arctan2', 'sinh', 'cosh', 'tanh', 'exp', 'expm1', 'exp2',
            'log', 'log10', 'log2', 'log1p', 'sqrt', 'cbrt', 'square', 'power', 'abs', 'fabs',
            'ceil', 'floor', 'trunc', 'rint', 'around', 'modf', 'ldexp', 'frexp', 'gcd',
            'lcm', 'sign', 'copysign', 'nextafter', 'spacing', 'linalg', 'random', 'fft'
        ];

        const pandasFunctions = [
            'DataFrame', 'Series', 'Index', 'MultiIndex', 'Categorical', 'Timestamp', 'Timedelta',
            'Period', 'Interval', 'read_csv', 'read_excel', 'read_json', 'read_sql', 'read_html',
            'concat', 'merge', 'join', 'pivot', 'pivot_table', 'melt', 'stack', 'unstack',
            'groupby', 'resample', 'rolling', 'expanding', 'ewm', 'shift', 'diff', 'pct_change',
            'cumsum', 'cumprod', 'cummax', 'cummin', 'rank', 'quantile', 'describe', 'info',
            'head', 'tail', 'sample', 'sort_values', 'sort_index', 'reset_index', 'set_index',
            'reindex', 'drop', 'dropna', 'fillna', 'isna', 'notna', 'duplicated', 'drop_duplicates',
            'apply', 'map', 'applymap', 'transform', 'filter', 'mask', 'where', 'query', 'eval'
        ];

        const matplotlibFunctions = [
            'plot', 'scatter', 'bar', 'barh', 'hist', 'boxplot', 'pie', 'imshow', 'contour',
            'contourf', 'pcolor', 'pcolormesh', 'fill', 'fill_between', 'fill_betweenx',
            'polar', 'semilogx', 'semilogy', 'loglog', 'errorbar', 'violinplot', 'eventplot',
            'hist2d', 'hexbin', 'stairs', 'stem', 'step', 'text', 'annotate', 'xlabel',
            'ylabel', 'title', 'legend', 'grid', 'xlim', 'ylim', 'axis', 'xticks', 'yticks',
            'gca', 'gcf', 'subplot', 'subplots', 'figure', 'savefig', 'show', 'close', 'clf',
            'cla', 'xscale', 'yscale', 'tight_layout', 'colorbar', 'imread', 'imsave', 'rcParams'
        ];

        // Function documentation database
        const functionDocs = {
            // Python builtins
            'print': 'print(*objects, sep=" ", end="\\n", file=sys.stdout, flush=False)\n打印对象到文本流',
            'len': 'len(s) -> int\n返回对象的长度（元素个数）',
            'range': 'range(stop) / range(start, stop[, step])\n生成整数序列',
            'enumerate': 'enumerate(iterable, start=0)\n返回索引和值的枚举对象',
            'zip': 'zip(*iterables)\n将多个可迭代对象聚合为元组',
            'map': 'map(function, iterable, ...)\n对可迭代对象每个元素执行函数',
            'filter': 'filter(function, iterable)\n过滤可迭代对象',
            'sum': 'sum(iterable[, start])\n求和',
            'max': 'max(iterable[, default=obj, key=func]) / max(arg1, arg2, *args[, key=func])\n返回最大值',
            'min': 'min(iterable[, default=obj, key=func]) / min(arg1, arg2, *args[, key=func])\n返回最小值',
            'abs': 'abs(x)\n返回绝对值',
            'round': 'round(number[, ndigits])\n四舍五入',
            'sorted': 'sorted(iterable, *, key=None, reverse=False)\n返回排序后的新列表',
            'open': 'open(file, mode="r", buffering=-1, encoding=None, ...)\n打开文件',
            'input': 'input([prompt])\n读取用户输入',
            'str': 'str(object="") / str(object=b"", encoding="utf-8", errors="strict")\n转换为字符串',
            'int': 'int([x]) / int(x, base=10)\n转换为整数',
            'float': 'float([x])\n转换为浮点数',
            'list': 'list([iterable])\n创建列表',
            'dict': 'dict(**kwarg) / dict(mapping, **kwarg) / dict(iterable, **kwarg)\n创建字典',
            'tuple': 'tuple([iterable])\n创建元组',
            'set': 'set([iterable])\n创建集合',
            // NumPy
            'array': 'numpy.array(object, dtype=None, copy=True, order="K", subok=False, ndmin=0)\n创建数组',
            'zeros': 'numpy.zeros(shape, dtype=float, order="C")\n创建零数组',
            'ones': 'numpy.ones(shape, dtype=float, order="C")\n创建1数组',
            'arange': 'numpy.arange([start,] stop[, step,], dtype=None)\n创建等差数组',
            'linspace': 'numpy.linspace(start, stop, num=50, endpoint=True, retstep=False, dtype=None)\n创建等间隔数组',
            'mean': 'numpy.mean(a, axis=None, dtype=None, out=None, keepdims=<no value>)\n计算平均值',
            'sum_np': 'numpy.sum(a, axis=None, dtype=None, out=None, keepdims=<no value>)\n计算总和',
            // Pandas
            'DataFrame': 'pandas.DataFrame(data=None, index=None, columns=None, dtype=None, copy=None)\n创建数据框',
            'Series': 'pandas.Series(data=None, index=None, dtype=None, name=None, copy=False)\n创建序列',
            'read_csv': 'pandas.read_csv(filepath_or_buffer, sep=NoDefault.no_default, delimiter=None, ...)\n读取CSV文件',
            'groupby': 'DataFrame.groupby(by=None, axis=0, level=None, as_index=True, ...)\n分组操作',
            // Matplotlib
            'plot': 'matplotlib.pyplot.plot(*args, scalex=True, scaley=True, data=None, **kwargs)\n绘制线图',
            'scatter': 'matplotlib.pyplot.scatter(x, y, s=None, c=None, marker=None, cmap=None, ...)\n绘制散点图',
            'show': 'matplotlib.pyplot.show(*args, **kwargs)\n显示图形',
            'xlabel': 'matplotlib.pyplot.xlabel(xlabel, fontdict=None, labelpad=None, *, loc=None, **kwargs)\n设置X轴标签',
            'ylabel': 'matplotlib.pyplot.ylabel(ylabel, fontdict=None, labelpad=None, *, loc=None, **kwargs)\n设置Y轴标签',
            'title': 'matplotlib.pyplot.title(label, fontdict=None, loc=None, pad=None, *, y=None, **kwargs)\n设置标题',
            // os module
            'os.listdir': 'os.listdir(path=None)\n返回指定目录中的文件和文件夹列表',
            'os.mkdir': 'os.mkdir(path, mode=511, *, dir_fd=None)\n创建新目录',
            'os.makedirs': 'os.makedirs(name, mode=511, exist_ok=False)\n递归创建目录',
            'os.remove': 'os.remove(path, *, dir_fd=None)\n删除文件',
            'os.rename': 'os.rename(src, dst, *, src_dir_fd=None, dst_dir_fd=None)\n重命名文件或目录',
            'os.getcwd': 'os.getcwd()\n返回当前工作目录',
            'os.chdir': 'os.chdir(path)\n改变当前工作目录',
            'os.path.join': 'os.path.join(a, *p)\n智能拼接路径',
            'os.path.exists': 'os.path.exists(path)\n检查路径是否存在',
            'os.path.isfile': 'os.path.isfile(path)\n检查路径是否为文件',
            'os.path.isdir': 'os.path.isdir(path)\n检查路径是否为目录',
            'os.path.basename': 'os.path.basename(p)\n返回路径中的文件名',
            'os.path.dirname': 'os.path.dirname(p)\n返回路径中的目录名',
            // sys module
            'sys.exit': 'sys.exit(arg=None)\n退出 Python 解释器',
            'sys.argv': 'sys.argv\n命令行参数列表',
            // json module
            'json.load': 'json.load(fp, *, cls=None, object_hook=None, ...)\n从文件加载 JSON',
            'json.loads': 'json.loads(s, *, cls=None, object_hook=None, ...)\n从字符串加载 JSON',
            'json.dump': 'json.dump(obj, fp, *, skipkeys=False, ensure_ascii=True, ...)\n保存 JSON 到文件',
            'json.dumps': 'json.dumps(obj, *, skipkeys=False, ensure_ascii=True, ...)\n将对象转为 JSON 字符串',
            // re module
            're.search': 're.search(pattern, string, flags=0)\n搜索字符串中第一个匹配',
            're.match': 're.match(pattern, string, flags=0)\n从字符串开头匹配',
            're.findall': 're.findall(pattern, string, flags=0)\n返回所有匹配的列表',
            're.sub': 're.sub(pattern, repl, string, count=0, flags=0)\n替换匹配的子串',
            're.compile': 're.compile(pattern, flags=0)\n编译正则表达式'
        };
        
        // Function parameter hint database - for showing signature help
        const functionSignatures = {
            // Builtins
            'print': { params: ['*objects', 'sep=" "', 'end="\\n"', 'file=sys.stdout', 'flush=False'], doc: '打印对象到文本流' },
            'len': { params: ['s'], doc: '返回对象的长度（元素个数）' },
            'range': { params: ['start/stop', 'stop', 'step'], doc: '生成整数序列' },
            'enumerate': { params: ['iterable', 'start=0'], doc: '返回索引和值的枚举对象' },
            'zip': { params: ['*iterables'], doc: '将多个可迭代对象聚合为元组' },
            'map': { params: ['function', '*iterables'], doc: '对可迭代对象每个元素执行函数' },
            'filter': { params: ['function', 'iterable'], doc: '过滤可迭代对象' },
            'sum': { params: ['iterable', 'start=0'], doc: '求和' },
            'max': { params: ['*args', 'key=None', 'default=None'], doc: '返回最大值' },
            'min': { params: ['*args', 'key=None', 'default=None'], doc: '返回最小值' },
            'abs': { params: ['x'], doc: '返回绝对值' },
            'round': { params: ['number', 'ndigits=None'], doc: '四舍五入' },
            'sorted': { params: ['iterable', 'key=None', 'reverse=False'], doc: '返回排序后的新列表' },
            'open': { params: ['file', 'mode="r"', 'encoding=None', '...'], doc: '打开文件' },
            'input': { params: ['prompt=None'], doc: '读取用户输入' },
            'str': { params: ['object=b""', 'encoding="utf-8"', 'errors="strict"'], doc: '转换为字符串' },
            'int': { params: ['x', 'base=10'], doc: '转换为整数' },
            'float': { params: ['x=None'], doc: '转换为浮点数' },
            'list': { params: ['iterable'], doc: '创建列表' },
            'dict': { params: ['**kwargs', 'mapping', 'iterable'], doc: '创建字典' },
            'tuple': { params: ['iterable'], doc: '创建元组' },
            'set': { params: ['iterable'], doc: '创建集合' },
            // os
            'listdir': { params: ['path=None'], doc: '返回目录中的文件列表' },
            'mkdir': { params: ['path', 'mode=511'], doc: '创建目录' },
            'makedirs': { params: ['name', 'mode=511', 'exist_ok=False'], doc: '递归创建目录' },
            'remove': { params: ['path'], doc: '删除文件' },
            'rename': { params: ['src', 'dst'], doc: '重命名文件' },
            'getcwd': { params: [], doc: '返回当前工作目录' },
            'chdir': { params: ['path'], doc: '改变当前工作目录' },
            'system': { params: ['command'], doc: '执行系统命令' },
            'walk': { params: ['top', 'topdown=True', 'onerror=None', 'followlinks=False'], doc: '遍历目录树' },
            // os.path
            'join': { params: ['a', '*p'], doc: '智能拼接路径' },
            'exists': { params: ['path'], doc: '检查路径是否存在' },
            'isfile': { params: ['path'], doc: '检查是否为文件' },
            'isdir': { params: ['path'], doc: '检查是否为目录' },
            'basename': { params: ['p'], doc: '返回路径中的文件名' },
            'dirname': { params: ['p'], doc: '返回路径中的目录名' },
            'splitext': { params: ['p'], doc: '分割路径和扩展名' },
            // sys
            'exit': { params: ['arg=None'], doc: '退出解释器' },
            // json
            'load': { params: ['fp'], doc: '从文件加载 JSON' },
            'loads': { params: ['s'], doc: '从字符串加载 JSON' },
            'dump': { params: ['obj', 'fp'], doc: '保存 JSON 到文件' },
            'dumps': { params: ['obj'], doc: '将对象转为 JSON 字符串' },
            // re
            'search': { params: ['pattern', 'string', 'flags=0'], doc: '搜索字符串中第一个匹配' },
            'match': { params: ['pattern', 'string', 'flags=0'], doc: '从字符串开头匹配' },
            'findall': { params: ['pattern', 'string', 'flags=0'], doc: '返回所有匹配的列表' },
            'sub': { params: ['pattern', 'repl', 'string', 'count=0'], doc: '替换匹配的子串' },
            'compile': { params: ['pattern', 'flags=0'], doc: '编译正则表达式' },
            // numpy
            'array': { params: ['object', 'dtype=None', 'copy=True'], doc: '创建数组' },
            'zeros': { params: ['shape', 'dtype=float'], doc: '创建零数组' },
            'ones': { params: ['shape', 'dtype=float'], doc: '创建1数组' },
            'arange': { params: ['start/stop', 'stop', 'step', 'dtype=None'], doc: '创建等差数组' },
            'linspace': { params: ['start', 'stop', 'num=50'], doc: '创建等间隔数组' },
            'mean': { params: ['a', 'axis=None'], doc: '计算平均值' },
            'std': { params: ['a', 'axis=None'], doc: '计算标准差' },
            'sum': { params: ['a', 'axis=None'], doc: '计算总和' },
            // pandas
            'DataFrame': { params: ['data=None', 'index=None', 'columns=None'], doc: '创建数据框' },
            'Series': { params: ['data=None', 'index=None', 'dtype=None'], doc: '创建序列' },
            'read_csv': { params: ['filepath', 'sep=None', 'header=0'], doc: '读取 CSV 文件' },
            // matplotlib
            'plot': { params: ['*args', '**kwargs'], doc: '绘制线图' },
            'scatter': { params: ['x', 'y', 's=None', 'c=None'], doc: '绘制散点图' },
            'xlabel': { params: ['xlabel'], doc: '设置 X 轴标签' },
            'ylabel': { params: ['ylabel'], doc: '设置 Y 轴标签' },
            'title': { params: ['label'], doc: '设置标题' },
            'legend': { params: ['*args', '**kwargs'], doc: '显示图例' },
            'grid': { params: ['b=None'], doc: '显示网格' }
        };
        
        // Extract user-defined variables and functions from code
        function extractUserDefinitions(code) {
            const definitions = [];
            
            // Match variable assignments: var = value
            const varRegex = /(^|\n)([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g;
            let match;
            while ((match = varRegex.exec(code)) !== null) {
                definitions.push({ text: match[2], type: 'variable' });
            }
            
            // Match function definitions: def func_name(
            const funcRegex = /def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
            while ((match = funcRegex.exec(code)) !== null) {
                definitions.push({ text: match[1], type: 'function' });
            }
            
            // Match class definitions: class ClassName
            const classRegex = /class\s+([a-zA-Z_][a-zA-Z0-9_]*)[\s\(:]/g;
            while ((match = classRegex.exec(code)) !== null) {
                definitions.push({ text: match[1], type: 'class' });
            }
            
            // Remove duplicates
            const seen = new Set();
            return definitions.filter(d => {
                if (seen.has(d.text)) return false;
                seen.add(d.text);
                return true;
            });
        }
        
        // Custom Python Hint Function
        function getPythonHints(editor, options) {
            const cursor = editor.getCursor();
            const token = editor.getTokenAt(cursor);
            const line = editor.getLine(cursor.line);
            const fullCode = editor.getValue();
            
            // Get the word being typed
            let start = token.start;
            let end = cursor.ch;
            let word = line.slice(start, end);
            
            // Check if there's a dot (accessing attributes)
            const lineUntilCursor = line.slice(0, cursor.ch);
            const dotMatch = lineUntilCursor.match(/([a-zA-Z_][a-zA-Z0-9_]*)\.(\w*)$/);
            
            let completions = [];
            let from = { line: cursor.line, ch: start };
            
            if (dotMatch) {
                const obj = dotMatch[1];
                const partial = dotMatch[2].toLowerCase();
                from = { line: cursor.line, ch: cursor.ch - partial.length };
                
                // Object-specific completions with docs
                const objCompletions = {
                    'np': numpyFunctions,
                    'numpy': numpyFunctions,
                    'pd': pandasFunctions,
                    'pandas': pandasFunctions,
                    'plt': matplotlibFunctions,
                    'matplotlib': matplotlibFunctions,
                    'list': ['append', 'extend', 'insert', 'remove', 'pop', 'clear', 'index', 'count', 'sort', 'reverse', 'copy'],
                    'dict': ['clear', 'copy', 'fromkeys', 'get', 'items', 'keys', 'pop', 'popitem', 'setdefault', 'update', 'values'],
                    'str': ['capitalize', 'casefold', 'center', 'count', 'encode', 'endswith', 'expandtabs', 'find', 'format', 'format_map', 'index', 'isalnum', 'isalpha', 'isascii', 'isdecimal', 'isdigit', 'isidentifier', 'islower', 'isnumeric', 'isprintable', 'isspace', 'istitle', 'isupper', 'join', 'ljust', 'lower', 'lstrip', 'maketrans', 'partition', 'removeprefix', 'removesuffix', 'replace', 'rfind', 'rindex', 'rjust', 'rpartition', 'rsplit', 'rstrip', 'split', 'splitlines', 'startswith', 'strip', 'swapcase', 'title', 'translate', 'upper', 'zfill'],
                    'os': ['path', 'name', 'environ', 'getcwd', 'chdir', 'listdir', 'mkdir', 'makedirs', 'remove', 'rmdir', 'rename', 'system', 'walk', 'sep', 'linesep'],
                    'sys': ['argv', 'exit', 'path', 'platform', 'version', 'stdout', 'stderr', 'stdin', 'modules'],
                    'json': ['dump', 'dumps', 'load', 'loads'],
                    're': ['compile', 'search', 'match', 'fullmatch', 'findall', 'finditer', 'split', 'sub', 'subn', 'escape', 'purge', 'template'],
                    'datetime': ['date', 'time', 'datetime', 'timedelta', 'tzinfo', 'timezone', 'MINYEAR', 'MAXYEAR'],
                    'math': ['pi', 'e', 'tau', 'inf', 'nan', 'ceil', 'floor', 'fabs', 'factorial', 'gcd', 'lcm', 'fsum', 'prod', 'isqrt', 'sqrt', 'pow', 'exp', 'expm1', 'log', 'log1p', 'log2', 'log10', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh', 'degrees', 'radians', 'hypot', 'dist', 'comb', 'perm', 'gamma', 'lgamma', 'erf', 'erfc']
                };
                
                if (objCompletions[obj]) {
                    completions = objCompletions[obj]
                        .filter(w => w.toLowerCase().startsWith(partial))
                        .map(w => {
                            const doc = functionDocs[w] || functionDocs[obj + '.' + w] || '';
                            return { text: w, type: 'method', doc: doc };
                        });
                }
            } else {
                // Global completions
                const wordLower = word.toLowerCase();
                
                // Extract user-defined variables and functions
                const userDefs = extractUserDefinitions(fullCode);
                
                // Add all categories
                const allWords = [
                    ...userDefs.map(w => ({ ...w, source: 'user' })),
                    ...pythonKeywords.map(w => ({ text: w, type: 'keyword' })),
                    ...pythonBuiltins.map(w => ({ text: w, type: 'class', doc: functionDocs[w] || '' })),
                    ...commonModules.map(w => ({ text: w, type: 'module' })),
                    ...numpyFunctions.map(w => ({ text: w, type: 'function', doc: functionDocs[w] || functionDocs['numpy.' + w] || '' })),
                    ...pandasFunctions.map(w => ({ text: w, type: 'function', doc: functionDocs[w] || functionDocs['pandas.' + w] || '' })),
                    ...matplotlibFunctions.map(w => ({ text: w, type: 'function', doc: functionDocs[w] || functionDocs['plt.' + w] || '' }))
                ];
                
                completions = allWords.filter(w => 
                    w.text.toLowerCase().startsWith(wordLower)
                );
            }
            
            // Enhance completions with display text and docs
            const enhancedCompletions = completions.slice(0, 50).map(c => ({
                text: c.text,
                displayText: c.text + (c.doc ? ' 📖' : ''),
                doc: c.doc || '',
                render: function(el, self, data) {
                    const div = document.createElement('div');
                    div.style.padding = '2px 0';
                    
                    const main = document.createElement('div');
                    main.textContent = data.text;
                    main.style.fontWeight = data.source === 'user' ? 'bold' : 'normal';
                    div.appendChild(main);
                    
                    if (data.doc) {
                        const docEl = document.createElement('div');
                        docEl.textContent = data.doc.split('\n')[0].substring(0, 50) + '...';
                        docEl.style.fontSize = '10px';
                        docEl.style.color = '#888';
                        docEl.style.marginTop = '2px';
                        div.appendChild(docEl);
                    }
                    
                    el.appendChild(div);
                }
            }));
            
            return {
                list: enhancedCompletions,
                from: from,
                to: cursor
            };
        }

        // Function Parameter Hint System
        function showParamHint(editor, functionName, paramIndex) {
            hideParamHint();
            
            const sig = functionSignatures[functionName];
            if (!sig) return;
            
            const cursor = editor.getCursor();
            const coords = editor.cursorCoords(cursor, 'local');
            
            const tooltip = document.createElement('div');
            tooltip.className = 'param-hint-tooltip';
            
            // Build signature with current parameter highlighted
            let sigHtml = sig.params.map((p, i) => {
                if (i === paramIndex) {
                    return `<span class="param-hint-active">${p}</span>`;
                }
                return p;
            }).join(', ');
            
            tooltip.innerHTML = `
                <div class="param-hint-signature">${functionName}(${sigHtml})</div>
                ${sig.doc ? `<div class="param-hint-doc">${sig.doc}</div>` : ''}
            `;
            
            // Position tooltip below cursor
            const editorRect = editor.getWrapperElement().getBoundingClientRect();
            tooltip.style.left = (editorRect.left + coords.left) + 'px';
            tooltip.style.top = (editorRect.top + coords.bottom + 5) + 'px';
            
            document.body.appendChild(tooltip);
            paramHintElement = tooltip;
            
            // Auto hide after 10 seconds or when typing continues
            setTimeout(() => hideParamHint(), 10000);
        }
        
        function hideParamHint() {
            if (paramHintElement) {
                paramHintElement.remove();
                paramHintElement = null;
            }
        }
        
        function updateParamHint(editor) {
            const cursor = editor.getCursor();
            const line = editor.getLine(cursor.line);
            const textBeforeCursor = line.slice(0, cursor.ch);
            
            // Find function call at cursor position
            // Match pattern: word(..., cursor, ...)
            const funcMatch = textBeforeCursor.match(/([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s*\(([^)]*)$/);
            if (!funcMatch) {
                hideParamHint();
                return;
            }
            
            const funcName = funcMatch[1];
            const argsText = funcMatch[2];
            
            // Count current parameter index by commas (ignoring nested parentheses and strings)
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
            
            // Try to find signature - first try full name, then just the last part
            if (functionSignatures[funcName]) {
                showParamHint(editor, funcName, paramIndex);
            } else {
                const parts = funcName.split('.');
                const lastPart = parts[parts.length - 1];
                if (functionSignatures[lastPart]) {
                    showParamHint(editor, lastPart, paramIndex);
                } else {
                    hideParamHint();
                }
            }
        }
        
        // Custom Modal Functions
        function showCustomModal(title, placeholder, defaultValue = '') {
            return new Promise((resolve) => {
                const modal = document.getElementById('customInputModal');
                const titleEl = document.getElementById('customModalTitle');
                const inputEl = document.getElementById('customModalInput');
                const confirmBtn = document.getElementById('customModalConfirm');
                const cancelBtn = document.getElementById('customModalCancel');
                
                titleEl.textContent = title;
                inputEl.placeholder = placeholder;
                inputEl.value = defaultValue;
                
                modal.classList.remove('hidden');
                inputEl.focus();
                inputEl.select();
                
                function close(result) {
                    modal.classList.add('hidden');
                    resolve(result);
                    // Clean up event listeners
                    confirmBtn.removeEventListener('click', onConfirm);
                    cancelBtn.removeEventListener('click', onCancel);
                    inputEl.removeEventListener('keydown', onKeydown);
                }
                
                function onConfirm() {
                    close(inputEl.value);
                }
                
                function onCancel() {
                    close(null);
                }
                
                function onKeydown(e) {
                    if (e.key === 'Enter') {
                        onConfirm();
                    } else if (e.key === 'Escape') {
                        onCancel();
                    }
                }
                
                confirmBtn.addEventListener('click', onConfirm);
                cancelBtn.addEventListener('click', onCancel);
                inputEl.addEventListener('keydown', onKeydown);
                
                // Close on backdrop click
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        onCancel();
                    }
                }, { once: true });
            });
        }

        // Initialize CodeMirror Editor
        function initEditor() {
            const textarea = document.getElementById('codeEditor');
            editor = CodeMirror.fromTextArea(textarea, {
                mode: 'python',
                theme: 'dracula',
                lineNumbers: true,
                indentUnit: 4,
                matchBrackets: true,
                extraKeys: {
                    'Ctrl-Enter': runCode,
                    'Cmd-Enter': runCode,
                    'Ctrl-Space': 'autocomplete',
                    'Cmd-Space': 'autocomplete',
                    'Tab': function(cm) {
                        if (cm.somethingSelected()) {
                            cm.indentSelection('add');
                        } else {
                            cm.replaceSelection('    ');
                        }
                    }
                },
                hintOptions: {
                    hint: getPythonHints,
                    completeSingle: false,
                    alignWithWord: true,
                    closeCharacters: /[\s(){}\[\];>,]/
                }
            });
            
            // Auto-trigger hints on typing
            let debounceTimer;
            editor.on('inputRead', function(cm, change) {
                if (change.text.length === 1 && /[\w.]/.test(change.text[0])) {
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => {
                        cm.showHint({ hint: getPythonHints });
                    }, 200);
                }
                
                // Update parameter hints when typing in function call
                updateParamHint(cm);
            });
            
            // Hide param hint on cursor activity
            editor.on('cursorActivity', () => {
                if (editor) {
                    updateParamHint(editor);
                }
            });
            
            editor.on('change', () => {
                const node = getNodeAtPath(currentPath);
                if (node && node.type === 'file') {
                    node.content = editor.getValue();
                }
                // Hide param hint when content changes significantly
                if (paramHintElement) {
                    updateParamHint(editor);
                }
            });
            
            // Hide param hint when editor loses focus
            editor.on('blur', () => {
                hideParamHint();
            });
            
            // Hide loading overlay
            const loadingEl = document.getElementById('editorLoading');
            if (loadingEl) {
                loadingEl.classList.add('hidden');
            }
        }

        // Initialize Notebook
        function initNotebook() {
            addNotebookCell('code');
        }

        // Switch Mode
        function switchMode(mode) {
            currentMode = mode;
            const ideContainer = document.getElementById('ideContainer');
            const notebookContainer = document.getElementById('notebookContainer');
            const ideBtn = document.getElementById('ideModeBtn');
            const notebookBtn = document.getElementById('notebookModeBtn');
            
            if (mode === 'ide') {
                ideContainer.classList.remove('hidden');
                notebookContainer.classList.add('hidden');
                ideBtn.classList.add('mode-active');
                notebookBtn.classList.remove('mode-active');
            } else {
                ideContainer.classList.add('hidden');
                notebookContainer.classList.remove('hidden');
                ideBtn.classList.remove('mode-active');
                notebookBtn.classList.add('mode-active');
            }
        }

        // Add Notebook Cell
        function addNotebookCell(type, content = '') {
            cellCounter++;
            const cellId = `cell-${cellCounter}`;
            const cell = { id: cellId, type, content, output: '' };
            notebookCells.push(cell);
            
            const cellDiv = document.createElement('div');
            cellDiv.id = cellId;
            cellDiv.className = 'notebook-cell bg-white rounded-lg shadow-sm border border-gray-200';
            cellDiv.innerHTML = `
                <div class="flex items-center gap-2 px-3 py-1 bg-gray-50 border-b border-gray-200 rounded-t-lg">
                    <span class="text-xs text-gray-500">[${notebookCells.length}]</span>
                    <span class="text-xs text-gray-400">${type === 'code' ? 'Code' : 'Markdown'}</span>
                    <div class="flex-1"></div>
                    <button onclick="runNotebookCell('${cellId}')" class="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded hover:bg-green-200">▶ 运行</button>
                    <button onclick="moveCell('${cellId}', -1)" class="text-xs text-gray-400 hover:text-gray-600">↑</button>
                    <button onclick="moveCell('${cellId}', 1)" class="text-xs text-gray-400 hover:text-gray-600">↓</button>
                    <button onclick="deleteCell('${cellId}')" class="text-xs text-red-400 hover:text-red-600">×</button>
                </div>
                <div class="p-3">
                    ${type === 'code' 
                        ? `<textarea id="${cellId}-input" class="w-full h-24 font-mono text-sm p-2 border border-gray-200 rounded resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="${I18N.t('pythonIde.notebook.codePlaceholder') || '输入 Python 代码...'}">${content}</textarea>`
                        : `<textarea id="${cellId}-input" class="w-full h-20 font-mono text-sm p-2 border border-gray-200 rounded resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="${I18N.t('pythonIde.notebook.markdownPlaceholder') || '输入 Markdown...'}">${content}</textarea>`
                    }
                </div>
                <div id="${cellId}-output" class="cell-output mx-3 mb-3 p-3 hidden"></div>
            `;
            
            document.getElementById('notebookCells').appendChild(cellDiv);
            
            // Initialize CodeMirror for code cells
            if (type === 'code') {
                const textarea = document.getElementById(`${cellId}-input`);
                const cm = CodeMirror.fromTextArea(textarea, {
                    mode: 'python',
                    theme: 'dracula',
                    lineNumbers: false,
                    indentUnit: 4,
                    matchBrackets: true,
                    viewportMargin: Infinity,
                    extraKeys: {
                        'Ctrl-Enter': () => runNotebookCell(cellId),
                        'Cmd-Enter': () => runNotebookCell(cellId),
                        'Ctrl-Space': 'autocomplete',
                        'Cmd-Space': 'autocomplete',
                        'Tab': function(cm) {
                            if (cm.somethingSelected()) {
                                cm.indentSelection('add');
                            } else {
                                cm.replaceSelection('    ');
                            }
                        }
                    },
                    hintOptions: {
                        hint: getPythonHints,
                        completeSingle: false,
                        alignWithWord: true,
                        closeCharacters: /[\s(){}\[\];>,]/
                    }
                });
                
                // Auto-trigger hints on typing
                let debounceTimer;
                cm.on('inputRead', function(cm, change) {
                    if (change.text.length === 1 && /[\w.]/.test(change.text[0])) {
                        clearTimeout(debounceTimer);
                        debounceTimer = setTimeout(() => {
                            cm.showHint({ hint: getPythonHints });
                        }, 200);
                    }
                });
                
                notebookCellEditors[cellId] = cm;
            }
        }

        // Run Notebook Cell
        async function runNotebookCell(cellId) {
            const cell = notebookCells.find(c => c.id === cellId);
            if (!cell) return;
            
            // Get input from CodeMirror if available, otherwise from textarea
            let input;
            const cm = notebookCellEditors[cellId];
            if (cm) {
                input = cm.getValue();
            } else {
                input = document.getElementById(`${cellId}-input`).value;
            }
            
            const outputDiv = document.getElementById(`${cellId}-output`);
            
            cell.content = input;
            
            if (cell.type === 'markdown') {
                outputDiv.innerHTML = renderMarkdown(input);
                outputDiv.classList.remove('hidden');
                return;
            }
            
            // Code cell
            outputDiv.innerHTML = '<div class="loading-spinner"></div>';
            outputDiv.classList.remove('hidden');
            
            // Clear global output areas for this cell run
            document.getElementById('consoleOutput').innerHTML = '';
            document.getElementById('plotsOutput').innerHTML = '';
            
            try {
                await pyodide.runPythonAsync(input);
                
                // Collect output
                let output = document.getElementById('consoleOutput').innerHTML;
                const plotsHtml = document.getElementById('plotsOutput').innerHTML;
                
                let resultHtml = '';
                if (output.trim()) {
                    resultHtml += `<div class="text-gray-300 font-mono text-sm mb-2">${output}</div>`;
                }
                if (plotsHtml.trim()) {
                    resultHtml += plotsHtml;
                }
                
                outputDiv.innerHTML = resultHtml || `<span class="text-gray-400">${I18N.t('pythonIde.toast.noCellOutput') || '无输出'}</span>`;
            } catch (error) {
                outputDiv.innerHTML = `<span class="text-red-500">${escapeHtml(String(error))}</span>`;
            }
        }

        // Move Cell
        function moveCell(cellId, direction) {
            const index = notebookCells.findIndex(c => c.id === cellId);
            if (index === -1) return;
            
            const newIndex = index + direction;
            if (newIndex < 0 || newIndex >= notebookCells.length) return;
            
            // Save current content from CodeMirror instances
            const savedCells = notebookCells.map(cell => {
                const cm = notebookCellEditors[cell.id];
                return {
                    type: cell.type,
                    content: cm ? cm.getValue() : document.getElementById(`${cell.id}-input`)?.value || cell.content
                };
            });
            
            // Swap cells
            const temp = savedCells[index];
            savedCells[index] = savedCells[newIndex];
            savedCells[newIndex] = temp;
            
            // Cleanup CodeMirror instances
            Object.values(notebookCellEditors).forEach(cm => cm.to());
            Object.keys(notebookCellEditors).forEach(key => delete notebookCellEditors[key]);
            
            // Rebuild notebook
            const container = document.getElementById('notebookCells');
            container.innerHTML = '';
            notebookCells = [];
            
            savedCells.forEach(cell => {
                addNotebookCell(cell.type, cell.content);
            });
        }

        // Delete Cell
        function deleteCell(cellId) {
            const index = notebookCells.findIndex(c => c.id === cellId);
            if (index === -1) return;
            
            // Cleanup CodeMirror instance if exists
            if (notebookCellEditors[cellId]) {
                notebookCellEditors[cellId].to();
                delete notebookCellEditors[cellId];
            }
            
            notebookCells.splice(index, 1);
            document.getElementById(cellId).remove();
        }

        // Simple Markdown Renderer
        function renderMarkdown(text) {
            return text
                .replace(/### (.*)/g, '<h3 class="text-lg font-bold mt-2 mb-1">$1</h3>')
                .replace(/## (.*)/g, '<h2 class="text-xl font-bold mt-3 mb-2">$1</h2>')
                .replace(/# (.*)/g, '<h1 class="text-2xl font-bold mt-4 mb-3">$1</h1>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded text-sm">$1</code>')
                .replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-800 text-white p-3 rounded overflow-x-auto text-sm"><code>$1</code></pre>')
                .replace(/\n/g, '<br>');
        }

        // Run Code
        async function runCode() {
            if (!pyodide) return;
            
            clearOutput();
            const code = currentMode === 'ide' ? editor.getValue() : '';
            
            if (!code.trim()) {
                showToast(I18N.t('pythonIde.toast.noCode') || '请输入代码', 'warning');
                return;
            }
            
            try {
                await pyodide.runPythonAsync(code);
                
                // Check if there are plots to display
                const plotsDiv = document.getElementById('plotsOutput');
                if (plotsDiv.children.length > 0) {
                    toggleOutputTab('plots');
                }
                
                showToast(I18N.t('pythonIde.toast.runSuccess') || '运行完成', 'success');
            } catch (error) {
                appendOutput(String(error), 'stderr');
                showToast(I18N.t('pythonIde.toast.runError') || '运行出错', 'error');
            }
        }

        // Append Output
        function appendOutput(text, type = 'stdout') {
            const consoleDiv = document.getElementById('consoleOutput');
            
            // Handle multi-line text by splitting on newlines
            const lines = text.split('\n');
            lines.forEach((lineText, index) => {
                // Skip empty trailing lines unless it's the only content
                if (index === lines.length - 1 && lineText === '' && lines.length > 1) {
                    return;
                }
                
                const line = document.createElement('div');
                line.className = type === 'stderr' ? 'text-red-400' : 'text-gray-300';
                line.style.whiteSpace = 'pre-wrap';  // Preserve whitespace and wrap
                line.style.wordBreak = 'break-word';  // Break long words
                line.textContent = lineText;
                consoleDiv.appendChild(line);
            });
            
            consoleDiv.scrollTop = consoleDiv.scrollHeight;
            
            // Check for matplotlib output
            if (text.includes('data:image/png;base64')) {
                const plotsDiv = document.getElementById('plotsOutput');
                const plotWrapper = document.createElement('div');
                plotWrapper.innerHTML = text;
                plotsDiv.appendChild(plotWrapper);
            }
        }

        // Clear Output
        function clearOutput() {
            document.getElementById('consoleOutput').innerHTML = '';
            document.getElementById('plotsOutput').innerHTML = '';
            
            // Clear notebook cell outputs too
            notebookCells.forEach(cell => {
                const outputDiv = document.getElementById(`${cell.id}-output`);
                if (outputDiv) {
                    outputDiv.innerHTML = '';
                    outputDiv.classList.add('hidden');
                }
            });
        }

        // Toggle Output Tab
        function toggleOutputTab(tab) {
            const consoleDiv = document.getElementById('consoleOutput');
            const plotsDiv = document.getElementById('plotsOutput');
            const consoleTab = document.getElementById('consoleTab');
            const plotsTab = document.getElementById('plotsTab');
            
            if (tab === 'console') {
                consoleDiv.classList.remove('hidden');
                plotsDiv.classList.add('hidden');
                consoleTab.classList.add('bg-gray-700', 'text-white');
                consoleTab.classList.remove('text-gray-400');
                plotsTab.classList.remove('bg-gray-700', 'text-white');
                plotsTab.classList.add('text-gray-400');
            } else {
                consoleDiv.classList.add('hidden');
                plotsDiv.classList.remove('hidden');
                plotsTab.classList.add('bg-gray-700', 'text-white');
                plotsTab.classList.remove('text-gray-400');
                consoleTab.classList.remove('bg-gray-700', 'text-white');
                consoleTab.classList.add('text-gray-400');
            }
        }

        // UI Toggle Functions
        let sidebarVisible = true;
        function toggleSidebar() {
            const sidebar = document.getElementById('sidebar');
            const toggle = document.getElementById('sidebarToggle');
            sidebarVisible = !sidebarVisible;
            
            if (sidebarVisible) {
                sidebar.classList.remove('sidebar-hidden');
                toggle.classList.add('hidden');
            } else {
                sidebar.classList.add('sidebar-hidden');
                toggle.classList.remove('hidden');
            }
        }
        
        let outputVisible = true;
        function toggleOutputPanel() {
            const panel = document.getElementById('outputPanel');
            const toggle = document.getElementById('outputToggle');
            const resizer = document.getElementById('outputResizer');
            outputVisible = !outputVisible;
            
            if (outputVisible) {
                panel.classList.remove('hidden');
                resizer.classList.remove('hidden');
                toggle.classList.add('hidden');
            } else {
                panel.classList.add('hidden');
                resizer.classList.add('hidden');
                toggle.classList.remove('hidden');
            }
        }
        
        // Resizable panels
        function initResizers() {
            // Sidebar resizer
            const sidebarResizer = document.getElementById('sidebarResizer');
            const sidebar = document.getElementById('sidebar');
            let isResizingSidebar = false;
            
            sidebarResizer.addEventListener('mousedown', (e) => {
                isResizingSidebar = true;
                document.body.style.cursor = 'col-resize';
            });
            
            // Output resizer
            const outputResizer = document.getElementById('outputResizer');
            const outputPanel = document.getElementById('outputPanel');
            let isResizingOutput = false;
            
            outputResizer.addEventListener('mousedown', (e) => {
                isResizingOutput = true;
                document.body.style.cursor = 'row-resize';
            });
            
            document.addEventListener('mousemove', (e) => {
                if (isResizingSidebar) {
                    const newWidth = e.clientX;
                    if (newWidth > 150 && newWidth < 400) {
                        sidebar.style.width = newWidth + 'px';
                    }
                }
                if (isResizingOutput) {
                    const containerHeight = document.querySelector('main').offsetHeight;
                    const newHeight = containerHeight - e.clientY;
                    if (newHeight > 100 && newHeight < 500) {
                        outputPanel.style.height = newHeight + 'px';
                    }
                }
            });
            
            document.addEventListener('mouseup', () => {
                isResizingSidebar = false;
                isResizingOutput = false;
                document.body.style.cursor = 'default';
            });
        }
        
        // Tab Management
        let openTabs = [];  // Array of paths
        
function updateTabs() {
            const tabsContainer = document.getElementById('editorTabs');
            if (!tabsContainer) return;
            
            // Ensure current file is in tabs
            const currentPathStr = getFullPath(currentPath);
            if (!openTabs.includes(currentPathStr)) {
                openTabs.push(currentPathStr);
            }
            
            // Render tabs
            tabsContainer.innerHTML = openTabs.map(pathStr => {
                const isActive = pathStr === currentPathStr;
                const fileName = pathStr.split('/').pop();
                return `
                    <div class="editor-tab ${isActive ? 'active' : ''}" 
                         onclick="switchToTab('${pathStr}')"
                         oncontextmenu="showTabContextMenu(event, '${pathStr}')">
                        <span>${fileName}</span>
                        <span class="editor-tab-close" onclick="closeTab(event, '${pathStr}')">×</span>
                    </div>
                `;
            }).join('');
            
            // Initialize long press for tabs
            tabsContainer.querySelectorAll('.editor-tab').forEach((tab, index) => {
                // Prevent text selection
                tab.style.webkitUserSelect = 'none';
                tab.style.userSelect = 'none';
                
                const pathStr = openTabs[index];
                if (pathStr) {
                    initLongPress(tab, (e) => {
                        const touch = e.touches[0];
                        showTabContextMenu({ 
                            preventDefault: () => {}, 
                            stopPropagation: () => {},
                            clientX: touch.clientX,
                            clientY: touch.clientY
                        }, pathStr);
                    });
                }
            });
        }
        
        function switchToTab(pathStr) {
            switchFile(pathStr);
            updateTabs();
        }
        
        function closeTab(event, pathStr) {
            event.stopPropagation();
            openTabs = openTabs.filter(p => p !== pathStr);
            
            // If closing current tab, switch to another
            if (getFullPath(currentPath) === pathStr && openTabs.length > 0) {
                switchFile(openTabs[0]);
            }
            
            updateTabs();
        }
        
        // Override switchFile to update tabs
        const originalSwitchFile = switchFile;
        switchFile = function(pathStr) {
            // Save current file content
            const currentNode = getNodeAtPath(currentPath);
            if (currentNode && currentNode.type === 'file') {
                currentNode.content = editor.getValue();
            }
            
            // Update path
            currentPath = pathStr.split('/').filter(p => p);
            
            // Load new file content
            const newNode = getNodeAtPath(currentPath);
            if (newNode && newNode.type === 'file') {
                editor.setValue(newNode.content || '');
                document.getElementById('currentFileLabel').textContent = pathStr;
            }
            
            updateFileList();
            updateTabs();
        };
        
        // Package Manager
        function togglePackagePanel() {
            const panel = document.getElementById('packagePanel');
            panel.classList.toggle('hidden');
            if (!panel.classList.contains('hidden')) {
                refreshPackages();
            }
        }

        function onPipSourceChange() {
            const source = document.getElementById('pipSource').value;
            const warning = document.getElementById('pipSourceWarning');
            if (source === 'tsinghua') {
                warning.classList.remove('hidden');
            } else {
                warning.classList.add('hidden');
            }
        }

        async function installPackage() {
            if (!pyodide) return;
            
            const packageName = document.getElementById('packageName').value.trim();
            const version = document.getElementById('packageVersion').value.trim();
            
            if (!packageName) {
                showToast(I18N.t('pythonIde.toast.noPackage') || '请输入包名', 'warning');
                return;
            }
            
            // Build package spec with version if provided
            const packageSpec = version ? `${packageName}==${version}` : packageName;
            
            const source = document.getElementById('pipSource').value;
            const installBtn = document.getElementById('installBtn');
            installBtn.disabled = true;
            installBtn.innerHTML = '<span class="loading-spinner" style="width:16px;height:16px;display:inline-block;vertical-align:middle;"></span>';
            
            try {
                await pyodide.loadPackage('micropip');
                
                // Set index URL based on source selection
                let indexUrl = null;
                if (source === 'tsinghua') {
                    indexUrl = 'https://pypi.tuna.tsinghua.edu.cn/simple';
                }
                
                if (indexUrl) {
                    await pyodide.runPythonAsync(`
import micropip
micropip.set_index_urls('${indexUrl}')
await micropip.install('${packageSpec}')
`);
                } else {
                    await pyodide.runPythonAsync(`
import micropip
await micropip.install('${packageSpec}')
`);
                }
                
                showToast(I18N.t('pythonIde.toast.installSuccess')?.replace('{{package}}', packageSpec) || `${packageSpec} 安装成功`, 'success');
                document.getElementById('packageName').value = '';
                document.getElementById('packageVersion').value = '';
                refreshPackages();
            } catch (error) {
                const errorMsg = String(error);
                // Simplified error messages
                if (errorMsg.includes('CORS') || errorMsg.includes('Failed to fetch')) {
                    showToast(I18N.t('pythonIde.packages.corsError') || '安装失败: CORS 限制，请尝试使用默认 PyPI 源', 'error');
                } else if (errorMsg.includes('Could not find') || errorMsg.includes('No package') || errorMsg.includes('not found')) {
                    showToast((I18N.t('pythonIde.packages.packageNotFound') || `安装失败: 未找到包 "${packageName}"，请检查包名是否正确`).replace('{{package}}', packageName), 'error');
                } else if (errorMsg.includes('version')) {
                    showToast((I18N.t('pythonIde.packages.versionError') || `安装失败: 版本 "${version}" 不可用，请检查版本号`).replace('{{version}}', version), 'error');
                } else {
                    // Show simplified error without full traceback
                    const simpleError = errorMsg.split('\n').pop() || errorMsg;
                    showToast((I18N.t('pythonIde.toast.installError') || '安装失败: {{error}}').replace('{{error}}', simpleError.substring(0, 100)), 'error');
                }
            } finally {
                installBtn.disabled = false;
                installBtn.innerHTML = I18N.t('pythonIde.buttons.install') || '安装';
            }
        }

        async function refreshPackages() {
            if (!pyodide) return;
            
            const container = document.getElementById('installedPackages');
            container.innerHTML = '<div class="loading-spinner mx-auto"></div>';
            
            try {
                const packages = await pyodide.runPythonAsync(`
import pkgutil
import sys
modules = [m.name for m in pkgutil.iter_modules()]
'\\n'.join(sorted(modules))
                `);
                
                const packageList = packages.split('\n').filter(p => p);
                installedPackagesList = packageList;
                
                container.innerHTML = packageList.map(pkg => `
                    <div class="flex items-center justify-between px-2 py-1 hover:bg-gray-100 rounded">
                        <span class="font-mono text-xs">${pkg}</span>
                    </div>
                `).join('') || '<div class="text-gray-400 text-center py-4">暂无已安装包</div>';
            } catch (error) {
                container.innerHTML = `<div class="text-red-500 text-center py-4">${I18N.t('pythonIde.toast.packagesLoadFailed') || '加载失败'}</div>`;
            }
        }

        // File Operations
        function addNewFile() {
            let parent = getNodeAtPath(currentPath);
            if (parent.type === 'file') {
                parent = parent.parent;
            }
            addNewFileToFolder(parent);
        }
        
        function addNewFolder() {
            let parent = getNodeAtPath(currentPath);
            if (parent.type === 'file') {
                parent = parent.parent;
            }
            addNewFolderToFolder(parent);
        }
        
        function deleteNode(event, pathStr) {
            event.stopPropagation();
            if (!confirm(I18N.t('pythonIde.fileExplorer.confirmDelete') || '确定要删除吗？')) return;
            
            const path = pathStr.split('/').filter(p => p);
            const node = getNodeAtPath(path);
            if (!node || !node.parent) return;
            
            // Remove from parent
            delete node.parent.children[node.name];
            
            // If deleted current file, switch to main.py
            if (JSON.stringify(path) === JSON.stringify(currentPath)) {
                currentPath = ['main.py'];
                const mainNode = getNodeAtPath(currentPath);
                editor.setValue(mainNode ? mainNode.content : '');
                document.getElementById('currentFileLabel').textContent = 'main.py';
            }
            
            updateFileList();
        }

        // File size formatter
        function formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }
        
        function switchFile(pathStr) {
            // Save current file content
            const currentNode = getNodeAtPath(currentPath);
            if (currentNode && currentNode.type === 'file' && currentNode.fileType === 'text') {
                currentNode.content = editor.getValue();
            }
            
            // Update path
            currentPath = pathStr.split('/').filter(p => p);
            
            // Load new file
            const newNode = getNodeAtPath(currentPath);
            if (!newNode || newNode.type !== 'file') return;
            
            // Check file type and handle accordingly
            const fileType = newNode.fileType || 'text';
            
            if (fileType === 'text') {
                // Text file - show in editor
                editor.setValue(newNode.content || '');
                document.getElementById('currentFileLabel').textContent = pathStr;
                document.querySelector('.CodeMirror').style.display = '';
                document.getElementById('editorLoading').classList.add('hidden');
            } else if (fileType === 'image') {
                // Image - show preview
                showFilePreview(pathStr, `<img src="${newNode.content}" style="max-width:100%;max-height:80vh;" />`);
            } else if (fileType === 'video') {
                // Video - show player
                showFilePreview(pathStr, `<video controls style="max-width:100%;max-height:80vh;"><source src="${newNode.content}"></video>`);
            } else if (fileType === 'audio') {
                // Audio - show player
                showFilePreview(pathStr, `<audio controls style="width:100%;"><source src="${newNode.content}"></audio>`);
            } else if (fileType === 'binary') {
                // Binary - show info
                showFilePreview(pathStr, `
                    <div class="p-8 text-center">
                        <div class="text-6xl mb-4">📦</div>
                        <h3 class="text-xl font-bold mb-2">${newNode.name}</h3>
                        <p class="text-gray-600 mb-4">二进制文件 (${formatFileSize(newNode.size || 0)})</p>
                        <p class="text-gray-500 text-sm">此文件类型不支持在编辑器中查看</p>
                        <button onclick="downloadCurrentFile()" class="mt-4 px-4 py-2 bg-indigo-600 text-white rounded">下载文件</button>
                    </div>
                `);
            }
            
            updateFileList();
            updateTabs();
        }
        
        function showFilePreview(title, contentHtml) {
            // Create modal for non-text files
            const modal = document.createElement('div');
            modal.className = 'file-viewer-modal';
            modal.id = 'fileViewerModal';
            modal.innerHTML = `
                <span class="file-viewer-close" onclick="closeFilePreview()">&times;</span>
                <div class="file-viewer-content">
                    <div class="p-4 border-b border-gray-200 flex items-center justify-between">
                        <h3 class="font-semibold">${title}</h3>
                        <button onclick="closeFilePreview()" class="text-gray-500 hover:text-gray-700">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                    <div class="p-4">${contentHtml}</div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        
        function closeFilePreview() {
            const modal = document.getElementById('fileViewerModal');
            if (modal) modal.remove();
        }
        
        function downloadCurrentFile() {
            const node = getNodeAtPath(currentPath);
            if (!node || !node.blob) return;
            
            const url = URL.createObjectURL(node.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = node.name;
            a.click();
            URL.revokeObjectURL(url);
        }

        // Render file tree recursively
        // Store expanded folder states
        const expandedFolders = new Set(['root']);
        let draggedItemPath = null;
        
        function getFileIcon(fileType, name) {
            if (name.endsWith('.py')) return '🐍';
            switch (fileType) {
                case 'image': return '🖼️';
                case 'video': return '🎬';
                case 'audio': return '🎵';
                case 'binary': return '📦';
                default: return name.endsWith('.md') ? '📝' : '📄';
            }
        }
        
        function renderFileTree(node, path = [], depth = 0) {
            const pathStr = getFullPath(path);
            
            if (node.type === 'file') {
                const isActive = JSON.stringify(path) === JSON.stringify(currentPath);
                const fullPath = getFullPath(path);
                const fileType = node.fileType || 'text';
                const icon = getFileIcon(fileType, node.name);
                return `
                    <div class="file-tree-item file-tree-file px-2 py-1.5 rounded text-sm cursor-pointer flex items-center gap-1.5 ${isActive ? 'active' : ''}"
                         data-path="${fullPath}"
                         style="padding-left: ${depth * 16 + 8}px"
                         onclick="if(!isLongPress) switchFile('${fullPath}')"
                         draggable="true"
                         ondragstart="handleFileDragStart(event, '${fullPath}')"
                         ondragend="handleFileDragEnd(event)"
                         ondrop="handleFileDrop(event, '${fullPath}')"
                         ondragover="handleFileItemDragOver(event)"
                         ondragleave="handleFileItemDragLeave(event)"
                         oncontextmenu="showContextMenu(event, '${fullPath}', 'file')">
                        <span>${icon}</span>
                        <span class="file-name flex-1 truncate">${node.name}</span>
                        <span class="file-actions flex items-center gap-1">
                            <span class="text-xs text-gray-400 hover:text-blue-500 p-1" onclick="downloadFile(event, '${fullPath}')" data-i18n-title="pythonIde.fileExplorer.download">⬇️</span>
                            <span class="text-xs text-gray-400 hover:text-red-500 p-1" onclick="deleteNode(event, '${fullPath}')" data-i18n-title="pythonIde.fileExplorer.delete">×</span>
                        </span>
                    </div>
                `;
            }
            
            // Folder
            let html = '';
            const fullPath = getFullPath(path);
            const isExpanded = expandedFolders.has(fullPath);
            
            // Don't render root folder header
            if (depth > 0) {
                const hasChildren = Object.keys(node.children || {}).length > 0;
                const toggleIcon = hasChildren ? (isExpanded ? '▼' : '▶') : ' ';
                const folderIcon = isExpanded ? '📂' : '📁';
                
                html += `
                    <div class="file-tree-item file-tree-folder px-2 py-1.5 rounded text-sm cursor-pointer flex items-center gap-1.5 text-gray-700 hover:bg-gray-100"
                         data-path="${fullPath}"
                         style="padding-left: ${(depth - 1) * 16 + 8}px"
                         draggable="true"
                         ondragstart="handleFileDragStart(event, '${fullPath}')"
                         ondragend="handleFileDragEnd(event)"
                         ondrop="handleFileDrop(event, '${fullPath}')"
                         ondragover="handleFileItemDragOver(event)"
                         ondragleave="handleFileItemDragLeave(event)"
                         oncontextmenu="showContextMenu(event, '${fullPath}', 'folder')">
                        <span class="file-tree-toggle" onclick="event.stopPropagation(); toggleFolder('${fullPath}')">${toggleIcon}</span>
                        <span onclick="event.stopPropagation(); toggleFolder('${fullPath}')">${folderIcon}</span>
                        <span class="file-name flex-1 truncate font-medium" onclick="event.stopPropagation(); toggleFolder('${fullPath}')">${node.name}</span>
                        <span class="file-actions flex items-center gap-1">
                            <span class="text-xs text-gray-400 hover:text-blue-500 p-1" onclick="downloadFolder(event, '${fullPath}')" data-i18n-title="pythonIde.fileExplorer.download">⬇️</span>
                            <span class="text-xs text-gray-400 hover:text-red-500 p-1" onclick="deleteNode(event, '${fullPath}')" data-i18n-title="pythonIde.fileExplorer.delete">×</span>
                        </span>
                    </div>
                `;
            }
            
            // Render children if expanded
            if (isExpanded || depth === 0) {
                const children = Object.values(node.children || {}).sort((a, b) => {
                    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
                    return a.name.localeCompare(b.name);
                });
                
                for (const child of children) {
                    const childPath = [...path, child.name];
                    html += renderFileTree(child, childPath, depth + 1);
                }
            }
            
            return html;
        }
        
        function toggleFolder(pathStr) {
            if (expandedFolders.has(pathStr)) {
                expandedFolders.delete(pathStr);
            } else {
                expandedFolders.add(pathStr);
            }
            updateFileList();
        }
        
        // Download single file
        function downloadFile(event, pathStr) {
            event.stopPropagation();
            const node = getNodeAtPath(pathStr.split('/').filter(p => p));
            if (!node || node.type !== 'file') return;
            
            if (node.fileType === 'image' && node.content) {
                const a = document.createElement('a');
                a.href = node.content;
                a.download = node.name;
                a.click();
            } else if (node.fileType === 'video' || node.fileType === 'audio') {
                const a = document.createElement('a');
                a.href = node.content;
                a.download = node.name;
                a.click();
            } else if (node.blob) {
                const url = URL.createObjectURL(node.blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = node.name;
                a.click();
                URL.revokeObjectURL(url);
            } else if (node.content !== null) {
                const blob = new Blob([node.content], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = node.name;
                a.click();
                URL.revokeObjectURL(url);
            }
            
            showToast((I18N.t('pythonIde.toast.fileDownloaded') || `已下载: ${node.name}`).replace('{{name}}', node.name), 'success');
        }
        
        // Download folder as ZIP
        async function downloadFolder(event, pathStr) {
            event.stopPropagation();
            const node = getNodeAtPath(pathStr.split('/').filter(p => p));
            if (!node || node.type !== 'folder') return;
            
            try {
                const JSZip = await loadJSZip();
                const zip = new JSZip();
                
                function addFolderToZip(folderNode, zipFolder) {
                    for (const [name, child] of Object.entries(folderNode.children || {})) {
                        if (child.type === 'file') {
                            if (child.blob) {
                                zipFolder.file(name, child.blob);
                            } else if (child.content !== null) {
                                zipFolder.file(name, child.content);
                            }
                        } else {
                            const subFolder = zipFolder.folder(name);
                            addFolderToZip(child, subFolder);
                        }
                    }
                }
                
                addFolderToZip(node, zip);
                
                const blob = await zip.generateAsync({ type: 'blob' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${node.name}.zip`;
                a.click();
                URL.revokeObjectURL(url);
                
                showToast((I18N.t('pythonIde.toast.folderDownloaded') || `文件夹已下载: ${node.name}.zip`).replace('{{name}}', node.name), 'success');
            } catch (error) {
                showToast((I18N.t('pythonIde.toast.downloadFailed') || '下载失败: {{error}}').replace('{{error}}', error.message), 'error');
            }
        }
        
        // File drag and drop handlers
        function handleFileDragStart(e, pathStr) {
            draggedItemPath = pathStr;
            e.dataTransfer.effectAllowed = 'move';
            e.target.style.opacity = '0.5';
        }
        
        function handleFileDragEnd(e) {
            e.target.style.opacity = '';
            draggedItemPath = null;
            document.querySelectorAll('.file-tree-item').forEach(el => {
                el.classList.remove('drag-over');
            });
        }
        
        function handleFileItemDragOver(e) {
            e.preventDefault();
            e.stopPropagation();
            const item = e.currentTarget;
            if (draggedItemPath && item !== e.target) {
                item.classList.add('drag-over');
            }
        }
        
        function handleFileItemDragLeave(e) {
            e.preventDefault();
            e.stopPropagation();
            e.currentTarget.classList.remove('drag-over');
        }
        
        function handleFileDrop(e, targetPathStr) {
            e.preventDefault();
            e.stopPropagation();
            e.currentTarget.classList.remove('drag-over');
            
            if (!draggedItemPath || draggedItemPath === targetPathStr) return;
            
            const sourcePath = draggedItemPath.split('/').filter(p => p);
            const targetPath = targetPathStr.split('/').filter(p => p);
            
            const sourceNode = getNodeAtPath(sourcePath);
            const targetNode = getNodeAtPath(targetPath);
            
            if (!sourceNode || !targetNode) return;
            if (targetNode.type !== 'folder') return;
            
            // Check for cycle
            let checkNode = targetNode;
            while (checkNode) {
                if (checkNode === sourceNode) {
                    showToast(I18N.t('pythonIde.toast.moveToSubfolderError') || '不能将文件夹移动到其子文件夹中', 'error');
                    return;
                }
                checkNode = checkNode.parent;
            }
            
            const nodeName = sourceNode.name;
            if (targetNode.children[nodeName]) {
                    showToast(I18N.t('pythonIde.toast.duplicateName') || '目标位置已存在同名文件/文件夹', 'error');
                return;
            }
            
            // Move node
            delete sourceNode.parent.children[nodeName];
            targetNode.children[nodeName] = sourceNode;
            sourceNode.parent = targetNode;
            
            if (JSON.stringify(sourcePath) === JSON.stringify(currentPath)) {
                currentPath = [...targetPath, nodeName];
            }
            
            updateFileList();
            showToast(I18N.t('pythonIde.toast.moveSuccess') || '移动成功', 'success');
        }
        
function updateFileList() {
            const container = document.getElementById('fileList');
            container.innerHTML = renderFileTree(fileSystem);
            
            // Initialize long press for mobile
            container.querySelectorAll('.file-tree-item').forEach(item => {
                // Prevent text selection
                item.style.webkitUserSelect = 'none';
                item.style.userSelect = 'none';
                
                const path = item.dataset.path;
                const type = item.classList.contains('file-tree-folder') ? 'folder' : 'file';
                initLongPress(item, (e) => {
                    const touch = e.touches[0];
                    showContextMenu({ 
                        preventDefault: () => {}, 
                        stopPropagation: () => {},
                        clientX: touch.clientX,
                        clientY: touch.clientY
                    }, path, type);
                });
            });
        }

        // Flatten file system for JSON export
        function flattenFileSystem(node, path = '', result = {}) {
            if (node.type === 'file') {
                result[path || node.name] = node.content;
            } else {
                for (const [name, child] of Object.entries(node.children || {})) {
                    const childPath = path ? `${path}/${name}` : name;
                    flattenFileSystem(child, childPath, result);
                }
            }
            return result;
        }
        
        // Save Project (JSON format)
        function saveProject() {
            // Save current file
            const currentNode = getNodeAtPath(currentPath);
            if (currentNode && currentNode.type === 'file') {
                currentNode.content = editor.getValue();
            }
            
            const project = {
                version: '2.1',
                mode: currentMode,
                fileSystem: flattenFileSystem(fileSystem),
                currentPath: currentPath,
                notebookCells: currentMode === 'notebook' ? notebookCells.map(cell => ({
                    type: cell.type,
                    content: document.getElementById(`${cell.id}-input`)?.value || ''
                })) : [],
                packages: installedPackagesList,  // 添加已安装包列表
                timestamp: new Date().toISOString()
            };
            
            const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'python-project.json';
            a.click();
            URL.revokeObjectURL(url);
            
            showToast(I18N.t('pythonIde.toast.saved') || '项目已保存', 'success');
        }
        
        async function exportPythonProject() {
            // Save current file
            const currentNode = getNodeAtPath(currentPath);
            if (currentNode && currentNode.type === 'file') {
                currentNode.content = editor.getValue();
            }
            
            try {
                const JSZip = await loadJSZip();
                const zip = new JSZip();
                
                // Add all files to zip
                function addFilesToZip(node, path = '') {
                    if (node.type === 'file') {
                        zip.file(path || node.name, node.content);
                    } else {
                        for (const [name, child] of Object.entries(node.children || {})) {
                            const childPath = path ? `${path}/${name}` : name;
                            addFilesToZip(child, childPath);
                        }
                    }
                }
                
                addFilesToZip(fileSystem);
                
                // Add requirements.txt with installed packages
                const requirements = installedPackagesList.length > 0 
                    ? installedPackagesList.join('\n')
                    : '# No additional packages installed\n# Add your requirements here, e.g.:\n# numpy\n# pandas';
                zip.file('requirements.txt', requirements);
                
                // Add README with package info
                const readme = `# Python Project

## Installed Packages
${installedPackagesList.length > 0 ? installedPackagesList.map(p => `- ${p}`).join('\n') : 'None'}

## Install Dependencies
\`\`\`bash
pip install -r requirements.txt
\`\`\`

Exported from Python IDE on ${new Date().toLocaleString()}
`;
                zip.file('README.md', readme);
                
                const blob = await zip.generateAsync({ type: 'blob' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'python-project.zip';
                a.click();
                URL.revokeObjectURL(url);
                
                showToast(I18N.t('pythonIde.toast.exportSuccess') || 'Python 项目已导出为 ZIP（包含 requirements.txt）', 'success');
            } catch (error) {
                showToast((I18N.t('pythonIde.toast.exportFailed') || '导出失败: {{error}}').replace('{{error}}', error.message), 'error');
            }
        }
        
        // Load JSZip library
        function loadJSZip() {
            return new Promise((resolve, reject) => {
                if (window.JSZip) {
                    resolve(window.JSZip);
                    return;
                }
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
                script.onload = () => resolve(window.JSZip);
                script.onerror = () => reject(new Error('Failed to load JSZip'));
                document.head.appendChild(script);
            });
        }

        // Load Project
        async function loadProject(input) {
            const file = input.files[0];
            if (!file) return;
            
            // Cleanup existing notebook CodeMirror instances
            Object.values(notebookCellEditors).forEach(cm => cm.to());
            Object.keys(notebookCellEditors).forEach(key => delete notebookCellEditors[key]);
            
            try {
                if (file.name.endsWith('.zip')) {
                    // Load ZIP file
                    await loadZipProject(file);
                } else {
                    // Load text files
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        handleLoadedText(file.name, e.target.result);
                    };
                    reader.readAsText(file);
                }
            } catch (error) {
                showToast(I18N.t('pythonIde.toast.loadError') || '加载失败', 'error');
                console.error(error);
            }
            
            input.value = '';
        }
        
        function handleLoadedText(filename, content) {
            if (filename.endsWith('.py')) {
                // Single Python file
                fileSystem = {
                    name: 'root',
                    type: 'folder',
                    children: {
                        [filename]: { name: filename, type: 'file', content: content, parent: null }
                    },
                    parent: null
                };
                fileSystem.children[filename].parent = fileSystem;
                currentPath = [filename];
                switchMode('ide');
                updateFileList();
                const node = getNodeAtPath(currentPath);
                editor.setValue(node ? node.content : '');
                document.getElementById('currentFileLabel').textContent = filename;
                showToast(I18N.t('pythonIde.toast.loaded') || '文件已加载', 'success');
            } else if (filename.endsWith('.ipynb')) {
                // Jupyter Notebook
                const notebook = JSON.parse(content);
                notebookCells = [];
                document.getElementById('notebookCells').innerHTML = '';
                
                notebook.cells?.forEach(cell => {
                    const cellType = cell.cell_type;
                    const cellContent = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
                    addNotebookCell(cellType, cellContent);
                });
                
                switchMode('notebook');
                showToast(I18N.t('pythonIde.toast.loaded') || 'Notebook 已加载', 'success');
            } else {
                // Project JSON
                const project = JSON.parse(content);
                
                // Rebuild file system from flat structure
                if (project.fileSystem || project.files) {
                    const flatFiles = project.fileSystem || project.files;
                    fileSystem = { name: 'root', type: 'folder', children: {}, parent: null };
                    
                    for (const [path, content] of Object.entries(flatFiles)) {
                        createFileFromPath(path, content);
                    }
                    
                    currentPath = project.currentPath || ['main.py'];
                    if (!getNodeAtPath(currentPath)) {
                        currentPath = Object.keys(fileSystem.children)[0] ? [Object.keys(fileSystem.children)[0]] : ['main.py'];
                    }
                    updateFileList();
                }
                
                if (project.mode === 'notebook' && project.notebookCells) {
                    notebookCells = [];
                    document.getElementById('notebookCells').innerHTML = '';
                    project.notebookCells.forEach(cell => {
                        addNotebookCell(cell.type, cell.content);
                    });
                }
                
                // Restore packages info
                if (project.packages && Array.isArray(project.packages)) {
                    installedPackagesList = project.packages;
                }
                
                switchMode(project.mode || 'ide');
                const node = getNodeAtPath(currentPath);
                if (editor && node && node.type === 'file') {
                    editor.setValue(node.content || '');
                }
                document.getElementById('currentFileLabel').textContent = getFullPath(currentPath);
                
                showToast(I18N.t('pythonIde.toast.loaded') || '项目已加载' + (project.packages ? `（含 ${project.packages.length} 个包）` : ''), 'success');
            }
        }
        
        // Create file from path string (e.g., "folder/subfolder/file.py")
        function createFileFromPath(path, content) {
            const parts = path.split('/').filter(p => p);
            let current = fileSystem;
            
            for (let i = 0; i < parts.length; i++) {
                const name = parts[i];
                const isLast = i === parts.length - 1;
                
                if (isLast) {
                    // Create file
                    current.children[name] = {
                        name: name,
                        type: 'file',
                        content: content,
                        parent: current
                    };
                } else {
                    // Create folder if not exists
                    if (!current.children[name]) {
                        current.children[name] = {
                            name: name,
                            type: 'folder',
                            children: {},
                            parent: current
                        };
                    }
                    current = current.children[name];
                }
            }
        }
        
        // Load ZIP project
        async function loadZipProject(file) {
            const JSZip = await loadJSZip();
            const zip = await JSZip.loadAsync(file);
            
            fileSystem = { name: 'root', type: 'folder', children: {}, parent: null };
            
            // Extract all files from zip
            const promises = [];
            zip.forEach((path, zipEntry) => {
                if (!zipEntry.dir) {
                    promises.push(
                        zipEntry.async('string').then(content => {
                            createFileFromPath(path, content);
                        })
                    );
                }
            });
            
            await Promise.all(promises);
            
            // Find first Python file or any file
            const firstFile = findFirstFile(fileSystem);
            currentPath = firstFile || ['main.py'];
            
            updateFileList();
            const node = getNodeAtPath(currentPath);
            if (editor && node && node.type === 'file') {
                editor.setValue(node.content || '');
            }
            document.getElementById('currentFileLabel').textContent = getFullPath(currentPath);
            
                showToast(I18N.t('pythonIde.toast.zipLoaded') || 'ZIP 项目已加载', 'success');
        }
        
        // Find first file in file system
        function findFirstFile(node, path = []) {
            if (node.type === 'file') return path;
            
            for (const [name, child] of Object.entries(node.children || {})) {
                const result = findFirstFile(child, [...path, name]);
                if (result) return result;
            }
            return null;
        }

        // Toast
        function showToast(message, type = 'info') {
            const container = document.getElementById('toastContainer');
            const toast = document.createElement('div');
            
            const colors = {
                success: 'bg-green-500',
                error: 'bg-red-500',
                warning: 'bg-yellow-500',
                info: 'bg-blue-500'
            };
            
            toast.className = `toast ${colors[type] || colors.info} text-white px-4 py-2 rounded shadow-lg text-sm`;
            toast.textContent = message;
            container.appendChild(toast);
            
            setTimeout(() => toast.remove(), 3000);
        }

        // Utility
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Handle file upload from input
        // File type detection
        function getFileType(filename) {
            const ext = filename.split('.').pop().toLowerCase();
            const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
            const videoExts = ['mp4', 'webm', 'ogg', 'mov'];
            const audioExts = ['mp3', 'wav', 'ogg', 'm4a'];
            const textExts = ['py', 'txt', 'md', 'json', 'html', 'css', 'js', 'xml', 'yaml', 'yml', 'ini', 'conf', 'log'];
            
            if (imageExts.includes(ext)) return 'image';
            if (videoExts.includes(ext)) return 'video';
            if (audioExts.includes(ext)) return 'audio';
            if (textExts.includes(ext)) return 'text';
            return 'binary';
        }
        
        function handleFileUpload(input) {
            const files = Array.from(input.files);
            if (files.length === 0) return;
            
            // Get target folder (current file's parent or current folder)
            let targetFolder = getNodeAtPath(currentPath);
            if (targetFolder.type === 'file') {
                targetFolder = targetFolder.parent;
            }
            
            files.forEach(file => {
                const name = file.name;
                const fileType = getFileType(name);
                
                if (targetFolder.children[name]) {
                    showToast((I18N.t('pythonIde.toast.fileSkipped') || `文件 ${name} 已存在，已跳过`).replace('{{name}}', name), 'warning');
                    return;
                }
                
                if (fileType === 'text') {
                    // Text files - read as text
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        targetFolder.children[name] = {
                            name: name,
                            type: 'file',
                            content: e.target.result,
                            fileType: 'text',
                            parent: targetFolder
                        };
                        updateFileList();
                        showToast((I18N.t('pythonIde.toast.fileUploaded') || `文件 ${name} 已上传`).replace('{{name}}', name), 'success');
                    };
                    reader.readAsText(file);
                } else if (fileType === 'image') {
                    // Images - read as data URL for preview
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        targetFolder.children[name] = {
                            name: name,
                            type: 'file',
                            content: e.target.result,
                            fileType: 'image',
                            parent: targetFolder
                        };
                        updateFileList();
                        showToast((I18N.t('pythonIde.toast.imageUploaded') || `图片 ${name} 已上传`).replace('{{name}}', name), 'success');
                    };
                    reader.readAsDataURL(file);
                } else if (fileType === 'video' || fileType === 'audio') {
                    // Video/Audio - create blob URL
                    const blobUrl = URL.createObjectURL(file);
                    targetFolder.children[name] = {
                        name: name,
                        type: 'file',
                        content: blobUrl,
                        fileType: fileType,
                        blob: file,
                        parent: targetFolder
                    };
                    updateFileList();
                    const typeName = fileType === 'video' ? (I18N.t('pythonIde.fileTypes.video') || '视频') : (I18N.t('pythonIde.fileTypes.audio') || '音频');
                    showToast((I18N.t('pythonIde.toast.mediaUploaded') || `${typeName} {{name}} 已上传`).replace('{{name}}', name), 'success');
                } else {
                    // Binary files - store metadata
                    targetFolder.children[name] = {
                        name: name,
                        type: 'file',
                        content: null,
                        fileType: 'binary',
                        size: file.size,
                        blob: file,
                        parent: targetFolder
                    };
                    updateFileList();
                    showToast((I18N.t('pythonIde.toast.fileUploadedWithSize') || `文件 {{name}} 已上传 ({{size}})`).replace('{{name}}', name).replace('{{size}}', formatFileSize(file.size)), 'success');
                }
            });
            
            input.value = '';
        }
        
        // Tree drop zone handlers
        function handleTreeDrop(e) {
            e.preventDefault();
            e.stopPropagation();
            document.getElementById('fileTreeContainer').classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                // Process files using same logic as handleFileUpload
                const fakeInput = { files: files };
                handleFileUpload(fakeInput);
            }
        }
        
        function handleTreeDragOver(e) {
            e.preventDefault();
            e.stopPropagation();
            document.getElementById('fileTreeContainer').classList.add('drag-over');
        }
        
        function handleTreeDragLeave(e) {
            e.preventDefault();
            e.stopPropagation();
            document.getElementById('fileTreeContainer').classList.remove('drag-over');
        }
        
        // File drag within tree (for reordering/moving)
        let draggedPath = null;
        
        function handleFileDragStart(e, pathStr) {
            draggedPath = pathStr;
            e.dataTransfer.effectAllowed = 'move';
        }
        
        function handleFileDrop(e, targetPathStr) {
            e.preventDefault();
            e.stopPropagation();
            if (!draggedPath || draggedPath === targetPathStr) return;
            
            // For now, just show a toast - full move functionality can be added later
            showToast(I18N.t('pythonIde.toast.moveInDevelopment') || '文件移动功能开发中', 'info');
            draggedPath = null;
        }
        
        function handleFileDragOver(e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        function handleFileDragLeave(e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        // Global drag and drop (fallback)
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        document.addEventListener('drop', (e) => {
            // Only handle if dropped outside file tree
            if (!e.target.closest('#fileTreeContainer')) {
                e.preventDefault();
            }
        });

        // Context Menu Functions
        function showContextMenu(e, pathStr, type) {
            e.preventDefault();
            e.stopPropagation();
            
            contextMenuTarget = { path: pathStr.split('/').filter(p => p), type };
            
            const menu = document.getElementById('contextMenu');
            const newFileItem = menu.querySelector('[data-action="newFile"]');
            const newFolderItem = menu.querySelector('[data-action="newFolder"]');
            
            // 只有文件夹才显示新建选项
            if (type === 'folder') {
                newFileItem.style.display = 'flex';
                newFolderItem.style.display = 'flex';
            } else {
                newFileItem.style.display = 'none';
                newFolderItem.style.display = 'none';
            }
            
            // 定位菜单
            const x = Math.min(e.clientX, window.innerWidth - 180);
            const y = Math.min(e.clientY, window.innerHeight - 200);
            menu.style.left = x + 'px';
            menu.style.top = y + 'px';
            menu.classList.remove('hidden');
        }

        function hideContextMenu() {
            document.getElementById('contextMenu').classList.add('hidden');
            contextMenuTarget = null;
        }

        function handleContextMenuAction(action) {
            if (!contextMenuTarget) return;
            
            const pathStr = contextMenuTarget.path.join('/');
            const node = getNodeAtPath(contextMenuTarget.path);
            
            switch (action) {
                case 'newFile':
                    if (node && node.type === 'folder') {
                        addNewFileToFolder(node);
                    }
                    break;
                case 'newFolder':
                    if (node && node.type === 'folder') {
                        addNewFolderToFolder(node);
                    }
                    break;
                case 'rename':
                    startRename(contextMenuTarget.path, contextMenuTarget.type);
                    break;
                case 'download':
                    if (contextMenuTarget.type === 'file') {
                        downloadFile({ stopPropagation: () => {} }, pathStr);
                    } else {
                        downloadFolder({ stopPropagation: () => {} }, pathStr);
                    }
                    break;
                case 'delete':
                    deleteNode({ stopPropagation: () => {} }, pathStr);
                    break;
            }
            hideContextMenu();
        }

        // Add new file to specific folder
        async function addNewFileToFolder(folderNode) {
            const name = await showCustomModal(
                I18N.t('pythonIde.fileExplorer.prompt') || '请输入文件名',
                'new_file.py',
                'new_file.py'
            );
            if (!name) return;
            
            if (folderNode.children[name]) {
                showToast(I18N.t('pythonIde.fileExplorer.fileExists') || '文件/文件夹已存在', 'warning');
                return;
            }
            
            const fileType = getFileType(name);
            folderNode.children[name] = {
                name: name,
                type: 'file',
                fileType: fileType === 'binary' ? 'text' : fileType,
                content: '',
                parent: folderNode
            };
            
            // 自动展开父文件夹
            const folderPath = [];
            let p = folderNode;
            while (p.parent) {
                folderPath.unshift(p.name);
                p = p.parent;
            }
            expandedFolders.add(folderPath.join('/'));
            
            updateFileList();
            
            // 切换到新文件
            const newPath = [...folderPath, name];
            switchFile(getFullPath(newPath));
        }

        // Add new folder to specific folder
        async function addNewFolderToFolder(folderNode) {
            const name = await showCustomModal(
                I18N.t('pythonIde.fileExplorer.folderPrompt') || '请输入文件夹名',
                'newfolder',
                'newfolder'
            );
            if (!name) return;
            
            if (folderNode.children[name]) {
                showToast(I18N.t('pythonIde.fileExplorer.fileExists') || '文件/文件夹已存在', 'warning');
                return;
            }
            
            folderNode.children[name] = {
                name: name,
                type: 'folder',
                children: {},
                parent: folderNode
            };
            
            // 自动展开父文件夹
            const folderPath = [];
            let p = folderNode;
            while (p.parent) {
                folderPath.unshift(p.name);
                p = p.parent;
            }
            expandedFolders.add(folderPath.join('/'));
            
            updateFileList();
            showToast(I18N.t('pythonIde.fileExplorer.folderCreated') || '文件夹已创建', 'success');
        }

        // Rename functionality
        function startRename(path, type) {
            const node = getNodeAtPath(path);
            if (!node) return;
            
            const pathStr = path.join('/');
            const element = document.querySelector(`[data-path="${pathStr}"]`);
            if (!element) return;
            
            const nameSpan = element.querySelector('.file-name');
            if (!nameSpan) return;
            
            const oldName = node.name;
            const input = document.createElement('input');
            input.type = 'text';
            input.value = oldName;
            input.className = 'rename-input';
            
            nameSpan.innerHTML = '';
            nameSpan.appendChild(input);
            input.focus();
            input.select();
            
            function finishRename() {
                const newName = input.value.trim();
                if (newName && newName !== oldName) {
                    if (node.parent.children[newName]) {
                        showToast(I18N.t('pythonIde.fileExplorer.fileExists') || '文件/文件夹已存在', 'warning');
                        nameSpan.textContent = oldName;
                    } else {
                        // 更新节点
                        delete node.parent.children[oldName];
                        node.name = newName;
                        node.parent.children[newName] = node;
                        
                        // 更新当前路径（如果是当前打开的文件）
                        if (JSON.stringify(currentPath) === JSON.stringify(path)) {
                            currentPath = [...path.slice(0, -1), newName];
                            document.getElementById('currentFileLabel').textContent = getFullPath(currentPath);
                        }
                        
                        showToast(I18N.t('pythonIde.toast.renamed') || '重命名成功', 'success');
                        updateFileList();
                    }
                } else {
                    nameSpan.textContent = oldName;
                }
            }
            
            input.addEventListener('blur', finishRename);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    input.blur();
                } else if (e.key === 'Escape') {
                    input.value = oldName;
                    input.blur();
                }
            });
        }

function initLongPress(element, callback) {
            // Prevent text selection on this element
            element.style.webkitUserSelect = 'none';
            element.style.userSelect = 'none';
            element.style.webkitTouchCallout = 'none';
            
            let timer;
            let startX, startY;
            let isPressed = false;
            
            const startHandler = (e) => {
                isPressed = true;
                isLongPress = false;
                if (e.type === 'touchstart') {
                    startX = e.touches[0].clientX;
                    startY = e.touches[0].clientY;
                }
                
                // Prevent text selection
                if (e.preventDefault) e.preventDefault();
                
                timer = setTimeout(() => {
                    if (isPressed) {
                        isLongPress = true;
                        element.classList.add('long-press-active');
                        
                        // Haptic feedback if available
                        if (navigator.vibrate) {
                            navigator.vibrate(50);
                        }
                        
                        callback(e);
                        setTimeout(() => {
                            element.classList.remove('long-press-active');
                        }, 200);
                    }
                }, 500);
            };
            
            const endHandler = (e) => {
                isPressed = false;
                clearTimeout(timer);
                element.classList.remove('long-press-active');
            };
            
            const moveHandler = (e) => {
                if (e.type === 'touchmove') {
                    const moveX = e.touches[0].clientX;
                    const moveY = e.touches[0].clientY;
                    if (Math.abs(moveX - startX) > 10 || Math.abs(moveY - startY) > 10) {
                        clearTimeout(timer);
                        isPressed = false;
                        element.classList.remove('long-press-active');
                    }
                }
            };
            
            element.addEventListener('touchstart', startHandler, { passive: false });
            element.addEventListener('touchend', endHandler, { passive: true });
            element.addEventListener('touchmove', moveHandler, { passive: true });
            element.addEventListener('touchcancel', endHandler, { passive: true });
            
            // Mouse support for testing
            element.addEventListener('mousedown', startHandler);
            element.addEventListener('mouseup', endHandler);
            element.addEventListener('mouseleave', endHandler);
            
            // Prevent context menu on long press
            element.addEventListener('contextmenu', (e) => {
                if (isLongPress) {
                    e.preventDefault();
                }
            });
        }
        
        // Show editor context menu
        function showEditorContextMenu(e) {
            e.preventDefault();
            e.stopPropagation();
            activeContextMenu = 'editor';
            
            const menu = document.getElementById('editorContextMenu');
            const x = Math.min(e.clientX, window.innerWidth - 200);
            const y = Math.min(e.clientY, window.innerHeight - 300);
            menu.style.left = x + 'px';
            menu.style.top = y + 'px';
            menu.classList.remove('hidden');
            hideOtherContextMenus('editorContextMenu');
        }

        // Show tab context menu
        function showTabContextMenu(e, pathStr) {
            e.preventDefault();
            e.stopPropagation();
            activeContextMenu = 'tab';
            tabContextMenuTarget = pathStr;
            
            const menu = document.getElementById('tabContextMenu');
            const x = Math.min(e.clientX, window.innerWidth - 180);
            const y = Math.min(e.clientY, window.innerHeight - 200);
            menu.style.left = x + 'px';
            menu.style.top = y + 'px';
            menu.classList.remove('hidden');
            hideOtherContextMenus('tabContextMenu');
        }

        // Show output context menu
        function showOutputContextMenu(e) {
            e.preventDefault();
            e.stopPropagation();
            activeContextMenu = 'output';
            
            const menu = document.getElementById('outputContextMenu');
            const x = Math.min(e.clientX, window.innerWidth - 170);
            const y = Math.min(e.clientY, window.innerHeight - 150);
            menu.style.left = x + 'px';
            menu.style.top = y + 'px';
            menu.classList.remove('hidden');
            hideOtherContextMenus('outputContextMenu');
        }

        // Show empty area context menu
        function showEmptyContextMenu(e) {
            e.preventDefault();
            e.stopPropagation();
            activeContextMenu = 'empty';
            
            const menu = document.getElementById('emptyContextMenu');
            const x = Math.min(e.clientX, window.innerWidth - 170);
            const y = Math.min(e.clientY, window.innerHeight - 200);
            menu.style.left = x + 'px';
            menu.style.top = y + 'px';
            menu.classList.remove('hidden');
            hideOtherContextMenus('emptyContextMenu');
        }

        // Hide all context menus
        function hideAllContextMenus() {
            document.querySelectorAll('.context-menu').forEach(menu => {
                menu.classList.add('hidden');
            });
            activeContextMenu = null;
            contextMenuTarget = null;
            tabContextMenuTarget = null;
        }

        // Hide other context menus except specified
        function hideOtherContextMenus(exceptId) {
            document.querySelectorAll('.context-menu').forEach(menu => {
                if (menu.id !== exceptId) {
                    menu.classList.add('hidden');
                }
            });
        }

        // Handle editor context menu actions
        function handleEditorContextMenuAction(action) {
            if (!editor) return;
            
            const doc = editor.getDoc();
            
            switch (action) {
                case 'undo':
                    editor.undo();
                    break;
                case 'redo':
                    editor.redo();
                    break;
                case 'cut':
                    if (doc.somethingSelected()) {
                        const selected = doc.getSelection();
                        navigator.clipboard.writeText(selected);
                        doc.replaceSelection('');
                    }
                    break;
                case 'copy':
                    if (doc.somethingSelected()) {
                        const selected = doc.getSelection();
                        navigator.clipboard.writeText(selected);
                    }
                    break;
                case 'paste':
                    navigator.clipboard.readText().then(text => {
                        doc.replaceSelection(text);
                    }).catch(() => {
                        showToast(I18N.t('pythonIde.toast.clipboardError') || '无法访问剪贴板', 'error');
                    });
                    break;
                case 'selectAll':
                    editor.execCommand('selectAll');
                    break;
                case 'format':
                    formatPythonCode();
                    break;
                case 'find':
                    editor.execCommand('find');
                    break;
                case 'replace':
                    editor.execCommand('replace');
                    break;
            }
            hideAllContextMenus();
        }

        // Format Python code (basic)
        function formatPythonCode() {
            const code = editor.getValue();
            // Simple formatting: normalize line endings and trailing whitespace
            const formatted = code
                .replace(/\r\n/g, '\n')
                .replace(/[ \t]+$/gm, '')
                .replace(/\n{3,}/g, '\n\n');
            
            if (formatted !== code) {
                const cursor = editor.getCursor();
                editor.setValue(formatted);
                editor.setCursor(cursor);
                showToast(I18N.t('pythonIde.toast.formatted') || '代码已格式化', 'success');
            } else {
                showToast(I18N.t('pythonIde.toast.alreadyFormatted') || '代码已经是格式化状态', 'info');
            }
        }

        // Handle tab context menu actions
        function handleTabContextMenuAction(action) {
            if (!tabContextMenuTarget) return;
            
            switch (action) {
                case 'closeTab':
                    closeTab({ stopPropagation: () => {} }, tabContextMenuTarget);
                    break;
                case 'closeOtherTabs':
                    openTabs = [tabContextMenuTarget];
                    switchToTab(tabContextMenuTarget);
                    updateTabs();
                    break;
                case 'closeTabsToRight':
                    const currentIndex = openTabs.indexOf(tabContextMenuTarget);
                    if (currentIndex !== -1) {
                        openTabs = openTabs.slice(0, currentIndex + 1);
                        updateTabs();
                    }
                    break;
                case 'copyPath':
                    navigator.clipboard.writeText(tabContextMenuTarget).then(() => {
                        showToast(I18N.t('pythonIde.toast.pathCopied') || '路径已复制', 'success');
                    });
                    break;
                case 'revealInExplorer':
                    // Expand folders to show the file
                    const parts = tabContextMenuTarget.split('/').filter(p => p);
                    let path = '';
                    for (let i = 0; i < parts.length - 1; i++) {
                        path = path ? `${path}/${parts[i]}` : parts[i];
                        expandedFolders.add(path);
                    }
                    updateFileList();
                    showToast(I18N.t('pythonIde.toast.revealedInExplorer') || '已在文件树中展开', 'success');
                    break;
            }
            hideAllContextMenus();
        }

        // Handle output context menu actions
        function handleOutputContextMenuAction(action) {
            const consoleDiv = document.getElementById('consoleOutput');
            
            switch (action) {
                case 'copyOutput':
                    const text = consoleDiv.innerText;
                    if (text.trim()) {
                        navigator.clipboard.writeText(text).then(() => {
                            showToast(I18N.t('pythonIde.toast.outputCopied') || '输出已复制', 'success');
                        });
                    } else {
                        showToast(I18N.t('pythonIde.toast.noOutput') || '没有可复制的内容', 'warning');
                    }
                    break;
                case 'clearOutput':
                    clearOutput();
                    showToast(I18N.t('pythonIde.toast.cleared') || '输出已清空', 'success');
                    break;
                case 'selectAllOutput':
                    const range = document.createRange();
                    range.selectNodeContents(consoleDiv);
                    const selection = window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(range);
                    break;
            }
            hideAllContextMenus();
        }

        // Handle empty area context menu actions
        function handleEmptyContextMenuAction(action) {
            switch (action) {
                case 'newFile':
                    addNewFile();
                    break;
                case 'newFolder':
                    addNewFolder();
                    break;
                case 'pasteFile':
                    navigator.clipboard.readText().then(text => {
                        // Try to detect if it's a file path or content
                        let parent = getNodeAtPath(currentPath);
                        if (parent.type === 'file') {
                            parent = parent.parent;
                        }
                        const name = 'pasted_file.py';
                        let counter = 1;
                        let finalName = name;
                        while (parent.children[finalName]) {
                            finalName = `pasted_file_${counter}.py`;
                            counter++;
                        }
                        parent.children[finalName] = {
                            name: finalName,
                            type: 'file',
                            fileType: 'text',
                            content: text,
                            parent: parent
                        };
                        updateFileList();
                        switchFile(getFullPath([...getPathArray(parent), finalName]));
                        showToast(I18N.t('pythonIde.toast.fileCreated') || '文件已创建', 'success');
                    }).catch(() => {
                        showToast(I18N.t('pythonIde.toast.clipboardError') || '无法访问剪贴板', 'error');
                    });
                    break;
                case 'toggleFullscreen':
                    toggleFullscreen();
                    break;
            }
            hideAllContextMenus();
        }

        // Helper to get path array from node
        function getPathArray(node) {
            const path = [];
            let current = node;
            while (current && current.parent) {
                path.unshift(current.name);
                current = current.parent;
            }
            return path;
        }

        // Fullscreen toggle
        function toggleFullscreen() {
            const body = document.body;
            const icon = document.getElementById('fullscreenIcon');
            
            if (!document.fullscreenElement) {
                body.requestFullscreen().then(() => {
                    body.classList.add('ide-fullscreen');
                    if (icon) icon.textContent = '🗗';  // 退出全屏图标
                    showToast(I18N.t('pythonIde.toast.fullscreenEnter') || '已进入全屏模式', 'success');
                }).catch(err => {
                    showToast(I18N.t('pythonIde.toast.fullscreenError') || '无法进入全屏模式', 'error');
                });
            } else {
                document.exitFullscreen().then(() => {
                    body.classList.remove('ide-fullscreen');
                    if (icon) icon.textContent = '⛶';  // 进入全屏图标
                    showToast(I18N.t('pythonIde.toast.fullscreenExit') || '已退出全屏模式', 'info');
                });
            }
        }

        // Listen for fullscreen change events
        document.addEventListener('fullscreenchange', () => {
            const icon = document.getElementById('fullscreenIcon');
            if (!document.fullscreenElement) {
                document.body.classList.remove('ide-fullscreen');
                if (icon) icon.textContent = '⛶';
            } else {
                if (icon) icon.textContent = '🗗';
            }
        });

// Initialize all context menus
        function initContextMenus() {
            // Context menu actions for file tree (original menu)
            document.querySelectorAll('#contextMenu .context-menu-item').forEach(item => {
                item.addEventListener('click', () => {
                    handleContextMenuAction(item.dataset.action);
                });
            });
            
            // Hide context menu on click elsewhere
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.context-menu')) {
                    hideContextMenu();
                    hideAllContextMenus();
                }
            });
            
            // Prevent default context menu on file tree
            document.getElementById('fileList').addEventListener('contextmenu', (e) => {
                e.preventDefault();
            });
            
            // Global context menu prevention for IDE
            const ideContainer = document.body;
            ideContainer.addEventListener('contextmenu', (e) => {
                // Allow default context menu only on specific elements
                const allowList = ['INPUT', 'TEXTAREA'];
                const isAllowed = allowList.includes(e.target.tagName) || 
                                 e.target.closest('.rename-input') ||
                                 e.target.closest('.CodeMirror-dialog') ||
                                 e.target.closest('.context-menu'); // Our custom menus
                
                // Check if we're in editor area - our custom menu will handle it
                const isEditorArea = e.target.closest('.CodeMirror');
                const isOutputArea = e.target.closest('#outputPanel');
                const isTabArea = e.target.closest('.editor-tabs');
                const isFileTree = e.target.closest('#fileList');
                const isSidebar = e.target.closest('#sidebar');
                
                // If it's our custom menu area, prevent default but allow our menu to show
                if (isEditorArea || isOutputArea || isTabArea || isFileTree) {
                    e.preventDefault();
                    // Our specific handlers will show the custom menu
                    return;
                }
                
                // For sidebar empty area, show empty menu
                if (isSidebar && !isFileTree) {
                    e.preventDefault();
                    showEmptyContextMenu(e);
                    return;
                }
                
                // For main area empty space
                const isMainArea = e.target.closest('main');
                if (isMainArea && !isEditorArea && !isTabArea) {
                    e.preventDefault();
                    showEmptyContextMenu(e);
                    return;
                }
                
                if (!isAllowed) {
                    e.preventDefault();
                }
            });
            
            // Prevent text selection during drag/long-press on tabs and file items
            document.querySelectorAll('.editor-tab, .file-tree-item').forEach(el => {
                el.addEventListener('selectstart', (e) => {
                    e.preventDefault();
                });
            });
            
            // Editor context menu
            document.querySelectorAll('#editorContextMenu .context-menu-item').forEach(item => {
                item.addEventListener('click', () => {
                    handleEditorContextMenuAction(item.dataset.action);
                });
            });
            
            // Tab context menu
            document.querySelectorAll('#tabContextMenu .context-menu-item').forEach(item => {
                item.addEventListener('click', () => {
                    handleTabContextMenuAction(item.dataset.action);
                });
            });
            
            // Output context menu
            document.querySelectorAll('#outputContextMenu .context-menu-item').forEach(item => {
                item.addEventListener('click', () => {
                    handleOutputContextMenuAction(item.dataset.action);
                });
            });
            
            // Empty area context menu
            document.querySelectorAll('#emptyContextMenu .context-menu-item').forEach(item => {
                item.addEventListener('click', () => {
                    handleEmptyContextMenuAction(item.dataset.action);
                });
            });
            
            // Setup editor context menu
            const editorWrapper = document.querySelector('.CodeMirror');
            if (editorWrapper) {
                editorWrapper.addEventListener('contextmenu', (e) => {
                    if (e.target.closest('.CodeMirror')) {
                        showEditorContextMenu(e);
                    }
                });
                
                // Long press for editor
                initLongPress(editorWrapper, (e) => {
                    const touch = e.touches[0];
                    showEditorContextMenu({ 
                        preventDefault: () => {}, 
                        stopPropagation: () => {},
                        clientX: touch.clientX,
                        clientY: touch.clientY
                    });
                });
            }
            
            // Setup output context menu
            const outputArea = document.getElementById('outputPanel');
            if (outputArea) {
                outputArea.addEventListener('contextmenu', (e) => {
                    if (!e.target.closest('button')) {
                        showOutputContextMenu(e);
                    }
                });
                
                initLongPress(outputArea, (e) => {
                    const touch = e.touches[0];
                    showOutputContextMenu({ 
                        preventDefault: () => {}, 
                        stopPropagation: () => {},
                        clientX: touch.clientX,
                        clientY: touch.clientY
                    });
                });
            }
            
            // Setup empty area context menu for sidebar and main areas
            const sidebar = document.getElementById('sidebar');
            if (sidebar) {
                sidebar.addEventListener('contextmenu', (e) => {
                    if (!e.target.closest('.file-tree-item') && !e.target.closest('button')) {
                        showEmptyContextMenu(e);
                    }
                });
            }
            
            const mainArea = document.querySelector('main');
            if (mainArea) {
                mainArea.addEventListener('contextmenu', (e) => {
                    if (!e.target.closest('.CodeMirror') && !e.target.closest('.editor-tabs') && !e.target.closest('button')) {
                        showEmptyContextMenu(e);
                    }
                });
            }
        }
