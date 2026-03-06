let originalImage = null;
let currentImage = null;
let canvas = null;
let ctx = null;
let history = [];
let historyIndex = -1;
let isCropMode = false;
let isDrawingCrop = false;
let isMovingCrop = false;
let isResizingCrop = false;
let cropRect = { x: 0, y: 0, width: 0, height: 0 };
let cropRatio = null;
let cropStartPos = { x: 0, y: 0 };
let cropMoveStart = { x: 0, y: 0, rectX: 0, rectY: 0 };
let resizeHandle = null;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    I18N.init().then(() => {
        I18N.initLanguageSwitcher('.language-switcher-container');
    });

    canvas = document.getElementById('editorCanvas');
    ctx = canvas.getContext('2d');

    setupDragDrop();
    setupCanvasCropEvents();
});

function setupDragDrop() {
    const container = document.getElementById('canvasContainer');
    
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
}

// 设置画布裁剪事件
function setupCanvasCropEvents() {
    const container = document.getElementById('canvasContainer');
    const canvas = document.getElementById('editorCanvas');

    container.addEventListener('mousedown', handleContainerMouseDown);
    container.addEventListener('mousemove', handleContainerMouseMove);
    document.addEventListener('mouseup', handleContainerMouseUp);

    container.addEventListener('touchstart', handleContainerTouchStart, { passive: false });
    container.addEventListener('touchmove', handleContainerTouchMove, { passive: false });
    document.addEventListener('touchend', handleContainerMouseUp);

    // 裁剪选择区域的事件
    const selection = document.getElementById('cropSelection');
    selection.addEventListener('mousedown', handleSelectionMouseDown);

    // 调整手柄的事件
    const handles = selection.querySelectorAll('.crop-handle');
    handles.forEach(handle => {
        handle.addEventListener('mousedown', handleResizeMouseDown);
    });
}

function handleContainerMouseDown(e) {
    if (!isCropMode || !currentImage) return;
    
    const container = document.getElementById('canvasContainer');
    const canvasEl = document.getElementById('editorCanvas');
    const rect = canvasEl.getBoundingClientRect();
    
    // 检查是否点击在 canvas 上
    if (e.target !== canvasEl && !e.target.classList.contains('crop-mask')) return;
    
    e.preventDefault();
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    isDrawingCrop = true;
    cropStartPos = { x, y };
    
    // 初始化裁剪区域
    cropRect = { x, y, width: 0, height: 0 };
    
    // 显示选择框
    const selection = document.getElementById('cropSelection');
    selection.classList.remove('hidden');
    
    updateCropOverlay();
}

function handleContainerTouchStart(e) {
    if (!isCropMode || !currentImage) return;
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = { clientX: touch.clientX, clientY: touch.clientY, target: e.target };
    handleContainerMouseDown(mouseEvent);
}

function handleContainerMouseMove(e) {
    if (!isCropMode || !currentImage) return;
    
    const canvasEl = document.getElementById('editorCanvas');
    const rect = canvasEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (isDrawingCrop) {
        // 正在绘制裁剪区域
        let width = Math.abs(x - cropStartPos.x);
        let height = Math.abs(y - cropStartPos.y);
        
        // 应用比例约束
        if (cropRatio !== null) {
            if (width / height > cropRatio) {
                width = height * cropRatio;
            } else {
                height = width / cropRatio;
            }
        }
        
        // 计算左上角位置
        let startX = cropStartPos.x;
        let startY = cropStartPos.y;
        
        if (x < cropStartPos.x) {
            startX = cropStartPos.x - width;
        }
        if (y < cropStartPos.y) {
            startY = cropStartPos.y - height;
        }
        
        // 限制在画布范围内
        startX = Math.max(0, Math.min(startX, rect.width - width));
        startY = Math.max(0, Math.min(startY, rect.height - height));
        width = Math.min(width, rect.width - startX);
        height = Math.min(height, rect.height - startY);
        
        cropRect = { x: startX, y: startY, width, height };
        updateCropOverlay();
        updateCropInfo();
    }
    
    // 处理移动和调整大小
    handleCropMoveAndResize(e);
}

function handleContainerTouchMove(e) {
    if (!isCropMode || !isDrawingCrop) return;
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = { clientX: touch.clientX, clientY: touch.clientY };
    handleContainerMouseMove(mouseEvent);
}

function handleContainerMouseUp(e) {
    if (isDrawingCrop) {
        isDrawingCrop = false;
        // 如果裁剪区域太小，取消裁剪
        if (cropRect.width < 10 || cropRect.height < 10) {
            cancelCrop();
            showToast(I18N.t('imageEditor.toast.cropTooSmall'), 'warning');
        } else {
            document.getElementById('cropActions').classList.remove('hidden');
            document.getElementById('cropHint').classList.add('hidden');
        }
    }
    isMovingCrop = false;
    isResizingCrop = false;
    resizeHandle = null;
}

function handleSelectionMouseDown(e) {
    if (!isCropMode) return;
    e.stopPropagation();
    
    isMovingCrop = true;
    cropMoveStart = {
        x: e.clientX,
        y: e.clientY,
        rectX: cropRect.x,
        rectY: cropRect.y
    };
}

function handleResizeMouseDown(e) {
    if (!isCropMode) return;
    e.stopPropagation();
    
    isResizingCrop = true;
    resizeHandle = e.target.dataset.handle;
    cropMoveStart = {
        x: e.clientX,
        y: e.clientY,
        rectX: cropRect.x,
        rectY: cropRect.y,
        rectW: cropRect.width,
        rectH: cropRect.height
    };
}

// 处理移动和调整大小逻辑（在 handleContainerMouseMove 中调用）
function handleCropMoveAndResize(e) {
    if (!isCropMode) return;
    
    const canvasEl = document.getElementById('editorCanvas');
    const rect = canvasEl.getBoundingClientRect();
    
    if (isMovingCrop) {
        const dx = e.clientX - cropMoveStart.x;
        const dy = e.clientY - cropMoveStart.y;
        
        let newX = cropMoveStart.rectX + dx;
        let newY = cropMoveStart.rectY + dy;
        
        // 限制在画布范围内
        newX = Math.max(0, Math.min(newX, rect.width - cropRect.width));
        newY = Math.max(0, Math.min(newY, rect.height - cropRect.height));
        
        cropRect.x = newX;
        cropRect.y = newY;
        updateCropOverlay();
    }
    
    if (isResizingCrop && resizeHandle) {
        const dx = e.clientX - cropMoveStart.x;
        const dy = e.clientY - cropMoveStart.y;
        
        let newX = cropRect.x;
        let newY = cropRect.y;
        let newW = cropRect.width;
        let newH = cropRect.height;
        
        if (resizeHandle.includes('e')) {
            newW = Math.max(20, cropMoveStart.rectW + dx);
        }
        if (resizeHandle.includes('w')) {
            newW = Math.max(20, cropMoveStart.rectW - dx);
            newX = cropMoveStart.rectX + (cropMoveStart.rectW - newW);
        }
        if (resizeHandle.includes('s')) {
            newH = Math.max(20, cropMoveStart.rectH + dy);
        }
        if (resizeHandle.includes('n')) {
            newH = Math.max(20, cropMoveStart.rectH - dy);
            newY = cropMoveStart.rectY + (cropMoveStart.rectH - newH);
        }
        
        // 应用比例约束
        if (cropRatio !== null) {
            if (resizeHandle === 'n' || resizeHandle === 's') {
                newW = newH * cropRatio;
                if (resizeHandle === 'n') {
                    newX = cropMoveStart.rectX + (cropMoveStart.rectW - newW) / 2;
                }
            } else if (resizeHandle === 'e' || resizeHandle === 'w') {
                newH = newW / cropRatio;
                if (resizeHandle === 'w') {
                    newY = cropMoveStart.rectY + (cropMoveStart.rectH - newH) / 2;
                }
            } else {
                // 对角调整
                if (newW / newH > cropRatio) {
                    newW = newH * cropRatio;
                } else {
                    newH = newW / cropRatio;
                }
                if (resizeHandle.includes('w')) {
                    newX = cropMoveStart.rectX + cropMoveStart.rectW - newW;
                }
                if (resizeHandle.includes('n')) {
                    newY = cropMoveStart.rectY + cropMoveStart.rectH - newH;
                }
            }
        }
        
        // 限制在画布范围内
        if (newX >= 0 && newY >= 0 && newX + newW <= rect.width && newY + newH <= rect.height) {
            cropRect = { x: newX, y: newY, width: newW, height: newH };
            updateCropOverlay();
            updateCropInfo();
        }
    }
}

function updateCropOverlay() {
    const container = document.getElementById('canvasContainer');
    const canvasEl = document.getElementById('editorCanvas');
    const selection = document.getElementById('cropSelection');
    const maskTop = document.getElementById('cropMaskTop');
    const maskBottom = document.getElementById('cropMaskBottom');
    const maskLeft = document.getElementById('cropMaskLeft');
    const maskRight = document.getElementById('cropMaskRight');
    
    const rect = canvasEl.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    // 设置选择框位置和大小
    selection.style.left = cropRect.x + 'px';
    selection.style.top = cropRect.y + 'px';
    selection.style.width = cropRect.width + 'px';
    selection.style.height = cropRect.height + 'px';
    
    // 设置遮罩层
    maskTop.style.height = cropRect.y + 'px';
    
    maskBottom.style.top = (cropRect.y + cropRect.height) + 'px';
    
    maskLeft.style.top = cropRect.y + 'px';
    maskLeft.style.width = cropRect.x + 'px';
    maskLeft.style.height = cropRect.height + 'px';
    
    maskRight.style.top = cropRect.y + 'px';
    maskRight.style.left = (cropRect.x + cropRect.width) + 'px';
    maskRight.style.height = cropRect.height + 'px';
}

function updateCropInfo() {
    const canvasEl = document.getElementById('editorCanvas');
    const scaleX = canvasEl.width / canvasEl.getBoundingClientRect().width;
    const scaleY = canvasEl.height / canvasEl.getBoundingClientRect().height;
    
    const actualWidth = Math.round(cropRect.width * scaleX);
    const actualHeight = Math.round(cropRect.height * scaleY);
    
    document.getElementById('cropInfo').textContent = `${actualWidth} x ${actualHeight}`;
}

function toggleCropMode() {
    if (isCropMode) {
        cancelCrop();
    } else {
        startCropMode();
    }
}

function startCropMode() {
    if (!currentImage) return;
    
    isCropMode = true;
    document.getElementById('cropBtn').classList.add('active');
    document.querySelector('#cropBtn span').textContent = I18N.t('imageEditor.tools.crop.cancel');
    document.getElementById('canvasContainer').classList.add('crop-mode');
    document.getElementById('cropOverlayContainer').classList.remove('hidden');
    document.getElementById('cropHint').classList.remove('hidden');
    
    // 隐藏操作按钮直到开始裁剪
    document.getElementById('cropActions').classList.add('hidden');
    document.getElementById('cropSelection').classList.add('hidden');
    
    showToast(I18N.t('imageEditor.toast.cropHint'), 'info');
}

function cancelCrop() {
    isCropMode = false;
    isDrawingCrop = false;
    isMovingCrop = false;
    isResizingCrop = false;
    
    document.getElementById('cropBtn').classList.remove('active');
    document.querySelector('#cropBtn span').textContent = I18N.t('imageEditor.tools.crop.start');
    document.getElementById('canvasContainer').classList.remove('crop-mode');
    document.getElementById('cropOverlayContainer').classList.add('hidden');
    document.getElementById('cropActions').classList.add('hidden');
    document.getElementById('cropSelection').classList.add('hidden');
    document.getElementById('cropHint').classList.add('hidden');
    
    cropRect = { x: 0, y: 0, width: 0, height: 0 };
}

function applyCrop() {
    if (!isCropMode || cropRect.width < 1 || cropRect.height < 1) return;
    
    const canvasEl = document.getElementById('editorCanvas');
    const rect = canvasEl.getBoundingClientRect();
    
    // 计算实际缩放比例
    const scaleX = canvasEl.width / rect.width;
    const scaleY = canvasEl.height / rect.height;
    
    // 计算实际裁剪坐标
    const actualX = cropRect.x * scaleX;
    const actualY = cropRect.y * scaleY;
    const actualWidth = cropRect.width * scaleX;
    const actualHeight = cropRect.height * scaleY;
    
    // 创建临时画布进行裁剪
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCanvas.width = actualWidth;
    tempCanvas.height = actualHeight;
    
    tempCtx.drawImage(
        canvas,
        actualX, actualY, actualWidth, actualHeight,
        0, 0, actualWidth, actualHeight
    );
    
    const img = new Image();
    img.onload = () => {
        currentImage = img;
        displayImage();
        saveToHistory();
        cancelCrop();
        showToast(I18N.t('imageEditor.toast.cropped'), 'success');
    };
    img.src = tempCanvas.toDataURL();
}

function setCropRatio(ratio) {
    cropRatio = ratio;
    
    // 更新按钮状态
    document.getElementById('ratio1Btn').classList.toggle('active', ratio === 1);
    document.getElementById('ratio43Btn').classList.toggle('active', ratio === 4/3);
    document.getElementById('ratio169Btn').classList.toggle('active', ratio === 16/9);
    document.getElementById('ratioFreeBtn').classList.toggle('active', ratio === null);
}

// 其他原有函数
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
                currentImage = img;
                
                history = [];
                historyIndex = -1;
                saveToHistory();
                
                displayImage();
                enableTools();
                showToast(I18N.t('imageEditor.toast.imageLoaded'), 'success');
                resolve();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function displayImage() {
    if (!currentImage) return;

    const maxSize = 2000;
    let width = currentImage.width;
    let height = currentImage.height;
    
    if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width *= ratio;
        height *= ratio;
    }
    
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(currentImage, 0, 0, width, height);
    
    canvas.classList.remove('hidden');
    document.getElementById('canvasPlaceholder').classList.add('hidden');
    document.getElementById('canvasContainer').classList.add('has-image');
    document.getElementById('imageInfo').textContent = `${Math.round(width)}×${Math.round(height)}`;
    document.getElementById('statusText').textContent = I18N.t('imageEditor.status.ready');
    
    document.getElementById('resizeWidth').value = width;
    document.getElementById('resizeHeight').value = height;
}

function enableTools() {
    document.getElementById('downloadBtn').disabled = false;
    document.getElementById('copyBtn').disabled = false;
    document.getElementById('resetBtn').disabled = false;
    document.getElementById('undoBtn').disabled = historyIndex <= 0;
    document.getElementById('rotateLeftBtn').disabled = false;
    document.getElementById('rotateRightBtn').disabled = false;
    document.getElementById('flipHBtn').disabled = false;
    document.getElementById('flipVBtn').disabled = false;
    document.getElementById('cropBtn').disabled = false;
    document.getElementById('ratio1Btn').disabled = false;
    document.getElementById('ratio43Btn').disabled = false;
    document.getElementById('ratio169Btn').disabled = false;
    document.getElementById('ratioFreeBtn').disabled = false;
    document.getElementById('resizeWidth').disabled = false;
    document.getElementById('resizeHeight').disabled = false;
    document.getElementById('resizeBtn').disabled = false;
}

function saveToHistory() {
    history = history.slice(0, historyIndex + 1);
    history.push(canvas.toDataURL());
    historyIndex++;
    
    if (history.length > 20) {
        history.shift();
        historyIndex--;
    }
    
    updateUndoButton();
}

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        restoreFromHistory();
        showToast(I18N.t('imageEditor.toast.undone'), 'success');
    }
}

function restoreFromHistory() {
    const img = new Image();
    img.onload = () => {
        currentImage = img;
        displayImage();
        updateUndoButton();
    };
    img.src = history[historyIndex];
}

function updateUndoButton() {
    document.getElementById('undoBtn').disabled = historyIndex <= 0;
}

function resetImage() {
    if (!originalImage) return;
    
    currentImage = originalImage;
    history = [];
    historyIndex = -1;
    saveToHistory();
    displayImage();
    
    showToast(I18N.t('imageEditor.toast.reset'), 'success');
}

function rotate(degrees) {
    if (!currentImage) return;
    
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    if (Math.abs(degrees) === 90) {
        tempCanvas.width = canvas.height;
        tempCanvas.height = canvas.width;
    } else {
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
    }
    
    tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
    tempCtx.rotate(degrees * Math.PI / 180);
    tempCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
    
    const img = new Image();
    img.onload = () => {
        currentImage = img;
        displayImage();
        saveToHistory();
        showToast(I18N.t('imageEditor.toast.rotated', { degrees: degrees }), 'success');
    };
    img.src = tempCanvas.toDataURL();
}

function flip(direction) {
    if (!currentImage) return;
    
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    
    if (direction === 'horizontal') {
        tempCtx.translate(tempCanvas.width, 0);
        tempCtx.scale(-1, 1);
    } else {
        tempCtx.translate(0, tempCanvas.height);
        tempCtx.scale(1, -1);
    }
    
    tempCtx.drawImage(canvas, 0, 0);
    
    const img = new Image();
    img.onload = () => {
        currentImage = img;
        displayImage();
        saveToHistory();
        showToast(I18N.t('imageEditor.toast.flipped', { direction: direction }), 'success');
    };
    img.src = tempCanvas.toDataURL();
}

function updateResizeHeight() {
    if (!document.getElementById('keepRatio').checked) return;
    
    const width = parseInt(document.getElementById('resizeWidth').value);
    const ratio = canvas.height / canvas.width;
    document.getElementById('resizeHeight').value = Math.round(width * ratio);
}

function updateResizeWidth() {
    if (!document.getElementById('keepRatio').checked) return;
    
    const height = parseInt(document.getElementById('resizeHeight').value);
    const ratio = canvas.width / canvas.height;
    document.getElementById('resizeWidth').value = Math.round(height * ratio);
}

function applyResize() {
    if (!currentImage) return;
    
    const newWidth = parseInt(document.getElementById('resizeWidth').value);
    const newHeight = parseInt(document.getElementById('resizeHeight').value);
    
    if (newWidth < 1 || newHeight < 1) {
        showToast(I18N.t('imageEditor.toast.invalidSize'), 'error');
        return;
    }
    
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCanvas.width = newWidth;
    tempCanvas.height = newHeight;
    
    tempCtx.imageSmoothingEnabled = true;
    tempCtx.imageSmoothingQuality = 'high';
    tempCtx.drawImage(canvas, 0, 0, newWidth, newHeight);
    
    const img = new Image();
    img.onload = () => {
        currentImage = img;
        displayImage();
        saveToHistory();
        showToast(I18N.t('imageEditor.toast.resized'), 'success');
    };
    img.src = tempCanvas.toDataURL();
}

// 从剪贴板粘贴图片
async function pasteFromClipboard() {
    try {
        const clipboardItems = await navigator.clipboard.read();
        let imageFound = false;
        
        for (const item of clipboardItems) {
            for (const type of item.types) {
                if (type.startsWith('image/')) {
                    const blob = await item.getType(type);
                    await loadImage(blob);
                    showToast(I18N.t('imageEditor.toast.pasted'), 'success');
                    imageFound = true;
                    return;
                }
            }
        }
        
        if (!imageFound) {
            showToast(I18N.t('imageEditor.toast.noImageInClipboard'), 'warning');
        }
    } catch (err) {
        console.error('Paste error:', err);
        showToast(I18N.t('imageEditor.toast.pasteError'), 'error');
    }
}

// 复制图片到剪贴板
async function copyToClipboard() {
    if (!currentImage) return;
    
    try {
        canvas.toBlob(async (blob) => {
            if (!blob) {
                showToast(I18N.t('imageEditor.toast.copyError'), 'error');
                return;
            }
            
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]);
                showToast(I18N.t('imageEditor.toast.copied'), 'success');
            } catch (err) {
                console.error('Clipboard write error:', err);
                showToast(I18N.t('imageEditor.toast.copyError'), 'error');
            }
        }, 'image/png');
    } catch (err) {
        console.error('Copy error:', err);
        showToast(I18N.t('imageEditor.toast.copyError'), 'error');
    }
}

// 全局粘贴快捷键支持
document.addEventListener('paste', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            e.preventDefault();
            const blob = items[i].getAsFile();
            loadImage(blob);
            showToast(I18N.t('imageEditor.toast.pasted'), 'success');
            return;
        }
    }
});

function downloadImage() {
    if (!currentImage) return;
    
    const link = document.createElement('a');
    link.download = `edited_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast(I18N.t('imageEditor.toast.downloadStarted'), 'success');
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
    
    toast.classList.remove('hidden');
    toast.classList.remove('translate-x-full');
    
    setTimeout(() => {
        toast.classList.add('translate-x-full');
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 300);
    }, 3000);
}
