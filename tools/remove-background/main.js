let originalImage = null;
let originalImageData = null;
let isProcessing = false;
let isPickingColor = false;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 初始化 i18n
    I18N.init().then(() => {
        I18N.initLanguageSwitcher('.language-switcher-container');
    });

    // 全局粘贴监听
    document.addEventListener('paste', handleGlobalPaste);
    
    // 拖拽支持
    setupDragDrop();
});

function handleGlobalPaste(e) {
    e.preventDefault();
    const items = e.clipboardData.items;
    
    for (let item of items) {
        if (item.type.indexOf('image') !== -1) {
            const blob = item.getAsFile();
            loadImage(blob);
            showToast(I18N.t('removeBackground.toast.pasted'), 'success');
            return;
        }
    }
}

function setupDragDrop() {
    const containers = [document.getElementById('originalContainer'), document.getElementById('resultContainer')];
    
    containers.forEach(container => {
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            container.style.borderColor = '#667eea';
            container.style.background = 'rgba(102, 126, 234, 0.1)';
        });
        
        container.addEventListener('dragleave', () => {
            container.style.borderColor = '';
            container.style.background = '';
        });
        
        container.addEventListener('drop', (e) => {
            e.preventDefault();
            container.style.borderColor = '';
            container.style.background = '';
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('image/')) {
                loadImage(files[0]);
            }
        });
    });
}

async function pasteFromClipboard() {
    try {
        const clipboardItems = await navigator.clipboard.read();
        for (const item of clipboardItems) {
            for (const type of item.types) {
                if (type.startsWith('image/')) {
                    const blob = await item.getType(type);
                    await loadImage(blob);
                    showToast(I18N.t('removeBackground.toast.readClipboard'), 'success');
                    return;
                }
            }
        }
        showToast(I18N.t('removeBackground.toast.noImage'), 'warning');
    } catch (err) {
        showToast(I18N.t('removeBackground.toast.useCtrlV'), 'info');
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) loadImage(file);
}

function loadImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                originalImage = img;
                displayOriginal(img);
                processImage();
                resolve();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function displayOriginal(img) {
    const canvas = document.getElementById('originalCanvas');
    const ctx = canvas.getContext('2d');
    
    // 设置画布尺寸（限制最大尺寸以保证性能）
    const maxSize = 2000;
    let width = img.width;
    let height = img.height;
    
    if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width *= ratio;
        height *= ratio;
    }
    
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);
    
    // 保存原始数据
    originalImageData = ctx.getImageData(0, 0, width, height);
    
    // 更新 UI
    canvas.classList.remove('hidden');
    document.getElementById('originalPlaceholder').classList.add('hidden');
    document.getElementById('originalContainer').classList.add('has-image');
    document.getElementById('originalInfo').textContent = `${Math.round(width)}×${Math.round(height)}`;
    document.getElementById('statusText').textContent = I18N.t('removeBackground.status.processing');
}

function updateSettings() {
    const mode = document.getElementById('removeMode').value;
    const colorContainer = document.getElementById('colorPickerContainer');
    
    if (mode === 'color') {
        colorContainer.style.display = 'block';
    } else {
        colorContainer.style.display = 'none';
    }
    
    document.getElementById('toleranceValue').textContent = document.getElementById('tolerance').value;
    
    if (originalImage) {
        processImage();
    }
}

function updateColorFromHex() {
    const hex = document.getElementById('colorHex').value;
    if (/^#[0-9A-F]{6}$/i.test(hex)) {
        document.getElementById('targetColor').value = hex;
        document.querySelector('.color-picker-wrapper').style.backgroundColor = hex;
        processImage();
    }
}

function processImage() {
    if (!originalImageData || isProcessing) return;
    isProcessing = true;
    
    const canvas = document.getElementById('resultCanvas');
    const ctx = canvas.getContext('2d');
    
    // 设置尺寸
    canvas.width = originalImageData.width;
    canvas.height = originalImageData.height;
    
    // 复制原始数据
    const newImageData = new ImageData(
        new Uint8ClampedArray(originalImageData.data),
        originalImageData.width,
        originalImageData.height
    );
    
    const data = newImageData.data;
    const mode = document.getElementById('removeMode').value;
    const tolerance = parseInt(document.getElementById('tolerance').value);
    const feather = document.getElementById('feather').checked;
    const invert = document.getElementById('invert').checked;
    
    // 获取目标颜色
    let targetR = 255, targetG = 255, targetB = 255;
    if (mode === 'color') {
        const hex = document.getElementById('targetColor').value;
        targetR = parseInt(hex.slice(1, 3), 16);
        targetG = parseInt(hex.slice(3, 5), 16);
        targetB = parseInt(hex.slice(5, 7), 16);
    } else if (mode === 'auto') {
        // 自动检测四角颜色作为背景
        const corners = [
            0, 
            (originalImageData.width - 1) * 4,
            (originalImageData.height - 1) * originalImageData.width * 4,
            (originalImageData.height - 1) * originalImageData.width * 4 + (originalImageData.width - 1) * 4
        ];
        let avgR = 0, avgG = 0, avgB = 0;
        corners.forEach(idx => {
            avgR += data[idx];
            avgG += data[idx + 1];
            avgB += data[idx + 2];
        });
        targetR = avgR / 4;
        targetG = avgG / 4;
        targetB = avgB / 4;
    }
    
    // 处理像素
    let transparentPixels = 0;
    
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // 计算颜色距离
        const distance = Math.sqrt(
            Math.pow(r - targetR, 2) + 
            Math.pow(g - targetG, 2) + 
            Math.pow(b - targetB, 2)
        );
        
        // 判断是否匹配目标颜色
        let isMatch = distance <= tolerance;
        if (invert) isMatch = !isMatch;
        
        if (isMatch) {
            if (feather && distance > tolerance * 0.5) {
                // 羽化边缘：根据距离计算透明度
                const alpha = Math.min(255, Math.max(0, (distance - tolerance * 0.5) / (tolerance * 0.5) * 255));
                data[i + 3] = alpha;
            } else {
                // 完全透明
                data[i + 3] = 0;
                transparentPixels++;
            }
        }
    }
    
    // 将处理后的数据绘制到画布
    ctx.putImageData(newImageData, 0, 0);
    
    // 更新 UI
    canvas.classList.remove('hidden');
    document.getElementById('resultPlaceholder').classList.add('hidden');
    document.getElementById('resultInfo').textContent = `${canvas.width}×${canvas.height}`;
    document.getElementById('copyBtn').disabled = false;
    document.getElementById('downloadBtn').disabled = false;
    
    const totalPixels = canvas.width * canvas.height;
    const percent = ((transparentPixels / totalPixels) * 100).toFixed(1);
    document.getElementById('statusText').textContent = I18N.t('removeBackground.status.completed', { percent: percent });
    document.getElementById('pixelInfo').textContent = I18N.t('removeBackground.status.transparentPixels', { count: transparentPixels.toLocaleString() });
    
    isProcessing = false;
}

async function copyToClipboard() {
    const canvas = document.getElementById('resultCanvas');
    
    try {
        canvas.toBlob(async (blob) => {
            if (!blob) {
                showToast(I18N.t('removeBackground.toast.copyError'), 'error');
                return;
            }
            
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]);
                showToast(I18N.t('removeBackground.toast.copied'), 'success');
            } catch (err) {
                console.error('Clipboard error:', err);
                showToast(I18N.t('removeBackground.toast.copyError'), 'error');
            }
        }, 'image/png');
    } catch (err) {
        showToast(I18N.t('removeBackground.toast.copyError'), 'error');
    }
}

function downloadImage() {
    const canvas = document.getElementById('resultCanvas');
    const link = document.createElement('a');
    link.download = `transparent_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast(I18N.t('removeBackground.toast.downloadStarted'), 'success');
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const icon = document.getElementById('toastIcon');
    const msg = document.getElementById('toastMessage');
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    icon.textContent = icons[type] || icons.info;
    msg.textContent = message;
    
    // 移除 hidden 类，然后滑入显示
    toast.classList.remove('hidden');
    toast.classList.remove('translate-x-full');
    
    setTimeout(() => {
        toast.classList.add('translate-x-full');
        // 等待动画完成后隐藏
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 300);
    }, 3000);
}

// 颜色选择器同步
document.getElementById('targetColor').addEventListener('input', (e) => {
    document.querySelector('.color-picker-wrapper').style.backgroundColor = e.target.value;
    document.getElementById('colorHex').value = e.target.value.toUpperCase();
    processImage();
});

// 从图片选取颜色功能
function startColorPicking() {
    if (!originalImage) {
        showToast(I18N.t('removeBackground.toast.uploadFirst'), 'warning');
        return;
    }
    
    isPickingColor = true;
    const container = document.getElementById('originalContainer');
    const canvas = document.getElementById('originalCanvas');
    const hint = document.getElementById('pickColorHint');
    const btn = document.getElementById('pickColorBtn');
    const preview = document.getElementById('colorPreview');
    
    // 添加视觉反馈
    container.classList.add('picking-cursor');
    hint.classList.remove('hidden');
    btn.classList.add('bg-red-600', 'hover:bg-red-700');
    btn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
    btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg> ' + I18N.t('removeBackground.buttons.paste');
    btn.onclick = stopColorPicking;
    
    // 添加叠加层动画
    let overlay = container.querySelector('.picking-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'picking-overlay';
        container.appendChild(overlay);
    }
    
    // 绑定点击事件
    canvas.addEventListener('click', handleColorPick);
    canvas.addEventListener('mousemove', handleColorPreview);
    document.addEventListener('keydown', handlePickKeydown);
    
    showToast(I18N.t('removeBackground.toast.pickColorHint'), 'info');
}

function stopColorPicking() {
    isPickingColor = false;
    const container = document.getElementById('originalContainer');
    const canvas = document.getElementById('originalCanvas');
    const hint = document.getElementById('pickColorHint');
    const btn = document.getElementById('pickColorBtn');
    const preview = document.getElementById('colorPreview');
    
    container.classList.remove('picking-cursor');
    hint.classList.add('hidden');
    btn.classList.remove('bg-red-600', 'hover:bg-red-700');
    btn.classList.add('bg-blue-600', 'hover:bg-blue-700');
    btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path></svg> ' + I18N.t('removeBackground.settings.targetColor.picker');
    btn.onclick = startColorPicking;
    
    // 移除叠加层
    const overlay = container.querySelector('.picking-overlay');
    if (overlay) overlay.remove();
    
    // 隐藏预览
    preview.style.display = 'none';
    
    // 解绑事件
    canvas.removeEventListener('click', handleColorPick);
    canvas.removeEventListener('mousemove', handleColorPreview);
    document.removeEventListener('keydown', handlePickKeydown);
}

function handlePickKeydown(e) {
    if (e.key === 'Escape') {
        stopColorPicking();
    }
}

function handleColorPreview(e) {
    if (!isPickingColor || !originalImageData) return;
    
    const canvas = document.getElementById('originalCanvas');
    const preview = document.getElementById('colorPreview');
    const rect = canvas.getBoundingClientRect();
    
    // 计算实际缩放比例
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // 获取鼠标在 canvas 上的坐标
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    
    // 检查边界
    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) {
        preview.style.display = 'none';
        return;
    }
    
    // 获取颜色
    const pixelIndex = (y * canvas.width + x) * 4;
    const r = originalImageData.data[pixelIndex];
    const g = originalImageData.data[pixelIndex + 1];
    const b = originalImageData.data[pixelIndex + 2];
    const hex = rgbToHex(r, g, b);
    
    // 更新预览
    preview.style.display = 'block';
    preview.style.left = (e.clientX + 15) + 'px';
    preview.style.top = (e.clientY + 15) + 'px';
    preview.style.backgroundColor = hex;
    preview.setAttribute('data-color', hex.toUpperCase());
}

function handleColorPick(e) {
    if (!isPickingColor || !originalImageData) return;
    
    const canvas = document.getElementById('originalCanvas');
    const rect = canvas.getBoundingClientRect();
    
    // 计算实际缩放比例
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // 获取点击位置在 canvas 上的坐标
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    
    // 检查边界
    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) return;
    
    // 获取颜色
    const pixelIndex = (y * canvas.width + x) * 4;
    const r = originalImageData.data[pixelIndex];
    const g = originalImageData.data[pixelIndex + 1];
    const b = originalImageData.data[pixelIndex + 2];
    const hex = rgbToHex(r, g, b);
    
    // 设置为目标颜色
    document.getElementById('targetColor').value = hex;
    document.querySelector('.color-picker-wrapper').style.backgroundColor = hex;
    document.getElementById('colorHex').value = hex.toUpperCase();
    
    // 切换到指定颜色模式
    document.getElementById('removeMode').value = 'color';
    document.getElementById('colorPickerContainer').style.display = 'block';
    
    // 重新处理图片
    processImage();
    
    // 停止取色模式
    stopColorPicking();
    
    showToast(I18N.t('removeBackground.toast.colorPicked', { color: hex.toUpperCase() }), 'success');
}

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}
